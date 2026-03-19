// Smooth scroll for nav + hero buttons
document.querySelectorAll('[data-scroll]').forEach(function (el) {
  el.addEventListener('click', function () {
    var target = document.querySelector(el.getAttribute('data-scroll'));
    if (!target) return;
    var rect = target.getBoundingClientRect();
    var offset = window.pageYOffset || document.documentElement.scrollTop;
    var y = rect.top + offset - 72;
    window.scrollTo({ top: y, behavior: 'smooth' });
  });
});

// Collapsible Deep Dive
document.querySelectorAll('[data-collapsible]').forEach(function (c) {
  var header = c.querySelector('.collapsible-header');
  var body = c.querySelector('.collapsible-body');
  if (!header || !body) return;

  function setHeight(open) {
    if (open) {
      body.style.maxHeight = body.scrollHeight + 'px';
    } else {
      body.style.maxHeight = 0;
    }
  }

  setTimeout(function () {
    setHeight(false);
  }, 50);

  header.addEventListener('click', function () {
    var isOpen = c.classList.toggle('open');
    setHeight(isOpen);
  });

  window.addEventListener('resize', function () {
    if (c.classList.contains('open')) {
      setHeight(true);
    }
  });
});

// Sources modal
var modal = document.getElementById('sourcesModal');
var closeBtn = document.getElementById('closeSources');
var openButtons = [
  document.getElementById('openSourcesTop'),
  document.getElementById('openSourcesHero'),
  document.getElementById('openSourcesBottom')
].filter(Boolean);

function openModal() {
    if (!modal) return;
    modal.classList.add('show');
    modal.style.display = 'block';
    document.body.classList.add('modal-open');
}

function closeModal() {
    if (!modal) return;
    modal.classList.remove('show');
    modal.style.display = 'none';
    document.body.classList.remove('modal-open');
}

if (modal) {
  openButtons.forEach(function (btn) {
    btn.addEventListener('click', openModal);
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', closeModal);
  }

  modal.addEventListener('click', function (e) {
    if (e.target === modal) {
      closeModal();
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modal.classList.contains('show')) {
      closeModal();
    }
  });
}

// Scroll animation: slide in on first entry
const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            // keep it visible once it has entered
            obs.unobserve(entry.target);
        }
    });
}, {
    threshold: 0.1
});

// Timeline elements and section mapping
const timelineFill = document.querySelector('.timeline-fill');
const timelineMarkers = document.querySelectorAll('.timeline-marker');
const sectionMarkerMap = new Map();
timelineMarkers.forEach(marker => {
    const targetSelector = marker.getAttribute('data-target');
    if (!targetSelector) return;
    const section = document.querySelector(targetSelector);
    if (section) {
        sectionMarkerMap.set(section, marker);
    }
});

// Stronger slide behavior for main text boxes:
// as you scroll, exactly one box is "current" (visible); others are past or before.
// Any main hero or panel in the primary column participates in this behavior.
const slideSections = document.querySelectorAll(
    '.hero, main .panel'
);

// Scroll animation: slide in on first entry (only for elements that are NOT main slide sections)
const slideSectionSet = new Set(slideSections);
const elementsToAnimate = document.querySelectorAll('.fade-in-on-scroll');
elementsToAnimate.forEach(el => {
    if (slideSectionSet.has(el)) return; // slide sections are controlled by updateSlideSections only
    observer.observe(el);
});

var slideUpdateScheduled = false;
function scheduleSlideUpdate() {
    if (slideUpdateScheduled) return;
    slideUpdateScheduled = true;
    requestAnimationFrame(function () {
        slideUpdateScheduled = false;
        updateSlideSections();
    });
}

