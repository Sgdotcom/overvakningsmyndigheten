/**
 * Logga in: face capture via MediaPipe + upload to VPS.
 *
 * Flow:
 * 1. User opens login modal (via header button or redirect from gated page)
 * 2. User enters name, clicks "Starta kamera"
 * 3. MediaPipe detects face, waits for stability
 * 4. Auto-captures, crops to face, uploads JPEG to VPS /upload_face
 * 5. On success: sets session, closes modal, reveals gated content
 */
(function () {
  var SESSION_KEY = 'poiSiteAuth';
  var REQUIRED_STABLE_FRAMES = 8;
  var MAX_WAIT_MS = 20000;

  // --- Session helpers ---

  function getSession() {
    try {
      var raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function setSession(name) {
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ ok: true, name: name.trim(), ts: Date.now() })
    );
  }

  function closeLoginModal() {
    var modalEl = document.getElementById('loginModal');
    if (!modalEl || typeof bootstrap === 'undefined') return;
    var inst = bootstrap.Modal.getInstance(modalEl);
    if (inst) inst.hide();
  }

  // --- Header UI ---

  function updateHeaderLoggedIn(name) {
    var openBtn = document.getElementById('btn-open-login-modal');
    var block = document.getElementById('header-authed-block');
    var nameEl = document.getElementById('header-user-name');
    if (openBtn) openBtn.classList.add('d-none');
    if (block) {
      block.classList.remove('d-none');
      block.classList.add('d-flex');
    }
    if (nameEl) nameEl.textContent = name;
  }

  function updateHeaderLoggedOut() {
    var openBtn = document.getElementById('btn-open-login-modal');
    var block = document.getElementById('header-authed-block');
    if (openBtn) openBtn.classList.remove('d-none');
    if (block) {
      block.classList.add('d-none');
      block.classList.remove('d-flex');
    }
  }

  function showAuthed(name) {
    updateHeaderLoggedIn(name);
    var gated = document.getElementById('gated-after-login');
    if (gated) gated.classList.remove('d-none');
    closeLoginModal();

    var params = new URLSearchParams(location.search);
    var next = params.get('next');
    if (next && /\.html$/i.test(next) && next.toLowerCase() !== 'index.html') {
      var allowed = [
        'poi-1.html', 'poi-2.html', 'poi-3.html', 'poi-4.html',
        'poi-5.html', 'poi-6.html', 'poi-final.html', 'summary.html',
      ];
      if (allowed.indexOf(next.toLowerCase()) !== -1) {
        location.replace(next);
      }
    }
  }

  // --- Face detection helpers (from biometric-paywall.js) ---

  function pickLargest(detections) {
    if (!detections || !detections.length) return null;
    var best = detections[0];
    var bestArea = 0;
    for (var i = 0; i < detections.length; i++) {
      var bb = detections[i].boundingBox;
      if (!bb) continue;
      var a = (bb.width || 0) * (bb.height || 0);
      if (a > bestArea) {
        bestArea = a;
        best = detections[i];
      }
    }
    return best;
  }

  function cropToSquare(video, det) {
    var bb = det.boundingBox;
    var vw = video.videoWidth;
    var vh = video.videoHeight;
    if (!vw || !vh) return null;

    // MediaPipe returns normalized coords (0-1), convert to pixels.
    var x = (bb.xCenter - bb.width / 2) * vw;
    var y = (bb.yCenter - bb.height / 2) * vh;
    var w = bb.width * vw;
    var h = bb.height * vh;

    // Expand a bit for better capture
    var pad = 0.20;
    x -= w * pad;
    y -= h * pad;
    w *= 1 + pad * 2;
    h *= 1 + pad * 2;

    // Square crop around center
    var cx = x + w / 2;
    var cy = y + h / 2;
    var s = Math.max(w, h);
    var sx = cx - s / 2;
    var sy = cy - s / 2;

    // Clamp
    sx = Math.max(0, Math.min(vw - 1, sx));
    sy = Math.max(0, Math.min(vh - 1, sy));
    if (sx + s > vw) s = vw - sx;
    if (sy + s > vh) s = vh - sy;

    var outSize = 256;
    var c = document.createElement('canvas');
    c.width = outSize;
    c.height = outSize;
    var ctx = c.getContext('2d');
    ctx.drawImage(video, sx, sy, s, s, 0, 0, outSize, outSize);
    return c;
  }

  function canvasToJpegBlob(canvas) {
    return new Promise(function (resolve) {
      canvas.toBlob(function (blob) { resolve(blob); }, 'image/jpeg', 0.86);
    });
  }

  function similarBox(a, b) {
    if (!a || !b) return false;
    // Coords are normalized (0-1), so thresholds are relative
    var dx = Math.abs(a.xCenter - b.xCenter);
    var dy = Math.abs(a.yCenter - b.yCenter);
    var dw = Math.abs(a.width - b.width);
    var dh = Math.abs(a.height - b.height);
    return dx < 0.03 && dy < 0.03 && dw < 0.05 && dh < 0.05;
  }

  // --- Upload ---

  async function uploadFace(blob, displayName) {
    var cfg = window.FACE_SYNC;
    if (!cfg || !cfg.enabled || !cfg.baseUrl || !cfg.token) {
      throw new Error('FACE_SYNC not configured');
    }

    var safeName = (displayName || 'face').replace(/[^A-Za-z0-9_-]/g, '_').substring(0, 40);
    var filename = (safeName || 'face') + '.jpg';

    var fd = new FormData();
    fd.append('image', blob, filename);

    var url = String(cfg.baseUrl).replace(/\/$/, '') + '/upload_face';
    var res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + cfg.token },
      body: fd,
    });
    if (!res.ok) throw new Error('Upload failed: ' + res.status);
    return await res.json();
  }

  // --- Camera + face capture flow ---

  var activeStream = null;
  var activeCamera = null;

  function stopCamera() {
    try { if (activeCamera) activeCamera.stop(); } catch (e) {}
    try {
      if (activeStream) activeStream.getTracks().forEach(function (t) { t.stop(); });
    } catch (e) {}
    activeCamera = null;
    activeStream = null;
    var v = document.getElementById('login-camera-preview');
    if (v) v.srcObject = null;
  }

  function setStatus(txt, kind) {
    var el = document.getElementById('login-camera-status');
    if (!el) return;
    el.textContent = txt;
    el.className = 'small mb-2 ' + (kind === 'error' ? 'text-danger' : kind === 'ok' ? 'text-success' : 'text-muted');
  }

  function drawBox(video, overlay, det) {
    var ctx = overlay ? overlay.getContext('2d') : null;
    if (!ctx) return;
    overlay.width = video.clientWidth;
    overlay.height = video.clientHeight;
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    if (!det || !det.boundingBox) return;

    // MediaPipe returns normalized coords (0-1), scale to displayed size
    var bb = det.boundingBox;
    var x = (bb.xCenter - bb.width / 2) * overlay.width;
    var y = (bb.yCenter - bb.height / 2) * overlay.height;
    var w = bb.width * overlay.width;
    var h = bb.height * overlay.height;

    ctx.strokeStyle = 'rgba(255,212,46,0.95)';
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, w, h);
  }

  async function startCaptureFlow() {
    var video = document.getElementById('login-camera-preview');
    var overlay = document.getElementById('login-camera-overlay');
    var nameInput = document.getElementById('login-display-name');
    var btnStart = document.getElementById('btn-enable-camera');

    if (!video) return;

    // Validate name first
    var displayName = (nameInput ? nameInput.value : '').trim();
    if (!displayName || displayName.split(/\s+/).length < 2) {
      setStatus('Ange för- och efternamn först.', 'error');
      if (nameInput) nameInput.focus();
      return;
    }

    if (btnStart) btnStart.disabled = true;
    setStatus('Startar kamera…', 'info');

    if (typeof FaceDetection === 'undefined' || typeof Camera === 'undefined') {
      setStatus('MediaPipe kunde inte laddas. Försök ladda om sidan.', 'error');
      if (btnStart) btnStart.disabled = false;
      return;
    }

    try {
      activeStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      video.srcObject = activeStream;
      await video.play().catch(function () {});
    } catch (e) {
      setStatus('Kunde inte starta kamera. Tillåt kameraåtkomst i webbläsaren.', 'error');
      if (btnStart) btnStart.disabled = false;
      return;
    }

    setStatus('Kamera aktiv — titta in i kameran…', 'info');

    var stable = 0;
    var lastBox = null;
    var startedAt = Date.now();
    var captured = false;

    var faceDetection = new FaceDetection({ locateFile: function (file) {
      return 'https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/' + file;
    }});
    faceDetection.setOptions({ model: 'short', minDetectionConfidence: 0.6 });

    faceDetection.onResults(async function (results) {
      if (captured) return;
      try {
        if (Date.now() - startedAt > MAX_WAIT_MS) {
          setStatus('Ingen stabil ansiktsbild hittades. Klicka "Starta kamera" för att försöka igen.', 'error');
          stopCamera();
          if (btnStart) btnStart.disabled = false;
          return;
        }

        var det = pickLargest(results && results.detections ? results.detections : []);
        drawBox(video, overlay, det);

        if (!det) {
          stable = 0;
          setStatus('Ingen ansiktsyta hittad…', 'info');
          return;
        }

        var bb = det.boundingBox;
        if (lastBox && similarBox(lastBox, bb)) stable += 1;
        else stable = 1;
        lastBox = bb;

        setStatus('Ansikte hittat… (' + stable + '/' + REQUIRED_STABLE_FRAMES + ')', 'info');
        if (stable < REQUIRED_STABLE_FRAMES) return;

        // Capture!
        captured = true;
        setStatus('Fångar bild och laddar upp…', 'info');

        var canvas = cropToSquare(video, det);
        if (!canvas) throw new Error('Bildbeskärning misslyckades');

        var blob = await canvasToJpegBlob(canvas);
        if (!blob) throw new Error('JPEG-kodning misslyckades');

        // Re-read name in case user changed it while camera was running
        displayName = (nameInput ? nameInput.value : '').trim() || displayName;

        await uploadFace(blob, displayName);

        setStatus('Klart — åtkomst beviljad.', 'ok');
        stopCamera();

        // Set session and close modal
        setSession(displayName);
        setTimeout(function () {
          showAuthed(displayName);
        }, 600);

      } catch (e) {
        // Upload failed — still grant access (graceful degradation)
        var msg = (e && e.message) || String(e);
        console.warn('Face upload failed:', msg);
        setStatus('Uppladdning misslyckades — åtkomst beviljad ändå.', 'ok');
        stopCamera();

        setSession(displayName);
        setTimeout(function () {
          showAuthed(displayName);
        }, 600);
      }
    });

    activeCamera = new Camera(video, {
      onFrame: async function () {
        if (!captured) await faceDetection.send({ image: video });
      },
      width: 640,
      height: 480,
    });
    activeCamera.start();
  }

  // --- Init ---

  document.addEventListener('DOMContentLoaded', function () {
    // Logout
    var btnHeaderLogout = document.getElementById('btn-header-logout');
    if (btnHeaderLogout) {
      btnHeaderLogout.addEventListener('click', function () {
        sessionStorage.removeItem(SESSION_KEY);
        stopCamera();
        location.href = '../index.html';
      });
    }

    // Modal cleanup on close
    var modalEl = document.getElementById('loginModal');
    if (modalEl) {
      modalEl.addEventListener('hidden.bs.modal', function () {
        stopCamera();
        var btn = document.getElementById('btn-enable-camera');
        if (btn) btn.disabled = false;
        setStatus('Kamera inte startad.', 'info');
      });
    }

    // Start camera button
    var btnStart = document.getElementById('btn-enable-camera');
    if (btnStart) {
      btnStart.addEventListener('click', startCaptureFlow);
    }

    // Check existing session
    var s = getSession();
    if (s && s.ok && s.name) {
      // Clean ?next= from URL so refresh doesn't re-trigger modal
      if (location.search) {
        history.replaceState(null, '', location.pathname);
      }
      showAuthed(s.name);
      return;
    }

    updateHeaderLoggedOut();

    // Auto-open login modal ONLY if redirected from a gated page (?next= param)
    var next = new URLSearchParams(location.search).get('next');
    if (next && modalEl && typeof bootstrap !== 'undefined') {
      // Clean the URL immediately so refresh won't re-open modal
      history.replaceState(null, '', location.pathname);
      var m = new bootstrap.Modal(modalEl);
      m.show();
    }
  });
})();
