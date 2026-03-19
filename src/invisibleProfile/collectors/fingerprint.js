import { setState } from '../state.js';

async function sha256Hex(bytes) {
  const buf = await crypto.subtle.digest('SHA-256', bytes);
  const arr = new Uint8Array(buf);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function getWebglInfo() {
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl') || canvas.getContext('experimental-webgl') || canvas.getContext('webgl2');
    if (!gl) return { webgl: false };
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const vendor = dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : null;
    const renderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : null;
    return { webgl: true, vendor, renderer };
  } catch (e) {
    return { webgl: false, error: String(e) };
  }
}

async function getCanvasFingerprint() {
  const canvas = document.createElement('canvas');
  canvas.width = 340;
  canvas.height = 120;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { canvas: false };

  ctx.textBaseline = 'top';
  ctx.fillStyle = '#f3f3f3';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // gradient + text
  const g = ctx.createLinearGradient(0, 0, 340, 0);
  g.addColorStop(0, '#00406a');
  g.addColorStop(0.5, '#ffd42e');
  g.addColorStop(1, '#145ea5');
  ctx.fillStyle = g;
  ctx.fillRect(12, 18, 316, 22);

  ctx.font = '16px \"Times New Roman\"';
  ctx.fillStyle = '#111';
  ctx.fillText('InvisibleProfile::Stockholm2026', 12, 48);

  ctx.font = '18px \"Arial\"';
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillText('🙂🚫🔍', 12, 72);

  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const hash = await sha256Hex(data.buffer);
  return { canvas: true, canvas_sha256: hash };
}

function probeFonts(fonts) {
  const testString = 'mmmmmmmmmlllllllWWWWWiiiiii1234567890';
  const size = '72px';
  const baseFonts = ['monospace', 'sans-serif', 'serif'];

  const body = document.body || document.documentElement;
  const span = document.createElement('span');
  span.style.position = 'absolute';
  span.style.left = '-9999px';
  span.style.fontSize = size;
  span.textContent = testString;
  body.appendChild(span);

  const base = {};
  for (const bf of baseFonts) {
    span.style.fontFamily = bf;
    base[bf] = { w: span.offsetWidth, h: span.offsetHeight };
  }

  const available = [];
  for (const f of fonts) {
    let detected = false;
    for (const bf of baseFonts) {
      span.style.fontFamily = `'${f}',${bf}`;
      const w = span.offsetWidth;
      const h = span.offsetHeight;
      if (w !== base[bf].w || h !== base[bf].h) {
        detected = true;
        break;
      }
    }
    if (detected) available.push(f);
  }

  span.remove();
  return available;
}

function getScreenMetrics() {
  return {
    screen: `${screen.width}x${screen.height}`,
    avail: `${screen.availWidth}x${screen.availHeight}`,
    colorDepth: screen.colorDepth,
    pixelRatio: window.devicePixelRatio,
    window: `${window.innerWidth}x${window.innerHeight}`,
  };
}

export async function collectFingerprint() {
  const webgl = getWebglInfo();
  const screenMetrics = getScreenMetrics();
  const cores = navigator.hardwareConcurrency ?? null;
  const ramGb = navigator.deviceMemory ?? null;
  const ua = navigator.userAgent;
  const platform = navigator.platform || null;
  const lang = navigator.language || null;
  let battery = null;
  try {
    if (navigator.getBattery) {
      const b = await navigator.getBattery();
      battery = {
        level: b.level,
        charging: b.charging,
        chargingTime: b.chargingTime,
        dischargingTime: b.dischargingTime,
      };
    }
  } catch (e) {
    battery = { error: String(e) };
  }

  const canvas = await getCanvasFingerprint();

  const fontList = [
    // Common
    'Arial',
    'Helvetica',
    'Times New Roman',
    'Courier New',
    'Georgia',
    'Verdana',
    'Trebuchet MS',
    'Impact',
    'Comic Sans MS',
    // Windows / Office
    'Calibri',
    'Cambria',
    'Candara',
    'Consolas',
    'Segoe UI',
    'Segoe UI Emoji',
    // macOS
    'SF Pro Display',
    'SF Pro Text',
    'Menlo',
    'Monaco',
    'Helvetica Neue',
    // Linux
    'Ubuntu',
    'DejaVu Sans',
    'Liberation Sans',
    // Rare-ish / designer
    'Futura',
    'Garamond',
    'Palatino',
    'Didot',
    'Baskerville',
    'Franklin Gothic',
    'Gill Sans',
    'Optima',
    'Avenir',
    'Avenir Next',
    'DIN Condensed',
    'DIN Alternate',
    'Montserrat',
    'Roboto Slab',
    'Source Sans Pro',
    'Noto Sans',
    'Noto Serif',
    'Noto Color Emoji',
    // “tells”
    'MS Gothic',
    'SimSun',
    'PingFang SC',
    'Hiragino Sans',
    'Apple SD Gothic Neo',
    'STHeiti',
    'TH Sarabun New',
    // More entropy
    'Book Antiqua',
    'Century Gothic',
    'Rockwell',
    'Lucida Console',
    'Copperplate',
    'Brush Script MT',
    'Chalkduster',
    'Papyrus',
  ];

  const fontsAvailable = probeFonts(fontList);

  const out = {
    userAgent: ua,
    platform,
    language: lang,
    cores,
    deviceMemoryGB: ramGb,
    battery,
    ...screenMetrics,
    webgl_vendor: webgl.vendor ?? null,
    webgl_renderer: webgl.renderer ?? null,
    canvas_sha256: canvas.canvas_sha256 ?? null,
    fonts_detected_count: fontsAvailable.length,
    fonts_detected_sample: fontsAvailable.slice(0, 12).join(', '),
  };

  setState({ fingerprint: out });
  return out;
}

