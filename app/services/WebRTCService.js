// import { Platform } from 'react-native';

// // Use actual WebRTC for web, polyfill for mobile
// let RTCPeerConnection, RTCSessionDescription, RTCIceCandidate;
// let MediaStream, MediaStreamTrack;

// if (Platform.OS === 'web') {
//   // Browser WebRTC
//   RTCPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || 
//                       window.webkitRTCPeerConnection || window.msRTCPeerConnection;
//   RTCSessionDescription = window.RTCSessionDescription || window.mozRTCSessionDescription;
//   RTCIceCandidate = window.RTCIceCandidate || window.mozRTCIceCandidate;
//   MediaStream = window.MediaStream || window.webkitMediaStream;
//   MediaStreamTrack = window.MediaStreamTrack || window.webkitMediaStreamTrack;
// } else {
//   // React Native WebRTC (install react-native-webrtc)
//   const WebRTC = require('react-native-webrtc');
//   RTCPeerConnection = WebRTC.RTCPeerConnection;
//   RTCSessionDescription = WebRTC.RTCSessionDescription;
//   RTCIceCandidate = WebRTC.RTCIceCandidate;
//   MediaStream = WebRTC.MediaStream;
//   MediaStreamTrack = WebRTC.MediaStreamTrack;
// }

// class WebRTCService {
//   constructor() {
//     this.peerConnection = null;
//     this.dataChannel = null;
//     this.localStream = null;
//     this.remoteStream = null;
//     this.mediaRecorder = null;
//     this.recordedChunks = [];
//     this.isCaller = false;
//     this.isConnected = false;
//     this.wsService = null;
//     this.onFrameCallback = null;
//     this.recordedVideoBlob = null;
    
//     // Configuration
//     this.configuration = {
//       iceServers: [
//         { urls: 'stun:stun.l.google.com:19302' },
//         { urls: 'stun:stun1.l.google.com:19302' },
//         { urls: 'stun:stun2.l.google.com:19302' },
//         { 
//           urls: 'turn:your-turn-server.com:3478',
//           username: 'username',
//           credential: 'password'
//         }
//       ],
//       iceTransportPolicy: 'all',
//       bundlePolicy: 'max-bundle',
//       rtcpMuxPolicy: 'require'
//     };
//   }

//   // Initialize WebRTC connection
//   async initialize(wsService, isCaller = false, onFrameCallback = null) {
//     this.wsService = wsService;
//     this.isCaller = isCaller;
//     this.onFrameCallback = onFrameCallback;
    
//     try {
//       // Create peer connection
//       this.peerConnection = new RTCPeerConnection(this.configuration);
      
//       console.log('✅ WebRTC PeerConnection created');
      
//       // Setup data channel for video frames
//       if (isCaller) {
//         this.dataChannel = this.peerConnection.createDataChannel('videoData', {
//           ordered: false,
//           maxRetransmits: 0
//         });
//         this.setupDataChannel();
//       } else {
//         this.peerConnection.ondatachannel = (event) => {
//           this.dataChannel = event.channel;
//           this.setupDataChannel();
//         };
//       }
      
//       // Handle ICE candidates
//       this.peerConnection.onicecandidate = (event) => {
//         if (event.candidate && this.wsService) {
//           this.wsService.send({
//             type: 'webrtc_ice_candidate',
//             candidate: event.candidate,
//             target: this.isCaller ? 'server' : 'client'
//           });
//         }
//       };
      
//       // Handle remote stream
//       this.peerConnection.ontrack = (event) => {
//         console.log('📹 Remote track received:', event.track.kind);
//         if (!this.remoteStream) {
//           this.remoteStream = new MediaStream();
//         }
//         this.remoteStream.addTrack(event.track);
//         this.emit('remote_stream', this.remoteStream);
//       };
      
//       // Handle connection state
//       this.peerConnection.onconnectionstatechange = () => {
//         console.log('🔗 WebRTC Connection State:', this.peerConnection.connectionState);
        
//         if (this.peerConnection.connectionState === 'connected') {
//           this.isConnected = true;
//           this.emit('connected');
//           console.log('✅ WebRTC fully connected');
//         } else if (this.peerConnection.connectionState === 'disconnected' || 
//                    this.peerConnection.connectionState === 'failed') {
//           this.isConnected = false;
//           this.emit('disconnected');
//         }
//       };
      
//       // Setup signaling handlers
//       this.setupSignalingHandlers();
      
//       return true;
      
//     } catch (error) {
//       console.error('❌ WebRTC initialization error:', error);
//       return false;
//     }
//   }

//   setupDataChannel() {
//     this.dataChannel.onopen = () => {
//       console.log('✅ WebRTC Data Channel opened');
//       this.emit('data_channel_open');
//     };
    
//     this.dataChannel.onclose = () => {
//       console.log('❌ WebRTC Data Channel closed');
//       this.emit('data_channel_closed');
//     };
    
