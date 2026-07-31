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
  state.showingTranslation = false;
}

function positionNear(el, targetEl, extraOffsetPx = 6) {
  const rect = targetEl.getBoundingClientRect();
  el.style.position = "fixed";
  el.style.left = `${rect.left}px`;
  el.style.top = `${rect.bottom + extraOffsetPx}px`;
}

function createTranslateButton(captionEl) {
  const btn = document.createElement("button");
  btn.textContent = "🌐 Translate";
  btn.className = "wa-status-translate-btn";
  positionNear(btn, captionEl);

  btn.addEventListener("click", () => handleTranslateClick(captionEl, btn));

  document.body.appendChild(btn);
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
        log("Translation failed:", response?.error);
        btn.textContent = "⚠️ Failed";
        setTimeout(() => (btn.textContent = "🌐 Translate"), 2000);
        return;
      }

      showTranslationInPlace(captionEl, response.translated);
      state.showingTranslation = true;
      btn.textContent = "🌐 Show original";
    }
  );
}

function checkForStatus() {
  const captionEl = findCaptionElement();

  if (!captionEl) {
    if (state.buttonEl) removeButtonAndOverlay();
    return;
  }

  if (captionEl === state.currentCaptionEl) return; // already handled

  removeButtonAndOverlay();
  state.currentCaptionEl = captionEl;
  state.buttonEl = createTranslateButton(captionEl);
  log("Caption found:", captionEl.textContent.trim());
}

const observer = new MutationObserver(() => checkForStatus());
observer.observe(document.body, { childList: true, subtree: true });

log("WA Status Translator content script loaded.");
