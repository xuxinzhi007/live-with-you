import { useCallback, useEffect, useRef, useState } from "react";
import HTMLFlipBook from "react-pageflip";
import { startGame } from "./game/runtime";
import { requestCompanionChat, requestCompanionStatus } from "./game/companion";
import { wenbebi } from "./game/data/pet";
import { roomSpots } from "./game/data/room";

const ROOM_LAYOUT_KEY = "wenbebi-room-layout-v1";
const MEMORIES_KEY = "wenbebi-memories-v1";
const ONBOARDING_KEY = "wenbebi-onboarding-v1";
const MOBILE_GUIDE_KEY = "wenbebi-mobile-guide-v1";
const JOURNAL_KEY = "wenbebi-life-journal-v1";
type MemoryPhoto = { id: string; src: string; title: string };
type JournalEntry = { id: string; title: string; copy: string; time: number };
type CompanionStatus = { model: string; models: Array<{ name: string; size: number; parameterSize: string }> };
type ChatTurn = { role: "user" | "assistant"; content: string };
const MAX_MEMORY_UPLOAD_BYTES = 12_000_000;
const MEMORY_IMAGE_MAX_EDGE = 1280;
const sceneLabels = {
  bedroom: "小屋",
  balcony: "阳台",
  street: "街区",
  cafe: "咖啡店",
} as const;
const movableSpots = roomSpots.filter((spot) => spot.movable);
const defaultLayout: Record<string, { x: number; y: number }> = Object.fromEntries(
  movableSpots.map(({ id, x, y }) => [id, { x: Number(x) || 0, y: Number(y) || 0 }]),
);

function loadRoomLayout() {
  try {
    const saved = JSON.parse(localStorage.getItem(ROOM_LAYOUT_KEY) || "{}");
    return movableSpots.reduce((layout, spot) => {
      const item = saved[spot.id];
      layout[spot.id] = Number.isFinite(item?.x) && Number.isFinite(item?.y)
        ? { x: item.x, y: item.y }
        : defaultLayout[spot.id];
      return layout;
    }, {} as Record<string, { x: number; y: number }>);
  } catch {
    return defaultLayout;
  }
}

function loadMemories(): MemoryPhoto[] {
  try {
    const saved = JSON.parse(localStorage.getItem(MEMORIES_KEY) || "[]");
    return Array.isArray(saved)
      ? saved.filter((item): item is MemoryPhoto => typeof item?.id === "string" && typeof item?.src === "string" && typeof item?.title === "string")
      : [];
  } catch {
    return [];
  }
}

function loadJournal(): JournalEntry[] {
  try {
    const saved = JSON.parse(localStorage.getItem(JOURNAL_KEY) || "[]");
    return Array.isArray(saved)
      ? saved.filter((item): item is JournalEntry => typeof item?.id === "string" && typeof item?.title === "string" && typeof item?.copy === "string" && Number.isFinite(item?.time)).slice(0, 12)
      : [];
  } catch { return []; }
}

function shouldShowOnboarding() {
  try {
    return localStorage.getItem(ONBOARDING_KEY) !== "seen";
  } catch {
    return true;
  }
}

function shouldShowMobileGuide() {
  try {
    return window.matchMedia("(pointer: coarse)").matches && localStorage.getItem(MOBILE_GUIDE_KEY) !== "seen";
  } catch {
    return false;
  }
}

function compressMemoryPhoto(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("error", () => reject(new Error("无法读取照片")));
    reader.addEventListener("load", () => {
      if (typeof reader.result !== "string") {
        reject(new Error("照片格式无效"));
        return;
      }
      const image = new Image();
      image.addEventListener("error", () => reject(new Error("无法处理照片")));
      image.addEventListener("load", () => {
        const longestEdge = Math.max(image.naturalWidth, image.naturalHeight) || 1;
        const scale = Math.min(1, MEMORY_IMAGE_MAX_EDGE / longestEdge);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("当前浏览器不支持照片压缩"));
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.78));
      });
      image.src = reader.result;
    });
    reader.readAsDataURL(file);
  });
}

