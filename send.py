import socket
import sys
from pprint import pprint
import os.path

from PIL import Image, ImageDraw, ImageFont


try:
    _, device, img_file = sys.argv
except:
    print("usage: send.py [bl:ue:to:ot:h0] [filename.png]")
    exit(1)

# -- handle image

if os.path.isfile(img_file):
    img = Image.open(img_file)
else:
    img = Image.new("1", (384, 240), color=1)
    draw = ImageDraw.Draw(img)
    for size in range(100, 1, -1):
        font = ImageFont.truetype(
            font="/usr/share/fonts/OTF/CascadiaCode-Regular.otf", size=size
        )
        if draw.textlength(img_file, font=font) <= 323:
            break
    draw.text((10, 10), img_file, font=font)

if img.height > img.width:
    img = img.transpose(Image.ROTATE_90)

if 323 / img.width * img.height <= 240:
    img = img.resize(size=(323, int(323 / img.width * img.height)))
else:
    img = img.resize(size=(int(240 / img.height * img.width), 240))

imgborder = Image.new("1", (384, 240), color=1)
imgborder.paste(img, (61, 0))
img = imgborder

# -- print

buf = []
buf += [0x1B, 0x40]
buf += [0x1D, 0x76, 0x30, 0x0]

width = img.width
height = img.height
width8 = width // 8

buf += [width8 & 0xFF, width8 >> 8]
buf += [height & 0xFF, height >> 8]

ibuf = [0] * height * width8
for y in range(height):
    for x in range(width):
        if img.getpixel((x, y)) == 0:
            ibuf[x // 8 + y * width8] |= 1 << (7 - (x & 7))
ibuf = [b if b != 0x0A else 0x14 for b in ibuf]

buf += ibuf

# -- send

with open("out.bin", "wb") as f:
    f.write(bytes(buf))
exit(1)

sock = socket.socket(socket.AF_BLUETOOTH, socket.SOCK_STREAM, socket.BTPROTO_RFCOMM)
sock.bind((socket.BDADDR_ANY, 1))
sock.connect((device, 1))
sock.sendall(bytes(buf))
sock.recv(1024)
sock.close()
