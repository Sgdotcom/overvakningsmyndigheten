# Insiktspunkter / FACESCAN — Human Handoff (Exhibition Version, 2026)

## 1. What this project is

- **Context**: Art installation in Stockholm (Swedish election 2026) about surveillance, facial recognition, and data profiling.
- **Two physical components**:
  - **Exhibition PC** with camera + FACESCAN (Python + InsightFace) doing real-time face recognition and streaming.
  - **Public website** that:
    - locks content behind a **“Biometric paywall”** (face capture),
    - shows a live **“Invisible Profile”** dossier built from browser/device signals.
- All of this is critique / demo, not a real government system.

---

## 2. High-level architecture

### 2.1 Exhibition side (Python)

- **Recognition**: InsightFace (`buffalo_l`), SVM + cosine + Norfair tracking.
- **Streaming**: Python → FFmpeg → VPS → MediaMTX (RTSP/WebRTC/HLS).
- **Datasets**: `dataset/<person_name>/` on the exhibition machine.
- **Curator workflow**: curator manually enrolls people into the dataset and triggers rebuilds.

### 2.2 VPS (Linux server)

- Already hosts:
  - **MediaMTX** relay for the camera stream.
  - **FACESCAN web app** at `http://187.124.168.106:8889/facescan` (used in the login modal).
- New:
  - **Face Sync API** (FastAPI) for:
    - generic uploads (`/api/captures`)
    - a **“Dropzone”** area for web face crops (`/upload_face`, `/list_faces`, `/download_face/{name}`).

### 2.3 Website (Vite + vanilla HTML)

- All HTML pages live in `pages/` (e.g. `pages/index.html`, `pages/poi-1.html`, etc.).
- All scripts live in `scripts/`.
- Styles live in `style.css`.
- There is a small React piece (`src/main.jsx`) for charts, but most of the site is plain HTML + JS.

---

## 3. Main experiences

### 3.1 Biometric Paywall (face capture)

- The **cookie banner** (“Acceptera cookies”) is actually a biometric paywall.
- When clicked:
  1. A **modal** opens (`Biometric paywall`) with webcam preview.
  2. A lightweight **MediaPipe** detector finds the largest face.
  3. The system:
     - Crops to a square face,
     - Resizes it,
     - Compresses to a small JPEG,
     - Uploads that JPEG to the VPS **dropzone** (`/upload_face`).
  4. Only when upload succeeds:
     - A “session captured” flag is set locally.
     - The “Invisible Profile” dossier is unlocked and starts.

> Important: a **token** is required to actually talk to the VPS; in dev mode this can be left empty for testing (it will show errors in the modal).

### 3.2 Invisible Profile (browser dossier)

Once cookies/biometric are accepted, the **Invisible Profile** section appears and begins collecting **read-only signals**:

- **Network & IP**: approximate city/region/country + ISP from IP lookup.
- **Device fingerprint**: GPU model, CPU core count, RAM, screen/window size, a canvas-based “device ID”, font presence.
- **Environment & privacy**: timezone, preferred languages, Do Not Track / Global Privacy Control, cookies enabled.
- **Connection**: rough connection type, RTT, downlink (where supported).
- **Permissions & location**:
  - Permission states (camera/mic/geolocation/notifications).
  - Optional precise GPS (only after user explicitly clicks “Request precise geolocation”).
- **Media capabilities**: video/audio codec support, counts of input/output devices.
- **Storage quota**: how much storage the browser is willing to allocate for this origin.
- **Breadcrumbs**: demo tracking IDs stored in cookie, localStorage, sessionStorage.
- **Adblock detection**: loads a fake `ads.js` and infers if an ad-blocker is likely.
- **Login sniffing (best-effort)**: favicon-based probes to Google/Facebook/LinkedIn (unreliable on modern browsers but shown as critique).
- **HSTS supercookie (demo)**: placeholder; only fully works if extra subdomains + HTTPS are configured.
- **Audio fingerprint (optional)**: only runs if the “invasive signals” toggle is enabled.

All of this is surfaced in a live **“dossier”** with:

- A **plain-language summary** section.
- For each topic (Network, Fingerprint, Permissions, etc.):
  - A short list of human-friendly bullet points,
  - A **Risk label** (Low/Medium/High),
  - An expandable **“Technical details”** block for deeper inspection.

### 3.3 POI pages & login gate

- POI pages (`pages/poi-1.html`…`poi-6.html`, `pages/summary.html`, `pages/poi-final.html`) are **locked** behind a light login gate:
  - **`scripts/auth-gate.js`** checks for a session key in `sessionStorage` and redirects unauthenticated users to `pages/index.html?next=<poi-X.html>`.
  - The **login modal** on the start page has:
    - A **manual** webcam + name route (for in-browser gating),
    - A **FACESCAN iframe** showing the real-time recognition app.
  - A successful login sets a session key and unlocks the POIs.

> Note: this is **not** real security — it’s for narrative framing only.

---

## 4. OPS: How to run each part

### 4.1 Website (dev & build)

From the repo root (`/Users/.../pois`):

```bash
npm install           # first time
npm run dev           # local dev (Vite, see terminal for port)
npm run build         # production build into dist/
```

- Vite is configured to treat `pages/index.html` as the entry point.
- After build, the entry will be `dist/pages/index.html` plus bundled assets.

### 4.2 VPS Face Sync / Dropzone

On the VPS, from this repo (or a copy of `face_sync/`):

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r face_sync/vps_api/requirements.txt

export FACE_SYNC_TOKEN="long-random-string"
export FACE_SYNC_DATA_DIR="/var/lib/face-sync"
export FACE_SYNC_CORS_ORIGINS="*"   # or specific origins

uvicorn face_sync.vps_api.main:app --host 0.0.0.0 --port 8787
```

**Endpoints (Dropzone):**

- `POST /upload_face` (multipart, `image` JPEG) → saves to `pending_faces/`.
- `GET /list_faces` → lists pending files.
- `GET /download_face/{name}` → serves a file and deletes it afterwards.

**Endpoints (generic Face Sync):**

- `POST /api/captures`
- `GET /api/captures?since=<id>&limit=100`
- `GET /api/captures/{id}/file`

All protected with `Authorization: Bearer <FACE_SYNC_TOKEN>`.

### 4.3 Exhibition-side sync

On the exhibition PC, a script (`6_vps_sync.py` or similar) should:

1. Poll `GET /list_faces`.
2. Download each image with `GET /download_face/{name}` into e.g. `id_from_web/`.
3. Stop. No automatic retraining.

The curator then:

1. Inspects `id_from_web/*.jpg`.
2. Moves selected faces into `dataset/Web_Visitor_XX/`.
3. Runs the embeddings build script.
4. Reloads the recognition stream (press `R` in the running Python script).

---

## 5. Folder map (what matters)

- **Frontend pages**: `pages/`
- **Frontend scripts**: `scripts/`
- **Shared CSS**: `style.css`
- **Charts React entry**: `src/main.jsx` (plus `SurveillanceChart.jsx`, `DroneStatsCharts.jsx`)
- **Face Sync / Dropzone API**: `face_sync/vps_api/main.py`
- **Local Face Sync client**: `face_sync/local_client/`
- **Docs for humans**: `docs/` (this file + original handoff docs)
- **Archive files** (assets not currently in use): `archive/`

If you only remember one thing:  
**The “accept cookies” button is the biometric gate**: it captures a face, sends it to the VPS, then reveals the browser dossier that shows just how much can be inferred about you on the fly.  
The **curator** uses the dropzone images and the Python tools to selectively promote visitors into the permanent watchlist for the exhibition.+
