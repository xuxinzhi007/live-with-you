/**
 * V3 场景动作结算：
 * - 彻底取消恶心人的长冷却（从 15~45s 缩短为 2~3s 轻防抖）
 * - 每次动作不仅给文案，还产出亲密经验（bond）与零钱/种子奖励
 * - 纯函数，便于单测
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

/** 仅保留极短的连点节奏（1.5s–3s），彻底废除 20s–45s 的罚站冷却 */
const COOLDOWN_MS: Record<string, number> = {
  rest: 3_000,
  read: 2_500,
  sit: 2_500,
  wish: 2_000,
  shelf: 1_500,
  buySeed: 1_000,
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

/** 切换场景：记录第一次来访并给予探索奖励（+3 零钱、+5 亲密）。 */
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
    next = { ...next, coins: next.coins + 3, bond: next.bond + 5 };
    next = addJournal(next, `第一次走进${ROOMS[room].name}。`, now);
  }
  return next;
}

/**
 * 物件动作总入口（每个物件互动均奖励亲密值 bond 与属性变化）。
 */
export function applyPropAction(state: GameState, prop: RoomProp, now = Date.now()): ActionOutcome {
  if (prop.doorTo) {
    return ok(state, `去${ROOMS[prop.doorTo].name}。`);
  }

  const coolLeft = cooldownLeftMs(state, prop.id, now);
  if (coolLeft > 0) {
    return blocked(state, `正在回味刚才的片刻，歇 ${Math.ceil(coolLeft / 1000)} 秒再来吧。`);
  }

  switch (prop.action) {
    case "rest": {
      let next: GameState = {
        ...state,
        bond: state.bond + 5,
        pet: {
          ...state.pet,
          energy: Math.min(100, state.pet.energy + 28),
          mood: "sleepy" as const,
          lastInteraction: now,
        },
      };
      next = bumpHappiness(next, 5);
      next = setCooldown(next, prop, now);
      const lines = [
        "被子晒得暖暖的，雯宝舒舒服服地打了个小盹（+28 精力 · +5 亲密）。",
        "把脸埋进松软的枕头里，听见窗外的微风（+28 精力 · +5 亲密）。",
        "充饱电啦！元气满满地坐了起来（+28 精力 · +5 亲密）。",
      ];
      return ok(next, lines[Math.floor(Math.random() * lines.length)]);
    }

    case "read": {
      const unlockBookmark = !state.bondedMoments.includes("relic:clover-bookmark");
      let next: GameState = {
        ...state,
        coins: state.coins + 1,
        bond: state.bond + (unlockBookmark ? 12 : 6),
        mementos: unlockBookmark ? state.mementos + 1 : state.mementos,
        bondedMoments: unlockBookmark
          ? [...state.bondedMoments, "relic:clover-bookmark"]
          : state.bondedMoments,
        pet: {
          ...state.pet,
          energy: Math.max(0, state.pet.energy - 4),
          mood: "curious" as const,
          lastInteraction: now,
        },
      };
      next = bumpHappiness(next, 7);
      next = setCooldown(next, prop, now);
      if (unlockBookmark) {
        next = addJournal(next, "在书桌翻画册时，发现了夹在书页里的【四叶草书签】🍀！", now);
        return ok(next, "✨ 翻开画册，发现了新图鉴藏品【四叶草书签】🍀（+12 亲密 · +1 零钱）！", "reward");
      }
      const lines = [
        "一起翻到夹着干花的那一页（+6 亲密 · +1 零钱）。",
        "雯宝指着画册上的插图小声念给你听（+6 亲密 · +1 零钱）。",
        "把今天的心情记在页角上（+6 亲密 · +1 零钱）。",
      ];
      return ok(next, lines[Math.floor(Math.random() * lines.length)]);
    }

    case "sit": {
      const needCoin = state.coins < 6;
      const coinGain = needCoin ? 2 : 1;
      let next: GameState = {
        ...state,
        coins: state.coins + coinGain,
        bond: state.bond + 5,
        pet: { ...state.pet, energy: Math.min(100, state.pet.energy + 8), lastInteraction: now },
      };
      next = bumpHappiness(next, 4);
      next = setCooldown(next, prop, now);
      return ok(
        next,
        needCoin
          ? "坐下来歇会儿，在长椅缝里发现了 2 枚零钱（+2 零钱 · +5 亲密）！"
          : "并肩坐在街角长椅上吹风（+1 零钱 · +5 亲密）。",
        needCoin ? "reward" : "ok",
      );
    }

    case "shelf": {
      const { collection } = state.world;
      const parts = FLOWER_KINDS
        .filter((kind) => (collection[kind] ?? 0) > 0)
        .map((kind) => `${FLOWER_META[kind].name}×${collection[kind]}`);
      let next: GameState = {
        ...state,
        bond: state.bond + 3,
      };
      next = bumpHappiness(next, 3);
      next = setCooldown(next, prop, now);
      if (!parts.length) {
        return ok(next, "收藏架正等着第一朵花和许愿摆件入住（+3 亲密）。");
      }
      return ok(next, `收藏架上摆着：${parts.join("，")}（+3 亲密）。`);
    }

    case "buySeed": {
      if (state.coins < 6) {
        return blocked(state, "还差一点零钱（需 6 枚）。点花摊出售花束、或去长椅坐坐都能拿零钱～");
      }
      let next: GameState = {
        ...state,
        coins: state.coins - 6,
        seeds: state.seeds + 2,
        bond: state.bond + 4,
        world: { ...state.world, cooldowns: { ...state.world.cooldowns, [prop.id]: now + (COOLDOWN_MS.buySeed ?? 0) } },
      };
      next = bumpHappiness(next, 4);
      return ok(next, "买了 2 颗精选花种，摊主笑着祝你们种出好花（+2 花种 · +4 亲密）！", "reward");
    }

    case "wish": {
      if (state.coins < 1) {
        return blocked(state, "兜里空了，先摸摸雯宝或收朵花再来许愿吧。");
      }
      let next: GameState = {
        ...state,
        coins: state.coins - 1,
        bond: state.bond + 6,
        world: { ...state.world, cooldowns: { ...state.world.cooldowns, [prop.id]: now + (COOLDOWN_MS.wish ?? 0) } },
      };
      next = bumpHappiness(next, 5);
      const lines = [
        "把一枚零钱丢进喷泉，水花亮晶晶的（+6 亲密）。",
        "雯宝双手合十许了个小愿望（+6 亲密）。",
      ];
      return ok(next, lines[Math.floor(Math.random() * lines.length)]);
    }

    case "plot":
      return plotAction(state, prop, now);

    default:
      return ok(state, "和雯宝在这里待了一会儿。");
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
      return blocked(state, "没有花种了。去街区的花摊买一点，或者参加街区奇遇。");
    }
    const kind: FlowerKind = FLOWER_KINDS[state.world.planted % FLOWER_KINDS.length];
    plots[index] = { kind, plantedAt: now, wateredAt: 0 };
    const next: GameState = {
      ...state,
      seeds: state.seeds - 1,
      bond: state.bond + 4,
      world: { ...state.world, plots, planted: state.world.planted + 1 },
    };
    return ok(
      next,
      `种下了${FLOWER_META[kind].name}，${describeRemaining(plotRemainingMs(plots[index], now))}后开花（+4 亲密）。`,
    );
  }

  if (stage === 3) {
    const kind = plot.kind!;
    const name = FLOWER_META[kind].name;
    plots[index] = emptyPlot();
    const firstOfKind = !state.bondedMoments.includes(`flower:${kind}`);
    const coinReward = firstOfKind ? 4 : 2;
    const bondReward = firstOfKind ? 12 : 6;
    let next: GameState = {
      ...state,
      coins: state.coins + coinReward,
      bond: state.bond + bondReward,
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
    if (firstOfKind) {
      next = {
        ...next,
        mementos: next.mementos + 1,
        bondedMoments: [...next.bondedMoments, `flower:${kind}`],
      };
      next = addJournal(next, `第一朵${name}收进了花束，点亮了花卉图鉴！`, now);
    }
    next = bumpHappiness(next, 6);
    return ok(
      next,
      `💐 收下了${name}！花束+1、留种+1、零钱+${coinReward}、亲密+${bondReward}${firstOfKind ? "（新图鉴点亮！）" : ""}`,
      "reward",
    );
  }

  // 生长中：没浇过水就浇一次，缩短一半时间；已经浇过水再点直接催熟开花！
  if (!plot.wateredAt) {
    const elapsed = Math.max(0, now - plot.plantedAt);
    plots[index] = { ...plot, plantedAt: now - elapsed / 2, wateredAt: now };
    const next: GameState = {
      ...state,
      bond: state.bond + 3,
      world: { ...state.world, plots },
    };
    return ok(next, `💧 浇了水，${describeRemaining(plotRemainingMs(plots[index], now))}后开花（+3 亲密）。`);
  }

  // 已浇过水：悉心照料直接加速盛开，不用干等！
  plots[index] = { ...plot, plantedAt: now - plotDuration(plot) - 100 };
  const next: GameState = {
    ...state,
    bond: state.bond + 3,
    world: { ...state.world, plots },
  };
  return ok(next, `☀️ 在阳光与照料下，${FLOWER_META[plot.kind!].name}提前盛开了！再点一次即可收花～`, "reward");
}

