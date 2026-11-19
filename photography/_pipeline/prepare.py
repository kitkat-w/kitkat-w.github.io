"""Prepare attributed, invisibly watermarked portfolio JPEGs outside the site tree.

Originals must be supplied separately. The prepare command never edits inputs.
Only copy the verified watermarked output into photography/assets for publishing.
"""

import argparse
import hashlib
import io
import json
import math
from pathlib import Path
import struct
from xml.sax.saxutils import escape
import xml.etree.ElementTree as ET

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageOps
import torch
from trustmark import TrustMark


ROOT = Path(__file__).resolve().parents[1]
XMP_HEADER = b"http://ns.adobe.com/xap/1.0/\0"
NS = {"dc": "http://purl.org/dc/elements/1.1/", "rdf": "http://www.w3.org/1999/02/22-rdf-syntax-ns#"}


def payload(photo):
    """A 40-bit lookup ID; BCH_SUPER reserves the remaining bits for correction."""
    return format(int(hashlib.sha256(photo["id"].encode()).hexdigest()[:10], 16), "040b")


def metadata(photo, author, marked):
    rights = f"© {photo['year']} {author}. All rights reserved."
    exif = Image.Exif()
    exif[315] = author
    exif[33432] = rights
    exif[270] = f"{photo['collection']} / {photo['id']} | {photo['source']}"
    xmp = f'''<x:xmpmeta xmlns:x="adobe:ns:meta/">
<rdf:RDF xmlns:rdf="{NS['rdf']}"><rdf:Description rdf:about=""
xmlns:dc="{NS['dc']}" xmlns:xmpRights="http://ns.adobe.com/xap/1.0/rights/"
xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/"
xmlns:sw="https://kitkat-w.github.io/photography/ns/1.0/">
<dc:creator><rdf:Seq><rdf:li>{escape(author)}</rdf:li></rdf:Seq></dc:creator>
<dc:source>{escape(photo['source'])}</dc:source>
<dc:identifier>{escape(photo['id'])}</dc:identifier>
<dc:rights><rdf:Alt><rdf:li xml:lang="x-default">{escape(rights)}</rdf:li></rdf:Alt></dc:rights>
<xmpRights:Marked>True</xmpRights:Marked>
<xmpRights:WebStatement>{escape(photo['source'])}</xmpRights:WebStatement>
<photoshop:DateCreated>{photo['year']}</photoshop:DateCreated>
<sw:Watermark>{'TrustMark-P' if marked else 'None'}</sw:Watermark>
<sw:Payload>{payload(photo) if marked else ''}</sw:Payload>
</rdf:Description></rdf:RDF></x:xmpmeta>'''.encode()
    return exif.tobytes(), xmp


def add_metadata_losslessly(data, exif, xmp):
    """Replace EXIF/XMP APP1 segments without decoding/recompressing JPEG data."""
    if data[:2] != b"\xff\xd8":
        raise ValueError("Expected a JPEG")
    result = bytearray(data[:2])
    for body in (exif, XMP_HEADER + xmp):
        if len(body) > 65533:
            raise ValueError("Metadata exceeds JPEG APP1 capacity")
        result.extend(b"\xff\xe1" + struct.pack(">H", len(body) + 2) + body)
    pos = 2
    while pos < len(data):
        start = pos
        if data[pos] != 255:
            raise ValueError("Malformed JPEG marker")
        while data[pos] == 255:
            pos += 1
        marker = data[pos]
        pos += 1
        if marker in (0xDA, 0xD9):
            result.extend(data[start:])
            return bytes(result)
        length = struct.unpack(">H", data[pos:pos + 2])[0]
        end = pos + length
        body = data[pos + 2:end]
        if marker != 0xE1 or not (body.startswith(b"Exif\0\0") or body.startswith(XMP_HEADER)):
            result.extend(data[start:end])
        pos = end
    raise ValueError("Incomplete JPEG")


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_rgb(path):
    with Image.open(path) as image:
        return ImageOps.exif_transpose(image).convert("RGB")


def jpeg(image, quality=97):
    buf = io.BytesIO()
    image.save(buf, format="JPEG", quality=quality, subsampling=0, optimize=True, progressive=True)
    buf.seek(0)
    return Image.open(buf).convert("RGB")


def psnr(a, b):
    mse = np.mean((np.asarray(a, dtype=np.float64) - np.asarray(b, dtype=np.float64)) ** 2)
    return round(10 * math.log10(255 ** 2 / mse), 2) if mse else None


