const mongoose = require('mongoose');
const logSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  type: { type: String, enum: ['frame', 'detection', 'error'] },
  data: { type: mongoose.Schema.Types.Mixed },
  timestamp: { type: Date, default: Date.now },
});
module.exports = mongoose.model('Log', logSchema);
