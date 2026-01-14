// const express = require('express');
// const { signup, login, verifyMfa, forgotPassword } = require('../controllers/authController');
// const router = express.Router();
// router.post('/signup', signup);
// router.post('/login', login);
// router.post('/verify-mfa', verifyMfa);
// router.post('/forgot-password', forgotPassword);
// module.exports = router;

// const express = require('express');
// const { 
//   signup, 
//   login, 
//   verifyMfa, 
//   forgotPassword,
//   verifyResetCode,  // ✅ NEW
//   resetPassword      // ✅ NEW
// } = require('../controllers/authController');

// const router = express.Router();

// router.post('/signup', signup);
// router.post('/login', login);
// router.post('/verify-mfa', verifyMfa);
// router.post('/forgot-password', forgotPassword);
// router.post('/verify-reset-code', verifyResetCode);  // ✅ NEW
// router.post('/reset-password', resetPassword);        // ✅ NEW

// module.exports = router;

// const express = require('express');
// const bcrypt = require('bcryptjs');
// const jwt = require('jsonwebtoken');
// const User = require('../models/User');
// const router = express.Router();

// // Register
// router.post('/register', async (req, res) => {
//   try {
//     const { name, email, password } = req.body;

//     // Check if user exists
//     const existingUser = await User.findOne({ email });
//     if (existingUser) {
//       return res.status(400).json({ message: 'User already exists' });
//     }

//     // Hash password
//     const hashedPassword = await bcrypt.hash(password, 12);

//     // Create user
//     const user = new User({
//       name,
//       email,
//       password: hashedPassword
//     });

//     await user.save();

//     // Generate token
//     const token = jwt.sign(
//       { id: user._id, email: user.email },
//       process.env.JWT_SECRET,
//       { expiresIn: '24h' }
//     );

//     res.status(201).json({
//       message: 'User created successfully',
//       token,
//       user: {
//         id: user._id,
//         name: user.name,
//         email: user.email
//       }
//     });
//   } catch (error) {
//     console.error('Registration error:', error);
//     res.status(500).json({ message: 'Server error during registration' });
//   }
// });

// // Login
// router.post('/login', async (req, res) => {
//   try {
//     const { email, password } = req.body;

//     // Find user
//     const user = await User.findOne({ email });
//     if (!user) {
//       return res.status(401).json({ message: 'Invalid credentials' });
//     }

//     // Check password
//     const isPasswordValid = await bcrypt.compare(password, user.password);
//     if (!isPasswordValid) {
//       return res.status(401).json({ message: 'Invalid credentials' });
//     }

//     // Generate token
//     const token = jwt.sign(
//       { id: user._id, email: user.email },
//       process.env.JWT_SECRET,
//       { expiresIn: '24h' }
//     );

//     res.json({
//       message: 'Login successful',
//       token,
//       user: {
//         id: user._id,
//         name: user.name,
//         email: user.email
//       }
//     });
//   } catch (error) {
//     console.error('Login error:', error);
//     res.status(500).json({ message: 'Server error during login' });
//   }
// });

// module.exports = router;



// //deepseek
// const express = require('express');
// const bcrypt = require('bcryptjs');
// const jwt = require('jsonwebtoken');
// const User = require('../models/User');
// const router = express.Router();

// // Register endpoint
// router.post('/register', async (req, res) => {
//   try {
//     const { name, email, password } = req.body;

//     // Check if user exists
//     const existingUser = await User.findOne({ email });
//     if (existingUser) {
//       return res.status(400).json({ message: 'User already exists' });
//     }

//     // Hash password
//     const hashedPassword = await bcrypt.hash(password, 12);

//     // Create user
//     const user = new User({
//       name,
//       email,
//       password: hashedPassword
//     });

//     await user.save();

//     // Generate token
//     const token = jwt.sign(
//       { id: user._id, email: user.email },
//       process.env.JWT_SECRET,
//       { expiresIn: '24h' }
//     );

//     res.status(201).json({
//       message: 'User created successfully',
//       token,
//       user: { id: user._id, name: user.name, email: user.email }
//     });
//   } catch (error) {
//     console.error('Registration error:', error);
//     res.status(500).json({ message: 'Server error' });
//   }
// });

// // Login endpoint  
// router.post('/login', async (req, res) => {
//   try {
//     const { email, password } = req.body;

//     // Find user
//     const user = await User.findOne({ email });
//     if (!user) {
//       return res.status(401).json({ message: 'Invalid credentials' });
//     }

//     // Check password
//     const isPasswordValid = await bcrypt.compare(password, user.password);
//     if (!isPasswordValid) {
//       return res.status(401).json({ message: 'Invalid credentials' });
//     }

//     // Generate token
//     const token = jwt.sign(
//       { id: user._id, email: user.email },
//       process.env.JWT_SECRET,
//       { expiresIn: '24h' }
//     );

