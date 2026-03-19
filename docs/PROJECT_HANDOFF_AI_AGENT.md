# Insiktspunkter / FACESCAN — AI Agent Handoff

**Audience:** coding agents integrating, extending, or debugging this repo.  
**Goals:** explain architecture, key flows, and file responsibilities so you can safely:
- Modify the website & login/dossier behavior
- Work with the VPS Face Sync / dropzone API
- Coordinate with the Python recognition pipeline (separate repo, hinted in docs)

---

## 1. Repo structure (post-refactor)

Root: `/Users/.../pois`

- `pages/` — all HTML entry points
  - `index.html` — landing page + login modal + Invisible Profile + cookie/biometric banner
  - `poi-1.html`…`poi-6.html` — “points of interest” pages (Swedish content)
  - `poi-final.html` — concluding POI
  - `summary.html` — summary page
  - `terms.html` — terms of service for demo
- `scripts/`
  - `auth-gate.js` — client-side login gate for POI/summary/final pages
  - `login.js` — index login modal logic (session storage, FACESCAN iframe integration)
  - `script.js` — general UI wiring (modals etc., used across pages)
  - `cookie-consent.js` — cookie banner + Invisible Profile start + now orchestrates biometric paywall
  - `poi-header-logout.js` — logout button & “logged-in name” on POI headers
  - `biometric-paywall.js` — MediaPipe-based face capture + upload to VPS dropzone
  - `ads.js` — ad-blocker bait (same-origin script)
- `assets/`
  - `assets/images/` — logos, screenshots, POI images:
    - `övmyndigheten.png` — header logo
    - `gs.png` — Gunnar Strömmer image for POI 1
    - `Centrum-for-rattvisa.png` — POI 1 legal org image
    - Screenshots used in POI 1 (`Screenshot 2026-03-18 at 09.57.17.png`, etc.)
  - `assets/video/`
    - `Glitch_face_transformation_effect_delpmaspu_.mp4` — glitch clip in POI 3
- `src/` (Vite/React)
  - `main.jsx` — React entry used for charts (mounts into specific DOM nodes only)
  - `SurveillanceChart.jsx`, `DroneStatsCharts.jsx` — chart components
  - `invisibleProfile/` — entire Invisible Profile implementation:
    - `boot.js` — mounts into `#invisible-profile-root` if present
    - `state.js` — global in-memory state + pub/sub + error logging
    - `ui.js` — DOM UI for User view + Dossier view
    - `workers.js` — orchestrates collectors + inference + timers
    - `inference.js` — rules-based “AI-style” inference summarizer
    - `collectors/*.js` — all signal collectors (network, fingerprint, behavior, storage, etc.)
- `face_sync/`
  - `vps_api/main.py` — FastAPI app: Face Sync + dropzone endpoints
  - `vps_api/requirements.txt` — Python deps for VPS
  - `local_client/client.py`, `pull_captures.py` — local helper to upload/pull captures
- `docs/`
  - `HANDOFF.md`, `BUILD_PLAN.md`, `CLAUDE.md`, `FACESCAN_WEB_HANDOFF.md`, `FACE_SYNC_FOR_RECOGNITION_AGENT.md`
  - `PROJECT_HANDOFF_HUMAN.md` — human-facing overview
  - `PROJECT_HANDOFF_AI_AGENT.md` — this file
- `archive/` — non-runtime sources (design files, unused assets, etc.)
- `dist/` — Vite build output (entry at `dist/pages/index.html`)
- `package.json`, `vite.config.js` — Node/Vite config

**Vite config** (`vite.config.js`):
- `root: '.'`
- `build.rollupOptions.input.main = 'pages/index.html'`
- React plugin active, but most of the site is static HTML.

---

## 2. Core flows

### 2.1 POI login gate (client-side auth-gate)

Files:
- `scripts/auth-gate.js`
- `scripts/login.js`
- `pages/index.html`
- `pages/poi-*.html`, `pages/summary.html`, `pages/poi-final.html`

