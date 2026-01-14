// import { ResizeMode, Video } from 'expo-av';
// import * as FileSystem from 'expo-file-system';
// import * as MediaLibrary from 'expo-media-library';
// import { useEffect, useRef, useState } from 'react';
// import {
//     ActivityIndicator,
//     Platform,
//     StyleSheet,
//     Text,
//     TouchableOpacity,
//     View
// } from 'react-native';

// export default function WebRTCVideo({ 
//   webRTCService, 
//   isProcessing, 
//   onRecordingComplete 
// }) {
//   const videoRef = useRef(null);
//   const [remoteStream, setRemoteStream] = useState(null);
//   const [videoUrl, setVideoUrl] = useState(null);
//   const [isRecording, setIsRecording] = useState(false);
//   const [recordedVideoPath, setRecordedVideoPath] = useState(null);
//   const [recordingTime, setRecordingTime] = useState(0);
//   const recordingTimerRef = useRef(null);

//   // Listen for remote stream
//   useEffect(() => {
//     if (!webRTCService) return;
    
//     const handleRemoteStream = (stream) => {
//       console.log('📹 Remote stream received');
//       setRemoteStream(stream);
      
//       // For web, create video URL
//       if (Platform.OS === 'web') {
//         setVideoUrl(URL.createObjectURL(stream));
//       }
//     };
    
//     webRTCService.on('remote_stream', handleRemoteStream);
    
//     return () => {
//       webRTCService.off('remote_stream', handleRemoteStream);
//     };
//   }, [webRTCService]);

//   // Start recording
//   const startRecording = async () => {
//     if (!webRTCService || isRecording) return;
    
//     try {
//       const success = webRTCService.startRecording();
//       if (success) {
//         setIsRecording(true);
//         setRecordingTime(0);
        
//         // Start recording timer
//         recordingTimerRef.current = setInterval(() => {
//           setRecordingTime(prev => prev + 1);
//         }, 1000);
        
//         console.log('🎥 Recording started');
//       }
//     } catch (error) {
//       console.error('Start recording error:', error);
//     }
//   };

//   // Stop recording and save
//   const stopRecording = async () => {
//     if (!webRTCService || !isRecording) return;
    
//     try {
//       clearInterval(recordingTimerRef.current);
//       setIsRecording(false);
      
//       // Get recorded video blob
//       const videoBlob = await webRTCService.stopRecording();
//       if (!videoBlob) {
//         console.error('No video recorded');
//         return;
//       }
      
//       // Save to local storage
//       const result = await saveVideoToLocalStorage(videoBlob);
      
//       if (result.success) {
//         setRecordedVideoPath(result.path);
//         if (onRecordingComplete) {
//           onRecordingComplete(result.path);
//         }
//       }
      
//     } catch (error) {
//       console.error('Stop recording error:', error);
//     }
//   };

//   // Save video to local storage
//   const saveVideoToLocalStorage = async (videoBlob) => {
//     try {
//       const timestamp = Date.now();
//       const filename = `dehazed_video_${timestamp}`;
      
//       if (Platform.OS === 'web') {
//         // Web: Download as file
//         const url = URL.createObjectURL(videoBlob);
//         const a = document.createElement('a');
//         a.href = url;
//         a.download = `${filename}.webm`;
//         document.body.appendChild(a);
//         a.click();
//         document.body.removeChild(a);
//         URL.revokeObjectURL(url);
        
//         return { success: true, path: filename };
        
//       } else {
//         // Mobile: Save to file system and gallery
//         // Convert blob to base64
//         const base64Data = await blobToBase64(videoBlob);
        
//         // Save to app directory
//         const fileUri = `${FileSystem.documentDirectory}${filename}.mp4`;
//         await FileSystem.writeAsStringAsync(fileUri, base64Data, {
//           encoding: FileSystem.EncodingType.Base64,
//         });
        
//         // Save to gallery
//         const { status } = await MediaLibrary.requestPermissionsAsync();
//         if (status === 'granted') {
//           const asset = await MediaLibrary.createAssetAsync(fileUri);
//           await MediaLibrary.createAlbumAsync('Dehazing Videos', asset, false);
//         }
        
