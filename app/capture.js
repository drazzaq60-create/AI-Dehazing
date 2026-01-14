// capture.js - Real-time Video Capture with Vision Camera + Binary WebSocket
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useAppContext } from './_layout';

// Vision Camera imports
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';

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

  const cameraRef = useRef(null);
  const captureIntervalRef = useRef(null);
  const startTimeRef = useRef(null);
  const frameCountRef = useRef(0);
  const isRecordingRef = useRef(false);
  const lastFrameTimeRef = useRef(0);
  const isTakingPhotoRef = useRef(false);
  const currentSessionIdRef = useRef(null);

  // Get current device based on facing
  const currentDevice = useCameraDevice(facing);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCapture();
    };
  }, []);

  // Listen for backend responses
  useEffect(() => {
    if (!wsService) return;

    const handleMessage = (data) => {
      if (data.type === 'session_created') {
        setSessionId(data.sessionId);
        setStatus('Capturing...');
        console.log('Session created:', data.sessionId);
      }
    };

    wsService.on('message', handleMessage);
    return () => wsService.off('message', handleMessage);
  }, [wsService]);

  // Start capturing - using takePhoto + binary send
  const startCapture = async () => {
    if (!currentDevice || !cameraRef.current) {
      setStatus('Camera not ready');
      return;
    }

    if (!wsService?.isConnected) {
      setStatus('Backend not connected');
      return;
    }

    // Create session
    const newSessionId = `capture_${Date.now()}`;
    setSessionId(newSessionId);
    currentSessionIdRef.current = newSessionId;
    setIsRecording(true);
    isRecordingRef.current = true;
    setFrameCount(0);
    frameCountRef.current = 0;
    startTimeRef.current = Date.now();
    lastFrameTimeRef.current = Date.now();
    setStatus('Starting...');

    // Tell backend to start processing
    wsService.send({
      type: 'start_processing',
      userId: user?.id || 'anonymous',
      mode: 'cloud',
      sessionId: newSessionId
    });

    // Capture at target 20 FPS = every 50ms
    captureIntervalRef.current = setInterval(async () => {
      if (!isRecordingRef.current || !cameraRef.current || isTakingPhotoRef.current) return;

      try {
        isTakingPhotoRef.current = true;

        // Vision Camera takePhoto - faster than expo-camera
        const photo = await cameraRef.current.takePhoto({
          qualityPrioritization: 'speed',
          flash: 'off',
          enableShutterSound: false,
        });

        if (!isRecordingRef.current) {
          isTakingPhotoRef.current = false;
          return;
        }

        frameCountRef.current++;
        const currentFrame = frameCountRef.current;
        setFrameCount(currentFrame);

        // Calculate FPS
        const now = Date.now();
        const timeDiff = now - lastFrameTimeRef.current;
        if (timeDiff > 0) {
          const currentFps = Math.round(1000 / timeDiff);
          setFps(currentFps);
        }
        lastFrameTimeRef.current = now;

        // Read file as ArrayBuffer (BINARY - no base64!)
        const response = await fetch(`file://${photo.path}`);
        const arrayBuffer = await response.arrayBuffer();

        // Send metadata first, then binary
        wsService.sendBinary(arrayBuffer, {
          type: 'binary_frame',
          frameNumber: currentFrame,
          sessionId: currentSessionIdRef.current,
          userId: user?.id || 'anonymous',
          timestamp: now
        });

        setStatus(`Capturing: ${currentFrame} frames @ ${fps} FPS`);

        // Delete temp file
        try {
          const RNFS = require('react-native-fs');
          await RNFS.unlink(photo.path);
        } catch (e) { }

        isTakingPhotoRef.current = false;

      } catch (error) {
        isTakingPhotoRef.current = false;
        if (isRecordingRef.current) {
          console.error('Frame capture error:', error);
        }
      }
    }, 50); // Target 20 FPS
  };

  // Stop capturing
  const stopCapture = () => {
    if (captureIntervalRef.current) {
      clearInterval(captureIntervalRef.current);
      captureIntervalRef.current = null;
    }

    if (currentSessionIdRef.current && wsService?.isConnected) {
      wsService.send({
        type: 'stop_processing',
        sessionId: currentSessionIdRef.current
      });
    }

    setIsRecording(false);
    isRecordingRef.current = false;
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
        <Text style={styles.title}>Binary Capture</Text>
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
          isActive={true}
          photo={true}
        />

        {/* Recording Overlay */}
        {isRecording && (
          <View style={styles.recordingOverlay}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingText}>BINARY MODE</Text>
            <Text style={styles.statsText}>Frames: {frameCount}</Text>
            <Text style={styles.statsText}>FPS: {fps}</Text>
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
              {isConnected ? '▶️ Start Binary Capture (20 FPS)' : '❌ Backend Offline'}
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
          <Text style={styles.statusTitle}>Status</Text>
          <Text style={styles.statusValue}>{status}</Text>
          <Text style={styles.statusValue}>
            Backend: {isConnected ? '✅ Connected' : '❌ Disconnected'}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.processButton}
          onPress={() => router.push('/processing')}
        >
          <Text style={styles.buttonText}>📊 Go to Processing Screen</Text>
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
    backgroundColor: '#22c55e',
    marginBottom: 8,
  },
  recordingText: {
    color: '#22c55e',
    fontSize: 14,
    fontWeight: 'bold',
  },
  statsText: {
    color: '#fff',
    fontSize: 12,
    marginTop: 4,
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
