/**
 * AI Service — Routes frames to either Google Colab (DehazeFormer, GPU, cloud)
 * or a local AOD-Net Python daemon (CPU), with automatic RTT-based toggling.
 *
 * Toggle rules (from INTEGRATION_GUIDE):
 *   - RTT < 7s and cloud responding    -> stay on cloud (DehazeFormer)
 *   - RTT >= 7s for 3 consecutive       -> switch to local (AOD-Net)
 *   - Network error / Colab unreachable -> instant switch to local
 *   - Cloud RTT < 3s for 5 consecutive  -> switch back to cloud
 *
 * This module is an EventEmitter — websocketService listens for 'modeSwitch'
 * events and broadcasts them to connected app clients.
 */

const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const http = require('http');
const https = require('https');
const EventEmitter = require('events');

class AIService extends EventEmitter {
  constructor() {
    super();

    // Current active mode — starts at cloud if COLAB_URL is set, else local
    this.colabUrl = (process.env.COLAB_URL || '').replace(/\/+$/, '');
    this.mode = this.colabUrl ? 'cloud' : 'local';

    // RTT-based toggling state
    this.consecutiveSlowFrames = 0;
    this.consecutiveFastFrames = 0;
    this.SLOW_THRESHOLD_MS = 7000; // switch to local if RTT >= this
    this.FAST_THRESHOLD_MS = 3000; // switch back to cloud if RTT < this
    this.SLOW_COUNT_LIMIT = 3;     // slow frames before switching to local
    this.FAST_COUNT_LIMIT = 5;     // fast health checks before switching back

    // Local AOD-Net daemon (spawned via Python child process)
    this.aodProcess = null;
    this.aodReady = false;
    this.aodResolvers = [];
    this.aodBuffer = '';
    this._spawnAODDaemon();

    // Recovery health-check timer (only active when in local mode)
    this.recoveryTimer = null;

    this._logStartup();
  }

  // ============================================
  // LOCAL AOD-NET DAEMON MANAGEMENT
  // ============================================

  _spawnAODDaemon() {
    const pythonCmd = os.platform() === 'win32' ? 'python' : 'python3';
    const projectRoot = path.resolve(__dirname, '..', '..', '..');
    const scriptPath = path.join(projectRoot, 'scripts', 'aod_net.py');
    const weightsPath = path.join(projectRoot, 'scripts', 'aodnet_finetuned_best.pth');

    console.log(`[AOD-Net] Spawning daemon: ${pythonCmd} ${scriptPath}`);

    try {
      this.aodProcess = spawn(pythonCmd, ['-u', scriptPath, '--weights', weightsPath], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.aodProcess.stdout.on('data', (data) => {
        this.aodBuffer += data.toString();
        const lines = this.aodBuffer.split('\n');
        this.aodBuffer = lines.pop(); // keep incomplete line in buffer

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          const resolver = this.aodResolvers.shift();
          if (resolver) resolver(trimmed);
        }
      });

      this.aodProcess.stderr.on('data', (data) => {
        const msg = data.toString().trim();
        console.log('[AOD-Net]', msg);
        if (msg.includes('Ready')) this.aodReady = true;
      });

      this.aodProcess.on('exit', (code) => {
        console.warn(`[AOD-Net] Daemon exited with code ${code} — restarting in 2s...`);
        this.aodReady = false;
        this.aodProcess = null;
        // Fail pending requests
        const pending = this.aodResolvers;
        this.aodResolvers = [];
        pending.forEach(r => r(null));
        // Auto-restart
        setTimeout(() => this._spawnAODDaemon(), 2000);
      });

      this.aodProcess.on('error', (err) => {
        console.error('[AOD-Net] Failed to start:', err.message);
        this.aodReady = false;
      });
    } catch (err) {
      console.error('[AOD-Net] spawn failed:', err.message);
    }
  }

  // ============================================
  // CLOUD (COLAB) HTTP CLIENT
  // ============================================

