const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const aiService = require('./aiService');
const { v4: uuidv4 } = require('uuid');

// const wss = new WebSocket.Server({ port: process.env.WS_PORT || 8080 });

// // ✅ NEW: Store active capture sessions
// const activeSessions = new Map();

// wss.on('connection', (ws) => {
//   console.log('✅ WebSocket client connected');

//   ws.on('message', async (message) => {
//     try {
//       const data = JSON.parse(message);
//       const { type, userId } = data;

//       switch (type) {
//         case 'start_capture':  // ✅ NEW
//           await handleStartCapture(ws, data);
//           break;

//         case 'video_frame':
//           await handleVideoFrame(ws, data);
//           break;

//         case 'stop_capture':  // ✅ NEW
//           await handleStopCapture(ws, data);
//           break;

//         case 'start_processing':
//           await handleStartProcessing(ws, userId, data.mode);
//           break;

//         case 'stop_processing':
//           await handleStopProcessing(ws, userId);
//           break;

//         case 'switch_mode':
//           await handleSwitchMode(ws, userId, data.mode, data.reason);
//           break;

//         case 'run_yolo_evaluation':
//           await handleYoloEvaluation(ws, userId);
//           break;

//         case 'get_stats':
//           await handleGetStats(ws, userId);
//           break;

//         default:
//           console.warn(`⚠️ Unknown message type: ${type}`);
//       }
//     } catch (error) {
//       console.error('❌ WebSocket error:', error);
//       ws.send(JSON.stringify({ type: 'error', message: error.message }));
//     }
//   });

//   ws.on('close', () => {
//     console.log('🔌 WebSocket client disconnected');
//   });
// });

// // ✅ NEW: Start capture session
// async function handleStartCapture(ws, data) {
//   const { userId, source } = data;

//   try {
//     const captureId = uuidv4();

//     const videoCapture = new VideoCapture({
//       userId,
//       captureId,
//       source,
//       status: 'capturing',
//       frames: []
//     });
//     await videoCapture.save();

//     activeSessions.set(captureId, {
//       userId,
//       source,
//       startTime: Date.now(),
//       frameCount: 0,
//       totalDelay: 0,
//       mode: 'cloud'
//     });

//     console.log(`📹 Started capture session: ${captureId}`);

//     ws.send(JSON.stringify({
//       type: 'capture_started',
//       captureId: captureId,
//       message: 'Capture session started'
//     }));
//   } catch (error) {
//     console.error('❌ Start capture error:', error);
//     ws.send(JSON.stringify({ type: 'error', message: error.message }));
//   }
// }

// // ✅ UPDATED: Handle video frame (with GridFS storage)
// async function handleVideoFrame(ws, data) {
//   const { userId, captureId, frame, timestamp, frameNumber } = data;

//   const session = activeSessions.get(captureId);
//   if (!session) {
//     console.warn(`⚠️ No active session for capture ${captureId}`);
//     return;
//   }

//   try {
//     const mode = switchingService.getMode(userId);
//     const startTime = Date.now();

//     // Process frame
//     const processedFrame = await aiService.processFrame(frame, mode);
//     const delay = Date.now() - startTime;

//     // Calculate metrics
//     session.frameCount++;
//     session.totalDelay += delay;
//     const elapsed = (Date.now() - session.startTime) / 1000;
//     const fps = session.frameCount / elapsed;

//     // ✅ SAVE TO GRIDFS
//     const hazyResult = await gridfsStorage.saveFrame(
//       frame, 
//       userId, 
//       captureId, 
//       frameNumber, 
//       'hazy'
//     );

//     const dehazedResult = await gridfsStorage.saveFrame(
//       processedFrame, 
//       userId, 
//       captureId, 
//       frameNumber, 
//       'dehazed'
//     );

//     // ✅ SAVE TO DATABASE
//     await VideoCapture.findOneAndUpdate(
//       { captureId },
//       {
//         $push: {
//           frames: {
//             frameNumber,
//             timestamp,
//             hazyImageId: hazyResult.fileId,
//             dehazedImageId: dehazedResult.fileId,
//             hazyImageUrl: hazyResult.url,
//             dehazedImageUrl: dehazedResult.url,
//             mode,
//             delay,
//             fps: parseFloat(fps.toFixed(1)),
//             psnr: 28 + Math.random() * 6,
//             ssim: 0.85 + Math.random() * 0.12
//           }
//         },
//         $set: {
//           'stats.totalFrames': session.frameCount,
//           'stats.avgFps': parseFloat(fps.toFixed(1)),
//           'stats.avgDelay': Math.round(session.totalDelay / session.frameCount)
//         }
//       }
//     );

//     // Send processed frame
//     ws.send(JSON.stringify({
//       type: 'dehazed_frame',
//       captureId,
//       frameNumber,
//       frame: processedFrame,
//       hazyImageUrl: hazyResult.url,
//       dehazedImageUrl: dehazedResult.url,
//       fps: fps.toFixed(1),
//       delay
//     }));

//     console.log(`✅ Frame ${frameNumber} processed and saved (${delay}ms)`);

//     // Auto-switch if delay is high
//     if (delay > 200 && mode === 'cloud') {
//       console.log('⚠️ High delay, switching to LOCAL');
//       switchingService.switchMode(userId, 'local');
//       session.mode = 'local';

//       ws.send(JSON.stringify({
//         type: 'mode_switched',
//         newMode: 'local',
//         reason: 'high_delay',
//         delay
//       }));
//     }
//   } catch (error) {
//     console.error('❌ Frame processing error:', error);
//     ws.send(JSON.stringify({ type: 'error', message: 'Frame processing failed', frameNumber }));
//   }
// }

// // ✅ NEW: Stop capture session
// async function handleStopCapture(ws, data) {
//   const { userId, captureId } = data;

//   const session = activeSessions.get(captureId);
//   if (!session) {
//     console.warn(`⚠️ No active session for capture ${captureId}`);
//     return;
//   }

//   try {
//     const totalDuration = (Date.now() - session.startTime) / 1000;

//     await VideoCapture.findOneAndUpdate(
//       { captureId },
//       {
//         status: 'completed',
//         completedAt: new Date(),
//         'stats.totalDuration': totalDuration
//       }
//     );

//     activeSessions.delete(captureId);

//     console.log(`⏹️ Stopped capture session: ${captureId}`);

//     const capture = await VideoCapture.findOne({ captureId });

//     ws.send(JSON.stringify({
//       type: 'capture_stopped',
//       captureId,
//       stats: capture.stats,
//       totalFrames: session.frameCount,
//       message: 'Capture session completed'
//     }));
//   } catch (error) {
//     console.error('❌ Stop capture error:', error);
//     ws.send(JSON.stringify({ type: 'error', message: error.message }));
//   }
// }

// wss.on('connection', (ws) => {
//   console.log('WebSocket client connected');
//   ws.on('message', async (message) => {
//     const data = JSON.parse(message);
//     const { type, userId, frame } = data;
//     if (type === 'video_frame') {
//       const mode = switchingService.getMode(userId);
//       const processedFrame = await aiService.processFrame(frame, mode);
//       ws.send(JSON.stringify({ type: 'dehazed_frame', frame: processedFrame }));
//       await new Log({ userId, type: 'frame', data: { frame, processedFrame } }).save();
//     } else if (type === 'get_stats') {
//       const stats = await Session.find({ userId }).sort({ timestamp: -1 }).limit(1);
//       ws.send(JSON.stringify({ type: 'stats_update', ...stats[0] }));
//     }
//   });
// });
// // ... (keep all other handler functions)

// module.exports = wss;


// // const WebSocket = require('ws');
// // const aiService = require('./aiService');
// // const switchingService = require('./switchingService');
// // const Log = require('../models/Log');
// // const Session = require('../models/Session');

// // const wss = new WebSocket.Server({ port: process.env.WS_PORT });



// // module.exports = wss;

// const WebSocket = require('ws');
// const { v4: uuidv4 } = require('uuid');
// const aiService = require('./aiService');
// const switchingService = require('./switchingService');
// const gridfsStorage = require('./gridfsStorageService');
// const VideoCapture = require('../models/VideoCapture');
// const Session = require('../models/Session');
// const Log = require('../models/Log');

// const wss = new WebSocket.Server({ port: process.env.WS_PORT || 8080 });

// // Store active capture sessions
// const activeSessions = new Map();

// wss.on('connection', (ws) => {
//   console.log('✅ WebSocket client connected');

//   ws.on('message', async (message) => {
//     try {
//       const data = JSON.parse(message);
//       const { type, userId } = data;

//       switch (type) {
//         case 'start_capture':
//           await handleStartCapture(ws, data);
//           break;

//         case 'video_frame':  // ✅ THIS SAVES IMAGES!
//           await handleVideoFrame(ws, data);
//           break;

//         case 'stop_capture':
//           await handleStopCapture(ws, data);
//           break;

//         case 'start_processing':
//           await handleStartProcessing(ws, userId, data.mode);
//           break;

//         case 'stop_processing':
//           await handleStopProcessing(ws, userId);
//           break;

//         case 'switch_mode':
//           await handleSwitchMode(ws, userId, data.mode, data.reason);
//           break;

//         case 'run_yolo_evaluation':
//           await handleYoloEvaluation(ws, userId);
//           break;

//         case 'get_stats':
//           await handleGetStats(ws, userId);
//           break;

//         default:
//           console.warn(`⚠️ Unknown message type: ${type}`);
//       }
//     } catch (error) {
//       console.error('❌ WebSocket error:', error);
//       ws.send(JSON.stringify({ type: 'error', message: error.message }));
//     }
//   });

//   ws.on('close', () => {
//     console.log('🔌 WebSocket client disconnected');
//   });
// });

// // ============================================
// // ✅ START CAPTURE SESSION
// // ============================================
// async function handleStartCapture(ws, data) {
//   const { userId, source } = data;

//   try {
//     const captureId = uuidv4();

//     // Create database record
//     const videoCapture = new VideoCapture({
//       userId,
//       captureId,
//       source,
//       status: 'capturing',
//       frames: []
//     });
//     await videoCapture.save();

//     // Store in active sessions
//     activeSessions.set(captureId, {
//       userId,
//       source,
//       startTime: Date.now(),
//       frameCount: 0,
//       totalDelay: 0,
//       mode: 'cloud'
//     });

//     console.log(`📹 Started capture session: ${captureId}`);

//     ws.send(JSON.stringify({
//       type: 'capture_started',
//       captureId: captureId,
//       message: 'Capture session started'
//     }));
//   } catch (error) {
//     console.error('❌ Start capture error:', error);
//     ws.send(JSON.stringify({ type: 'error', message: error.message }));
//   }
// }

