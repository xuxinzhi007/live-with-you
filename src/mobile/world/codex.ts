/**
 * V3 核心系统：亲密等级成长、18 项全图鉴（N/R/SR）、许愿扭蛋池、街区奇遇二选一、雯宝自主心愿气泡。
 *
 * 纯函数 + 纯数据，不依赖 DOM 或 Pixi，方便单测。
 */
import type { FlowerKind, GameState, WorldRoomId } from "../engine/types.ts";
import { FLOWER_KINDS, FLOWER_META } from "./state.ts";

export type CodexRarity = "N" | "R" | "SR";
export type CodexCategory = "flower" | "relic" | "memory";

export interface CodexEntry {
  /** 写入 GameState.bondedMoments 的唯一键，如 "flower:daisy" / "relic:whale-globe" / "memory:first-rain" */
  id: string;
  category: CodexCategory;
  rarity: CodexRarity;
  name: string;
  icon: string;
  desc: string;
  /** 抽中或解锁时奖励的亲密经验 */
  bondBonus: number;
}

export const CODEX_ENTRIES: CodexEntry[] = [
  // 🌸 花卉图鉴（3 项）
  {
    id: "flower:daisy",
    category: "flower",
    rarity: "N",
    name: "奶油雏菊",
    icon: "🌼",
    desc: "第一朵在庭院泥土里冒头的小白花，带着太阳晒过的微甜香气。",
    bondBonus: 8,
  },
  {
    id: "flower:rose",
    category: "flower",
    rarity: "R",
    name: "绒瓣小玫瑰",
    icon: "🌹",
    desc: "花瓣边缘带着柔和的暮色粉，插在书桌花瓶里能香一整晚。",
    bondBonus: 12,
  },
  {
    id: "flower:sunflower",
    category: "flower",
    rarity: "SR",
    name: "金灿向日葵",
    icon: "🌻",
    desc: "无论阴天还是傍晚都朝着雯宝笑的向日葵，是庭院里最亮眼的一抹金黄。",
    bondBonus: 16,
  },

  // 🎁 珍藏摆件图鉴（9 项，抽到后展示在收藏架与图鉴中）
  {
    id: "relic:clover-bookmark",
    category: "relic",
    rarity: "N",
    name: "四叶草书签",
    icon: "🍀",
    desc: "夹在常翻的那本诗集里，每次翻开都能闻到一点草木香。",
    bondBonus: 6,
  },
  {
    id: "relic:honey-cookie-jar",
    category: "relic",
    rarity: "N",
    name: "蜂蜜曲奇罐",
    icon: "🍪",
    desc: "玻璃罐里装着烤得金黄的黄油曲奇，是雯宝下午茶的秘密储备。",
    bondBonus: 6,
  },
  {
    id: "relic:paper-windmill",
    category: "relic",
    rarity: "N",
    name: "彩色纸风车",
    icon: "🎐",
    desc: "插在庭院篱笆边的小风车，风一吹就哗啦啦地转个不停。",
    bondBonus: 6,
  },
  {
    id: "relic:ceramic-teacup",
    category: "relic",
    rarity: "N",
    name: "暖白陶土茶杯",
    icon: "🍵",
    desc: "杯沿印着一朵小小雏菊，捧在手心里刚刚好。",
    bondBonus: 6,
  },
  {
    id: "relic:music-box",
    category: "relic",
    rarity: "R",
    name: "发条木八音盒",
    icon: "🎵",
    desc: "拧上三圈发条，就会慢慢淌出一段让人安心的摇篮曲。",
    bondBonus: 12,
  },
  {
    id: "relic:whale-globe",
    category: "relic",
    rarity: "R",
    name: "小鲸鱼水晶球",
    icon: "🐋",
    desc: "摇一摇就会飘起细碎的银色雪花，蓝白小鲸鱼在里面轻轻游动。",
    bondBonus: 12,
  },
  {
    id: "relic:moon-lamp",
    category: "relic",
    rarity: "R",
    name: "新月床头灯",
    icon: "🌙",
    desc: "夜里亮起柔和的暖黄光晕，把怕黑的影子都挡在窗外。",
    bondBonus: 12,
  },
  {
    id: "relic:star-kaleidoscope",
    category: "relic",
    rarity: "SR",
    name: "星屑万花筒",
    icon: "🔭",
    desc: "对着灯光转一下，能看见像银河一样盛开的彩色碎钻。",
    bondBonus: 20,
  },
  {
    id: "relic:golden-pocket-watch",
    category: "relic",
    rarity: "SR",
    name: "停驻时光怀表",
    icon: "🕰️",
    desc: "从喷泉底捞起的精致古董怀表，指针指向我们第一次相遇的时刻。",
    bondBonus: 22,
  },

  // 📸 奇遇记忆图鉴（6 项，通过街区奇遇事件与特别互动解锁）
  {
    id: "memory:window-rain",
    category: "memory",
    rarity: "N",
    name: "窗边的听雨午后",
    icon: "🌧️",
    desc: "两个人在小屋窗边并肩听雨，玻璃上画了一个小小的笑脸。",
    bondBonus: 8,
  },
  {
    id: "memory:stray-kitten",
    category: "memory",
    rarity: "N",
    name: "街角偶遇橘猫",
    icon: "🐱",
    desc: "在街区长椅下分了一半小鱼干给路过的橘猫，它蹭了蹭雯宝的裙角。",
    bondBonus: 8,
  },
  {
    id: "memory:secret-letter",
    category: "memory",
    rarity: "R",
    name: "树洞里的明信片",
    icon: "✉️",
    desc: "庭院大树下藏着一张画着花束的手绘明信片，背面写着『今天也很开心』。",
    bondBonus: 12,
  },
  {
    id: "memory:sunset-fountain",
    category: "memory",
    rarity: "R",
    name: "暮色里的喷泉彩虹",
    icon: "🌈",
    desc: "傍晚的阳光穿过喷泉水雾，正好在雯宝手心映出一道小小的彩虹。",
    bondBonus: 14,
  },
  {
    id: "memory:midnight- cocoa",
    category: "memory",
    rarity: "SR",
    name: "深夜的热可可",
    icon: "☕",
    desc: "睡不着的夜晚，两杯冒着热气的棉花糖可可，聊到了星星都快睡着。",
    bondBonus: 20,
  },
  {
    id: "memory:full-bloom-promise",
    category: "memory",
    rarity: "SR",
    name: "满院花开的约定",
    icon: "💐",
    desc: "当雏菊、小玫瑰和向日葵一起盛开时，雯宝把最漂亮的一朵别在了你的衣角。",
    bondBonus: 24,
  },
];

