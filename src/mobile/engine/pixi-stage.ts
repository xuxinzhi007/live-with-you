import {
  Application,
  Container,
  Graphics,
  Sprite,
  Text,
  Texture,
} from "pixi.js";
import { WORLD_W, designX, designW, parseVerticalGradient } from "./world";
import type { FurnitureItem } from "../data/scenes";
import { SPRITES } from "../data/pixel-sprites";
import type { SlotPose } from "../data/slots";

export type ActorKey = "self" | "peer" | "pet";
export type JuiceKind = "pop" | "meet" | "sit" | "pass" | "look" | "bounce";

export interface ActorInput {
  key: ActorKey;
  src: string;
  name: string;
  tagColor: string;
  pose: SlotPose;
  away?: boolean;
  clickable?: boolean;
}

const APPROACH_MS = 720;
const MAX_CAM = WORLD_W - 100;
const WALL_PARALLAX = 0.35;
const FLOOR_H_FRAC = 0.1;

interface Tween {
  elapsed: number;
  duration: number;
  update: (t: number) => void;
  onDone?: () => void;
}

interface ActorSprite {
  key: ActorKey;
  container: Container;
  sprite: Sprite;
  shadow: Graphics;
  tag: Text;
  pose: SlotPose;
  away: boolean;
  clickable: boolean;
  moving: boolean;
  moveFrom: { x: number; y: number };
  moveTo: { x: number; y: number };
  moveElapsed: number;
  width: number;
  height: number;
  src: string;
}

interface FurnSprite {
  item: FurnitureItem;
  sprite: Sprite | null;
  label: Text | null;
  tex: Texture | null;
}

interface HitRect {
  item: FurnitureItem;
  x: number;
  y: number;
  w: number;
  h: number;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function loadTexture(src: string, nearest: boolean): Promise<Texture> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const tex = Texture.from(img);
      tex.source.scaleMode = nearest ? "nearest" : "linear";
      resolve(tex);
    };
    img.onerror = () => resolve(Texture.WHITE);
    img.src = src;
  });
}

function gradientTexture(css: string, height: number): Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = Math.max(2, Math.round(height));
  const ctx = canvas.getContext("2d")!;
  const stops = parseVerticalGradient(css);
  if (stops.length === 0) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 1, canvas.height);
  } else {
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    for (const stop of stops) grad.addColorStop(stop.at, stop.color);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1, canvas.height);
  }
  const tex = Texture.from(canvas);
  tex.source.scaleMode = "linear";
  return tex;
}

function containFit(tex: Texture, boxW: number, boxH: number): { w: number; h: number } {
  if (tex.width <= 0 || tex.height <= 0) return { w: boxW, h: boxH };
  const aspect = tex.width / tex.height;
  const boxAspect = boxW / boxH;
  if (boxAspect > aspect) return { w: boxH * aspect, h: boxH };
  return { w: boxW, h: boxW / aspect };
}

function furnRank(item: FurnitureItem): number {
  if (item.id === "sky-view") return 0;
  if (item.id === "rug") return 1;
  if (item.type === "portal") return 4;
  if (item.type === "interactive") return 3;
  return 2;
}

export class SceneStage {
  onFurnitureClick?: (item: FurnitureItem, x: number, y: number) => void;
  onPetClick?: () => void;

  private app!: Application;
  private host!: HTMLElement;
  private wallLayer = new Container();
  private worldLayer = new Container();
  private floorLayer = new Container();
  private furnLayer = new Container();
  private actorLayer = new Container();

  private wallSprite: Sprite | null = null;
  private floorSprite: Sprite | null = null;

  private screenW = 1;
  private screenH = 1;
  private scaleX = 1;
  private scaleY = 1;

  private wallCss = "#ffffff";
  private floorCss = "#ffffff";

  private furn: FurnSprite[] = [];
  private hitRects: HitRect[] = [];
  private actors = new Map<ActorKey, ActorSprite>();
  private tweens: Tween[] = [];
  private texCache = new Map<string, Texture>();
  private gradientCache = new Map<string, Texture>();

