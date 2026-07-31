# WhatsApp Status Translator (MVP)

> **Disclaimer:** This is an independent, unofficial tool. It is not
> affiliated with, endorsed by, or supported by WhatsApp or Meta.

One-click translate for WhatsApp Web Status captions — WhatsApp's own
"long-press to translate" feature covers chats, groups, and channels, but
not Status. This fills that gap for text-based captions.

## Setup

1. Get a free DeepL API key: https://www.deepl.com/pro-api (Free tier,
   500k characters/month, no credit card issues for personal volume).
2. Open `chrome://extensions`, enable **Developer mode** (top-right toggle).
3. Click **Load unpacked**, select this folder.
4. Click the extension's **Details** → **Extension options**. Paste your
   DeepL key, pick your target language, click Save.
5. Open a WhatsApp Web Status with a caption — a "🌐 Translate" button
   should appear near it.

## If the button doesn't appear

WhatsApp Web's DOM structure can change between releases. The caption is
currently found via `[data-testid="status-text"]` in `content.js`
(confirmed working as of 2026-07-15). If a future update breaks this:

1. Open `web.whatsapp.com`, open a Status with a caption.
2. Open DevTools (F12) → **Console**. With `DEBUG = true` in `content.js`,
   you'll see a log confirming whether a caption was found.
3. If not: switch to the **Elements** tab, inspect the actual DOM around
   the caption text, and update `SELECTORS.captionSelector` in
   `content.js` to match.
4. Reload the extension in `chrome://extensions` and hard-refresh
   `web.whatsapp.com` (content-script changes need a real page reload,
   not just an extension reload).

Contributions/PRs fixing selector drift are welcome — it's the one part
of this tool likely to need periodic updates.

## How it works

- `content.js` watches the page for the Status viewer opening and looks
  for caption text via `data-testid="status-text"`.
- When a caption is found, a small "🌐 Translate" button appears near it.
- Clicking it sends the caption text to `background.js`, which calls the
  DeepL API. The network call happens in the background service worker
  rather than the content script, so WhatsApp Web's own page CSP can't
  interfere with it.
- The original caption is hidden and replaced **in place** with a cloned
  element containing the translated text — the clone inherits WhatsApp's
  own classes, so it matches the native font/size/color automatically,
  just shown in italics as a visual cue that it's a translation. Click
  the button again ("🌐 Show original") to swap back.

## Known limitations

- Only handles **DOM-extractable caption text** — not text baked into an
  image (memes/flyers) or spoken audio in a video with no caption.
  Adding an OCR/vision-model path for that is on the roadmap.
- No auto-translate mode — deliberately click-to-translate to avoid
  unnecessary API calls.

## License

MIT — see [LICENSE](./LICENSE).
