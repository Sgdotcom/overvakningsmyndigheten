/**
 * POI / summary pages: show logged-in name + Log out (same session as index).
 */
(function () {
  function init() {
    try {
      var raw = sessionStorage.getItem('poiSiteAuth');
      var o = raw ? JSON.parse(raw) : null;
      var name = o && o.name ? String(o.name).trim() : '';
      var nameEl = document.getElementById('poi-header-user-name');
      var btn = document.getElementById('poi-btn-header-logout');
      if (nameEl) nameEl.textContent = name || '—';
      if (btn) {
        btn.addEventListener('click', function () {
          sessionStorage.removeItem('poiSiteAuth');
          location.href = 'index.html';
        });
      }
    } catch (e) {}
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
