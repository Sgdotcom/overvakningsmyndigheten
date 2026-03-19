import { setState } from '../state.js';

export function collectEnvironment() {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  const locale = Intl.DateTimeFormat().resolvedOptions().locale || null;
  const languages = navigator.languages || (navigator.language ? [navigator.language] : []);

  const dnt = navigator.doNotTrack || window.doNotTrack || null;
  const gpc = navigator.globalPrivacyControl ?? null;
  const cookieEnabled = navigator.cookieEnabled ?? null;
  const uaData = navigator.userAgentData
    ? {
        mobile: navigator.userAgentData.mobile,
        platform: navigator.userAgentData.platform,
        brands: navigator.userAgentData.brands,
      }
    : null;

  const out = {
    timezone: tz,
    locale,
    languages: languages.slice(0, 6).join(', '),
    doNotTrack: dnt,
    globalPrivacyControl: gpc,
    cookiesEnabled: cookieEnabled,
    userAgentData: uaData ? JSON.stringify(uaData) : null,
  };
  setState({ environment: out });
  return out;
}

