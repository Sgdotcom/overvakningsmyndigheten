import { pushError, setState } from '../state.js';

const PERMS = ['camera', 'microphone', 'geolocation', 'notifications'];

export async function collectPermissions() {
  const out = {};
  if (!navigator.permissions || !navigator.permissions.query) {
    setState({ permissions: { supported: false } });
    return { supported: false };
  }

  for (const p of PERMS) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const st = await navigator.permissions.query({ name: p });
      out[p] = st.state;
    } catch (e) {
      out[p] = 'unknown';
    }
  }

  setState({ permissions: out });
  return out;
}

export function requestGeolocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      const out = { supported: false };
      setState({ geolocation: out });
      resolve(out);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const out = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy_m: pos.coords.accuracy,
          altitude: pos.coords.altitude,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
          timestamp: pos.timestamp,
        };
        setState({ geolocation: out });
        resolve(out);
      },
      (err) => {
        const out = { error: err.message, code: err.code };
        setState({ geolocation: out });
        resolve(out);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  }).catch((e) => {
    pushError(e);
    const out = { error: String(e) };
    setState({ geolocation: out });
    return out;
  });
}

