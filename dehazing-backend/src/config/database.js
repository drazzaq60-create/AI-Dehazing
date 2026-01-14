// const mongoose = require('mongoose');

// const connectDB = async () => {
//   try {
//     await mongoose.connect(process.env.MONGO_URI, {
//       useNewUrlParser: true,
//       useUnifiedTopology: true,
//     });
//     console.log('MongoDB connected');
//   } catch (err) {
//     console.error('MongoDB connection error:', err);
//     process.exit(1);
//   }
// };

// module.exports = { connectDB };

const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);  // ✅ Remove deprecated options
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    console.log('❌ MongoDB Offline - Start DB to login!');
    // process.exit(1);
  }
};

module.exports = { connectDB };