//     this.dataChannel.onmessage = async (event) => {
//       try {
//         const data = JSON.parse(event.data);
        
//         if (data.type === 'video_frame') {
//           // Process video frame
//           if (this.onFrameCallback) {
//             this.onFrameCallback(data.frame, data.frameNumber, data.metrics);
//           }
          
//           // Record frame if recording is active
//           if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
//             this.recordFrame(data.frame);
//           }
//         } else if (data.type === 'video_chunk') {
//           // Handle video chunks for recording
//           this.recordedChunks.push(new Uint8Array(data.chunk));
//         }
        
//         this.emit('data', data);
//       } catch (error) {
//         console.error('❌ Data channel message error:', error);
//       }
//     };
//   }

//   setupSignalingHandlers() {
//     if (!this.wsService) return;
    
//     // Handle offer from server
//     this.wsService.on('webrtc_offer', async (data) => {
//       try {
//         console.log('📩 Received WebRTC offer');
//         await this.peerConnection.setRemoteDescription(
//           new RTCSessionDescription(data.offer)
//         );
        
//         const answer = await this.peerConnection.createAnswer();
//         await this.peerConnection.setLocalDescription(answer);
        
//         this.wsService.send({
//           type: 'webrtc_answer',
//           answer: answer
//         });
        
//       } catch (error) {
//         console.error('❌ Error handling offer:', error);
//       }
//     });
    
//     // Handle answer from server
//     this.wsService.on('webrtc_answer', async (data) => {
//       try {
//         console.log('📩 Received WebRTC answer');
//         await this.peerConnection.setRemoteDescription(
//           new RTCSessionDescription(data.answer)
//         );
//       } catch (error) {
//         console.error('❌ Error handling answer:', error);
//       }
//     });
    
//     // Handle ICE candidates
//     this.wsService.on('webrtc_ice_candidate', async (data) => {
//       try {
//         if (data.candidate) {
//           await this.peerConnection.addIceCandidate(
//             new RTCIceCandidate(data.candidate)
//           );
//         }
//       } catch (error) {
//         console.error('❌ Error handling ICE candidate:', error);
//       }
//     });
//   }

//   // Start WebRTC call
//   async startCall() {
//     if (!this.peerConnection || !this.isCaller) return false;
    
//     try {
//       console.log('📞 Starting WebRTC call...');
      
//       const offer = await this.peerConnection.createOffer({
//         offerToReceiveAudio: false,
//         offerToReceiveVideo: true
//       });
      
//       await this.peerConnection.setLocalDescription(offer);
      
//       this.wsService.send({
//         type: 'webrtc_offer',
//         offer: offer
//       });
      
//       console.log('✅ WebRTC offer sent');
//       return true;
      
//     } catch (error) {
//       console.error('❌ Error creating offer:', error);
//       return false;
//     }
//   }

//   // Send video frame via WebRTC
//   sendFrame(frameData, frameNumber, metrics = {}) {
//     if (this.dataChannel && this.dataChannel.readyState === 'open' && this.isConnected) {
//       try {
//         // Compress frame before sending
//         const compressedData = this.compressFrame(frameData);
        
//         const framePacket = {
//           type: 'video_frame',
//           frame: compressedData,
//           frameNumber: frameNumber,
//           timestamp: Date.now(),
//           metrics: metrics
//         };
        
//         this.dataChannel.send(JSON.stringify(framePacket));
//         return true;
//       } catch (error) {
//         console.error('❌ Error sending frame via WebRTC:', error);
//         return false;
//       }
//     }
//     return false;
//   }

//   // Start recording video
//   startRecording() {
//     try {
//       this.recordedChunks = [];
      
//       if (Platform.OS === 'web') {
//         // Web recording
//         const options = { mimeType: 'video/webm;codecs=vp9' };
//         this.mediaRecorder = new MediaRecorder(this.remoteStream, options);
        
//         this.mediaRecorder.ondataavailable = (event) => {
//           if (event.data.size > 0) {
//             this.recordedChunks.push(event.data);
//           }
//         };
        
//         this.mediaRecorder.onstop = () => {
//           this.recordedVideoBlob = new Blob(this.recordedChunks, { 
//             type: 'video/webm' 
//           });
//           this.emit('recording_complete', this.recordedVideoBlob);
//         };
        
//         this.mediaRecorder.start(1000); // Collect data every second
//         console.log('🎥 Recording started');
        
//       } else {
//         // Mobile recording - handle differently
//         console.log('📱 Mobile recording setup');
//         this.emit('recording_started');
//       }
      
//       return true;
//     } catch (error) {
//       console.error('❌ Start recording error:', error);
//       return false;
//     }
//   }

//   // Stop recording and save video
//   async stopRecording() {
//     if (!this.mediaRecorder || this.mediaRecorder.state !== 'recording') {
//       return null;
//     }
    
//     try {
//       this.mediaRecorder.stop();
      