  _postJSON(url, body, timeoutMs) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const lib = urlObj.protocol === 'https:' ? https : http;
      const data = JSON.stringify(body);

      const req = lib.request({
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path: urlObj.pathname + (urlObj.search || ''),
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          // ngrok free tier shows an interstitial HTML page without this header
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
            reject(new Error(`Invalid JSON from Colab: ${responseBody.slice(0, 200)}`));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Colab request timed out (${timeoutMs}ms)`));
      });

      req.write(data);
      req.end();
    });
  }

  _getJSON(url, timeoutMs) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const lib = urlObj.protocol === 'https:' ? https : http;

      const req = lib.get({
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path: urlObj.pathname + (urlObj.search || ''),
        headers: { 'ngrok-skip-browser-warning': 'true' },
        timeout: timeoutMs
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try { resolve(JSON.parse(body)); }
          catch (e) { reject(new Error('Invalid JSON from Colab')); }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    });
  }

  // ============================================
  // FRAME PROCESSING
  // ============================================

  /**
   * Process a single base64-encoded frame.
   * Returns { frame, mode, ms } where mode is the mode that actually processed it.
   */
  async processFrame(frameBase64, requestedMode) {
    const cleanBase64 = frameBase64.replace(/^data:image\/[a-z]+;base64,/, '');

    // Decide which backend to use:
    //   - User explicitly requested a mode AND that mode is currently healthy
    //   - Otherwise, use whatever the auto-toggle has settled on (this.mode)
    const effectiveMode = requestedMode === 'local'
      ? 'local'
      : (this.mode === 'cloud' && this.colabUrl ? 'cloud' : 'local');

    if (effectiveMode === 'cloud') {
      return this._processViaColab(cleanBase64, frameBase64);
    }
    return this._processViaAOD(cleanBase64, frameBase64);
  }

  async _processViaColab(cleanBase64, originalFrame) {
    const t0 = Date.now();
    try {
      const data = await this._postJSON(
        `${this.colabUrl}/dehaze`,
        { frame: cleanBase64 },
        15000
      );
      const rtt = Date.now() - t0;

      if (data && data.dehazed) {
        // Track slow vs fast frames for toggling
        if (rtt >= this.SLOW_THRESHOLD_MS) {
          this.consecutiveSlowFrames++;
          this.consecutiveFastFrames = 0;
          console.log(`[Cloud] SLOW frame: ${rtt}ms (${this.consecutiveSlowFrames}/${this.SLOW_COUNT_LIMIT})`);
          if (this.consecutiveSlowFrames >= this.SLOW_COUNT_LIMIT) {
            this._switchTo('local', `Cloud RTT ${rtt}ms exceeded ${this.SLOW_THRESHOLD_MS}ms threshold`);
          }
        } else {
          this.consecutiveSlowFrames = 0;
        }
        return { frame: data.dehazed, mode: 'cloud', ms: rtt };
      }

      // Empty/bad response — treat as failure and fall back to local
      console.warn('[Cloud] empty response, falling back to local');
      return this._fallbackToLocal(cleanBase64, originalFrame, 'Cloud returned empty response');

    } catch (err) {
      const isNetworkErr = /timed out|fetch|ECONNREFUSED|ENOTFOUND|ECONNRESET|EAI_AGAIN/i.test(err.message);
      console.error(`[Cloud] error: ${err.message}`);
      if (isNetworkErr) {
        this._switchTo('local', `Network error: ${err.message}`);
      }
      // Fall back to local for this frame so the user never sees a blank screen
      return this._fallbackToLocal(cleanBase64, originalFrame, err.message);
    }
  }

  async _fallbackToLocal(cleanBase64, originalFrame, reason) {
    // Try local AOD-Net immediately; if that also fails, return the original frame
    try {
      const local = await this._processViaAOD(cleanBase64, originalFrame);
      return { ...local, mode: 'cloud_fallback', fallbackReason: reason };
    } catch (_) {
      return { frame: originalFrame, mode: 'cloud_fallback', fallbackReason: reason, ms: 0 };
    }
  }

  _processViaAOD(cleanBase64, originalFrame) {
    const t0 = Date.now();
    return new Promise((resolve) => {
      if (!this.aodProcess || this.aodProcess.exitCode !== null || !this.aodReady) {
        console.warn('[AOD-Net] daemon not ready, returning original frame');
        return resolve({ frame: originalFrame, mode: 'local_unavailable', ms: 0 });
      }

      const resolver = (result) => {
        const rtt = Date.now() - t0;
        // If we're currently in local mode, check if cloud has recovered
        if (this.mode === 'local' && this.colabUrl) {
          this._checkColabRecovery();
        }
        resolve({ frame: result || originalFrame, mode: 'local', ms: rtt });
      };
      this.aodResolvers.push(resolver);

      try {
        this.aodProcess.stdin.write(cleanBase64 + '\n');
      } catch (err) {
        console.error('[AOD-Net] write failed:', err.message);
        const idx = this.aodResolvers.indexOf(resolver);
        if (idx !== -1) this.aodResolvers.splice(idx, 1);
        resolve({ frame: originalFrame, mode: 'local_error', ms: 0 });
      }

      // Safety timeout — if daemon hangs, return original after 5s
      setTimeout(() => {
        const idx = this.aodResolvers.indexOf(resolver);
        if (idx !== -1) {
          this.aodResolvers.splice(idx, 1);
          console.warn('[AOD-Net] timeout, returning original frame');
          resolve({ frame: originalFrame, mode: 'local_timeout', ms: 5000 });
        }
      }, 5000);
    });
  }

  // ============================================
  // MODE SWITCHING & RECOVERY
  // ============================================

  _switchTo(newMode, reason) {
    if (this.mode === newMode) return;
    const oldMode = this.mode;
    this.mode = newMode;
    this.consecutiveSlowFrames = 0;
    this.consecutiveFastFrames = 0;
    console.log(`[AIService] Mode switch: ${oldMode} -> ${newMode} (${reason})`);
    this.emit('modeSwitch', { mode: newMode, reason, previousMode: oldMode });
  }

  _checkColabRecovery() {
    // Throttle — only check at most once every 2 seconds
    if (this.recoveryTimer) return;
    this.recoveryTimer = setTimeout(() => { this.recoveryTimer = null; }, 2000);

    if (!this.colabUrl) return;

    (async () => {
      try {
        const t0 = Date.now();
        await this._getJSON(`${this.colabUrl}/health`, 3000);
        const rtt = Date.now() - t0;
        if (rtt < this.FAST_THRESHOLD_MS) {
          this.consecutiveFastFrames++;
          if (this.consecutiveFastFrames >= this.FAST_COUNT_LIMIT) {
            this._switchTo('cloud', `Colab recovered (health RTT ${rtt}ms)`);
          }
        } else {
          this.consecutiveFastFrames = 0;
        }
      } catch (_) {
        this.consecutiveFastFrames = 0;
      }
    })();
  }

  // ============================================
  // PUBLIC GETTERS
  // ============================================

  getMode() { return this.mode; }
  getColabUrl() { return this.colabUrl; }

  _logStartup() {
    console.log('='.repeat(60));
    console.log('[AIService] Started');
    console.log(`[AIService]   Initial mode: ${this.mode}`);
    console.log(`[AIService]   COLAB_URL:    ${this.colabUrl || '(not set)'}`);
    console.log(`[AIService]   Auto-toggle:  slow>=${this.SLOW_THRESHOLD_MS}ms x${this.SLOW_COUNT_LIMIT} -> local`);
    console.log(`[AIService]                 fast<${this.FAST_THRESHOLD_MS}ms x${this.FAST_COUNT_LIMIT} -> cloud`);
    console.log('='.repeat(60));
  }
}

// Export a singleton so websocketService can subscribe to its events
module.exports = new AIService();
