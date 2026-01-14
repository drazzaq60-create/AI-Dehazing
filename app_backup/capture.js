import { Video } from 'expo-av';
import { Camera } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useAppContext } from './_layout';


// CAPTURE SCREEN COMPONENT - Your original code, updated for Expo Router and context
export default function CaptureScreen() {
  const router = useRouter();  // For back navigation (fixes the crash)
  const { user, wsService } = useAppContext();  // Get user and WebSocket from context
  const [hasPermission, setHasPermission] = useState(null);
  const [type, setType] = useState(CameraType.back);
  const [isRecording, setIsRecording] = useState(false);
  const [selectedSource, setSelectedSource] = useState('camera');
  const [videoUri, setVideoUri] = useState(null);
  const [fps, setFps] = useState(0);
  const [frameCount, setFrameCount] = useState(0);
  
  const cameraRef = useRef(null);
  const captureIntervalRef = useRef(null);

  // Request camera permissions (original logic)
  useEffect(() => {
    (async () => {
      if (Platform.OS !== 'web') {  // Skip on web
        const { status } = await Camera.requestCameraPermissionsAsync();
        setHasPermission(status === 'granted');
      } else {
        setHasPermission(false);  // Disable on web
      }
    })();

    return () => {
      stopCapture();
    };
  }, []);

  // START CAPTURING FRAMES (original logic, uses wsService from context)
  const startFrameCapture = async () => {
    if (!cameraRef.current) return;

    setIsRecording(true);
    let count = 0;
    const startTime = Date.now();

    captureIntervalRef.current = setInterval(async () => {
      try {
        if (cameraRef.current) {
          // Capture photo as frame
          const photo = await cameraRef.current.takePictureAsync({
            quality: 0.8,
            base64: true,
          });

          count++;
          setFrameCount(count);

          // Calculate FPS
          const elapsed = (Date.now() - startTime) / 1000;
          const currentFps = Math.round(count / elapsed);
          setFps(currentFps);

          // Send frame to backend via WebSocket (uses context wsService)
          wsService.send({
            type: 'video_frame',
            userId: user?.id,
            frame: photo.base64,
            timestamp: Date.now(),
            frameNumber: count,
          });

          console.log(`📸 Frame ${count} captured and sent | FPS: ${currentFps}`);
        }
      } catch (error) {
        console.error('Error capturing frame:', error);
      }
    }, 1000 / 30); // 30 FPS
  };

  // STOP CAPTURING (original logic)
  const stopCapture = () => {
    if (captureIntervalRef.current) {
      clearInterval(captureIntervalRef.current);
      captureIntervalRef.current = null;
    }
    setIsRecording(false);
    setFps(0);
    setFrameCount(0);
  };

  // PICK VIDEO FROM GALLERY (original logic, uses wsService)
  const pickVideo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled) {
      setVideoUri(result.assets[0].uri);
      
      // Send video to backend
      wsService.send({
        type: 'video_upload',
        userId: user?.id,
        videoUri: result.assets[0].uri,
        timestamp: Date.now(),
      });
    }
  };

  // Handle start based on source (original logic)
  const handleStart = () => {
    if (selectedSource === 'camera') {
      startFrameCapture();
    } else {
      pickVideo();
    }
  };

  // WEB FALLBACK (new - camera not supported on browser)
  if (Platform.OS === 'web') {
    return (
      <ScrollView style={styles.captureContainer}>
        <View style={styles.captureHeader}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.captureTitle}>Video Capture</Text>
          <View style={{ width: 50 }} />
        </View>
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>📱 Camera not supported on web</Text>
          <Text style={styles.errorSubtext}>Use the mobile app (iOS/Android) for camera and video features.</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => router.back()}>
            <Text style={styles.primaryButtonText}>Go Back to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  if (hasPermission === null) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Requesting camera permissions...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>❌ No camera access</Text>
        <Text style={styles.errorSubtext}>Please enable camera permissions in settings</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => router.back()}>
          <Text style={styles.primaryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.captureContainer}>
      <View style={styles.captureHeader}>
        <TouchableOpacity onPress={() => router.back()}>  {/* Updated: uses router.back() */}
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.captureTitle}>Video Capture</Text>
        {isRecording && (
          <View style={styles.recordingBadge}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingText}>Live • {fps} FPS</Text>
          </View>
        )}
      </View>

      {/* Source Selection (original) */}
      <View style={styles.sourceSelector}>
        <TouchableOpacity
          style={[
            styles.sourceButton,
            selectedSource === 'camera' && styles.sourceButtonActive,
          ]}
          onPress={() => !isRecording && setSelectedSource('camera')}
          disabled={isRecording}
        >
          <Text style={styles.sourceIcon}>📹</Text>
          <Text style={styles.sourceText}>Camera</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.sourceButton,
            selectedSource === 'upload' && styles.sourceButtonActive,
          ]}
          onPress={() => !isRecording && setSelectedSource('upload')}
          disabled={isRecording}
        >
          <Text style={styles.sourceIcon}>📁</Text>
          <Text style={styles.sourceText}>Upload</Text>
        </TouchableOpacity>
      </View>

      {/* Video Preview (original) */}
      <View style={styles.videoPreview}>
        {selectedSource === 'camera' && !videoUri ? (
          <Camera
            style={styles.camera}
            type={type}
            ref={cameraRef}
          >
            <View style={styles.cameraOverlay}>
              {isRecording && (
                <View style={styles.recordingOverlay}>
                  <Text style={styles.recordingInfo}>🔴 Recording</Text>
                  <Text style={styles.frameInfo}>Frames: {frameCount}</Text>
                </View>
              )}
            </View>
          </Camera>
        ) : videoUri ? (
          <Video
            source={{ uri: videoUri }}
            style={styles.video}
            useNativeControls
            resizeMode="contain"
            isLooping
          />
        ) : (
          <View style={styles.placeholderView}>
            <Text style={styles.placeholderIcon}>📹</Text>
            <Text style={styles.placeholderText}>Camera ready</Text>
            <Text style={styles.placeholderSubtext}>Tap Start to begin capture</Text>
          </View>
        )}
      </View>

      {/* Controls (original) */}
      <View style={styles.controlsContainer}>
        {!isRecording ? (
          <TouchableOpacity
            style={[styles.primaryButton, styles.startButton]}
            onPress={handleStart}
          >
            <Text style={styles.primaryButtonText}>
              ▶️ Start {selectedSource === 'camera' ? 'Capture' : 'Upload'}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.primaryButton, styles.stopButton]}
            onPress={stopCapture}
          >
            <Text style={styles.primaryButtonText}>⏸️ Stop Capture</Text>
          </TouchableOpacity>
        )}

        {selectedSource === 'camera' && !isRecording && (
          <TouchableOpacity
            style={styles.switchCameraButton}
            onPress={() => setType(
              type === CameraType.back ? CameraType.front : CameraType.back
            )}
          >
            <Text style={styles.switchCameraText}>🔄 Switch Camera</Text>
          </TouchableOpacity>
        )}

        {videoUri && (
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => setVideoUri(null)}
          >
            <Text style={styles.secondaryButtonText}>Clear Video</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Stats (original) */}
      {isRecording && (
        <View style={styles.statsBox}>
          <Text style={styles.statsTitle}>📊 Capture Statistics:</Text>
          <Text style={styles.statsText}>• Frames Captured: {frameCount}</Text>
          <Text style={styles.statsText}>• Current FPS: {fps}</Text>
          <Text style={styles.statsText}>• Sending to backend via WebSocket</Text>
        </View>
      )}

      {/* Instructions (original) */}
      <View style={styles.instructionsBox}>
        <Text style={styles.instructionsTitle}>📋 Instructions:</Text>
        <Text style={styles.instructionsText}>
          - Select Camera to capture live or Upload for video file{'\n'}
          - Frames are captured at 30 FPS and sent to backend{'\n'}
          - Switch between front/back camera{'\n'}
          - Backend processes frames with MLKD-Net or AOD-Net
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    padding: 20,
  },
  loadingText: {
    color: '#93c5fd',
    marginTop: 15,
    fontSize: 14,
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  errorSubtext: {
    color: '#fca5a5',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },

  // Login Styles
  loginContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#0f172a',
  },
  loginCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    padding: 30,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  logoText: {
    fontSize: 40,
  },
  loginTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  loginSubtitle: {
    fontSize: 14,
    color: '#93c5fd',
    textAlign: 'center',
  },
  formContainer: {
    gap: 15,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#bfdbfe',
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 10,
    padding: 15,
    color: '#fff',
    fontSize: 16,
  },
  mfaInput: {
    textAlign: 'center',
    fontSize: 24,
    letterSpacing: 10,
  },
  mfaText: {
    color: '#bfdbfe',
    textAlign: 'center',
    marginBottom: 15,
  },
  primaryButton: {
    backgroundColor: '#3b82f6',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    padding: 10,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#93c5fd',
    fontSize: 14,
  },
  disabledButton: {
    opacity: 0.5,
  },

  // Dashboard Styles
  dashboardContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 20,
  },
  dashboardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 25,
    marginTop: 10,
  },
  dashboardTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  dashboardSubtitle: {
    fontSize: 14,
    color: '#93c5fd',
    marginTop: 5,
  },
  headerRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  connectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 5,
  },
  connected: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
  },
  disconnected: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  connectionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22c55e',
  },
  connectionText: {
    color: '#86efac',
    fontSize: 11,
    fontWeight: '600',
  },
  logoutButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
  },
  logoutText: {
    color: '#fca5a5',
    fontSize: 14,
    fontWeight: '600',
  },
  statsGrid: {
    gap: 12,
    marginBottom: 25,
  },
  statCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 20,
    borderLeftWidth: 4,
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  statTitle: {
    fontSize: 12,
    color: '#93c5fd',
  },
  statIcon: {
    fontSize: 20,
  },
  statValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  menuGrid: {
    gap: 15,
  },
  menuCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    borderWidth: 2,
  },
  menuIcon: {
    fontSize: 50,
    marginBottom: 15,
  },
  menuLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 5,
  },
  menuSubtext: {
    fontSize: 12,
    color: '#93c5fd',
  },

  // Capture Screen Styles
  captureContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 20,
  },
  captureHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 10,
  },
  backButton: {
    color: '#93c5fd',
    fontSize: 16,
  },
  captureTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  recordingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
  },
  recordingText: {
    color: '#86efac',
    fontSize: 12,
    fontWeight: '600',
  },
  sourceSelector: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  sourceButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
  },
  sourceButtonActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.3)',
    borderColor: '#3b82f6',
  },
  sourceIcon: {
    fontSize: 30,
    marginBottom: 8,
  },
  sourceText: {
    color: '#fff',
    fontWeight: '600',
  },
  videoPreview: {
    height: 300,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 20,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  recordingOverlay: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 15,
    borderRadius: 10,
  },
  recordingInfo: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  frameInfo: {
    color: '#93c5fd',
    fontSize: 14,
  },
  video: {
    flex: 1,
  },
  placeholderView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  placeholderIcon: {
    fontSize: 50,
    marginBottom: 10,
  },
  placeholderText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 14,
    textAlign: 'center',
  },
  placeholderSubtext: {
    color: 'rgba(255, 255, 255, 0.3)',
    fontSize: 12,
    marginTop: 5,
    textAlign: 'center',
  },
  controlsContainer: {
    gap: 10,
    marginBottom: 20,
  },
  startButton: {
    backgroundColor: '#22c55e',
  },
  stopButton: {
    backgroundColor: '#ef4444',
  },
  switchCameraButton: {
    backgroundColor: '#3b82f6',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  switchCameraText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  statsBox: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
  },
  statsTitle: {
    color: '#93c5fd',
    fontWeight: '600',
    marginBottom: 8,
    fontSize: 14,
  },
  statsText: {
    color: '#93c5fd',
    fontSize: 12,
    lineHeight: 20,
  },
  instructionsBox: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    borderRadius: 12,
    padding: 15,
  },
  instructionsTitle: {
    color: '#93c5fd',
    fontWeight: '600',
    marginBottom: 8,
  },
  instructionsText: {
    color: '#93c5fd',
    fontSize: 12,
    lineHeight: 20,
  },

  // Processing Screen Styles
  processingContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 20,
  },
  processingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 10,
  },
  processingTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  modeBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  cloudMode: {
    color: '#22c55e',
    fontWeight: '600',
    fontSize: 12,
  },
  localMode: {
    color: '#fb923c',
    fontWeight: '600',
    fontSize: 12,
  },
  autoSwitchBanner: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 15,
  },
  autoSwitchText: {
    color: '#86efac',
    fontSize: 12,
    textAlign: 'center',
  },
  splitScreen: {
    gap: 15,
    marginBottom: 20,
  },
  videoPanel: {
    gap: 8,
  },
  panelLabel: {
    color: '#bfdbfe',
    fontSize: 12,
    fontWeight: '600',
  },
  videoPlaceholder: {
    height: 150,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  frameImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  metricCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 15,
  },
  metricLabel: {
    color: '#93c5fd',
    fontSize: 12,
    marginBottom: 5,
  },
  metricValue: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  modelInfo: {
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
  },
  modelInfoTitle: {
    color: '#c4b5fd',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 5,
  },
  modelInfoText: {
    color: '#c4b5fd',
    fontSize: 12,
    lineHeight: 18,
  },
  processingControls: {
    gap: 10,
  },
  switchButton: {
    backgroundColor: '#3b82f6',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  switchButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  // Evaluation Screen Styles
  evaluationContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 20,
  },
  evaluationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 10,
  },
  evaluationTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 40,
  },
  detectionStats: {
    gap: 15,
    marginBottom: 25,
  },
  detectionCard: {
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  detectionLabel: {
    color: '#bfdbfe',
    fontSize: 14,
    marginBottom: 10,
  },
  detectionValue: {
    color: '#fff',
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  detectionSubtext: {
    color: '#93c5fd',
    fontSize: 12,
  },
  analysisBox: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
  },
  analysisTitle: {
    color: '#86efac',
    fontWeight: '600',
    marginBottom: 10,
    fontSize: 14,
  },
  analysisText: {
    color: '#86efac',
    fontSize: 12,
    lineHeight: 20,
    marginBottom: 10,
  },
  analysisSummary: {
    color: '#86efac',
    fontSize: 13,
    fontWeight: '600',
  },
  comparisonSection: {
    gap: 15,
    marginBottom: 20,
  },
  comparisonPanel: {
    gap: 8,
  },
  comparisonLabel: {
    color: '#bfdbfe',
    fontSize: 12,
    fontWeight: '600',
  },
  comparisonPlaceholder: {
    height: 200,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  comparisonImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  refreshButton: {
    backgroundColor: '#3b82f6',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  refreshButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