//     res.json({
//       message: 'Login successful',
//       token,
//       user: { id: user._id, name: user.name, email: user.email }
//     });
//   } catch (error) {
//     console.error('Login error:', error);
//     res.status(500).json({ message: 'Server error' });
//   }
// });

// module.exports = router;

// const express = require('express');
// const bcrypt = require('bcryptjs');
// const jwt = require('jsonwebtoken');
// const User = require('../models/User');
// const emailService = require('../services/emailService');
// const router = express.Router();

// // ✅ SIGNUP (with welcome email)
// router.post('/register', async (req, res) => {
//   try {
//     const { name, email, password } = req.body;

//     if (!name || !email || !password) {
//       return res.status(400).json({ message: 'All fields are required' });
//     }

//     if (password.length < 8) {
//       return res.status(400).json({ message: 'Password must be at least 8 characters' });
//     }

//     const existingUser = await User.findOne({ email });
//     if (existingUser) {
//       return res.status(400).json({ message: 'User already exists' });
//     }

//     const hashedPassword = await bcrypt.hash(password, 10);
//     const user = new User({ name, email, password: hashedPassword });
//     await user.save();

//     // ✅ Send welcome email
//     await emailService.sendWelcomeEmail(email, name);

//     // Generate token
//     const token = jwt.sign(
//       { id: user._id, email: user.email },
//       process.env.JWT_SECRET,
//       { expiresIn: '24h' }
//     );

//     res.status(201).json({
//       message: 'User created successfully',
//       token,
//       user: { id: user._id, name: user.name, email: user.email }
//     });
//   } catch (error) {
//     console.error('Registration error:', error);
//     res.status(500).json({ message: 'Server error' });
//   }
// });

// // ✅ LOGIN (with MFA)
// router.post('/login', async (req, res) => {
//   try {
//     const { email, password } = req.body;

//     if (!email || !password) {
//       return res.status(400).json({ message: 'Email and password required' });
//     }

//     const user = await User.findOne({ email });
//     if (!user || !(await bcrypt.compare(password, user.password))) {
//       return res.status(400).json({ message: 'Invalid credentials' });
//     }

//     // ✅ Generate MFA code
//     const mfaCode = Math.floor(100000 + Math.random() * 900000).toString();
//     user.mfaCode = mfaCode;
//     user.mfaExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes
//     await user.save();

//     // ✅ Send MFA email
//     const emailSent = await emailService.sendMfaCode(email, mfaCode, user.name);

//     if (!emailSent) {
//       console.log(`⚠️ Email failed, MFA code: ${mfaCode}`);
//     }

//     res.json({ message: 'MFA code sent to email' });
//   } catch (error) {
//     console.error('Login error:', error);
//     res.status(500).json({ message: 'Server error' });
//   }
// });

// // ✅ VERIFY MFA
// router.post('/verify-mfa', async (req, res) => {
//   try {
//     const { email, mfaCode } = req.body;

//     if (!email || !mfaCode) {
//       return res.status(400).json({ message: 'Email and MFA code required' });
//     }

//     const user = await User.findOne({ email });
//     if (!user || user.mfaCode !== mfaCode) {
//       return res.status(400).json({ message: 'Invalid MFA code' });
//     }

//     if (Date.now() > user.mfaExpiry) {
//       return res.status(400).json({ message: 'MFA code expired' });
//     }

//     // Clear MFA code
//     user.mfaCode = null;
//     user.mfaExpiry = null;
//     await user.save();

//     // Generate JWT token
//     const token = jwt.sign(
//       { id: user._id, email: user.email },
//       process.env.JWT_SECRET,
//       { expiresIn: '24h' }
//     );

//     res.json({
//       token,
//       user: {
//         id: user._id,
//         name: user.name,
//         email: user.email
//       }
//     });
//   } catch (error) {
//     console.error('MFA verification error:', error);
//     res.status(500).json({ message: 'Server error' });
//   }
// });

// // ✅ FORGOT PASSWORD
// router.post('/forgot-password', async (req, res) => {
//   try {
//     const { email } = req.body;

//     if (!email) {
//       return res.status(400).json({ message: 'Email required' });
//     }

//     const user = await User.findOne({ email });
//     if (!user) {
//       return res.status(400).json({ message: 'User not found' });
//     }

//     // Generate reset code
//     const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
//     user.resetCode = resetCode;
//     user.resetExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes
//     await user.save();

//     // Send reset email
//     const emailSent = await emailService.sendResetCode(email, resetCode, user.name);

//     if (!emailSent) {
//       console.log(`⚠️ Email failed, Reset code: ${resetCode}`);
//     }

//     res.json({ message: 'Reset code sent to email' });
//   } catch (error) {
//     console.error('Forgot password error:', error);
//     res.status(500).json({ message: 'Server error' });
//   }
// });

