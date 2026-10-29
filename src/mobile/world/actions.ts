/**
 * V2 动作结算：玩家点击物件后发生的世界变化。
 *
 * 纯函数，入参出参都是 GameState，不发 React 状态、不碰渲染。
 * 规则保持低压力：没有失败惩罚，只有“现在做不了”的温和提示。
 */
import type { GameState, FlowerKind } from "../engine/types.ts";
import { ROOMS, type RoomProp } from "./rooms.ts";
import {
  FLOWER_KINDS,
  FLOWER_META,
  emptyPlot,
  plotDuration,
  plotRemainingMs,
  plotStage,
  describeRemaining,
  roomToScene,
} from "./state.ts";

const JOURNAL_LIMIT = 48;
const HAPPINESS_CAP = 100;

const COOLDOWN_MS: Record<string, number> = {
  rest: 20_000,
  read: 15_000,
  sit: 12_000,
  wish: 45_000,
  shelf: 4_000,
  buySeed: 1_500,
};

export type ActionTone = "ok" | "blocked" | "reward";

export interface ActionOutcome {
  state: GameState;
  line: string;
  tone: ActionTone;
}

function addJournal(state: GameState, text: string, now: number): GameState {
  const entry = {
    id: `${now}-${state.journal.length}`,
    text,
    time: now,
  };
  return { ...state, journal: [entry, ...state.journal].slice(0, JOURNAL_LIMIT) };
}

function bumpHappiness(state: GameState, amount: number): GameState {
  return {
    ...state,
    pet: { ...state.pet, happiness: Math.max(0, Math.min(HAPPINESS_CAP, state.pet.happiness + amount)) },
  };
}

function setCooldown(state: GameState, prop: RoomProp, now: number): GameState {
  const duration = (prop.action && COOLDOWN_MS[prop.action]) || 0;
  if (!duration) return state;
  return {
    ...state,
    world: { ...state.world, cooldowns: { ...state.world.cooldowns, [prop.id]: now + duration } },
  };
}

export function cooldownLeftMs(state: GameState, propId: string, now = Date.now()): number {
  const until = state.world.cooldowns[propId] ?? 0;
  return Math.max(0, until - now);
}

function blocked(state: GameState, line: string): ActionOutcome {
  return { state, line, tone: "blocked" };
}

function ok(state: GameState, line: string, tone: ActionTone = "ok"): ActionOutcome {
  return { state, line, tone };
}

/** 进入房间：切换 currentScene、记录第一次来访。 */
export function enterRoom(state: GameState, room: GameState["world"]["room"], now = Date.now()): GameState {
  if (state.world.room === room) return state;
  const firstVisit = !state.world.visited.includes(room);
  let next: GameState = {
    ...state,
    currentScene: roomToScene(room),
    world: {
      ...state.world,
      room,
      visited: firstVisit ? [...state.world.visited, room] : state.world.visited,
    },
  };
  if (firstVisit) {
    next = { ...next, coins: next.coins + 3 };
    next = addJournal(next, `第一次走进${ROOMS[room].name}。`, now);
  }
  return next;
}

/**
 * 物件动作总入口。
 * 物件的画面反馈（走位、动画）由渲染层负责，这里只结算存档数据与文案。
 */
export function applyPropAction(state: GameState, prop: RoomProp, now = Date.now()): ActionOutcome {
  if (prop.doorTo) {
    return ok(state, `去${ROOMS[prop.doorTo].name}。`);
  }

  const coolLeft = cooldownLeftMs(state, prop.id, now);
  if (coolLeft > 0) {
    return blocked(state, `刚做过，歇 ${Math.ceil(coolLeft / 1000)} 秒再来吧。`);
  }

  switch (prop.action) {
    case "rest": {
      let next: GameState = {
        ...state,
        pet: {
          ...state.pet,
          energy: Math.min(100, state.pet.energy + 28),
          mood: "sleepy" as const,
          lastInteraction: now,
        },
      };
      next = bumpHappiness(next, 3);
      next = setCooldown(next, prop, now);
      const lines = [
        "被子晒得暖暖的，躺一会儿。",
        "把脸埋进枕头里，听见窗外的风。",
        "今天也可以什么都不做。",
      ];
      return ok(next, lines[Math.floor(Math.random() * lines.length)]);
    }

    case "read": {
      let next: GameState = {
        ...state,
        pet: {
          ...state.pet,
          energy: Math.max(0, state.pet.energy - 5),
          mood: "curious" as const,
          lastInteraction: now,
        },
      };
      next = bumpHappiness(next, 7);
      next = setCooldown(next, prop, now);
      const lines = [
        "翻到夹着花瓣的那一页。",
        "看到一半，开始走神。",
        "把今天记在页角上。",
      ];
      return ok(next, lines[Math.floor(Math.random() * lines.length)]);
    }

    case "sit": {
      let next: GameState = {
        ...state,
        pet: { ...state.pet, energy: Math.min(100, state.pet.energy + 6), lastInteraction: now },
      };
      next = bumpHappiness(next, 3);
      next = setCooldown(next, prop, now);
      return ok(next, "坐下来，风从耳边过去。");
    }

    case "shelf": {
      const { collection } = state.world;
      const parts = FLOWER_KINDS
        .filter((kind) => (collection[kind] ?? 0) > 0)
        .map((kind) => `${FLOWER_META[kind].name}×${collection[kind]}`);
      let next = bumpHappiness(state, 2);
      next = setCooldown(next, prop, now);
      if (!parts.length) {
        return ok(next, "架子还空着。等第一朵花收进来。");
      }
      return ok(next, `架子上有：${parts.join("，")}。`);
    }

    case "buySeed": {
      if (state.coins < 6) {
        return blocked(state, "还差一点零钱。去喷泉边坐坐，或者明天再来。");
      }
      let next: GameState = {
        ...state,
        coins: state.coins - 6,
        seeds: state.seeds + 2,
        world: { ...state.world, cooldowns: { ...state.world.cooldowns, [prop.id]: now + (COOLDOWN_MS.buySeed ?? 0) } },
      };
      next = bumpHappiness(next, 2);
      return ok(next, "买了两颗花种，摊主多送了一小把。");
    }

    case "wish": {
      if (state.coins < 1) {
        return blocked(state, "兜里空了，先看看水花也好。");
      }
      let next: GameState = {
        ...state,
        coins: state.coins - 1,
        world: { ...state.world, cooldowns: { ...state.world.cooldowns, [prop.id]: now + (COOLDOWN_MS.wish ?? 0) } },
      };
      next = bumpHappiness(next, 3);
      const lines = [
        "把一枚零钱丢进水里，水面晃了晃。",
        "许了个很小的愿，不告诉别人。",
        "看着水花，坐了一会儿。",
      ];
      return ok(next, lines[Math.floor(Math.random() * lines.length)]);
    }

    case "plot":
      return plotAction(state, prop, now);

    default:
      return ok(state, "现在没什么可做的。");
  }
}

