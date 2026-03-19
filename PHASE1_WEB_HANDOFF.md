# FACESCAN — Phase 1 Handoff: Website Face Capture

**Drop this file into your website project folder and open it with Claude Code.**

---

## 1. What This Project Is

FACESCAN is a real-time facial recognition surveillance-critique art installation for a Stockholm exhibition (Beckmans Designhögskola, 2026 Swedish election context). The aesthetic should feel like a real government surveillance system, not a tech demo.

The website shows a full-screen live FACESCAN camera feed (via WebRTC iframe). We are adding a **"Biometric Paywall"** — visitors must submit their face via webcam to access the website. Their face image is uploaded to a VPS, then pulled down to the exhibition machine and manually curated into the recognition dataset.

---

## 2. What Is Already Built and Working

### Phase 2 — VPS API (DONE, running)

A FastAPI server on the VPS receives, stores, and serves face images.

| Detail | Value |
|--------|-------|
| **VPS IP** | `187.124.168.106` |
| **API port** | `8000` |
| **Base URL** | `http://187.124.168.106:8000` |
| **Auth** | Bearer token in `Authorization` header |
| **API Token** | `BHSK7yHImyRdxkwfzWrwp7rJlvtcIl7QwSSP3W0-OVU` |

**Endpoints:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/health` | No | Returns `{"status": "ok"}` — use to check if API is up |
| `POST` | `/upload_face` | Yes | Multipart form: field `image` (JPEG/PNG/WEBP, max 5MB). Returns `{"status": "ok", "filename": "web_20260318_...jpg"}` |
| `GET` | `/list_faces` | Yes | Returns `{"files": [...], "count": N}` |
| `GET` | `/download_face/{filename}` | Yes | Returns the image file |
| `DELETE` | `/delete_face/{filename}` | Yes | Deletes the image |

**Upload example (JS fetch):**
```javascript
const formData = new FormData();
formData.append('image', blob, 'face.jpg');  // blob from canvas

const response = await fetch('http://187.124.168.106:8000/upload_face', {
    method: 'POST',
    headers: {
        'Authorization': 'Bearer BHSK7yHImyRdxkwfzWrwp7rJlvtcIl7QwSSP3W0-OVU'
    },
    body: formData
});

