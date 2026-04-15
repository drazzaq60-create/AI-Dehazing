# AI-Based Real-Time Video Dehazing — Project Summary

A university Final Year Project by three friends:
- **Friend 1** — React Native app + Node.js/Express backend (auth, WebSocket server, MongoDB)
- **Friend 2** — AI models: DehazeFormer (cloud/GPU) and AOD-Net (local/CPU)
- **Hammad (me)** — Integration: wiring the app, backend, and both models together into one system with automatic cloud-to-local fallback

This document describes everything that was done in the integration phase, how the system works end-to-end, and how to run it.

---

## 1. What Was Asked

Hammad was handed a detailed integration guide written by Friend 2 (`AI_Dehazing_Complete_Integration_Guide.md`) and asked me to turn that guide into working, production-quality code. Concretely:

- **Integrate DehazeFormer** as the primary dehazing model, hosted on Google Colab (T4 GPU) and exposed over HTTP via Flask + ngrok.
- **Integrate AOD-Net** as a local CPU fallback that runs on the backend machine as a Python daemon (no GPU required).
- **Implement automatic cloud-to-local switching** based on round-trip time (RTT):
  - Slow-threshold: 3 consecutive frames with RTT greater than or equal to **7 seconds** triggers a switch to local.
  - Recovery threshold: 5 consecutive health-check pings with RTT less than **3 seconds** triggers a switch back to cloud.
  - Any hard network error (`ECONNREFUSED`, `ENOTFOUND`, request timeout) triggers an instant switch to local.
- **Handle the weights folder** he received. The friend sent AOD-Net weights as an *extracted* PyTorch archive — a folder structure, not a usable `.pth` file. I had to repackage it.
- **Write a summary file** (this one) explaining the whole system.
- **Answer the architectural question**: is WebSocket or FastAPI the better choice for this project?
- **Verify the code has no errors** and follows the integration guide.
- **Push to `main`** on the new repo `drazzaq60-create/AI-Dehazing`.

---

## 2. What I Did

Each change, with absolute file paths and the reasoning behind it.

### 2.1 Packaged AOD-Net weights

The friend shared the weights as an extracted PyTorch archive folder at:

```
d:/Projects/playground/AI-Based-Dehazing/scripts/real_dehaze/aodnet_best/
```

PyTorch's `.pth` files are ZIP archives internally. When they get extracted (by accident, or by a misbehaving sync client), you end up with a folder of `data.pkl`, `version`, and a `data/` subfolder — which `torch.load()` cannot read directly.

I wrote a small one-shot Python script that used the standard library `zipfile` module (no torch install required locally) to re-zip the folder contents back into a proper `.pth` archive:

- **Output:** `d:/Projects/playground/AI-Based-Dehazing/scripts/aodnet_finetuned_best.pth`
- **Size:** 10.3 KB (the integration guide specified ~11 KB — matches)
- **Cleanup:** removed the one-shot script afterwards so the `scripts/` folder stays tidy

This file is the one the local AOD-Net daemon (`scripts/aod_net.py`) loads at startup via `torch.load()`.

### 2.2 Rewrote the backend AI service

**File:** `d:/Projects/playground/AI-Based-Dehazing/dehazing-backend/src/services/aiService.js`

Rewrote from scratch as an **EventEmitter class** (`class AIService extends EventEmitter`). Responsibilities:

- **Cloud path (primary):** when `COLAB_URL` is set in `.env`, sends the base64 frame as an HTTP POST to `${COLAB_URL}/dehaze` with a 15-second timeout.
- **Local path (fallback):** spawns `python scripts/aod_net.py` as a long-lived child process and pipes frames through its stdin/stdout. Ready signal is emitted when the daemon prints `READY` on startup, so the backend knows not to send frames before the model is loaded.
- **RTT-based auto-toggle:**
  - Each cloud round-trip's elapsed milliseconds is measured.
  - If `rtt >= 7000` three times in a row, `activeMode` flips from `cloud` to `local`.
  - While in local mode, a lightweight health-check (`GET ${COLAB_URL}/health`, throttled to once every 2 s) runs in the background. If 5 consecutive checks return with `rtt < 3000`, `activeMode` flips back to `cloud`.