export const TOTAL_CODEX_COUNT = CODEX_ENTRIES.length; // 18

/* ============ 亲密等级与称号体系 ============ */

export interface BondLevelInfo {
  level: number;
  title: string;
  currentExp: number;
  nextLevelExp: number;
  progressPercent: number;
  totalBond: number;
}

const LEVEL_TITLES: string[] = [
  "初识室友",   // Lv.1
  "点头之交",   // Lv.2
  "温室伙伴",   // Lv.3
  "午后茶友",   // Lv.4
  "默契搭档",   // Lv.5
  "街角同行",   // Lv.6
  "无话不谈",   // Lv.7
  "心有灵犀",   // Lv.8
  "朝夕相伴",   // Lv.9
  "知心挚友",   // Lv.10+
];

/** 每升一级所需经验：Lv1->2 需 20，之后每级递增 10 */
export function expForLevel(level: number): number {
  return 20 + Math.max(0, level - 1) * 10;
}

export function getBondLevelInfo(bond: number): BondLevelInfo {
  const safeBond = Math.max(0, Math.floor(bond || 0));
  let level = 1;
  let remaining = safeBond;
  while (level < 20) {
    const need = expForLevel(level);
    if (remaining < need) {
      return {
        level,
        title: LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)],
        currentExp: remaining,
        nextLevelExp: need,
        progressPercent: Math.min(100, Math.round((remaining / need) * 100)),
        totalBond: safeBond,
      };
    }
    remaining -= need;
    level += 1;
  }
  return {
    level,
    title: LEVEL_TITLES[LEVEL_TITLES.length - 1],
    currentExp: remaining,
    nextLevelExp: 200,
    progressPercent: 100,
    totalBond: safeBond,
  };
}