//       // Wait for recording to complete
//       return new Promise((resolve) => {
//         this.once('recording_complete', (videoBlob) => {
//           resolve(videoBlob);
//         });
        
//         // Fallback timeout
//         setTimeout(() => {
//           if (this.recordedChunks.length > 0) {
//             const videoBlob = new Blob(this.recordedChunks, { type: 'video/webm' });
//             resolve(videoBlob);
//           } else {
//             resolve(null);
//           }
//         }, 2000);
//       });
      
//     } catch (error) {
//       console.error('❌ Stop recording error:', error);
//       return null;
//     }
//   }

//   // Save video to local storage
//   async saveVideoToStorage(videoBlob, filename = `dehazed_video_${Date.now()}`) {
//     try {
//       if (Platform.OS === 'web') {
//         // Web: Download file
//         const url = URL.createObjectURL(videoBlob);
//         const a = document.createElement('a');
//         a.href = url;
//         a.download = `${filename}.webm`;
//         document.body.appendChild(a);
//         a.click();
//         document.body.removeChild(a);
//         URL.revokeObjectURL(url);
        
//         console.log('✅ Video saved (web):', filename);
//         return { success: true, path: filename };
        
//       } else {
//         // Mobile: Save to file system
//         const { writeAsStringAsync, documentDirectory } = await import('expo-file-system');
//         const { requestPermissionsAsync, createAssetAsync, createAlbumAsync } = 
//               await import('expo-media-library');
        
//         // Convert blob to base64
//         const base64Data = await this.blobToBase64(videoBlob);
        
//         // Save to app directory
//         const fileUri = `${documentDirectory}${filename}.mp4`;
//         await writeAsStringAsync(fileUri, base64Data, {
//           encoding: 'base64'
//         });
        
//         // Save to gallery
//         const { status } = await requestPermissionsAsync();
//         if (status === 'granted') {
//           const asset = await createAssetAsync(fileUri);
//           await createAlbumAsync('Dehazing Videos', asset, false);
          
//           console.log('✅ Video saved to gallery:', filename);
//           return { success: true, path: fileUri };
//         }
        
//         return { success: true, path: fileUri };
//       }
//     } catch (error) {
//       console.error('❌ Save video error:', error);
//       return { success: false, error: error.message };
//     }
//   }

//   // Utility methods
//   compressFrame(frameData) {
//     // Simple compression - truncate if too large
//     if (frameData.length > 300000) { // 500KB
//       return frameData.substring(0, 300000) + '...TRUNCATED';
//     }
//     return frameData;
//   }

//   async blobToBase64(blob) {
//     return new Promise((resolve, reject) => {
//       const reader = new FileReader();
//       reader.onloadend = () => resolve(reader.result.split(',')[1]);
//       reader.onerror = reject;
//       reader.readAsDataURL(blob);
//     });
//   }

//   // Event emitter methods
//   events = {};
  
//   on(event, listener) {
//     if (!this.events[event]) this.events[event] = [];
//     this.events[event].push(listener);
//   }
  
//   off(event, listener) {
//     if (!this.events[event]) return;
//     this.events[event] = this.events[event].filter(l => l !== listener);
//   }
  
//   emit(event, ...args) {
//     if (!this.events[event]) return;
//     this.events[event].forEach(listener => listener(...args));
//   }
  
//   once(event, listener) {
//     const onceListener = (...args) => {
//       listener(...args);
//       this.off(event, onceListener);
//     };
//     this.on(event, onceListener);
//   }

//   // Get status
//   getStatus() {
//     return {
//       connected: this.isConnected,
//       dataChannel: this.dataChannel ? this.dataChannel.readyState : 'closed',
//       iceState: this.peerConnection ? this.peerConnection.iceConnectionState : 'disconnected',
//       recording: this.mediaRecorder ? this.mediaRecorder.state : 'inactive'
//     };
//   }

//   // Clean up
//   disconnect() {
//     if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
//       this.mediaRecorder.stop();
//     }
    
//     if (this.dataChannel) {
//       this.dataChannel.close();
//     }
    
//     if (this.peerConnection) {
//       this.peerConnection.close();
//     }
    
//     this.isConnected = false;
//     console.log('✅ WebRTC disconnected');
//   }
// }

// export default WebRTCService;

// import { Platform } from 'react-native';

// class WebRTCService {
//   constructor() {
//     this.peerConnection = null;
//     this.dataChannel = null;
//     this.localStream = null;
//     this.remoteStream = null;
//     this.isConnected = false;
//     this.wsService = null;
//     this.isCaller = false;
//     this.frameCount = 0;
//     this.mediaRecorder = null;
//     this.recordedChunks = [];
    
//     // Check WebRTC availability
//     this.webRTCAvailable = this.checkWebRTCAvailability();
//   }

//   checkWebRTCAvailability() {
//     if (Platform.OS === 'web') {
//       return !!(window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection);
//     }
    
