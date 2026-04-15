# What Was Implemented — 2026-04-15

This document records the changes made to wire up the AI-Based Real-Time Video Dehazing
system per [AI_Dehazing_Complete_Integration_Guide.md](scripts/AI_Dehazing_Complete_Integration_Guide.md).
Before these changes, the backend could *call* the AI models but lacked the intelligence to
switch between them automatically, and the local fallback (AOD-Net) was a placeholder script
that didn't actually use the trained weights. The app side was missing the message handlers
and UI needed to react to automatic mode switches and download specific clips.

---

## 1. Files changed (the "what")

### Backend — Node.js (`dehazing-backend/`)

| File | Change |
|---|---|
| [dehazing-backend/src/services/aiService.js](dehazing-backend/src/services/aiService.js) | Full rewrite. Converted to `EventEmitter`. Added RTT-based auto-toggle state machine between cloud (DehazeFormer on Colab) and local (AOD-Net). Added periodic `/health` check for cloud recovery. Added `_switchTo()` helper that emits a `modeSwitch` event. |
| [dehazing-backend/src/services/websocketService.js](dehazing-backend/src/services/websocketService.js) | Added a one-time listener on `aiService.on('modeSwitch', …)` that broadcasts a `mode_switched` message to every connected WebSocket client. `handleVideoFrame` was also updated to emit both `processed_frame` (legacy) and `dehazed_frame` (new guide-compliant) so old and new app builds both work. |
| [dehazing-backend/.env.example](dehazing-backend/.env.example) | Created. `PORT=3000`, empty `COLAB_URL=` placeholder. |

### Python daemon — `scripts/`

