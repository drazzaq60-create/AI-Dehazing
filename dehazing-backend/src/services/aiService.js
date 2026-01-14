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

/**
 * Process frame with AI dehazing
 */
exports.processFrame = async (frameBase64, mode) => {
  return new Promise((resolve, reject) => {
    
    // 🛠️ FINAL FIX: Using THREE '..' segments to move up to E:\DehazingCompleteApp\
    const script = mode === 'cloud' 
      ? path.join(__dirname, '..', '..', '..', 'scripts', 'map_net.py')
      : path.join(__dirname, '..', '..', '..', 'scripts', 'aod_net.py');
    
    console.log(`🤖 Processing frame with ${mode} mode`);
    
    // Remove data URI prefix if present
    const cleanBase64 = frameBase64.replace(/^data:image\/[a-z]+;base64,/, '');
    
    // Keeping the 'python' command as it's more standard on Windows
    const python = spawn('python', [script]); 
    
    // ... (rest of the code for stdout, stderr, close, and stdin remains the same)
    
    let result = '';
    let errorOutput = '';
    
    python.stdout.on('data', (data) => {
      result += data.toString();
    });
    
    python.stderr.on('data', (data) => {
      errorOutput += data.toString();
      console.error('❌ Python error:', data.toString());
    });
    
    python.on('close', (code) => {
      if (code === 0 && result.trim()) {
        resolve(result.trim());
      } else {
        console.error(`❌ Python script exited with code ${code}. Stderr: ${errorOutput}`);
        resolve(frameBase64);
      }
    });
    
    python.on('error', (error) => {
      console.error('❌ Failed to start Python process:', error);
      resolve(frameBase64);
    });
    
    // Write the Base64 data to the Python process's stdin
    python.stdin.write(cleanBase64);
    python.stdin.end(); 

    // Optional: Keep the timeout
    setTimeout(() => {
      if (!result) {
        python.kill();
        console.warn('⚠️ Processing timeout, returning original frame');
        resolve(frameBase64);
      }
    }, 3000);
  });
};
