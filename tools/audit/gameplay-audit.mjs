import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9338;
const OUT = "/tmp/wenbebi-v2-final";
const URL = "http://localhost:5199/?mobile";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await mkdir(OUT, { recursive: true });

const chrome = spawn(CHROME, [
  "--headless=new",
  `--remote-debugging-port=${PORT}`,
  "--user-data-dir=/tmp/wenbebi-v2-chrome-final",
  "--no-first-run",
  "--no-default-browser-check",
  "--hide-scrollbars",
  "--window-size=390,844",
  "--force-device-scale-factor=1",
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
  const result = await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  }, timeout);
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

const report = { url: URL, viewport: "390x844", steps: {}, checks: {} };

const worldState = () => evaluate(`(() => {
  const w = window.__world;
  if (!w) return null;
  return {
    room: w.room.id,
    x: Math.round(w.player.x),
    y: Math.round(w.player.y),
    moving: w.player.moving,
    pose: w.player.pose,
    cameraX: Math.round(w.cameraX),
    viewW: Math.round(w.viewW),
    maxCameraX: Math.round(w.maxCameraX),
    nearest: w.nearest ? w.nearest.id : null,
    ballX: w.ball ? Math.round(w.ball.x) : null,
    ballY: w.ball ? Math.round(w.ball.y) : null,
    ballCombo: w.ball ? w.ball.combo : null,
    ballBounce: Boolean(w.ball && w.ball.bounce),
    ballDistance: Math.round(w.ballDistance ? w.ballDistance() : -1),
  };
})()`);

const canvasBox = () => evaluate(`(() => {
  const c = document.querySelector('.world-canvas canvas');
  if (!c) return null;
  const r = c.getBoundingClientRect();
  return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, w: r.width, h: r.height, scale: r.height / 1000 };
})()`);

const propScreen = (propId) => evaluate(`(() => {
  const w = window.__world;
  const el = document.querySelector('.world-canvas canvas');
  if (!w || !el) return null;
  const r = el.getBoundingClientRect();
  const s = r.height / 1000;
  const prop = w.room.props.find((p) => p.id === ${JSON.stringify(propId)});
  if (!prop) return null;
  return {
    x: r.left + (prop.x - w.cameraX) * s,
    y: r.top + (prop.y - prop.h * 0.42) * s,
    scale: s,
    onScreen: r.left + (prop.x - w.cameraX) * s > r.left && r.left + (prop.x - w.cameraX) * s < r.right,
    prop: { id: prop.id, x: prop.x, y: prop.y, w: prop.w, h: prop.h, action: prop.action || null, doorTo: prop.doorTo || null },
  };
})()`);

const propWorld = (propId) => evaluate(`(() => {
  const w = window.__world;
  const p = w && w.room.props.find((p) => p.id === ${JSON.stringify(propId)});
  return p ? { x: p.x, y: p.y } : null;
})()`);

const ctaInfo = () => evaluate(`(() => {
  const el = document.querySelector('.world-cta');
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { text: el.innerText.trim(), x: r.left + r.width / 2, y: r.top + r.height / 2, w: Math.round(r.width), h: Math.round(r.height) };
})()`);

const saveState = () => evaluate(`(() => {
  const raw = localStorage.getItem('wenbebi-mobile-game-v2');
  if (!raw) return null;
  const s = JSON.parse(raw);
  return {
    coins: s.coins, seeds: s.seeds, flowers: s.flowers, mementos: s.mementos,
    energy: s.pet?.energy, happiness: s.pet?.happiness,
    room: s.world?.room,
    plots: (s.world?.plots || []).map((p) => ({ kind: p.kind, wateredAt: p.wateredAt })),
    collection: s.world?.collection,
    bestCombo: s.world?.bestCombo,
    harvested: s.world?.harvested,
    seenIntro: s.world?.seenIntro,
    journal: (s.journal || []).slice(0, 4).map((e) => e.text),
  };
})()`);