/* ============ 图鉴统计与查询 ============ */

export interface CodexProgress {
  unlockedCount: number;
  totalCount: number;
  percent: number;
  byCategory: Record<CodexCategory, { unlocked: number; total: number }>;
}

export function getCodexProgress(bondedMoments: string[]): CodexProgress {
  const set = new Set(bondedMoments);
  const byCategory: Record<CodexCategory, { unlocked: number; total: number }> = {
    flower: { unlocked: 0, total: 0 },
    relic: { unlocked: 0, total: 0 },
    memory: { unlocked: 0, total: 0 },
  };
  let unlockedCount = 0;
  for (const item of CODEX_ENTRIES) {
    byCategory[item.category].total += 1;
    if (set.has(item.id)) {
      byCategory[item.category].unlocked += 1;
      unlockedCount += 1;
    }
  }
  return {
    unlockedCount,
    totalCount: TOTAL_CODEX_COUNT,
    percent: Math.round((unlockedCount / TOTAL_CODEX_COUNT) * 100),
    byCategory,
  };
}

/* ============ 喷泉许愿扭蛋池（N / R / SR） ============ */

export interface WishDrawResult {
  state: GameState;
  entry: CodexEntry;
  isNew: boolean;
  bondGained: number;
  coinsRefund: number;
  leveledUp: boolean;
  newLevel: number;
  line: string;
}

const GACHA_POOL = CODEX_ENTRIES.filter((e) => e.category === "relic" || e.category === "memory");

/**
 * 喷泉许愿扭蛋（消耗 3 零钱，或 1 朵花束免费许愿）：
 * - 优先保障高概率抽出未解锁的藏品（防非酋卡死图鉴）
 * - 抽到新藏品：点亮图鉴 + 奖励对应 bondBonus + 纪念 +1 + 写入手账
 * - 抽到重复藏品：转化为 +2 零钱补贴 + +5 亲密经验
 */
export function drawFountainWish(
  state: GameState,
  payWith: "coins" | "flower" = "coins",
  now = Date.now(),
  rng = Math.random,
): { ok: false; reason: string; state: GameState } | { ok: true; result: WishDrawResult } {
  const costCoins = 3;
  if (payWith === "coins" && state.coins < costCoins) {
    return {
      ok: false,
      reason: "零钱不够 3 枚啦。可以摸摸雯宝、收花，或者用 1 朵花束许愿～",
      state,
    };
  }
  if (payWith === "flower" && state.flowers < 1) {
    return {
      ok: false,
      reason: "还没有花束呢，去庭院种一朵花吧～",
      state,
    };
  }

  const unlocked = new Set(state.bondedMoments);
  const lockedPool = GACHA_POOL.filter((item) => !unlocked.has(item.id));

  // 75% 概率优先从未解锁池抽取（若还有未解锁项）
  const targetPool = lockedPool.length > 0 && rng() < 0.75 ? lockedPool : GACHA_POOL;

  // 按稀有度权重：N=60, R=30, SR=12
  const weights = targetPool.map((item) => (item.rarity === "SR" ? 12 : item.rarity === "R" ? 30 : 60));
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let roll = rng() * totalWeight;
  let picked = targetPool[0];
  for (let i = 0; i < targetPool.length; i++) {
    roll -= weights[i];
    if (roll <= 0) {
      picked = targetPool[i];
      break;
    }
  }

  const prevLevel = getBondLevelInfo(state.bond).level;
  const isNew = !unlocked.has(picked.id);
  const bondGained = isNew ? picked.bondBonus : 5;
  const coinsRefund = isNew ? 0 : 2;

  const nextCoins = (payWith === "coins" ? state.coins - costCoins : state.coins) + coinsRefund;
  const nextFlowers = payWith === "flower" ? state.flowers - 1 : state.flowers;
  const nextBond = state.bond + bondGained;
  const newLevelInfo = getBondLevelInfo(nextBond);
  const leveledUp = newLevelInfo.level > prevLevel;
  const levelBonusCoins = leveledUp ? 5 : 0;

  const nextMoments = isNew ? [...state.bondedMoments, picked.id] : state.bondedMoments;
  const journalText = isNew
    ? `在喷泉许愿抽到了【${picked.rarity} · ${picked.name}】${picked.icon}！`
    : `在喷泉重温了【${picked.name}】，水花带回了 2 枚零钱。`;

  const nextJournal = [
    { id: `${now}-${state.journal.length}`, text: journalText, time: now },
    ...state.journal,
  ].slice(0, 48);

  const nextState: GameState = {
    ...state,
    coins: nextCoins + levelBonusCoins,
    flowers: nextFlowers,
    bond: nextBond,
    mementos: isNew ? state.mementos + 1 : state.mementos,
    bondedMoments: nextMoments,
    pet: {
      ...state.pet,
      happiness: Math.min(100, state.pet.happiness + 6),
      mood: "excited",
      lastInteraction: now,
    },
    journal: nextJournal,
  };

  const line = isNew
    ? `✨ 许愿成功！获得了新图鉴【${picked.rarity}】${picked.icon} ${picked.name}！`
    : `💫 抽到了${picked.icon} ${picked.name}（已拥有，转化为 +2 零钱 & +5 亲密）`;

  return {
    ok: true,
    result: {
      state: nextState,
      entry: picked,
      isNew,
      bondGained,
      coinsRefund,
      leveledUp,
      newLevel: newLevelInfo.level,
      line,
    },
  };
}

