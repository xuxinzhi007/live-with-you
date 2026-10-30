import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9341;
const OUT = "/tmp/wenbebi-skin-audit";
const URL = "http://localhost:5199/?mobile";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await mkdir(OUT, { recursive: true });

const chrome = spawn(CHROME, [
  "--headless=new",
  `--remote-debugging-port=${PORT}`,
  "--user-data-dir=/tmp/wenbebi-skin-chrome",
  "--no-first-run",
  "--no-default-browser-check",
  "--hide-scrollbars",
  "--enable-unsafe-swiftshader",
  "--disable-gpu",
  "about:blank",
], { stdio: "ignore" });

let ws = null;
let nextId = 0;
const pending = new Map();
const consoleLines = [];
const exceptions = [];

function send(method, params = {}, timeout = 20000) {
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`timeout ${method}`));
    }, timeout);
    pending.set(id, {
      resolve: (value) => { clearTimeout(timer); resolve(value); },
      reject: (error) => { clearTimeout(timer); reject(error); },
    });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression, timeout = 20000) {
  const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, timeout);
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "evaluate failed");
  return result.result.value;
}

async function waitFor(fn, timeout = 25000, interval = 150) {
  const start = Date.now();
  let last;
  while (Date.now() - start < timeout) {
    try {
      const value = await fn();
      if (value) return value;
      last = value;
    } catch (error) {
      last = error?.message || String(error);
    }
    await sleep(interval);
  }
  throw new Error(`waitFor timeout: ${last}`);
}

async function shot(name) {
  const { data } = await send("Page.captureScreenshot", { format: "png", fromSurface: true }, 25000);
  await writeFile(`${OUT}/${name}.png`, Buffer.from(data, "base64"));
}

async function tap(x, y) {
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, buttons: 0 });
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 });
  await sleep(55);
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", buttons: 0, clickCount: 1 });
}

const seed = {
  version: 2,
  currentScene: "bedroom",
  pet: { currentAction: "idle", mood: "normal", energy: 70, happiness: 70, lastInteraction: Date.now() },
  player: null,
  coins: 18,
  seeds: 2,
  flowers: 1,
  mementos: 1,
  bond: 0,
  exploredScenes: ["bedroom"],
  bondedMoments: ["flower:daisy"],
  journal: [{ id: "seed-1", text: "第一次走进庭院。", time: Date.now() - 3600_000 }],
  lastCoplayId: null,
  lastCoplayAt: 0,
  world: {
    room: "home",
    plots: [
      { kind: "daisy", plantedAt: Date.now() - 30_000, wateredAt: 0 },
      { kind: null, plantedAt: 0, wateredAt: 0 },
      { kind: null, plantedAt: 0, wateredAt: 0 },
    ],
    cooldowns: {},
    bestCombo: 2,
    seenIntro: true,
    planted: 1,
    harvested: 1,
    kicks: 2,
    collection: { daisy: 1, rose: 0, sunflower: 0 },
    visited: ["home", "garden"],
  },
};

const report = { url: URL, steps: {}, checks: {} };

const snapshot = () => evaluate(`(() => {
  const raw = localStorage.getItem('wenbebi-mobile-game-v2');
  const save = raw ? JSON.parse(raw) : null;
  const header = document.querySelector('.world-id img');
  const resources = performance.getEntriesByType('resource')
    .map((e) => e.name)
    .filter((n) => n.includes('/characters/'))
    .map((n) => n.split('/characters/')[1]);
  const sheet = document.querySelector('.world-sheet');
  const cards = [...document.querySelectorAll('.world-skin-card')].map((el) => ({
    label: el.innerText.trim(),
    active: el.classList.contains('m-active'),
    checked: el.getAttribute('aria-checked'),
    avatar: el.querySelector('img')?.getAttribute('src') ?? null,
  }));
  return {
    skin: save?.world?.skin ?? null,
    headerAvatar: header?.getAttribute('src') ?? null,
    characterResources: [...new Set(resources)].sort(),
    sheetOpen: Boolean(sheet),
    sheetHeight: sheet ? Math.round(sheet.getBoundingClientRect().height) : null,
    cards,
    canvasCount: document.querySelectorAll('.world-canvas canvas').length,
    world: window.__world ? { x: Math.round(window.__world.player.x), room: window.__world.room.id } : null,
  };
})()`);