const ctaText = async () => (await ctaInfo())?.text ?? null;
const toastText = () => evaluate(`document.querySelector('.world-toast')?.innerText ?? null`);

async function walkToWorld(wx, wy = 868, tries = 9) {
  for (let i = 0; i < tries; i += 1) {
    const w = await worldState();
    const box = await canvasBox();
    if (!w || !box) return false;
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

/**
 * Stop ~170 units away, tap the prop (only approaches), wait until next to it.
 * The contextual CTA performs the action, matching the documented interaction.
 */
async function goToProp(propId) {
  const at = await propWorld(propId);
  if (!at) return { ok: false, reason: "missing prop" };
  const room = await evaluate(`(() => window.__world ? { walk: window.__world.room.walk } : null)()`);
  if (!room) return { ok: false, reason: "no room" };
  const gap = 170;
  const preferLeft = at.x - gap >= room.walk.x0 + 20;
  const standX = preferLeft ? at.x - gap : Math.min(room.walk.x1 - 20, at.x + gap);
  const walked = await walkToWorld(standX, 868);
  await sleep(350);
  const screen = await propScreen(propId);
  if (!screen) return { ok: false, reason: "no screen pos" };
  await tap(screen.x, screen.y);
  if (screen.prop.doorTo) {
    await sleep(2000);
    return { ok: true, walked, screen, auto: "door" };
  }
  const arrived = await waitFor(async () => {
    const w = await worldState();
    return w && !w.moving && w.nearest === propId;
  }, 15000).catch(() => false);
  return { ok: true, walked, arrived, screen };
}

async function tapCtaAndWait() {
  const cta = await ctaInfo();
  if (!cta) return null;
  await tap(cta.x, cta.y);
  await sleep(900);
  return cta;
}

function seedBase(overrides = {}) {
  const now = Date.now();
  const plots = [
    { kind: null, plantedAt: 0, wateredAt: 0 },
    { kind: null, plantedAt: 0, wateredAt: 0 },
    { kind: null, plantedAt: 0, wateredAt: 0 },
  ];
  return {
    version: 2,
    currentScene: "bedroom",
    pet: { currentAction: "idle", mood: "normal", energy: 60, happiness: 60, lastInteraction: now },
    player: null,
    coins: 18,
    seeds: 1,
    flowers: 0,
    mementos: 0,
    bond: 0,
    exploredScenes: ["bedroom"],
    bondedMoments: [],
    journal: [],
    lastCoplayId: null,
    lastCoplayAt: 0,
    world: {
      room: "home",
      plots,
      cooldowns: {},
      bestCombo: 0,
      seenIntro: true,
      planted: 0,
      harvested: 0,
      kicks: 0,
      collection: { daisy: 0, rose: 0, sunflower: 0 },
      visited: ["home"],
    },
    ...overrides,
  };
}

async function seedAndReload(seed) {
  await evaluate(`localStorage.setItem('wenbebi-mobile-game-v2', ${JSON.stringify(JSON.stringify(seed))})`);
  await send("Page.reload", { ignoreCache: true });
  await waitFor(async () => await evaluate(`!!window.__world && !!document.querySelector('.world-canvas canvas')`), 25000);
  await sleep(1500);
}

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

  // ---------- 1. first run / intro ----------
  await send("Page.navigate", { url: URL });
  await waitFor(async () => (await evaluate("document.readyState")) === "complete");
  await evaluate("localStorage.clear()");
  const introSeed = seedBase();
  introSeed.world.seenIntro = false;
  await evaluate(`localStorage.setItem('wenbebi-mobile-game-v2', ${JSON.stringify(JSON.stringify(introSeed))})`);
  await send("Page.reload", { ignoreCache: true });
  await waitFor(async () => await evaluate(`!!document.querySelector('.world-intro')`), 25000);
  await sleep(700);
  await shot("01-intro-390x844");
  report.steps.intro = await evaluate(`(() => {
    const r = document.querySelector('.world-intro-card button').getBoundingClientRect();
    return { title: document.querySelector('#world-intro-title')?.innerText, button: { w: Math.round(r.width), h: Math.round(r.height) } };
  })()`);
  await evaluate(`document.querySelector('.world-intro-card button')?.click()`);
  await sleep(600);

  // ---------- 2. home baseline ----------
  await seedAndReload(seedBase());
  await shot("02-home-390x844");
  report.steps.home = await evaluate(`(() => {
    const q = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    };
    const small = [...document.querySelectorAll('#world-root button, #world-root a')]
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { text: (el.getAttribute('aria-label') || el.innerText || '').trim().slice(0, 20), w: Math.round(r.width), h: Math.round(r.height) };
      })
      .filter((t) => t.w > 0 && t.h > 0 && (t.w < 44 || t.h < 44));
    const top = q('.world-top');
    const nav = q('.world-nav');
    return {
      viewport: { w: innerWidth, h: innerHeight, dpr: devicePixelRatio },
      canvas: q('.world-canvas canvas'),
      nav, navItems: document.querySelectorAll('.world-nav button').length,
      hudContentPx: (q('.world-id')?.h ?? 0) + nav.h,
      hudContentPct: Math.round(((q('.world-id')?.h ?? 0) + nav.h) / innerHeight * 1000) / 10,
      topOverlayH: top.h,
      smallTargets: small,
      bodyScroll: { w: document.body.scrollWidth, h: document.body.scrollHeight },
      label: document.querySelector('.world-id')?.innerText,
      cta: q('.world-cta'),
    };
  })()`);
  report.steps.home.world = await worldState();

  // ---------- 3. player tap ----------
  const box = await canvasBox();
  const feet = await evaluate(`(() => {
    const w = window.__world;
    const el = document.querySelector('.world-canvas canvas');
    const r = el.getBoundingClientRect();
    const s = r.height / 1000;
    return { x: r.left + (w.player.x - w.cameraX) * s, y: r.top + (w.player.y - 150) * s };
  })()`);
  await tap(feet.x, feet.y);
  await sleep(500);
  report.steps.tapPlayer = { world: await worldState(), toast: await toastText() };
  await shot("03-tap-player-390x844");

  // ---------- 4. walking + camera ----------
  const walkTarget = await evaluate(`(() => {
    const w = window.__world;
    const el = document.querySelector('.world-canvas canvas');
    const r = el.getBoundingClientRect();
    const s = r.height / 1000;
    const wx = Math.min(w.cameraX + w.viewW - 80, w.player.x + 240);
    return { x: r.left + (wx - w.cameraX) * s, y: r.top + 868 * s, wx };
  })()`);
  await tap(walkTarget.x, walkTarget.y);
  await sleep(380);
  report.steps.walkMid = { world: await worldState(), shot: "04-walk-mid-390x844" };
  await shot("04-walk-mid-390x844");
  await waitFor(async () => {
    const w = await worldState();
    return w && !w.moving;
  }, 8000);
  report.steps.walkEnd = { world: await worldState() };
  await shot("05-walk-end-390x844");

  // ---------- 5. bed: rest ----------
  report.steps.bedNav = await goToProp("bed");
  report.steps.nearBed = { world: await worldState(), cta: await ctaInfo() };
  await shot("06-near-bed-390x844");
  const beforeRest = await saveState();
  const restCta = await tapCtaAndWait();
  report.steps.afterRest = {
    ctaClicked: restCta?.text ?? null,
    world: await worldState(),
    cta: await ctaInfo(),
    toast: await toastText(),
    save: await saveState(),
    energyDelta: (await saveState())?.energy - beforeRest.energy,
  };
  await shot("07-rested-390x844");

  // ---------- 6. garden via door ----------
  report.steps.doorNav = await goToProp("home-garden-door");
  await waitFor(async () => (await worldState())?.room === "garden", 12000).catch(() => null);
  await sleep(1200);
  report.steps.garden = { world: await worldState(), save: await saveState(), cta: await ctaInfo() };
  await shot("08-garden-390x844");

  // ---------- 7. plant ----------
  report.steps.plotNav = await goToProp("plot-0");
  report.steps.nearPlot = { world: await worldState(), cta: await ctaInfo() };
  await shot("09-near-plot-390x844");
  const plantCta = await tapCtaAndWait();
  report.steps.afterPlant = {
    ctaClicked: plantCta?.text ?? null,
    world: await worldState(),
    toast: await toastText(),
    save: await saveState(),
    cta: await ctaInfo(),
  };
  await shot("10-planted-390x844");

  // Water once: the CTA switches to 浇水 after planting.
  const waterCta = await tapCtaAndWait();
  report.steps.afterWater = {
    ctaClicked: waterCta?.text ?? null,
    world: await worldState(),
    toast: await toastText(),
    save: await saveState(),
    cta: await ctaInfo(),
  };
  await shot("10b-watered-390x844");

  // ---------- 8. ball kick + catch (world tap on the ball) ----------
  report.steps.ballNav = await goToProp("garden-ball");
  report.steps.nearBall = { world: await worldState(), cta: await ctaInfo() };
  const kickCta = await tapCtaAndWait();
  report.steps.ballKicked = { ctaClicked: kickCta?.text ?? null, world: await worldState(), toast: await toastText() };

  let ballWindow = null;
  for (let i = 0; i < 40; i += 1) {
    const canCatch = await evaluate(`(() => window.__world.canCatch())()`);
    if (canCatch) { ballWindow = await worldState(); break; }
    await sleep(80);
  }
  report.steps.ballWindow = { world: ballWindow };
  await shot("11-ball-bounce-390x844");

  const ballAt = await evaluate(`(() => {
    const w = window.__world;
    const el = document.querySelector('.world-canvas canvas');
    if (!w || !w.ball || !el) return null;
    const r = el.getBoundingClientRect();
    const s = r.height / 1000;
    return { x: r.left + (w.ball.x - w.cameraX) * s, y: r.top + (w.ball.y - 8) * s, canCatch: w.canCatch() };
  })()`);
  report.steps.ballScreen = ballAt;
  if (ballAt && ballAt.canCatch) {
    await tap(ballAt.x, ballAt.y);
    await sleep(600);
  }
  report.steps.afterCatch = {
    world: await worldState(),
    toast: await toastText(),
    save: await saveState(),
  };
  await shot("12-caught-390x844");

  // ---------- 9. harvest a matured plot ----------
  const mature = seedBase({ currentScene: "balcony", seeds: 0, flowers: 0 });
  mature.world.room = "garden";
  mature.world.visited = ["home", "garden"];
  mature.world.plots = [
    { kind: "daisy", plantedAt: Date.now() - 90_000, wateredAt: 0 },
    { kind: null, plantedAt: 0, wateredAt: 0 },
    { kind: null, plantedAt: 0, wateredAt: 0 },
  ];
  await seedAndReload(mature);
  await shot("13-garden-mature-390x844");
  report.steps.matureNav = await goToProp("plot-0");
  report.steps.matureCta = { world: await worldState(), cta: await ctaInfo() };
  const harvestCta = await tapCtaAndWait();
  await sleep(700);
  report.steps.afterHarvest = {
    ctaClicked: harvestCta?.text ?? null,
    save: await saveState(),
    toast: await toastText(),
    world: await worldState(),
  };
  await shot("14-harvested-390x844");

  // ---------- 10. street flower stall ----------
  const streetSeed = seedBase({ currentScene: "street", coins: 18, seeds: 0 });
  streetSeed.world.room = "street";
  streetSeed.world.visited = ["home", "street"];
  await seedAndReload(streetSeed);
  await shot("15-street-390x844");
  report.steps.street = { world: await worldState() };
  report.steps.stallNav = await goToProp("flower-stall");
  report.steps.nearStall = { world: await worldState(), cta: await ctaInfo() };
  await shot("16-near-stall-390x844");
  const beforeBuy = await saveState();
  const buyCta = await tapCtaAndWait();
  const afterBuy = await saveState();
  report.steps.afterBuy = {
    ctaClicked: buyCta?.text ?? null,
    coins: afterBuy.coins,
    seeds: afterBuy.seeds,
    coinDelta: afterBuy.coins - beforeBuy.coins,
    seedDelta: afterBuy.seeds - beforeBuy.seeds,
    toast: await toastText(),
    world: await worldState(),
  };
  await shot("17-bought-390x844");

  // ---------- 11. sheets ----------
  await evaluate(`[...document.querySelectorAll('.world-nav button')].find((b) => b.innerText.includes('背包'))?.click()`);
  await sleep(500);
  await shot("18-bag-sheet-390x844");
  report.steps.bagSheet = await evaluate(`(() => {
    const close = document.querySelector('.world-sheet-close')?.getBoundingClientRect();
    return {
      open: !!document.querySelector('.world-sheet'),
      title: document.querySelector('.world-sheet-head h2')?.innerText,
      close: close ? { w: Math.round(close.width), h: Math.round(close.height) } : null,
      body: document.querySelector('.world-sheet')?.innerText.slice(0, 200),
    };
  })()`);
  await evaluate(`document.querySelector('.world-sheet-close')?.click()`);
  await sleep(300);

  await evaluate(`[...document.querySelectorAll('.world-nav button')].find((b) => b.innerText.includes('手账'))?.click()`);
  await sleep(400);
  await shot("19-journal-sheet-390x844");
  report.steps.journalSheet = await evaluate(`(() => ({
    open: !!document.querySelector('.world-sheet'),
    count: document.querySelectorAll('.world-journal-entry').length,
    empty: document.querySelector('.world-empty')?.innerText ?? null,
  }))()`);
  await evaluate(`document.querySelector('.world-sheet-close')?.click()`);
  await sleep(300);

  await evaluate(`[...document.querySelectorAll('.world-nav button')].find((b) => b.innerText.includes('更多'))?.click()`);
  await sleep(400);
  await shot("20-more-sheet-390x844");
  report.steps.moreSheet = await evaluate(`(() => {
    const sheet = document.querySelector('.world-sheet');
    const r = sheet?.getBoundingClientRect();
    return {
      open: !!sheet,
      h: r ? Math.round(r.height) : null,
      pct: r ? Math.round((r.height / innerHeight) * 1000) / 10 : null,
      text: sheet?.innerText.slice(0, 200),
    };
  })()`);
  await evaluate(`document.querySelector('.world-sheet-close')?.click()`);
  await sleep(300);

  // ---------- 12. persistence ----------
  await seedAndReload(seedBase({ currentScene: "balcony", coins: 7, seeds: 2, flowers: 3 }));
  const persisted = await saveState();
  report.steps.persistence = {
    save: persisted,
    world: await worldState(),
  };
  await shot("21-reload-persisted-390x844");

  report.consoleLines = consoleLines;
  report.exceptions = exceptions;
  report.screenshots = [
    "01-intro-390x844.png",
    "02-home-390x844.png",
    "03-tap-player-390x844.png",
    "04-walk-mid-390x844.png",
    "05-walk-end-390x844.png",
    "06-near-bed-390x844.png",
    "07-rested-390x844.png",
    "08-garden-390x844.png",
    "09-near-plot-390x844.png",
    "10-planted-390x844.png",
    "10b-watered-390x844.png",
    "11-ball-bounce-390x844.png",
    "12-caught-390x844.png",
    "13-garden-mature-390x844.png",
    "14-harvested-390x844.png",
    "15-street-390x844.png",
    "16-near-stall-390x844.png",
    "17-bought-390x844.png",
    "18-bag-sheet-390x844.png",
    "19-journal-sheet-390x844.png",
    "20-more-sheet-390x844.png",
    "21-reload-persisted-390x844.png",
  ];

  await writeFile(`${OUT}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  try { ws?.close(); } catch { /* ignore */ }
  chrome.kill("SIGTERM");
  await sleep(250);
}
