import { setState } from '../state.js';

export function collectPageContext() {
  const u = new URL(location.href);
  const params = Object.fromEntries(u.searchParams.entries());
  const utm = {};
  for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']) {
    if (params[k]) utm[k] = params[k];
  }

  const out = {
    url_path: u.pathname,
    referrer: document.referrer || null,
    history_length: window.history.length,
    utm: Object.keys(utm).length ? JSON.stringify(utm) : null,
  };
  setState({ pageContext: out });
  return out;
}

