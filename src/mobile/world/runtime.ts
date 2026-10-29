/**
 * V2 世界运行时：玩家移动、碰撞、相机、就近互动与接球玩法。
 *
 * 纯 TypeScript，不依赖 React / Pixi，方便单测，也避免把规则写进渲染层。
 * 坐标单位见 rooms.ts：世界高 1000，房间横向 900–1180。
 */
import type { RoomDef, RoomProp } from "./rooms.ts";
import {
  getProp,
  propApproach,
  propFootprint,
} from "./rooms.ts";

export const WORLD_H = 1000;
export const PLAYER_STAND_H = 300;
export const PLAYER_RADIUS = 22;
export const WALK_SPEED = 330;
export const INTERACT_RANGE = 96;
export const CATCH_RANGE = 170;
export const BALL_FLIGHT_MS = 980;
export const BALL_ARC = 210;
export const BALL_BOUNCE_MS = 1000;
export const BALL_BOUNCES = 4;

export type PlayerPose = "idle" | "walk" | "react";

export interface PlayerState {
  x: number;
  y: number;
  facing: 1 | -1;
  moving: boolean;
  /** 走路相位（秒），给渲染层选帧 */
  phase: number;
  pose: PlayerPose;
  /** pose 结束时间（performance.now 基准） */
  poseUntil: number;
}

export interface BallFlight {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  elapsed: number;
  duration: number;
  arc: number;
}

export interface BallBounce {
  elapsed: number;
  duration: number;
  bounces: number;
  height: number;
}

export interface BallState {
  x: number;
  y: number;
  flight: BallFlight | null;
  bounce: BallBounce | null;
  /** 当前连击；命中时上报给存档层 */
  combo: number;
  /** 接住后的展示计时（毫秒），到点回到球位 */
  caughtFor: number;
  /** 最近一次落点，渲染层画落点圈 */
  landing: { x: number; y: number } | null;
  /** 归位点 */
  home: { x: number; y: number } | null;
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}

function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

/** 球的离地高度（世界单位）。 */
export function ballZ(ball: BallState | null): number {
  if (!ball) return 0;
  if (ball.flight) {
    const t = clamp(ball.flight.elapsed / ball.flight.duration, 0, 1);
    return 4 * t * (1 - t) * ball.flight.arc;
  }
  if (ball.bounce) {
    const segment = ball.bounce.duration;
    const t = clamp((ball.bounce.elapsed % segment) / segment, 0, 1);
    const total = segment * ball.bounce.bounces;
    const decay = 1 - clamp(ball.bounce.elapsed / total, 0, 1) * 0.55;
    return 4 * t * (1 - t) * ball.bounce.height * Math.max(0.25, decay);
  }
  return 0;
}

export class WorldRuntime {
  room: RoomDef;
  player: PlayerState;
  cameraX = 0;
  viewW = 540;
  nearest: RoomProp | null = null;
  ball: BallState | null = null;
  /** 玩家手动拖过镜头后暂停自动跟随，直到再次移动。 */
  cameraFollow = true;
  onArrive?: (prop: RoomProp) => void;
  onCatch?: (combo: number) => void;
  onMiss?: (combo: number) => void;
  onDoor?: (prop: RoomProp) => void;
  onKick?: () => void;

  private target: { x: number; y: number } | null = null;
  private targetPropId: string | null = null;

  constructor(room: RoomDef, spawn: { x: number; y: number }) {
    this.room = room;
    this.player = {
      x: clamp(spawn.x, room.walk.x0, room.walk.x1),
      y: clamp(spawn.y, room.walk.y0, room.walk.y1),
      facing: 1,
      moving: false,
      phase: 0,
      pose: "idle",
      poseUntil: 0,
    };
    this.resetBall(room);
    this.snapCamera();
  }

  get maxCameraX(): number {
    return Math.max(0, this.room.worldW - this.viewW);
  }

  setViewport(viewW: number): void {
    this.viewW = Math.max(240, viewW);
    this.cameraX = clamp(this.cameraX, 0, this.maxCameraX);
  }

