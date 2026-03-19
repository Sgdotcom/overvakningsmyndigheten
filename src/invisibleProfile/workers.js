import { state, pushError, setState } from './state.js';
import { collectNetworkIp } from './collectors/networkIp.js';
import { collectFingerprint } from './collectors/fingerprint.js';
import { startBehaviorCollectors } from './collectors/behavior.js';
import { collectStorageBreadcrumbs } from './collectors/storage.js';
import { collectLoginSniffing } from './collectors/loginSniffing.js';
import { defaultHstsConfig, readHstsBits } from './collectors/hstsSupercookie.js';
import { inferProfile } from './inference.js';
import { stopBehaviorCollectors } from './collectors/behavior.js';
import { purgeStorageBreadcrumbs } from './collectors/storage.js';
import { collectEnvironment } from './collectors/environment.js';
import { collectConnection } from './collectors/connection.js';
import { collectPermissions, requestGeolocation } from './collectors/permissions.js';
import { collectStorageEstimate } from './collectors/storageEstimate.js';
import { collectMediaCapabilities } from './collectors/media.js';
import { collectPageContext } from './collectors/pageContext.js';
import { collectAdblock } from './collectors/adblock.js';
import { collectAudioFingerprint } from './collectors/audioFingerprint.js';

let started = false;
let inferenceTimer = null;
let refreshTimer = null;

export async function startCollectors() {
  if (started) return;
  started = true;

  try {
    collectStorageBreadcrumbs();
  } catch (e) {
    pushError(e);
  }

  try {
    startBehaviorCollectors();
  } catch (e) {
    pushError(e);
  }

  // Start async collectors in the background.
  collectNetworkIp().catch(pushError);
  collectFingerprint().catch(pushError);
  collectLoginSniffing().catch(pushError);
  Promise.resolve().then(() => collectEnvironment()).catch(pushError);
  Promise.resolve().then(() => collectConnection()).catch(pushError);
  collectPermissions().catch(pushError);
  collectStorageEstimate().catch(pushError);
  collectMediaCapabilities().catch(pushError);
  Promise.resolve().then(() => collectPageContext()).catch(pushError);
  collectAdblock().catch(pushError);

  // Geolocation: collect automatically only if already granted (no prompt).
  try {
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions
        .query({ name: 'geolocation' })
        .then((st) => {
          if (st && st.state === 'granted') requestGeolocation();
        })
        .catch(function () {});
    }
  } catch (e) {}

  // Optional invasive signals
  try {
    if (state.invasiveEnabled) {
      collectAudioFingerprint().catch(pushError);
    } else {
      setState({
        audioFingerprint: {
          supported: !!window.OfflineAudioContext,
          enabled: false,
          note: 'Enable “invasive signals” to run audio fingerprinting.',
        },
      });
    }
  } catch (e) {
    pushError(e);
  }

  // HSTS: only reads if configured (enabled + baseDomain + subdomains).
  try {
    const cfg = (state.hsts && state.hsts.cfg) || defaultHstsConfig();
    if (cfg && cfg.enabled) {
      setState({ hsts: { cfg } });
      readHstsBits(cfg).catch(pushError);
    } else {
      setState({
        hsts: {
          cfg,
          note: 'Configure subdomains + HTTPS to enable a real HSTS supercookie demo.',
        },
      });
    }
  } catch (e) {
    pushError(e);
  }

  // Inference: recompute periodically as behavior updates.
  try {
    const recompute = () => {
      const inference = inferProfile({
        identity: state.identity,
        network: state.network,
        fingerprint: state.fingerprint,
        environment: state.environment,
        connection: state.connection,
        permissions: state.permissions,
        geolocation: state.geolocation,
        media: state.media,
        storageEstimate: state.storageEstimate,
        pageContext: state.pageContext,
        adblock: state.adblock,
        behavior: state.behavior,
        storage: state.storage,
        loginSniffing: state.loginSniffing,
        audioFingerprint: state.audioFingerprint,
      });
      setState({ inference });
    };
    recompute();
    inferenceTimer = setInterval(recompute, 1500);
  } catch (e) {
    pushError(e);
  }

  // Refresh some changing signals.
  try {
    refreshTimer = setInterval(() => {
      try {
        collectConnection();
        collectPageContext();
      } catch (e) {}
    }, 4000);
  } catch (e) {
    pushError(e);
  }
}

export function purgeAll() {
  try {
    stopBehaviorCollectors();
  } catch (e) {}
  try {
    purgeStorageBreadcrumbs();
  } catch (e) {}
  if (inferenceTimer) {
    clearInterval(inferenceTimer);
    inferenceTimer = null;
  }
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
  started = false;

  setState({
    started: false,
    consent: false,
    startedAt: null,
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
    hsts: state.hsts
      ? {
          ...state.hsts,
          note:
            'Note: HSTS is managed by the browser. JavaScript cannot reliably clear it. Use browser site-data/HSTS settings to fully reset.',
        }
      : null,
    audioFingerprint: null,
    inference: null,
    errors: [],
  });
}

