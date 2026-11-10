/**
 * V10 · 关键帧动画系统 (Keyframe Animation System)
 *
 * 替代 V9 的硬编码正弦波动画。
 * 每个动画剪辑由一组关键帧定义，支持 easing 缓动曲线。
 *
 * 设计参考：CSS Animation / GSAP / Spine
 * - Keyframe: 时间点 + 数值 + 缓动函数
 * - Track: 一个属性的关键帧序列
 * - Clip: 多个 Track 的集合
 */

// ========== 核心类型 ==========

export type EasingName =
  | "linear"
  | "easeIn"
  | "easeOut"
  | "easeInOut"
  | "easeInQuad"
  | "easeOutQuad"
  | "easeInOutQuad"
  | "easeInCubic"
  | "easeOutCubic"
  | "easeInOutCubic"
  | "easeInBack"
  | "easeOutBack"
  | "easeInOutBack"
  | "easeInElastic"
  | "easeOutElastic"
  | "easeInOutElastic"
  | "easeInBounce"
  | "easeOutBounce"
  | "easeInOutBounce";

export interface Keyframe {
  /** 时间点（秒） */
  time: number;
  /** 属性值 */
  value: number;
  /** 到下一个关键帧的缓动函数 */
  easing?: EasingName;
}

/** 一个属性的关键帧轨道 */
export type Track = Keyframe[];

/** 动画剪辑：多个属性的轨道 */
export interface AnimClipDef {
  id: string;
  /** 时长（秒） */
  duration: number;
  /** 是否循环 */
  loop: boolean;
  /** 轨道集合 */
  tracks: {
    torsoRot?: Track;
    headRot?: Track;
    armLRot?: Track;
    armRRot?: Track;
    legLRot?: Track;
    legRRot?: Track;
    pelvisDy?: Track;
    /** 配饰挂点附加旋转 */
    hairRot?: Track;
    handLRot?: Track;
    handRRot?: Track;
  };
}

/** 动画采样结果（与 V9 AnimPoseOffsets 兼容） */
export interface AnimPoseOffsets {
  torsoRot: number;
  headRot: number;
  armLRot: number;
  armRRot: number;
  legLRot: number;
  legRRot: number;
  pelvisDy: number;
}

// ========== 缓动函数 ==========

type EasingFn = (t: number) => number;

const EASING_MAP: Record<EasingName, EasingFn> = {
  linear: (t) => t,
  easeIn: (t) => t * t,
  easeOut: (t) => 1 - (1 - t) * (1 - t),
  easeInOut: (t) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t)),
  easeInQuad: (t) => t * t,
  easeOutQuad: (t) => 1 - (1 - t) * (1 - t),
  easeInOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t)),
  easeInCubic: (t) => t * t * t,
  easeOutCubic: (t) => 1 - Math.pow(1 - t, 3),
  easeInOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  easeInBack: (t) => 2.70158 * t * t * t - 1.70158 * t * t,
  easeOutBack: (t) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2),
  easeInOutBack: (t) => {
    const c = 1.70158 * 1.525;
    return t < 0.5
      ? (Math.pow(2 * t, 2) * ((c + 1) * 2 * t - c)) / 2
      : (Math.pow(2 * t - 2, 2) * ((c + 1) * (t * 2 - 2) + c) + 2) / 2;
  },
  easeInElastic: (t) => {
    if (t === 0 || t === 1) return t;
    return -Math.pow(2, 10 * (t - 1)) * Math.sin(((t - 1.1) * 5 * Math.PI) / 0.4 / 0.1);
  },
  easeOutElastic: (t) => {
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10 * t) * Math.sin(((t - 0.1) * 5 * Math.PI) / 0.4) + 1;
  },
  easeInOutElastic: (t) => {
    if (t === 0 || t === 1) return t;
    const c = (2 * Math.PI) / 4.5;
    return t < 0.5
      ? -(Math.pow(2, 20 * t - 10) * Math.sin((20 * t - 11.125) * c)) / 2
      : (Math.pow(2, -20 * t + 10) * Math.sin((20 * t - 11.125) * c)) / 2 + 1;
  },
  easeInBounce: (t) => 1 - EASING_MAP.easeOutBounce(1 - t),
  easeOutBounce: (t) => {
    const n = 7.5625;
    const d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
    if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
    return n * (t -= 2.625 / d) * t + 0.984375;
  },
  easeInOutBounce: (t) =>
    t < 0.5 ? EASING_MAP.easeInBounce(t * 2) / 2 : EASING_MAP.easeOutBounce(t * 2 - 1) / 2 + 0.5,
};

// ========== 轨道采样 ==========

/**
 * 对单条轨道进行采样：给定时间 t，返回插值后的数值。
 * 关键帧必须按 time 升序排列。
 */
