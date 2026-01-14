import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useAppContext } from './_layout';

// EVALUATION SCREEN COMPONENT - Your original code, updated for router and context
export default function EvaluationScreen() {
  const router = useRouter();  // For back navigation
  const { user, wsService } = useAppContext();  // Get user and WebSocket from context
  const [detectionResults, setDetectionResults] = useState({
    hazyDetections: 0,
    dehazedDetections: 0,
    improvement: 0,
  });
  const [hazyImage, setHazyImage] = useState(null);
  const [dehazedImage, setDehazedImage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Listen for YOLO results from backend (original logic, uses wsService)
  useEffect(() => {
    const handleMessage = (data) => {
      if (data.type === 'yolo_results') {
        setDetectionResults({
          hazyDetections: data.hazyDetections,
          dehazedDetections: data.dehazedDetections,
          improvement: data.improvement,
        });
        setHazyImage(data.hazyImage);
        setDehazedImage(data.dehazedImage);
        setIsLoading(false);
      }
    };
    wsService.on('message', handleMessage);

    // Request YOLO evaluation (original)
    setIsLoading(true);
    wsService.send({
      type: 'run_yolo_evaluation',
      userId: user?.id,
    });

    // Simulate data for demo (original - remove when backend ready)
    setTimeout(() => {
      setDetectionResults({
        hazyDetections: 12,
        dehazedDetections: 23,
        improvement: 91.7,
      });
      setIsLoading(false);
    }, 2000);

    return () => {
      wsService.off('message', handleMessage);
    };
  }, [user, wsService]);

  // Refresh button handler (original, uses wsService)
  const handleRefresh = () => {
    setIsLoading(true);
    wsService.send({
      type: 'run_yolo_evaluation',
      userId: user?.id,
    });
  };

  // Web fallback (new - no real YOLO on web)
  if (Platform.OS === 'web') {
    return (
      <ScrollView style={styles.evaluationContainer}>
        <View style={styles.evaluationHeader}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.evaluationTitle}>YOLO Evaluation</Text>
          <View style={{ width: 50 }} />
        </View>
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>📱 YOLO Evaluation not supported on web</Text>
          <Text style={styles.errorSubtext}>Use the mobile app for detection features.</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => router.back()}>
            <Text style={styles.primaryButtonText}>Go Back to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.evaluationContainer}>
      <View style={styles.evaluationHeader}>
        <TouchableOpacity onPress={() => router.back()}>  {/* Updated: router.back() */}
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.evaluationTitle}>YOLO Evaluation</Text>
        <View style={{ width: 50 }} />
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Running YOLO detection...</Text>
        </View>
      ) : (
        <>
          {/* Detection Stats (original) */}
          <View style={styles.detectionStats}>
            <View style={[styles.detectionCard, { backgroundColor: '#3b82f620' }]}>
              <Text style={styles.detectionLabel}>Hazy Detections</Text>
              <Text style={styles.detectionValue}>{detectionResults.hazyDetections}</Text>
              <Text style={styles.detectionSubtext}>Objects found</Text>
            </View>

            <View style={[styles.detectionCard, { backgroundColor: '#10b98120' }]}>
              <Text style={styles.detectionLabel}>Dehazed Detections</Text>
              <Text style={styles.detectionValue}>{detectionResults.dehazedDetections}</Text>
              <Text style={styles.detectionSubtext}>Objects found</Text>
            </View>

            <View style={[styles.detectionCard, { backgroundColor: '#8b5cf620' }]}>
              <Text style={styles.detectionLabel}>Improvement</Text>
              <Text style={styles.detectionValue}>{detectionResults.improvement}%</Text>
              <Text style={styles.detectionSubtext}>More accurate</Text>
            </View>
          </View>

          {/* Analysis (original) */}
          <View style={styles.analysisBox}>
            <Text style={styles.analysisTitle}>📊 Analysis:</Text>
            <Text style={styles.analysisText}>
              - Hazy frames: {detectionResults.hazyDetections} objects detected{'\n'}
              - Dehazed frames: {detectionResults.dehazedDetections} objects detected{'\n'}
              - Improvement: +{detectionResults.dehazedDetections - detectionResults.hazyDetections} more objects{'\n'}
              - Accuracy boost: {detectionResults.improvement}%
            </Text>
            <Text style={styles.analysisSummary}>
              ✅ Dehazing significantly improves AI object detection capabilities
            </Text>
          </View>

          {/* Visual Comparison (original) */}
          <View style={styles.comparisonSection}>
            <View style={styles.comparisonPanel}>
              <Text style={styles.comparisonLabel}>Hazy + YOLO Detections</Text>
              <View style={styles.comparisonPlaceholder}>
                {hazyImage ? (
                  <Image source={{ uri: hazyImage }} style={styles.comparisonImage} />
                ) : (
                  <Text style={styles.placeholderText}>Hazy with detections</Text>
                )}
              </View>
            </View>

            <View style={styles.comparisonPanel}>
              <Text style={styles.comparisonLabel}>Dehazed + YOLO Detections</Text>
              <View style={styles.comparisonPlaceholder}>
                {dehazedImage ? (
                  <Image source={{ uri: dehazedImage }} style={styles.comparisonImage} />
                ) : (
                  <Text style={styles.placeholderText}>Dehazed with detections</Text>
                )}
              </View>
            </View>
          </View>

          {/* Refresh Button (original) */}
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={handleRefresh}
          >
            <Text style={styles.refreshButtonText}>🔄 Run New Evaluation</Text>
          </TouchableOpacity>
        </>
      )}
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
