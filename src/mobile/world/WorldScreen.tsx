/**
 * 小世界屏幕：房间横切视图 + 可交互物件 + 情境按钮。
 *
 * 只做展示与点击，规则全部来自 rooms.ts / actions.ts / useWorldGame。
 * 不在这里判断冷却、不在这里算数值、不在这里改存档。
 *
 * 渲染契约（P0，2026-11-13）：
 * - 世界高固定 1000（rooms.ts），舞台 aspect-ratio = worldW/1000，整图可见。
 * - 道具与角色全部用世界单位定位：left = x/worldW，bottom = (1000-y)/1000。
 * - z-index 按 y 排（y 越大越靠前），她走到 approach 再触发动作。
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ROOMS, ROOM_ORDER, type RoomProp } from "./rooms";
import { resolveAsset } from "./remote-assets";
import type { WorldRoomId } from "../engine/types";

interface WorldScreenProps {
  room: WorldRoomId;
  onEnterRoom: (room: WorldRoomId) => void;
  onPropAction: (prop: RoomProp) => { line: string; tone: string } | null;
  onBack: () => void;
}

const WORLD_H = 1000;
/** 她的身高（世界单位）。rooms.ts 注释：角色站立高 300 单位。 */
const HERO_H = 300;
const WALK_FRAME_MS = 110;

const PROP_ART: Record<string, string> = {
  bed: "assets/scenes/prop-bed.webp",
  desk: "assets/scenes/prop-desk.webp",
  shelf: "assets/scenes/prop-shelf.webp",
  plant: "assets/scenes/prop-plant.webp",
  rug: "assets/scenes/prop-rug.webp",
  ball: "assets/scenes/prop-ball.webp",
  tree: "assets/scenes/prop-tree.webp",
  lamp: "assets/scenes/prop-lamp.webp",
  fountain: "assets/scenes/prop-fountain.webp",
  stall: "assets/scenes/prop-stall.webp",
  bench: "assets/scenes/prop-bench.webp",
  door: "assets/scenes/prop-door.webp",
  crate: "assets/scenes/prop-crate.webp",
  plot: "assets/scenes/prop-plot.webp",
};

const ROOM_ART: Record<WorldRoomId, string> = {
  home: "assets/scenes/home.webp",
  garden: "assets/scenes/garden.webp",
  street: "assets/scenes/street.webp",
};

const HERO_FRAMES = {
  idle: "assets/characters/original/idle.webp",
  breathe: [1, 2, 3, 4].map((n) => `assets/characters/original/breathe-${n}.webp`),
  react: "assets/characters/original/react.webp",
  walk: [1, 2, 3, 4].map((n) => `assets/characters/original/walk-${n}.webp`),
};

interface HeroState {
  x: number;
  y: number;
  moving: boolean;
  reacting: boolean;
  frame: number;
}

