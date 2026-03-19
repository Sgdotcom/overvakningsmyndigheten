import { setState } from '../state.js';

function sniffOne(url, timeoutMs = 2500) {
  return new Promise((resolve) => {
    const img = new Image();
    const started = performance.now();
    let done = false;

    const finish = (status, extra = {}) => {
      if (done) return;
      done = true;
      cleanup();
      resolve({
        url,
        status,
        ms: Math.round(performance.now() - started),
        ...extra,
      });
    };

    const cleanup = () => {
      img.onload = null;
      img.onerror = null;
    };

    const t = setTimeout(() => finish('timeout'), timeoutMs);
    img.onload = () => {
      clearTimeout(t);
      finish('load');
    };
    img.onerror = () => {
      clearTimeout(t);
      finish('error');
    };

    // Cache-bust to avoid local cache changes between runs.
    img.referrerPolicy = 'no-referrer';
    img.src = `${url}${url.includes('?') ? '&' : '?'}_=${Date.now()}`;
  });
}

/**
 * Best-effort “login sniffing” style probe.
 * Note: modern browsers + partitioned cache make this unreliable; we report “load/error/timeout” only.
 */
export async function collectLoginSniffing() {
  const targets = [
    { key: 'google', url: 'https://www.google.com/favicon.ico' },
    { key: 'facebook', url: 'https://www.facebook.com/favicon.ico' },
    { key: 'linkedin', url: 'https://www.linkedin.com/favicon.ico' },
  ];

  const results = {};
  for (const t of targets) {
    // eslint-disable-next-line no-await-in-loop
    results[t.key] = await sniffOne(t.url);
  }

  const out = {
    note:
      'Best-effort probe. Results may be false/unknown due to browser privacy protections (partitioned cache, tracking prevention, extensions).',
    results,
  };
  setState({ loginSniffing: out });
  return out;
}

