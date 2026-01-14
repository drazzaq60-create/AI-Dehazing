const { MongoClient, GridFSBucket, ObjectId } = require('mongodb');

let bucket;
let client;

/**
 * Initialize GridFS bucket
 */
async function initGridFS() {
  try {
    const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/dehazing_db';
    
    client = new MongoClient(MONGO_URI);
    await client.connect();
    
    const db = client.db();
    bucket = new GridFSBucket(db, { bucketName: 'captures' });
    
    console.log('✅ GridFS bucket ready for image storage');
  } catch (error) {
    console.error('❌ GridFS init error:', error);
    throw error;
  }
}

// Initialize on module load
initGridFS();

/**
 * Save frame to GridFS
 */
exports.saveFrame = async (base64Image, userId, captureId, frameNumber, type = 'hazy') => {
  return new Promise((resolve, reject) => {
    try {
      if (!bucket) {
        throw new Error('GridFS bucket not initialized');
      }
      
      // Remove data URI prefix
      const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      
      // Create filename
      const filename = `${userId}_${captureId}_${type}_frame_${String(frameNumber).padStart(6, '0')}.jpg`;
      
      // Upload to GridFS
      const uploadStream = bucket.openUploadStream(filename, {
        contentType: 'image/jpeg',
        metadata: {
          userId: userId,
          captureId: captureId,
          frameNumber: frameNumber,
          type: type,
          uploadedAt: new Date()
        }
      });
      
      uploadStream.end(buffer);
      
      uploadStream.on('finish', () => {
        const fileId = uploadStream.id.toString();
        console.log(`✅ Frame ${frameNumber} (${type}) saved to GridFS`);
        resolve({ fileId, url: `/file/${fileId}` });
      });
      
      uploadStream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Get frame by file ID
 */
exports.getFrame = async (fileId, res) => {
  try {
    const _id = new ObjectId(fileId);
    res.setHeader('Content-Type', 'image/jpeg');
    
    const downloadStream = bucket.openDownloadStream(_id);
    
    downloadStream.on('error', (error) => {
      console.error('❌ Download error:', error);
      res.status(404).json({ message: 'File not found' });
    });
    
    downloadStream.pipe(res);
  } catch (error) {
    res.status(404).json({ message: 'Invalid file ID' });
  }
};

/**
 * Delete capture session
 */
exports.deleteCapture = async (userId, captureId) => {
  try {
    const files = await bucket.find({
      'metadata.userId': userId,
      'metadata.captureId': captureId
    }).toArray();
    
    for (const file of files) {
      await bucket.delete(file._id);
    }
    
    console.log(`✅ Deleted capture ${captureId} (${files.length} files)`);
  } catch (error) {
    console.error('❌ Delete capture error:', error);
    throw error;
  }
};

/**
 * Get storage statistics
 */
exports.getStorageStats = async (userId = null) => {
  try {
    const query = userId ? { 'metadata.userId': userId } : {};
    const files = await bucket.find(query).toArray();
    
    const totalSize = files.reduce((sum, file) => sum + file.length, 0);
    const captures = new Set(files.map(f => f.metadata.captureId));
    
    return {
      totalSize: totalSize,
      totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
      frameCount: files.length,
      captureCount: captures.size
    };
  } catch (error) {
    console.error('❌ Stats error:', error);
    return { totalSize: 0, frameCount: 0, captureCount: 0 };
  }
};

module.exports = exports;
