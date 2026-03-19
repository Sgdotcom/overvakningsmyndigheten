import { state, subscribe, setState } from './state.js';
import { startCollectors } from './workers.js';
import { mockOidcClaims } from './collectors/identityMock.js';
import { primeHstsBits, readHstsBits } from './collectors/hstsSupercookie.js';
import { purgeAll } from './workers.js';
import { requestGeolocation } from './collectors/permissions.js';
import { setState as setGlobalState } from './state.js';

// Persist dossier open/closed state across re-renders.
const detailsOpenState = new Map();
const techOpenState = new Map();

function el(tag, attrs = {}, children = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else if (v === false || v == null) continue;
    else n.setAttribute(k, String(v));
  }
  for (const c of children) n.append(c);
  return n;
}

function renderKV(obj) {
  if (!obj) return el('div', { class: 'ip-muted', text: '—' });
  const rows = Object.entries(obj).map(([k, v]) =>
    el('div', { class: 'ip-kv-row' }, [
      el('div', { class: 'ip-kv-key', text: k }),
      el('div', { class: 'ip-kv-val', text: typeof v === 'string' ? v : JSON.stringify(v) }),
    ])
  );
  return el('div', { class: 'ip-kv' }, rows);
}

function yn(v) {
  if (v === true) return 'Yes';
  if (v === false) return 'No';
  return 'Unknown';
}

function fmt(v) {
  if (v == null) return '—';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string' && !v.trim()) return '—';
  return String(v);
}

function friendlyList(items) {
  if (!items || !items.length) return el('div', { class: 'ip-muted', text: '—' });
  return el(
    'ul',
    { class: 'ip-friendly' },
    items.map((t) => el('li', { class: 'ip-friendly-item', text: t }))
  );
}

function sectionContent({ sectionKey, summaryItems, techObj }) {
  const kids = [friendlyList(summaryItems)];
  if (techObj) {
    const k = `tech:${sectionKey || 'unknown'}`;
    const remembered = techOpenState.has(k) ? techOpenState.get(k) : null;
    kids.push(
      (() => {
        const node = el('details', { class: 'ip-tech', open: remembered ? 'open' : null }, [
          el('summary', { class: 'ip-tech-summary', text: 'Technical details' }),
          el('div', { class: 'ip-tech-body' }, [renderKV(techObj)]),
        ]);
        node.addEventListener('toggle', () => {
          techOpenState.set(k, node.open);
        });
        return node;
      })()
    );
  }
  return el('div', { class: 'ip-section-content' }, kids);
}

function pill(text, kind = 'low') {
  const cls =
    kind === 'high'
      ? 'ip-risk ip-risk--high'
      : kind === 'med'
        ? 'ip-risk ip-risk--med'
        : 'ip-risk ip-risk--low';
  return el('span', { class: cls, text });
}

function section(title, riskKind, helpText, contentNode, { open = false } = {}) {
  const key = `sec:${title}`;
  const remembered = detailsOpenState.has(key) ? detailsOpenState.get(key) : null;
  const isOpen = remembered != null ? remembered : open;

  const node = el('details', { class: 'ip-section', open: isOpen ? 'open' : null }, [
    el('summary', { class: 'ip-section-summary' }, [
      el('span', { class: 'ip-section-title', text: title }),
      pill(riskKind === 'high' ? 'High risk' : riskKind === 'med' ? 'Medium risk' : 'Low risk', riskKind),
    ]),
    el('div', { class: 'ip-section-help', text: helpText }),
    el('div', { class: 'ip-section-body' }, [contentNode]),
  ]);
  node.addEventListener('toggle', () => {
    detailsOpenState.set(key, node.open);
  });
  return node;
}

