# AI-Based Real-Time Video Dehazing System
## Complete Integration Guide for Developers / LLM Agents
**Version:** Final (April 2026)  
**Purpose:** Everything needed to understand, integrate, and run this system end to end.

---

## 1. WHAT THIS SYSTEM DOES

A mobile phone app captures live camera video of a hazy/foggy scene. The frames are streamed to an AI model that removes the haze in real time. The screen shows **two panels side by side**:
- **LEFT panel:** Live hazy input from camera (raw)
- **RIGHT panel:** AI-dehazed output (clean, clear image)

The system uses **two AI models** intelligently:

| Model | Where it runs | Quality | Speed |
|-------|-------------|---------|-------|
| **DehazeFormer** | Google Colab (T4 GPU) | High (19 dB PSNR) | ~200ms/frame |
| **AOD-Net** | Local device / backend server (CPU) | Good (14 dB PSNR) | ~30ms/frame |

The system automatically switches between them based on network conditions.

---

## 2. THE TWO AI MODELS — COMPLETE TECHNICAL DETAILS

### 2A. DehazeFormer (Cloud / Primary Model)

**What it is:** A Vision Transformer (ViT-based) designed specifically for image restoration. Uses Shifted Window Attention (similar to Swin Transformer) with a 5-stage encoder-decoder architecture.

**Model file:** `dehazeformer_real_haze_best.pth` — **54 MB**

**Architecture parameters:**
```python
DehazeFormer(
    in_chans=3, out_chans=4, window_size=8,
    embed_dims=[24, 48, 96, 48, 24],
    mlp_ratios=[2., 4., 4., 2., 2.],
    depths=[12, 12, 12, 6, 6],
    num_heads=[2, 4, 6, 1, 1],
    attn_ratio=[1/4, 1/2, 3/4, 0, 0],
    conv_type=['Conv', 'Conv', 'Conv', 'Conv', 'Conv']
)
```

**How it was trained:**
- Stage 1: Fine-tuned on O-HAZE + DENSE-HAZE real outdoor fog datasets (20.63 dB PSNR)
- Stage 2: Added NH-HAZE (non-homogeneous/patchy fog) for distant haze handling (19.43 dB PSNR, 0.71 SSIM)
- Base: Started from DehazeFormer official outdoor pretrained weights

**How it processes a frame:**
1. Receives BGR image as base64 string
2. Decodes → numpy array → BGR image
3. Converts BGR → RGB, normalizes to [0, 1] float range
4. Pads image dimensions to multiples of 8 (transformer window requirement)
5. Runs through 5-stage encoder-decoder network on T4 GPU
6. Takes first 3 channels of 4-channel output (RGB), clamps to [0, 1]
7. Converts back to BGR, encodes as JPEG base64 at quality 85
8. Returns to backend

**Where it runs:** Google Colab with T4 GPU. A Flask HTTP server + ngrok tunnel exposes it publicly.

**Performance:** ~200ms per frame on T4. Handles frames up to 1080p.

---

### 2B. AOD-Net (Local / Fallback Model)

**What it is:** All-in-One Dehazing Network (ICCV 2017). Extremely lightweight ~100KB model. Uses a direct mathematical reformulation of the atmospheric scattering equation.

**Model file:** `aodnet_finetuned_best.pth` — **11 KB**

**Architecture:**
```python
class AODNet(nn.Module):
    def __init__(self):
        super().__init__()
        self.relu    = nn.ReLU(inplace=True)
        self.e_conv1 = nn.Conv2d(3,  3,  1, padding=0)
        self.e_conv2 = nn.Conv2d(3,  3,  3, padding=1)
        self.e_conv3 = nn.Conv2d(6,  3,  5, padding=2)
        self.e_conv4 = nn.Conv2d(6,  3,  7, padding=3)
        self.e_conv5 = nn.Conv2d(12, 3,  3, padding=1)

    def forward(self, x):
        x1 = self.relu(self.e_conv1(x))
        x2 = self.relu(self.e_conv2(x1))
        x3 = self.relu(self.e_conv3(torch.cat([x1, x2], 1)))
        x4 = self.relu(self.e_conv4(torch.cat([x2, x3], 1)))
        k  = self.relu(self.e_conv5(torch.cat([x1, x2, x3, x4], 1)))
        return torch.clamp(k * x - k + 1, 0, 1)  # AOD reformulation
```

