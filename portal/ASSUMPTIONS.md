# Assumptions to confirm

Each of these is a single setting in `assets/js/config.js` unless noted.

1. **Left and right.** "Left ear" is drawn on the viewer's left when facing the bear (`perspective: "viewer"`). If the device's `1LeftEar` is the bear's own left ear, set `perspective: "bear"`; the hotspots swap sides and the folders stay correct. One test on a real bear settles it.
2. **Order inside a folder.** Files are named `01_name`, `02_name` so alphabetical order equals intended order. Confirm how the bear plays several files in one folder (all in sequence on one press, or one file per press).
3. **Browser recordings are WAV**, 16-bit mono, 44.1 kHz. About 5 MB per minute. Drop `recording.sampleRate` to 22050 if the hardware accepts it. Uploaded MP3s are passed through untouched. Confirm which formats the bear actually plays.
4. **16 MB** is treated as 16,777,216 bytes of raw file size. Confirm the real usable capacity.
5. **Submission IDs** are `IT-YYYY-` plus six random digits because there is no server to count. Production should issue sequential IDs.
6. **Filenames** are sanitised to ASCII letters, digits, dots, dashes and underscores, 40 characters max, to be safe on any SD card or device filesystem.
7. **No persistence.** Refreshing the page clears everything. Production needs save-and-return.
8. **Acknowledgement text** is a placeholder pending legal and privacy review.
