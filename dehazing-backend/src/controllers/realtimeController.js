const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const aiService = require('../services/aiService');

const activeSessions = new Map();

// Start real-time session
exports.startRealtimeSession = async (req, res) => {
  const { userId, mode = 'cloud' } = req.body;
  const sessionId = `rt_${userId}_${Date.now()}_${uuidv4().substring(0, 8)}`;

  // Create temp directory
  const tempDir = path.join(__dirname, '..', '..', 'temp', sessionId);
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  activeSessions.set(sessionId, {
    userId,
    mode,
    tempDir,
    frames: [],
    startTime: Date.now(),
    frameCount: 0
  });

  // Auto-cleanup after 1 hour
  setTimeout(() => {
    cleanupSession(sessionId);
  }, 60 * 60 * 1000);

  res.json({
    success: true,
    sessionId,
    message: 'Real-time session started',
    tempDir
  });
};

// Process single frame
exports.processFrame = async (req, res) => {
  const { sessionId, frame, frameNumber, mode = 'cloud' } = req.body;
  const session = activeSessions.get(sessionId);

  if (!session) {
    return res.status(404).json({
      success: false,
      error: 'Session not found'
    });
  }

  // ✅ Immediate response
  res.json({
    success: true,
    frameNumber,
    received: true,
    timestamp: Date.now()
  });

  // Process in background — run frame through AI dehazing daemon
  try {
    const processedFrame = await aiService.processFrame(frame, mode);
    const cleanFrame = (processedFrame || frame).replace(/^data:image\/[a-z]+;base64,/, '');
    const framePath = path.join(session.tempDir, `dehazed_${frameNumber.toString().padStart(6, '0')}.jpg`);
    fs.writeFileSync(framePath, cleanFrame, 'base64');

    session.frames.push({
      frameNumber,
      timestamp: Date.now(),
      framePath
    });
    session.frameCount++;

    console.log(`Frame ${frameNumber} processed and saved`);

  } catch (error) {
    console.error('Frame processing error:', error);
  }
};

// Stop session and generate video
exports.stopSession = async (req, res) => {
  const { sessionId } = req.body;
  const session = activeSessions.get(sessionId);

  if (!session) {
    return res.status(404).json({
      success: false,
      error: 'Session not found'
    });
  }

  if (session.frameCount === 0) {
    return res.status(400).json({
      success: false,
      error: 'No frames processed'
    });
  }

  console.log(`🎬 Generating video from ${session.frameCount} frames`);

  try {
    // Generate video
    const videoPath = path.join(session.tempDir, 'output.mp4');
    await generateVideo(session.tempDir, videoPath);

    res.json({
      success: true,
      sessionId,
      videoUrl: `/api/realtime/download/${sessionId}`,
      frameCount: session.frameCount,
      duration: Date.now() - session.startTime
    });

  } catch (error) {
    console.error('Video generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Video generation failed'
    });
  }
};

// Download video
exports.downloadVideo = (req, res) => {
  const session = activeSessions.get(req.params.sessionId);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const videoPath = path.join(session.tempDir, 'output.mp4');

  if (!fs.existsSync(videoPath)) {
    return res.status(404).json({ error: 'Video not found' });
  }

  res.download(videoPath, `dehazed_${req.params.sessionId}.mp4`, (err) => {
    if (err) {
      console.error('Download error:', err);
    }
  });
};

// Helper functions
async function processWithAI(frameBase64, mode) {
  return new Promise((resolve) => {
    const script = mode === 'cloud'
      ? path.join(__dirname, '..', '..', 'scripts', 'aod_net.py')
      : path.join(__dirname, '..', '..', 'scripts', 'mlkd_net.py');

    const cleanFrame = frameBase64.replace(/^data:image\/[a-z]+;base64,/, '');

    const pythonProcess = spawn('python', [script]);

    let result = '';

    pythonProcess.stdout.on('data', (data) => {
      result += data.toString();
    });

    pythonProcess.on('close', () => {
      resolve(result.trim() || frameBase64);
    });

    pythonProcess.stdin.write(cleanFrame);
    pythonProcess.stdin.end();

    setTimeout(() => {
      pythonProcess.kill();
      resolve(frameBase64);
    }, 3000);
  });
}

async function generateVideo(framesDir, outputPath) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-framerate', '10',
      '-pattern_type', 'glob',
      '-i', path.join(framesDir, 'dehazed_*.jpg'),
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-preset', 'fast',
      '-crf', '23',
      outputPath
    ]);

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg failed with code ${code}`));
      }
    });

    ffmpeg.on('error', reject);
  });
}

function cleanupSession(sessionId) {
  const session = activeSessions.get(sessionId);
  if (session && session.tempDir) {
    try {
      fs.rmSync(session.tempDir, { recursive: true, force: true });
      console.log(`🧹 Cleaned session: ${sessionId}`);
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }
  activeSessions.delete(sessionId);
}

// Get session status
exports.getSessionStatus = (req, res) => {
  const session = activeSessions.get(req.params.sessionId);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  res.json({
    success: true,
    sessionId: req.params.sessionId,
    status: {
      frameCount: session.frameCount,
      duration: Date.now() - session.startTime,
      fps: calculateFPS(session),
      mode: session.mode,
      videoGenerated: fs.existsSync(path.join(session.tempDir, 'output.mp4'))
    }
  });
};

function calculateFPS(session) {
  const duration = (Date.now() - session.startTime) / 1000;
  return duration > 0 ? (session.frameCount / duration).toFixed(1) : '0';
}