function updateSlideSections() {
    if (!slideSections.length) return;
    const vh = window.innerHeight;
    const lastIndex = slideSections.length - 1;
    const scrollY = window.scrollY || document.documentElement.scrollTop;
    const docHeight = document.documentElement.scrollHeight - vh;
    const nearBottom = docHeight > 0 && scrollY >= docHeight - vh * 0.4;

    // At the very top of the page, always show the hero/intro section.
    let activeIndex = 0;
    let maxVisible = 0;

    if (scrollY > 4) {
        // Find the section with maximum visible height
        activeIndex = -1;
        slideSections.forEach((el, index) => {
            const rect = el.getBoundingClientRect();
            const visibleTop = Math.max(rect.top, 0);
            const visibleBottom = Math.min(rect.bottom, vh);
            const visibleHeight = Math.max(0, visibleBottom - visibleTop);

            if (visibleHeight > maxVisible) {
                maxVisible = visibleHeight;
                activeIndex = index;
            }
        });

        // Fallback: if nothing is visibly inside viewport, pick nearest to center
        if (activeIndex < 0) {
            let best = 0;
            let bestDist = Infinity;
            slideSections.forEach((el, index) => {
                const rect = el.getBoundingClientRect();
                const sectionCenter = rect.top + rect.height / 2;
                const dist = Math.abs(sectionCenter - vh / 2);
                if (dist < bestDist) {
                    bestDist = dist;
                    best = index;
                }
            });
            activeIndex = best;
        }
    }

    // When scrolled near bottom, always show last section (it may be above viewport)
    if (nearBottom) {
        activeIndex = lastIndex;
    }

    // Apply classes:
    // - Active section is always visible.
    // - Sections before the active one slide out only after they have moved
    //   well above the viewport (their bottom is above a threshold).
    // - Sections after the active one are hidden until reached.
    const pastThreshold = vh * 0.25;

    slideSections.forEach((el, index) => {
        if (index === activeIndex) {
            el.classList.add('is-visible');
            el.classList.remove('is-past');
        } else if (index < activeIndex) {
            const rect = el.getBoundingClientRect();
            if (rect.bottom < pastThreshold) {
                el.classList.remove('is-visible');
                el.classList.add('is-past');
            } else {
                el.classList.add('is-visible');
                el.classList.remove('is-past');
            }
        } else {
            el.classList.remove('is-visible');
            el.classList.remove('is-past');
        }
    });

    // Sync left-hand timeline highlight with the active section
    if (timelineMarkers.length && sectionMarkerMap.size) {
        timelineMarkers.forEach(m => m.classList.remove('active'));
        const activeSection = slideSections[activeIndex];
        const marker = sectionMarkerMap.get(activeSection);
        if (marker) {
            marker.classList.add('active');
        }
    }
}

window.addEventListener('scroll', scheduleSlideUpdate, { passive: true });
window.addEventListener('resize', scheduleSlideUpdate);
updateSlideSections();

function updateTimelineFill() {
    if (!timelineFill) return;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrolled = docHeight > 0 ? window.scrollY / docHeight : 0;
    timelineFill.style.height = (scrolled * 100) + '%';
}

window.addEventListener('scroll', updateTimelineFill);
window.addEventListener('resize', updateTimelineFill);
updateTimelineFill();

// Profile popout
let popoutTimeout;

function showPopout(popout) {
    clearTimeout(popoutTimeout);
    popout.classList.add('is-visible');
}

function hidePopout(popout) {
    popoutTimeout = setTimeout(() => {
        popout.classList.remove('is-visible');
    }, 200);
}

document.querySelectorAll('.profile-hover-trigger').forEach(hoverTrigger => {
    const popout = hoverTrigger.querySelector('.profile-popout');
    if(popout) {
        hoverTrigger.addEventListener('mouseenter', () => showPopout(popout));
        hoverTrigger.addEventListener('mouseleave', () => hidePopout(popout));
    }
});

