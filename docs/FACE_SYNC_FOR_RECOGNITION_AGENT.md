# Face Sync & web login — handoff for the recognition engineer

**Purpose:** This document summarizes **everything implemented so far** for sending face images from the website to a VPS and how **you** (the face recognition pipeline) pull them onto the local machine. It ends with **questions for you** about next steps.

**Audience:** AI agent or developer working in `YOLO_test_insightface` / `3_recognize_stream.py`, etc.

---

## 1. Background (what the project is)

- The **website** (“Insiktspunkter”) has a **Log in** modal on `index.html`: name + webcam + embedded **FACESCAN** (iframe to `http://187.124.168.106:8889/facescan`).
- **Web login** today is a **lightweight gate** (`sessionStorage`, `auth-gate.js`) — not real server-side security.
- **Face recognition** runs on a **local machine** (Mac/Windows) with InsightFace, dataset, `2_build_embeddings.py`, `3_recognize_stream.py`, etc. (see `HANDOFF.md` / `CLAUDE.md` in the repo).
- The **VPS** (e.g. `187.124.168.106`) already hosts FACESCAN and streaming. We added a **separate small API service** to receive uploaded images (“captures”).

**What we wanted to test (path A):**  
Visitor logs in on the web → a **still image** is sent to the VPS → the recognition machine **pulls** the images and saves them locally → (later) used for enrollment / training.

---

## 2. Everything we have implemented (full list)

### 2.1 VPS: Face Sync API (FastAPI)

| Item | Detail |
|------|--------|
| **Code** | `face_sync/vps_api/main.py` |
| **Dependencies** | `face_sync/vps_api/requirements.txt` (fastapi, uvicorn, python-multipart) |
| **Port (default)** | `8787` |
| **Auth** | `Authorization: Bearer <FACE_SYNC_TOKEN>` on protected endpoints |
| **CORS** | `FACE_SYNC_CORS_ORIGINS` — browser must be allowed to POST from the site; `*` for testing or a list of origins |
| **Storage** | SQLite `captures.sqlite3` + files under `files/` in `FACE_SYNC_DATA_DIR` |

**Endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Ping (no auth) |
| POST | `/api/captures` | Multipart: field `image` (JPEG/PNG/WEBP), optional `name`, `source` |
| GET | `/api/captures?since=<id>&limit=<n>` | List new captures after `id` |
| GET | `/api/captures/<id>/file` | Download original file |

**Start on VPS (example):**

```bash
cd /path/to/pois   # or copy only face_sync/vps_api + face_sync/__init__.py
python3 -m venv .venv
source .venv/bin/activate
pip install -r face_sync/vps_api/requirements.txt

export FACE_SYNC_TOKEN="long-random-string"
export FACE_SYNC_DATA_DIR="/var/lib/face-sync"
export FACE_SYNC_CORS_ORIGINS="*"   # or "https://your-domain.com,http://localhost:5173"

uvicorn face_sync.vps_api.main:app --host 0.0.0.0 --port 8787
```

*(Production: run behind Nginx/Caddy with HTTPS, firewall, optional IP allow-list.)*

---

### 2.2 Python on the recognition machine: upload (path B, optional)

Not required for path A, but already built if the **Python app** should send frames directly:

- **Code:** `face_sync/local_client/client.py` — `FaceSyncClient.upload_jpeg_bytes(...)`, `upload_file(...)`, `list_captures`, `download_capture`.
- **README:** `face_sync/README.md` with example (OpenCV → JPEG bytes → POST).

---

### 2.3 Python on the recognition machine: pull — **main work on your side for path A**

- **Script:** `face_sync/local_client/pull_captures.py`
- **Lib:** `face_sync/local_client/client.py`
- **Deps:** `face_sync/local_client/requirements.txt` (`requests`)

**Example (run from repo root where `face_sync/` lives, or copy the folder):**

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r face_sync/local_client/requirements.txt

python face_sync/local_client/pull_captures.py \
  --base-url "http://187.124.168.106:8787" \
  --token "SAME_AS_FACE_SYNC_TOKEN" \
  --out-dir "/path/where/you/want/captures" \
  --state-file "/path/face-sync-state.json"
```

- Saves files like `000042_Alice_login.jpg` (id + sanitized name + original filename).
- `state-file` tracks the latest `id` so the same image is not re-downloaded unnecessarily.

---

### 2.4 Website: upload on manual login

| File | What happens |
|------|----------------|
| `index.html` | Defines `window.FACE_SYNC`: `enabled`, `baseUrl` (e.g. `http://187.124.168.106:8787`), `token`. **Currently: `enabled: false`, `token: ""`** — must be set for uploads to occur. |
| `login.js` | On **manual** login (name + Allow camera + Log in): before the camera stops, a **still frame** is taken from `#login-camera-preview` (canvas → JPEG), then `fetch` POST to `baseUrl/api/captures` with `name` and `source=web-login`. **Fire-and-forget** (failures are not shown to the user). |

