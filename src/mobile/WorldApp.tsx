import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { WorldView, type WorldViewHandle } from "./world/WorldView";
import { useWorldGame } from "./world/useWorldGame";
import { getRoom, type RoomProp } from "./world/rooms";
import {
  cooldownLeftMs,
  plotActionLabel,
  plotHint,
} from "./world/actions";
import {
  FLOWER_KINDS,
  FLOWER_META,
  plotRemainingMs,
  plotStage,
} from "./world/state";
import { CHARACTER_SKIN_LIST, getCharacterSkin } from "./world/skins";
import "./world.css";

type Sheet = "bag" | "journal" | "more" | null;
type Tone = "ok" | "blocked" | "reward";

interface Spawn {
  room: string;
  x: number;
  y: number;
}

function dayPart(hour: number): string {
  if (hour < 6) return "深夜";
  if (hour < 10) return "清晨";
  if (hour < 12) return "上午";
  if (hour < 14) return "午后";
  if (hour < 18) return "下午";
  if (hour < 21) return "傍晚";
  return "夜里";
}

function ctaLabel(
  nearest: RoomProp | null,
  state: ReturnType<typeof useWorldGame>["state"],
  now: number,
): { label: string; kind: "action" | "door" | "wait"; seconds?: number } | null {
  if (!nearest) return null;
  if (nearest.doorTo) return { label: nearest.label, kind: "door" };
  const wait = cooldownLeftMs(state, nearest.id, now);
  if (wait > 0) {
    return { label: "过一会儿", kind: "wait", seconds: Math.ceil(wait / 1000) };
  }
  const plots = state.world.plots;
  switch (nearest.action) {
    case "rest":
      return { label: "躺一会儿", kind: "action" };
    case "read":
      return { label: "看看书", kind: "action" };
    case "shelf":
      return { label: "看看收藏架", kind: "action" };
    case "plot": {
      const plot = plots[nearest.plotIndex ?? 0];
      const stage = plotStage(plot, now);
      if (plot && plot.kind && stage < 3 && plot.wateredAt) {
        return {
          label: "等开花",
          kind: "wait",
          seconds: Math.ceil(plotRemainingMs(plot, now) / 1000),
        };
      }
      return {
        label: plotActionLabel(plot, now),
        kind: "action",
      };
    }
    case "buySeed":
      return { label: "买花种 · 6 零钱", kind: "action" };
    case "wish":
      return { label: "许个愿 · 1 零钱", kind: "action" };
    case "sit":
      return { label: "坐一会儿", kind: "action" };
    case "playBall":
      return { label: "踢球", kind: "action" };
    default:
      return { label: nearest.label || "看看", kind: "action" };
  }
}

