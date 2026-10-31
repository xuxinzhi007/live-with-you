import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWorldGame } from "./world/useWorldGame";
import {
  DEFAULT_EQUIPPED_OUTFIT,
  DEFAULT_UNLOCKED_ITEM_IDS,
  SLOT_META,
  STYLE_ATTR_LABELS,
  STYLING_SKILLS,
  STYLING_STAGES,
  SUIT_DEFS,
  WARDROBE_ITEMS,
  WARDROBE_SLOTS,
  computeOutfitStats,
  detectActiveSuit,
  evaluateOutfitForStage,
  getWardrobeItem,
  recommendBestOutfitForStage,
  rollPavilionGacha,
  type EquippedOutfit,
  type OutfitEvaluation,
  type PavilionPullItem,
  type StyleAttr,
  type StylingSkill,
  type StylingStage,
  type WardrobeItem,
  type WardrobeSlot,
} from "./world/nikki-wardrobe";
import {
  getWearableOverlaySrc,
  loadCutoutImage,
} from "./world/paper-doll-rig";
import {
  BONE_LINKS,
  HUMANOID_BONES,
  JOINT_LIST,
  buildTaperedBonePolygon,
  computeHumanoidPartSlices,
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
  probeCompanionStatus,
  sendCompanionChatMessage,
  type ChatTurn,
  type CompanionConnection,
} from "./world/companion-bridge";
import { getCharacterSkin } from "./world/skins";
import "./world.css";

/**
 * 正规手游场景流（Screen State Machine）：
 * - "title"    : 游戏启动封面页（Logo + 动态看板娘 + 点击开始游戏）
 * - "lobby"    : 纯净主大厅（中间 85% 纯净全身展示，不堆叠任何衣橱列表或削头顶横幅）
 * - "wardrobe" : 高定换装试衣间（上半全身试衣镜 + 下半轻巧衣橱）
 * - "rig"      : 🦴 可视化骨骼工作台（在角色身上直接显示骨骼杆与关节圆环，按住关节直接拖动校准！）
 * - "stages"   : 主题搭配闯关页
 * - "pavilion" : 星愿幻阁 & ComfyUI 实时生图工坊
 * - "codex"    : 典藏套装与原画图鉴
 * - "chat"     : 和雯宝私语
 */
type GameScreen = "title" | "lobby" | "wardrobe" | "rig" | "stages" | "pavilion" | "codex" | "chat";

const WARDROBE_STORAGE_KEY = "wenbebi-nikki-wardrobe-v8";

interface SavedNikkiState {
  equipped: EquippedOutfit;
  unlockedIds: string[];
  itemStars: Record<string, number>;
  clearedStages: Record<string, string>;
  coupons: number;
  customImages?: Record<string, string>;
  dressSkeletons?: AllDressSkeletons;
}

function loadNikkiState(): SavedNikkiState {
  try {
    const raw =
      localStorage.getItem(WARDROBE_STORAGE_KEY) ||
      localStorage.getItem("wenbebi-nikki-wardrobe-v6") ||
      localStorage.getItem("wenbebi-nikki-wardrobe-v4");
    if (!raw) {
      return {
        equipped: { ...DEFAULT_EQUIPPED_OUTFIT },
        unlockedIds: [...DEFAULT_UNLOCKED_ITEM_IDS],
        itemStars: {},
        clearedStages: {},
        coupons: 40,
        customImages: {},
        dressSkeletons: {},
      };
    }
    const parsed = JSON.parse(raw);
    return {
      equipped: { ...DEFAULT_EQUIPPED_OUTFIT, ...(parsed.equipped || {}) },
      unlockedIds: Array.from(new Set([...DEFAULT_UNLOCKED_ITEM_IDS, ...(parsed.unlockedIds || [])])),
      itemStars: parsed.itemStars || {},
      clearedStages: parsed.clearedStages || {},
      coupons: typeof parsed.coupons === "number" ? parsed.coupons : 40,
      customImages: parsed.customImages || {},
      dressSkeletons: parsed.dressSkeletons || {},
    };
  } catch {
    return {
      equipped: { ...DEFAULT_EQUIPPED_OUTFIT },
      unlockedIds: [...DEFAULT_UNLOCKED_ITEM_IDS],
      itemStars: {},
      clearedStages: {},
      coupons: 40,
      customImages: {},
      dressSkeletons: {},
    };
  }
}

