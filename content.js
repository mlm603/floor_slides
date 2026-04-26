let timer1 = 45;
let timer2 = 45;
let activeTimer = null;
let intervalId = null;

console.log("CONTENT SCRIPT LOADED", window.location.href);

window.addEventListener("error", (e) => {
  console.error("CONTENT SCRIPT ERROR:", e.message, e.filename, e.lineno);
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.type !== "TIMER_COMMAND") return;

  if (message.command === "start_timer") {
    nextSlide();
    startTimer(1);
  }

  if (message.command === "switch_timer") {
    nextSlide();
    pauseCurrentTimer();

    const nextTimer = activeTimer === 1 ? 2 : 1;
    startTimer(nextTimer);
  }

  if (message.command === "deduct_time") {
    nextSlide();

    if (activeTimer === 1) timer1 = Math.max(0, timer1 - 3);
    if (activeTimer === 2) timer2 = Math.max(0, timer2 - 3);

    if (timer1 === 0 || timer2 === 0) {
      stopInterval();
      flashScreen();
    }

    renderTimers();
  }
});

if (window.top !== window.self) {
  throw new Error("Skipping iframe");
}

function renderTimers() {
  const t1 = document.getElementById("timer1");
  const t2 = document.getElementById("timer2");

  if (!t1 || !t2) return;

  t1.textContent = `Timer 1: ${timer1}`;
  t2.textContent = `Timer 2: ${timer2}`;

  t1.classList.toggle("active", activeTimer === 1);
  t2.classList.toggle("active", activeTimer === 2);
}

const style = document.createElement("style");
style.textContent = `
  #slides-game-timer-overlay {
    position: fixed !important;
    top: 16px !important;
    right: 16px !important;
    z-index: 2147483647 !important;
    display: flex !important;
    gap: 8px !important;
    font-family: Arial, sans-serif !important;
    pointer-events: none !important;
    visibility: visible !important;
    opacity: 1 !important;
  }

  #slides-game-timer-overlay .timer-box {
    background: rgba(0, 0, 0, 0.85) !important;
    color: white !important;
    padding: 10px 14px !important;
    border-radius: 8px !important;
    font-size: 20px !important;
    font-weight: bold !important;
  }

  #slides-game-timer-overlay .timer-box.active {
    outline: 3px solid white !important;
  }
`;

const overlay = document.createElement("div");
overlay.id = "slides-game-timer-overlay";

const timer1El = document.createElement("div");
timer1El.className = "timer-box";
timer1El.id = "timer1";
timer1El.textContent = "Timer 1: 45";

const timer2El = document.createElement("div");
timer2El.className = "timer-box";
timer2El.id = "timer2";
timer2El.textContent = "Timer 2: 45";

overlay.appendChild(timer1El);
overlay.appendChild(timer2El);

function mountOverlay() {
  console.log("Trying to mount overlay");

  if (document.getElementById("slides-game-timer-overlay")) {
    console.log("Overlay already exists");
    return;
  }

  document.documentElement.appendChild(style);
  document.documentElement.appendChild(overlay);

  renderTimers();

  console.log("Slides timer overlay mounted");
}

setTimeout(mountOverlay, 1000);

function flashScreen() {
  document.body.classList.add("slides-timer-flash");
}

function stopInterval() {
  if (intervalId) clearInterval(intervalId);
  intervalId = null;
}

function startTimer(timerNumber) {
  stopInterval();
  activeTimer = timerNumber;
  renderTimers();

  intervalId = setInterval(() => {
    if (activeTimer === 1) timer1 -= 1;
    if (activeTimer === 2) timer2 -= 1;

    if (timer1 <= 0 || timer2 <= 0) {
      timer1 = Math.max(timer1, 0);
      timer2 = Math.max(timer2, 0);
      stopInterval();
      flashScreen();
    }

    renderTimers();
  }, 1000);
}

function pauseCurrentTimer() {
  stopInterval();
}

function nextSlide() {
  document.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowRight",
      code: "ArrowRight",
      keyCode: 39,
      which: 39,
      bubbles: true
    })
  );
}

function isTypingTarget(el) {
  return (
    el &&
    (el.tagName === "INPUT" ||
      el.tagName === "TEXTAREA" ||
      el.isContentEditable)
  );
}

window.addEventListener(
  "keydown",
  (event) => {
    console.log("meghan test");
    console.log("KEYDOWN:", event.key, event.code, event.target);
    if (isTypingTarget(event.target)) return;

    const key = event.key;
    const code = event.code;

    const isStart = key === "0" || code === "Digit0" || code === "Numpad0";
    const isSwitch = key === "1" || code === "Digit1" || code === "Numpad1";
    const isDeduct = key === "2" || code === "Digit2" || code === "Numpad2";

    if (!isStart && !isSwitch && !isDeduct) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    event.stopPropagation();

    if (isStart) {
      nextSlide();
      startTimer(1);
    }

    if (isSwitch) {
      nextSlide();
      pauseCurrentTimer();

      const nextTimer = activeTimer === 1 ? 2 : 1;
      startTimer(nextTimer);
    }

    if (isDeduct) {
      nextSlide();

      if (activeTimer === 1) timer1 = Math.max(0, timer1 - 3);
      if (activeTimer === 2) timer2 = Math.max(0, timer2 - 3);

      if (timer1 === 0 || timer2 === 0) {
        stopInterval();
        flashScreen();
      }

      renderTimers();
    }
  },
  true
);