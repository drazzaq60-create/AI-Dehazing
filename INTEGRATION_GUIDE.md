# AI Model Integration Guide

This document explains how the DehazeFormer AI model was integrated with the Node.js backend and React Native frontend, what was broken, what was fixed, and how to run the complete system.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture Before Integration](#2-architecture-before-integration)
3. [What Was Broken](#3-what-was-broken)
4. [What Was Fixed (File by File)](#4-what-was-fixed-file-by-file)
5. [How the AI Pipeline Works](#5-how-the-ai-pipeline-works)
6. [Prerequisites & Installation](#6-prerequisites--installation)
7. [Running the Project](#7-running-the-project)
8. [Troubleshooting](#8-troubleshooting)
9. [What Is Still Not Integrated](#9-what-is-still-not-integrated)

---

## 1. Project Overview

This is an AI-driven real-time video dehazing system. The user points their phone camera at a hazy/foggy scene, and the AI removes the haze in real-time.

**Three components:**

| Component | Technology | Location |
|-----------|-----------|----------|
| Mobile App (Frontend) | React Native + Expo | `app/` |
| Backend Server | Node.js + Express + WebSocket | `dehazing-backend/` |
| AI Model | Python + PyTorch (DehazeFormer) | `scripts/` |

**Data flow:**

```
Phone Camera  -->  WebSocket  -->  Node.js Backend  -->  Python AI Daemon  -->  Dehazed Frame
   (app/)          (ws://)      (dehazing-backend/)    (scripts/)             back to phone
```

---

## 2. Architecture Before Integration

The AI model code and trained weights were present in the repo:

- **Model architecture:** `scripts/DehazeFormer/models/dehazeformer.py` (transformer-based dehazing network)
- **Inference daemon:** `scripts/dehazeformer_daemon.py` (persistent Python process that reads base64 frames from stdin, runs inference, writes results to stdout)
- **Trained weights:** `scripts/real_dehaze/dehazeformer_m_outdoor.pth` (19MB PyTorch checkpoint)
- **Alternative weights:** `scripts/real_dehaze/dehazeformer_real_haze_best/` (fine-tuned on real haze)
- **Lightweight fallback:** `scripts/aod_net.py` (OpenCV-based dark channel prior dehazing, no PyTorch needed)
- **AI service bridge:** `dehazing-backend/src/services/aiService.js` (Node.js code that spawns and communicates with the Python daemon)

The frontend was also complete: login/signup with MFA, camera capture, processing screen with side-by-side comparison, evaluation screen, video download.

**But none of it was connected.**

---

## 3. What Was Broken

### Problem 1: WebSocket handler was entirely commented out

**File:** `dehazing-backend/src/services/websocketService.js`

This is the most critical file in the integration. It is supposed to:
- Receive camera frames from the mobile app via WebSocket
- Pass them to the Python AI daemon via `aiService.processFrame()`
- Send the dehazed frames back to the mobile app

The entire file (~1800 lines) was **100% commented out**. Multiple iterations of the handler existed as commented-out blocks, but none were active. When the mobile app connected via WebSocket and sent frames, the backend simply ignored them.

### Problem 2: REST controller skipped AI processing

**File:** `dehazing-backend/src/controllers/realtimeController.js`

The REST endpoint for processing frames had this comment:
```js
// Process in background - FAST PATH (no AI processing for now)
// Skip AI processing for speed - just save frame directly
```

It saved the raw hazy frame to disk without running it through the AI model.

### Problem 3: aiService.js had platform issues

**File:** `dehazing-backend/src/services/aiService.js`

- Used `python3` as the command, which does not exist on Windows (Windows uses `python`)
- Pre-warmed both `cloud` and `local` daemon modes at startup
- The `local` mode pointed to `dehazing-backend/scripts/aod_net.py` which was an **empty file** (0 bytes), causing the daemon to crash immediately on startup
- The crash triggered an infinite auto-restart loop

### Problem 4: Server startup used macOS-specific commands

**File:** `dehazing-backend/src/server.js`

- Used `lsof -ti:3000 | xargs kill -9` to clear the port before starting, which is a macOS/Linux command that fails on Windows
- Had an unnecessary 5-second delay before binding to the port ("for stubborn macOS sockets")

---

## 4. What Was Fixed (File by File)

### 4.1 `dehazing-backend/src/services/websocketService.js` — Complete Rewrite

Replaced ~1800 lines of commented-out code with a clean ~320 line working implementation.

**What it does now:**

The `initWebSocket(server)` function creates a WebSocket server attached to the HTTP server and handles all 6 message types that the frontend sends:

| Message Type | Handler | What Happens |
|---|---|---|
| `start_processing` | `handleStartProcessing()` | Creates a session with temp directory, responds with `session_created` so the frontend starts its camera capture loop |
| `video_frame` | `handleVideoFrame()` | **Calls `aiService.processFrame(frame, mode)`** to run the frame through the AI model, responds with `processed_frame` containing both original and dehazed frames |
| `stop_processing` | `handleStopProcessing()` | Generates MP4 from saved frames via FFmpeg, responds with `video_ready` (download link) and `processing_complete` |
| `switch_mode` | `handleSwitchMode()` | Switches between cloud (DehazeFormer) and local (AOD-Net) processing |
| `run_yolo_evaluation` | `handleYoloEvaluation()` | Returns simulated YOLO detection results (the real script is not implemented yet) |
| `get_stats` | `handleGetStats()` | Returns processing statistics (total frames, FPS, uptime) |

**The key integration code in `handleVideoFrame()`:**

```js
// This is the line that connects the frontend to the AI model:
const processedFrame = await aiService.processFrame(frame, mode);
```

The handler also:
- Saves each dehazed frame to `temp/{sessionId}/dehazed_000001.jpg` etc. for later FFmpeg video generation
- Tracks per-user FPS and processing time statistics
- Falls back to returning the original frame if the AI daemon fails

### 4.2 `dehazing-backend/src/services/aiService.js` — Fixed Daemon Management

**Changes made:**

1. **Cross-platform Python detection:**
   ```js
   const PYTHON_CMD = os.platform() === 'win32' ? 'python' : 'python3';
   ```

2. **Correct script paths for both modes:**
   - Cloud mode: `scripts/dehazeformer_daemon.py` (full DehazeFormer model, requires PyTorch)
   - Local mode: `scripts/aod_net.py` (lightweight OpenCV-based, no PyTorch needed)

3. **Safe pre-warming:** Only starts the cloud daemon at startup. The local daemon starts on first request, avoiding crashes from the empty placeholder scripts in `dehazing-backend/scripts/`.

4. **Robust timeout:** Each frame has a 5-second timeout. If the daemon hangs, the original frame is returned instead of blocking forever.

5. **Clean error handling:** If the daemon crashes, pending requests get failed gracefully (return original frame), and the daemon auto-restarts after 3 seconds.

### 4.3 `dehazing-backend/src/server.js` — Cross-Platform Startup

**Changes made:**

- Removed the macOS-specific `lsof -ti:3000 | xargs kill -9` command
- Removed the unnecessary 5-second startup delay
- Added proper `EADDRINUSE` error handling with a clear message
- Server now starts immediately on any platform

### 4.4 `dehazing-backend/src/controllers/realtimeController.js` — AI Wired Into REST Path

**Changes made:**

- Added `const aiService = require('../services/aiService');` import
- Changed the frame processing from "skip AI, save raw frame" to:
  ```js
  const processedFrame = await aiService.processFrame(frame, mode);
  ```
- Now both the WebSocket path AND the REST API path run frames through the AI model

---

## 5. How the AI Pipeline Works

### The Python Daemon Model

Instead of spawning a new Python process for every frame (which would be extremely slow due to model loading), the backend uses a **persistent daemon** approach:

```
                    Node.js (aiService.js)              Python (dehazeformer_daemon.py)
                         |                                          |
Server starts    -->  spawn('python', ['dehazeformer_daemon.py'])   |
                         |                                          |
                         |                              Load model weights (19MB)
                         |                              Print "AI Daemon Ready" to stderr
                         |                                          |
Frame arrives    -->  stdin.write(base64_frame + '\n')  --------->  |
                         |                              readline() from stdin
                         |                              base64 decode -> numpy array
                         |                              Pad to multiple of 8
                         |                              Run DehazeFormer inference
                         |                              numpy array -> base64 encode
                         |                              stdout.write(result + '\n')
                         |  <---------  stdout.on('data')           |
                         |                                          |
Return to frontend  <--  resolve(dehazed_base64)                    |
                         |                                          |
Next frame       -->  stdin.write(next_base64 + '\n')  --------->   |
                         |                              (loop continues...)
```

The daemon loads the model **once** and then processes frames in a loop. This means:
- First frame: ~2-5 seconds (model loading + inference)
- Subsequent frames: ~50-200ms each (inference only)

### The Two Processing Modes

| Mode | Script | Model | Speed | Quality | Requirements |
|------|--------|-------|-------|---------|-------------|
| Cloud | `dehazeformer_daemon.py` | DehazeFormer (transformer) | Slower (~100-200ms/frame) | Higher | PyTorch, GPU recommended |
| Local | `aod_net.py` | Dark Channel Prior + CLAHE | Faster (~30-50ms/frame) | Lower | OpenCV only |

The frontend can switch between modes mid-session via the mode selector in the Processing screen.

---

## 6. Prerequisites & Installation

### 6.1 Python Environment (for the AI model)

The AI model requires Python 3.8+ with the following packages:

```bash
# Install PyTorch (check https://pytorch.org for your platform/CUDA version)
pip install torch torchvision

# Install other dependencies
pip install opencv-python numpy timm pytorch-msssim tqdm
```

**Verify Python is working:**
```bash
python --version          # Windows
python3 --version         # macOS/Linux
python -c "import torch; print(torch.__version__)"
```

### 6.2 MongoDB

The backend uses MongoDB for user accounts, sessions, and frame metadata.

**Option A — Local MongoDB:**
- Install MongoDB Community Server from https://www.mongodb.com/try/download/community
- Make sure `mongod` is running on port 27017

**Option B — MongoDB Atlas (cloud):**
- Create a free cluster at https://cloud.mongodb.com
- Update the `MONGO_URI` in `dehazing-backend/.env`

### 6.3 Node.js Dependencies

```bash
# Backend dependencies
cd dehazing-backend
npm install

# Frontend dependencies
cd ..
npm install
```

### 6.4 FFmpeg (optional — for MP4 video export)

FFmpeg is needed to compile individual dehazed frames into a downloadable MP4 video. Without it, real-time processing still works, but the "Download Video" feature will not.

```bash
# Windows (using Chocolatey)
choco install ffmpeg

# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt install ffmpeg
```

### 6.5 Environment Configuration

**Root `.env`** — Set to your machine's LAN IP address (find it with `ipconfig` on Windows or `ifconfig` on Mac):

```
EXPO_PUBLIC_API_URL=http://YOUR_LOCAL_IP:3000
EXPO_PUBLIC_WS_URL=ws://YOUR_LOCAL_IP:3000
```

**`dehazing-backend/.env`** — Should already have correct values:

```
PORT=3000
MONGO_URI=mongodb://localhost:27017/dehazing_db
JWT_SECRET=your_secret_key_here
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_gmail_app_password
```

> **Note:** The `EMAIL_USER` and `EMAIL_PASS` are used for sending MFA codes and password reset emails. You need a Gmail App Password (not your regular password). Generate one at https://myaccount.google.com/apppasswords

---

## 7. Running the Project

### Step 1: Start MongoDB

```bash
# If installed locally, it may already be running as a service
# Otherwise:
mongod --dbpath /path/to/your/data/directory
```

### Step 2: Start the Backend

```bash
cd dehazing-backend
node src/server.js
```

**Expected output:**
```
Pre-warming AI daemon (cloud mode)...
Starting AI daemon for cloud mode: .../scripts/dehazeformer_daemon.py
Preparing port 3000...
==================================================
Backend running on port 3000
HTTP API:    http://192.168.x.x:3000
WebSocket:   ws://192.168.x.x:3000
Mobile app should connect to: http://192.168.x.x:3000
==================================================
Initializing WebSocket server...
WebSocket server initialized and ready.
AI Daemon (cloud): Initializing DehazeFormer on cpu...
AI Daemon (cloud): Loaded Stage 2 Weights from: .../real_dehaze/dehazeformer_real_haze_best
AI Daemon (cloud): AI Daemon Ready
```

The "AI Daemon Ready" line confirms the model loaded successfully. If you have a CUDA GPU, it will say "cuda" instead of "cpu".

### Step 3: Start the Frontend

```bash
# In the project root (not dehazing-backend)
npx expo start
```

This will show a QR code. Scan it with:
- **Android:** Expo Go app
- **iOS:** Camera app (opens in Expo Go)

> **Important:** Your phone must be on the **same WiFi network** as your development machine.

### Step 4: Test the Flow

1. Open the app on your phone
2. Sign up with an email (you'll receive an MFA code)
3. Log in and verify the MFA code
4. From the Dashboard, tap **Processing**
5. Tap **Start** — the camera should activate
6. You should see the original (hazy) frames on the left and dehazed frames on the right
7. Tap **Stop** — if FFmpeg is installed, a download button will appear
8. Tap **Download** to save the dehazed MP4 to your phone

---

## 8. Troubleshooting

### "AI Daemon (cloud) exited with code 1"

The Python daemon crashed. Common causes:
- Python not installed or not in PATH
- Missing Python packages (run `pip install torch torchvision opencv-python numpy timm`)
- Model weights file missing (check `scripts/real_dehaze/` directory)

### "Port 3000 is already in use"

Another process is using port 3000. Either:
- Stop the other process
- Change the port in `dehazing-backend/.env`

### App shows "Backend not connected"

- Make sure the backend is running
- Make sure `.env` has the correct IP (your machine's LAN IP, not `localhost`)
- Make sure your phone is on the same WiFi network
- Try `http://YOUR_IP:3000` in your phone's browser — should show a JSON response

### Frames are processed but look the same as input

The AI daemon may have timed out and returned the original frame. Check the backend console for timeout warnings. This can happen if:
- The model is still loading (first frame takes longer)
- Your machine is too slow for real-time inference (try local mode)

### Video download button doesn't appear

FFmpeg is not installed or not in PATH. Install it and verify with `ffmpeg -version`.

---

## 9. What Is Still Not Integrated

| Feature | Status | What's Needed |
|---------|--------|--------------|
| YOLO object detection evaluation | Simulated data | Implement `scripts/yolo_eval.py` with actual YOLOv5/v8 inference |
| WebRTC streaming path | Code exists but unused | The WebRTC service (`app/services/WebRTCService.js`) is fully written but not connected to any active UI flow. Everything currently uses WebSocket. |
| GridFS frame storage | Code exists but bypassed | The `gridfsStorageService.js` can save frames to MongoDB GridFS, but the current WebSocket handler saves to temp disk instead (simpler, faster) |
| Docker deployment | Dockerfile exists but incomplete | The Dockerfile uses `node:16` base image but doesn't install Python, PyTorch, or model weights. Needs a multi-stage build or `nvidia/cuda` base image. |
