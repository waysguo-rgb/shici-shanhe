import sys
import base64
b64_data = sys.stdin.read().strip().strip('"')
img_bytes = base64.b64decode(b64_data)
with open('preview.jpg', 'wb') as f:
    f.write(img_bytes)
print(f"saved {len(img_bytes)} bytes")
