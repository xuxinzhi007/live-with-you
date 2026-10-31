/**
 * V9 · 标准二次元人体双足全身层级骨骼系统 (Anime Humanoid Biped FK Skeleton & 6-Layer Cutout Skinning)
 *
 * 参考 Blender 2D Cutout / Spine / Live2D / LÖVE 2D 标准双足人体骨骼架构（Biped Rig）：
 *
 *                    ● crown (头顶皇冠/礼帽插槽)
 *                    │
 *                    ▲ head (头部骨骼 · 绕颈部 neck 枢轴旋转 -> 歪头) ── ● hairSide (侧发夹插槽)
 *                    │
 *                    ● neck (颈部枢轴)
 *                    │
 *     shoulderL ●────┼────● shoulderR (左右肩枢轴)
 *        │           │           │
 *        ▼ armL      ▲ torso     ▼ armR (右臂骨骼 · 绕右肩旋转 -> 挥手)
 *        │        (胸腔脊柱)     │
 *     handL ●        │        ● handR (右手插槽：茶杯/花束/藤篮跟随右臂挥动！)
 *   (左手插槽)       ● pelvis (骨盆/髋中心 Root Pivot)
 *                 ╱     ╲
 *          hipL ●         ● hipR (左右髋关节枢轴)
 *               │         │
 *               ▼ legL    ▼ legR (左右腿骨骼 · 绕髋部旋转 -> 迈步/踢腿/欢呼跳跃！)
 *               │         │
 *         footL ●         ● footR (左右脚踝末端)
 *
 * 核心能力：
 * 1. 【11 关节完整双足人体骨骼树（Full Humanoid Biped Tree）】：
 *    包含 `pelvis(骨盆根)`、`torso(胸脊)`、`neck(颈部)`、`head(头顶)`、`crown(头饰槽)`、`hairSide(侧发槽)`、
 *    `shoulderL/handL(左臂链)`、`shoulderR/handR(右臂链)`、`hipL/footL(左腿链)`、`hipR/footR(右腿链)`。
 * 2. 【单张立绘自动 6 层人体部位切割蒙皮（6-Layer Humanoid Cutout Skinning）】：
 *    根据当前服装在 Setup 模式下标定的颈部、双肩、髋部坐标，在 Canvas 内存中将透明立绘自动拆分为 6 个独立部位图层：
 *    `LegL(左腿层)`、`LegR(右腿层)`、`ArmL(左臂层)`、`Torso(躯干裙摆层)`、`ArmR(右臂层)`、`Head(头部层)`，
 *    并在关节旋转枢轴处生成圆形柔化重叠区（Joint Overlap Seam），旋转时绝不漏缝！
 * 3. 【正运动学（FK）级联旋转与 5 套全身骨骼动画】：
 *    支持 `idle(呼吸轻摆)`、`tilt(歪头卖萌)`、`wave(挥手问好)`、`walk(轻快踏步走)`、`cheer(开心跳跃)`！
 */

export type JointId =
  | "pelvis"
  | "torso"
  | "neck"
  | "head"
  | "crown"
  | "hairSide"
  | "shoulderL"
  | "handL"
  | "shoulderR"
  | "handR"
  | "hipL"
  | "footL"
  | "hipR"
  | "footR";

export type BodyPartId = "legL" | "legR" | "armL" | "torso" | "armR" | "head";

export interface JointNode {
  id: JointId;
  label: string;
  parent: JointId | null;
  /** Setup 模式下的静止绑定坐标 (0 ~ 100%) */
  x: number;
  y: number;
  /** Pose 模式下的 FK 局部旋转角 (-75 ~ +75 度) */
  poseRotate: number;
  /** 挂载在该关节上的配饰缩放倍率 (0.4 ~ 2.2) */
  scale: number;
  /** 挂载在该关节上的配饰附加旋转角 (-90 ~ +90 度) */
  rotate: number;
}

export type DressSkeleton = Record<JointId, JointNode>;
export type AllDressSkeletons = Record<string, DressSkeleton>;

export interface BoneDef {
  id: string;
  name: string;
  from: JointId;
  to: JointId;
  color: string;
  part?: BodyPartId;
}

