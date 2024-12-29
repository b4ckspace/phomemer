from enum import Enum, auto
from io import BytesIO
from multiprocessing import Lock
from typing import Optional
import os
import pathlib
import socket

from PIL import Image, ImageDraw, ImageFont
from flask import Flask, request, make_response, redirect, jsonify
from flask_cors import CORS

from . import config


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




@app.route("/printers")
def printers():
    return jsonify(config.printers)


@app.route("/print", methods=["POST"])
def handle_image():
    printer_name = request.args.get("printer")

    try:
        f = request.files["image"]
        file_length = f.seek(0, os.SEEK_END)
        f.seek(0, os.SEEK_SET)
        width = int(float(request.form.get("width")))
        height = int(float(request.form.get("height")))
        print(
            f"Received image with length {file_length} bytes and intended print size {width}x{height}"
        )
        img = Image.open(f)
    except Exception as e:
        print(e)
        return f"Error loading image: {e}", 500

    try:
        print_image = PrintImage(img, offset=True, resize=(width, height))

        if printer_name is None:
            printer_name = config.printers[0]["name"]

        printer_config = [x for x in config.printers if x["name"] == printer_name][0]

        printer = Printer(
            device=printer_config["device"],
            name=printer_config["name"],
        )
        printer.print(print_image)
    except Exception as e:
        print(e)
        return f"Error printing image: {e}", 500

    return jsonify("ok")


class DeviceType(Enum):
    BLUETOOTH = auto()
    CHARDEV = auto()


class PrinterDevice:
    path: Optional[str]
    device_type: DeviceType

    def __init__(
        self, path: Optional[str] = None, device_type: Optional[DeviceType] = None
    ):
        if path is None:
            self.path = "/dev/phomemo"

            if device_type is None:
                self.device_type = DeviceType.CHARDEV

            if not pathlib.Path(self.path).is_char_device():
                raise Exception(
                    f"No valid printer target configured (envvar PHOMEMO_BT_MAC unset and {CHARDEV} is not a character device)"
                )
        else:
            self.path = path

            if device_type is None:
                self.device_type = DeviceType.BLUETOOTH

    @property
    def address(self):
        return self.path

    @address.setter
    def address(self, value):
        self.path = value


class PrintImage:
    image: Image

    def __init__(self, image: Image, offset=True, resize=(323, 240)):
        self.image = image
        print("Original image size:", image.size)
        if resize:
            self._resize(resize[0], resize[1])
            print("Image size after resize:", self.image.size)
        if offset:
            self._offset()
            print("Image size after offset:", self.image.size)

    def _resize(self, target_width, target_height):
        img = self.image

        if img.width / target_width > img.height / target_height:
            # target_width is bigger dimension -> keep it
            target_height = int(img.height * (target_width / img.width))
        else:
            # target_height is bigger dimension -> keep it
            target_width = int(img.width * (target_height / img.height))

        img = img.resize(size=(target_width, target_height))

        self.image = img

    def _offset(self):
        # For some reason, the printer rejects widths > 384px, even though it
        # should be able to print 50mm*8px/mm=400px...
        target_width, target_height = 384, self.image.height
        imgborder = Image.new("1", (target_width, target_height), color=1)
        horizontal_offset = target_width - self.image.width
        imgborder.paste(self.image, (horizontal_offset, 0))
        self.image = imgborder


class Printer:
    name: str
    device: PrinterDevice

    def __init__(
        self,
        device: Optional[str] = None,
        name: Optional[str] = None,
    ):
        self.device = PrinterDevice(path=device)

        if name is None:
            self.name = self.device.address

    def _print(self, image: PrintImage):
        img = image.image.convert("1")

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
        if self.device.device_type == DeviceType.BLUETOOTH:
            sock = socket.socket(
                socket.AF_BLUETOOTH, socket.SOCK_STREAM, socket.BTPROTO_RFCOMM
            )
            sock.bind((socket.BDADDR_ANY, 1))
            sock.connect((self.device.address, 1))
            sock.sendall(bytes(buf))
            sock.recv(1024)
            sock.close()
        else:
            with open(self.device.path, "wb") as f:
                f.write(bytes(buf))

    def print(self, image: PrintImage):
        with app.printlock:
            self._print(image)