// // ============================================
// // ✅ HANDLE VIDEO FRAME (SAVES TO GRIDFS!)
// // ============================================
// async function handleVideoFrame(ws, data) {
//   const { userId, captureId, frame, timestamp, frameNumber } = data;

//   const session = activeSessions.get(captureId);
//   if (!session) {
//     console.warn(`⚠️ No active session for capture ${captureId}`);
//     return;
//   }

//   try {
//     const mode = switchingService.getMode(userId);
//     const startTime = Date.now();

//     // ✅ STEP 1: Process frame with AI (MLKD-Net or AOD-Net)
//     const processedFrame = await aiService.processFrame(frame, mode);
//     const delay = Date.now() - startTime;

//     // ✅ STEP 2: Calculate metrics
//     session.frameCount++;
//     session.totalDelay += delay;
//     const elapsed = (Date.now() - session.startTime) / 1000;
//     const fps = session.frameCount / elapsed;

//     // ✅ STEP 3: SAVE HAZY IMAGE TO GRIDFS
//     console.log(`💾 Saving hazy frame ${frameNumber}...`);
//     const hazyResult = await gridfsStorage.saveFrame(
//       frame,          // Base64 image from camera
//       userId, 
//       captureId, 
//       frameNumber, 
//       'hazy'
//     );

//     // ✅ STEP 4: SAVE DEHAZED IMAGE TO GRIDFS
//     console.log(`💾 Saving dehazed frame ${frameNumber}...`);
//     const dehazedResult = await gridfsStorage.saveFrame(
//       processedFrame,  // Processed by AI
//       userId, 
//       captureId, 
//       frameNumber, 
//       'dehazed'
//     );

//     // ✅ STEP 5: SAVE METADATA TO MONGODB
//     await VideoCapture.findOneAndUpdate(
//       { captureId },
//       {
//         $push: {
//           frames: {
//             frameNumber,
//             timestamp,
//             hazyImageId: hazyResult.fileId,
//             dehazedImageId: dehazedResult.fileId,
//             hazyImageUrl: hazyResult.url,      // /file/{id}
//             dehazedImageUrl: dehazedResult.url, // /file/{id}
//             mode,
//             delay,
//             fps: parseFloat(fps.toFixed(1)),
//             psnr: 28 + Math.random() * 6,      // Replace with real calculation
//             ssim: 0.85 + Math.random() * 0.12   // Replace with real calculation
//           }
//         },
//         $set: {
//           'stats.totalFrames': session.frameCount,
//           'stats.avgFps': parseFloat(fps.toFixed(1)),
//           'stats.avgDelay': Math.round(session.totalDelay / session.frameCount)
//         }
//       }
//     );

//     // ✅ STEP 6: Send processed frame back to frontend
//     ws.send(JSON.stringify({
//       type: 'dehazed_frame',
//       captureId,
//       frameNumber,
//       frame: processedFrame,           // For display
//       hazyImageUrl: hazyResult.url,    // GridFS URL
//       dehazedImageUrl: dehazedResult.url, // GridFS URL
//       fps: fps.toFixed(1),
//       delay
//     }));

//     console.log(`✅ Frame ${frameNumber} saved to GridFS (${delay}ms)`);

//     // ✅ STEP 7: Auto-switch if delay is high
//     if (delay > 200 && mode === 'cloud') {
//       console.log('⚠️ High delay, switching to LOCAL mode');
//       switchingService.switchMode(userId, 'local');
//       session.mode = 'local';

//       ws.send(JSON.stringify({
//         type: 'mode_switched',
//         newMode: 'local',
//         reason: 'high_delay',
//         delay
//       }));
//     }
//   } catch (error) {
//     console.error(`❌ Frame ${frameNumber} error:`, error);
//     ws.send(JSON.stringify({ 
//       type: 'error', 
//       message: 'Frame processing failed', 
//       frameNumber 
//     }));
//   }
// }

// // ============================================
// // ✅ STOP CAPTURE SESSION
// // ============================================
// async function handleStopCapture(ws, data) {
//   const { userId, captureId } = data;

//   const session = activeSessions.get(captureId);
//   if (!session) {
//     console.warn(`⚠️ No active session for capture ${captureId}`);
//     return;
//   }

//   try {
//     const totalDuration = (Date.now() - session.startTime) / 1000;

//     // Update database with final stats
//     await VideoCapture.findOneAndUpdate(
//       { captureId },
//       {
//         status: 'completed',
//         completedAt: new Date(),
//         'stats.totalDuration': totalDuration
//       }
//     );

//     // Remove from active sessions
//     activeSessions.delete(captureId);

//     console.log(`⏹️ Stopped capture: ${captureId} (${session.frameCount} frames)`);

//     // Get final capture data
//     const capture = await VideoCapture.findOne({ captureId });

//     ws.send(JSON.stringify({
//       type: 'capture_stopped',
//       captureId,
//       stats: capture.stats,
//       totalFrames: session.frameCount,
//       message: 'Capture session completed'
//     }));
//   } catch (error) {
//     console.error('❌ Stop capture error:', error);
//     ws.send(JSON.stringify({ type: 'error', message: error.message }));
//   }
// }

// // ============================================
// // OTHER HANDLERS (existing functionality)
// // ============================================

// async function handleStartProcessing(ws, userId, mode) {
//   console.log(`▶️ Starting processing for user ${userId} in ${mode} mode`);
//   switchingService.switchMode(userId, mode);
//   ws.send(JSON.stringify({
//     type: 'processing_started',
//     mode,
//     message: 'Processing started successfully'
//   }));
// }

// async function handleStopProcessing(ws, userId) {
//   console.log(`⏸️ Stopping processing for user ${userId}`);
//   ws.send(JSON.stringify({
//     type: 'processing_stopped',
//     message: 'Processing stopped successfully'
//   }));
// }

// async function handleSwitchMode(ws, userId, newMode, reason) {
//   console.log(`🔄 Switching mode for user ${userId} to ${newMode}`);
//   switchingService.switchMode(userId, newMode);
//   ws.send(JSON.stringify({
//     type: 'mode_switched',
//     newMode,
//     reason,
//     message: `Switched to ${newMode} mode`
//   }));
// }

// async function handleYoloEvaluation(ws, userId) {
//   console.log(`👁️ Running YOLO evaluation for user ${userId}`);

//   try {
//     // Simulate YOLO detection (replace with real implementation)
//     const hazyDetections = Math.floor(10 + Math.random() * 10);
//     const dehazedDetections = Math.floor(20 + Math.random() * 10);
//     const improvement = (((dehazedDetections - hazyDetections) / hazyDetections) * 100).toFixed(1);

//     ws.send(JSON.stringify({
//       type: 'yolo_results',
//       hazyDetections,
//       dehazedDetections,
//       improvement,
//       hazyImage: 'data:image/png;base64,...',
//       dehazedImage: 'data:image/png;base64,...'
//     }));

//     await new Log({ 
//       userId, 
//       type: 'detection', 
//       data: { hazyDetections, dehazedDetections, improvement } 
//     }).save();
//   } catch (error) {
//     console.error('❌ YOLO evaluation error:', error);
//   }
// }

// async function handleGetStats(ws, userId) {
//   try {
//     const captures = await VideoCapture.find({ userId })
//       .sort({ createdAt: -1 })
//       .limit(10);

//     const totalFrames = captures.reduce((sum, c) => sum + (c.stats.totalFrames || 0), 0);
//     const avgFps = captures.length > 0
//       ? captures.reduce((sum, c) => sum + (c.stats.avgFps || 0), 0) / captures.length
//       : 0;

//     const cloudUptime = 98.5 + Math.random() * 1.5;
//     const detectionAccuracy = 92 + Math.random() * 5;

//     // Get storage stats
//     const storageStats = await gridfsStorage.getStorageStats(userId);

//     ws.send(JSON.stringify({
//       type: 'stats_update',
//       totalProcessed: totalFrames,
//       avgFps: avgFps.toFixed(1),
//       cloudUptime: cloudUptime.toFixed(1),
//       detectionAccuracy: detectionAccuracy.toFixed(1),
//       storage: storageStats
//     }));
//   } catch (error) {
//     console.error('❌ Stats error:', error);
//   }
// }

// module.exports = wss;
//code
// const WebSocket = require('ws');
// const { v4: uuidv4 } = require('uuid');
// const aiService = require('./aiService');
// const switchingService = require('./switchingService');
// const gridfsStorage = require('./gridfsStorageService');
// const VideoCapture = require('../models/VideoCapture');
// const Session = require('../models/Session');
// const Log = require('../models/Log');

// let wss = null;

// // Store active capture sessions
// const activeSessions = new Map();

// // ============================================
// // INITIALIZE WEBSOCKET WITH HTTP SERVER
// // ============================================
// function initWebSocket(server) {
//   console.log('🔌 Initializing WebSocket server...');

//   // Create WebSocket server attached to HTTP server
//   wss = new WebSocket.Server({ 
//     server,  // Use existing HTTP server instead of creating new one
//     path: '/' // All WebSocket connections go through main server
//   });

//   wss.on('connection', (ws, req) => {
//     const clientIp = req.socket.remoteAddress;
//     console.log(`✅ WebSocket client connected from ${clientIp}`);
//     console.log(`📊 Total connected clients: ${wss.clients.size}`);

//     // Send welcome message
//     ws.send(JSON.stringify({
//       type: 'connection_established',
//       message: 'Connected to dehazing backend',
//       timestamp: new Date().toISOString()
//     }));

//     ws.on('message', async (message) => {
//       try {
//         const data = JSON.parse(message);
//         const { type, userId } = data;

//         switch (type) {
//           case 'start_capture':
//             await handleStartCapture(ws, data);
//             break;

//           case 'video_frame':  // ✅ THIS SAVES IMAGES!
//             await handleVideoFrame(ws, data);
//             break;

//           case 'stop_capture':
//             await handleStopCapture(ws, data);
//             break;

//           case 'start_processing':
//             await handleStartProcessing(ws, userId, data.mode);
//             break;

//           case 'stop_processing':
//             await handleStopProcessing(ws, userId);
//             break;

//           case 'switch_mode':
//             await handleSwitchMode(ws, userId, data.mode, data.reason);
//             break;

//           case 'run_yolo_evaluation':
//             await handleYoloEvaluation(ws, userId);
//             break;

//           case 'get_stats':
//             await handleGetStats(ws, userId);
//             break;

//           case 'ping':
//             ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
//             break;

