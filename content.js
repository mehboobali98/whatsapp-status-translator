/**
 * WA Status Translator (Personal) — content script
 *
 * SELECTOR STATUS: confirmed via live DevTools inspection on
 * web.whatsapp.com (2026-07-15) — the status caption renders inside an
 * element with data-testid="status-text", wrapping a <span> with the
 * actual caption text. Confirmed on both a link-style caption and a
 * plain text caption, same structure both times. If a future WhatsApp
 * Web update changes this, re-inspect via DevTools and update
 * SELECTORS below.
 */

const DEBUG = true;

const SELECTORS = {
  captionSelector: '[data-testid="status-text"]',
};

const state = {
  currentCaptionEl: null,
  currentText: "",
  buttonEl: null,
  translatedEl: null,
  showingTranslation: false,
};

function log(...args) {
  if (DEBUG) console.log("[WA Status Translator]", ...args);
}

function findCaptionElement() {
  const container = document.querySelector(SELECTORS.captionSelector);
  if (!container) return null;

  // The actual text lives on an inner span, not the container itself.
  const span = container.querySelector("span");
  const target = span && span.textContent.trim().length > 0 ? span : container;

  return target.textContent.trim().length > 0 ? target : null;
}

function removeButtonAndOverlay() {
  state.buttonEl?.remove();
  state.translatedEl?.remove();

  // If we navigate away while a translation is showing, make sure the
  // original caption is left visible again for whatever comes next.
  if (state.currentCaptionEl) {
    state.currentCaptionEl.style.display = "";
  }

  state.buttonEl = null;
  state.translatedEl = null;
  state.currentCaptionEl = null;
  state.currentText = "";
  state.showingTranslation = false;
}

function createTranslateButton(captionEl) {
  const btn = document.createElement("button");
  btn.textContent = "🌐 Translate";
  btn.className = "wa-status-translate-btn";

  btn.addEventListener("click", () => handleTranslateClick(captionEl, btn));

  // Inserted as an in-flow sibling rather than a fixed-position overlay, so it
  // tracks the caption through the viewer's open animation, window resizes and
  // layout shifts with no repositioning code at all. A fixed overlay measured
  // once at creation ends up stranded whenever any of those happen.
  captionEl.insertAdjacentElement("afterend", btn);
  return btn;
}

function showTranslationInPlace(captionEl, translatedText) {
  if (!state.translatedEl) {
    // Shallow clone copies WhatsApp's own classes/attributes (font size,
    // color, dir, etc.) without copying the original text node's content.
    const clone = captionEl.cloneNode(false);
    clone.textContent = translatedText;
    clone.classList.add("wa-status-translated-text");
    captionEl.insertAdjacentElement("afterend", clone);
    state.translatedEl = clone;
  } else {
    state.translatedEl.textContent = translatedText;
    state.translatedEl.style.display = "";
  }

  captionEl.style.display = "none";
}

function hideTranslationShowOriginal(captionEl) {
  if (state.translatedEl) state.translatedEl.style.display = "none";
  captionEl.style.display = "";
}

function handleTranslateClick(captionEl, btn) {
  if (state.showingTranslation) {
    hideTranslationShowOriginal(captionEl);
    state.showingTranslation = false;
    btn.textContent = "🌐 Translate";
    return;
  }

  btn.textContent = "⏳ Translating…";

  chrome.runtime.sendMessage(
    { type: "TRANSLATE_TEXT", text: captionEl.textContent.trim() },
    (response) => {
      if (!response?.ok) {
        const reason =
          response?.error ?? "No response from the extension background worker.";
        log("Translation failed:", reason);
        btn.textContent = "⚠️ Failed";
        // Surfaced on hover — a dead API key and an exhausted monthly quota are
        // otherwise indistinguishable to anyone without the console open.
        btn.title = reason;
        setTimeout(() => (btn.textContent = "🌐 Translate"), 2000);
        return;
      }

      showTranslationInPlace(captionEl, response.translated);
      state.showingTranslation = true;
      btn.textContent = "🌐 Show original";
      btn.title = "";
    }
  );
}

function checkForStatus() {
  const captionEl = findCaptionElement();

  if (!captionEl) {
    if (state.buttonEl) removeButtonAndOverlay();
    return;
  }

  const text = captionEl.textContent.trim();

  // Node identity alone is not enough to say "already handled": status auto-
  // advances on a timer and WhatsApp can reuse the same element with new text,
  // which would leave the *previous* status's translation on screen. Also
  // re-check that our button survived WhatsApp's own re-renders.
  const unchanged =
    captionEl === state.currentCaptionEl &&
    text === state.currentText &&
    state.buttonEl?.isConnected;
  if (unchanged) return;

  removeButtonAndOverlay();
  state.currentCaptionEl = captionEl;
  state.currentText = text;
  state.buttonEl = createTranslateButton(captionEl);
  log("Caption found:", text);
}

// WhatsApp Web mutates the DOM constantly; without coalescing this runs a
// querySelector thousands of times a minute while the page just sits there.
let checkQueued = false;
const observer = new MutationObserver(() => {
  if (checkQueued) return;
  checkQueued = true;
  requestAnimationFrame(() => {
    checkQueued = false;
    checkForStatus();
  });
});
observer.observe(document.body, { childList: true, subtree: true });

log("WA Status Translator content script loaded.");
