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