def model():
    torch.set_num_threads(4)
    tm = TrustMark(model_type="P", encoding_type=TrustMark.Encoding.BCH_SUPER,
                   device="cpu", loadRemover=False, verbose=False)
    if tm.encoder is None or tm.decoder is None:
        raise RuntimeError("TrustMark-P models are unavailable; no files were replaced")
    return tm


def decode(tm, image, expected):
    secret, detected, schema = tm.decode(image, MODE="binary")
    return {"matches": bool(detected and secret == expected), "detected": bool(detected), "schema": int(schema)}


def verify_metadata(path, photo, author):
    with Image.open(path) as image:
        assert image.getexif().get(315) == author, f"Missing author: {path}"
        assert photo["year"] in image.getexif().get(33432, ""), f"Missing copyright: {path}"
        xmp = image.info.get("xmp", b"")
        root = ET.fromstring(xmp)
        assert root.find(".//dc:source", NS).text == photo["source"], f"Wrong source: {path}"
        assert root.find(".//dc:identifier", NS).text == photo["id"], f"Wrong ID: {path}"
        assert root.find(".//dc:creator/rdf:Seq/rdf:li", NS).text == author
        return True


def comparison(reference, watermarked, path, label):
    """Normal-view and 100%-pixel center crops, without amplifying differences."""
    panel_w, panel_h = 720, 480
    sheet = Image.new("RGB", (panel_w * 2, panel_h + 410), "#f3f0e8")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default(size=18)
    for i, (image, title) in enumerate(((reference, "Unwatermarked"), (watermarked, "TrustMark-P / published JPEG"))):
        fitted = ImageOps.contain(image, (panel_w - 30, panel_h - 55))
        x = i * panel_w
        sheet.paste(fitted, (x + (panel_w - fitted.width) // 2, 45))
        draw.text((x + 20, 15), title, fill="#353630", font=font)
        cx, cy = image.width // 2, image.height // 2
        crop = image.crop((cx - 320, cy - 160, cx + 320, cy + 160))
        sheet.paste(crop, (x + 40, panel_h + 45))
        draw.text((x + 20, panel_h + 15), "100% center crop", fill="#353630", font=font)
    draw.text((20, panel_h + 375), label, fill="#353630", font=font)
    sheet.save(path)


def prepare(args, manifest):
    source, output, review = args.source.resolve(), args.output.resolve(), args.review.resolve()
    if source == output or source in output.parents or output in source.parents:
        raise ValueError("Source and staging output must be separate directories")
    output.mkdir(parents=True, exist_ok=True)
    review.mkdir(parents=True, exist_ok=True)
    tm = model()
    report = {"method": "TrustMark-P", "strength": args.strength, "encoding": "BCH_SUPER",
              "max_edge": args.max_edge, "jpeg_quality": 97, "jpeg_subsampling": "4:4:4", "images": []}
    for photo in manifest["images"]:
        original = source / photo["file"]
        image = load_rgb(original)
        expected = payload(photo)
        if decode(tm, image, expected)["matches"]:
            raise ValueError(f"Input is already watermarked: {original}. Use your original file.")
        # Lossless metadata-only copy, for attribution and pixel-identity verification.
        exif, xmp = metadata(photo, manifest["author"], False)
        attributed = output / "metadata-only" / photo["file"]
        attributed.parent.mkdir(parents=True, exist_ok=True)
        attributed.write_bytes(add_metadata_losslessly(original.read_bytes(), exif, xmp))
        assert np.array_equal(np.asarray(image), np.asarray(load_rgb(attributed))), "Metadata changed pixels"
        verify_metadata(attributed, photo, manifest["author"])
        reference = image.copy()
        reference.thumbnail((args.max_edge, args.max_edge), Image.Resampling.LANCZOS)
        clean_jpeg = jpeg(reference)
        marked = tm.encode(reference, expected, MODE="binary", WM_STRENGTH=args.strength)
        target = output / "watermarked" / photo["file"]
        target.parent.mkdir(parents=True, exist_ok=True)
        # Carry the original color profile, but no original GPS/private camera metadata.
        with Image.open(original) as raw:
            profile = raw.info.get("icc_profile")
        buf = io.BytesIO()
        marked.save(buf, format="JPEG", quality=97, subsampling=0, optimize=True,
                    progressive=True, icc_profile=profile)
        exif, xmp = metadata(photo, manifest["author"], True)
        target.write_bytes(add_metadata_losslessly(buf.getvalue(), exif, xmp))
        published = load_rgb(target)
        verify_metadata(target, photo, manifest["author"])
        small = published.resize((published.width // 2, published.height // 2), Image.Resampling.LANCZOS)
        crop = published.crop((int(published.width * .05), int(published.height * .05),
                               int(published.width * .95), int(published.height * .95)))
        tests = {name: decode(tm, variant, expected) for name, variant in {
            "published": published, "jpeg_85": jpeg(published, 85), "jpeg_75": jpeg(published, 75),
            "resize_50_percent": small, "resize_50_jpeg_80": jpeg(small, 80), "crop_5_percent_each_edge": crop,
        }.items()}
        assert tests["published"]["matches"], f"Watermark failed after final JPEG export: {photo['id']}"
        negative = decode(tm, clean_jpeg, expected)
        assert not negative["matches"], f"Unmarked control matched: {photo['id']}"
        entry = {"id": photo["id"], "file": photo["file"], "source": photo["source"],
                 "original_dimensions": list(image.size), "published_dimensions": list(published.size),
                 "original_sha256": sha256(original), "published_sha256": sha256(target),
                 "published_bytes": target.stat().st_size, "metadata_verified": True,
                 "metadata_only_pixels_identical": True, "watermark_only_psnr_db": psnr(reference, marked),
                 "published_vs_reference_psnr_db": psnr(reference, published),
                 "published_vs_clean_jpeg_psnr_db": psnr(clean_jpeg, published),
                 "unwatermarked_control": negative, "tests": tests}
        report["images"].append(entry)
        comparison(reference, published, review / f"{photo['id']}.jpg", photo["id"] + " / " + photo["collection"])
        (review / "report.json").write_text(json.dumps(report, indent=2) + "\n")
        print(photo["id"], f"watermark PSNR {entry['watermark_only_psnr_db']} dB",
              {name: test["matches"] for name, test in tests.items()}, flush=True)
    (output / "report.json").write_text(json.dumps(report, indent=2) + "\n")
    approved = json.loads(json.dumps(manifest))
    approved["watermark"]["strength"] = args.strength
    approved["export"] = {"maxEdge": args.max_edge, "jpegQuality": 97, "chromaSubsampling": "4:4:4"}
    for photo, result in zip(approved["images"], report["images"], strict=True):
        photo["payload"] = payload(photo)
        photo["sha256"] = result["published_sha256"]
    (output / "provenance.json").write_text(json.dumps(approved, indent=2) + "\n")


def verify(args, manifest):
    tm = model()
    for photo in manifest["images"]:
        path = args.assets / photo["file"]
        verify_metadata(path, photo, manifest["author"])
        assert decode(tm, load_rgb(path), payload(photo))["matches"], f"Watermark failed: {path}"
        print(photo["id"], "author, source, copyright, ID and watermark verified", flush=True)


def identify(args, manifest):
    secret, detected, _ = model().decode(load_rgb(args.image), MODE="binary")
    photo = next((item for item in manifest["images"] if payload(item) == secret), None)
    if not detected or photo is None:
        raise SystemExit("No matching TrustMark-P identifier found in this copy.")
    print(json.dumps({"author": manifest["author"], "id": photo["id"], "source": photo["source"]}, indent=2))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, default=ROOT / "provenance.json")
    sub = parser.add_subparsers(dest="command", required=True)
    prep = sub.add_parser("prepare")
    prep.add_argument("--source", type=Path, required=True)
    prep.add_argument("--output", type=Path, required=True)
    prep.add_argument("--review", type=Path, required=True)
    prep.add_argument("--max-edge", type=int, default=3840)
    prep.add_argument("--strength", type=float, default=1.0)
    check = sub.add_parser("verify")
    check.add_argument("--assets", type=Path, default=ROOT / "assets")
    find = sub.add_parser("identify")
    find.add_argument("image", type=Path)
    args = parser.parse_args()
    manifest = json.loads(args.manifest.read_text())
    ids = [payload(photo) for photo in manifest["images"]]
    assert len(ids) == len(set(ids)), "Duplicate watermark identifiers"
    {"prepare": prepare, "verify": verify, "identify": identify}[args.command](args, manifest)


if __name__ == "__main__":
    main()
