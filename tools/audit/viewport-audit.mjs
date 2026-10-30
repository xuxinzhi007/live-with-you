import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9339;
const OUT = "/tmp/wenbebi-v2-viewports";
const URL = "http://localhost:5199/?mobile";
const VIEWPORTS = [
  { name: "360x640", width: 360, height: 640 },
  { name: "390x844", width: 390, height: 844 },
  { name: "430x932", width: 430, height: 932 },
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await mkdir(OUT, { recursive: true });

const chrome = spawn(CHROME, [
  "--headless=new",
  `--remote-debugging-port=${PORT}`,
  "--user-data-dir=/tmp/wenbebi-v2-chrome-viewports",
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

async function evaluate(expression) {
  const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "evaluate failed");
  return result.result.value;
}

async function waitFor(fn, timeout = 25000) {
  const start = Date.now();
  let last;
  while (Date.now() - start < timeout) {
    try {
      const value = await fn();
      if (value) return value;
    } catch (error) {
      last = error?.message || String(error);
    }
    await sleep(150);
  }
  throw new Error(`waitFor timeout: ${last}`);
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

const report = { url: URL, viewports: {} };

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
    if (message.method === "Runtime.exceptionThrown") {
      exceptions.push(message.params.exceptionDetails?.text || "exception");
    }
  };

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Page.navigate", { url: URL });
  await waitFor(async () => (await evaluate("document.readyState")) === "complete");
  await evaluate(`localStorage.setItem('wenbebi-mobile-game-v2', ${JSON.stringify(JSON.stringify(seed))})`);

  for (const viewport of VIEWPORTS) {
    await send("Emulation.setDeviceMetricsOverride", {
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: 2,
      mobile: true,
      screenWidth: viewport.width,
      screenHeight: viewport.height,
      screenOrientation: { type: "portraitPrimary", angle: 0 },
    });
    await send("Page.reload", { ignoreCache: true });
    await waitFor(async () => await evaluate(`!!window.__world && !!document.querySelector('.world-canvas canvas')`), 25000);
    await sleep(1400);

    report.viewports[viewport.name] = await evaluate(`(() => {
      const q = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
      };
      const small = [...document.querySelectorAll('#world-root button, #world-root a')]
        .map((el) => {
          const r = el.getBoundingClientRect();
          return { text: (el.getAttribute('aria-label') || el.innerText || '').trim().slice(0, 18), w: Math.round(r.width), h: Math.round(r.height) };
        })
        .filter((t) => t.w > 0 && t.h > 0 && (t.w < 44 || t.h < 44));
      const top = q('.world-top');
      const nav = q('.world-nav');
      const cta = q('.world-cta');
      const scale = document.querySelector('.world-canvas canvas').getBoundingClientRect().height / 1000;
      const player = window.__world.player;
      const canvasRect = document.querySelector('.world-canvas canvas').getBoundingClientRect();
      const feet = canvasRect.top + player.y * scale;
      const head = feet - 300 * scale;
      return {
        viewport: { w: innerWidth, h: innerHeight, dpr: devicePixelRatio },
        canvas: q('.world-canvas canvas'),
        nav,
        navItems: document.querySelectorAll('.world-nav button').length,
        hudContentPx: (q('.world-id')?.h ?? 0) + nav.h,
        hudContentPct: Math.round(((q('.world-id')?.h ?? 0) + nav.h) / innerHeight * 1000) / 10,
        topOverlayH: top.h,
        cta,
        smallTargets: small,
        bodyScroll: { w: document.body.scrollWidth, h: document.body.scrollHeight },
        character: {
          head: Math.round(head),
          feet: Math.round(feet),
          overlapsTop: head < (q('.world-top')?.h ?? 0),
          underNav: feet > (nav?.y ?? innerHeight),
          underCta: Boolean(cta) && feet > cta.y && head < cta.y + cta.h,
        },
        room: window.__world.room.id,
      };
    })()`);

    const { data } = await send("Page.captureScreenshot", { format: "png", fromSurface: true }, 25000);
    await writeFile(`${OUT}/${viewport.name}.png`, Buffer.from(data, "base64"));
  }

  report.exceptions = exceptions;
  await writeFile(`${OUT}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  try { ws?.close(); } catch { /* ignore */ }
  chrome.kill("SIGTERM");
  await sleep(200);
}