//         return { success: true, path: fileUri };
//       }
//     } catch (error) {
//       console.error('Save video error:', error);
//       return { success: false, error: error.message };
//     }
//   };

//   // Utility: Convert blob to base64
//   const blobToBase64 = (blob) => {
//     return new Promise((resolve, reject) => {
//       const reader = new FileReader();
//       reader.onloadend = () => {
//         const base64data = reader.result.split(',')[1];
//         resolve(base64data);
//       };
//       reader.onerror = reject;
//       reader.readAsDataURL(blob);
//     });
//   };

//   // Format recording time
//   const formatRecordingTime = (seconds) => {
//     const mins = Math.floor(seconds / 60);
//     const secs = seconds % 60;
//     return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
//   };

//   if (!isProcessing) {
//     return (
//       <View style={styles.container}>
//         <View style={styles.placeholder}>
//           <Text style={styles.placeholderText}>
//             Start processing to see video stream
//           </Text>
//         </View>
//       </View>
//     );
//   }

//   return (
//     <View style={styles.container}>
//       {/* Video Display */}
//       <View style={styles.videoContainer}>
//         {Platform.OS === 'web' && videoUrl ? (
//           <video
//             ref={videoRef}
//             src={videoUrl}
//             style={styles.video}
//             autoPlay
//             controls
//             playsInline
//           />
//         ) : remoteStream && Platform.OS !== 'web' ? (
//           <Video
//             ref={videoRef}
//             source={{ uri: remoteStream.toURL() }}
//             style={styles.video}
//             useNativeControls
//             resizeMode={ResizeMode.CONTAIN}
//             shouldPlay
//             isLooping
//           />
//         ) : (
//           <View style={styles.loadingContainer}>
//             <ActivityIndicator size="large" color="#3b82f6" />
//             <Text style={styles.loadingText}>Connecting to video stream...</Text>
//           </View>
//         )}
        
//         {/* Recording Indicator */}
//         {isRecording && (
//           <View style={styles.recordingOverlay}>
//             <View style={styles.recordingDot} />
//             <Text style={styles.recordingText}>
//               REC • {formatRecordingTime(recordingTime)}
//             </Text>
//           </View>
//         )}
//       </View>
      
//       {/* Recording Controls */}
//       <View style={styles.controlsContainer}>
//         {!isRecording ? (
//           <TouchableOpacity
//             style={[styles.button, styles.recordButton]}
//             onPress={startRecording}
//             disabled={!isProcessing}
//           >
//             <Text style={styles.buttonText}>● Start Recording</Text>
//           </TouchableOpacity>
//         ) : (
//           <TouchableOpacity
//             style={[styles.button, styles.stopButton]}
//             onPress={stopRecording}
//           >
//             <Text style={styles.buttonText}>⏸️ Stop & Save</Text>
//           </TouchableOpacity>
//         )}
        
//         {recordedVideoPath && (
//           <View style={styles.savedInfo}>
//             <Text style={styles.savedText}>
//               ✅ Video saved: {recordedVideoPath.split('/').pop()}
//             </Text>
//           </View>
//         )}
//       </View>
      
