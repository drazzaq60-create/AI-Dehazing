const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const http = require('http');
const https = require('https');
const EventEmitter = require('events');

// ============================================
// CONFIGURATION
// ============================================

const PYTHON_CMD = os.platform() === 'win32' ? 'python' : 'python3';

// Local AOD-Net fallback daemon (CPU, always available)
const AODNET_SCRIPT = path.join(__dirname, '..', '..', '..', 'scripts', 'aod_net.py');
// Weights path — guide §4 specifies `scripts/real_dehaze/aodnet_best` (directory form).
const AODNET_WEIGHTS = path.join(__dirname, '..', '..', '..', 'scripts', 'real_dehaze', 'aodnet_best');

// ============================================
// HTTP POST HELPER (with timeout + abort)
// ============================================
function postJSON(url, body, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const lib = urlObj.protocol === 'https:' ? https : http;
    const data = JSON.stringify(body);

    const req = lib.request({
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'ngrok-skip-browser-warning': 'true'
      },
      timeout: timeoutMs
    }, (res) => {
      let responseBody = '';
      res.on('data', chunk => responseBody += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(responseBody));
        } catch (e) {
          const err = new Error(`Invalid JSON from Colab: ${responseBody.slice(0, 200)}`);
          err.name = 'InvalidJSONError';
          reject(err);
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      const err = new Error('Colab request timed out');
      err.name = 'AbortError';
      reject(err);
    });

    req.write(data);
    req.end();
  });
}

function getJSON(url, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const lib = urlObj.protocol === 'https:' ? https : http;

    const req = lib.request({
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname,
      method: 'GET',
      headers: { 'ngrok-skip-browser-warning': 'true' },
      timeout: timeoutMs
    }, (res) => {
      let responseBody = '';
      res.on('data', chunk => responseBody += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: responseBody }));
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      const err = new Error('Health check timed out');
      err.name = 'AbortError';
      reject(err);
    });
    req.end();
  });
}

// ============================================
// AIService — EventEmitter with auto-toggle logic
// ============================================
class AIService extends EventEmitter {
  constructor() {
    super();

    this.mode = 'cloud';              // 'cloud' | 'local'
    this.consecutiveSlowFrames = 0;
    this.consecutiveFastFrames = 0;

    this.SLOW_THRESHOLD_MS = 7000;
    this.FAST_THRESHOLD_MS = 3000;
    this.SLOW_COUNT_LIMIT = 3;
    this.FAST_COUNT_LIMIT = 5;

    this.colabUrl = (process.env.COLAB_URL || '').replace(/\/+$/, '') || null;

    // AOD daemon plumbing (queue-based stdout parsing preserved from legacy impl)
    this.aodProcess = null;
    this._aodResolvers = [];
    this._aodStdoutBuffer = '';
    this._recoveryInFlight = false;

    this._spawnAODDaemon();
    this._logStartup();
  }

  _logStartup() {
    console.log('='.repeat(50));
    if (this.colabUrl) {
      console.log(`[AIService] Cloud: Colab @ ${this.colabUrl}`);
    } else {
      console.log('[AIService] Cloud: disabled (COLAB_URL empty) — local AOD-Net only');
      this.mode = 'local';
    }
    console.log(`[AIService] Local: AOD-Net daemon (${AODNET_SCRIPT})`);
    console.log('='.repeat(50));
  }

