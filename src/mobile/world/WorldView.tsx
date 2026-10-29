import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { Application, Container, Graphics, Sprite, Texture } from "pixi.js";
import {
  PLAYER_STAND_H,
  WorldRuntime,
} from "./runtime";
import { getRoom, propBounds, type RoomProp } from "./rooms";
import {
  BLOOM_ASSETS,
  CHARACTER_ASSETS,
  PLOT_ASSETS,
  PLOT_OVERLAY_ASPECT,
  PROP_ASSETS,
  ROOM_BACKGROUND,
} from "./assets";
import { plotStage } from "./state";
import type { GardenPlot, WorldRoomId } from "../engine/types";

const WORLD_H = 1000;
const CHAR_FRAME = 760;
/** 760px 画布内角色的可见高度（见 tools/build-character-assets.py） */
const CHAR_VISIBLE_H = 714;
const CHAR_BASELINE = 748 / CHAR_FRAME;
const BALL_VISUAL_H = 54;
const DRAG_THRESHOLD = 8;

export interface WorldViewHandle {
  activateNearest: () => void;
}

interface WorldViewProps {
  roomId: WorldRoomId;
  spawn: { x: number; y: number };
  plots: GardenPlot[];
  onAction: (prop: RoomProp) => void;
  onDoor: (prop: RoomProp) => void;
  onCatch: (combo: number) => void;
  onMiss: (combo: number) => void;
  onNearest: (prop: RoomProp | null) => void;
  onKick: () => void;
  onTapPlayer: () => void;
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}

function loadTexture(src: string): Promise<Texture> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const tex = Texture.from(img);
      tex.source.scaleMode = "linear";
      resolve(tex);
    };
    img.onerror = () => resolve(Texture.WHITE);
    img.src = src;
  });
}

interface PropView {
  prop: RoomProp;
  sprite: Sprite;
}

interface PlotView {
  index: number;
  prop: RoomProp;
  sprite: Sprite;
  key: string;
}

class WorldRenderer {
  onNearest?: (prop: RoomProp | null) => void;
  onKick?: () => void;
  onTapPlayer?: () => void;

  runtime!: WorldRuntime;
  private host!: HTMLElement;
  private app!: Application;
  private root = new Container();
  private sortable = new Container();
  private bg = new Sprite(Texture.WHITE);
  private charBox = new Container();
  private charSprite = new Sprite(Texture.WHITE);
  private ballBox = new Container();
  private ballSprite = new Sprite(Texture.WHITE);
  private ballShadow = new Graphics();
  private nearestRing = new Graphics();
  private landingRing = new Graphics();
  private groundFx = new Container();
  private charFrames: Texture[] = [];
  private bowFrame: Texture = Texture.WHITE;
  private idleFrame: Texture = Texture.WHITE;
  private propViews: PropView[] = [];
  private plotViews: PlotView[] = [];
  private plotTextures = new Map<string, Texture>();
  private scale = 1;
  private disposed = false;
  private observer: ResizeObserver | null = null;
  private plots: GardenPlot[] = [];

  private pointerDown = false;
  private dragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragStartCam = 0;

  private lastNearestKey = "~";
  private lastLandingKey = "~";
  private plotTimer = 0;
  private reduceMotion = false;

