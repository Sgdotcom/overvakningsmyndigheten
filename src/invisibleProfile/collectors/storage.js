import { setState } from '../state.js';

function randomId(prefix) {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${prefix}_${hex}`;
}

function getCookie(name) {
  const parts = document.cookie.split(';').map((p) => p.trim());
  for (const p of parts) {
    if (!p) continue;
    const idx = p.indexOf('=');
    if (idx === -1) continue;
    const k = decodeURIComponent(p.slice(0, idx));
    if (k === name) return decodeURIComponent(p.slice(idx + 1));
  }
  return null;
}

function setCookie(name, value, days = 30) {
  const maxAge = days * 24 * 60 * 60;
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(
    value
  )}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
}

export function collectStorageBreadcrumbs() {
  const cookieKey = 'ip_demo_tracking_id';
  const lsKey = 'ip_demo_zombie_id';
  const ssKey = 'ip_demo_session_id';

  let tracking = getCookie(cookieKey);
  if (!tracking) {
    tracking = randomId('cookie');
    setCookie(cookieKey, tracking, 30);
  }

  let zombie = localStorage.getItem(lsKey);
  if (!zombie) {
    zombie = randomId('ls');
    localStorage.setItem(lsKey, zombie);
  }

  let session = sessionStorage.getItem(ssKey);
  if (!session) {
    session = randomId('ss');
    sessionStorage.setItem(ssKey, session);
  }

  const out = {
    cookie_tracking_id: tracking,
    localStorage_zombie_id: zombie,
    sessionStorage_session_id: session,
  };
  setState({ storage: out });
  return out;
}

export function purgeStorageBreadcrumbs() {
  // Clear the demo cookie and storage keys (not global wipe here).
  document.cookie = `ip_demo_tracking_id=; Path=/; Max-Age=0; SameSite=Lax`;
  localStorage.removeItem('ip_demo_zombie_id');
  sessionStorage.removeItem('ip_demo_session_id');
}