/* ============ 雯宝的自主心愿气泡（Craving / Thought Bubble） ============ */

export interface CompanionWish {
  id: string;
  room: WorldRoomId;
  actionKey: string;
  icon: string;
  label: string;
  line: string;
}

export const COMPANION_WISHES: CompanionWish[] = [
  {
    id: "wish-pat",
    room: "home",
    actionKey: "pat",
    icon: "♥",
    label: "想被摸摸头",
    line: "雯宝轻轻拽了拽你的袖子，好像想让你摸摸头。",
  },
  {
    id: "wish-snack",
    room: "home",
    actionKey: "snack",
    icon: "🍪",
    label: "想吃小曲奇",
    line: "肚子有一点点饿了，闻到了黄油曲奇的香味～",
  },
  {
    id: "wish-read",
    room: "home",
    actionKey: "read",
    icon: "📖",
    label: "想一起翻画册",
    line: "书桌上的画册翻到了一半，想和你一起看。",
  },
  {
    id: "wish-rest",
    room: "home",
    actionKey: "rest",
    icon: "🛏️",
    label: "想靠着枕头打盹",
    line: "被子晒得蓬松暖和，想上去滚一圈。",
  },
  {
    id: "wish-garden",
    room: "garden",
    actionKey: "garden",
    icon: "🌷",
    label: "想去庭院看花",
    line: "不知道庭院里的花苗长高了没有？去看看吧！",
  },
  {
    id: "wish-ball",
    room: "garden",
    actionKey: "ball",
    icon: "⚽",
    label: "想在草地踢球",
    line: "今天天气真好，想在草地上踢两脚小皮球！",
  },
  {
    id: "wish-fountain",
    room: "street",
    actionKey: "wish",
    icon: "⛲",
    label: "想去喷泉许愿",
    line: "街区喷泉的水花亮晶晶的，我们去许个愿好不好？",
  },
  {
    id: "wish-bouquet",
    room: "street",
    actionKey: "sellBouquet",
    icon: "💐",
    label: "想逛街区花摊",
    line: "花摊老板今天在收新鲜花束呢，去逛逛吧～",
  },
];

