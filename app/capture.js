import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useAppContext } from './_layout';

// Vision Camera imports
import { Camera, useCameraDevice, useCameraFormat, useCameraPermission } from 'react-native-vision-camera';

export default function CaptureScreen() {
  const router = useRouter();
  const { user, wsService, isConnected } = useAppContext();

  // Vision Camera hooks
  const { hasPermission, requestPermission } = useCameraPermission();

  const [facing, setFacing] = useState('back');
  const [isRecording, setIsRecording] = useState(false);
  const [frameCount, setFrameCount] = useState(0);
  const [fps, setFps] = useState(0);
  const [sessionId, setSessionId] = useState(null);
  const [status, setStatus] = useState('Ready');
  const [dehazedFrame, setDehazedFrame] = useState(null);
  const [serverFps, setServerFps] = useState(0);

  const cameraRef = useRef(null);
  const captureIntervalRef = useRef(null);
  const captureTimerRef = useRef(null);
  const startTimeRef = useRef(null);
  const frameCountRef = useRef(0);
  const isRecordingRef = useRef(false);
  const lastFrameTimeRef = useRef(0);
  const isTakingPhotoRef = useRef(false);
  const currentSessionIdRef = useRef(null);

  // Get current device based on facing
  const currentDevice = useCameraDevice(facing);

  // Filter for LOWEST resolution to maximize FPS (Deep Focus Authentic Solution)
  const format = useCameraFormat(currentDevice, [
    { videoResolution: { width: 320, height: 240 } },
    { photoResolution: { width: 320, height: 240 } },
    { fps: 60 }
  ]);

  // Listen for processed frames from backend
  useEffect(() => {
    if (!wsService) return;

    const handleMessage = (data) => {
      if (data.type === 'processed_frame' && data.sessionId === currentSessionIdRef.current) {
        if (data.processedFrame) {
          setDehazedFrame(data.processedFrame);
        }
        setServerFps(data.fps || 0);
      }
    };

    wsService.on('message', handleMessage);
    return () => {
      wsService.off('message', handleMessage);
      isRecordingRef.current = false;
      if (captureTimerRef.current) clearTimeout(captureTimerRef.current);
    };
  }, [wsService]);

  // Start capturing frames manually in a loop to control FPS precisely
  const startCapture = async () => {
    if (!cameraRef.current) {
      setStatus('Error: Camera not ready');
      return;
    }

    const newSessionId = `capture_${Date.now()}`;
    setSessionId(newSessionId);
    currentSessionIdRef.current = newSessionId;

    // Start session on backend
    wsService.send({
      type: 'start_processing',
      userId: user?.id || 'anonymous',
      mode: 'cloud',
      sessionId: newSessionId
    });

    setIsRecording(true);
    isRecordingRef.current = true;
    frameCountRef.current = 0;
    setFrameCount(0);
    setStatus('Capturing...');

    // THE PARALLEL FPS PIPE (Deep Focus Authentic Solution)
    const captureFrame = async () => {
      if (!isRecordingRef.current) return;

      try {
        const now = Date.now();
        const timeSinceLast = now - lastFrameTimeRef.current;

        // Target ~20 FPS (50ms interval)
        if (timeSinceLast < 50) {
          captureTimerRef.current = setTimeout(captureFrame, 5);
          return;
        }

        // 1. FAST CAMERA SNAPSHOT (Bypasses Sensor Processing)
        const photo = await cameraRef.current.takeSnapshot({
          quality: 50
        });

        lastFrameTimeRef.current = Date.now();
        frameCountRef.current++;
        const currentFrame = frameCountRef.current;

        // 2. PARALLEL PROCESSING (Non-Blocking)
        (async () => {
          try {
            // No resize needed if we're already at 320x240, but base64 is still required
            const manipulated = await manipulateAsync(
              photo.path.startsWith('file') ? photo.path : `file://${photo.path}`,
              [], // No resize needed if format is already small
              { compress: 0.5, format: SaveFormat.JPEG, base64: true }
            );

            wsService.send({
              type: 'video_frame',
              frame: manipulated.base64,
              frameNumber: currentFrame,
              sessionId: currentSessionIdRef.current,
              userId: user?.id || 'anonymous',
              timestamp: Date.now()
            });

            // Occasional UI updates for diagnostics to avoid UI lag (Every 10 frames)
            if (currentFrame % 10 === 0) {
              setFrameCount(currentFrame);
              setFps(Math.round(1000 / (Date.now() - now)));
            }
          } catch (err) {
            console.error('Parallel work error:', err);
          }
        })();

        // 3. IMMEDIATELY START NEXT CAPTURE CYCLE
        captureTimerRef.current = setTimeout(captureFrame, 1);

      } catch (error) {
        console.error('Fast capture error:', error);
        captureTimerRef.current = setTimeout(captureFrame, 200);
      }
    };

    // Start the loop
    lastFrameTimeRef.current = Date.now();
    captureFrame();
  };

  // Stop capturing
  const stopCapture = () => {
    isRecordingRef.current = false;
    setIsRecording(false);

    if (captureTimerRef.current) {
      clearTimeout(captureTimerRef.current);
      captureTimerRef.current = null;
    }

    if (currentSessionIdRef.current && wsService?.isConnected) {
      wsService.send({
        type: 'stop_processing',
        sessionId: currentSessionIdRef.current
      });
    }

    setStatus(`Done: ${frameCountRef.current} frames captured`);
  };

  // Switch camera
  const switchCamera = () => {
    setFacing(facing === 'back' ? 'front' : 'back');
  };

  // Web fallback
  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Video Capture</Text>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>
              {isConnected ? '🟢 Online' : '🔴 Offline'}
            </Text>
          </View>
        </View>
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>📱 Camera requires mobile device</Text>
          <Text style={styles.subText}>Use Development Build on your phone</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => router.back()}>
            <Text style={styles.buttonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Permission loading
  if (!hasPermission) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Requesting camera permission...</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // No device
  if (!currentDevice) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.errorText}>❌ No camera device found</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => router.back()}>
          <Text style={styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>DEEP SCAN MODE v2</Text>
        <View style={[styles.statusBadge, isRecording && styles.recordingBadge]}>
          <Text style={styles.statusText}>
            {isRecording ? `🔴 ${fps} FPS` : (isConnected ? '🟢 Ready' : '🔴 Offline')}
          </Text>
        </View>
      </View>

      {/* Camera Preview */}
      <View style={styles.cameraContainer}>
        <Camera
          ref={cameraRef}
          style={styles.camera}
          device={currentDevice}
          format={format}
          isActive={true}
          photo={true}
          video={true}
          enableHighQualityPhotos={false}
          enableAutoStabilization={false}
          exposure={0}
          lowLightBoost={false}
        />

        {/* Recording Overlay */}
        {isRecording && (
          <View style={styles.recordingOverlay}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingText}>REAL-TIME DEHAZING</Text>
            <Text style={styles.statsText}>Camera FPS: {fps}</Text>
            <Text style={styles.statsText}>Server FPS: {serverFps}</Text>
            <Text style={styles.statsText}>Frames: {frameCount}</Text>
          </View>
        )}

        {/* Dehazed Preview Overlay */}
        {isRecording && dehazedFrame && (
          <View style={styles.previewOverlay}>
            <Text style={styles.previewLabel}>DEHAZED OUTPUT</Text>
            <Image
              source={{ uri: dehazedFrame }}
              style={styles.previewImage}
              resizeMode="cover"
            />
          </View>
        )}
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        {!isRecording ? (
          <TouchableOpacity
            style={[styles.primaryButton, !isConnected && styles.disabledButton]}
            onPress={startCapture}
            disabled={!isConnected}
          >
            <Text style={styles.buttonText}>
              {isConnected ? '🚀 Start Ultra-FPS Capture' : '❌ Backend Offline'}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.stopButton} onPress={stopCapture}>
            <Text style={styles.buttonText}>⏹️ Stop Capture</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={switchCamera}
          disabled={isRecording}
        >
          <Text style={styles.secondaryButtonText}>🔄 Switch Camera</Text>
        </TouchableOpacity>

        <View style={styles.statusBox}>
          <Text style={styles.statusTitle}>Network Optimization Status</Text>
          <Text style={styles.statusValue}>{status}</Text>
          <Text style={styles.statusValue}>
            Payload: ~30KB/frame (320px compressed)
          </Text>
        </View>

        <TouchableOpacity
          style={styles.processButton}
          onPress={() => router.push('/processing')}
        >
          <Text style={styles.buttonText}>📊 View Real-time Dehazing</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 50,
    backgroundColor: '#1e293b',
  },
  backButton: {
    color: '#3b82f6',
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  statusBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  recordingBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.3)',
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  cameraContainer: {
    height: 350,
    margin: 16,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  recordingOverlay: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 12,
    borderRadius: 8,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ef4444',
    marginBottom: 8,
  },
  recordingText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: 'bold',
  },
  statsText: {
    color: '#fff',
    fontSize: 12,
    marginTop: 2,
  },
  previewOverlay: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 140,
    height: 105,
    backgroundColor: '#000',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#3b82f6',
    overflow: 'hidden',
  },
  previewLabel: {
    position: 'absolute',
    top: 2,
    left: 4,
    zIndex: 10,
    color: '#3b82f6',
    fontSize: 8,
    fontWeight: 'bold',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 4,
    borderRadius: 2,
  },
  previewImage: {
    flex: 1,
  },
  controls: {
    flex: 1,
    padding: 16,
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#22c55e',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  stopButton: {
    backgroundColor: '#ef4444',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  processButton: {
    backgroundColor: '#8b5cf6',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 'auto',
  },
  disabledButton: {
    backgroundColor: '#475569',
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#475569',
  },
  secondaryButtonText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
  },
  statusBox: {
    backgroundColor: '#1e293b',
    padding: 16,
    borderRadius: 12,
  },
  statusTitle: {
    color: '#94a3b8',
    fontSize: 12,
    marginBottom: 4,
  },
  statusValue: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 4,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    padding: 20,
  },
  loadingText: {
    color: '#94a3b8',
    marginTop: 16,
    fontSize: 14,
  },
  errorText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subText: {
    color: '#94a3b8',
    fontSize: 14,
    marginBottom: 24,
  },
});
