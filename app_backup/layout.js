   import { Stack } from 'expo-router';
   import React, { createContext, useContext, useState, useEffect } from 'react';
   import { SafeAreaProvider } from 'react-native-safe-area-context';
   import { StatusBar } from 'expo-status-bar';
   import { View, StyleSheet } from 'react-native';

   // WEBSOCKET SERVICE - Exact copy from your original code
   class WebSocketService {
     constructor() {
       this.ws = null;
       this.listeners = {};
       this.reconnectAttempts = 0;
       this.maxReconnectAttempts = 5;
     }

     connect(url) {
       try {
         this.ws = new WebSocket(url);
         
         this.ws.onopen = () => {
           console.log('✅ WebSocket connected');
           this.reconnectAttempts = 0;
           this.emit('connected');
         };

         this.ws.onmessage = (event) => {
           const data = JSON.parse(event.data);
           this.emit('message', data);
         };

         this.ws.onerror = (error) => {
           console.error('❌ WebSocket error:', error);
           this.emit('error', error);
         };

         this.ws.onclose = () => {
           console.log('🔌 WebSocket disconnected');
           this.emit('disconnected');
           this.reconnect(url);
         };
       } catch (error) {
         console.error('Failed to connect:', error);
       }
     }

     reconnect(url) {
       if (this.reconnectAttempts < this.maxReconnectAttempts) {
         this.reconnectAttempts++;
         console.log(`🔄 Reconnecting... Attempt ${this.reconnectAttempts}`);
         setTimeout(() => this.connect(url), 3000);
       }
     }

     send(data) {
       if (this.ws && this.ws.readyState === WebSocket.OPEN) {
         this.ws.send(JSON.stringify(data));
       } else {
         console.warn('⚠️ WebSocket not connected');
       }
     }

     on(event, callback) {
       if (!this.listeners[event]) {
         this.listeners[event] = [];
       }
       this.listeners[event].push(callback);
     }

     emit(event, data) {
       if (this.listeners[event]) {
         this.listeners[event].forEach(callback => callback(data));
       }
     }

     off(event, callback) {
       if (this.listeners[event]) {
         this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
       }
     }

     disconnect() {
       if (this.ws) {
         this.ws.close();
         this.ws = null;
       }
     }
   }

   const wsService = new WebSocketService();

   // APP CONTEXT - Shares user and connection state between screens
   const AppContext = createContext(undefined);

   // EXPORT THE HOOK - This is the key part that's missing or broken
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

     useEffect(() => {
       const BACKEND_URL = 'ws://echo.websocket.org'; // Test URL - change to your backend
       wsService.connect(BACKEND_URL);
       
       const handleConnected = () => {
         setIsConnected(true);
         console.log('Backend connected');
       };

       const handleDisconnected = () => {
         setIsConnected(false);
         console.log('Backend disconnected');
       };

       wsService.on('connected', handleConnected);
       wsService.on('disconnected', handleDisconnected);

       return () => {
         wsService.off('connected', handleConnected);
         wsService.off('disconnected', handleDisconnected);
         wsService.disconnect();
       };
     }, []);

     return (
       <AppContext.Provider value={{ user, setUser, isConnected, wsService }}>
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

   // ROOT LAYOUT - Sets up the screen stack
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
   