**Important:**

- **FACESCAN login** (`postMessage` from `http://187.124.168.106:8889` with `{ type: 'INSIKTPUNKTER_AUTH', name }`) **does not upload any image** — name only. Upload happens **only** for manual camera login until FACESCAN is extended or a proxy is added.
- **Token in the frontend** is intentionally **test-only**. Public site = build an upload proxy or other auth.

---

### 2.5 Other pieces in the same project (short context)

- **`auth-gate.js` + `login.js`:** Lock POI pages until a session exists; index has modal login.
- **Streaming / FACESCAN** are **separate** from the Face Sync API (different port/service).

---

## 3. End-to-end: what must be true for the flow to work

1. **VPS:** Face Sync API running on the chosen port; `FACE_SYNC_TOKEN` set; firewall allows the port (or internal/LAN only).
2. **Web:** In `index.html` — `FACE_SYNC.enabled = true`, `baseUrl` points at the API, `token` matches the bearer token.
3. **CORS:** If the page is loaded from an origin other than the VPS, `FACE_SYNC_CORS_ORIGINS` must include that origin (or `*` for lab).
4. **Recognition machine:** `pull_captures.py` runs on a schedule (cron) or manually; you choose `--out-dir` and `--state-file`.

**What does NOT happen automatically today:**  
No pulls → no new local files. No files in `dataset/<name>/` → no new recognition. No rerun of `2_build_embeddings` → the model does not learn new people.

---

## 4. What you need to do on your side (checklist)

- [ ] **1.** Bring the VPS API online and share **base URL + token** with the web team (or use token only in lab).
- [ ] **2.** Decide where captures land locally, e.g.  
  `~/Desktop/YOLO_test_insightface/staging_web_logins/`
- [ ] **3.** Run `pull_captures.py` regularly (cron every 1–5 min) or wire it into your own orchestration script.
- [ ] **4.** Decide: **inbox only** (human review → move to `dataset/<name>/`) or **auto-enroll** (detect one face, save crop, debounce, rebuild).
- [ ] **5.** If enrolling: run `2_build_embeddings.py` (and optionally `4_optimize_dataset.py`) per your pipeline; **restart** the recognition process so new embeddings load.
- [ ] **6.** (Optional) Python path: from kiosk/camera call `FaceSyncClient.upload_jpeg_bytes` directly if you want to bypass the browser.

---

## 5. Technical limitations you should know

| Limitation | Impact |
|------------|--------|
| Web upload is **full frame**, not guaranteed face-crop | Run detector + optional align before dataset. |
| Different `name` strings from the web | Normalize to folder names (consistent with `dataset/`). |
| Many logins from the same person | Duplicate risk — debounce / max N images per name per hour. |
| Token in JS | Test only; production needs backend proxy or signed uploads. |

---

## 6. Questions for you — what should we do next?

Please answer point-by-point so web and VPS can adapt.

### A. Enrollment & pipeline
1. Do you want to start with **manual review only** of `staging_web_logins/` before anything goes into `dataset/`, or aim for **semi- or full auto-enroll** immediately?
2. How should **web names** map to **dataset folders** (exact string, slug, or manual mapping table)?
3. How often can you **rebuild** embeddings/SVM — every N minutes, nightly job, or manual at the exhibition?
4. Can the recognition process **restart automatically** after rebuild, or must it be manual?

### B. FACESCAN vs webcam
5. Should the **FACESCAN iframe** also send **image or face-crop** (e.g. extended `postMessage`) so upload happens when people don’t use manual camera? If yes: can you change the FACESCAN app to post base64/canvas or URL to a capture endpoint?
6. Should the **Python kiosk** (path B) be the primary source for “real” enrollment images and the web only a backup?

### C. VPS & security
7. Should we add an API for **delete / “consumed”** after successful pull (GDPR, disk, privacy)?
8. Should uploads require **HTTPS + proxy** with no token in the browser (e.g. short-lived upload URL from your backend)?
9. Do we need **rate limiting** or per-IP caps on the VPS?

### D. Product / legal
10. What **retention** should apply for captures on VPS and locally (hours, days, delete after pull)?
11. Should visitors be explicitly told that a **face image is stored** for recognition testing (copy on the page)?

---

## 7. Quick reference — files in the repo

| Path | Role |
|------|------|
| `face_sync/vps_api/main.py` | VPS API |
| `face_sync/local_client/pull_captures.py` | Pull captures to disk |
| `face_sync/local_client/client.py` | HTTP client (upload/list/download) |
| `face_sync/README.md` | Short setup |
| `index.html` | `window.FACE_SYNC` |
| `login.js` | Still frame + upload on manual login |

---

*Last updated for handoff to recognition / AI agent. Update this file once you’ve answered the questions and changed the flow.*
