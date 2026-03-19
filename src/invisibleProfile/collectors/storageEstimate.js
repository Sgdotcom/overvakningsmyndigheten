import { setState } from '../state.js';

export async function collectStorageEstimate() {
  if (!navigator.storage || !navigator.storage.estimate) {
    const out = { supported: false };
    setState({ storageEstimate: out });
    return out;
  }
  const est = await navigator.storage.estimate();
  const out = {
    quota_bytes: est.quota ?? null,
    usage_bytes: est.usage ?? null,
  };
  setState({ storageEstimate: out });
  return out;
}

