/**
 * Cookie consent — sticky bottom bar.
 * Created entirely via JS so Vite cannot strip inline styles.
 * Non-blocking: user can still interact with the page behind it.
 */
(function () {
  var KEY = 'ipCookieConsentAccepted';
  var CONSENT_EVENT = 'ip-consent-accepted';

  function hasConsent() {
    try { return localStorage.getItem(KEY) === 'true'; } catch (e) { return false; }
  }
  function setConsent() {
    try { localStorage.setItem(KEY, 'true'); } catch (e) {}
  }
  function triggerStart() {
    window.dispatchEvent(new Event(CONSENT_EVENT));
  }
  function showDossier() {
    var sec = document.getElementById('invisible-profile');
    if (sec) sec.classList.remove('d-none');
  }

  // --- Build bottom bar DOM ---
  function createBanner() {
    var bar = document.createElement('div');
    bar.id = 'ip-cookie-banner';
    bar.setAttribute('role', 'dialog');
    bar.setAttribute('aria-label', 'Cookie consent');
    bar.style.cssText = [
      'position:fixed',
      'bottom:0',
      'left:0',
      'right:0',
      'z-index:9999',
      'background:#fff',
      'border-top:1px solid #d0d0d0',
      'box-shadow:0 -4px 24px rgba(0,0,0,0.15)',
      'padding:1rem 1.5rem',
      'display:flex',
      'flex-wrap:wrap',
      'align-items:center',
      'gap:1rem 2rem',
    ].join(';') + ';';

    var textWrap = document.createElement('div');
    textWrap.style.cssText = 'flex:1 1 400px;min-width:0;';

    var h2 = document.createElement('h2');
    h2.textContent = 'Cookies & villkor';
    h2.style.cssText = 'font-size:1rem;font-weight:800;color:#00406a;margin:0 0 0.3rem 0;';
    textWrap.appendChild(h2);

    var p1 = document.createElement('p');
    p1.textContent = 'Denna webbplats anv\u00E4nder cookies f\u00F6r att demonstrera sp\u00E5rning och skapa en \u201Cdossier\u201D (klientsida). Genom att acceptera samtycker du till att insamling av enhetsdata startar. Din data visas under \u201CDin Data\u201D p\u00E5 startsidan. Det enda s\u00E4ttet att avb\u00F6ja \u00E4r att l\u00E4mna webbplatsen.';
    p1.style.cssText = 'font-size:0.85rem;color:#373737;line-height:1.4;margin:0;';
    textWrap.appendChild(p1);

    bar.appendChild(textWrap);

    var actions = document.createElement('div');
    actions.style.cssText = 'display:flex;flex-wrap:wrap;gap:0.5rem;flex-shrink:0;';

    var btnAccept = document.createElement('button');
    btnAccept.type = 'button';
    btnAccept.className = 'btn btn-primary btn-sm';
    btnAccept.id = 'btn-cookie-banner-accept';
    btnAccept.textContent = 'Acceptera cookies';

    var linkTerms = document.createElement('a');
    linkTerms.className = 'btn btn-outline-secondary btn-sm';
    linkTerms.href = 'terms.html';
    linkTerms.textContent = 'Terms of Service';

    actions.appendChild(btnAccept);
    actions.appendChild(linkTerms);
    bar.appendChild(actions);

    return bar;
  }

  function removeBanner() {
    var el = document.getElementById('ip-cookie-banner');
    if (el) el.parentNode.removeChild(el);
  }

  function acceptCookies() {
    setConsent();
    showDossier();
    removeBanner();
    triggerStart();
    var footerBtn = document.getElementById('btn-accept-cookies');
    if (footerBtn) {
      footerBtn.disabled = true;
      footerBtn.textContent = 'Cookies accepterade';
    }
  }

  function wireFooter() {
    var btn = document.getElementById('btn-accept-cookies');
    if (!btn) return;
    btn.addEventListener('click', function () { acceptCookies(); });
    if (hasConsent()) {
      btn.disabled = true;
      btn.textContent = 'Cookies accepterade';
    }
  }

  // --- Init ---
  document.addEventListener('DOMContentLoaded', function () {
    wireFooter();

    if (hasConsent()) {
      showDossier();
      triggerStart();
      return;
    }

    // Fresh visit — show sticky bottom bar
    var banner = createBanner();
    document.body.appendChild(banner);

    var btn = document.getElementById('btn-cookie-banner-accept');
    if (btn) {
      btn.addEventListener('click', function () { acceptCookies(); });
    }
  });
})();
