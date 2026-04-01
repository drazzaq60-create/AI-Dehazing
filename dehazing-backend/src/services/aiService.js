const { spawn } = require('child_process');
const path = require('path');
const os = require('os');

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
  if (mode === 'local') {
    return AODNET_SCRIPT;
  }
  return DEHAZEFORMER_SCRIPT;
}

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
 * Process a single base64-encoded frame through the AI dehazing daemon.
 *
 * How it works:
 * 1. Writes the base64 frame string + newline to the daemon's stdin
 * 2. The Python daemon decodes it, runs inference, encodes result back to base64
 * 3. The daemon writes the result + newline to stdout
 * 4. We read it here and resolve the promise
 *
 * Falls back to returning the original frame if the daemon is unavailable or times out.
 */
exports.processFrame = async (frameBase64, mode) => {
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
};

// Pre-warm the cloud daemon on startup (local starts on first request)
console.log('Pre-warming AI daemon (cloud mode)...');
startProcess('cloud');