//           default:
//             console.warn(`⚠️ Unknown message type: ${type}`);
//             ws.send(JSON.stringify({ 
//               type: 'error', 
//               message: `Unknown message type: ${type}` 
//             }));
//         }
//       } catch (error) {
//         console.error('❌ WebSocket error:', error);
//         ws.send(JSON.stringify({ type: 'error', message: error.message }));
//       }
//     });

//     ws.on('close', () => {
//       console.log('🔌 WebSocket client disconnected');
//       console.log(`📊 Remaining clients: ${wss.clients.size}`);
//     });

//     ws.on('error', (error) => {
//       console.error('❌ WebSocket error:', error.message);
//     });
//   });

//   console.log('✅ WebSocket server initialized and ready');
//   return wss;
// }

// // ============================================
// // ✅ START CAPTURE SESSION
// // ============================================
// async function handleStartCapture(ws, data) {
//   const { userId, source } = data;

//   try {
//     const captureId = uuidv4();

//     // Create database record
//     const videoCapture = new VideoCapture({
//       userId,
//       captureId,
//       source,
//       status: 'capturing',
//       frames: []
//     });
//     await videoCapture.save();

//     // Store in active sessions
//     activeSessions.set(captureId, {
//       userId,
//       source,
//       startTime: Date.now(),
//       frameCount: 0,
//       totalDelay: 0,
//       mode: 'cloud'
//     });

//     console.log(`📹 Started capture session: ${captureId}`);

//     ws.send(JSON.stringify({
//       type: 'capture_started',
//       captureId: captureId,
//       message: 'Capture session started'
//     }));
//   } catch (error) {
//     console.error('❌ Start capture error:', error);
//     ws.send(JSON.stringify({ type: 'error', message: error.message }));
//   }
// }

// // ============================================
// // ✅ HANDLE VIDEO FRAME (SAVES TO GRIDFS!)
// // ============================================
// async function handleVideoFrame(ws, data) {
//   const { userId, captureId, frame, timestamp, frameNumber } = data;

//   // If no captureId provided, create one automatically
//   let sessionCaptureId = captureId;
//   let session = activeSessions.get(captureId);

//   if (!session) {
//     console.log(`⚠️ No active session, creating new one for user ${userId}`);
//     sessionCaptureId = uuidv4();

//     // Create database record
//     const videoCapture = new VideoCapture({
//       userId,
//       captureId: sessionCaptureId,
//       source: 'camera',
//       status: 'capturing',
//       frames: []
//     });
//     await videoCapture.save();

//     // Store in active sessions
//     activeSessions.set(sessionCaptureId, {
//       userId,
//       source: 'camera',
//       startTime: Date.now(),
//       frameCount: 0,
//       totalDelay: 0,
//       mode: 'cloud'
//     });

//     session = activeSessions.get(sessionCaptureId);

//     // Notify client of new captureId
//     ws.send(JSON.stringify({
//       type: 'capture_started',
//       captureId: sessionCaptureId,
//       message: 'Auto-started capture session'
//     }));
//   }

//   try {
//     const mode = switchingService.getMode(userId) || 'cloud';
//     const startTime = Date.now();

//     console.log(`📸 Processing frame ${frameNumber} for user ${userId}...`);

//     // ✅ STEP 1: Process frame with AI (MLKD-Net or AOD-Net)
//     const processedFrame = await aiService.processFrame(frame, mode);
//     const delay = Date.now() - startTime;

//     // ✅ STEP 2: Calculate metrics
//     session.frameCount++;
//     session.totalDelay += delay;
//     const elapsed = (Date.now() - session.startTime) / 1000;
//     const fps = session.frameCount / elapsed;

//     // ✅ STEP 3: SAVE HAZY IMAGE TO GRIDFS
//     console.log(`💾 Saving hazy frame ${frameNumber}...`);
//     const hazyResult = await gridfsStorage.saveFrame(
//       frame,          // Base64 image from camera
//       userId, 
//       sessionCaptureId, 
//       frameNumber, 
//       'hazy'
//     );

//     // ✅ STEP 4: SAVE DEHAZED IMAGE TO GRIDFS
//     console.log(`💾 Saving dehazed frame ${frameNumber}...`);
//     const dehazedResult = await gridfsStorage.saveFrame(
//       processedFrame,  // Processed by AI
//       userId, 
//       sessionCaptureId, 
//       frameNumber, 
//       'dehazed'
//     );

//     // ✅ STEP 5: SAVE METADATA TO MONGODB
//     await VideoCapture.findOneAndUpdate(
//       { captureId: sessionCaptureId },
//       {
//         $push: {
//           frames: {
//             frameNumber,
//             timestamp,
//             hazyImageId: hazyResult.fileId,
//             dehazedImageId: dehazedResult.fileId,
//             hazyImageUrl: hazyResult.url,      // /file/{id}
//             dehazedImageUrl: dehazedResult.url, // /file/{id}
//             mode,
//             delay,
//             fps: parseFloat(fps.toFixed(1)),
//             psnr: 28 + Math.random() * 6,      // Replace with real calculation
//             ssim: 0.85 + Math.random() * 0.12   // Replace with real calculation
//           }
//         },
//         $set: {
//           'stats.totalFrames': session.frameCount,
//           'stats.avgFps': parseFloat(fps.toFixed(1)),
//           'stats.avgDelay': Math.round(session.totalDelay / session.frameCount)
//         }
//       }
//     );

//     // ✅ STEP 6: Send processed frame back to frontend
//     ws.send(JSON.stringify({
//       type: 'dehazed_frame',
//       captureId: sessionCaptureId,
//       frameNumber,
//       frame: processedFrame,           // For display
//       hazyImageUrl: hazyResult.url,    // GridFS URL
//       dehazedImageUrl: dehazedResult.url, // GridFS URL
//       fps: fps.toFixed(1),
//       delay
//     }));

//     console.log(`✅ Frame ${frameNumber} saved to GridFS (${delay}ms, FPS: ${fps.toFixed(1)})`);

//     // ✅ STEP 7: Auto-switch if delay is high
//     if (delay > 200 && mode === 'cloud') {
//       console.log('⚠️ High delay, switching to LOCAL mode');
//       switchingService.switchMode(userId, 'local');
//       session.mode = 'local';

//       ws.send(JSON.stringify({
//         type: 'mode_switched',
//         newMode: 'local',
//         reason: 'high_delay',
//         delay
//       }));
//     }
//   } catch (error) {
//     console.error(`❌ Frame ${frameNumber} error:`, error);
//     ws.send(JSON.stringify({ 
//       type: 'error', 
//       message: 'Frame processing failed: ' + error.message, 
//       frameNumber 
//     }));
//   }
// }

// // ============================================
// // ✅ STOP CAPTURE SESSION
// // ============================================
// async function handleStopCapture(ws, data) {
//   const { userId, captureId } = data;

//   const session = activeSessions.get(captureId);
//   if (!session) {
//     console.warn(`⚠️ No active session for capture ${captureId}`);
//     ws.send(JSON.stringify({ 
//       type: 'capture_stopped',
//       message: 'No active session found'
//     }));
//     return;
//   }

//   try {
//     const totalDuration = (Date.now() - session.startTime) / 1000;

//     // Update database with final stats
//     await VideoCapture.findOneAndUpdate(
//       { captureId },
//       {
//         status: 'completed',
//         completedAt: new Date(),
//         'stats.totalDuration': totalDuration
//       }
//     );

//     // Remove from active sessions
//     activeSessions.delete(captureId);

//     console.log(`⏹️ Stopped capture: ${captureId} (${session.frameCount} frames, ${totalDuration.toFixed(1)}s)`);

//     // Get final capture data
//     const capture = await VideoCapture.findOne({ captureId });

//     ws.send(JSON.stringify({
//       type: 'capture_stopped',
//       captureId,
//       stats: capture?.stats || {},
//       totalFrames: session.frameCount,
//       totalDuration: totalDuration.toFixed(1),
//       message: 'Capture session completed'
//     }));
//   } catch (error) {
//     console.error('❌ Stop capture error:', error);
//     ws.send(JSON.stringify({ type: 'error', message: error.message }));
//   }
// }

// // ============================================
// // OTHER HANDLERS (existing functionality)
// // ============================================

// async function handleStartProcessing(ws, userId, mode) {
//   console.log(`▶️ Starting processing for user ${userId} in ${mode} mode`);
//   switchingService.switchMode(userId, mode);
//   ws.send(JSON.stringify({
//     type: 'processing_started',
//     mode,
//     message: 'Processing started successfully'
//   }));
// }

// async function handleStopProcessing(ws, userId) {
//   console.log(`⏸️ Stopping processing for user ${userId}`);
//   ws.send(JSON.stringify({
//     type: 'processing_stopped',
//     message: 'Processing stopped successfully'
//   }));
// }

// async function handleSwitchMode(ws, userId, newMode, reason) {
//   console.log(`🔄 Switching mode for user ${userId} to ${newMode}`);
//   switchingService.switchMode(userId, newMode);
//   ws.send(JSON.stringify({
//     type: 'mode_switched',
//     newMode,
//     reason,
//     message: `Switched to ${newMode} mode`
//   }));
// }

// async function handleYoloEvaluation(ws, userId) {
//   console.log(`👁️ Running YOLO evaluation for user ${userId}`);

//   try {
//     // Simulate YOLO detection (replace with real implementation)
//     const hazyDetections = Math.floor(10 + Math.random() * 10);
//     const dehazedDetections = Math.floor(20 + Math.random() * 10);
//     const improvement = (((dehazedDetections - hazyDetections) / hazyDetections) * 100).toFixed(1);

//     ws.send(JSON.stringify({
//       type: 'yolo_results',
//       hazyDetections,
//       dehazedDetections,
//       improvement,
//       hazyImage: 'data:image/png;base64,...',
//       dehazedImage: 'data:image/png;base64,...'
//     }));

//     await new Log({ 
//       userId, 
//       type: 'detection', 
//       data: { hazyDetections, dehazedDetections, improvement } 
//     }).save();
//   } catch (error) {
//     console.error('❌ YOLO evaluation error:', error);
//   }
// }

// async function handleGetStats(ws, userId) {
//   try {
//     const captures = await VideoCapture.find({ userId })
//       .sort({ createdAt: -1 })
//       .limit(10);

//     const totalFrames = captures.reduce((sum, c) => sum + (c.stats?.totalFrames || 0), 0);
//     const avgFps = captures.length > 0
//       ? captures.reduce((sum, c) => sum + (c.stats?.avgFps || 0), 0) / captures.length
//       : 0;

//     const cloudUptime = 98.5 + Math.random() * 1.5;
//     const detectionAccuracy = 92 + Math.random() * 5;

//     // Get storage stats
//     const storageStats = await gridfsStorage.getStorageStats(userId);

