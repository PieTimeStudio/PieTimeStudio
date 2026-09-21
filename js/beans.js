// Pie Time Studio — The Bean Patch
// A whimsical, per-visitor "vote with a bean" widget for the games page.
// Each visitor gets a small pouch of beans to drag onto the games they most
// want the studio to focus on. Everything here is stored in the visitor's
// own browser (localStorage) — it is not shared across visitors yet.

(function () {
  const TOTAL_BEANS = 3;
  const STORAGE_KEY = "pts_bean_patch_v1";
  const DRAG_THRESHOLD = 6; // px of movement before a tap becomes a drag

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && parsed.planted) {
          return parsed;
        }
      }
    } catch (e) {
      // localStorage unavailable (private browsing, etc.) — fall back silently
    }
    return { planted: {}, remaining: TOTAL_BEANS };
  }

  function saveState(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      // best-effort only
    }
  }

  function init() {
    const patches = document.querySelectorAll(".bean-patch");
    const tray = document.getElementById("beanPouchTray");
    if (!patches.length || !tray) return;

    const state = loadState();
    let dragGhost = null;
    let dragInfo = null; // { from: "pouch" | "jar", game, startX, startY, moved }
    let hoverTarget = null;

    // ---------- rendering ----------

    function renderJar(patch) {
      const game = patch.dataset.game;
      const jar = patch.querySelector(".beans-in-jar");
      const count = state.planted[game] || 0;
      jar.innerHTML = "";
      for (let i = 0; i < count; i++) {
        jar.appendChild(makeBeanToken("jar", game));
      }
      patch.classList.toggle("bean-patch-empty", count === 0);
    }

    function renderTray() {
      tray.innerHTML = "";
      for (let i = 0; i < state.remaining; i++) {
        tray.appendChild(makeBeanToken("pouch", null));
      }
      tray.classList.toggle("bean-pouch-tray-empty", state.remaining === 0);
    }

    function renderAll() {
      patches.forEach(renderJar);
      renderTray();
      renderNote();
      patches.forEach((patch) => {
        const btn = patch.querySelector(".bean-btn");
        if (btn) btn.disabled = state.remaining <= 0;
      });
    }

    function renderNote() {
      const note = document.getElementById("beanPouchNote");
      if (!note) return;
      if (dragInfo) return; // don't fight the "drop it here" hint mid-drag
      note.textContent =
        state.remaining <= 0
          ? "You're all planted out — drag (or tap) a bean out of a jar to replant it."
          : "Drag a bean onto the games you want us to focus on next.";
    }

    function makeBeanToken(source, game) {
      const el = document.createElement("span");
      el.className = "bean-token bean-emoji";
      el.textContent = "🫘";
      el.dataset.source = source;
      if (game) el.dataset.game = game;
      el.setAttribute("role", "img");
      el.setAttribute("aria-label", source === "pouch" ? "Bean, unplanted" : "Bean, planted here");
      el.addEventListener("pointerdown", onPointerDown);
      return el;
    }

    // ---------- state changes ----------

    function plant(game) {
      if (state.remaining <= 0) return false;
      state.planted[game] = (state.planted[game] || 0) + 1;
      state.remaining -= 1;
      saveState(state);
      return true;
    }

    function unplant(game) {
      const current = state.planted[game] || 0;
      if (current <= 0) return false;
      state.planted[game] = current - 1;
      state.remaining += 1;
      saveState(state);
      return true;
    }

    function move(fromGame, toGame) {
      if (fromGame === toGame) return false;
      const current = state.planted[fromGame] || 0;
      if (current <= 0) return false;
      state.planted[fromGame] = current - 1;
      state.planted[toGame] = (state.planted[toGame] || 0) + 1;
      saveState(state);
      return true;
    }

    function bounce(el) {
      if (!el) return;
      el.classList.remove("bean-jar-bounce");
      void el.offsetWidth;
      el.classList.add("bean-jar-bounce");
    }

    // ---------- tap fallback (click without dragging) ----------

    function handleTap(source, game) {
      if (source === "pouch") return; // tapping an unplanted bean alone has no target
      if (unplant(game)) {
        renderAll();
      }
    }

    // Plant buttons remain as an accessible, no-drag way to plant one bean
    patches.forEach((patch) => {
      const btn = patch.querySelector(".bean-btn");
      const jar = patch.querySelector(".bean-jar");
      if (btn) {
        btn.addEventListener("click", () => {
          if (plant(patch.dataset.game)) {
            renderAll();
            bounce(jar);
          }
        });
      }
    });

    // ---------- drag machinery (pointer events: mouse + touch + pen) ----------

    function findDropTarget(x, y) {
      const el = document.elementFromPoint(x, y);
      if (!el) return null;
      const jarPatch = el.closest(".bean-patch");
      if (jarPatch) return { type: "jar", game: jarPatch.dataset.game, el: jarPatch };
      const pouchEl = el.closest("#beanPouchTray");
      if (pouchEl) return { type: "pouch", el: pouchEl };
      return null;
    }

    function clearHover() {
      if (hoverTarget && hoverTarget.el) {
        hoverTarget.el.classList.remove("bean-drop-hover");
      }
      hoverTarget = null;
    }

    function setHover(target) {
      if (hoverTarget && hoverTarget.el === (target && target.el)) return;
      clearHover();
      if (target) {
        target.el.classList.add("bean-drop-hover");
        hoverTarget = target;
      }
    }

    function onPointerDown(e) {
      const token = e.currentTarget;
      if (token.dataset.source === "pouch" && state.remaining <= 0) return;

      dragInfo = {
        token,
        from: token.dataset.source,
        game: token.dataset.game || null,
        startX: e.clientX,
        startY: e.clientY,
        moved: false,
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerCancel);
    }

    function onPointerMove(e) {
      if (!dragInfo) return;
      const dx = e.clientX - dragInfo.startX;
      const dy = e.clientY - dragInfo.startY;

      if (!dragInfo.moved) {
        if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;
        dragInfo.moved = true;
        dragInfo.token.classList.add("bean-token-dragging");
        dragGhost = document.createElement("div");
        dragGhost.className = "bean-drag-ghost";
        dragGhost.textContent = "🫘";
        document.body.appendChild(dragGhost);
        const note = document.getElementById("beanPouchNote");
        if (note) note.textContent = "Let go over a jar to plant it, or over the pouch to dig it back up.";
      }

      if (dragGhost) {
        dragGhost.style.left = e.clientX + "px";
        dragGhost.style.top = e.clientY + "px";
      }

      setHover(findDropTarget(e.clientX, e.clientY));
    }

    function endDrag() {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
      if (dragGhost) {
        dragGhost.remove();
        dragGhost = null;
      }
      clearHover();
      if (dragInfo && dragInfo.token) {
        dragInfo.token.classList.remove("bean-token-dragging");
      }
    }

    function onPointerCancel() {
      endDrag();
      dragInfo = null;
      renderNote();
    }

    function onPointerUp(e) {
      if (!dragInfo) return;
      const info = dragInfo;
      const wasDrag = info.moved;
      const target = wasDrag ? findDropTarget(e.clientX, e.clientY) : null;

      endDrag();
      dragInfo = null;

      if (!wasDrag) {
        handleTap(info.from, info.game);
        return;
      }

      let changed = false;
      let landedJar = null;

      if (target && target.type === "jar") {
        if (info.from === "pouch") {
          changed = plant(target.game);
        } else if (info.from === "jar") {
          changed = move(info.game, target.game);
        }
        if (changed) landedJar = target.el.querySelector(".bean-jar");
      } else if (target && target.type === "pouch") {
        if (info.from === "jar") {
          changed = unplant(info.game);
        }
        // dropping a pouch bean back on the pouch is a no-op
      }

      renderAll();
      if (landedJar) bounce(landedJar);
    }

    // ---------- reset ----------

    const resetBtn = document.getElementById("beanResetBtn");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        state.planted = {};
        state.remaining = TOTAL_BEANS;
        saveState(state);
        renderAll();
      });
    }

    renderAll();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