//     // For React Native with Expo
//     try {
//       require('react-native-webrtc');
//       return true;
//     } catch (error) {
//       console.log('WebRTC not available in React Native:', error.message);
//       return false;
//     }
//   }

//   async initialize(wsService, isCaller = false) {
//     this.wsService = wsService;
//     this.isCaller = isCaller;
    
//     if (!this.webRTCAvailable) {
//       console.log('⚠️ WebRTC not available, using WebSocket fallback');
//       return false;
//     }
    
//     try {
//       // Get WebRTC APIs based on platform
//       let RTCPeerConnection, RTCSessionDescription, RTCIceCandidate;
      
//       if (Platform.OS === 'web') {
//         RTCPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
//         RTCSessionDescription = window.RTCSessionDescription || window.mozRTCSessionDescription;
//         RTCIceCandidate = window.RTCIceCandidate || window.mozRTCIceCandidate;
//       } else {
//         const WebRTC = require('react-native-webrtc');
//         RTCPeerConnection = WebRTC.RTCPeerConnection;
//         RTCSessionDescription = WebRTC.RTCSessionDescription;
//         RTCIceCandidate = WebRTC.RTCIceCandidate;
//       }
      
//       // WebRTC configuration
//       const configuration = {
//         iceServers: [
//           { urls: 'stun:stun.l.google.com:19302' },
//           { urls: 'stun:stun1.l.google.com:19302' },
//           { urls: 'stun:stun2.l.google.com:19302' }
//         ]
//       };
      
//       this.peerConnection = new RTCPeerConnection(configuration);
      
//       console.log('✅ WebRTC PeerConnection created');
      
//       // Setup data channel
//       if (this.isCaller) {
//         this.dataChannel = this.peerConnection.createDataChannel('videoData', {
//           ordered: false,
//           maxRetransmits: 0
//         });
//         this.setupDataChannel();
//       } else {
//         this.peerConnection.ondatachannel = (event) => {
//           this.dataChannel = event.channel;
//           this.setupDataChannel();
//         };
//       }
      
//       // ICE candidates
//       this.peerConnection.onicecandidate = (event) => {
//         if (event.candidate && this.wsService) {
//           this.wsService.send({
//             type: 'webrtc_ice_candidate',
//             candidate: event.candidate
//           });
//         }
//       };
      
//       // Connection state
//       this.peerConnection.onconnectionstatechange = () => {
//         console.log('🔗 WebRTC state:', this.peerConnection.connectionState);
//         if (this.peerConnection.connectionState === 'connected') {
//           this.isConnected = true;
//           console.log('✅ WebRTC connected');
//         } else if (this.peerConnection.connectionState === 'disconnected' || 
//                    this.peerConnection.connectionState === 'failed') {
//           this.isConnected = false;
//           console.log('❌ WebRTC disconnected');
//         }
//       };
      
//       // Handle remote stream
//       this.peerConnection.ontrack = (event) => {
//         console.log('📹 Received remote track');
//         if (event.streams && event.streams[0]) {
//           this.remoteStream = event.streams[0];
//           console.log('✅ Remote stream set');
//         }
//       };
      
//       // Setup signaling handlers
//       this.setupSignalingHandlers();
      
//       return true;
      
//     } catch (error) {
//       console.error('❌ WebRTC initialization error:', error);
//       return false;
//     }
//   }

//   setupDataChannel() {
//     if (!this.dataChannel) return;
    
//     this.dataChannel.onopen = () => {
//       console.log('✅ Data channel opened');
//     };
    
//     this.dataChannel.onclose = () => {
//       console.log('❌ Data channel closed');
//     };
    
//     this.dataChannel.onmessage = (event) => {
//       try {
//         const data = JSON.parse(event.data);
//         console.log('📨 Data channel message:', data.type);
//         // Handle incoming data
//       } catch (error) {
//         console.error('Data channel error:', error);
//       }
//     };
//   }

//   setupSignalingHandlers() {
//     if (!this.wsService) return;
    
//     // Handle offer from server
//     this.wsService.on('webrtc_offer', async (data) => {
//       try {
//         const WebRTC = Platform.OS === 'web' ? window : require('react-native-webrtc');
//         const RTCSessionDescription = WebRTC.RTCSessionDescription || (WebRTC.default && WebRTC.default.RTCSessionDescription);
        
//         await this.peerConnection.setRemoteDescription(
//           new RTCSessionDescription(data.offer)
//         );
        
//         const answer = await this.peerConnection.createAnswer();
//         await this.peerConnection.setLocalDescription(answer);
        
//         this.wsService.send({
//           type: 'webrtc_answer',
//           answer: answer
//         });
        
//       } catch (error) {
//         console.error('❌ Error handling offer:', error);
//       }
//     });
    