export function App() {
  const appRef = useRef<HTMLDivElement>(null);
  const layoutSaveTimerRef = useRef<number | null>(null);
  const furnitureDragRef = useRef<{
    id: string;
    pointerId: number;
    startX: number;
    startY: number;
    layout: { x: number; y: number };
  } | null>(null);
  const [isDecorating, setIsDecorating] = useState(false);
  const [scene, setScene] = useState<"bedroom" | "balcony" | "street" | "cafe">("bedroom");
  const [activeItem, setActiveItem] = useState<string | null>(null);
  const [layout, setLayout] = useState(loadRoomLayout);
  const [isMemoryOpen, setIsMemoryOpen] = useState(false);
  const [memories, setMemories] = useState<MemoryPhoto[]>(loadMemories);
  const [memoryPage, setMemoryPage] = useState(0);
  const memoryBookRef = useRef<any>(null);
  const memoryPageRef = useRef(0);
  const memoryCounterRef = useRef<HTMLSpanElement>(null);
  const memoryTotalRef = useRef(2);
  const [memoryPortrait, setMemoryPortrait] = useState(true);
  const memorySwipeStartRef = useRef<number | null>(null);
  const [memoryBookSize, setMemoryBookSize] = useState({ width: 320, height: 460 });
  const [showMobileTip, setShowMobileTip] = useState(shouldShowMobileGuide);
  const [showOnboarding, setShowOnboarding] = useState(shouldShowOnboarding);
  const [memoryNotice, setMemoryNotice] = useState("");
  const [journal, setJournal] = useState<JournalEntry[]>(loadJournal);
  const [companionStatus, setCompanionStatus] = useState<CompanionStatus | null>(null);
  const [companionStatusState, setCompanionStatusState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [companionStatusError, setCompanionStatusError] = useState("");
  const [chatTurns, setChatTurns] = useState<ChatTurn[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState("");
  const [talkOpen, setTalkOpen] = useState(false);

  useEffect(() => {
    if (layoutSaveTimerRef.current) window.clearTimeout(layoutSaveTimerRef.current);
    layoutSaveTimerRef.current = window.setTimeout(() => {
      try {
        localStorage.setItem(ROOM_LAYOUT_KEY, JSON.stringify(layout));
      } catch {
        // 布局仍留在当前页面；无痕模式或存储被禁用时不影响继续布置。
      }
    }, 180);
    return () => {
      if (layoutSaveTimerRef.current) window.clearTimeout(layoutSaveTimerRef.current);
    };
  }, [layout]);

  useEffect(() => {
    if (!appRef.current) return;
    return startGame(appRef.current);
  }, []);

  useEffect(() => {
    const app = appRef.current;
    if (!app) return;
    const updateJournal = (event: Event) => setJournal((event as CustomEvent<JournalEntry[]>).detail || []);
    app.addEventListener("journal:update", updateJournal);
    return () => app.removeEventListener("journal:update", updateJournal);
  }, []);

  useEffect(() => {
    const app = appRef.current;
    if (!app) return;
    const openMemories = () => setIsMemoryOpen(true);
    app.addEventListener("memory:open", openMemories);
    return () => app.removeEventListener("memory:open", openMemories);
  }, []);

  useEffect(() => {
    if (!isMemoryOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsMemoryOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isMemoryOpen]);

  useEffect(() => {
    const updateBookSize = () => {
      const mobile = window.innerWidth <= 520;
      const width = Math.min(340, Math.max(260, window.innerWidth - (mobile ? 82 : 96)));
      const height = mobile
        ? Math.min(390, Math.max(300, Math.round(window.innerHeight * 0.42)))
        : Math.min(500, Math.max(360, Math.round(window.innerHeight * 0.58)));
      setMemoryBookSize({ width, height });
      setMemoryPortrait(mobile);
    };
    updateBookSize();
    window.addEventListener("resize", updateBookSize);
    return () => window.removeEventListener("resize", updateBookSize);
  }, []);

  useEffect(() => {
    if (!showMobileTip) return;
    const timer = window.setTimeout(() => {
      setShowMobileTip(false);
      try {
        localStorage.setItem(MOBILE_GUIDE_KEY, "seen");
      } catch {}
    }, 4200);
    return () => window.clearTimeout(timer);
  }, [showMobileTip]);

  useEffect(() => {
    appRef.current?.dispatchEvent(new CustomEvent("scene:change", { detail: scene }));
  }, [scene]);

  useEffect(() => {
    const app = appRef.current;
    if (!app) return;
    const openTalk = () => setTalkOpen(true);
    const closeTalk = () => setTalkOpen(false);
    app.addEventListener("companion:talk", openTalk);
    app.addEventListener("companion:talk-end", closeTalk);
    return () => {
      app.removeEventListener("companion:talk", openTalk);
      app.removeEventListener("companion:talk-end", closeTalk);
    };
  }, []);

  useEffect(() => {
    if (!talkOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setTalkOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [talkOpen]);

  useEffect(() => {
    if (talkOpen) setIsDecorating(false);
    appRef.current?.dispatchEvent(new Event("hud:change"));
  }, [talkOpen]);

  useEffect(() => {
    const app = appRef.current;
    if (!app) return;
    const requestScene = (event: Event) => {
      const next = (event as CustomEvent<"bedroom" | "balcony" | "street" | "cafe">).detail;
      if (["bedroom", "balcony", "street", "cafe"].includes(next)) setScene(next);
    };
    app.addEventListener("scene:request", requestScene);
    return () => app.removeEventListener("scene:request", requestScene);
  }, []);

  function addMemoryPhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !file.type.startsWith("image/")) return;
    if (file.size > MAX_MEMORY_UPLOAD_BYTES) {
      setMemoryNotice("照片请小于 12MB");
      return;
    }
    setMemoryNotice("正在整理照片…");
    void compressMemoryPhoto(file)
      .then((source) => {
        const next = [...memories, { id: `${Date.now()}-${Math.random()}`, src: source, title: file.name.replace(/\.[^.]+$/, "") }];
        try {
          // 先确认能写入，再更新画面；刷新后不会出现“刚才有、现在没了”的假保存。
          localStorage.setItem(MEMORIES_KEY, JSON.stringify(next));
          setMemories(next);
          setMemoryPage(next.length);
        } catch {
          setMemoryNotice("浏览器存储已满；请删除一张旧照片后再试");
          return;
        }
        setMemoryNotice("照片已收进回忆录");
      })
      .catch(() => setMemoryNotice("这张照片暂时无法使用"));
  }

  function removeMemory(id: string) {
    const next = memories.filter((memory) => memory.id !== id);
    try {
      localStorage.setItem(MEMORIES_KEY, JSON.stringify(next));
    } catch {
      setMemoryNotice("浏览器暂时无法保存更改");
      return;
    }
    setMemories(next);
    setMemoryPage((page) => Math.min(page, Math.max(0, next.length - 1)));
    setMemoryNotice("");
  }

  memoryTotalRef.current = memories.length + 2;

  function changeMemoryPage(nextPage: number) {
    const currentPage = memoryPageRef.current;
    if (nextPage < 0) {
      setMemoryNotice("已经是第一页");
      return;
    }
    if (nextPage > memories.length + 1) {
      setMemoryNotice("已经是最后一页");
      return;
    }
    const pageFlip = memoryBookRef.current?.pageFlip?.();
    if (pageFlip) {
      if (nextPage > currentPage) pageFlip.flipNext("top");
      else if (nextPage < currentPage) pageFlip.flipPrev("top");
      return;
    }
    setMemoryPage(Math.max(0, Math.min(nextPage, memories.length - 1)));
    setMemoryNotice("");
  }

  const handleMemoryFlip = useCallback((event: { data: number }) => {
    memoryPageRef.current = event.data;
    if (memoryCounterRef.current) {
      memoryCounterRef.current.textContent = `${Math.min(event.data + 1, memoryTotalRef.current)} / ${memoryTotalRef.current}`;
    }
  }, []);

  const handleMemoryInit = useCallback((event: { data: number }) => {
    memoryPageRef.current = event.data;
    if (memoryCounterRef.current) {
      memoryCounterRef.current.textContent = `${Math.min(event.data + 1, memoryTotalRef.current)} / ${memoryTotalRef.current}`;
    }
  }, []);

  function handleMemoryTouchStart(event: React.TouchEvent<HTMLElement>) {
    memorySwipeStartRef.current = event.changedTouches[0]?.clientX ?? null;
  }

  function handleMemoryTouchEnd(event: React.TouchEvent<HTMLElement>) {
    const startX = memorySwipeStartRef.current;
    memorySwipeStartRef.current = null;
    const endX = event.changedTouches[0]?.clientX;
    if (startX === null || endX === undefined) return;
    const delta = endX - startX;
    if (Math.abs(delta) < 48) return;
    const pageAtRelease = memoryPageRef.current;
    window.setTimeout(() => {
      if (memoryPageRef.current !== pageAtRelease) return;
      const pageFlip = memoryBookRef.current?.pageFlip?.();
      if (!pageFlip) return;
      if (delta > 0 && pageAtRelease > 0) pageFlip.flipPrev("top");
      if (delta < 0 && pageAtRelease < memoryTotalRef.current - 1) pageFlip.flipNext("top");
    }, 90);
  }

  function finishOnboarding() {
    try {
      localStorage.setItem(ONBOARDING_KEY, "seen");
    } catch {
      // 无痕模式下仍允许关闭本次引导。
    }
    setShowOnboarding(false);
  }

  async function checkCompanionStatus() {
    setCompanionStatusState("loading");
    setCompanionStatusError("");
    try {
      const next = await requestCompanionStatus();
      setCompanionStatus(next);
      setCompanionStatusState("ready");
    } catch (error) {
      setCompanionStatusState("error");
      setCompanionStatusError(error instanceof Error ? error.message : "无法连接模型服务");
    }
  }

  async function sendCompanionChat(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = chatInput.trim();
    if (!text || chatBusy) return;
    setChatInput("");
    setChatError("");
    setChatBusy(true);
    const history = chatTurns.slice(-8);
    setChatTurns((current) => [...current, { role: "user", content: text }]);
    try {
      const next = await requestCompanionChat(text, history) as { reply: string };
      setChatTurns((current) => [...current, { role: "assistant", content: next.reply }]);
      appRef.current?.dispatchEvent(new CustomEvent("companion:said", { detail: { text: next.reply } }));
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "雯宝暂时说不了话");
    } finally {
      setChatBusy(false);
    }
  }

  function startFurnitureDrag(event: React.PointerEvent<HTMLButtonElement>, id: string) {
    if (!isDecorating) return;
    const item = layout[id];
    if (!item) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    furnitureDragRef.current = {
      id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      layout: item,
    };
    setActiveItem(id);
  }

  function moveFurniture(event: React.PointerEvent<HTMLButtonElement>) {
    const drag = furnitureDragRef.current;
    const world = appRef.current?.querySelector<HTMLElement>("#world");
    if (!drag || drag.pointerId !== event.pointerId || !world) return;
    const rect = world.getBoundingClientRect();
    const worldWidth = world.offsetWidth || 1;
    const scale = rect.width / worldWidth || 1;
    const deltaX = (event.clientX - drag.startX) / scale;
    const deltaY = (event.clientY - drag.startY) / scale;
    const item = movableSpots.find((spot) => spot.id === drag.id);
    if (!item) return;
    const itemRect = event.currentTarget.getBoundingClientRect();
    const width = itemRect.width / scale || Number(item.width) || 80;
    const height = itemRect.height / scale || Number(item.height) || 80;
    const maxX = 100 - width / worldWidth * 100;
    const floorHeight = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--floor-h")) || 0;
    const maxY = Math.max(0, world.offsetHeight - floorHeight - height);
    const candidate = {
      x: Math.min(maxX, Math.max(0, drag.layout.x + deltaX / worldWidth * 100)),
      y: Math.min(maxY, Math.max(0, drag.layout.y - deltaY)),
    };
    setLayout((current) => ({ ...current, [drag.id]: candidate }));
  }

  function endFurnitureDrag(event: React.PointerEvent<HTMLButtonElement>) {
    const drag = furnitureDragRef.current;
    if (drag?.pointerId !== event.pointerId) return;
    if (layoutSaveTimerRef.current) window.clearTimeout(layoutSaveTimerRef.current);
    try {
      localStorage.setItem(ROOM_LAYOUT_KEY, JSON.stringify(layout));
    } catch {
      // 无痕模式下仍保留当前会话内的布置结果。
    }
    furnitureDragRef.current = null;
    setActiveItem(null);
  }

  return (
    <div ref={appRef} className="game-app" data-scene={scene} data-decorating={isDecorating || undefined} data-talking={talkOpen || undefined} data-memory-open={isMemoryOpen || undefined} data-onboarding={showOnboarding || undefined}>
      <div id="viewport">
        <div id="world">
          <div className={`room room--${scene}`}>
            <div className="wall" aria-hidden="true" />
            {(scene === "balcony" || scene === "street") && <div className="weather-rain" aria-hidden="true" />}
            {roomSpots.filter((spot) => spot.scene === scene).map((spot) => {
              const item = spot.movable ? layout[spot.id] : null;
              const style = item ? { left: `${item.x}%`, bottom: `calc(var(--floor-h, 18%) + ${item.y}px)` } : undefined;
              return (
                <button
                  key={spot.id}
                  type="button"
                  className={spot.className}
                  style={style}
                  data-spot={spot.kind}
                  data-decor-item={spot.movable || undefined}
                  data-decor-id={spot.movable ? spot.id : undefined}
                  data-decor-selected={activeItem === spot.id || undefined}
                  aria-label={spot.label}
                  onPointerDown={(event) => startFurnitureDrag(event, spot.id)}
                  onPointerMove={moveFurniture}
                  onPointerUp={endFurnitureDrag}
                  onPointerCancel={endFurnitureDrag}
                />
              );
            })}
            <button type="button" className="garden-bed" data-spot="garden" aria-label="阳台花圃" />
            {scene === "bedroom" && <button type="button" className="memento-shelf" data-spot="mementoShelf" aria-label="旅行纪念架" />}
            {scene === "bedroom" && <p className="play-streak" id="playStreak" aria-live="polite" hidden />}
            <div className="home-collection" id="homeCollection" aria-hidden="true" />
            <div className="floor" aria-hidden="true" />
            <div className="baseboard" aria-hidden="true" />
          </div>
          <canvas id="fx" />
          <div className="pet" id="pet">
            <div className="talk-bubble" id="bubble" />
            <div className="pet-need" id="petNeed" aria-hidden="true" />
            <div className="pet-facing">
              <div className="pet-actor" id="actor">
                <picture>
                  <source srcSet={`assets/${wenbebi.sprites.idle}.webp`} type="image/webp" />
                  <img src={`assets/${wenbebi.sprites.idle}.png`} alt={`桌面宠物${wenbebi.name}`} draggable={false} decoding="async" fetchPriority="high" />
                </picture>
              </div>
            </div>
            <div className="pet-shadow" />
          </div>
        </div>
      </div>

      <a className="mobile-presence" href="?character" aria-label={`查看${wenbebi.name}角色详情`}>
        <span className="mobile-presence__avatar" aria-hidden="true">
          <img src={`assets/${wenbebi.sprites.idle}.webp`} alt="" draggable={false} />
        </span>
        <span className="mobile-presence__copy">
          <strong>{wenbebi.name}</strong>
          <small>{sceneLabels[scene]} · 在这里陪你</small>
        </span>
        <span className="mobile-presence__signal" aria-hidden="true">·</span>
      </a>

      <section className="life-bag" aria-label="生活背包">
        <button type="button" id="bagToggle" aria-expanded="false"><span className="life-bag__icon" aria-hidden="true">✦</span> 收集 <span data-bag-total>0</span></button>
        <div className="life-bag__panel" id="bagPanel">
          <p>散步收获</p>
          <span>天气 <strong data-weather>晴天</strong></span>
          <span>花种 <strong data-bag-seeds>0</strong></span>
          <span>花束 <strong data-bag-flowers>0</strong></span>
          <span>小纪念 <strong data-bag-mementos>0</strong></span>
          <span>零钱 <strong data-bag-coins>0</strong></span>
          <small data-life-hint>街区里的相遇，会慢慢留在生活里。</small>
          <div className="life-bag__model-status">
            <button type="button" className="model-status-trigger" onClick={checkCompanionStatus} disabled={companionStatusState === "loading"}>
              <span>连接状态</span><small>{companionStatusState === "loading" ? "检查中…" : companionStatusState === "ready" ? "已连接" : companionStatusState === "error" ? "未连接" : "查看"}</small>
            </button>
            {companionStatusState === "ready" && companionStatus && (
              <div className="model-status" aria-live="polite">
                <strong>{companionStatus.model}</strong>
                <span>已安装 {companionStatus.models.length} 个模型</span>
                <small>{companionStatus.models.map((model) => model.name).join(" · ")}</small>
              </div>
            )}
            {companionStatusState === "error" && <p className="model-status model-status--error" role="status">{companionStatusError}</p>}
          </div>
        </div>
      </section>

      <aside className="life-compass" aria-live="polite">
        <span className="life-compass__mark" aria-hidden="true">·</span>
        <p data-life-compass>回来就好，慢慢待一会儿。</p>
      </aside>

      <button type="button" className="today-story" id="todayStory" aria-live="polite" hidden>
        <span className="today-story__eyebrow">此刻的小屋</span>
        <strong data-today-story-title>今天的小片段</strong>
        <small data-today-story-copy />
      </button>

      <aside className="desk-plate" id="plate" aria-label="小屋操作">
        <div className="desk-plate__top">
          <button type="button" className="desk-plate__memory" onClick={() => { setTalkOpen(false); setIsMemoryOpen(true); }}>
            <span aria-hidden="true">◌</span><small>回忆</small>
          </button>
          <button type="button" className="desk-plate__decorate" aria-pressed={isDecorating} onClick={() => { setTalkOpen(false); setIsDecorating((value) => !value); }}>
            <span aria-hidden="true">⌂</span><small>{isDecorating ? "完成" : "布置"}</small>
          </button>
          <button type="button" className="desk-plate__menu" id="menuToggle" aria-expanded="false" aria-controls="plateExtra">
            <span aria-hidden="true">···</span><small>更多</small>
          </button>
        </div>
        <p className="desk-plate__hint">{scene === "balcony" ? "点花盆、藤椅或楼梯 · 拖空白处看风景" : scene === "street" ? "点喷泉、花摊、长椅或路口 · 拖空白处散步" : scene === "cafe" ? "点吧台或窗边小桌 · 从门口回街区" : "摸摸头 · 点身体说一句 · 点家具互动 · 从门口出门"}</p>
        <div className="desk-plate__drawer-heading">
          <strong>雯宝今天</strong>
          <span>状态</span>
        </div>
        <div className="pet-stats" aria-label={`${wenbebi.name}的状态`}>
          <span data-stat="mood"><b>心情</b><strong data-mood>--</strong></span>
          <span data-stat="pats"><b>亲密</b><strong data-pats>--</strong></span>
          <span data-stat="energy"><b>精力</b><strong data-energy>--</strong></span>
          <span data-stat="hunger"><b>饱腹</b><strong data-hunger>--</strong></span>
        </div>
        <div className="desk-plate__extra" id="plateExtra">
          <a className="desk-plate__studio" href="?studio">角色工坊</a>
          <label className="desk-plate__toggle"><input type="checkbox" id="followToggle" /><span className="label-mouse">跟着鼠标</span><span className="label-touch">跟着手指</span></label>
          <label className="desk-plate__toggle"><input type="checkbox" id="cameraToggle" defaultChecked />摄像机跟随</label>
          <label className="desk-plate__toggle"><input type="checkbox" id="flipToggle" />左右纠正</label>
          <p className="desk-plate__keys">点击玩具筐丢球 · 方向键可散步</p>
        </div>
      </aside>

      <form className="talk-dock" hidden={!talkOpen} onSubmit={sendCompanionChat} aria-label="和雯宝说话">
        {(chatBusy || chatError) && (
          <p className={`talk-dock__status${chatError ? " talk-dock__status--error" : ""}`} role="status">
            {chatError || "雯宝在想…"}
          </p>
        )}
        <div className="talk-dock__row">
          <input
            value={chatInput}
            onChange={(event) => setChatInput(event.target.value)}
            maxLength={400}
            placeholder="说一句…"
            disabled={chatBusy}
            aria-label="对雯宝说的话"
          />
          <button type="submit" disabled={chatBusy || !chatInput.trim()}>发送</button>
          <button type="button" onClick={() => setTalkOpen(false)}>收起</button>
        </div>
      </form>

      <p className={`mobile-gesture-tip${showMobileTip ? " is-visible" : ""}`} aria-live="polite">
        {isDecorating ? "拖动家具布置 · 双指查看全景" : scene === "balcony" ? "点花盆、藤椅或楼梯 · 双指查看风景" : scene === "street" ? "点喷泉、花摊、长椅或路口 · 双指散步" : scene === "cafe" ? "点吧台或窗边小桌 · 从门口回街区" : "摸摸头 · 点身体说一句 · 从门口一起出门"}
      </p>

      <div className="life-event" id="lifeEvent" role="dialog" aria-modal="true" aria-label="街区偶遇" hidden>
        <section className="life-event__card">
          <p className="life-event__eyebrow">街区偶遇</p>
          <h2 data-life-event-title>遇见了一件小事</h2>
          <p data-life-event-copy />
          <div className="life-event__choices" data-life-event-choices />
          <button type="button" className="life-event__close" data-life-event-close>先离开</button>
        </section>
      </div>

      <div className="life-event travel-event" id="travelEvent" role="dialog" aria-modal="true" aria-label="出行选择" hidden>
        <section className="life-event__card">
          <p className="life-event__eyebrow">一起出门</p>
          <h2 data-travel-title>从小屋门口出发</h2>
          <p data-travel-copy />
          <div className="life-event__choices travel-event__choices" data-travel-choices />
          <button type="button" className="life-event__close" data-travel-event-close>还是在这里待一会儿</button>
        </section>
      </div>

      {showOnboarding && (
        <div className="onboarding" role="dialog" aria-modal="true" aria-label="雯宝玩法说明">
          <section className="onboarding__card">
            <p className="onboarding__eyebrow">欢迎回家</p>
            <h2>和雯宝一起生活</h2>
            <ul>
              <li><span>1</span>摸摸头，或点她身体说一句。</li>
              <li><span>2</span>点家具，她会自己走过去互动。</li>
              <li><span>3</span>饿了点点心，困了带她去床上。</li>
              <li><span>4</span>从门口或楼梯出发，和她一起去街区。</li>
            </ul>
            <button type="button" onClick={finishOnboarding}>开始陪伴</button>
          </section>
        </div>
      )}

      {isMemoryOpen && (
        <div className="memory-overlay" role="presentation" onPointerDown={() => setIsMemoryOpen(false)}>
          <section className="memory-book" role="dialog" aria-modal="true" aria-label="回忆录" onPointerDown={(event) => event.stopPropagation()}>
            <header className="memory-book__header">
              <div>
                <p className="memory-book__eyebrow">WENBEBI'S</p>
                <h2>回忆录</h2>
              </div>
              <button className="memory-book__close" type="button" aria-label="关闭回忆录" onClick={() => setIsMemoryOpen(false)}>x</button>
            </header>
            <section className="memory-book__page" aria-label="照片回忆" onTouchStart={handleMemoryTouchStart} onTouchEnd={handleMemoryTouchEnd}>
              <HTMLFlipBook
                ref={memoryBookRef}
                startPage={0}
                width={memoryBookSize.width}
                height={memoryBookSize.height}
                size="stretch"
                minWidth={260}
                maxWidth={340}
                minHeight={360}
                maxHeight={500}
                drawShadow
                maxShadowOpacity={0.28}
                flippingTime={620}
                usePortrait={memoryPortrait}
                startZIndex={0}
                showCover
                mobileScrollSupport
                swipeDistance={32}
                autoSize
                clickEventForward
                useMouseEvents
                showPageCorners
                disableFlipByClick={!memoryPortrait}
                style={{}}
                onInit={handleMemoryInit}
                onFlip={handleMemoryFlip}
                className="memory-flip-book"
              >
                <div className="memory-flip-page memory-flip-page--cover" key="memory-cover">
                  <p className="memory-book__eyebrow">OUR LITTLE DAYS</p>
                  <h3>和你住在一起</h3>
                  <p>把想留下来的时刻，收进这一页。</p>
                  <span className="memory-flip-page__mark">雯宝的小屋</span>
                </div>
                {memories.map((memory) => (
                  <div className="memory-flip-page" key={memory.id}>
                    <figure className="memory-photo">
                      <img src={memory.src} alt={memory.title} />
                      <figcaption>{memory.title}</figcaption>
                      <button type="button" aria-label={`删除照片 ${memory.title}`} onClick={() => removeMemory(memory.id)}>x</button>
                    </figure>
                  </div>
                ))}
                <label className="memory-flip-page memory-flip-page--add" key="memory-add">
                  <input type="file" accept="image/*" onChange={addMemoryPhoto} />
                  <span>＋</span>
                  <strong>收进下一页</strong>
                  <small>把今天留在这里</small>
                </label>
              </HTMLFlipBook>
              <div className="memory-page__controls">
                <button type="button" className="memory-page__nav" aria-label="上一页" aria-disabled={memoryPageRef.current === 0} onClick={() => changeMemoryPage(memoryPageRef.current - 1)}>‹</button>
                <span ref={memoryCounterRef}>{`${Math.min(memoryPageRef.current + 1, memories.length + 2)} / ${memories.length + 2}`}</span>
                <button type="button" className="memory-page__nav" aria-label="下一页" aria-disabled={memoryPageRef.current >= memories.length + 1} onClick={() => changeMemoryPage(memoryPageRef.current + 1)}>›</button>
              </div>
              <p className="memory-page__hint">左右滑动翻页 · 书页会记住你停留的地方</p>
            </section>
            <section className="memory-book__journal" aria-label="生活小记">
              <p className="memory-book__eyebrow">LITTLE DAYS</p>
              <h3>生活小记</h3>
              {journal.length ? <ul>{journal.slice(0, 4).map((entry) => <li key={entry.id}><strong>{entry.title}</strong><span>{entry.copy}</span></li>)}</ul> : <p className="memory-book__empty">下一次出门，会写进这里。</p>}
            </section>
            {memoryNotice && <p className="memory-book__notice" aria-live="polite">{memoryNotice}</p>}
          </section>
        </div>
      )}
    </div>
  );
}