function plotAction(state: GameState, prop: RoomProp, now: number): ActionOutcome {
  if (prop.plotIndex == null) return ok(state, "这块土还没准备好。");
  const index = prop.plotIndex;
  const plot = state.world.plots[index] ?? emptyPlot();
  const stage = plotStage(plot, now);
  const plots = [...state.world.plots];

  if (stage === 0) {
    if (state.seeds < 1) {
      return blocked(state, "没有花种了。去街区的花摊买一点。");
    }
    const kind: FlowerKind = FLOWER_KINDS[state.world.planted % FLOWER_KINDS.length];
    plots[index] = { kind, plantedAt: now, wateredAt: 0 };
    const next: GameState = {
      ...state,
      seeds: state.seeds - 1,
      world: { ...state.world, plots, planted: state.world.planted + 1 },
    };
    return ok(
      next,
      `种下了${FLOWER_META[kind].name}，${describeRemaining(plotRemainingMs(plots[index], now))}后开花。`,
    );
  }

  if (stage === 3) {
    const kind = plot.kind!;
    const name = FLOWER_META[kind].name;
    plots[index] = emptyPlot();
    let next: GameState = {
      ...state,
      flowers: state.flowers + 1,
      // 收花时留一颗种子，保证「种 → 收 → 再种」不会因为零钱断掉。
      seeds: state.seeds + 1,
      world: {
        ...state.world,
        plots,
        harvested: state.world.harvested + 1,
        collection: {
          ...state.world.collection,
          [kind]: (state.world.collection[kind] ?? 0) + 1,
        },
      },
    };
    const firstOfKind = !state.bondedMoments.includes(`flower:${kind}`);
    if (firstOfKind) {
      next = {
        ...next,
        mementos: next.mementos + 1,
        bondedMoments: [...next.bondedMoments, `flower:${kind}`],
      };
      next = addJournal(next, `第一朵${name}收进了花束。`, now);
    }
    next = bumpHappiness(next, 5);
    return ok(next, `收下了${name}，花束里多了一朵，还留了一颗种子。`, "reward");
  }

  // 生长中：没浇过水就浇一次，缩短一半时间。
  if (!plot.wateredAt) {
    const elapsed = Math.max(0, now - plot.plantedAt);
    plots[index] = { ...plot, plantedAt: now - elapsed / 2, wateredAt: now };
    const next: GameState = { ...state, world: { ...state.world, plots } };
    return ok(next, `浇了水，${describeRemaining(plotRemainingMs(plots[index], now))}后开花。`);
  }

  return ok(state, `已经浇过水了，${describeRemaining(plotDuration(plot) - (now - plot.plantedAt))}后开花。`);
}

/** 每次踢球都记一笔，用于「更多」里的统计。 */
export function recordBallKick(state: GameState): GameState {
  return {
    ...state,
    world: { ...state.world, kicks: state.world.kicks + 1 },
  };
}

/** 接住球：记录连击、偶尔留下纪念。 */
export function recordBallCatch(state: GameState, combo: number, now = Date.now()): GameState {
  let next: GameState = {
    ...state,
    world: { ...state.world, bestCombo: Math.max(state.world.bestCombo, combo) },
  };
  next = bumpHappiness(next, 1);
  if (combo > 0 && combo % 3 === 0) {
    next = {
      ...next,
      mementos: next.mementos + 1,
    };
    next = addJournal(next, `连续接住 ${combo} 次球，收下一枚小纪念。`, now);
  }
  return next;
}

export function recordBallMiss(state: GameState): GameState {
  return state;
}

/** 当前花圃的可执行动作，用于 HUD 上的情境按钮文案。 */
export function plotActionLabel(plot: { kind: FlowerKind | null; plantedAt: number; wateredAt: number } | undefined, now: number): string {
  if (!plot || !plot.kind) return "种花";
  const stage = plotStage(plot, now);
  if (stage === 3) return "收花";
  return plot.wateredAt ? "等开花" : "浇水";
}

export function plotHint(plot: { kind: FlowerKind | null; plantedAt: number; wateredAt: number } | undefined, now: number): string {
  if (!plot || !plot.kind) return "这块地还空着。";
  const stage = plotStage(plot, now);
  if (stage === 3) return `${FLOWER_META[plot.kind].name}开好了。`;
  return `${FLOWER_META[plot.kind].name}${plot.wateredAt ? "喝饱了水" : "刚种下"}，${describeRemaining(plotRemainingMs(plot, now))}。`;
}
