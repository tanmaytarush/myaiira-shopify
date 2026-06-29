(function () {
  var GAP = 24;
  var SPEED_PX_S = 44;
  var INTERACTION_PAUSE_MS = 3500;
  var SNAP_MS = 650;

  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }

  function qsa(sel, root) {
    return Array.from((root || document).querySelectorAll(sel));
  }

  function initTrendsCarousel(viewport) {
    if (viewport.hasAttribute("data-aiira-carousel-ready")) return;
    viewport.setAttribute("data-aiira-carousel-ready", "");

    var track = qs("[data-aiira-trends-marquee]", viewport);
    if (!track) return;

    var section = viewport.closest(".aiira-trends");
    var prev = section && qs("[data-aiira-carousel-prev]", section);
    var next = section && qs("[data-aiira-carousel-next]", section);
    var cards = qsa(".aiira-look-card:not(.aiira-look-card--clone)", track);

    if (!cards.length) return;

    cards.forEach(function (card) {
      var clone = card.cloneNode(true);
      clone.setAttribute("aria-hidden", "true");
      clone.classList.add("aiira-look-card--clone");
      track.appendChild(clone);
    });

    viewport.scrollLeft = 0;

    var offset = 0;
    var paused = false;
    var hoverPaused = false;
    var interactionPaused = false;
    var snapping = false;
    var visible = true;
    var resumeTimer = null;
    var lastTs = 0;
    var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function syncPaused() {
      paused = hoverPaused || interactionPaused;
    }

    function getGap() {
      var gap = parseFloat(getComputedStyle(track).gap);
      return isNaN(gap) ? GAP : gap;
    }

    function getStep() {
      return cards[0].offsetWidth + getGap();
    }

    function loopWidth() {
      return track.scrollWidth / 2;
    }

    function wrapOffset() {
      var loop = loopWidth();
      if (loop <= 0) return;
      while (offset <= -loop) offset += loop;
      while (offset > 0) offset -= loop;
    }

    function applyTransform() {
      track.style.transform = "translate3d(" + offset + "px, 0, 0)";
    }

    function pauseAuto(ms) {
      interactionPaused = true;
      syncPaused();
      window.clearTimeout(resumeTimer);
      resumeTimer = window.setTimeout(function () {
        interactionPaused = false;
        resumeTimer = null;
        syncPaused();
      }, ms || INTERACTION_PAUSE_MS);
    }

    function nudge(dir) {
      var step = getStep();
      if (!step || snapping) return;
      pauseAuto(INTERACTION_PAUSE_MS);
      snapping = true;
      track.classList.add("is-snapping");
      offset += dir * step;
      wrapOffset();
      applyTransform();
      window.setTimeout(function () {
        track.classList.remove("is-snapping");
        snapping = false;
      }, SNAP_MS);
    }

    function tick(ts) {
      if (!lastTs) lastTs = ts;
      var delta = Math.min(ts - lastTs, 48);
      lastTs = ts;

      if (!paused && visible && !reducedMotion && !snapping) {
        offset -= (SPEED_PX_S * delta) / 1000;
        wrapOffset();
        applyTransform();
      }

      requestAnimationFrame(tick);
    }

    if (prev) {
      prev.addEventListener("click", function () {
        nudge(1);
      });
    }
    if (next) {
      next.addEventListener("click", function () {
        nudge(-1);
      });
    }

    if (section) {
      section.addEventListener("mouseenter", function () {
        hoverPaused = true;
        syncPaused();
      });
      section.addEventListener("mouseleave", function () {
        hoverPaused = false;
        syncPaused();
      });
      section.addEventListener("focusin", function () {
        hoverPaused = true;
        syncPaused();
      });
      section.addEventListener("focusout", function (e) {
        if (!section.contains(e.relatedTarget)) {
          hoverPaused = false;
          syncPaused();
        }
      });
    }

    viewport.addEventListener(
      "wheel",
      function (e) {
        if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
        e.preventDefault();
        pauseAuto(INTERACTION_PAUSE_MS);
        offset -= e.deltaY;
        wrapOffset();
        applyTransform();
      },
      { passive: false },
    );

    if ("IntersectionObserver" in window) {
      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            visible = entry.isIntersecting;
          });
        },
        { threshold: 0.1 },
      );
      observer.observe(viewport);
    }

    applyTransform();
    requestAnimationFrame(tick);

    window.addEventListener("resize", function () {
      window.clearTimeout(resumeTimer);
      resumeTimer = null;
      interactionPaused = false;
      wrapOffset();
      applyTransform();
      syncPaused();
    });
  }

  function openAnyVto() {
    var trigger =
      qs("[data-aiira-vto-default]") ||
      qs(".aiira-look-card:not(.aiira-look-card--clone) [data-aiira-open-vto]") ||
      qs("[data-aiira-open-vto]");
    if (trigger) {
      trigger.click();
      return true;
    }
    if (window.__AIIRA_VTO__ && typeof window.__AIIRA_VTO__.openFromElement === "function") {
      var fallback = qs("[data-aiira-open-vto]");
      if (fallback) {
        window.__AIIRA_VTO__.openFromElement(fallback);
        return true;
      }
    }
    return false;
  }

  function handleTryOnHash() {
    if (window.location.hash !== "#try-on") return;
    if (openAnyVto()) return;
    var attempts = 0;
    var timer = window.setInterval(function () {
      attempts += 1;
      if (openAnyVto() || attempts >= 50) window.clearInterval(timer);
    }, 120);
  }

  function interceptLegacyVtoLinks() {
    document.addEventListener(
      "click",
      function (e) {
        var link = e.target.closest(
          ".aiira-landing a.aiira-btn, .aiira-bespoke a.aiira-btn, .aiira-look-card a.aiira-btn",
        );
        if (!link) return;
        if (link.hasAttribute("data-aiira-open-vto")) return;
        var href = link.getAttribute("href") || "";
        if (
          href.indexOf("/products/") === -1 &&
          href.indexOf("/collections/") === -1 &&
          href.indexOf("#try-on") === -1
        ) {
          return;
        }
        e.preventDefault();
        if (window.history && window.history.replaceState) {
          window.history.replaceState(null, "", window.location.pathname + "#try-on");
        }
        if (!openAnyVto()) handleTryOnHash();
      },
      true,
    );
  }

  function initNavVtoLinks() {
    qsa("[data-aiira-nav-vto]").forEach(function (link) {
      link.addEventListener("click", function (e) {
        e.preventDefault();
        if (window.history && window.history.replaceState) {
          window.history.replaceState(null, "", window.location.pathname + "#try-on");
        }
        if (!openAnyVto()) handleTryOnHash();
      });
    });
  }

  function initScrollTargets() {
    qsa("[data-aiira-scroll-target]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var target = btn.getAttribute("data-aiira-scroll-target");
        if (!target) return;
        var el = qs(target);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  function boot() {
    qsa("[data-aiira-trends-viewport]").forEach(initTrendsCarousel);
    initScrollTargets();
    interceptLegacyVtoLinks();
    initNavVtoLinks();
    handleTryOnHash();
    window.addEventListener("hashchange", handleTryOnHash);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