try {
  await waitFor(async () => (await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok);
  const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const page = targets.find((t) => t.type === "page");
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const entry = pending.get(message.id);
      if (!entry) return;
      pending.delete(message.id);
      if (message.error) entry.reject(new Error(JSON.stringify(message.error)));
      else entry.resolve(message.result);
      return;
    }
    if (message.method === "Runtime.consoleAPICalled") {
      if (message.params.type === "error" || message.params.type === "warning") {
        consoleLines.push(`${message.params.type}: ${message.params.args.map((a) => a.value ?? a.description ?? "").join(" ")}`);
      }
    }
    if (message.method === "Runtime.exceptionThrown") {
      exceptions.push(message.params.exceptionDetails?.text || "exception");
    }
  };

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Log.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
    screenWidth: 390,
    screenHeight: 844,
    screenOrientation: { type: "portraitPrimary", angle: 0 },
  });

  await send("Page.navigate", { url: URL });
  await waitFor(async () => (await evaluate("document.readyState")) === "complete");
  await evaluate("localStorage.clear()");
  // Note: no `skin` field -> exercises the legacy/default path.
  await evaluate(`localStorage.setItem('wenbebi-mobile-game-v2', ${JSON.stringify(JSON.stringify(seed))})`);
  await send("Page.reload", { ignoreCache: true });
  await waitFor(async () => await evaluate(`!!window.__world && !!document.querySelector('.world-canvas canvas')`), 25000);
  await sleep(1600);

  report.steps.default = await snapshot();
  await shot("01-default-original-390x844");

  // Open the more sheet and inspect the picker.
  await evaluate(`[...document.querySelectorAll('.world-nav button')].find((b) => b.innerText.includes('更多'))?.click()`);
  await sleep(600);
  report.steps.moreSheet = await snapshot();
  await shot("02-more-skins-390x844");

  // Switch to the maid skin.
  await evaluate(`[...document.querySelectorAll('.world-skin-card')].find((el) => el.innerText.includes('小鲸鱼'))?.click()`);
  await sleep(1500);
  report.steps.afterMaidClick = await snapshot();
  await shot("03-maid-selected-390x844");

  // Close the sheet so the whole scene is visible.
  await evaluate(`document.querySelector('.world-sheet-close')?.click()`);
  await sleep(700);
  report.steps.maidScene = await snapshot();
  await shot("04-maid-scene-390x844");

  // Tap her body: react pose should still fire for the maid skin.
  const bodyAt = await evaluate(`(() => {
    const w = window.__world;
    const el = document.querySelector('.world-canvas canvas');
    const r = el.getBoundingClientRect();
    const s = r.height / 1000;
    return { x: r.left + (w.player.x - w.cameraX) * s, y: r.top + (w.player.y - 150) * s };
  })()`);
  await tap(bodyAt.x, bodyAt.y);
  await sleep(500);
  report.steps.maidTap = {
    toast: await evaluate(`document.querySelector('.world-toast')?.innerText ?? null`),
    pose: await evaluate(`window.__world?.player?.pose ?? null`),
  };
  await shot("05-maid-tap-390x844");

  // Reload: maid must persist.
  await send("Page.reload", { ignoreCache: true });
  await waitFor(async () => await evaluate(`!!window.__world && !!document.querySelector('.world-canvas canvas')`), 25000);
  await sleep(1500);
  report.steps.afterReload = await snapshot();
  await shot("06-maid-after-reload-390x844");

  // Switch back to the original white skin.
  await evaluate(`[...document.querySelectorAll('.world-nav button')].find((b) => b.innerText.includes('更多'))?.click()`);
  await sleep(500);
  await evaluate(`[...document.querySelectorAll('.world-skin-card')].find((el) => el.innerText.includes('白色'))?.click()`);
  await sleep(900);
  await evaluate(`document.querySelector('.world-sheet-close')?.click()`);
  await sleep(700);
  report.steps.backToOriginal = await snapshot();
  await shot("07-original-again-390x844");

  // Reload once more: white persists.
  await send("Page.reload", { ignoreCache: true });
  await waitFor(async () => await evaluate(`!!window.__world && !!document.querySelector('.world-canvas canvas')`), 25000);
  await sleep(1500);
  report.steps.originalAfterReload = await snapshot();
  await shot("08-original-after-reload-390x844");

  const d = report.steps.default;
  const m = report.steps.afterMaidClick;
  const back = report.steps.originalAfterReload;
  report.checks = {
    defaultIsOriginal: d.skin === "original",
    defaultHeaderAvatarOriginal: (d.headerAvatar || "").includes("/original/"),
    defaultLoadsOriginalFrames: d.characterResources.some((r) => r.startsWith("original/")),
    pickerHasTwoSkins: report.steps.moreSheet.cards.length === 2,
    pickerDefaultActiveOriginal: report.steps.moreSheet.cards.find((c) => c.active)?.label?.includes("白色") ?? false,
    maidSwitchPersisted: m.skin === "maid",
    maidHeaderAvatar: (m.headerAvatar || "").includes("/maid/"),
    maidFramesLoaded: m.characterResources.some((r) => r.startsWith("maid/")),
    maidSurvivesReload: report.steps.afterReload.skin === "maid",
    maidTapHasFeedback: Boolean(report.steps.maidTap.toast) && report.steps.maidTap.pose === "react",
    backToOriginalPersisted: back.skin === "original",
    sheetWithinBudget: (report.steps.moreSheet.sheetHeight ?? 9999) <= 340,
    noConsoleErrors: consoleLines.length === 0,
    noExceptions: exceptions.length === 0,
  };

  report.consoleLines = consoleLines;
  report.exceptions = exceptions;
  await writeFile(`${OUT}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  try { ws?.close(); } catch { /* ignore */ }
  chrome.kill("SIGTERM");
  await sleep(250);
}