export function pickNextCompanionWish(state: GameState, indexSeed = 0): CompanionWish {
  if (state.pet.energy < 40) {
    return COMPANION_WISHES.find((w) => w.id === "wish-rest")!;
  }
  const hasBloom = state.world.plots.some((p) => p.kind !== null);
  if (hasBloom && indexSeed % 3 === 1) {
    return COMPANION_WISHES.find((w) => w.id === "wish-garden")!;
  }
  return COMPANION_WISHES[Math.abs(indexSeed) % COMPANION_WISHES.length];
}

/* ============ 街区奇遇二选一事件卡 ============ */

export interface StreetEncounterChoice {
  label: string;
  outcomeLine: string;
  coinsDelta: number;
  seedsDelta: number;
  bondDelta: number;
  unlockMemoryId?: string;
}

export interface StreetEncounter {
  id: string;
  title: string;
  desc: string;
  icon: string;
  choices: [StreetEncounterChoice, StreetEncounterChoice];
}

export const STREET_ENCOUNTERS: StreetEncounter[] = [
  {
    id: "enc-kitten",
    title: "长椅下的小橘猫",
    desc: "一只圆滚滚的小橘猫正蹲在街区长椅下，歪着脑袋盯住雯宝的口袋。",
    icon: "🐱",
    choices: [
      {
        label: "🍪 分它半块小饼干",
        outcomeLine: "小橘猫开心地咪了一声，从草丛里叼来一颗饱满的花种放在雯宝脚边！",
        coinsDelta: 2,
        seedsDelta: 1,
        bondDelta: 10,
        unlockMemoryId: "memory:stray-kitten",
      },
      {
        label: "📸 蹲下来轻轻挠下巴",
        outcomeLine: "猫咪发出呼噜呼噜的声音，你抓拍下了雯宝笑得眼睛弯弯的一幕。",
        coinsDelta: 3,
        seedsDelta: 0,
        bondDelta: 12,
        unlockMemoryId: "memory:stray-kitten",
      },
    ],
  },
  {
    id: "enc-postcard",
    title: "大树下的神秘信封",
    desc: "微风吹过庭院与街角的围栏，一片夹在木箱缝隙里的彩绘明信片露了出来。",
    icon: "✉️",
    choices: [
      {
        label: "📖 和雯宝一起拆开看",
        outcomeLine: "明信片里夹着两枚闪亮的纪念硬币和一朵干花，雯宝小心地收进了手账！",
        coinsDelta: 5,
        seedsDelta: 0,
        bondDelta: 10,
        unlockMemoryId: "memory:secret-letter",
      },
      {
        label: "🌱 在旁边回赠一颗花种",
        outcomeLine: "把善意留给下一个经过的人，雯宝看向你的眼神格外温柔。",
        coinsDelta: 3,
        seedsDelta: 1,
        bondDelta: 14,
        unlockMemoryId: "memory:secret-letter",
      },
    ],
  },
  {
    id: "enc-rainbow",
    title: "喷泉边的七彩水雾",
    desc: "阳光斜斜地照在街区喷泉上，水珠在空气里折射出一小片亮晶晶的彩虹。",
    icon: "🌈",
    choices: [
      {
        label: "🤲 伸手去接彩虹水珠",
        outcomeLine: "水珠落在雯宝手心，她开心地转了个圈，还在池边发现了零钱！",
        coinsDelta: 4,
        seedsDelta: 0,
        bondDelta: 12,
        unlockMemoryId: "memory:sunset-fountain",
      },
      {
        label: "🌼 许下满院花开的愿望",
        outcomeLine: "花摊摊主被你们感染，笑着送了你们两颗精选花种！",
        coinsDelta: 2,
        seedsDelta: 2,
        bondDelta: 10,
        unlockMemoryId: "memory:sunset-fountain",
      },
    ],
  },
];

