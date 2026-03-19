# FACESCAN — Project Context for Claude Code

## What This Is

FACESCAN is a real-time face detection and recognition system built for a public art exhibition in Stockholm (Beckmans Designhögskola, 2026 Swedish election context). It detects and identifies faces from a live camera feed, displays overlays, and streams annotated video to a public website via a VPS relay. The project is a surveillance critique — the aesthetic and behaviour should feel like a real government system, not a tech demo.

## Golden Rules

1. **NEVER break the VPS streaming pipeline.** The FFmpeg → MediaMTX → WebRTC chain in `3_recognize_stream.py` is working and tested. Any changes to recognition logic must preserve the streaming code exactly.
2. **Training and runtime must use the same embedding pipeline.** Both must go through InsightFace's 5-point alignment. Never resize directly to 112×112 — that produces embeddings in a different geometric space.
3. **Test changes with `3_recognize.py` first** (local display only), then port to `3_recognize_stream.py` once confirmed working.
4. **Keep all config constants at the top of each script** in clearly labelled USER CONFIG sections. Never bury magic numbers in function bodies.
5. **The two scripts that matter most are `3_recognize.py` and `3_recognize_stream.py`.** Other recognition variants (`_surveillance`, `_masked`) are not actively used. Don't modify them unless explicitly asked.
6. **Rollback safety:** The pickle files (`embeddings.pkl` + `classifier.pkl`) are the only bridge between build and recognition. Rebuilding with the old `2_build_embeddings.py` restores the old system completely.

## Hardware

- **Development machine:** MacBook Pro M3 Max, 36GB unified memory
- **Exhibition machine (pending):** Windows PC with dedicated NVIDIA GPU
- **Camera:** USB webcam (UVC Camera) + Canon EOS R6 Mark II being tested
- **VPS:** Hostinger KVM 1, Ubuntu 24.04 LTS, IP `187.124.168.106`

## Python Environment

```bash
source ~/Desktop/YOLO_test/.venv311/bin/activate
cd ~/Desktop/YOLO_test_insightface/
```

Python 3.11 venv. Key packages: `insightface`, `onnxruntime`, `opencv-python`, `norfair`, `scikit-learn`, `numpy`.

## Architecture

InsightFace buffalo_l (SCRFD detection + 5-point alignment + ArcFace 512-dim embeddings) → Hybrid SVM/Cosine classifier → Norfair tracker with appearance-aware matching + lost-track re-ID + label hysteresis.

### Recognition Pipeline (v6 — current)

- **Pose quality gating:** Only frontal frames (|yaw| < 25°, |pitch| < 20°) are added to the EMA buffer. Off-angle frames are tracked but not used for recognition.
- **Detection quality gating:** Frames with low det_score (< 0.5) or small faces (< 60px) are excluded from the buffer.
- **Hybrid SVM + Cosine:** SVM is tried first for enrolled people (≥ MIN_ORIGINALS_FOR_SVM original images). If SVM returns Unidentified, cosine similarity is tried against ALL people including watchlist targets.
- **EMA centroid:** Exponential moving average (alpha=0.15) of quality-gated embeddings per track.
- **Label hysteresis:** 4 votes to accept, 7 to revoke, 2s cooldown. Prevents flicker.

### Data Flow

```
detection.data = {
    "emb":       face.embedding,        # 512-dim float32
    "pose":      (pitch, yaw, roll),    # degrees, or None
    "det_score": float,                 # 0–1
    "bbox_wh":   (width, height),       # pixels
}
```

This rich dict is passed through Norfair's `Detection.data` field. Code that accesses `detection.data` must handle both the dict format (v6) and raw embedding arrays (legacy).

## Script Set

| Script | Purpose | Status |
|--------|---------|--------|
| `0_passive_capture.py` | Background camera capture of unknowns → `staging/` | Working |
| `1_collect_faces.py` | Interactive webcam capture, type name to save | Working |
| `2_build_embeddings.py` | Builds `embeddings.pkl` + trains `classifier.pkl` (SVM) | **v2 with incremental cache** |
| `3_recognize.py` | Live recognition v6 — local display | **v6 with pose/quality gating + hybrid** |
| `3_recognize_stream.py` | Live recognition v6 + FFmpeg streaming to VPS | **v6 with pose/quality gating + hybrid** |
| `3_recognize_surveillance.py` | Surveillance aesthetic variant (not actively used) | v5 |
| `3_recognize_masked.py` | Masked variant (not actively used) | v5 |
| `4_optimize_dataset.py` | 4-stage quality filter with greedy diversity cap | Working |
| `4b_augment_dataset.py` | Augmentation for underrepresented people only | Working |
| `5_sort_unidentified.py` | Sort captured faces into dataset folders | Working |

