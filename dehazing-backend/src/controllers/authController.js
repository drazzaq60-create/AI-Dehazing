const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const emailService = require('../services/emailservice');

// ✅ SIGNUP
const signup = async (req, res) => {
  const { name, email, password } = req.body;
  try {
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hashedPassword });
    await user.save();

    // ✅ Send welcome email
    await emailService.sendWelcomeEmail(email, name);

    res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ✅ LOGIN (with MFA)
const login = async (req, res) => {
  const { email, password } = req.body;
  try {
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password required' });
    }

    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // ✅ Generate MFA code
    const mfaCode = Math.floor(100000 + Math.random() * 900000).toString();
    user.mfaCode = mfaCode;
    user.mfaExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes
    await user.save();

    // ✅ Send MFA email
    const emailSent = await emailService.sendMfaCode(email, mfaCode, user.name);

    if (!emailSent) {
      console.log(`⚠️ Email failed, MFA code: ${mfaCode}`);
    } else {
      console.log(`📧 MFA code sent to ${email}: ${mfaCode}`);
    }

    res.json({ message: 'MFA code sent to email' });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ✅ VERIFY MFA
const verifyMfa = async (req, res) => {
  const { email, mfaCode } = req.body;
  try {
    if (!email || !mfaCode) {
      return res.status(400).json({ message: 'Email and MFA code required' });
    }

    const user = await User.findOne({ email });
    if (!user || user.mfaCode !== mfaCode) {
      return res.status(400).json({ message: 'Invalid MFA code' });
    }

    if (Date.now() > user.mfaExpiry) {
      return res.status(400).json({ message: 'MFA code expired' });
    }

    // Clear MFA code
    user.mfaCode = null;
    user.mfaExpiry = null;
    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error('MFA verification error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ✅ FORGOT PASSWORD
const forgotPassword = async (req, res) => {
  const { email } = req.body;
  try {
    if (!email) {
      return res.status(400).json({ message: 'Email required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'User not found' });
    }

    // Generate reset code
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    user.resetCode = resetCode;
    user.resetExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes
    await user.save();

    // Send reset email
    const emailSent = await emailService.sendResetCode(email, resetCode, user.name);

    if (!emailSent) {
      console.log(`⚠️ Email failed, Reset code: ${resetCode}`);
    } else {
      console.log(`🔑 Reset Code for ${email}: ${resetCode}`);
    }

    res.json({ message: 'Reset code sent to email' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ✅ VERIFY RESET CODE
const verifyResetCode = async (req, res) => {
  const { email, resetCode } = req.body;
  try {
    if (!email || !resetCode) {
      return res.status(400).json({ message: 'Email and reset code required' });
    }

    const user = await User.findOne({ email });
    if (!user || user.resetCode !== resetCode) {
      return res.status(400).json({ message: 'Invalid reset code' });
    }

    if (Date.now() > user.resetExpiry) {
      return res.status(400).json({ message: 'Reset code expired' });
    }

    res.json({ message: 'Code verified, proceed to reset password' });
  } catch (error) {
    console.error('Reset code verification error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ✅ RESET PASSWORD
const resetPassword = async (req, res) => {
  const { email, resetCode, newPassword } = req.body;
  try {
    if (!email || !resetCode || !newPassword) {
      return res.status(400).json({ message: 'All fields required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    const user = await User.findOne({ email });
    if (!user || user.resetCode !== resetCode) {
      return res.status(400).json({ message: 'Invalid reset code' });
    }

    if (Date.now() > user.resetExpiry) {
      return res.status(400).json({ message: 'Reset code expired' });
    }

    // Update password
    user.password = await bcrypt.hash(newPassword, 10);
    user.resetCode = null;
    user.resetExpiry = null;
    await user.save();

    res.json({ message: 'Password reset successful' });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  signup,
  login,
  verifyMfa,
  forgotPassword,
  verifyResetCode,
  resetPassword
};