  async mount(host: HTMLElement, runtime: WorldRuntime): Promise<void> {
    this.host = host;
    this.runtime = runtime;
    this.app = new Application();
    await this.app.init({
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      width: 2,
      height: 2,
    });
    if (this.disposed) {
      this.app.destroy(true);
      return;
    }

    this.reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const canvas = this.app.canvas;
    host.appendChild(canvas);
    canvas.style.position = "absolute";
    canvas.style.inset = "0";
    canvas.style.touchAction = "none";
    canvas.setAttribute("aria-hidden", "true");

    this.root.addChild(this.bgLayer(), this.groundFx, this.sortable);
    this.sortable.sortableChildren = true;
    this.app.stage.addChild(this.root);

    this.charSprite.anchor.set(0.5, CHAR_BASELINE);
    const charShadow = new Graphics();
    charShadow.ellipse(0, 0, 44, 13);
    charShadow.fill({ color: 0x2f241a, alpha: 0.18 });
    this.charBox.addChild(charShadow, this.charSprite);
    this.sortable.addChild(this.charBox);

    this.ballSprite.anchor.set(0.5, 1);
    this.ballBox.addChild(this.ballSprite);
    this.ballBox.visible = false;
    this.sortable.addChild(this.ballBox);

    this.groundFx.addChild(this.ballShadow, this.nearestRing, this.landingRing);

    canvas.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);

    await this.loadScene();

    if (this.disposed) return;

    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(host);
    this.resize();
    this.app.ticker.add(this.onTick);

