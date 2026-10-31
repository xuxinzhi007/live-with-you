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
  clampRigPlacement,
  getRigPlacement,
  loadCutoutImage,
  type RigOverrideMap,
  type RigPlacement,
} from "./world/paper-doll-rig";
import { getBondLevelInfo } from "./world/codex";
import {
  probeCompanionStatus,
  sendCompanionChatMessage,
  type ChatTurn,
  type CompanionConnection,
} from "./world/companion-bridge";
import { getCharacterSkin } from "./world/skins";
import "./world.css";

type MainView = "wardrobe" | "stages" | "pavilion" | "codex" | "chat";
type WearableAccessorySlot = "hairAcc" | "handheld" | "aura";

const WARDROBE_STORAGE_KEY = "wenbebi-nikki-wardrobe-v6";

interface SavedNikkiState {
  equipped: EquippedOutfit;
  unlockedIds: string[];
  itemStars: Record<string, number>;
  clearedStages: Record<string, string>;
  coupons: number;
  customImages?: Record<string, string>;
  rigOverrides?: RigOverrideMap;
}

function loadNikkiState(): SavedNikkiState {
  try {
    const raw =
      localStorage.getItem(WARDROBE_STORAGE_KEY) ||
      localStorage.getItem("wenbebi-nikki-wardrobe-v4");
    if (!raw) {
      return {
        equipped: { ...DEFAULT_EQUIPPED_OUTFIT },
        unlockedIds: [...DEFAULT_UNLOCKED_ITEM_IDS],
        itemStars: {},
        clearedStages: {},
        coupons: 35,
        customImages: {},
        rigOverrides: {},
      };
    }
    const parsed = JSON.parse(raw);
    return {
      equipped: { ...DEFAULT_EQUIPPED_OUTFIT, ...(parsed.equipped || {}) },
      unlockedIds: Array.from(new Set([...DEFAULT_UNLOCKED_ITEM_IDS, ...(parsed.unlockedIds || [])])),
      itemStars: parsed.itemStars || {},
      clearedStages: parsed.clearedStages || {},
      coupons: typeof parsed.coupons === "number" ? parsed.coupons : 35,
      customImages: parsed.customImages || {},
      rigOverrides: parsed.rigOverrides || {},
    };
  } catch {
    return {
      equipped: { ...DEFAULT_EQUIPPED_OUTFIT },
      unlockedIds: [...DEFAULT_UNLOCKED_ITEM_IDS],
      itemStars: {},
      clearedStages: {},
      coupons: 35,
      customImages: {},
      rigOverrides: {},
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
  const [activeView, setActiveView] = useState<MainView>("wardrobe");
  const [activeSlot, setActiveSlot] = useState<WardrobeSlot>("dress");
  const [selectedStageId, setSelectedStageId] = useState<string>(STYLING_STAGES[0].id);
  const [inspectedItemId, setInspectedItemId] = useState<string>(DEFAULT_EQUIPPED_OUTFIT.dress);
  const [selectedSkills, setSelectedSkills] = useState<StylingSkill["id"][]>(["smile", "charm"]);
  const [drawerCollapsed, setDrawerCollapsed] = useState(false);

  // 纸偶骨骼穿戴微调器状态（支持手动调整头饰/手持物/香氛在雯宝身上的位置、缩放、旋转）
  const [rigEditingSlot, setRigEditingSlot] = useState<WearableAccessorySlot | null>(null);
  const [cutoutMap, setCutoutMap] = useState<Record<string, string>>({});

  // 角色立绘丝滑动态（呼吸帧 + 换装闪光魔法阵 + 互动弹跳）
  const [breatheIdx, setBreatheIdx] = useState(0);
  const [reacting, setReacting] = useState(false);
  const [equipBurstKey, setEquipBurstKey] = useState(0);

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
      content: "欢迎来到高定搭配工坊～现在所有礼服都是同角色 Q 版雯宝并已自动透明抠图，头饰和手持物也会直接穿戴在我身上，点『🔧调位置』还能自由拖动大小哦！",
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

  useEffect(() => {
    void probeCompanionStatus().then(setCompanionConn);
  }, []);

  const currentDress = useMemo(() => getWardrobeItem(nikki.equipped.dress), [nikki.equipped.dress]);
  const currentHairAcc = useMemo(() => getWardrobeItem(nikki.equipped.hairAcc), [nikki.equipped.hairAcc]);
  const currentHandheld = useMemo(() => getWardrobeItem(nikki.equipped.handheld), [nikki.equipped.handheld]);
  const currentAura = useMemo(() => getWardrobeItem(nikki.equipped.aura), [nikki.equipped.aura]);
  const currentCard = useMemo(() => getWardrobeItem(nikki.equipped.memoryCard), [nikki.equipped.memoryCard]);

  const itemImage = useCallback(
    (item: WardrobeItem) => nikki.customImages?.[item.id] || item.image,
    [nikki.customImages],
  );

  // 自动将当前穿戴的礼服、头饰、手持物、香氛进行四边连通洪水透明抠图（消除方形白框！）
  useEffect(() => {
    let active = true;
    const targets: { id: string; src: string; mode: "character" | "accessory" }[] = [
      { id: currentDress.id, src: itemImage(currentDress), mode: "character" },
      { id: currentHairAcc.id, src: itemImage(currentHairAcc), mode: "accessory" },
      { id: currentHandheld.id, src: itemImage(currentHandheld), mode: "accessory" },
      { id: currentAura.id, src: itemImage(currentAura), mode: "accessory" },
    ];
    for (const t of targets) {
      void loadCutoutImage(t.src, t.mode).then((dataUrl) => {
        if (!active) return;
        setCutoutMap((prev) => (prev[t.id] === dataUrl ? prev : { ...prev, [t.id]: dataUrl }));
      });
    }
    return () => {
      active = false;
    };
  }, [currentAura, currentDress, currentHairAcc, currentHandheld, itemImage]);

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

  // 计算头饰、手持物、香氛在雯宝骨骼上的实时穿戴坐标
  const hairRig = useMemo(
    () => getRigPlacement(currentHairAcc.id, "hairAcc", nikki.rigOverrides),
    [currentHairAcc.id, nikki.rigOverrides],
  );
  const handRig = useMemo(
    () => getRigPlacement(currentHandheld.id, "handheld", nikki.rigOverrides),
    [currentHandheld.id, nikki.rigOverrides],
  );
  const auraRig = useMemo(
    () => getRigPlacement(currentAura.id, "aura", nikki.rigOverrides),
    [currentAura.id, nikki.rigOverrides],
  );

  const editingTargetItem = useMemo(() => {
    if (rigEditingSlot === "hairAcc") return currentHairAcc;
    if (rigEditingSlot === "handheld") return currentHandheld;
    if (rigEditingSlot === "aura") return currentAura;
    return null;
  }, [currentAura, currentHairAcc, currentHandheld, rigEditingSlot]);

  const editingTargetRig = useMemo(() => {
    if (!rigEditingSlot || !editingTargetItem) return null;
    return getRigPlacement(editingTargetItem.id, rigEditingSlot, nikki.rigOverrides);
  }, [editingTargetItem, nikki.rigOverrides, rigEditingSlot]);

  const updateEditingRig = useCallback((patch: Partial<RigPlacement>) => {
    if (!rigEditingSlot || !editingTargetItem) return;
    setNikki((prev) => {
      const current = getRigPlacement(editingTargetItem.id, rigEditingSlot, prev.rigOverrides);
      const next = clampRigPlacement({ ...current, ...patch }, current);
      return {
        ...prev,
        rigOverrides: { ...(prev.rigOverrides || {}), [editingTargetItem.id]: next },
      };
    });
  }, [editingTargetItem, rigEditingSlot]);

  const resetEditingRig = useCallback(() => {
    if (!editingTargetItem) return;
    setNikki((prev) => {
      const nextMap = { ...(prev.rigOverrides || {}) };
      delete nextMap[editingTargetItem.id];
      return { ...prev, rigOverrides: nextMap };
    });
    pushPopup(`已重置 ${editingTargetItem.name} 穿戴位置`);
  }, [editingTargetItem, pushPopup]);

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
    if (item.slot === "hairAcc" || item.slot === "handheld" || item.slot === "aura") {
      setRigEditingSlot(item.slot);
    }
    setEquipBurstKey((k) => k + 1);
    setReacting(true);
    setTimeout(() => setReacting(false), 680);
    pushPopup(`✨ 穿戴上身：${item.name}`);
  }, [pushPopup, setSkin, showToast, unlockedSet]);

  const handleUpgradeOrCraftItem = useCallback((item: WardrobeItem) => {
    const owned = unlockedSet.has(item.id);
    const currentStar = nikki.itemStars[item.id] ?? 1;

    if (!owned) {
      const craftCost = item.rarity === "SSR" ? 28 : item.rarity === "SR" ? 16 : 10;
      if (nikki.coupons < craftCost) {
        showToast(`定制【${item.name}】需要 ${craftCost} 礼券（当前 ${nikki.coupons}），点舞台右上角『PK ›』赢礼券吧！`);
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
      showToast(`升至 ★${currentStar + 1} 需要 ${upCost} 礼券（当前 ${nikki.coupons}），点右上角『PK ›』拿奖励吧！`);
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

  // 调用本地 ComfyUI (8188 · meinamix_v12Final + xiaoyan.safetensors LoRA 0.80) 实时重绘并自动透明抠图
  const handleLiveComfyGenerate = useCallback(async () => {
    if (comfyBusy) return;
    setComfyBusy(true);
    const isDress = inspectedItem.slot === "dress";
    showToast(
      isDress
        ? "🎨 正在调用本机 ComfyUI + 雯宝 LoRA (xiaoyan.safetensors 0.80) 生成同角色礼服并自动透明抠图…"
        : "🎨 正在调用本机 ComfyUI 生成配饰并自动透明抠图…",
    );
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
      pushPopup(`🎨 已用雯宝 LoRA 重绘并抠图：${inspectedItem.name}！`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "请确认本机 ComfyUI (127.0.0.1:8188) 正在运行");
    } finally {
      setComfyBusy(false);
    }
  }, [comfyBusy, comfyPrompt, inspectedItem.id, inspectedItem.name, inspectedItem.slot, pushPopup, showToast]);

  const handleTapCharacter = useCallback(() => {
    const res = companionAct("pat", false);
    setNikki((prev) => ({ ...prev, coupons: prev.coupons + 2 }));
    setEquipBurstKey((k) => k + 1);
    setReacting(true);
    setTimeout(() => setReacting(false), 720);
    pushPopup(`+${res.bondGained} 亲密 · +2 礼券`);
  }, [companionAct, pushPopup]);

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
      showToast(`许愿 ${count} 次需要 ${cost} 礼券（当前 ${nikki.coupons}），点右上角『PK ›』闯关拿礼券吧！`);
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

  // 角色主立绘：全部使用透明抠图后的同角色 Q 版雯宝（再也没有方形白框！）
  const isComfyDress = currentDress.image.startsWith("assets/nikki/dress-");
  const customDressImg = nikki.customImages?.[currentDress.id];
  const heroSpriteSrc = customDressImg
    ? customDressImg
    : isComfyDress
      ? cutoutMap[currentDress.id] || currentDress.image
      : reacting
        ? activeSkin.react
        : activeSkin.breathe[breatheIdx % activeSkin.breathe.length] || activeSkin.idle;

  const hairCutoutSrc = cutoutMap[currentHairAcc.id] || itemImage(currentHairAcc);
  const handCutoutSrc = cutoutMap[currentHandheld.id] || itemImage(currentHandheld);
  const auraCutoutSrc = cutoutMap[currentAura.id] || itemImage(currentAura);

  const collectionPercent = Math.round((nikki.unlockedIds.length / WARDROBE_ITEMS.length) * 100);
  const inspectedOwned = unlockedSet.has(inspectedItem.id);
  const inspectedStars = nikki.itemStars[inspectedItem.id] ?? 1;

  return (
    <div id="nikki-root" data-theme={currentDress.stageTheme || "daylight"}>
      {/* 1. 极简顶栏 */}
      <header className="nk-header">
        <button type="button" className="nk-profile" onClick={handleTapCharacter}>
          <img src={activeSkin.avatar} alt="" draggable={false} />
          <div className="nk-profile-text">
            <div className="nk-profile-row">
              <strong>雯宝</strong>
              <span className="nk-lv">Lv.{bondInfo.level}</span>
            </div>
            <div className="nk-exp-track">
              <i style={{ width: `${bondInfo.progressPercent}%` }} />
            </div>
          </div>
        </button>

        <div className="nk-currencies">
          <button type="button" className="nk-curr-pill" onClick={() => setActiveView("stages")}>
            <GemSvg />
            <b>{totalCharmPower}</b>
            <span>魅力</span>
          </button>
          <button type="button" className="nk-curr-pill" onClick={() => setActiveView("pavilion")}>
            <CoinSvg />
            <b>{nikki.coupons}</b>
            <span>礼券</span>
          </button>
        </div>
      </header>

      <main className="nk-main">
        {/* 2. 多层纸偶骨骼穿戴舞台（Paper-Doll Stage：透明抠图雯宝 + 头饰/手持/香氛直接穿戴在身上！） */}
        {(activeView === "wardrobe" || activeView === "stages") && (
          <section className={`nk-stage-card${drawerCollapsed ? " m-expanded" : ""}`}>
            <div
              className="nk-stage-bg"
              style={{ backgroundImage: `url(${itemImage(currentCard) || currentDress.bgScene || "assets/scenes/home.webp"})` }}
              aria-hidden="true"
            />
            <div className="nk-stage-frame" aria-hidden="true" />

            {equipBurstKey > 0 && (
              <div key={equipBurstKey} className="nk-magic-ring" aria-hidden="true" />
            )}

            {/* 舞台顶部：轻巧挑战目标胶囊 */}
            <div className="nk-stage-banner">
              <div className="nk-banner-left" onClick={() => { setActiveView("stages"); setDrawerCollapsed(false); }}>
                <span className="nk-banner-chap">{selectedStage.chapter}</span>
                <strong>{selectedStage.title}</strong>
                <span className="nk-banner-req">
                  ({STYLE_ATTR_LABELS[selectedStage.primaryAttr].name}/{STYLE_ATTR_LABELS[selectedStage.secondaryAttr].name})
                </span>
              </div>
              <button
                type="button"
                className="nk-banner-pk-btn"
                onClick={() => handleStartStylingEval(selectedStage)}
              >
                <span>预估 <b>{livePreviewEval.rank}</b></span>
                <em>PK ›</em>
              </button>
            </div>

            <div className="nk-sparkles" aria-hidden="true">
              <i className="s1" /><i className="s2" /><i className="s3" /><i className="s4" /><i className="s5" />
            </div>

            {/* 左侧 2 枚快捷槽位指示圆章（点击可切换槽位或开启该部位穿戴位置微调） */}
            <div className="nk-side-orbs m-left">
              <button
                type="button"
                className={`nk-orb${activeSlot === "hairAcc" || rigEditingSlot === "hairAcc" ? " m-focus" : ""}`}
                title={`头饰：${currentHairAcc.name}（点击调整穿戴）`}
                onClick={() => {
                  setActiveView("wardrobe");
                  setDrawerCollapsed(false);
                  setActiveSlot("hairAcc");
                  setInspectedItemId(currentHairAcc.id);
                }}
              >
                <img src={hairCutoutSrc} alt={currentHairAcc.name} draggable={false} />
                <b className="nk-orb-star">头饰 ★{nikki.itemStars[currentHairAcc.id] ?? 1}</b>
              </button>
              <button
                type="button"
                className={`nk-orb${activeSlot === "aura" || rigEditingSlot === "aura" ? " m-focus" : ""}`}
                title={`香氛：${currentAura.name}`}
                onClick={() => {
                  setActiveView("wardrobe");
                  setDrawerCollapsed(false);
                  setActiveSlot("aura");
                  setInspectedItemId(currentAura.id);
                }}
              >
                <img src={auraCutoutSrc} alt={currentAura.name} draggable={false} />
                <b className="nk-orb-star">香氛 ★{nikki.itemStars[currentAura.id] ?? 1}</b>
              </button>
            </div>

            {/* 右侧 2 枚快捷槽位指示圆章 */}
            <div className="nk-side-orbs m-right">
              <button
                type="button"
                className={`nk-orb${activeSlot === "handheld" || rigEditingSlot === "handheld" ? " m-focus" : ""}`}
                title={`手持：${currentHandheld.name}（点击调整穿戴）`}
                onClick={() => {
                  setActiveView("wardrobe");
                  setDrawerCollapsed(false);
                  setActiveSlot("handheld");
                  setInspectedItemId(currentHandheld.id);
                }}
              >
                <img src={handCutoutSrc} alt={currentHandheld.name} draggable={false} />
                <b className="nk-orb-star">手持 ★{nikki.itemStars[currentHandheld.id] ?? 1}</b>
              </button>
              <button
                type="button"
                className={`nk-orb m-card${activeSlot === "memoryCard" ? " m-focus" : ""}`}
                title={`羁绊：${currentCard.name}`}
                onClick={() => {
                  setActiveView("wardrobe");
                  setDrawerCollapsed(false);
                  setActiveSlot("memoryCard");
                  setInspectedItemId(currentCard.id);
                }}
              >
                <img src={itemImage(currentCard)} alt={currentCard.name} draggable={false} />
                <b className="nk-orb-star">羁绊 ★{nikki.itemStars[currentCard.id] ?? 1}</b>
              </button>
            </div>

            {/* ==================== 核心：多层纸偶骨骼穿戴容器 (Paper-Doll Rig) ==================== */}
            <div
              key={`${currentDress.id}-${equipBurstKey}`}
              className={`nk-paperdoll-rig nk-anim-enter${reacting ? " m-bounce" : ""}`}
              onClick={handleTapCharacter}
              role="button"
              tabIndex={0}
              aria-label="点击雯宝互动"
            >
              {/* Layer 10: 背后香氛光环挂件（随骨骼呼吸浮动） */}
              <img
                className={`nk-rig-layer m-aura${rigEditingSlot === "aura" ? " m-editing" : ""}`}
                src={auraCutoutSrc}
                alt={currentAura.name}
                style={{
                  transform: `translate(${auraRig.dx}%, ${auraRig.dy}%) scale(${auraRig.scale}) rotate(${auraRig.rotate}deg)`,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setRigEditingSlot("aura");
                }}
                draggable={false}
              />

              {/* Layer 20: 100% 透明抠图的同角色 Q 版雯宝主立绘（无方形背景框！） */}
              <img
                className="nk-rig-body"
                src={heroSpriteSrc}
                alt="雯宝"
                draggable={false}
              />

              {/* Layer 30: 头顶骨骼锚点 — 透明抠图头饰直接戴在雯宝头上！ */}
              <img
                className={`nk-rig-layer m-hair${rigEditingSlot === "hairAcc" ? " m-editing" : ""}`}
                src={hairCutoutSrc}
                alt={currentHairAcc.name}
                style={{
                  transform: `translate(${hairRig.dx}%, ${hairRig.dy}%) scale(${hairRig.scale}) rotate(${hairRig.rotate}deg)`,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setRigEditingSlot("hairAcc");
                }}
                draggable={false}
              />

              {/* Layer 40: 手部骨骼锚点 — 透明抠图手持物直接拿在雯宝手边！ */}
              <img
                className={`nk-rig-layer m-hand${rigEditingSlot === "handheld" ? " m-editing" : ""}`}
                src={handCutoutSrc}
                alt={currentHandheld.name}
                style={{
                  transform: `translate(${handRig.dx}%, ${handRig.dy}%) scale(${handRig.scale}) rotate(${handRig.rotate}deg)`,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setRigEditingSlot("handheld");
                }}
                draggable={false}
              />
            </div>

            {/* 穿戴位置/大小/角度自由微调浮层（点击 🔧调位置 或点击身上的配饰触发） */}
            {rigEditingSlot && editingTargetItem && editingTargetRig && (
              <div className="nk-rig-tuner" onClick={(e) => e.stopPropagation()}>
                <div className="nk-tuner-head">
                  <div className="nk-tuner-tabs">
                    <button
                      type="button"
                      className={rigEditingSlot === "hairAcc" ? "m-on" : ""}
                      onClick={() => setRigEditingSlot("hairAcc")}
                    >
                      🎀 头饰
                    </button>
                    <button
                      type="button"
                      className={rigEditingSlot === "handheld" ? "m-on" : ""}
                      onClick={() => setRigEditingSlot("handheld")}
                    >
                      👜 手持
                    </button>
                    <button
                      type="button"
                      className={rigEditingSlot === "aura" ? "m-on" : ""}
                      onClick={() => setRigEditingSlot("aura")}
                    >
                      ✨ 香氛
                    </button>
                  </div>
                  <button type="button" className="nk-tuner-reset" onClick={resetEditingRig}>重置</button>
                  <button type="button" className="nk-tuner-close" onClick={() => setRigEditingSlot(null)}>完成</button>
                </div>
                <div className="nk-tuner-sliders">
                  <label>
                    <span>水平 X</span>
                    <input
                      type="range"
                      min={-45}
                      max={45}
                      value={editingTargetRig.dx}
                      onChange={(e) => updateEditingRig({ dx: Number(e.target.value) })}
                    />
                  </label>
                  <label>
                    <span>垂直 Y</span>
                    <input
                      type="range"
                      min={-45}
                      max={45}
                      value={editingTargetRig.dy}
                      onChange={(e) => updateEditingRig({ dy: Number(e.target.value) })}
                    />
                  </label>
                  <label>
                    <span>大小</span>
                    <input
                      type="range"
                      min={45}
                      max={165}
                      value={Math.round(editingTargetRig.scale * 100)}
                      onChange={(e) => updateEditingRig({ scale: Number(e.target.value) / 100 })}
                    />
                  </label>
                  <label>
                    <span>角度</span>
                    <input
                      type="range"
                      min={-45}
                      max={45}
                      value={editingTargetRig.rotate}
                      onChange={(e) => updateEditingRig({ rotate: Number(e.target.value) })}
                    />
                  </label>
                </div>
              </div>
            )}

            {/* 舞台底栏：左套装共鸣铭牌，右「🔧调位置」与「👁️全景欣赏」 */}
            <div className="nk-stage-foot">
              <span className="nk-suit-badge">
                {activeSuitInfo.suit
                  ? `✨ ${activeSuitInfo.suit.name} (+${activeSuitInfo.bonusScore})`
                  : `${currentDress.rarity} · ${currentDress.name}`}
              </span>
              <div className="nk-foot-btns">
                <button
                  type="button"
                  className={`nk-collapse-btn${rigEditingSlot ? " m-active" : ""}`}
                  onClick={() => setRigEditingSlot((cur) => (cur ? null : "hairAcc"))}
                >
                  🔧 调饰品位置
                </button>
                <button
                  type="button"
                  className="nk-collapse-btn"
                  onClick={() => setDrawerCollapsed((c) => !c)}
                >
                  {drawerCollapsed ? "🔼 展开衣橱" : "👁️ 全景"}
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ==================== 面板 A：全插画毛玻璃卡片衣橱 ==================== */}
        {activeView === "wardrobe" && !drawerCollapsed && (
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

        {/* ==================== 面板 B：主题出行搭配闯关 ==================== */}
        {activeView === "stages" && !drawerCollapsed && (
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

        {/* ==================== 面板 C：星愿幻阁 + 本地 ComfyUI 雯宝 LoRA 实时工坊 ==================== */}
        {activeView === "pavilion" && (
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
                <strong>🎨 雯宝 LoRA 换装抠图工坊 (xiaoyan.safetensors · 0.80)</strong>
                <small>正在为【{inspectedItem.name}】生成同角色立绘并自动执行边缘洪水透明抠图</small>
              </div>
              <div className="nk-comfy-row">
                <input
                  type="text"
                  value={comfyPrompt}
                  onChange={(e) => setComfyPrompt(e.target.value)}
                  placeholder="输入新礼服/配饰英文描述（自动挂雯宝LoRA并透明抠图）…"
                  disabled={comfyBusy}
                />
                <button type="button" disabled={comfyBusy} onClick={() => void handleLiveComfyGenerate()}>
                  {comfyBusy ? "抠图中…" : "✨ LoRA生图"}
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ==================== 面板 D：四大典藏套装 & 全插画图鉴 ==================== */}
        {activeView === "codex" && (
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

        {/* ==================== 面板 E：和雯宝聊聊 ==================== */}
        {activeView === "chat" && (
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
                  setActiveView("wardrobe");
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
          className={activeView === "wardrobe" ? "m-active" : ""}
          onClick={() => { setActiveView("wardrobe"); setDrawerCollapsed(false); }}
        >
          <span>👗</span>
          <small>高定衣橱</small>
        </button>
        <button
          type="button"
          className={activeView === "stages" ? "m-active" : ""}
          onClick={() => { setActiveView("stages"); setDrawerCollapsed(false); }}
        >
          <span>👑</span>
          <small>搭配闯关</small>
        </button>
        <button type="button" className={activeView === "pavilion" ? "m-active" : ""} onClick={() => setActiveView("pavilion")}>
          <span>✨</span>
          <small>星愿幻阁</small>
        </button>
        <button type="button" className={activeView === "codex" ? "m-active" : ""} onClick={() => setActiveView("codex")}>
          <span>📖</span>
          <small>原画 ({collectionPercent}%)</small>
        </button>
        <button type="button" className={activeView === "chat" ? "m-active" : ""} onClick={() => setActiveView("chat")}>
          <span>💬</span>
          <small>密语</small>
        </button>
      </nav>
    </div>
  );
}
