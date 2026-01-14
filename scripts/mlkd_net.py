# # import sys
# # frame = sys.argv[1]
# # print("dehazed_cloud_frame_placeholder")  # Simulate Map-Net output

# import sys

# # FIX: Read the Base64 data from stdin, not sys.argv[1]
# frame = sys.stdin.read().strip()

# # Check if data was received (good practice)
# if not frame:
#     sys.stderr.write("Error: Map-Net received no data from stdin.\n")
#     sys.exit(1)

# # TODO: Add your actual Map-Net processing logic here

# print("dehazed_cloud_frame_placeholder")  # Simulate Map-Net output


import cv2
import numpy as np
import base64
import sys
import time

def simulate_mlkd_net(frame):
    """Simulate MLKD-Net dehazing (replace with actual model)"""
    # Convert to LAB color space
    lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    
    # Apply CLAHE to L-channel
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    l_enhanced = clahe.apply(l)
    
    # Merge enhanced L-channel with original A and B
    lab_enhanced = cv2.merge([l_enhanced, a, b])
    
    # Convert back to BGR
    result = cv2.cvtColor(lab_enhanced, cv2.COLOR_LAB2BGR)
    
    # Apply guided filter for edge preservation
    result = cv2.ximgproc.guidedFilter(frame, result, radius=8, eps=0.01)
    
    # Adjust saturation
    hsv = cv2.cvtColor(result, cv2.COLOR_BGR2HSV)
    hsv[:, :, 1] = cv2.multiply(hsv[:, :, 1], 1.2)
    result = cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)
    
    return result

def dehaze_frame(frame_base64):
    """Main dehazing function for MLKD-Net"""
    try:
        # Decode base64
        frame_data = base64.b64decode(frame_base64)
        nparr = np.frombuffer(frame_data, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if frame is None:
            print("Error: Could not decode image", file=sys.stderr)
            return frame_base64
        
        # Process with simulated MLKD-Net
        processed = simulate_mlkd_net(frame)
        
        # Apply bilateral filter for noise reduction
        processed = cv2.bilateralFilter(processed, 9, 75, 75)
        
        # Sharpening
        kernel = np.array([[-1, -1, -1],
                          [-1,  9, -1],
                          [-1, -1, -1]])
        processed = cv2.filter2D(processed, -1, kernel)
        
        # Encode back to base64
        _, buffer = cv2.imencode('.jpg', processed, [cv2.IMWRITE_JPEG_QUALITY, 90])
        return base64.b64encode(buffer).decode('utf-8')
        
    except Exception as e:
        print(f"Error in MLKD-Net: {e}", file=sys.stderr)
        return frame_base64

if __name__ == "__main__":
    # Simulate processing delay (slightly longer than AOD-Net)
    time.sleep(0.08)
    
    input_data = sys.stdin.read()
    if input_data.strip():
        result = dehaze_frame(input_data)
        sys.stdout.write(result)
        sys.stdout.flush()