export function sampleTrack(track: Track, t: number): number {
  if (track.length === 0) return 0;
  if (track.length === 1) return track[0].value;

  // 边界
  if (t <= track[0].time) return track[0].value;
  if (t >= track[track.length - 1].time) return track[track.length - 1].value;

  // 二分查找区间
  let lo = 0;
  let hi = track.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (track[mid].time <= t) lo = mid;
    else hi = mid;
  }

  const a = track[lo];
  const b = track[hi];
  const span = b.time - a.time;
  if (span <= 0) return b.value;

  const rawT = (t - a.time) / span;
  const easingFn = EASING_MAP[a.easing ?? "linear"] ?? EASING_MAP.linear;
  const easedT = easingFn(rawT);

  return a.value + (b.value - a.value) * easedT;
}

// ========== 动画剪辑定义 ==========

/** 5 个标准动画剪辑（关键帧版） */
export const ANIM_CLIPS: Record<string, AnimClipDef> = {
  idle: {
    id: "idle",
    duration: 3.0,
    loop: true,
    tracks: {
      torsoRot: [
        { time: 0, value: 0, easing: "easeInOutSine" as EasingName },
        { time: 1.5, value: 1.2 },
        { time: 3.0, value: 0 },
      ],
      headRot: [
        { time: 0, value: -2, easing: "easeInOut" },
        { time: 1.5, value: 2 },
        { time: 3.0, value: -2 },
      ],
      armLRot: [
        { time: 0, value: -3, easing: "easeInOut" },
        { time: 1.5, value: 3 },
        { time: 3.0, value: -3 },
      ],
      armRRot: [
        { time: 0, value: 3, easing: "easeInOut" },
        { time: 1.5, value: -3 },
        { time: 3.0, value: 3 },
      ],
      legLRot: [{ time: 0, value: 0 }],
      legRRot: [{ time: 0, value: 0 }],
      pelvisDy: [
        { time: 0, value: 0, easing: "easeInOut" },
        { time: 1.5, value: -0.7 },
        { time: 3.0, value: 0 },
      ],
    },
  },

  tilt: {
    id: "tilt",
    duration: 2.5,
    loop: true,
    tracks: {
      torsoRot: [
        { time: 0, value: 0, easing: "easeInOut" },
        { time: 1.25, value: 2.5 },
        { time: 2.5, value: 0 },
      ],
      headRot: [
        { time: 0, value: 8, easing: "easeInOut" },
        { time: 1.25, value: 16 },
        { time: 2.5, value: 8 },
      ],
      armLRot: [
        { time: 0, value: -13, easing: "easeInOut" },
        { time: 1.25, value: -3 },
        { time: 2.5, value: -13 },
      ],
      armRRot: [
        { time: 0, value: 5, easing: "easeInOut" },
        { time: 1.25, value: 15 },
        { time: 2.5, value: 5 },
      ],
      legLRot: [
        { time: 0, value: -2, easing: "easeInOut" },
        { time: 1.25, value: 2 },
        { time: 2.5, value: -2 },
      ],
      legRRot: [
        { time: 0, value: 2, easing: "easeInOut" },
        { time: 1.25, value: -2 },
        { time: 2.5, value: 2 },
      ],
      pelvisDy: [
        { time: 0, value: -0.4, easing: "easeInOut" },
        { time: 1.25, value: -1.2 },
        { time: 2.5, value: -0.4 },
      ],
    },
  },

  wave: {
    id: "wave",
    duration: 2.0,
    loop: true,
    tracks: {
      torsoRot: [
        { time: 0, value: 0, easing: "easeInOut" },
        { time: 1.0, value: 2 },
        { time: 2.0, value: 0 },
      ],
      headRot: [
        { time: 0, value: -9, easing: "easeInOut" },
        { time: 1.0, value: -3 },
        { time: 2.0, value: -9 },
      ],
      armLRot: [
        { time: 0, value: -46, easing: "easeOut" },
        { time: 0.25, value: -10 },
        { time: 0.5, value: -46 },
        { time: 0.75, value: -10 },
        { time: 1.0, value: -46 },
        { time: 1.25, value: -10 },
        { time: 1.5, value: -46 },
        { time: 1.75, value: -10 },
        { time: 2.0, value: -46 },
      ],
      armRRot: [
        { time: 0, value: 4, easing: "easeInOut" },
        { time: 1.0, value: 12 },
        { time: 2.0, value: 4 },
      ],
      legLRot: [{ time: 0, value: 0 }],
      legRRot: [{ time: 0, value: 0 }],
      pelvisDy: [
        { time: 0, value: 0, easing: "easeInOut" },
        { time: 1.0, value: -1.2 },
        { time: 2.0, value: 0 },
      ],
    },
  },

  walk: {
    id: "walk",
    duration: 1.2,
    loop: true,
    tracks: {
      torsoRot: [
        { time: 0, value: 0, easing: "easeInOut" },
        { time: 0.3, value: 3.5 },
        { time: 0.6, value: 0 },
        { time: 0.9, value: -3.5 },
        { time: 1.2, value: 0 },
      ],
      headRot: [
        { time: 0, value: -4, easing: "easeInOut" },
        { time: 0.3, value: 0 },
        { time: 0.6, value: 4 },
        { time: 0.9, value: 0 },
        { time: 1.2, value: -4 },
      ],
      armLRot: [
        { time: 0, value: -18, easing: "easeInOut" },
        { time: 0.3, value: 0 },
        { time: 0.6, value: 18 },
        { time: 0.9, value: 0 },
        { time: 1.2, value: -18 },
      ],
      armRRot: [
        { time: 0, value: 18, easing: "easeInOut" },
        { time: 0.3, value: 0 },
        { time: 0.6, value: -18 },
        { time: 0.9, value: 0 },
        { time: 1.2, value: 18 },
      ],
      legLRot: [
        { time: 0, value: -20, easing: "easeInOut" },
        { time: 0.3, value: 0 },
        { time: 0.6, value: 20 },
        { time: 0.9, value: 0 },
        { time: 1.2, value: -20 },
      ],
      legRRot: [
        { time: 0, value: 20, easing: "easeInOut" },
        { time: 0.3, value: 0 },
        { time: 0.6, value: -20 },
        { time: 0.9, value: 0 },
        { time: 1.2, value: 20 },
      ],
      pelvisDy: [
        { time: 0, value: -2.2, easing: "easeInOut" },
        { time: 0.3, value: 0 },
        { time: 0.6, value: -2.2 },
        { time: 0.9, value: 0 },
        { time: 1.2, value: -2.2 },
      ],
    },
  },

  cheer: {
    id: "cheer",
    duration: 1.5,
    loop: true,
    tracks: {
      torsoRot: [
        { time: 0, value: 0, easing: "easeOut" },
        { time: 0.3, value: -4 },
        { time: 0.75, value: 4 },
        { time: 1.2, value: -4 },
        { time: 1.5, value: 0 },
      ],
      headRot: [
        { time: 0, value: 0, easing: "easeOut" },
        { time: 0.3, value: -6 },
        { time: 0.75, value: 6 },
        { time: 1.2, value: -6 },
        { time: 1.5, value: 0 },
      ],
      armLRot: [
        { time: 0, value: 0, easing: "easeOutBack" },
        { time: 0.3, value: -48 },
        { time: 0.75, value: -32 },
        { time: 1.2, value: -48 },
        { time: 1.5, value: 0 },
      ],
      armRRot: [
        { time: 0, value: 0, easing: "easeOutBack" },
        { time: 0.3, value: 48 },
        { time: 0.75, value: 32 },
        { time: 1.2, value: 48 },
        { time: 1.5, value: 0 },
      ],
      legLRot: [
        { time: 0, value: 0, easing: "easeOut" },
        { time: 0.3, value: -10 },
        { time: 0.75, value: 0 },
        { time: 1.2, value: -10 },
        { time: 1.5, value: 0 },
      ],
      legRRot: [
        { time: 0, value: 0, easing: "easeOut" },
        { time: 0.3, value: 10 },
        { time: 0.75, value: 0 },
        { time: 1.2, value: 10 },
        { time: 1.5, value: 0 },
      ],
      pelvisDy: [
        { time: 0, value: 0, easing: "easeOut" },
        { time: 0.3, value: -4.5 },
        { time: 0.75, value: -1.5 },
        { time: 1.2, value: -4.5 },
        { time: 1.5, value: 0 },
      ],
    },
  },
};

