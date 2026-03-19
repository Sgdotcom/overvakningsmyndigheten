import { setState } from '../state.js';

/**
 * Real HSTS supercookie demo (requires server + subdomains).
 *
 * Concept:
 * - You have subdomains like:
 *   bit0.example.com, bit1.example.com, ... bitN.example.com
 * - Each subdomain serves a tiny image at /hsts.png over HTTPS and sends:
 *   Strict-Transport-Security: max-age=31536000; includeSubDomains
 * - Optional: the HTTP version (http://bit0.example.com/hsts.png) is NOT served (connection refused) OR returns something else.
 *
 * Detect:
 * - Request http://bitX.example.com/hsts.png
 * - If HSTS cached, the browser upgrades to https://... and the load succeeds.
 * - If not, it stays on http and fails (or loads a different response).
 *
 * This is best-effort and depends on deployment.
 */

function loadImage(url, timeoutMs = 2500) {
  return new Promise((resolve) => {
    const img = new Image();
    let done = false;
    const started = performance.now();

    const finish = (status) => {
      if (done) return;
      done = true;
      cleanup();
      resolve({ url, status, ms: Math.round(performance.now() - started) });
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

    img.referrerPolicy = 'no-referrer';
    img.src = `${url}${url.includes('?') ? '&' : '?'}_=${Date.now()}`;
  });
}

export function defaultHstsConfig() {
  return {
    enabled: false,
    // Example for public web:
    // baseDomain: "example.com",
    // subdomains: ["b0", "b1", "b2", "b3"]  -> becomes b0.example.com etc.
    baseDomain: '',
    subdomains: [],
    httpsPath: '/hsts.png',
    httpPath: '/hsts.png',
  };
}

export async function primeHstsBits(cfg) {
  if (!cfg || !cfg.enabled) return null;
  if (!cfg.baseDomain || !cfg.subdomains || !cfg.subdomains.length) return null;

  const results = [];
  for (const sub of cfg.subdomains) {
    const host = `${sub}.${cfg.baseDomain}`;
    // eslint-disable-next-line no-await-in-loop
    results.push(await loadImage(`https://${host}${cfg.httpsPath}`));
  }

  const out = { action: 'prime', results };
  setState({ hsts: out });
  return out;
}

export async function readHstsBits(cfg) {
  if (!cfg || !cfg.enabled) return null;
  if (!cfg.baseDomain || !cfg.subdomains || !cfg.subdomains.length) return null;

  const bits = [];
  const results = [];

  for (const sub of cfg.subdomains) {
    const host = `${sub}.${cfg.baseDomain}`;
    // eslint-disable-next-line no-await-in-loop
    const r = await loadImage(`http://${host}${cfg.httpPath}`);
    results.push(r);
    bits.push(r.status === 'load' ? 1 : 0);
  }

  const out = {
    action: 'read',
    bits: bits.join(''),
    note:
      'For this to work, your server must set Strict-Transport-Security on the HTTPS endpoint, and the HTTP endpoint must be unavailable or distinguishable.',
    results,
  };
  setState({ hsts: out });
  return out;
}

