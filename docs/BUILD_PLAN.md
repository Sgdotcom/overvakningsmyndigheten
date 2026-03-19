# FACESCAN — Build Plan

## How to Use This File

This is a prioritised task list. Work through it top-to-bottom. Each task has:
- **What:** Clear description of what to build/change
- **Where:** Which files to modify
- **Why:** The problem it solves
- **Test:** How to verify it works
- **Status:** `[ ]` todo, `[x]` done, `[~]` in progress

Check off tasks as you complete them. Don't skip ahead — later tasks may depend on earlier ones.

---

## Tier 1 — Critical Fixes (do first)

### [ ] 1.1 — Debug dark-lighting recognition failure

**What:** Recognition fails completely in dark ambient lighting, even with 4 good enrollment photos taken in well-lit conditions. Need to diagnose whether the problem is detection (no bounding box at all) or quality gating (bounding box appears but buffer never fills because all frames fail the gate).

**Where:** `3_recognize.py`

**Steps:**
1. Add temporary diagnostic logging inside the quality gate path. After the `passes_quality_gate()` check, log when a frame is rejected and why:
   ```python
   # Inside the EMA update block, after quality gate check:
   if not passes_quality_gate(face_data):
       reason = []
       if face_data["det_score"] < MIN_DET_SCORE:
           reason.append(f"det_score={face_data['det_score']:.2f}<{MIN_DET_SCORE}")
       if face_data["bbox_wh"][0] < MIN_FACE_PIXELS or face_data["bbox_wh"][1] < MIN_FACE_PIXELS:
           reason.append(f"bbox={face_data['bbox_wh']}")
       pose = face_data["pose"]
       if pose and (abs(pose[1]) > POSE_YAW_MAX or abs(pose[0]) > POSE_PITCH_MAX):
           reason.append(f"pose=yaw:{pose[1]:.0f}/pitch:{pose[0]:.0f}")
       print(f"[GATE] Track {tid} REJECTED: {', '.join(reason)}")
   ```
2. Run `3_recognize.py` in dark lighting and observe the terminal output.
3. Based on findings, either:
   - Lower `MIN_DET_SCORE` (if detection confidence is the bottleneck)
   - Lower `MIN_FACE_PIXELS` (if face size is the issue)
   - Widen `POSE_YAW_MAX`/`POSE_PITCH_MAX` (if pose is too strict)
4. Remove the diagnostic logging once the thresholds are tuned.

**Test:** Face appears, bounding box shows, buffer fills, name locks on — in the same dark lighting that was failing before.

---

### [ ] 1.2 — Shared config module

**What:** Extract all shared config constants into a single `config.py` so that `3_recognize.py` and `3_recognize_stream.py` stay in sync. Currently, changing a threshold in one requires manually copying to the other.

**Where:** New file `config.py`, then modify `3_recognize.py` and `3_recognize_stream.py`

**Steps:**
1. Create `config.py` with all shared constants (thresholds, buffer sizes, pose limits, etc.)
2. In each recognition script, `import config` and replace hardcoded values with `config.XXX`
3. Keep script-specific values (like `DET_SIZE`, `RECOGNITION_EVERY`, streaming config) in each script — only shared recognition logic goes in config
4. `2_build_embeddings.py` can also import `MIN_ORIGINALS_FOR_SVM` from config

**Test:** Change a threshold in `config.py`, run both scripts, verify both use the new value.

---

### [ ] 1.3 — GPU provider auto-detection

**What:** Replace hardcoded `CPUExecutionProvider` with auto-detection that picks the best available provider (CUDA > CoreML > CPU).

**Where:** `config.py` (as a shared helper function), then all scripts that load InsightFace

**Steps:**
1. Add to `config.py`:
   ```python
   import onnxruntime as ort

   def get_providers():
       available = ort.get_available_providers()
       if 'CUDAExecutionProvider' in available:
           return ['CUDAExecutionProvider', 'CPUExecutionProvider']
       elif 'CoreMLExecutionProvider' in available:
           return ['CoreMLExecutionProvider', 'CPUExecutionProvider']
       return ['CPUExecutionProvider']
   ```
