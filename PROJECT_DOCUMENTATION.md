# AI-Based Real-Time Video Dehazing — Full Project Documentation

**Last updated:** 2026-04-15
**Owner:** University FYP team
**This document:** complete, in-depth explanation of what the project is, how it
works, what was implemented in this iteration, how to set it up, and how to run it.

---

## Table of Contents

1. [What the project is](#1-what-the-project-is)
2. [High-level architecture](#2-high-level-architecture)
3. [The two AI models — and why there are two](#3-the-two-ai-models--and-why-there-are-two)
4. [**The cloud → local auto-switch feature (the big one)**](#4-the-cloud--local-auto-switch-feature-the-big-one)
5. [End-to-end data flow (every step a frame goes through)](#5-end-to-end-data-flow-every-step-a-frame-goes-through)
6. [WebSocket message protocol](#6-websocket-message-protocol)
7. [What was asked of me (the task brief)](#7-what-was-asked-of-me-the-task-brief)
8. [What I did (all changes in this iteration)](#8-what-i-did-all-changes-in-this-iteration)
9. [File / folder structure explained](#9-file--folder-structure-explained)
10. [How to set up the project (one-time)](#10-how-to-set-up-the-project-one-time)
11. [How to run the project (every session)](#11-how-to-run-the-project-every-session)
12. [How to use the app (end user)](#12-how-to-use-the-app-end-user)
13. [Troubleshooting](#13-troubleshooting)
14. [WebSockets vs FastAPI — the architecture question answered](#14-websockets-vs-fastapi--the-architecture-question-answered)

---

## 1. What the project is

A **mobile application that removes fog and haze from live camera video in real time**.
The user points their phone at a foggy or hazy scene and the app shows **two panels side
by side**:

- **LEFT panel** — the raw, hazy video straight from the phone camera
- **RIGHT panel** — the same frame, with the fog removed by AI

The whole thing is designed to work at roughly **20 frames per second** so it feels
like live video, not a slideshow.

### What makes it "smart"
Running large AI models on a phone is impractical — they're slow, drain the battery,
and need a GPU. So the system sends frames to a remote server with a real GPU (Google
Colab's T4) and gets dehazed frames back.

But what if the Wi-Fi drops? Or the Colab server gets slow because Google throttled
the free tier? Normal systems would just freeze. **This system quietly switches to a
smaller, weaker AI model that runs directly on the backend server's CPU** and keeps
going. When the cloud recovers, it switches back. The user doesn't have to do
anything — they just see a little banner flash on screen saying "Switched to LOCAL
mode".

### Project tech stack

| Layer | Technology |
|---|---|
| Mobile app | React Native + Expo, `react-native-vision-camera` |
| Backend server | Node.js + Express + `ws` (WebSocket library) |
| Cloud AI (primary) | Google Colab (free T4 GPU) running Flask + PyTorch + DehazeFormer |
| Local AI (fallback) | Python daemon on the backend machine running PyTorch + AOD-Net |
| Tunneling (cloud) | ngrok (exposes Colab's local Flask server to the public internet) |
| Video stitching | FFmpeg (stitches JPEG frames into MP4 for download) |
| Database | MongoDB (user accounts, session metadata) |

---

## 2. High-level architecture

```
                        ┌─────────────────────┐
                        │   Phone (Expo app)  │
                        │  LEFT: raw camera   │
                        │  RIGHT: dehazed     │
                        └──────────┬──────────┘
                                   │
                    WebSocket  (ws://backend:3000)
                       ▲ dehazed frames, mode events
                       ▼ raw frames at 20 FPS
                        ┌──────────┴──────────┐
                        │   Node.js Backend   │
                        │   (Express + ws)    │
                        │                     │
                        │   aiService.js      │  ← the "brain": decides
                        │   (auto-toggle)     │    which AI to use
                        └────┬────────────┬───┘
                             │            │
          HTTP POST /dehaze  │            │ stdin / stdout
          (when cloud OK)    │            │ (always available)
                             ▼            ▼
             ┌───────────────────┐   ┌──────────────────┐
             │ Google Colab T4   │   │ scripts/aod_net  │
             │  DehazeFormer     │   │ .py daemon       │
             │  (19 dB PSNR)     │   │  AOD-Net         │
             │  ~200ms per frame │   │  (14 dB PSNR)    │
             │                   │   │  ~30ms per frame │
             │  Needs internet.  │   │  CPU-only,       │
             │  High quality.    │   │  no internet.    │
             └───────────────────┘   └──────────────────┘
                  PRIMARY PATH            FALLBACK PATH
```

The key insight: **the app never talks to Colab directly**. It always talks to the
Node.js backend, which decides where the work actually happens. This means the app
doesn't have to care about network conditions — that's the backend's job.

---

## 3. The two AI models — and why there are two

Real-time dehazing is a hard problem. The best models are big and slow; the fast
models are small and produce worse results. You can't have everything. So the
project uses **two models** and picks the best one available at any given moment.

### 3A. DehazeFormer (the "cloud" / primary model)

- **What it is:** A Vision Transformer-based model specifically designed for image
  dehazing. Uses Shifted Window Attention (the same idea as Swin Transformer). Has
  a 5-stage encoder-decoder architecture.
- **Weight file:** `dehazeformer_real_haze_best.pth` (~54 MB)
- **How it was trained:** Started from the official DehazeFormer outdoor weights,
  then fine-tuned for 100 epochs on three real-world fog datasets: O-HAZE,
  DENSE-HAZE, and NH-HAZE. Final quality: **19.43 dB PSNR, 0.71 SSIM** on real
  outdoor haze.
- **Where it runs:** Google Colab (free tier, T4 GPU). A Flask HTTP server wraps
  the model and an ngrok tunnel exposes it to the public internet so the backend
  can reach it.
- **Speed:** ~200 ms per frame on a T4.
- **Why cloud:** The model is too big for CPU inference and most developer laptops
  don't have an NVIDIA GPU.

### 3B. AOD-Net (the "local" / fallback model)

- **What it is:** All-in-One Dehazing Network (ICCV 2017). A tiny 5-convolution
  network that learns a single "K(x)" map which encodes both atmospheric light and
  transmission. The math reformulates the classical haze equation `I(x) = J(x)·t(x) + A·(1-t(x))`
  into a single-output form: `J(x) = K(x)·I(x) - K(x) + b`. The network is so small
  (~100 KB of parameters) that it runs fast even without a GPU.
- **Weight file:** `aodnet_finetuned_best.pth` (~11 KB) — in our project this is
  stored as an extracted directory at `scripts/real_dehaze/aodnet_best/` (PyTorch
  archive format, same content).
- **How it was trained:** Started from official RESIDE-pretrained weights, then
  fine-tuned 50 epochs on O-HAZE + DENSE-HAZE + NH-HAZE (150 real-haze image pairs
  total). Loss: L1 + SSIM. Final quality: **14.17 dB PSNR** on real outdoor haze.
- **Where it runs:** On the backend server machine's CPU — the same machine that
  runs Node.js. A Python daemon process stays alive as long as the backend is up.
- **Speed:** ~30 ms per frame at 320×240 on a typical laptop CPU.
- **Why local:** It works without internet and it's so cheap we can run it on a
  developer laptop.

### Which one is "better"?
DehazeFormer is better — 5 extra decibels of PSNR is a significant visual
difference. But AOD-Net is good enough for the picture to not be a disaster when
the cloud is down, and that's the whole point of having a fallback.

### Post-processing for AOD-Net
AOD-Net has a slight known color bias (slightly blue-tinted, low contrast). To fix
it, the daemon applies a `fix_colors()` step after inference:
1. For each channel (R, G, B): rescale so the 1st percentile becomes black and the
   99th becomes white (percentile stretch — like a tiny auto-contrast).
2. Boost the red channel by 5 %, pull the blue channel down by 3 %.
The result looks noticeably cleaner than raw AOD-Net output.

---

## 4. The cloud → local auto-switch feature (the big one)

**This is the feature the FYP owner specifically asked about:** "if the cloud
isn't running, switch to local". It's fully implemented. Here's how it works in
detail.

### 4.1 The problem it solves
Three things can go wrong with the cloud path:

1. **Internet drops** — phone loses Wi-Fi, or the backend's connection dies.
2. **Colab throttles** — Google's free tier occasionally slows responses to 10+
   seconds per frame, which is unusable for "real-time".
3. **ngrok tunnel dies** — the free ngrok URL sometimes expires or gets rate-limited.

In all three cases, without automatic switching, the app would freeze. With
automatic switching, the app continues working (at slightly lower quality) and the
user is told what happened.

### 4.2 Where the logic lives
All of the auto-switch logic is in a single file:
[dehazing-backend/src/services/aiService.js](dehazing-backend/src/services/aiService.js).
It's a Node.js singleton that extends `EventEmitter`.

### 4.3 The state machine

The service tracks three pieces of state:
```javascript
this.mode = 'cloud';               // current mode — 'cloud' or 'local'
this.consecutiveSlowFrames = 0;    // how many Colab calls in a row took too long
this.consecutiveFastFrames = 0;    // how many /health checks came back fast
```

And four constants:
```javascript
this.SLOW_THRESHOLD_MS = 7000;   // "slow" means ≥ 7 seconds round-trip
this.FAST_THRESHOLD_MS = 3000;   // "fast" means < 3 seconds round-trip
this.SLOW_COUNT_LIMIT = 3;       // 3 slow frames → switch to local
this.FAST_COUNT_LIMIT = 5;       // 5 fast health checks → switch back to cloud
```

### 4.4 The switch-to-local rules

Every time a frame is sent to Colab, the backend measures the round-trip time
(RTT) with `Date.now()`:

```
Rule 1 — Slow cloud:
  If RTT ≥ 7000 ms:
    consecutiveSlowFrames += 1
    If consecutiveSlowFrames >= 3:
      → SWITCH TO LOCAL
      → Reason: "RTT <X>ms exceeded threshold"
  Else:
    consecutiveSlowFrames = 0  (any fast frame resets the counter)

Rule 2 — Cloud error:
  If the HTTP request throws (AbortError, ECONNREFUSED, ENOTFOUND, ECONNRESET,
  or any "network" / "fetch" error):
    → SWITCH TO LOCAL IMMEDIATELY
    → Reason: "Network/transport error: <message>"
```

### 4.5 The switch-back-to-cloud rules

Once in local mode, the backend needs to know when the cloud recovers. It can't
use regular frames for this (frames are going to the local daemon now). So it runs
a background **health probe**:

```
Every time a frame is processed by the local daemon:
  If mode == 'local' AND COLAB_URL is set AND no recovery probe is currently running:
    Fire-and-forget: GET ${COLAB_URL}/health with 3-second timeout
    (Does NOT block the frame response — probe runs in parallel)

    If the probe succeeds and RTT < 3000 ms:
      consecutiveFastFrames += 1
      If consecutiveFastFrames >= 5:
        → SWITCH BACK TO CLOUD
        → Reason: "Colab recovered (RTT <X>ms)"

    If the probe fails OR RTT >= 3000 ms:
      consecutiveFastFrames = 0
```

The Colab server has a `/health` endpoint (defined in
[scripts/colab_server.ipynb](scripts/colab_server.ipynb) Cell 5) that returns a
tiny JSON blob with `{status, device, frames, avg_ms}`. This endpoint is cheap, so
probing it every frame in local mode is fine.

### 4.6 What happens when a switch occurs

The `_switchTo(mode, reason)` method does four things:

```javascript
_switchTo(mode, reason) {
  if (this.mode === mode) return;           // no-op guard
  this.mode = mode;                         // flip the state
  this.consecutiveSlowFrames = 0;           // reset counters
  this.consecutiveFastFrames = 0;
  console.log(`[AIService] Switched to ${mode.toUpperCase()}: ${reason}`);
  this.emit('modeSwitch', { mode, reason }); // notify listeners
}
```

The `emit('modeSwitch', …)` call is where the magic connects to the app. The
WebSocket layer is listening:

```javascript
// In websocketService.js, wired once at startup:
aiService.on('modeSwitch', ({ mode, reason }) => {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        type: 'mode_switched',
        mode, reason,
        timestamp: Date.now()
      }));
    }
  });
});
```

So every connected app receives a `mode_switched` message the instant the switch
happens.

### 4.7 What happens on the app side

In [app/_layout.js](app/_layout.js), the WebSocket client now emits a typed
`modeSwitched` event when it receives this message. [app/processing.js](app/processing.js)
listens for it and:

1. Displays a banner at the top of the screen with the text "Switched to LOCAL mode — RTT 8120ms exceeded threshold" (fades in, holds for 4 seconds, fades out).
2. Updates the mode indicator in the status bar so it now shows LOCAL in orange instead of CLOUD in green.

Crucially, the manual mode-switcher buttons **still work** — the user can override
the automatic choice any time. The UI uses whichever mode signal is most recent
(user's click vs server's broadcast).

### 4.8 Timeline example

Here's what a real cloud-outage scenario looks like end-to-end:

```
t=0.0s   App connects to backend. Backend starts in CLOUD mode.
t=0.1s   First frame sent. Colab responds in 210ms. ✓
t=0.3s   Frame 2. Colab 205ms. ✓
...
t=5.0s   Wi-Fi glitch. Frame 101 hangs.
t=12.0s  Frame 101 finally times out (15s HTTP timeout, aborts earlier due to
         threshold check). RTT = 7200ms.
         consecutiveSlowFrames = 1. Stays on CLOUD.
t=12.3s  Frame 102 also slow: 8100ms. consecutiveSlowFrames = 2.
t=20.4s  Frame 103: 7500ms. consecutiveSlowFrames = 3. THRESHOLD HIT.
         → _switchTo('local', 'RTT 7500ms exceeded threshold')
         → emit('modeSwitch', {mode: 'local', ...})
         → WebSocket broadcast to all clients: type:'mode_switched'
         → App shows banner: "Switched to LOCAL mode"
         → App indicator flips to LOCAL (orange)
t=20.5s  Frame 104 now goes to the local AOD-Net daemon. ~30ms. ✓
t=20.6s  In parallel with frame 104's response, backend probes Colab /health:
         health check times out in 3s. consecutiveFastFrames stays at 0.
...
t=60.0s  Wi-Fi back. Frame 200 goes through local AOD-Net again.
         Probe to Colab /health now returns in 180ms. < 3000ms, so
         consecutiveFastFrames = 1.
t=60.1s  Frame 201: probe 170ms. consecutiveFastFrames = 2.
t=60.2s  Frame 202: probe 190ms. consecutiveFastFrames = 3.
t=60.3s  Frame 203: probe 200ms. consecutiveFastFrames = 4.
t=60.4s  Frame 204: probe 175ms. consecutiveFastFrames = 5. THRESHOLD HIT.
         → _switchTo('cloud', 'Colab recovered (RTT 175ms)')
         → App banner: "Switched to CLOUD mode"
t=60.5s  Frame 205 now goes back to Colab. ✓
```

### 4.9 What if the local daemon also fails?

Graceful degradation, all the way down:

- If the Python daemon crashes, it's auto-restarted 2 seconds later.
- If the daemon hangs for >5 s on any frame, the backend times out and returns the
  **original (hazy) frame** to the app. The user sees unprocessed video but the
  stream keeps going.
- If the weights file is missing or corrupt, the daemon logs `[AOD-Net] WARNING`
  to stderr and enters pass-through mode — every frame goes in and comes out
  unchanged.

The design rule: **never crash, never block the pipeline.** At the worst, the user
sees raw camera video, which is still better than a frozen app.

---

## 5. End-to-end data flow (every step a frame goes through)

Walk through a single frame to see where the code executes:

### Step 1 — Camera capture
File: [app/capture.js](app/capture.js)
The `react-native-vision-camera` library grabs a frame, downsizes it to 320×240,
encodes it as a JPEG, and base64-encodes the bytes.

### Step 2 — App sends frame over WebSocket
File: [app/_layout.js](app/_layout.js) (the `WebSocketService` class)
```json
{"type":"video_frame","frame":"<base64 JPEG>","mode":"cloud","frameNumber":142}
```

### Step 3 — Backend receives frame
File: [dehazing-backend/src/services/websocketService.js](dehazing-backend/src/services/websocketService.js)
`handleVideoFrame()` is called. It extracts the base64, the requested mode, and
the frame number, then calls `aiService.processFrame(base64, requestedMode)`.

### Step 4 — aiService routes the frame
File: [dehazing-backend/src/services/aiService.js](dehazing-backend/src/services/aiService.js)
```javascript
const useCloud = (requestedMode === 'cloud') && this.colabUrl && (this.mode === 'cloud');
if (useCloud) return this._processViaColab(frameBase64);
else         return this._processViaAOD(frameBase64);
```
Both paths return `{frame, mode, ms, error?}`.

### Step 5a — Cloud path
- Measures `t0 = Date.now()`
- Sends `POST ${COLAB_URL}/dehaze` with body `{frame: base64}`, 15 s timeout
- When Colab responds, calculates RTT, updates slow/fast counters, possibly
  triggers a switch
- Returns the dehazed base64 from Colab

### Step 5b — Local path
- Writes `base64 + "\n"` to the AOD-Net daemon's stdin
- Adds a resolver to a queue (`_aodResolvers`)
- A chunk-reassembly stdout parser picks up whole lines and resolves the queued
  resolver in FIFO order — this handles multiple frames being in flight at once
- Fires the background Colab health probe (fire-and-forget)
- Returns the dehazed base64 from the daemon

### Step 6 — Python daemon processes the frame (local path only)
File: [scripts/aod_net.py](scripts/aod_net.py)
- Reads one line from stdin
- Decodes base64 → JPEG bytes → numpy array via `cv2.imdecode`
- BGR → RGB, normalize to [0, 1], make torch tensor
- Runs `AODNet.forward(x) = clamp(k·x - k + 1, 0, 1)`
- Tensor → numpy → BGR
- Applies `fix_colors()` (percentile stretch + R/B trim)
- Encodes JPEG at quality 85 → base64
- Writes `base64 + "\n"` to stdout

### Step 7 — Backend saves frame (for recording feature)
Back in `websocketService.js`, the dehazed JPEG is written to
`tmp/<sessionId>/dehazed_<n>.jpg` so the user can later request a clip download.

### Step 8 — Backend sends dehazed frame to app
```json
{"type":"dehazed_frame","frame":"<base64 dehazed JPEG>","mode":"cloud","frameIndex":142,"ms":203}
```
(Also emitted as `processed_frame` for backward compat with older app builds.)

### Step 9 — App displays the frame
File: [app/processing.js](app/processing.js)
The new frame updates the RIGHT panel. The LEFT panel always shows the raw camera
feed in real time (never waits on the backend).

### Step 10 — (Optional) Mode-switch notification
If `_switchTo()` fires during step 5a or 5b, the WebSocket layer broadcasts
`{type:'mode_switched', mode, reason, timestamp}` to every connected client.
The app shows a banner.

---

## 6. WebSocket message protocol

All messages are JSON strings.

### App → Backend

| `type` | Payload | Sent when |
|---|---|---|
| `video_frame` | `{frame, mode, frameNumber}` | Every captured frame (~20 FPS) |
| `switch_mode` | `{newMode}` | User taps mode button |
| `download_clip` | `{sessionId, startSec, endSec, fps}` | User confirms clip download |
| `start_session` | (varies) | User begins recording |
| `stop_session` | (varies) | User ends recording |

### Backend → App

| `type` | Payload | Sent when |
|---|---|---|
| `dehazed_frame` | `{frame, mode, frameIndex, ms}` | Every processed frame returned |
| `processed_frame` | (legacy alias for `dehazed_frame`) | Same — kept for old builds |
| `mode_switched` | `{mode, reason, timestamp}` | Backend auto-toggled modes |
| `download_ready` | `{path, duration, sessionId}` | FFmpeg finished stitching the clip |
| `session_created` | `{sessionId}` | Server created a recording session |
| `video_ready` | (existing feature) | Full-session video ready |
| `error` | `{message}` | Any backend error |

---

## 7. What was asked of me (the task brief)

The FYP student sent a detailed integration guide
([scripts/AI_Dehazing_Complete_Integration_Guide.md](scripts/AI_Dehazing_Complete_Integration_Guide.md))
and asked that the existing partially-built codebase be brought up to the spec.
Specifically:

1. **Implement the cloud → local automatic switch** exactly as described in
   section 4 of the guide. If Colab gets slow (≥ 7 s for 3 consecutive frames) or
   the internet dies, the backend should switch to the local AOD-Net daemon
   automatically. When Colab recovers (< 3 s for 5 consecutive health checks),
   switch back. The app should be notified so the UI can update.

2. **Make the local AOD-Net daemon real.** The existing `scripts/aod_net.py` was
   a placeholder that used dark-channel-prior math, not the actual trained
   AOD-Net model. Replace it with real PyTorch inference loading the fine-tuned
   weights (which were provided as `scripts/real_dehaze/aodnet_best/`).

3. **Add the side-by-side display and the time-range clip download** in the app
   per guide sections 3 and 7.

4. **Write a document explaining the architecture, what was done, and how to run
   the system** — the FYP student doesn't know Node.js well and needed something
   comprehensive.

5. **Answer the WebSockets vs FastAPI question** — whether the current transport
   choice is right.

6. **Push everything to GitHub** when done.

---

## 8. What I did (all changes in this iteration)

Four parallel sub-agents made isolated, non-overlapping changes. Every change was
syntax-checked before reporting done.

### 8.1 Backend — `dehazing-backend/`

**File: [dehazing-backend/src/services/aiService.js](dehazing-backend/src/services/aiService.js)** — full rewrite (282 lines).

What changed:
- The class now extends Node's `EventEmitter` (built-in `events` module).
- Added state fields `mode`, `consecutiveSlowFrames`, `consecutiveFastFrames` and
  the four threshold constants.
- Added `_processViaColab()` that measures RTT, updates the slow counter, and
  calls `_switchTo('local', …)` when the counter hits the limit. On any network
  error (AbortError, ECONNREFUSED, ENOTFOUND, ECONNRESET) it switches to local
  immediately. Always returns `{frame, mode, ms, error?}` — never throws,
  never crashes the stream.
- Added `_processViaAOD()` using a queue-based stdout parser so multiple frames
  can be in flight at once. Fires the recovery probe in the background (does not
  block the response). Has a 5 s safety timeout so a stuck daemon can't freeze
  the pipeline.
- Added `_checkColabRecovery()` that does `GET /health` with a 3 s timeout,
  updates the fast counter, and calls `_switchTo('cloud', …)` after 5
  consecutive fast responses.
- Added `_switchTo(mode, reason)` that guards against no-op, resets counters,
  logs, and emits `'modeSwitch'`.
- Preserved: AOD daemon auto-restart on exit, base64 data-URI stripping,
  `ngrok-skip-browser-warning` header, MongoDB/Express/routes wiring.

**File: [dehazing-backend/src/services/websocketService.js](dehazing-backend/src/services/websocketService.js)** — two targeted inserts.

What changed:
- At WSS init, added a one-time listener:
  `aiService.on('modeSwitch', …)` that broadcasts `{type:'mode_switched', …}` to
  every connected client.
- `handleVideoFrame()` now unwraps the new result object and emits both
  `processed_frame` (legacy) and `dehazed_frame` (guide-compliant) so old and
  new app builds both work.
- Everything else — session recording, 30-min cleanup, auth, MongoDB,
  FFmpeg generation — left alone.

**File: [dehazing-backend/.env.example](dehazing-backend/.env.example)** — created.
```
PORT=3000
COLAB_URL=
```

### 8.2 Python daemon — `scripts/`

**File: [scripts/aod_net.py](scripts/aod_net.py)** — full rewrite (~140 lines).

What changed:
- Removed the old placeholder that simulated dehazing with dark-channel-prior math.
- Added the real `AODNet` PyTorch module (5 convolutions matching the guide's
  architecture exactly).
- Added `fix_colors()` post-processing (percentile stretch + R+5% / B-3%).
- Added `argparse` with `--weights` flag (default `scripts/real_dehaze/aodnet_best`).
- Added a compatibility shim `_extract_state_dict()` that handles multiple
  checkpoint shapes: dict with `model` key, dict with `state_dict` key,
  `net`/`network` keys, or the object itself being the state_dict.
- Added `_strip_module_prefix()` to handle DataParallel-saved weights.
- Uses `torch.load(path, map_location='cpu', weights_only=False)` which works for
  both `.pth` files and extracted-archive directories (this matters — your weights
  are stored as a directory, not a single file).
- Per-frame try/except: on any exception, logs `[AOD-Net]` to stderr and echoes
  the original frame back. Never crashes, never blocks.
- Main loop reads stdin line-by-line and writes to stdout + `flush()` after every
  frame (so Node.js gets responses immediately instead of buffered chunks).

### 8.3 App — `app/`

**File: [app/_layout.js](app/_layout.js)** — `WebSocketService` class updated.

What changed:
- `onmessage` handler now switches on `data.type` and emits typed events
  (`dehazedFrame`, `modeSwitched`, `downloadReady`) alongside the existing generic
  `message` event (backward compatible).
- Added a `getHttpBaseURL()` helper and exported `HTTP_BASE_URL` so downloadable
  files can be opened via `Linking.openURL`.

**File: [app/processing.js](app/processing.js)** — three additions.

What changed:
- Subscribes to the `modeSwitched` event and shows an `Animated.View` banner at
  the top of the screen for ~4 seconds (fades in 200 ms, holds 4 s, fades out
  500 ms). The banner text includes the reason (e.g., "RTT 8120ms exceeded
  threshold") so students can see the auto-switch working during demo.
- Added `autoMode` / `userModeTimestamp` / `autoModeTimestamp` state. The mode
  indicator reads from whichever signal is most recent so user overrides still
  work.
- Added a time-range clip picker: two numeric `TextInput`s (startSec / endSec)
  with inline validation. On confirm, sends
  `{type:'download_clip', sessionId, startSec, endSec, fps:20}`. On
  `downloadReady`, opens the URL via `Linking.openURL` for the browser to handle
  the download.

### 8.4 Documentation

**File: [WHAT_WAS_IMPLEMENTED.md](WHAT_WAS_IMPLEMENTED.md)** — an earlier,
shorter summary (kept for reference).

**File: [PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md)** — this document.
Full explanation of what the project is, how it works, and how to run it.

---

## 9. File / folder structure explained

```
AI-Based-Dehazing/
├── PROJECT_DOCUMENTATION.md           ← THIS FILE
├── WHAT_WAS_IMPLEMENTED.md            ← older, shorter summary
├── INTEGRATION_GUIDE.md               ← earlier integration notes (v1)
├── INTEGRATION_GUIDE_V2.md            ← earlier integration notes (v2)
├── CODEBASE_AUDIT.md                  ← previous structural audit
├── VIDEO_FEATURE_AUDIT.md             ← download-feature audit (notes FFmpeg gap)
│
├── app/                               ← React Native (Expo) mobile app
│   ├── _layout.js                     ← app shell, WebSocket client class
│   ├── processing.js                  ← main live-dehazing screen (side-by-side)
│   ├── capture.js                     ← camera frame capture (vision-camera)
│   ├── index.js                       ← home screen
│   └── (auth screens, settings, etc.)
│
├── components/                        ← shared React components
│   └── VideoRecorder.js               ← recording UI (start/stop/timer)
│
├── dehazing-backend/                  ← Node.js + Express backend
│   ├── src/
│   │   ├── server.js                  ← Express app + WebSocket server on :3000
│   │   ├── services/
│   │   │   ├── aiService.js           ← CLOUD ↔ LOCAL auto-toggle brain
│   │   │   └── websocketService.js    ← frame handler + mode_switched broadcast
│   │   ├── controllers/
│   │   │   └── realtimeController.js  ← /download/:sessionId endpoint
│   │   ├── routes/
│   │   └── models/                    ← MongoDB schemas
│   ├── package.json
│   ├── .env                           ← secrets (committed for collaborators)
│   └── .env.example                   ← template (no secrets)
│
├── scripts/                           ← AI models + Colab notebook
│   ├── AI_Dehazing_Complete_Integration_Guide.md   ← the spec from FYP owner
│   ├── colab_server.ipynb             ← run cells 1-5 in Colab, get URL
│   ├── aod_net.py                     ← LOCAL AOD-Net daemon (CPU)
│   ├── dehazeformer_daemon.py         ← legacy DehazeFormer local daemon
│   ├── DehazeFormer/                  ← cloned GitHub model code (used by Colab)
│   │   └── models/dehazeformer.py
│   └── real_dehaze/                   ← trained weight files
│       ├── aodnet_best/               ← AOD-Net weights (extracted archive)
│       ├── dehazeformer_real_haze_best/   ← DehazeFormer weights (extracted)
│       ├── dehazeformer_m_outdoor.pth ← older 19 MB DehazeFormer weights
│       └── FYP_finetune_final.ipynb   ← training notebook
│
└── tmp/                               ← (auto-created) per-session frame storage
    └── <sessionId>/
        └── dehazed_000001.jpg, ...
```

---

## 10. How to set up the project (one-time)

You need to do these steps **once** per development machine.

### 10.1 Install system tools
You need:
- **Node.js** version 18 or newer ([nodejs.org](https://nodejs.org))
- **Python** 3.10 or 3.11 ([python.org](https://python.org))
- **FFmpeg** — required for the clip-download feature
  - Windows: `winget install ffmpeg` (or download from `gyan.dev/ffmpeg/builds/` and add `ffmpeg.exe` to PATH)
  - Verify: `ffmpeg -version` should print a banner
- **MongoDB** running on `mongodb://localhost:27017` (or update `MONGO_URI` in `.env`)
- **Git** ([git-scm.com](https://git-scm.com))

### 10.2 Install Python AI dependencies
In a terminal:
```bash
pip install torch torchvision opencv-python numpy
```
Verify:
```bash
python -c "import torch, cv2, numpy; print('ok')"
```

### 10.3 Install backend Node.js dependencies
```bash
cd dehazing-backend
npm install
```

### 10.4 Install app dependencies
```bash
cd ..         # back to project root
npm install   # this installs the React Native / Expo app deps (root package.json)
```

### 10.5 Verify the trained weights exist
Both should already be in the repo:
- `scripts/real_dehaze/aodnet_best/` (AOD-Net local fallback weights — directory form)
- `scripts/real_dehaze/dehazeformer_real_haze_best/` (DehazeFormer weights — you'll upload these to Colab)

### 10.6 Set up ngrok (free account, one-time)
1. Sign up at [ngrok.com](https://ngrok.com) (free).
2. Go to Dashboard → Your Auth Token → copy it.
3. You'll paste this into the Colab notebook in step 11.1 below.

### 10.7 Configure the backend `.env`
In `dehazing-backend/.env`:
```
PORT=3000
MONGO_URI=mongodb://localhost:27017/dehazing_db
COLAB_URL=                          ← leave empty for now, fill in at step 11.2
JWT_SECRET=<any long random string>
```

### 10.8 Configure the app's backend URL
The app needs to know where your backend is running. Edit the `.env` in the
project root (for Expo) or in `app/`:
```
EXPO_PUBLIC_WS_URL=ws://<YOUR_PC_LAN_IP>:3000
```
Find your PC's LAN IP with `ipconfig` (Windows) or `ifconfig` / `ip a` (mac/Linux) —
look for something like `192.168.1.42`. It must be the IP your phone can reach
(same Wi-Fi network).

---

## 11. How to run the project (every session)

Four things need to be running: Colab (cloud AI), the backend, MongoDB, and the app.

### 11.1 Start Colab (cloud AI)
1. Open [scripts/colab_server.ipynb](scripts/colab_server.ipynb) in Google Colab.
2. **Runtime → Change runtime type → T4 GPU** (important — without GPU this is too slow).
3. Run Cell 1 — installs Flask, pyngrok, timm, einops, clones DehazeFormer.
4. Run Cell 2 — paste your ngrok auth token.
5. Run Cell 3 — upload `dehazeformer_real_haze_best.pth` when prompted (54 MB).
6. Run Cell 4 — loads the model onto the T4 GPU. Should print "DehazeFormer loaded!".
7. Run Cell 5 — starts the Flask server and an ngrok tunnel. **Copy the printed `COLAB_URL`** — it looks like `https://xxxx-xx-xxx-xxx-xxx.ngrok-free.app`.
8. (Optional) Cell 6 — sends a test frame to confirm everything works.

### 11.2 Paste the Colab URL into backend
Edit `dehazing-backend/.env`:
```
COLAB_URL=https://xxxx-xx-xxx-xxx-xxx.ngrok-free.app
```
If this is left empty, the backend starts in LOCAL-only mode (AOD-Net only).

### 11.3 Start MongoDB
Usually just: `mongod` in a terminal, or start the MongoDB service from your OS.

### 11.4 Start the backend
```bash
cd dehazing-backend
npm run dev
```
You should see:
```
==================================================
[AIService] Cloud: Colab @ https://xxxx-xx-xxx-xxx-xxx.ngrok-free.app
[AIService] Local: AOD-Net daemon (.../scripts/aod_net.py)
==================================================
[AOD-Net] Loaded: scripts/real_dehaze/aodnet_best
[AOD-Net] Ready. Listening on stdin...
Server listening on :3000
```

If you see `[AOD-Net] WARNING: weights not found` or `[AOD-Net] Failed to spawn:
... No module named 'torch'`, go back to step 10.2 and install Python deps.

### 11.5 Start the app
```bash
cd ..          # back to project root
npx expo start
```
This prints a QR code. On your phone:
1. Install **Expo Go** from the App Store / Play Store.
2. Scan the QR code.
3. The app loads. Make sure your phone is on the **same Wi-Fi as your PC**.

---

## 12. How to use the app (end user)

1. **Sign in** on the app (auth flow uses MongoDB + JWT — standard email/password).
2. Tap **Real-time Processing** (or similar label) on the main screen.
3. Grant camera permission when prompted.
4. Tap **Start Real-time Processing**. The screen splits into two panels.
5. Point the camera at a foggy/hazy scene. The LEFT panel shows raw camera; the
   RIGHT panel shows the AI-dehazed version.
6. The top of the screen shows the current mode (CLOUD or LOCAL). You can tap it
   to force a specific mode.
7. If the internet drops or Colab gets slow, a banner flashes saying "Switched to
   LOCAL mode — RTT 8120ms exceeded threshold". The RIGHT panel keeps working
   using the local AOD-Net model.
8. **To download a clip**:
   - Tap "Download Clip (Pick Range)".
   - Enter a start second and end second (e.g., 5 and 12 for a 7-second clip).
   - Tap Download. The backend stitches frames into MP4 with FFmpeg and opens
     the download URL in your phone's browser.

---

## 13. Troubleshooting

### "Backend won't start — AOD-Net daemon keeps crashing"
Run `python -c "import torch, cv2, numpy; print('ok')"` in the same Python
interpreter that the backend spawns. If any import fails, install the missing
package with `pip install <name>`. On Windows, if you use multiple Pythons make
sure the right one is on PATH.

### "App shows 'Connected' but no dehazed frames"
- Check the backend console — is it logging `[AIService] Cloud slow: <ms>`? If so,
  your Colab is being throttled. Wait a few seconds for the auto-switch to kick
  in, or manually tap LOCAL mode in the app.
- Check that the Colab cell 5 server is still running (Colab free tier times out
  after ~12 hours idle).

### "Download button does nothing / 404 error"
- Check that `ffmpeg` is on PATH: `ffmpeg -version` in a fresh terminal.
- Check that the `tmp/<sessionId>/` directory has actual JPEG files (the session
  had to record frames before there's anything to download).

### "Colab URL keeps changing"
This is normal for the free ngrok tier. Every time you restart the Colab cell 5,
you get a new URL. Paste the new one into `.env` and restart the backend.

### "Mode switch banner never appears"
The banner only appears when the backend AUTO-switches, not when the user
manually taps a mode button. To test: start the backend with COLAB_URL set, then
kill your Wi-Fi. Within ~30 seconds the banner should pop up saying "Switched to
LOCAL mode".

---

## 14. WebSockets vs FastAPI — the architecture question answered

**TL;DR: Keep both transports. The design is correct.**

The system uses two transports on purpose, each chosen for its traffic pattern:

### App ↔ Backend uses WebSocket. Why?
- Frames flow at 20 FPS continuously — a one-way HTTP request per frame would
  mean 20 new TCP+TLS handshakes per second. That's prohibitively expensive on
  mobile (battery, latency, data usage).
- The backend needs to **push** events to the app: mode-switch notifications,
  download-ready signals. HTTP is one-way (client asks, server answers). Without
  WebSocket you'd need polling (high latency) or Server-Sent Events (one-way only,
  so you'd still need HTTP for the upload direction).
- A single WebSocket keeps one TCP connection alive for the whole session. This
  is literally what WebSockets were designed for.

### Backend ↔ Colab uses HTTP POST (Flask). Why?
- Each inference is a discrete request-response. There's no "streaming" from
  Colab's side — Colab does one inference and returns.
- HTTP has clean timeouts. The backend can enforce "give me an answer in 15 s or
  I give up" with a simple `req.timeout = 15000`. WebSockets don't have per-
  message timeouts — you'd have to reimplement that.
- The Colab `/health` endpoint is just a GET. Trivial to implement in Flask,
  messy in a WebSocket protocol.
- ngrok free-tier WebSocket tunnels are less stable than HTTP tunnels.

### Would FastAPI be better than Flask on Colab?
FastAPI is async-first and in theory can handle ~2× the concurrent requests
Flask can. But here's the thing: the bottleneck is the 200 ms GPU inference, not
the HTTP layer. Swapping Flask for FastAPI would save at most a few milliseconds
per request and would cost several hours of rewrite + debug time. Not worth it
for the FYP.

If, post-FYP, the project grows to support many concurrent users on the same
Colab instance, then revisit — async really does help at 10+ concurrent
requests. But for a demo / single-user / small-class use case, Flask is fine.

### Summary
| Boundary | Transport | Reason |
|---|---|---|
| App ↔ Backend | WebSocket | Streaming + server push |
| Backend ↔ Colab | HTTP POST | Discrete requests + clean timeouts |
| Backend ↔ Local daemon | stdin / stdout pipe | Zero network, lowest latency |

Each transport is chosen specifically for its job. The architecture is correct
and should not be changed.

---

## End of document

If anything in this document doesn't match the code, the code is the source of
truth — update the doc. Good luck with the FYP demo.
