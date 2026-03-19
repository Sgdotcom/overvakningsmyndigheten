# FACESCAN — Project Handoff
**Date:** 2026-03-17  
**Prepared for:** New Claude chat session

---

## Project Overview

FACESCAN is a real-time face detection and recognition system built for a public art exhibition in Stockholm (2026 Swedish election context). It detects and identifies faces from a live camera feed, displays a watchlist panel of identified subjects, and streams the annotated video to a public website via a VPS relay.

The project sits at the intersection of surveillance critique, computer vision, and interactive exhibition design. Caspar is a student at Beckmans Designhögskola (VK programme).

---

## Hardware

- **Development machine:** MacBook Pro M3 Max, 36GB unified memory
- **Exhibition machine:** Windows PC with dedicated NVIDIA GPU (migration pending)
- **Camera:** USB webcam (UVC Camera VendorID_7119 ProductID_8836) + Canon EOS R6 Mark II being tested
- **VPS:** Hostinger KVM 1, Ubuntu 24.04 LTS, IP: 187.124.168.106

---

## Python Recognition Pipeline

### Environment
```bash
source ~/Desktop/YOLO_test/.venv311/bin/activate
cd ~/Desktop/YOLO_test_insightface/
```

### Architecture
InsightFace buffalo_l (SCRFD detection + 5-point alignment + ArcFace 512-dim embeddings) → SVM classifier → Norfair tracker with appearance-aware matching + lost-track re-ID + label hysteresis.

**Critical:** Training and runtime both use InsightFace's aligned embedding pipeline. Training pads images 50% and runs `insight_app.get(padded_rgb)`. YOLO has been removed entirely from all scripts.

### Script Set (all in `~/Desktop/YOLO_test_insightface/`)

| Script | Purpose |
|--------|---------|
| `0_passive_capture.py` | Passive camera capture of unknowns → `staging/` |
| `1_collect_faces.py` | Webcam capture, C to freeze, type name, ENTER to save |
| `2_build_embeddings.py` | Builds `embeddings.pkl` + trains `classifier.pkl` (SVM) |
| `2b_build_facts.py` | Terminal UI to enter age + occupation → `facts.json` |
| `3_recognize.py` | Live recognition v5 — main script |
| `3_recognize_surveillance.py` | Surveillance aesthetic variant with watchlist panel + FFmpeg streaming |
| `4_optimize_dataset.py` | 4-stage quality filter with greedy diversity cap |
| `4b_augment_dataset.py` | Augmentation for underrepresented people only |
| `5_sort_unidentified.py` | Sort captured faces into dataset folders |

### Workflow
```
0_passive_capture → staging/ (rename to names, move to dataset/)
    OR
1_collect_faces
    ↓
4_optimize (DRY_RUN=True first, then False)
    ↓
4b_augment (only if someone has <30 originals)
    ↓
2_build_embeddings
    ↓
3_recognize / 3_recognize_surveillance
```

### Key Config (`3_recognize.py` v5)
```python
DET_SIZE                  = (320, 320)
RECOGNITION_EVERY         = 2
EMBEDDING_BUFFER_SIZE     = 15
MIN_FRAMES_TO_LABEL       = 4
SVM_CONFIDENCE_THRESHOLD  = 0.45
SVM_AMBIGUITY_MARGIN      = 0.10
COSINE_RECOGNITION_THRESHOLD = 0.38
TRACKER_DISTANCE_THRESHOLD   = 0.6
TRACKER_HIT_COUNTER_MAX      = 15
APPEARANCE_WEIGHT            = 0.5
LOST_TRACK_MEMORY_SEC        = 6.0
REID_SIMILARITY_THRESHOLD    = 0.60
LABEL_VOTE_WINDOW            = 12
LABEL_ACCEPT_VOTES           = 4
LABEL_REVOKE_VOTES           = 7
LABEL_LOCK_COOLDOWN_SEC      = 2.0
```

