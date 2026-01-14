import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useAppContext } from './_layout';



// LOGIN COMPONENT - Exact copy from your original code (unchanged logic)
function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [showMfa, setShowMfa] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }
    setIsLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      setShowMfa(true);
      setIsLoading(false);
    }, 1000);
  };

  const handleMfaSubmit = () => {
    if (!mfaCode || mfaCode.length !== 6) {
      Alert.alert('Error', 'Please enter 6-digit MFA code');
      return;
    }
    setIsLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      onLogin({ 
        email, 
        name: email.split('@')[0],
        id: Date.now() 
      });
      setIsLoading(false);
    }, 1000);
  };

  return (
    <ScrollView contentContainerStyle={styles.loginContainer}>
      <View style={styles.loginCard}>
        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>☁️</Text>
          </View>
          <Text style={styles.loginTitle}>AI Dehazing System</Text>
          <Text style={styles.loginSubtitle}>Real-Time Video Clarity Enhancement</Text>
        </View>

        {!showMfa ? (
          <View style={styles.formContainer}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="Enter your email"
                placeholderTextColor="#93c5fd"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password"
                placeholderTextColor="#93c5fd"
                secureTextEntry
              />
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, isLoading && styles.disabledButton]}
              onPress={handleLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>Login</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.formContainer}>
            <Text style={styles.mfaText}>
              Enter the 6-digit MFA code sent to your email
            </Text>

            <TextInput
              style={[styles.input, styles.mfaInput]}
              value={mfaCode}
              onChangeText={(text) => setMfaCode(text.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              placeholderTextColor="#93c5fd"
              keyboardType="number-pad"
              maxLength={6}
            />

            <TouchableOpacity
              style={[styles.primaryButton, isLoading && styles.disabledButton]}
              onPress={handleMfaSubmit}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>Verify & Continue</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => setShowMfa(false)}
            >
              <Text style={styles.secondaryButtonText}>Back to Login</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

// DASHBOARD COMPONENT - Updated for Expo Router navigation
function DashboardScreen({ user, isConnected, onLogout }) {
  const router = useRouter();
  const { wsService } = useAppContext();

  const [stats, setStats] = useState({
    totalProcessed: 0,
    avgFps: 0,
    cloudUptime: 0,
    detectionAccuracy: 0,
  });

  useEffect(() => {
    // Listen for stats updates from backend
    const handleStatsUpdate = (data) => {
      setStats(data);
    };
    wsService.on('stats_update', handleStatsUpdate);

    // Request initial stats
    wsService.send({
      type: 'get_stats',
      userId: user?.id
    });

    // Simulate stats for demo (remove when backend ready)
    setStats({
      totalProcessed: 1247,
      avgFps: 28.5,
      cloudUptime: 98.7,
      detectionAccuracy: 94.2,
    });

    return () => {
      wsService.off('stats_update', handleStatsUpdate);
    };
  }, [user, wsService]);

  const menuItems = [
    { id: 'capture', icon: '📹', label: 'Video Capture', color: '#3b82f6' },
    { id: 'processing', icon: '⚡', label: 'Live Processing', color: '#10b981' },
    { id: 'evaluation', icon: '👁️', label: 'Evaluation', color: '#8b5cf6' },
  ];

  const handleMenuPress = (id) => {
    router.push(`/${id}`);  // Expo Router navigation - fixes the crash
  };

  return (
    <ScrollView style={styles.dashboardContainer}>
      <View style={styles.dashboardHeader}>
        <View>
          <Text style={styles.dashboardTitle}>Dashboard</Text>
          <Text style={styles.dashboardSubtitle}>Welcome back, {user?.name}</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={[styles.connectionBadge, isConnected ? styles.connected : styles.disconnected]}>
            <View style={styles.connectionDot} />
            <Text style={styles.connectionText}>
              {isConnected ? 'Connected' : 'Offline'}
            </Text>
          </View>
          <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
            <Text style={styles.logoutText}>🚪 Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.statsGrid}>
        <View style={[styles.statCard, { borderLeftColor: '#3b82f6' }]}>
          <View style={styles.statHeader}>
            <Text style={styles.statTitle}>Total Frames</Text>
            <Text style={styles.statIcon}>🎬</Text>
          </View>
          <Text style={styles.statValue}>{stats.totalProcessed}</Text>
        </View>
        <View style={[styles.statCard, { borderLeftColor: '#10b981' }]}>
          <View style={styles.statHeader}>
            <Text style={styles.statTitle}>Avg FPS</Text>
            <Text style={styles.statIcon}>⚡</Text>
          </View>
          <Text style={styles.statValue}>{stats.avgFps}</Text>
        </View>
        <View style={[styles.statCard, { borderLeftColor: '#8b5cf6' }]}>
          <View style={styles.statHeader}>
            <Text style={styles.statTitle}>Cloud Uptime</Text>
            <Text style={styles.statIcon}>☁️</Text>
          </View>
          <Text style={styles.statValue}>{stats.cloudUptime}%</Text>
        </View>
        <View style={[styles.statCard, { borderLeftColor: '#f59e0b' }]}>
          <View style={styles.statHeader}>
            <Text style={styles.statTitle}>Detection Accuracy</Text>
            <Text style={styles.statIcon}>🎯</Text>
          </View>
          <Text style={styles.statValue}>{stats.detectionAccuracy}%</Text>
        </View>
      </View>

      <View style={styles.menuGrid}>
        {menuItems.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[styles.menuCard, { borderColor: item.color }]}
            onPress={() => handleMenuPress(item.id)}
          >
            <Text style={styles.menuIcon}>{item.icon}</Text>
            <Text style={styles.menuLabel}>{item.label}</Text>
            <Text style={styles.menuSubtext}>Tap to access</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

// MAIN INDEX COMPONENT - Shows Login or Dashboard based on user state
export default function Index() {
  const { user, setUser, isConnected } = useAppContext();
  const [currentScreen, setCurrentScreen] = useState(user ? 'dashboard' : 'login');
  const router = useRouter();

  const handleLogin = (userData) => {
    setUser(userData);
    setCurrentScreen('dashboard');
  };

  const handleLogout = () => {
    setUser(null);
    setCurrentScreen('login');
  };

  if (currentScreen === 'login') {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return <DashboardScreen user={user} isConnected={isConnected} onLogout={handleLogout} />;
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
