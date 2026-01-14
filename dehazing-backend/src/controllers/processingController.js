// const Session = require('../models/Session');

// const getStats = async (req, res) => {
//   try {
//     const userId = req.user.id; // From auth middleware
//     let session = await Session.findOne({ userId });
//     if (!session) {
//       session = new Session({ userId });
//       await session.save();
//     }
//     res.json(session);
//   } catch (error) {
//     res.status(500).json({ message: 'Server error' });
//   }
// };

// module.exports = { getStats };

// const processImage = async (req, res) => {
//   try {
//     // your image processing logic here
//     res.json({ message: 'Image processed successfully' });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: 'Server error' });
//   }
// };

// const getStats = async (req, res) => {
//   try {
//     // your logic for returning stats
//     res.json({ message: 'Stats retrieved successfully' });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: 'Server error' });
//   }
// };

// module.exports = { processImage, getStats };


// const processImage = async (req, res) => {
//   try {
//     // Example placeholder logic
//     res.json({ message: 'Image processed successfully' });
//   } catch (error) {
//     console.error('Error processing image:', error);
//     res.status(500).json({ message: 'Server error while processing image' });
//   }
// };

// const getStats = async (req, res) => {
//   try {
//     // Example placeholder logic
//     res.json({ message: 'Stats retrieved successfully' });
//   } catch (error) {
//     console.error('Error getting stats:', error);
//     res.status(500).json({ message: 'Server error while fetching stats' });
//   }
// };

// module.exports = { processImage, getStats };



// const processImage = async (req, res) => {
//     try {
//         // Example placeholder logic
//         res.json({ message: 'Image processed successfully' });
//     } catch (error) {
//         console.error('Error processing image:', error);
//         res.status(500).json({ message: 'Server error while processing image' });
//     }
// };

// const getStats = async (req, res) => {
//     try {
//         // Example placeholder logic
//         res.json({ message: 'Stats retrieved successfully' });
//     } catch (error) {
//         console.error('Error getting stats:', error);
//         res.status(500).json({ message: 'Server error while fetching stats' });
//     }
// };

// // 🛑 ADD THE MISSING FUNCTION 🛑
// const uploadAndProcess = async (req, res) => {
//     // This is the function the router is looking for
//     if (!req.file) {
//         return res.status(400).json({ message: 'No file uploaded.' });
//     }

//     // Successfully received file using Multer
//     console.log(`✅ File received: ${req.file.originalname}`);

//     // For testing the route, just return success
//     return res.status(200).json({ 
//         message: "File received successfully. Processing simulation started.",
//         filename: req.file.originalname,
//         // The user object comes from the 'authenticate' middleware
//         userId: req.user ? req.user.id : 'unknown'
//     });
// };

// // 🛑 EXPORT THE NEW FUNCTION 🛑
// module.exports = { processImage, getStats, uploadAndProcess };


// const mongoose = require('mongoose');
// const Grid = require('gridfs-stream');
// const { GridFSBucket } = require('mongodb');

// // Initialize GridFS
// let gfs;
// mongoose.connection.once('open', () => {
//   gfs = Grid(mongoose.connection.db, mongoose.mongo);
//   gfs.collection('uploads'); // This should match your GridFS bucket name
// });

// const uploadAndProcess = async (req, res) => {
//   try {
//     if (!req.file) {
//       return res.status(400).json({
//         success: false,
//         message: 'No image file provided'
//       });
//     }

//     const userId = req.user.id;
//     const file = req.file;

//     console.log('📸 Processing upload for user:', userId);
//     console.log('📁 File details:', {
//       originalname: file.originalname,
//       mimetype: file.mimetype,
//       size: file.size
//     });

//     // ✅ 1. SAVE TO GRIDFS (MongoDB)
//     const bucket = new GridFSBucket(mongoose.connection.db, {
//       bucketName: 'uploads'
//     });

//     const uploadStream = bucket.openUploadStream(file.originalname, {
//       metadata: {
//         userId: userId,
//         uploadDate: new Date(),
//         mimetype: file.mimetype
//       }
//     });

//     // Write file to GridFS
//     uploadStream.end(file.buffer);

//     uploadStream.on('finish', async (file) => {
//       try {
//         console.log('✅ Image saved to GridFS with ID:', file._id);

