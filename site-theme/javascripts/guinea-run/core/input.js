/*
 * Every way to play, turned into the same few actions: left, right, jump, duck,
 * confirm, pause, mute and quit.
 *
 * Keys are read by position (event.code), so WASD works on every layout: on an
 * AZERTY keyboard the same keys are ZQSD. The arrows work as well, for those
 * who have them. On a touch screen a swipe moves and a tap jumps, and the pads
 * at the bottom of the screen do the same for those who prefer tapping.
 *
 * Buttons of the menus are real buttons: a click, or Enter or Space while one
 * has the focus, presses it. The pads react on pointerdown, so a press counts
 * at once instead of when the finger lifts.
 */

const KEYMAP = {
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
  ArrowUp: "jump",
  KeyW: "jump",
  Space: "jump",
  ArrowDown: "duck",
  KeyS: "duck",
  KeyP: "pause",
  KeyM: "mute",
  Escape: "quit",
  Enter: "confirm",
  NumpadEnter: "confirm"
};

const SWIPE_MIN_PX = 30;
const TAP_MAX_PX = 12;
const TAP_MAX_MS = 250;

function isControl(element) {
  if (!element || !element.tagName) {
    return false;
  }
  const tag = element.tagName.toLowerCase();
  return tag === "button" || tag === "a" || tag === "input" || tag === "select" || tag === "textarea";
}

/**
 * Listens on the overlay and the window and calls onAction(name, element) for
 * every action. Returns a function that removes every listener.
 */
export function createInput(overlay, canvas, onAction, options = {}) {
  const cleanups = [];

  function listen(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    cleanups.push(() => target.removeEventListener(type, handler, options));
  }

  listen(
    window,
    "keydown",
    (event) => {
      const action = KEYMAP[event.code];
      if (!action) {
        return;
      }
      // A focused menu button takes Enter and Space itself, as any button does
      const focused = document.activeElement;
      if ((event.code === "Enter" || event.code === "Space" || event.code === "NumpadEnter") && isControl(focused) && overlay.contains(focused)) {
        event.stopPropagation();
        return;
      }
      // Arrows and Space would scroll the page behind the game
      event.preventDefault();
      event.stopPropagation();
      if (event.repeat && action !== "duck" && action !== "left" && action !== "right") {
        return;
      }
      onAction(action, null);
    },
    { capture: true }
  );

  // Swipes and taps on the canvas
  let start = null;
  listen(canvas, "pointerdown", (event) => {
    // A world with a single jump pad has no swipe to tell apart: its tap counts
    // at the touch, as fast as the pad
    if (options.tapOnDown && options.tapOnDown()) {
      start = null;
      onAction("tap", null);
      return;
    }
    start = { x: event.clientX, y: event.clientY, time: performance.now(), id: event.pointerId };
  });
  listen(canvas, "pointerup", (event) => {
    if (!start || start.id !== event.pointerId) {
      return;
    }
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    const elapsed = performance.now() - start.time;
    start = null;
    if (Math.abs(dx) < TAP_MAX_PX && Math.abs(dy) < TAP_MAX_PX && elapsed < TAP_MAX_MS) {
      onAction("tap", null);
      return;
    }
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN_PX) {
      return;
    }
    if (Math.abs(dx) > Math.abs(dy)) {
      onAction(dx < 0 ? "left" : "right", null);
    } else {
      onAction(dy < 0 ? "jump" : "duck", null);
    }
  });
  listen(canvas, "pointercancel", () => {
    start = null;
  });

  // The pads, at once on pointerdown
  listen(overlay, "pointerdown", (event) => {
    const pad = event.target.closest ? event.target.closest("[data-pad]") : null;
    if (!pad || !overlay.contains(pad)) {
      return;
    }
    event.preventDefault();
    onAction(pad.getAttribute("data-pad"), pad);
  });

  // Every other button, on click, which a keyboard press also fires
  listen(overlay, "click", (event) => {
    const button = event.target.closest ? event.target.closest("[data-action]") : null;
    if (!button || !overlay.contains(button) || button.hasAttribute("data-pad")) {
      return;
    }
    event.preventDefault();
    onAction(button.getAttribute("data-action"), button);
  });

  return function dispose() {
    for (const cleanup of cleanups) {
      cleanup();
    }
  };
}
