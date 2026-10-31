/**
 * V8 · 每套服装独立的父子层级骨骼系统 (Per-Costume Hierarchical Skeleton Rig)
 *
 * 解决不同 ComfyUI 生成立绘身材比例、高矮、手部姿态不一致的根本问题：
 * 1. 【父子层级骨骼树（Hierarchical Bone Tree）】：
 *    root (脚底根骨骼)
 *      └── torso (胸腔主骨骼)
 *            ├── head (头部中心关节)
 *            │     ├── crown (头顶皇冠/发箍/礼帽挂载关节)
 *            │     └── hairSide (左侧刘海发夹/蝴蝶结挂载关节)
 *            ├── handR (右手手持物挂载关节)
 *            └── handL (左手手持物挂载关节)
 *    当玩家拖动父关节（如 `head` 或 `torso`）时，其所有子关节自动保持相对偏移同步移动（级联变换 Cascade Transform）！
 *    当玩家单独拖动叶子关节（如 `crown`、`hairSide`、`handR`、`handL`）时，可精确校准该插槽在新生成立绘上的位置！
 *
 * 2. 【每套服装专属骨骼预设（Per-Dress Skeleton Presets）】：
 *    - `dress-snow-white`（1.87 头身大头 Q 版）
 *    - `dress-whale-maid`（2.06 头身小鲸鱼女仆，右手挥起、左手放下）
 *    - `dress-apricot-tea`（3.2 头身暖杏针织裙，头顶更高、双手在毛衣袖口）
 *    - `dress-rose-waltz`（2.6 头身蓬蓬裙，双臂微张 A-pose）
 *    - `dress-starlight-dream`（2.2 头身星河纱裙）
 */

export type JointId = "root" | "torso" | "head" | "crown" | "hairSide" | "handL" | "handR";

export interface JointNode {
  id: JointId;
  label: string;
  parent: JointId | null;
  /** 在 1:1 角色骨骼画布中的归一化百分比坐标 (0 ~ 100) */
  x: number;
  y: number;
  /** 绑定在该关节上的配饰缩放倍率 (0.4 ~ 2.2) */
  scale: number;
  /** 绑定在该关节上的配饰旋转角 (-90 ~ +90 度) */
  rotate: number;
}

export type DressSkeleton = Record<JointId, JointNode>;
export type AllDressSkeletons = Record<string, DressSkeleton>;

export const JOINT_LIST: { id: JointId; label: string; parent: JointId | null; color: string }[] = [
  { id: "root",     label: "根基(脚底)", parent: null,    color: "#94a3b8" },
  { id: "torso",    label: "胸腔主骨",   parent: "root",  color: "#38bdf8" },
  { id: "head",     label: "头部中心",   parent: "torso", color: "#fb7185" },
  { id: "crown",    label: "头顶插槽",   parent: "head",  color: "#f59e0b" },
  { id: "hairSide", label: "侧发插槽",   parent: "head",  color: "#f472b6" },
  { id: "handL",    label: "左手插槽",   parent: "torso", color: "#34d399" },
  { id: "handR",    label: "右手插槽",   parent: "torso", color: "#a78bfa" },
];

/** 父子骨骼连线（用于可视化骨骼工作台绘制骨骼杆） */
export const BONE_LINKS: [JointId, JointId][] = [
  ["root", "torso"],
  ["torso", "head"],
  ["head", "crown"],
  ["head", "hairSide"],
  ["torso", "handL"],
  ["torso", "handR"],
];

function makeSkeleton(coords: Record<JointId, { x: number; y: number; scale?: number; rotate?: number }>): DressSkeleton {
  const out = {} as DressSkeleton;
  for (const meta of JOINT_LIST) {
    const c = coords[meta.id];
    out[meta.id] = {
      id: meta.id,
      label: meta.label,
      parent: meta.parent,
      x: c.x,
      y: c.y,
      scale: c.scale ?? 1.0,
      rotate: c.rotate ?? 0,
    };
  }
  return out;
}