Mechanism:
- **POI/summary/final pages** (`pages/poi-1.html` etc.) include:
  - `<script src="../scripts/auth-gate.js"></script>` immediately after `<body>`.
- `auth-gate.js`:
  - Computes `file = location.pathname.split('/').pop().toLowerCase()`.
  - Skips `index.html` and any non-gated files.
  - Maintains a `gated` list of allowed POIs.
  - Reads `poiSiteAuth` from `sessionStorage`.
  - If missing, malformed, or expired, redirects to:
    - `index.html?next=<target.html>` (note: relative to current path).

Login workflow:
- `pages/index.html` defines a **login modal**:
  - Manual path:
    - User enters **display name**.
    - Enables camera preview.
    - Clicks “Logga in”.
    - `login.js`:
      - Validates non-empty name and active camera.
      - Sets `poiSiteAuth` = `{ ok: true, name, ts }` in `sessionStorage`.
      - Calls `showAuthed(name)`, which:
        - Updates header label “Inloggad: <name>”.
        - Reveals `#gated-after-login` content (POI links).
        - Optionally navigates to the `next` POI.
  - FACESCAN path:
    - An iframe loads `http://187.124.168.106:8889/facescan`.
    - It is expected to `postMessage({ type: 'INSIKTPUNKTER_AUTH', name }, origin)` to the parent.
    - `login.js` listens for this message and calls `completeLogin(name, false)`, skipping local camera requirement.

Logout:
- `poi-header-logout.js` (on POIs):
  - Reads `poiSiteAuth` to show the logged-in user name.
  - On “Logga ut”, removes `poiSiteAuth` and navigates to `pages/index.html`.

**Agent note:** persisting this behavior when refactoring:
- Keep `SESSION_KEY = 'poiSiteAuth'` consistent across scripts.
- If you change filenames or move pages again, update:
  - `gated` list in `auth-gate.js`
  - redirect target `index.html` (currently root-relative from `pages/`).

---

### 2.2 Invisible Profile (browser dossier)

Files:
- `src/invisibleProfile/*`
- `pages/index.html` (section markup + `#invisible-profile-root`)
- `style.css` (styles for `ip-*` classes)

Mount:
- `src/main.jsx`:

```js
import { bootInvisibleProfile } from './invisibleProfile/boot.js';

const rootEl = document.getElementById('poi-chart-root');
// ... charts mount

bootInvisibleProfile();
```

- `bootInvisibleProfile()`:
  - Looks for `#invisible-profile-root` in DOM.
  - Calls `mountInvisibleProfile(root)` if present.

State & rendering:
- `state.js`:
  - `state` object holds all collected data (`network`, `fingerprint`, `behavior`, `storage`, etc.).
  - `subscribe(fn)` + `setState(patch)` implement a simple pub-sub pattern.
  - `pushError(err)` appends to `state.errors`.
- `ui.js`:
  - Builds DOM using small helper `el(tag, attrs, children)`.
  - Contains:
    - **User View** (left column): controls, toggles, hints.
    - **Dossier View** (right column): sticky panel with sections.
  - Sections use `<details>` with titles, risk pills, summaries, and nested “Technical details” toggles.
  - Persists open state per section and per “Technical details” block using maps (`detailsOpenState`, `techOpenState`).
  - Listens for custom event `ip-consent-accepted` (emitted by `cookie-consent.js`) to **start collectors**.