export function resolveEncounterChoice(
  state: GameState,
  encounter: StreetEncounter,
  choiceIndex: 0 | 1,
  now = Date.now(),
): {
  state: GameState;
  line: string;
  bondGained: number;
  coinsGained: number;
  seedsGained: number;
  unlockedEntry: CodexEntry | null;
  leveledUp: boolean;
} {
  const choice = encounter.choices[choiceIndex] ?? encounter.choices[0];
  const prevLevel = getBondLevelInfo(state.bond).level;
  const unlocked = new Set(state.bondedMoments);
  let unlockedEntry: CodexEntry | null = null;
  const nextMoments = [...state.bondedMoments];

  if (choice.unlockMemoryId && !unlocked.has(choice.unlockMemoryId)) {
    nextMoments.push(choice.unlockMemoryId);
    unlockedEntry = CODEX_ENTRIES.find((e) => e.id === choice.unlockMemoryId) ?? null;
  }

  const nextBond = state.bond + choice.bondDelta + (unlockedEntry ? unlockedEntry.bondBonus : 0);
  const newLevel = getBondLevelInfo(nextBond).level;
  const leveledUp = newLevel > prevLevel;

  const nextJournal = [
    {
      id: `${now}-${state.journal.length}`,
      text: `【奇遇·${encounter.title}】${choice.outcomeLine}`,
      time: now,
    },
    ...state.journal,
  ].slice(0, 48);

  const nextState: GameState = {
    ...state,
    coins: Math.max(0, state.coins + choice.coinsDelta + (leveledUp ? 5 : 0)),
    seeds: Math.max(0, state.seeds + choice.seedsDelta),
    bond: nextBond,
    mementos: unlockedEntry ? state.mementos + 1 : state.mementos,
    bondedMoments: nextMoments,
    pet: {
      ...state.pet,
      happiness: Math.min(100, state.pet.happiness + 8),
      mood: "happy",
      lastInteraction: now,
    },
    journal: nextJournal,
  };

  return {
    state: nextState,
    line: choice.outcomeLine,
    bondGained: nextBond - state.bond,
    coinsGained: choice.coinsDelta + (leveledUp ? 5 : 0),
    seedsGained: choice.seedsDelta,
    unlockedEntry,
    leveledUp,
  };
}

/** 计算书桌/收藏架已解锁的珍藏摆件列表 */
export function getUnlockedRelics(bondedMoments: string[]): CodexEntry[] {
  const set = new Set(bondedMoments);
  return CODEX_ENTRIES.filter((e) => e.category === "relic" && set.has(e.id));
}

/** 玩家自选花种播种或一键收花 */
export function plantChosenFlower(
  state: GameState,
  plotIndex: number,
  chosenKind: FlowerKind,
  now = Date.now(),
): { ok: boolean; line: string; state: GameState; bondGained: number } {
  if (state.seeds < 1) {
    return {
      ok: false,
      line: "花种用完啦，点旁边『买花种』或去喷泉奇遇拿一点吧～",
      state,
      bondGained: 0,
    };
  }
  const plots = [...state.world.plots];
  plots[plotIndex] = { kind: chosenKind, plantedAt: now, wateredAt: 0 };
  const name = FLOWER_META[chosenKind].name;
  const nextState: GameState = {
    ...state,
    seeds: state.seeds - 1,
    bond: state.bond + 4,
    world: {
      ...state.world,
      plots,
      planted: state.world.planted + 1,
    },
  };
  return {
    ok: true,
    line: `🌱 亲手种下了【${name}】，浇一次水就能加速开花！`,
    state: nextState,
    bondGained: 4,
  };
}

/** 花摊出售花束换取零钱与亲密值（1 朵花束 -> 6 零钱 + 6 亲密） */
export function sellFlowerBouquet(
  state: GameState,
  now = Date.now(),
): { ok: boolean; line: string; state: GameState; coinsGained: number; bondGained: number } {
  if (state.flowers < 1) {
    return {
      ok: false,
      line: "手里还没有收好的花束呢，先去庭院收一朵花吧～",
      state,
      coinsGained: 0,
      bondGained: 0,
    };
  }
  const coinsGained = 6;
  const bondGained = 6;
  const nextState: GameState = {
    ...state,
    flowers: state.flowers - 1,
    coins: state.coins + coinsGained,
    bond: state.bond + bondGained,
    pet: {
      ...state.pet,
      happiness: Math.min(100, state.pet.happiness + 5),
      mood: "happy",
      lastInteraction: now,
    },
  };
  return {
    ok: true,
    line: "💐 把新鲜花束交给花摊老板，换到了 6 枚零钱！",
    state: nextState,
    coinsGained,
    bondGained,
  };
}