### Three v5 Upgrades
1. **Appearance-aware matching** — Norfair distance = `APPEARANCE_WEIGHT * cosine_dist + (1-APPEARANCE_WEIGHT) * iou_dist`. Prevents ID swaps.
2. **Lost-track re-ID** — Dropped tracks saved to memory bank. New tracks inherit identity if cosine sim ≥ 0.60.
3. **Label hysteresis** — 4 votes to accept, 7 votes to revoke, 2s cooldown. No flicker.

### Dataset
16 people currently. Target: 150 faces for exhibition.
Located at `~/Desktop/YOLO_test_insightface/dataset/`

---

## Surveillance Variant (`3_recognize_surveillance.py`)

Built for exhibition display. Key differences from `3_recognize.py`:

- `DET_SIZE = (640, 640)` + `RECOGNITION_EVERY = 1` — genuine processing lag, not fake slow FPS
- **Watchlist panel** (280px right column) — freeze-frame + name + confidence bar + facts + timestamp for each identified person
- **Realistic UI aesthetic** — dark charcoal, amber for matches, no green-on-black matrix style
- Corner bracket boxes (thickness=2), clean label bars, status bar along bottom
- Press `C` to clear watchlist

### FFmpeg Streaming (added to `3_recognize_surveillance.py`)
The script pipes annotated OpenCV frames into FFmpeg which streams to the VPS:
```python
STREAM_ENABLED = True
VPS_IP         = "187.124.168.106"
VPS_STREAM_URL = f"rtsp://publishuser:publishpass@{VPS_IP}:8554/facescan"
```
FFmpeg reads from stdin (`pipe:0`) so the stream shows recognition overlays, not raw camera.

---

## Streaming Infrastructure

### Full Pipeline
```
Camera → Python recognition script (annotated frames)
    → FFmpeg (encodes to H.264, pushes RTSP)
        → VPS MediaMTX (receives + re-serves as WebRTC)
            → Website / browser
```

### VPS Setup (Hostinger, 187.124.168.106)
- **OS:** Ubuntu 24.04 LTS
- **MediaMTX:** v1.9.1, installed at `/usr/local/bin/mediamtx`
- **Config:** `/etc/mediamtx.yml`
- **Service:** runs as systemd service, starts automatically on boot
- **SSH:** `ssh root@187.124.168.106`

### MediaMTX Config (`/etc/mediamtx.yml`)
```yaml
logLevel: info
logDestinations: [file]
logFile: /var/log/mediamtx.log

rtspAddress: :8554
rtmpAddress: :1935
webrtcAddress: :8889
webrtcEncryption: no
webrtcAllowOrigin: '*'
webrtcLocalUDPAddress: :8189
webrtcIPsFromInterfaces: yes

hlsAddress: :8888
hlsAlwaysRemux: yes
hlsSegmentCount: 7
hlsSegmentDuration: 1s

api: yes
apiAddress: :9997

paths:
  facescan:
    source: publisher
    publishUser: publishuser
    publishPass: publishpass
    readUser: viewuser
    readPass: viewpass
```

### Open Ports
22 (SSH), 8554 (RTSP in), 1935 (RTMP), 8889 (WebRTC out), 8888 (HLS), 8189/udp (WebRTC), 9997 (API)

### Stream URLs
- **View in browser (WebRTC, ~sub-second latency):** `http://187.124.168.106:8889/facescan`
- **Publish from local machine:** `rtsp://publishuser:publishpass@187.124.168.106:8554/facescan`
- **HLS (higher latency fallback):** `http://187.124.168.106:8888/facescan/index.m3u8`

### Test Stream Script (`~/Desktop/quicktest/stream_test.py`)
```python
import subprocess
VPS_IP = "187.124.168.106"
command = [
    "ffmpeg", "-f", "avfoundation", "-framerate", "30",
    "-video_size", "1280x720", "-i", "0",
    "-c:v", "libx264", "-preset", "ultrafast", "-tune", "zerolatency",
    "-f", "rtsp", f"rtsp://publishuser:publishpass@{VPS_IP}:8554/facescan"
]
subprocess.run(command)
```

---

## Website (`~/Desktop/quicktest/index.html`)