  private camX = 0;
  private camTarget = 0;
  private snapCamera = false;

  private pointerDown = false;
  private dragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragStartCam = 0;

  private gen = 0;
  private observer: ResizeObserver | null = null;
  private disposed = false;

  async mount(host: HTMLElement): Promise<void> {
    this.host = host;
    this.app = new Application();
    await this.app.init({
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      width: 2,
      height: 2,
    });
    host.appendChild(this.app.canvas);
    this.app.canvas.style.touchAction = "none";
    this.app.canvas.style.position = "absolute";
    this.app.canvas.style.inset = "0";

    this.app.stage.addChild(this.wallLayer, this.worldLayer);
    this.worldLayer.addChild(this.floorLayer, this.furnLayer, this.actorLayer);

    this.app.canvas.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);

    this.app.ticker.add(this.onTick);

    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(host);
    this.resize();
  }

  destroy(): void {
    this.disposed = true;
    this.observer?.disconnect();
    this.app.canvas.removeEventListener("pointerdown", this.onPointerDown);
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerup", this.onPointerUp);
    this.app.ticker.remove(this.onTick);
    this.app.destroy(true);
  }

  setScene(furniture: FurnitureItem[], wall: string, floor: string): void {
    this.wallCss = wall;
    this.floorCss = floor;
    this.gen += 1;
    const gen = this.gen;

    this.furnLayer.removeChildren();
    this.furn = [];
    this.hitRects = [];

    const sorted = [...furniture].sort((a, b) => furnRank(a) - furnRank(b));

    sorted.forEach((item) => {
      const src = SPRITES[item.id];
      const entry: FurnSprite = { item, sprite: null, label: null, tex: null };
      if (src) {
        this.getTexture(src, true).then((tex) => {
          if (gen !== this.gen) return;
          entry.tex = tex;
          const sprite = new Sprite(tex);
          sprite.anchor.set(0.5, 1);
          this.furnLayer.addChild(sprite);
          entry.sprite = sprite;
          this.layoutFurn(entry);
        });
      }
      if (item.type === "portal" && item.label) {
        const label = new Text({
          text: item.label,
          style: {
            fontFamily: "system-ui, sans-serif",
            fontSize: 11,
            fontWeight: "600",
            fill: "#ffffff",
            stroke: { color: "rgba(120,60,30,0.85)", width: 3 },
          },
        });
        label.anchor.set(0.5, 0);
        this.furnLayer.addChild(label);
        entry.label = label;
      }
      this.furn.push(entry);
      this.layoutFurn(entry);
    });

    // 场景切换时相机回到居中视角，避免横扫
    this.camX = 0;
    this.camTarget = 0;
    this.snapCamera = true;
    this.relayout();
  }

  syncActors(inputs: ActorInput[]): void {
    this.gen += 1;
    const gen = this.gen;
    const wanted = new Set(inputs.map((a) => a.key));

    for (const [key, actor] of this.actors) {
      if (!wanted.has(key)) {
        actor.container.destroy({ children: true });
        this.actors.delete(key);
      }
    }

    inputs.forEach((input) => {
      const existing = this.actors.get(input.key);
      if (existing) {
        existing.tag.text = input.name;
        existing.tag.style.fill = input.tagColor;
        existing.away = Boolean(input.away);
        existing.clickable = Boolean(input.clickable);
        if (existing.src !== input.src) {
          this.applyActorTexture(existing, input.src, gen);
        }
        this.setPose(input.key, input.pose);
        return;
      }

      const container = new Container();
      const shadow = new Graphics();
      const sprite = new Sprite(Texture.WHITE);
      sprite.anchor.set(0.5, 1);
      const tag = new Text({
        text: input.name,
        style: {
          fontFamily: "system-ui, sans-serif",
          fontSize: 10,
          fontWeight: "600",
          fill: input.tagColor,
          stroke: { color: "rgba(0,0,0,0.35)", width: 3 },
        },
      });
      tag.anchor.set(0.5, 0.5);
      container.addChild(shadow, sprite, tag);
      this.actorLayer.addChild(container);

      const actor: ActorSprite = {
        key: input.key,
        container,
        sprite,
        shadow,
        tag,
        pose: { left: 0, bottom: 0 },
        away: Boolean(input.away),
        clickable: Boolean(input.clickable),
        moving: false,
        moveFrom: { x: 0, y: 0 },
        moveTo: { x: 0, y: 0 },
        moveElapsed: 0,
        width: 0,
        height: 0,
        src: "",
      };
      this.actors.set(input.key, actor);
      this.applyActorTexture(actor, input.src, gen);
      this.setPose(input.key, input.pose);
    });
  }

  setPose(key: ActorKey, pose: SlotPose): void {
    const actor = this.actors.get(key);
    if (!actor) return;
    if (actor.pose.left === pose.left && actor.pose.bottom === pose.bottom) return;
    actor.pose = pose;
    const target = this.actorTargetPx(pose);
    if (!actor.moving) actor.moveFrom = { x: actor.container.x, y: actor.container.y };
    actor.moveTo = target;
    actor.moving = true;
    actor.moveElapsed = 0;
  }

  juice(key: ActorKey, kind: JuiceKind): void {
    const actor = this.actors.get(key);
    if (!actor) return;
    const target = actor.sprite;
    switch (kind) {
      case "pop":
        this.keyframes(target, [
          { at: 0 },
          { at: 0.35, scaleX: 1.12, scaleY: 0.88 },
          { at: 0.55, scaleX: 0.94, scaleY: 1.08 },
          { at: 1 },
        ], 450);
        break;
      case "meet":
        this.keyframes(target, [
          { at: 0, scaleX: 0.86, scaleY: 0.86, alpha: 0.5 },
          { at: 0.6, scaleX: 1.06, scaleY: 1.06, alpha: 1 },
          { at: 1 },
        ], 700);
        break;
      case "sit":
        this.keyframes(target, [
          { at: 0, y: 0 },
          { at: 0.5, y: 10 },
          { at: 1, y: 6 },
        ], 500);
        break;
      case "pass":
        this.keyframes(target, [
          { at: 0, x: 0 },
          { at: 0.4, x: 14 },
          { at: 1, x: 0 },
        ], 500);
        break;
      case "look":
        this.keyframes(target, [
          { at: 0, y: 0 },
          { at: 0.5, y: 4, scaleY: 0.98 },
          { at: 1, y: 0 },
        ], 600);
        break;
      case "bounce":
        this.keyframes(target, [
          { at: 0, y: 0 },
          { at: 0.4, y: -20 },
          { at: 0.6, y: -10 },
          { at: 1, y: 0 },
        ], 500);
        break;
    }
  }

  private keyframes(
    target: { scale: { x: number; y: number }; x: number; y: number; alpha: number },
    frames: { at: number; scaleX?: number; scaleY?: number; x?: number; y?: number; alpha?: number }[],
    duration: number,
  ): void {
    this.tweens.push({
      elapsed: 0,
      duration,
      update: (t) => {
        let a = frames[0];
        let b = frames[frames.length - 1];
        for (let i = 0; i < frames.length - 1; i += 1) {
          if (t >= frames[i].at && t <= frames[i + 1].at) {
            a = frames[i];
            b = frames[i + 1];
            break;
          }
        }
        const span = Math.max(1e-6, b.at - a.at);
        const k = clamp((t - a.at) / span, 0, 1);
        target.scale.x = lerp(a.scaleX ?? 1, b.scaleX ?? 1, k);
        target.scale.y = lerp(a.scaleY ?? 1, b.scaleY ?? 1, k);
        target.x = lerp(a.x ?? 0, b.x ?? 0, k);
        target.y = lerp(a.y ?? 0, b.y ?? 0, k);
        target.alpha = lerp(a.alpha ?? 1, b.alpha ?? 1, k);
      },
      onDone: () => {
        target.scale.x = 1;
        target.scale.y = 1;
        target.x = 0;
        target.y = 0;
        target.alpha = 1;
      },
    });
  }

  private applyActorTexture(actor: ActorSprite, src: string, gen: number): void {
    actor.src = src;
    this.getTexture(src, false).then((tex) => {
      if (gen !== this.gen || this.disposed) return;
      actor.sprite.texture = tex;
      this.layoutActor(actor);
    });
  }

  private getTexture(src: string, nearest: boolean): Promise<Texture> {
    const cached = this.texCache.get(src);
    if (cached) return Promise.resolve(cached);
    return loadTexture(src, nearest).then((tex) => {
      this.texCache.set(src, tex);
      return tex;
    });
  }

  private getGradientTexture(css: string, height: number): Texture {
    const key = `${height}|${css}`;
    const cached = this.gradientCache.get(key);
    if (cached) return cached;
    const tex = gradientTexture(css, height);
    this.gradientCache.set(key, tex);
    return tex;
  }

  private resize(): void {
    const rect = this.host.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));
    if (w === this.screenW && h === this.screenH) return;
    this.screenW = w;
    this.screenH = h;
    this.scaleX = w / 100;
    this.scaleY = h / 100;
    this.app.renderer.resize(w, h);
    this.relayout();
  }

  private relayout(): void {
    const wallHeight = this.screenH;
    const wallTex = this.getGradientTexture(this.wallCss, wallHeight);
    if (!this.wallSprite) {
      this.wallSprite = new Sprite(wallTex);
      this.wallLayer.addChild(this.wallSprite);
    }
    this.wallSprite.texture = wallTex;
    this.wallSprite.width = WORLD_W * this.scaleX;
    this.wallSprite.height = wallHeight;
    this.wallSprite.position.set(0, 0);

    const floorHeight = Math.round(FLOOR_H_FRAC * this.screenH);
    const floorTex = this.getGradientTexture(this.floorCss, floorHeight);
    if (!this.floorSprite) {
      this.floorSprite = new Sprite(floorTex);
      this.floorLayer.addChild(this.floorSprite);
    }
    this.floorSprite.texture = floorTex;
    this.floorSprite.width = WORLD_W * this.scaleX;
    this.floorSprite.height = floorHeight;
    this.floorSprite.position.set(0, this.screenH - floorHeight);

    this.hitRects = [];
    this.furn.forEach((entry) => this.layoutFurn(entry));

    this.actors.forEach((actor) => {
      const target = this.actorTargetPx(actor.pose);
      actor.moveTo = target;
      actor.moveFrom = target;
      actor.moving = false;
      actor.container.position.set(target.x, target.y);
      this.layoutActor(actor);
    });
  }

  private layoutFurn(entry: FurnSprite): void {
    if (this.screenW <= 1) return;
    const item = entry.item;
    const x = designX(item.left) * this.scaleX;
    const w = designW(item.w) * this.scaleX;
    const bottom = item.bottom * this.scaleY;
    const h = item.h * this.scaleY;
    const centerX = x + w / 2;
    const bottomY = this.screenH - bottom;

    if (entry.sprite && entry.tex) {
      const size = containFit(entry.tex, w, h);
      entry.sprite.width = size.w;
      entry.sprite.height = size.h;
      entry.sprite.position.set(centerX, bottomY);
    }
    if (entry.label) {
      entry.label.position.set(centerX, bottomY + 14);
    }
    if (item.actions.length > 0 || item.type === "portal") {
      this.hitRects.push({ item, x, y: bottomY - h, w, h });
    }
  }

  private actorTargetPx(pose: SlotPose): { x: number; y: number } {
    return {
      x: designX(pose.left) * this.scaleX,
      y: this.screenH - pose.bottom * this.scaleY,
    };
  }

  private layoutActor(actor: ActorSprite): void {
    const isPet = actor.key === "pet";
    const boxH = this.screenH * (isPet ? 0.2 : 0.17);
    const boxW = this.screenH * (isPet ? 0.14 : 0.12);
    const size = containFit(actor.sprite.texture, boxW, boxH);
    actor.sprite.width = size.w;
    actor.sprite.height = size.h;
    actor.sprite.position.set(0, 0);
    actor.width = size.w;
    actor.height = size.h;
    actor.shadow.clear();
    actor.shadow.ellipse(0, 0, Math.max(8, size.w * 0.3), Math.max(3, size.h * 0.04));
    actor.shadow.fill({ color: 0x000000, alpha: 0.18 });
    actor.tag.position.set(0, -size.h - 6);
    actor.sprite.alpha = actor.away ? 0.55 : 1;
  }

  private computeFocusX(): number | null {
    const keys: ActorKey[] = [];
    if (this.actors.has("self")) keys.push("self");
    if (this.actors.has("peer")) keys.push("peer");
    else if (this.actors.has("pet")) keys.push("pet");
    if (keys.length === 0) return null;
    let sum = 0;
    for (const key of keys) {
      const actor = this.actors.get(key)!;
      sum += designX(actor.pose.left);
    }
    return sum / keys.length;
  }

  private onTick = (): void => {
    if (this.disposed) return;
    const dt = this.app.ticker.deltaMS;

    // 相机跟随：聚焦角色中点，带滞回避免抖动
    if (!this.dragging) {
      const focus = this.computeFocusX();
      if (this.snapCamera && focus != null) {
        this.camX = this.camTarget = clamp(focus - 50, 0, MAX_CAM);
        this.snapCamera = false;
      } else if (focus != null) {
        if (Math.abs(focus - (this.camTarget + 50)) > 8) {
          this.camTarget = clamp(focus - 50, 0, MAX_CAM);
        }
      }
    }
    this.camX += (this.camTarget - this.camX) * Math.min(1, dt * 0.01);
    this.worldLayer.x = -this.camX * this.scaleX;
    this.wallLayer.x = -this.camX * this.scaleX * WALL_PARALLAX;

    // 角色短位移
    this.actors.forEach((actor) => {
      if (actor.moving) {
        actor.moveElapsed += dt;
        const t = Math.min(1, actor.moveElapsed / APPROACH_MS);
        const e = easeInOutCubic(t);
        actor.container.x = lerp(actor.moveFrom.x, actor.moveTo.x, e);
        actor.container.y = lerp(actor.moveFrom.y, actor.moveTo.y, e);
        if (t >= 1) actor.moving = false;
      }
    });

    // juice tween
    for (let i = this.tweens.length - 1; i >= 0; i -= 1) {
      const tween = this.tweens[i];
      tween.elapsed += dt;
      const t = Math.min(1, tween.elapsed / tween.duration);
      tween.update(t);
      if (tween.elapsed >= tween.duration) {
        tween.onDone?.();
        this.tweens.splice(i, 1);
      }
    }
  };

  private onPointerDown = (e: PointerEvent): void => {
    this.pointerDown = true;
    this.dragging = false;
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;
    this.dragStartCam = this.camX;
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.pointerDown) return;
    const dx = e.clientX - this.dragStartX;
    const dy = e.clientY - this.dragStartY;
    if (!this.dragging && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) this.dragging = true;
    if (this.dragging) {
      this.camX = this.camTarget = clamp(this.dragStartCam - dx / this.scaleX, 0, MAX_CAM);
    }
  };

  private onPointerUp = (e: PointerEvent): void => {
    const wasDrag = this.dragging;
    this.pointerDown = false;
    this.dragging = false;
    if (!wasDrag) this.handleTap(e);
  };

  private handleTap(e: PointerEvent): void {
    const rect = this.app.canvas.getBoundingClientRect();
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;
    const wx = localX - this.worldLayer.x;

    for (let i = this.hitRects.length - 1; i >= 0; i -= 1) {
      const r = this.hitRects[i];
      if (wx >= r.x && wx <= r.x + r.w && localY >= r.y && localY <= r.y + r.h) {
        this.onFurnitureClick?.(r.item, localX, localY);
        return;
      }
    }

    const pet = this.actors.get("pet");
    if (pet && pet.clickable && !pet.away) {
      const half = pet.width / 2;
      if (wx >= pet.container.x - half && wx <= pet.container.x + half
        && localY >= pet.container.y - pet.height && localY <= pet.container.y) {
        this.onPetClick?.();
      }
    }
  }
}