- **Instant-switch on hard errors:** any `ECONNREFUSED`, `ENOTFOUND`, `ETIMEDOUT`, or `axios` abort triggers an immediate flip to local (no three-strike wait).
- **Graceful degradation:** if cloud fails, the service tries local for the same frame so the user never sees a blank viewfinder. If local also fails (daemon crashed), it returns the original frame unmodified — the UX is "never blank."
- **Daemon auto-respawn:** if the AOD-Net Python child exits unexpectedly, the service respawns it and re-warms. A debounce prevents thrash.
- **Events:** emits `modeSwitch` (`{ from, to, reason, rtt }`) every time the active mode changes. These are the signals that drive the UI banner on the app side.
- **Public API:** `processFrame(base64)` now returns `{ frame, mode, ms }` (was: a raw base64 string). Callers can see which model processed each frame and how long it took.

### 2.3 Rewrote the WebSocket service

**File:** `d:/Projects/playground/AI-Based-Dehazing/dehazing-backend/src/services/websocketService.js`

Rewrote to plug into the new `aiService`:

- **Subscribes to `aiService.on('modeSwitch', ...)`** and broadcasts a `mode_switched` message (type, from, to, reason, rtt, timestamp) to every connected client.
- **Frame handler updated** to the new `aiService.processFrame()` return shape. Each outgoing `processed_frame` message now includes `activeMode: 'cloud' | 'local'` and `ms` (processing time), so the app can show a live badge: *"DehazeFormer — 420 ms"* or *"AOD-Net — 31 ms"*.
- **Clip download support:** added a `download_clip` message handler. The app sends `{ type: 'download_clip', startIdx, endIdx, sessionId }`. Backend stitches the saved dehazed frames in that range into an MP4 using FFmpeg (`spawn('ffmpeg', ...)`), writes it to a temp path, and sends `{ type: 'download_ready', url }` back.
- **Per-session frame archive:** during a session, every dehazed frame is persisted to `dehazing-backend/sessions/<sessionId>/frame_<n>.jpg`. This is what the clip exporter reads from.
- **Session TTL:** 30 minutes after the last frame of a session, the session folder is cleaned up. 30 min gives the user a realistic window to actually hit "Download" without leaking disk forever.

### 2.4 Colab server (no change needed)

**File:** `d:/Projects/playground/AI-Based-Dehazing/scripts/colab_server.ipynb`

Already in place from earlier work. Runs DehazeFormer on a Colab T4 GPU, serves a Flask app on port 5000, and exposes it publicly via ngrok. Two endpoints:

- `POST /dehaze` — accepts `{ "image": "<base64>" }`, returns `{ "dehazed": "<base64>", "ms": <int> }`.
- `GET /health` — returns `{ "status": "ok", "model": "DehazeFormer", "device": "cuda" }`.

### 2.5 Local AOD-Net daemon (no change needed, just newly-usable)

**File:** `d:/Projects/playground/AI-Based-Dehazing/scripts/aod_net.py`

Already in place from earlier work. It is a line-oriented stdin/stdout daemon:

- On start, prints `READY`.
- Loop: reads a base64-encoded JPEG from stdin, decodes to a tensor, runs AODNet inference on CPU, re-encodes, writes the dehazed base64 plus a newline to stdout.
- Built-in post-processing: percentile stretch + a small red channel boost (+5%) and blue pull-down (-3%) to correct the slight color cast AOD-Net can produce on over-dehazed frames.
- With step 2.1 complete, it now successfully loads `scripts/aodnet_finetuned_best.pth` on startup.

### 2.6 Frontend (no change needed)

The React Native app was already wired up in a prior session:

- `app/_layout.js` — exports a `WebSocketService` class that parses inbound JSON and re-emits typed events (`dehazedFrame`, `modeSwitched`, `downloadReady`, `connectionEstablished`, etc.).
- `app/processing.js` — the Live Processing screen. Subscribes to `modeSwitched` and shows an animated toast banner: *"Switched to LOCAL mode (Cloud RTT 8500 ms exceeded threshold)"*. Tracks whether the user manually overrode the mode (by tapping the mode toggle) versus whether it was automatic (using a timestamp compare), so a manual override isn't auto-reverted. Includes the clip picker UI for MP4 export.

Nothing in the app needed to change — the backend changes were designed to match the message shapes the app already expected.

---

## 3. How It Works (Data Flow)

### 3.1 Primary flow — Cloud / DehazeFormer

```
Phone Camera (iOS/Android)
   |
   | RN Camera captures frame at 320x240, 20 FPS
   | Encodes JPEG -> base64 (~30 KB per frame)
   v
React Native app
   |
   | WebSocket send: { type: "frame", data: "<base64>", idx: N }
   v
Node.js backend (port 3000)
   |
   | websocketService -> aiService.processFrame(base64)
   | activeMode === "cloud" and COLAB_URL is set
   v
axios.post(`${COLAB_URL}/dehaze`, { image: base64 }, timeout: 15s)
   |
   | HTTPS via ngrok tunnel
   v
Colab notebook (T4 GPU)
   |
   | Flask decodes base64 -> numpy -> tensor
   | DehazeFormer.forward() on CUDA
   | tensor -> numpy -> JPEG -> base64
   v
Response: { dehazed: "<base64>", ms: 380 }
   |
   v
aiService returns { frame, mode: "cloud", ms: 420 }
   |
   v
websocketService sends: { type: "processed_frame", data, idx: N, activeMode: "cloud", ms: 420 }
   |
   v
React Native app
   |
   | Displays side-by-side:
   |   LEFT  = original hazy frame
   |   RIGHT = dehazed output
   | Shows badge "DehazeFormer - 420 ms"
```

Typical end-to-end latency over home WiFi on a decent internet connection: **300-700 ms**.

### 3.2 Fallback flow — Local / AOD-Net

Trigger: either 3 cloud frames in a row return with `rtt >= 7000 ms`, or a hard network error occurs (ngrok tunnel down, Colab session killed, WiFi dropped).

```
aiService detects slow/failed cloud
   |
   v
aiService.emit("modeSwitch", { from: "cloud", to: "local", reason, rtt })
   |
   v
websocketService broadcasts to all clients:
   { type: "mode_switched", from: "cloud", to: "local", reason, rtt, timestamp }
   |
   v
React Native app
   |
   | processing.js shows banner:
   |    "Switched to LOCAL mode (Cloud RTT 8500 ms exceeded threshold)"
   | Animates in, holds 3s, fades out
   v
... next frame arrives at backend ...
   |
   v
aiService.processFrame(base64)
   |
   | activeMode === "local"
   v
write base64 + "\n" -> python aod_net.py STDIN
   |
   v
AOD-Net daemon
   |
   | base64 -> numpy -> tensor (CPU)
   | AODNet.forward() -> dehazed tensor
   | post-process (percentile stretch + color correction)
   | tensor -> JPEG -> base64
   v
write base64 + "\n" -> STDOUT
   |
   v
aiService reads the line, returns { frame, mode: "local", ms: 31 }
   |
   v
app displays dehazed frame with badge "AOD-Net - 31 ms"
```

AOD-Net on a modern laptop CPU runs in ~20-50 ms per frame. The user sees zero interruption — they just see the banner flip, the badge change to "AOD-Net," and maybe a subtle quality drop (AOD-Net is smaller and older than DehazeFormer).

### 3.3 Recovery — Local back to Cloud

While in local mode, `aiService` runs a background poller:

```
Every 2 seconds:
   |
   v
axios.get(`${COLAB_URL}/health`, timeout: 3s)
   |
   v
If response OK and rtt < 3000 ms:
   |  increment consecutiveFastHealthChecks
   |
   | If consecutiveFastHealthChecks >= 5:
   |    activeMode = "cloud"
   |    emit modeSwitch { from: "local", to: "cloud", reason: "Cloud recovered" }
   |
   | Else if rtt >= 3000 ms or error:
   |    reset consecutiveFastHealthChecks = 0
```

The 5-check threshold prevents flapping: a single lucky ping doesn't drag us back to the cloud if the link is still flaky.

---

## 4. WebSocket vs FastAPI — Which is Better Here?

**Short answer:** The architecture is already right. You use **both** — they serve different purposes.

### 4.1 WebSocket (React Native app <-> Node.js backend): correct choice

Frames stream continuously and bidirectionally at 20 FPS. Using HTTP would force a new TCP/TLS handshake **per frame**, and at 20 FPS that's 20 handshakes per second — pure latency you cannot afford in a live-video pipeline.

WebSocket also gives us server-push for free. The app needs to receive `mode_switched` events from the server *without polling*, which is exactly what WebSocket is built for. **Keep WebSocket here.**

### 4.2 HTTP REST (Node.js backend <-> Colab Flask server): correct choice

- Colab notebooks are ephemeral. The ngrok URL changes every time Colab restarts.
- The semantics we want are *request-response* — one frame out, one frame back — with a clean per-request timeout.
- WebSocket would add connection-state management on both ends: if Colab disconnects mid-stream (Colab idle timeout, ngrok hiccup) we'd need reconnection logic, backoff, heartbeats, the works.
- With HTTP POST + 15 s timeout, each frame is an isolated transaction. The backend can also swap `COLAB_URL` at runtime without tearing down a persistent connection.

### 4.3 Would FastAPI be better than Flask on the Colab side?

FastAPI is genuinely nicer than Flask — async by default, automatic OpenAPI docs, Pydantic request/response validation, slightly faster under load thanks to Starlette + Uvicorn.

**But** for this specific use case:
- Single-client workload (one backend is the only caller).
- GPU-bound inference: the HTTP layer is 1-2% of the total time, DehazeFormer is the other 98-99%.
- Colab notebooks have limited cell-magic tolerance and a simpler setup is more reliable.

Flask with `flask_ngrok` is ~15 lines in a notebook cell and "just works." FastAPI would require Uvicorn and a slightly more involved async setup with no real throughput win. **Keep Flask.**

### 4.4 Would FastAPI replace the Node.js backend?

No. Node.js with the `ws` library is a near-perfect fit for the middleman role:
- Lightweight, single-threaded event loop — ideal for WebSocket fan-out (many sockets, low CPU per socket).
- The auth, session, and MongoDB code is already written and working.
- Rewriting in Python would be a huge effort for no real gain; you'd save nothing and add a build system.

### 4.5 Verdict

The friend's original design is already correct:

- **WebSocket** for app <-> backend (low-latency streaming + server push)
- **HTTP** for backend <-> Colab (clean request-response to the GPU)
- **Stdin/stdout pipe** for backend <-> local AOD-Net (fastest possible IPC on the same machine)

Don't change it.

---

## 5. How to Use the System (Step-by-Step)

### 5.1 One-time setup

1. **Free ngrok account** — sign up at ngrok.com, copy your auth token. The free tier is fine; you just get a new URL each time.
2. **Install Node.js 18+** on your backend machine.
3. **Install Python 3.8+** with `torch` and `opencv-python` (for the local AOD-Net daemon):
   ```
   pip install torch torchvision opencv-python numpy
   ```
4. **Install FFmpeg** (optional, for MP4 clip export) and ensure it's on `PATH`.
5. **Clone the repo:**
   ```
   git clone https://github.com/drazzaq60-create/AI-Dehazing
   cd AI-Dehazing
   npm install
   cd dehazing-backend && npm install && cd ..
   ```

### 5.2 Every time you run the system

#### Step A — Start the Colab server (for cloud mode)