/** 针对每套不同头身比/姿势的服装立绘，专门标定的默认骨骼树 */
export const PRESET_DRESS_SKELETONS: AllDressSkeletons = {
  // 1. 初雪白茶连衣裙（1.87 头身大头 Q 版）
  "dress-snow-white": makeSkeleton({
    root:     { x: 50, y: 95 },
    torso:    { x: 50, y: 66 },
    head:     { x: 50, y: 34 },
    crown:    { x: 50, y: 12, scale: 1.0, rotate: 0 },
    hairSide: { x: 64, y: 23, scale: 1.0, rotate: 12 },
    handL:    { x: 33, y: 69, scale: 0.95, rotate: -6 },
    handR:    { x: 67, y: 69, scale: 1.0, rotate: 6 },
  }),

  // 2. 深海小鲸鱼女仆（右手挥起，左手在裙边）
  "dress-whale-maid": makeSkeleton({
    root:     { x: 50, y: 95 },
    torso:    { x: 50, y: 63 },
    head:     { x: 50, y: 32 },
    crown:    { x: 50, y: 11, scale: 1.02, rotate: -2 },
    hairSide: { x: 63, y: 22, scale: 1.0, rotate: 10 },
    handL:    { x: 31, y: 40, scale: 0.92, rotate: -14 },
    handR:    { x: 63, y: 66, scale: 1.0, rotate: 4 },
  }),

  // 3. 杏仁奶昔针织裙（ComfyUI 生成的高挑暖杏毛衣裙，头较小且靠上）
  "dress-apricot-tea": makeSkeleton({
    root:     { x: 50, y: 95 },
    torso:    { x: 50, y: 54 },
    head:     { x: 50, y: 22 },
    crown:    { x: 50, y: 9,  scale: 0.78, rotate: 0 },
    hairSide: { x: 58, y: 16, scale: 0.76, rotate: 10 },
    handL:    { x: 35, y: 60, scale: 0.85, rotate: -5 },
    handR:    { x: 65, y: 60, scale: 0.88, rotate: 5 },
  }),

  // 4. 暮色蔷薇圆舞曲（蓬蓬裙 A-pose，双臂微张）
  "dress-rose-waltz": makeSkeleton({
    root:     { x: 50, y: 95 },
    torso:    { x: 50, y: 58 },
    head:     { x: 50, y: 27 },
    crown:    { x: 50, y: 10, scale: 0.88, rotate: 0 },
    hairSide: { x: 61, y: 19, scale: 0.85, rotate: 10 },
    handL:    { x: 24, y: 58, scale: 0.9, rotate: -12 },
    handR:    { x: 76, y: 58, scale: 0.92, rotate: 10 },
  }),

  // 5. 星河眠云轻纱裙（星空 Q 版）
  "dress-starlight-dream": makeSkeleton({
    root:     { x: 50, y: 95 },
    torso:    { x: 50, y: 62 },
    head:     { x: 50, y: 31 },
    crown:    { x: 50, y: 11, scale: 0.94, rotate: 0 },
    hairSide: { x: 62, y: 21, scale: 0.9, rotate: 10 },
    handL:    { x: 31, y: 63, scale: 0.92, rotate: -8 },
    handR:    { x: 69, y: 63, scale: 0.94, rotate: 8 },
  }),
};

function cloneSkeleton(src: DressSkeleton): DressSkeleton {
  const out = {} as DressSkeleton;
  for (const meta of JOINT_LIST) {
    out[meta.id] = { ...src[meta.id] };
  }
  return out;
}

export function getSkeletonForDress(dressId: string, savedMap: AllDressSkeletons = {}): DressSkeleton {
  const base = PRESET_DRESS_SKELETONS[dressId] || PRESET_DRESS_SKELETONS["dress-snow-white"];
  const custom = savedMap[dressId];
  if (!custom) return cloneSkeleton(base);
  const merged = {} as DressSkeleton;
  for (const meta of JOINT_LIST) {
    merged[meta.id] = {
      ...base[meta.id],
      ...(custom[meta.id] || {}),
    };
  }
  return merged;
}

function clampCoord(v: number): number {
  return Math.max(4, Math.min(96, Math.round(v * 10) / 10));
}

/**
 * 找出某个父关节的所有后代关节（用于拖动父关节时，子关节级联跟随平移！）
 */
export function getDescendantJoints(rootJoint: JointId): JointId[] {
  const result: JointId[] = [];
  const queue: JointId[] = [rootJoint];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const meta of JOINT_LIST) {
      if (meta.parent === cur) {
        result.push(meta.id);
        queue.push(meta.id);
      }
    }
  }
  return result;
}

/**
 * 移动指定关节到新坐标 (nx, ny)，并自动级联平移其所有子孙关节！
 */
export function moveJointCascade(
  skeleton: DressSkeleton,
  jointId: JointId,
  nx: number,
  ny: number,
): DressSkeleton {
  const next = cloneSkeleton(skeleton);
  const target = next[jointId];
  if (!target) return next;

  const clampedX = clampCoord(nx);
  const clampedY = clampCoord(ny);
  const dx = clampedX - target.x;
  const dy = clampedY - target.y;

  target.x = clampedX;
  target.y = clampedY;

  const descendants = getDescendantJoints(jointId);
  for (const childId of descendants) {
    next[childId].x = clampCoord(next[childId].x + dx);
    next[childId].y = clampCoord(next[childId].y + dy);
  }
  return next;
}

/** 更新某个插槽关节的配饰缩放倍率与旋转角 */
export function updateJointTransform(
  skeleton: DressSkeleton,
  jointId: JointId,
  patch: { scale?: number; rotate?: number },
): DressSkeleton {
  const next = cloneSkeleton(skeleton);
  const joint = next[jointId];
  if (!joint) return next;
  if (typeof patch.scale === "number" && Number.isFinite(patch.scale)) {
    joint.scale = Math.max(0.4, Math.min(2.2, Math.round(patch.scale * 100) / 100));
  }
  if (typeof patch.rotate === "number" && Number.isFinite(patch.rotate)) {
    joint.rotate = Math.max(-90, Math.min(90, Math.round(patch.rotate)));
  }
  return next;
}

/** 判断某件单品应该挂载到哪一根骨骼关节上 */
export function resolveJointForItem(itemId: string, slot: "hairAcc" | "handheld" | "aura"): JointId {
  if (slot === "hairAcc") {
    if (itemId === "hair-daisy-clip" || itemId === "hair-lace-ribbon") {
      return "hairSide";
    }
    return "crown";
  }
  if (slot === "handheld") {
    if (itemId === "hand-pocket-watch") {
      return "handL";
    }
    return "handR";
  }
  return "torso";
}
