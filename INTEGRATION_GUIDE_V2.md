# AI-Based Real-Time Video Dehazing System - Integration Guide V2

> **Audience:** University final year project students  
> **Last Updated:** April 2026  
> **Purpose:** Complete technical reference for understanding, running, and troubleshooting the dehazing system

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture & Data Flow](#architecture--data-flow)
3. [What Was Broken (Original Code Issues)](#what-was-broken-original-code-issues)
4. [What Was Fixed (File by File)](#what-was-fixed-file-by-file)
5. [How the AI Pipeline Works](#how-the-ai-pipeline-works)
6. [Prerequisites & Installation](#prerequisites--installation)
7. [Running the Project](#running-the-project)
8. [Troubleshooting](#troubleshooting)
9. [What Is Still Not Integrated](#what-is-still-not-integrated)
10. [Key Configuration Files](#key-configuration-files)
11. [Project Directory Structure](#project-directory-structure)

---

## Project Overview

This is an **AI-driven real-time video dehazing system** built as a university final year project. The core idea is simple but technically demanding: a user points their phone camera at a hazy or foggy scene, and the AI removes the haze in real-time, displaying a clear version of the scene alongside the original.

The system is composed of three main components that work together:

| Component | Technology | Location |
|-----------|-----------|----------|
| Mobile App (Frontend) | React Native + Expo | `app/` |
| Backend Server | Node.js + Express + WebSocket | `dehazing-backend/` |
| AI Model (Colab) | Python + PyTorch (DehazeFormer) | `scripts/colab_server.ipynb` |
| AI Model (Local fallback) | Python + OpenCV (AOD-Net) | `scripts/aod_net.py` *(not yet trained — coming later)* |

The mobile app captures video frames from the phone camera and sends them to the backend server over WebSocket. The backend then routes each frame to the appropriate AI model for dehazing. **The current priority is cloud mode** --- GPU-accelerated DehazeFormer running on Google Colab. The local AOD-Net fallback mode will be added later once the model finishes training locally. The code structure is already in place for it.

---

## Architecture & Data Flow

### Cloud Mode (Colab GPU - Primary)

```
Phone Camera --> React Native App --> WebSocket --> Node.js Backend --> HTTP POST --> Google Colab (ngrok) --> DehazeFormer GPU --> HTTP Response --> Backend --> WebSocket --> App Display
```

The app captures frames at **320x240 @ 20FPS** and sends them via WebSocket to the Node.js backend. The backend forwards each frame as an HTTP POST to a Google Colab notebook running DehazeFormer with GPU acceleration via an ngrok tunnel. The dehazed frame comes back as base64 and is relayed to the app.

**Why this architecture?** Phones and laptops lack the GPU power to run DehazeFormer in real-time. Google Colab provides free access to NVIDIA T4 GPUs, making real-time inference possible. The ngrok tunnel gives the Colab notebook a public URL that the backend can reach from any network.

### Local Mode (Fallback — Coming Later)

```
Phone Camera --> React Native App --> WebSocket --> Node.js Backend --> Python stdin/stdout --> AOD-Net (OpenCV) --> Backend --> WebSocket --> App Display
```

> **Status:** The local AOD-Net model is still being trained. The code infrastructure for local mode is in place (`scripts/aod_net.py`, daemon spawning in `aiService.js`), but selecting "Local" mode in the app will currently return unprocessed frames. Once training is complete, the trained weights will be plugged in and local mode will work automatically.

When internet is down or Colab is unavailable, the backend will spawn a local Python process running AOD-Net (dark channel prior based, OpenCV only, no PyTorch needed). This mode will produce lower quality results but works entirely offline and requires no GPU.

**When to use which mode:**
- **Cloud mode (use this now):** Best quality. Use whenever you have internet and a running Colab instance.
- **Local mode (not ready yet):** Fallback. Will work once AOD-Net training is complete.

---

## What Was Broken (Original Code Issues)

This section documents the major issues found in the original codebase and how they were resolved. Understanding these problems is important so that future developers do not reintroduce them.

### Problem 1: WebSocket handler was entirely commented out

**File:** `dehazing-backend/src/services/websocketService.js`

The entire file (~1800 lines) was 100% commented out. Multiple iterations existed as commented-out blocks but none were active. This meant that even though the mobile app was sending frames via WebSocket, the backend was silently ignoring all of them.

**Fixed:** Rewrote from scratch with clean handlers for `start_processing`, `video_frame`, `stop_processing`, `switch_mode`, `run_yolo_evaluation`, and `get_stats`.

### Problem 2: REST controller skipped AI processing

**File:** `dehazing-backend/src/controllers/realtimeController.js`

Had the comment `"Skip AI processing for speed - just save frame directly"` --- the controller saved raw frames without running them through the AI model. This meant the "dehazed" output was identical to the input.

**Fixed:** Now routes through `aiService.processFrame()` so every frame is actually processed by the AI model.

### Problem 3: aiService.js had no Colab integration and platform issues

**File:** `dehazing-backend/src/services/aiService.js`

Multiple issues compounded here:
- Used `python3` command which does not exist on Windows (Windows uses `python`) --- caused immediate crash on Windows machines
- Pre-warmed both cloud and local daemons at startup --- the local daemon pointed to an empty `aod_net.py` file, creating an infinite crash-restart loop
- No remote/cloud GPU support at all --- only spawned local Python processes, making GPU-accelerated dehazing impossible

**Fixed:** Complete rewrite with dual-mode support:
- **Cloud mode with COLAB_URL set** --> HTTP POST to Colab via ngrok (GPU-accelerated)
- **Cloud mode without COLAB_URL** --> local DehazeFormer daemon (fallback)
- **Local mode** --> AOD-Net daemon (OpenCV, lightweight)
- Auto-detects OS for correct Python command (`python` on Windows, `python3` on macOS/Linux)

### Problem 4: Server startup used macOS-specific commands

**File:** `dehazing-backend/src/server.js`

Used `lsof -ti:3000 | xargs kill -9` to kill processes on port 3000 before starting. This command only works on macOS/Linux and would crash immediately on Windows. Also had an unnecessary 5-second delay before starting.

**Fixed:** Clean cross-platform startup without OS-specific process management.

### Problem 5: No Google Colab integration existed

The model code and pretrained weights existed in the repository but there was no way to run them on a remote GPU. The `FYP_finetune_final.ipynb` notebook was just a verification/fine-tuning notebook, not a server that could accept frames for processing.

**Fixed:** Created `scripts/colab_server.ipynb` --- a complete Colab notebook that:
- Loads DehazeFormer with Stage 2 pretrained weights on GPU
- Starts a Flask HTTP server for real-time frame processing
- Exposes the server via ngrok tunnel for external access
- Includes health check, stats monitoring, and testing cells

---

## What Was Fixed (File by File)

### 1. `scripts/colab_server.ipynb` (NEW)

Google Colab notebook that serves as the cloud dehazing API:
- **Step-by-step cells:** install deps --> configure ngrok --> upload weights --> load model --> start server --> test
- Flask HTTP server with `/dehaze` (POST) and `/health` (GET) endpoints
- Receives base64 frame, runs DehazeFormer inference on GPU, returns dehazed base64
- ngrok tunnel for public URL access
- Stats tracking (frames processed, avg time, errors)
- Test cell with visual side-by-side comparison

### 2. `dehazing-backend/src/services/aiService.js` (REWRITTEN)

The brain of the integration --- routes frames to the right processing backend:
- `processFrame(frameBase64, mode)` --- main entry point called by websocketService
- **Cloud mode + COLAB_URL set** --> `processFrameViaColab()` --- HTTP POST to Colab
- **Cloud mode + no COLAB_URL** --> `processFrameViaLocalDaemon()` --- local DehazeFormer Python
- **Local mode** --> `processFrameViaLocalDaemon()` --- local AOD-Net Python
- Built-in timeout (15s for Colab, 5s for local daemon)
- Graceful fallback: always returns original frame if processing fails (never crashes)

### 3. `dehazing-backend/src/services/websocketService.js` (REWRITTEN)

WebSocket handler that bridges the app and AI service:
- Handles 6 message types: `start_processing`, `video_frame`, `stop_processing`, `switch_mode`, `run_yolo_evaluation`, `get_stats`
- The critical line: `const processedFrame = await aiService.processFrame(frame, mode)`
- Saves dehazed frames to temp directory for FFmpeg video generation
- Session management with auto-cleanup

### 4. `dehazing-backend/src/server.js` (CLEANED UP)

- Removed ~130 lines of commented-out old code iterations
- Clean Express + HTTP + WebSocket server on same port
- Cross-platform (Windows/macOS/Linux)
- Announces local IP for mobile app connection on startup

### 5. `dehazing-backend/.env` (UPDATED)

Added `COLAB_URL` configuration variable --- the single most important config for cloud mode.

### 6. `app/processing.js` (FIXED)

- Fixed duplicate line that was setting `hazyFrame` twice (the dehazed frame was being discarded)
- Side-by-side comparison display (Hazy Input | Dehazed Output) now works correctly

---

## How the AI Pipeline Works

### DehazeFormer (Cloud/Primary)

This is the high-quality model that runs on Google Colab with GPU acceleration.

**Processing steps:**

1. Base64 frame arrives at Colab's `/dehaze` endpoint
2. Decode base64 --> numpy array --> BGR image
3. Convert BGR --> RGB, normalize to [0,1] float range
4. Pad to multiple of 8 (transformer architecture requirement)
5. Run through DehazeFormer network (5-stage encoder-decoder transformer)
6. Output: 4 channels (use first 3 for RGB), clamp values to [0,1]
7. Convert back to BGR, encode as JPEG base64
8. Return to backend

**Model architecture details:**

| Parameter | Value |
|-----------|-------|
| Embedding dimensions | [24, 48, 96, 48, 24] |
| Depths (blocks per stage) | [12, 12, 12, 6, 6] |
| Window size | 8 |
| Weights file | `dehazeformer_real_haze_best.pth` (54MB) |
| Training | Stage 2 fine-tuned on real haze images |

DehazeFormer is a vision transformer specifically designed for image restoration tasks. It uses shifted window attention (similar to Swin Transformer) to efficiently process images while maintaining global context awareness. The 5-stage encoder-decoder structure progressively downsamples and then upsamples the feature maps, with skip connections between corresponding encoder and decoder stages.

### AOD-Net (Local/Fallback — Not Yet Available)

> **Status:** AOD-Net is still being trained locally. Once training is complete, the weights will be placed in `scripts/` and local mode will activate automatically. The daemon code in `aiService.js` is ready — it just needs the trained model.

This will be the lightweight fallback model that runs locally without GPU or PyTorch.

**Planned processing steps:**

1. Base64 frame arrives via stdin
2. Dark channel prior estimation
3. Atmospheric light computation
4. Transmission map generation
5. Scene radiance recovery
6. CLAHE contrast enhancement
7. Encode as JPEG base64, write to stdout

**Expected performance:** No PyTorch needed --- pure OpenCV processing at approximately **30-50ms per frame**.

The dark channel prior is based on the observation that in most non-sky patches of haze-free outdoor images, at least one color channel has very low intensity values. AOD-Net uses this prior to estimate the haze transmission map and then recovers the clear image. While not as effective as DehazeFormer, it produces acceptable results with minimal computational requirements.

---

## Prerequisites & Installation

### For Google Colab (Cloud Mode)

1. **Google account** with access to Google Colab (free tier works)
2. **Free ngrok account** --- sign up at https://ngrok.com and get your auth token
3. **Model weights file:** `dehazeformer_real_haze_best.pth` (54MB) --- should be in `scripts/real_dehaze/`

### For Backend Server

1. **Node.js 16+** (recommended: 18+) --- download from https://nodejs.org
2. **MongoDB** (for authentication features) --- download from https://www.mongodb.com or use MongoDB Atlas (free cloud tier)
3. **FFmpeg** (optional, for video export) --- download from https://ffmpeg.org/download.html
4. **Python 3.8+** with OpenCV (for local AOD-Net fallback):
   ```bash
   pip install opencv-python numpy
   ```

### For Mobile App

1. **Node.js 16+**
2. **Expo CLI:** `npm install -g expo-cli`
3. **Expo Go app** on your phone (download from App Store / Google Play)
4. **Phone and backend server must be on the same WiFi network** --- this is essential for the WebSocket connection to work

---

## Running the Project

### Step 1: Start Google Colab Server

1. Open `scripts/colab_server.ipynb` in Google Colab
2. **Set runtime to GPU:** Runtime --> Change runtime type --> T4 GPU
3. Run **Cell 1:** Install dependencies (torch, flask, pyngrok, etc.)
4. Run **Cell 2:** Paste your ngrok auth token when prompted
5. Run **Cell 3:** Upload `dehazeformer_real_haze_best.pth` weights file
6. Run **Cell 4:** Load model (takes approximately 10 seconds)
7. Run **Cell 5:** Start server --- **copy the COLAB_URL printed** (it will look like `https://xxxx-xx-xx-xxx-xxx.ngrok-free.app`)
8. (Optional) Run **Cell 6:** Test with a sample image to verify everything works

**Important:** Do not close the Colab browser tab while using the system. If the tab is closed or the runtime disconnects, the dehazing server stops.

### Step 2: Configure & Start Backend

1. Navigate to the backend directory:
   ```bash
   cd dehazing-backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Edit `.env` file:
   ```
   PORT=3000
   MONGO_URI=mongodb://localhost:27017/dehazing
   COLAB_URL=https://xxxx-xx-xx-xxx-xxx.ngrok-free.app
   ```
   Replace the COLAB_URL with the URL you copied from Step 1, Cell 5.

4. Start MongoDB (if using local MongoDB):
   ```bash
   mongod
   ```
   Or use MongoDB Atlas and set the `MONGO_URI` to your Atlas connection string.

5. Start the backend:
   ```bash
   npm run dev
   ```
   Or for production:
   ```bash
   npm start
   ```

6. You should see output like:
   ```
   Server running on port 3000
   Cloud mode: Colab server at https://xxxx-xx-xx-xxx-xxx.ngrok-free.app
   Local IP: 192.168.x.x
   ```

### Step 3: Configure & Start Mobile App

1. In the project root directory, edit `.env`:
   ```
   EXPO_PUBLIC_API_URL=http://YOUR_PC_IP:3000
   EXPO_PUBLIC_WS_URL=ws://YOUR_PC_IP:3000
   ```
   Replace `YOUR_PC_IP` with your computer's local IP address:
   - **Windows:** Run `ipconfig` in Command Prompt, look for "IPv4 Address" under your WiFi adapter
   - **macOS/Linux:** Run `ifconfig`, look for the `inet` address under `en0` or `wlan0`

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the Expo development server:
   ```bash
   npx expo start
   ```

4. Scan the QR code with the Expo Go app on your phone

5. **Critical:** Your phone and PC must be on the **same WiFi network**. If they are on different networks, the WebSocket connection will fail.

### Step 4: Use the App

1. **Sign up / Log in** on the app's authentication screen
2. Navigate to the **"Live Processing"** screen
3. Select your processing mode:
   - **Cloud** --- for Colab GPU (higher quality, requires internet + running Colab)
   - **Local** --- for AOD-Net fallback (lower quality, works offline)
4. Press **"Start Real-time Processing"**
5. **Point camera at a hazy/foggy scene**
6. The display shows a side-by-side view:
   - **Left side:** Live hazy input from camera
   - **Right side:** AI-dehazed output
7. Press **"Stop Processing"** when done
8. Optionally download the **dehazed MP4 video** for later review

---

## Troubleshooting

### "Backend Offline" on mobile app

- Ensure phone and PC are on the **same WiFi network** (this is the most common cause)
- Check that the IP address in `.env` matches your PC's **current** IP address (it can change if you reconnect to WiFi)
- Try opening `http://YOUR_IP:3000` in your phone's browser --- it should show a JSON status response
- Make sure no firewall is blocking port 3000

### Colab connection errors

- Check that `COLAB_URL` is correct in the backend `.env` file (must include `https://`)
- Make sure the Colab notebook is still running --- do not close the browser tab
- **ngrok free tier URLs change each time you restart** --- update `.env` if you restart the Colab notebook
- Test the connection directly:
  ```bash
  curl https://xxxx-xx-xx-xxx-xxx.ngrok-free.app/health
  ```
  This should return a JSON response with status information.

### Frames not being dehazed (original frames coming back)

- Check the backend console for `"Colab processing error"` messages
- Test Colab directly by running the test cell (Cell 6) in the notebook
- If Colab is slow, frames may timeout after 15 seconds --- check GPU utilization in Colab (Runtime --> View resources)
- The system is designed to return the original frame on failure rather than crashing, so "no dehazing" usually means a silent error

### Local mode not working

- Ensure Python is installed and accessible from PATH:
  - **Windows:** `python --version`
  - **macOS/Linux:** `python3 --version`
- Check that `scripts/aod_net.py` exists and is not empty
- Install required Python packages:
  ```bash
  pip install opencv-python numpy
  ```

### MongoDB connection error

- Start MongoDB locally: `mongod`
- Or use MongoDB Atlas and verify the `MONGO_URI` in `.env`
- **Note:** Authentication features (login/signup) require MongoDB, but the core dehazing functionality works without it

### FFmpeg video export fails

- Install FFmpeg from https://ffmpeg.org/download.html
- Ensure `ffmpeg` is in your system PATH:
  ```bash
  ffmpeg -version
  ```
- **Note:** Video export is optional --- real-time dehazing works without FFmpeg installed

---

## What Is Still Not Integrated

The following features exist as partial implementations or placeholders in the codebase but are not fully functional:

| Feature | Status | What's Needed |
|---------|--------|---------------|
| YOLO object detection | Simulated results | Implement actual YOLOv5/v8 evaluation script |
| WebRTC streaming | Code exists but unused | Could replace WebSocket for lower latency |
| GridFS storage | Code exists | Currently using temp disk for frame storage |
| Docker deployment | Incomplete Dockerfile | Need to containerize backend + Python deps |
| Persistent video storage | Not implemented | Videos are temp files, deleted after 30 min |
| HTTPS/WSS | Not implemented | Needed for production (currently HTTP/WS) |

---

## Key Configuration Files

| File | Purpose |
|------|---------|
| `dehazing-backend/.env` | Backend config: PORT, MONGO_URI, COLAB_URL |
| `.env` (root) | Frontend config: API_URL, WS_URL |
| `app.json` | Expo/React Native app config |
| `scripts/colab_server.ipynb` | Colab server notebook |

---

## Project Directory Structure

```
AI-Based-Dehazing/
├── app/                           # React Native Frontend
│   ├── _layout.js                 # Root layout + WebSocket service
│   ├── index.js                   # Auth + Dashboard
│   ├── processing.js              # Real-time dehazing (side-by-side)
│   ├── capture.js                 # Video capture screen
│   ├── evaluation.js              # YOLO evaluation
│   └── services/
│       ├── authservice.js         # JWT + MFA auth
│       └── videosaver.js          # Frame saving
│
├── dehazing-backend/              # Node.js Backend
│   ├── src/
│   │   ├── server.js              # Entry point
│   │   ├── services/
│   │   │   ├── aiService.js       # AI processing router (Colab/local)
│   │   │   ├── websocketService.js# WebSocket frame handler
│   │   │   └── switchingService.js# Mode switching
│   │   ├── controllers/
│   │   ├── routes/
│   │   ├── models/
│   │   └── config/
│   └── .env                       # Backend config
│
├── scripts/                       # AI Models
│   ├── colab_server.ipynb         # Colab dehazing API server (NEW)
│   ├── dehazeformer_daemon.py     # Local DehazeFormer daemon
│   ├── aod_net.py                 # Local AOD-Net fallback
│   ├── models/
│   │   └── dehazeformer.py        # Model architecture
│   ├── DehazeFormer/              # Original DehazeFormer repo
│   └── real_dehaze/
│       ├── dehazeformer_real_haze_best.pth.zip  # Pretrained weights (54MB)
│       ├── dehazeformer_m_outdoor.pth           # Outdoor weights (19MB)
│       └── FYP_finetune_final.ipynb             # Stage 2 verification notebook
│
├── .env                           # Frontend config
├── app.json                       # Expo config
└── INTEGRATION_GUIDE_V2.md        # This file
```