export const JOINT_LIST: { id: JointId; label: string; parent: JointId | null; color: string; isSocket?: boolean }[] = [
  { id: "pelvis",    label: "骨盆(根)", parent: null,        color: "#f59e0b" },
  { id: "torso",     label: "胸腔脊柱", parent: "pelvis",    color: "#38bdf8" },
  { id: "neck",      label: "颈部枢轴", parent: "torso",     color: "#fb7185" },
  { id: "head",      label: "头部朝向", parent: "neck",      color: "#f43f5e" },
  { id: "crown",     label: "头顶插槽", parent: "head",      color: "#eab308", isSocket: true },
  { id: "hairSide",  label: "侧发插槽", parent: "head",      color: "#ec4899", isSocket: true },
  { id: "shoulderL", label: "左肩枢轴", parent: "torso",     color: "#34d399" },
  { id: "handL",     label: "左手腕/槽", parent: "shoulderL", color: "#10b981", isSocket: true },
  { id: "shoulderR", label: "右肩枢轴", parent: "torso",     color: "#a78bfa" },
  { id: "handR",     label: "右手腕/槽", parent: "shoulderR", color: "#8b5cf6", isSocket: true },
  { id: "hipL",      label: "左髋枢轴", parent: "pelvis",    color: "#2dd4bf" },
  { id: "footL",     label: "左脚踝",   parent: "hipL",      color: "#14b8a6" },
  { id: "hipR",      label: "右髋枢轴", parent: "pelvis",    color: "#60a5fa" },
  { id: "footR",     label: "右脚踝",   parent: "hipR",      color: "#3b82f6" },
];

/** Blender / Spine 风格锥形骨骼棒（从父枢轴 from 指向子端 to） */
export const HUMANOID_BONES: BoneDef[] = [
  { id: "bone-spine",  name: "脊柱 (Spine)",   from: "pelvis",    to: "neck",      color: "#38bdf8", part: "torso" },
  { id: "bone-head",   name: "头部 (Head)",    from: "neck",      to: "head",      color: "#fb7185", part: "head" },
  { id: "bone-armL",   name: "左臂 (Arm.L)",   from: "shoulderL", to: "handL",     color: "#34d399", part: "armL" },
  { id: "bone-armR",   name: "右臂 (Arm.R)",   from: "shoulderR", to: "handR",     color: "#a78bfa", part: "armR" },
  { id: "bone-legL",   name: "左腿 (Leg.L)",   from: "hipL",      to: "footL",     color: "#2dd4bf", part: "legL" },
  { id: "bone-legR",   name: "右腿 (Leg.R)",   from: "hipR",      to: "footR",     color: "#60a5fa", part: "legR" },
];

/** 辅助虚线连接（锁骨、骨盆横梁、头饰插槽连线） */
export const BONE_LINKS: [JointId, JointId][] = [
  ["pelvis", "torso"],
  ["torso", "neck"],
  ["neck", "head"],
  ["head", "crown"],
  ["head", "hairSide"],
  ["neck", "shoulderL"],
  ["shoulderL", "handL"],
  ["neck", "shoulderR"],
  ["shoulderR", "handR"],
  ["pelvis", "hipL"],
  ["hipL", "footL"],
  ["pelvis", "hipR"],
  ["hipR", "footR"],
];

function makeSkeleton(
  coords: Record<JointId, { x: number; y: number; scale?: number; rotate?: number; poseRotate?: number }>,
): DressSkeleton {
  const out = {} as DressSkeleton;
  for (const meta of JOINT_LIST) {
    const c = coords[meta.id];
    out[meta.id] = {
      id: meta.id,
      label: meta.label,
      parent: meta.parent,
      x: c.x,
      y: c.y,
      poseRotate: c.poseRotate ?? 0,
      scale: c.scale ?? 1.0,
      rotate: c.rotate ?? 0,
    };
  }
  return out;
}