    if (import.meta.env.DEV) {
      // Read-only debug hook for device-mode checks; not part of the save.
      (window as unknown as { __world?: WorldRuntime }).__world = runtime;
    }
  }

  private bgLayer(): Container {
    const layer = new Container();
    this.bg.anchor.set(0, 0);
    layer.addChild(this.bg);
    return layer;
  }

  private async loadScene(): Promise<void> {
    const room = this.runtime.room;
    const bgPromise = loadTexture(ROOM_BACKGROUND[room.id]);
    const charPromise = Promise.all([
      loadTexture(CHARACTER_ASSETS.idle),
      loadTexture(CHARACTER_ASSETS.bow),
      ...CHARACTER_ASSETS.walk.map((src) => loadTexture(src)),
    ]);
    const props = room.props.filter((prop) => prop.kind !== "ball");
    const propPromise = Promise.all(
      props.map(async (prop) => ({ prop, tex: await loadTexture(PROP_ASSETS[prop.kind]) })),
    );
    const ballProp = room.props.find((prop) => prop.kind === "ball");
    const ballPromise = ballProp ? loadTexture(PROP_ASSETS.ball) : Promise.resolve<Texture | null>(null);

    const [bgTex, charTex, propEntries, ballTex] = await Promise.all([
      bgPromise,
      charPromise,
      propPromise,
      ballPromise,
    ]);
    if (this.disposed) return;

    this.bg.texture = bgTex;
    this.bg.width = room.worldW;
    this.bg.height = WORLD_H;

    this.idleFrame = charTex[0];
    this.bowFrame = charTex[1];
    this.charFrames = charTex.slice(2);
    this.charSprite.texture = this.idleFrame;

    for (const entry of propEntries) {
      const sprite = new Sprite(entry.tex);
      sprite.anchor.set(0.5, 1);
      sprite.width = entry.prop.w;
      sprite.height = entry.prop.h;
      sprite.position.set(entry.prop.x, entry.prop.y);
      sprite.zIndex = entry.prop.kind === "rug" ? 0 : entry.prop.y;
      this.sortable.addChild(sprite);
      this.propViews.push({ prop: entry.prop, sprite });
    }

    if (ballTex) {
      this.ballSprite.texture = ballTex;
      this.ballSprite.width = BALL_VISUAL_H;
      this.ballSprite.height = BALL_VISUAL_H;
    }
  }

  setPlots(plots: GardenPlot[]): void {
    this.plots = plots;
    this.plotTimer = 9999;
    this.updatePlotVisuals(true);
  }

  private updatePlotVisuals(force = false): void {
    if (this.disposed) return;
    if (!force && this.plotTimer < 400) return;
    this.plotTimer = 0;
    const now = Date.now();
    const room = this.runtime.room;
    for (const prop of room.props) {
      if (prop.kind !== "plot" || prop.plotIndex == null) continue;
      const plot = this.plots[prop.plotIndex];
      if (!plot) continue;
      const stage = plotStage(plot, now);
      const key = stage === 0 ? "empty" : `${stage}:${plot.kind ?? ""}`;
      let view = this.plotViews.find((item) => item.index === prop.plotIndex);
      if (!view) {
        const sprite = new Sprite(Texture.WHITE);
        sprite.anchor.set(0.5, 1);
        sprite.width = prop.w;
        sprite.height = prop.w * PLOT_OVERLAY_ASPECT;
        sprite.position.set(prop.x, prop.y);
        sprite.zIndex = prop.y + 1;
        sprite.visible = false;
        this.sortable.addChild(sprite);
        view = { index: prop.plotIndex, prop, sprite, key: "new" };
        this.plotViews.push(view);
      }
      if (view.key === key) continue;
      view.key = key;
      if (stage === 0) {
        view.sprite.visible = false;
        continue;
      }
      const src = stage === 1
        ? PLOT_ASSETS.sprout
        : stage === 2
          ? PLOT_ASSETS.bud
          : BLOOM_ASSETS[plot.kind ?? "daisy"];
      const cached = this.plotTextures.get(src);
      if (cached) {
        view.sprite.texture = cached;
        view.sprite.visible = true;
        continue;
      }
      void loadTexture(src).then((tex) => {
        if (this.disposed) return;
        this.plotTextures.set(src, tex);
        if (view && view.key === key) {
          view.sprite.texture = tex;
          view.sprite.visible = true;
        }
      });
    }
  }

  private resize(): void {
    if (this.disposed || !this.host) return;
    const rect = this.host.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));
    this.app.renderer.resize(w, h);
    this.scale = h / WORLD_H;
    this.root.scale.set(this.scale);
    this.runtime.setViewport(w / this.scale);
    this.lastNearestKey = "~";
    this.refreshFx(true);
  }

  private onTick = (): void => {
    if (this.disposed) return;
    const dt = Math.min(this.app.ticker.deltaMS, 50);
    this.runtime.tick(dt);
    if (this.reduceMotion) {
      this.runtime.cameraX = clamp(
        this.runtime.player.x - this.runtime.viewW / 2,
        0,
        this.runtime.maxCameraX,
      );
    }
    this.plotTimer += dt;
    this.updatePlotVisuals();
    this.render();
  };

  private render(): void {
    const runtime = this.runtime;
    const player = runtime.player;
    this.root.position.x = -runtime.cameraX * this.scale;

    this.charBox.position.set(player.x, player.y);
    this.charBox.zIndex = player.y;
    const frame = this.reduceMotion
      ? this.idleFrame
      : player.pose === "bow"
        ? this.bowFrame
        : player.pose === "walk" && this.charFrames.length
          ? this.charFrames[Math.floor(player.phase * 2) % this.charFrames.length]
          : this.idleFrame;
    if (this.charSprite.texture !== frame) this.charSprite.texture = frame;
    const base = PLAYER_STAND_H / CHAR_VISIBLE_H;
    const targetX = base * player.facing;
    if (Math.abs(this.charSprite.scale.x - targetX) > 1e-4) {
      this.charSprite.scale.x = targetX;
    }
    if (Math.abs(this.charSprite.scale.y - base) > 1e-4) {
      this.charSprite.scale.y = base;
    }

    const ball = runtime.ball;
    if (ball && this.ballSprite.texture !== Texture.WHITE) {
      const z = runtime.ballHeight();
      this.ballBox.visible = true;
      this.ballBox.position.set(ball.x, ball.y - z);
      this.ballBox.zIndex = ball.y + 2;
      this.ballShadow.clear();
      this.ballShadow.ellipse(ball.x, ball.y, 27, 9);
      this.ballShadow.fill({
        color: 0x2c2218,
        alpha: 0.22 * Math.max(0.2, 1 - z / 320),
      });
    } else {
      this.ballBox.visible = false;
      this.ballShadow.clear();
    }

    const nearest = runtime.nearest;
    const nearestKey = nearest?.id ?? "";
    if (nearestKey !== this.lastNearestKey) {
      this.lastNearestKey = nearestKey;
      this.drawNearestRing(nearest);
      this.onNearest?.(nearest);
    }

    const landing = ball?.landing;
    const landingKey = landing ? `${Math.round(landing.x)}:${Math.round(landing.y)}:${ball?.bounce ? 1 : 0}` : "";
    if (landingKey !== this.lastLandingKey) {
      this.lastLandingKey = landingKey;
      this.drawLandingRing(landing ?? null, Boolean(ball?.bounce));
    }

  }

  private drawNearestRing(prop: RoomProp | null): void {
    this.nearestRing.clear();
    if (!prop) return;
    const radiusX = Math.max(28, Math.min(prop.w * 0.34, 90));
    this.nearestRing.ellipse(prop.x, prop.y - 2, radiusX, 11);
    this.nearestRing.stroke({ width: 3, color: 0xfff6df, alpha: 0.95 });
    this.nearestRing.ellipse(prop.x, prop.y - 2, radiusX + 4, 15);
    this.nearestRing.stroke({ width: 2, color: 0x3f6a57, alpha: 0.5 });
  }

  private drawLandingRing(landing: { x: number; y: number } | null, active: boolean): void {
    this.landingRing.clear();
    if (!landing) return;
    this.landingRing.ellipse(landing.x, landing.y, 30, 11);
    this.landingRing.stroke({
      width: active ? 4 : 2,
      color: active ? 0xffe9a8 : 0xffffff,
      alpha: active ? 0.95 : 0.5,
    });
  }

  private refreshFx(force = false): void {
    if (force) {
      this.lastNearestKey = "~";
      this.lastLandingKey = "~";
    }
    this.drawNearestRing(this.runtime.nearest);
    this.drawLandingRing(this.runtime.ball?.landing ?? null, Boolean(this.runtime.ball?.bounce));
  }

  activateNearest(): void {
    this.runtime.activateNearest();
  }

  catchBall(): boolean {
    return this.runtime.catchBall();
  }

  private onPointerDown = (event: PointerEvent): void => {
    this.pointerDown = true;
    this.dragging = false;
    this.dragStartX = event.clientX;
    this.dragStartY = event.clientY;
    this.dragStartCam = this.runtime.cameraX;
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (!this.pointerDown) return;
    const dx = event.clientX - this.dragStartX;
    if (!this.dragging && Math.abs(dx) > DRAG_THRESHOLD) this.dragging = true;
    if (!this.dragging) return;
    this.runtime.cameraFollow = false;
    this.runtime.cameraX = clamp(
      this.dragStartCam - dx / this.scale,
      0,
      this.runtime.maxCameraX,
    );
  };

  private onPointerUp = (event: PointerEvent): void => {
    if (!this.pointerDown) return;
    this.pointerDown = false;
    const wasDrag = this.dragging;
    this.dragging = false;
    if (wasDrag) return;
    const dx = Math.abs(event.clientX - this.dragStartX);
    const dy = Math.abs(event.clientY - this.dragStartY);
    if (dx > 10 || dy > 10) return;
    this.handleTap(event);
  };

  private handleTap(event: PointerEvent): void {
    const rect = this.app.canvas.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;
    const wx = localX / this.scale + this.runtime.cameraX;
    const wy = localY / this.scale;
    const runtime = this.runtime;
    const ball = runtime.ball;

    if (ball) {
      const z = runtime.ballHeight();
      const bx = ball.x;
      const by = ball.y - z - BALL_VISUAL_H / 2;
      if (Math.hypot(wx - bx, wy - by) <= 60 || Math.hypot(wx - ball.x, wy - ball.y) <= 48) {
        if (runtime.canCatch()) {
          runtime.catchBall();
          return;
        }
        const ballProp = runtime.room.props.find((prop) => prop.kind === "ball");
        if (ballProp && !ball.flight && !ball.bounce) {
          runtime.requestProp(ballProp);
          return;
        }
      }
    }

    // Depth-aware tap resolution: whoever is drawn in front at that point wins.
    // A character standing in front of the bed should be tappable on her body,
    // while a prop drawn in front of her still takes the tap.
    const player = runtime.player;
    const playerDepth = player.y;
    let bestDepth = -Infinity;
    let bestProp: RoomProp | null = null;
    let hitPlayer = false;

    // Body only — feet level is floor, otherwise walking near her breaks.
    if (Math.abs(wx - player.x) < 62 && wy > player.y - 296 && wy < player.y - 30) {
      hitPlayer = true;
      bestDepth = playerDepth;
    }

    // Only props that can actually do something are tap targets. Rugs, plants
    // and other scenery must not swallow taps meant for the floor.
    const props = [...runtime.room.props]
      .filter((prop) => prop.kind !== "ball" && Boolean(prop.action || prop.doorTo));
    for (const prop of props) {
      const bounds = propBounds(prop);
      if (
        wx >= bounds.x0 - 16
        && wx <= bounds.x1 + 16
        && wy >= bounds.y0 - 18
        && wy <= bounds.y1 + 14
      ) {
        // Ties go to the prop (doors/objects are the intent when overlapping).
        if (prop.y >= bestDepth) {
          bestDepth = prop.y;
          bestProp = prop;
          hitPlayer = false;
        }
      }
    }

    if (bestProp) {
      runtime.requestProp(bestProp);
      return;
    }
    if (hitPlayer) {
      runtime.playPose("bow", 650);
      this.onTapPlayer?.();
      return;
    }

    runtime.moveTo(wx, Math.min(wy, runtime.room.walk.y1));
  }

  destroy(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.observer?.disconnect();
    this.observer = null;
    const canvas = this.app?.canvas;
    canvas?.removeEventListener("pointerdown", this.onPointerDown);
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerup", this.onPointerUp);
    try {
      this.app?.ticker.remove(this.onTick);
    } catch {
      // already torn down
    }
    try {
      this.app?.destroy(true, { children: true });
    } catch {
      // already torn down
    }
  }
}