//     // Handle answer from server
//     this.wsService.on('webrtc_answer', async (data) => {
//       try {
//         const WebRTC = Platform.OS === 'web' ? window : require('react-native-webrtc');
//         const RTCSessionDescription = WebRTC.RTCSessionDescription || (WebRTC.default && WebRTC.default.RTCSessionDescription);
        
//         await this.peerConnection.setRemoteDescription(
//           new RTCSessionDescription(data.answer)
//         );
        
//       } catch (error) {
//         console.error('❌ Error handling answer:', error);
//       }
//     });
    
//     // Handle ICE candidates
//     this.wsService.on('webrtc_ice_candidate', async (data) => {
//       try {
//         const WebRTC = Platform.OS === 'web' ? window : require('react-native-webrtc');
//         const RTCIceCandidate = WebRTC.RTCIceCandidate || (WebRTC.default && WebRTC.default.RTCIceCandidate);
        
//         if (data.candidate) {
//           await this.peerConnection.addIceCandidate(
//             new RTCIceCandidate(data.candidate)
//           );
//         }
//       } catch (error) {
//         console.error('❌ Error handling ICE candidate:', error);
//       }
//     });
//   }

//   async startCall() {
//     if (!this.peerConnection || !this.isCaller) {
//       console.log('❌ Cannot start call: peer connection not ready');
//       return false;
//     }
    
//     try {
//       const offer = await this.peerConnection.createOffer({
//         offerToReceiveAudio: true,
//         offerToReceiveVideo: true
//       });
      
//       await this.peerConnection.setLocalDescription(offer);
      
//       if (this.wsService) {
//         this.wsService.send({
//           type: 'webrtc_offer',
//           offer: offer
//         });
//       }
      
//       console.log('✅ WebRTC offer sent');
//       return true;
      
//     } catch (error) {
//       console.error('❌ Error creating offer:', error);
//       return false;
//     }
//   }

//   sendFrame(frameData, frameNumber) {
//     if (!this.dataChannel || this.dataChannel.readyState !== 'open' || !this.isConnected) {
//       return false;
//     }
    
//     try {
//       const packet = {
//         type: 'video_frame',
//         frame: this.compressFrame(frameData),
//         frameNumber: frameNumber,
//         timestamp: Date.now()
//       };
      
//       this.dataChannel.send(JSON.stringify(packet));
//       this.frameCount++;
//       return true;
      
//     } catch (error) {
//       console.error('❌ Error sending frame:', error);
//       return false;
//     }
//   }

//   compressFrame(frameData) {
//     // Simple compression - truncate if too large
//     const maxSize = 300000; // 500KB
//     if (frameData.length > maxSize) {
//       return frameData.substring(0, maxSize);
//     }
//     return frameData;
//   }

//   // Video recording methods
//   startRecording() {
//     if (Platform.OS === 'web' && this.remoteStream) {
//       try {
//         this.recordedChunks = [];
//         const options = { mimeType: 'video/webm;codecs=vp9' };
//         this.mediaRecorder = new MediaRecorder(this.remoteStream, options);
        
//         this.mediaRecorder.ondataavailable = (event) => {
//           if (event.data.size > 0) {
//             this.recordedChunks.push(event.data);
//           }
//         };
        
//         this.mediaRecorder.start(1000); // Collect data every second
//         console.log('🎥 Recording started');
//         return true;
//       } catch (error) {
//         console.error('❌ Start recording error:', error);
//         return false;
//       }
//     }
//     console.log('⚠️ Recording not available on this platform');
//     return false;
//   }

//   async stopRecording() {
//     if (!this.mediaRecorder || this.mediaRecorder.state !== 'recording') {
//       return null;
//     }
    
//     return new Promise((resolve) => {
//       this.mediaRecorder.onstop = () => {
//         const videoBlob = new Blob(this.recordedChunks, { 
//           type: 'video/webm' 
//         });
//         resolve(videoBlob);
//       };
      
//       this.mediaRecorder.stop();
//     });
//   }

//   async saveVideoToDevice(videoBlob, filename = `dehazed_${Date.now()}`) {
//     try {
//       if (Platform.OS === 'web') {
//         // Web: Download file
//         const url = URL.createObjectURL(videoBlob);
//         const a = document.createElement('a');
//         a.href = url;
//         a.download = `${filename}.webm`;
//         document.body.appendChild(a);
//         a.click();
//         document.body.removeChild(a);
//         URL.revokeObjectURL(url);
        
//         console.log('✅ Video saved (web download)');
//         return { success: true, path: filename };
        
//       } else {
//         // React Native: Save to file system
//         const { writeAsStringAsync, documentDirectory } = require('expo-file-system');
//         const { requestPermissionsAsync, createAssetAsync, createAlbumAsync } = 
//               require('expo-media-library');
        
//         // Convert blob to base64
//         const base64Data = await this.blobToBase64(videoBlob);
//         const fileUri = `${documentDirectory}${filename}.mp4`;
        