2. In every script's `load_insightface()` / `load_model()`, replace `providers=["CPUExecutionProvider"]` with `providers=config.get_providers()`
3. Print which provider was selected at startup

**Test:** On Mac, should print CoreML or CPU. On Windows with onnxruntime-gpu, should print CUDA.

---

## Tier 2 — Recognition Accuracy

### [ ] 2.1 — Adaptive quality gating

**What:** Instead of hard thresholds for detection score and face size, make the quality gate adaptive — if the buffer hasn't received any frames after N detection attempts, progressively relax the thresholds. This prevents the "dark room deadlock" where quality gating is too strict and the buffer never fills.

**Where:** `3_recognize.py`, `3_recognize_stream.py`

**Steps:**
1. Add a counter to track_state: `"gate_misses": 0` — incremented each frame a detection exists but fails the quality gate
2. After `gate_misses` exceeds a threshold (e.g. 20), temporarily relax `MIN_DET_SCORE` by 0.1 and `MIN_FACE_PIXELS` by 10
3. Reset `gate_misses` when a frame passes the gate
4. Never relax pose gating — off-angle embeddings are always bad regardless of conditions

**Test:** In dark lighting, buffer should eventually fill (with slightly lower quality frames) rather than staying empty forever.

---

### [ ] 2.2 — Cosine threshold tuning per enrollment quality

**What:** A person with 1 internet photo should have a slightly lower cosine threshold than a person with 30 webcam captures, because the single-photo embedding has no variance to average against. Store per-person metadata in the embeddings pickle.

**Where:** `2_build_embeddings.py`, `3_recognize.py`, `3_recognize_stream.py`

**Steps:**
1. In `2_build_embeddings.py`, save metadata alongside embeddings:
   ```python
   embeddings_db[name] = {
       "signatures": [r.tolist() for r in representatives],
       "n_originals": n_originals,
       "tier": "svm" or "watchlist"
   }
   ```
2. In recognition scripts, when doing cosine matching, use a slightly lower threshold (e.g. 0.35 instead of 0.38) for watchlist people with ≤3 originals
3. Be careful — this changes the embeddings.pkl format. The recognition scripts must handle both old format (dict of lists) and new format (dict of dicts with "signatures" key) for backwards compatibility

**Test:** Single internet photo of a known person → recognition locks on with adjusted threshold. Person with 30 images still uses normal threshold.

---

### [ ] 2.3 — Enrollment image quality report

**What:** When `2_build_embeddings.py` runs, print a quality assessment per person — average embedding similarity between their images, any outlier images that are very different from the rest (possible wrong-person or bad crop), and a recommendation for whether more images are needed.

**Where:** `2_build_embeddings.py`

**Steps:**
1. After encoding all images for a person, compute pairwise cosine similarity matrix
2. Flag any image whose average similarity to others is below 0.5 (likely a bad crop or wrong person)
3. Print per-person quality score: mean intra-class similarity
4. If mean similarity < 0.6, suggest collecting more varied images

**Test:** Run on existing dataset, check that the quality report makes sense — people with good photos should score high, people with messy folders should get warnings.

---

## Tier 3 — Robustness & Exhibition Readiness

### [ ] 3.1 — Camera reconnect loop

**What:** USB cameras randomly drop connection. Instead of exiting, attempt to reconnect.

**Where:** `3_recognize.py`, `3_recognize_stream.py`

**Steps:**
1. Replace the `if not ret: break` block with a reconnect loop:
   ```python
   if not ret:
       print("[WARN] Camera dropped. Attempting reconnect...")
       cap.release()
       time.sleep(1)
       cap = cv2.VideoCapture(VIDEO_PATH)
       continue
   ```
2. Add a max retry count (e.g. 10 attempts) before giving up
3. Log each reconnect attempt

**Test:** Unplug USB camera briefly, verify script recovers when plugged back in.

---

