//    import { Stack } from 'expo-router';
// import { StatusBar } from 'expo-status-bar';
// import { createContext, useContext, useEffect, useState } from 'react';
// import { StyleSheet, View } from 'react-native';
// import { SafeAreaProvider } from 'react-native-safe-area-context';

//    // WEBSOCKET SERVICE - Exact copy from your original code
//    class WebSocketService {
//      constructor() {
//        this.ws = null;
//        this.listeners = {};
//        this.reconnectAttempts = 0;
//        this.maxReconnectAttempts = 5;
//      }

//      connect(url) {
//        try {
//          this.ws = new WebSocket(url);

//          this.ws.onopen = () => {
//            console.log('✅ WebSocket connected');
//            this.reconnectAttempts = 0;
//            this.emit('connected');
//          };

//          this.ws.onmessage = (event) => {
//            const data = JSON.parse(event.data);
//            this.emit('message', data);
//          };

//          this.ws.onerror = (error) => {
//            console.error('❌ WebSocket error:', error);
//            this.emit('error', error);
//          };

//          this.ws.onclose = () => {
//            console.log('🔌 WebSocket disconnected');
//            this.emit('disconnected');
//            this.reconnect(url);
//          };
//        } catch (error) {
//          console.error('Failed to connect:', error);
//        }
//      }

//      reconnect(url) {
//        if (this.reconnectAttempts < this.maxReconnectAttempts) {
//          this.reconnectAttempts++;
//          console.log(`🔄 Reconnecting... Attempt ${this.reconnectAttempts}`);
//          setTimeout(() => this.connect(url), 3000);
//        }
//      }

//      send(data) {
//        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
//          this.ws.send(JSON.stringify(data));
//        } else {
//          console.warn('⚠️ WebSocket not connected');
//        }
//      }

//      on(event, callback) {
//        if (!this.listeners[event]) {
//          this.listeners[event] = [];
//        }
//        this.listeners[event].push(callback);
//      }

//      emit(event, data) {
//        if (this.listeners[event]) {
//          this.listeners[event].forEach(callback => callback(data));
//        }
//      }

//      off(event, callback) {
//        if (this.listeners[event]) {
//          this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
//        }
//      }

//      disconnect() {
//        if (this.ws) {
//          this.ws.close();
//          this.ws = null;
//        }
//      }
//    }

//    const wsService = new WebSocketService();

//    // APP CONTEXT - Shares user and connection state between screens
//    const AppContext = createContext(undefined);

//    // EXPORT THE HOOK - This is the key part that's missing or broken
//    export function useAppContext() {
//      const context = useContext(AppContext);
//      if (!context) {
//        throw new Error('useAppContext must be used inside AppProvider');
//      }
//      return context;
//    }

//    function AppProvider({ children }) {
//      const [user, setUser] = useState(null);
//      const [isConnected, setIsConnected] = useState(false);

//      useEffect(() => {
//        const BACKEND_URL = 'ws://localhost:8080'; // Test URL - change to your backend
//        wsService.connect(BACKEND_URL);

//        const handleConnected = () => {
//          setIsConnected(true);
//          console.log('Backend connected');
//        };

//        const handleDisconnected = () => {
//          setIsConnected(false);
//          console.log('Backend disconnected');
//        };

//        wsService.on('connected', handleConnected);
//        wsService.on('disconnected', handleDisconnected);

//        return () => {
//          wsService.off('connected', handleConnected);
//          wsService.off('disconnected', handleDisconnected);
//          wsService.disconnect();
//        };
//      }, []);

//      return (
//        <AppContext.Provider value={{ user, setUser, isConnected, wsService }}>
//          <SafeAreaProvider>
//            <StatusBar style="light" backgroundColor="#0f172a" />
//            <View style={styles.container}>
//              {children}
//            </View>
//          </SafeAreaProvider>
//        </AppContext.Provider>
//      );
//    }

//    const styles = StyleSheet.create({
//      container: {
//        flex: 1,
//        backgroundColor: '#0f172a',
//      },
//    });

//    // ROOT LAYOUT - Sets up the screen stack
//    export default function RootLayout() {
//      return (
//        <AppProvider>
//          <Stack 
//            screenOptions={{ 
//              headerShown: false, 
//              contentStyle: { backgroundColor: '#0f172a' } 
//            }}
//          >
//            <Stack.Screen name="index" />
//            <Stack.Screen name="capture" />
//            <Stack.Screen name="processing" />
//            <Stack.Screen name="evaluation" />
//          </Stack>
//        </AppProvider>
//      );
//    }


