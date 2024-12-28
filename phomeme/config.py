import json
import os

config_path = os.path.join(os.path.dirname(__file__), "config")

printers = []
paper = None

with open(os.path.join(config_path, "printer.json"), 'r') as file:
    printers = json.load(file)

with open(os.path.join(config_path, "paper.json"), 'r') as file:
    paper = json.load(file)

for printer in printers:
    printer["paper"] = paper[printer["paper"]]