**The math:** AOD-Net directly reformulates the haze scattering equation `I(x) = J(x)*t(x) + A*(1-t(x))` into `J(x) = K(x)*I(x) - K(x) + b`. The network learns K(x) — a single map that encodes both transmission and atmospheric light simultaneously.

**How it was trained:**
- Fine-tuned from official RESIDE pretrained weights (loaded & remapped from old pickle format)
- 50 epochs on O-HAZE (45 pairs) + DENSE-HAZE (55 pairs) + NH-HAZE train/val (50 pairs) = 150 pairs total
- Loss: L1 + SSIM, LR: 2e-4 cosine decay, batch 16, patch 240×240
- Achieved: **14.17 dB PSNR** on real outdoor haze validation set

**Where it runs:** LOCAL — on the backend server machine (CPU). Does NOT require Colab. Runs as a Python daemon process.

**Performance:** ~30ms per frame on CPU. Works without internet.

**Color correction applied post-inference** (fixes AOD-Net's slight color bias):
```python
def fix_colors(img_bgr):
    img = img_bgr.astype(np.float32)
    for c in range(3):
        lo  = np.percentile(img[:,:,c], 1)
        hi  = np.percentile(img[:,:,c], 99)
        img[:,:,c] = np.clip((img[:,:,c] - lo) / (hi - lo + 1e-6), 0, 1) * 255
    img[:,:,2] = np.clip(img[:,:,2] * 1.05, 0, 255)  # Red +5%
    img[:,:,0] = np.clip(img[:,:,0] * 0.97, 0, 255)  # Blue -3%
    return img.astype(np.uint8)
```

---

## 3. SYSTEM ARCHITECTURE & DATA FLOW

### 3A. Normal Operation (Cloud Mode — DehazeFormer)

```
Phone Camera
    ↓ (frame at 320x240, 20 FPS)
React Native App
    ↓ (base64 frame via WebSocket)
Node.js Backend (port 3000)
    ↓ (HTTP POST /dehaze)
Google Colab Flask Server (via ngrok tunnel)
    ↓ (DehazeFormer GPU inference ~200ms)
    ↑ (dehazed base64 frame returned)
Node.js Backend
    ↑ (WebSocket message)
React Native App
    → Display RIGHT panel (dehazed frame)
    → Display LEFT panel (original hazy frame — shown immediately, no wait)
```

### 3B. Fallback Mode (Local — AOD-Net)

```
Phone Camera
    ↓ (frame at 320x240, 20 FPS)
React Native App
    ↓ (base64 frame via WebSocket)
Node.js Backend (port 3000)
    ↓ (stdin pipe)
Python AOD-Net Daemon (local process)
    ↓ (CPU inference ~30ms)
    ↑ (dehazed base64 via stdout)
Node.js Backend
    ↑ (WebSocket message)
React Native App
    → Display RIGHT panel (dehazed)
```

---

## 4. AUTOMATIC TOGGLING LOGIC

This is the critical intelligence of the system. The backend tracks **frame round-trip time (RTT)** for each Colab request.

### Toggle Rules:

| Condition | Action |
|-----------|--------|
| RTT < 7 seconds AND internet connected | Stay on DehazeFormer (Cloud) |
| RTT ≥ 7 seconds for 3 consecutive frames | Auto-switch to AOD-Net (Local) |
| Internet disconnects (fetch throws NetworkError) | Instant switch to AOD-Net |
| Cloud recovers (RTT < 3s for 5 frames) | Auto-switch back to DehazeFormer |

### Backend Toggle Code (`aiService.js`):

```javascript
class AIService {
  constructor() {
    this.mode = 'cloud';               // 'cloud' | 'local'
    this.consecutiveSlowFrames = 0;
    this.consecutiveFastFrames = 0;
    this.SLOW_THRESHOLD_MS = 7000;     // 7 seconds
    this.FAST_THRESHOLD_MS = 3000;     // 3 seconds for recovery
    this.SLOW_COUNT_LIMIT = 3;         // switch after 3 slow frames
    this.FAST_COUNT_LIMIT = 5;         // switch back after 5 fast frames
    this.colabUrl = process.env.COLAB_URL || null;
    this.aodProcess = null;
    this._spawnAODDaemon();
  }

  _spawnAODDaemon() {
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    this.aodProcess = require('child_process').spawn(pythonCmd, [
      'scripts/aod_net.py',
      '--weights', 'scripts/aodnet_finetuned_best.pth'
    ]);
    this.aodProcess.stderr.on('data', d => console.log('[AOD-Net]', d.toString().trim()));
    this.aodProcess.on('exit', () => {
      console.log('[AOD-Net] Daemon exited — restarting...');
      setTimeout(() => this._spawnAODDaemon(), 2000);
    });
  }

  async processFrame(frameBase64, requestedMode) {
    // Always use cloud if explicitly requested and available
    const useCloud = (requestedMode === 'cloud') && this.colabUrl && (this.mode === 'cloud');

    if (useCloud) {
      return await this._processViaColab(frameBase64);
    } else {
      return await this._processViaAOD(frameBase64);
    }
  }

  async _processViaColab(frameBase64) {
    const t0 = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const resp = await fetch(`${this.colabUrl}/dehaze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frame: frameBase64 }),
        signal: controller.signal
      });
      clearTimeout(timeout);

      const rtt = Date.now() - t0;
      const data = await resp.json();

      // Check if slow
      if (rtt >= this.SLOW_THRESHOLD_MS) {
        this.consecutiveSlowFrames++;
        this.consecutiveFastFrames = 0;
        console.log(`⚠️  Cloud slow: ${rtt}ms (${this.consecutiveSlowFrames}/${this.SLOW_COUNT_LIMIT})`);
        if (this.consecutiveSlowFrames >= this.SLOW_COUNT_LIMIT) {
          this._switchTo('local', `RTT ${rtt}ms exceeded threshold`);
        }
      } else {
        this.consecutiveSlowFrames = 0;
      }

      return { frame: data.dehazed, mode: 'cloud', ms: rtt };

    } catch (err) {
      const isDisconnect = err.name === 'AbortError' || err.message.includes('fetch');
      if (isDisconnect) {
        this._switchTo('local', 'Network disconnected');
      }
      // Always return original frame on failure — never crash
      return { frame: frameBase64, mode: 'cloud_fallback', error: err.message };
    }
  }

  async _processViaAOD(frameBase64) {
    const t0 = Date.now();
    return new Promise((resolve) => {
      if (!this.aodProcess || this.aodProcess.exitCode !== null) {
        return resolve({ frame: frameBase64, mode: 'local_unavailable' });
      }
      const onData = (data) => {
        const result = data.toString().trim();
        this.aodProcess.stdout.removeListener('data', onData);
        const rtt = Date.now() - t0;
        // Check if cloud can be recovered
        if (this.mode === 'local' && this.colabUrl) {
          this._checkColabRecovery();
        }
        resolve({ frame: result, mode: 'local', ms: rtt });
      };
      this.aodProcess.stdout.once('data', onData);
      this.aodProcess.stdin.write(frameBase64 + '\n');
    });
  }

  async _checkColabRecovery() {
    try {
      const t0 = Date.now();
      await fetch(`${this.colabUrl}/health`, { signal: AbortSignal.timeout(3000) });
      const rtt = Date.now() - t0;
      if (rtt < this.FAST_THRESHOLD_MS) {
        this.consecutiveFastFrames++;
        if (this.consecutiveFastFrames >= this.FAST_COUNT_LIMIT) {
          this._switchTo('cloud', `Colab recovered (RTT: ${rtt}ms)`);
        }
      } else {
        this.consecutiveFastFrames = 0;
      }
    } catch (_) { this.consecutiveFastFrames = 0; }
  }

  _switchTo(mode, reason) {
    if (this.mode === mode) return;
    this.mode = mode;
    this.consecutiveSlowFrames = 0;
    this.consecutiveFastFrames = 0;
    console.log(`🔄 Switched to ${mode.toUpperCase()}: ${reason}`);
    // Emit event so WebSocket can notify the app
    this.emit('modeSwitch', { mode, reason });
  }
}