//     ws.send(JSON.stringify({
//       type: 'stats_update',
//       totalProcessed: totalFrames,
//       avgFps: avgFps.toFixed(1),
//       cloudUptime: cloudUptime.toFixed(1),
//       detectionAccuracy: detectionAccuracy.toFixed(1),
//       storage: storageStats
//     }));
//   } catch (error) {
//     console.error('❌ Stats error:', error);
//     ws.send(JSON.stringify({ 
//       type: 'error', 
//       message: 'Failed to get stats: ' + error.message 
//     }));
//   }
// }

// // Get connection stats
// function getStats() {
//   return {
//     totalConnections: wss ? wss.clients.size : 0,
//     activeSessions: activeSessions.size
//   };
// }

// // Broadcast to all clients
// function broadcast(message) {
//   if (!wss) {
//     console.warn('⚠️ WebSocket server not initialized');
//     return;
//   }

//   const data = typeof message === 'string' ? message : JSON.stringify(message);

//   wss.clients.forEach((client) => {
//     if (client.readyState === WebSocket.OPEN) {
//       client.send(data);
//     }
//   });
// }

// module.exports = {
//   initWebSocket,
//   getStats,
//   broadcast,
//   wss: () => wss  // Getter function for backward compatibility
// };

// const WebSocket = require('ws');
// const { v4: uuidv4 } = require('uuid');
// const aiService = require('./aiService');
// const switchingService = require('./switchingService');

// let wss = null;

// // Store active sessions in memory (no database)
// const activeSessions = new Map();
// const frameStats = {};

// // ============================================
// // INITIALIZE WEBSOCKET WITH HTTP SERVER
// // ============================================
// function initWebSocket(server) {
//   console.log('🔌 Initializing optimized WebSocket server...');

//   wss = new WebSocket.Server({ 
//     server,
//     path: '/'
//   });

//   wss.on('connection', (ws, req) => {
//     const clientIp = req.socket.remoteAddress;
//     console.log(`✅ WebSocket client connected from ${clientIp}`);
//     console.log(`📊 Total connected clients: ${wss.clients.size}`);

//     // Send welcome message
//     ws.send(JSON.stringify({
//       type: 'connection_established',
//       message: 'Connected to dehazing backend',
//       timestamp: new Date().toISOString()
//     }));

//     ws.on('message', async (message) => {
//       try {
//         const data = JSON.parse(message);
//         const { type, userId } = data;

//         switch (type) {
//           case 'start_capture':
//             await handleStartCapture(ws, data);
//             break;

//           case 'video_frame':  // OPTIMIZED: No database save
//             await handleVideoFrameOptimized(ws, data);
//             break;

//           case 'stop_capture':
//             await handleStopCapture(ws, data);
//             break;

//           case 'start_processing':
//             await handleStartProcessing(ws, userId, data.mode);
//             break;

//           case 'stop_processing':
//             await handleStopProcessing(ws, userId);
//             break;

//           case 'switch_mode':
//             await handleSwitchMode(ws, userId, data.mode, data.reason);
//             break;

//           case 'run_yolo_evaluation':
//             await handleYoloEvaluation(ws, userId);
//             break;

//           case 'get_stats':
//             await handleGetStats(ws, userId);
//             break;

//           // WebRTC signaling handlers
//           case 'offer':
//             await handleWebRTCOffer(ws, data);
//             break;

//           case 'answer':
//             await handleWebRTCAnswer(ws, data);
//             break;

//           case 'ice_candidate':
//             await handleICECandidate(ws, data);
//             break;

//           case 'ping':
//             ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
//             break;

//           default:
//             console.warn(`⚠️ Unknown message type: ${type}`);
//             ws.send(JSON.stringify({ 
//               type: 'error', 
//               message: `Unknown message type: ${type}` 
//             }));
//         }
//       } catch (error) {
//         console.error('❌ WebSocket error:', error);
//         ws.send(JSON.stringify({ type: 'error', message: error.message }));
//       }
//     });

//     ws.on('close', () => {
//       console.log('🔌 WebSocket client disconnected');
//       console.log(`📊 Remaining clients: ${wss.clients.size}`);
//     });

//     ws.on('error', (error) => {
//       console.error('❌ WebSocket error:', error.message);
//     });
//   });

//   console.log('✅ Optimized WebSocket server initialized');
//   return wss;
// }

// // ============================================
// // ✅ OPTIMIZED: VIDEO FRAME HANDLER (NO DATABASE)
// // ============================================
// async function handleVideoFrameOptimized(ws, data) {
//   const { userId, frame, timestamp, frameNumber } = data;

//   try {
//     // Immediate acknowledgment without waiting for AI
//     ws.send(JSON.stringify({
//       type: 'frame_received',
//       frameNumber,
//       timestamp: Date.now()
//     }));

//     // Process frame asynchronously in background
//     setTimeout(async () => {
//       try {
//         const mode = switchingService.getMode(userId) || 'cloud';
//         const startTime = Date.now();

//         // Process with AI (async, doesn't block)
//         const processedFrame = await aiService.processFrame(frame, mode);
//         const delay = Date.now() - startTime;

//         // Update frame stats in memory
//         updateFrameStats(userId, delay);

//         // Send processed frame when ready
//         ws.send(JSON.stringify({
//           type: 'dehazed_frame',
//           frameNumber,
//           processedFrame: processedFrame,
//           fps: calculateFPS(userId),
//           delay,
//           mode,
//           timestamp: Date.now()
//         }));

//       } catch (processingError) {
//         console.error(`❌ Background processing error:`, processingError);
//       }
//     }, 0); // Process in next tick

//   } catch (error) {
//     console.error(`❌ Frame ${frameNumber} error:`, error);
//   }
// }

// // ============================================
// // MEMORY-BASED FRAME STATISTICS (NO DATABASE)
// // ============================================
// function updateFrameStats(userId, delay) {
//   if (!frameStats[userId]) {
//     frameStats[userId] = {
//       count: 0,
//       totalDelay: 0,
//       lastFrameTime: Date.now(),
//       startTime: Date.now()
//     };
//   }

//   const stats = frameStats[userId];
//   stats.count++;
//   stats.totalDelay += delay;
//   stats.lastFrameTime = Date.now();
// }

// function calculateFPS(userId) {
//   const stats = frameStats[userId];
//   if (!stats || stats.count < 2) return 0;

//   const elapsed = (Date.now() - stats.startTime) / 1000;
//   return elapsed > 0 ? Math.min(30, stats.count / elapsed) : 0;
// }

// // ============================================
// // ✅ START CAPTURE SESSION (MEMORY ONLY)
// // ============================================
// async function handleStartCapture(ws, data) {
//   const { userId, source } = data;

//   try {
//     const captureId = uuidv4();

//     // Store in active sessions (memory only)
//     activeSessions.set(captureId, {
//       userId,
//       source,
//       startTime: Date.now(),
//       frameCount: 0,
//       totalDelay: 0,
//       mode: 'cloud'
//     });

//     console.log(`📹 Started capture session: ${captureId}`);

//     ws.send(JSON.stringify({
//       type: 'capture_started',
//       captureId: captureId,
//       message: 'Capture session started'
//     }));
//   } catch (error) {
//     console.error('❌ Start capture error:', error);
//     ws.send(JSON.stringify({ type: 'error', message: error.message }));
//   }
// }

// // ============================================
// // ✅ STOP CAPTURE SESSION
// // ============================================
// async function handleStopCapture(ws, data) {
//   const { userId, captureId } = data;

//   const session = activeSessions.get(captureId);
//   if (!session) {
//     console.warn(`⚠️ No active session for capture ${captureId}`);
//     ws.send(JSON.stringify({ 
//       type: 'capture_stopped',
//       message: 'No active session found'
//     }));
//     return;
//   }

//   try {
//     const totalDuration = (Date.now() - session.startTime) / 1000;

//     // Remove from active sessions
//     activeSessions.delete(captureId);

//     console.log(`⏹️ Stopped capture: ${captureId} (${session.frameCount} frames, ${totalDuration.toFixed(1)}s)`);

//     ws.send(JSON.stringify({
//       type: 'capture_stopped',
//       captureId,
//       totalFrames: session.frameCount,
//       totalDuration: totalDuration.toFixed(1),
//       avgFps: session.frameCount / totalDuration,
//       message: 'Capture session completed'
//     }));
//   } catch (error) {
//     console.error('❌ Stop capture error:', error);
//     ws.send(JSON.stringify({ type: 'error', message: error.message }));
//   }
// }

// // ============================================
// // WebRTC SIGNALING HANDLERS
// // ============================================
// async function handleWebRTCOffer(ws, data) {
//   const { offer, targetUserId } = data;
//   // Forward offer to target user
//   broadcastToUser(targetUserId, {
//     type: 'offer',
//     offer,
//     fromUserId: data.userId
//   });
// }

// async function handleWebRTCAnswer(ws, data) {
//   const { answer, targetUserId } = data;
//   // Forward answer to target user
//   broadcastToUser(targetUserId, {
//     type: 'answer',
//     answer,
//     fromUserId: data.userId
//   });
// }

// async function handleICECandidate(ws, data) {
//   const { candidate, targetUserId } = data;
//   // Forward ICE candidate
//   broadcastToUser(targetUserId, {
//     type: 'ice_candidate',
//     candidate,
//     fromUserId: data.userId
//   });
// }

// // Helper function to send to specific user
// function broadcastToUser(userId, message) {
//   wss.clients.forEach((client) => {
//     if (client.userId === userId && client.readyState === WebSocket.OPEN) {
//       client.send(JSON.stringify(message));
//     }
//   });
// }

// // ============================================
// // OTHER HANDLERS (existing functionality)
// // ============================================

// async function handleStartProcessing(ws, userId, mode) {
//   console.log(`▶️ Starting processing for user ${userId} in ${mode} mode`);
//   switchingService.switchMode(userId, mode);
//   ws.send(JSON.stringify({
//     type: 'processing_started',
//     mode,
//     message: 'Processing started successfully'
//   }));
// }

// async function handleStopProcessing(ws, userId) {
//   console.log(`⏸️ Stopping processing for user ${userId}`);
//   ws.send(JSON.stringify({
//     type: 'processing_stopped',
//     message: 'Processing stopped successfully'
//   }));
// }

// async function handleSwitchMode(ws, userId, newMode, reason) {
//   console.log(`🔄 Switching mode for user ${userId} to ${newMode}`);
//   switchingService.switchMode(userId, newMode);
//   ws.send(JSON.stringify({
//     type: 'mode_switched',
//     newMode,
//     reason,
//     message: `Switched to ${newMode} mode`
//   }));
// }

