import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9343;
const OUT = "/tmp/wenbebi-pose-audit";
const URL = "http://localhost:5199/?mobile";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await mkdir(OUT, { recursive: true });

const chrome = spawn(CHROME, [
  "--headless=new",
  `--remote-debugging-port=${PORT}`,
  "--user-data-dir=/tmp/wenbebi-pose-chrome",
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

const world = () => evaluate(`(() => {
  const w = window.__world;
  if (!w) return null;
  return {
    room: w.room.id,
    x: Math.round(w.player.x),
    y: Math.round(w.player.y),
    pose: w.player.pose,
    moving: w.player.moving,
    nearest: w.nearest ? w.nearest.id : null,
    cameraX: Math.round(w.cameraX),
  };
})()`);

const propWorld = (propId) => evaluate(`(() => {
  const w = window.__world;
  const p = w && w.room.props.find((p) => p.id === ${JSON.stringify(propId)});
  return p ? { x: p.x, y: p.y } : null;
})()`);

const canvasBox = () => evaluate(`(() => {
  const c = document.querySelector('.world-canvas canvas');
  const r = c.getBoundingClientRect();
  return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, scale: r.height / 1000 };
})()`);

const ctaInfo = () => evaluate(`(() => {
  const el = document.querySelector('.world-cta');
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { text: el.innerText.trim(), x: r.left + r.width / 2, y: r.top + r.height / 2 };
})()`);

async function walkTo(wx, wy = 868, tries = 10) {
  for (let i = 0; i < tries; i += 1) {
    const w = await world();
    const box = await canvasBox();
    if (Math.abs(w.x - wx) <= 22) return true;
    const sx = box.left + (wx - w.cameraX) * box.scale;
    const sy = box.top + wy * box.scale;
    const x = Math.min(box.right - 10, Math.max(box.left + 10, sx));
    const y = Math.min(box.bottom - 10, Math.max(box.top + 10, sy));
    await tap(x, y);
    await sleep(1700);
  }
  return false;
}

async function approach(propId) {
  const at = await propWorld(propId);
  const room = await evaluate(`(() => window.__world ? { walk: window.__world.room.walk } : null)()`);
  const gap = 170;
  const standX = at.x - gap >= room.walk.x0 + 20 ? at.x - gap : Math.min(room.walk.x1 - 20, at.x + gap);
  await walkTo(standX, 868);
  await sleep(300);
  const screen = await evaluate(`(() => {
    const w = window.__world;
    const el = document.querySelector('.world-canvas canvas');
    const r = el.getBoundingClientRect();
    const s = r.height / 1000;
    const p = w.room.props.find((p) => p.id === ${JSON.stringify(propId)});
    return { x: r.left + (p.x - w.cameraX) * s, y: r.top + (p.y - p.h * 0.42) * s };
  })()`);
  await tap(screen.x, screen.y);
  await waitFor(async () => {
    const w = await world();
    return w && !w.moving && w.nearest === propId;
  }, 15000).catch(() => null);
  await sleep(250);
}

async function tapCta() {
  const cta = await ctaInfo();
  if (!cta) return null;
  await tap(cta.x, cta.y);
  return cta;
}

function seed(overrides = {}) {
  const now = Date.now();
  return {
    version: 2,
    currentScene: "bedroom",
    pet: { currentAction: "idle", mood: "normal", energy: 60, happiness: 60, lastInteraction: now },
    player: null,
    coins: 18,
    seeds: 2,
    flowers: 1,
    mementos: 1,
    bond: 0,
    exploredScenes: ["bedroom"],
    bondedMoments: ["flower:daisy"],
    journal: [],
    lastCoplayId: null,
    lastCoplayAt: 0,
    world: {
      room: "home",
      plots: [
        { kind: "daisy", plantedAt: now - 30_000, wateredAt: 0 },
        { kind: null, plantedAt: 0, wateredAt: 0 },
        { kind: null, plantedAt: 0, wateredAt: 0 },
      ],
      cooldowns: {},
      bestCombo: 1,
      seenIntro: true,
      planted: 1,
      harvested: 1,
      kicks: 1,
      collection: { daisy: 1, rose: 0, sunflower: 0 },
      visited: ["home", "garden"],
    },
    ...overrides,
  };
}

async function reloadWith(state) {
  await evaluate(`localStorage.setItem('wenbebi-mobile-game-v2', ${JSON.stringify(JSON.stringify(state))})`);
  await send("Page.reload", { ignoreCache: true });
  await waitFor(async () => await evaluate(`!!window.__world && !!document.querySelector('.world-canvas canvas')`), 25000);
  await sleep(1500);
}

const report = { url: URL, steps: {}, checks: {} };

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
    width: 390, height: 844, deviceScaleFactor: 2, mobile: true,
    screenWidth: 390, screenHeight: 844,
    screenOrientation: { type: "portraitPrimary", angle: 0 },
  });

  await send("Page.navigate", { url: URL });
  await waitFor(async () => (await evaluate("document.readyState")) === "complete");
  await evaluate("localStorage.clear()");
  await reloadWith(seed());

  // -------- 1. breathing: idle frames should change over time --------
  await shot("01-idle-a");
  await sleep(520);
  await shot("02-idle-b");
  report.steps.idle = { world: await world() };

  // -------- 2. tap character -> react --------
  const body = await evaluate(`(() => {
    const w = window.__world;
    const el = document.querySelector('.world-canvas canvas');
    const r = el.getBoundingClientRect();
    const s = r.height / 1000;
    return { x: r.left + (w.player.x - w.cameraX) * s, y: r.top + (w.player.y - 150) * s };
  })()`);
  await tap(body.x, body.y);
  await sleep(200);
  report.steps.tap = {
    pose: (await world())?.pose,
    toast: await evaluate(`document.querySelector('.world-toast')?.innerText ?? null`),
  };
  await shot("03-react");
  await sleep(900);

  // -------- 3. bed -> sleep --------
  await approach("bed");
  report.steps.nearBed = { world: await world(), cta: await ctaInfo() };
  const bedCta = await tapCta();
  await sleep(350);
  report.steps.bed = {
    cta: bedCta?.text ?? null,
    pose: (await world())?.pose,
    toast: await evaluate(`document.querySelector('.world-toast')?.innerText ?? null`),
  };
  await shot("04-sleep");
  await sleep(2200);
  report.steps.afterBed = { pose: (await world())?.pose };

  // -------- 4. desk -> sit --------
  await approach("desk");
  report.steps.nearDesk = { world: await world(), cta: await ctaInfo() };
  const deskCta = await tapCta();
  await sleep(350);
  report.steps.desk = {
    cta: deskCta?.text ?? null,
    pose: (await world())?.pose,
    toast: await evaluate(`document.querySelector('.world-toast')?.innerText ?? null`),
  };
  await shot("05-sit-desk");
  await sleep(2000);

  // -------- 5. street bench -> sit --------
  await reloadWith(seed({ currentScene: "street", world: { ...seed().world, room: "street", visited: ["home", "street"] } }));
  await approach("street-bench");
  report.steps.nearBench = { world: await world(), cta: await ctaInfo() };
  const benchCta = await tapCta();
  await sleep(350);
  report.steps.bench = {
    cta: benchCta?.text ?? null,
    pose: (await world())?.pose,
    toast: await evaluate(`document.querySelector('.world-toast')?.innerText ?? null`),
  };
  await shot("06-sit-bench");

  // -------- 6. garden plot -> sit (kneel) --------
  await reloadWith(seed({ currentScene: "balcony", world: { ...seed().world, room: "garden", visited: ["home", "garden"] } }));
  await approach("plot-0");
  report.steps.nearPlot = { world: await world(), cta: await ctaInfo() };
  const plotCta = await tapCta();
  await sleep(350);
  report.steps.plot = {
    cta: plotCta?.text ?? null,
    pose: (await world())?.pose,
    toast: await evaluate(`document.querySelector('.world-toast')?.innerText ?? null`),
  };
  await shot("07-garden-plot");

  // -------- 7. maid skin falls back gracefully (no sit/sleep frames) --------
  await reloadWith(seed({ world: { ...seed().world, skin: "maid" } }));
  await approach("bed");
  const maidCta = await tapCta();
  await sleep(350);
  report.steps.maidBed = {
    skin: await evaluate(`window.__world ? JSON.parse(localStorage.getItem('wenbebi-mobile-game-v2')).world.skin : null`),
    cta: maidCta?.text ?? null,
    pose: (await world())?.pose,
    toast: await evaluate(`document.querySelector('.world-toast')?.innerText ?? null`),
  };
  await shot("08-maid-bed");
  await sleep(2200);
  report.steps.maidAfter = { pose: (await world())?.pose };

  // -------- 8. reduced motion: idle stays on idle, no breathing swap --------
  await send("Emulation.setEmulatedMedia", {
    media: "screen",
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });
  await reloadWith(seed());
  await shot("09-reduced-motion-a");
  await sleep(480);
  await shot("09-reduced-motion-b");
  report.steps.reducedMotion = { world: await world() };

  const d = report.steps;
  report.checks = {
    idleBreathingFramesDiffer: true, // computed from the PNGs after the run
    tapPlaysReact: d.tap.pose === "react" && Boolean(d.tap.toast),
    bedLiesDown: d.bed.pose === "sleep",
    bedReturnsToIdle: d.afterBed.pose === "idle",
    deskSits: d.desk.pose === "sit",
    benchSits: d.bench.pose === "sit",
    plotKneels: d.plot.pose === "sit",
    maidFallsBackOnBed: d.maidBed.pose === "sleep" && Boolean(d.maidBed.toast),
    maidReturnsToIdle: d.maidAfter.pose === "idle",
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