module.exports = new AIService();
```

### App receives mode switch notification:

```javascript
// In websocketService.js — notify app of automatic mode switch
aiService.on('modeSwitch', ({ mode, reason }) => {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        type: 'mode_switched',
        mode,
        reason,
        timestamp: Date.now()
      }));
    }
  });
});
```

---

## 5. COLAB SERVER CODE (`scripts/colab_server.ipynb`)

Run these cells in order in Google Colab. **Set runtime to T4 GPU first.**

### Cell 1 — Install:
```python
!pip install -q flask pyngrok timm einops
!git clone -q https://github.com/IDKiro/DehazeFormer.git
import sys; sys.path.insert(0, "DehazeFormer")
print("✅ Ready")
```

### Cell 2 — ngrok Setup:
```python
from pyngrok import ngrok
# Sign up free at ngrok.com → Dashboard → Auth Token
ngrok.set_auth_token("PASTE_YOUR_NGROK_TOKEN_HERE")
print("✅ ngrok configured")
```

### Cell 3 — Upload Weights:
```python
from google.colab import files
import os, shutil
os.makedirs("scripts/real_dehaze", exist_ok=True)
print("📂 Upload dehazeformer_real_haze_best.pth (54MB)")
uploaded = files.upload()
fname = list(uploaded.keys())[0]
shutil.move(fname, "scripts/real_dehaze/dehazeformer_real_haze_best.pth")
print(f"✅ {os.path.getsize('scripts/real_dehaze/dehazeformer_real_haze_best.pth')/1024/1024:.1f} MB ready")
```

### Cell 4 — Load Model:
```python
import torch, torch.nn.functional as F
from models.dehazeformer import DehazeFormer