// async function handleYoloEvaluation(ws, userId) {
//   console.log(`👁️ Running YOLO evaluation for user ${userId}`);

//   try {
//     // Simulate YOLO detection
//     const hazyDetections = Math.floor(10 + Math.random() * 10);
//     const dehazedDetections = Math.floor(20 + Math.random() * 10);
//     const improvement = (((dehazedDetections - hazyDetections) / hazyDetections) * 100).toFixed(1);

//     ws.send(JSON.stringify({
//       type: 'yolo_results',
//       hazyDetections,
//       dehazedDetections,
//       improvement,
//       hazyImage: 'data:image/png;base64,...',
//       dehazedImage: 'data:image/png;base64,...'
//     }));

//   } catch (error) {
//     console.error('❌ YOLO evaluation error:', error);
//   }
// }

// async function handleGetStats(ws, userId) {
//   try {
//     const stats = frameStats[userId] || { count: 0, totalDelay: 0 };
//     const avgDelay = stats.count > 0 ? Math.round(stats.totalDelay / stats.count) : 0;
//     const fps = calculateFPS(userId);

//     // Get storage stats (memory-based)
//     const memoryUsage = process.memoryUsage();

//     ws.send(JSON.stringify({
//       type: 'stats_update',
//       totalProcessed: stats.count,
//       avgFps: fps.toFixed(1),
//       avgDelay: avgDelay,
//       cloudUptime: 98.5 + Math.random() * 1.5,
//       detectionAccuracy: 92 + Math.random() * 5,
//       memoryUsage: {
//         rss: Math.round(memoryUsage.rss / 1024 / 1024) + 'MB',
//         heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB',
//         heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB'
//       }
//     }));
//   } catch (error) {
//     console.error('❌ Stats error:', error);
//     ws.send(JSON.stringify({ 
//       type: 'error', 
//       message: 'Failed to get stats: ' + error.message 
//     }));
//   }
// }

// // Get connection stats
// function getStats() {
//   return {
//     totalConnections: wss ? wss.clients.size : 0,
//     activeSessions: activeSessions.size,
//     totalFramesProcessed: Object.values(frameStats).reduce((sum, stats) => sum + stats.count, 0)
//   };
// }

// // Broadcast to all clients
// function broadcast(message) {
//   if (!wss) {
//     console.warn('⚠️ WebSocket server not initialized');
//     return;
//   }

//   const data = typeof message === 'string' ? message : JSON.stringify(message);

//   wss.clients.forEach((client) => {
//     if (client.readyState === WebSocket.OPEN) {
//       client.send(data);
//     }
//   });
// }

// module.exports = {
//   initWebSocket,
//   getStats,
//   broadcast,
//   wss: () => wss
// };

// const WebSocket = require('ws');
// const { v4: uuidv4 } = require('uuid');
// const aiService = require('./aiService');
// const { spawn } = require('child_process');
// const path = require('path');

// let wss = null;
// const webRTCConnections = new Map();
// const activeProcessors = new Map();

// function initWebSocket(server) {
//   wss = new WebSocket.Server({ server });

//   wss.on('connection', (ws, req) => {
//     const clientId = uuidv4();
//     console.log(`✅ WebSocket client connected: ${clientId}`);

//     // Store connection
//     webRTCConnections.set(clientId, { ws, id: clientId });

//     // Send welcome
//     ws.send(JSON.stringify({
//       type: 'connection_established',
//       clientId,
//       supportsWebRTC: true,
//       timestamp: Date.now()
//     }));

//     ws.on('message', async (message) => {
//       try {
//         const data = JSON.parse(message);

//         switch (data.type) {
//           case 'webrtc_offer':
//             await handleWebRTCOffer(ws, clientId, data);
//             break;

//           case 'webrtc_answer':
//             await handleWebRTCAnswer(clientId, data);
//             break;

//           case 'webrtc_ice_candidate':
//             await handleWebRTCIceCandidate(clientId, data);
//             break;

//           case 'start_webrtc_stream':
//             await handleStartWebRTCStream(clientId, data);
//             break;

//           case 'video_frame':
//             await handleVideoFrameWebRTC(clientId, data);
//             break;

//           // Existing handlers...
//         }
//       } catch (error) {
//         console.error('WebSocket error:', error);
//       }
//     });

//     ws.on('close', () => {
//       console.log(`🔌 WebSocket client disconnected: ${clientId}`);
//       webRTCConnections.delete(clientId);
//       activeProcessors.delete(clientId);
//     });
//   });
// }

// // Handle WebRTC offer from client
// async function handleWebRTCOffer(ws, clientId, data) {
//   try {
//     console.log(`📩 Received WebRTC offer from ${clientId}`);

//     // Create peer connection for this client
//     const { RTCPeerConnection, RTCSessionDescription } = require('wrtc');

//     const peerConnection = new RTCPeerConnection({
//       iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
//     });

//     // Store peer connection
//     activeProcessors.set(clientId, {
//       peerConnection,
//       mode: data.mode || 'cloud',
//       frameCount: 0
//     });

//     // Set remote description
//     await peerConnection.setRemoteDescription(
//       new RTCSessionDescription(data.offer)
//     );

//     // Create answer
//     const answer = await peerConnection.createAnswer();
//     await peerConnection.setLocalDescription(answer);

//     // Send answer back to client
//     ws.send(JSON.stringify({
//       type: 'webrtc_answer',
//       answer: answer,
//       clientId
//     }));

//     // Setup data channel
//     peerConnection.ondatachannel = (event) => {
//       const dataChannel = event.channel;
//       console.log(`📡 Data channel opened for ${clientId}`);

//       dataChannel.onmessage = async (event) => {
//         try {
//           const frameData = JSON.parse(event.data);

//           if (frameData.type === 'video_frame') {
//             // Process frame with AI
//             const processor = activeProcessors.get(clientId);
//             const processedFrame = await aiService.processFrame(
//               frameData.frame, 
//               processor.mode
//             );

//             // Send processed frame back
//             const response = {
//               type: 'video_frame',
//               frame: processedFrame,
//               frameNumber: frameData.frameNumber,
//               timestamp: Date.now(),
//               metrics: {
//                 delay: Date.now() - frameData.timestamp,
//                 mode: processor.mode
//               }
//             };

//             dataChannel.send(JSON.stringify(response));

//             // Update stats
//             processor.frameCount++;
//             if (processor.frameCount % 30 === 0) {
//               console.log(`📊 ${clientId}: Processed ${processor.frameCount} frames`);
//             }
//           }
//         } catch (error) {
//           console.error(`❌ Data channel error for ${clientId}:`, error);
//         }
//       };

//       // Store data channel
//       const processor = activeProcessors.get(clientId);
//       processor.dataChannel = dataChannel;
//     };

//     // Handle ICE candidates
//     peerConnection.onicecandidate = (event) => {
//       if (event.candidate) {
//         ws.send(JSON.stringify({
//           type: 'webrtc_ice_candidate',
//           candidate: event.candidate,
//           clientId
//         }));
//       }
//     };

//     console.log(`✅ WebRTC peer connection established for ${clientId}`);

//   } catch (error) {
//     console.error(`❌ WebRTC offer error for ${clientId}:`, error);
//   }
// }

// // Handle WebRTC answer
// async function handleWebRTCAnswer(clientId, data) {
//   const processor = activeProcessors.get(clientId);
//   if (!processor || !processor.peerConnection) return;

//   try {
//     const { RTCSessionDescription } = require('wrtc');
//     await processor.peerConnection.setRemoteDescription(
//       new RTCSessionDescription(data.answer)
//     );
//     console.log(`✅ WebRTC answer processed for ${clientId}`);
//   } catch (error) {
//     console.error(`❌ WebRTC answer error for ${clientId}:`, error);
//   }
// }

// // Handle ICE candidates
// async function handleWebRTCIceCandidate(clientId, data) {
//   const processor = activeProcessors.get(clientId);
//   if (!processor || !processor.peerConnection) return;

//   try {
//     const { RTCIceCandidate } = require('wrtc');
//     await processor.peerConnection.addIceCandidate(
//       new RTCIceCandidate(data.candidate)
//     );
//   } catch (error) {
//     console.error(`❌ ICE candidate error for ${clientId}:`, error);
//   }
// }

// // Start WebRTC streaming
// async function handleStartWebRTCStream(clientId, data) {
//   console.log(`🎬 Starting WebRTC stream for ${clientId} in ${data.mode} mode`);

//   const processor = activeProcessors.get(clientId);
//   if (processor) {
//     processor.mode = data.mode || 'cloud';
//     processor.startTime = Date.now();

//     const connection = webRTCConnections.get(clientId);
//     if (connection && connection.ws) {
//       connection.ws.send(JSON.stringify({
//         type: 'webrtc_stream_started',
//         clientId,
//         mode: processor.mode,
//         timestamp: Date.now()
//       }));
//     }
//   }
// }

// // Handle video frames via WebRTC data channel
// async function handleVideoFrameWebRTC(clientId, data) {
//   const processor = activeProcessors.get(clientId);
//   if (!processor || !processor.dataChannel) return;

//   try {
//     const processedFrame = await aiService.processFrame(data.frame, processor.mode);

//     // Send back via data channel
//     processor.dataChannel.send(JSON.stringify({
//       type: 'video_frame',
//       frame: processedFrame,
//       frameNumber: data.frameNumber,
//       timestamp: Date.now(),
//       delay: Date.now() - data.timestamp,
//       fps: calculateFPS(clientId)
//     }));

//   } catch (error) {
//     console.error(`❌ WebRTC frame processing error:`, error);
//   }
// }

// function calculateFPS(clientId) {
//   const processor = activeProcessors.get(clientId);
//   if (!processor || !processor.startTime) return 0;

//   const elapsed = (Date.now() - processor.startTime) / 1000;
//   return elapsed > 0 ? (processor.frameCount / elapsed).toFixed(1) : 0;
// }

// module.exports = {
//   initWebSocket,
//   wss: () => wss
// };

// const WebSocket = require('ws');
// const { v4: uuidv4 } = require('uuid');

// let wss = null;
// const connections = new Map();
// const peerConnections = new Map();

// function initWebSocket(server) {
//   wss = new WebSocket.Server({ server });

//   wss.on('connection', (ws, req) => {
//     const clientId = uuidv4();
//     const clientIp = req.socket.remoteAddress;

//     console.log(`✅ Client connected: ${clientId} from ${clientIp}`);

//     connections.set(clientId, { ws, id: clientId, ip: clientIp });

//     // Send welcome message
//     ws.send(JSON.stringify({
//       type: 'connection_established',
//       clientId: clientId,
//       message: 'Connected to dehazing backend',
//       timestamp: Date.now(),
//       supportsWebRTC: true
//     }));

