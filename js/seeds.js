// Pie Time Studio — The Seed Bag
// A "like" system for the games page. Every visitor gets a bag with as many
// seeds as there are games, and can split them between games however they like. Each game shows how many seeds have been
// planted on it, and vines grow around its border as the count rises.
//
// ------------------------------------------------------------------------
// DEMO MODE: counts are saved in this visitor's own browser only.
// To count seeds from everyone, provide a shared store before this script:
//
//   window.PTS_SEED_STORE = {
//     load:   () => Promise<{ [gameId]: number }>,   // all counts
//     change: (gameId, delta) => Promise<number>,    // +1 / -1, returns new count
//   };
//
// Nothing else in this file needs to change.
//
// Tip: add ?preview to the page URL to see made-up counts and full vine growth.
// ------------------------------------------------------------------------

(function () {
  const VINE_FULL_AT = 25;        // seeds needed for the vines to fully wrap a card
  const FLOWERS_AT = 10;          // seeds needed before flowers start to bloom
  const BAG_KEY = "pts_seed_bag_v2";
  const COUNTS_KEY = "pts_seed_counts_demo_v2";
  const DRAG_THRESHOLD = 6;
  const PREVIEW = /[?&]preview\b/.test(location.search);
  const SVGNS = "http://www.w3.org/2000/svg";

  // ---------- storage ----------

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* private mode etc. */ }
    return fallback;
  }
  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* best effort */ }
  }

  // Demo store: counts live in this browser only.
  const DemoStore = {
    load() { return Promise.resolve(readJSON(COUNTS_KEY, {})); },
    change(game, delta) {
      const counts = readJSON(COUNTS_KEY, {});
      counts[game] = Math.max(0, (counts[game] || 0) + delta);
      writeJSON(COUNTS_KEY, counts);
      return Promise.resolve(counts[game]);
    },
  };

  // Preview store: made-up counts so the vine stages can be seen. Never saved.
  const previewCounts = { "the-right-way": 27, "dodo-doku": 12, "cubeish": 5, "ant-farm": 1, "untitled-project": 0 };
  const PreviewStore = {
    load() { return Promise.resolve(Object.assign({}, previewCounts)); },
    change(game, delta) {
      previewCounts[game] = Math.max(0, (previewCounts[game] || 0) + delta);
      return Promise.resolve(previewCounts[game]);
    },
  };

  const store = PREVIEW ? PreviewStore : (window.PTS_SEED_STORE || DemoStore);

  // Seed artwork: a plump golden seed with a little sprout. Each copy gets its own gradient ids.
  let seedUid = 0;
  function seedSVG() {
    const u = "sd" + (++seedUid);
    return '<svg viewBox="0 0 24 30" aria-hidden="true">' +
      '<defs>' +
        '<radialGradient id="' + u + 'b" cx=".36" cy=".32" r=".85">' +
          '<stop offset="0" stop-color="#ffe7b0"/><stop offset=".45" stop-color="#e2a95e"/><stop offset="1" stop-color="#7a4a1a"/>' +
        '</radialGradient>' +
      '</defs>' +
      // sprout
      '<path d="M12 9.5C12 7 12.6 5 14 3.6" stroke="#4f8f68" stroke-width="1.4" fill="none" stroke-linecap="round"/>' +
      '<path d="M13.4 4.6C13.6 2.2 15.6 1 18.4 1.2 18.2 3.8 16.2 5 13.4 4.6z" fill="#8fd1ab" stroke="#4f8f68" stroke-width=".6"/>' +
      '<path d="M12.6 6.6C11.2 4.8 9 4.4 7 5.4 8.2 7.2 10.4 7.6 12.6 6.6z" fill="#6fb98f" stroke="#4f8f68" stroke-width=".6"/>' +
      // seed body
      '<path d="M12 8.5C17.6 11 19.6 17 18.4 22 17.3 26.4 14.8 28.6 12 28.6S6.7 26.4 5.6 22C4.4 17 6.4 11 12 8.5Z" fill="url(#' + u + 'b)" stroke="#5a3514" stroke-width="1"/>' +
      // seam + stripes
      '<path d="M12 10.5C10.4 15 10.4 22 12 27" stroke="#6b4420" stroke-opacity=".55" stroke-width=".9" fill="none" stroke-linecap="round"/>' +
      '<path d="M8.4 15.5C7.8 18 8 21.5 9 24.2M15.6 15.5C16.2 18 16 21.5 15 24.2" stroke="#fff1cf" stroke-opacity=".35" stroke-width=".8" fill="none" stroke-linecap="round"/>' +
      // glint
      '<path d="M8.2 13.6C8.8 12.3 9.8 11.4 11 10.8" stroke="#fff8e6" stroke-opacity=".9" stroke-width="1.2" fill="none" stroke-linecap="round"/>' +
      '<circle cx="8.3" cy="16" r=".7" fill="#fff8e6" fill-opacity=".8"/>' +
      "</svg>";
  }

  // ---------- init ----------

  function init() {
    const plots = Array.from(document.querySelectorAll(".seed-plot"));
    const bagEl = document.getElementById("seedBag");
    const bagCountEl = document.getElementById("seedBagCount");
    const barEl = document.querySelector(".seed-bag-bar");
    if (!plots.length || !bagEl) return;

    const cards = plots.map((p) => p.closest(".game-card"));
    const games = plots.map((p) => p.dataset.game);
    const TOTAL_SEEDS = games.length;            // as many seeds as there are games

    // Visitor's bag: how many seeds they've planted on each game
    const saved = readJSON(BAG_KEY, null);
    const bag = { planted: {} };
    if (saved && saved.planted && !PREVIEW) {
      let left = TOTAL_SEEDS;
      games.forEach((g) => {
        const n = Math.min(Math.max(0, Math.floor(saved.planted[g] || 0)), left);
        if (n > 0) { bag.planted[g] = n; left -= n; }
      });
    }
    const plantedCount = () => games.reduce((sum, g) => sum + (bag.planted[g] || 0), 0);
    const remaining = () => TOTAL_SEEDS - plantedCount();
    const saveBag = () => { if (!PREVIEW) writeJSON(BAG_KEY, { planted: bag.planted }); };

    let counts = {};
    let dragInfo = null, dragGhost = null, hoverTarget = null;
    let holding = false; // tap-mode: a seed has been taken from the bag, waiting for a game to be tapped

    // ---------- vines ----------

    const vines = new Map(); // card -> { svg, stems:[], leaves:[], flowers:[] }

    function buildVines(card) {
      const old = vines.get(card);
      if (old) old.svg.remove();

      const w = card.clientWidth, h = card.clientHeight;
      if (!w || !h) return;
      const svg = document.createElementNS(SVGNS, "svg");
      svg.setAttribute("class", "vine-layer");
      svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
      svg.setAttribute("aria-hidden", "true");

      const inset = 7, r = 16;
      const rec = { svg, stems: [], leaves: [], flowers: [], curls: [], thorns: [] };

      [1, -1].forEach((dir) => {
        // Route: up the side from the bottom corner, round the top corner, to the top middle.
        const x0 = dir === 1 ? inset : w - inset;
        const route = [];
        for (let y = h - inset; y > inset + r; y -= 4) route.push([x0, y]);
        for (let a = 0; a <= 90; a += 10) {
          const rad = (a * Math.PI) / 180;
          route.push([x0 + dir * (r - r * Math.cos(rad)), inset + r - r * Math.sin(rad)]);
        }
        for (let x = x0 + dir * r; dir === 1 ? x <= w / 2 : x >= w / 2; x += dir * 4) route.push([x, inset]);

        // Add a gentle wiggle, perpendicular to the direction of travel.
        const pts = route.map((p, i) => {
          const q = route[Math.min(i + 1, route.length - 1)], o = route[Math.max(i - 1, 0)];
          const tx = q[0] - o[0], ty = q[1] - o[1], len = Math.hypot(tx, ty) || 1;
          const wig = Math.sin(i * 0.42 + (dir === 1 ? 0 : 1.7)) * 2.6;
          return [p[0] + (-ty / len) * wig, p[1] + (tx / len) * wig];
        });
        const toD = (arr) => "M" + arr.map((p) => p[0].toFixed(1) + " " + p[1].toFixed(1)).join("L");
        const d = toD(pts);

        // A thinner second strand that twists around the main stem
        const pts2 = route.map((p, i) => {
          const q = route[Math.min(i + 1, route.length - 1)], o = route[Math.max(i - 1, 0)];
          const tx = q[0] - o[0], ty = q[1] - o[1], len = Math.hypot(tx, ty) || 1;
          const wig = Math.sin(i * 0.3 + (dir === 1 ? Math.PI : 0.6)) * 4.6;
          return [p[0] + (-ty / len) * wig, p[1] + (tx / len) * wig];
        });

        const addStem = (dd, cls) => {
          const el = document.createElementNS(SVGNS, "path");
          el.setAttribute("d", dd);
          el.setAttribute("class", cls);
          svg.appendChild(el);
          const len = el.getTotalLength();
          el.style.strokeDasharray = len;
          el.style.strokeDashoffset = len;
          rec.stems.push({ el, L: len });
          return el;
        };
        addStem(toD(pts2), "vine-strand");
        addStem(d, "vine-stem-outline");
        const stem = addStem(d, "vine-stem");
        addStem(d, "vine-stem-shine");
        const L = stem.getTotalLength();

        const angleAt = (s) => {
          const a = stem.getPointAtLength(Math.max(0, s - 2)), b = stem.getPointAtLength(Math.min(L, s + 2));
          return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
        };

        // Thorns: sharp spikes along the stem, alternating sides, leaning in the direction of growth
        let tside = 1;
        for (let s = 8; s < L - 3; s += 9 + ((s * 7) % 5)) {
          const p = stem.getPointAtLength(s), ang = angleAt(s);
          const g = document.createElementNS(SVGNS, "g");
          g.setAttribute("transform", `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${ang.toFixed(1)}) scale(1 ${tside})`);
          const big = ((s | 0) % 3) === 0;
          const th = document.createElementNS(SVGNS, "path");
          th.setAttribute("d", big ? "M-3.4 -2Q0 -3 4.8 -13Q1.8 -4 3.8 -2Z" : "M-2.8 -2Q0 -2.8 3.8 -9.5Q1.5 -3.4 3.2 -2Z");
          th.setAttribute("class", "vine-thorn");
          g.appendChild(th);
          svg.appendChild(g);
          rec.thorns.push({ el: th, t: s / L });
          tside = -tside;
        }

        // Leaves every ~20px, alternating sides
        let side = 1;
        for (let s = 14; s < L - 4; s += 22) {
          const p = stem.getPointAtLength(s), ang = angleAt(s) + side * 55;
          const g = document.createElementNS(SVGNS, "g");
          g.setAttribute("transform", `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${ang.toFixed(1)})`);
          const big = (Math.round(s / 20) % 3 === 0);
          const leaf = document.createElementNS(SVGNS, "path");
          leaf.setAttribute("d", big ? "M0 0C3.5 -6 11 -6.5 16 0 11 6.5 3.5 6 0 0Z" : "M0 0C3 -5 8.5 -5 12 0 8.5 5 3 5 0 0Z");
          leaf.setAttribute("class", "vine-leaf" + (side === 1 ? "" : " vine-leaf-alt"));
          g.appendChild(leaf);
          svg.appendChild(g);
          rec.leaves.push({ el: leaf, t: s / L });
          side = -side;
        }

        // Little curling tendrils
        for (let s = 45; s < L - 10; s += 70) {
          const p = stem.getPointAtLength(s), ang = angleAt(s) - 70 * dir;
          const c = document.createElementNS(SVGNS, "path");
          c.setAttribute("d", "M0 0c5 -1 8 3 5 6 -2 2 -5 0 -3 -2");
          c.setAttribute("class", "vine-curl");
          c.setAttribute("transform", `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${ang.toFixed(1)})`);
          svg.appendChild(c);
          rec.curls.push({ el: c, t: s / L });
        }

        // Flowers at a few spots along each vine
        [0.22, 0.48, 0.74, 0.97].forEach((t, k) => {
          const p = stem.getPointAtLength(t * L);
          const g = document.createElementNS(SVGNS, "g");
          g.setAttribute("transform", `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
          const f = document.createElementNS(SVGNS, "g");
          f.setAttribute("class", "vine-flower" + (k % 2 ? " vine-flower-alt" : ""));
          for (let i = 0; i < 5; i++) {
            const petal = document.createElementNS(SVGNS, "ellipse");
            petal.setAttribute("cx", "0"); petal.setAttribute("cy", "-3.6");
            petal.setAttribute("rx", "2.4"); petal.setAttribute("ry", "3.4");
            petal.setAttribute("transform", `rotate(${i * 72})`);
            petal.setAttribute("class", "petal");
            f.appendChild(petal);
          }
          const mid = document.createElementNS(SVGNS, "circle");
          mid.setAttribute("r", "1.9"); mid.setAttribute("class", "flower-mid");
          f.appendChild(mid);
          g.appendChild(f);
          svg.appendChild(g);
          rec.flowers.push({ el: f, t });
        });
      });

      card.appendChild(svg);
      vines.set(card, rec);
      applyGrowth(card, true);
    }

    function growthFor(count) {
      if (count <= 0) return 0;
      return Math.min(1, Math.sqrt(count / VINE_FULL_AT)); // early seeds show a lot, later ones fill in
    }

    function applyGrowth(card, instant) {
      const rec = vines.get(card);
      if (!rec) return;
      const count = counts[card.dataset.game] || 0;
      const f = growthFor(count);
      rec.svg.classList.toggle("vine-instant", !!instant);
      rec.stems.forEach((s) => { s.el.style.strokeDashoffset = s.L * (1 - f); });
      rec.leaves.forEach((l) => l.el.classList.toggle("on", f > 0 && l.t <= f));
      rec.curls.forEach((c) => c.el.classList.toggle("on", f > 0 && c.t <= f));
      rec.thorns.forEach((t) => t.el.classList.toggle("on", f > 0 && t.t <= f));
      rec.flowers.forEach((fl) => fl.el.classList.toggle("on", count >= FLOWERS_AT && fl.t <= f));
      if (instant) requestAnimationFrame(() => rec.svg.classList.remove("vine-instant"));
    }

    const ro = "ResizeObserver" in window ? new ResizeObserver((entries) => {
      entries.forEach((e) => {
        const card = e.target;
        const rec = vines.get(card);
        const w = card.clientWidth, h = card.clientHeight;
        if (!rec || rec.w !== w || rec.h !== h) { buildVines(card); const r2 = vines.get(card); if (r2) { r2.w = w; r2.h = h; } }
      });
    }) : null;

    // ---------- rendering ----------

    function makeSeed(game) {
      const el = document.createElement("span");
      el.className = "seed-token";
      el.innerHTML = seedSVG();
      el.dataset.source = "plot";
      el.dataset.game = game;
      el.setAttribute("role", "button");
      el.setAttribute("tabindex", "0");
      el.setAttribute("aria-label", "Your seed — tap to dig it back up, or drag it to another game");
      el.addEventListener("pointerdown", onPointerDown);
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); unplant(game); }
      });
      return el;
    }

    function renderPlot(plot) {
      const game = plot.dataset.game;
      const count = counts[game] || 0;

      const num = plot.querySelector(".seed-count-num");
      if (num && num.textContent !== String(count)) {
        num.textContent = count;
        num.classList.remove("pop"); void num.offsetWidth; num.classList.add("pop");
      }
      const label = plot.querySelector(".seed-count-label");
      if (label) label.textContent = count === 1 ? "seed planted" : "seeds planted";

      const my = plot.querySelector(".my-seeds");
      if (my) {
        my.innerHTML = "";
        const mine = bag.planted[game] || 0;
        if (mine) {
          for (let i = 0; i < mine; i++) my.appendChild(makeSeed(game));
          const tag = document.createElement("span");
          tag.className = "my-seed-label";
          tag.textContent = "yours";
          my.appendChild(tag);
        }
      }
      plot.closest(".game-card").classList.toggle("has-my-seed", !!bag.planted[game]);
    }

    function renderBag() {
      const left = remaining();
      if (bagCountEl) bagCountEl.textContent = left;
      bagEl.classList.toggle("seed-bag-empty", left === 0);
      bagEl.classList.toggle("seed-bag-holding", holding);
      bagEl.setAttribute("aria-label", left
        ? `Seed bag, ${left} seed${left === 1 ? "" : "s"} left. Drag a seed onto a game, or tap the bag then tap a game.`
        : "Seed bag, empty");
      document.body.classList.toggle("seed-holding", holding);
    }

    function setNote(text) {
      const note = document.getElementById("seedBagNote");
      if (note) note.textContent = text;
    }

    function renderNote() {
      if (dragInfo) return;
      if (holding) { setNote("Now tap a game to plant your seed. Tap the bag again to put it back."); return; }
      if (PREVIEW) { setNote("Preview mode: these counts are made up, to show how the vines grow."); return; }
      setNote(remaining() <= 0
        ? "Your bag is empty! Tap one of your planted seeds to dig it back up and replant it."
        : "Grab seeds from the bag and drop them on the games you like — spread them out or pile them on a favourite. The more seeds a game gets, the more its vines grow.");
    }

    function renderLeader() {
      let best = null, bestCount = 0;
      cards.forEach((c) => {
        const n = counts[c.dataset.game] || 0;
        if (n > bestCount) { best = c; bestCount = n; }
      });
      const tied = cards.filter((c) => (counts[c.dataset.game] || 0) === bestCount).length > 1;
      cards.forEach((c) => c.classList.toggle("most-loved", !tied && c === best));
    }

    function renderAll() {
      plots.forEach(renderPlot);
      renderBag();
      renderNote();
      renderLeader();
      cards.forEach((c) => applyGrowth(c, false));
    }

    // ---------- actions ----------

    function changeCount(game, delta) {
      counts[game] = Math.max(0, (counts[game] || 0) + delta); // optimistic
      store.change(game, delta).then((n) => {
        if (typeof n === "number" && n !== counts[game]) { counts[game] = n; renderAll(); }
      }).catch(() => {});
    }

    function cardFor(game) { return cards.find((c) => c.dataset.game === game); }

    function plant(game) {
      if (remaining() <= 0) return false;
      bag.planted[game] = (bag.planted[game] || 0) + 1;
      saveBag();
      changeCount(game, +1);
      renderAll();
      sprout(game);
      return true;
    }

    function unplant(game) {
      if (!bag.planted[game]) return false;
      bag.planted[game] -= 1;
      if (!bag.planted[game]) delete bag.planted[game];
      saveBag();
      changeCount(game, -1);
      renderAll();
      return true;
    }

    function move(from, to) {
      if (from === to || !bag.planted[from]) return false;
      bag.planted[from] -= 1;
      if (!bag.planted[from]) delete bag.planted[from];
      bag.planted[to] = (bag.planted[to] || 0) + 1;
      saveBag();
      changeCount(from, -1);
      changeCount(to, +1);
      renderAll();
      sprout(to);
      return true;
    }

    function sprout(game) {
      const card = cardFor(game);
      if (!card) return;
      card.classList.remove("seed-landed"); void card.offsetWidth; card.classList.add("seed-landed");
    }

    const resetBtn = document.getElementById("seedResetBtn");
    if (resetBtn) resetBtn.addEventListener("click", () => {
      Object.keys(bag.planted).forEach((g) => changeCount(g, -bag.planted[g]));
      bag.planted = {};
      holding = false;
      saveBag();
      renderAll();
    });

    // ---------- tap mode: tap the bag, then tap a game ----------

    function toggleHolding(on) {
      holding = on && remaining() > 0;
      renderBag();
      renderNote();
    }

    bagEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleHolding(!holding); }
    });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && holding) toggleHolding(false); });

    // Capture phase, so a tap on a game card plants instead of opening its link
    window.addEventListener("click", (e) => {
      if (!holding) return;
      if (e.target.closest("#seedBag")) return;
      const card = e.target.closest(".game-card");
      e.preventDefault();
      e.stopImmediatePropagation();
      if (card && card.dataset.game) {
        if (plant(card.dataset.game)) toggleHolding(false);
      } else {
        toggleHolding(false);
      }
    }, true);

    // ---------- drag and drop (mouse, touch, pen) ----------

    function findTarget(x, y) {
      const el = document.elementFromPoint(x, y);
      if (!el) return null;
      const card = el.closest(".game-card");
      if (card && card.dataset.game) return { type: "card", game: card.dataset.game, el: card };
      if (el.closest(".seed-bag-bar")) return { type: "bag", el: bagEl };
      return null;
    }

    function setHover(t) {
      if (hoverTarget && t && hoverTarget.el === t.el) return;
      if (hoverTarget) hoverTarget.el.classList.remove("seed-drop-hover", "seed-drop-blocked");
      hoverTarget = t || null;
      if (!t) return;
      t.el.classList.add("seed-drop-hover");
    }

    function onPointerDown(e) {
      if (e.button !== undefined && e.button !== 0) return;
      const fromBag = e.currentTarget === bagEl;
      if (fromBag && remaining() <= 0) return;
      dragInfo = {
        token: e.currentTarget,
        from: fromBag ? "bag" : "plot",
        game: fromBag ? null : e.currentTarget.dataset.game,
        x: e.clientX, y: e.clientY, moved: false,
      };
      if (fromBag) e.preventDefault(); // stop text selection / image drag on the bag
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerCancel);
    }
    bagEl.addEventListener("pointerdown", onPointerDown);

    function onPointerMove(e) {
      if (!dragInfo) return;
      if (!dragInfo.moved) {
        if (Math.abs(e.clientX - dragInfo.x) < DRAG_THRESHOLD && Math.abs(e.clientY - dragInfo.y) < DRAG_THRESHOLD) return;
        dragInfo.moved = true;
        if (holding) { holding = false; renderBag(); }
        if (dragInfo.from === "plot") dragInfo.token.classList.add("seed-token-dragging");
        else bagEl.classList.add("seed-bag-grabbing");
        dragGhost = document.createElement("div");
        dragGhost.className = "seed-drag-ghost";
        dragGhost.innerHTML = seedSVG();
        document.body.appendChild(dragGhost);
        setNote(dragInfo.from === "bag"
          ? "Drop it on a game to plant it."
          : "Drop it on another game to move it, or back on the bag to dig it up.");
      }
      e.preventDefault();
      dragGhost.style.left = e.clientX + "px";
      dragGhost.style.top = e.clientY + "px";
      setHover(findTarget(e.clientX, e.clientY));
    }

    function endDrag() {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
      if (dragGhost) { dragGhost.remove(); dragGhost = null; }
      setHover(null);
      bagEl.classList.remove("seed-bag-grabbing");
      if (dragInfo && dragInfo.token) dragInfo.token.classList.remove("seed-token-dragging");
    }

    function onPointerCancel() { endDrag(); dragInfo = null; renderNote(); }

    function onPointerUp(e) {
      if (!dragInfo) return;
      const info = dragInfo;
      const target = info.moved ? findTarget(e.clientX, e.clientY) : null;
      endDrag();
      dragInfo = null;

      if (!info.moved) {                       // a tap
        if (info.from === "plot") unplant(info.game);
        else toggleHolding(!holding);
        renderNote();
        return;
      }
      // Swallow the click that follows a drag, so dropping on a linked card doesn't open it
      const swallow = (ev) => { ev.stopImmediatePropagation(); ev.preventDefault(); };
      window.addEventListener("click", swallow, { capture: true, once: true });
      setTimeout(() => window.removeEventListener("click", swallow, true), 60);

      if (target && target.type === "card") {
        if (info.from === "bag") plant(target.game);
        else move(info.game, target.game);
      } else if (target && target.type === "bag" && info.from === "plot") {
        unplant(info.game);
      }
      renderAll();
    }

    // ---------- go ----------

    renderAll();
    cards.forEach((c) => { buildVines(c); if (ro) ro.observe(c); });
    if (!ro) window.addEventListener("resize", () => cards.forEach(buildVines));

    store.load().then((c) => {
      counts = Object.assign({}, c || {});
      // In demo mode, make sure this visitor's own seeds are always counted.
      if (store === DemoStore) {
        games.forEach((g) => { if (bag.planted[g]) counts[g] = Math.max(counts[g] || 0, bag.planted[g]); });
      }
      renderAll();
    }).catch(() => renderAll());
  }

  document.addEventListener("DOMContentLoaded", init);
})();