device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
print(f"Device: {device}")

model = DehazeFormer(
    in_chans=3, out_chans=4, window_size=8,
    embed_dims=[24,48,96,48,24], mlp_ratios=[2.,4.,4.,2.,2.],
    depths=[12,12,12,6,6], num_heads=[2,4,6,1,1],
    attn_ratio=[1/4,1/2,3/4,0,0],
    conv_type=['Conv','Conv','Conv','Conv','Conv']
)
ckpt  = torch.load("scripts/real_dehaze/dehazeformer_real_haze_best.pth", map_location=device)
state = ckpt.get('state_dict', ckpt.get('model', ckpt))
state = {k.replace('module.',''):v for k,v in state.items()}
model.load_state_dict(state, strict=False)
model = model.to(device).eval()
print("✅ DehazeFormer loaded!")
```

### Cell 5 — Start Server (COPY THE URL PRINTED):
```python
import cv2, numpy as np, base64, time, threading
from flask import Flask, request, jsonify
from pyngrok import ngrok

app   = Flask(__name__)
stats = {"frames": 0, "errors": 0, "total_ms": 0}

def dehaze_frame(frame_bgr):
    h, w = frame_bgr.shape[:2]
    rgb  = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
    inp  = torch.from_numpy(rgb/255.0).float().permute(2,0,1).unsqueeze(0).to(device)
    ph, pw = (8-h%8)%8, (8-w%8)%8
    if ph or pw: inp = F.pad(inp,(0,pw,0,ph),'reflect')
    with torch.no_grad():
        out = model(inp)[:,:3,:h,:w].squeeze(0).permute(1,2,0).clamp(0,1)
    return cv2.cvtColor((out.cpu().numpy()*255).astype(np.uint8), cv2.COLOR_RGB2BGR)

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        "status": "ok", "device": str(device),
        "frames": stats["frames"], "errors": stats["errors"],
        "avg_ms": round(stats["total_ms"] / max(stats["frames"], 1), 1)
    })

@app.route('/dehaze', methods=['POST'])
def dehaze_endpoint():
    try:
        t0    = time.time()
        data  = request.json
        raw   = base64.b64decode(data['frame'])
        img   = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)
        clean = dehaze_frame(img)
        _, buf  = cv2.imencode('.jpg', clean, [cv2.IMWRITE_JPEG_QUALITY, 85])
        result  = base64.b64encode(buf).decode('utf-8')
        ms = (time.time()-t0)*1000
        stats["frames"] += 1; stats["total_ms"] += ms
        return jsonify({"dehazed": result, "ms": round(ms,1)})
    except Exception as e:
        stats["errors"] += 1
        return jsonify({"error": str(e)}), 500

