// Create a new file: app/services/videoSaver.js
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { Platform } from 'react-native';

class VideoSaver {
  static async saveVideoLocally(frames, filename = `dehazed_${Date.now()}`) {
    try {
      console.log(`💾 Saving ${frames.length} frames as video...`);
      
      if (Platform.OS === 'web') {
        // Web: Create downloadable zip of frames
        return this.saveForWeb(frames, filename);
      } else {
        // Mobile: Save to device storage
        return this.saveForMobile(frames, filename);
      }
      
    } catch (error) {
      console.error('❌ Video save error:', error);
      return { success: false, error: error.message };
    }
  }
  
  static async saveForWeb(frames, filename) {
    // Create HTML page with all frames
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <title>Dehazed Video Frames - ${filename}</title>
    <style>
        body { background: #0f172a; color: white; padding: 20px; }
        .frame-container { display: flex; flex-wrap: wrap; gap: 10px; }
        .frame { border: 2px solid #3b82f6; border-radius: 8px; }
        .frame-info { font-size: 12px; color: #94a3b8; margin-top: 5px; }
    </style>
</head>
<body>
    <h1>Dehazed Video: ${filename}</h1>
    <p>${frames.length} frames captured • ${new Date().toLocaleString()}</p>
    <div class="frame-container">
        ${frames.map((frame, index) => `
            <div>
                <img src="data:image/jpeg;base64,${frame}" class="frame" height="150" />
                <div class="frame-info">Frame ${index + 1}</div>
            </div>
        `).join('')}
    </div>
</body>
</html>`;
    
    // Create and download HTML file
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    return {
      success: true,
      path: 'Downloads folder',
      filename: `${filename}.html`,
      message: `Saved ${frames.length} frames as HTML gallery`
    };
  }
  
  static async saveForMobile(frames, filename) {
    // Request permission
    const { status } = await MediaLibrary.requestPermissionsAsync();
    
    if (status !== 'granted') {
      // Save to app directory if no permission
      return this.saveToAppDirectory(frames, filename);
    }
    
    // Save each frame as image
    const savedPaths = [];
    
    for (let i = 0; i < Math.min(frames.length, 50); i++) { // Limit to 50 frames
      const frame = frames[i];
      const frameFilename = `${filename}_frame_${String(i + 1).padStart(3, '0')}.jpg`;
      const fileUri = `${FileSystem.documentDirectory}${frameFilename}`;
      
      await FileSystem.writeAsStringAsync(fileUri, frame, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      // Save to gallery
      const asset = await MediaLibrary.createAssetAsync(fileUri);
      await MediaLibrary.createAlbumAsync('Dehazing App', asset, false);
      
      savedPaths.push(fileUri);
    }
    
    // Create info file
    const infoContent = `Dehazed Video: ${filename}\nFrames: ${frames.length}\nDate: ${new Date().toLocaleString()}`;
    const infoUri = `${FileSystem.documentDirectory}${filename}_info.txt`;
    await FileSystem.writeAsStringAsync(infoUri, infoContent);
    
    return {
      success: true,
      path: 'Photo Gallery → Dehazing App',
      framesSaved: savedPaths.length,
      totalFrames: frames.length,
      message: `Saved ${savedPaths.length} frames to gallery`
    };
  }
  
  static async saveToAppDirectory(frames, filename) {
    // Save frames to app's document directory
    for (let i = 0; i < Math.min(frames.length, 30); i++) {
      const frame = frames[i];
      const frameFilename = `${filename}_frame_${String(i + 1).padStart(3, '0')}.jpg`;
      const fileUri = `${FileSystem.documentDirectory}${frameFilename}`;
      
      await FileSystem.writeAsStringAsync(fileUri, frame, {
        encoding: FileSystem.EncodingType.Base64,
      });
    }
    
    return {
      success: true,
      path: 'App storage',
      framesSaved: Math.min(frames.length, 30),
      message: 'Frames saved to app storage (enable gallery permission for better saving)'
    };
  }
  
  // Simple MP4 creation (if ffmpeg is available on device)
  static async createMP4FromFrames(frames, filename) {
    // This is a placeholder - you'd need ffmpeg integration
    console.log(`Would create MP4 from ${frames.length} frames`);
    
    return {
      success: false,
      message: 'MP4 creation requires ffmpeg integration',
      suggestion: 'Use frame gallery method instead'
    };
  }
}

export default VideoSaver;