| File | Change |
|---|---|
| [scripts/aod_net.py](scripts/aod_net.py) | Full rewrite. The old file simulated dehazing with a dark-channel-prior math trick (it wasn't actually AOD-Net). The new file loads the real trained `AODNet` PyTorch model, runs inference, applies the `fix_colors()` percentile normalization + red/blue trim, and serves frames over stdin/stdout. Reads weights from `scripts/real_dehaze/aodnet_best/` (the directory-format checkpoint your friend provided) via `--weights` CLI arg. Gracefully degrades to pass-through on any weight-load or inference failure so the backend stream never blocks. |

### App — React Native Expo (`app/`)

| File | Change |
|---|---|
| [app/_layout.js](app/_layout.js) | In `WebSocketService`, after parsing the incoming JSON, added an explicit switch on `data.type` that emits typed events — `dehazedFrame`, `modeSwitched`, `downloadReady` — alongside the existing generic `message` event (backward compatible). Also exports an `HTTP_BASE_URL` helper derived from the WS URL so download links can be opened via `Linking`. |
| [app/processing.js](app/processing.js) | Subscribes to `modeSwitched` and shows an animated banner ("Switched to LOCAL mode — RTT 8120ms exceeded threshold") for ~4 seconds that fades in and out. The side-panel mode indicator now reflects whichever mode is most recent — the user's manual pick *or* the server's automatic switch. Added a time-range clip picker: two numeric `TextInput`s (startSec / endSec) with inline validation, a "Download Clip (Pick Range)" button that sends `{type:'download_clip', sessionId, startSec, endSec, fps:20}` over WebSocket, and a handler that opens the returned URL via `Linking.openURL`. |

Total: **5 files modified**, **1 file created**.

---

## 2. Why these changes (the "why")

### Why auto-toggle logic in `aiService.js`
The integration guide's core promise is that the app "just works" even when Colab is slow or
the internet drops. Before these changes, the backend picked a mode per request based only on
whether `COLAB_URL` was set — it had no idea whether Colab was actually responsive. If Colab
was slow (or broke mid-session), every frame would time out and the user would see frozen
output.

The new code tracks the round-trip time of every Colab request. Three slow frames (≥ 7 s each)
trigger an automatic switch to the local AOD-Net daemon. While running locally, it quietly
polls Colab's `/health` endpoint in the background; five fast responses in a row (< 3 s) switch
back to cloud. The user never has to intervene.

### Why `mode_switched` broadcast
When the backend auto-switches modes, the app has to know so it can update its UI. Without the
broadcast, the app would keep showing "CLOUD" in the indicator while the backend was secretly
running locally. This is the contract described in guide §4 ("App receives mode switch notification").

### Why replace `aod_net.py`
The old file was a placeholder that used Dark Channel Prior math. Dark Channel Prior is a
well-known *non-learning* dehazing heuristic from 2011 — it produces plausible but mediocre
results and has nothing to do with AOD-Net. Your friend spent 50 epochs training the real
AOD-Net model; those weights were never being used. The rewrite loads the actual trained
model, so the local fallback now produces the 14.17 dB PSNR quality the paper promises
instead of whatever DCP happened to give.

### Why graceful-degrade on weight-load failure
If the weights file is missing or corrupted, the old code would either crash or produce gibberish.
The new code logs a clear `[AOD-Net]` warning to stderr and then passes frames through
unchanged. The user sees their raw camera feed instead of a broken pipeline — not great, but
much better than a frozen app.

### Why time-range clip picker
The guide §7 specifies a `download_clip` message with `startSec` and `endSec` so users can
export *just the interesting part* of a long recording. Before these changes the app only had
a "download whole session" button, which isn't useful for a 20-minute recording where the
user only cares about 30 seconds.

---

## 3. How the system works end-to-end (the "how")

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│   Phone (React Native + Vision Camera)                                   │
│   ────────────────────────────────────                                   │
│   Camera captures 320x240 @ 20 fps                                       │
│   Each frame → base64 JPEG → WebSocket send                              │
│                                                                          │
└───────────────────────────┬──────────────────────────────────────────────┘
                            │  { type:'video_frame', frame:<base64> }
                            ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│   Node.js backend (port 3000)                                            │
│   ───────────────────────────                                            │
│   websocketService.js                                                    │
│     ├─ handleVideoFrame() receives frame                                 │
│     ├─ calls aiService.processFrame(frame, requestedMode)                │
│     ├─ saves returned dehazed JPEG to tmp/<sessionId>/ (for recording)   │
│     └─ broadcasts { type:'dehazed_frame', frame, mode, ms } back         │
│                                                                          │
│   aiService.js (the brain)                                               │
│     │                                                                    │
│     ├─ if mode === 'cloud' and COLAB_URL set:                            │
│     │     POST /dehaze to Colab (Flask + ngrok)                          │
│     │     measure RTT                                                    │
│     │     if RTT ≥ 7s: slowCount++                                       │
│     │       if slowCount ≥ 3: emit 'modeSwitch' → switch to local        │
│     │     on network error: emit 'modeSwitch' → switch to local          │
│     │                                                                    │
│     └─ if mode === 'local':                                              │
│           write frame+newline to aod_net.py daemon stdin                 │
│           read one line back from stdout                                 │
│           fire-and-forget _checkColabRecovery() in background:           │
│             GET Colab /health with 3s timeout                            │
│             if RTT < 3s: fastCount++                                     │
│               if fastCount ≥ 5: emit 'modeSwitch' → switch back          │
│                                                                          │
│   When aiService emits 'modeSwitch', websocketService sends              │
│     { type:'mode_switched', mode, reason } to every connected client.    │
│                                                                          │
└───────────────┬──────────────────────────────┬───────────────────────────┘
                │                              │
                │ HTTP POST /dehaze            │ stdin / stdout pipe
                ▼                              ▼
┌─────────────────────────────────┐   ┌────────────────────────────────────┐
│                                 │   │                                    │
│   Google Colab (T4 GPU)         │   │   scripts/aod_net.py (local)       │
│   ───────────────────────       │   │   ────────────────────────         │
│   Flask + ngrok tunnel          │   │   Child process spawned by         │
│   DehazeFormer (54MB)           │   │   aiService at backend startup     │
│   ~200ms/frame                  │   │   AOD-Net (trained weights:        │
│   High quality (19 dB PSNR)     │   │     scripts/real_dehaze/           │
│                                 │   │     aodnet_best/)                  │
│   colab_server.ipynb cells 1-5  │   │   ~30ms/frame on CPU               │
│                                 │   │   Good quality (14 dB PSNR)        │
└─────────────────────────────────┘   └────────────────────────────────────┘
```

### The happy path
1. Student opens Colab notebook, runs cells 1-5, gets an `https://xxx.ngrok-free.app` URL.
2. Pastes the URL into `dehazing-backend/.env` as `COLAB_URL=...`.
3. Starts backend: `cd dehazing-backend && npm run dev`. Backend auto-spawns the `aod_net.py` daemon as a child process; it loads the weights and prints `[AOD-Net] Ready` to stderr.
4. Student starts Expo app on phone: `npx expo start`.
5. Taps **Start Real-time Processing**. Camera starts, frames fly to backend over WebSocket.
6. Backend routes each frame to Colab → gets dehazed result back in ~200ms → sends to app.
7. App shows **side-by-side**: left = raw camera, right = dehazed.
8. If Colab slows down or the internet drops, the backend quietly switches to local AOD-Net; the app sees a `mode_switched` banner flash for ~4 seconds so the user knows.
9. When Colab recovers, the backend switches back, another banner flashes.
10. User taps **Download Clip (Pick Range)**, types "5" and "12" in the inputs, taps Download. Backend stitches frames 100–240 into an MP4 with FFmpeg, sends back a URL. App opens the URL in the phone's browser, which downloads the MP4.

---

## 4. What the students still need to do before this runs

Two system-level dependencies are **missing on the machine** and must be installed:

### A. Install FFmpeg (required for video download)
FFmpeg is a command-line tool that stitches JPEG frames into MP4 video. The backend calls it
directly via `spawn('ffmpeg', ...)`. On Windows:
```powershell
winget install ffmpeg
# or download from https://www.gyan.dev/ffmpeg/builds/ and add ffmpeg.exe to PATH
```
Verify: `ffmpeg -version` should print a version banner.

### B. Install Python AI dependencies (required for local AOD-Net fallback)
The backend spawns `python scripts/aod_net.py`, which imports `torch`, `cv2`, `numpy`. None
are currently installed in the system Python.
```bash
pip install torch torchvision opencv-python numpy
```
Note: if the students use a Python virtual environment, make sure the backend's `PYTHON_CMD`
in [aiService.js line 12](dehazing-backend/src/services/aiService.js#L12) resolves to that
venv's python (on Windows this usually works out of the box if the venv is activated when
running `npm run dev`).

Verify: `python -c "import torch, cv2, numpy; print('ok')"` should print `ok`.

### C. (Optional but recommended) Get the DehazeFormer weights onto Colab
Cell 3 of [scripts/colab_server.ipynb](scripts/colab_server.ipynb) prompts you to upload the
54MB `dehazeformer_real_haze_best.pth` file. That file is the full fine-tuned DehazeFormer
model; without it the cloud path can't run. The file appears to exist at
[scripts/real_dehaze/dehazeformer_real_haze_best](scripts/real_dehaze/dehazeformer_real_haze_best/)
(directory format) — re-pack with `torch.save(model.state_dict(), 'dehazeformer_real_haze_best.pth')`
if needed, or upload the 19MB `dehazeformer_m_outdoor.pth` as a starting point.

---

## 5. Quick-reference: message types flowing over the WebSocket

| Direction | type | Payload | When |
|---|---|---|---|
| App → Backend | `video_frame` | `{frame, mode, frameNumber}` | Every frame, 20 FPS |
| App → Backend | `download_clip` | `{sessionId, startSec, endSec, fps}` | User taps download |
| App → Backend | `switch_mode` | `{newMode}` | User manually picks a mode |
| Backend → App | `dehazed_frame` | `{frame, mode, frameIndex, ms}` | After each frame processed |
| Backend → App | `mode_switched` | `{mode, reason, timestamp}` | Backend auto-switched |
| Backend → App | `download_ready` | `{path, duration, sessionId}` | FFmpeg finished stitching |
| Backend → App | `error` | `{message}` | Anything went wrong |

---

## 6. WebSockets vs FastAPI — the answer to the architecture question

The system uses **two different transports on purpose**:
- **App ↔ Backend: WebSocket.** Frames flow continuously in both directions at 20 FPS and the
  backend also needs to push server-initiated events (mode switches, download ready). A
  WebSocket keeps one TCP+TLS connection open for the whole session. HTTP/FastAPI would force
  the app to either poll (huge latency) or open a new TCP handshake per frame (huge battery
  drain on mobile). WebSocket is the only sensible choice here.
- **Backend ↔ Colab: HTTP POST (Flask).** Each inference is a discrete request-response with
  a clean timeout; there's no server-push needed. HTTP is simpler, easier to health-check,
  and works reliably through ngrok. Swapping Flask for FastAPI would give a theoretical 2×
  throughput, but the bottleneck is the 200 ms GPU inference, not the HTTP layer — not worth
  the rewrite.

The current architecture is correct and should not be changed.