threading.Thread(target=lambda: app.run(port=5000, debug=False, use_reloader=False), daemon=True).start()
tunnel = ngrok.connect(5000)
COLAB_URL = tunnel.public_url
print(f"\n{'='*55}")
print(f"🚀 SERVER RUNNING!")
print(f"📋 COLAB_URL = {COLAB_URL}")
print(f"{'='*55}")
print(f"\n👉 Paste into backend .env:")
print(f"   COLAB_URL={COLAB_URL}")
```

### Cell 6 — Test (optional):
```python
import requests
gray = np.zeros((240,320,3), dtype=np.uint8)+128
_, buf = cv2.imencode('.jpg', gray)
r = requests.post(f"{COLAB_URL}/dehaze", json={"frame": base64.b64encode(buf).decode()})
print("Test:", r.status_code, r.json().get('ms','?'), "ms")
print("Health:", requests.get(f"{COLAB_URL}/health").json())
```

---

## 6. LOCAL AOD-NET DAEMON (`scripts/aod_net.py`)

This runs as a permanent background process on the backend server machine.
**It does NOT run on Colab.** It runs purely locally on CPU.
The backend spawns it automatically on server start.

```python
"""
AOD-Net Local Fallback Daemon
- Reads base64-encoded JPEG frames from stdin (one per line)
- Outputs dehazed base64-encoded JPEG frames to stdout (one per line)
- Runs forever until killed by parent process (Node.js backend)
- No GPU required — CPU only, ~30ms per frame at 320x240
"""
import sys, os, cv2, base64, argparse
import numpy as np
import torch
import torch.nn as nn

class AODNet(nn.Module):
    def __init__(self):
        super().__init__()
        self.relu    = nn.ReLU(inplace=True)
        self.e_conv1 = nn.Conv2d(3,  3,  1, padding=0)
        self.e_conv2 = nn.Conv2d(3,  3,  3, padding=1)
        self.e_conv3 = nn.Conv2d(6,  3,  5, padding=2)
        self.e_conv4 = nn.Conv2d(6,  3,  7, padding=3)
        self.e_conv5 = nn.Conv2d(12, 3,  3, padding=1)
    def forward(self, x):
        x1=self.relu(self.e_conv1(x)); x2=self.relu(self.e_conv2(x1))
        x3=self.relu(self.e_conv3(torch.cat([x1,x2],1)))
        x4=self.relu(self.e_conv4(torch.cat([x2,x3],1)))
        k =self.relu(self.e_conv5(torch.cat([x1,x2,x3,x4],1)))
        return torch.clamp(k*x - k + 1, 0, 1)

def fix_colors(img):
    img = img.astype(np.float32)
    for c in range(3):
        lo,hi = np.percentile(img[:,:,c],1), np.percentile(img[:,:,c],99)
        img[:,:,c] = np.clip((img[:,:,c]-lo)/(hi-lo+1e-6),0,1)*255
    img[:,:,2] = np.clip(img[:,:,2]*1.05, 0, 255)   # Red +5%
    img[:,:,0] = np.clip(img[:,:,0]*0.97, 0, 255)   # Blue -3%
    return img.astype(np.uint8)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--weights', default='scripts/aodnet_finetuned_best.pth')
    args = parser.parse_args()

    model = AODNet().eval()
    if os.path.exists(args.weights):
        ckpt = torch.load(args.weights, map_location='cpu')
        model.load_state_dict(ckpt['model'])
        sys.stderr.write(f"[AOD-Net] Loaded: {args.weights}\n"); sys.stderr.flush()
    else:
        sys.stderr.write(f"[AOD-Net] WARNING: weights not found at {args.weights}\n")
        sys.stderr.flush()

    sys.stderr.write("[AOD-Net] Ready. Listening on stdin...\n"); sys.stderr.flush()

    for line in sys.stdin:
        line = line.strip()
        if not line: continue
        try:
            raw   = base64.b64decode(line)
            frame = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)
            rgb   = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            inp   = torch.from_numpy(rgb/255.0).float().permute(2,0,1).unsqueeze(0)
            with torch.no_grad():
                out = model(inp).squeeze(0).permute(1,2,0).clamp(0,1).numpy()
            clean = cv2.cvtColor((out*255).astype(np.uint8), cv2.COLOR_RGB2BGR)
            clean = fix_colors(clean)
            _, buf = cv2.imencode('.jpg', clean, [cv2.IMWRITE_JPEG_QUALITY, 85])
            sys.stdout.write(base64.b64encode(buf).decode('utf-8') + '\n')
            sys.stdout.flush()
        except Exception as e:
            sys.stderr.write(f"[AOD-Net] Error: {e}\n"); sys.stderr.flush()
            # Return original on error — never crash
            try:
                _, buf = cv2.imencode('.jpg', frame)
                sys.stdout.write(base64.b64encode(buf).decode() + '\n')
                sys.stdout.flush()
            except: pass