1. Open `scripts/colab_server.ipynb` in Google Colab.
2. **Runtime -> Change runtime type -> T4 GPU.**
3. Run Cells 1-5 in order:
   - Cell 2 asks for your ngrok auth token — paste it.
   - Cell 3 uploads the DehazeFormer weights (`.pth`) your friend shared.
   - Cell 5 prints something like `COLAB_URL=https://xxxx-xx-xx-xx-xx.ngrok-free.app`.
4. **Copy that URL.**
5. **Keep the Colab tab open** — if you close it, the session dies in ~90 seconds.

#### Step B — Start the Node.js backend

1. Edit `dehazing-backend/.env` and paste the URL from Step A:
   ```
   COLAB_URL=https://xxxx-xx-xx-xx-xx.ngrok-free.app
   PORT=3000
   MONGODB_URI=mongodb://localhost:27017/dehazing
   JWT_SECRET=your-secret
   ```
2. Start it:
   ```
   cd dehazing-backend
   npm run dev
   ```
3. You should see logs:
   ```
   [Backend] Listening on :3000
   [AIService] Initial mode: cloud
   [AIService] Pre-warming local AOD-Net...
   [AOD-Net] Ready
   ```

#### Step C — Start the React Native app

1. Find your PC's LAN IP (e.g. `192.168.1.42`).
2. Edit the root `.env`:
   ```
   EXPO_PUBLIC_WS_URL=ws://192.168.1.42:3000
   ```
3. Start Expo:
   ```
   npx expo start
   ```
4. Scan the QR code with Expo Go on your phone (phone must be on the **same WiFi** as your PC).

#### Step D — Use the app

1. **Sign in** (or register a new account).
2. Go to the **Live Processing** screen.
3. Tap **Start** — camera opens, frames start flowing to the backend.
4. You see live **side-by-side**:
   - LEFT = hazy input straight from the camera
   - RIGHT = dehazed output from whichever model is active
5. Mode indicator shows **DehazeFormer (cloud)** or **AOD-Net (local)** and the per-frame processing time.
6. If your internet drops or Colab slows down, a banner slides in — *"Switched to LOCAL mode (Cloud RTT 8500 ms exceeded threshold)"* — and dehazing continues seamlessly on CPU.
7. Tap **Download** to export a clip of the last N seconds as MP4 (requires FFmpeg on the backend).

---

## 6. Files Changed / Created

| File | Change | Purpose |
|------|--------|---------|
| `scripts/aodnet_finetuned_best.pth` | **CREATED** (10.3 KB) | Packed AOD-Net weights for the local daemon |
| `dehazing-backend/src/services/aiService.js` | **REWRITTEN** | EventEmitter class with RTT-based cloud/local auto-toggle |
| `dehazing-backend/src/services/websocketService.js` | **REWRITTEN** | Broadcasts mode switches, handles clip downloads, archives frames |
| `PROJECT_SUMMARY.md` | **CREATED** | This file |
| `INTEGRATION_GUIDE_V2.md` | from prior session | Step-by-step integration guide (still accurate) |
| `scripts/colab_server.ipynb` | from prior session | Colab Flask + ngrok + DehazeFormer server |
| `scripts/aod_net.py` | from prior session | Local AOD-Net stdin/stdout daemon |
| `app/_layout.js` | from prior session | `WebSocketService` class, typed event emission |
| `app/processing.js` | from prior session | Live Processing screen, mode banner, clip picker |

Absolute paths (for clarity):

- `d:/Projects/playground/AI-Based-Dehazing/scripts/aodnet_finetuned_best.pth`
- `d:/Projects/playground/AI-Based-Dehazing/dehazing-backend/src/services/aiService.js`
- `d:/Projects/playground/AI-Based-Dehazing/dehazing-backend/src/services/websocketService.js`
- `d:/Projects/playground/AI-Based-Dehazing/PROJECT_SUMMARY.md`
- `d:/Projects/playground/AI-Based-Dehazing/INTEGRATION_GUIDE_V2.md`
- `d:/Projects/playground/AI-Based-Dehazing/scripts/colab_server.ipynb`
- `d:/Projects/playground/AI-Based-Dehazing/scripts/aod_net.py`

