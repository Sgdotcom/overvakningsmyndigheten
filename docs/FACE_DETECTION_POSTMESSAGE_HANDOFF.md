# Face detection → Web “live-feed” handoff (detection-only)

## Goal
Connect your existing VPS face-scanning iframe so it reports **detection-only** results to the website page:
`pages/live-feed.html`.

The website will show:
- Latest detection timestamp
- “Ansikte upptäckt” vs “Inget upptäckt”
- Latest face count (if provided)
- A small event log (last 20 events)

This integration is intentionally **detection-only**:
- No face images
- No identity database

## Where the browser listens
In `pages/live-feed.html` the iframe is:
- `id="facescan-iframe"`

The page listens for `window.postMessage` events and processes messages **only when**:
- `event.source === iframe.contentWindow`
- `event.data.type` is one of:
  - `face-detections`
  - `faceDetection`
  - `faces-detected`

## Message contract your VPS iframe must send
Send this object from inside the iframe (VPS script):

```js
window.parent.postMessage(
  {
    type: 'face-detections', // required
    ts: Date.now(),          // optional (recommended)
    detected: true,         // optional; if missing it is derived from faceCount/boxes length
    faceCount: 2,          // optional; recommended
    boxes: [
      // optional; parent currently only uses boxes.length to infer faceCount
      // You may provide normalized coords (0..1) or pixels; the parent does not render boxes yet.
      { x: 0.1, y: 0.2, w: 0.3, h: 0.4, score: 0.92 }
    ]
  },
  '*'
);
```

### Notes on fields
- `type`: must match one of the accepted strings.
- `ts`: millisecond timestamp; used to display “Senaste”.
- `faceCount`:
  - if `detected` is missing, the website infers `detected = faceCount > 0`
  - if `faceCount` is missing, it infers from `boxes.length`
- `boxes`:
  - optional for now, but safe to include
  - parent currently does not draw boxes; it only uses `boxes.length` as a fallback

## Example payload mapping (typical)
If your VPS already computes `boxes` from your tracker/detector:
```js
const boxes = detections.map(d => ({
  x: d.x, y: d.y, w: d.w, h: d.h,
  score: d.score
}));

window.parent.postMessage(
  {
    type: 'face-detections',
    ts: Date.now(),
    faceCount: boxes.length,
    detected: boxes.length > 0,
    boxes
  },
  '*'
);
```

## Implementation checklist
1. Ensure the iframe runs code that calls `window.parent.postMessage(...)` after each frame update.
2. Throttle if needed (e.g. at 2–5 messages/second) to avoid UI spam.
3. Validate in devtools:
   - The website’s detection panel should update when messages arrive.
   - You should see status switch between “Ansikte upptäckt” and “Inget upptäckt”.

## Privacy note
This handoff does **not** request or store face crops or identities.
Only detection presence/count is sent to the browser UI.

