function moneyGuess(fingerprint, network) {
  const ram = fingerprint?.deviceMemoryGB ?? null;
  const cores = fingerprint?.cores ?? null;
  const gpu = (fingerprint?.webgl_renderer || '').toLowerCase();
  const country = (network?.country || '').toLowerCase();

  let score = 0;
  if (typeof ram === 'number') score += Math.min(4, ram / 4);
  if (typeof cores === 'number') score += Math.min(4, cores / 4);
  if (gpu.includes('nvidia') || gpu.includes('radeon')) score += 1.5;
  if (gpu.includes('apple') || gpu.includes('m1') || gpu.includes('m2') || gpu.includes('m3')) score += 1.2;
  if (country.includes('sweden') || country.includes('denmark') || country.includes('norway')) score += 0.6;

  if (score >= 7) return 'High (based on premium hardware + region)';
  if (score >= 4) return 'Medium (based on hardware class + region)';
  return 'Unknown/Low (limited signals)';
}

function professionGuess(fingerprint) {
  const ua = (fingerprint?.userAgent || '').toLowerCase();
  const fontsSample = (fingerprint?.fonts_detected_sample || '').toLowerCase();
  const platform = (fingerprint?.platform || '').toLowerCase();

  const hints = [];
  if (ua.includes('mac os') || platform.includes('mac')) hints.push('macOS user');
  if (fontsSample.includes('calibri') || fontsSample.includes('cambria')) hints.push('Office/Windows fonts present');
  if (fontsSample.includes('menlo') || fontsSample.includes('monaco') || fontsSample.includes('consolas'))
    hints.push('developer-friendly monospace fonts present');
  if (fontsSample.includes('din') || fontsSample.includes('avenir') || fontsSample.includes('optima'))
    hints.push('design-oriented fonts present');

  if (hints.find((h) => h.includes('developer'))) return { guess: 'Tech / developer-adjacent', hints };
  if (hints.find((h) => h.includes('design'))) return { guess: 'Design / creative', hints };
  if (hints.find((h) => h.includes('Office'))) return { guess: 'Office / admin / corporate', hints };
  return { guess: 'Unknown', hints };
}

function privacyGuess(network, loginSniffing, storage) {
  const proxy = network?.proxy;
  const hosting = network?.hosting;
  const mobile = network?.mobile;

  const adIdPresent = !!storage?.cookie_tracking_id;
  const ln = loginSniffing?.results;

  const signals = [];
  if (proxy === true) signals.push('Proxy/VPN likely (from IP metadata)');
  if (hosting === true) signals.push('Hosting/VPS network (possible VPN/Tor exit)');
  if (mobile === true) signals.push('Mobile network');
  if (adIdPresent) signals.push('Accepts first-party tracking cookies (demo cookie present)');
  if (ln) {
    const loaded = Object.entries(ln)
      .filter(([, v]) => v && v.status === 'load')
      .map(([k]) => k);
    if (loaded.length) signals.push(`Third-party resources loaded: ${loaded.join(', ')}`);
  }

  let habit = 'Unknown';
  if (proxy === true) habit = 'Privacy-aware (VPN/proxy signals)';
  else if (adIdPresent) habit = 'Average (cookies accepted in this session)';
  if (signals.length >= 4) habit = `${habit} (many observable signals)`;

  return { habit, signals };
}

export function inferProfile({
  identity,
  network,
  fingerprint,
  environment,
  connection,
  permissions,
  geolocation,
  media,
  storageEstimate,
  pageContext,
  adblock,
  behavior,
  storage,
  loginSniffing,
  audioFingerprint,
}) {
  const wealth = moneyGuess(fingerprint, network);
  const prof = professionGuess(fingerprint);
  const privacy = privacyGuess(network, loginSniffing, storage);

  const name = identity?.name || 'Unknown person';
  const age = typeof identity?.age === 'number' ? `${identity.age}` : 'unknown';

  const privacySignals = [...privacy.signals];
  if (environment?.globalPrivacyControl === true) privacySignals.push('Global Privacy Control enabled');
  if (String(environment?.doNotTrack) === '1') privacySignals.push('Do Not Track enabled');
  if (adblock?.likely_adblock) privacySignals.push('Likely adblock user (bait blocked)');
  if (audioFingerprint?.sha256) privacySignals.push('Audio fingerprint collected (invasive toggle enabled)');

  const summary =
    `Inference for ${name}: ` +
    `age≈${age}, wealth=${wealth}, profession=${prof.guess}, privacy=${privacy.habit}.`;

  return {
    summary,
    wealth,
    profession: prof,
    privacy: { ...privacy, signals: privacySignals },
    behavior: {
      keystroke_avg_ms: behavior?.keystroke_ms?.avg ?? null,
      mouse_moves: behavior?.mouse_moves ?? null,
    },
    context: {
      timezone: environment?.timezone ?? null,
      effectiveType: connection?.effectiveType ?? null,
      geoPrecise: geolocation?.lat != null ? 'granted' : null,
      mediaDevices: media?.mediaDevices ? JSON.stringify(media.mediaDevices) : null,
      storageQuota: storageEstimate?.quota_bytes ?? null,
      utm: pageContext?.utm ?? null,
    },
  };
}