//         // Write file
//         await writeAsStringAsync(fileUri, base64Data, {
//           encoding: 'base64'
//         });
        
//         // Save to gallery
//         const { status } = await requestPermissionsAsync();
//         if (status === 'granted') {
//           const asset = await createAssetAsync(fileUri);
//           await createAlbumAsync('Dehazing Videos', asset, false);
//           console.log('✅ Video saved to gallery');
//         }
        
//         return { success: true, path: fileUri };
//       }
//     } catch (error) {
//       console.error('❌ Save video error:', error);
//       return { success: false, error: error.message };
//     }
//   }

//   async blobToBase64(blob) {
//     return new Promise((resolve, reject) => {
//       const reader = new FileReader();
//       reader.onloadend = () => resolve(reader.result.split(',')[1]);
//       reader.onerror = reject;
//       reader.readAsDataURL(blob);
//     });
//   }

//   getStatus() {
//     return {
//       webRTCAvailable: this.webRTCAvailable,
//       connected: this.isConnected,
//       dataChannel: this.dataChannel ? this.dataChannel.readyState : 'closed',
//       frameCount: this.frameCount,
//       recording: this.mediaRecorder ? this.mediaRecorder.state : 'inactive'
//     };
//   }

//   disconnect() {
//     if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
//       this.mediaRecorder.stop();
//     }
    
//     if (this.dataChannel) {
//       this.dataChannel.close();
//     }
    
//     if (this.peerConnection) {
//       this.peerConnection.close();
//     }
    
//     this.isConnected = false;
//     console.log('✅ WebRTC disconnected');
//   }
// }

// export default WebRTCService;


import { Platform } from 'react-native';

class WebRTCService {
  constructor() {
    this.peerConnection = null;
    this.dataChannel = null;
    this.localStream = null;
    this.remoteStream = null;
    this.isConnected = false;
    this.wsService = null;
    this.frameCount = 0;
    this.sessionId = null;
    
    // Recording properties
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.isRecording = false;
    this.recordingStartTime = null;
    
    // Event callbacks
    this.onProcessedFrame = null;
    this.onVideoReady = null;
    this.onError = null;
    this.onRecordingStateChange = null;
  }

  // Check WebRTC availability
  checkWebRTCAvailability() {
    if (Platform.OS === 'web') {
      return !!(window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection);
    }
    
    // For React Native with Expo
    try {
      require('react-native-webrtc');
      return true;
    } catch (error) {
      console.log('WebRTC not available:', error.message);
      return false;
    }
  }

  // Initialize with WebSocket service
  async initialize(wsService) {
    this.wsService = wsService;
    
    if (!this.checkWebRTCAvailability()) {
      console.log('⚠️ WebRTC not available, using WebSocket fallback');
      return false;
    }
    
    try {
      // Setup WebRTC if available
      await this.setupWebRTC();
      
      // Listen for WebRTC signals
      this.wsService.on('webrtc_offer_received', (data) => {
        console.log('WebRTC offer received:', data);
      });
      
      this.wsService.on('webrtc_ready', (data) => {
        console.log('WebRTC ready:', data);
      });
      
      return true;
      
    } catch (error) {
      console.error('WebRTC initialization error:', error);
      return false;
    }
  }