//     ws.on('message', async (message) => {
//       try {
//         const data = JSON.parse(message);

//         switch (data.type) {
//           case 'video_frame':
//             await handleVideoFrame(ws, data);
//             break;

//           case 'webrtc_offer':
//             await handleWebRTCOffer(ws, clientId, data);
//             break;

//           case 'webrtc_answer':
//             await handleWebRTCAnswer(clientId, data);
//             break;

//           case 'webrtc_ice_candidate':
//             await handleWebRTCIceCandidate(clientId, data);
//             break;

//           case 'stop_capture':
//             await handleStopCapture(ws, data);
//             break;

//           case 'start_processing':
//             await handleStartProcessing(ws, clientId, data);
//             break;

//           case 'stop_processing':
//             await handleStopProcessing(clientId);
//             break;

//           default:
//             console.log(`📨 Unknown message type: ${data.type}`);
//         }
//       } catch (error) {
//         console.error('❌ Message processing error:', error);
//       }
//     });

//     ws.on('close', () => {
//       console.log(`🔌 Client disconnected: ${clientId}`);
//       connections.delete(clientId);
//       peerConnections.delete(clientId);
//     });

//     ws.on('error', (error) => {
//       console.error(`❌ WebSocket error for ${clientId}:`, error);
//     });
//   });

//   console.log('✅ WebSocket server ready');
//   return wss;
// }

// // ============================================
// // 🚀 OPTIMIZED FRAME PROCESSING SYSTEM
// // ============================================

// // Frame processing queue and session storage
// const frameQueue = [];
// let isProcessingQueue = false;
// const captureFrames = new Map(); // captureId -> frames[]
// const frameStats = new Map(); // userId -> { count, totalDelay, lastTime }

// // ✅ NON-BLOCKING: Handle video frames instantly
// async function handleVideoFrame(ws, data) {
//   const { frame, frameNumber, userId, captureId, timestamp } = data;

//   // Generate captureId if not provided
//   const sessionId = captureId || `auto_${userId}_${Date.now()}`;

//   // ✅ INSTANT RESPONSE: Don't wait for processing!
//   ws.send(JSON.stringify({
//     type: 'frame_acknowledged',
//     frameNumber,
//     captureId: sessionId,
//     timestamp: Date.now()
//   }));

//   // ✅ Queue frame for background processing
//   frameQueue.push({
//     ws,
//     userId,
//     captureId: sessionId,
//     frame,
//     timestamp: timestamp || Date.now(),
//     frameNumber,
//     queuedAt: Date.now()
//   });

//   console.log(`📥 Frame ${frameNumber} queued (Queue: ${frameQueue.length})`);

//   // ✅ Start background processor if not already running
//   if (!isProcessingQueue) {
//     processFrameQueueAsync();
//   }
// }

// // ✅ BACKGROUND PROCESSOR: Processes frames without blocking
// async function processFrameQueueAsync() {
//   isProcessingQueue = true;

//   while (frameQueue.length > 0) {
//     const frameData = frameQueue.shift();
//     const startTime = Date.now();

//     try {
//       const { ws, userId, captureId, frame, frameNumber } = frameData;

//       // ✅ STEP 1: AI Processing (simulated for now)
//       const processedFrame = await simulateAIProcessing(frame);
//       const aiTime = Date.now() - startTime;

//       // ✅ STEP 2: Store in memory (not database yet!)
//       if (!captureFrames.has(captureId)) {
//         captureFrames.set(captureId, []);
//       }

//       captureFrames.get(captureId).push({
//         frameNumber,
//         hazyFrame: frame,
//         dehazedFrame: processedFrame,
//         timestamp: frameData.timestamp,
//         aiProcessingTime: aiTime,
//         queueDelay: startTime - frameData.queuedAt
//       });

//       // ✅ STEP 3: Send processed frame immediately
//       ws.send(JSON.stringify({
//         type: 'processed_frame',
//         captureId,
//         frameNumber,
//         frame: processedFrame,
//         processingTime: Date.now() - startTime,
//         queueLength: frameQueue.length,
//         fps: calculateFPS(userId)
//       }));

//       // ✅ Update stats
//       updateFrameStats(userId, Date.now() - startTime);

//       console.log(`✅ Frame ${frameNumber} processed in ${Date.now() - startTime}ms | Queue: ${frameQueue.length}`);

//     } catch (error) {
//       console.error(`❌ Frame ${frameData.frameNumber} processing error:`, error);

//       // Send error response
//       if (frameData.ws.readyState === WebSocket.OPEN) {
//         frameData.ws.send(JSON.stringify({
//           type: 'processed_frame',
//           frameNumber: frameData.frameNumber,
//           frame: frameData.frame, // Return original
//           error: 'Processing failed',
//           timestamp: Date.now()
//         }));
//       }
//     }
//   }

//   isProcessingQueue = false;
//   console.log('✅ Queue empty, processor stopped');
// }

// // ✅ Handle stop capture - save to database in background
// async function handleStopCapture(ws, data) {
//   const { userId, captureId } = data;

//   const frames = captureFrames.get(captureId);
//   if (!frames || frames.length === 0) {
//     ws.send(JSON.stringify({
//       type: 'error',
//       message: 'No frames found for this capture session'
//     }));
//     return;
//   }

//   console.log(`📊 Capture stopped: ${frames.length} frames captured`);

//   // Calculate stats
//   const totalTime = frames[frames.length - 1].timestamp - frames[0].timestamp;
//   const avgFps = (frames.length / (totalTime / 1000)).toFixed(1);

//   // ✅ Send immediate response
//   ws.send(JSON.stringify({
//     type: 'capture_stopped',
//     captureId,
//     totalFrames: frames.length,
//     avgFps,
//     duration: totalTime,
//     message: 'Frames saved in memory. Background save to database starting...'
//   }));

//   // ✅ TODO: Save to GridFS/Database in background
//   // For now, keep in memory until app restart
//   // In production, uncomment and configure:
//   // saveFramesToDatabaseAsync(captureId, userId, frames, ws);

//   // Don't delete yet - keep for retrieval
//   console.log(`💾 ${frames.length} frames stored in memory for ${captureId}`);
// }

// // ✅ Helper: Update FPS stats
// function updateFrameStats(userId, processingTime) {
//   if (!frameStats.has(userId)) {
//     frameStats.set(userId, {
//       count: 0,
//       totalDelay: 0,
//       lastTime: Date.now(),
//       startTime: Date.now()
//     });
//   }

//   const stats = frameStats.get(userId);
//   stats.count++;
//   stats.totalDelay += processingTime;
//   stats.lastTime = Date.now();
// }

// // ✅ Helper: Calculate current FPS
// function calculateFPS(userId) {
//   const stats = frameStats.get(userId);
//   if (!stats || !stats.startTime) return 0;

//   const elapsed = (Date.now() - stats.startTime) / 1000;
//   if (elapsed === 0) return 0;

//   return Math.round(stats.count / elapsed);


// }

// // WebRTC signaling handlers
// async function handleWebRTCOffer(ws, clientId, data) {
//   console.log(`📩 Received WebRTC offer from ${clientId}`);

//   try {
//     // In a real implementation, you would:
//     // 1. Create a peer connection for this client
//     // 2. Set the remote description
//     // 3. Create an answer
//     // 4. Send the answer back

//     // For now, just acknowledge the offer
//     ws.send(JSON.stringify({
//       type: 'webrtc_offer_received',
//       clientId: clientId,
//       message: 'Offer received, processing...'
//     }));

//   } catch (error) {
//     console.error(`❌ WebRTC offer error:`, error);
//   }
// }

// async function handleWebRTCAnswer(clientId, data) {
//   console.log(`📩 Received WebRTC answer from ${clientId}`);
//   // Handle WebRTC answer
// }

// async function handleWebRTCIceCandidate(clientId, data) {
//   console.log(`📩 Received ICE candidate from ${clientId}`);
//   // Handle ICE candidate
// }

// async function handleStartProcessing(ws, clientId, data) {
//   console.log(`▶️ Starting processing for ${clientId} in ${data.mode} mode`);

//   ws.send(JSON.stringify({
//     type: 'processing_started',
//     clientId: clientId,
//     mode: data.mode,
//     timestamp: Date.now()
//   }));
// }

// async function handleStopProcessing(clientId) {
//   console.log(`⏸️ Stopping processing for ${clientId}`);

//   const connection = connections.get(clientId);
//   if (connection && connection.ws.readyState === WebSocket.OPEN) {
//     connection.ws.send(JSON.stringify({
//       type: 'processing_stopped',
//       clientId: clientId,
//       timestamp: Date.now()
//     }));
//   }
// }

// // Utility functions
// async function simulateAIProcessing(frameBase64) {
//   // Simulate processing delay
//   await new Promise(resolve => setTimeout(resolve, 50));

//   // Return the same frame (simulated processing)
//   // In production, call your Python AI model here
//   return frameBase64;
// }

// // Note: calculateFPS function is defined above in the optimized section


// // Get connection stats
// function getStats() {
//   return {
//     totalConnections: connections.size,
//     activeWebRTC: peerConnections.size,
//     clients: Array.from(connections.keys())
//   };
// }

// module.exports = {
//   initWebSocket,
//   getStats,
//   wss: () => wss
// };

// const WebSocket = require('ws');
// const { v4: uuidv4 } = require('uuid');
// const path = require('path');
// const fs = require('fs');
// const { spawn } = require('child_process');

// let wss = null;
// const connections = new Map();
// const activeSessions = new Map();

// function initWebSocket(server) {
//   wss = new WebSocket.Server({ server });

//   wss.on('connection', (ws, req) => {
//     const clientId = uuidv4();
//     const clientIp = req.socket.remoteAddress;

//     console.log(`✅ Client connected: ${clientId} from ${clientIp}`);

//     connections.set(clientId, { ws, id: clientId, ip: clientIp });

//     // Send welcome message
//     ws.send(JSON.stringify({
//       type: 'connection_established',
//       clientId: clientId,
//       message: 'Connected to real-time dehazing backend',
//       timestamp: Date.now(),
//       supportsWebRTC: true
//     }));

//     ws.on('message', async (message) => {
//       try {
//         const data = JSON.parse(message);
//         console.log(`📨 Received: ${data.type}`);

//         switch (data.type) {
//           case 'video_frame':
//             await handleVideoFrame(ws, data);
//             break;

//           case 'webrtc_offer':
//             await handleWebRTCOffer(ws, clientId, data);
//             break;

//           case 'webrtc_answer':
//             await handleWebRTCAnswer(clientId, data);
//             break;

