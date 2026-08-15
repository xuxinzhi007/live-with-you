import { useEffect, useRef, useState } from "react";
import { startGame } from "./game/runtime";
import { wenbebi } from "./game/data/pet";
import { roomSpots } from "./game/data/room";

const ROOM_LAYOUT_KEY = "wenbebi-room-layout-v1";
const MEMORIES_KEY = "wenbebi-memories-v1";
type MemoryPhoto = { id: string; src: string; title: string };
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
      ? saved.filter((item): item is MemoryPhoto => typeof item?.id === "string" && typeof item?.src === "string" && typeof item?.title === "string").slice(0, 6)
      : [];
  } catch {
    return [];
  }
}

function isFurniturePlacementBlocked(
  id: string,
  candidate: { x: number; y: number },
  layout: Record<string, { x: number; y: number }>,
  worldWidth: number,
) {
  const item = movableSpots.find((spot) => spot.id === id);
  if (!item) return true;
  const width = Number(item.width) || 80;
  const height = Number(item.height) || 80;
  const left = candidate.x / 100 * worldWidth;
  const gap = 12;

  return movableSpots.some((other) => {
    if (other.id === id) return false;
    const placed = layout[other.id];
    if (!placed) return false;
    const otherWidth = Number(other.width) || 80;
    const otherHeight = Number(other.height) || 80;
    const otherLeft = placed.x / 100 * worldWidth;
    return left < otherLeft + otherWidth + gap
      && left + width + gap > otherLeft
      && candidate.y < placed.y + otherHeight + gap
      && candidate.y + height + gap > placed.y;
  });
}

