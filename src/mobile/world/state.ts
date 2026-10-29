/**
 * V2 世界状态：房间、花圃、冷却与收集。
 *
 * 这里只放“纯数据 + 纯函数”，不依赖 React、Pixi 或浏览器存储，
 * 便于单测，也避免把世界规则散进渲染层。
 */
import type {
  FlowerKind,
  GardenPlot,
  WorldRoomId,
  WorldState,
} from "../engine/types";

export const GARDEN_PLOT_COUNT = 3;
export const PLOT_GROW_MS = 60_000;
export const PLOT_WATERED_GROW_MS = 30_000;

export const ROOM_IDS: WorldRoomId[] = ["home", "garden", "street"];
export const FLOWER_KINDS: FlowerKind[] = ["daisy", "rose", "sunflower"];

export const FLOWER_META: Record<FlowerKind, { name: string; color: string; accent: string }> = {
  daisy: { name: "雏菊", color: "#f6efe0", accent: "#e7b84f" },
  rose: { name: "小玫瑰", color: "#d97b86", accent: "#a94f60" },
  sunflower: { name: "向日葵", color: "#f2c14e", accent: "#b7791f" },
};

/** 旧场景 → 新房间，保证老存档打开后落在合理位置。 */
export function sceneToRoom(sceneId: string): WorldRoomId {
  switch (sceneId) {
    case "balcony":
      return "garden";
    case "street":
    case "cafe":
      return "street";
    default:
      return "home";
  }
}

export function roomToScene(room: WorldRoomId): "bedroom" | "balcony" | "street" {
  if (room === "garden") return "balcony";
  if (room === "street") return "street";
  return "bedroom";
}

export function emptyPlot(): GardenPlot {
  return { kind: null, plantedAt: 0, wateredAt: 0 };
}

export function createInitialWorldState(sceneId = "bedroom"): WorldState {
  return {
    room: sceneToRoom(sceneId),
    plots: Array.from({ length: GARDEN_PLOT_COUNT }, emptyPlot),
    cooldowns: {},
    bestCombo: 0,
    seenIntro: false,
    planted: 0,
    harvested: 0,
    kicks: 0,
    collection: { daisy: 0, rose: 0, sunflower: 0 },
    visited: [sceneToRoom(sceneId)],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeTime(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(value)))
    : fallback;
}

function normalizePlot(value: unknown): GardenPlot {
  if (!isRecord(value)) return emptyPlot();
  const kind = FLOWER_KINDS.includes(value.kind as FlowerKind)
    ? (value.kind as FlowerKind)
    : null;
  if (!kind) return emptyPlot();
  return {
    kind,
    plantedAt: safeTime(value.plantedAt),
    wateredAt: safeTime(value.wateredAt),
  };
}

/**
 * 只增不减：world 缺失时按 currentScene 推导；字段逐个校验，
 * 坏数据回默认值，不抛异常。
 */
export function normalizeWorldState(
  value: unknown,
  currentScene: string,
  now = Date.now(),
): WorldState {
  const fresh = createInitialWorldState(currentScene);
  if (!isRecord(value)) return fresh;

  const room = ROOM_IDS.includes(value.room as WorldRoomId)
    ? (value.room as WorldRoomId)
    : fresh.room;

  const savedPlots = Array.isArray(value.plots) ? value.plots : [];
  const plots = Array.from({ length: GARDEN_PLOT_COUNT }, (_, index) => {
    const plot = normalizePlot(savedPlots[index]);
    if (!plot.kind) return plot;
    // 未来时间戳会让花永远长不好，夹回 now。
    return {
      ...plot,
      plantedAt: Math.min(plot.plantedAt || now, now),
      wateredAt: plot.wateredAt ? Math.min(plot.wateredAt, now) : 0,
    };
  });

  const cooldowns: Record<string, number> = {};
  if (isRecord(value.cooldowns)) {
    for (const [key, at] of Object.entries(value.cooldowns)) {
      if (typeof at === "number" && Number.isFinite(at)) {
        // A skewed clock must not lock an object for years.
        cooldowns[key.slice(0, 48)] = Math.min(safeTime(at), now + 10 * 60_000);
      }
    }
  }

  const collection = { daisy: 0, rose: 0, sunflower: 0 };
  if (isRecord(value.collection)) {
    for (const kind of FLOWER_KINDS) {
      const count = value.collection[kind];
      if (typeof count === "number" && Number.isFinite(count)) {
        collection[kind] = Math.max(0, Math.min(9_999_999, Math.floor(count)));
      }
    }
  }

  const visited: WorldRoomId[] = Array.isArray(value.visited)
    ? Array.from(new Set(value.visited.filter((item): item is WorldRoomId => ROOM_IDS.includes(item as WorldRoomId))))
    : [room];
  if (!visited.includes(room)) visited.push(room);

  const count = (input: unknown, fallback = 0) =>
    typeof input === "number" && Number.isFinite(input)
      ? Math.max(0, Math.min(9_999_999, Math.floor(input)))
      : fallback;

  return {
    room,
    plots,
    cooldowns,
    bestCombo: count(value.bestCombo),
    seenIntro: value.seenIntro === true,
    planted: count(value.planted),
    harvested: count(value.harvested),
    kicks: count(value.kicks),
    collection,
    visited,
  };
}

/** 生长时长：浇过水的花圃更快。 */
export function plotDuration(plot: GardenPlot): number {
  if (!plot.kind) return 0;
  return plot.wateredAt ? PLOT_WATERED_GROW_MS : PLOT_GROW_MS;
}

/** 0 = 空地，1 = 发芽，2 = 花苞，3 = 开花可收。 */
export function plotStage(plot: GardenPlot, now: number): 0 | 1 | 2 | 3 {
  if (!plot.kind) return 0;
  const duration = plotDuration(plot);
  const elapsed = Math.max(0, now - plot.plantedAt);
  if (elapsed >= duration) return 3;
  const ratio = elapsed / duration;
  if (ratio < 1 / 3) return 1;
  if (ratio < 1) return 2;
  return 3;
}

export function plotRemainingMs(plot: GardenPlot, now: number): number {
  if (!plot.kind) return 0;
  return Math.max(0, plotDuration(plot) - (now - plot.plantedAt));
}

export function describeRemaining(ms: number): string {
  if (ms <= 0) return "可以收了";
  const seconds = Math.ceil(ms / 1000);
  if (seconds < 60) return `还要 ${seconds} 秒`;
  return `还要 ${Math.ceil(seconds / 60)} 分钟`;
}