  setRoom(room: RoomDef, spawn?: { x: number; y: number }): void {
    this.room = room;
    const at = spawn ?? room.defaultSpawn;
    this.player.x = clamp(at.x, room.walk.x0, room.walk.x1);
    this.player.y = clamp(at.y, room.walk.y0, room.walk.y1);
    this.player.moving = false;
    this.player.phase = 0;
    this.player.pose = "idle";
    this.player.poseUntil = 0;
    this.target = null;
    this.targetPropId = null;
    this.nearest = null;
    this.cameraFollow = true;
    this.resetBall(room);
    this.snapCamera();
  }

  private resetBall(room: RoomDef): void {
    const home = room.props.find((prop) => prop.kind === "ball");
    this.ball = home
      ? {
        x: home.x,
        y: home.y,
        flight: null,
        bounce: null,
        combo: 0,
        caughtFor: 0,
        landing: null,
        home: { x: home.x, y: home.y },
      }
      : null;
  }

  snapCamera(): void {
    this.cameraX = clamp(this.player.x - this.viewW / 2, 0, this.maxCameraX);
  }

  /** 播一个短动作；到点由 tick 收回 idle/walk。 */
  playPose(pose: PlayerPose, durationMs: number): void {
    this.player.pose = pose;
    this.player.poseUntil = performance.now() + durationMs;
  }

  canStand(x: number, y: number): boolean {
    const walk = this.room.walk;
    if (x < walk.x0 || x > walk.x1 || y < walk.y0 || y > walk.y1) return false;
    for (const prop of this.room.props) {
      const fp = propFootprint(prop);
      if (!fp) continue;
      if (
        x > fp.x0 - PLAYER_RADIUS
        && x < fp.x1 + PLAYER_RADIUS
        && y > fp.y0 - PLAYER_RADIUS
        && y < fp.y1 + PLAYER_RADIUS
      ) {
        return false;
      }
    }
    return true;
  }

  /** 把目标点修正到可行走带；被家具挡住时退到家具前方。 */
  resolveTarget(x: number, y: number): { x: number; y: number } {
    const walk = this.room.walk;
    const tx = clamp(x, walk.x0, walk.x1);
    let ty = clamp(y, walk.y0, walk.y1);
    if (this.canStand(tx, ty)) return { x: tx, y: ty };

    for (const prop of this.room.props) {
      const fp = propFootprint(prop);
      if (!fp) continue;
      if (
        tx > fp.x0 - PLAYER_RADIUS
        && tx < fp.x1 + PLAYER_RADIUS
        && ty > fp.y0 - PLAYER_RADIUS
        && ty < fp.y1 + PLAYER_RADIUS
      ) {
        ty = clamp(fp.y1 + PLAYER_RADIUS + 6, walk.y0, walk.y1);
        break;
      }
    }
    if (this.canStand(tx, ty)) return { x: tx, y: ty };
    return { x: tx, y: clamp(this.player.y, walk.y0, walk.y1) };
  }

  moveTo(x: number, y: number, propId: string | null = null): void {
    const resolved = this.resolveTarget(x, y);
    this.target = resolved;
    this.targetPropId = propId;
    this.player.moving = true;
    this.player.pose = "walk";
    this.player.poseUntil = 0;
    this.cameraFollow = true;
  }

  approachFor(prop: RoomProp): { x: number; y: number } {
    if (prop.kind === "ball" && this.ball) {
      const walk = this.room.walk;
      return { x: clamp(this.ball.x, walk.x0, walk.x1), y: clamp(this.ball.y, walk.y0, walk.y1) };
    }
    const at = propApproach(prop);
    return {
      x: clamp(at.x, this.room.walk.x0, this.room.walk.x1),
      y: clamp(at.y, this.room.walk.y0, this.room.walk.y1),
    };
  }

  isNear(prop: RoomProp, range = INTERACT_RANGE): boolean {
    const at = this.approachFor(prop);
    return distance(this.player.x, this.player.y, at.x, at.y) <= range;
  }

  /**
   * 点物件：已经走近就直接执行；还没走近就只走过去，停在物件前，
   * 由底部情境按钮决定要不要做。门和球例外——它们本身就是“过去”的动作。
   */
  requestProp(prop: RoomProp): void {
    if (this.isNear(prop)) {
      this.target = null;
      this.targetPropId = null;
      this.player.moving = false;
      this.triggerProp(prop);
      return;
    }
    const at = this.approachFor(prop);
    const autoOnArrival = Boolean(prop.doorTo);
    this.moveTo(at.x, at.y, autoOnArrival ? prop.id : null);
  }

