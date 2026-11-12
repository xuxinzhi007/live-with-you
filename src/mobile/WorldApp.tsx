import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWorldGame } from "./world/useWorldGame";
import {
  DEFAULT_EQUIPPED_OUTFIT,
  STYLE_ATTR_LABELS,
  STYLING_SKILLS,
  STYLING_STAGES,
  SUIT_DEFS,
  WARDROBE_ITEMS,
  WARDROBE_SLOTS,
  computeOutfitStats,
  detectActiveSuit,
  couponsFromPat,
  evaluateOutfitForStage,
  getWardrobeItem,
  isStageUnlocked,
  openingScreen,
  recommendBestOutfitForStage,
  rollPavilionGacha,
  showcaseForWishPool,
  stageBondForRank,
  WISH_POOLS,
  type EquippedOutfit,
  type OutfitEvaluation,
  type PavilionPullItem,
  type StyleAttr,
  type StylingSkill,
  type StylingStage,
  type WardrobeItem,
  type WardrobeSlot,
  type WishPool,
} from "./world/nikki-wardrobe";
import { isComfyDressSource, resolveAsset } from "./world/remote-assets";
import { useRemoteAssetGeneration } from "./world/use-remote-assets";
import {
  getWearableOverlaySrc,
  loadCutoutImage,
} from "./world/paper-doll-rig";
import {
  BONE_LINKS,
  HUMANOID_BONES,
  JOINT_LIST,
  buildTaperedBonePolygon,
  evaluateAnimClip,
  getSkeletonForDress,
  moveJointCascade,
  resolveJointForItem,
  solveWorldSkeleton,
  updateJointTransform,
  type AllDressSkeletons,
  type AnimClipId,
  type JointId,
} from "./world/skeleton-system";
import { getBondLevelInfo } from "./world/codex";
import {
  NIKKI_SAVE_KEY,
  loadNikkiSaveFrom,
  type SavedNikkiState as NormalizedNikkiSave,
} from "./world/nikki-wardrobe";
import {
  probeCompanionStatus,
  sendCompanionChatMessage,
  type ChatTurn,
  type CompanionConnection,
} from "./world/companion-bridge";
import { getCharacterSkin } from "./world/skins";
import {
  MOTION_DURATION_MS,
  isPhase1LayeredOutfit,
  nextMotion,
  probeLayeredParts,
  resolveLayeredPartUrls,
  type LayerSkinId,
  type StageMotion,
} from "./world/layered-stage";
import { WorldScreen } from "./world/WorldScreen";
import { CodexScreen } from "./screens/CodexScreen";
import { ChatScreen } from "./screens/ChatScreen";
import { StagesScreen } from "./screens/StagesScreen";
import { WardrobeScreen } from "./screens/WardrobeScreen";
import { useNikkiState } from "./store/useNikkiState";
import { useScreenState } from "./store/useScreenState";
import { useUIState } from "./store/useUIState";
import { useChatState } from "./store/useChatState";
import { usePavilionState } from "./store/usePavilionState";
import { useRigState } from "./store/useRigState";
import type { RoomProp } from "./world/rooms";
import "./world.css";

/**
 * 正规手游场景流（Screen State Machine）：
 * - "title"    : 游戏启动封面页（Logo + 动态看板娘 + 点击开始游戏）
 * - "lobby"    : 纯净主大厅（中间 85% 纯净全身展示，不堆叠任何衣橱列表或削头顶横幅）
 * - "wardrobe" : 高定换装试衣间（上半全身试衣镜 + 下半轻巧衣橱）
 * - "rig"      : 🦴 可视化骨骼工作台（在角色身上直接显示骨骼杆与关节圆环，按住关节直接拖动校准！）
 * - "stages"   : 主题搭配闯关页
 * - "pavilion" : 星愿幻阁 & 官方 Qwen 编辑工坊
 * - "codex"    : 典藏套装与原画图鉴
 * - "chat"     : 和雯宝私语
 */
type GameScreen = "title" | "lobby" | "world" | "wardrobe" | "rig" | "stages" | "pavilion" | "codex" | "chat";

function CoinSvg() {
  return (
    <svg className="nk-svg" viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
      <circle cx="10" cy="10" r="8.5" fill="#f5bd41" stroke="#c8831b" strokeWidth="1.5" />
      <circle cx="10" cy="10" r="4.8" fill="none" stroke="#fff3c4" strokeWidth="1.2" />
    </svg>
  );
}

function GemSvg() {
  return (
    <svg className="nk-svg" viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
      <polygon points="10,2 17,8 10,18 3,8" fill="#f078a0" stroke="#b83b66" strokeWidth="1.3" />
      <polygon points="10,4 14,8 10,15 6,8" fill="#ffd1e1" opacity="0.65" />
    </svg>
  );
}

const QUICK_CHAT_TOPICS = [
  "今天这身搭配和头饰好看吗？",
  "我们去挑战下一章搭配赛吧～",
  "最喜欢深海小鲸鱼还是暮色蔷薇？",
  "陪我聊聊天，充充电吧！",
];

