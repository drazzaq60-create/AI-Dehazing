// processing.js - Real-time Dehazing with Side-by-Side Display
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { Camera, useCameraDevice, useCameraFormat, useCameraPermission } from 'react-native-vision-camera';
import { useAppContext } from './_layout';

const { width } = Dimensions.get('window');
const FRAME_WIDTH = (width - 48) / 2;

export default function ProcessingScreen() {
  const router = useRouter();
  const { user, wsService, isConnected } = useAppContext();

  const [isProcessing, setIsProcessing] = useState(false);
  const [mode, setMode] = useState('cloud');
  const [hazyFrame, setHazyFrame] = useState(null);
  const [dehazedFrame, setDehazedFrame] = useState(null);
  const [sessionStats, setSessionStats] = useState({ frameCount: 0, fps: 0, delay: 0 });
  const [sessionId, setSessionId] = useState(null);
  const [status, setStatus] = useState('Ready');
  const [videoUrl, setVideoUrl] = useState(null);

  const sessionIdRef = useRef(null);
  const wasStopClickedRef = useRef(false);
  const lastRenderRef = useRef(0);
  const startTimeRef = useRef(null);
  const pendingBinaryMetaRef = useRef(null);

  // Sync mode changes to server during active processing
  useEffect(() => {
    if (isProcessing && sessionIdRef.current) {
      console.log('🔄 Requesting mode switch to:', mode);
      wsService.send({
        type: 'switch_mode',
        sessionId: sessionIdRef.current,
        mode: mode
      });
    }
  }, [mode]);

  // Vision Camera refs & hooks
  const { hasPermission, requestPermission } = useCameraPermission();
  const currentDevice = useCameraDevice('back');
  const cameraRef = useRef(null);
  const isRecordingRef = useRef(false);
  const captureTimerRef = useRef(null);
  const frameCountRef = useRef(0);
  const lastFrameTimeRef = useRef(0);

  const format = useCameraFormat(currentDevice, [
    { videoResolution: { width: 320, height: 240 } },
    { photoResolution: { width: 320, height: 240 } },
    { fps: 60 }
  ]);

  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      isRecordingRef.current = false;
      if (captureTimerRef.current) clearTimeout(captureTimerRef.current);
    };
  }, []);

  // Listen for processed frames from backend
  useEffect(() => {
    if (!wsService) return;

    // Optimized frame handler for high-FPS display
    const handleMessage = (data) => {
      // console.log('Received:', data.type);

      switch (data.type) {
        case 'processed_frame':
          // 1. If we just clicked Stop, ignore residual frames from the network
          if (wasStopClickedRef.current) return;

          // 2. Auto-sync sessionId if we're monitoring a session
          if (data.sessionId && !sessionIdRef.current) {
            sessionIdRef.current = data.sessionId;
            setSessionId(data.sessionId);
          }

          // 3. Throttle UI rendering to keep UI responsive at 15-20 FPS
          const now = Date.now();
          if (now - lastRenderRef.current < 50) return;
          lastRenderRef.current = now;

          if (data.originalFrame) setHazyFrame(data.originalFrame);
          if (data.processedFrame) setDehazedFrame(data.processedFrame);

          setSessionStats({
            frameCount: data.frameCount || 0,
            fps: data.fps || 0,
            delay: data.processingTime || 0
          });

          if (!isProcessing) setIsProcessing(true);
          const newStatus = 'Processing Live...';
          if (status !== newStatus) setStatus(newStatus);
          break;

        case 'session_created':
          setSessionId(data.sessionId);
          sessionIdRef.current = data.sessionId;
          setIsProcessing(true);
          setStatus('Processing started. Capturing...');

          // Start capture loop ONLY after session is verified by backend
          isRecordingRef.current = true;
          frameCountRef.current = 0;
          startLiveCapture();
          break;

        case 'video_ready':
          setStatus('Video ready for download!');
          setVideoUrl(data.downloadUrl);
          break;

        case 'processing_complete':
          setIsProcessing(false);
          setStatus('Finished');
          break;

        case 'error':
          setStatus(`Error: ${data.message}`);
          break;
      }
    };

    wsService.on('message', handleMessage);

    return () => {
      wsService.off('message', handleMessage);
    };
  }, [wsService]);

  // Start processing session
  const startProcessing = () => {
    if (!isConnected) {
      Alert.alert('Error', 'Backend not connected');
      return;
    }

    const newSessionId = `process_${Date.now()}`;
    setSessionId(newSessionId);
    sessionIdRef.current = newSessionId;
    wasStopClickedRef.current = false; // Allow frames again

    setSessionStats({ frameCount: 0, fps: 0, delay: 0 });
    setHazyFrame(null);
    setDehazedFrame(null);

    wsService.send({
      type: 'start_processing',
      userId: user?.id || 'anonymous',
      mode: mode,
      sessionId: newSessionId
    });

    setStatus('Initializing session...');
    setVideoUrl(null); // Reset previous video link
  };

  // Dedicated capture loop for the Processing screen
  const startLiveCapture = () => {
    const captureLoop = async () => {
      if (!isRecordingRef.current || !cameraRef.current) return;

      try {
        const photo = await cameraRef.current.takeSnapshot({ quality: 50 });
        const now = Date.now();
        frameCountRef.current++;
        const currentCount = frameCountRef.current;

        // Process and send in background
        (async () => {
          try {
            const manipulated = await manipulateAsync(
              photo.path.startsWith('file') ? photo.path : `file://${photo.path}`,
              [],
              { compress: 0.5, format: SaveFormat.JPEG, base64: true }
            );

            wsService.send({
              type: 'video_frame',
              frame: manipulated.base64,
              frameNumber: currentCount,
              sessionId: sessionIdRef.current,
              userId: user?.id || 'anonymous',
              timestamp: now
            });
          } catch (e) { }
        })();

        captureTimerRef.current = setTimeout(captureLoop, 50); // Target 20 FPS
      } catch (err) {
        captureTimerRef.current = setTimeout(captureLoop, 200);
      }
    };

    captureLoop();
  };
  // Stop processing
  const stopProcessing = () => {
    const targetSession = sessionIdRef.current || sessionId;
    if (targetSession) {
      wsService.send({
        type: 'stop_processing',
        sessionId: targetSession
      });
    }

    wasStopClickedRef.current = true; // Block incoming residual frames
    isRecordingRef.current = false;
    if (captureTimerRef.current) clearTimeout(captureTimerRef.current);
    setIsProcessing(false);
    setSessionId(null);
    sessionIdRef.current = null;
    setStatus('Stopped');
  };

  // Switch mode (cloud/local)
  const switchMode = () => {
    const newMode = mode === 'cloud' ? 'local' : 'cloud';
    setMode(newMode);
    // mode sync happens in useEffect
  };

  // Save collected frames to phone gallery
  // Capture the current dehazed frame to phone gallery
  const captureSnapshot = async () => {
    if (!dehazedFrame) {
      Alert.alert('No image', 'Please start processing to capture a frame');
      return;
    }

    try {
      const MediaLibrary = require('expo-media-library');
      const FileSystem = require('expo-file-system');

      const { status: pStatus } = await MediaLibrary.requestPermissionsAsync();
      if (pStatus !== 'granted') {
        Alert.alert('Permission needed', 'Allow storage access to save images');
        return;
      }

      setStatus('Saving snapshot...');

      const base64 = dehazedFrame.replace(/^data:image\/[a-z]+;base64,/, '');
      const filename = `${FileSystem.cacheDirectory}snapshot_${Date.now()}.jpg`;

      await FileSystem.writeAsStringAsync(filename, base64, {
        encoding: FileSystem.EncodingType ? FileSystem.EncodingType.Base64 : 'base64',
      });

      await MediaLibrary.saveToLibraryAsync(filename);

      Alert.alert('Success', 'Snapshot saved to your photo gallery!');
      setStatus('Snapshot saved');
    } catch (error) {
      console.error('Capture error:', error);
      Alert.alert('Error', 'Failed to save snapshot');
      setStatus('Error saving');
    }
  };

  // Download compiled MP4 from server
  const downloadVideo = async () => {
    if (!videoUrl) return;

    try {
      setStatus('Downloading video...');

      const API_URL = wsService.ws.url.replace('ws://', 'http://').replace('wss://', 'https://');
      const downloadLink = `${API_URL}${videoUrl}`;

      console.log('🔗 Downloading from:', downloadLink);

      if (Platform.OS === 'web') {
        window.open(downloadLink, '_blank');
      } else {
        // Mobile download logic using expo-file-system
        const FileSystem = require('expo-file-system');
        const MediaLibrary = require('expo-media-library');

        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Allow storage access to save video');
          return;
        }

        const fileUri = `${FileSystem.cacheDirectory}dehazed_${sessionIdRef.current || 'video'}.mp4`;
        const downloadRes = await FileSystem.downloadAsync(downloadLink, fileUri);

        if (downloadRes.status === 200) {
          await MediaLibrary.saveToLibraryAsync(downloadRes.uri);
          Alert.alert('Success', 'Video saved to gallery!');
        } else {
          Alert.alert('Error', 'Download failed from server');
        }
      }
      setStatus('Download complete');
    } catch (error) {
      console.error('Download error:', error);
      Alert.alert('Error', 'Failed to download video');
      setStatus('Error downloading');
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Real-time Dehazing</Text>
        <View style={[styles.statusBadge, isConnected ? styles.online : styles.offline]}>
          <Text style={styles.statusText}>
            {isConnected ? '🟢 Online' : '🔴 Offline'}
          </Text>
        </View>
      </View>

      {/* Mode Selector */}
      <View style={styles.modeSelector}>
        <TouchableOpacity
          style={[styles.modeButton, mode === 'cloud' && styles.modeActive]}
          onPress={() => setMode('cloud')}
        >
          <Text style={styles.modeText}>☁️ Cloud (Fast)</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeButton, mode === 'local' && styles.modeActive]}
          onPress={() => setMode('local')}
        >
          <Text style={styles.modeText}>💻 Local (Quality)</Text>
        </TouchableOpacity>
      </View>

      {/* Side-by-Side Comparison */}
      <View style={styles.comparisonContainer}>
        {/* Hazy Input */}
        <View style={styles.frameBox}>
          <Text style={styles.frameLabel}>Hazy Input</Text>
          <View style={styles.frameView}>
            {isProcessing && isRecordingRef.current && currentDevice ? (
              <Camera
                ref={cameraRef}
                style={styles.frameImage}
                device={currentDevice}
                format={format}
                isActive={true}
                photo={true}
                video={true}
              />
            ) : hazyFrame ? (
              <Image source={{ uri: hazyFrame }} style={styles.frameImage} resizeMode="cover" />
            ) : (
              <Text style={styles.placeholderText}>No input yet</Text>
            )}
          </View>
        </View>

        {/* Dehazed Output */}
        <View style={styles.frameBox}>
          <Text style={styles.frameLabel}>Dehazed Output</Text>
          <View style={styles.frameView}>
            {dehazedFrame ? (
              <Image source={{ uri: dehazedFrame }} style={styles.frameImage} resizeMode="cover" />
            ) : (
              <Text style={styles.placeholderText}>
                {isProcessing ? 'Processing...' : 'Start to see output'}
              </Text>
            )}
          </View>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <Text style={styles.statsTitle}>Processing Statistics</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Frames</Text>
            <Text style={styles.statValue}>{sessionStats.frameCount}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>FPS</Text>
            <Text style={styles.statValue}>{sessionStats.fps}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Delay</Text>
            <Text style={styles.statValue}>{sessionStats.delay}ms</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Mode</Text>
            <Text style={styles.statValue}>{mode === 'cloud' ? '☁️' : '💻'}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Status</Text>
            <Text style={[styles.statValue, styles.statusTextSmall]}>
              {isProcessing ? '🔴' : '⚪'}
            </Text>
          </View>
        </View>
      </View>

      {/* Status */}
      <View style={styles.statusBar}>
        <Text style={styles.statusBarText}>{status}</Text>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        {!isProcessing ? (
          <TouchableOpacity
            style={[styles.primaryButton, !isConnected && styles.disabledButton]}
            onPress={startProcessing}
            disabled={!isConnected}
          >
            <Text style={styles.buttonText}>
              {isConnected ? '▶️ Start Real-time Processing' : '❌ Backend Offline'}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.stopButton} onPress={stopProcessing}>
            <Text style={styles.buttonText}>⏹️ Stop Processing</Text>
          </TouchableOpacity>
        )}

        {videoUrl && (
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: '#3b82f6', marginTop: 10 }]}
            onPress={downloadVideo}
          >
            <Text style={styles.buttonText}>⬇️ Download Dehazed MP4</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.saveButton}
          onPress={captureSnapshot}
          disabled={!dehazedFrame}
        >
          <Text style={styles.buttonText}>📸 Capture Snapshot to Gallery</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.captureButton}
          onPress={() => router.push('/capture')}
        >
          <Text style={styles.buttonText}>📹 Go to Capture Screen</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  online: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
  },
  offline: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  modeSelector: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  modeButton: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#475569',
  },
  modeActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  modeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  comparisonContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 16,
  },
  frameBox: {
    flex: 1,
  },
  frameLabel: {
    color: '#94a3b8',
    fontSize: 12,
    marginBottom: 8,
    fontWeight: '600',
  },
  frameView: {
    aspectRatio: 4 / 3,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  frameImage: {
    width: '100%',
    height: '100%',
  },
  placeholderText: {
    color: '#475569',
    fontSize: 11,
    textAlign: 'center',
    padding: 8,
  },
  statsContainer: {
    margin: 16,
    padding: 16,
    backgroundColor: '#1e293b',
    borderRadius: 12,
  },
  statsTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statCard: {
    width: (width - 64) / 3 - 8,
    backgroundColor: '#0f172a',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  statLabel: {
    color: '#94a3b8',
    fontSize: 10,
    marginBottom: 4,
  },
  statValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  statusTextSmall: {
    fontSize: 14,
  },
  statusBar: {
    marginHorizontal: 16,
    padding: 12,
    backgroundColor: '#1e293b',
    borderRadius: 8,
    marginBottom: 16,
  },
  statusBarText: {
    color: '#94a3b8',
    fontSize: 12,
    textAlign: 'center',
  },
  controls: {
    padding: 16,
    gap: 12,
    paddingBottom: 32,
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
  saveButton: {
    backgroundColor: '#3b82f6',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  captureButton: {
    backgroundColor: '#8b5cf6',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
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
});
