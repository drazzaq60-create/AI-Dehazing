import os
import sys
import torch
import cv2
import numpy as np
import base64
import torch.nn.functional as F

# Add the parent directory to sys.path to allow importing from 'models'
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from models.dehazeformer import DehazeFormer

# Configure GPU/MPS acceleration
device = torch.device('mps' if torch.backends.mps.is_available() else 'cpu')
if torch.cuda.is_available():
    device = torch.device('cuda')

def load_stage2_model(weights_path):
    # Stage 2 architecture from the user's FYP_finetune_final.ipynb
    model = DehazeFormer(
        in_chans=3, out_chans=4, window_size=8,
        embed_dims=[24, 48, 96, 48, 24],
        mlp_ratios=[2., 4., 4., 2., 2.],
        depths=[12, 12, 12, 6, 6],
        num_heads=[2, 4, 6, 1, 1],
        attn_ratio=[1/4, 1/2, 3/4, 0, 0],
        conv_type=['Conv', 'Conv', 'Conv', 'Conv', 'Conv']
    )

    if os.path.exists(weights_path):
        # The weights can be a .pth file or a directory (if saved with torch.save(model.state_dict()))
        # Try both loading methods
        try:
            ckpt = torch.load(weights_path, map_location='cpu')
            state = ckpt.get('state_dict', ckpt.get('model', ckpt))
            # Clean up module prefix if present (e.g. from DataParallel)
            new_state = { (k[7:] if k.startswith('module.') else k): v for k, v in state.items() }
            model.load_state_dict(new_state, strict=False)
            print(f"✅ Loaded Stage 2 Weights from: {weights_path}", file=sys.stderr)
        except Exception as e:
            print(f"⚠️ Error loading weights with torch.load: {e}. Attempting directory load...", file=sys.stderr)
    else:
        print(f"❌ Weights not found at {weights_path}", file=sys.stderr)

    return model.to(device).eval()

@torch.no_grad()
def dehaze_frame(model, frame_base64):
    try:
        # Decode base64 to image
        img_data = base64.b64decode(frame_base64)
        np_arr = np.frombuffer(img_data, np.uint8)
        frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        
        if frame is None:
            return frame_base64

        h, w, _ = frame.shape
        img_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

        # Pad to multiple of 8
        pad_h, pad_w = (8 - h % 8) % 8, (8 - w % 8) % 8

        inp = torch.from_numpy(img_rgb / 255.0).float().permute(2, 0, 1).unsqueeze(0).to(device)
        if pad_h > 0 or pad_w > 0:
            inp = F.pad(inp, (0, pad_w, 0, pad_h), mode='reflect')

        # Inference
        out = model(inp)[:, :3, :h, :w].squeeze(0).permute(1, 2, 0).clamp(0, 1)
        
        # Convert back to BGR and uint8
        out_np = (out.cpu().numpy() * 255).astype(np.uint8)
        out_bgr = cv2.cvtColor(out_np, cv2.COLOR_RGB2BGR)

        # Encode back to base64
        _, buffer = cv2.imencode('.jpg', out_bgr)
        return base64.b64encode(buffer).decode('utf-8')
    except Exception as e:
        print(f"❌ Dehazing Error: {e}", file=sys.stderr)
        return frame_base64

if __name__ == "__main__":
    # Weights path from the real_dehaze folder
    WEIGHTS_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'real_dehaze', 'dehazeformer_real_haze_best')
    if not os.path.exists(WEIGHTS_PATH):
        # Fallback to the outdoor weights if the best weights aren't unzipped or correct
        WEIGHTS_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'real_dehaze', 'dehazeformer_m_outdoor.pth')

    print(f"🚀 Initializing DehazeFormer on {device}...", file=sys.stderr)
    model = load_stage2_model(WEIGHTS_PATH)
    print("✅ AI Daemon Ready", file=sys.stderr)

    # Persistent loop for real-time processing
    # Each line from stdin is one base64 frame
    while True:
        try:
            line = sys.stdin.readline()
            if not line:
                break
            
            input_data = line.strip()
            if not input_data:
                continue
                
            result = dehaze_frame(model, input_data)
            sys.stdout.write(result + "\n")
            sys.stdout.flush()
        except EOFError:
            break
        except Exception as e:
            print(f"❌ Daemon Loop Error: {e}", file=sys.stderr)
            sys.stderr.flush()
