import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// API URL configuration - Use localhost for web, IP for mobile devices
// IMPORTANT: For iOS/Android, use your computer's local IP address
// You can set this in a .env file as EXPO_PUBLIC_API_URL=http://YOUR_IP:3000
const API_URL = process.env.EXPO_PUBLIC_API_URL || Platform.select({
  ios: 'http://192.168.18.84:3000',      // Change this to your Mac's IP
  android: 'http://192.168.18.84:3000',  // Change this to your Mac's IP
  web: 'http://localhost:3000',
  default: 'http://192.168.18.21:3000'
});

console.log('🔗 API URL configured:', API_URL);

// Signup (calls /api/auth/register)
const signup = async (name, email, password) => {
  try {
    console.log('📝 Signup attempt:', email);
    const response = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });

    let data;
    try {
      data = await response.json();
    } catch (jsonError) {
      console.error('❌ Failed to parse JSON response:', jsonError);
      return { success: false, message: 'Server returned invalid response. Please try again.' };
    }

    console.log('📝 Signup response:', data);

    if (!response.ok) {
      throw new Error(data.message || 'Signup failed');
    }

    // Store token and user if provided
    if (data.token && data.user) {
      await AsyncStorage.setItem('@auth_token', data.token);
      await AsyncStorage.setItem('@user_data', JSON.stringify(data.user));
    }

    return { success: true, message: data.message, user: data.user, token: data.token };
  } catch (error) {
    console.error('❌ Signup error:', error);
    const errorMessage = error.message || 'Network error. Please check your connection and ensure the backend is running.';
    return { success: false, message: errorMessage };
  }
};

// Login Step 1: Send credentials (calls /api/auth/login)
const login = async (email, password) => {
  try {
    console.log('🔐 Login attempt:', email);
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    let data;
    try {
      data = await response.json();
    } catch (jsonError) {
      console.error('❌ Failed to parse JSON response:', jsonError);
      return { success: false, message: 'Server returned invalid response. Please try again.' };
    }

    console.log('🔐 Login response:', data);

    if (!response.ok) {
      throw new Error(data.message || 'Login failed');
    }

    return { success: true, message: data.message };
  } catch (error) {
    console.error('❌ Login error:', error);
    const errorMessage = error.message || 'Network error. Please check your connection and ensure the backend is running.';
    return { success: false, message: errorMessage };
  }
};

// Login Step 2: Verify MFA code (calls /api/auth/verify-mfa)
const verifyMfa = async (email, mfaCode) => {
  try {
    console.log('✅ MFA verification attempt:', email);
    const response = await fetch(`${API_URL}/api/auth/verify-mfa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, mfaCode }),
    });

    let data;
    try {
      data = await response.json();
    } catch (jsonError) {
      console.error('❌ Failed to parse JSON response:', jsonError);
      return { success: false, message: 'Server returned invalid response. Please try again.' };
    }

    console.log('✅ MFA verify response:', data);

    if (!response.ok) {
      throw new Error(data.message || 'MFA verification failed');
    }

    // Store token and user
    if (data.token && data.user) {
      await AsyncStorage.setItem('@auth_token', data.token);
      await AsyncStorage.setItem('@user_data', JSON.stringify(data.user));
    }

    return { success: true, user: data.user, token: data.token };
  } catch (error) {
    console.error('❌ MFA verify error:', error);
    const errorMessage = error.message || 'Network error. Please check your connection and ensure the backend is running.';
    return { success: false, message: errorMessage };
  }
};

// Forgot Password (calls /api/auth/forgot-password)
const forgotPassword = async (email) => {
  try {
    console.log('🔐 Forgot password request:', email);
    const response = await fetch(`${API_URL}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    let data;
    try {
      data = await response.json();
    } catch (jsonError) {
      console.error('❌ Failed to parse JSON response:', jsonError);
      return { success: false, message: 'Server returned invalid response. Please try again.' };
    }

    console.log('🔐 Forgot password response:', data);

    if (!response.ok) {
      throw new Error(data.message || 'Request failed');
    }

    return { success: true, message: data.message };
  } catch (error) {
    console.error('❌ Forgot password error:', error);
    const errorMessage = error.message || 'Network error. Please check your connection and ensure the backend is running.';
    return { success: false, message: errorMessage };
  }
};

// Verify Reset Code (calls /api/auth/verify-reset-code)
const verifyResetCode = async (email, resetCode) => {
  try {
    console.log('🔐 Verify reset code request:', email);
    const response = await fetch(`${API_URL}/api/auth/verify-reset-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, resetCode }),
    });

    let data;
    try {
      data = await response.json();
    } catch (jsonError) {
      console.error('❌ Failed to parse JSON response:', jsonError);
      return { success: false, message: 'Server returned invalid response. Please try again.' };
    }

    console.log('🔐 Verify reset code response:', data);

    if (!response.ok) {
      throw new Error(data.message || 'Verification failed');
    }

    return { success: true, message: data.message };
  } catch (error) {
    console.error('❌ Verify reset code error:', error);
    const errorMessage = error.message || 'Network error. Please check your connection and ensure the backend is running.';
    return { success: false, message: errorMessage };
  }
};

// Reset Password (calls /api/auth/reset-password)
const resetPassword = async (email, resetCode, newPassword) => {
  try {
    console.log('🔐 Reset password request:', email);
    const response = await fetch(`${API_URL}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, resetCode, newPassword }),
    });

    let data;
    try {
      data = await response.json();
    } catch (jsonError) {
      console.error('❌ Failed to parse JSON response:', jsonError);
      return { success: false, message: 'Server returned invalid response. Please try again.' };
    }

    console.log('🔐 Reset password response:', data);

    if (!response.ok) {
      throw new Error(data.message || 'Reset failed');
    }

    return { success: true, message: data.message };
  } catch (error) {
    console.error('❌ Reset password error:', error);
    const errorMessage = error.message || 'Network error. Please check your connection and ensure the backend is running.';
    return { success: false, message: errorMessage };
  }
};

// Logout
const logout = async () => {
  try {
    console.log('🚪 Logging out...');
    await AsyncStorage.multiRemove(['@auth_token', '@user_data']);
    console.log('✅ Logout successful');
    return { success: true };
  } catch (error) {
    console.error('❌ Logout error:', error);
    return { success: false, message: error.message };
  }
};

// Get stored user
const getStoredUser = async () => {
  try {
    const userData = await AsyncStorage.getItem('@user_data');
    return userData ? JSON.parse(userData) : null;
  } catch (error) {
    console.error('❌ Get stored user error:', error);
    return null;
  }
};

// Get auth token for API calls
const getAuthToken = async () => {
  try {
    return await AsyncStorage.getItem('@auth_token');
  } catch (error) {
    console.error('❌ Get auth token error:', error);
    return null;
  }
};

// Check if user is already logged in  
const checkAuthStatus = async () => {
  try {
    const token = await AsyncStorage.getItem('@auth_token');
    const userData = await AsyncStorage.getItem('@user_data');

    if (token && userData) {
      return {
        isLoggedIn: true,
        user: JSON.parse(userData),
        token: token
      };
    }
    return { isLoggedIn: false };
  } catch (error) {
    console.error('❌ Auth status check error:', error);
    return { isLoggedIn: false };
  }
};

// Export all functions as named exports to match frontend usage
export {
  API_URL, checkAuthStatus, forgotPassword, getAuthToken, getStoredUser, login, logout, resetPassword, signup, verifyMfa, verifyResetCode
};