function render(root) {
  root.innerHTML = '';

  const started = !!state.started;

  const controls = el('div', { class: 'ip-controls' }, [
    el(
      'button',
      {
        class: 'btn btn-primary btn-sm',
        type: 'button',
        disabled: started,
        onclick: () => {
          setState({ started: true, consent: true, startedAt: Date.now() });
          startCollectors();
        },
      },
      [document.createTextNode('Acceptera cookies')]
    ),
    el(
      'button',
      {
        class: 'btn btn-outline-danger btn-sm',
        type: 'button',
        onclick: () => {
          purgeAll();
        },
      },
      [document.createTextNode('Purge all data')]
    ),
  ]);

  const userView = el('div', { class: 'ip-user' }, [
    el('h3', { class: 'h6 text-uppercase small text-muted mb-2', text: 'User view' }),
    el('p', { class: 'mb-2' }, [
      document.createTextNode(
        started
          ? 'Demo is running. Interact with the page to generate behavioral signals.'
          : 'Acceptera cookies för att fortsätta.'
      ),
    ]),
    controls,
    el('hr', { class: 'my-3' }),
    el('div', { class: 'ip-actions' }, [
      el('div', { class: 'ip-action-title', text: 'Identity (mock OIDC)' }),
      el('p', { class: 'small text-muted mb-2' }, [
        document.createTextNode('Simulates a verified identity provider (BankID/MitID style) using OIDC-shaped claims.'),
      ]),
      el(
        'button',
        {
          class: 'btn btn-outline-primary btn-sm',
          type: 'button',
          onclick: () => openIdentityModal(),
        },
        [document.createTextNode('Open mock login')]
      ),
    ]),
    el('div', { class: 'ip-actions mt-3' }, [
      el('div', { class: 'ip-action-title', text: 'Permissions & location' }),
      el('p', { class: 'small text-muted mb-2' }, [
        document.createTextNode('Geolocation is collected automatically if already granted; otherwise you can request it here.'),
      ]),
      el('div', { class: 'ip-controls' }, [
        el(
          'button',
          {
            class: 'btn btn-outline-secondary btn-sm',
            type: 'button',
            onclick: async () => {
              if (!state.started) return;
              await requestGeolocation();
            },
          },
          [document.createTextNode('Request precise geolocation')]
        ),
      ]),
    ]),
    el('div', { class: 'ip-actions mt-3' }, [
      el('div', { class: 'ip-action-title', text: 'Invasive signals' }),
      el('p', { class: 'small text-muted mb-2' }, [
        document.createTextNode('Enable extra invasive techniques (e.g. audio fingerprint).'),
      ]),
      el('label', { class: 'ip-toggle' }, [
        el('input', {
          type: 'checkbox',
          checked: state.invasiveEnabled ? 'checked' : null,
          onchange: (e) => {
            setGlobalState({ invasiveEnabled: !!e.target.checked });
            // If demo is already running, re-run collectors to pick up invasive-only ones.
            if (state.started) startCollectors();
          },
        }),
        el('span', { class: 'ip-toggle-text', text: 'Enable invasive signals' }),
      ]),
    ]),
    el('div', { class: 'ip-actions mt-3' }, [
      el('div', { class: 'ip-action-title', text: 'HSTS supercookie (real demo)' }),
      el('p', { class: 'small text-muted mb-2' }, [
        document.createTextNode(
          'Requires HTTPS + configured subdomains. Prime sets HSTS by loading https://sub.domain/hsts.png; Read probes http://sub.domain/hsts.png.'
        ),
      ]),
      el('div', { class: 'ip-controls' }, [
        el(
          'button',
          {
            class: 'btn btn-outline-light btn-sm',
            type: 'button',
            onclick: async () => {
              const cfg = (state.hsts && state.hsts.cfg) || null;
              if (!cfg || !cfg.enabled) return;
              await primeHstsBits(cfg);
            },
          },
          [document.createTextNode('Prime bits')]
        ),
        el(
          'button',
          {
            class: 'btn btn-outline-light btn-sm',
            type: 'button',
            onclick: async () => {
              const cfg = (state.hsts && state.hsts.cfg) || null;
              if (!cfg || !cfg.enabled) return;
              await readHstsBits(cfg);
            },
          },
          [document.createTextNode('Read bits')]
        ),
      ]),
    ]),
    el('div', { class: 'ip-user-note small text-muted mt-2' }, [
      document.createTextNode(
        'This demo collects and displays signals in your browser session. It is intentionally invasive by design.'
      ),
    ]),
  ]);

  const dossier = el('div', { class: 'ip-dossier' }, [
    el('div', { class: 'ip-dossier-header' }, [
      el('h3', { class: 'h6 text-uppercase small text-muted mb-0', text: 'Dossier (live)' }),
      el('div', { class: 'ip-pill', text: started ? 'Collecting' : 'Idle' }),
    ]),
    el('div', { class: 'ip-dossier-body' }, [
      // At-a-glance
      el('div', { class: 'ip-dossier-ataglance' }, [
        el('div', { class: 'ip-ataglance-title', text: 'At a glance' }),
        el('div', { class: 'ip-ataglance-row' }, [
          el('span', { class: 'ip-ataglance-key', text: 'IP' }),
          el('span', { class: 'ip-ataglance-val', text: state.network?.ip || '—' }),
        ]),
        el('div', { class: 'ip-ataglance-row' }, [
          el('span', { class: 'ip-ataglance-key', text: 'GPU' }),
          el('span', { class: 'ip-ataglance-val', text: state.fingerprint?.webgl_renderer || '—' }),
        ]),
        el('div', { class: 'ip-ataglance-row' }, [
          el('span', { class: 'ip-ataglance-key', text: 'Canvas hash' }),
          el('span', { class: 'ip-ataglance-val', text: state.fingerprint?.canvas_sha256 ? state.fingerprint.canvas_sha256.slice(0, 16) + '…' : '—' }),
        ]),
      ]),

      section(
        'Inference (AI-style)',
        'med',
        'A rules-based guess built from the signals below.',
        state.inference
          ? el('div', { class: 'ip-inference', text: state.inference.summary || '—' })
          : el('div', { class: 'ip-muted', text: '—' })
        , { open: true }
      ),
      section(
        'Network & location (from IP)',
        'med',
        'Rough location and ISP inferred from your public IP address.',
        sectionContent({
          sectionKey: 'network',
          summaryItems: [
            `Your public IP: ${fmt(state.network?.ip)}`,
            `Approx. location: ${[state.network?.city, state.network?.region, state.network?.country].filter(Boolean).join(', ') || '—'}`,
            `ISP / ASN: ${fmt(state.network?.isp)} / ${fmt(state.network?.asn)}`,
            `VPN / proxy hint: ${yn(state.network?.proxy)}`,
            `Mobile network hint: ${yn(state.network?.mobile)}`,
          ],
          techObj: state.network,
        }),
        { open: true }
      ),
      section(
        'Device fingerprint (stable identifiers)',
        'high',
        'Traits that can help identify your device even after cookie deletion.',
        sectionContent({
          sectionKey: 'fingerprint',
          summaryItems: [
            `GPU model: ${fmt(state.fingerprint?.webgl_renderer)}`,
            `CPU cores: ${fmt(state.fingerprint?.cores)} · RAM: ${fmt(state.fingerprint?.deviceMemoryGB)} GB`,
            `Screen: ${fmt(state.fingerprint?.screen)} · Window: ${fmt(state.fingerprint?.window)}`,
            `Canvas “device ID”: ${state.fingerprint?.canvas_sha256 ? state.fingerprint.canvas_sha256.slice(0, 16) + '…' : '—'}`,
            `Fonts detected: ${fmt(state.fingerprint?.fonts_detected_count)}`,
          ],
          techObj: state.fingerprint,
        }),
        { open: true }
      ),
      section(
        'Identity (mock verification)',
        'med',
        'A simulated “verified identity” response (OIDC-shaped claims).',
        sectionContent({
          sectionKey: 'identity',
          summaryItems: [
            `Legal name: ${fmt(state.identity?.name)}`,
            `Birthdate: ${fmt(state.identity?.birthdate)}`,
            `18+ verified: ${yn(state.identity?.age_verified_18)}`,
            `PIN/SSN (masked): ${fmt(state.identity?.pin_masked)}`,
          ],
          techObj: state.identity,
        })
      ),
      section(
        'Page context',
        'low',
        'How you arrived and what this session looks like.',
        sectionContent({
          sectionKey: 'pageContext',
          summaryItems: [
            `Referrer: ${fmt(state.pageContext?.referrer)}`,
            `UTM campaign tags: ${fmt(state.pageContext?.utm)}`,
            `History length (this session): ${fmt(state.pageContext?.history_length)}`,
          ],
          techObj: state.pageContext,
        })
      ),
      section(
        'Environment & privacy preferences',
        'low',
        'Timezone/locale and privacy preferences exposed by the browser.',
        sectionContent({
          sectionKey: 'environment',
          summaryItems: [
            `Timezone: ${fmt(state.environment?.timezone)}`,
            `Languages: ${fmt(state.environment?.languages)}`,
            `Global Privacy Control: ${yn(state.environment?.globalPrivacyControl)}`,
            `Do Not Track: ${fmt(state.environment?.doNotTrack)}`,
            `Cookies enabled: ${yn(state.environment?.cookiesEnabled)}`,
          ],
          techObj: state.environment,
        })
      ),
      section(
        'Connection hints',
        'low',
        'Best-effort network quality hints (when supported).',
        sectionContent({
          sectionKey: 'connection',
          summaryItems: [
            `Effective type: ${fmt(state.connection?.effectiveType)}`,
            `RTT: ${state.connection?.rtt != null ? `${state.connection.rtt} ms` : '—'}`,
            `Downlink: ${state.connection?.downlink != null ? `${state.connection.downlink} Mbps` : '—'}`,
            `Save-Data: ${yn(state.connection?.saveData)}`,
          ],
          techObj: state.connection,
        })
      ),
      section(
        'Permissions & precise location',
        'high',
        'Whether your browser has granted access to sensitive features (and optional GPS).',
        sectionContent({
          sectionKey: 'permissions',
          summaryItems: [
            `Camera permission: ${fmt(state.permissions?.camera)}`,
            `Microphone permission: ${fmt(state.permissions?.microphone)}`,
            `Geolocation permission: ${fmt(state.permissions?.geolocation)}`,
            `Precise coordinates: ${
              state.geolocation?.lat != null ? `${state.geolocation.lat}, ${state.geolocation.lon} (±${fmt(state.geolocation.accuracy_m)} m)` : 'Not collected'
            }`,
          ],
          techObj: { ...(state.permissions || {}), geolocation: state.geolocation },
        })
      ),
      section(
        'Media & device capabilities',
        'low',
        'What your browser can decode/play (and how many media devices it sees).',
        sectionContent({
          sectionKey: 'media',
          summaryItems: [
            `Video support: H.264=${fmt(state.media?.video?.h264)} · HEVC=${fmt(state.media?.video?.hevc)} · AV1=${fmt(state.media?.video?.av1)}`,
            `Audio support: AAC=${fmt(state.media?.audio?.aac)} · Opus=${fmt(state.media?.audio?.opus)}`,
            `Devices (counts): ${state.media?.mediaDevices ? JSON.stringify(state.media.mediaDevices) : '—'}`,
          ],
          techObj: state.media,
        })
      ),
      section(
        'Storage quota',
        'low',
        'How much storage the browser allocates to this site.',
        sectionContent({
          sectionKey: 'storageEstimate',
          summaryItems: [
            `Quota: ${state.storageEstimate?.quota_bytes != null ? `${Math.round(state.storageEstimate.quota_bytes / (1024 * 1024))} MB` : '—'}`,
            `Usage: ${state.storageEstimate?.usage_bytes != null ? `${Math.round(state.storageEstimate.usage_bytes / (1024 * 1024))} MB` : '—'}`,
          ],
          techObj: state.storageEstimate,
        })
      ),
      section(
        'Tracking “breadcrumbs”',
        'med',
        'IDs stored in cookie/localStorage/sessionStorage that let a site recognize a returning browser.',
        sectionContent({
          sectionKey: 'storage',
          summaryItems: [
            `Cookie ID set: ${state.storage?.cookie_tracking_id ? 'Yes' : 'No'}`,
            `LocalStorage “zombie” ID set: ${state.storage?.localStorage_zombie_id ? 'Yes' : 'No'}`,
            `SessionStorage ID set: ${state.storage?.sessionStorage_session_id ? 'Yes' : 'No'}`,
          ],
          techObj: state.storage,
        })
      ),
      section(
        'Adblock detection',
        'med',
        'A bait file is requested; blockers often stop it.',
        sectionContent({
          sectionKey: 'adblock',
          summaryItems: [
            `Likely adblock user: ${yn(state.adblock?.likely_adblock)}`,
            `Bait request result: ${fmt(state.adblock?.result)} (${state.adblock?.ms != null ? state.adblock.ms + ' ms' : '—'})`,
          ],
          techObj: state.adblock,
        })
      ),
      section(
        'Login sniffing (best-effort)',
        'high',
        'Cross-site probes that can sometimes hint whether you are logged into major services (often blocked/unreliable).',
        sectionContent({
          sectionKey: 'loginSniffing',
          summaryItems: state.loginSniffing?.results
            ? [
                `Google probe: ${fmt(state.loginSniffing.results.google?.status)} (${fmt(state.loginSniffing.results.google?.ms)} ms)`,
                `Facebook probe: ${fmt(state.loginSniffing.results.facebook?.status)} (${fmt(state.loginSniffing.results.facebook?.ms)} ms)`,
                `LinkedIn probe: ${fmt(state.loginSniffing.results.linkedin?.status)} (${fmt(state.loginSniffing.results.linkedin?.ms)} ms)`,
              ]
            : ['No results yet'],
          techObj: state.loginSniffing,
        })
      ),
      section(
        'HSTS supercookie',
        'high',
        'Encodes bits via HSTS state across subdomains. Requires HTTPS + server configuration.',
        sectionContent({
          sectionKey: 'hsts',
          summaryItems: [
            `Configured: ${state.hsts?.cfg?.enabled ? 'Yes' : 'No'}`,
            `Bits read: ${fmt(state.hsts?.bits)}`,
            state.hsts?.note ? state.hsts.note : '—',
          ],
          techObj: state.hsts,
        })
      ),
      section(
        'Audio fingerprint (invasive)',
        'high',
        'Hashes an OfflineAudioContext render. Only runs when invasive signals are enabled.',
        sectionContent({
          sectionKey: 'audioFingerprint',
          summaryItems: [
            `Enabled: ${yn(state.invasiveEnabled)}`,
            `Fingerprint hash: ${state.audioFingerprint?.sha256 ? state.audioFingerprint.sha256.slice(0, 16) + '…' : '—'}`,
          ],
          techObj: state.audioFingerprint,
        })
      ),
    ]),
  ]);

  root.append(
    el('div', { class: 'ip-grid' }, [
      el('div', { class: 'ip-col' }, [userView]),
      el('div', { class: 'ip-col ip-col--dossier' }, [dossier]),
    ])
  );
}

