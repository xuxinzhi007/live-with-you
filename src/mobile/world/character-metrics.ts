// 由 tools/character/verify.py 从 public/assets/characters/metrics.json 生成。
// 不要手改。改 tools/character/spec.json 后重跑：python3 tools/character/verify.py

export interface FrameMetrics {
  w: number;
  h: number;
  cx: number;
  feet: number;
}

export interface SkinMetrics {
  visibleHeight: number;
  visibleWidth: number;
  baseline: number;
}

export const CHARACTER_METRICS: Record<string, SkinMetrics> = {
  original: {
    visibleHeight: 720,
    visibleWidth: 429,
    baseline: 0.9842105263157894,
  },
  maid: {
    visibleHeight: 714,
    visibleWidth: 554,
    baseline: 0.9842105263157894,
  },
};