// // ✅ VERIFY RESET CODE
// router.post('/verify-reset-code', async (req, res) => {
//   try {
//     const { email, resetCode } = req.body;

//     if (!email || !resetCode) {
//       return res.status(400).json({ message: 'Email and reset code required' });
//     }

//     const user = await User.findOne({ email });
//     if (!user || user.resetCode !== resetCode) {
//       return res.status(400).json({ message: 'Invalid reset code' });
//     }

//     if (Date.now() > user.resetExpiry) {
//       return res.status(400).json({ message: 'Reset code expired' });
//     }

//     res.json({ message: 'Code verified, proceed to reset password' });
//   } catch (error) {
//     console.error('Reset code verification error:', error);
//     res.status(500).json({ message: 'Server error' });
//   }
// });

// // ✅ RESET PASSWORD
// router.post('/reset-password', async (req, res) => {
//   try {
//     const { email, resetCode, newPassword } = req.body;

//     if (!email || !resetCode || !newPassword) {
//       return res.status(400).json({ message: 'All fields required' });
//     }

//     if (newPassword.length < 8) {
//       return res.status(400).json({ message: 'Password must be at least 8 characters' });
//     }

//     const user = await User.findOne({ email });
//     if (!user || user.resetCode !== resetCode) {
//       return res.status(400).json({ message: 'Invalid reset code' });
//     }

//     if (Date.now() > user.resetExpiry) {
//       return res.status(400).json({ message: 'Reset code expired' });
//     }

//     // Update password
//     user.password = await bcrypt.hash(newPassword, 10);
//     user.resetCode = null;
//     user.resetExpiry = null;
//     await user.save();

//     res.json({ message: 'Password reset successful' });
//   } catch (error) {
//     console.error('Password reset error:', error);
//     res.status(500).json({ message: 'Server error' });
//   }
// });

// module.exports = router;


const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const emailService = require('../services/emailservice');
const router = express.Router();

// ✅ SIGNUP (with welcome email)
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

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

    // Generate token
    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: { id: user._id, name: user.name, email: user.email }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ✅ LOGIN (with MFA) - UPDATED WITH DEBUG LOGS
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password required' });
    }

    console.log(`🔍 Looking for user: ${email}`);
    const user = await User.findOne({ email });

    if (!user) {
      console.log('❌ User not found');
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    if (!(await bcrypt.compare(password, user.password))) {
      console.log('❌ Password incorrect');
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // ✅ Generate MFA code
    const mfaCode = Math.floor(100000 + Math.random() * 900000).toString();
    console.log(`📧 Generated MFA code: ${mfaCode}`);

    user.mfaCode = mfaCode;
    user.mfaExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes

    console.log(`💾 Before save - MFA code: ${user.mfaCode}`);
    await user.save();
    console.log(`✅ After save - MFA code: ${user.mfaCode}`);

    // ✅ Double check from database
    const freshUser = await User.findOne({ email });
    console.log(`🔍 Database MFA code: ${freshUser.mfaCode}`);

    // ✅ Send MFA email
    const emailSent = await emailService.sendMfaCode(email, mfaCode, user.name);

    if (!emailSent) {
      console.log(`⚠️ Email failed, but MFA code is: ${mfaCode}`);
    } else {
      console.log(`✅ Email sent with MFA code: ${mfaCode}`);
    }

    res.json({ message: 'MFA code sent to email' });
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ✅ VERIFY MFA - UPDATED WITH DEBUG LOGS
router.post('/verify-mfa', async (req, res) => {
  try {
    const { email, mfaCode } = req.body;

    if (!email || !mfaCode) {
      return res.status(400).json({ message: 'Email and MFA code required' });
    }

    console.log(`🔍 Verifying MFA for: ${email}, Code entered: ${mfaCode}`);
    const user = await User.findOne({ email });

    if (!user) {
      console.log('❌ User not found during MFA verification');
      return res.status(400).json({ message: 'Invalid MFA code' });
    }

    console.log(`🔍 Stored MFA code: ${user.mfaCode}, Expiry: ${user.mfaExpiry}`);
    console.log(`🔍 Current time: ${Date.now()}`);

    if (!user.mfaCode || user.mfaCode !== mfaCode) {
      console.log('❌ MFA code mismatch or missing');
      return res.status(400).json({ message: 'Invalid MFA code' });
    }

    if (Date.now() > user.mfaExpiry) {
      console.log('❌ MFA code expired');
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

    console.log('✅ MFA verification successful');
    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error('❌ MFA verification error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ✅ FORGOT PASSWORD
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

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
    }

    res.json({ message: 'Reset code sent to email' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ✅ VERIFY RESET CODE
router.post('/verify-reset-code', async (req, res) => {
  try {
    const { email, resetCode } = req.body;

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
});

// ✅ RESET PASSWORD
router.post('/reset-password', async (req, res) => {
  try {
    const { email, resetCode, newPassword } = req.body;

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
});

module.exports = router;
