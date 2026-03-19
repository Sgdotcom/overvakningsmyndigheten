import { setState } from '../state.js';

export async function collectAdblock() {
  // Try to load a same-origin bait script that some blockers block by pattern.
  const url = `/ads.js?_=${Date.now()}`;
  const started = performance.now();

  const res = await new Promise((resolve) => {
    const s = document.createElement('script');
    s.async = true;
    s.src = url;
    s.onload = () => resolve({ status: 'load' });
    s.onerror = () => resolve({ status: 'error' });
    document.head.appendChild(s);
  });

  const ms = Math.round(performance.now() - started);
  const baitFlag = window.__IP_ADS_BAIT__ === true;

  const out = {
    bait_url: url,
    result: res.status,
    ms,
    bait_executed: baitFlag,
    likely_adblock: res.status === 'error' || baitFlag === false,
  };
  setState({ adblock: out });
  return out;
}

