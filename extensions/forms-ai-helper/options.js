const apiKeyInput = document.getElementById("apiKey");
const modelSelect = document.getElementById("model");
const statusEl = document.getElementById("status");

chrome.storage.sync.get({ apiKey: "", model: "gpt-4o-mini" }, (items) => {
  apiKeyInput.value = items.apiKey;
  modelSelect.value = items.model;
});

document.getElementById("saveBtn").addEventListener("click", () => {
  const apiKey = apiKeyInput.value.trim();
  const model = modelSelect.value;

  chrome.storage.sync.set({ apiKey, model }, () => {
    statusEl.textContent = "Configurações salvas.";
    setTimeout(() => (statusEl.textContent = ""), 3000);
  });
});