export function WorldApp() {
  const { state, runProp, enterRoom, catchBall, recordKick, setSkin, markIntroSeen } = useWorldGame();
  const world = state.world;
  const room = getRoom(world.room);
  const skin = getCharacterSkin(world.skin);
  const viewRef = useRef<WorldViewHandle>(null);

  const [spawn, setSpawn] = useState<Spawn>(() => ({
    room: world.room,
    x: room.defaultSpawn.x,
    y: room.defaultSpawn.y,
  }));
  const [sheet, setSheet] = useState<Sheet>(null);
  const [nearest, setNearest] = useState<RoomProp | null>(null);
  const [toast, setToast] = useState<{ text: string; tone: Tone; id: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const showToast = useCallback((text: string, tone: Tone = "ok") => {
    setToast({ text, tone, id: Date.now() });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const handleAction = useCallback((prop: RoomProp) => {
    const outcome = runProp(prop);
    if (outcome.line) showToast(outcome.line, outcome.tone);
  }, [runProp, showToast]);

  const handleDoor = useCallback((prop: RoomProp) => {
    if (!prop.doorTo) return;
    const target = getRoom(prop.doorTo);
    enterRoom(prop.doorTo);
    const at = prop.spawn ?? target.defaultSpawn;
    setSpawn({ room: prop.doorTo, x: at.x, y: at.y });
    setNearest(null);
    showToast(`去了${target.name}。`, "ok");
  }, [enterRoom, showToast]);

  const handleKick = useCallback(() => {
    recordKick();
    showToast("球飞出去了，点球接住。", "ok");
  }, [recordKick, showToast]);

  const handleCatch = useCallback((combo: number) => {
    catchBall(combo);
    const lines = ["接住了！", "稳稳接住。", "球在手里了。"];
    showToast(`${lines[combo % lines.length]}${combo > 1 ? ` 连续 ${combo} 次` : ""}`, "reward");
  }, [catchBall, showToast]);

  const handleMiss = useCallback((combo: number) => {
    if (combo >= 2) showToast(`连击停在 ${combo}，再来一次。`, "blocked");
    else showToast("球落地了，再踢一次。", "ok");
  }, [showToast]);

  /** 点角色：给一句当下的状态，不弹菜单。 */
  const handleTapPlayer = useCallback(() => {
    const lines = state.pet.energy < 34
      ? ["有点困了，床看起来好软。", "想找个地方坐一会儿。"]
      : state.pet.happiness < 40
        ? ["今天有点安静，想出去走走。", "要不要去庭院看看花？"]
        : ["嗯？我在呢。", "今天想种点什么。", "点地面，我就过去。"];
    showToast(lines[Math.floor(Math.random() * lines.length)], "ok");
  }, [state.pet.energy, state.pet.happiness, showToast]);

  const cta = useMemo(
    () => ctaLabel(nearest, state, now),
    [nearest, state, now],
  );

  const flowerSummary = FLOWER_KINDS
    .filter((kind) => (world.collection[kind] ?? 0) > 0)
    .map((kind) => `${FLOWER_META[kind].name}×${world.collection[kind]}`);

  const showIntro = !world.seenIntro;

  return (
    <div id="world-root">
      <div className="world-stage">
        <WorldView
          ref={viewRef}
          roomId={world.room}
          skin={world.skin}
          spawn={{ x: spawn.x, y: spawn.y }}
          plots={world.plots}
          onAction={handleAction}
          onDoor={handleDoor}
          onCatch={handleCatch}
          onMiss={handleMiss}
          onNearest={setNearest}
          onKick={handleKick}
          onTapPlayer={handleTapPlayer}
        />

        <header className="world-top">
          <div className="world-id">
            <img src={skin.avatar} alt="" draggable={false} />
            <div>
              <strong>雯宝</strong>
              <span>{room.name} · {dayPart(new Date(now).getHours())}</span>
            </div>
          </div>
          <div className="world-pills">
            <span className="world-pill" aria-label={`零钱 ${state.coins}`}>
              <span aria-hidden="true">🪙</span><b>{state.coins}</b>
            </span>
            <span className="world-pill" aria-label={`花种 ${state.seeds}`}>
              <span aria-hidden="true">🌱</span><b>{state.seeds}</b>
            </span>
          </div>
        </header>

        {toast && (
          <div key={toast.id} className={`world-toast m-${toast.tone}`} role="status" aria-live="polite">
            {toast.text}
          </div>
        )}

        {cta?.kind === "wait" ? (
          <div className="world-cta m-wait" aria-live="polite">
            {cta.label} <small>{cta.seconds} 秒后可再试</small>
          </div>
        ) : cta ? (
          <button
            type="button"
            className="world-cta"
            onClick={() => viewRef.current?.activateNearest()}
          >
            {cta.label}
          </button>
        ) : (
          <div className="world-hint">点地面走过去 · 点物件互动</div>
        )}
      </div>

      <nav className="world-nav" aria-label="游戏导航">
        <button type="button" className={sheet === "bag" ? "m-active" : ""} onClick={() => setSheet("bag")}>
          <span aria-hidden="true">🎒</span>背包
        </button>
        <button type="button" className={sheet === "journal" ? "m-active" : ""} onClick={() => setSheet("journal")}>
          <span aria-hidden="true">📔</span>手账
        </button>
        <button type="button" className={sheet === "more" ? "m-active" : ""} onClick={() => setSheet("more")}>
          <span aria-hidden="true">☰</span>更多
        </button>
      </nav>

      {sheet && (
        <div className="world-layer" role="presentation">
          <button type="button" className="world-scrim" aria-label="关闭面板" onClick={() => setSheet(null)} />
          <div className={`world-sheet${sheet === "more" ? " m-compact" : ""}`} role="dialog" aria-modal="true">
            <div className="world-sheet-head">
              <div>
                <h2>
                  {sheet === "bag" ? "背包与花圃" : sheet === "journal" ? "生活小记" : "更多"}
                </h2>
                <p>
                  {sheet === "bag"
                    ? `${room.name} · 花束 ${state.flowers} 朵`
                    : sheet === "journal"
                      ? `${state.journal.length} 条记录`
                      : "状态、提示与设置"}
                </p>
              </div>
              <button type="button" className="world-sheet-close" aria-label="关闭" onClick={() => setSheet(null)}>
                ×
              </button>
            </div>

            {sheet === "bag" && (
              <>
                <div className="world-stat-grid">
                  <div className="world-stat"><i aria-hidden="true">🪙</i><div><small>零钱</small><strong>{state.coins}</strong></div></div>
                  <div className="world-stat"><i aria-hidden="true">🌱</i><div><small>花种</small><strong>{state.seeds}</strong></div></div>
                  <div className="world-stat"><i aria-hidden="true">💐</i><div><small>花束</small><strong>{state.flowers}</strong></div></div>
                  <div className="world-stat"><i aria-hidden="true">🎖️</i><div><small>纪念</small><strong>{state.mementos}</strong></div></div>
                </div>

                <h3 className="world-subhead">花圃</h3>
                {world.plots.map((plot, index) => (
                  <div className="world-plot-row" key={index}>
                    <span>第 {index + 1} 块</span>
                    <strong>{plotHint(plot, now)}</strong>
                  </div>
                ))}

                <h3 className="world-subhead">收过的花</h3>
                <div className="world-chip-row">
                  {flowerSummary.length ? flowerSummary.map((text) => (
                    <span className="world-chip" key={text}>{text}</span>
                  )) : (
                    <span className="world-chip m-muted">还没有。去庭院种一朵。</span>
                  )}
                </div>
              </>
            )}

            {sheet === "journal" && (
              <div className="world-journal">
                {state.journal.length ? state.journal.map((entry) => (
                  <article className="world-journal-entry" key={entry.id}>
                    <i aria-hidden="true" />
                    <div>
                      <p>{entry.text}</p>
                      <time>{new Date(entry.time).toLocaleDateString("zh-CN", { month: "long", day: "numeric" })}</time>
                    </div>
                  </article>
                )) : <p className="world-empty">新的一页还空着。去房间里做点什么，这里会留下记录。</p>}
              </div>
            )}

            {sheet === "more" && (
              <>
                <div className="world-meter">
                  <div className="world-meter-head"><span>精力</span><span>{state.pet.energy} / 100</span></div>
                  <div className="world-meter-track"><div className="world-meter-fill" style={{ width: `${state.pet.energy}%` }} /></div>
                </div>
                <div className="world-meter">
                  <div className="world-meter-head"><span>心情</span><span>{state.pet.happiness} / 100</span></div>
                  <div className="world-meter-track"><div className="world-meter-fill m-warm" style={{ width: `${state.pet.happiness}%` }} /></div>
                </div>
                <div className="world-stat-grid">
                  <div className="world-stat"><i aria-hidden="true">🏅</i><div><small>最高连击</small><strong>{world.bestCombo}</strong></div></div>
                  <div className="world-stat"><i aria-hidden="true">🌷</i><div><small>种过</small><strong>{world.planted}</strong></div></div>
                  <div className="world-stat"><i aria-hidden="true">✂️</i><div><small>收过</small><strong>{world.harvested}</strong></div></div>
                  <div className="world-stat"><i aria-hidden="true">⚽</i><div><small>踢球</small><strong>{world.kicks}</strong></div></div>
                </div>

                <h3 className="world-subhead">角色外观</h3>
                <div className="world-skin-row" role="radiogroup" aria-label="角色外观">
                  {CHARACTER_SKIN_LIST.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      role="radio"
                      aria-checked={world.skin === item.id}
                      className={`world-skin-card${world.skin === item.id ? " m-active" : ""}`}
                      onClick={() => setSkin(item.id)}
                    >
                      <img src={item.avatar} alt="" draggable={false} />
                      <span>
                        <strong>{item.label}</strong>
                        <small>{item.note}</small>
                      </span>
                    </button>
                  ))}
                </div>

                <p className="world-note">
                  点地面走过去，靠近物件后点下方按钮。房间之间走门，不用切标签。这里没有每日任务，也没有体力墙。
                </p>
                <p className="world-note">
                  旧版界面仍在：<a href="?legacy">打开旧版</a>　桌面预览：<a href="?desktop">桌面版</a>
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {showIntro && (
        <div className="world-intro" role="dialog" aria-modal="true" aria-labelledby="world-intro-title">
          <div className="world-intro-card">
            <img src={skin.avatar} alt="" draggable={false} />
            <h2 id="world-intro-title">今天从哪儿开始？</h2>
            <p>点地面，雯宝就会走过去。靠近床、书桌或门，下方会出现对应的按钮。</p>
            <p>庭院能种花，街区能买花种。种下后等一会儿，回来收花。</p>
            <button type="button" onClick={markIntroSeen}>开始</button>
          </div>
        </div>
      )}
    </div>
  );
}
