/*
  Indigenize Toys Pilot Portal (prototype)
  Configuration. Everything that might change with the hardware or the
  business lives here so it can be edited without touching app.js.

  This file sets a global (window.PORTAL_CONFIG) instead of being JSON
  so the portal still works when index.html is opened straight from disk.
*/

window.PORTAL_CONFIG = {

  product: "bear",
  productLabel: "Language Bear",

  /* Total audio capacity of the bear. ASSUMPTION: "about 16 MB" is
     treated as 16 x 1024 x 1024 bytes, measured on the raw files the
     user provides. Confirm the real usable capacity against hardware. */
  capacityBytes: 16 * 1024 * 1024,

  /* Fraction of capacity at which the meter turns to a warning. */
  warnAt: 0.8,

  /* File types accepted for upload (lower-case extensions). */
  acceptedExtensions: ["mp3", "wav"],

  /* Browser recordings are written as uncompressed WAV.
     ASSUMPTION: 16-bit mono at 44.1 kHz. Change sampleRate to 22050
     to halve the size if the hardware accepts it. */
  recording: {
    sampleRate: 44100,
    maxSeconds: 120
  },

  /* Submission IDs look like IT-2026-000123. The prototype has no
     server, so the six digits are random rather than sequential. */
  submissionIdPrefix: "IT",

  /* Where "Need help?" goes. Uses the existing website contact page. */
  helpUrl: "https://indigenize.toys/connect",

  /* The bear photograph and its hotspots.
     x and y are percentages of the image width and height.

     Folder names are the hardware truth supplied by Jon: any audio file
     placed in a folder is played by that button.

     ASSUMPTION about left and right: "Left ear" is placed on the
     viewer's left when facing the bear. If a physical test shows the
     device's "LeftEar" is the bear's own left ear, set
     perspective: "bear" and the hotspots swap sides automatically. */
  perspective: "viewer",

  bearImage: {
    src: "assets/img/bear-front.jpg",
    width: 1200,
    height: 1594,
    alt: "The Language Bear, seen from the front"
  },

  touchpoints: [
    { id: 1, folder: "1LeftEar",   label: "Left ear",   side: "left",  x: 30,   y: 17 },
    { id: 2, folder: "2RightEar",  label: "Right ear",  side: "right", x: 73,   y: 17 },
    { id: 3, folder: "3LeftHand",  label: "Left hand",  side: "left",  x: 21.5, y: 41.5 },
    { id: 4, folder: "4RightHand", label: "Right hand", side: "right", x: 81,   y: 41.5 },
    { id: 5, folder: "5LeftFoot",  label: "Left foot",  side: "left",  x: 15.5, y: 74.5 },
    { id: 6, folder: "6RightFoot", label: "Right foot", side: "right", x: 89,   y: 74 },
    { id: 7, folder: "7Heart",     label: "Heart",      side: null,    x: 58,   y: 52 }
  ],

  /* Text shown at the acknowledgement checkbox. Placeholder pending
     legal and privacy review. */
  acknowledgementText:
    "I confirm that I have the authority or permission from my community " +
    "or organization to provide these recordings for this pilot. The " +
    "recordings remain the property of the community. Indigenize Toys " +
    "will use them only to prepare the bears for this pilot."
};
