const apiKeyEl = document.getElementById("apiKey");
const targetLangEl = document.getElementById("targetLang");
const statusEl = document.getElementById("status");

chrome.storage.local.get(["apiKey", "targetLang"], (data) => {
  if (data.apiKey) apiKeyEl.value = data.apiKey;
  if (data.targetLang) targetLangEl.value = data.targetLang;
});

document.getElementById("save").addEventListener("click", () => {
  chrome.storage.local.set(
    {
      apiKey: apiKeyEl.value.trim(),
      targetLang: targetLangEl.value,
    },
    () => {
      statusEl.textContent = "Saved.";
      setTimeout(() => (statusEl.textContent = ""), 1500);
    }
  );
});