export function WorldScreen({ room, onEnterRoom, onPropAction, onBack }: WorldScreenProps) {
  const def = ROOMS[room] ?? ROOMS.home;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [line, setLine] = useState<string>("");
  const [breatheIdx, setBreatheIdx] = useState(0);
  const [hero, setHero] = useState<HeroState>({
    x: def.defaultSpawn.x,
    y: def.defaultSpawn.y,
    moving: false,
    reacting: false,
    frame: 0,
  });
  const heroRef = useRef(hero);
  heroRef.current = hero;

  // 换房间：落到目标房间的出生点，清掉选中与台词
  useEffect(() => {
    setHero({ x: def.defaultSpawn.x, y: def.defaultSpawn.y, moving: false, reacting: false, frame: 0 });
    setSelectedId(null);
    setLine("");
  }, [room, def.defaultSpawn.x, def.defaultSpawn.y]);

  // 待机呼吸帧
  useEffect(() => {
    const id = window.setInterval(() => setBreatheIdx((n) => n + 1), 2600);
    return () => window.clearInterval(id);
  }, []);

  // 走路时轮播 walk 帧
  useEffect(() => {
    if (!hero.moving) return;
    const id = window.setInterval(() => {
      setHero((h) => ({ ...h, frame: (h.frame + 1) % HERO_FRAMES.walk.length }));
    }, WALK_FRAME_MS);
    return () => window.clearInterval(id);
  }, [hero.moving]);

  const walkTo = useCallback((target: { x: number; y: number }, done: () => void) => {
    const from = heroRef.current;
    const dist = Math.hypot(target.x - from.x, target.y - from.y);
    const duration = Math.min(900, 160 + dist * 1.05);
    setHero((h) => ({ ...h, x: target.x, y: target.y, moving: dist > 24, reacting: false }));
    window.setTimeout(() => {
      setHero((h) => ({ ...h, moving: false }));
      done();
    }, duration);
  }, []);

  const handleClick = useCallback(
    (prop: RoomProp) => {
      if (heroRef.current.moving) return;
      setSelectedId(prop.id);
      const target = prop.approach ?? { x: prop.x, y: Math.min(prop.y, 940) };
      if (prop.doorTo) {
        const doorTo = prop.doorTo;
        walkTo(target, () => {
          setSelectedId(null);
          setLine("");
          onEnterRoom(doorTo);
        });
        return;
      }
      walkTo(target, () => {
        setHero((h) => ({ ...h, reacting: true }));
        const res = onPropAction(prop);
        setLine(res?.line ?? "");
        window.setTimeout(() => setHero((h) => ({ ...h, reacting: false })), 1500);
      });
    },
    [onEnterRoom, onPropAction, walkTo],
  );

  const selectable = useMemo(() => def.props.filter((p) => p.kind !== "rug"), [def.props]);
  const selected = useMemo(
    () => selectable.find((p) => p.id === selectedId) ?? null,
    [selectable, selectedId],
  );

  const near = useCallback(
    (prop: RoomProp) => Math.abs(hero.x - prop.x) <= prop.w / 2 + 240,
    [hero.x],
  );

  const heroSrc = hero.moving
    ? resolveAsset(HERO_FRAMES.walk[hero.frame % HERO_FRAMES.walk.length])
    : hero.reacting
      ? resolveAsset(HERO_FRAMES.react)
      : resolveAsset(HERO_FRAMES.breathe[breatheIdx % HERO_FRAMES.breathe.length]);

  return (
    <section className="nk-full-view nk-world" aria-label={def.name}>
      <div className="nk-world-head">
        <button type="button" className="nk-world-back" onClick={onBack}>
          ‹ 返回大厅
        </button>
        <div className="nk-world-rooms">
          {ROOM_ORDER.map((rid) => (
            <button
              key={rid}
              type="button"
              className={`nk-world-room-tab${rid === room ? " m-active" : ""}`}
              onClick={() => {
                setSelectedId(null);
                setLine("");
                onEnterRoom(rid);
              }}
            >
              {ROOMS[rid].name}
            </button>
          ))}
        </div>
      </div>

      <div
        className="nk-world-stage"
        style={{
          aspectRatio: `${def.worldW} / ${WORLD_H}`,
          maxHeight: "56dvh",
          maxWidth: `calc(56dvh * ${(def.worldW / WORLD_H).toFixed(3)})`,
        }}
      >
        <img className="nk-world-bg" src={resolveAsset(ROOM_ART[room])} alt="" draggable={false} />

        {/* 地毯等无动作件是纯装饰；其余按世界单位摆放，y 越大越靠前 */}
        {def.props.map((prop) => {
          const interactive = Boolean(prop.action || prop.doorTo);
          const isSelected = prop.id === selectedId;
          const style: CSSProperties = {
            left: `${(prop.x / def.worldW) * 100}%`,
            width: `${(prop.w / def.worldW) * 100}%`,
            bottom: `${((WORLD_H - prop.y) / WORLD_H) * 100}%`,
            zIndex: 100 + Math.round(prop.y / 10),
          };
          const className = `nk-world-prop${isSelected ? " m-selected" : ""}${!interactive ? " m-decor" : ""}${interactive && near(prop) ? " m-near" : ""}`;
          const img = <img src={resolveAsset(PROP_ART[prop.kind] ?? PROP_ART.door)} alt="" draggable={false} />;
          const label = <span>{prop.label}</span>;
          if (!interactive) {
            return (
              <div key={prop.id} className={className} style={style}>
                {img}
                {label}
              </div>
            );
          }
          return (
            <button
              key={prop.id}
              type="button"
              className={className}
              style={style}
              onClick={() => handleClick(prop)}
              aria-label={prop.label}
            >
              {img}
              {label}
            </button>
          );
        })}

        <img
          className={`nk-world-hero${hero.moving ? " m-walk" : ""}`}
          src={heroSrc}
          alt="雯宝"
          draggable={false}
          style={{
            left: `${(hero.x / def.worldW) * 100}%`,
            height: `${(HERO_H / WORLD_H) * 100}%`,
            bottom: `${((WORLD_H - hero.y) / WORLD_H) * 100}%`,
            zIndex: 100 + Math.round(hero.y / 10),
          }}
        />
      </div>

      {line && <div className="nk-world-line">{line}</div>}

      {selected && (
        <div className="nk-world-actions">
          <button
            type="button"
            className="nk-world-action-btn"
            onClick={() => handleClick(selected)}
          >
            {selected.doorTo ? `去${ROOMS[selected.doorTo].name}` : `和${selected.label}待一会儿`}
          </button>
        </div>
      )}
    </section>
  );
}
