/**
 * V2 陪伴生成与本地回退桥接（同源 `/.netlify/functions/companion-scene`）。
 *
 * 严格遵循 ollama-mini-host 规范：
 * 1. 浏览器只走同源函数，不直连 11434。
 * 2. 模型不可用或超时时 100% 静默回退到本地情境文案，不阻塞游玩。
 */
import type { GameState } from "../engine/types.ts";
import { ROOMS } from "./rooms.ts";
import { FLOWER_KINDS, FLOWER_META, lightingForHour, plotStage } from "./state.ts";

export interface CompanionMoment {
  line: string;
  storyTitle: string;
  journalCopy: string;
  source: "ollama" | "local";
}

export interface CompanionConnection {
  connected: boolean;
  model: string;
  error?: string;
}

/** 构造传给 companion-scene 的精简结构化状态。 */
export function buildCompanionContext(state: GameState, now = Date.now()) {
  const hour = new Date(now).getHours();
  const light = lightingForHour(hour);
  const room = ROOMS[state.world.room] ?? ROOMS.home;
  const blooming = state.world.plots
    .filter((p) => p.kind && plotStage(p, now) === 3)
    .map((p) => FLOWER_META[p.kind!].name);
  const growing = state.world.plots
    .filter((p) => p.kind && plotStage(p, now) > 0 && plotStage(p, now) < 3)
    .map((p) => FLOWER_META[p.kind!].name);
  const collected = FLOWER_KINDS
    .filter((k) => (state.world.collection[k] ?? 0) > 0)
    .map((k) => `${FLOWER_META[k].name}×${state.world.collection[k]}`);

  return {
    room: room.name,
    dayPart: light.label,
    energy: state.pet.energy,
    happiness: state.pet.happiness,
    mood: state.pet.mood,
    skin: state.world.skin === "maid" ? "小鲸鱼蓝白女仆装" : "白色常服",
    flowers: state.flowers,
    seeds: state.seeds,
    coins: state.coins,
    blooming,
    growing,
    collected,
    bestCombo: state.world.bestCombo,
  };
}

/** 纯函数：当 Ollama 不可用时，按当前房间、时段、花圃与角色状态生成细腻的本地陪伴片段。 */
export function fallbackCompanionScene(state: GameState, now = Date.now()): CompanionMoment {
  const hour = new Date(now).getHours();
  const light = lightingForHour(hour);
  const room = state.world.room;
  const bloomingPlot = state.world.plots.find((p) => p.kind && plotStage(p, now) === 3);
  const growingPlot = state.world.plots.find((p) => p.kind && plotStage(p, now) > 0 && plotStage(p, now) < 3);

  if (bloomingPlot?.kind) {
    const flowerName = FLOWER_META[bloomingPlot.kind].name;
    return {
      line: `庭院里的${flowerName}已经全开了，风吹过来有淡淡的香味。`,
      storyTitle: `${light.label}的花期`,
      journalCopy: `${light.label}，庭院里的${flowerName}开好了，雯宝站在花圃边看了很久。`,
      source: "local",
    };
  }

  if (state.pet.energy < 35) {
    return {
      line: "眼皮有一点沉了，靠着枕头或者长椅歇一会儿吧。",
      storyTitle: `${light.label}小憩`,
      journalCopy: `${light.label}的${ROOMS[room].name}很安静，雯宝放慢了脚步，准备歇一歇。`,
      source: "local",
    };
  }

  if (room === "garden") {
    if (growingPlot?.kind) {
      const flowerName = FLOWER_META[growingPlot.kind].name;
      return {
        line: `泥土还是湿润的，${flowerName}的叶子好像又舒展了一点。`,
        storyTitle: "等花开的时候",
        journalCopy: `${light.label}在庭院里照料${flowerName}，泥土里冒出安静的新绿。`,
        source: "local",
      };
    }
    return {
      line: `${light.label}的庭院风很轻，皮球就停在草地边。`,
      storyTitle: `${light.label}的庭院`,
      journalCopy: `${light.label}走进庭院，树影落在草地上，空气里带着泥土的味道。`,
      source: "local",
    };
  }

  if (room === "street") {
    return {
      line: light.lampGlow
        ? "街区的路灯亮起来了，喷泉的水声听起来格外清楚。"
        : "花摊上的花种摆得很整齐，喷泉边偶有微风吹过。",
      storyTitle: `${light.label}的街角`,
      journalCopy: light.lampGlow
        ? `${light.label}，街区的路灯洒下暖光，雯宝沿着喷泉慢步走过。`
        : `${light.label}去了一趟街区，在喷泉与花摊之间停下看了看。`,
      source: "local",
    };
  }

  return {
    line: light.lampGlow
      ? "屋里点着暖暖的灯，外面的夜色刚好。"
      : "阳光落在小屋的地毯上，今天不用赶时间。",
    storyTitle: `${light.label}的小屋`,
    journalCopy: light.lampGlow
      ? `${light.label}的小屋亮起了暖灯，收藏架上的花朵安静地陪在手边。`
      : `${light.label}待在小屋里，窗外的光线慢慢移过书桌与地毯。`,
    source: "local",
  };
}