## Pipeline Order

```
1_collect_faces.py  OR  0_passive_capture.py → 5_sort_unidentified.py
    ↓
4_optimize_dataset.py  (DRY_RUN=True first, then False)
    ↓
4b_augment_dataset.py  (skip for watchlist/1-shot people)
    ↓
2_build_embeddings.py  (incremental — only re-encodes changed people)
    ↓
3_recognize.py  OR  3_recognize_stream.py
```

## Key Config Values (3_recognize.py / 3_recognize_stream.py)

```python
DET_SIZE                     = (320, 320)  # recognize.py — (640,640) in stream
RECOGNITION_EVERY            = 2           # recognize.py — 1 in stream
EMBEDDING_BUFFER_SIZE        = 15
MIN_FRAMES_TO_LABEL          = 4
SVM_CONFIDENCE_THRESHOLD     = 0.45
SVM_AMBIGUITY_MARGIN         = 0.10
COSINE_RECOGNITION_THRESHOLD = 0.38
COSINE_AMBIGUITY_MARGIN      = 0.03
POSE_YAW_MAX                 = 25
POSE_PITCH_MAX               = 20
MIN_DET_SCORE                = 0.5
MIN_FACE_PIXELS              = 60
```

## 2_build_embeddings.py — Incremental Cache

Saves `.embeddings_cache.json` with per-person fingerprints (filenames + sizes + mtimes) and pre-computed embeddings. On re-run, only people with changed folders are re-encoded. The SVM always retrains.

- `--force` flag skips the cache and re-encodes everything
- `MIN_ORIGINALS_FOR_SVM = 5` — below this, person is cosine-only (watchlist)
- Augmented images don't count toward the SVM threshold

## Streaming Infrastructure

```
Camera → Python (annotated frames) → FFmpeg (H.264, RTSP) → VPS MediaMTX → WebRTC → Browser
```

- **VPS:** `187.124.168.106`, MediaMTX v1.9.1, systemd service
- **Publish:** `rtsp://publishuser:publishpass@187.124.168.106:8554/facescan`
- **View (WebRTC):** `http://187.124.168.106:8889/facescan`
- **View (HLS):** `http://187.124.168.106:8888/facescan/index.m3u8`

## Dataset

Located at `~/Desktop/YOLO_test_insightface/dataset/`. Structure: `dataset/PersonName/*.jpg`. Currently ~16 people. Target: 150 for exhibition.

Augmented image suffixes (skipped by augmenter, not counted for SVM): `_flip`, `_bright`, `_dark`, `_rot_cw`, `_rot_ccw`, `_blur`, `_zoom`, `_var_bright`, `_var_dark`.

## Known Issues / Current Bugs

- **Dark lighting recognition failure:** With only 4 original images and dark ambient lighting, detection confidence may be too low to pass the quality gate (MIN_DET_SCORE=0.5), causing the buffer to never fill. May need to lower MIN_DET_SCORE or add adaptive thresholding.
- **face.pose availability:** InsightFace's face.pose attribute may not exist in all versions. Code handles this gracefully (falls back to no pose gating) but logs a warning.
- **Provider hardcoded to CPU:** All scripts use `CPUExecutionProvider`. When moving to Windows GPU, change to auto-detection with CUDAExecutionProvider.

## Style / Conventions

- ASCII box headers at top of each script describing purpose
- USER CONFIG section immediately after header with all tuneable constants
- Functions ordered: loaders → recognition → tracking helpers → drawing → main
- Print logging with `[INFO]`, `[WARN]`, `[ERROR]`, `[SKIP]`, `[RE-ID]` prefixes
- No external config files — each script is self-contained (config at top)

## Windows Migration Checklist (pending)

1. `pip uninstall onnxruntime && pip install onnxruntime-gpu`
2. Auto-detect providers: `CUDAExecutionProvider` → `CPUExecutionProvider` fallback
3. Raise `DET_SIZE = (640, 640)` in all scripts
4. Install FFmpeg on Windows, add to PATH
5. Same VPS IP — website doesn't change
