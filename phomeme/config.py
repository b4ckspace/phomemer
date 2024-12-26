import os

from dotenv import dotenv_values

# List of valid config options
options = [
    "PHOMEMO_BT_MAC",
    "PHOMEMO_PAPER_SIZE"
]

# Load config values from .env and environment variables
# Note: This reads all environment variables
config = {
    **dotenv_values(".env"),
    **os.environ
}

# Set None as default for unset options
for key in options:
    if key not in config:
        config[key] = None

# Filter only desired config options
config = {key: config[key] for key in options if key in config}

printers = []

if config["PHOMEMO_BT_MAC"]:
    for printer in config["PHOMEMO_BT_MAC"].split(","):
        printer_kv = printer.split("=", 1)

        if len(printer_kv) == 1:
            printer_name = printer
            printer_value = printer
        else:
            printer_name = printer_kv[0]
            printer_value = printer_kv[1]

        printers.append({"name": printer_name, "address": printer_value})

# Store config in globals
globals().update(**config)