### [ ] 3.2 — FFmpeg auto-restart

**What:** If FFmpeg process dies (VPS glitch, network hiccup), automatically restart it instead of permanently losing the stream.

**Where:** `3_recognize_stream.py`

**Steps:**
1. Extract FFmpeg startup into a `start_ffmpeg()` function
2. In the BrokenPipeError handler, call `start_ffmpeg()` after a 2-second delay
3. Add a max restart count per session to prevent infinite restart loops
4. Log each restart

**Test:** Kill the FFmpeg process externally (`kill -9`), verify stream auto-recovers within a few seconds.

---

### [ ] 3.3 — Threading architecture

**What:** Decouple camera reading, AI inference, and FFmpeg writing into separate threads to prevent the camera buffer from overflowing during heavy processing.

**Where:** `3_recognize_stream.py`

**Steps:**
1. Thread 1 (Camera): reads `cap.read()` in a loop, puts latest frame into a `queue.Queue(maxsize=2)`, drops old frames
2. Thread 2 (Main/AI): pulls frame, runs InsightFace, tracker, drawing — puts annotated frame into output queue
3. Thread 3 (Stream): pulls annotated frame, writes to FFmpeg stdin
4. Use `threading.Event` for clean shutdown
5. Keep the `cv2.imshow` and keyboard handling in the main thread

**Why:** This is the single most important reliability fix for 8–12 hour exhibition runtime. Without it, the camera buffer overflows during heavy inference frames, causing 2+ second lag.

**Test:** Measure end-to-end latency (camera to display). Should be < 200ms even during heavy multi-face inference.

---

### [ ] 3.4 — Structured logging

**What:** Replace print statements with Python's `logging` module so output can be directed to both console and a log file for post-exhibition analysis.

**Where:** All scripts

**Steps:**
1. Add a `setup_logging()` function that creates a file handler (rotating, max 10MB) plus console handler
2. Replace `print("[INFO]...")` with `logger.info(...)` etc.
3. Log recognition events (who was identified when) for exhibition analysis
4. Keep the log file in the project directory: `facescan.log`

**Test:** Run for 5 minutes, check log file has structured output.

---

## Tier 4 — Exhibition Polish

### [ ] 4.1 — Session statistics

**What:** Track and display per-session statistics: total unique people identified, total faces tracked, uptime, recognition rate (identified / total tracks).

**Where:** `3_recognize.py`, `3_recognize_stream.py`

**Steps:**
1. Add session-level counters (unique names seen, total tracks created, start time)
2. Show in the HUD overlay
3. Optionally save session summary to a JSON file on exit

---

### [ ] 4.2 — Exhibition auto-start script

**What:** A single launch script that starts everything needed for the exhibition: activates venv, starts recognition with streaming, handles crashes with auto-restart.

**Where:** New file `start_exhibition.sh` (Mac) / `start_exhibition.bat` (Windows)

**Steps:**
1. Activate venv
2. Start `3_recognize_stream.py` in a loop with crash recovery
3. Log crashes to a file
4. Optional: system notification on crash

---

### [ ] 4.3 — Website deployment

**What:** Deploy the exhibition website (index.html) to GitHub Pages with proper domain.

**Where:** Website repo / GitHub Pages config

**Steps:**
1. Push index.html to a GitHub repo
2. Enable GitHub Pages
3. Consider a custom domain (e.g. facescan.se)
4. Change VPS passwords from defaults before going public

---

## Notes for Claude Code

- Always test with `3_recognize.py` first (local, no streaming dependency)
- The `.embeddings_cache.json` file speeds up rebuilds — don't delete it unless debugging
- When modifying recognition logic, make the same change in both `3_recognize.py` AND `3_recognize_stream.py` (or better yet, extract shared logic first per task 1.2)
- The dataset is at `~/Desktop/YOLO_test_insightface/dataset/` — don't modify images, only code
- If something breaks, rebuilding embeddings with the original `2_build_embeddings.py` (not ver2) and running original `3_recognize.py` restores the known-good state
