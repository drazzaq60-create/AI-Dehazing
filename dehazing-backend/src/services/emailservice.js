const nodemailer = require('nodemailer');

// Create email transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Test connection on startup
transporter.verify((error, success) => {
  if (error) {
    console.log('⚠️ Email not configured:', error.message);
  } else {
    console.log('✅ Email server ready');
  }
});

/**
 * Send MFA code to user email
 */
exports.sendMfaCode = async (email, code, name) => {
  const mailOptions = {
    from: `"AI Dehazing System" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: '🔐 Your MFA Verification Code',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; background-color: #0f172a; color: #fff; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: rgba(255,255,255,0.1); border-radius: 10px; padding: 30px; }
          .code { font-size: 36px; font-weight: bold; color: #3b82f6; letter-spacing: 12px; text-align: center; padding: 25px; background: rgba(59,130,246,0.2); border-radius: 10px; margin: 20px 0; }
          .footer { font-size: 12px; color: #93c5fd; text-align: center; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2 style="text-align: center; color: #60a5fa;">🔐 MFA Verification Code</h2>
          <p>Hello ${name || 'User'},</p>
          <p>Your Multi-Factor Authentication code is:</p>
          <div class="code">${code}</div>
          <p>This code will expire in <strong>10 minutes</strong>.</p>
          <p>If you didn't request this code, please ignore this email.</p>
          <div class="footer">
            <p>AI Dehazing System | Real-Time Video Clarity Enhancement</p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ MFA code sent to ${email}`);
    return true;
  } catch (error) {
    console.error('❌ Email error:', error);
    return false;
  }
};

/**
 * Send password reset code
 */
exports.sendResetCode = async (email, code, name) => {
  const mailOptions = {
    from: `"AI Dehazing System" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: '🔓 Password Reset Code',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; background-color: #0f172a; color: #fff; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: rgba(255,255,255,0.1); border-radius: 10px; padding: 30px; }
          .code { font-size: 36px; font-weight: bold; color: #ef4444; letter-spacing: 12px; text-align: center; padding: 25px; background: rgba(239,68,68,0.2); border-radius: 10px; margin: 20px 0; }
          .warning { background: rgba(239,68,68,0.2); padding: 15px; border-radius: 8px; margin: 20px 0; }
          .footer { font-size: 12px; color: #93c5fd; text-align: center; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2 style="text-align: center; color: #fca5a5;">🔓 Password Reset Request</h2>
          <p>Hello ${name || 'User'},</p>
          <p>You requested to reset your password. Your verification code is:</p>
          <div class="code">${code}</div>
          <p>This code will expire in <strong>15 minutes</strong>.</p>
          <div class="warning">
            <strong>⚠️ Security Notice:</strong><br>
            If you didn't request this password reset, please ignore this email.
          </div>
          <div class="footer">
            <p>AI Dehazing System | Real-Time Video Clarity Enhancement</p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Reset code sent to ${email}`);
    return true;
  } catch (error) {
    console.error('❌ Email error:', error);
    return false;
  }
};

/**
 * Send welcome email
 */
exports.sendWelcomeEmail = async (email, name) => {
  const mailOptions = {
    from: `"AI Dehazing System" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: '🎉 Welcome to AI Dehazing System!',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; background-color: #0f172a; color: #fff; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: rgba(255,255,255,0.1); border-radius: 10px; padding: 30px; }
          .features { background: rgba(59,130,246,0.2); padding: 20px; border-radius: 10px; margin: 20px 0; }
          .footer { font-size: 12px; color: #93c5fd; text-align: center; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2 style="text-align: center; color: #60a5fa;">🎉 Welcome ${name || 'User'}!</h2>
          <p>Thank you for joining AI Dehazing System.</p>
          <div class="features">
            <h3 style="color: #93c5fd;">✨ What you can do:</h3>
            <ul>
              <li>📹 Real-time video capture & processing</li>
              <li>☁️ Cloud & Local dehazing modes</li>
              <li>👁️ YOLO-based evaluation</li>
              <li>📊 Performance analytics</li>
              <li>💾 All images saved automatically</li>
            </ul>
          </div>
          <div class="footer">
            <p>AI Dehazing System | Real-Time Video Clarity Enhancement</p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Welcome email sent to ${email}`);
    return true;
  } catch (error) {
    console.error('❌ Email error:', error);
    return false;
  }
};
