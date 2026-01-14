// const express = require('express');
// const cors = require('cors');
// const helmet = require('helmet');
// const rateLimit = require('express-rate-limit');
// const authRoutes = require('./routes/authRoutes');
// const processingRoutes = require('./routes/processingRoutes');
// const app = express();

// app.use(cors());
// app.use(helmet());
// app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));
// app.use(express.json());
// app.use('/api/auth', authRoutes);
// app.use('/api/processing', processingRoutes);

// module.exports = app;

// const express = require('express');
// const cors = require('cors');
// const helmet = require('helmet');
// const rateLimit = require('express-rate-limit');
// const authRoutes = require('./routes/authRoutes');
// const processingRoutes = require('./routes/processingRoutes');

// const app = express();

// app.use(cors());
// app.use(helmet());
// app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));
// app.use(express.json());

// // ✅ Test route — helps confirm the API is running
// app.get('/', (req, res) => {
//   res.send('✅ API is running successfully!');
// });

// app.use('/api/auth', authRoutes);
// app.use('/api/processing', processingRoutes);

// module.exports = app;

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const authRoutes = require('./routes/authRoutes');
const processingRoutes = require('./routes/processingRoutes');
const gridfsStorage = require('./services/gridfsStorageService');  // ✅ NEW

const app = express();

app.use(cors());
app.use(helmet());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));
app.use(express.json({ limit: '50mb' }));  // ✅ INCREASED for images

// Test route
app.get('/', (req, res) => {
  res.send('✅ AI Dehazing API is running!');
});

// ✅ NEW: Serve images from GridFS
app.get('/file/:id', async (req, res) => {
  await gridfsStorage.getFrame(req.params.id, res);
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/processing', processingRoutes);

module.exports = app;
