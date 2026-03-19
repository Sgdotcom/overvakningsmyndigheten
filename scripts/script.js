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