function saveNikkiState(data: SavedNikkiState) {
  try {
    localStorage.setItem(WARDROBE_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore quota error
  }
}

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
  const { state, setSkin, companionAct } = useWorldGame();
  const [nikki, setNikki] = useState<SavedNikkiState>(loadNikkiState);
  const [screen, setScreen] = useState<GameScreen>("title");
  const [activeSlot, setActiveSlot] = useState<WardrobeSlot>("dress");
  const [selectedStageId, setSelectedStageId] = useState<string>(STYLING_STAGES[0].id);
  const [inspectedItemId, setInspectedItemId] = useState<string>(DEFAULT_EQUIPPED_OUTFIT.dress);
  const [selectedSkills, setSelectedSkills] = useState<StylingSkill["id"][]>(["smile", "charm"]);

  // 骨骼校准工作台：Setup 绑定对位模式 vs Pose 动作摆姿模式 + 全身骨骼动画播放器
  const [rigMode, setRigMode] = useState<"setup" | "pose">("pose");
  const [animClip, setAnimClip] = useState<AnimClipId>("idle");
  const [animTime, setAnimTime] = useState(0);
  const [selectedJoint, setSelectedJoint] = useState<JointId>("head");
  const [draggingJoint, setDraggingJoint] = useState<JointId | null>(null);
  const boneBoxRef = useRef<HTMLDivElement>(null);

  const [cutoutMap, setCutoutMap] = useState<Record<string, string>>({});
  const [breatheIdx, setBreatheIdx] = useState(0);
  const [reacting, setReacting] = useState(false);
  const [equipBurstKey, setEquipBurstKey] = useState(0);
  const [lobbyLine, setLobbyLine] = useState("「欢迎回来～点右边『换装』试新裙子，或点『骨骼』直接拖动关节点位哦！」");

  // PK 走秀动态滚分演出状态
  const [evalModal, setEvalModal] = useState<{
    evalResult: OutfitEvaluation;
    coinsGained: number;
    bonusUnlockedItem: WardrobeItem | null;
  } | null>(null);
  const [rollingScore, setRollingScore] = useState(0);
  const [showStamp, setShowStamp] = useState(false);

  const [gachaResults, setGachaResults] = useState<PavilionPullItem[] | null>(null);
  const [comfyPrompt, setComfyPrompt] = useState("wearing a pastel pink sakura dress with white lace ribbon");
  const [comfyBusy, setComfyBusy] = useState(false);

  const [toast, setToast] = useState<string | null>(null);
  const [popups, setPopups] = useState<{ id: number; text: string }[]>([]);

  const [companionConn, setCompanionConn] = useState<CompanionConnection | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatTurn[]>([
    {
      role: "assistant",
      content: "欢迎来到高定搭配工坊～每套生成的衣服现在都有自己独立的骨骼树，进入『🦴 骨骼』模式可以直接按住我身上的关节点拖动微调哦！",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const popupIdRef = useRef(1);

  useEffect(() => {
    saveNikkiState(nikki);
  }, [nikki]);

  useEffect(() => {
    const timer = setInterval(() => {
      setBreatheIdx((i) => (i + 1) % 4);
    }, 520);
    return () => clearInterval(timer);
  }, []);

  // 30FPS 驱动全身双足 FK 骨骼动画（呼吸/歪头/挥手/踏步走/欢呼）
  useEffect(() => {
    if (screen === "rig" && rigMode === "setup") return;
    let raf = 0;
    const t0 = performance.now();
    const loop = (now: number) => {
      setAnimTime((now - t0) / 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [rigMode, screen]);

  useEffect(() => {
    void probeCompanionStatus().then(setCompanionConn);
  }, []);

  const currentDress = useMemo(() => getWardrobeItem(nikki.equipped.dress), [nikki.equipped.dress]);
  const currentHairAcc = useMemo(() => getWardrobeItem(nikki.equipped.hairAcc), [nikki.equipped.hairAcc]);
  const currentHandheld = useMemo(() => getWardrobeItem(nikki.equipped.handheld), [nikki.equipped.handheld]);
  const currentAura = useMemo(() => getWardrobeItem(nikki.equipped.aura), [nikki.equipped.aura]);
  const currentCard = useMemo(() => getWardrobeItem(nikki.equipped.memoryCard), [nikki.equipped.memoryCard]);

  // 当前所穿服装的专属层级骨骼树（每套衣服独立保存！）
  const activeSkeleton = useMemo(
    () => getSkeletonForDress(currentDress.id, nikki.dressSkeletons),
    [currentDress.id, nikki.dressSkeletons],
  );

  const itemImage = useCallback(
    (item: WardrobeItem) => nikki.customImages?.[item.id] || item.image,
    [nikki.customImages],
  );

  // 自动将当前穿戴的礼服进行防过度透明抠图并对齐到 760×760 骨骼画布
  useEffect(() => {
    let active = true;
    const src = itemImage(currentDress);
    void loadCutoutImage(src, "character").then((dataUrl) => {
      if (!active) return;
      setCutoutMap((prev) => (prev[currentDress.id] === dataUrl ? prev : { ...prev, [currentDress.id]: dataUrl }));
    });
    return () => {
      active = false;
    };
  }, [currentDress, itemImage]);

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

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const pushPopup = useCallback((text: string) => {
    const id = popupIdRef.current++;
    setPopups((prev) => [...prev.slice(-3), { id, text }]);
    setTimeout(() => {
      setPopups((prev) => prev.filter((p) => p.id !== id));
    }, 1350);
  }, []);

  const unlockedSet = useMemo(() => new Set(nikki.unlockedIds), [nikki.unlockedIds]);
  const bondInfo = useMemo(() => getBondLevelInfo(state.bond), [state.bond]);

  const inspectedItem = useMemo(() => getWardrobeItem(inspectedItemId), [inspectedItemId]);
  const activeSuitInfo = useMemo(() => detectActiveSuit(nikki.equipped), [nikki.equipped]);

  const activeSkin = useMemo(
    () => getCharacterSkin(currentDress.skinId ?? "original"),
    [currentDress.skinId],
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

  const partSlices = useMemo(
    () => computeHumanoidPartSlices(activeSkeleton, worldJoints, currentAnimOffsets),
    [activeSkeleton, currentAnimOffsets, worldJoints],
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
    setReacting(true);
    setTimeout(() => setReacting(false), 680);
    pushPopup(`✨ 穿戴：${item.name}`);
  }, [pushPopup, setSkin, showToast, unlockedSet]);

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
      companionAct("giftFlower", false);
      pushPopup(`🎉 成功定制并穿戴 ${item.name}！`);
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
    setReacting(true);
    setTimeout(() => setReacting(false), 680);
    pushPopup(`⭐ ${item.name} 升至 ★${currentStar + 1}`);
  }, [companionAct, nikki.coupons, nikki.itemStars, pushPopup, setSkin, showToast, unlockedSet]);

  const handleLiveComfyGenerate = useCallback(async () => {
    if (comfyBusy) return;
    setComfyBusy(true);
    const isDress = inspectedItem.slot === "dress";
    showToast("🎨 正在调用本机 ComfyUI + 雯宝 LoRA 生成同角色立绘并自动对齐 760×760 骨骼画布…");
    try {
      const res = await fetch("/api/comfy/draw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: comfyPrompt,
          useWenbaoLora: isDress,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload?.ok || !payload?.image) {
        throw new Error(payload?.error || "ComfyUI 生图失败");
      }
      const cutoutUrl = await loadCutoutImage(payload.image, isDress ? "character" : "accessory");
      setCutoutMap((prev) => ({ ...prev, [inspectedItem.id]: cutoutUrl }));
      setNikki((prev) => ({
        ...prev,
        customImages: { ...(prev.customImages || {}), [inspectedItem.id]: cutoutUrl },
      }));
      setEquipBurstKey((k) => k + 1);
      pushPopup(`🎨 新生成的【${inspectedItem.name}】已绑定骨骼！可点『🦴骨骼』微调关节`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "请确认本机 ComfyUI (127.0.0.1:8188) 正在运行");
    } finally {
      setComfyBusy(false);
    }
  }, [comfyBusy, comfyPrompt, inspectedItem.id, inspectedItem.name, inspectedItem.slot, pushPopup, showToast]);

  const handleTapCharacter = useCallback(() => {
    if (screen === "rig") return;
    const res = companionAct("pat", false);
    setNikki((prev) => ({ ...prev, coupons: prev.coupons + 2 }));
    setEquipBurstKey((k) => k + 1);
    setReacting(true);
    setTimeout(() => setReacting(false), 720);
    const lines = [
      `「今天穿的是【${currentDress.name}】，头饰和手持物都牢牢绑在我的骨骼点上啦！」`,
      "「如果新生成的衣服高矮不同，点右边的『🦴骨骼』就能直接拖动我身上的关节点对位哦～」",
      `「当前搭配总魅力已经达到 ${totalCharmPower} 分啦！」`,
    ];
    setLobbyLine(lines[Math.floor(Math.random() * lines.length)]);
    pushPopup(`+${res.bondGained} 亲密 · +2 礼券`);
  }, [companionAct, currentDress.name, pushPopup, screen, totalCharmPower]);

  const handleAutoRecommend = useCallback((stage: StylingStage) => {
    const best = recommendBestOutfitForStage(stage, unlockedSet, nikki.itemStars);
    setNikki((prev) => ({ ...prev, equipped: best }));
    const dress = getWardrobeItem(best.dress);
    if (dress.skinId) setSkin(dress.skinId);
    setInspectedItemId(best.dress);
    setEquipBurstKey((k) => k + 1);
    setReacting(true);
    setTimeout(() => setReacting(false), 680);
    showToast(`💡 已一键换上【${STYLE_ATTR_LABELS[stage.primaryAttr].name}·${STYLE_ATTR_LABELS[stage.secondaryAttr].name}】最优搭配！`);
  }, [nikki.itemStars, setSkin, showToast, unlockedSet]);

  const handleToggleSkill = useCallback((skId: StylingSkill["id"]) => {
    setSelectedSkills((prev) => {
      if (prev.includes(skId)) {
        return prev.length > 1 ? prev.filter((id) => id !== skId) : prev;
      }
      return [...prev.slice(-1), skId];
    });
  }, []);

  const handleStartStylingEval = useCallback((stage: StylingStage) => {
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

    setNikki((prev) => ({
      ...prev,
      coupons: prev.coupons + coinsGained,
      unlockedIds: Array.from(nextUnlocked),
      clearedStages: { ...prev.clearedStages, [stage.id]: bestRank },
    }));

    companionAct(evalResult.passedS ? "giftFlower" : "snack", evalResult.rank === "SSS");

    setEvalModal({
      evalResult,
      coinsGained,
      bonusUnlockedItem,
    });
  }, [companionAct, nikki.clearedStages, nikki.equipped, nikki.itemStars, nikki.unlockedIds, selectedSkills]);

  const handlePavilionDraw = useCallback((count: 1 | 5) => {
    const cost = count === 5 ? 20 : 5;
    if (nikki.coupons < cost) {
      showToast(`许愿 ${count} 次需要 ${cost} 礼券（当前 ${nikki.coupons}）！`);
      return;
    }
    const res = rollPavilionGacha(count, unlockedSet, nikki.itemStars);
    setNikki((prev) => ({
      ...prev,
      coupons: prev.coupons - cost,
      unlockedIds: res.nextUnlockedIds,
      itemStars: res.nextStars,
    }));
    companionAct("pat", count === 5);
    setGachaResults(res.pulls);
    setEquipBurstKey((k) => k + 1);
    setReacting(true);
    setTimeout(() => setReacting(false), 800);
    pushPopup(`✨ 幻阁抽取 ×${count} · +${res.bondGained} 亲密`);
  }, [companionAct, nikki.coupons, nikki.itemStars, pushPopup, showToast, unlockedSet]);

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

  const isComfyDress = currentDress.image.startsWith("assets/nikki/dress-");
  const customDressImg = nikki.customImages?.[currentDress.id];
  const heroSpriteSrc = customDressImg
    ? customDressImg
    : isComfyDress
      ? cutoutMap[currentDress.id] || currentDress.image
      : reacting
        ? activeSkin.react
        : activeSkin.breathe[breatheIdx % activeSkin.breathe.length] || activeSkin.idle;

  const collectionPercent = Math.round((nikki.unlockedIds.length / WARDROBE_ITEMS.length) * 100);
  const inspectedOwned = unlockedSet.has(inspectedItem.id);
  const inspectedStars = nikki.itemStars[inspectedItem.id] ?? 1;
  const activeJointNode = activeSkeleton[selectedJoint];

  /* ==================== 画面 1：正规手游启动封面页 (Title Screen) ==================== */
  if (screen === "title") {
    return (
      <div id="nikki-root" className="nk-title-screen" onClick={() => setScreen("lobby")}>
        <div
          className="nk-title-bg"
          style={{ backgroundImage: `url(${itemImage(currentCard) || "assets/nikki/card-starlight-waltz.png"})` }}
          aria-hidden="true"
        />
        <div className="nk-sparkles" aria-hidden="true">
          <i className="s1" /><i className="s2" /><i className="s3" /><i className="s4" /><i className="s5" />
        </div>

        <div className="nk-title-top">
          <span className="nk-title-ver">VER 8.0 · LIVE WITH WENBAO</span>
        </div>

        <div className="nk-title-hero">
          <img src={heroSpriteSrc} alt="雯宝" draggable={false} />
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
              style={{ backgroundImage: `url(${itemImage(currentCard) || currentDress.bgScene || "assets/scenes/home.webp"})` }}
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
              key={`${currentDress.id}-${equipBurstKey}`}
              className={`nk-paperdoll-rig nk-anim-enter${reacting ? " m-bounce" : ""}${screen === "rig" ? " m-rig-mode" : ""}`}
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

                {/* Layer 16~24: 6 层人体部位切片蒙皮（LegL 左腿 / LegR 右腿 / ArmL 左臂 / Torso 躯干 / ArmR 右臂 / Head 头部）各自绕骨骼枢轴独立旋转！ */}
                {partSlices.map((slice) => (
                  <img
                    key={slice.part}
                    className={`nk-bone-body m-part-${slice.part}`}
                    src={heroSpriteSrc}
                    alt=""
                    style={{
                      zIndex: slice.zIndex,
                      clipPath: slice.clipPath,
                      transformOrigin: `${slice.originX}% ${slice.originY}%`,
                      transform: `translateY(${slice.ty}%) rotate(${slice.angle}deg)`,
                    }}
                    draggable={false}
                  />
                ))}

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
        {screen === "wardrobe" && (
          <section className="nk-panel nk-panel-enter" aria-label="换装衣橱">
            <div className="nk-slot-tabs" role="tablist">
              {WARDROBE_SLOTS.map((slot) => {
                const meta = SLOT_META[slot];
                const active = activeSlot === slot;
                return (
                  <button
                    key={slot}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    className={`nk-slot-tab${active ? " m-active" : ""}`}
                    onClick={() => {
                      setActiveSlot(slot);
                      setInspectedItemId(nikki.equipped[slot]);
                    }}
                  >
                    <span>{meta.icon}</span>
                    <b>{meta.short}</b>
                  </button>
                );
              })}
            </div>

            <div className="nk-slim-bar">
              <div className="nk-slim-info">
                <span className={`nk-rarity-badge m-${inspectedItem.rarity}`}>{inspectedItem.rarity}</span>
                <strong>{inspectedItem.name}</strong>
                <span className="nk-item-stars">{"★".repeat(inspectedStars)}</span>
                <small>
                  {STYLE_ATTR_LABELS[inspectedItem.mainTag].name}+{inspectedItem.stats[inspectedItem.mainTag]} ·{" "}
                  {inspectedItem.skillName || `${STYLE_ATTR_LABELS[inspectedItem.subTag].name}+${inspectedItem.stats[inspectedItem.subTag]}`}
                </small>
              </div>
              <button
                type="button"
                className={`nk-slim-btn${inspectedOwned ? "" : " m-craft"}`}
                onClick={() => handleUpgradeOrCraftItem(inspectedItem)}
              >
                {inspectedOwned
                  ? inspectedStars < 5
                    ? `⭐ 升星 (${inspectedStars * 8}券)`
                    : "✨ 已满星"
                  : `🔨 定制 (${inspectedItem.rarity === "SSR" ? 28 : inspectedItem.rarity === "SR" ? 16 : 10}券)`}
              </button>
            </div>

            <div className="nk-carousel">
              {slotItems.map((item) => {
                const owned = unlockedSet.has(item.id);
                const isEquipped = nikki.equipped[item.slot] === item.id;
                const isInspected = inspectedItem.id === item.id;
                const stars = nikki.itemStars[item.id] ?? 1;
                const mainMeta = STYLE_ATTR_LABELS[item.mainTag];
                const subMeta = STYLE_ATTR_LABELS[item.subTag];

                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`nk-art-card m-rarity-${item.rarity}${isEquipped ? " m-equipped" : ""}${isInspected ? " m-selected" : ""}${!owned ? " m-locked" : ""}`}
                    onClick={() => handleSelectOrEquipItem(item)}
                  >
                    <img
                      className="nk-art-img"
                      src={cutoutMap[item.id] || itemImage(item)}
                      alt={item.name}
                      draggable={false}
                    />
                    {item.rarity === "SSR" && <i className="nk-foil-shimmer" aria-hidden="true" />}

                    <div className="nk-art-top">
                      <span className={`nk-rarity-badge m-${item.rarity}`}>{item.rarity}</span>
                      {isEquipped ? (
                        <span className="nk-equipped-pill">穿戴</span>
                      ) : (
                        <span className="nk-art-stars">{"★".repeat(stars)}</span>
                      )}
                    </div>

                    {!owned && <span className="nk-art-lock">🔒 未解锁</span>}

                    <div className="nk-art-footer">
                      <strong className="nk-art-name">{item.name}</strong>
                      <div className="nk-art-tags">
                        <span style={{ background: mainMeta.tagBg, color: mainMeta.color }}>{mainMeta.name}</span>
                        <span style={{ background: subMeta.tagBg, color: subMeta.color }}>{subMeta.name}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* ==================== 画面 5：主题出行搭配闯关 ==================== */}
        {screen === "stages" && (
          <section className="nk-panel nk-panel-enter" aria-label="主题搭配闯关">
            <div className="nk-stage-selector">
              {STYLING_STAGES.map((st) => {
                const active = st.id === selectedStage.id;
                const bestRank = nikki.clearedStages[st.id];
                return (
                  <button
                    key={st.id}
                    type="button"
                    className={`nk-stage-pill${active ? " m-active" : ""}`}
                    onClick={() => setSelectedStageId(st.id)}
                  >
                    <span>{st.chapter}</span>
                    {bestRank && <b className={`nk-rank-mini m-${bestRank}`}>{bestRank}</b>}
                  </button>
                );
              })}
            </div>

            <div className="nk-stage-detail">
              <div className="nk-stage-head">
                <span className="nk-stage-ic">{selectedStage.icon}</span>
                <div className="nk-stage-title-box">
                  <div className="nk-stage-vs-line">
                    <h3>{selectedStage.chapter} · {selectedStage.title}</h3>
                    <span className="nk-rival-tag">对手: {selectedStage.rivalName} ({selectedStage.rivalScore})</span>
                  </div>
                  <p>{selectedStage.desc}</p>
                </div>
              </div>

              <div className="nk-skill-picker">
                <span className="nk-skill-label">技能(2项)：</span>
                {STYLING_SKILLS.map((sk) => {
                  const chosen = selectedSkills.includes(sk.id);
                  return (
                    <button
                      key={sk.id}
                      type="button"
                      className={`nk-skill-chip${chosen ? " m-on" : ""}`}
                      onClick={() => handleToggleSkill(sk.id)}
                    >
                      <span>{sk.icon}</span>
                      <b>{sk.name}</b>
                    </button>
                  );
                })}
              </div>

              <div className="nk-stage-actions">
                <button
                  type="button"
                  className="nk-btn-secondary"
                  onClick={() => handleAutoRecommend(selectedStage)}
                >
                  💡 最优推荐
                </button>
                <button
                  type="button"
                  className="nk-btn-primary"
                  onClick={() => handleStartStylingEval(selectedStage)}
                >
                  ⚔️ 开始对决 (预估 {livePreviewEval.rank})
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ==================== 画面 6：星愿幻阁 + 本地 ComfyUI 雯宝 LoRA 实时工坊 ==================== */}
        {screen === "pavilion" && (
          <section className="nk-full-view nk-panel-enter" aria-label="星愿幻阁">
            <div className="nk-pavilion-hero">
              <span className="nk-pavilion-tag">✨ 限时典藏阁 · 重复单品自动升星 (+15%属性)</span>
              <h2>星愿幻之阁</h2>
              <p>抽取同角色透明抠图【深海小鲸鱼套装 SSR】【星河眠云套装 SSR】与心境羁绊 CG！持有礼券：<b>{nikki.coupons}</b></p>
              <div className="nk-pavilion-btns">
                <button type="button" className="nk-draw-btn" onClick={() => handlePavilionDraw(1)}>
                  <strong>✨ 许愿 1 次</strong>
                  <small>消耗 5 礼券</small>
                </button>
                <button type="button" className="nk-draw-btn m-multi" onClick={() => handlePavilionDraw(5)}>
                  <strong>🌟 许愿 5 连抽 (特惠)</strong>
                  <small>消耗 20 礼券 · 必出 SR/SSR！</small>
                </button>
              </div>
            </div>

            {gachaResults && (
              <div className="nk-gacha-results">
                <h3>🎉 本次许愿收获</h3>
                <div className="nk-gacha-grid">
                  {gachaResults.map((res, idx) => (
                    <div
                      key={`${res.item.id}-${idx}`}
                      className={`nk-gacha-card m-${res.item.rarity}`}
                      style={{ animationDelay: `${idx * 90}ms` }}
                    >
                      <span className={`nk-rarity-badge m-${res.item.rarity}`}>
                        {res.item.rarity} · {res.isNew ? "NEW!" : `升至 ★${res.newStarLevel}`}
                      </span>
                      <img className="nk-gacha-thumb" src={itemImage(res.item)} alt={res.item.name} />
                      <strong>{res.item.name}</strong>
                      <small>{SLOT_META[res.item.slot].label}</small>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="nk-comfy-box">
              <div className="nk-comfy-head">
                <strong>🎨 雯宝 LoRA 换装抠图工坊 (xiaoyan.safetensors)</strong>
                <small>正在为【{inspectedItem.name}】生成同角色立绘并绑定专属骨骼树</small>
              </div>
              <div className="nk-comfy-row">
                <input
                  type="text"
                  value={comfyPrompt}
                  onChange={(e) => setComfyPrompt(e.target.value)}
                  placeholder="输入新礼服英文描述（生成后自动抠图并可在🦴骨骼台微调关节）…"
                  disabled={comfyBusy}
                />
                <button type="button" disabled={comfyBusy} onClick={() => void handleLiveComfyGenerate()}>
                  {comfyBusy ? "生成中…" : "✨ LoRA生图"}
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ==================== 画面 7：四大典藏套装 & 全插画图鉴 ==================== */}
        {screen === "codex" && (
          <section className="nk-full-view nk-panel-enter" aria-label="全衣橱图鉴">
            <div className="nk-codex-head">
              <div>
                <h2>典藏套装与原画图鉴</h2>
                <p>已收集 {nikki.unlockedIds.length} / {WARDROBE_ITEMS.length} 件 ({collectionPercent}%)</p>
              </div>
              <div className="nk-codex-bar">
                <i style={{ width: `${collectionPercent}%` }} />
              </div>
            </div>

            <div className="nk-suit-gallery">
              {SUIT_DEFS.map((suit) => {
                const ownedPieces = suit.itemIds.filter((id) => unlockedSet.has(id)).length;
                const complete = ownedPieces === suit.itemIds.length;
                return (
                  <div key={suit.id} className={`nk-suit-card${complete ? " m-complete" : ""}`}>
                    <div className="nk-suit-top">
                      <span className={`nk-rarity-badge m-${suit.rarity}`}>{suit.rarity}</span>
                      <strong>{suit.name}</strong>
                      <span className="nk-suit-prog">{ownedPieces}/{suit.itemIds.length}</span>
                    </div>
                    <p>{suit.themeDesc}</p>
                    <small className="nk-suit-bonus">
                      ✨ 共鸣加成：<b>+{suit.bonusScore}</b> 魅力分
                    </small>
                  </div>
                );
              })}
            </div>

            <div className="nk-codex-list">
              {WARDROBE_ITEMS.map((item) => {
                const owned = unlockedSet.has(item.id);
                const stars = nikki.itemStars[item.id] ?? 1;
                return (
                  <div key={item.id} className={`nk-codex-row${owned ? "" : " m-locked"}`}>
                    <img className="nk-codex-thumb" src={itemImage(item)} alt={item.name} />
                    <div className="nk-codex-info">
                      <div className="nk-codex-title">
                        <span className={`nk-rarity-badge m-${item.rarity}`}>{item.rarity}</span>
                        <strong>{owned ? item.name : `${item.name} (未解锁)`}</strong>
                        {owned && <span className="nk-item-stars">{"★".repeat(stars)}</span>}
                      </div>
                      <p>{item.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ==================== 画面 8：和雯宝聊聊 ==================== */}
        {screen === "chat" && (
          <section className="nk-full-view nk-chat-view nk-panel-enter" aria-label="和雯宝聊聊">
            <div className="nk-chat-head">
              <img src={activeSkin.avatar} alt="" />
              <div>
                <h2>和雯宝私语</h2>
                <small>{companionConn?.connected ? `已连接 ${companionConn.model}` : "贴心陪伴模式（随时回复）"}</small>
              </div>
            </div>
            <div className="nk-chat-messages">
              {chatHistory.map((turn, idx) => (
                <div key={idx} className={`nk-chat-bubble m-${turn.role}`}>
                  {turn.content}
                </div>
              ))}
              {chatBusy && <div className="nk-chat-bubble m-assistant">雯宝正在认真想…</div>}
            </div>
            <div className="nk-chat-topics">
              {QUICK_CHAT_TOPICS.map((topic) => (
                <button key={topic} type="button" onClick={() => void handleSendChat(topic)} disabled={chatBusy}>
                  {topic}
                </button>
              ))}
            </div>
            <form
              className="nk-chat-form"
              onSubmit={(e) => {
                e.preventDefault();
                void handleSendChat();
              }}
            >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="对雯宝说点什么吧…"
                maxLength={200}
              />
              <button type="submit" disabled={chatBusy || !chatInput.trim()}>发送</button>
            </form>
          </section>
        )}
      </main>

      <div className="nk-popups" aria-hidden="true">
        {popups.map((p) => (
          <div key={p.id} className="nk-popup">{p.text}</div>
        ))}
      </div>
      {toast && <div className="nk-toast" role="status">{toast}</div>}

      {/* 搭配对决动态走秀跳分结算弹窗 */}
      {evalModal && (
        <div className="nk-modal-backdrop" role="dialog" aria-modal="true" aria-label="搭配评比结果">
          <div className="nk-eval-card nk-modal-pop">
            <div className={`nk-rank-stamp m-${evalModal.evalResult.rank}${showStamp ? " m-slam" : ""}`}>
              <span>评级</span>
              <strong>{evalModal.evalResult.rank}</strong>
            </div>
            <h2>{evalModal.evalResult.stage.title}</h2>
            <p className="nk-eval-total">
              我方得分 <b>{rollingScore}</b> vs {evalModal.evalResult.stage.rivalName} ({evalModal.evalResult.stage.rivalScore})
            </p>

            <div className="nk-eval-bars">
              {(Object.keys(STYLE_ATTR_LABELS) as StyleAttr[]).map((attr, idx) => {
                const meta = STYLE_ATTR_LABELS[attr];
                const val = evalModal.evalResult.weightedStats[attr];
                const pct = Math.min(100, Math.round((val / 1800) * 100));
                return (
                  <div key={attr} className="nk-eval-bar-row">
                    <span style={{ color: meta.color }}>{meta.name}</span>
                    <div className="nk-eval-bar-track">
                      <i
                        className="nk-bar-fill-anim"
                        style={{
                          width: `${pct}%`,
                          background: meta.color,
                          animationDelay: `${idx * 90}ms`,
                        }}
                      />
                    </div>
                    <b>+{val}</b>
                  </div>
                );
              })}
              <div className="nk-eval-bar-row m-skill">
                <span>🃏 羁绊：{evalModal.evalResult.skillLabel}</span>
                <b>+{evalModal.evalResult.skillBonusScore}</b>
              </div>
              <div className="nk-eval-bar-row m-skill">
                <span>✨ 舞台技能释放加成</span>
                <b>+{evalModal.evalResult.activeSkillBonus}</b>
              </div>
              {evalModal.evalResult.activeSuit && (
                <div className="nk-eval-bar-row m-skill">
                  <span>👑 {evalModal.evalResult.activeSuit.name}共鸣</span>
                  <b>+{evalModal.evalResult.suitBonusScore}</b>
                </div>
              )}
            </div>

            {evalModal.bonusUnlockedItem && (
              <div className="nk-eval-unlock">
                <span>🎁 首通 S 级限定图纸解锁：</span>
                <strong>{evalModal.bonusUnlockedItem.name}</strong>
              </div>
            )}

            <p className="nk-eval-comment">{evalModal.evalResult.comment}（获得 +{evalModal.coinsGained} 礼券）</p>

            <div className="nk-eval-actions">
              <button
                type="button"
                className="nk-btn-secondary"
                onClick={() => {
                  setEvalModal(null);
                  setScreen("wardrobe");
                }}
              >
                去升星/换装
              </button>
              <button
                type="button"
                className="nk-btn-primary"
                onClick={() => setEvalModal(null)}
              >
                收下奖励
              </button>
            </div>
          </div>
        </div>
      )}

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
