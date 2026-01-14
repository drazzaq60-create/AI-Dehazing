// const express = require('express');
// const { processImage } = require('../controllers/processingController'); // ← likely here
// router.post('/process', processImage);
// const { getStats } = require('../controllers/processingController');
// const { runEvaluation } = require('../controllers/evaluationController');
// const authMiddleware = require('../middleware/authMiddleware');
// const router = express.Router();
// const { processImage } = require('../controllers/processingController');
// router.post('/process', processImage);
// router.get('/stats', authMiddleware, getStats);
// router.post('/evaluate', authMiddleware, runEvaluation);
// module.exports = router;

// const express = require('express');
// const router = express.Router();

// const { processImage, getStats } = require('../controllers/processingController');
// const { runEvaluation } = require('../controllers/evaluationController');
// const authMiddleware = require('../middleware/authMiddleware');

// // Define routes
// router.post('/process', processImage);
// router.get('/stats', authMiddleware, getStats);
// router.post('/evaluate', authMiddleware, runEvaluation);

// module.exports = router;
// const express = require('express');
// const router = express.Router();

// const { processImage, getStats } = require('../controllers/processingController');
// const { runEvaluation } = require('../controllers/evaluationController');
// const authMiddleware = require('../middleware/authMiddleware');

// // Define routes
// router.post('/process', processImage);
// router.get('/stats', authMiddleware, getStats);
// router.post('/evaluate', authMiddleware, runEvaluation);

// module.exports = router;

// const express = require('express');
// const router = express.Router();

// const { processImage, getStats } = require('../controllers/processingController');
// const { runEvaluation } = require('../controllers/evaluationController');
// const authMiddleware = require('../middleware/authMiddleware');

// // Define routes
// router.post('/process', processImage);
// router.get('/stats', authMiddleware, getStats);
// router.post('/evaluate', authMiddleware, runEvaluation);

// module.exports = router;


// const express = require('express');
// const router = express.Router();
// const multer = require('multer'); 

// // --- Multer Configuration for File Upload ---
// const upload = multer({ storage: multer.memoryStorage() }); 

// // --- Middleware and Controller Imports ---
// const authenticate = require('../middleware/authMiddleware'); 
// const { 
//     uploadAndProcess,
//     processImage,
//     getStats 
// } = require('../controllers/processingController');
// const { runEvaluation } = require('../controllers/evaluationController');


// // --- Define Routes ---

// // 1. SECURE UPLOAD ROUTE (Must be present for your test)
// router.post('/upload', authenticate, upload.single('image'), uploadAndProcess); 

// // 2. Other defined routes 
// router.post('/process', authenticate, processImage);
// router.get('/stats', authenticate, getStats);
// router.post('/evaluate', authenticate, runEvaluation);


// module.exports = router;



// const express = require('express');
// const router = express.Router();
// const multer = require('multer'); 

// // --- Multer Configuration for File Upload ---
// const upload = multer({ storage: multer.memoryStorage() }); 

// // --- Middleware and Controller Imports ---
// const authenticate = require('../middleware/authMiddleware'); 
// const { 
//     uploadAndProcess,
//     processImage,
//     getStats,
//     getImage  // ✅ ADD THIS IMPORT
// } = require('../controllers/processingController');
// const { runEvaluation } = require('../controllers/evaluationController');


// // --- Define Routes ---

// // 1. SECURE UPLOAD ROUTE
// router.post('/upload', authenticate, upload.single('image'), uploadAndProcess); 

// // 2. IMAGE RETRIEVAL ROUTE - ✅ ADD THIS
// router.get('/image/:id', authenticate, getImage);

// // 3. Other defined routes 
// router.post('/process', authenticate, processImage);
// router.get('/stats', authenticate, getStats);
// router.post('/evaluate', authenticate, runEvaluation);

// module.exports = router;


const express = require('express');
const router = express.Router();
const multer = require('multer'); 
const mongoose = require('mongoose');
const { GridFSBucket } = require('mongodb'); // ✅ ADD THIS IMPORT

// --- Multer Configuration for File Upload ---
const upload = multer({ storage: multer.memoryStorage() }); 

// --- Middleware and Controller Imports ---
const authenticate = require('../middleware/authMiddleware'); 
const { 
    uploadAndProcess,
    processImage,
    getStats,
    getImage
} = require('../controllers/processingController');
const { runEvaluation } = require('../controllers/evaluationController');


// --- Define Routes ---

// 1. SECURE UPLOAD ROUTE
router.post('/upload', authenticate, upload.single('image'), uploadAndProcess); 

// 2. IMAGE RETRIEVAL ROUTE - ✅ ADD THIS FILE SERVING ROUTE
router.get('/file/:id', async (req, res) => {
  try {
    const fileId = new mongoose.Types.ObjectId(req.params.id);
    const bucket = new GridFSBucket(mongoose.connection.db, {
      bucketName: 'uploads'
    });

    const downloadStream = bucket.openDownloadStream(fileId);

    downloadStream.on('data', (chunk) => {
      res.write(chunk);
    });

    downloadStream.on('error', (error) => {
      console.error('File download error:', error);
      res.status(404).json({ message: 'File not found' });
    });

    downloadStream.on('end', () => {
      res.end();
    });

  } catch (error) {
    console.error('Get image error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// 3. Other defined routes 
router.get('/image/:id', authenticate, getImage);
router.post('/process', authenticate, processImage);
router.get('/stats', authenticate, getStats);
router.post('/evaluate', authenticate, runEvaluation);

module.exports = router;