Hosted on GitHub Pages (not yet deployed, currently tested locally). Static HTML with:
- Full-screen iframe embedding `http://187.124.168.106:8889/facescan`
- FACESCAN title overlay (Bebas Neue font)
- Blinking red LIVE indicator
- Live clock (updates every second)
- Corner bracket frame marks
- Dark/clinical aesthetic — no gimmicks

To view locally: Go Live in VS Code → `http://localhost:5500/index.html`

---

## Windows/NVIDIA Migration (PENDING)

When moving to the Windows exhibition machine:
1. `pip uninstall onnxruntime && pip install onnxruntime-gpu`
2. Change all scripts: `providers=["CUDAExecutionProvider", "CPUExecutionProvider"]`
3. Raise `DET_SIZE = (640, 640)` in all scripts
4. Lower `RECOGNITION_EVERY = 1` in `3_recognize_surveillance.py`
5. Raise `EMBEDDING_BUFFER_SIZE = 20`
6. Install FFmpeg on Windows and add to PATH
7. Point FFmpeg at same VPS IP — website doesn't change at all

---

## Beckmans Student Instagram Scraper

Two scripts in `~/Desktop/quicktest/`:

### `beckmans_instagram.py`
Scrapes `beckmans.se/studenter/`, checks each student profile for Instagram handle, falls back to DuckDuckGo search. Outputs `results/compleeteinstagram.csv` (semicolon-separated).

CSV columns: `name;profile_url;instagram;ig_url;source`

Run: `python3 beckmans_instagram.py` (no venv needed, just `pip3 install requests beautifulsoup4`)

### `beckmans_ig_faces.py`
Reads the CSV, downloads each Instagram profile picture via `instaloader`, runs InsightFace to detect and crop faces, saves to `ig_faces/Firstname_Lastname/profile.jpg`.

Config:
```python
CSV_FILE      = "results/compleeteinstagram.csv"
OUTPUT_DIR    = "ig_faces"
MIN_FACE_PX   = 80
MIN_FACE_CONF = 0.75   # only save if InsightFace ≥75% confident
```

Run: `python3 beckmans_ig_faces.py` (needs `pip3 install instaloader insightface onnxruntime opencv-python`)

Output `ig_faces/` folders match `dataset/` format — copy good ones into `dataset/` then run `4_optimize_dataset.py` → `2_build_embeddings.py`.

---

## Model Notes

- **buffalo_l** — current model (ResNet-50, 512-dim, ~300MB at `~/.insightface/models/buffalo_l/`)
- **antelopev2** — better accuracy but detection model missing from pip package. Test on Windows GPU machine.
- **InsightFace license** — library is MIT, pretrained models are non-commercial research only. Verify before public exhibition.

---

## Pending Items

- [ ] Move to Windows NVIDIA GPU machine, enable CUDA
- [ ] Test antelopev2 on Windows
- [ ] Collect 150 faces for exhibition (currently 16)
- [ ] Run `beckmans_ig_faces.py` fully and review output
- [ ] Copy good ig_faces into dataset/ and rebuild embeddings
- [ ] Deploy GitHub Pages website
- [ ] Change placeholder passwords (`publishuser/publishpass`, `viewuser/viewpass`) before exhibition
- [ ] Verify InsightFace model license for public exhibition
- [ ] Consider domain name for VPS instead of raw IP

---

## Completed

- [x] Aligned embedding pipeline (training + runtime match)
- [x] YOLO removed from all scripts
- [x] Norfair tracker with appearance-aware matching
- [x] Lost-track re-ID memory
- [x] Label hysteresis
- [x] Greedy diversity selection in optimize
- [x] Surveillance variant with watchlist panel
- [x] FFmpeg pipe output added to recognition script
- [x] VPS set up (Hostinger, MediaMTX, firewall)
- [x] WebRTC streaming working end-to-end (Mac → VPS → browser)
- [x] Exhibition website HTML with overlay UI
- [x] Beckmans student Instagram scraper
- [x] Instagram profile picture face extractor