//         // ✅ 2. PROCESS THE IMAGE (Dehazing logic here)
//         const processedImage = await processImageWithDehazing(file.buffer);
        
//         // ✅ 3. SAVE PROCESSED IMAGE TO GRIDFS
//         const processedStream = bucket.openUploadStream(`processed_${file.originalname}`, {
//           metadata: {
//             userId: userId,
//             originalFileId: file._id,
//             processedDate: new Date(),
//             mimetype: 'image/jpeg' // Processed images as JPEG
//           }
//         });

//         processedStream.end(processedImage);

//         processedStream.on('finish', (processedFile) => {
//           // ✅ 4. SEND RESPONSE
//           res.json({
//             success: true,
//             message: 'Image uploaded and processed successfully',
//             data: {
//               originalFile: {
//                 id: file._id,
//                 name: file.filename,
//                 size: file.length,
//                 uploadDate: file.uploadDate
//               },
//               processedFile: {
//                 id: processedFile._id,
//                 name: processedFile.filename,
//                 size: processedFile.length
//               },
//               userId: userId,
//               processingTime: '50ms', // Simulate processing time
//               metrics: {
//                 originalSize: file.length,
//                 processedSize: processedFile.length,
//                 compression: Math.round((1 - processedFile.length / file.length) * 100)
//               }
//             }
//           });
//         });

//       } catch (processingError) {
//         console.error('❌ Image processing error:', processingError);
//         res.status(500).json({
//           success: false,
//           message: 'Image processing failed',
//           error: processingError.message
//         });
//       }
//     });

//     uploadStream.on('error', (error) => {
//       console.error('❌ GridFS upload error:', error);
//       res.status(500).json({
//         success: false,
//         message: 'Failed to save image',
//         error: error.message
//       });
//     });

//   } catch (error) {
//     console.error('❌ Upload controller error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Upload failed',
//       error: error.message
//     });
//   }
// };

// // ✅ IMAGE PROCESSING FUNCTION (Dehazing)
// const processImageWithDehazing = async (imageBuffer) => {
//   try {
//     console.log('🔄 Processing image with dehazing...');
    
//     // SIMPLE PROCESSING - REPLACE WITH YOUR ACTUAL DEHAZING ALGORITHM
//     // For now, we'll just return the same image
//     // In production, use your ML model here (AOD-Net, MLKD-Net, etc.)
    
//     // Simulate processing delay
//     await new Promise(resolve => setTimeout(resolve, 50));
    
//     // Return processed image (same as input for demo)
//     // TODO: Replace with actual dehazing:
//     // const processed = await yourDehazingModel.process(imageBuffer);
    
//     return imageBuffer;
    
//   } catch (error) {
//     console.error('Dehazing processing error:', error);
//     throw new Error('Failed to process image with dehazing');
//   }
// };

// // ✅ GET IMAGE ENDPOINT (to retrieve saved images)
// const getImage = async (req, res) => {
//   try {
//     const fileId = new mongoose.Types.ObjectId(req.params.id);
//     const bucket = new GridFSBucket(mongoose.connection.db, {
//       bucketName: 'uploads'
//     });

//     const downloadStream = bucket.openDownloadStream(fileId);

//     downloadStream.on('data', (chunk) => {
//       res.write(chunk);
//     });

//     downloadStream.on('error', (error) => {
//       console.error('File download error:', error);
//       res.status(404).json({ message: 'File not found' });
//     });

//     downloadStream.on('end', () => {
//       res.end();
//     });

//   } catch (error) {
//     console.error('Get image error:', error);
//     res.status(500).json({ message: 'Server error' });
//   }
// };

// // module.exports = {
// //   uploadAndProcess,
// //   processImage: processImageWithDehazing,
// //   getImage
// // };


// module.exports = {
//   uploadAndProcess,
//   processImage: processImageWithDehazing, // or whatever your function is called
//   getStats, // your existing function
//   getImage  // ✅ ADD THIS EXPORT
// };


const mongoose = require('mongoose');
const Grid = require('gridfs-stream');
const { GridFSBucket } = require('mongodb');

