import { mountInvisibleProfile } from './ui.js';
import { startCollectors } from './workers.js';
import { setState } from './state.js';

export function bootInvisibleProfile() {
  const root = document.getElementById('invisible-profile-root');
  if (!root) return;
  mountInvisibleProfile(root);

  // If cookies were already accepted in a previous session, auto-start collectors.
  // This prevents a race condition where cookie-consent.js dispatches the event
  // before this module finishes loading.
  try {
    if (localStorage.getItem('ipCookieConsentAccepted') === 'true') {
      // Also ensure the Din Data section is visible
      const section = document.getElementById('invisible-profile');
      if (section) section.classList.remove('d-none');
      setState({ started: true, consent: true, startedAt: Date.now() });
      startCollectors();
    }
  } catch (e) { /* localStorage unavailable */ }
}

