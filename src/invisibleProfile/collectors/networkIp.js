import { pushError, setState } from '../state.js';

const DEFAULT_ENDPOINTS = [
  'https://ipapi.co/json/',
  'https://ip-api.com/json/?fields=status,message,query,country,regionName,city,zip,lat,lon,isp,as,mobile,proxy,hosting',
];

function normalizeIpResult(raw) {
  if (!raw || typeof raw !== 'object') return null;

  // ipapi.co shape
  if (raw.ip) {
    return {
      ip: raw.ip,
      city: raw.city || null,
      region: raw.region || raw.region_code || null,
      country: raw.country_name || raw.country || null,
      zip: raw.postal || null,
      lat: raw.latitude ?? null,
      lon: raw.longitude ?? null,
      isp: raw.org || raw.asn || null,
      asn: raw.asn || null,
      network: raw.network || null,
      mobile: raw.network && /mobile/i.test(raw.network) ? true : null,
      proxy: raw.in_eu != null ? null : null,
      rawProvider: 'ipapi.co',
    };
  }

  // ip-api.com shape
  if (raw.query || raw.status) {
    if (raw.status && raw.status !== 'success') {
      return { error: raw.message || 'ip-api error', rawProvider: 'ip-api.com' };
    }
    return {
      ip: raw.query || null,
      city: raw.city || null,
      region: raw.regionName || null,
      country: raw.country || null,
      zip: raw.zip || null,
      lat: raw.lat ?? null,
      lon: raw.lon ?? null,
      isp: raw.isp || null,
      asn: raw.as || null,
      mobile: raw.mobile ?? null,
      proxy: raw.proxy ?? null,
      hosting: raw.hosting ?? null,
      rawProvider: 'ip-api.com',
    };
  }

  return { raw: raw, rawProvider: 'unknown' };
}

export async function collectNetworkIp({ endpoint } = {}) {
  const url = endpoint || DEFAULT_ENDPOINTS[0];
  try {
    const res = await fetch(url, { cache: 'no-store' });
    const json = await res.json();
    const normalized = normalizeIpResult(json);
    setState({ network: normalized });
    return normalized;
  } catch (e) {
    pushError(e);
    setState({ network: { error: String(e && e.message ? e.message : e) } });
    return null;
  }
}