export function App() {
  const appRef = useRef<HTMLDivElement>(null);
  const furnitureDragRef = useRef<{
    id: string;
    pointerId: number;
    startX: number;
    startY: number;
    layout: { x: number; y: number };
  } | null>(null);
  const [isDecorating, setIsDecorating] = useState(false);
  const [activeItem, setActiveItem] = useState<string | null>(null);
  const [isPlacementBlocked, setIsPlacementBlocked] = useState(false);
  const [layout, setLayout] = useState(loadRoomLayout);
  const [isMemoryOpen, setIsMemoryOpen] = useState(false);
  const [memories, setMemories] = useState<MemoryPhoto[]>(loadMemories);

  useEffect(() => {
    localStorage.setItem(ROOM_LAYOUT_KEY, JSON.stringify(layout));
  }, [layout]);

  useEffect(() => {
    try {
      localStorage.setItem(MEMORIES_KEY, JSON.stringify(memories));
    } catch {
      // 相册已达到浏览器本地存储上限时，保留当前页面中的照片预览。
    }
  }, [memories]);

  useEffect(() => {
    if (!appRef.current) return;
    return startGame(appRef.current);
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

  function addMemoryPhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !file.type.startsWith("image/") || file.size > 1_500_000 || memories.length >= 6) return;
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const source = reader.result;
      if (typeof source !== "string") return;
      setMemories((current) => [...current, { id: `${Date.now()}-${Math.random()}`, src: source, title: file.name.replace(/\.[^.]+$/, "") }].slice(0, 6));
    });
    reader.readAsDataURL(file);
  }

  function removeMemory(id: string) {
    setMemories((current) => current.filter((memory) => memory.id !== id));
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
    const grid = 40;
    const width = Number(item.width) || 80;
    const height = Number(item.height) || 80;
    const maxX = 100 - width / worldWidth * 100;
    const candidate = {
      x: Math.min(maxX, Math.max(2, Math.round((drag.layout.x * worldWidth / 100 + deltaX) / grid) * grid / worldWidth * 100)),
      y: Math.min(120, Math.max(0, Math.round((drag.layout.y - deltaY) / grid) * grid)),
    };

    const blocked = isFurniturePlacementBlocked(drag.id, candidate, layout, worldWidth);
    setIsPlacementBlocked(blocked);
    if (!blocked) setLayout((current) => ({ ...current, [drag.id]: candidate }));
  }

  function endFurnitureDrag(event: React.PointerEvent<HTMLButtonElement>) {
    const drag = furnitureDragRef.current;
    if (drag?.pointerId !== event.pointerId) return;
    if (drag.id === "toy") localStorage.removeItem("wenbebi-toy-position-v1");
    furnitureDragRef.current = null;
    setActiveItem(null);
    setIsPlacementBlocked(false);
  }

  return (
    <div ref={appRef} className="game-app" data-decorating={isDecorating || undefined} data-memory-open={isMemoryOpen || undefined}>
      <div id="viewport">
        <div id="world">
          <div className="room">
            <div className="wall" aria-hidden="true" />
            {roomSpots.map((spot) => {
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
                  data-decor-selected={activeItem === spot.id || undefined}
                  data-decor-blocked={activeItem === spot.id && isPlacementBlocked || undefined}
                  aria-label={spot.label}
                  onPointerDown={(event) => startFurnitureDrag(event, spot.id)}
                  onPointerMove={moveFurniture}
                  onPointerUp={endFurnitureDrag}
                  onPointerCancel={endFurnitureDrag}
                />
              );
            })}
            <div className="floor" aria-hidden="true" />
            <div className="baseboard" aria-hidden="true" />
          </div>
          <canvas id="fx" />
          <div className="pet" id="pet">
            <div className="talk-bubble" id="bubble" />
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

      <aside className="desk-plate" id="plate">
        <div className="desk-plate__top">
          <p className="desk-plate__name">{wenbebi.name}</p>
          <button type="button" className="desk-plate__decorate" aria-pressed={isDecorating} onClick={() => setIsDecorating((value) => !value)}>{isDecorating ? "完成" : "布置"}</button>
          <button type="button" className="desk-plate__menu" id="menuToggle" aria-expanded="false">菜单</button>
        </div>
        <p className="desk-plate__hint">摸摸她的头 · 点家具互动 · 拖空白处看房间</p>
        <div className="pet-stats" aria-label={`${wenbebi.name}的状态`}>
          <span>心情 <strong data-mood>--</strong></span>
          <span>亲密 <strong data-pats>--</strong></span>
          <span>精力 <strong data-energy>--</strong></span>
          <span>饱腹 <strong data-hunger>--</strong></span>
        </div>
        <div className="desk-plate__extra" id="plateExtra">
          <a className="desk-plate__studio" href="?studio">角色工坊</a>
          <label className="desk-plate__toggle"><input type="checkbox" id="followToggle" /><span className="label-mouse">跟着鼠标</span><span className="label-touch">跟着手指</span></label>
          <label className="desk-plate__toggle"><input type="checkbox" id="cameraToggle" defaultChecked />摄像机跟随</label>
          <label className="desk-plate__toggle"><input type="checkbox" id="flipToggle" />左右纠正</label>
          <label className="desk-plate__toggle"><input type="checkbox" id="clearToggle" />透明背景</label>
          <p className="desk-plate__keys">点击玩具筐丢球 · 方向键可散步</p>
        </div>
      </aside>

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
            <div className="memory-book__photos">
              {memories.map((memory) => (
                <figure className="memory-photo" key={memory.id}>
                  <img src={memory.src} alt={memory.title} />
                  <figcaption>{memory.title}</figcaption>
                  <button type="button" aria-label={`删除照片 ${memory.title}`} onClick={() => removeMemory(memory.id)}>x</button>
                </figure>
              ))}
              {memories.length < 6 && (
                <label className="memory-photo memory-photo--add">
                  <input type="file" accept="image/*" onChange={addMemoryPhoto} />
                  <span>+</span>
                  <small>添加照片</small>
                </label>
              )}
              {memories.length === 0 && <p className="memory-book__empty">留一张给今天的回忆</p>}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