const result = await response.json();
// result = { status: "ok", filename: "web_20260318_142055_a3f2c1d9.jpg" }
```

**Allowed content types:** `image/jpeg`, `image/png`, `image/webp`

### Phase 3 — Local Sync Script (DONE)

A Python script (`6_vps_sync_CUR.py`) runs on the exhibition machine, polls the VPS every 10 seconds, downloads new images to `id_from_web/`, and deletes them from the VPS after download. This is already built and tested.

---

## 3. What You Need to Build (Phase 1)

### The Flow

1. User visits the website
2. **Before showing any content**, a full-screen login/capture modal appears
3. User sees their webcam feed in the modal
4. User sees their face being detected (visual feedback — a box or indicator)
5. User enters their **full name** (first + last name, basic validation)
6. User clicks a "Submit" / "Identify" / "Register" button
7. A still frame is captured from the webcam, cropped to the face region
8. The image is POSTed to the VPS API (`/upload_face`)
9. On success: modal closes, website content (FACESCAN livestream) is revealed
10. A `sessionStorage` flag prevents re-prompting on page refresh within the same tab

### The Login Modal

**Design language:** Cold, institutional, surveillance-aesthetic. Think government ID system, not friendly tech. Monospace fonts, dark background, minimal color. The fonts already used on the site are `Share Tech Mono` (monospace) and `Bebas Neue` (headings).

**What the modal should contain:**
- A title like "BIOMETRIC VERIFICATION REQUIRED" or "FACIAL IDENTIFICATION" (match the surveillance tone)
- The user's webcam feed (live preview)
- Visual face detection feedback (a bounding box or crosshair on the detected face)
- A text input for full name
- A submit button
- A small status line showing connection/capture state

**Name validation:** Keep it simple — just require at least 2 words (first + last name). No need to verify against a database. The name is used for folder naming on the exhibition machine.

### Face Detection in the Browser

Use **MediaPipe Face Detection** (lightweight, runs in-browser, no server needed for detection). This is ONLY for:
1. Confirming a face is present before allowing capture
2. Drawing a visual indicator on the face (feedback to the user)
3. Optionally: cropping the image to the face region before upload

The actual recognition happens on the exhibition machine — the browser just needs to confirm "yes, there's a face here" and capture a decent image.

**MediaPipe Face Detection CDN:**
```html
<script src="https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/face_detection.js" crossorigin="anonymous"></script>
<script src="https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js" crossorigin="anonymous"></script>
```

Or use the newer `@mediapipe/tasks-vision` package if you prefer.

### Upload Logic

**Fire-and-forget with graceful handling.** The upload should:
- Convert the webcam frame (or face crop) to JPEG via canvas
- POST to the VPS API as multipart form data
- On success (200): close modal, grant access
- On failure: still grant access (don't block the user because the API is down), but log a warning
- The face upload is a bonus feature — the website should work even if the API is unreachable

**Important:** The token is in the frontend JS. This is intentional for the exhibition context (not a production security model). The API has file size limits and type checking as basic protection.

### Session Persistence

Use `sessionStorage` (not `localStorage`) so:
- Closing the tab = must re-verify next visit (good for exhibition — each session is a new "scan")
- Refreshing within the same tab = stays authenticated
- Key: `facescan_verified` = `"true"`

---

## 4. The Current index.html Structure

The existing `index.html` is a simple full-screen layout:

```
<iframe>  — Full-screen WebRTC stream from VPS (http://187.124.168.106:8889/facescan)
<div class="overlay">  — Title "FACESCAN", live indicator, clock, metadata
```

**Fonts loaded:** `Share Tech Mono` (monospace), `Bebas Neue` (display headings)
**Color scheme:** Black background, white text, red for live indicator, low-opacity grays

The modal should sit on top of everything (z-index above the overlay which is z-index 10). When dismissed, the existing layout is revealed exactly as-is.

The iframe should NOT load until the user is verified (saves bandwidth and avoids showing the stream before "login").

---

## 5. File Structure Suggestion

```
index.html          — main page (add modal HTML here, or keep separate)
css/
  styles.css        — extracted styles + modal styles
js/
  face-capture.js   — webcam + MediaPipe face detection + capture logic
  auth-gate.js      — sessionStorage check, modal show/hide, upload to API
```

Or keep it all in `index.html` if you prefer — the current site is a single file.

---

## 6. VPS API Quick Test

You can test the API is working right now from your browser console:

```javascript
// Health check (no auth needed)
fetch('http://187.124.168.106:8000/health')
  .then(r => r.json())
  .then(d => console.log(d));
// Expected: { status: "ok" }

// List faces (needs auth)
fetch('http://187.124.168.106:8000/list_faces', {
  headers: { 'Authorization': 'Bearer BHSK7yHImyRdxkwfzWrwp7rJlvtcIl7QwSSP3W0-OVU' }
}).then(r => r.json()).then(d => console.log(d));
// Expected: { files: [...], count: N }
```

---

## 7. Security Notes

| Concern | Status |
|---------|--------|
| Token in JS source | Acceptable for exhibition — not a public production app |
| CORS | VPS allows `*` origins for now. Tighten to specific domain for production |
| File size | Server-side limit: 5MB max |
| File type | Server-side check: only JPEG/PNG/WEBP accepted |
| Path traversal | Server sanitizes filenames |
| Rate limiting | Not implemented — add if abuse becomes a concern |
| HTTPS | Not set up yet — API runs on HTTP. Add Caddy/Nginx reverse proxy for HTTPS if needed |

---

## 8. Summary — What to Build

1. A full-screen modal that blocks the page until face + name are submitted
2. Webcam preview with MediaPipe face detection (visual feedback)
3. Name input (first + last name, basic validation)
4. On submit: capture frame → crop to face → JPEG → POST to VPS API
5. On success: close modal, set sessionStorage, reveal the FACESCAN livestream
6. On failure: still grant access (degrade gracefully)

The surveillance aesthetic is critical — this should feel intimidating and institutional, not friendly.
