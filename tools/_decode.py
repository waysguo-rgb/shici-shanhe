import sys, base64
data = sys.stdin.read()
b64 = data.split(',', 1)[1] if ',' in data else data
img = base64.b64decode(b64)
with open('preview.jpg', 'wb') as f:
    f.write(img)
print(f"saved {len(img)} bytes")