/** 高频陪伴互动（摸摸头 / 喂曲奇 / 送花夸夸）：无长冷却，立即给数值与反馈 */
export function interactWithCompanion(
  state: GameState,
  act: "pat" | "snack" | "giftFlower",
  wishBonus = false,
  now = Date.now(),
): {
  ok: boolean;
  line: string;
  state: GameState;
  bondGained: number;
  coinsGained: number;
  leveledUp: boolean;
  newLevel: number;
} {
  const prevLevel = getBondLevelInfo(state.bond).level;
  const mult = wishBonus ? 2 : 1;

  if (act === "giftFlower" && state.flowers < 1) {
    return {
      ok: false,
      line: "还没有收好的花束呢，去庭院种一朵送给雯宝吧～",
      state,
      bondGained: 0,
      coinsGained: 0,
      leveledUp: false,
      newLevel: prevLevel,
    };
  }

  let bondGained = 5 * mult;
  let coinsGained = 1 * mult;
  let energyDelta = 2;
  let happyDelta = 6;
  let line = "";
  let unlockId: string | null = null;

  if (act === "pat") {
    const lines = [
      "雯宝眯起眼睛蹭了蹭你的手心，心情变得软乎乎的～",
      "「今天有你在身边，小屋里一点都不孤单。」",
      "她轻轻晃了晃脑袋，发梢带着阳光的味道。",
    ];
    line = lines[Math.floor((now / 1000) % lines.length)];
    if (state.pet.happiness >= 80 && !state.bondedMoments.includes("memory:window-rain")) {
      unlockId = "memory:window-rain";
    }
  } else if (act === "snack") {
    bondGained = 6 * mult;
    coinsGained = 2 * mult;
    energyDelta = 15;
    happyDelta = 8;
    line = "「是刚烤好的黄油小曲奇！分你一半，甜滋滋的～」";
    if (!state.bondedMoments.includes("memory:midnight- cocoa") && state.bond >= 30) {
      unlockId = "memory:midnight- cocoa";
    }
  } else {
    bondGained = 12 * mult;
    coinsGained = 4 * mult;
    energyDelta = 8;
    happyDelta = 12;
    line = "「这朵花是专门送给我的吗？我会好好插在屋里的！」";
    const allFlowersCollected = FLOWER_KINDS.every((k) => (state.world.collection[k] ?? 0) > 0);
    if (allFlowersCollected && !state.bondedMoments.includes("memory:full-bloom-promise")) {
      unlockId = "memory:full-bloom-promise";
    }
  }

  if (wishBonus) {
    line = `💖 满足心愿暴击（双倍好感）！${line}`;
  }

  const nextMoments = unlockId && !state.bondedMoments.includes(unlockId)
    ? [...state.bondedMoments, unlockId]
    : state.bondedMoments;

  const nextBond = state.bond + bondGained;
  const newLevel = getBondLevelInfo(nextBond).level;
  const leveledUp = newLevel > prevLevel;
  if (leveledUp) {
    coinsGained += 5;
  }

  const nextState: GameState = {
    ...state,
    coins: state.coins + coinsGained,
    flowers: act === "giftFlower" ? state.flowers - 1 : state.flowers,
    bond: nextBond,
    mementos: nextMoments.length > state.bondedMoments.length ? state.mementos + 1 : state.mementos,
    bondedMoments: nextMoments,
    pet: {
      ...state.pet,
      energy: Math.min(100, state.pet.energy + energyDelta),
      happiness: Math.min(100, state.pet.happiness + happyDelta),
      mood: "happy",
      lastInteraction: now,
    },
  };

  return {
    ok: true,
    line,
    state: nextState,
    bondGained,
    coinsGained,
    leveledUp,
    newLevel,
  };
}
