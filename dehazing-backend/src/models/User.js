// const mongoose = require('mongoose');
// const userSchema = new mongoose.Schema({
//   name: { type: String, required: true },
//   email: { type: String, required: true, unique: true },
//   password: { type: String, required: true },
//   mfaCode: { type: String },
//   createdAt: { type: Date, default: Date.now },
// });
// module.exports = mongoose.model('User', userSchema);

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Define User Schema
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  
  // ✅ NEW: MFA & Password Reset fields
  mfaCode: { type: String },
  mfaExpiry: { type: Date },
  resetCode: { type: String },
  resetExpiry: { type: Date },
  
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