if __name__ == '__main__':
    main()
```

---

## 7. VIDEO RECORDING & DOWNLOAD FEATURE

Users can record and download dehazed video clips. The backend saves dehazed frames to disk during a session, then stitches them into an MP4 on demand.

### Backend — Frame Saving (`websocketService.js`):

```javascript
const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const sessions = {};  // sessionId -> { frames: [], startTime, mode }

function handleVideoFrame(ws, sessionId, frameBase64, mode) {
  if (!sessions[sessionId]) {
    sessions[sessionId] = { frames: [], startTime: Date.now(), saveDir: `tmp/${sessionId}` };
    fs.mkdirSync(`tmp/${sessionId}`, { recursive: true });
  }
  const session = sessions[sessionId];

  aiService.processFrame(frameBase64, mode).then(result => {
    const frameIdx = session.frames.length;
    const framePath = path.join(session.saveDir, `frame_${String(frameIdx).padStart(6,'0')}.jpg`);

    // Save dehazed frame to disk
    fs.writeFileSync(framePath, Buffer.from(result.frame, 'base64'));
    session.frames.push(framePath);

    // Send dehazed frame back to app for live display
    ws.send(JSON.stringify({
      type: 'dehazed_frame',
      frame: result.frame,
      mode: result.mode,
      frameIndex: frameIdx,
      ms: result.ms
    }));
  });
}

function handleDownloadRequest(ws, sessionId, startSec, endSec, fps = 20) {
  const session = sessions[sessionId];
  if (!session) return ws.send(JSON.stringify({ type: 'error', message: 'Session not found' }));

  const startFrame = Math.floor(startSec * fps);
  const endFrame   = Math.ceil(endSec * fps);
  const clipDir    = `tmp/${sessionId}_clip_${startSec}-${endSec}`;
  fs.mkdirSync(clipDir, { recursive: true });

  // Copy selected frames
  session.frames.slice(startFrame, endFrame).forEach((src, i) => {
    fs.copyFileSync(src, path.join(clipDir, `frame_${String(i).padStart(6,'0')}.jpg`));
  });

  // Stitch with FFmpeg
  const outPath = `tmp/${sessionId}_clip.mp4`;
  execSync(`ffmpeg -y -framerate ${fps} -i "${clipDir}/frame_%06d.jpg" -c:v libx264 -pix_fmt yuv420p "${outPath}"`);
  fs.rmSync(clipDir, { recursive: true });

  // Send download link
  ws.send(JSON.stringify({ type: 'download_ready', path: `/download/${sessionId}`, duration: endSec - startSec }));
}
```

### Backend — Download Endpoint (`server.js`):

```javascript
const express = require('express');
app.get('/download/:sessionId', (req, res) => {
  const filePath = path.join(__dirname, `../tmp/${req.params.sessionId}_clip.mp4`);
  if (fs.existsSync(filePath)) {
    res.download(filePath, 'dehazed_clip.mp4', () => {
      fs.unlinkSync(filePath);  // Clean up after download
    });
  } else {
    res.status(404).json({ error: 'File not found or already downloaded' });
  }
});
// Clean up old sessions after 30 minutes
setInterval(() => {
  const cutoff = Date.now() - 30*60*1000;
  Object.entries(sessions).forEach(([id, s]) => {
    if (s.startTime < cutoff) {
      fs.rmSync(s.saveDir, { recursive: true, force: true });
      delete sessions[id];
    }
  });
}, 5 * 60 * 1000);
```

### App — Download UI Request:

```javascript
// User selects a time range and taps Download
function requestDownload(startSec, endSec) {
  websocket.send(JSON.stringify({
    type: 'download_clip',
    sessionId: currentSessionId,
    startSec,
    endSec,
    fps: 20
  }));
}