  // Setup WebRTC connection
  async setupWebRTC() {
    try {
      let RTCPeerConnection, RTCSessionDescription, RTCIceCandidate;
      
      if (Platform.OS === 'web') {
        RTCPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
        RTCSessionDescription = window.RTCSessionDescription || window.mozRTCSessionDescription;
        RTCIceCandidate = window.RTCIceCandidate || window.mozRTCIceCandidate;
      } else {
        const WebRTC = require('react-native-webrtc');
        RTCPeerConnection = WebRTC.RTCPeerConnection;
        RTCSessionDescription = WebRTC.RTCSessionDescription;
        RTCIceCandidate = WebRTC.RTCIceCandidate;
      }
      
      const configuration = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      };
      
      this.peerConnection = new RTCPeerConnection(configuration);
      
      console.log('✅ WebRTC PeerConnection created');
      
      // Setup data channel
      this.dataChannel = this.peerConnection.createDataChannel('videoData', {
        ordered: false,
        maxRetransmits: 0
      });
      
      this.setupDataChannel();
      this.setupPeerConnectionEvents();
      
    } catch (error) {
      console.error('WebRTC setup error:', error);
      throw error;
    }
  }

  setupDataChannel() {
    if (!this.dataChannel) return;
    
    this.dataChannel.onopen = () => {
      console.log('✅ Data channel opened');
      this.isConnected = true;
      if (this.onRecordingStateChange) {
        this.onRecordingStateChange('connected');
      }
    };
    
    this.dataChannel.onclose = () => {
      console.log('❌ Data channel closed');
      this.isConnected = false;
      if (this.onRecordingStateChange) {
        this.onRecordingStateChange('disconnected');
      }
    };
    
    this.dataChannel.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('WebRTC message:', data.type);
        
        if (data.type === 'processed_frame' && this.onProcessedFrame) {
          this.onProcessedFrame(data);
        }
      } catch (error) {
        console.error('Data channel error:', error);
      }
    };
  }

  setupPeerConnectionEvents() {
    if (!this.peerConnection) return;
    
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.wsService) {
        this.wsService.send({
          type: 'webrtc_ice_candidate',
          candidate: event.candidate
        });
      }
    };
    
    this.peerConnection.onconnectionstatechange = () => {
      console.log('WebRTC state:', this.peerConnection.connectionState);
    };
    
    this.peerConnection.ondatachannel = (event) => {
      this.dataChannel = event.channel;
      this.setupDataChannel();
    };
  }

  // ============================================
  // 🎥 RECORDING METHODS
  // ============================================

  // Start recording
  startRecording() {
    console.log('🎥 Starting recording...');
    
    if (Platform.OS === 'web' && this.remoteStream) {
      try {
        this.recordedChunks = [];
        const options = { mimeType: 'video/webm;codecs=vp9' };
        this.mediaRecorder = new MediaRecorder(this.remoteStream, options);
        
        this.mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            this.recordedChunks.push(event.data);
          }
        };
        
        this.mediaRecorder.start(1000); // Collect data every second
        this.isRecording = true;
        this.recordingStartTime = Date.now();
        
        console.log('✅ Recording started');
        return true;
        
      } catch (error) {
        console.error('❌ Start recording error:', error);
        return false;
      }
    }
    
    // For demo purposes or when no stream is available
    console.log('⚠️ Using demo recording mode');
    this.isRecording = true;
    this.recordingStartTime = Date.now();
    this.recordedChunks = [];
    
    return true;
  }

  // Stop recording
  stopRecording() {
    console.log('🛑 Stopping recording...');
    
    if (Platform.OS === 'web' && this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      return new Promise((resolve) => {
        this.mediaRecorder.onstop = () => {
          const videoBlob = new Blob(this.recordedChunks, { 
            type: 'video/webm' 
          });
          this.isRecording = false;
          resolve(videoBlob);
        };
        
        this.mediaRecorder.stop();
      });
    }
    
    // For demo purposes
    this.isRecording = false;
    return Promise.resolve(null);
  }

  // Save video to device
  async saveVideoToDevice(videoBlob, filename = `dehazed_${Date.now()}`) {
    try {
      if (Platform.OS === 'web') {
        // Web: Download file
        const url = URL.createObjectURL(videoBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        return { success: true, path: 'Downloads folder' };
        
      } else {
        // React Native: Save to file system
        const { writeAsStringAsync, documentDirectory } = require('expo-file-system');
        const { MediaLibrary } = require('expo-media-library');
        
        // For demo, create a text file
        const content = `Dehazed Video: ${filename}\nGenerated at: ${new Date().toLocaleString()}`;
        const fileUri = `${documentDirectory}${filename}.txt`;
        
        await writeAsStringAsync(fileUri, content);
        
        // Try to save to gallery
        try {
          const { status } = await MediaLibrary.requestPermissionsAsync();
          if (status === 'granted') {
            const asset = await MediaLibrary.createAssetAsync(fileUri);
            await MediaLibrary.createAlbumAsync('Dehazing Videos', asset, false);
            return { success: true, path: 'Gallery → Dehazing Videos' };
          }
        } catch (mediaError) {
          console.log('Media library error:', mediaError);
        }
        
        return { success: true, path: 'App storage' };
      }
    } catch (error) {
      console.error('❌ Save video error:', error);
      return { success: false, error: error.message };
    }
  }

  // Get recording status
  getRecordingStatus() {
    const duration = this.recordingStartTime ? Date.now() - this.recordingStartTime : 0;
    
    return {
      isRecording: this.isRecording,
      duration: Math.floor(duration / 1000), // in seconds
      fileSize: '0 MB',
      format: Platform.OS === 'web' ? 'webm' : 'mp4',
      chunksCount: this.recordedChunks.length
    };
  }

  // Get recording duration in formatted string
  getRecordingDuration() {
    if (!this.recordingStartTime) return '00:00';
    
    const seconds = Math.floor((Date.now() - this.recordingStartTime) / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  // ============================================
  // 🚀 PROCESSING METHODS
  // ============================================

  // Start processing session
  async startProcessing(userId, mode = 'cloud') {
    if (!this.wsService) {
      console.error('WebSocket service not available');
      return false;
    }
    
    try {
      // Start session via WebSocket
      this.wsService.send({
        type: 'start_processing',
        userId,
        mode
      });
      
      // Create WebRTC offer if available
      if (this.peerConnection) {
        const offer = await this.peerConnection.createOffer();
        await this.peerConnection.setLocalDescription(offer);
        
        this.wsService.send({
          type: 'webrtc_offer',
          offer: offer
        });
      }
      
      return true;
      
    } catch (error) {
      console.error('Start processing error:', error);
      return false;
    }
  }

  // Send frame via WebRTC (fallback to WebSocket)
  async sendFrame(frameBase64, frameNumber, sessionId) {
    this.frameCount++;
    
    // Try WebRTC first
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      const compressedFrame = this.compressFrame(frameBase64);
      this.dataChannel.send(JSON.stringify({
        type: 'video_frame',
        frame: compressedFrame,
        frameNumber,
        sessionId,
        timestamp: Date.now()
      }));
      return true;
    }
    
    // Fallback to WebSocket
    if (this.wsService && this.wsService.isConnected) {
      this.wsService.send({
        type: 'video_frame',
        frame: frameBase64,
        frameNumber,
        sessionId,
        timestamp: Date.now()
      });
      return true;
    }
    
    return false;
  }

  // Compress frame for transmission
  compressFrame(frameBase64) {
    const maxSize = 200000; // 200KB
    if (frameBase64.length > maxSize) {
      return frameBase64.substring(0, maxSize);
    }
    return frameBase64;
  }

  // Stop processing
  async stopProcessing(sessionId) {
    if (!this.wsService) return false;
    
    try {
      this.wsService.send({
        type: 'stop_processing',
        sessionId
      });
      
      return true;
      
    } catch (error) {
      console.error('Stop processing error:', error);
      return false;
    }
  }

  // Download video
  async downloadVideo(downloadUrl) {
    try {
      const fullUrl = downloadUrl.startsWith('http') ? downloadUrl : `http://localhost:3000${downloadUrl}`;
      
      if (Platform.OS === 'web') {
        window.open(fullUrl, '_blank');
        return { success: true };
      } else {
        const { downloadAsync, documentDirectory } = require('expo-file-system');
        const downloadResult = await downloadAsync(
          fullUrl,
          `${documentDirectory}dehazed_${Date.now()}.mp4`
        );
        return { success: true, uri: downloadResult.uri };
      }
      
    } catch (error) {
      console.error('Download error:', error);
      return { success: false, error: error.message };
    }
  }

  // Convert blob to base64 (for React Native)
  async blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // ============================================
  // 📊 STATUS & UTILITY METHODS
  // ============================================

  // Get comprehensive status
  getStatus() {
    const recordingStatus = this.getRecordingStatus();
    
    return {
      // WebRTC status
      webRTCAvailable: this.checkWebRTCAvailability(),
      connected: this.isConnected,
      dataChannel: this.dataChannel ? this.dataChannel.readyState : 'closed',
      
      // Processing status
      frameCount: this.frameCount,
      sessionId: this.sessionId,
      
      // Recording status
      isRecording: recordingStatus.isRecording,
      recordingDuration: recordingStatus.duration,
      recordingFormat: recordingStatus.format,
      
      // Connection state
      peerConnectionState: this.peerConnection ? this.peerConnection.connectionState : 'closed',
      iceConnectionState: this.peerConnection ? this.peerConnection.iceConnectionState : 'closed'
    };
  }

  // Get simplified status for UI display
  getSimpleStatus() {
    const status = this.getStatus();
    
    if (status.isRecording) {
      return `🔴 Recording • ${this.getRecordingDuration()}`;
    } else if (status.connected) {
      return `🟢 Connected • ${status.frameCount} frames`;
    } else {
      return `⚪️ Disconnected`;
    }
  }

  // Cleanup
  disconnect() {
    // Stop recording if active
    if (this.isRecording && this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
    }
    
    // Close data channel
    if (this.dataChannel) {
      this.dataChannel.close();
    }
    
    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
    }
    
    // Reset state
    this.isConnected = false;
    this.isRecording = false;
    this.frameCount = 0;
    this.sessionId = null;
    this.recordedChunks = [];
    this.recordingStartTime = null;
    
    console.log('✅ WebRTC disconnected');
  }

  // Test connection
  async testConnection() {
    try {
      if (Platform.OS === 'web') {
        // Test WebRTC availability
        const pc = new (window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection)({});
        const hasWebRTC = !!pc;
        if (pc) pc.close();
        
        // Test MediaRecorder
        const hasMediaRecorder = !!window.MediaRecorder;
        
        return {
          webRTC: hasWebRTC,
          mediaRecorder: hasMediaRecorder,
          platform: 'web'
        };
      } else {
        // Test React Native WebRTC
        const WebRTC = require('react-native-webrtc');
        const hasWebRTC = !!WebRTC.RTCPeerConnection;
        
        return {
          webRTC: hasWebRTC,
          mediaRecorder: false, // MediaRecorder not available in React Native
          platform: 'native'
        };
      }
    } catch (error) {
      console.error('Connection test error:', error);
      return {
        webRTC: false,
        mediaRecorder: false,
        platform: Platform.OS,
        error: error.message
      };
    }
  }
}

export default WebRTCService;