- `workers.js`:
  - `startCollectors()`:
    - Guards `started` flag.
    - Immediately collects:
      - Storage breadcrumbs (`collectStorageBreadcrumbs`)
      - Behavior collectors (`startBehaviorCollectors`)
      - Environment (`collectEnvironment`), connection (`collectConnection`)
      - Permissions (`collectPermissions`)
      - Storage estimate (`collectStorageEstimate`)
      - Media capabilities (`collectMediaCapabilities`)
      - Page context (`collectPageContext`)
      - Adblock detection (`collectAdblock`)
    - Triggers async:
      - IP geo (`collectNetworkIp`)
      - Fingerprint (`collectFingerprint`)
      - Login sniffing (`collectLoginSniffing`)
    - HSTS:
      - Reads or initializes `state.hsts.cfg` from `defaultHstsConfig()`.
      - If `cfg.enabled`, calls `readHstsBits(cfg)`.
      - Otherwise sets a note explaining configuration requirements.
    - Optional audio fingerprint:
      - If `state.invasiveEnabled === true`, calls `collectAudioFingerprint()`.
      - Else sets a note indicating it’s disabled.
    - Inference:
      - Schedules `inferProfile(...)` every 1500 ms, stores in `state.inference`.
    - Periodic refresh:
      - Every 4 seconds, re-runs `collectConnection()` and `collectPageContext()`.
  - `purgeAll()`:
    - Stops behavior collectors and timers.
    - Clears storage breadcrumbs (cookie/local/session keys).
    - Resets almost all state fields to null/false, but:
      - Leaves `hsts` with an explanatory note that true HSTS cannot be cleared from JS.

Collectors overview (under `src/invisibleProfile/collectors/`):
- `networkIp.js` — IP geo via external API(s).
- `fingerprint.js` — WebGL vendor/renderer, UA/platform/lang, battery, screen metrics, canvas hash, font availability.
- `behavior.js` — keystroke cadence, mouse jitter/moves, referrer, history length.
- `storage.js` — demo cookie (`ip_demo_tracking_id`), localStorage zombie, sessionStorage session.
- `loginSniffing.js` — favicon load/error/timeout for Google/Facebook/LinkedIn.
- `hstsSupercookie.js` — drop-in for a real HSTS-based supercookie (requires configured subdomains + HTTPS).
- `environment.js` — timezone, locale, languages, DNT, GPC, cookieEnabled, UA-Client-Hints.
- `connection.js` — `navigator.connection` (effectiveType, downlink, rtt, saveData).
- `permissions.js` — `navigator.permissions` states; `requestGeolocation()` wrapper.
- `storageEstimate.js` — `navigator.storage.estimate()`.
- `media.js` — `canPlayType` hints + `enumerateDevices()` counts.
- `pageContext.js` — `location`, search/UTM parsing, `document.referrer`, `history.length`.
- `adblock.js` — `ads.js` load/error/time; `likely_adblock` inference.
- `audioFingerprint.js` — OfflineAudioContext-based hash of a synthetic graph.

Inference:
- `inference.js`:
  - `inferProfile({ identity, network, fingerprint, environment, connection, permissions, geolocation, media, storageEstimate, pageContext, adblock, behavior, storage, loginSniffing, audioFingerprint })`
  - Produces:
    - `summary` (human-readable one-line inference)
    - `wealth` (high/medium/unknown) based on cores/RAM/GPU/region
    - `profession` guess (dev/design/office/unknown) based on fonts, UA, platform
    - `privacy` object with aggregated signals (VPN/proxy/GPC/DNT/adblock/audio fingerprint)
    - a `context` object (timezone, connection, devices, quota, UTMs)

**Agent notes when editing Invisible Profile:**
- Don’t break `ip-consent-accepted` event contract; `cookie-consent.js` relies on it.
- Any new collectors must:
  - Be gated behind `state.started` and respect consent.
  - Avoid excessive external calls; prefer caching and “best-effort”.
- Keep a clear separation:
  - **Summary bullets** per section for humans.
  - **Technical details** toggles for deeper inspection.

---

### 2.3 Cookie consent + Biometric Paywall

Files:
- `pages/index.html`
- `scripts/cookie-consent.js`
- `scripts/biometric-paywall.js`
- `style.css` (IP cookie banner + biometric modal styles)
- `face_sync/vps_api/main.py` (dropzone endpoints)

Config on page:

