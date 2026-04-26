chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SHUFFLE_AFTER_PERSON") {
    shuffleAfterPerson(message)
      .then(sendResponse)
      .catch((err) => sendResponse({ ok: false, error: err.message }));

    return true;
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id || !tab.url?.includes("docs.google.com/presentation")) return;

  await chrome.tabs.sendMessage(tab.id, {
    type: "TIMER_COMMAND",
    command,
    advanceSlide: false
  });

  await sendArrowRight(tab.id);
});

async function sendArrowRight(tabId) {
  const target = { tabId };

  await chrome.debugger.attach(target, "1.3");

  await chrome.debugger.sendCommand(target, "Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "ArrowRight",
    code: "ArrowRight",
    windowsVirtualKeyCode: 39,
    nativeVirtualKeyCode: 39
  });

  await chrome.debugger.sendCommand(target, "Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "ArrowRight",
    code: "ArrowRight",
    windowsVirtualKeyCode: 39,
    nativeVirtualKeyCode: 39
  });

  await chrome.debugger.detach(target);
}

function getPresentationId(url) {
  const match = url.match(/\/presentation\/d\/([^/]+)/);
  if (!match) throw new Error("Could not find presentation ID in URL.");
  return match[1];
}

async function getToken() {
  const result = await chrome.identity.getAuthToken({ interactive: true });
  return result.token;
}

async function slidesFetch(token, url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Slides API error ${res.status}: ${text}`);
  }

  return res.json();
}

function extractSlideText(slide) {
  const chunks = [];

  for (const el of slide.pageElements || []) {
    const textElements = el.shape?.text?.textElements || [];

    for (const t of textElements) {
      if (t.textRun?.content) chunks.push(t.textRun.content);
    }
  }

  return chunks.join("").replace(/\s+/g, " ").trim();
}

function fuzzyMatch(a, b) {
  return a.toLowerCase().includes(b.toLowerCase());
}

function shuffleArray(items) {
  const arr = [...items];

  for (let i = arr.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  return arr;
}

function findDividerSlides(slides) {
  return slides
    .map((slide, index) => {
      const text = extractSlideText(slide).trim();

      // Finds a name inside parentheses anywhere on the slide,
      // even if the slide also has "Category: x" or other text.
      const match = text.match(/\(\s*([^)]+?)\s*\)/);

      return {
        index,
        objectId: slide.objectId,
        text,
        name: match ? match[1].trim() : null
      };
    })
    .filter((s) => s.name);
}

async function shuffleAfterPerson({ tabUrl, personName }) {
  const presentationId = getPresentationId(tabUrl);
  const token = await getToken();

  const presentation = await slidesFetch(
    token,
    `https://slides.googleapis.com/v1/presentations/${presentationId}`
  );

  const slides = presentation.slides || [];
  const dividers = findDividerSlides(slides);

  const start = dividers.find((s) => fuzzyMatch(s.name, personName));

  if (!start) {
    throw new Error(`Could not find divider slide for: ${personName}`);
  }

  const end = dividers.find((s) => s.index > start.index);

  if (!end) {
    throw new Error(`Could not find another name after: ${personName}`);
  }

  const between = slides.slice(start.index + 1, end.index);

  if (between.length <= 1) {
    return { ok: true, count: between.length };
  }

  const shuffled = shuffleArray(between);

  const requests = [...shuffled].reverse().map((slide) => ({
    updateSlidesPosition: {
      slideObjectIds: [slide.objectId],
      insertionIndex: start.index + 1
    }
  }));

  await slidesFetch(
    token,
    `https://slides.googleapis.com/v1/presentations/${presentationId}:batchUpdate`,
    {
      method: "POST",
      body: JSON.stringify({ requests })
    }
  );

  return { ok: true, count: between.length };
}