  private triggerProp(prop: RoomProp): void {
    if (prop.doorTo) {
      this.onDoor?.(prop);
      return;
    }
    if (prop.kind === "ball") {
      this.kickBall();
      return;
    }
    if (!prop.action) return;
    this.onArrive?.(prop);
  }

  activateNearest(): void {
    if (this.nearest) this.requestProp(this.nearest);
  }

  kickBall(): void {
    const ball = this.ball;
    if (!ball || ball.flight || ball.bounce) return;
    if (distance(this.player.x, this.player.y, ball.x, ball.y) > INTERACT_RANGE + 20) return;

    const walk = this.room.walk;
    let toX = clamp(this.player.x + (Math.random() * 2 - 1) * 105, walk.x0 + 46, walk.x1 - 46);
    let toY = clamp(this.player.y - 50 - Math.random() * 70, walk.y0 + 16, walk.y1 - 10);
    if (distance(this.player.x, this.player.y, toX, toY) < 150) {
      toX = clamp(toX + (toX < this.player.x ? -180 : 180), walk.x0 + 46, walk.x1 - 46);
    }
    let landing = this.resolveTarget(toX, toY);
    // The light-action loop must be winnable: always land within reach.
    const maxReach = CATCH_RANGE - 24;
    const ldx = landing.x - this.player.x;
    const ldy = landing.y - this.player.y;
    const ldist = Math.hypot(ldx, ldy);
    if (ldist > maxReach) {
      landing = {
        x: clamp(this.player.x + (ldx / ldist) * maxReach, walk.x0 + 24, walk.x1 - 24),
        y: clamp(this.player.y + (ldy / ldist) * maxReach, walk.y0 + 8, walk.y1),
      };
    }
    toX = landing.x;
    toY = landing.y;
    ball.flight = {
      fromX: this.player.x,
      fromY: this.player.y - 90,
      toX,
      toY,
      elapsed: 0,
      duration: BALL_FLIGHT_MS,
      arc: BALL_ARC,
    };
    ball.bounce = null;
    ball.landing = { x: toX, y: toY };
    ball.caughtFor = 0;
    this.player.facing = toX >= this.player.x ? 1 : -1;
    this.onKick?.();
  }

  /**
   * 可接窗口：踢出 0.26s 后到弹跳结束。落点被夹在接球范围内，
   * 所以这整个窗口都可以接，玩家不用卡一帧。
   */
  canCatch(): boolean {
    const ball = this.ball;
    if (!ball) return false;
    const active = Boolean(ball.bounce) || Boolean(ball.flight && ball.flight.elapsed >= 260);
    return active && distance(this.player.x, this.player.y, ball.x, ball.y) <= CATCH_RANGE;
  }

  /** 点球接住；飞行或弹跳阶段均可。返回是否接住。 */
  catchBall(): boolean {
    const ball = this.ball;
    if (!this.canCatch() || !ball) return false;
    ball.bounce = null;
    ball.flight = null;
    ball.caughtFor = 620;
    ball.landing = null;
    ball.combo += 1;
    // Keep the ball at her feet so the next kick does not need a walk back.
    ball.x = clamp(this.player.x + this.player.facing * 26, this.room.walk.x0 + 20, this.room.walk.x1 - 20);
    ball.y = clamp(this.player.y, this.room.walk.y0, this.room.walk.y1);
    ball.home = { x: ball.x, y: ball.y };
    this.onCatch?.(ball.combo);
    return true;
  }

  ballDistance(): number {
    if (!this.ball) return Number.POSITIVE_INFINITY;
    return distance(this.player.x, this.player.y, this.ball.x, this.ball.y);
  }

  /** 渲染层需要知道球的当前高度。 */
  ballHeight(): number {
    return ballZ(this.ball);
  }

  tick(dtMs: number): void {
    const dt = clamp(dtMs, 0, 50) / 1000;
    if (this.player.poseUntil && performance.now() >= this.player.poseUntil) {
      this.player.pose = this.player.moving ? "walk" : "idle";
      this.player.poseUntil = 0;
    }
    this.updateMovement(dt);
    this.updateBall(dt);
    this.updateNearest();
    this.updateCamera(dt);
  }