// ========== 剪辑采样 ==========

/**
 * 对动画剪辑进行采样：给定时间 t，返回所有属性的插值结果。
 * 如果 clip.loop 为 true，时间会对 duration 取模。
 */
export function evaluateAnimClip(clipId: string, t: number): AnimPoseOffsets {
  const clip = ANIM_CLIPS[clipId];
  if (!clip) {
    return { torsoRot: 0, headRot: 0, armLRot: 0, armRRot: 0, legLRot: 0, legRRot: 0, pelvisDy: 0 };
  }

  const time = clip.loop ? t % clip.duration : Math.min(t, clip.duration);
  const tracks = clip.tracks;

  return {
    torsoRot: tracks.torsoRot ? sampleTrack(tracks.torsoRot, time) : 0,
    headRot: tracks.headRot ? sampleTrack(tracks.headRot, time) : 0,
    armLRot: tracks.armLRot ? sampleTrack(tracks.armLRot, time) : 0,
    armRRot: tracks.armRRot ? sampleTrack(tracks.armRRot, time) : 0,
    legLRot: tracks.legLRot ? sampleTrack(tracks.legLRot, time) : 0,
    legRRot: tracks.legRRot ? sampleTrack(tracks.legRRot, time) : 0,
    pelvisDy: tracks.pelvisDy ? sampleTrack(tracks.pelvisDy, time) : 0,
  };
}

/**
 * 获取所有可用的动画剪辑 ID
 */
export function getAvailableClipIds(): string[] {
  return Object.keys(ANIM_CLIPS);
}

/**
 * 获取动画剪辑定义
 */
export function getAnimClip(id: string): AnimClipDef | undefined {
  return ANIM_CLIPS[id];
}