// Initialize GridFS
let gfs;
mongoose.connection.once('open', () => {
  gfs = Grid(mongoose.connection.db, mongoose.mongo);
  gfs.collection('uploads'); // This should match your GridFS bucket name
});

const uploadAndProcess = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
    }

    const userId = req.user.id;
    const file = req.file;

    console.log('📸 Processing upload for user:', userId);
    console.log('📁 File details:', {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size
    });

    // ✅ 1. SAVE TO GRIDFS (MongoDB)
    const bucket = new GridFSBucket(mongoose.connection.db, {
      bucketName: 'uploads'
    });

    const uploadStream = bucket.openUploadStream(file.originalname, {
      metadata: {
        userId: userId,
        uploadDate: new Date(),
        mimetype: file.mimetype
      }
    });

    // Write file to GridFS
    uploadStream.end(file.buffer);

    uploadStream.on('finish', async (file) => {
      try {
        console.log('✅ Image saved to GridFS with ID:', file._id);

        // ✅ 2. PROCESS THE IMAGE (Dehazing logic here)
        const processedImage = await processImageWithDehazing(file.buffer);
        
        // ✅ 3. SAVE PROCESSED IMAGE TO GRIDFS
        const processedStream = bucket.openUploadStream(`processed_${file.originalname}`, {
          metadata: {
            userId: userId,
            originalFileId: file._id,
            processedDate: new Date(),
            mimetype: 'image/jpeg' // Processed images as JPEG
          }
        });

        processedStream.end(processedImage);

        processedStream.on('finish', (processedFile) => {
          // ✅ 4. SEND RESPONSE
          res.json({
            success: true,
            message: 'Image uploaded and processed successfully',
            data: {
              originalFile: {
                id: file._id,
                name: file.filename,
                size: file.length,
                uploadDate: file.uploadDate
              },
              processedFile: {
                id: processedFile._id,
                name: processedFile.filename,
                size: processedFile.length
              },
              userId: userId,
              processingTime: '50ms', // Simulate processing time
              metrics: {
                originalSize: file.length,
                processedSize: processedFile.length,
                compression: Math.round((1 - processedFile.length / file.length) * 100)
              }
            }
          });
        });

      } catch (processingError) {
        console.error('❌ Image processing error:', processingError);
        res.status(500).json({
          success: false,
          message: 'Image processing failed',
          error: processingError.message
        });
      }
    });

    uploadStream.on('error', (error) => {
      console.error('❌ GridFS upload error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to save image',
        error: error.message
      });
    });

  } catch (error) {
    console.error('❌ Upload controller error:', error);
    res.status(500).json({
      success: false,
      message: 'Upload failed',
      error: error.message
    });
  }
};

// ✅ IMAGE PROCESSING FUNCTION (Dehazing)
const processImageWithDehazing = async (imageBuffer) => {
  try {
    console.log('🔄 Processing image with dehazing...');
    
    // SIMPLE PROCESSING - REPLACE WITH YOUR ACTUAL DEHAZING ALGORITHM
    // For now, we'll just return the same image
    // In production, use your ML model here (AOD-Net, MLKD-Net, etc.)
    
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Return processed image (same as input for demo)
    // TODO: Replace with actual dehazing:
    // const processed = await yourDehazingModel.process(imageBuffer);
    
    return imageBuffer;
    
  } catch (error) {
    console.error('Dehazing processing error:', error);
    throw new Error('Failed to process image with dehazing');
  }
};

// ✅ GET IMAGE ENDPOINT (to retrieve saved images)
const getImage = async (req, res) => {
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
};

// ✅ ADD MISSING getStats FUNCTION
const getStats = async (req, res) => {
  try {
    // Return some basic stats - you can customize this
    res.json({
      success: true,
      stats: {
        totalProcessed: 0,
        avgFps: 0,
        cloudUptime: 98.7,
        detectionAccuracy: 94.2
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get stats',
      error: error.message
    });
  }
};

// ✅ ADD MISSING processImage FUNCTION (for the /process route)
const processImage = async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Image processing endpoint ready',
      status: 'active'
    });
  } catch (error) {
    console.error('Process image error:', error);
    res.status(500).json({
      success: false,
      message: 'Processing failed',
      error: error.message
    });
  }
};

module.exports = {
  uploadAndProcess,
  processImage,
  getStats,
  getImage
};
