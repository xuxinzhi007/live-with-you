import { Application, extensions, Ticker } from "pixi.js";
import {
  Live2DModel,
  Live2DPlugin,
  configureCubismSDK,
} from "untitled-pixi-live2d-engine/cubism";

configureCubismSDK({ memorySizeMB: 64 });

const log = document.getElementById("log");
const lines = [];
function say(msg) {
  lines.push(msg);
  log.textContent = lines.join("\n");
  console.log(msg);
}

const report = (window.__l2dReport = {
  ok: false,
  errors: [],
  versions: {},
  model: {},
  render: {},
});

window.addEventListener("error", (e) => report.errors.push(String(e.message)));

(async () => {
  try {
    const { VERSION } = await import("pixi.js");
    report.versions.pixi = VERSION;
    say(`pixi ${VERSION}`);

    report.versions.engine = "1.4.0";
    say(`engine ${report.versions.engine}`);

    extensions.add(Live2DPlugin);
    say("Live2DPlugin registered (before init)");

    const app = new Application();
    await app.init({
      canvas: document.getElementById("stage"),
      width: 760,
      height: 760,
      backgroundAlpha: 0,
      antialias: true,
      preference: "webgl",
    });
    say("renderer ready");

    const t0 = performance.now();
    const model = await Live2DModel.from("/haru/Haru.model3.json", {
      autoInteract: false,
    });
    report.model.loadMs = Math.round(performance.now() - t0);
    app.stage.addChild(model);

    const w = model.width;
    const h = model.height;
    report.model.size = { w: Math.round(w), h: Math.round(h) };
    say(`model ${Math.round(w)}x${Math.round(h)} in ${report.model.loadMs}ms`);

    // 按 760 画布等高缩放并落到脚底基线
    const scale = 700 / h;
    model.scale.set(scale);
    model.x = 380 - (w * scale) / 2;
    model.y = 748 - h * scale;
    report.model.scale = Number(scale.toFixed(4));

    say(`model pos=(${Math.round(model.x)},${Math.round(model.y)}) scale=${model.scale.x.toFixed(3)} visible=${model.visible} alpha=${model.alpha}`);
    const b = model.getBounds();
    say(`bounds x=${Math.round(b.x)} y=${Math.round(b.y)} w=${Math.round(b.width)} h=${Math.round(b.height)}`);

    // 动作：先 idle，再试并行
    let motionOk = false;
    try {
      await model.motion("Idle", 0);
      motionOk = true;
      say("motion Idle/0 started");
    } catch (e) {
      report.errors.push(`motion: ${e.message}`);
      say(`motion failed: ${e.message}`);
    }
    report.model.motion = motionOk;

    let exprOk = false;
    try {
      await model.expression(0);
      exprOk = true;
      say("expression 0 applied");
    } catch (e) {
      report.errors.push(`expression: ${e.message}`);
      say(`expression failed: ${e.message}`);
    }
    report.model.expression = exprOk;

    let parallelOk = false;
    try {
      await model.parallelMotion([
        { group: "Idle", index: 0 },
        { group: "TapBody", index: 0, loop: true },
      ]);
      parallelOk = true;
      say("parallelMotion ok");
    } catch (e) {
      report.errors.push(`parallel: ${e.message}`);
      say(`parallel failed: ${e.message}`);
    }
    report.model.parallelMotion = parallelOk;

    // 跑帧
    let frames = 0;
    const t1 = performance.now();
    await new Promise((resolve) => {
      const ticker = Ticker.shared;
      const fn = () => {
        frames += 1;
        if (frames >= 60) {
          ticker.remove(fn);
          resolve();
        }
      };
      ticker.add(fn);
    });
    const elapsed = performance.now() - t1;
    report.render.frames = frames;
    report.render.ms = Math.round(elapsed);
    report.render.fps = Math.round((frames / elapsed) * 1000);
    say(`rendered ${frames} frames, ${report.render.fps} fps`);

    // 读回像素，确认真的画出了东西（不是空白）
    const canvas = app.canvas;
    const gl = app.renderer.gl;
    const px = new Uint8Array(4 * 64);
    let nonEmpty = 0;
    const sampleBoxes = [
      [380, 200],
      [380, 400],
      [300, 600],
      [450, 550],
    ];
    for (const [sx, sy] of sampleBoxes) {
      gl.readPixels(sx, 760 - sy, 8, 8, gl.RGBA, gl.UNSIGNED_BYTE, px);
      for (let i = 0; i < px.length; i += 4) {
        if (px[i + 3] > 10) nonEmpty += 1;
      }
    }
    report.render.nonEmptySamples = nonEmpty;
    report.render.sampleTotal = 4 * 64;
    say(`pixel probe: ${nonEmpty}/${4 * 64} opaque samples`);

    report.render.canvasSize = { w: canvas.width, h: canvas.height };
    report.ok = motionOk && nonEmpty > 0 && report.errors.length === 0;
    say(report.ok ? "RESULT ok" : "RESULT fail");
  } catch (e) {
    report.errors.push(`${e?.name}: ${e?.message}`);
    say(`FATAL ${e?.name}: ${e?.message}`);
  } finally {
    window.__l2dDone = true;
  }
})();
