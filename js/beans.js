// Pie Time Studio — The Bean Patch
// A whimsical, per-visitor "vote with a bean" widget for the games page.
// Each visitor gets a small pouch of beans to plant on the games they most
// want the studio to focus on. Everything here is stored in the visitor's
// own browser (localStorage) — it is not shared across visitors yet.

(function () {
  const TOTAL_BEANS = 3;
  const STORAGE_KEY = "pts_bean_patch_v1";

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

  function renderJar(patchEl, count) {
    const jar = patchEl.querySelector(".beans-in-jar");
    if (!jar) return;
    jar.innerHTML = "";
    for (let i = 0; i < count; i++) {
      const bean = document.createElement("span");
      bean.className = "bean-emoji";
      bean.textContent = "🫘";
      jar.appendChild(bean);
    }
    patchEl.classList.toggle("bean-patch-empty", count === 0);
  }

  function renderPouch(state) {
    const remainingEl = document.getElementById("beansLeft");
    if (remainingEl) remainingEl.textContent = state.remaining;

    document.querySelectorAll(".bean-btn").forEach((btn) => {
      btn.disabled = state.remaining <= 0;
    });

    const note = document.getElementById("beanPouchNote");
    if (note) {
      note.textContent =
        state.remaining <= 0
          ? "You're all planted out — tap a jar below to dig a bean back up and replant it."
          : "Tap “Plant a bean” on the games you want us to focus on next.";
    }
  }

  function bounce(el) {
    if (!el) return;
    el.classList.remove("bean-jar-bounce");
    // force reflow so the animation can re-trigger on repeated clicks
    void el.offsetWidth;
    el.classList.add("bean-jar-bounce");
  }

  function init() {
    const patches = document.querySelectorAll(".bean-patch");
    if (!patches.length) return;

    const state = loadState();

    patches.forEach((patch) => {
      const game = patch.dataset.game;
      if (!game) return;

      const count = state.planted[game] || 0;
      renderJar(patch, count);

      const plantBtn = patch.querySelector(".bean-btn");
      const jar = patch.querySelector(".bean-jar");

      if (plantBtn) {
        plantBtn.addEventListener("click", () => {
          if (state.remaining <= 0) return;
          state.planted[game] = (state.planted[game] || 0) + 1;
          state.remaining -= 1;
          saveState(state);
          renderJar(patch, state.planted[game]);
          renderPouch(state);
          bounce(jar);
        });
      }

      if (jar) {
        jar.addEventListener("click", () => {
          const current = state.planted[game] || 0;
          if (current <= 0) return;
          state.planted[game] = current - 1;
          state.remaining += 1;
          saveState(state);
          renderJar(patch, state.planted[game]);
          renderPouch(state);
        });
      }
    });

    renderPouch(state);

    const resetBtn = document.getElementById("beanResetBtn");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        const fresh = { planted: {}, remaining: TOTAL_BEANS };
        saveState(fresh);
        patches.forEach((patch) => renderJar(patch, 0));
        renderPouch(fresh);
        Object.assign(state, fresh);
      });
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
