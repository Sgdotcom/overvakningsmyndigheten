import { setState } from '../state.js';

export function collectConnection() {
  const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const out = c
    ? {
        effectiveType: c.effectiveType ?? null,
        downlink: c.downlink ?? null,
        rtt: c.rtt ?? null,
        saveData: c.saveData ?? null,
      }
    : { supported: false };

  setState({ connection: out });
  return out;
}