// When download is ready, open in browser
websocket.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === 'download_ready') {
    const url = `http://${BACKEND_IP}:3000${msg.path}`;
    Linking.openURL(url);  // React Native — opens in browser for download
  }
};
```

---

## 8. FILES TO RECEIVE (WEIGHTS)

The two weight files must be shared separately (too large for code):

| File | Size | Put it at |
|------|------|-----------|
| `dehazeformer_real_haze_best.pth` | **54 MB** | `scripts/real_dehaze/dehazeformer_real_haze_best.pth` |
| `aodnet_finetuned_best.pth` | **11 KB** | `scripts/aodnet_finetuned_best.pth` |

---

## 9. BACKEND `.env` FILE

```
PORT=3000
MONGO_URI=mongodb://localhost:27017/dehazing
COLAB_URL=https://xxxx-xx-xx-xxx-xxx.ngrok-free.app   ← paste from Colab Cell 5
```

---

## 10. DIRECTORY STRUCTURE

```
project/
├── app/                           # React Native (Expo) frontend
│   ├── processing.js              # Side-by-side display + mode status
│   └── services/
│       └── wsService.js           # WebSocket client + auto-reconnect
│
├── dehazing-backend/              # Node.js backend
│   ├── src/
│   │   ├── server.js              # Express + WebSocket on port 3000
│   │   ├── services/
│   │   │   ├── aiService.js       # Toggle logic + Colab/AOD routing
│   │   │   └── websocketService.js# Frame handler + session recording
│   │   └── routes/
│   │       └── download.js        # /download/:sessionId endpoint
│   └── .env
│
├── scripts/                       # AI models
│   ├── colab_server.ipynb         # Cells 1-6 above (DehazeFormer Flask server)
│   ├── aod_net.py                 # Local AOD-Net stdin/stdout daemon
│   ├── aodnet_finetuned_best.pth  # 11KB weights (PROVIDED)
│   ├── real_dehaze/
│   │   └── dehazeformer_real_haze_best.pth  # 54MB weights (PROVIDED)
│   └── DehazeFormer/              # Auto-cloned by Colab Cell 1
│       └── models/
│           └── dehazeformer.py    # Architecture (cloned from GitHub)
│
└── tmp/                           # Auto-created, frame storage for recording
```

---

## 11. STARTUP CHECKLIST

1. **Colab:** Open `scripts/colab_server.ipynb` → Change runtime to T4 GPU → Run Cells 1–5 → Copy COLAB_URL
2. **Backend `.env`:** Set `COLAB_URL` to the URL from step 1
3. **Backend:** `cd dehazing-backend && npm install && npm run dev`
4. **App:** Edit `.env` with your PC's local IP → `npx expo start` → Scan QR code
5. **App:** Tap "Start Real-time Processing" → Point camera at foggy scene

---

## 12. HOW MODELS WERE BUILT (SUMMARY FOR CONTEXT)

**DehazeFormer** was not built from scratch. The official pretrained outdoor model from the DehazeFormer GitHub (`dehazeformer_m_outdoor.pth`, 19MB) was used as a starting point. It was then fine-tuned in two stages on real-world fog datasets (O-HAZE, DENSE-HAZE, NH-HAZE) to improve performance on actual outdoor haze. The fine-tuning was done on RunPod RTX 3090 for 100 epochs each stage. The result is `dehazeformer_real_haze_best.pth` (54MB).

**AOD-Net** was initialized from official RESIDE-pretrained weights (17KB, from the weberwcwei/AODnet-by-pytorch GitHub repository). The weights were stored in an old Python 2 pickle format, requiring a compatibility shim to extract them. They were then fine-tuned for 50 epochs on the same three real-haze datasets. The result is `aodnet_finetuned_best.pth` (11KB).

Both models are ready to use as-is. No further training is required for basic integration.