```html
<script>
  window.FACE_DROPZONE = {
    enabled: true,
    baseUrl: "http://187.124.168.106:8787",
    token: ""  // MUST be set to FACE_SYNC_TOKEN in real deployment
  };
</script>
```

Banner markup (index):
- `#ip-cookie-banner` at bottom of `index.html`:
  - `#btn-cookie-banner-accept` — main “Acceptera cookies” call-to-action.
  - Terms of Service link.
- Footer also has a `#btn-accept-cookies` button that does the same.

`cookie-consent.js` behavior:
- Maintains `ipCookieConsentAccepted` in `localStorage`.
- Emits custom `ip-consent-accepted` event to start Invisible Profile.
- New logic:
  - **Always** call `ensureBiometricCaptureIfAvailable()` before unlocking.
  - Only auto-unlocks if **both**:
    - Cookie consent is `true`
    - `IP_BIOMETRIC_PAYWALL.hasCaptured()` returns `true`

`IP_BIOMETRIC_PAYWALL` contract:
- Implemented in `scripts/biometric-paywall.js` as:

```js
window.IP_BIOMETRIC_PAYWALL = {
  captureAndUpload: async () => { ... },
  hasCaptured: () => boolean,
  markCaptured: () => void,
  openModal: () => void,
  closeModal: () => void,
};
```

`captureAndUpload` flow:
1. If `hasCaptured()` is already true, returns `{ ok: true, skipped: true }`.
2. Otherwise:
   - Opens `#ip-bio-modal`.
   - Requests webcam (`getUserMedia`).
   - Sets up MediaPipe **FaceDetection**:
     - Uses model `short`, `minDetectionConfidence = 0.6`.
     - On each frame:
       - Picks the **largest bounding box**.
       - Keeps track of **stability** across `REQUIRED_STABLE_FRAMES` frames.
   - Once stable:
     - Crops around the face to a square using the raw video frame.
     - Resizes to 256×256.
     - Encodes as JPEG (quality ~0.86).
3. Upload:
   - Creates `FormData` with field `image` = JPEG blob.
   - `POST` to `${FACE_DROPZONE.baseUrl}/upload_face` with `Authorization: Bearer <token>`.
   - On 2xx, calls `markCaptured()` and returns `{ ok: true }`.
4. Errors:
   - Status text in `#ip-bio-status`.
   - Stops camera and leaves modal open/closed depending on state.

**Agent notes when changing paywall:**
- Respect the contract that upload must succeed **before** calling `setConsent()` and `triggerStart()`.
- If you change `captureAndUpload`, update `ensureBiometricCaptureIfAvailable()` accordingly.
- Never hardcode secrets in `FACE_DROPZONE.token` in long-term; inject via environment or server templating.

---

### 2.4 VPS Face Sync + Dropzone API

File: `face_sync/vps_api/main.py`

Settings:
- `FACE_SYNC_TOKEN` (required)
- `FACE_SYNC_DATA_DIR` (default `./face_sync_data`)
- `FACE_SYNC_CORS_ORIGINS` (default `*`)

Directories:
- DB: `FACE_SYNC_DATA_DIR/captures.sqlite3` (Face Sync)
- Files: `FACE_SYNC_DATA_DIR/files/` (Face Sync)
- Pending faces: `FACE_SYNC_DATA_DIR/pending_faces/` (Dropzone)

Auth:
- All non-health endpoints require `Authorization: Bearer <FACE_SYNC_TOKEN>`.

Dropzone endpoints (for web → exhibition bridge):
- `POST /upload_face`
  - Multipart field `image` (JPEG only).
  - Rejects >3MB.
  - Generates filename: `web_<UTC stamp>_<token>.jpg`.
  - Writes file to `pending_faces/`.
  - Returns `{ ok, filename, bytes, created_at }`.
- `GET /list_faces`
  - Scans `pending_faces/*.jpg`.
  - Returns `{ items: [ { name, bytes, mtime }, ... ] }`.