/** 每次踢球都记一笔，并增加亲密。 */
export function recordBallKick(state: GameState): GameState {
  return {
    ...state,
    bond: state.bond + 2,
    world: { ...state.world, kicks: state.world.kicks + 1 },
  };
}

/** 接住球：记录连击、奖励零钱与纪念。 */
export function recordBallCatch(state: GameState, combo: number, now = Date.now()): GameState {
  let next: GameState = {
    ...state,
    coins: state.coins + 1,
    bond: state.bond + 4,
    world: { ...state.world, bestCombo: Math.max(state.world.bestCombo, combo) },
  };
  next = bumpHappiness(next, 3);
  if (combo > 0 && combo % 3 === 0) {
    next = {
      ...next,
      coins: next.coins + 2,
      mementos: next.mementos + 1,
    };
    next = addJournal(next, `连续接住 ${combo} 次球，收下一枚小纪念与零钱奖励！`, now);
  }
  return next;
}

export function recordBallMiss(state: GameState): GameState {
  return state;
}

/** 当前花圃的可执行动作，用于情境按钮文案。 */
export function plotActionLabel(plot: { kind: FlowerKind | null; plantedAt: number; wateredAt: number } | undefined, now: number): string {
  if (!plot || !plot.kind) return "种花";
  const stage = plotStage(plot, now);
  if (stage === 3) return "收花";
  return plot.wateredAt ? "照料催熟" : "浇水";
}

export function plotHint(plot: { kind: FlowerKind | null; plantedAt: number; wateredAt: number } | undefined, now: number): string {
  if (!plot || !plot.kind) return "空花圃 · 可自选播种";
  const stage = plotStage(plot, now);
  if (stage === 3) return `${FLOWER_META[plot.kind].name}盛开啦 · 可收获`;
  return `${FLOWER_META[plot.kind].name}${plot.wateredAt ? "（点此催熟）" : "（点此浇水）"} · ${describeRemaining(plotRemainingMs(plot, now))}`;
}