// import { Stack } from 'expo-router';
// import { StatusBar } from 'expo-status-bar';
// import { createContext, useContext, useEffect, useState } from 'react';
// import { StyleSheet, View } from 'react-native';
// import { SafeAreaProvider } from 'react-native-safe-area-context';



// // WEBSOCKET SERVICE - Exact copy from your original code
// class WebSocketService {
//   constructor() {
//     this.ws = null;
//     this.listeners = {};
//     this.reconnectAttempts = 0;
//     this.maxReconnectAttempts = 5;
//     this.isConnected = false; // ✅ ADDED: Track connection state
//     this.url = null; // ✅ ADDED: Track connection URL
//   }

//   connect(url) {
//     try {
//       this.url = url; // ✅ Store the URL
//       this.ws = new WebSocket(url);

//       this.ws.onopen = () => {
//         console.log('✅ WebSocket connected to:', url);
//         this.isConnected = true; // ✅ Set connected state
//         this.reconnectAttempts = 0;
//         this.emit('connected');
//       };

//       this.ws.onmessage = (event) => {
//         const data = JSON.parse(event.data);
//         this.emit('message', data);
//       };

//       this.ws.onerror = (error) => {
//         console.error('❌ WebSocket error:', error);
//         this.emit('error', error);
//       };

//       this.ws.onclose = () => {
//         console.log('🔌 WebSocket disconnected from:', url);
//         this.isConnected = false; // ✅ Set disconnected state
//         this.emit('disconnected');
//         this.reconnect(url);
//       };
//     } catch (error) {
//       console.error('Failed to connect:', error);
//       this.isConnected = false;
//     }
//   }

//   reconnect(url) {
//     if (this.reconnectAttempts < this.maxReconnectAttempts) {
//       this.reconnectAttempts++;
//       console.log(`🔄 Reconnecting... Attempt ${this.reconnectAttempts}`);
//       setTimeout(() => this.connect(url), 3000);
//     } else {
//       console.log('❌ Max reconnection attempts reached');
//     }
//   }

//   send(data) {
//     if (this.ws && this.ws.readyState === WebSocket.OPEN) {
//       this.ws.send(JSON.stringify(data));
//       return true;
//     } else {
//       console.warn('⚠️ WebSocket not connected, cannot send data');
//       return false;
//     }
//   }

//   on(event, callback) {
//     if (!this.listeners[event]) {
//       this.listeners[event] = [];
//     }
//     this.listeners[event].push(callback);
//   }

//   emit(event, data) {
//     if (this.listeners[event]) {
//       this.listeners[event].forEach(callback => callback(data));
//     }
//   }

//   off(event, callback) {
//     if (this.listeners[event]) {
//       this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
//     }
//   }

//   disconnect() {
//     if (this.ws) {
//       this.ws.close();
//       this.ws = null;
//       this.isConnected = false;
//     }
//   }
// }

// const wsService = new WebSocketService();

// // APP CONTEXT - Shares user and connection state between screens
// const AppContext = createContext(undefined);

// // EXPORT THE HOOK - This is the key part that's missing or broken
// export function useAppContext() {
//   const context = useContext(AppContext);
//   if (!context) {
//     throw new Error('useAppContext must be used inside AppProvider');
//   }
//   return context;
// }

// function AppProvider({ children }) {
//   const [user, setUser] = useState(null);
//   const [isConnected, setIsConnected] = useState(false);
//   const [connectionStatus, setConnectionStatus] = useState('connecting');

//   useEffect(() => {

//     const BACKEND_URL = 'ws://localhost:8080';
//     console.log('🔗 Connecting to backend:', BACKEND_URL);

//     wsService.connect(BACKEND_URL);

//     const handleConnected = () => {
//       setIsConnected(true);
//       setConnectionStatus('connected');
//       console.log('✅ Backend connected successfully');
//     };

//     const handleDisconnected = () => {
//       setIsConnected(false);
//       setConnectionStatus('disconnected');
//       console.log('❌ Backend disconnected');
//     };

//     const handleError = (error) => {
//       console.error('❌ WebSocket connection error:', error);
//       setConnectionStatus('error');
//     };

//     wsService.on('connected', handleConnected);
//     wsService.on('disconnected', handleDisconnected);
//     wsService.on('error', handleError);

