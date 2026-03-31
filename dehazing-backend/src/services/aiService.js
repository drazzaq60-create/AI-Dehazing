// const { spawn } = require('child_process');

// exports.processFrame = async (frame, mode) => {
//   return new Promise((resolve) => {
//     const script = mode === 'cloud' ? 'scripts/map_net.py' : 'scripts/aod_net.py';
//     const python = spawn('python', [script, frame]);
//     python.stdout.on('data', (data) => resolve(data.toString()));
//     python.stderr.on('data', (err) => console.error('AI Error:', err));
//     python.on('close', () => resolve('processed_frame_placeholder'));  // Fallback
//   });
// };

// const { spawn } = require('child_process');
// const path = require('path');

// /**
//  * Process frame with AI dehazing
//  */
// exports.processFrame = async (frameBase64, mode) => {
//   return new Promise((resolve, reject) => {
//     const script = mode === 'cloud' 
//       ? path.join(__dirname, '..', '..', 'scripts', 'map_net.py')
//       : path.join(__dirname, '..', '..', 'scripts', 'aod_net.py');

//     console.log(`🤖 Processing frame with ${mode} mode`);

//     // Remove data URI prefix if present
//     const cleanBase64 = frameBase64.replace(/^data:image\/[a-z]+;base64,/, '');

//     const python = spawn('python3', [script, cleanBase64]);

//     let result = '';
//     let errorOutput = '';

//     python.stdout.on('data', (data) => {
//       result += data.toString();
//     });

//     python.stderr.on('data', (data) => {
//       errorOutput += data.toString();
//       console.error('❌ Python error:', data.toString());
//     });

//     python.on('close', (code) => {
//       if (code === 0 && result) {
//         resolve(result.trim());
//       } else {
//         console.error(`❌ Python script exited with code ${code}`);
//         // Fallback: return original frame if processing fails
//         resolve(frameBase64);
//       }
//     });

//     python.on('error', (error) => {
//       console.error('❌ Failed to start Python process:', error);
//       resolve(frameBase64); // Fallback
//     });

//     // Timeout after 5 seconds
//     setTimeout(() => {
//       python.kill();
//       console.warn('⚠️ Processing timeout, returning original frame');
//       resolve(frameBase64);
//     }, 3000);
//   });
// };

const { spawn } = require('child_process');
const path = require('path');

const processes = {
  cloud: null,
  local: null
};

const resolvers = {
  cloud: [],
  local: []
};

function getScriptPath(mode) {
  return mode === 'cloud'
    ? path.join(__dirname, '..', '..', '..', 'scripts', 'dehazeformer_daemon.py')
    : path.join(__dirname, '..', '..', '..', 'scripts', 'aod_net.py');
}

function startProcess(mode) {
  if (processes[mode]) return;

  const script = getScriptPath(mode);
  console.log(`🚀 Starting persistent AI daemon for ${mode} mode...`);

  const python = spawn('python3', ['-u', script]);
  processes[mode] = python;

  let buffer = '';
  let stderrBuffer = '';

  python.stdout.on('data', (data) => {
    buffer += data.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop(); // Keep the last incomplete line in buffer

    for (const line of lines) {
      const resolve = resolvers[mode].shift();
      if (resolve) {
        resolve(line.trim());
      }
    }
  });

  python.stderr.on('data', (data) => {
    const msg = data.toString();
    stderrBuffer += msg;
    console.error(`❌ AI Daemon (${mode}) Error:`, msg);
  });

  python.on('close', (code) => {
    console.warn(`⚠️ AI Daemon (${mode}) exited with code ${code}. Stderr: ${stderrBuffer}`);
    processes[mode] = null;

    // Fail all pending requests for this mode
    const pending = resolvers[mode];
    resolvers[mode] = [];
    pending.forEach(resolve => resolve(null));

    // Auto-restart after 2s
    setTimeout(() => startProcess(mode), 2000);
  });

  // Dummy write to initialize STDIN stream
  try {
    python.stdin.write('\n');
  } catch (e) {
    console.error(`❌ Initial write to AI Daemon (${mode}) failed:`, e.message);
  }
}

/**
 * Process frame with persistent AI dehazing
 */
exports.processFrame = async (frameBase64, mode) => {
  // Ensure daemon is running
  if (!processes[mode]) {
    startProcess(mode);
  }

  return new Promise((resolve) => {
    const cleanBase64 = frameBase64.replace(/^data:image\/[a-z]+;base64,/, '');

    // Add to resolver queue
    resolvers[mode].push((result) => {
      resolve(result || frameBase64); // Fallback to original if daemon failed
    });

    // Write to persistent stdin plus a newline for the Python loop
    try {
      processes[mode].stdin.write(cleanBase64 + '\n');
    } catch (e) {
      console.error(`❌ Failed to write to AI Daemon (${mode}):`, e.message);
      // Fallback
      resolvers[mode].pop();
      resolve(frameBase64);
    }

    // Safety timeout in case daemon hangs
    setTimeout(() => {
      // Find and remove this resolver if it hasn't been called
      const idx = resolvers[mode].findIndex(r => r === resolve);
      if (idx !== -1) {
        resolvers[mode].splice(idx, 1);
        console.warn(`⚠️ AI Daemon (${mode}) timeout on frame, returning original`);
        resolve(frameBase64);
      }
    }, 2000);
  });
};

// Pre-warm daemons
startProcess('cloud');
startProcess('local');
