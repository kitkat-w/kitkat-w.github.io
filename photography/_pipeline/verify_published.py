"""Check published image metadata and approved JPEG hashes using only Python stdlib."""

import argparse
import hashlib
import json
from pathlib import Path
import struct
import xml.etree.ElementTree as ET


NS = {"dc": "http://purl.org/dc/elements/1.1/", "rdf": "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
      "sw": "https://kitkat-w.github.io/photography/ns/1.0/"}
HEADER = b"http://ns.adobe.com/xap/1.0/\0"


def read_xmp(data):
    if data[:2] != b"\xff\xd8":
        raise ValueError("Expected JPEG")
    pos = 2
    while pos < len(data):
        if data[pos] != 255:
            raise ValueError("Malformed JPEG")
        while data[pos] == 255:
            pos += 1
        marker = data[pos]
        pos += 1
        if marker in (0xDA, 0xD9):
            break
        length = struct.unpack(">H", data[pos:pos + 2])[0]
        body = data[pos + 2:pos + length]
        if marker == 0xE1 and body.startswith(HEADER):
            return ET.fromstring(body[len(HEADER):])
        pos += length
    raise ValueError("Missing embedded XMP")


def check(site):
    manifest = json.loads((site / "provenance.json").read_text())
    expected = {photo["file"] for photo in manifest["images"]}
    images = {path.relative_to(site / "assets").as_posix()
              for path in (site / "assets").rglob("*")
              if path.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp", ".avif", ".heic"}}
    if images != expected:
        raise ValueError(f"Unregistered or missing photos: {sorted(images ^ expected)}")
    for photo in manifest["images"]:
        data = (site / "assets" / photo["file"]).read_bytes()
        if hashlib.sha256(data).hexdigest() != photo["sha256"]:
            raise ValueError(f"Image differs from verified watermarked copy: {photo['file']}")
        xmp = read_xmp(data)
        for selector, value in {
            ".//dc:creator/rdf:Seq/rdf:li": manifest["author"],
            ".//dc:source": photo["source"],
            ".//dc:identifier": photo["id"],
            ".//sw:Watermark": "TrustMark-P",
            ".//sw:Payload": photo["payload"],
        }.items():
            element = xmp.find(selector, NS)
            if element is None or element.text != value:
                raise ValueError(f"Wrong or missing metadata {selector}: {photo['file']}")
        print(f"{photo['id']}: approved JPEG, author, source and watermark ID verified")
    print(f"Verified all {len(expected)} published photos; no unregistered image files.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--site", type=Path, default=Path(__file__).resolve().parents[1])
    check(parser.parse_args().site)
