import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    Alert,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useAppContext } from './_layout';


// PROCESSING SCREEN COMPONENT - Your original code, updated for router and context
export default function ProcessingScreen() {
  const router = useRouter();  // For back navigation
  const { user, wsService } = useAppContext();  // Get user and WebSocket from context
  const [processingMode, setProcessingMode] = useState('cloud');
  const [isProcessing, setIsProcessing] = useState(false);
  const [metrics, setMetrics] = useState({
    fps: 0,
    delay: 0,
    psnr: 0,
    ssim: 0,
  });
  const [hazyFrame, setHazyFrame] = useState(null);
  const [dehazedFrame, setDehazedFrame] = useState(null);

  // Listen for processed frames from backend (original logic, uses wsService)
  useEffect(() => {
    const handleMessage = (data) => {
      if (data.type === 'dehazed_frame') {
        setDehazedFrame(data.frame);
        setMetrics({
          fps: data.fps,
          delay: data.delay,
          psnr: data.psnr,
          ssim: data.ssim,
        });
      }
    };
    wsService.on('message', handleMessage);

    return () => {
      wsService.off('message', handleMessage);
      setIsProcessing(false);
    };
  }, [wsService]);

  // AUTO SWITCHING LOGIC (original - switches based on delay)
  useEffect(() => {
    if (isProcessing && metrics.delay) {
      // If delay > 200ms, switch to local mode
      if (metrics.delay > 200 && processingMode === 'cloud') {
        console.log('⚠️ High delay detected, switching to LOCAL mode');
        setProcessingMode('local');
        wsService.send({
          type: 'switch_mode',
          mode: 'local',
          reason: 'high_delay'
        });
        
        Alert.alert(
          'Mode Switched',
          'Switched to Local mode due to high network delay',
          [{ text: 'OK' }]
        );
      }
      // If delay < 100ms, switch back to cloud
      else if (metrics.delay < 100 && processingMode === 'local') {
        console.log('✅ Delay improved, switching to CLOUD mode');
        setProcessingMode('cloud');
        wsService.send({
          type: 'switch_mode',
          mode: 'cloud',
          reason: 'low_delay'
        });
      }
    }
  }, [metrics.delay, isProcessing, processingMode, wsService]);

  // Start/Stop processing (original, uses wsService)
  const toggleProcessing = () => {
    if (!isProcessing) {
      wsService.send({
        type: 'start_processing',
        userId: user?.id,
        mode: processingMode,
      });
      setIsProcessing(true);
    } else {
      wsService.send({
        type: 'stop_processing',
        userId: user?.id,
      });
      setIsProcessing(false);
      setMetrics({ fps: 0, delay: 0, psnr: 0, ssim: 0 });
    }
  };

  // Manual mode switch (original, uses wsService)
  const handleModeSwitch = () => {
    const newMode = processingMode === 'cloud' ? 'local' : 'cloud';
    setProcessingMode(newMode);
    
    wsService.send({
      type: 'switch_mode',
      mode: newMode,
      reason: 'manual'
    });
  };

  // Simulate metrics for demo (original - remove when backend ready)
  useEffect(() => {
    let interval;
    if (isProcessing) {
      interval = setInterval(() => {
        setMetrics({
          fps: (25 + Math.random() * 5).toFixed(1),
          delay: processingMode === 'cloud' 
            ? (50 + Math.random() * 150).toFixed(0)  // Cloud: 50-200ms
            : (10 + Math.random() * 30).toFixed(0),   // Local: 10-40ms
          psnr: (28 + Math.random() * 4).toFixed(2),
          ssim: (0.85 + Math.random() * 0.1).toFixed(3),
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isProcessing, processingMode]);

  // Web fallback (new - no real processing on web)
  if (Platform.OS === 'web') {
    return (
      <ScrollView style={styles.processingContainer}>
        <View style={styles.processingHeader}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.processingTitle}>Live Processing</Text>
          <View style={{ width: 50 }} />
        </View>
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>📱 Processing not supported on web</Text>
          <Text style={styles.errorSubtext}>Use the mobile app for live dehazing features.</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => router.back()}>
            <Text style={styles.primaryButtonText}>Go Back to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.processingContainer}>
      <View style={styles.processingHeader}>
        <TouchableOpacity onPress={() => router.back()}>  {/* Updated: router.back() */}
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.processingTitle}>Live Processing</Text>
        <View style={styles.modeBadge}>
          <Text style={processingMode === 'cloud' ? styles.cloudMode : styles.localMode}>
            {processingMode === 'cloud' ? '☁️ Cloud' : '💻 Local'}
          </Text>
        </View>
      </View>

       {/* Auto-switching notification (original) */}
      {isProcessing && (
        <View style={styles.autoSwitchBanner}>
          <Text style={styles.autoSwitchText}>
            🤖 Auto-switching enabled: Switches to Local if delay 200ms
          </Text>
        </View>
      )}

      {/* Split Screen (original) */}
      <View style={styles.splitScreen}>
        <View style={styles.videoPanel}>
          <Text style={styles.panelLabel}>Original (Hazy)</Text>
          <View style={styles.videoPlaceholder}>
            {hazyFrame ? (
              <Image source={{ uri: hazyFrame }} style={styles.frameImage} />
            ) : (
              <Text style={styles.placeholderText}>Hazy Video Feed</Text>
            )}
          </View>
        </View>

        <View style={styles.videoPanel}>
          <Text style={styles.panelLabel}>Dehazed ({processingMode})</Text>
          <View style={styles.videoPlaceholder}>
            {dehazedFrame ? (
              <Image source={{ uri: dehazedFrame }} style={styles.frameImage} />
            ) : (
              <Text style={styles.placeholderText}>Dehazed Feed</Text>
            )}
          </View>
        </View>
      </View>

      {/* Metrics (original) */}
      <View style={styles.metricsGrid}>
        <View style={[styles.metricCard, { borderLeftColor: parseFloat(metrics.fps) > 25 ? '#22c55e' : '#ef4444' }]}>
          <Text style={styles.metricLabel}>FPS</Text>
          <Text style={styles.metricValue}>{isProcessing ? metrics.fps : '0.0'}</Text>
        </View>
        <View style={[styles.metricCard, { borderLeftColor: parseFloat(metrics.delay) < 100 ? '#22c55e' : parseFloat(metrics.delay) < 200 ? '#fb923c' : '#ef4444' }]}>
          <Text style={styles.metricLabel}>Delay (ms)</Text>
          <Text style={styles.metricValue}>{isProcessing ? metrics.delay : '0'}</Text>
        </View>
        <View style={[styles.metricCard, { borderLeftColor: '#3b82f6' }]}>
          <Text style={styles.metricLabel}>PSNR</Text>
          <Text style={styles.metricValue}>{isProcessing ? metrics.psnr : '0.00'}</Text>
        </View>
        <View style={[styles.metricCard, { borderLeftColor: '#8b5cf6' }]}>
          <Text style={styles.metricLabel}>SSIM</Text>
          <Text style={styles.metricValue}>{isProcessing ? metrics.ssim : '0.000'}</Text>
        </View>
      </View>

      {/* Model Info (original) */}
      <View style={styles.modelInfo}>
        <Text style={styles.modelInfoTitle}>
          {processingMode === 'cloud' ? '☁️ MLKD-Net (Cloud GPU)' : '💻 AOD-Net (Local CPU)'}
        </Text>
        <Text style={styles.modelInfoText}>
          {processingMode === 'cloud' 
            ? 'High-quality dehazing with knowledge distillation'
            : 'Lightweight backup for network issues'
          }
        </Text>
      </View>

      {/* Controls (original) */}
      <View style={styles.processingControls}>
        <TouchableOpacity
          style={[
            styles.primaryButton,
            isProcessing ? styles.stopButton : styles.startButton,
          ]}
          onPress={toggleProcessing}
        >
          <Text style={styles.primaryButtonText}>
            {isProcessing ? '⏸️ Stop' : '▶️ Start'} Processing
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.switchButton}
          onPress={handleModeSwitch}
        >
          <Text style={styles.switchButtonText}>🔄 Switch to {processingMode === 'cloud' ? 'Local' : 'Cloud'}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// COMPLETE FULL STYLES - All original styles from your code (no truncation)
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
  backButton: {
    color: '#93c5fd',
    fontSize: 16,
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
