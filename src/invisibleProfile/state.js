const listeners = new Set();

export const state = {
  started: false,
  startedAt: null,
  consent: false,
  invasiveEnabled: false,
  identity: null,
  network: null,
  fingerprint: null,
  environment: null,
  connection: null,
  permissions: null,
  geolocation: null,
  media: null,
  storageEstimate: null,
  pageContext: null,
  adblock: null,
  behavior: null,
  storage: null,
  loginSniffing: null,
  audioFingerprint: null,
  inference: null,
  errors: [],
};

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setState(patch) {
  Object.assign(state, patch);
  listeners.forEach((fn) => fn(state));
}

export function pushError(err) {
  const msg = err && err.message ? err.message : String(err);
  state.errors = [...state.errors, { at: Date.now(), message: msg }];
  listeners.forEach((fn) => fn(state));
}