- `GET /download_face/{name}`
  - Validates filename against a safe regex (`^[A-Za-z0-9][A-Za-z0-9._-]{0,200}$`).
  - Serves JPEG file from `pending_faces/`.
  - Schedules a background task to **delete the file** after sending.

Face Sync endpoints (for generic capture sync, if needed):
- `POST /api/captures` (upload with metadata into DB)
- `GET /api/captures`
- `GET /api/captures/{id}/file`

**Agent notes when editing VPS API:**
- Do not change auth semantics casually; clients assume Bearer token behavior.
- Respect `PENDING_DIR` behavior:
  - `download_face` must delete file on successful send to maintain “pending queue” semantics.
- For very high load, consider switching to async file IO or streaming responses, but for this exhibition context the current approach is adequate.

---

## 3. Python-side (external) expectations

The main recognition repo isn’t embedded here, but from `HANDOFF.md`, `FACESCAN_WEB_HANDOFF.md`, and `FACE_SYNC_FOR_RECOGNITION_AGENT.md` you should assume:

- Recognizer scripts (e.g. `3_recognize_stream_ver2_CUR.py`) expect **embeddings + SVM classifier** built by a separate script (e.g. `2_build_embeddings_ver2_CUR.py`).
- A sync script (`6_vps_sync.py`) is supposed to:
  - Poll the **dropzone** (not `/api/captures`) every 5–10s.
  - Download faces to `id_from_web/`.
  - Exit or idle — no automatic integration into the dataset.
- The curator is the **only actor** moving faces into `dataset/<name>/` and rebuilding.

**If you build tooling for the curator:**
- Do not auto-enroll faces into the dataset without explicit design approval.
- Safe extension: a small CLI that:
  - Lists `id_from_web/` images with simple thumbnails.
  - Asks for a target name/folder and moves images into `dataset/<name>/`.
  - Optionally runs the embeddings rebuild script at the end.

---

## 4. Common changes & how to do them safely

### Change the VPS host or port
- Update:
  - `FACE_DROPZONE.baseUrl` in `pages/index.html` (and ideally in one place).
  - `FACE_SYNC.baseUrl` if you use it for other flows.
- Ensure CORS (`FACE_SYNC_CORS_ORIGINS`) includes the web origin.

### Make Invisible Profile more/less invasive
- To **disable** dangerous collectors:
  - Audio fingerprint: remove or gate `collectAudioFingerprint()` path.
  - Login sniffing: wrap `collectLoginSniffing()` in a user toggle.
  - HSTS demo: leave it purely explanatory unless you actually have subdomains.
- To **add** new collectors:
  - Create `collectors/newThing.js` with a pure function that:
    - Reads from browser APIs.
    - Writes a small JSON into `state.newThing`.
  - Call it from `startCollectors()` and/or a periodic refresh.
  - Add a new section in `ui.js` with:
    - user-facing bullets (plain language),
    - `Risk` pill,
    - `Technical details` wrapper around `renderKV(state.newThing)`.

### Adjust the Biometric Paywall behavior
- To change when it triggers:
  - Modify `cookie-consent.js`’s use of `ensureBiometricCaptureIfAvailable()` and `hasBiometricCapture()`.
- To change upload format:
  - Edit `biometric-paywall.js` (crop size, JPG quality, etc.).
  - Corresponding server (`upload_face`) is tolerant as long as content-type is JPEG.

---

## 5. Final guidance for agents

1. **Respect the critique framing.** This is an art/research piece, not a production security system.
2. **Guard rails:** keep data collection behind explicit user actions (cookie/biometric consent, toggles).
3. **VPS load & safety:** don’t add heavy work to the VPS app; offload heavy processing to the exhibition machine.
4. **Reversibility:** prefer additive changes (new endpoints, new sections) over destructive refactors; preserve public contracts where possible.

If you need more details about the Python recognition side, consult the external repo described in `HANDOFF.md` and treat this project as the **web + bridge** layer in that ecosystem.+
