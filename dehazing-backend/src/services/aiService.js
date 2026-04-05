const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const http = require('http');
const https = require('https');

// ============================================
// CONFIGURATION
// ============================================

// If COLAB_URL is set, cloud mode sends frames to Google Colab via HTTP.
// If empty, cloud mode falls back to the local DehazeFormer Python daemon.
const COLAB_URL = (process.env.COLAB_URL || '').replace(/\/+$/, ''); // trim trailing slashes

const processes = {
  cloud: null,
  local: null
};

const resolvers = {
  cloud: [],
  local: []
};

// Use 'python' on Windows, 'python3' on macOS/Linux
const PYTHON_CMD = os.platform() === 'win32' ? 'python' : 'python3';

// Cloud mode: full DehazeFormer AI model (requires PyTorch + GPU-accelerated)
const DEHAZEFORMER_SCRIPT = path.join(__dirname, '..', '..', '..', 'scripts', 'dehazeformer_daemon.py');
// Local mode: lightweight AOD-Net simulation (OpenCV only, no PyTorch needed)
const AODNET_SCRIPT = path.join(__dirname, '..', '..', '..', 'scripts', 'aod_net.py');

function getScriptPath(mode) {
  return mode === 'local' ? AODNET_SCRIPT : DEHAZEFORMER_SCRIPT;
}

// ============================================
// COLAB CLOUD PROCESSING (HTTP POST via ngrok)
// ============================================

/**
 * Send a JSON POST request to the Colab server.
 * Uses built-in http/https modules for maximum compatibility.
 */
function postJSON(url, body) {
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
        // ngrok free tier shows a browser warning page; this header skips it
        'ngrok-skip-browser-warning': 'true'
      },
      timeout: 15000
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
      reject(new Error('Colab request timed out (15s)'));
    });

    req.write(data);
    req.end();
  });
}

/**
 * Process a frame via the Google Colab server.
 * Sends base64 frame as HTTP POST, receives dehazed base64 back.
 */
async function processFrameViaColab(frameBase64) {
  const cleanBase64 = frameBase64.replace(/^data:image\/[a-z]+;base64,/, '');

  try {
    const result = await postJSON(`${COLAB_URL}/dehaze`, { frame: cleanBase64 });
    if (result.dehazed) {
      return result.dehazed;
    }
    console.warn('Colab returned no dehazed frame, using original');
    return frameBase64;
  } catch (error) {
    console.error(`Colab processing error: ${error.message}`);
    return frameBase64; // Fallback: return original frame
  }
}

// ============================================
// LOCAL DAEMON PROCESSING (stdin/stdout)
// ============================================

function startProcess(mode) {
  if (processes[mode]) return;

  const script = getScriptPath(mode);
  console.log(`Starting AI daemon for ${mode} mode: ${script}`);
  console.log(`Using Python command: ${PYTHON_CMD}`);

  try {
    const python = spawn(PYTHON_CMD, ['-u', script], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    processes[mode] = python;

    let buffer = '';

    python.stdout.on('data', (data) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop(); // Keep the last incomplete line in buffer

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const resolve = resolvers[mode].shift();
        if (resolve) {
          resolve(trimmed);
        }
      }
    });

    python.stderr.on('data', (data) => {
      // Log stderr but don't treat as fatal — model loading messages go here
      console.log(`AI Daemon (${mode}):`, data.toString().trim());
    });

    python.on('close', (code) => {
      console.warn(`AI Daemon (${mode}) exited with code ${code}`);
      processes[mode] = null;

      // Fail all pending requests for this mode
      const pending = resolvers[mode];
      resolvers[mode] = [];
      pending.forEach(resolve => resolve(null));

      // Auto-restart after 3s
      setTimeout(() => {
        console.log(`Auto-restarting AI daemon for ${mode} mode...`);
        startProcess(mode);
      }, 3000);
    });

    python.on('error', (err) => {
      console.error(`Failed to start AI daemon (${mode}):`, err.message);
      processes[mode] = null;

      // Fail all pending
      const pending = resolvers[mode];
      resolvers[mode] = [];
      pending.forEach(resolve => resolve(null));
    });

    // Dummy write to initialize STDIN stream
    try {
      python.stdin.write('\n');
    } catch (e) {
      console.error(`Initial write to AI Daemon (${mode}) failed:`, e.message);
    }
  } catch (err) {
    console.error(`Failed to spawn AI daemon (${mode}):`, err.message);
  }
}