export function WorldApp() {
  const {
    state,
    setSkin,
    companionAct,
    grantBond,
    enterRoom,
    runProp,
  } = useWorldGame();
  const { nikki, setNikki, hasEnteredLobby: hasEnteredLobbyFlag, markEnteredLobby: markEnteredLobbyFn } = useNikkiState();
  const { screen, setScreen } = useScreenState();
  const [activeSlot, setActiveSlot] = useState<WardrobeSlot>("dress");
  const [selectedStageId, setSelectedStageId] = useState<string>(STYLING_STAGES[0].id);
  const [inspectedItemId, setInspectedItemId] = useState<string>(DEFAULT_EQUIPPED_OUTFIT.dress);
  const [selectedSkills, setSelectedSkills] = useState<StylingSkill["id"][]>(["smile", "charm"]);

  // 骨骼校准工作台：Setup 绑定对位模式 vs Pose 动作摆姿模式 + 全身骨骼动画播放器
  const {
    rigMode, setRigMode,
    animClip, setAnimClip,
    animTime, setAnimTime,
    selectedJoint, setSelectedJoint,
    draggingJoint, setDraggingJoint,
    cutoutMap, setCutoutMap,
    breatheIdx, setBreatheIdx,
    reacting, setReacting,
    stageMotion, setStageMotion,
    equipBurstKey, setEquipBurstKey,
    layeredReady, setLayeredReady,
    lobbyLine, setLobbyLine,
  } = useRigState();
  const boneBoxRef = useRef<HTMLDivElement>(null);
  const motionGenRef = useRef(0);

  // PK 走秀动态滚分演出状态
  const [evalModal, setEvalModal] = useState<{
    evalResult: OutfitEvaluation;
    coinsGained: number;
    bondGained: number;
    openedNextChapter: boolean;
    bonusUnlockedItem: WardrobeItem | null;
  } | null>(null);
  const [rollingScore, setRollingScore] = useState(0);
  const [showStamp, setShowStamp] = useState(false);

  const {
    gachaResults, setGachaResults,
    wishPhase, setWishPhase,
    wishPool, setWishPool,
    revealedPulls, setRevealedPulls,
    comfyPrompt, setComfyPrompt,
    comfyBusy, setComfyBusy,
    showAtelier, setShowAtelier,
  } = usePavilionState();
  const assetGeneration = useRemoteAssetGeneration();
  const heldDressSrc = useRef("");
  const wishTimer = useRef(0);
  const wishRailRef = useRef<HTMLDivElement>(null);
  const wishGlide = useRef(0);
  const wishDrag = useRef<{
    x: number;
    scroll: number;
    moved: boolean;
    lastT: number;
    lastScroll: number;
    velocity: number;
  } | null>(null);
  const wishSuppressClick = useRef(false);

  const wishScrollTarget = useCallback((id: WishPool) => {
    const rail = wishRailRef.current;
    const card = rail?.querySelector<HTMLElement>(`[data-pool="${id}"]`);
    if (!rail || !card) return null;
    const railBox = rail.getBoundingClientRect();
    const cardBox = card.getBoundingClientRect();
    const delta = cardBox.left + cardBox.width / 2 - (railBox.left + railBox.width / 2);
    return rail.scrollLeft + delta;
  }, []);

  const nearestWishPool = useCallback((projectedScroll: number) => {
    const rail = wishRailRef.current;
    if (!rail) return wishPoolRef.current;
    let next: WishPool = "all";
    let best = Number.POSITIVE_INFINITY;
    for (const card of rail.querySelectorAll<HTMLElement>("[data-pool]")) {
      const id = (card.dataset.pool as WishPool) || "all";
      const target = wishScrollTarget(id);
      if (target == null) continue;
      const dist = Math.abs(target - projectedScroll);
      if (dist < best) {
        best = dist;
        next = id;
      }
    }
    return next;
  }, [wishScrollTarget]);

  const paintWishScales = useCallback(() => {
    const rail = wishRailRef.current;
    if (!rail) return;
    let nearest: WishPool = wishPoolRef.current;
    let best = Number.POSITIVE_INFINITY;
    for (const card of rail.querySelectorAll<HTMLElement>("[data-pool]")) {
      const delta =
        card.offsetLeft -
        rail.offsetLeft +
        card.offsetWidth / 2 -
        rail.scrollLeft -
        rail.clientWidth / 2;
      const stride = card.offsetWidth || 280;
      const closeness = Math.max(0, 1 - Math.abs(delta) / stride);
      card.style.transform = `scale(${(0.92 + 0.08 * closeness).toFixed(3)})`;
      card.style.opacity = (0.55 + 0.45 * closeness).toFixed(3);
      if (Math.abs(delta) < best) {
        best = Math.abs(delta);
        nearest = (card.dataset.pool as WishPool) || "all";
      }
    }
    if (nearest !== wishPoolRef.current) setWishPool(nearest);
  }, []);

  const glideWishTo = useCallback((id: WishPool) => {
    const rail = wishRailRef.current;
    const target = wishScrollTarget(id);
    if (!rail || target == null) return;
    cancelAnimationFrame(wishGlide.current);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || Math.abs(target - rail.scrollLeft) < 1) {
      rail.scrollLeft = target;
      rail.classList.remove("m-drag");
      paintWishScales();
      setWishPool(id);
      return;
    }
    rail.classList.add("m-drag");
    const from = rail.scrollLeft;
    const distance = target - from;
    const duration = Math.min(520, Math.max(320, Math.abs(distance) * 0.55));
    const started = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - started) / duration);
      const eased = 1 - (1 - t) ** 3;
      rail.scrollLeft = from + distance * eased;
      paintWishScales();
      if (t < 1) {
        wishGlide.current = requestAnimationFrame(tick);
        return;
      }
      rail.scrollLeft = target;
      rail.classList.remove("m-drag");
      paintWishScales();
      setWishPool(id);
    };
    wishGlide.current = requestAnimationFrame(tick);
  }, [paintWishScales, wishScrollTarget]);

  const wishPoolRef = useRef(wishPool);
  wishPoolRef.current = wishPool;

  const stepWishPool = useCallback((dir: -1 | 1) => {
    const index = WISH_POOLS.findIndex((pool) => pool.id === wishPoolRef.current);
    const next = WISH_POOLS[Math.min(WISH_POOLS.length - 1, Math.max(0, index + dir))];
    if (!next || next.id === wishPoolRef.current) return;
    glideWishTo(next.id);
  }, [glideWishTo]);

  useEffect(() => {
    if (screen !== "pavilion") return;
    const align = () => {
      const rail = wishRailRef.current;
      const target = wishScrollTarget(wishPoolRef.current);
      if (rail && target != null) rail.scrollLeft = target;
    };
    align();
    const frame = requestAnimationFrame(() => {
      align();
      paintWishScales();
    });
    return () => cancelAnimationFrame(frame);
  }, [paintWishScales, screen, wishScrollTarget]);

  useEffect(() => {
    const rail = wishRailRef.current;
    if (screen !== "pavilion" || !rail) return;
    let cooling = false;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      if (cooling || Math.abs(delta) < 8) return;
      cooling = true;
      stepWishPool(delta > 0 ? 1 : -1);
      window.setTimeout(() => {
        cooling = false;
      }, 280);
    };
    rail.addEventListener("wheel", onWheel, { passive: false });
    return () => rail.removeEventListener("wheel", onWheel);
  }, [screen, stepWishPool]);

  useEffect(() => () => cancelAnimationFrame(wishGlide.current), []);

  const { toast, showToast, popups, pushPopup } = useUIState();
  const {
    chatHistory, setChatHistory,
    chatInput, setChatInput,
    chatBusy, setChatBusy,
    companionConn, setCompanionConn,
  } = useChatState();


  // 30FPS 驱动全身双足 FK 骨骼动画（呼吸/歪头/挥手/踏步走/欢呼）
  // 节流：每 33ms 才 setState 一次，避免 60fps 打满。只在有骨骼动画的屏幕跑。
  useEffect(() => {
    const needsAnim =
      screen === "lobby" || screen === "wardrobe" || screen === "rig" || screen === "stages";
    if (!needsAnim) return;
    if (screen === "rig" && rigMode === "setup") return;
    let raf = 0;
    let last = 0;
    const t0 = performance.now();
    const loop = (now: number) => {
      if (now - last >= 33) {
        last = now;
        setAnimTime((now - t0) / 1000);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [rigMode, screen]);

  useEffect(() => {
    void probeCompanionStatus().then(setCompanionConn);
  }, []);

  const currentDress = useMemo(() => getWardrobeItem(nikki.equipped.dress), [nikki.equipped.dress, assetGeneration]);
  const currentHairAcc = useMemo(() => getWardrobeItem(nikki.equipped.hairAcc), [nikki.equipped.hairAcc, assetGeneration]);
  const currentHandheld = useMemo(() => getWardrobeItem(nikki.equipped.handheld), [nikki.equipped.handheld, assetGeneration]);
  const currentAura = useMemo(() => getWardrobeItem(nikki.equipped.aura), [nikki.equipped.aura, assetGeneration]);
  const currentCard = useMemo(() => getWardrobeItem(nikki.equipped.memoryCard), [nikki.equipped.memoryCard, assetGeneration]);

  // 当前所穿服装的专属层级骨骼树（每套衣服独立保存！）
  const activeSkeleton = useMemo(
    () => getSkeletonForDress(currentDress.id, nikki.dressSkeletons),
    [currentDress.id, nikki.dressSkeletons],
  );

  const itemImage = useCallback(
    (item: WardrobeItem) => nikki.customImages?.[item.id] || item.image,
    [nikki.customImages],
  );

  // 仓库里已有的 Comfy 礼服仍可预处理；官方 Qwen 新图（customImages）先用未抠原图，不用洪水填充。
  useEffect(() => {
    let active = true;
    const customSrc = nikki.customImages?.[currentDress.id];
    if (customSrc) {
      setCutoutMap((prev) => (prev[currentDress.id] === customSrc ? prev : { ...prev, [currentDress.id]: customSrc }));
    }
    const jobs = WARDROBE_ITEMS.filter((item) => {
      if (item.slot !== "dress" || !isComfyDressSource(item.image)) return false;
      if (nikki.customImages?.[item.id]) return false;
      return true;
    });
    for (const item of jobs) {
      void loadCutoutImage(item.image, "character").then((dataUrl) => {
        if (!active) return;
        setCutoutMap((prev) => (prev[item.id] === dataUrl ? prev : { ...prev, [item.id]: dataUrl }));
      });
    }
    return () => {
      active = false;
    };
  }, [currentDress.id, nikki.customImages]);

  const playStageMotion = useCallback((input: StageMotion) => {
    const gen = ++motionGenRef.current;
    setStageMotion((current) => nextMotion(current, input));
    setReacting(input !== "idle");
    if (input === "idle") return;
    const duration = MOTION_DURATION_MS[input];
    window.setTimeout(() => {
      if (motionGenRef.current !== gen) return;
      setStageMotion("idle");
      setReacting(false);
    }, duration);
  }, []);

  const layerSkinId: LayerSkinId = currentDress.skinId === "maid" ? "maid" : "original";
  const layeredEligible = isPhase1LayeredOutfit(currentDress.id);
  const layeredUrls = useMemo(
    () => resolveLayeredPartUrls(layerSkinId, currentDress.id),
    [layerSkinId, currentDress.id],
  );
  const showLayered = layeredEligible && layeredReady;

  useEffect(() => {
    if (showLayered) return;
    const timer = setInterval(() => {
      setBreatheIdx((i) => (i + 1) % 4);
    }, 520);
    return () => clearInterval(timer);
  }, [showLayered]);

  useEffect(() => {
    let alive = true;
    if (!layeredEligible) {
      setLayeredReady(false);
      return;
    }
    setLayeredReady(false);
    void probeLayeredParts(layeredUrls).then((ok) => {
      if (alive) setLayeredReady(ok);
    });
    return () => {
      alive = false;
    };
  }, [layeredEligible, layeredUrls]);

  useEffect(() => {
    if (!evalModal) {
      setRollingScore(0);
      setShowStamp(false);
      return;
    }
    const target = evalModal.evalResult.totalScore;
    const duration = 850;
    const start = performance.now();
    let rafId = 0;

    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 4);
      setRollingScore(Math.round(target * eased));
      if (t < 1) {
        rafId = requestAnimationFrame(step);
      } else {
        setShowStamp(true);
      }
    };
    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [evalModal]);

  const unlockedSet = useMemo(() => new Set(nikki.unlockedIds), [nikki.unlockedIds]);
  const bondInfo = useMemo(() => getBondLevelInfo(state.bond), [state.bond]);

  const inspectedItem = useMemo(() => getWardrobeItem(inspectedItemId), [inspectedItemId, assetGeneration]);
  const activeSuitInfo = useMemo(() => detectActiveSuit(nikki.equipped), [nikki.equipped]);

  const activeSkin = useMemo(
    () => getCharacterSkin(currentDress.skinId ?? "original"),
    [currentDress.skinId, assetGeneration],
  );

  const totalStats = useMemo(
    () => computeOutfitStats(nikki.equipped, nikki.itemStars),
    [nikki.equipped, nikki.itemStars],
  );

  const totalCharmPower = useMemo(
    () =>
      totalStats.sweet +
      totalStats.elegant +
      totalStats.pure +
      totalStats.warm +
      totalStats.cool +
      activeSuitInfo.bonusScore,
    [activeSuitInfo.bonusScore, totalStats],
  );

  const selectedStage: StylingStage = useMemo(
    () => STYLING_STAGES.find((s) => s.id === selectedStageId) ?? STYLING_STAGES[0],
    [selectedStageId],
  );
  const selectedStageOpen = isStageUnlocked(selectedStage.id, nikki.clearedStages);

  const livePreviewEval = useMemo(
    () => evaluateOutfitForStage(selectedStage, nikki.equipped, nikki.itemStars, selectedSkills),
    [nikki.equipped, nikki.itemStars, selectedSkills, selectedStage],
  );

  // 根据当前头饰/手持物/香氛绑定的骨骼节点 + FK 正运动学解算世界坐标与旋转角！
  const hairJointId = useMemo(() => resolveJointForItem(currentHairAcc.id, "hairAcc"), [currentHairAcc.id]);
  const handJointId = useMemo(() => resolveJointForItem(currentHandheld.id, "handheld"), [currentHandheld.id]);

  const currentAnimOffsets = useMemo(
    () =>
      screen === "rig" && rigMode === "setup"
        ? { torsoRot: 0, headRot: 0, armLRot: 0, armRRot: 0, legLRot: 0, legRRot: 0, pelvisDy: 0 }
        : evaluateAnimClip(animClip, animTime),
    [animClip, animTime, rigMode, screen],
  );

  const worldJoints = useMemo(
    () => solveWorldSkeleton(activeSkeleton, currentAnimOffsets),
    [activeSkeleton, currentAnimOffsets],
  );

  const hairWorld = worldJoints[hairJointId];
  const handWorld = worldJoints[handJointId];
  const auraWorld = worldJoints.torso;

  const hairOverlaySrc = getWearableOverlaySrc(currentHairAcc.id, itemImage(currentHairAcc));
  const handOverlaySrc = getWearableOverlaySrc(currentHandheld.id, itemImage(currentHandheld));
  const auraOverlaySrc = getWearableOverlaySrc(currentAura.id, itemImage(currentAura));

  // ==================== 可视化骨骼关节拖拽处理（Setup 拖关节对位 / Pose 拖骨骼旋转摆动作） ====================
  const handleBonePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingJoint || !boneBoxRef.current) return;
    const rect = boneBoxRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const nx = ((e.clientX - rect.left) / rect.width) * 100;
    const ny = ((e.clientY - rect.top) / rect.height) * 100;

    setNikki((prev) => {
      const curSkel = getSkeletonForDress(currentDress.id, prev.dressSkeletons);
      if (rigMode === "pose") {
        // Pose 模式：拖动末端关节时，计算相对父枢轴的角度变化，直接旋转该部位骨骼（FK 摆姿）！
        const node = curSkel[draggingJoint];
        const parentNode = node.parent ? curSkel[node.parent] : null;
        if (parentNode && !node.id.startsWith("crown") && !node.id.startsWith("hair")) {
          const restAngle = (Math.atan2(node.y - parentNode.y, node.x - parentNode.x) * 180) / Math.PI;
          const curAngle = (Math.atan2(ny - parentNode.y, nx - parentNode.x) * 180) / Math.PI;
          let delta = curAngle - restAngle;
          if (delta > 180) delta -= 360;
          if (delta < -180) delta += 360;
          const nextSkel = updateJointTransform(curSkel, draggingJoint, { poseRotate: delta });
          return {
            ...prev,
            dressSkeletons: { ...(prev.dressSkeletons || {}), [currentDress.id]: nextSkel },
          };
        }
      }
      const nextSkel = moveJointCascade(curSkel, draggingJoint, nx, ny);
      return {
        ...prev,
        dressSkeletons: { ...(prev.dressSkeletons || {}), [currentDress.id]: nextSkel },
      };
    });
  }, [currentDress.id, draggingJoint, rigMode]);

  const handleBonePointerUp = useCallback(() => {
    setDraggingJoint(null);
  }, []);

  const handleSelectedJointScaleRotate = useCallback((patch: { scale?: number; rotate?: number; poseRotate?: number }) => {
    setNikki((prev) => {
      const curSkel = getSkeletonForDress(currentDress.id, prev.dressSkeletons);
      const nextSkel = updateJointTransform(curSkel, selectedJoint, patch);
      return {
        ...prev,
        dressSkeletons: { ...(prev.dressSkeletons || {}), [currentDress.id]: nextSkel },
      };
    });
  }, [currentDress.id, selectedJoint]);

  const handleResetDressSkeleton = useCallback(() => {
    setNikki((prev) => {
      const nextMap = { ...(prev.dressSkeletons || {}) };
      delete nextMap[currentDress.id];
      return { ...prev, dressSkeletons: nextMap };
    });
    pushPopup(`已重置【${currentDress.name}】骨骼树`);
  }, [currentDress.id, currentDress.name, pushPopup]);

  const handleCopySkeletonJson = useCallback(() => {
    const jsonText = JSON.stringify({ [currentDress.id]: activeSkeleton }, null, 2);
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(jsonText);
    }
    showToast(`📋 已复制【${currentDress.name}】的专属骨骼树 JSON！`);
  }, [activeSkeleton, currentDress.id, currentDress.name, showToast]);

  const handleSelectOrEquipItem = useCallback((item: WardrobeItem) => {
    setInspectedItemId(item.id);
    if (!unlockedSet.has(item.id)) {
      showToast(`【${item.name}】尚未解锁，可点击上方『🔨定制』直接制作或去星愿幻阁抽取～`);
      return;
    }
    setNikki((prev) => ({
      ...prev,
      equipped: { ...prev.equipped, [item.slot]: item.id },
    }));
    if (item.skinId) {
      setSkin(item.skinId);
    }
    if (item.slot === "hairAcc") {
      setSelectedJoint(resolveJointForItem(item.id, "hairAcc"));
    } else if (item.slot === "handheld") {
      setSelectedJoint(resolveJointForItem(item.id, "handheld"));
    }
    setEquipBurstKey((k) => k + 1);
    playStageMotion(item.slot === "dress" ? "equip" : "react");
    pushPopup(`✨ 穿戴：${item.name}`);
  }, [playStageMotion, pushPopup, setSkin, showToast, unlockedSet]);

  const handleUpgradeOrCraftItem = useCallback((item: WardrobeItem) => {
    const owned = unlockedSet.has(item.id);
    const currentStar = nikki.itemStars[item.id] ?? 1;

    if (!owned) {
      const craftCost = item.rarity === "SSR" ? 28 : item.rarity === "SR" ? 16 : 10;
      if (nikki.coupons < craftCost) {
        showToast(`定制【${item.name}】需要 ${craftCost} 礼券（当前 ${nikki.coupons}），去『👑 闯关』赢礼券吧！`);
        return;
      }
      setNikki((prev) => ({
        ...prev,
        coupons: prev.coupons - craftCost,
        unlockedIds: [...prev.unlockedIds, item.id],
        equipped: { ...prev.equipped, [item.slot]: item.id },
        itemStars: { ...prev.itemStars, [item.id]: 1 },
      }));
      if (item.skinId) setSkin(item.skinId);
      setEquipBurstKey((k) => k + 1);
      playStageMotion(item.slot === "dress" ? "equip" : "react");
      pushPopup(`定制并穿戴 ${item.name}`);
      return;
    }

    if (currentStar >= 5) {
      showToast("该单品已经达到最高 ★5 满星啦！");
      return;
    }
    const upCost = currentStar * 8;
    if (nikki.coupons < upCost) {
      showToast(`升至 ★${currentStar + 1} 需要 ${upCost} 礼券（当前 ${nikki.coupons}）！`);
      return;
    }
    setNikki((prev) => ({
      ...prev,
      coupons: prev.coupons - upCost,
      itemStars: { ...prev.itemStars, [item.id]: currentStar + 1 },
    }));
    setEquipBurstKey((k) => k + 1);
    playStageMotion("react");
    pushPopup(`⭐ ${item.name} 升至 ★${currentStar + 1}`);
  }, [nikki.coupons, nikki.itemStars, playStageMotion, pushPopup, setSkin, showToast, unlockedSet]);

  const handleLiveComfyGenerate = useCallback(async () => {
    if (comfyBusy) return;
    setComfyBusy(true);
    showToast("🎨 正在用官方 Qwen 编辑母图出图，大约需要 3–4 分钟…");
    try {
      const res = await fetch("/api/comfy/draw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: comfyPrompt,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload?.ok || !payload?.image) {
        throw new Error(payload?.error || "ComfyUI 生图失败");
      }
      // 预览用未抠原图，不用洪水填充（白 T 白短裤会穿帮）。
      const previewUrl = payload.image as string;
      setCutoutMap((prev) => ({ ...prev, [inspectedItem.id]: previewUrl }));
      setNikki((prev) => ({
        ...prev,
        customImages: { ...(prev.customImages || {}), [inspectedItem.id]: previewUrl },
      }));
      setEquipBurstKey((k) => k + 1);
      pushPopup(`🎨 新生成的【${inspectedItem.name}】已作为预览（未抠底），可点『🦴骨骼』微调`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "请确认本机 ComfyUI (127.0.0.1:8188) 正在运行");
    } finally {
      setComfyBusy(false);
    }
  }, [comfyBusy, comfyPrompt, inspectedItem.id, inspectedItem.name, pushPopup, showToast]);

  const handleTapCharacter = useCallback(() => {
    if (screen === "rig") return;
    const now = Date.now();
    const couponsGained = couponsFromPat(nikki.lastCouponPatAt, now);
    const res = companionAct("pat", false);
    setNikki((prev) => ({
      ...prev,
      coupons: prev.coupons + couponsGained,
      lastCouponPatAt: couponsGained > 0 ? now : prev.lastCouponPatAt,
    }));
    setEquipBurstKey((k) => k + 1);
    playStageMotion("react");
    const lines = [
      `「今天穿的是【${currentDress.name}】，头饰和手持物都牢牢绑在我的骨骼点上啦！」`,
      "「如果新生成的衣服高矮不同，点右边的『🦴骨骼』就能直接拖动我身上的关节点对位哦～」",
      `「当前搭配总魅力已经达到 ${totalCharmPower} 分啦！」`,
    ];
    setLobbyLine(lines[Math.floor(Math.random() * lines.length)]);
    pushPopup(
      couponsGained > 0
        ? `+${res.bondGained} 亲密 · +${couponsGained} 礼券`
        : `+${res.bondGained} 亲密`,
    );
  }, [companionAct, currentDress.name, nikki.lastCouponPatAt, playStageMotion, pushPopup, screen, totalCharmPower]);

  const handleAutoRecommend = useCallback((stage: StylingStage) => {
    const best = recommendBestOutfitForStage(stage, unlockedSet, nikki.itemStars);
    setNikki((prev) => ({ ...prev, equipped: best }));
    const dress = getWardrobeItem(best.dress);
    if (dress.skinId) setSkin(dress.skinId);
    setInspectedItemId(best.dress);
    setEquipBurstKey((k) => k + 1);
    playStageMotion("equip");
    showToast(`💡 已一键换上【${STYLE_ATTR_LABELS[stage.primaryAttr].name}·${STYLE_ATTR_LABELS[stage.secondaryAttr].name}】最优搭配！`);
  }, [nikki.itemStars, playStageMotion, setSkin, showToast, unlockedSet]);

  const handleToggleSkill = useCallback((skId: StylingSkill["id"]) => {
    setSelectedSkills((prev) => {
      if (prev.includes(skId)) {
        return prev.length > 1 ? prev.filter((id) => id !== skId) : prev;
      }
      return [...prev.slice(-1), skId];
    });
  }, []);

  const handleStartStylingEval = useCallback((stage: StylingStage) => {
    if (!isStageUnlocked(stage.id, nikki.clearedStages)) {
      showToast("先在上一话拿到 S 级，这一话才会开放");
      return;
    }
    const evalResult = evaluateOutfitForStage(stage, nikki.equipped, nikki.itemStars, selectedSkills);
    let bonusUnlockedItem: WardrobeItem | null = null;
    const nextUnlocked = new Set(nikki.unlockedIds);

    if (evalResult.passedS && stage.firstSRewardItem && !nextUnlocked.has(stage.firstSRewardItem)) {
      nextUnlocked.add(stage.firstSRewardItem);
      bonusUnlockedItem = getWardrobeItem(stage.firstSRewardItem);
    }

    const rankOrder: Record<string, number> = { C: 1, B: 2, A: 3, S: 4, SS: 5, SSS: 6 };
    const prevBest = nikki.clearedStages[stage.id];
    const bestRank = !prevBest || rankOrder[evalResult.rank] > rankOrder[prevBest] ? evalResult.rank : prevBest;

    const coinsGained = evalResult.passedS ? stage.rewardCoins : Math.max(3, Math.floor(stage.rewardCoins / 2));
    const bondGained = stageBondForRank(evalResult.rank);
    const nextStage = STYLING_STAGES[STYLING_STAGES.findIndex((item) => item.id === stage.id) + 1];
    const openedNextChapter = Boolean(
      evalResult.passedS && nextStage && !isStageUnlocked(nextStage.id, nikki.clearedStages),
    );

    setNikki((prev) => ({
      ...prev,
      coupons: prev.coupons + coinsGained,
      unlockedIds: Array.from(nextUnlocked),
      clearedStages: { ...prev.clearedStages, [stage.id]: bestRank },
    }));
    grantBond(bondGained);

    setEvalModal({
      evalResult,
      coinsGained,
      bondGained,
      openedNextChapter,
      bonusUnlockedItem,
    });
  }, [grantBond, nikki.clearedStages, nikki.equipped, nikki.itemStars, nikki.unlockedIds, selectedSkills, showToast]);

  const handlePavilionDraw = useCallback((count: 1 | 5) => {
    if (wishPhase !== "idle") return;
    const cost = count === 5 ? 20 : 5;
    if (nikki.coupons < cost) {
      showToast(`许愿 ${count} 次需要 ${cost} 礼券（当前 ${nikki.coupons}）！`);
      return;
    }
    const res = rollPavilionGacha(count, unlockedSet, nikki.itemStars, Math.random, wishPool);
    setNikki((prev) => ({
      ...prev,
      coupons: prev.coupons - cost,
      unlockedIds: res.nextUnlockedIds,
      itemStars: res.nextStars,
    }));
    grantBond(res.bondGained);
    setGachaResults(res.pulls);
    setRevealedPulls(0);
    setWishPhase("charge");
    window.clearTimeout(wishTimer.current);
    wishTimer.current = window.setTimeout(() => {
      setWishPhase("reveal");
      setRevealedPulls(1);
    }, 900);
    pushPopup(`幻阁抽取 ×${count} · +${res.bondGained} 亲密`);
  }, [grantBond, nikki.coupons, nikki.itemStars, pushPopup, showToast, unlockedSet, wishPhase, wishPool]);

  const handleSendChat = useCallback(async (textToSend?: string) => {
    const msg = (textToSend ?? chatInput).trim();
    if (!msg || chatBusy) return;
    setChatInput("");
    setChatBusy(true);
    const nextHistory: ChatTurn[] = [...chatHistory, { role: "user", content: msg }];
    setChatHistory(nextHistory);
    try {
      const { reply } = await sendCompanionChatMessage(msg, nextHistory, state);
      setChatHistory((prev) => [...prev, { role: "assistant", content: reply }]);
      companionAct("pat", false);
    } finally {
      setChatBusy(false);
    }
  }, [chatBusy, chatHistory, chatInput, companionAct, state]);

  const slotItems = useMemo(
    () => WARDROBE_ITEMS.filter((item) => item.slot === activeSlot),
    [activeSlot],
  );

  const isComfyDress = isComfyDressSource(currentDress.image);
  const customDressImg = nikki.customImages?.[currentDress.id];
  const preparedDressSrc = (customDressImg || isComfyDress) ? cutoutMap[currentDress.id] || "" : "";
  if (preparedDressSrc) heldDressSrc.current = preparedDressSrc;
  // 抠图没好时继续显示上一套透明立绘，不回退到白底原图。
  const heroSpriteSrc = !isComfyDress && !customDressImg
    ? reacting
      ? activeSkin.react
      : activeSkin.breathe[breatheIdx % activeSkin.breathe.length] || activeSkin.idle
    : preparedDressSrc || heldDressSrc.current;

  const collectionPercent = Math.round((nikki.unlockedIds.length / WARDROBE_ITEMS.length) * 100);
  const inspectedOwned = unlockedSet.has(inspectedItem.id);
  const inspectedStars = nikki.itemStars[inspectedItem.id] ?? 1;
  const activeJointNode = activeSkeleton[selectedJoint];

  /* ==================== 画面 1：正规手游启动封面页 (Title Screen) ==================== */
  if (screen === "title") {
    return (
      <div id="nikki-root" className="nk-title-screen" onClick={() => {
        markEnteredLobbyFn();
        setScreen("lobby");
      }}>
        <div
          className="nk-title-bg"
          style={{ backgroundImage: `url(${itemImage(currentCard) || resolveAsset("assets/nikki/card-starlight-waltz.png")})` }}
          aria-hidden="true"
        />
        <div className="nk-sparkles" aria-hidden="true">
          <i className="s1" /><i className="s2" /><i className="s3" /><i className="s4" /><i className="s5" />
        </div>

        <div className="nk-title-top">
          <span className="nk-title-ver">VER 8.0 · LIVE WITH WENBAO</span>
        </div>

        <div className="nk-title-hero">
          {showLayered ? (
            <div className={`nk-layered-stack m-title m-motion-${stageMotion}`} aria-hidden="true">
              <img className="nk-layer m-body" src={layeredUrls.body} alt="" draggable={false} />
              <img className="nk-layer m-dress" src={layeredUrls.dress} alt="" draggable={false} />
              <img className="nk-layer m-head" src={layeredUrls.head} alt="" draggable={false} />
              <img className="nk-layer m-arms" src={layeredUrls.armsFront} alt="" draggable={false} />
            </div>
          ) : (
            <img src={heroSpriteSrc} alt="雯宝" draggable={false} />
          )}
        </div>

        <div className="nk-title-brand">
          <span className="nk-title-sub">STYLING & COMPANION STORY</span>
          <h1>雯宝 · 心境衣橱</h1>
          <p>高定换装 · 骨骼工坊 · 星愿幻阁 · 朝夕相伴</p>
          <button
            type="button"
            className="nk-title-start-btn"
            onClick={(e) => {
              e.stopPropagation();
              markEnteredLobbyFn();
              setScreen("lobby");
            }}
          >
            ✨ 点击进入小屋 · TAP TO START
          </button>
        </div>
      </div>
    );
  }

  return (
    <div id="nikki-root" data-theme={currentDress.stageTheme || "daylight"}>
      {/* 1. 极简顶栏（含返回封面/大厅按钮） */}
      <header className="nk-header">
        <button
          type="button"
          className="nk-profile"
          onClick={() => setScreen(screen === "lobby" ? "title" : "lobby")}
          title={screen === "lobby" ? "返回游戏封面" : "返回主大厅"}
        >
          <img src={activeSkin.avatar} alt="" draggable={false} />
          <div className="nk-profile-text">
            <div className="nk-profile-row">
              <strong>{screen === "lobby" ? "雯宝" : "‹ 返回大厅"}</strong>
              <span className="nk-lv">Lv.{bondInfo.level}</span>
            </div>
            <div className="nk-exp-track">
              <i style={{ width: `${bondInfo.progressPercent}%` }} />
            </div>
          </div>
        </button>

        <div className="nk-currencies">
          <button type="button" className="nk-curr-pill" onClick={() => setScreen("stages")}>
            <GemSvg />
            <b>{totalCharmPower}</b>
            <span>魅力</span>
          </button>
          <button type="button" className="nk-curr-pill" onClick={() => setScreen("pavilion")}>
            <CoinSvg />
            <b>{nikki.coupons}</b>
            <span>礼券</span>
          </button>
        </div>
      </header>

      <main className="nk-main">
        {/* ==================== 共享核心舞台（在「主大厅」「换装」「骨骼校准」「闯关」下展示） ==================== */}
        {(screen === "lobby" || screen === "wardrobe" || screen === "rig" || screen === "stages") && (
          <section
            className={`nk-stage-card${screen === "lobby" || screen === "rig" ? " m-expanded" : ""}`}
          >
            <div
              className="nk-stage-bg"
              style={{ backgroundImage: `url(${itemImage(currentCard) || currentDress.bgScene || resolveAsset("assets/scenes/home.webp")})` }}
              aria-hidden="true"
            />
            <div className="nk-stage-frame" aria-hidden="true" />

            {equipBurstKey > 0 && (
              <div key={equipBurstKey} className="nk-magic-ring" aria-hidden="true" />
            )}

            <div className="nk-sparkles" aria-hidden="true">
              <i className="s1" /><i className="s2" /><i className="s3" /><i className="s4" /><i className="s5" />
            </div>

            {/* 仅在「主大厅 Lobby」显示的右侧精致悬浮功能按钮组（不挡人物、不削头顶！） */}
            {screen === "lobby" && (
              <>
                <div className="nk-lobby-bubble" onClick={handleTapCharacter}>
                  <span>{lobbyLine}</span>
                </div>
                <aside className="nk-lobby-menu" aria-label="快捷入口">
                  <button type="button" className="nk-lobby-btn" onClick={() => setScreen("wardrobe")}>
                    <span>👗</span>
                    <small>换装</small>
                  </button>
                  <button type="button" className="nk-lobby-btn" onClick={() => setScreen("rig")}>
                    <span>🦴</span>
                    <small>骨骼</small>
                  </button>
                  <button type="button" className="nk-lobby-btn m-pk" onClick={() => setScreen("stages")}>
                    <span>👑</span>
                    <small>闯关</small>
                  </button>
                  <button type="button" className="nk-lobby-btn" onClick={() => setScreen("pavilion")}>
                    <span>✨</span>
                    <small>幻阁</small>
                  </button>
                </aside>
              </>
            )}

            {/* ==================== 核心：每套衣服独立的层级骨骼容器 (Hierarchical Skeleton Rig) ==================== */}
            <div
              className={`nk-paperdoll-rig${reacting ? " m-bounce" : ""}${screen === "rig" ? " m-rig-mode" : ""}${showLayered ? " m-layered" : ""} m-motion-${stageMotion}${preparedDressSrc ? " m-dress-ready" : ""}`}
              onClick={handleTapCharacter}
              role="button"
              tabIndex={0}
              aria-label="雯宝角色舞台"
            >
              <div
                ref={boneBoxRef}
                className="nk-bone-box"
                onPointerMove={handleBonePointerMove}
                onPointerUp={handleBonePointerUp}
                onPointerCancel={handleBonePointerUp}
              >
                {/* Layer 10: 绑定在胸腔主骨骼 torso 上的背后环绕光环 */}
                <img
                  className="nk-bone-layer m-aura"
                  src={auraOverlaySrc}
                  alt={currentAura.name}
                  style={{
                    left: `${auraWorld.x}%`,
                    top: `${auraWorld.y}%`,
                    width: `${88 * auraWorld.scale}%`,
                    zIndex: 10,
                    transform: `translate(-50%, -50%) rotate(${auraWorld.worldAngle + auraWorld.attachRotate}deg)`,
                  }}
                  draggable={false}
                />

                {/* Layered paper-doll (body→dress→head→arms) when transparent parts exist; else fake 6-slice whole-body fallback */}
                {showLayered ? (
                  <div className={`nk-layered-stack m-motion-${stageMotion}`} aria-hidden="true">
                    <img className="nk-layer m-body" src={layeredUrls.body} alt="" draggable={false} />
                    <img
                      className={`nk-layer m-dress${stageMotion === "equip" ? " m-equip-fade" : ""}`}
                      src={layeredUrls.dress}
                      alt=""
                      draggable={false}
                    />
                    <img className="nk-layer m-head" src={layeredUrls.head} alt="" draggable={false} />
                    <img className="nk-layer m-arms" src={layeredUrls.armsFront} alt="" draggable={false} />
                  </div>
                ) : (
                  <img
                    className="nk-bone-body"
                    src={heroSpriteSrc}
                    alt="雯宝"
                    draggable={false}
                  />
                )}

                {/* Layer 32: 绑定在头部骨骼链上的头饰（随歪头动作同步旋转！） */}
                <img
                  className={`nk-bone-layer m-hair${screen === "rig" && selectedJoint === hairJointId ? " m-editing" : ""}`}
                  src={hairOverlaySrc}
                  alt={currentHairAcc.name}
                  style={{
                    left: `${hairWorld.x}%`,
                    top: `${hairWorld.y}%`,
                    width: `${(hairJointId === "hairSide" ? 22 : 38) * hairWorld.scale}%`,
                    zIndex: 32,
                    transform: `translate(-50%, -50%) rotate(${hairWorld.worldAngle + hairWorld.attachRotate}deg)`,
                  }}
                  onClick={(e) => {
                    if (screen === "rig") {
                      e.stopPropagation();
                      setSelectedJoint(hairJointId);
                    }
                  }}
                  draggable={false}
                />

                {/* Layer 35: 绑定在手部骨骼链上的手持物（随手臂挥动同步旋转位移！） */}
                <img
                  className={`nk-bone-layer m-hand${screen === "rig" && selectedJoint === handJointId ? " m-editing" : ""}`}
                  src={handOverlaySrc}
                  alt={currentHandheld.name}
                  style={{
                    left: `${handWorld.x}%`,
                    top: `${handWorld.y}%`,
                    width: `${26 * handWorld.scale}%`,
                    zIndex: 35,
                    transform: `translate(-50%, -50%) rotate(${handWorld.worldAngle + handWorld.attachRotate}deg)`,
                  }}
                  onClick={(e) => {
                    if (screen === "rig") {
                      e.stopPropagation();
                      setSelectedJoint(handJointId);
                    }
                  }}
                  draggable={false}
                />

                {/* Layer 50: 🦴 Blender / Spine 风格锥形双足人体骨骼棒与精致关节圆环 */}
                {screen === "rig" && (
                  <div className="nk-skeleton-overlay">
                    <svg className="nk-skeleton-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
                      {/* 辅助锁骨/髋部连接线 */}
                      {BONE_LINKS.map(([fromId, toId]) => {
                        const a = worldJoints[fromId];
                        const b = worldJoints[toId];
                        return (
                          <line
                            key={`link-${fromId}-${toId}`}
                            x1={a.x}
                            y1={a.y}
                            x2={b.x}
                            y2={b.y}
                            stroke="rgba(255,255,255,0.55)"
                            strokeWidth="0.6"
                            strokeDasharray="1.5 1.2"
                          />
                        );
                      })}

                      {/* 6 根人体主锥形骨骼棒（脊柱、头部、左臂、右臂、左腿、右腿） */}
                      {HUMANOID_BONES.map((bone) => {
                        const a = worldJoints[bone.from];
                        const b = worldJoints[bone.to];
                        const pts = buildTaperedBonePolygon(a.x, a.y, b.x, b.y, 2.5);
                        const isSel = selectedJoint === bone.to || selectedJoint === bone.from;
                        return (
                          <polygon
                            key={bone.id}
                            points={pts}
                            fill={bone.color}
                            fillOpacity={isSel ? 0.78 : 0.48}
                            stroke="#ffffff"
                            strokeWidth={isSel ? "0.8" : "0.45"}
                          />
                        );
                      })}
                    </svg>

                    {JOINT_LIST.map((meta) => {
                      const wNode = worldJoints[meta.id];
                      const isSel = selectedJoint === meta.id;
                      return (
                        <button
                          key={meta.id}
                          type="button"
                          className={`nk-joint-handle${isSel ? " m-selected" : ""}${meta.isSocket ? " m-socket" : ""}`}
                          style={{
                            left: `${wNode.x}%`,
                            top: `${wNode.y}%`,
                            borderColor: meta.color,
                            background: isSel ? meta.color : "rgba(15, 23, 42, 0.72)",
                          }}
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            e.currentTarget.setPointerCapture(e.pointerId);
                            setSelectedJoint(meta.id);
                            setDraggingJoint(meta.id);
                          }}
                          title={`${meta.label} (${Math.round(wNode.x)}%, ${Math.round(wNode.y)}%)`}
                        >
                          {isSel && <em>{meta.label}</em>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* 舞台底栏：左套装铭牌，右快速切换「🦴骨骼校准」 */}
            <div className="nk-stage-foot">
              <span className="nk-suit-badge">
                {activeSuitInfo.suit
                  ? `✨ ${activeSuitInfo.suit.name} (+${activeSuitInfo.bonusScore})`
                  : `${currentDress.rarity} · ${currentDress.name}`}
              </span>
              <div className="nk-foot-btns">
                <button
                  type="button"
                  className={`nk-collapse-btn${screen === "rig" ? " m-active" : ""}`}
                  onClick={() => setScreen(screen === "rig" ? "wardrobe" : "rig")}
                >
                  {screen === "rig" ? "✓ 完成骨骼校准" : "🦴 骨骼校准"}
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ==================== 画面 3：🦴 双足人体骨骼绑定 (Setup) & 动作摆姿 (Pose) 工作台 ==================== */}
        {screen === "rig" && (
          <section className="nk-panel nk-panel-enter" aria-label="骨骼校准工作台">
            <div className="nk-rig-panel-head">
              <div className="nk-rig-mode-switch">
                <button
                  type="button"
                  className={rigMode === "pose" ? "m-on" : ""}
                  onClick={() => setRigMode("pose")}
                >
                  🎬 动作摆姿 (Pose)
                </button>
                <button
                  type="button"
                  className={rigMode === "setup" ? "m-on" : ""}
                  onClick={() => setRigMode("setup")}
                >
                  🔧 骨骼对位 (Setup)
                </button>
              </div>
              <div className="nk-rig-head-btns">
                <button type="button" className="nk-tuner-reset" onClick={handleCopySkeletonJson}>📋 导出</button>
                <button type="button" className="nk-tuner-reset" onClick={handleResetDressSkeleton}>重置</button>
              </div>
            </div>

            {/* 5 套全身骨骼动作一键预览（含迈腿踏步走、歪头、挥手、欢呼） */}
            {rigMode === "pose" && (
              <div className="nk-anim-clips">
                <span>全身动作：</span>
                {(
                  [
                    ["idle", "🍃 呼吸"],
                    ["tilt", "💖 歪头"],
                    ["wave", "👋 挥手"],
                    ["walk", "🚶 踏步(动腿)"],
                    ["cheer", "🎉 雀跃"],
                  ] as [AnimClipId, string][]
                ).map(([cid, label]) => (
                  <button
                    key={cid}
                    type="button"
                    className={`nk-clip-btn${animClip === cid ? " m-on" : ""}`}
                    onClick={() => setAnimClip(cid)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            <div className="nk-joint-pills">
              {JOINT_LIST.map((j) => (
                <button
                  key={j.id}
                  type="button"
                  className={`nk-joint-pill${selectedJoint === j.id ? " m-on" : ""}`}
                  onClick={() => setSelectedJoint(j.id)}
                >
                  <i style={{ background: j.color }} />
                  <span>{j.label}</span>
                </button>
              ))}
            </div>

            {activeJointNode && (
              <div className="nk-tuner-sliders">
                <label>
                  <span>骨骼旋转 ({activeJointNode.poseRotate}°)</span>
                  <input
                    type="range"
                    min={-60}
                    max={60}
                    value={activeJointNode.poseRotate}
                    onChange={(e) => handleSelectedJointScaleRotate({ poseRotate: Number(e.target.value) })}
                  />
                </label>
                <label>
                  <span>插槽缩放 ({Math.round(activeJointNode.scale * 100)}%)</span>
                  <input
                    type="range"
                    min={45}
                    max={180}
                    value={Math.round(activeJointNode.scale * 100)}
                    onChange={(e) => handleSelectedJointScaleRotate({ scale: Number(e.target.value) / 100 })}
                  />
                </label>
                <label>
                  <span>关节 X ({Math.round(activeJointNode.x)}%)</span>
                  <input
                    type="range"
                    min={5}
                    max={95}
                    value={activeJointNode.x}
                    onChange={(e) => {
                      const nx = Number(e.target.value);
                      setNikki((prev) => {
                        const cur = getSkeletonForDress(currentDress.id, prev.dressSkeletons);
                        return {
                          ...prev,
                          dressSkeletons: {
                            ...(prev.dressSkeletons || {}),
                            [currentDress.id]: moveJointCascade(cur, selectedJoint, nx, activeJointNode.y),
                          },
                        };
                      });
                    }}
                  />
                </label>
                <label>
                  <span>关节 Y ({Math.round(activeJointNode.y)}%)</span>
                  <input
                    type="range"
                    min={5}
                    max={95}
                    value={activeJointNode.y}
                    onChange={(e) => {
                      const ny = Number(e.target.value);
                      setNikki((prev) => {
                        const cur = getSkeletonForDress(currentDress.id, prev.dressSkeletons);
                        return {
                          ...prev,
                          dressSkeletons: {
                            ...(prev.dressSkeletons || {}),
                            [currentDress.id]: moveJointCascade(cur, selectedJoint, activeJointNode.x, ny),
                          },
                        };
                      });
                    }}
                  />
                </label>
              </div>
            )}
          </section>
        )}

        {/* ==================== 画面 4：高定换装衣橱 ==================== */}
        {screen === "world" && (
          <WorldScreen
            room={state.world.room}
            onEnterRoom={(room) => enterRoom(room)}
            onPropAction={(prop: RoomProp) => {
              const res = runProp(prop);
              return res ? { line: res.line, tone: res.tone } : null;
            }}
            onBack={() => setScreen("lobby")}
          />
        )}

        {screen === "wardrobe" && (
          <WardrobeScreen
            nikki={nikki}
            activeSlot={activeSlot}
            inspectedItem={inspectedItem}
            inspectedStars={inspectedStars}
            inspectedOwned={inspectedOwned}
            slotItems={slotItems}
            unlockedSet={unlockedSet}
            cutoutMap={cutoutMap}
            itemImage={itemImage}
            onSelectSlot={(slot) => {
              setActiveSlot(slot);
              setInspectedItemId(nikki.equipped[slot]);
            }}
            onSelectOrEquip={handleSelectOrEquipItem}
            onUpgradeOrCraft={handleUpgradeOrCraftItem}
          />
        )}

        {screen === "stages" && (
          <StagesScreen
            nikki={nikki}
            selectedStage={selectedStage}
            selectedSkills={selectedSkills}
            livePreviewEval={livePreviewEval}
            selectedStageOpen={selectedStageOpen}
            onSelectStage={setSelectedStageId}
            onToggleSkill={handleToggleSkill}
            onAutoRecommend={handleAutoRecommend}
            onStartEval={handleStartStylingEval}
          />
        )}

        {/* ==================== 画面 6：星愿幻阁 + 官方 Qwen 编辑工坊 ==================== */}
        {screen === "pavilion" && (
          <section className="nk-pavilion nk-panel-enter" aria-label="星愿幻阁">
            <div className="nk-pavilion-veil" />
            <div className="nk-pavilion-body">
              <header className="nk-pavilion-top">
                <h2>星愿幻阁</h2>
                <span>{nikki.coupons} 礼券</span>
              </header>
              <div
                className="nk-wish-carousel"
                onKeyDown={(event) => {
                  if (event.key === "ArrowLeft") {
                    event.preventDefault();
                    stepWishPool(-1);
                  } else if (event.key === "ArrowRight") {
                    event.preventDefault();
                    stepWishPool(1);
                  }
                }}
              >
                <div className="nk-wish-deck">
                <button
                  type="button"
                  className="nk-wish-arrow"
                  aria-label="上一类"
                  disabled={wishPool === WISH_POOLS[0].id}
                  onClick={() => stepWishPool(-1)}
                >
                  ‹
                </button>
                <div
                  ref={wishRailRef}
                  className="nk-wish-rail"
                  role="tablist"
                  aria-label="许愿分类"
                  onPointerDown={(event) => {
                    if (event.button !== 0) return;
                    const rail = wishRailRef.current;
                    if (!rail) return;
                    cancelAnimationFrame(wishGlide.current);
                    rail.classList.add("m-drag");
                    wishDrag.current = {
                      x: event.clientX,
                      scroll: rail.scrollLeft,
                      moved: false,
                      lastT: performance.now(),
                      lastScroll: rail.scrollLeft,
                      velocity: 0,
                    };
                    rail.setPointerCapture(event.pointerId);
                  }}
                  onPointerMove={(event) => {
                    const drag = wishDrag.current;
                    const rail = wishRailRef.current;
                    if (!drag || !rail) return;
                    const dx = event.clientX - drag.x;
                    if (Math.abs(dx) > 4) drag.moved = true;
                    if (!drag.moved) return;
                    const now = performance.now();
                    const nextScroll = drag.scroll - dx;
                    const dt = Math.max(8, now - drag.lastT);
                    const instant = (nextScroll - drag.lastScroll) / dt;
                    drag.velocity = drag.velocity * 0.65 + instant * 0.35;
                    drag.lastT = now;
                    drag.lastScroll = nextScroll;
                    rail.scrollLeft = nextScroll;
                    paintWishScales();
                  }}
                  onPointerUp={() => {
                    const drag = wishDrag.current;
                    const rail = wishRailRef.current;
                    wishDrag.current = null;
                    if (!rail) return;
                    if (!drag?.moved) {
                      rail.classList.remove("m-drag");
                      return;
                    }
                    wishSuppressClick.current = true;
                    const stride = rail.querySelector<HTMLElement>("[data-pool]")?.offsetWidth ?? 280;
                    const coast = Math.max(-stride * 0.85, Math.min(stride * 0.85, drag.velocity * 180));
                    glideWishTo(nearestWishPool(rail.scrollLeft + coast));
                  }}
                  onPointerCancel={() => {
                    const rail = wishRailRef.current;
                    wishDrag.current = null;
                    if (!rail) return;
                    glideWishTo(nearestWishPool(rail.scrollLeft));
                  }}
                  onClickCapture={(event) => {
                    if (!wishSuppressClick.current) return;
                    wishSuppressClick.current = false;
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                >
                  {WISH_POOLS.map((pool) => {
                    const faces = showcaseForWishPool(pool.id);
                    const [hero, ...sides] = faces;
                    const count = WARDROBE_ITEMS.filter((item) => pool.slots.includes(item.slot)).length;
                    return (
                      <button
                        key={pool.id}
                        type="button"
                        role="tab"
                        data-pool={pool.id}
                        aria-selected={wishPool === pool.id}
                        className={`nk-wish-banner${wishPool === pool.id ? " m-on" : ""}`}
                        onClick={() => glideWishTo(pool.id)}
                      >
                        {hero && <img className="m-hero" src={itemImage(hero)} alt="" draggable={false} />}
                        {sides.map((item, index) => (
                          <img
                            key={item.id}
                            className={`nk-wish-side m-${index === 0 ? "a" : "b"}`}
                            src={itemImage(item)}
                            alt=""
                            draggable={false}
                          />
                        ))}
                        <footer>
                          <strong>{pool.label}</strong>
                          <small>
                            {count} 件 · {pool.line}
                          </small>
                        </footer>
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  className="nk-wish-arrow m-next"
                  aria-label="下一类"
                  disabled={wishPool === WISH_POOLS[WISH_POOLS.length - 1].id}
                  onClick={() => stepWishPool(1)}
                >
                  ›
                </button>
                </div>
                <div className="nk-wish-dots">
                  {WISH_POOLS.map((pool) => (
                    <button
                      key={pool.id}
                      type="button"
                      className={wishPool === pool.id ? "m-on" : ""}
                      aria-label={pool.label}
                      aria-pressed={wishPool === pool.id}
                      onClick={() => glideWishTo(pool.id)}
                    />
                  ))}
                </div>
              </div>

              {wishPhase === "idle" && gachaResults && (
                <div className="nk-pavilion-last">
                  {gachaResults.map((res, idx) => (
                    <img
                      key={`${res.item.id}-${idx}`}
                      src={itemImage(res.item)}
                      alt={res.item.name}
                      className={`m-${res.item.rarity}`}
                    />
                  ))}
                </div>
              )}

              <div className="nk-pavilion-actions">
                <button type="button" className="nk-draw-btn" onClick={() => handlePavilionDraw(1)} disabled={wishPhase !== "idle"}>
                  <strong>许愿 1 次</strong>
                  <small>5 礼券</small>
                </button>
                <button type="button" className="nk-draw-btn m-multi" onClick={() => handlePavilionDraw(5)} disabled={wishPhase !== "idle"}>
                  <strong>许愿 5 连</strong>
                  <small>20 礼券</small>
                </button>
              </div>

              <button type="button" className="nk-pavilion-atelier" onClick={() => setShowAtelier((open) => !open)}>
                {showAtelier ? "收起裁缝铺" : "裁缝铺"}
              </button>
            </div>

            {wishPhase !== "idle" && gachaResults && (
              <div
                className={`nk-wish-overlay${wishPhase === "charge" ? " m-charge" : ` m-${gachaResults[Math.max(0, revealedPulls - 1)]?.item.rarity ?? "back"}`}`}
                role="dialog"
                aria-modal="true"
                aria-label="星愿揭晓"
              >
                <i
                  key={`rays-${revealedPulls}`}
                  className="nk-wish-rays"
                  aria-hidden="true"
                />
                <i key={`flash-${revealedPulls}`} className="nk-wish-flash" aria-hidden="true" />
                <div className="nk-wish-stage">
                  {wishPhase === "charge" ? (
                    <div className="nk-wish-charge">
                      <i className="nk-wish-orb" />
                      <p>星愿落下</p>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        key={revealedPulls}
                        className={`nk-wish-focus${revealedPulls > 0 ? ` m-open m-${gachaResults[revealedPulls - 1].item.rarity}` : " m-back"}`}
                        onClick={() => {
                          if (revealedPulls >= gachaResults.length) {
                            window.clearTimeout(wishTimer.current);
                            setWishPhase("idle");
                            return;
                          }
                          setRevealedPulls((count) => count + 1);
                        }}
                      >
                        {revealedPulls > 0 ? (
                          <>
                            <img src={itemImage(gachaResults[revealedPulls - 1].item)} alt="" />
                            <b>{gachaResults[revealedPulls - 1].item.rarity}</b>
                            <span>
                              {gachaResults[revealedPulls - 1].isNew
                                ? gachaResults[revealedPulls - 1].item.name
                                : `升至 ★${gachaResults[revealedPulls - 1].newStarLevel}`}
                            </span>
                          </>
                        ) : (
                          <i />
                        )}
                      </button>
                      <div className="nk-wish-film" aria-hidden="true">
                        {gachaResults.map((res, idx) => (
                          <em key={`${res.item.id}-${idx}`} className={idx < revealedPulls ? `m-on m-${res.item.rarity}` : ""} />
                        ))}
                      </div>
                      <button
                        type="button"
                        className="nk-wish-take"
                        onClick={() => {
                          window.clearTimeout(wishTimer.current);
                          if (revealedPulls < gachaResults.length) {
                            setRevealedPulls((count) => count + 1);
                            return;
                          }
                          setWishPhase("idle");
                        }}
                      >
                        {revealedPulls < gachaResults.length ? "下一张" : "收下"}
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            {showAtelier && (
              <div className="nk-comfy-box">
                <div className="nk-comfy-head">
                  <strong>为【{inspectedItem.name}】重绘卡面</strong>
                </div>
                <div className="nk-comfy-row">
                  <input
                    type="text"
                    value={comfyPrompt}
                    onChange={(e) => setComfyPrompt(e.target.value)}
                    placeholder="描述视角或姿势（只改这些，保持同一角色和白 T 白短裤）"
                    disabled={comfyBusy}
                  />
                  <button type="button" disabled={comfyBusy} onClick={() => void handleLiveComfyGenerate()}>
                    {comfyBusy ? "绘制中" : "绘制"}
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {screen === "codex" && (
          <CodexScreen nikki={nikki} unlockedSet={unlockedSet} itemImage={itemImage} />
        )}

        {screen === "chat" && (
          <ChatScreen
            activeSkinAvatar={activeSkin.avatar}
            companionConn={companionConn}
            chatHistory={chatHistory}
            chatBusy={chatBusy}
            chatInput={chatInput}
            onChatInputChange={setChatInput}
            onSendChat={(text) => void handleSendChat(text)}
          />
        )}

      </main>

      {/* 底部 5 项核心导航 */}
      <nav className="nk-nav" aria-label="主导航">
        <button
          type="button"
          className={screen === "lobby" ? "m-active" : ""}
          onClick={() => setScreen("lobby")}
        >
          <span>🏠</span>
          <small>主大厅</small>
        </button>
        <button
          type="button"
          className={screen === "world" ? "m-active" : ""}
          onClick={() => setScreen("world")}
        >
          <span>🏡</span>
          <small>小世界</small>
        </button>
        <button
          type="button"
          className={screen === "wardrobe" || screen === "rig" ? "m-active" : ""}
          onClick={() => setScreen("wardrobe")}
        >
          <span>👗</span>
          <small>高定衣橱</small>
        </button>
        <button
          type="button"
          className={screen === "stages" ? "m-active" : ""}
          onClick={() => setScreen("stages")}
        >
          <span>👑</span>
          <small>搭配闯关</small>
        </button>
        <button
          type="button"
          className={screen === "pavilion" ? "m-active" : ""}
          onClick={() => setScreen("pavilion")}
        >
          <span>✨</span>
          <small>星愿幻阁</small>
        </button>
        <button
          type="button"
          className={screen === "codex" ? "m-active" : ""}
          onClick={() => setScreen("codex")}
        >
          <span>📖</span>
          <small>原画 ({collectionPercent}%)</small>
        </button>
      </nav>
    </div>
  );
}