// Cross-page search for header search bar
(function initSiteSearch() {
    var searchForms = document.querySelectorAll('.rk-search-form');
    if (!searchForms.length) return;
    if (typeof DOMParser === 'undefined') return;

    var searchPages = [
        'index.html',
        'pages/index.html',
        'pages/poi-1.html',
        'pages/poi-2.html',
        'pages/poi-3.html',
        'pages/poi-4.html',
        'pages/poi-5.html',
        'pages/poi-6.html',
        'pages/summary.html',
        'pages/sources.html',
        'pages/terms.html'
    ];
    var textSelectors = 'h1, h2, h3, h4, p, li, dt, dd, blockquote';
    var parser = new DOMParser();
    var cachePromise = null;

    function getBasePrefix() {
        var path = window.location.pathname || '/';
        var pagesIdx = path.indexOf('/pages/');
        if (pagesIdx !== -1) return path.slice(0, pagesIdx + 1);
        var lastSlash = path.lastIndexOf('/');
        return lastSlash >= 0 ? path.slice(0, lastSlash + 1) : '/';
    }

    function pageUrl(relativePath) {
        return new URL(getBasePrefix() + relativePath, window.location.origin).toString();
    }

    function normalize(value) {
        return (value || '')
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .trim();
    }

    function getNearestId(node, fallbackId) {
        var current = node;
        while (current && current.nodeType === 1) {
            if (current.id) return current.id;
            current = current.parentElement;
        }
        return fallbackId || 'content';
    }

    function snippetAround(text, query) {
        var normalizedText = normalize(text);
        var normalizedQuery = normalize(query);
        var idx = normalizedText.indexOf(normalizedQuery);
        if (idx < 0) return text;
        var raw = text.replace(/\s+/g, ' ').trim();
        var start = Math.max(0, idx - 70);
        var end = Math.min(raw.length, idx + normalizedQuery.length + 90);
        var snippet = raw.slice(start, end).trim();
        if (start > 0) snippet = '...' + snippet;
        if (end < raw.length) snippet = snippet + '...';
        return snippet;
    }

    function buildIndex() {
        if (cachePromise) return cachePromise;
        cachePromise = Promise.all(
            searchPages.map(function (relativePath) {
                return fetch(pageUrl(relativePath))
                    .then(function (resp) {
                        if (!resp.ok) throw new Error('Failed to load ' + relativePath);
                        return resp.text();
                    })
                    .then(function (html) {
                        var doc = parser.parseFromString(html, 'text/html');
                        var main = doc.querySelector('#content') || doc.body;
                        var titleText = (doc.title || relativePath).split('·')[0].trim();
                        var records = [];
                        if (!main) return records;

                        main.querySelectorAll(textSelectors).forEach(function (el) {
                            var text = (el.textContent || '').replace(/\s+/g, ' ').trim();
                            if (text.length < 3) return;
                            var sectionId = getNearestId(el, 'content');
                            var section = doc.getElementById(sectionId);
                            var sectionHeading = section ? section.querySelector('h1, h2, h3') : null;
                            var sectionLabel = sectionHeading ? sectionHeading.textContent.trim() : titleText;
                            records.push({
                                path: relativePath,
                                pageTitle: titleText,
                                sectionId: sectionId,
                                sectionLabel: sectionLabel,
                                text: text
                            });
                        });
                        return records;
                    })
                    .catch(function () {
                        return [];
                    });
            })
        ).then(function (chunks) {
            return chunks.flat();
        });
        return cachePromise;
    }

    function renderResults(container, matches, query) {
        if (!container) return;
        if (!matches.length) {
            container.innerHTML = '<div class="rk-search-results__empty">Inga traffar for "' + query.replace(/"/g, '&quot;') + '".</div>';
            container.hidden = false;
            return;
        }

        var items = matches.map(function (m) {
            var href = pageUrl(m.path) + '#' + encodeURIComponent(m.sectionId);
            var snippet = snippetAround(m.text, query)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
            return (
                '<li class="rk-search-results__item">' +
                '<a class="rk-search-results__link" href="' + href + '">' +
                '<strong>' + m.pageTitle + '</strong>' +
                '<span class="rk-search-results__meta">' + m.sectionLabel + '</span>' +
                '<span class="rk-search-results__snippet">' + snippet + '</span>' +
                '</a>' +
                '</li>'
            );
        }).join('');

        container.innerHTML =
            '<div class="rk-search-results__header">' + matches.length + ' traffar for "' + query.replace(/"/g, '&quot;') + '"</div>' +
            '<ul class="rk-search-results__list">' + items + '</ul>';
        container.hidden = false;
    }

    function ensureContainer(form) {
        var existing = form.parentElement.querySelector('.rk-search-results');
        if (existing) return existing;
        var box = document.createElement('div');
        box.className = 'rk-search-results';
        box.hidden = true;
        form.insertAdjacentElement('afterend', box);
        return box;
    }

    searchForms.forEach(function (form) {
        var input = form.querySelector('input[type="search"]');
        if (!input) return;
        var resultsBox = ensureContainer(form);

        form.addEventListener('submit', function (e) {
            e.preventDefault();
            var query = (input.value || '').trim();
            if (!query) {
                resultsBox.hidden = true;
                resultsBox.innerHTML = '';
                return;
            }
            buildIndex().then(function (index) {
                var q = normalize(query);
                var matches = index.filter(function (record) {
                    return normalize(record.text).indexOf(q) !== -1;
                });
                renderResults(resultsBox, matches, query);
            });
        });

        input.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') {
                resultsBox.hidden = true;
                resultsBox.innerHTML = '';
            }
        });
    });
})();

