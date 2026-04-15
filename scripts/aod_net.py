"""
AOD-Net Local Fallback Daemon
- Reads base64-encoded JPEG frames from stdin (one per line)
- Outputs dehazed base64-encoded JPEG frames to stdout (one per line)
- Runs forever until killed by parent process (Node.js backend)
- No GPU required - CPU only, ~30ms per frame at 320x240
- On any failure (bad weights, bad frame, etc.) returns the ORIGINAL
  frame so the backend pipeline never blocks or crashes.
"""
import sys
import os
import cv2
import base64
import argparse
import traceback
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
        x1 = self.relu(self.e_conv1(x))
        x2 = self.relu(self.e_conv2(x1))
        x3 = self.relu(self.e_conv3(torch.cat([x1, x2], 1)))
        x4 = self.relu(self.e_conv4(torch.cat([x2, x3], 1)))
        k  = self.relu(self.e_conv5(torch.cat([x1, x2, x3, x4], 1)))
        return torch.clamp(k * x - k + 1, 0, 1)


def fix_colors(img_bgr):
    img = img_bgr.astype(np.float32)
    for c in range(3):
        lo = np.percentile(img[:, :, c], 1)
        hi = np.percentile(img[:, :, c], 99)
        img[:, :, c] = np.clip((img[:, :, c] - lo) / (hi - lo + 1e-6), 0, 1) * 255
    img[:, :, 2] = np.clip(img[:, :, 2] * 1.05, 0, 255)  # Red  +5%
    img[:, :, 0] = np.clip(img[:, :, 0] * 0.97, 0, 255)  # Blue -3%
    return img.astype(np.uint8)


def _extract_state_dict(ckpt):
    """Accept a checkpoint object in several known shapes and return a flat state_dict."""
    if isinstance(ckpt, dict):
        for key in ('model', 'state_dict', 'net', 'network'):
            if key in ckpt and isinstance(ckpt[key], dict):
                return ckpt[key]
        # Heuristic: if every value is a tensor, treat the dict itself as the state_dict.
        if all(hasattr(v, 'shape') for v in ckpt.values()):
            return ckpt
    # Fall back - caller will handle the error
    return ckpt


def _strip_module_prefix(state):
    if not isinstance(state, dict):
        return state
    return {(k[len('module.'):] if k.startswith('module.') else k): v for k, v in state.items()}


def load_weights(model, weights_path):
    """Try to populate model with trained weights. Returns True on success."""
    if not os.path.exists(weights_path):
        sys.stderr.write(f"[AOD-Net] WARNING: weights not found at {weights_path}\n")
        sys.stderr.flush()
        return False
    try:
        ckpt = torch.load(weights_path, map_location='cpu', weights_only=False)
        state = _extract_state_dict(ckpt)
        state = _strip_module_prefix(state)
        missing, unexpected = model.load_state_dict(state, strict=False)
        sys.stderr.write(f"[AOD-Net] Loaded: {weights_path}\n")
        if missing:
            sys.stderr.write(f"[AOD-Net] Missing keys: {list(missing)[:8]}\n")
        if unexpected:
            sys.stderr.write(f"[AOD-Net] Unexpected keys: {list(unexpected)[:8]}\n")
        sys.stderr.flush()
        return True
    except Exception as e:
        sys.stderr.write(f"[AOD-Net] ERROR loading weights: {e}\n")
        sys.stderr.write(traceback.format_exc())
        sys.stderr.flush()
        return False


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--weights', default='scripts/real_dehaze/aodnet_best')
    args = parser.parse_args()

    model = AODNet().eval()
    weights_loaded = load_weights(model, args.weights)
    if not weights_loaded:
        sys.stderr.write("[AOD-Net] Running WITHOUT trained weights - frames will pass through.\n")
        sys.stderr.flush()

    sys.stderr.write("[AOD-Net] Ready. Listening on stdin...\n")
    sys.stderr.flush()

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue

        try:
            raw = base64.b64decode(line)
            nparr = np.frombuffer(raw, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if frame is None:
                raise ValueError("cv2.imdecode returned None")

            if not weights_loaded:
                # Graceful degradation: return original frame re-encoded
                _, buf = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
                sys.stdout.write(base64.b64encode(buf).decode('utf-8') + '\n')
                sys.stdout.flush()
                continue

            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            inp = torch.from_numpy(rgb / 255.0).float().permute(2, 0, 1).unsqueeze(0)
            with torch.no_grad():
                out = model(inp).squeeze(0).permute(1, 2, 0).clamp(0, 1).numpy()
            clean = cv2.cvtColor((out * 255).astype(np.uint8), cv2.COLOR_RGB2BGR)
            clean = fix_colors(clean)

            _, buf = cv2.imencode('.jpg', clean, [cv2.IMWRITE_JPEG_QUALITY, 85])
            sys.stdout.write(base64.b64encode(buf).decode('utf-8') + '\n')
            sys.stdout.flush()

        except Exception as e:
            sys.stderr.write(f"[AOD-Net] Frame error: {e}\n")
            sys.stderr.flush()
            # Never crash, never block - echo the ORIGINAL base64 back
            try:
                sys.stdout.write(line + '\n')
                sys.stdout.flush()
            except Exception as ee:
                sys.stderr.write(f"[AOD-Net] Failed to echo original frame: {ee}\n")
                sys.stderr.flush()


if __name__ == '__main__':
    main()