  // --------------------------------------------
  // AOD-Net daemon lifecycle
  // --------------------------------------------
  _spawnAODDaemon() {
    if (this.aodProcess) return;

    try {
      this.aodProcess = spawn(PYTHON_CMD, [
        '-u',
        AODNET_SCRIPT,
        '--weights', AODNET_WEIGHTS
      ], { stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (err) {
      console.error('[AOD-Net] Failed to spawn:', err.message);
      this.aodProcess = null;
      return;
    }

    this.aodProcess.stdout.on('data', (data) => {
      this._aodStdoutBuffer += data.toString();
      const lines = this._aodStdoutBuffer.split('\n');
      this._aodStdoutBuffer = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const resolver = this._aodResolvers.shift();
        if (resolver) resolver(trimmed);
      }
    });

    this.aodProcess.stderr.on('data', (d) => {
      console.log('[AOD-Net]', d.toString().trim());
    });

    this.aodProcess.on('exit', (code) => {
      console.log(`[AOD-Net] Daemon exited (code ${code}) — restarting in 2s...`);
      this.aodProcess = null;
      // Fail any pending requests so callers can fall back
      const pending = this._aodResolvers;
      this._aodResolvers = [];
      pending.forEach(r => r(null));
      setTimeout(() => this._spawnAODDaemon(), 2000);
    });

    this.aodProcess.on('error', (err) => {
      console.error('[AOD-Net] Daemon error:', err.message);
    });

    // Kick stdin so the daemon's line-based read loop is ready
    try {
      this.aodProcess.stdin.write('\n');
    } catch (_) { /* ignore */ }
  }

  // --------------------------------------------
  // Public API
  // --------------------------------------------
  async processFrame(frameBase64, requestedMode) {
    const clean = (frameBase64 || '').replace(/^data:image\/[a-z]+;base64,/, '');
    const useCloud = (requestedMode === 'cloud') && this.colabUrl && (this.mode === 'cloud');

    if (useCloud) {
      return this._processViaColab(clean);
    }
    return this._processViaAOD(clean);
  }

  // --------------------------------------------
  // Cloud path (DehazeFormer via Colab HTTPS)
  // --------------------------------------------
  async _processViaColab(frameBase64) {
    const t0 = Date.now();
    try {
      const data = await postJSON(`${this.colabUrl}/dehaze`, { frame: frameBase64 }, 15000);
      const rtt = Date.now() - t0;

      if (rtt >= this.SLOW_THRESHOLD_MS) {
        this.consecutiveSlowFrames++;
        this.consecutiveFastFrames = 0;
        console.log(`[AIService] Cloud slow: ${rtt}ms (${this.consecutiveSlowFrames}/${this.SLOW_COUNT_LIMIT})`);
        if (this.consecutiveSlowFrames >= this.SLOW_COUNT_LIMIT) {
          this._switchTo('local', `RTT ${rtt}ms exceeded threshold`);
        }
      } else {
        this.consecutiveSlowFrames = 0;
      }

      if (!data || !data.dehazed) {
        return { frame: frameBase64, mode: 'cloud_fallback', ms: rtt, error: 'no dehazed field' };
      }

      return { frame: data.dehazed, mode: 'cloud', ms: rtt };

    } catch (err) {
      const rtt = Date.now() - t0;
      const isDisconnect =
        err.name === 'AbortError' ||
        err.code === 'ENOTFOUND' ||
        err.code === 'ECONNREFUSED' ||
        err.code === 'ECONNRESET' ||
        (err.message || '').toLowerCase().includes('fetch') ||
        (err.message || '').toLowerCase().includes('network');

      if (isDisconnect) {
        this._switchTo('local', `Network/transport error: ${err.message}`);
      }

      return { frame: frameBase64, mode: 'cloud_fallback', ms: rtt, error: err.message };
    }
  }

  // --------------------------------------------
  // Local path (AOD-Net stdin/stdout daemon)
  // --------------------------------------------
  _processViaAOD(frameBase64) {
    const t0 = Date.now();
    return new Promise((resolve) => {
      if (!this.aodProcess || this.aodProcess.exitCode !== null) {
        return resolve({ frame: frameBase64, mode: 'local_unavailable', ms: Date.now() - t0 });
      }

      let settled = false;
      const resolver = (result) => {
        if (settled) return;
        settled = true;
        const rtt = Date.now() - t0;

        // Fire-and-forget recovery probe when running in local mode
        if (this.mode === 'local' && this.colabUrl && !this._recoveryInFlight) {
          this._checkColabRecovery();
        }

        if (result == null) {
          resolve({ frame: frameBase64, mode: 'local_unavailable', ms: rtt });
        } else {
          resolve({ frame: result, mode: 'local', ms: rtt });
        }
      };

      this._aodResolvers.push(resolver);

      try {
        this.aodProcess.stdin.write(frameBase64 + '\n');
      } catch (err) {
        const idx = this._aodResolvers.indexOf(resolver);
        if (idx !== -1) this._aodResolvers.splice(idx, 1);
        settled = true;
        console.error('[AOD-Net] stdin write failed:', err.message);
        resolve({ frame: frameBase64, mode: 'local_unavailable', ms: Date.now() - t0, error: err.message });
      }

      // Safety: never let a stuck daemon hang the pipeline
      setTimeout(() => {
        if (settled) return;
        const idx = this._aodResolvers.indexOf(resolver);
        if (idx !== -1) this._aodResolvers.splice(idx, 1);
        settled = true;
        console.warn('[AOD-Net] timeout — returning original frame');
        resolve({ frame: frameBase64, mode: 'local_timeout', ms: Date.now() - t0 });
      }, 5000);
    });
  }

  // --------------------------------------------
  // Colab recovery probe (background, non-blocking)
  // --------------------------------------------
  async _checkColabRecovery() {
    if (!this.colabUrl) return;
    this._recoveryInFlight = true;
    const t0 = Date.now();
    try {
      await getJSON(`${this.colabUrl}/health`, 3000);
      const rtt = Date.now() - t0;
      if (rtt < this.FAST_THRESHOLD_MS) {
        this.consecutiveFastFrames++;
        if (this.consecutiveFastFrames >= this.FAST_COUNT_LIMIT) {
          this._switchTo('cloud', `Colab recovered (RTT ${rtt}ms)`);
        }
      } else {
        this.consecutiveFastFrames = 0;
      }
    } catch (_) {
      this.consecutiveFastFrames = 0;
    } finally {
      this._recoveryInFlight = false;
    }
  }

  // --------------------------------------------
  // Mode switch (emits event for WebSocket broadcast)
  // --------------------------------------------
  _switchTo(mode, reason) {
    if (this.mode === mode) return;
    this.mode = mode;
    this.consecutiveSlowFrames = 0;
    this.consecutiveFastFrames = 0;
    console.log(`[AIService] Switched to ${mode.toUpperCase()}: ${reason}`);
    this.emit('modeSwitch', { mode, reason });
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================
const instance = new AIService();

// Legacy API: keep `processFrame(frame, mode)` callable as before
// (websocketService already consumes it that way). It now returns the rich
// object { frame, mode, ms, error? } — callers that expect a string should
// migrate, but we also expose the raw string via a .frame accessor.
module.exports = instance;
module.exports.processFrame = instance.processFrame.bind(instance);