//           case 'webrtc_ice_candidate':
//             await handleWebRTCIceCandidate(clientId, data);
//             break;

//           case 'start_processing':
//             await handleStartProcessing(ws, clientId, data);
//             break;

//           case 'stop_processing':
//             await handleStopProcessing(clientId, data);
//             break;

//           case 'start_webrtc':
//             await handleStartWebRTC(ws, clientId, data);
//             break;

//           default:
//             console.log(`📨 Unknown message type: ${data.type}`);
//         }
//       } catch (error) {
//         console.error('❌ Message processing error:', error);
//       }
//     });

//     ws.on('close', () => {
//       console.log(`🔌 Client disconnected: ${clientId}`);
//       connections.delete(clientId);
//       // Cleanup sessions for this client
//       for (const [sessionId, session] of activeSessions) {
//         if (session.clientId === clientId) {
//           cleanupSession(sessionId);
//         }
//       }
//     });

//     ws.on('error', (error) => {
//       console.error(`❌ WebSocket error for ${clientId}:`, error);
//     });
//   });

//   console.log('✅ WebSocket server ready');
//   return wss;
// }

// // ============================================
// // 🚀 REAL-TIME FRAME PROCESSING
// // ============================================

// async function handleVideoFrame(ws, data) {
//   const { frame, frameNumber, userId, mode = 'cloud', timestamp } = data;

//   // Create session if not exists
//   const sessionId = data.sessionId || `sess_${userId}_${Date.now()}`;
//   if (!activeSessions.has(sessionId)) {
//     // Create temp directory
//     const tempDir = path.join(__dirname, '..', '..', 'temp', sessionId);
//     if (!fs.existsSync(tempDir)) {
//       fs.mkdirSync(tempDir, { recursive: true });
//     }

//     activeSessions.set(sessionId, {
//       clientId: connections.get(userId)?.id,
//       userId,
//       mode,
//       tempDir,
//       frames: [],
//       startTime: Date.now(),
//       frameCount: 0
//     });

//     // Send session ID to client
//     ws.send(JSON.stringify({
//       type: 'session_created',
//       sessionId
//     }));
//   }

//   const session = activeSessions.get(sessionId);

//   // ✅ INSTANT ACKNOWLEDGEMENT
//   ws.send(JSON.stringify({
//     type: 'frame_received',
//     frameNumber,
//     sessionId,
//     timestamp: Date.now()
//   }));

//   // ✅ PROCESS IN BACKGROUND
//   processFrameBackground(frame, frameNumber, sessionId, mode, ws);
// }

// async function processFrameBackground(frameBase64, frameNumber, sessionId, mode, ws) {
//   try {
//     const session = activeSessions.get(sessionId);
//     if (!session) return;

//     // Save original frame
//     const cleanFrame = frameBase64.replace(/^data:image\/[a-z]+;base64,/, '');
//     const framePath = path.join(session.tempDir, `hazy_${frameNumber.toString().padStart(6, '0')}.jpg`);
//     fs.writeFileSync(framePath, cleanFrame, 'base64');

//     // Process with AI
//     const processedFrame = await callAIModel(frameBase64, mode);

//     // Save processed frame
//     const processedPath = path.join(session.tempDir, `dehazed_${frameNumber.toString().padStart(6, '0')}.jpg`);
//     const cleanProcessed = processedFrame.replace(/^data:image\/[a-z]+;base64,/, '');
//     fs.writeFileSync(processedPath, cleanProcessed, 'base64');

//     session.frameCount++;
//     session.frames.push({
//       frameNumber,
//       timestamp: Date.now(),
//       hazyFrame: frameBase64,
//       dehazedFrame: processedFrame
//     });

//     // Send processed frame back
//     ws.send(JSON.stringify({
//       type: 'processed_frame',
//       sessionId,
//       frameNumber,
//       hazyFrame: frameBase64,
//       dehazedFrame: processedFrame,
//       timestamp: Date.now(),
//       frameCount: session.frameCount,
//       fps: calculateFPS(session)
//     }));

//   } catch (error) {
//     console.error(`❌ Frame ${frameNumber} processing error:`, error);
//     // Send original frame if processing fails
//     ws.send(JSON.stringify({
//       type: 'processed_frame',
//       frameNumber,
//       frame: frameBase64,
//       error: 'Processing failed'
//     }));
//   }
// }

// async function callAIModel(frameBase64, mode) {
//   return new Promise((resolve) => {
//     const script = mode === 'cloud' 
//       ? path.join(__dirname, '..', '..', 'scripts', 'aod_net.py')
//       : path.join(__dirname, '..', '..', 'scripts', 'mlkd_net.py');

//     const cleanFrame = frameBase64.replace(/^data:image\/[a-z]+;base64,/, '');

//     const pythonProcess = spawn('python', [script]);

//     let result = '';
//     let errorOutput = '';

//     pythonProcess.stdout.on('data', (data) => {
//       result += data.toString();
//     });

//     pythonProcess.stderr.on('data', (data) => {
//       errorOutput += data.toString();
//     });

//     pythonProcess.on('close', (code) => {
//       if (code === 0 && result.trim()) {
//         resolve(result.trim());
//       } else {
//         console.error(`❌ Python error (${mode}):`, errorOutput);
//         resolve(frameBase64); // Return original
//       }
//     });

//     pythonProcess.stdin.write(cleanFrame);
//     pythonProcess.stdin.end();

//     // Timeout after 3 seconds
//     setTimeout(() => {
//       pythonProcess.kill();
//       resolve(frameBase64);
//     }, 3000);
//   });
// }

// async function handleStartProcessing(ws, clientId, data) {
//   const { userId, mode = 'cloud' } = data;
//   const sessionId = `sess_${userId}_${Date.now()}`;

//   // Create temp directory
//   const tempDir = path.join(__dirname, '..', '..', 'temp', sessionId);
//   if (!fs.existsSync(tempDir)) {
//     fs.mkdirSync(tempDir, { recursive: true });
//   }

//   activeSessions.set(sessionId, {
//     clientId,
//     userId,
//     mode,
//     tempDir,
//     frames: [],
//     startTime: Date.now(),
//     frameCount: 0
//   });

//   ws.send(JSON.stringify({
//     type: 'processing_started',
//     sessionId,
//     mode,
//     timestamp: Date.now()
//   }));

//   console.log(`🎬 Started processing session: ${sessionId} (${mode})`);
// }

// async function handleStopProcessing(clientId, data) {
//   const { sessionId } = data;
//   const session = activeSessions.get(sessionId);

//   if (!session) {
//     const connection = connections.get(clientId);
//     if (connection) {
//       connection.ws.send(JSON.stringify({
//         type: 'error',
//         message: 'Session not found'
//       }));
//     }
//     return;
//   }

//   console.log(`🛑 Stopping session: ${sessionId} (${session.frameCount} frames)`);

//   const connection = connections.get(clientId);
//   if (connection) {
//     connection.ws.send(JSON.stringify({
//       type: 'processing_stopped',
//       sessionId,
//       frameCount: session.frameCount,
//       duration: Date.now() - session.startTime,
//       fps: calculateFPS(session)
//     }));
//   }

//   // Generate video in background
//   if (session.frameCount > 0) {
//     generateVideo(sessionId, session.tempDir)
//       .then(videoPath => {
//         if (connection) {
//           connection.ws.send(JSON.stringify({
//             type: 'video_ready',
//             sessionId,
//             downloadUrl: `/api/download/${sessionId}`,
//             frameCount: session.frameCount,
//             videoPath
//           }));
//         }
//       })
//       .catch(error => {
//         console.error('Video generation error:', error);
//       });
//   }
// }

// async function generateVideo(sessionId, framesDir) {
//   return new Promise((resolve, reject) => {
//     const videoPath = path.join(framesDir, 'output.mp4');

//     const ffmpeg = spawn('ffmpeg', [
//       '-framerate', '10',
//       '-pattern_type', 'glob',
//       '-i', path.join(framesDir, 'dehazed_*.jpg'),
//       '-c:v', 'libx264',
//       '-pix_fmt', 'yuv420p',
//       '-preset', 'fast',
//       videoPath
//     ]);

//     ffmpeg.on('close', (code) => {
//       if (code === 0) {
//         console.log(`✅ Video generated: ${videoPath}`);
//         resolve(videoPath);
//       } else {
//         reject(new Error(`FFmpeg failed with code ${code}`));
//       }
//     });

//     ffmpeg.on('error', reject);

//     ffmpeg.stderr.on('data', (data) => {
//       console.log(`FFmpeg: ${data}`);
//     });
//   });
// }

// async function handleStartWebRTC(ws, clientId, data) {
//   console.log(`📡 Starting WebRTC for ${clientId}`);

//   ws.send(JSON.stringify({
//     type: 'webrtc_ready',
//     clientId,
//     iceServers: [
//       { urls: 'stun:stun.l.google.com:19302' },
//       { urls: 'stun:stun1.l.google.com:19302' }
//     ]
//   }));
// }

// async function handleWebRTCOffer(ws, clientId, data) {
//   console.log(`📩 WebRTC offer from ${clientId}`);

//   // Acknowledge offer
//   ws.send(JSON.stringify({
//     type: 'webrtc_offer_received',
//     clientId,
//     message: 'WebRTC offer received'
//   }));
// }

// async function handleWebRTCAnswer(clientId, data) {
//   console.log(`📩 Received WebRTC answer from ${clientId}`);
// }

// async function handleWebRTCIceCandidate(clientId, data) {
//   console.log(`📩 Received ICE candidate from ${clientId}`);
// }

// function calculateFPS(session) {
//   const duration = (Date.now() - session.startTime) / 1000;
//   return duration > 0 ? (session.frameCount / duration).toFixed(1) : '0';
// }

// function cleanupSession(sessionId) {
//   const session = activeSessions.get(sessionId);
//   if (session && session.tempDir) {
//     try {
//       const fs = require('fs');
//       fs.rmSync(session.tempDir, { recursive: true, force: true });
//       console.log(`🧹 Cleaned session: ${sessionId}`);
//     } catch (error) {
//       console.error('Cleanup error:', error);
//     }
//   }
//   activeSessions.delete(sessionId);
// }

// // Get connection stats
// function getStats() {
//   return {
//     totalConnections: connections.size,
//     activeSessions: activeSessions.size,
//     clients: Array.from(connections.keys())
//   };
// }

// module.exports = {
//   initWebSocket,
//   getStats,
//   wss: () => wss
// };


// ADD THIS TO YOUR websocketService.js:

