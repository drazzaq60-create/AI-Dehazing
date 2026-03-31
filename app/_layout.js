import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { createContext, useContext, useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// 1. WEBSOCKET CONFIGURATION
const getWebSocketURL = () => {
    const PORT = 3000;
    if (Platform.OS === 'web') {
        return `ws://localhost:${PORT}`;
    } else {
        if (process.env.EXPO_PUBLIC_WS_URL) {
            return process.env.EXPO_PUBLIC_WS_URL;
        }
        const BACKEND_IP = '192.168.18.97';
        return `ws://${BACKEND_IP}:${PORT}`;
    }
};

const WS_URL = getWebSocketURL();
console.log('🔗 WebSocket URL configured:', WS_URL);

// 2. WEBSOCKET SERVICE CLASS
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
        if (this.ws && this.isConnected) return;
        try {
            this.ws = new WebSocket(WS_URL);
            this.ws.binaryType = 'arraybuffer';

            this.ws.onopen = () => {
                console.log('✅ Connected to backend');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.emit('connected', { url: WS_URL });
                this.flushMessageQueue();
            };

            this.ws.onmessage = (event) => {
                try {
                    if (event.data instanceof ArrayBuffer) {
                        this.emit('binaryMessage', event.data);
                        return;
                    }
                    const data = JSON.parse(event.data);
                    this.emit('message', data);
                } catch (error) {
                    console.error('❌ Error parsing message:', error);
                }
            };

            this.ws.onerror = (error) => {
                console.error('❌ WebSocket error:', error);
                this.emit('error', error);
            };

            this.ws.onclose = () => {
                console.log('🔌 WebSocket disconnected');
                this.isConnected = false;
                this.emit('disconnected');
                if (this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.reconnectAttempts++;
                    setTimeout(() => this.connect(), this.reconnectDelay);
                }
            };
        } catch (error) {
            console.error('❌ Failed to create WebSocket:', error);
        }
    }

    send(data) {
        if (this.ws && this.isConnected && this.ws.readyState === WebSocket.OPEN) {
            try {
                this.ws.send(JSON.stringify(data));
                return true;
            } catch (error) {
                return false;
            }
        } else {
            this.messageQueue.push(data);
            return false;
        }
    }

    flushMessageQueue() {
        while (this.messageQueue.length > 0 && this.isConnected) {
            const message = this.messageQueue.shift();
            this.send(message);
        }
    }

    on(event, callback) {
        if (!this.listeners.has(event)) this.listeners.set(event, []);
        this.listeners.get(event).push(callback);
    }

    off(event, callback) {
        if (this.listeners.has(event)) {
            const callbacks = this.listeners.get(event);
            const index = callbacks.indexOf(callback);
            if (index > -1) callbacks.splice(index, 1);
        }
    }

    emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => callback(data));
        }
    }
}

const wsService = new WebSocketService();
export { WS_URL, wsService };

// 3. APP CONTEXT
const AppContext = createContext(undefined);

export function useAppContext() {
    const context = useContext(AppContext);
    if (!context) throw new Error('useAppContext must be used inside AppProvider');
    return context;
}

function AppProvider({ children }) {
    const [user, setUser] = useState(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        wsService.connect();
        const handleConnected = () => setIsConnected(true);
        const handleDisconnected = () => setIsConnected(false);
        wsService.on('connected', handleConnected);
        wsService.on('disconnected', handleDisconnected);
        return () => {
            wsService.off('connected', handleConnected);
            wsService.off('disconnected', handleDisconnected);
        };
    }, []);

    return (
        <AppContext.Provider value={{ user, setUser, isConnected, wsService }}>
            <SafeAreaProvider>
                <StatusBar style="light" backgroundColor="#0f172a" />
                <View style={styles.container}>{children}</View>
            </SafeAreaProvider>
        </AppContext.Provider>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a' },
});

// 4. ROOT LAYOUT stack definition
export default function RootLayout() {
    return (
        <AppProvider>
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0f172a' } }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="capture" />
                <Stack.Screen name="processing" />
                <Stack.Screen name="evaluation" />
            </Stack>
        </AppProvider>
    );
}