export const WorldView = forwardRef<WorldViewHandle, WorldViewProps>(function WorldView(props, ref) {
  const hostRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<WorldRenderer | null>(null);
  const latest = useRef(props);
  latest.current = props;
  const { roomId, spawn } = props;

  useImperativeHandle(ref, () => ({
    activateNearest: () => rendererRef.current?.activateNearest(),
  }), []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    const runtime = new WorldRuntime(getRoom(roomId), spawn);
    const renderer = new WorldRenderer();
    rendererRef.current = renderer;

    runtime.onArrive = (prop) => {
      runtime.playPose("bow", 620);
      latest.current.onAction(prop);
    };
    runtime.onDoor = (prop) => {
      latest.current.onDoor(prop);
    };
    runtime.onCatch = (combo) => {
      runtime.playPose("bow", 420);
      latest.current.onCatch(combo);
    };
    runtime.onMiss = (combo) => {
      latest.current.onMiss(combo);
    };
    runtime.onKick = () => {
      latest.current.onKick();
    };
    renderer.onNearest = (prop) => latest.current.onNearest(prop);
    renderer.onKick = () => latest.current.onKick();
    renderer.onTapPlayer = () => latest.current.onTapPlayer();

    void renderer.mount(host, runtime).then(() => {
      if (!disposed) renderer.setPlots(latest.current.plots);
    });

    return () => {
      disposed = true;
      renderer.destroy();
      rendererRef.current = null;
    };
    // spawn is intentionally keyed by the parent; a room change remounts the view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, spawn.x, spawn.y]);

  useEffect(() => {
    rendererRef.current?.setPlots(props.plots);
  }, [props.plots]);

  return <div className="world-canvas" ref={hostRef} />;
});
