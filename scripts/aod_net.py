# # import sys
# # frame = sys.argv[1]
# # print("dehazed_local_frame_placeholder")  # Simulate AOD-Net output

# import sys

# # FIX: Read the Base64 data from stdin, not sys.argv[1]
# frame = sys.stdin.read().strip()

# # Check if data was received (good practice)
# if not frame:
#     sys.stderr.write("Error: AOD-Net received no data from stdin.\n")
#     sys.exit(1)

# # TODO: Add your actual AOD-Net processing logic here

# print("dehazed_local_frame_placeholder")  # Simulate AOD-Net output


import cv2
import numpy as np
import base64
import sys
import time

def simulate_aod_net(frame):
    """Simulate AOD-Net dehazing (replace with actual model)"""
    # Convert to float32 for processing
    frame_float = frame.astype(np.float32) / 255.0
    
    # Simulate atmospheric light estimation (simplified)
    dark_channel = cv2.erode(np.min(frame_float, axis=2), np.ones((15, 15), np.uint8))
    atmospheric_light = np.percentile(dark_channel, 99.9)
    
    # Simulate transmission map
    transmission = 1 - 0.95 * dark_channel / max(atmospheric_light, 0.1)
    transmission = np.clip(transmission, 0.1, 0.9)
    
    # Recover scene radiance
    result = np.zeros_like(frame_float)
    for i in range(3):
        result[:, :, i] = (frame_float[:, :, i] - atmospheric_light) / transmission + atmospheric_light
    
    # Clip and convert back
    result = np.clip(result * 255, 0, 255).astype(np.uint8)
    
    # Add some contrast enhancement
    result = cv2.convertScaleAbs(result, alpha=1.2, beta=10)
    
    return result

def dehaze_frame(frame_base64):
    """Main dehazing function"""
    try:
        # Decode base64
        frame_data = base64.b64decode(frame_base64)
        nparr = np.frombuffer(frame_data, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if frame is None:
            print("Error: Could not decode image", file=sys.stderr)
            return frame_base64
        
        # Process with simulated AOD-Net
        processed = simulate_aod_net(frame)
        
        # Apply additional enhancements
        processed = cv2.fastNlMeansDenoisingColored(processed, None, 10, 10, 7, 21)
        
        # Encode back to base64
        _, buffer = cv2.imencode('.jpg', processed, [cv2.IMWRITE_JPEG_QUALITY, 85])
        return base64.b64encode(buffer).decode('utf-8')
        
    except Exception as e:
        print(f"Error in AOD-Net: {e}", file=sys.stderr)
        return frame_base64

if __name__ == "__main__":
    # Persistent loop for real-time processing
    # Blocks until a new base64 line is received
    while True:
        try:
            line = sys.stdin.readline()
            if not line:
                # Actual EOF
                break
            
            input_data = line.strip()
            if not input_data:
                continue
                
            result = dehaze_frame(input_data)
            sys.stdout.write(result + "\n")
            sys.stdout.flush()
        except EOFError:
            break
        except Exception as e:
            sys.stderr.write(f"Error in daemon loop: {e}\n")
            sys.stderr.flush()