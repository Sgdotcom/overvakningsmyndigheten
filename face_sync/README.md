# Face Sync (VPS ⇄ Local)

Goal: let the **local Python app** (OpenCV/InsightFace) upload “login face scans” to the **VPS**, and optionally let the **local machine pull them back** and save to disk.

## 1) VPS: run the upload API

On the VPS (Ubuntu 24.04), from this repo (or copy just `face_sync/vps_api/`):

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r face_sync/vps_api/requirements.txt

export FACE_SYNC_TOKEN="change-me-to-a-long-random-string"
export FACE_SYNC_DATA_DIR="/var/lib/face-sync"   # optional

uvicorn face_sync.vps_api.main:app --host 0.0.0.0 --port 8787
```

Endpoints:
- `POST /api/captures` (multipart upload)
- `GET /api/captures?since=<id>&limit=100`
- `GET /api/captures/<id>/file`

All endpoints require:
- `Authorization: Bearer $FACE_SYNC_TOKEN`

## Dropzone endpoints (Biometric Paywall)

These are compatible with the `FACESCAN_WEB_HANDOFF.md` “dropzone” contract.

- `POST /upload_face` (multipart: `image` JPEG only) → saves to `pending_faces/`
- `GET /list_faces` → lists pending filenames
- `GET /download_face/{name}` → downloads file **and deletes it after sending**

## 2) Local: upload from your Python app

Install deps locally:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r face_sync/local_client/requirements.txt
```

Example (from any OpenCV loop):

```python
import cv2
from face_sync.local_client.client import FaceSyncClient

client = FaceSyncClient(
    base_url="https://YOUR_VPS_HOST:8787",
    token="YOUR_FACE_SYNC_TOKEN",
)

# frame is a BGR numpy array from OpenCV
ok, jpg = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 92])
client.upload_jpeg_bytes(
    jpg.tobytes(),
    name="optional-name",
    source="local-python-login",
)
```

## 3) Local: pull new captures from VPS and save to disk

```bash
python face_sync/local_client/pull_captures.py \
  --base-url "https://YOUR_VPS_HOST:8787" \
  --token "YOUR_FACE_SYNC_TOKEN" \
  --out-dir "/path/to/save/images" \
  --state-file "/path/to/face-sync-state.json"
```

It will only download captures after the last saved `id`.

## Notes / ops
- Put this behind HTTPS (Caddy/Nginx) or run uvicorn behind a reverse proxy.
- Add a firewall rule so only your booth machine can reach `:8787` if desired.
- The server stores images + a small SQLite DB under `FACE_SYNC_DATA_DIR`.

