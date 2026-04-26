const statusEl = document.getElementById("status");

document.getElementById("shuffle").addEventListener("click", async () => {
  const personName = document.getElementById("personName").value.trim();

  if (!personName) {
    statusEl.textContent = "Enter a person name.";
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  chrome.runtime.sendMessage(
    {
      type: "SHUFFLE_AFTER_PERSON",
      tabUrl: tab.url,
      personName
    },
    (response) => {
      if (chrome.runtime.lastError) {
        statusEl.textContent = chrome.runtime.lastError.message;
        return;
      }

      statusEl.textContent = response?.ok
        ? `Shuffled ${response.count} slides.`
        : response?.error || "Something went wrong.";
    }
  );
});