/** 探测同源 companion-scene 的 Ollama 连接状态。 */
export async function probeCompanionStatus(): Promise<CompanionConnection> {
  try {
    const res = await fetch("/.netlify/functions/companion-scene", {
      method: "GET",
      signal: AbortSignal.timeout(3500),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok || payload?.ok !== true) {
      return {
        connected: false,
        model: "",
        error: payload?.error || `HTTP ${res.status}`,
      };
    }
    return {
      connected: true,
      model: String(payload.data?.model || "qwen2.5:3b-instruct"),
    };
  } catch (err) {
    return {
      connected: false,
      model: "",
      error: err instanceof Error ? err.message : "离线",
    };
  }
}

/** 请求生成一条陪伴短句与生活小记；任何异常或超时均回退到 fallbackCompanionScene。 */
export async function fetchCompanionMoment(
  state: GameState,
  now = Date.now(),
): Promise<CompanionMoment> {
  const fallback = fallbackCompanionScene(state, now);
  try {
    const context = buildCompanionContext(state, now);
    const res = await fetch("/.netlify/functions/companion-scene", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(context),
      signal: AbortSignal.timeout(8500),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok || payload?.ok !== true || !payload?.data) {
      return fallback;
    }
    const { line, storyTitle, journalCopy } = payload.data;
    if (typeof line !== "string" || !line.trim()) return fallback;
    return {
      line: line.trim(),
      storyTitle: typeof storyTitle === "string" && storyTitle.trim() ? storyTitle.trim() : fallback.storyTitle,
      journalCopy: typeof journalCopy === "string" && journalCopy.trim() ? journalCopy.trim() : fallback.journalCopy,
      source: "ollama",
    };
  } catch {
    return fallback;
  }
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

/** 离线或 Ollama 未启动时的高情商本地对话回复。 */
export function fallbackCompanionChat(userText: string, state: GameState, now = Date.now()): string {
  const text = userText.trim();
  const roomName = ROOMS[state.world.room]?.name ?? "小屋";
  const light = lightingForHour(new Date(now).getHours());

  if (/早|morning|醒/i.test(text)) {
    return "早安呀～今天想先在小屋待一会儿，还是去庭院看看花？";
  }
  if (/晚安|睡|困|累/i.test(text)) {
    return "累了就早点歇息吧，我把床铺整理得软乎乎的，随时陪你。";
  }
  if (/花|种|玫瑰|向日葵|雏菊/i.test(text)) {
    return `我们已经收过 ${state.world.harvested} 朵花啦！每次看到花圃冒出新芽都觉得很有干劲～`;
  }
  if (/喜欢|想你|抱|摸/i.test(text)) {
    return "嘿嘿，我也是！只要你在身边，连空气都变得暖洋洋的。";
  }
  if (/吃|饿|曲奇|饼干|点心/i.test(text)) {
    return "玻璃罐里还有刚烤好的蜂蜜黄油曲奇，快来分一块！";
  }
  const replies = [
    `嗯嗯，我在听呢！现在的${roomName}正好是${light.label}，和你聊聊天最舒服了。`,
    "把你今天遇到的开心事或者小烦恼都告诉我吧，我会一直记在心里的～",
    "不管外面多忙，回到这个小房间就可以彻底放松下来啦。",
  ];
  return replies[Math.floor((now / 1000 + text.length) % replies.length)];
}

/** 发送一句聊天给雯宝：在线走 Ollama，离线自动回退到高情商本地回复，永不报错卡死。 */
export async function sendCompanionChatMessage(
  userText: string,
  history: ChatTurn[],
  state: GameState,
): Promise<{ reply: string; source: "ollama" | "local" }> {
  const fallback = fallbackCompanionChat(userText, state);
  try {
    const res = await fetch("/.netlify/functions/companion-scene", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "chat", text: userText.trim(), history: history.slice(-6) }),
      signal: AbortSignal.timeout(12000),
    });
    const payload = await res.json().catch(() => ({}));
    const reply = payload?.data?.reply;
    if (res.ok && payload?.ok === true && typeof reply === "string" && reply.trim()) {
      return { reply: reply.trim(), source: "ollama" };
    }
    return { reply: fallback, source: "local" };
  } catch {
    return { reply: fallback, source: "local" };
  }
}
