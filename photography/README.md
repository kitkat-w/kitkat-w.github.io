# Photography journal

A standalone, dependency-free photography portfolio, linked from the main Jekyll website’s Photography navigation tab. The top-left name on both photography views returns to https://kitkat-w.github.io/.

Run from this directory:

```sh
python3 -m http.server 4173 --bind 127.0.0.1
```

Open http://127.0.0.1:4173/#intro to start at the entrance. The first screen shows the name and collection thread. Native scrolling moves the introduction away and reveals the first photograph as a descending screen, preserving its aspect ratio with its caption beneath it. The thread remains anchored at the bottom; hovering a visible collection changes the full-size preview, and selecting the image enters its gallery. Continued vertical scrolling selects collections in order, with a short 120px scroll between collections rather than a full screen of scrolling. The thread translates left as later collections need to enter the viewport. The header shows the selected collection title. The scroll length and index are derived from the collection count, so the thread can grow with future collections.

Tap a thread stop on mobile, or use Tab / Left / Right and Enter on the keyboard. The down-arrow and “Next collection” buttons provide alternatives to scrolling. The original main-site links remain in the top-left name. Gallery back navigation returns to the selected collection on the thread. Hash links support direct entry. Reduced-motion mode uses a simple reveal instead of the animated introduction and photo transitions.

Supporting text uses a 14px minimum and scales up to 22px on 4K desktops. The name and statement retain their normal-desktop scale, with a larger-screen adjustment.

## Collections

- **Island nostalgia** — five black-and-white photographs in `assets/01_Island_nostalgia/`, sequenced by their original numbered filenames. The file prefixed `thumbnail_05` is the collection cover and appears as the fourth photograph in the sequence.
- **Little trip on water** — three color photographs in `assets/02_Little_trip_on_water/`, sequenced by filename.

All photographs are by Shengxi Wu. Published images are attributed web copies with an invisible TrustMark-P identifier. Their full composition is preserved; the larger color images are resized to a maximum long edge of 3840 pixels. Collection titles and statements follow the owner’s wording. Island nostalgia was taken in 2022 on HP 200 film; Little trip on water was taken in 2023. Photographs are labeled by sequence number only; locations are left blank.

Edit the `collections` array in `app.js` to change descriptions, sequences, and photo filenames. Set `coverIndex` to choose a collection's cover photograph (zero-based; the first photograph is the default). Edit the opening statement in `index.html`. The visual theme and responsive layouts live in `style.css`.

## GitHub Pages

The site is served at `https://kitkat-w.github.io/photography/` after the changes are committed and pushed to the existing `main` or `master` deployment branch. Jekyll copies this standalone folder into `_site/photography/`; the existing GitHub Actions workflow watches `photography/**` and deploys the full site together. No separate hosting account or domain is required.

## Image attribution and watermark pipeline

Every published photo embeds the author, copyright notice, collection year, stable photo ID, and a URL linking to its exact gallery frame. These are stored in EXIF and XMP. Metadata does not assert a download time or change the capture date. The EXIF/XMP fields are written after the watermark and JPEG export; color profiles are retained, while GPS and other private camera metadata are omitted from the web copies.

`provenance.json` maps each photo ID to its source, 40-bit watermark payload, and approved JPEG hash. TrustMark-P uses BCH_SUPER error correction at strength 1.0. The watermark is a source identifier, not a cryptographic ownership signature or a way to prevent copying. Metadata can be removed, and watermark recovery can fail after edits beyond those tested.

The current eight copies passed all six checks each: final JPEG export, JPEG quality 85 and 75 recompression, half-size resizing, half-size plus JPEG quality 80, and cropping 5% from each edge. All eight unwatermarked controls were negative. The pipeline writes a local `report.json` into its output and review directories; generated reports and comparisons are not committed. These results apply to this batch; they are not a guarantee for every possible transformation.

Only the verified watermarked copies remain in the publishable photo folders. Keep original source images outside this repository. Reusable pipeline code lives in `_pipeline/`, which is excluded from the built site. The public provenance registry is copied with the site. GitHub deployment checks both embedded metadata and approved JPEG hashes after building, and rejects unregistered photos.

To prepare a new batch, update `provenance.json` and the gallery's `collections` array, then use a separate Python 3.13 environment:

```sh
python3.13 -m venv /tmp/photography-watermark-venv
/tmp/photography-watermark-venv/bin/pip install -r photography/_pipeline/requirements.txt
/tmp/photography-watermark-venv/bin/python photography/_pipeline/prepare.py prepare \
  --source /path/to/original-assets \
  --output /tmp/photography-watermark-stage \
  --review /path/outside-the-repository/watermark-review
```

The source folder should contain the collection subfolders named in the registry. Adobe's model files download on first use; processing then runs locally. The command preserves its inputs and produces metadata-only copies, watermarked web copies, comparison sheets, a test report, and an updated `provenance.json`. It refuses inputs already carrying the expected watermark. Inspect the comparisons before replacing the site's images with the `watermarked/` output and its registry. Never copy the `metadata-only/` output or originals into the public site.

To verify the installed photos or identify a saved copy:

```sh
python3 photography/_pipeline/verify_published.py
/tmp/photography-watermark-venv/bin/python photography/_pipeline/prepare.py verify
/tmp/photography-watermark-venv/bin/python photography/_pipeline/prepare.py identify /path/to/saved-photo.jpg
```

The first check uses only the Python standard library and also runs during GitHub deployment. The other commands use TrustMark to read the embedded pixel watermark. Identification needs the correct model variant and registry, and may fail after substantial alteration.

Upstream: [Adobe TrustMark](https://github.com/adobe/trustmark), [model configuration](https://github.com/adobe/trustmark/blob/main/python/CONFIG.md).