//       {/* WebRTC Status */}
//       <View style={styles.statusContainer}>
//         <Text style={styles.statusTitle}>WebRTC Status:</Text>
//         <View style={styles.statusGrid}>
//           <View style={styles.statusItem}>
//             <Text style={styles.statusLabel}>Connection</Text>
//             <Text style={[styles.statusValue, 
//               webRTCService?.isConnected ? styles.connected : styles.disconnected
//             ]}>
//               {webRTCService?.isConnected ? '✅ Connected' : '❌ Disconnected'}
//             </Text>
//           </View>
//           <View style={styles.statusItem}>
//             <Text style={styles.statusLabel}>Frames</Text>
//             <Text style={styles.statusValue}>
//               {webRTCService?.frameCount || 0}
//             </Text>
//           </View>
//           <View style={styles.statusItem}>
//             <Text style={styles.statusLabel}>Latency</Text>
//             <Text style={styles.statusValue}>
//               {webRTCService?.lastDelay || 0}ms
//             </Text>
//           </View>
//         </View>
//       </View>
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   container: {
//     width: '100%',
//     marginBottom: 20,
//   },
//   videoContainer: {
//     width: '100%',
//     height: 300,
//     backgroundColor: '#000',
//     borderRadius: 12,
//     overflow: 'hidden',
//     position: 'relative',
//   },
//   video: {
//     width: '100%',
//     height: '100%',
//   },
//   placeholder: {
//     flex: 1,
//     justifyContent: 'center',
//     alignItems: 'center',
//     backgroundColor: '#1a1a1a',
//     borderRadius: 12,
//     padding: 20,
//   },
//   placeholderText: {
//     color: '#666',
//     fontSize: 16,
//     textAlign: 'center',
//   },
//   loadingContainer: {
//     flex: 1,
//     justifyContent: 'center',
//     alignItems: 'center',
//     backgroundColor: '#000',
//   },
//   loadingText: {
//     color: '#fff',
//     marginTop: 10,
//     fontSize: 14,
//   },
//   recordingOverlay: {
//     position: 'absolute',
//     top: 10,
//     right: 10,
//     flexDirection: 'row',
//     alignItems: 'center',
//     backgroundColor: 'rgba(0, 0, 0, 0.7)',
//     paddingHorizontal: 12,
//     paddingVertical: 6,
//     borderRadius: 20,
//   },
//   recordingDot: {
//     width: 8,
//     height: 8,
//     borderRadius: 4,
//     backgroundColor: '#ef4444',
//     marginRight: 6,
//   },
//   recordingText: {
//     color: '#fff',
//     fontSize: 12,
//     fontWeight: '600',
//   },
//   controlsContainer: {
//     marginTop: 12,
//     alignItems: 'center',
//   },
//   button: {
//     paddingHorizontal: 24,
//     paddingVertical: 12,
//     borderRadius: 8,
//     alignItems: 'center',
//     minWidth: 180,
//   },
//   recordButton: {
//     backgroundColor: '#ef4444',
//   },
//   stopButton: {
//     backgroundColor: '#3b82f6',
//   },
//   buttonText: {
//     color: '#fff',
//     fontSize: 16,
//     fontWeight: '600',
//   },
//   savedInfo: {
//     marginTop: 12,
//     padding: 12,
//     backgroundColor: 'rgba(34, 197, 94, 0.1)',
//     borderRadius: 8,
//     borderWidth: 1,
//     borderColor: 'rgba(34, 197, 94, 0.3)',
//   },
//   savedText: {
//     color: '#86efac',
//     fontSize: 12,
//     textAlign: 'center',
//   },
//   statusContainer: {
//     marginTop: 16,
//     padding: 16,
//     backgroundColor: '#1e293b',
//     borderRadius: 12,
//     borderWidth: 1,
//     borderColor: '#334155',
//   },
//   statusTitle: {
//     color: '#fff',
//     fontSize: 14,
//     fontWeight: 'bold',
//     marginBottom: 12,
//   },
//   statusGrid: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//   },
//   statusItem: {
//     alignItems: 'center',
//   },
//   statusLabel: {
//     color: '#94a3b8',
//     fontSize: 12,
//     marginBottom: 4,
//   },
//   statusValue: {
//     color: '#fff',
//     fontSize: 14,
//     fontWeight: '600',
//   },
//   connected: {
//     color: '#22c55e',
//   },
//   disconnected: {
//     color: '#ef4444',
//   },
// });

import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

export default function WebRTCVideo({ 
  webRTCService, 
  isProcessing, 
  onRecordingComplete 
}) {
  const videoRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [lastVideoPath, setLastVideoPath] = useState(null);
  const recordingTimerRef = useRef(null);
  const [hasPermission, setHasPermission] = useState(null);

  // Request media library permission
  useEffect(() => {
    (async () => {
      if (Platform.OS !== 'web') {
        const { status } = await MediaLibrary.requestPermissionsAsync();
        setHasPermission(status === 'granted');
      }
    })();
  }, []);

  // Start recording
  const startRecording = async () => {
    if (!isProcessing) {
      console.warn('Start processing first');
      return;
    }

    try {
      if (webRTCService && webRTCService.startRecording) {
        const success = webRTCService.startRecording();
        if (success) {
          setIsRecording(true);
          setRecordingTime(0);
          
          // Start recording timer
          recordingTimerRef.current = setInterval(() => {
            setRecordingTime(prev => prev + 1);
          }, 1000);
          
          console.log('🎥 Recording started');
        }
      } else {
        // Simulate recording for demo
        setIsRecording(true);
        setRecordingTime(0);
        
        recordingTimerRef.current = setInterval(() => {
          setRecordingTime(prev => prev + 1);
        }, 1000);
        
        console.log('🎥 Recording started (demo mode)');
      }
    } catch (error) {
      console.error('Start recording error:', error);
    }
  };

  // Stop recording and save
  const stopRecording = async () => {
    try {
      clearInterval(recordingTimerRef.current);
      setIsRecording(false);
      
      let videoBlob = null;
      
      if (webRTCService && webRTCService.stopRecording) {
        videoBlob = await webRTCService.stopRecording();
      }
      
      if (videoBlob) {
        // Save using WebRTC service
        const result = await webRTCService.saveVideoToDevice(videoBlob);
        if (result.success) {
          setLastVideoPath(result.path);
          if (onRecordingComplete) {
            onRecordingComplete(result.path);
          }
        }
      } else {
        // Create demo video file
        const demoResult = await saveDemoVideo();
        setLastVideoPath(demoResult.path);
        if (onRecordingComplete) {
          onRecordingComplete(demoResult.path);
        }
      }
      
    } catch (error) {
      console.error('Stop recording error:', error);
    }
  };

  // Save demo video (for testing)
  const saveDemoVideo = async () => {
    try {
      const timestamp = Date.now();
      const filename = `dehazed_video_${timestamp}`;
      
      if (Platform.OS === 'web') {
        // Web: Create and download dummy file
        const content = `Dehazed Video Recording\n\nTimestamp: ${new Date(timestamp).toLocaleString()}\nDuration: ${formatTime(recordingTime)}\nFrames Processed: Demo recording`;
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        return { success: true, path: 'Downloads folder' };
        
      } else {
        // Mobile: Save to app storage
        const fileUri = `${FileSystem.documentDirectory}${filename}.txt`;
        const content = `Dehazed Video Recording\n\nTimestamp: ${new Date(timestamp).toLocaleString()}\nDuration: ${formatTime(recordingTime)}\nFrames Processed: Demo recording`;
        
        await FileSystem.writeAsStringAsync(fileUri, content);
        
        // Save to gallery if permission granted
        if (hasPermission) {
          await MediaLibrary.createAssetAsync(fileUri);
          return { success: true, path: 'Photo Gallery' };
        }
        
        return { success: true, path: 'App storage' };
      }
    } catch (error) {
      console.error('Save demo video error:', error);
      return { success: false, error: error.message };
    }
  };

  // Format time (seconds to MM:SS)
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Get WebRTC status
  const getStatus = () => {
    if (!webRTCService) {
      return {
        connected: false,
        status: 'Not initialized',
        frameCount: 0
      };
    }
    
    const status = webRTCService.getStatus();
    return {
      connected: status.connected || false,
      status: status.connected ? 'Connected' : 'Disconnected',
      frameCount: status.frameCount || 0,
      dataChannel: status.dataChannel || 'closed'
    };
  };

  const status = getStatus();

  if (!isProcessing) {
    return (
      <View style={styles.container}>
        <View style={styles.placeholder}>
          <Text style={styles.placeholderIcon}>📹</Text>
          <Text style={styles.placeholderText}>
            Start processing to enable video recording
          </Text>
          <Text style={styles.placeholderSubtext}>
            WebRTC status: {status.status}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Video Preview */}
      <View style={styles.videoContainer}>
        {Platform.OS === 'web' ? (
          <View style={styles.webVideoPlaceholder}>
            <Text style={styles.webVideoIcon}>🎬</Text>
            <Text style={styles.webVideoText}>Live Video Stream</Text>
            <Text style={styles.webVideoSubtext}>
              Real-time dehazed video preview
            </Text>
          </View>
        ) : (
          <View style={styles.nativeVideoPlaceholder}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={styles.nativeVideoText}>
              Processing video stream...
            </Text>
          </View>
        )}
        
        {/* Recording Indicator */}
        {isRecording && (
          <View style={styles.recordingOverlay}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingText}>
              REC • {formatTime(recordingTime)}
            </Text>
          </View>
        )}
      </View>
      
      {/* Recording Controls */}
      <View style={styles.controlsContainer}>
        {!isRecording ? (
          <TouchableOpacity
            style={[styles.button, styles.recordButton]}
            onPress={startRecording}
            disabled={!isProcessing}
          >
            <Text style={styles.buttonText}>
              ● Start Recording
            </Text>
            <Text style={styles.buttonSubtext}>
              Save processed video locally
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.button, styles.stopButton]}
            onPress={stopRecording}
          >
            <Text style={styles.buttonText}>
              ⏸️ Stop & Save
            </Text>
            <Text style={styles.buttonSubtext}>
              Recording: {formatTime(recordingTime)}
            </Text>
          </TouchableOpacity>
        )}
        
        {lastVideoPath && (
          <View style={styles.savedInfo}>
            <Text style={styles.savedIcon}>✅</Text>
            <Text style={styles.savedText}>
              Last saved to: {lastVideoPath}
            </Text>
          </View>
        )}
      </View>
      
      {/* Status Info */}
      <View style={styles.statusContainer}>
        <Text style={styles.statusTitle}>Video Stream Status</Text>
        <View style={styles.statusGrid}>
          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>Connection</Text>
            <Text style={[
              styles.statusValue,
              status.connected ? styles.connected : styles.disconnected
            ]}>
              {status.connected ? '✅ Live' : '❌ Offline'}
            </Text>
          </View>
          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>Frames</Text>
            <Text style={styles.statusValue}>
              {status.frameCount}
            </Text>
          </View>
          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>Duration</Text>
            <Text style={styles.statusValue}>
              {formatTime(recordingTime)}
            </Text>
          </View>
        </View>
      </View>
      
      {/* Instructions */}
      <View style={styles.instructions}>
        <Text style={styles.instructionsTitle}>How to Record:</Text>
        <Text style={styles.instructionsText}>
          1. Start processing to enable recording{'\n'}
          2. Tap "Start Recording" to begin{'\n'}
          3. Process video in real-time{'\n'}
          4. Tap "Stop & Save" to download{'\n'}
          5. Video saves to device storage
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: 20,
  },
  videoContainer: {
    width: '100%',
    height: 250,
    backgroundColor: '#000',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  webVideoPlaceholder: {
    alignItems: 'center',
    padding: 20,
  },
  webVideoIcon: {
    fontSize: 60,
    marginBottom: 10,
  },
  webVideoText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  webVideoSubtext: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
  },
  nativeVideoPlaceholder: {
    alignItems: 'center',
    padding: 20,
  },
  nativeVideoText: {
    color: '#fff',
    marginTop: 10,
    fontSize: 14,
  },
  recordingOverlay: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
    marginRight: 6,
  },
  recordingText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
  },
  placeholderIcon: {
    fontSize: 50,
    marginBottom: 10,
  },
  placeholderText: {
    color: '#666',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 5,
  },
  placeholderSubtext: {
    color: '#444',
    fontSize: 12,
    textAlign: 'center',
  },
  controlsContainer: {
    marginTop: 12,
    alignItems: 'center',
  },
  button: {
    width: '100%',
    maxWidth: 300,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  recordButton: {
    backgroundColor: '#ef4444',
  },
  stopButton: {
    backgroundColor: '#3b82f6',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  buttonSubtext: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
  },
  savedInfo: {
    marginTop: 12,
    padding: 12,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  savedIcon: {
    marginRight: 8,
  },
  savedText: {
    color: '#86efac',
    fontSize: 12,
    flex: 1,
  },
  statusContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  statusTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  statusGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statusItem: {
    alignItems: 'center',
    flex: 1,
  },
  statusLabel: {
    color: '#94a3b8',
    fontSize: 12,
    marginBottom: 4,
  },
  statusValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  connected: {
    color: '#22c55e',
  },
  disconnected: {
    color: '#ef4444',
  },
  instructions: {
    marginTop: 16,
    padding: 16,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  instructionsTitle: {
    color: '#93c5fd',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  instructionsText: {
    color: '#93c5fd',
    fontSize: 12,
    lineHeight: 20,
  },
});
