# Indigenize Toys Pilot Portal (prototype): Language Bear

One page. No server, no framework, no build step. Nothing is uploaded anywhere.

## Run it

Double-click `index.html`. That is enough for uploads and packaging.

For microphone recording, some browsers require the page to be served rather than opened from disk.
If the Record button says the microphone is not available, run one of these from this folder and open the address it prints:

```
python -m http.server 8000        (then open http://localhost:8000)
npx serve .
```

## What it does

1. Pilot details (community, language, contact).
2. Bear with seven touch points. Tap one, then record with the microphone or upload MP3/WAV. Reorder, preview, remove.
3. Storage meter against about 16 MB.
4. Review, permission acknowledgement, then **Download package (.zip)**.

The ZIP is built in the browser and saved to the user's Downloads folder. Copy it to a USB stick, then to the air-gapped laptop, unzip, and copy each folder's files onto the bear's matching folder.

## Package layout

```
IT-2026-123456/
  manifest.json      all details and the file map
  SUMMARY.txt        the same, human readable
  1LeftEar/
    01_welcome.wav
    02_song.mp3
  2RightEar/
  3LeftHand/
  4RightHand/
  5LeftFoot/
  6RightFoot/
  7Heart/
```

All seven folders are always present, even when empty. Files inside a folder are prefixed `01_`, `02_` so the order is fixed.

## Change things

Everything that might change with the hardware or the business is in `assets/js/config.js`:
capacity, warning threshold, accepted formats, recording sample rate, folder names, hotspot positions, left/right perspective, acknowledgement text, help link.

## Files

```
index.html               the page
assets/css/portal.css    styles (tokens copied from indigenize.toys)
assets/js/config.js      settings
assets/js/recorder.js    microphone to WAV
assets/js/app.js         the workflow
assets/vendor/jszip.min.js   the only dependency (ZIP creation, MIT licence)
assets/img/              bear photo (resized) and logo
sample-audio/            dummy tone files for testing uploads
ASSUMPTIONS.md           what still needs confirming
```
