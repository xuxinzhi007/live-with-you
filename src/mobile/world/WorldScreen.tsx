/**
 * 小世界屏幕：房间横切视图 + 可交互物件 + 情境按钮。
 *
 * 只做展示与点击，规则全部来自 rooms.ts / actions.ts / useWorldGame。
 * 不在这里判断冷却、不在这里算数值、不在这里改存档。
 */
import { useCallback, useMemo, useState } from "react";
import { ROOMS, ROOM_ORDER, type RoomProp } from "./rooms";
import { applyPropAction } from "./actions";
import type { WorldRoomId } from "../engine/types";

interface WorldScreenProps {
  room: WorldRoomId;
  onEnterRoom: (room: WorldRoomId) => void;
  onPropAction: (prop: RoomProp) => { line: string; tone: string } | null;
  onBack: () => void;
}

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

export function WorldScreen({ room, onEnterRoom, onPropAction, onBack }: WorldScreenProps) {
  const def = ROOMS[room] ?? ROOMS.home;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [line, setLine] = useState<string>("");

  const selectable = useMemo(
    () => def.props.filter((p) => p.kind !== "rug"),
    [def.props],
  );

  const selected = useMemo(
    () => selectable.find((p) => p.id === selectedId) ?? null,
    [selectable, selectedId],
  );

  const handleClick = useCallback(
    (prop: RoomProp) => {
      setSelectedId(prop.id);
      if (prop.doorTo) {
        setSelectedId(null);
        setLine("");
        onEnterRoom(prop.doorTo);
        return;
      }
      const res = onPropAction(prop);
      setLine(res?.line ?? "");
    },
    [onEnterRoom, onPropAction],
  );

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

      <div className="nk-world-stage">
        <img className="nk-world-bg" src={ROOM_ART[room]} alt="" draggable={false} />

        <div className="nk-world-props">
          {selectable.map((prop) => (
            <button
              key={prop.id}
              type="button"
              className={`nk-world-prop${prop.id === selectedId ? " m-selected" : ""}`}
              style={{
                left: `${(prop.x / def.worldW) * 100}%`,
                width: `${(prop.w / def.worldW) * 100}%`,
              }}
              onClick={() => handleClick(prop)}
              aria-label={prop.label}
            >
              <img src={PROP_ART[prop.kind] ?? PROP_ART.door} alt="" draggable={false} />
              <span>{prop.label}</span>
            </button>
          ))}
        </div>
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
