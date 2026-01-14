// const mongoose = require('mongoose');

// const videoCaptureSchema = new mongoose.Schema({
//   userId: { 
//     type: mongoose.Schema.Types.ObjectId, 
//     ref: 'User',
//     required: true 
//   },
  
//   captureId: { 
//     type: String, 
//     unique: true,
//     required: true 
//   },
  
//   source: { 
//     type: String, 
//     enum: ['camera', 'upload'],
//     required: true 
//   },
  
//   // Frames saved to GridFS
//   frames: [{
//     frameNumber: Number,
//     timestamp: Number,
//     hazyImageId: String,      // GridFS file ID
//     dehazedImageId: String,   // GridFS file ID
//     hazyImageUrl: String,     // /file/{id}
//     dehazedImageUrl: String,  // /file/{id}
//     mode: { type: String, enum: ['cloud', 'local'] },
//     delay: Number,
//     fps: Number,
//     psnr: Number,
//     ssim: Number,
//     capturedAt: { type: Date, default: Date.now }
//   }],
  
//   // Session stats
//   stats: {
//     totalFrames: { type: Number, default: 0 },
//     avgFps: Number,
//     avgDelay: Number,
//     avgPsnr: Number,
//     avgSsim: Number,
//     totalDuration: Number
//   },
  
//   // Status
//   status: {
//     type: String,
//     enum: ['capturing', 'processing', 'completed', 'failed'],
//     default: 'capturing'
//   },
  
//   createdAt: { type: Date, default: Date.now },
//   completedAt: Date
// });

// // Indexes for fast queries
// videoCaptureSchema.index({ userId: 1, createdAt: -1 });
// videoCaptureSchema.index({ captureId: 1 });

// module.exports = mongoose.model('VideoCapture', videoCaptureSchema);

// const mongoose = require('mongoose');

// const videoCaptureSchema = new mongoose.Schema({
//   userId: { 
//     type: Number, // <--- FIX IS HERE: Changed from mongoose.Schema.Types.ObjectId
//     // Note: Removed 'ref: 'User'' because Number cannot reference a model using ObjectId as the primary key.
//     required: true 
//   },
  
//   captureId: { 
//     type: String, 
//     unique: true,
//     required: true 
//   },
  
//   source: { 
//     type: String, 
//     enum: ['camera', 'upload'],
//     required: true 
//   },
  
//   // Frames saved to GridFS
//   frames: [{
//     frameNumber: Number,
//     timestamp: Number,
//     hazyImageId: String,       // GridFS file ID
//     dehazedImageId: String,    // GridFS file ID
//     hazyImageUrl: String,      // /file/{id}
//     dehazedImageUrl: String,   // /file/{id}
//     mode: { type: String, enum: ['cloud', 'local'] },
//     delay: Number,
//     fps: Number,
//     psnr: Number,
//     ssim: Number,
//     capturedAt: { type: Date, default: Date.now }
//   }],
  
//   // Session stats
//   stats: {
//     totalFrames: { type: Number, default: 0 },
//     avgFps: Number,
//     avgDelay: Number,
//     avgPsnr: Number,
//     avgSsim: Number,
//     totalDuration: Number
//   },
  
//   // Status
//   status: {
//     type: String,
//     enum: ['capturing', 'processing', 'completed', 'failed'],
//     default: 'capturing'
//   },
  
//   createdAt: { type: Date, default: Date.now },
//   completedAt: Date
// });

// // Indexes for fast queries
// videoCaptureSchema.index({ userId: 1, createdAt: -1 });
// videoCaptureSchema.index({ captureId: 1 });

// module.exports = mongoose.model('VideoCapture', videoCaptureSchema);

const mongoose = require('mongoose');

const videoCaptureSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, // ✅ FIX: Changed from Number to ObjectId
    ref: 'User', // ✅ FIX: Added back reference to User model
    required: true 
  },
  
  captureId: { 
    type: String, 
    unique: true,
    required: true 
  },
  
  source: { 
    type: String, 
    enum: ['camera', 'upload'],
    required: true 
  },
  
  // Frames saved to GridFS
  frames: [{
    frameNumber: Number,
    timestamp: Number,
    hazyImageId: String,       // GridFS file ID
    dehazedImageId: String,    // GridFS file ID
    hazyImageUrl: String,      // /file/{id}
    dehazedImageUrl: String,   // /file/{id}
    mode: { type: String, enum: ['cloud', 'local'] },
    delay: Number,
    fps: Number,
    psnr: Number,
    ssim: Number,
    capturedAt: { type: Date, default: Date.now }
  }],
  
  // Session stats
  stats: {
    totalFrames: { type: Number, default: 0 },
    avgFps: Number,
    avgDelay: Number,
    avgPsnr: Number,
    avgSsim: Number,
    totalDuration: Number
  },
  
  // Status
  status: {
    type: String,
    enum: ['capturing', 'processing', 'completed', 'failed'],
    default: 'capturing'
  },
  
  createdAt: { type: Date, default: Date.now },
  completedAt: Date
});

// Indexes for fast queries
videoCaptureSchema.index({ userId: 1, createdAt: -1 });
videoCaptureSchema.index({ captureId: 1 });

module.exports = mongoose.model('VideoCapture', videoCaptureSchema);
