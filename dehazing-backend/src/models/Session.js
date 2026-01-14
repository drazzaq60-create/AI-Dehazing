const mongoose = require('mongoose');
const sessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  mode: { type: String, enum: ['cloud', 'local'], default: 'cloud' },
  fps: { type: Number },
  delay: { type: Number },
  psnr: { type: Number },
  ssim: { type: Number },
  totalFrames: { type: Number },
  timestamp: { type: Date, default: Date.now },
});
module.exports = mongoose.model('Session', sessionSchema);
