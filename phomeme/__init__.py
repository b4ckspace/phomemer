from io import BytesIO
from multiprocessing import Lock
import os
import socket

from PIL import Image, ImageDraw, ImageFont
from flask import Flask, request, make_response, redirect, jsonify
from flask_cors import CORS

DEVICE = os.environ["PHOMEMO_BT_MAC"]


app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 40 * 1024 * 1024
app.config["UPLOAD_FOLDER"] = "uploads"
app.printlock = Lock()
CORS(app)


@app.route("/")
def index():
    return redirect("/index.html")


@app.route("/<path:static>")
def static_helper(static):
    return app.send_static_file(static)


@app.route("/print", methods=["POST"])
def handle_image():
    try:
        f = request.files["image"]
        img = Image.open(f)
    except Exception as e:
        print(e)
        return f"Error loading image: {e}", 500

    try:
        print_image = PrintImage(img)
        print_image.print()
    except Exception as e:
        print(e)
        return f"Error printing image: {e}", 500

    return jsonify("ok")


class PrintImage:
    image: Image

    def __init__(self, image: Image, offset=True, resize=True):
        self.image = image
        if resize:
            self._resize()
        if offset:
            self._offset()

    def _resize(self):
        img = self.image

        if img.height > img.width:
            img = img.transpose(Image.ROTATE_90)
        if 323 / img.width * img.height <= 240:
            img = img.resize(size=(323, int(323 / img.width * img.height)))
        else:
            img = img.resize(size=(int(240 / img.height * img.width), 240))

        self.image = img

    def _offset(self):
        imgborder = Image.new("1", (384, 240), color=1)
        imgborder.paste(self.image, (61, 0))
        self.image = imgborder

    def _print(self):
        img = self.image.convert("1")

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
        sock = socket.socket(
            socket.AF_BLUETOOTH, socket.SOCK_STREAM, socket.BTPROTO_RFCOMM
        )
        sock.bind((socket.BDADDR_ANY, 1))
        sock.connect((DEVICE, 1))
        sock.sendall(bytes(buf))
        sock.recv(1024)
        sock.close()

    def print(self):
        with app.printlock:
            self._print()
