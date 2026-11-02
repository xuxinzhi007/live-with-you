import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9351;
const URL = "http://localhost:5231/";
const OUT = "/tmp/l2ddemo/out";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, [
  "--headless=new",
  `--remote-debugging-port=${PORT}`,
  "--user-data-dir=/tmp/l2d-chrome",
  "--no-first-run",
  "--no-default-browser-check",
  "--hide-scrollbars",
  "--enable-unsafe-swiftshader",
  "--use-gl=swiftshader",
  "about:blank",
], { stdio: "ignore" });

let ws = null;
let nextId = 0;
const pending = new Map();
const consoleLines = [];

function send(method, params = {}, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`timeout ${method}`));
    }, timeout);
    pending.set(id, {
      resolve: (v) => { clearTimeout(timer); resolve(v); },
      reject: (e) => { clearTimeout(timer); reject(e); },
    });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text || "eval failed");
  return r.result.value;
}

async function waitFor(fn, timeout = 60000, interval = 200) {
  const start = Date.now();
  let last;
  while (Date.now() - start < timeout) {
    try {
      const v = await fn();
      if (v) return v;
      last = v;
    } catch (e) {
      last = e.message;
    }
    await sleep(interval);
  }
  throw new Error(`waitFor timeout: ${last}`);
}

let result = { ok: false, stage: "boot" };

try {
  await waitFor(async () => (await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok);
  const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const page = targets.find((t) => t.type === "page");
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id) {
      const entry = pending.get(m.id);
      if (!entry) return;
      pending.delete(m.id);
      m.error ? entry.reject(new Error(JSON.stringify(m.error))) : entry.resolve(m.result);
      return;
    }
    if (m.method === "Runtime.consoleAPICalled") {
      consoleLines.push(`${m.params.type}: ${m.params.args.map((a) => a.value ?? a.description ?? "").join(" ")}`);
    }
  };

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Log.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 800, height: 900, deviceScaleFactor: 1, mobile: false,
  });
  await send("Page.navigate", { url: URL });
  await waitFor(async () => (await evaluate("document.readyState")) === "complete");
  result.stage = "page-loaded";

  await waitFor(async () => await evaluate("window.__l2dDone === true"));
  result.stage = "run-finished";
  result.report = await evaluate("JSON.parse(JSON.stringify(window.__l2dReport || {}))");
  result.logText = await evaluate("document.getElementById('log')?.textContent ?? ''");

  const shot = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
  await writeFile(`${OUT}/live2d-demo.png`, Buffer.from(shot.data, "base64"));

  // 单独截 canvas 区域
  const box = await evaluate(`(() => {
    const c = document.getElementById('stage');
    const r = c.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  })()`);
  const cshot = await send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    clip: { ...box, scale: 1 },
  });
  await writeFile(`${OUT}/live2d-canvas.png`, Buffer.from(cshot.data, "base64"));

  result.ok = Boolean(result.report?.ok);
  result.consoleLines = consoleLines;
} catch (e) {
  result.error = e.message;
  result.consoleLines = consoleLines;
} finally {
  await writeFile(`${OUT}/report.json`, JSON.stringify(result, null, 2)).catch(() => {});
  console.log(JSON.stringify(result, null, 2));
  try { ws?.close(); } catch {}
  chrome.kill("SIGTERM");
  await sleep(300);
}
