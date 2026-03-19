/**
 * Kräv inloggning för POI-sidor (klient-side). Index.html ska INTE ladda detta script.
 * Säkerhet: vem som helst kan kringgå detta via devtools – för riktig låsning behövs server.
 */
(function () {
  var file = (location.pathname.split('/').pop() || '').toLowerCase();
  if (!file || file === 'index.html') return;

  var gated = [
    'poi-1.html',
    'poi-2.html',
    'poi-3.html',
    'poi-4.html',
    'poi-5.html',
    'poi-6.html',
    'poi-final.html',
    'summary.html',
  ];
  if (gated.indexOf(file) === -1) return;

  var SESSION_KEY = 'poiSiteAuth';
  var MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 h

  function redirect() {
    var next = encodeURIComponent(file);
    location.replace('../index.html?next=' + next);
  }

  try {
    var raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) {
      redirect();
      return;
    }
    var o = JSON.parse(raw);
    if (!o || !o.ok || typeof o.name !== 'string' || !o.name.trim()) {
      redirect();
      return;
    }
    if (typeof o.ts === 'number' && Date.now() - o.ts > MAX_AGE_MS) {
      sessionStorage.removeItem(SESSION_KEY);
      redirect();
      return;
    }
  } catch (e) {
    redirect();
  }
})();
