# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

An unaffiliated Chrome MV3 extension that adds click-to-translate for WhatsApp
Web Status captions (WhatsApp's built-in translate covers chats/channels but
not Status). No build step, no dependencies, no test suite — plain JS loaded
directly by Chrome.

## Dev loop

- Load: `chrome://extensions` → Developer mode → **Load unpacked** → this folder.
- Config: extension **Details** → **Extension options** (DeepL key + target lang,
  stored in `chrome.storage.local`).
- After editing `content.js`/`overlay.css`: reload the extension **and** hard-refresh
  `web.whatsapp.com`. Content-script changes don't take effect on an
  already-loaded page.
- After editing `background.js`: reload the extension; inspect the service worker
  from the `chrome://extensions` card for its console.
- `DEBUG = true` in `content.js` logs to the page console under
  `[WA Status Translator]`.

## Architecture

Three isolated contexts, no shared module system — each file is a standalone
script:

- `content.js` — runs in the WhatsApp Web page. A `MutationObserver` on
  `document.body` looks for the caption element on DOM changes, coalesced to one
  check per animation frame (WhatsApp mutates constantly — don't remove the
  coalescing). When found, the button is inserted as an **in-flow sibling** of
  the caption, not a fixed-position overlay, so it tracks animations and resizes
  for free; `checkForStatus()` re-checks `isConnected` in case WhatsApp's own
  re-render removes it. Translation is shown by
  **shallow-cloning the caption element** (`cloneNode(false)`) so the clone
  inherits WhatsApp's own classes for font/size/color/dir, then hiding the
  original. Toggling back just flips `display` on both. All UI state lives in the
  single `state` object; `removeButtonAndOverlay()` is the one teardown path and
  must restore `currentCaptionEl.style.display`.
- `background.js` — MV3 service worker, sole owner of the DeepL API key and the
  network call. Content scripts must **not** fetch DeepL directly: WhatsApp Web's
  page CSP interferes. Messaging is `chrome.runtime.sendMessage` with
  `{type: "TRANSLATE_TEXT", text}` → `{ok, translated}` / `{ok: false, error}`;
  the listener returns `true` to keep the channel open for the async reply.
- `options.html` / `options.js` — key + target-lang form.

## The fragile part

`SELECTORS.captionSelector` (`[data-testid="status-text"]`) is the only coupling
to WhatsApp's internal DOM and the single most likely thing to break on a
WhatsApp Web release. Verified 2026-07-15. If the button stops appearing, verify
against live DOM in DevTools before changing anything else — everything
downstream assumes the caption element is found. Note the caption text lives on
an inner `<span>`, not the `data-testid` container itself; `findCaptionElement()`
handles that fallback.

## Scope boundaries (deliberate, per README)

- Text-only: no OCR for text baked into images, no audio.
- Click-to-translate only, never auto — avoids burning DeepL free-tier quota.
- Free-tier endpoint (`api-free.deepl.com`) is hardcoded in both `background.js`
  and `host_permissions`; a Pro key would need both changed to `api.deepl.com`.
