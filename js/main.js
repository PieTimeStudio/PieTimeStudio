// Pie Time Studio — shared site behavior

document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.querySelector(".nav-toggle");
  const links = document.querySelector(".nav-links");

  if (toggle && links) {
    toggle.addEventListener("click", () => {
      const isOpen = links.classList.toggle("open");
      toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });

    links.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => links.classList.remove("open"));
    });
  }

  // Mark the current page's nav link as active
  const current = window.location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav-links a").forEach((link) => {
    const href = link.getAttribute("href");
    if (href === current) {
      link.classList.add("active");
    }
  });

  // Featured games scroller: left/right arrows that hide at each end
  document.querySelectorAll(".games-scroll-wrap").forEach((wrap) => {
    const track = wrap.querySelector(".games-scroll");
    const prev = wrap.querySelector(".scroll-arrow-left");
    const next = wrap.querySelector(".scroll-arrow-right");
    if (!track || !prev || !next) return;

    const update = () => {
      const max = track.scrollWidth - track.clientWidth;
      prev.classList.toggle("is-hidden", track.scrollLeft <= 6);
      next.classList.toggle("is-hidden", track.scrollLeft >= max - 6);
    };

    // Scroll by as many whole cards as fit in view
    const step = () => {
      const card = track.querySelector(".mini-game-card");
      if (!card) return track.clientWidth * 0.8;
      const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      const cardWidth = card.getBoundingClientRect().width + gap;
      return Math.max(1, Math.floor(track.clientWidth / cardWidth)) * cardWidth;
    };

    prev.addEventListener("click", () => track.scrollBy({ left: -step(), behavior: "smooth" }));
    next.addEventListener("click", () => track.scrollBy({ left: step(), behavior: "smooth" }));
    track.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
  });

  // Set copyright year
  const yearEl = document.querySelector("[data-year]");
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }
});

// ---------- Clickable game cards ----------
// Cards with data-href open that link when clicked, except clicks on the
// bean patch (jar + plant button) or the end of a bean drag.
(function () {
  let downX = 0, downY = 0;
  document.addEventListener("pointerdown", (e) => { downX = e.clientX; downY = e.clientY; });

  function openCard(card) {
    const url = card.dataset.href;
    window.open(url, "_blank", "noopener"); // always a new tab
  }

  document.addEventListener("click", (e) => {
    const card = e.target.closest(".game-card[data-href]");
    if (!card || e.target.closest(".bean-patch, .seed-plot, a, button")) return;
    if (Math.abs(e.clientX - downX) > 6 || Math.abs(e.clientY - downY) > 6) return; // was a drag
    openCard(card);
  });

  document.addEventListener("auxclick", (e) => {
    const card = e.target.closest(".game-card[data-href]");
    if (card && e.button === 1 && !e.target.closest(".bean-patch, .seed-plot")) openCard(card);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const card = e.target.closest && e.target.closest(".game-card[data-href]");
    if (card && e.target === card) openCard(card);
  });
})();

// ---------- Page transitions: slide left/right ----------
// Pages are in a row: Home → Our Mission → Games → Support Us → Contact.
// Browsers with cross-page View Transitions do the slide in CSS (style.css).
// Otherwise: slide this page out, then open the next one (which slides in).
(function () {
  const ORDER = ["index", "about", "games", "support", "contact"];
  const pageIndex = (path) => {
    const name = (path.split("/").pop() || "index.html").replace(/\.html?$/, "");
    const i = ORDER.indexOf(name);
    return i < 0 ? 0 : i;
  };

  const usesViewTransitions = document.documentElement.classList.contains("vt");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (usesViewTransitions || reduceMotion) return;

  const LEAVING = ["leaving-fwd", "leaving-back", "leaving-fade"];

  document.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const link = e.target.closest("a[href]");
    if (!link || (link.target && link.target !== "_self") || link.hasAttribute("download")) return;
    const href = link.getAttribute("href");
    if (!href || href.startsWith("#") || /^(mailto|tel|javascript):/i.test(href)) return;
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin && location.protocol !== "file:") return;   // external site
    if (!/\.html?$|\/$/.test(url.pathname)) return;                               // only our pages
    if (url.pathname === location.pathname) return;                               // same page

    const from = pageIndex(location.pathname), to = pageIndex(url.pathname);
    e.preventDefault();
    document.body.classList.add(to > from ? "leaving-fwd" : to < from ? "leaving-back" : "leaving-fade");
    setTimeout(() => { location.href = link.href; }, 190);
  });

  // Coming back with the browser's Back button can restore the slid-out page; undo that.
  window.addEventListener("pageshow", (e) => {
    if (e.persisted) document.body.classList.remove(...LEAVING);
  });
})();