//     return () => {
//       wsService.off('connected', handleConnected);
//       wsService.off('disconnected', handleDisconnected);
//       wsService.off('error', handleError);
//       wsService.disconnect();
//     };
//   }, []);

//   // ✅ ADDED: Connection status display for debugging
//   const getConnectionStatus = () => {
//     return {
//       connected: '✅ Connected to Backend (Port 3000)',
//       disconnected: '❌ Backend Disconnected',
//       connecting: '🔄 Connecting to Backend...',
//       error: '❌ Connection Error'
//     }[connectionStatus] || 'Unknown status';
//   };

//   return (
//     <AppContext.Provider value={{ 
//       user, 
//       setUser, 
//       isConnected, 
//       wsService,
//       connectionStatus: getConnectionStatus() // ✅ ADDED: Easy status access
//     }}>
//       <SafeAreaProvider>
//         <StatusBar style="light" backgroundColor="#0f172a" />
//         <View style={styles.container}>
//           {children}
//         </View>
//       </SafeAreaProvider>
//     </AppContext.Provider>
//   );
// }

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: '#0f172a',
//   },
// });

// // ROOT LAYOUT - Sets up the screen stack
// export default function RootLayout() {
//   return (
//     <AppProvider>
//       <Stack 
//         screenOptions={{ 
//           headerShown: false, 
//           contentStyle: { backgroundColor: '#0f172a' } 
//         }}
//       >
//         <Stack.Screen name="index" />
//         <Stack.Screen name="capture" />
//         <Stack.Screen name="processing" />
//         <Stack.Screen name="evaluation" />
//       </Stack>
//     </AppProvider>
//   );
// }