export function mountInvisibleProfile(root) {
  render(root);
  subscribe(() => render(root));
}

function openIdentityModal() {
  const modal = document.getElementById('ip-identity-modal');
  if (!modal) return;
  modal.classList.add('ip-modal--open');
  const first = modal.querySelector('input');
  if (first) first.focus();
}

function closeIdentityModal() {
  const modal = document.getElementById('ip-identity-modal');
  if (!modal) return;
  modal.classList.remove('ip-modal--open');
}

// Lightweight modal (no bootstrap dependency)
function ensureIdentityModal() {
  if (document.getElementById('ip-identity-modal')) return;

  const modal = el('div', { id: 'ip-identity-modal', class: 'ip-modal', role: 'dialog', 'aria-modal': 'true' }, [
    el('div', { class: 'ip-modal-backdrop', onclick: closeIdentityModal }),
    el('div', { class: 'ip-modal-card' }, [
      el('div', { class: 'ip-modal-header' }, [
        el('div', { class: 'ip-modal-title', text: 'Mock identity login (OIDC)' }),
        el('button', { type: 'button', class: 'ip-modal-close', onclick: closeIdentityModal, 'aria-label': 'Close' }, [
          document.createTextNode('×'),
        ]),
      ]),
      el('div', { class: 'ip-modal-body' }, [
        el('label', { class: 'form-label small mb-1', for: 'ip-name', text: 'Legal full name' }),
        el('input', { id: 'ip-name', class: 'form-control form-control-sm mb-2', type: 'text', placeholder: 'Full name' }),
        el('label', { class: 'form-label small mb-1', for: 'ip-birthdate', text: 'Birthdate' }),
        el('input', { id: 'ip-birthdate', class: 'form-control form-control-sm mb-2', type: 'date' }),
        el('label', { class: 'form-label small mb-1', for: 'ip-pin', text: 'PIN / SSN (demo)' }),
        el('input', { id: 'ip-pin', class: 'form-control form-control-sm mb-3', type: 'text', inputmode: 'numeric', placeholder: 'YYYYMMDD-XXXX' }),
        el('div', { class: 'd-flex gap-2' }, [
          el(
            'button',
            {
              type: 'button',
              class: 'btn btn-primary btn-sm',
              onclick: () => {
                const name = document.getElementById('ip-name')?.value || '';
                const birthdate = document.getElementById('ip-birthdate')?.value || '';
                const pin = document.getElementById('ip-pin')?.value || '';
                mockOidcClaims({ name, birthdate, pin });
                closeIdentityModal();
              },
            },
            [document.createTextNode('Issue claims')]
          ),
          el('button', { type: 'button', class: 'btn btn-outline-secondary btn-sm', onclick: closeIdentityModal }, [
            document.createTextNode('Cancel'),
          ]),
        ]),
        el('p', { class: 'small text-muted mt-2 mb-0' }, [
          document.createTextNode('This is a simulation. No real BankID/MitID verification happens here.'),
        ]),
      ]),
    ]),
  ]);

  document.body.appendChild(modal);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeIdentityModal();
  });
}

ensureIdentityModal();

// Allow external consent UI (footer/banner) to trigger start.
window.addEventListener('ip-consent-accepted', () => {
  if (state.started) return;
  setState({ started: true, consent: true, startedAt: Date.now() });
  startCollectors();
});

