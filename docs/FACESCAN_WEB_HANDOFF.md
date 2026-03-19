# FACESCAN: Web-to-Exhibition Integration Handoff
**Project Status:** Active Exhibition Development (Stockholm, 2026)
**Conceptual Core:** A surveillance-critique art installation for the Swedish election context.

---

## 1. Context & Objective
The system is a real-time facial recognition and tracking suite. It currently identifies individuals from a live camera feed and streams that feed (with data overlays) to a public website via a VPS.

**The New Feature:** A "Biometric Paywall." To access the website, a user must submit their face. This face is then "captured" by the system and sent back to the physical exhibition space, where it is stored for the curator to manually add to the permanent "watchlist."

---

## 2. Current Technical Stack
* **Detection & Recognition:** InsightFace (`buffalo_l` model) using ArcFace (512-dim embeddings).
* **Tracking:** Norfair (IoU + Cosine Similarity matching).
* **Streaming:** Python → FFmpeg → VPS (MediaMTX) → Web (WebRTC/HLS).
* **Local Hardware:** Windows exhibition machine (NVIDIA GPU / CUDA).
* **VPS:** Linux server running MediaMTX relay.

---

## 3. The "Bridge" Architecture (3-Tier)

### Phase 1: The Website (User Browser)
* **Library:** MediaPipe Face Detection (Lightweight).
* **Logic:** 1. Request camera permission.
    2. Detect the largest face (closest to camera).
    3. Crop the face to a square.
    4. Compress to a small `.jpg` (to minimize bandwidth).
    5. POST the image to the VPS API.
    6. Set a "Session Captured" cookie to prevent re-prompting.

### Phase 2: The VPS "Dropzone" (FastAPI/Flask)
* **Location:** Running on the existing streaming VPS.
* **Logic:**
    1. A minimal Python API server (e.g., FastAPI on port 8000).
    2. Endpoint `/upload_face`: Receives JPG and saves it to a folder `pending_faces/`.
    3. Endpoint `/list_faces`: Returns a list of available filenames.
    4. Endpoint `/download_face/{name}`: Serves the file and deletes it after successful download.

### Phase 3: The Local Sync (`6_vps_sync.py`)
* **Location:** Running locally on the exhibition computer in a separate terminal.
* **CRITICAL CONSTRAINT:** This script is a "Dumb Downloader." It does **not** automate recognition updates.
* **Logic:**
    1. Polls the VPS every 5–10 seconds.
    2. Downloads any new images found.
    3. Saves them locally to a folder named `id_from_web/`.
    4. **Action:** The script stops here. It does NOT run `2_build_embeddings.py` or signal the live stream.

---

## 4. Manual Curation Workflow
To ensure the exhibition remains stable and only high-quality data is used, the addition of web visitors follows this manual path:

1.  `6_vps_sync.py` places a new photo in `id_from_web/visitor_88.jpg`.
2.  The Curator (User) inspects the photo.
3.  The Curator moves the photo into `dataset/Web_Visitor_88/`.
4.  The Curator manually runs `2_build_embeddings_ver2_CUR.py`.
5.  The live stream (`3_recognize_stream_ver2_CUR.py`) is reloaded (Press 'R') to recognize the new visitor.

---

## 5. Implementation Notes for AI Assistant
* **Environment:** The VPS is already handling high-bandwidth video via MediaMTX. Any API implementation must be "non-blocking" and extremely lightweight.
* **Hardware:** Ensure scripts check for `CUDAExecutionProvider` for the Windows machine, falling back to CPU for the VPS.
* **File Naming:** Web images should be saved with timestamps or unique IDs (e.g., `web_20260318_1420.jpg`) to avoid overwriting.

---

## 6. Development Priorities
1.  **Phase 2 (VPS Server):** Create the minimal FastAPI/Flask receiver.
2.  **Phase 3 (Local Sync):** Create the polling/downloading script.
3.  **Phase 1 (JS Frontend):** Integrate MediaPipe capture into the existing `index.html`.