  private updateMovement(dt: number): void {
    if (!this.target) {
      this.player.moving = false;
      if (!this.player.poseUntil && this.player.pose !== "idle") this.player.pose = "idle";
      return;
    }

    const dx = this.target.x - this.player.x;
    const dy = this.target.y - this.player.y;
    const dist = Math.hypot(dx, dy);

    if (dist <= 2.5) {
      this.player.x = this.target.x;
      this.player.y = this.target.y;
      this.player.moving = false;
      if (!this.player.poseUntil) this.player.pose = "idle";
      const propId = this.targetPropId;
      this.target = null;
      this.targetPropId = null;
      if (propId) {
        const prop = getProp(this.room.id, propId);
        if (prop) this.triggerProp(prop);
      }
      return;
    }

    const step = Math.min(dist, WALK_SPEED * dt);
    const nx = this.player.x + (dx / dist) * step;
    const ny = this.player.y + (dy / dist) * step;
    let moved = false;

    if (this.canStand(nx, this.player.y)) {
      this.player.x = nx;
      moved = true;
    }
    if (this.canStand(this.player.x, ny)) {
      this.player.y = ny;
      moved = true;
    }

    if (!moved) {
      const fallback = this.resolveTarget(this.target.x, this.target.y);
      if (fallback.x !== this.target.x || fallback.y !== this.target.y) {
        this.target = fallback;
      } else {
        this.target = null;
        this.targetPropId = null;
        this.player.moving = false;
      }
      return;
    }

    if (Math.abs(dx) > 1) this.player.facing = dx > 0 ? 1 : -1;
    this.player.moving = true;
    if (!this.player.poseUntil) this.player.pose = "walk";
    this.player.phase += dt * (1.4 + Math.min(1, dist / 220) * 1.6);
  }

  private updateBall(dt: number): void {
    const ball = this.ball;
    if (!ball) return;

    if (ball.caughtFor > 0) {
      ball.caughtFor -= dt * 1000;
      if (ball.caughtFor <= 0 && ball.home) {
        ball.x = ball.home.x;
        ball.y = ball.home.y;
        ball.landing = null;
      }
      return;
    }

    if (ball.flight) {
      ball.flight.elapsed += dt * 1000;
      const t = clamp(ball.flight.elapsed / ball.flight.duration, 0, 1);
      ball.x = ball.flight.fromX + (ball.flight.toX - ball.flight.fromX) * t;
      ball.y = ball.flight.fromY + (ball.flight.toY - ball.flight.fromY) * t;
      if (t >= 1) {
        ball.x = ball.flight.toX;
        ball.y = ball.flight.toY;
        ball.flight = null;
        ball.bounce = {
          elapsed: 0,
          duration: BALL_BOUNCE_MS,
          bounces: BALL_BOUNCES,
          height: 120,
        };
      }
      return;
    }

    if (ball.bounce) {
      ball.bounce.elapsed += dt * 1000;
      if (ball.bounce.elapsed >= ball.bounce.duration * ball.bounce.bounces) {
        const previous = ball.combo;
        ball.bounce = null;
        ball.combo = 0;
        ball.landing = null;
        this.onMiss?.(previous);
        // Keep the ball where it landed: the next kick starts from there.
      }
    }
  }

  private updateNearest(): void {
    let best: RoomProp | null = null;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const prop of this.room.props) {
      if (!prop.action && !prop.doorTo) continue;
      if (prop.kind === "ball" && (this.ball?.flight || this.ball?.bounce)) continue;
      const at = this.approachFor(prop);
      const d = distance(this.player.x, this.player.y, at.x, at.y);
      if (d <= INTERACT_RANGE && d < bestDist) {
        best = prop;
        bestDist = d;
      }
    }
    this.nearest = best;
  }

  private updateCamera(dt: number): void {
    if (!this.cameraFollow) return;
    const target = clamp(this.player.x - this.viewW / 2, 0, this.maxCameraX);
    const ease = 1 - Math.exp(-dt * 7);
    this.cameraX += (target - this.cameraX) * ease;
  }
}