import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { createContext, useContext, useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// ============================================
// 1. WEBSOCKET CONFIGURATION (Using Port 3000)
// ============================================
// --- UPDATED getWebSocketURL FUNCTION ---
const getWebSocketURL = () => {
    // const PORT = 3000;
    const PORT = 3000;
    if (Platform.OS === 'web') {
        // Web runs on the same machine, so localhost works
        return `ws://localhost:${PORT}`;
    } else if (Platform.OS === 'android' || Platform.OS === 'ios') {
        // For mobile: Use your computer's IP address
        if (process.env.EXPO_PUBLIC_WS_URL) {
            return process.env.EXPO_PUBLIC_WS_URL;
        }
        const BACKEND_IP = '192.168.18.84'; // Your computer's IP address
        return `ws://${BACKEND_IP}:${3000}`;
    }

    return `ws://localhost:${PORT}`;
};
// ----------------------------------------

const WS_URL = getWebSocketURL();

console.log('🔗 WebSocket URL configured:', WS_URL);

// ============================================
// 2. WEBSOCKET SERVICE CLASS (Robust version)
// ============================================
class WebSocketService {
    constructor() {
        this.ws = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 3000;
        this.listeners = new Map();
        this.messageQueue = [];
    }

    connect() {
        if (this.ws && this.isConnected) {
            console.log('⚠️ Already connected');
            return;
        }

        console.log('🔗 Connecting to backend:', WS_URL);

        try {
            this.ws = new WebSocket(WS_URL);
            this.ws.binaryType = 'arraybuffer'; // Enable binary handling

            this.ws.onopen = () => {
                console.log('✅ Connected to backend');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.emit('connected', { url: WS_URL });
                this.flushMessageQueue();
            };

            this.ws.onmessage = (event) => {
                try {
                    // Handle binary messages (frames from server)
                    if (event.data instanceof ArrayBuffer) {
                        this.emit('binaryMessage', event.data);
                        return;
                    }
                    // Handle JSON messages
                    const data = JSON.parse(event.data);
                    console.log('📨 Received:', data.type);
                    this.emit('message', data);
                } catch (error) {
                    console.error('❌ Error parsing message:', error);
                }
            };

            this.ws.onerror = (error) => {
                console.error('❌ WebSocket error:', error);
                this.emit('error', error);
            };

            this.ws.onclose = (event) => {
                console.log('🔌 WebSocket disconnected');
                this.isConnected = false;
                this.emit('disconnected');

                if (this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.reconnectAttempts++;
                    console.log(`🔄 Reconnecting... Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
                    setTimeout(() => this.connect(), this.reconnectDelay);
                } else {
                    console.log('❌ Max reconnection attempts reached');
                    this.emit('maxReconnectReached');
                }
            };
        } catch (error) {
            console.error('❌ Failed to create WebSocket:', error);
            this.emit('error', error);
        }
    }

    send(data) {
        if (this.ws && this.isConnected && this.ws.readyState === WebSocket.OPEN) {
            try {
                const message = JSON.stringify(data);
                this.ws.send(message);
                console.log('📤 Sent:', data.type);
                return true;
            } catch (error) {
                console.error('❌ Error sending data:', error);
                return false;
            }
        } else {
            console.warn('⚠️ WebSocket not connected, queueing message:', data.type);
            this.messageQueue.push(data);
            return false;
        }
    }

    // NEW: Send binary data (ArrayBuffer) for faster frame transfer
    sendBinary(arrayBuffer, metadata) {
        if (this.ws && this.isConnected && this.ws.readyState === WebSocket.OPEN) {
            try {
                // Send metadata first as JSON
                if (metadata) {
                    this.ws.send(JSON.stringify(metadata));
                }
                // Then send binary frame
                this.ws.send(arrayBuffer);
                return true;
            } catch (error) {
                console.error('❌ Error sending binary:', error);
                return false;
            }
        }
        return false;
    }

    flushMessageQueue() {
        while (this.messageQueue.length > 0 && this.isConnected) {
            const message = this.messageQueue.shift();
            this.send(message);
        }
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
        }
        this.isConnected = false;
        this.messageQueue = [];
        this.reconnectAttempts = 0;
    }

    reset() {
        this.disconnect();
        this.connect();
    }

    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    off(event, callback) {
        if (this.listeners.has(event)) {
            const callbacks = this.listeners.get(event);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`❌ Error in ${event} listener:`, error);
                }
            });
        }
    }

    getStatus() {
        return {
            connected: this.isConnected,
            url: WS_URL,
            reconnectAttempts: this.reconnectAttempts,
            queueLength: this.messageQueue.length
        };
    }
}

// Create singleton instance
const wsService = new WebSocketService();

// Export for use throughout your app
export { WS_URL, wsService };

// ============================================
// 3. APP CONTEXT & PROVIDER
// ============================================
const AppContext = createContext(undefined);

export function useAppContext() {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error('useAppContext must be used inside AppProvider');
    }
    return context;
}

function AppProvider({ children }) {
    const [user, setUser] = useState(null);
    const [isConnected, setIsConnected] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState('connecting');

    useEffect(() => {
        wsService.connect();

        const handleConnected = () => {
            setIsConnected(true);
            setConnectionStatus('connected');
            console.log('✅ Backend connected successfully');
        };

        const handleDisconnected = () => {
            setIsConnected(false);
            setConnectionStatus('disconnected');
            console.log('❌ Backend disconnected');
        };

        const handleError = (error) => {
            console.error('❌ WebSocket connection error:', error);
            setConnectionStatus('error');
        };

        const handleMaxReconnect = () => {
            setConnectionStatus('error');
            console.log('🛑 Max reconnect attempts reached.');
        };

        wsService.on('connected', handleConnected);
        wsService.on('disconnected', handleDisconnected);
        wsService.on('error', handleError);
        wsService.on('maxReconnectReached', handleMaxReconnect);

        return () => {
            wsService.off('connected', handleConnected);
            wsService.off('disconnected', handleDisconnected);
            wsService.off('error', handleError);
            wsService.off('maxReconnectReached', handleMaxReconnect);
        };
    }, []);

    const getConnectionStatusText = () => {
        return {
            connected: `✅ Connected to Backend (${WS_URL.split('://')[1]})`,
            disconnected: '❌ Backend Disconnected',
            connecting: '🔄 Connecting to Backend...',
            error: '❌ Connection Error (Check Backend Status)'
        }[connectionStatus] || 'Unknown status';
    };

    return (
        <AppContext.Provider value={{
            user,
            setUser,
            isConnected,
            wsService,
            connectionStatus: getConnectionStatusText()
        }}>
            <SafeAreaProvider>
                <StatusBar style="light" backgroundColor="#0f172a" />
                <View style={styles.container}>
                    {children}
                </View>
            </SafeAreaProvider>
        </AppContext.Provider>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f172a',
    },
});

// ============================================
// 4. ROOT LAYOUT COMPONENT
// ============================================
export default function RootLayout() {
    return (
        <AppProvider>
            <Stack
                screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: '#0f172a' }
                }}
            >
                <Stack.Screen name="index" />
                <Stack.Screen name="capture" />
                <Stack.Screen name="processing" />
                <Stack.Screen name="evaluation" />
            </Stack>
        </AppProvider>
    );
}

