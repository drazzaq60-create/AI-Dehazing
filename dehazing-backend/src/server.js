// require('./config/env');
// const app = require('./app');
// const { connectDB } = require('./config/database');
// const wss = require('./services/websocketService');

// connectDB();

// const authRoutes = require('./routes/authRoutes');

// // Add this with your other routes
// app.use('/api/auth', authRoutes);

// app.listen(process.env.PORT, () => console.log(`Server running on port ${process.env.PORT}`));
// // Add this to your server.js - TEMPORARY TEST ENDPOINT
// app.get('/api/test-token', (req, res) => {
//   try {
//     const jwt = require('jsonwebtoken');

//     console.log('🔐 JWT Secret exists:', !!process.env.JWT_SECRET);

//     const testToken = jwt.sign(
//       { 
//         id: "test-user-123", 
//         email: "test@example.com",
//         name: "Test User"
//       },
//       process.env.JWT_SECRET,
//       { expiresIn: '24h' }
//     );

//     console.log('✅ Generated test token');
//     res.json({ 
//       success: true,
//       token: testToken,
//       message: 'Use this token for testing file uploads'
//     });
//   } catch (error) {
//     console.error('❌ Token generation error:', error);
//     res.status(500).json({ 
//       success: false,
//       error: 'Failed to generate token: ' + error.message 
//     });
//   }
// });


// require('./config/env');
// const http = require('http');
// const app = require('./app');
// const { connectDB } = require('./config/database');
// const { initWebSocket } = require('./services/websocketService');

// // Connect to database
// connectDB();

// // Create HTTP server
// const server = http.createServer(app);

// // Initialize WebSocket with the HTTP server (on same port!)
// const wss = initWebSocket(server);

// // Routes
// const authRoutes = require('./routes/authRoutes');
// app.use('/api/auth', authRoutes);

// // In your server.js, add:
// const videoRoutes = require('E:\DehazingCompleteApp\dehazing-backend\src\routes\videoProcessing.js');
// app.use('/api', videoRoutes);

// // Test endpoint for JWT tokens
// app.get('/api/test-token', (req, res) => {
//   try {
//     const jwt = require('jsonwebtoken');

//     console.log('🔐 JWT Secret exists:', !!process.env.JWT_SECRET);

//     const testToken = jwt.sign(
//       { 
//         id: "test-user-123", 
//         email: "test@example.com",
//         name: "Test User"
//       },
//       process.env.JWT_SECRET,
//       { expiresIn: '24h' }
//     );

//     console.log('✅ Generated test token');
//     res.json({ 
//       success: true,
//       token: testToken,
//       message: 'Use this token for testing file uploads'
//     });
//   } catch (error) {
//     console.error('❌ Token generation error:', error);
//     res.status(500).json({ 
//       success: false,
//       error: 'Failed to generate token: ' + error.message 
//     });
//   }
// });

// // Health check endpoint
// app.get('/api/health', (req, res) => {
//   res.json({
//     status: 'ok',
//     server: 'running',
//     websocket: wss ? 'active' : 'inactive',
//     timestamp: new Date().toISOString()
//   });
// });

// // Start server with both HTTP and WebSocket on the SAME port
// const PORT = process.env.PORT || 3000;

// server.listen(PORT, () => {
//   console.log('═══════════════════════════════════════════');
//   console.log('🚀 Dehazing Backend Server Started');
//   console.log('═══════════════════════════════════════════');
//   console.log(`📡 HTTP API:    http://localhost:${PORT}`);
//   console.log(`🔌 WebSocket:   ws://localhost:${PORT}`);
//   console.log(`💾 MongoDB:     Connected`);
//   console.log(`✅ Status:      Ready to accept connections`);
//   console.log('═══════════════════════════════════════════');
// });

// // Graceful shutdown
// process.on('SIGTERM', () => {
//   console.log('🛑 SIGTERM received, shutting down gracefully...');
//   server.close(() => {
//     console.log('✅ Server closed');
//     process.exit(0);
//   });
// });

const express = require('express');
const http = require('http');
const cors = require('cors');
const { initWebSocket } = require('./services/websocketService');
const { connectDB } = require('./config/database');
const { getLocalIP } = require('./utils/ipHelper');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const server = http.createServer(app);

// Connect to MongoDB
connectDB();

// Initialize WebSocket will happen after listen
// initWebSocket(server);

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/process', require('./routes/processingRoutes'));
app.use('/api/realtime', require('./routes/realtimeRoutes'));

// Health check
app.get('/', (req, res) => {
  res.json({
    status: 'Dehazing backend running',
    version: '2.0',
    features: ['WebSocket', 'Real-time processing', 'Video generation']
  });
});

// Download endpoint
app.get('/api/download/:sessionId', (req, res) => {
  const path = require('path');
  const fs = require('fs');
  const videoPath = path.join(__dirname, '..', 'temp', req.params.sessionId, 'output.mp4');

  console.log(`📥 Download request for ${req.params.sessionId}`);
  console.log(`🔍 Checking path: ${videoPath}`);

  if (fs.existsSync(videoPath)) {
    console.log(`✅ File found! Sending to client...`);
    res.download(videoPath, `dehazed_${req.params.sessionId}.mp4`);
  } else {
    console.error(`❌ File NOT found at: ${videoPath}`);
    res.status(404).json({ error: 'Video not found', path: videoPath });
  }
});
const PORT = process.env.PORT || 3000;

function startServer() {
  console.log(`Preparing port ${PORT}...`);

  server.listen(PORT, '0.0.0.0', () => {
    const localIP = getLocalIP();
    console.log('='.repeat(50));
    console.log(`Backend running on port ${PORT}`);
    console.log(`HTTP API:    http://${localIP}:${PORT}`);
    console.log(`WebSocket:   ws://${localIP}:${PORT}`);
    console.log(`Mobile app should connect to: http://${localIP}:${PORT}`);
    console.log('='.repeat(50));

    console.log('Initializing WebSocket server...');
    initWebSocket(server);
    console.log('WebSocket server initialized and ready.');
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use. Stop the other process or use a different port.`);
    } else {
      console.error(`Server failed to start: ${err.message}`);
    }
    process.exit(1);
  });
}

startServer();
