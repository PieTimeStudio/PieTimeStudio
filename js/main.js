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

/* ---------- The gold hoard: click it and a goblin pops up to take the coin back ---------- */
(() => {
  const footer = document.querySelector(".site-footer");
  if (!footer || !footer.animate) return;

  // Same heap outline as the coin tile in style.css (240 x 64 tile, repeated along the bottom)
  const heapTop = (x) => 26 - 7 * Math.sin(2 * Math.PI * x / 240 + 0.6)
                            - 4 * Math.sin(6 * Math.PI * x / 240 + 1.7)
                            - 2 * Math.sin(10 * Math.PI * x / 240);
  const small = window.matchMedia("(max-width: 780px)");
  const surfaceAt = (x) => {                      // px from the footer's bottom edge
    const tileW = small.matches ? 172 : 240, tileH = small.matches ? 46 : 64;
    const tx = ((x % tileW) + tileW) % tileW * 240 / tileW;
    return tileH - heapTop(tx) * tileH / 64;
  };

  const GOBLIN = `<svg viewBox="0 0 60 66" aria-hidden="true">
    <path d="M9 66c1-11 8-18 21-18s20 7 21 18z" fill="#4e3420" stroke="#1a0f08" stroke-width="1.2"/>
    <path d="M17 54l4 5 4-5 5 5 5-5 4 5 4-5" fill="none" stroke="#2e1d0f" stroke-width="1"/>
    <path d="M15 29C9 26 4 20 1 13c7 1 13 5 17 10z" fill="#6f9a42" stroke="#1f2e12" stroke-width="1.2"/>
    <path d="M45 29c6-3 11-9 14-16-7 1-13 5-17 10z" fill="#6f9a42" stroke="#1f2e12" stroke-width="1.2"/>
    <path d="M13 25c-3-2-6-5-8-9 4 1 8 4 10 7zM47 25c3-2 6-5 8-9-4 1-8 4-10 7z" fill="#a0694f" fill-opacity=".6"/>
    <ellipse cx="30" cy="31" rx="16.5" ry="16" fill="#6f9a42" stroke="#1f2e12" stroke-width="1.2"/>
    <ellipse cx="24" cy="22" rx="6" ry="3" fill="#8fb85c" fill-opacity=".45"/>
    <circle cx="41" cy="37" r="1.1" fill="#4c6e2c"/><circle cx="18" cy="39" r=".9" fill="#4c6e2c"/>
    <path d="M18 24l9 3M42 24l-9 3" stroke="#1f2e12" stroke-width="2" stroke-linecap="round"/>
    <ellipse cx="23.5" cy="29" rx="4" ry="3.2" fill="#f2d24a" stroke="#1f2e12" stroke-width=".7"/>
    <ellipse cx="36.5" cy="29" rx="4" ry="3.2" fill="#f2d24a" stroke="#1f2e12" stroke-width=".7"/>
    <g class="gob-pupils"><circle cx="23" cy="29.5" r="1.5" fill="#120a04"/><circle cx="36" cy="29.5" r="1.5" fill="#120a04"/></g>
    <path d="M30 29c2 3 4 6 3 9-1 1-4 1-5 0z" fill="#5c8434" stroke="#1f2e12" stroke-width=".8"/>
    <path d="M21 40c6 5 12 5 18 0-3 5-15 5-18 0z" fill="#2a1208" stroke="#1f2e12" stroke-width=".8"/>
    <path d="M24 41.3l1.3 2 1.2-1.6M34 41.3l-1.3 2-1.2-1.6" fill="#f3ece2"/>
    <g class="gob-hand"><path d="M7 52c-2-5-1-9 2-11" stroke="#6f9a42" stroke-width="5" stroke-linecap="round" fill="none"/>
      <circle cx="9.5" cy="40.5" r="3.4" fill="#6f9a42" stroke="#1f2e12" stroke-width="1"/></g>
  </svg>`;
  const COIN = `<svg viewBox="0 0 14 14" aria-hidden="true"><circle cx="7" cy="7" r="6" fill="#d4af37" stroke="#3a2a10" stroke-width="1"/><circle cx="7" cy="7" r="3.6" fill="none" stroke="#fff0b0" stroke-opacity=".5" stroke-width=".8"/></svg>`;
  const MOUND = `<svg viewBox="0 0 80 18" aria-hidden="true"><path d="M2 18c8-9 22-13 38-13s30 4 38 13z" fill="#6e5418"/>
    ${[[14,14],[24,10],[34,8],[46,8],[56,10],[66,14],[20,16],[40,13],[60,16],[30,15],[50,15]].map(([x,y]) =>
      `<ellipse cx="${x}" cy="${y}" rx="4.4" ry="2" fill="#c9a445" stroke="#3a2a10" stroke-width=".55"/>`).join("")}</svg>`;

  const hit = document.createElement("div");
  hit.className = "hoard-hit";
  hit.setAttribute("role", "button");
  hit.setAttribute("tabindex", "0");
  hit.setAttribute("aria-label", "Grab some gold from the hoard");
  footer.appendChild(hit);

  let busy = false;
  const spawn = (x) => {
    if (busy) return;
    busy = true;
    const w = footer.clientWidth;
    x = Math.max(120, Math.min(w - 120, x));
    const s = surfaceAt(x);

    const hole = document.createElement("div");
    hole.className = "goblin-hole";
    hole.style.left = x + "px";
    hole.style.bottom = (s - 4) + "px";
    hole.innerHTML = `<div class="goblin">${GOBLIN}</div><div class="hoard-coin">${COIN}</div>`;
    const mound = document.createElement("div");
    mound.className = "goblin-mound";
    mound.style.left = x + "px";
    mound.style.bottom = (s - 12) + "px";
    mound.innerHTML = MOUND;
    footer.append(hole, mound);

    const T = 2600, ease = "cubic-bezier(.3,.7,.3,1)";
    const gob = hole.querySelector(".goblin"), coin = hole.querySelector(".hoard-coin");
    const pupils = hole.querySelector(".gob-pupils"), hand = hole.querySelector(".gob-hand");

    // you grab a coin: it jumps out of the pile...
    coin.animate([
      { transform: "translate(-7px, 10px) rotate(0)", opacity: 0, offset: 0 },
      { transform: "translate(-7px, -46px) rotate(200deg)", opacity: 1, offset: .14 },
      { transform: "translate(-7px, -38px) rotate(360deg)", opacity: 1, offset: .24 },
      { transform: "translate(-7px, -42px) rotate(380deg)", opacity: 1, offset: .46 },
      { transform: "translate(-24px, -15px) rotate(400deg)", opacity: 1, offset: .55 },   // snatched
      { transform: "translate(-23px, -16px) rotate(400deg)", opacity: 1, offset: .66 },
      { transform: "translate(-23px, -16px) rotate(400deg)", opacity: 1, offset: .74 },
      { transform: "translate(-23px, 45px) rotate(400deg)", opacity: 1, offset: 1 }        // taken below
    ], { duration: T, easing: ease, fill: "forwards" });

    // ...a goblin peeks out, eyes it, pops up, snatches it and dives back in
    gob.animate([
      { transform: "translateY(100%)", offset: 0 },
      { transform: "translateY(100%)", offset: .16 },
      { transform: "translateY(52%)", offset: .28 },                // just the eyes and ears
      { transform: "translateY(55%) rotate(-3deg)", offset: .38 },
      { transform: "translateY(52%) rotate(3deg)", offset: .46 },
      { transform: "translateY(12%) rotate(-4deg)", offset: .55 },   // lunge
      { transform: "translateY(14%) rotate(2deg)", offset: .66 },
      { transform: "translateY(14%) rotate(-2deg)", offset: .74 },   // smug look
      { transform: "translateY(105%)", offset: 1 }
    ], { duration: T, easing: ease, fill: "forwards" });
    pupils.animate([
      { transform: "translate(0,0)" }, { transform: "translate(0,0)", offset: .28 },
      { transform: "translate(-1.2px,-1.4px)", offset: .34 }, { transform: "translate(1px,-1.4px)", offset: .42 },
      { transform: "translate(-1.2px,-.8px)", offset: .5 }, { transform: "translate(1.4px,.4px)", offset: .68 },
      { transform: "translate(1.4px,.4px)" }
    ], { duration: T, fill: "forwards" });
    hand.animate([
      { transform: "translate(0,0)" }, { transform: "translate(0,0)", offset: .5 },
      { transform: "translate(-3px,-5px)", offset: .56 }, { transform: "translate(0,0)", offset: .66 },
      { transform: "translate(0,0)" }
    ], { duration: T, fill: "forwards" });
    mound.animate([
      { opacity: 0, transform: "translateX(-50%) scaleY(.4)" },
      { opacity: 1, transform: "translateX(-50%) scaleY(1)", offset: .2 },
      { opacity: 1, transform: "translateX(-50%) scaleY(1)", offset: .9 },
      { opacity: 0, transform: "translateX(-50%) scaleY(.4)" }
    ], { duration: T + 300, fill: "forwards" }).finished.then(() => {
      hole.remove(); mound.remove(); busy = false;
    });
  };

  hit.addEventListener("click", (e) => spawn(e.clientX - footer.getBoundingClientRect().left));
  hit.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); spawn(footer.clientWidth * (.3 + Math.random() * .4)); }
  });
})();