/** 针对 5 套不同动漫头身比/姿势的礼服，专门标定的完整双足人体骨骼树（含双腿！） */
export const PRESET_DRESS_SKELETONS: AllDressSkeletons = {
  // 1. 初雪白茶连衣裙（1.87 头身 Q 版，含双腿脚踝）
  "dress-snow-white": makeSkeleton({
    pelvis:    { x: 50, y: 74 },
    torso:     { x: 50, y: 62 },
    neck:      { x: 50, y: 50 },
    head:      { x: 50, y: 27 },
    crown:     { x: 50, y: 12, scale: 1.0, rotate: 0 },
    hairSide:  { x: 64, y: 23, scale: 1.0, rotate: 12 },
    shoulderL: { x: 38, y: 53 },
    handL:     { x: 33, y: 69, scale: 0.95, rotate: -6 },
    shoulderR: { x: 62, y: 53 },
    handR:     { x: 67, y: 69, scale: 1.0, rotate: 6 },
    hipL:      { x: 44, y: 76 },
    footL:     { x: 43, y: 94 },
    hipR:      { x: 56, y: 76 },
    footR:     { x: 57, y: 94 },
  }),

  // 2. 深海小鲸鱼女仆（2.06 头身，左臂挥起、双腿站立）
  "dress-whale-maid": makeSkeleton({
    pelvis:    { x: 50, y: 73 },
    torso:     { x: 50, y: 60 },
    neck:      { x: 50, y: 48 },
    head:      { x: 50, y: 26 },
    crown:     { x: 50, y: 11, scale: 1.02, rotate: -2 },
    hairSide:  { x: 63, y: 22, scale: 1.0, rotate: 10 },
    shoulderL: { x: 39, y: 50 },
    handL:     { x: 31, y: 39, scale: 0.92, rotate: -14 },
    shoulderR: { x: 60, y: 51 },
    handR:     { x: 63, y: 66, scale: 1.0, rotate: 4 },
    hipL:      { x: 45, y: 76 },
    footL:     { x: 44, y: 94 },
    hipR:      { x: 55, y: 76 },
    footR:     { x: 56, y: 94 },
  }),

  // 3. 杏仁奶昔针织裙（3.2 头身动漫比例，修长双腿与高挑毛衣裙）
  "dress-apricot-tea": makeSkeleton({
    pelvis:    { x: 50, y: 66 },
    torso:     { x: 50, y: 50 },
    neck:      { x: 50, y: 35 },
    head:      { x: 50, y: 19 },
    crown:     { x: 50, y: 9,  scale: 0.78, rotate: 0 },
    hairSide:  { x: 58, y: 16, scale: 0.76, rotate: 10 },
    shoulderL: { x: 39, y: 38 },
    handL:     { x: 35, y: 60, scale: 0.85, rotate: -5 },
    shoulderR: { x: 61, y: 38 },
    handR:     { x: 65, y: 60, scale: 0.88, rotate: 5 },
    hipL:      { x: 44, y: 68 },
    footL:     { x: 43, y: 94 },
    hipR:      { x: 56, y: 68 },
    footR:     { x: 57, y: 94 },
  }),

  // 4. 暮色蔷薇圆舞曲（蓬蓬礼服裙 A-pose）
  "dress-rose-waltz": makeSkeleton({
    pelvis:    { x: 50, y: 68 },
    torso:     { x: 50, y: 54 },
    neck:      { x: 50, y: 40 },
    head:      { x: 50, y: 23 },
    crown:     { x: 50, y: 10, scale: 0.88, rotate: 0 },
    hairSide:  { x: 61, y: 19, scale: 0.85, rotate: 10 },
    shoulderL: { x: 38, y: 43 },
    handL:     { x: 24, y: 58, scale: 0.9, rotate: -12 },
    shoulderR: { x: 62, y: 43 },
    handR:     { x: 76, y: 58, scale: 0.92, rotate: 10 },
    hipL:      { x: 44, y: 72 },
    footL:     { x: 43, y: 94 },
    hipR:      { x: 56, y: 72 },
    footR:     { x: 57, y: 94 },
  }),

  // 5. 星河眠云轻纱裙（星空 Q 版）
  "dress-starlight-dream": makeSkeleton({
    pelvis:    { x: 50, y: 72 },
    torso:     { x: 50, y: 58 },
    neck:      { x: 50, y: 45 },
    head:      { x: 50, y: 26 },
    crown:     { x: 50, y: 11, scale: 0.94, rotate: 0 },
    hairSide:  { x: 62, y: 21, scale: 0.9, rotate: 10 },
    shoulderL: { x: 38, y: 48 },
    handL:     { x: 31, y: 63, scale: 0.92, rotate: -8 },
    shoulderR: { x: 62, y: 48 },
    handR:     { x: 69, y: 63, scale: 0.94, rotate: 8 },
    hipL:      { x: 44, y: 74 },
    footL:     { x: 43, y: 94 },
    hipR:      { x: 56, y: 74 },
    footR:     { x: 57, y: 94 },
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

/** Setup 模式：拖动父关节时，所有子孙关节级联平移 */
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

/** 更新关节的配饰缩放、旋转或 Pose 骨骼旋转角 */
export function updateJointTransform(
  skeleton: DressSkeleton,
  jointId: JointId,
  patch: { scale?: number; rotate?: number; poseRotate?: number },
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
  if (typeof patch.poseRotate === "number" && Number.isFinite(patch.poseRotate)) {
    joint.poseRotate = Math.max(-75, Math.min(75, Math.round(patch.poseRotate)));
  }
  return next;
}

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

/* ==================== 正运动学（Forward Kinematics, FK）世界坐标解算器 ==================== */

export type AnimClipId = "idle" | "tilt" | "wave" | "walk" | "cheer";

export interface AnimPoseOffsets {
  torsoRot: number;
  headRot: number;
  armLRot: number;
  armRRot: number;
  legLRot: number;
  legRRot: number;
  pelvisDy: number;
}

/** 5 套全身骨骼动作曲线（时间 t 单位：秒） */
export function evaluateAnimClip(clip: AnimClipId, t: number): AnimPoseOffsets {
  switch (clip) {
    case "tilt":
      return {
        torsoRot: Math.sin(t * 2.2) * 2.5,
        headRot: 12 + Math.sin(t * 2.2) * 4,
        armLRot: -8 + Math.sin(t * 2.2) * 5,
        armRRot: 10 - Math.sin(t * 2.2) * 5,
        legLRot: Math.sin(t * 2.2) * 2,
        legRRot: -Math.sin(t * 2.2) * 2,
        pelvisDy: Math.abs(Math.sin(t * 2.2)) * -0.8,
      };
    case "wave":
      return {
        torsoRot: Math.sin(t * 3) * 2,
        headRot: -6 + Math.sin(t * 3) * 3,
        armLRot: -28 + Math.sin(t * 7.5) * 18,
        armRRot: 8 + Math.cos(t * 3) * 4,
        legLRot: 0,
        legRRot: 0,
        pelvisDy: Math.sin(t * 3) * -0.6,
      };
    case "walk":
      return {
        torsoRot: Math.sin(t * 5.5) * 3.5,
        headRot: Math.sin(t * 5.5 - 0.4) * 4,
        armLRot: Math.sin(t * 5.5) * 18,
        armRRot: -Math.sin(t * 5.5) * 18,
        legLRot: -Math.sin(t * 5.5) * 20,
        legRRot: Math.sin(t * 5.5) * 20,
        pelvisDy: Math.abs(Math.cos(t * 5.5)) * -2.2,
      };
    case "cheer":
      return {
        torsoRot: Math.sin(t * 6) * 4,
        headRot: Math.sin(t * 6) * 6,
        armLRot: -32 - Math.abs(Math.sin(t * 6)) * 16,
        armRRot: 32 + Math.abs(Math.sin(t * 6)) * 16,
        legLRot: -10 * Math.abs(Math.sin(t * 6)),
        legRRot: 10 * Math.abs(Math.sin(t * 6)),
        pelvisDy: -Math.abs(Math.sin(t * 6)) * 4.5,
      };
    case "idle":
    default:
      return {
        torsoRot: Math.sin(t * 1.8) * 1.2,
        headRot: Math.sin(t * 1.8 - 0.5) * 2.4,
        armLRot: Math.sin(t * 1.8) * 3.2,
        armRRot: -Math.sin(t * 1.8) * 3.2,
        legLRot: 0,
        legRRot: 0,
        pelvisDy: Math.sin(t * 1.8) * -0.7,
      };
  }
}

export interface WorldJointState {
  x: number;
  y: number;
  worldAngle: number;
  scale: number;
  attachRotate: number;
}

function rotatePoint(px: number, py: number, ox: number, oy: number, deg: number): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = px - ox;
  const dy = py - oy;
  return {
    x: ox + dx * cos - dy * sin,
    y: oy + dx * sin + dy * cos,
  };
}

/**
 * 给定当前衣服的 Setup 骨骼树 + 动画偏移，按父子层级顺序求值所有关节的 FK 世界坐标与世界旋转角！
 */
export function solveWorldSkeleton(
  skel: DressSkeleton,
  anim: AnimPoseOffsets = { torsoRot: 0, headRot: 0, armLRot: 0, armRRot: 0, legLRot: 0, legRRot: 0, pelvisDy: 0 },
): Record<JointId, WorldJointState> {
  const out = {} as Record<JointId, WorldJointState>;

  const torsoAngle = (skel.torso.poseRotate || 0) + anim.torsoRot;
  const headAngle = torsoAngle + (skel.head.poseRotate || 0) + (skel.neck.poseRotate || 0) + anim.headRot;
  const armLAngle = torsoAngle + (skel.shoulderL.poseRotate || 0) + (skel.handL.poseRotate || 0) + anim.armLRot;
  const armRAngle = torsoAngle + (skel.shoulderR.poseRotate || 0) + (skel.handR.poseRotate || 0) + anim.armRRot;
  const legLAngle = (skel.hipL.poseRotate || 0) + (skel.footL.poseRotate || 0) + anim.legLRot;
  const legRAngle = (skel.hipR.poseRotate || 0) + (skel.footR.poseRotate || 0) + anim.legRRot;

  const pelvis = { x: skel.pelvis.x, y: skel.pelvis.y + anim.pelvisDy };
  out.pelvis = { ...pelvis, worldAngle: torsoAngle, scale: skel.pelvis.scale, attachRotate: skel.pelvis.rotate };

  // 胸腔、颈部、左右肩绕 pelvis 旋转 torsoAngle
  const torsoPt = rotatePoint(skel.torso.x, skel.torso.y + anim.pelvisDy, pelvis.x, pelvis.y, torsoAngle);
  out.torso = { ...torsoPt, worldAngle: torsoAngle, scale: skel.torso.scale, attachRotate: skel.torso.rotate };

  const neckPt = rotatePoint(skel.neck.x, skel.neck.y + anim.pelvisDy, pelvis.x, pelvis.y, torsoAngle);
  out.neck = { ...neckPt, worldAngle: headAngle, scale: skel.neck.scale, attachRotate: skel.neck.rotate };

  const shLPt = rotatePoint(skel.shoulderL.x, skel.shoulderL.y + anim.pelvisDy, pelvis.x, pelvis.y, torsoAngle);
  out.shoulderL = { ...shLPt, worldAngle: armLAngle, scale: skel.shoulderL.scale, attachRotate: skel.shoulderL.rotate };

  const shRPt = rotatePoint(skel.shoulderR.x, skel.shoulderR.y + anim.pelvisDy, pelvis.x, pelvis.y, torsoAngle);
  out.shoulderR = { ...shRPt, worldAngle: armRAngle, scale: skel.shoulderR.scale, attachRotate: skel.shoulderR.rotate };

  // 头部、头顶插槽、侧发插槽：先随 torso 旋转，再绕 neckPt 旋转 (headAngle - torsoAngle)
  const rotateHeadChain = (pt: { x: number; y: number }) => {
    const afterTorso = rotatePoint(pt.x, pt.y + anim.pelvisDy, pelvis.x, pelvis.y, torsoAngle);
    return rotatePoint(afterTorso.x, afterTorso.y, neckPt.x, neckPt.y, headAngle - torsoAngle);
  };

  const headPt = rotateHeadChain(skel.head);
  out.head = { ...headPt, worldAngle: headAngle, scale: skel.head.scale, attachRotate: skel.head.rotate };

  const crownPt = rotateHeadChain(skel.crown);
  out.crown = { ...crownPt, worldAngle: headAngle, scale: skel.crown.scale, attachRotate: skel.crown.rotate };

  const hairSidePt = rotateHeadChain(skel.hairSide);
  out.hairSide = { ...hairSidePt, worldAngle: headAngle, scale: skel.hairSide.scale, attachRotate: skel.hairSide.rotate };

  // 左手腕：先随 torso 旋转，再绕 shLPt 旋转 (armLAngle - torsoAngle)
  const handLAfterTorso = rotatePoint(skel.handL.x, skel.handL.y + anim.pelvisDy, pelvis.x, pelvis.y, torsoAngle);
  const handLPt = rotatePoint(handLAfterTorso.x, handLAfterTorso.y, shLPt.x, shLPt.y, armLAngle - torsoAngle);
  out.handL = { ...handLPt, worldAngle: armLAngle, scale: skel.handL.scale, attachRotate: skel.handL.rotate };

  // 右手腕：先随 torso 旋转，再绕 shRPt 旋转 (armRAngle - torsoAngle)
  const handRAfterTorso = rotatePoint(skel.handR.x, skel.handR.y + anim.pelvisDy, pelvis.x, pelvis.y, torsoAngle);
  const handRPt = rotatePoint(handRAfterTorso.x, handRAfterTorso.y, shRPt.x, shRPt.y, armRAngle - torsoAngle);
  out.handR = { ...handRPt, worldAngle: armRAngle, scale: skel.handR.scale, attachRotate: skel.handR.rotate };

  // 左右髋与双腿：hipL/hipR 随 pelvis 位移，footL 绕 hipL 旋转 legLAngle，footR 绕 hipR 旋转 legRAngle
  const hipLPt = { x: skel.hipL.x, y: skel.hipL.y + anim.pelvisDy };
  out.hipL = { ...hipLPt, worldAngle: legLAngle, scale: skel.hipL.scale, attachRotate: skel.hipL.rotate };
  const footLPt = rotatePoint(skel.footL.x, skel.footL.y + anim.pelvisDy, hipLPt.x, hipLPt.y, legLAngle);
  out.footL = { ...footLPt, worldAngle: legLAngle, scale: skel.footL.scale, attachRotate: skel.footL.rotate };

  const hipRPt = { x: skel.hipR.x, y: skel.hipR.y + anim.pelvisDy };
  out.hipR = { ...hipRPt, worldAngle: legRAngle, scale: skel.hipR.scale, attachRotate: skel.hipR.rotate };
  const footRPt = rotatePoint(skel.footR.x, skel.footR.y + anim.pelvisDy, hipRPt.x, hipRPt.y, legRAngle);
  out.footR = { ...footRPt, worldAngle: legRAngle, scale: skel.footR.scale, attachRotate: skel.footR.rotate };

  return out;
}

/**
 * 根据 Setup 骨骼关节坐标，生成 6 大人体部位图层（Head / Torso / ArmL / ArmR / LegL / LegR）
 * 的带圆弧重叠区 CSS clip-path 多边形/椭圆与各自的旋转枢轴 (transform-origin)，
 * 实现任意单张立绘的实时 6 层纸偶骨骼分离驱动！
 */
export interface PartSliceStyle {
  part: BodyPartId;
  zIndex: number;
  clipPath: string;
  originX: number;
  originY: number;
  angle: number;
  ty: number;
}

export function computeHumanoidPartSlices(
  skel: DressSkeleton,
  world: Record<JointId, WorldJointState>,
  anim: AnimPoseOffsets,
): PartSliceStyle[] {
  const neckY = skel.neck.y;
  const hipY = Math.max(skel.hipL.y, skel.hipR.y);
  const shLX = skel.shoulderL.x;
  const shRX = skel.shoulderR.x;

  return [
    // 1. 左腿层 (LegL)：从 hipY 向下到脚底，左半侧，绕 hipL 旋转
    {
      part: "legL",
      zIndex: 16,
      clipPath: `polygon(18% ${hipY - 3}%, 50.5% ${hipY - 3}%, 50.5% 100%, 18% 100%)`,
      originX: skel.hipL.x,
      originY: skel.hipL.y,
      angle: world.hipL.worldAngle,
      ty: anim.pelvisDy,
    },
    // 2. 右腿层 (LegR)：从 hipY 向下到脚底，右半侧，绕 hipR 旋转
    {
      part: "legR",
      zIndex: 17,
      clipPath: `polygon(49.5% ${hipY - 3}%, 82% ${hipY - 3}%, 82% 100%, 49.5% 100%)`,
      originX: skel.hipR.x,
      originY: skel.hipR.y,
      angle: world.hipR.worldAngle,
      ty: anim.pelvisDy,
    },
    // 3. 左臂层 (ArmL)：左肩外侧区域，绕 shoulderL 旋转
    {
      part: "armL",
      zIndex: 19,
      clipPath: `polygon(0% ${neckY - 2}%, ${shLX + 3}% ${neckY - 2}%, ${shLX + 1}% ${hipY + 4}%, 0% ${hipY + 4}%)`,
      originX: skel.shoulderL.x,
      originY: skel.shoulderL.y,
      angle: world.shoulderL.worldAngle,
      ty: anim.pelvisDy,
    },
    // 4. 躯干与裙摆主层 (Torso)：颈部以下、髋部以上（含躯干中心连接），绕 pelvis 旋转
    {
      part: "torso",
      zIndex: 20,
      clipPath: `polygon(${shLX - 3}% ${neckY - 3}%, ${shRX + 3}% ${neckY - 3}%, ${shRX + 5}% ${hipY + 3}%, ${shLX - 5}% ${hipY + 3}%)`,
      originX: skel.pelvis.x,
      originY: skel.pelvis.y,
      angle: world.pelvis.worldAngle,
      ty: anim.pelvisDy,
    },
    // 5. 右臂层 (ArmR)：右肩外侧区域，绕 shoulderR 旋转
    {
      part: "armR",
      zIndex: 21,
      clipPath: `polygon(${shRX - 3}% ${neckY - 2}%, 100% ${neckY - 2}%, 100% ${hipY + 4}%, ${shRX - 1}% ${hipY + 4}%)`,
      originX: skel.shoulderR.x,
      originY: skel.shoulderR.y,
      angle: world.shoulderR.worldAngle,
      ty: anim.pelvisDy,
    },
    // 6. 头部层 (Head)：颈部枢轴以上全部区域（带圆弧下沿重叠），绕 neck 枢轴旋转 -> 歪头时整个头部丝滑转动！
    {
      part: "head",
      zIndex: 24,
      clipPath: `polygon(0% 0%, 100% 0%, 100% ${neckY + 2.5}%, 0% ${neckY + 2.5}%)`,
      originX: skel.neck.x,
      originY: skel.neck.y,
      angle: world.neck.worldAngle,
      ty: anim.pelvisDy,
    },
  ];
}

/**
 * 生成 Blender / Spine 风格八面体锥形骨骼棒（Octahedral Tapered Bone）的 SVG Polygon 顶点串
 */
export function buildTaperedBonePolygon(x1: number, y1: number, x2: number, y2: number, width = 2.6): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 0.5) return `${x1},${y1}`;
  const nx = -dy / len;
  const ny = dx / len;
  // 距离根部 22% 处为骨骼最宽棱角点（标准 Blender Bone 形状）
  const midX = x1 + dx * 0.22;
  const midY = y1 + dy * 0.22;
  const pLeftX = (midX + nx * width).toFixed(2);
  const pLeftY = (midY + ny * width).toFixed(2);
  const pRightX = (midX - nx * width).toFixed(2);
  const pRightY = (midY - ny * width).toFixed(2);
  return `${x1.toFixed(2)},${y1.toFixed(2)} ${pLeftX},${pLeftY} ${x2.toFixed(2)},${y2.toFixed(2)} ${pRightX},${pRightY}`;
}
