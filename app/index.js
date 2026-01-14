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
import * as authService from './services/authservice.js';

// SIGNUP COMPONENT
function SignupScreen({ onBack, onSignupSuccess }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [isLoading, setIsLoading] = useState(false);

  // Validation functions
  const validateName = (name) => {
    // Name should contain only letters, spaces, hyphens, and apostrophes
    const nameRegex = /^[A-Za-z\s\-'.]+$/;

    if (!name.trim()) {
      return 'Name is required';
    }

    if (!nameRegex.test(name)) {
      return 'Name should contain only letters, spaces, hyphens, and apostrophes';
    }

    if (name.length < 2) {
      return 'Name should be at least 2 characters long';
    }

    if (name.length > 50) {
      return 'Name should not exceed 50 characters';
    }

    return null; // No error
  };

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      return 'Email is required';
    }
    if (!emailRegex.test(email)) {
      return 'Please enter a valid email address';
    }
    return null;
  };

  const validatePassword = (password) => {
    if (!password) {
      return 'Password is required';
    }
    if (password.length < 8) {
      return 'Password must be at least 8 characters long';
    }
    return null;
  };

  const handleSignup = async () => {
    const { name, email, password, confirmPassword } = formData;

    // Validate all fields
    const nameError = validateName(name);
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);

    if (nameError) {
      Alert.alert('Error', nameError);
      return;
    }

    if (emailError) {
      Alert.alert('Error', emailError);
      return;
    }

    if (passwordError) {
      Alert.alert('Error', passwordError);
      return;
    }

    if (!confirmPassword) {
      Alert.alert('Error', 'Please confirm your password');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      const result = await authService.signup(name, email, password);
      setIsLoading(false);

      if (result.success) {
        Alert.alert(
          'Success',
          'Account created! Check your email for welcome message.',
          [{ text: 'OK', onPress: onSignupSuccess }]
        );
      } else {
        Alert.alert('Error', result.message);
      }
    } catch (error) {
      setIsLoading(false);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.loginContainer}>
      <View style={styles.loginCard}>
        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>☁️</Text>
          </View>
          <Text style={styles.loginTitle}>Create Account</Text>
          <Text style={styles.loginSubtitle}>Join AI Dehazing System</Text>
        </View>

        <View style={styles.formContainer}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={[
                styles.input,
                formData.name && validateName(formData.name) && styles.inputError
              ]}
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
              placeholder="Enter your full name"
              placeholderTextColor="#93c5fd"
              autoCapitalize="words"
            />
            {formData.name && validateName(formData.name) && (
              <Text style={styles.errorText}>{validateName(formData.name)}</Text>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={[
                styles.input,
                formData.email && validateEmail(formData.email) && styles.inputError
              ]}
              value={formData.email}
              onChangeText={(text) => setFormData({ ...formData, email: text })}
              placeholder="Enter your email"
              placeholderTextColor="#93c5fd"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            {formData.email && validateEmail(formData.email) && (
              <Text style={styles.errorText}>{validateEmail(formData.email)}</Text>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={[
                styles.input,
                formData.password && validatePassword(formData.password) && styles.inputError
              ]}
              value={formData.password}
              onChangeText={(text) => setFormData({ ...formData, password: text })}
              placeholder="Enter password (min 8 characters)"
              placeholderTextColor="#93c5fd"
              secureTextEntry
            />
            {formData.password && validatePassword(formData.password) && (
              <Text style={styles.errorText}>{validatePassword(formData.password)}</Text>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Confirm Password</Text>
            <TextInput
              style={[
                styles.input,
                formData.confirmPassword &&
                formData.password !== formData.confirmPassword &&
                styles.inputError
              ]}
              value={formData.confirmPassword}
              onChangeText={(text) => setFormData({ ...formData, confirmPassword: text })}
              placeholder="Confirm your password"
              placeholderTextColor="#93c5fd"
              secureTextEntry
            />
            {formData.confirmPassword &&
              formData.password !== formData.confirmPassword && (
                <Text style={styles.errorText}>Passwords do not match</Text>
              )}
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, isLoading && styles.disabledButton]}
            onPress={handleSignup}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>Create Account</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={onBack}
          >
            <Text style={styles.secondaryButtonText}>Already have an account? Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

// FORGOT PASSWORD COMPONENT
function ForgotPasswordScreen({ onBack }) {
  const [email, setEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [step, setStep] = useState(1); // 1: email, 2: code, 3: new password
  const [isLoading, setIsLoading] = useState(false);

  const handleSendCode = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }
    setIsLoading(true);

    const result = await authService.forgotPassword(email);
    setIsLoading(false);

    if (result.success) {
      setStep(2);
      Alert.alert('Success', 'Reset code sent to your email!');
    } else {
      Alert.alert('Error', result.message);
    }
  };

  const handleVerifyCode = async () => {
    if (!resetCode || resetCode.length !== 6) {
      Alert.alert('Error', 'Please enter the 6-digit code');
      return;
    }
    setIsLoading(true);

    const result = await authService.verifyResetCode(email, resetCode);
    setIsLoading(false);

    if (result.success) {
      setStep(3);
    } else {
      Alert.alert('Error', result.message);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters long');
      return;
    }
    setIsLoading(true);

    const result = await authService.resetPassword(email, resetCode, newPassword);
    setIsLoading(false);

    if (result.success) {
      Alert.alert(
        'Success',
        'Password reset successfully! Please login with your new password.',
        [{ text: 'OK', onPress: onBack }]
      );
    } else {
      Alert.alert('Error', result.message);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.loginContainer}>
      <View style={styles.loginCard}>
        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>🔐</Text>
          </View>
          <Text style={styles.loginTitle}>Reset Password</Text>
          <Text style={styles.loginSubtitle}>
            {step === 1 && 'Enter your email to receive reset code'}
            {step === 2 && 'Enter the code sent to your email'}
            {step === 3 && 'Create a new password'}
          </Text>
        </View>

        <View style={styles.formContainer}>
          {step === 1 && (
            <>
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

              <TouchableOpacity
                style={[styles.primaryButton, isLoading && styles.disabledButton]}
                onPress={handleSendCode}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>Send Reset Code</Text>
                )}
              </TouchableOpacity>
            </>
          )}

          {step === 2 && (
            <>
              <Text style={styles.mfaText}>
                Enter the 6-digit code sent to {email}
              </Text>

              <TextInput
                style={[styles.input, styles.mfaInput]}
                value={resetCode}
                onChangeText={(text) => setResetCode(text.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                placeholderTextColor="#93c5fd"
                keyboardType="number-pad"
                maxLength={6}
              />

              <TouchableOpacity
                style={[styles.primaryButton, isLoading && styles.disabledButton]}
                onPress={handleVerifyCode}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>Verify Code</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={handleSendCode}
              >
                <Text style={styles.secondaryButtonText}>Resend Code</Text>
              </TouchableOpacity>
            </>
          )}

          {step === 3 && (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>New Password</Text>
                <TextInput
                  style={styles.input}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Enter new password (min 8 characters)"
                  placeholderTextColor="#93c5fd"
                  secureTextEntry
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Confirm Password</Text>
                <TextInput
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Confirm new password"
                  placeholderTextColor="#93c5fd"
                  secureTextEntry
                />
              </View>

              <TouchableOpacity
                style={[styles.primaryButton, isLoading && styles.disabledButton]}
                onPress={handleResetPassword}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>Reset Password</Text>
                )}
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={onBack}
          >
            <Text style={styles.secondaryButtonText}>Back to Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

// LOGIN COMPONENT
function LoginScreen({ onLogin, onNavigateToSignup, onNavigateToForgotPassword }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [showMfa, setShowMfa] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [emailForMfa, setEmailForMfa] = useState('');

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }
    setIsLoading(true);

    const result = await authService.login(email, password);
    setIsLoading(false);

    if (result.success) {
      setEmailForMfa(email); // Store email for MFA step
      setShowMfa(true);
      Alert.alert('Success', 'MFA code sent to your email!');
    } else {
      Alert.alert('Error', result.message);
    }
  };

  const handleMfaSubmit = async () => {
    if (!mfaCode || mfaCode.length !== 6) {
      Alert.alert('Error', 'Please enter 6-digit MFA code');
      return;
    }
    setIsLoading(true);

    const result = await authService.verifyMfa(emailForMfa, mfaCode);
    setIsLoading(false);

    if (result.success) {
      onLogin(result.user);
    } else {
      Alert.alert('Error', result.message);
    }
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
              <View style={styles.labelRow}>
                <Text style={styles.label}>Password</Text>
                <TouchableOpacity onPress={onNavigateToForgotPassword}>
                  <Text style={styles.forgotPasswordLink}>Forgot Password?</Text>
                </TouchableOpacity>
              </View>
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

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              style={styles.signupButton}
              onPress={onNavigateToSignup}
            >
              <Text style={styles.signupButtonText}>Create New Account</Text>
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

// DASHBOARD COMPONENT
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
    router.push(`/${id}`);
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

// MAIN INDEX COMPONENT
export default function Index() {
  const { user, setUser, isConnected } = useAppContext();
  const [currentScreen, setCurrentScreen] = useState(user ? 'dashboard' : 'login');
  const router = useRouter();

  const handleLogin = (userData) => {
    setUser(userData);
    setCurrentScreen('dashboard');
  };

  const handleLogout = async () => {
    await authService.logout();
    setUser(null);
    setCurrentScreen('login');
  };

  const handleNavigateToSignup = () => {
    setCurrentScreen('signup');
  };

  const handleNavigateToForgotPassword = () => {
    setCurrentScreen('forgotPassword');
  };

  const handleBackToLogin = () => {
    setCurrentScreen('login');
  };

  if (currentScreen === 'signup') {
    return (
      <SignupScreen
        onBack={handleBackToLogin}
        onSignupSuccess={handleBackToLogin}
      />
    );
  }

  if (currentScreen === 'forgotPassword') {
    return <ForgotPasswordScreen onBack={handleBackToLogin} />;
  }

  if (currentScreen === 'login') {
    return (
      <LoginScreen
        onLogin={handleLogin}
        onNavigateToSignup={handleNavigateToSignup}
        onNavigateToForgotPassword={handleNavigateToForgotPassword}
      />
    );
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
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#bfdbfe',
  },
  forgotPasswordLink: {
    fontSize: 12,
    color: '#60a5fa',
    fontWeight: '600',
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
  inputError: {
    borderColor: '#ef4444',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    marginLeft: 4,
  },
  primaryButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  disabledButton: {
    backgroundColor: '#9ca3af',
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    padding: 16,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#3b82f6',
    fontSize: 16,
    fontWeight: '600',
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
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  dividerText: {
    color: '#93c5fd',
    paddingHorizontal: 15,
    fontSize: 12,
  },
  signupButton: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    borderWidth: 1,
    borderColor: '#22c55e',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  signupButtonText: {
    color: '#86efac',
    fontSize: 16,
    fontWeight: '600',
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
});