/**
 * Process a frame via a local Python daemon (stdin/stdout IPC).
 */
async function processFrameViaLocalDaemon(frameBase64, mode) {
  // Ensure daemon is running
  if (!processes[mode]) {
    startProcess(mode);
    // Wait a moment for daemon to initialize on first call
    await new Promise(r => setTimeout(r, 500));
  }

  if (!processes[mode]) {
    console.warn(`AI Daemon (${mode}) not available, returning original frame`);
    return frameBase64;
  }

  return new Promise((resolve) => {
    const cleanBase64 = frameBase64.replace(/^data:image\/[a-z]+;base64,/, '');

    // Add to resolver queue
    const resolverFn = (result) => {
      resolve(result || frameBase64);
    };
    resolvers[mode].push(resolverFn);

    // Write frame to persistent daemon stdin
    try {
      processes[mode].stdin.write(cleanBase64 + '\n');
    } catch (e) {
      console.error(`Failed to write to AI Daemon (${mode}):`, e.message);
      // Remove resolver and fallback
      const idx = resolvers[mode].indexOf(resolverFn);
      if (idx !== -1) resolvers[mode].splice(idx, 1);
      resolve(frameBase64);
    }

    // Safety timeout — if daemon hangs, return original frame after 5s
    setTimeout(() => {
      const idx = resolvers[mode].indexOf(resolverFn);
      if (idx !== -1) {
        resolvers[mode].splice(idx, 1);
        console.warn(`AI Daemon (${mode}) timeout on frame, returning original`);
        resolve(frameBase64);
      }
    }, 5000);
  });
}

// ============================================
// MAIN ENTRY POINT
// ============================================

/**
 * Process a single base64-encoded frame through the AI dehazing pipeline.
 *
 * Cloud mode (PRIMARY):
 *   - If COLAB_URL is set in .env → sends frame to Google Colab via HTTP POST (GPU-accelerated)
 *   - If COLAB_URL is empty → falls back to local DehazeFormer Python daemon
 *
 * Local mode (COMING LATER — AOD-Net not yet trained):
 *   - Will use the local AOD-Net daemon once training is complete
 *   - For now, returns original frame with a warning
 */
exports.processFrame = async (frameBase64, mode) => {
  // Cloud mode with Colab URL configured → use remote GPU (PRIMARY PATH)
  if (mode === 'cloud' && COLAB_URL) {
    return processFrameViaColab(frameBase64);
  }

  // Local mode — AOD-Net is not yet trained, return original frame for now
  // Once AOD-Net training is done, this will use processFrameViaLocalDaemon()
  if (mode === 'local') {
    console.warn('Local mode (AOD-Net) is not yet available — model still being trained');
    console.warn('Returning original frame. Switch to Cloud mode for AI dehazing.');
    return frameBase64;
  }

  // Cloud mode without COLAB_URL — fall back to local DehazeFormer daemon
  return processFrameViaLocalDaemon(frameBase64, mode);
};

// ============================================
// STARTUP
// ============================================
if (COLAB_URL) {
  console.log('='.repeat(50));
  console.log(`Cloud mode (PRIMARY): Colab server at ${COLAB_URL}`);
  console.log('Frames in cloud mode will be sent to Colab for GPU dehazing');
  console.log('Local mode (AOD-Net): Not yet available — model still being trained');
  console.log('='.repeat(50));
  // No local daemon pre-warming — AOD-Net is not trained yet
} else {
  console.log('No COLAB_URL set — cloud mode will use local DehazeFormer daemon');
  console.log('To use Colab GPU: set COLAB_URL in .env (see colab_server.ipynb)');
  console.log('Local mode (AOD-Net): Not yet available — model still being trained');
  console.log('Pre-warming AI daemon (cloud mode)...');
  startProcess('cloud');
}