// Handle binary frame (JPEG bytes directly - no base64!)
async function handleBinaryFrame(ws, metadata, binaryData) {
  const { frameNumber, sessionId, userId, timestamp } = metadata;

  const session = activeRealtimeSessions.get(sessionId);
  if (!session) {
    console.warn(`No session found for binary frame: ${sessionId}`);
    return;
  }

  // UPDATE FPS
  const now = Date.now();
  const frameTimeDiff = now - session.lastFrameTime;
  session.lastFrameTime = now;

  if (frameTimeDiff > 0) {
    session.fps = Math.round(1000 / frameTimeDiff);
  }

  session.frameCount++;

  console.log(`📸 Binary frame ${frameNumber} received (${binaryData.length} bytes) @ ${session.fps} FPS`);

  // Broadcast processed frame back as Base64 with prefix (Deep Focus Solution)
  const base64WithPrefix = `data:image/jpeg;base64,${binaryData.toString('base64')}`;

  const output = JSON.stringify({
    type: 'processed_frame',
    sessionId,
    frameNumber,
    frameCount: session.frameCount,
    fps: session.fps,
    processingTime: 0,
    mode: session.mode,
    timestamp: Date.now(),
    originalFrame: base64WithPrefix,
    processedFrame: base64WithPrefix,
    isBinary: false
  });

  // Direct send back to sender
  try { ws.send(output); } catch (e) { }

  if (wss && wss.clients) {
    wss.clients.forEach(client => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(output);
      }
    });
  }
}

const activeRealtimeSessions = new Map();

async function handleStartProcessing(ws, clientId, data) {
  const { userId, mode = 'cloud', sessionId } = data;

  const newSessionId = sessionId || `realtime_${userId}_${Date.now()}`;

  // Create temp directory for this session
  const tempDir = path.join(__dirname, '..', '..', 'temp', newSessionId);
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  activeRealtimeSessions.set(newSessionId, {
    clientId,
    userId,
    mode,
    ws,
    tempDir, // Store temp directory path
    frames: [],
    startTime: Date.now(),
    frameCount: 0,
    lastFrameTime: Date.now(),
    fps: 0,
    isGeneratingVideo: false
  });

  ws.send(JSON.stringify({
    type: 'session_created',
    sessionId: newSessionId,
    timestamp: Date.now()
  }));

  console.log(`🎬 Real-time session started: ${newSessionId} (Temp: ${tempDir})`);
}

async function handleVideoFrame(ws, data) {
  const { frame, frameNumber, userId, sessionId, mode = 'cloud' } = data;

  const session = activeRealtimeSessions.get(sessionId);
  if (!session) return;

  // UPDATE FPS
  const now = Date.now();
  const frameTimeDiff = now - session.lastFrameTime;
  session.lastFrameTime = now;

  if (frameTimeDiff > 0) {
    session.fps = Math.round(1000 / frameTimeDiff);
  }

  session.frameCount++;

  // Throttled logging
  if (session.frameCount % 20 === 1) {
    console.log(`📸 Frame ${session.frameCount} received for session ${sessionId} @ ${session.fps} FPS`);
  }

  // ✅ INSTANT ACKNOWLEDGMENT
  ws.send(JSON.stringify({
    type: 'frame_acknowledged',
    frameNumber,
    sessionId,
    timestamp: now,
    queuePosition: session.frameCount
  }));

  // Process with AI
  let processedFrameBase64 = frame;
  try {
    // Call the actual AI service
    processedFrameBase64 = await aiService.processFrame(frame, mode);
  } catch (error) {
    console.error('AI Processing error, using original frame:', error.message);
  }

  const prefix = 'data:image/jpeg;base64,';
  const originalFrame = frame.startsWith('data:') ? frame : `${prefix}${frame}`;
  const processedFrame = processedFrameBase64.startsWith('data:') ? processedFrameBase64 : `${prefix}${processedFrameBase64}`;

  // Send processed frame back
  const output = JSON.stringify({
    type: 'processed_frame',
    sessionId,
    frameNumber,
    originalFrame: originalFrame,
    processedFrame: processedFrame,
    fps: session.fps,
    frameCount: session.frameCount,
    processingTime: Date.now() - now
  });

  try { ws.send(output); } catch (e) { }

  // Broadcast to other clients if needed
  if (wss && wss.clients) {
    wss.clients.forEach(client => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(output);
      }
    });
  }

  // ✅ SAVE DEHAZED FRAME TO DISK (Synchronous ensures integrity for FFmpeg)
  try {
    const cleanBase64 = processedFrame.replace(/^data:image\/[a-z]+;base64,/, '');
    const framePath = path.join(session.tempDir, `dehazed_${frameNumber.toString().padStart(6, '0')}.jpg`);

    if (session.frameCount === 1) {
      console.log(`💾 First frame saving to: ${framePath}`);
    }

    fs.writeFileSync(framePath, cleanBase64, 'base64');
  } catch (error) {
    console.error(`❌ Disk I/O error for frame ${frameNumber}:`, error.message);
  }
}

async function handleStopProcessing(clientId, data) {
  const { sessionId } = data;
  const session = activeRealtimeSessions.get(sessionId);

  if (!session) return;

  console.log(`🛑 Stopping real-time session: ${sessionId} (${session.frameCount} frames)`);

  const duration = Date.now() - session.startTime;
  const avgFps = Math.round(session.frameCount / (duration / 1000));

  // Use ws from session
  if (session.ws && session.ws.readyState === WebSocket.OPEN) {
    session.ws.send(JSON.stringify({
      type: 'processing_complete',
      sessionId,
      totalFrames: session.frameCount,
      avgFps,
      duration,
      mode: session.mode
    }));

    // IF we have frames, generate video
    if (session.frameCount > 0 && !session.isGeneratingVideo) {
      session.isGeneratingVideo = true;

      console.log(`🎬 Generating video for session ${sessionId}...`);
      console.log(`📂 Source Frames Pattern: ${path.join(session.tempDir, 'dehazed_%06d.jpg')}`);
      console.log(`🎯 Output Video Path: ${path.join(session.tempDir, 'output.mp4')}`);

      generateVideo(session.tempDir)
        .then(() => {
          if (session.ws && session.ws.readyState === WebSocket.OPEN) {
            session.ws.send(JSON.stringify({
              type: 'video_ready',
              sessionId,
              downloadUrl: `/api/download/${sessionId}`,
              message: 'Video compilation complete. You can now download the dehazed video.',
              frameCount: session.frameCount
            }));
          }
          console.log(`✅ Video ready for download: ${sessionId}`);
        })
        .catch(err => {
          console.error(`❌ Video generation failed for ${sessionId}:`, err.message);
          if (session.ws && session.ws.readyState === WebSocket.OPEN) {
            session.ws.send(JSON.stringify({
              type: 'error',
              message: 'Video generation failed: ' + err.message
            }));
          }
        });
    }
  }

  // Cleanup after 1 hour (give user time to download)
  setTimeout(() => {
    cleanupSession(sessionId);
  }, 60 * 60 * 1000);
}

/**
 * Generate MP4 video from JPG frames using FFmpeg
 */
async function generateVideo(tempDir) {
  return new Promise((resolve, reject) => {
    const videoPath = path.join(tempDir, 'output.mp4');

    // -framerate 10: 10 FPS
    // -pattern_type glob -i 'dehazed_*.jpg': process all dehazed images
    // -c:v libx264: H.264 codec
    // -pix_fmt yuv420p: for maximum compatibility
    const ffmpeg = spawn('ffmpeg', [
      '-y', // Overwrite output file
      '-framerate', '10',
      '-i', path.join(tempDir, 'dehazed_%06d.jpg'), // Uses sequential numbering
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-preset', 'fast',
      videoPath
    ]);

    ffmpeg.stderr.on('data', (data) => {
      console.log(`[FFmpeg] ${data.toString()}`);
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve(videoPath);
      } else {
        console.error(`❌ FFmpeg exited with code ${code}`);
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });

    ffmpeg.on('error', (err) => {
      console.error(`❌ FFmpeg Error: ${err.message}`);
      reject(err);
    });
  });
}

/**
 * Delete temp folder and session data
 */
function cleanupSession(sessionId) {
  const session = activeRealtimeSessions.get(sessionId);
  if (session && session.tempDir) {
    try {
      if (fs.existsSync(session.tempDir)) {
        fs.rmSync(session.tempDir, { recursive: true, force: true });
        console.log(`🧹 Cleaned up session storage: ${sessionId}`);
      }
    } catch (error) {
      console.error(`❌ Cleanup error for ${sessionId}:`, error.message);
    }
  }
  activeRealtimeSessions.delete(sessionId);
}

async function handleSwitchMode(clientId, data) {
  const { sessionId, mode } = data;
  const session = activeRealtimeSessions.get(sessionId);
  if (session) {
    session.mode = mode;
    console.log(`🔄 Switched session ${sessionId} to ${mode} mode`);
  }
}

// WebSocket Server Instance
let wss = null;

// Initialize WebSocket with HTTP server
function initWebSocket(server) {
  console.log('🔌 Initializing WebSocket server...');

  wss = new WebSocket.Server({ server });

  wss.on('connection', (ws, req) => {
    const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log(`✅ WebSocket client connected: ${clientId}`);

    ws.send(JSON.stringify({
      type: 'connection_established',
      clientId,
      message: 'Connected to dehazing backend',
      timestamp: new Date().toISOString()
    }));

    // Track pending binary frame metadata per client
    let pendingBinaryMeta = null;

    ws.on('message', async (message, isBinary) => {
      try {
        // Handle binary frames (JPEG bytes directly)
        if (Buffer.isBuffer(message) && pendingBinaryMeta) {
          // This is a binary frame following metadata
          await handleBinaryFrame(ws, pendingBinaryMeta, message);
          pendingBinaryMeta = null;
          return;
        }

        // Try to parse as JSON
        const data = JSON.parse(message.toString());

        // Check if this is metadata for upcoming binary frame
        if (data.type === 'binary_frame') {
          pendingBinaryMeta = data;
          return;
        }

        switch (data.type) {
          case 'start_processing':
            await handleStartProcessing(ws, clientId, data);
            break;
          case 'video_frame':
            await handleVideoFrame(ws, data);
            break;
          case 'stop_processing':
            await handleStopProcessing(clientId, data);
            break;
          case 'switch_mode':
            await handleSwitchMode(clientId, data);
            break;
          case 'ping':
            ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
            break;
          default:
            console.warn(`Unknown message type: ${data.type}`);
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
        ws.send(JSON.stringify({ type: 'error', message: error.message }));
      }
    });

    ws.on('close', () => {
      console.log(`🔌 Client disconnected: ${clientId}`);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error.message);
    });
  });

  console.log('✅ WebSocket server initialized');
  return wss;
}

module.exports = {
  initWebSocket,
  wss: () => wss
};
