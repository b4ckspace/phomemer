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
        print_image = PrintImage(img, offset=False, resize=None)

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
        img_ratio = img.width / img.height
        target_ratio = target_width / target_height

        if img_ratio > target_ratio:
            # Image is wider than target, fit to width
            new_width = target_width
            new_height = int(target_width / img_ratio)
        else:
            # Image is taller than target, fit to height
            new_height = target_height
            new_width = int(target_height * img_ratio)

        # Resize the image
        img = img.resize((new_width, new_height), Image.LANCZOS)

        # Create a white background of the target size
        background = Image.new('RGB', (target_width, target_height), (255, 255, 255))

        # Paste the resized image onto the center of the background
        offset = ((target_width - new_width) // 2, (target_height - new_height) // 2)
        background.paste(img, offset)

        self.image = background

    def _offset(self):
        # For some reason, the printer rejects widths > 384px, even though it
        # should be able to print 50mm*8px/mm=400px...
        target_width, target_height = 384, self.image.height
        imgborder = Image.new("1", (target_width, target_height), color=1)
        horizontal_offset = (target_width - self.image.width) // 2  # Center horizontally
        imgborder.paste(self.image, (horizontal_offset, 0))
        self.image = imgborder

class Printer:
    name: str
    device: PrinterDevice
    endless_mode: bool

    def __init__(
            self,
            device: Optional[str] = None,
            name: Optional[str] = None,
            endless_mode: bool = True
    ):
        self.device = PrinterDevice(path=device)
        self.endless_mode = endless_mode

        if name is None:
            self.name = self.device.address

    def _print(self, image: PrintImage):
        img = image.image.convert("1")

        width = img.width
        height = img.height
        width8 = (width + 7) // 8

        def generate_header():
            buf = []
            buf += [0x1B, 0x40]  # Initialize printer
            buf += [0x1B, 0x37]  # Disable automatic line feed
            buf += [0x1B, 0x4E, 0x0D, 0x07]  # Set print speed (higher value)
            buf += [0x1B, 0x4E, 0x04, 0x0F]  # Set print density (higher value)
            buf += [0x1F, 0x11, 0x0A]  # Select media type
            buf += [0x1D, 0x50, 0x00]  # Disable automatic feeding by line
            buf += [0x1D, 0x4C, 0x00, 0x00]  # Set left margin to 0
            buf += [0x1B, 0x33, 0x00]  # Set line spacing to 0

            if self.endless_mode:
                buf += [0x1D, 0x56, 0x00]  # Disable auto-cutter
            else:
                buf += [0x1D, 0x56, 0x01]  # Enable auto-cutter

            return bytes(buf)

        def generate_raster(line, lines):
            buf = []
            buf += [0x1D, 0x76, 0x30, 0x00]  # Print raster bit image
            buf += [width8 & 0xFF, width8 >> 8]
            buf += [lines & 0xFF, lines >> 8]

            for y in range(line, min(line + lines, height)):
                row_data = []
                for x in range(0, width, 8):
                    byte = 0
                    for bit in range(8):
                        if x + bit < width and img.getpixel((x + bit, y)) == 0:
                            byte |= (1 << (7 - bit))
                    row_data.append(byte)
                buf.extend(row_data)

            return bytes(buf)

        def generate_footer():
            buf = []
            buf += [0x1B, 0x4A, 0x10]  # Feed paper 16 dots
            return bytes(buf)

        chunk_size = 128  # Adjusted chunk size

        if self.device.device_type == DeviceType.BLUETOOTH:
            with socket.socket(socket.AF_BLUETOOTH, socket.SOCK_STREAM, socket.BTPROTO_RFCOMM) as sock:
                sock.bind((socket.BDADDR_ANY, 1))
                sock.connect((self.device.address, 1))

                sock.sendall(generate_header())

                for line in range(0, height, chunk_size):
                    lines = min(chunk_size, height - line)
                    sock.sendall(generate_raster(line, lines))
                    if line + lines < height:
                        sock.sendall(b'\x1B\x4A\x00')  # No feed between chunks

                sock.sendall(generate_footer())
                sock.recv(1024)
        else:
            with open(self.device.path, "wb") as f:
                f.write(generate_header())

                for line in range(0, height, chunk_size):
                    lines = min(chunk_size, height - line)
                    f.write(generate_raster(line, lines))
                    if line + lines < height:
                        f.write(b'\x1B\x4A\x00')  # No feed between chunks

                f.write(generate_footer())

    def print(self, image: PrintImage):
        with app.printlock:
            self._print(image)