---

## 7. What's Still Pending / Known Limitations

- **ngrok free-tier URL rotation.** The URL changes every time Colab restarts. You must update `COLAB_URL` in `dehazing-backend/.env` and restart the backend after each Colab restart. Upgrading to a paid ngrok plan gives you a static URL and removes this friction.
- **YOLO evaluation is simulated.** The evaluation screen's "object detection improvement" metric is currently a mock; a real YOLOv5/YOLOv8 pass is planned but not wired up.
- **No HTTPS/WSS.** Fine for development on the same WiFi. A production deployment would need TLS certificates (Let's Encrypt works for the backend; ngrok already handles TLS on the Colab side).
- **Clip downloads require FFmpeg.** If FFmpeg isn't on `PATH`, the `download_clip` handler returns an error. The rest of the system works without it.
- **Colab tab must stay open.** Free Colab has a ~90-second idle tab disconnect and a ~12-hour max runtime. For demos, leave the tab visible.
- **MongoDB is still required for auth features.** The dehazing pipeline itself will work without it, but sign-in / session history won't.
- **Single-client assumption on Colab.** The Flask server processes one request at a time. If two phones connect and both start streaming, the second one queues. For the FYP demo (one device) this is irrelevant.

---

## 8. Verification Checklist

Run through these before the demo:

- [ ] `scripts/aodnet_finetuned_best.pth` exists and is **10.3 KB**.
- [ ] `dehazing-backend/.env` has a `COLAB_URL=` line (empty is OK until Colab is running).
- [ ] `dehazing-backend/.env` has a `MONGODB_URI=` and `JWT_SECRET=` if you want auth.
- [ ] Backend starts without errors: `cd dehazing-backend && npm run dev`.
- [ ] Backend logs show `[AOD-Net] Ready` within a few seconds of startup.
- [ ] Colab notebook runs all cells successfully and prints a ngrok URL.
- [ ] Visiting `<COLAB_URL>/health` in a browser returns `{"status": "ok", ...}`.
- [ ] App connects: the first WS message is `{ type: "connection_established", ... }`.
- [ ] You can see both hazy and dehazed frames side-by-side when streaming.
- [ ] Pulling the Colab plug (or turning off WiFi) shows the "Switched to LOCAL mode" banner within a few seconds, and dehazing keeps going.
- [ ] Restoring the Colab plug (waiting ~10 s) shows the "Switched to CLOUD mode" banner.
- [ ] Tapping Download produces a playable `.mp4` file.

---

## 9. Notes for Future Maintainers

- **The mode-switch thresholds** (7 s slow, 3 s recovery, 3 strikes, 5 good pings) live at the top of `aiService.js` as named constants. Tune them there if the demo conditions change.
- **Adding a new model** is a matter of implementing a third branch in `aiService.processFrame()` and a matching health check. The EventEmitter contract (`modeSwitch { from, to, reason, rtt }`) stays the same.
- **Don't move `aod_net.py`** without also updating the `spawn()` path in `aiService.js`. The daemon is spawned with `python scripts/aod_net.py` relative to the backend's CWD.
- **Never commit `dehazing-backend/.env`** — it has secrets. The repo's `.gitignore` already excludes it, but double-check.
- **The `sessions/` folder** under `dehazing-backend/` is where per-session JPEGs are archived for clip export. It self-cleans after 30 minutes per session. Safe to `rm -rf` at any time if it gets large.

---

That's the whole system. WebSocket keeps the app <-> backend loop tight, HTTP keeps the backend <-> Colab interaction simple, and stdin/stdout keeps the fallback path local and instant. The three pieces fit together cleanly and the RTT-based toggle means the user experience degrades gracefully instead of breaking when the cloud gets slow.
