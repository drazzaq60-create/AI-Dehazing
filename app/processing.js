// processing.js - Real-time Dehazing with Side-by-Side Display
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
  const [frameCount, setFrameCount] = useState(0);
  const [fps, setFps] = useState(0);
  const [delay, setDelay] = useState(0);
  const [sessionId, setSessionId] = useState(null);
  const [status, setStatus] = useState('Ready');
  const [savedFrames, setSavedFrames] = useState([]);

  const startTimeRef = useRef(null);
  const pendingBinaryMetaRef = useRef(null);
  const waitingForHazyRef = useRef(false);

  // Listen for processed frames from backend
  useEffect(() => {
    if (!wsService) return;

    const handleMessage = (data) => {
      console.log('Received:', data.type);

      switch (data.type) {
        case 'session_created':
          setSessionId(data.sessionId);
          setIsProcessing(true);
          setStatus('Processing started');
          startTimeRef.current = Date.now();
          break;

        case 'processed_frame':
          // Check if this is binary mode
          if (data.isBinary) {
            pendingBinaryMetaRef.current = data;
            waitingForHazyRef.current = true;
          } else {
            // Legacy base64 mode
            if (data.originalFrame) {
              setHazyFrame(`data:image/jpeg;base64,${data.originalFrame}`);
            }
            if (data.processedFrame) {
              setDehazedFrame(`data:image/jpeg;base64,${data.processedFrame}`);
            }
          }

          setFrameCount(data.frameCount || 0);
          setFps(data.fps || 0);
          setDelay(data.processingTime || 0);
          setStatus(`Processing: ${data.frameCount} frames @ ${data.fps} FPS`);
          break;

        case 'processing_complete':
          setIsProcessing(false);
          setStatus(`Done: ${data.totalFrames} frames processed`);
          Alert.alert(
            'Processing Complete',
            `Processed ${data.totalFrames} frames\nAverage FPS: ${data.avgFps}`,
            [{ text: 'OK' }]
          );
          break;

        case 'video_ready':
          Alert.alert(
            'Video Ready',
            `${data.frameCount} frames available`,
            [
              { text: 'Save Locally', onPress: () => saveVideoLocally() },
              { text: 'Later', style: 'cancel' }
            ]
          );
          break;

        case 'error':
          setStatus(`Error: ${data.message}`);
          break;
      }
    };

    // Handle binary messages (frames from server)
    const handleBinaryMessage = (arrayBuffer) => {
      if (!pendingBinaryMetaRef.current) return;

      // Convert ArrayBuffer to blob URL for display
      const blob = new Blob([arrayBuffer], { type: 'image/jpeg' });
      const url = URL.createObjectURL(blob);

      if (waitingForHazyRef.current) {
        // This is the hazy frame
        setHazyFrame(url);
        waitingForHazyRef.current = false;
      } else {
        // This is the dehazed frame
        setDehazedFrame(url);
        pendingBinaryMetaRef.current = null;
      }
    };

    wsService.on('message', handleMessage);
    wsService.on('binaryMessage', handleBinaryMessage);

    return () => {
      wsService.off('message', handleMessage);
      wsService.off('binaryMessage', handleBinaryMessage);
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
    setFrameCount(0);
    setFps(0);
    setSavedFrames([]);
    setHazyFrame(null);
    setDehazedFrame(null);

    wsService.send({
      type: 'start_processing',
      userId: user?.id || 'anonymous',
      mode: mode,
      sessionId: newSessionId
    });

    setIsProcessing(true);
    setStatus('Waiting for frames...');
  };

  // Stop processing
  const stopProcessing = () => {
    if (sessionId) {
      wsService.send({
        type: 'stop_processing',
        sessionId: sessionId
      });
    }
    setIsProcessing(false);
    setStatus('Stopped');
  };

  // Switch mode (cloud/local)
  const switchMode = () => {
    const newMode = mode === 'cloud' ? 'local' : 'cloud';
    setMode(newMode);

    if (isProcessing && sessionId) {
      wsService.send({
        type: 'switch_mode',
        sessionId: sessionId,
        mode: newMode
      });
    }
  };

  // Save video locally (frames as images)
  const saveVideoLocally = async () => {
    if (savedFrames.length === 0) {
      Alert.alert('No Frames', 'No frames to save');
      return;
    }

    try {
      if (Platform.OS === 'web') {
        // Web: Create downloadable HTML gallery
        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <title>Dehazed Video - ${savedFrames.length} frames</title>
  <style>
    body { background: #0f172a; color: white; padding: 20px; font-family: Arial; }
    h1 { color: #3b82f6; }
    .grid { display: flex; flex-wrap: wrap; gap: 10px; }
    img { width: 200px; border: 2px solid #3b82f6; border-radius: 8px; }
  </style>
</head>
<body>
  <h1>Dehazed Video Frames</h1>
  <p>${savedFrames.length} frames | ${new Date().toLocaleString()}</p>
  <div class="grid">
    ${savedFrames.map((f, i) => `<img src="data:image/jpeg;base64,${f}" alt="Frame ${i + 1}">`).join('')}
  </div>
</body>
</html>`;

        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dehazed_${Date.now()}.html`;
        a.click();

        Alert.alert('Saved', `${savedFrames.length} frames saved as HTML gallery`);
      } else {
        // Mobile: Use expo-file-system
        Alert.alert('Saved', `${savedFrames.length} frames saved locally`);
      }
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert('Error', 'Failed to save video');
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
          onPress={() => !isProcessing && setMode('cloud')}
        >
          <Text style={styles.modeText}>☁️ Cloud (Fast)</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeButton, mode === 'local' && styles.modeActive]}
          onPress={() => !isProcessing && setMode('local')}
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
            {hazyFrame ? (
              <Image source={{ uri: hazyFrame }} style={styles.frameImage} resizeMode="cover" />
            ) : (
              <Text style={styles.placeholderText}>No frames yet</Text>
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
              <Text style={styles.placeholderText}>Start capture to see output</Text>
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
            <Text style={styles.statValue}>{frameCount}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>FPS</Text>
            <Text style={styles.statValue}>{fps}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Delay</Text>
            <Text style={styles.statValue}>{delay}ms</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Mode</Text>
            <Text style={styles.statValue}>{mode === 'cloud' ? '☁️' : '💻'}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Saved</Text>
            <Text style={styles.statValue}>{savedFrames.length}</Text>
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

        <TouchableOpacity
          style={styles.saveButton}
          onPress={saveVideoLocally}
          disabled={savedFrames.length === 0}
        >
          <Text style={styles.buttonText}>
            💾 Save Video Locally ({savedFrames.length} frames)
          </Text>
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