// Text-to-speech for "Lyssna" top button
(function initTextToSpeech() {
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') return;

    var listenButtons = Array.from(document.querySelectorAll('.rk-toplink')).filter(function (btn) {
        return (btn.textContent || '').trim().toLowerCase().indexOf('lyssna') === 0;
    });
    if (!listenButtons.length) return;

    var synth = window.speechSynthesis;
    var currentUtterance = null;

    function setButtonsState(isReading) {
        listenButtons.forEach(function (btn) {
            btn.textContent = isReading ? 'Stoppa' : 'Lyssna';
            btn.setAttribute('aria-pressed', isReading ? 'true' : 'false');
            btn.classList.toggle('is-listening', isReading);
        });
    }

    function pickVoice() {
        var voices = synth.getVoices() || [];
        if (!voices.length) return null;
        return (
            voices.find(function (v) { return /^sv(-|_)/i.test(v.lang); }) ||
            voices.find(function (v) { return /^en(-|_)/i.test(v.lang); }) ||
            voices[0]
        );
    }

    function getReadableText() {
        var root = document.querySelector('#content') || document.body;
        if (!root) return '';
        var chunks = [];
        root.querySelectorAll('h1, h2, h3, p, li, dt, dd, blockquote').forEach(function (el) {
            var text = (el.textContent || '').replace(/\s+/g, ' ').trim();
            if (text.length > 1) chunks.push(text);
        });
        return chunks.join('. ');
    }

    function stopReading() {
        synth.cancel();
        currentUtterance = null;
        setButtonsState(false);
    }

    function startReading() {
        var text = getReadableText();
        if (!text) return;

        stopReading();

        var utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'sv-SE';
        utterance.rate = 1;
        utterance.pitch = 1;
        utterance.volume = 1;

        var voice = pickVoice();
        if (voice) utterance.voice = voice;

        utterance.onend = function () {
            currentUtterance = null;
            setButtonsState(false);
        };
        utterance.onerror = function () {
            currentUtterance = null;
            setButtonsState(false);
        };

        currentUtterance = utterance;
        setButtonsState(true);
        synth.speak(utterance);
    }

    listenButtons.forEach(function (btn) {
        btn.addEventListener('click', function () {
            if (synth.speaking || currentUtterance) {
                stopReading();
            } else {
                startReading();
            }
        });
    });

    // Some browsers load voice list asynchronously.
    if (typeof synth.onvoiceschanged !== 'undefined') {
        synth.onvoiceschanged = function () {};
    }

    window.addEventListener('beforeunload', function () {
        stopReading();
    });
})();
