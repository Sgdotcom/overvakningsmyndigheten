/**
 * Biometric paywall (browser):
 * - uses MediaPipe Face Detection to find the largest face
 * - crops to square + resizes + compresses to JPEG
 * - POSTs to VPS dropzone: POST /upload_face (multipart field "image")
 *
 * Config via window.FACE_DROPZONE:
 *   { enabled: true, baseUrl: "http://ip:8787", token: "..." }
 */
(function () {
  var CAPTURE_KEY = 'ipSessionCaptured';
  var MAX_WAIT_MS = 12000;
  var REQUIRED_STABLE_FRAMES = 8;

  function hasCaptured() {
    try {
      return localStorage.getItem(CAPTURE_KEY) === 'true';
    } catch (e) {
      return false;
    }
  }

  function markCaptured() {
    try {
      localStorage.setItem(CAPTURE_KEY, 'true');
    } catch (e) {}
  }

  function cfg() {
    return (window && window.FACE_DROPZONE) ? window.FACE_DROPZONE : null;
  }

  function openModal() {
    var m = document.getElementById('ip-bio-modal');
    if (m) m.classList.add('ip-bio-modal--open');
  }

  function closeModal() {
    var m = document.getElementById('ip-bio-modal');
    if (m) m.classList.remove('ip-bio-modal--open');
  }

  function setStatus(txt, kind) {
    var el = document.getElementById('ip-bio-status');
    if (!el) return;
    el.textContent = txt;
    el.className = 'ip-bio-status small mt-2 ' + (kind === 'error' ? 'text-danger' : kind === 'ok' ? 'text-success' : 'text-muted');
  }

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
      canvas.toBlob(
        function (blob) {
          resolve(blob);
        },
        'image/jpeg',
        0.86
      );
    });
  }

  async function uploadBlob(blob) {
    var c = cfg();
    if (!c || !c.enabled) throw new Error('Dropzone disabled');
    if (!c.baseUrl) throw new Error('Missing dropzone baseUrl');
    if (!c.token) throw new Error('Missing dropzone token');

    var fd = new FormData();
    fd.append('image', blob, 'face.jpg');

    var url = String(c.baseUrl).replace(/\/$/, '') + '/upload_face';
    var res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + c.token },
      body: fd,
    });
    if (!res.ok) throw new Error('Upload failed: ' + res.status);
    return await res.json();
  }

  async function runCaptureOnce() {
    if (hasCaptured()) return { ok: true, skipped: true };

    if (typeof FaceDetection === 'undefined' || typeof Camera === 'undefined') {
      throw new Error('MediaPipe not loaded');
    }

    openModal();
    setStatus('Starta kamera…', 'info');

    var video = document.getElementById('ip-bio-video');
    var overlay = document.getElementById('ip-bio-overlay');
    var overlayCtx = overlay ? overlay.getContext('2d') : null;

    var stream = null;
    var camera = null;
    var faceDetection = null;
    var stable = 0;
    var lastBox = null;
    var startedAt = Date.now();

    function stopAll() {
      try {
        if (camera) camera.stop();
      } catch (e) {}
      try {
        if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
      } catch (e) {}
    }

    function drawBox(det) {
      if (!overlayCtx || !overlay) return;
      overlay.width = video.clientWidth;
      overlay.height = video.clientHeight;
      overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
      if (!det || !det.boundingBox) return;

      // MediaPipe returns normalized coords (0-1), scale to displayed size
      var bb = det.boundingBox;
      var x = (bb.xCenter - bb.width / 2) * overlay.width;
      var y = (bb.yCenter - bb.height / 2) * overlay.height;
      var w = bb.width * overlay.width;
      var h = bb.height * overlay.height;

      overlayCtx.strokeStyle = 'rgba(255,212,46,0.95)';
      overlayCtx.lineWidth = 3;
      overlayCtx.strokeRect(x, y, w, h);
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

    var r = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
    stream = r;
    video.srcObject = stream;
    await video.play().catch(function () {});

    faceDetection = new FaceDetection({ locateFile: function (file) {
      return 'https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/' + file;
    }});
    faceDetection.setOptions({ model: 'short', minDetectionConfidence: 0.6 });

    faceDetection.onResults(async function (results) {
      try {
        if (Date.now() - startedAt > MAX_WAIT_MS) {
          setStatus('Ingen stabil ansiktsbild hittades. Försök igen.', 'error');
          stopAll();
          return;
        }
        var det = pickLargest(results && results.detections ? results.detections : []);
        drawBox(det);
        if (!det) {
          stable = 0;
          setStatus('Ingen ansiktsyta hittad…', 'info');
          return;
        }
        var bb = det.boundingBox;
        if (lastBox && similarBox(lastBox, bb)) stable += 1;
        else stable = 1;
        lastBox = bb;

        setStatus('Hittar ansikte… (' + stable + '/' + REQUIRED_STABLE_FRAMES + ')', 'info');
        if (stable < REQUIRED_STABLE_FRAMES) return;

        // Capture
        stable = -999;
        setStatus('Fångar bild och laddar upp…', 'info');
        var canvas = cropToSquare(video, det);
        if (!canvas) throw new Error('Crop failed');
        var blob = await canvasToJpegBlob(canvas);
        if (!blob) throw new Error('JPEG encode failed');
        await uploadBlob(blob);

        markCaptured();
        setStatus('Klart. Åtkomst beviljad.', 'ok');
        stopAll();
        setTimeout(function () {
          closeModal();
        }, 500);
      } catch (e) {
        setStatus('Fel: ' + (e && e.message ? e.message : String(e)), 'error');
        stopAll();
      }
    });

    camera = new Camera(video, {
      onFrame: async function () {
        await faceDetection.send({ image: video });
      },
      width: 640,
      height: 480,
    });

    // UI controls inside modal
    var btnStart = document.getElementById('ip-bio-start');
    var btnCancel = document.getElementById('ip-bio-cancel');
    if (btnStart) btnStart.onclick = function () { camera.start(); setStatus('Kamera aktiv. Titta in i kameran…', 'info'); };
    if (btnCancel) btnCancel.onclick = function () { stopAll(); closeModal(); };

    return { ok: true };
  }

  // Expose to cookie-consent.js
  window.IP_BIOMETRIC_PAYWALL = {
    captureAndUpload: runCaptureOnce,
    hasCaptured: hasCaptured,
    markCaptured: markCaptured,
    openModal: openModal,
    closeModal: closeModal,
  };

  document.addEventListener('DOMContentLoaded', function () {
    var closeBtn = document.getElementById('ip-bio-close');
    var backdrop = document.getElementById('ip-bio-backdrop');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (backdrop) backdrop.addEventListener('click', closeModal);
  });
})();

