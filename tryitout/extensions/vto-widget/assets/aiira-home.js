(function () {
  var GAP = 24;
  var SPEED_PX_S = 28;

  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }

  function qsa(sel, root) {
    return Array.from((root || document).querySelectorAll(sel));
  }

  function initTrendsMarquee(viewport) {
    var marquee = qs("[data-aiira-trends-marquee]", viewport);
    if (!marquee) return;

    var section = viewport.closest(".aiira-trends, .aiira-section");
    var prev = section && qs("[data-aiira-carousel-prev]", section);
    var next = section && qs("[data-aiira-carousel-next]", section);
    var cards = qsa(".aiira-look-card:not(.aiira-look-card--clone)", marquee);

    if (!cards.length) return;

    cards.forEach(function (card) {
      var clone = card.cloneNode(true);
      clone.setAttribute("aria-hidden", "true");
      clone.classList.add("aiira-look-card--clone");
      marquee.appendChild(clone);
    });

    var offset = 0;
    var paused = false;
    var visible = true;
    var rafId = null;
    var lastTs = 0;
    var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function loopWidth() {
      return marquee.scrollWidth / 2;
    }

    function getStep() {
      var card = marquee.querySelector(".aiira-look-card");
      return card ? card.offsetWidth + GAP : 0;
    }

    function wrapOffset() {
      var loop = loopWidth();
      if (loop <= 0) return;
      while (offset <= -loop) offset += loop;
      while (offset > 0) offset -= loop;
    }

    function applyTransform() {
      marquee.style.transform = "translate3d(" + offset + "px, 0, 0)";
    }

    function tick(ts) {
      if (!lastTs) lastTs = ts;
      var delta = Math.min(ts - lastTs, 48);
      lastTs = ts;

      if (!paused && visible && !reducedMotion) {
        offset -= (SPEED_PX_S * delta) / 1000;
        wrapOffset();
        applyTransform();
      }

      rafId = requestAnimationFrame(tick);
    }

    function nudge(dir) {
      var step = getStep();
      if (!step) return;
      offset += dir * step;
      wrapOffset();
      applyTransform();
    }

    viewport.addEventListener("mouseenter", function () {
      paused = true;
    });
    viewport.addEventListener("mouseleave", function () {
      paused = false;
    });
    viewport.addEventListener("focusin", function () {
      paused = true;
    });
    viewport.addEventListener("focusout", function (e) {
      if (!viewport.contains(e.relatedTarget)) paused = false;
    });

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

    viewport.addEventListener(
      "wheel",
      function (e) {
        if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
        e.preventDefault();
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
    rafId = requestAnimationFrame(tick);

    window.addEventListener("resize", function () {
      wrapOffset();
      applyTransform();
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
    qsa("[data-aiira-trends-viewport]").forEach(initTrendsMarquee);
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
