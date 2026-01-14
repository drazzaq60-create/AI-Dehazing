// const jwt = require('jsonwebtoken');
// module.exports = (req, res, next) => {
//   const token = req.header('Authorization')?.replace('Bearer ', '');
//   if (!token) return res.status(401).json({ message: 'No token provided' });
//   try {
//     req.user = jwt.verify(token, process.env.JWT_SECRET);
//     next();
//   } catch (err) {
//     res.status(401).json({ message: 'Invalid token' });
//   }
// };
const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authorization header missing or malformed' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    console.log('🔐 Received token:', token);
    console.log('🧩 Secret used:', process.env.JWT_SECRET ? 'Exists' : 'MISSING');

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;

    next();
  } catch (error) {
    console.error('Token verification error:', error.message);
    return res.status(401).json({ message: 'Invalid token' });
  }
};
