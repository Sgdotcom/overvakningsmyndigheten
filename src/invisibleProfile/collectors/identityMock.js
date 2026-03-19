import { setState } from '../state.js';

function yearsBetween(fromIso, toDate) {
  const d = new Date(fromIso);
  if (Number.isNaN(d.getTime())) return null;
  let age = toDate.getFullYear() - d.getFullYear();
  const m = toDate.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && toDate.getDate() < d.getDate())) age -= 1;
  return age;
}

export function mockOidcClaims({ name, birthdate, pin }) {
  const now = new Date();
  const age = birthdate ? yearsBetween(birthdate, now) : null;
  const age_verified_18 = typeof age === 'number' ? age >= 18 : null;
  const maskedPin =
    pin && pin.length >= 4 ? `${pin.slice(0, 2)}••••••${pin.slice(-2)}` : (pin ? '••••' : null);

  // Shape it like a minimal OIDC profile response.
  const claims = {
    iss: 'mock://bankid',
    aud: 'invisible-profile-demo',
    iat: Math.floor(Date.now() / 1000),
    name: (name || '').trim() || null,
    birthdate: birthdate || null,
    pin_masked: maskedPin,
    age,
    age_verified_18,
    scope: 'openid profile birthdate',
  };

  setState({ identity: claims });
  return claims;
}

