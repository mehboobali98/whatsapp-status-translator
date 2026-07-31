/**
 * Handles the actual network call to DeepL from the background service
 * worker, rather than the content script. Content-script fetches can get
 * tangled up in the host page's CSP; routing through the background avoids
 * that entirely and is the recommended MV3 pattern for this kind of thing.
 */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "TRANSLATE_TEXT") return;

  (async () => {
    try {
      const { apiKey, targetLang } = await chrome.storage.local.get([
        "apiKey",
        "targetLang",
      ]);

      if (!apiKey) {
        sendResponse({
          ok: false,
          error: "No DeepL API key set. Open the extension's options page first.",
        });
        return;
      }

      const lang = targetLang || "EN";

      const resp = await fetch("https://api-free.deepl.com/v2/translate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `DeepL-Auth-Key ${apiKey}`,
        },
        body: JSON.stringify({
          text: [message.text],
          target_lang: lang,
        }),
      });

      if (!resp.ok) {
        const body = await resp.text();
        sendResponse({ ok: false, error: `DeepL API error ${resp.status}: ${body}` });
        return;
      }

      const data = await resp.json();
      const translated = data?.translations?.[0]?.text;

      if (!translated) {
        sendResponse({ ok: false, error: "DeepL returned no translation." });
        return;
      }

      sendResponse({ ok: true, translated });
    } catch (err) {
      sendResponse({ ok: false, error: String(err) });
    }
  })();

  // Keep the message channel open for the async response above.
  return true;
});
