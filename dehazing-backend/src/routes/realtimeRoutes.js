const express = require('express');
const router = express.Router();
const {
  startRealtimeSession,
  processFrame,
  stopSession,
  downloadVideo,
  getSessionStatus
} = require('../controllers/realtimeController');

// Start real-time session
router.post('/start', startRealtimeSession);

// Process single frame
router.post('/frame', processFrame);

// Stop session and generate video
router.post('/stop', stopSession);

// Download video
router.get('/download/:sessionId', downloadVideo);

// Get session status
router.get('/status/:sessionId', getSessionStatus);

module.exports = router;
