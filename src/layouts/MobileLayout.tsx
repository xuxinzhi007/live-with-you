import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { wenbebi } from "../game/data/pet";
import { requestCompanionChat, requestCompanionStatus } from "../game/companion";
import {
  SCENES,
  SceneId,
  SCENE_FURNITURE,
  SCENE_BACKGROUNDS,
  FurnitureItem,
} from "../mobile/data/scenes";
import {
  PET_ACTIONS,
  PetAction,
  getSpriteForAction,
  getDialogueForMood,
} from "../mobile/data/pet-actions";
import { getPlayerLook } from "../mobile/data/player-looks";
import { COPLAY_ACTIONS, type CoplayJuice } from "../mobile/data/coplay-actions";
import { preferredSlot } from "../mobile/data/slots";
import { getInteractionBlockMessage, relationshipLevel } from "../mobile/engine/game-rules";
import { useGameEngine } from "../mobile/engine/GameEngine";
import { useStagePresence } from "../mobile/engine/useStagePresence";
import { useCoupleRoom } from "../mobile/multiplayer/useCoupleRoom";
import { persistRoomId, readStoredRoomId } from "../mobile/multiplayer/room-code";
import { CharacterCreate } from "../mobile/CharacterCreate";
import { FindPartnerSheet } from "../mobile/FindPartnerSheet";
import { SceneStage } from "../mobile/SceneStage";
import "../mobile/mobile-layout.css";

// ============ 主组件 ============
export function MobileLayout() {
  const {
    state,
    ui,
    switchScene,
    selectFurniture,
    closeActionMenu,
    interactWithFurniture,
    petThePet,
    createPlayer,
    doCoplay,
  } = useGameEngine();
  const [tab, setTab] = useState<"home" | "collection" | "journal" | "chat">("home");
  const [petJuice, setPetJuice] = useState(false);
  const [selfJuice, setSelfJuice] = useState(false);
  const [peerJuice, setPeerJuice] = useState(false);
  const [coplayJuice, setCoplayJuice] = useState<CoplayJuice | null>(null);
  const [coplayOpen, setCoplayOpen] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(() => readStoredRoomId());
  const [metFlash, setMetFlash] = useState(false);
  const juiceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const peerActionSeen = useRef("");
  const localIdentity = useMemo(
    () => (state.player
      ? { playerId: state.player.playerId, name: state.player.name, lookId: state.player.lookId }
      : null),
    [state.player],
  );
  const room = useCoupleRoom(localIdentity, state.currentScene, roomId);
  const partner = room.peersInScene[0] ?? null;
  const hasPartner = Boolean(partner);
  const partnerLook = partner ? getPlayerLook(partner.lookId) : null;
  const homeOtherSlot = partner
    ? preferredSlot(partner.playerId, [state.player?.playerId ?? ""])
    : "R";
  const stage = useStagePresence(room.localSlot, homeOtherSlot);

  const enterRoom = useCallback((nextRoomId: string) => {
    setRoomId(nextRoomId);
    persistRoomId(nextRoomId);
  }, []);

  const leaveRoom = useCallback(() => {
    setRoomId(null);
    persistRoomId(null);
  }, []);

  const goScene = useCallback((sceneId: SceneId) => {
    if (sceneId === state.currentScene) return;
    closeActionMenu();
    setCoplayOpen(false);
    stage.runSceneChange(() => switchScene(sceneId));
  }, [state.currentScene, closeActionMenu, stage, switchScene]);
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState("");
  const [lastFailedText, setLastFailedText] = useState("");
  const [chatTurns, setChatTurns] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([]);
  const [companionStatus, setCompanionStatus] = useState<{ model?: string; models?: { name: string }[] } | null>(null);
  const [companionStatusState, setCompanionStatusState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [companionStatusError, setCompanionStatusError] = useState("");
  const [dialogue, setDialogue] = useState<string | null>(null);
  const dialogueTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sceneAreaRef = useRef<HTMLDivElement>(null);
  const chatLogRef = useRef<HTMLDivElement>(null);

  const currentScene = SCENES.find((s) => s.id === state.currentScene)!;
  const furniture = SCENE_FURNITURE[state.currentScene] || [];
  const bg = SCENE_BACKGROUNDS[state.currentScene];
  const petSprite = getSpriteForAction(state.pet.currentAction);
  const level = relationshipLevel(state.bond);
  const levelProgress = Math.round((state.bond % 24) / 24 * 100);
  const relationshipName = level >= 8 ? "最好的朋友" : level >= 5 ? "形影不离" : level >= 2 ? "小伙伴" : "刚认识";

  const showDialogue = useCallback((text: string) => {
    if (dialogueTimer.current) clearTimeout(dialogueTimer.current);
    setDialogue(text);
    dialogueTimer.current = setTimeout(() => setDialogue(null), 3000);
  }, []);

  useEffect(() => () => {
    if (dialogueTimer.current) clearTimeout(dialogueTimer.current);
    if (juiceTimer.current) clearTimeout(juiceTimer.current);
  }, []);

  const triggerPetJuice = useCallback(() => {
    setPetJuice(true);
    if (juiceTimer.current) clearTimeout(juiceTimer.current);
    juiceTimer.current = setTimeout(() => setPetJuice(false), 480);
  }, []);

  const triggerCoplayJuice = useCallback((juice: CoplayJuice | null, withPeer = false) => {
    if (!juice) return;
    setCoplayJuice(juice);
    setSelfJuice(true);
    if (withPeer) setPeerJuice(true);
    else setPetJuice(true);
    if (juiceTimer.current) clearTimeout(juiceTimer.current);
    juiceTimer.current = setTimeout(() => {
      setPetJuice(false);
      setSelfJuice(false);
      setPeerJuice(false);
      setCoplayJuice(null);
    }, 520);
  }, []);

  const handleCoplay = useCallback((actionId: string) => {
    const result = doCoplay(actionId);
    if (result.blockedMessage) {
      showDialogue(result.blockedMessage);
      return;
    }
    setCoplayOpen(false);
    const action = COPLAY_ACTIONS.find((item) => item.id === actionId);
    if (action) {
      stage.approachCoplay(action.juice, state.currentScene, furniture, true);
    }
    room.broadcastCoplay(actionId);
    // 短位移后再出 juice，避免「走很久」
    window.setTimeout(() => {
      triggerCoplayJuice(result.juice, hasPartner);
      if (result.dialogue) showDialogue(result.dialogue);
    }, stage.approachMs);
  }, [
    doCoplay,
    showDialogue,
    triggerCoplayJuice,
    room.broadcastCoplay,
    hasPartner,
    stage,
    state.currentScene,
    furniture,
  ]);

  const playerLook = state.player ? getPlayerLook(state.player.lookId) : null;

  useEffect(() => {
    if (!room.joinedFlashName) return;
    setMetFlash(true);
    showDialogue(`${room.joinedFlashName} 来了。`);
    const timer = setTimeout(() => setMetFlash(false), 1600);
    return () => clearTimeout(timer);
  }, [room.joinedFlashName, showDialogue]);

  useEffect(() => {
    if (!partner || partner.action === "idle") return;
    const key = `${partner.playerId}:${partner.action}:${partner.actionStartedAt}`;
    if (key === peerActionSeen.current) return;
    peerActionSeen.current = key;
    const action = COPLAY_ACTIONS.find((item) => item.id === partner.action);
    if (action) {
      stage.approachCoplay(action.juice, state.currentScene, furniture, true);
      window.setTimeout(() => {
        triggerCoplayJuice(action.juice, true);
        showDialogue(`${partner.name}：${action.dialogue}`);
      }, stage.approachMs);
    } else {
      setPeerJuice(true);
      if (juiceTimer.current) clearTimeout(juiceTimer.current);
      juiceTimer.current = setTimeout(() => setPeerJuice(false), 480);
    }
  }, [partner, showDialogue, triggerCoplayJuice, stage, state.currentScene, furniture]);

  const handleFurnitureClick = useCallback(
    (item: FurnitureItem, x: number, y: number) => {
      setCoplayOpen(false);
      if (item.type === "portal" && item.targetScene) {
        goScene(item.targetScene);
        if (item.dialogue) showDialogue(item.dialogue);
        return;
      }
      if (item.actions.length > 0) {
        // 先短位移到锚点，再出菜单；菜单开着时先别自动回位
        stage.approachFurniture(item, hasPartner, { sticky: true });
        window.setTimeout(() => {
          selectFurniture(item.id, { x, y });
        }, Math.min(stage.approachMs, 420));
        if (item.dialogue) showDialogue(item.dialogue);
      }
    },
    [goScene, selectFurniture, showDialogue, stage, hasPartner]
  );

  const handleAction = useCallback(
    (action: PetAction) => {
      if (!ui.selectedFurniture) return;
      const selectedItem = furniture.find((item) => item.id === ui.selectedFurniture);
      if (!selectedItem) {
        closeActionMenu();
        return;
      }
      const blockedMessage = getInteractionBlockMessage(state, selectedItem, action.id);
      if (blockedMessage) {
        showDialogue(blockedMessage);
        closeActionMenu();
        return;
      }
      stage.approachFurniture(selectedItem, hasPartner);
      interactWithFurniture(ui.selectedFurniture, action.id);
      showDialogue(action.dialogue || getDialogueForMood(action.mood));
      closeActionMenu();
    },
    [
      ui.selectedFurniture,
      state,
      furniture,
      interactWithFurniture,
      closeActionMenu,
      showDialogue,
      stage,
      hasPartner,
    ]
  );

  const handleCloseActionMenu = useCallback(() => {
    closeActionMenu();
    stage.scheduleReturnHome();
  }, [closeActionMenu, stage]);

  const currentFurniture = ui.selectedFurniture
    ? furniture.find((item) => item.id === ui.selectedFurniture)
    : null;
  const availableActions = currentFurniture
    ? PET_ACTIONS.filter((action) => currentFurniture.actions.includes(action.id))
    : [];
  const sceneRect = sceneAreaRef.current?.getBoundingClientRect();
  const menuWidth = Math.min(280, (sceneRect?.width || window.innerWidth) - 24);
  const menuStyle: React.CSSProperties = ui.actionMenuPosition
    ? {
        left: Math.max(12, Math.min(ui.actionMenuPosition.x - menuWidth / 2, (sceneRect?.width || window.innerWidth) - menuWidth - 12)),
        top: Math.max(126, Math.min(ui.actionMenuPosition.y - 96, (sceneRect?.height || window.innerHeight) - 190)),
      }
    : { left: "50%", top: "50%", transform: "translate(-50%, -50%)" };

  const checkCompanionStatus = useCallback(async () => {
    setCompanionStatusState("loading");
    setCompanionStatusError("");
    try {
      const next = await requestCompanionStatus() as { model?: string; models?: { name: string }[] };
      setCompanionStatus(next);
      setCompanionStatusState("ready");
    } catch (error) {
      setCompanionStatusError(error instanceof Error ? error.message : "无法连接 Ollama");
      setCompanionStatusState("error");
    }
  }, []);

  useEffect(() => {
    if (tab === "chat" && companionStatusState === "idle") void checkCompanionStatus();
  }, [tab, companionStatusState, checkCompanionStatus]);

  const sendMessage = useCallback(async (submittedText = chatInput, appendUserMessage = true) => {
    const text = submittedText.trim();
    if (!text || chatBusy) return;

    const history = chatTurns.slice(-8);
    setChatError("");
    setLastFailedText("");
    setChatBusy(true);
    setChatInput("");
    if (appendUserMessage) {
      setChatMessages((previous) => [...previous, { role: "user" as const, text }].slice(-16));
    }

    try {
      const result = await requestCompanionChat(text, history) as { reply?: unknown };
      if (typeof result?.reply !== "string" || !result.reply.trim()) throw new Error("雯宝这次没有收到回复，请再试一次。");
      const reply = result.reply.trim();
      setChatTurns((previous) => [...previous, { role: "user" as const, content: text }, { role: "assistant" as const, content: reply }].slice(-12));
      setChatMessages((previous) => [...previous, { role: "assistant" as const, text: reply }].slice(-16));
      setCompanionStatusState("ready");
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "暂时无法连接雯宝的对话服务");
      setLastFailedText(text);
      setChatInput(text);
    } finally {
      setChatBusy(false);
    }
  }, [chatInput, chatBusy, chatTurns]);

  const quickPrompts = [
    "今天你过得怎么样？",
    `我现在在${currentScene.name}，陪我聊聊这里吧。`,
    "我想和你安静地待一会儿。",
  ];

  useEffect(() => {
    if (tab === "chat" && chatLogRef.current) {
      chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight;
    }
  }, [tab, chatMessages, chatBusy, chatError]);

  const modelName = companionStatus?.model || "Ollama";
  const modelAvailable = !companionStatus?.models?.length
    || companionStatus.models.some((model) => model.name === companionStatus.model);
  const chatStatusText = companionStatusState === "loading"
    ? "正在连接模型…"
    : companionStatusState === "error"
      ? companionStatusError || "模型暂时无法连接"
      : companionStatusState === "ready"
        ? modelAvailable ? `已连接 · ${modelName}` : `已连接，但未找到 ${modelName}`
        : "等待连接模型";

  if (!state.player) {
    return (
      <div id="mobile-game-root">
        <CharacterCreate companionName={wenbebi.name} onCreate={createPlayer} />
      </div>
    );
  }

  const presenceLabel = hasPartner
    ? partner!.presence === "away"
      ? `${partner!.name} 暂时离开`
      : `${partner!.name} 在场`
    : room.isInRoom
      ? "等待对方加入"
      : "点此找对方";

  return (
    <>

      <div id="mobile-game-root">
        <header className="m-hud">
          <div className="m-hud-brand">
            <img
              className="m-hud-avatar"
              src={playerLook?.src ?? `assets/${wenbebi.sprites.idle}.webp`}
              alt=""
              style={playerLook ? { filter: playerLook.filter } : undefined}
              draggable={false}
            />
            <div className="m-hud-name">
              <strong>{state.player.name}</strong>
              <button
                type="button"
                className="m-hud-presence m-hud-presence-btn"
                aria-expanded={findOpen}
                aria-controls="m-find-sheet"
                onClick={() => {
                  setCoplayOpen(false);
                  setFindOpen(true);
                }}
              >
                <span
                  className={`m-dot${hasPartner ? (partner!.presence === "away" ? " m-dot--away" : " m-dot--online") : " m-dot--wait"}`}
                  aria-hidden="true"
                />
                {presenceLabel}
              </button>
            </div>
          </div>
          <div className="m-hud-right">
            <button
              type="button"
              className={`m-find-entry${room.isInRoom ? " m-in-room" : ""}`}
              aria-expanded={findOpen}
              aria-controls="m-find-sheet"
              onClick={() => {
                setCoplayOpen(false);
                setFindOpen(true);
              }}
            >
              {hasPartner ? "同房" : "找对方"}
            </button>
            <div className="m-currency" aria-label={`零钱 ${state.coins}`}><span aria-hidden="true">🪙</span><strong>{state.coins}</strong></div>
            <button className="m-header-action" type="button" aria-label="打开手账" title="打开手账" onClick={() => setTab("journal")}>▤</button>
          </div>
        </header>

        <main className="m-main">
          {tab === "home" && (
            <div className={`m-scene-area${stage.sceneFade ? " m-scene-fading" : ""}`} ref={sceneAreaRef}>
              <SceneStage
                sceneId={state.currentScene}
                furniture={furniture}
                wall={bg.wall}
                floor={bg.floor}
                selfPose={stage.selfPose}
                otherPose={stage.otherPose}
                selfName={state.player.name}
                selfLook={playerLook ? { src: playerLook.src, filter: playerLook.filter } : null}
                hasPartner={hasPartner}
                partnerLook={partnerLook ? { src: partnerLook.src, filter: partnerLook.filter } : null}
                partnerName={partner?.name ?? ""}
                partnerColor={partner?.color ?? "#6b7fd7"}
                partnerAway={partner?.presence === "away"}
                petSprite={petSprite}
                petName={wenbebi.name}
                selfJuice={selfJuice}
                peerJuice={peerJuice}
                petJuice={petJuice}
                coplayJuice={coplayJuice}
                metFlash={metFlash}
                onFurnitureClick={handleFurnitureClick}
                onPetClick={() => {
                  petThePet();
                  triggerPetJuice();
                  showDialogue(getDialogueForMood("happy"));
                }}
              />
              <div className="m-scene-fade" aria-hidden="true" />

              <nav className="m-location-nav" aria-label="选择地点">
                {SCENES.map((scene) => (
                  <button
                    key={scene.id}
                    type="button"
                    className={`m-location-btn${scene.id === state.currentScene ? " m-active" : ""}`}
                    aria-current={scene.id === state.currentScene ? "location" : undefined}
                    onClick={() => goScene(scene.id)}
                  >
                    <span aria-hidden="true">{scene.icon}</span>{scene.name}
                  </button>
                ))}
              </nav>

              <div className="m-scene-actions">
                {!hasPartner && (
                  <button
                    type="button"
                    className="m-find-fab"
                    onClick={() => {
                      closeActionMenu();
                      setCoplayOpen(false);
                      setFindOpen(true);
                    }}
                  >
                    找对方
                  </button>
                )}
                <button
                  type="button"
                  className={`m-coplay-entry${coplayOpen ? " m-open" : ""}`}
                  aria-expanded={coplayOpen}
                  aria-controls="m-coplay-sheet"
                  onClick={() => {
                    closeActionMenu();
                    setFindOpen(false);
                    setCoplayOpen((open) => !open);
                  }}
                >
                  一起做
                </button>
              </div>

              {coplayOpen && (
                <div className="m-coplay-layer" role="presentation">
                  <button
                    type="button"
                    className="m-coplay-scrim"
                    aria-label="关闭一起做"
                    onClick={() => setCoplayOpen(false)}
                  />
                  <div
                    id="m-coplay-sheet"
                    className="m-coplay-sheet"
                    role="dialog"
                    aria-label="选择一起做的事"
                  >
                    <div className="m-coplay-sheet-head">
                      <p>{hasPartner ? `和 ${partner!.name} 一起` : `和 ${wenbebi.name} 一起`}</p>
                      <button type="button" className="m-coplay-close" aria-label="关闭" onClick={() => setCoplayOpen(false)}>
                        ×
                      </button>
                    </div>
                    <div className="m-coplay-grid">
                      {COPLAY_ACTIONS.map((action) => (
                        <button
                          key={action.id}
                          type="button"
                          className="m-coplay-cell"
                          onClick={() => handleCoplay(action.id)}
                        >
                          <span className="m-coplay-cell-icon" aria-hidden="true">{action.icon}</span>
                          <span>{action.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {dialogue && (
                <div className="m-dialogue" style={{ left: "50%", bottom: "18%", transform: "translateX(-50%)" }} aria-live="polite">
                  {dialogue}
                </div>
              )}

              {ui.showActionMenu && currentFurniture && availableActions.length > 0 && (
                <div className="m-action-menu" style={menuStyle} role="group" aria-label={`${currentFurniture.label || currentFurniture.id}的互动`}>
                  <div className="m-action-heading">{currentFurniture.label || accessibleFurnitureName(currentFurniture.id)}</div>
                  {availableActions.map((action) => (
                    <button key={action.id} type="button" className="m-action-btn" onClick={(event) => { event.stopPropagation(); handleAction(action); }}>
                      <span className="m-action-icon" aria-hidden="true">{action.icon}</span>
                      <span>{action.label}</span>
                    </button>
                  ))}
                  <button type="button" className="m-action-btn" onClick={(event) => { event.stopPropagation(); handleCloseActionMenu(); }}>
                    <span className="m-action-icon" aria-hidden="true">×</span><span>收起</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {tab === "collection" && (
            <section className="m-screen" aria-labelledby="collection-title">
              <div className="m-screen-heading">
                <div><h1 id="collection-title">收藏与成长</h1><p>一起走过的地方和留下的小东西</p></div>
                <span className="m-count-label">探索 {state.exploredScenes.length} / {SCENES.length}</span>
              </div>
              <div className="m-level-card">
                <div className="m-level-top"><strong>Lv.{level} · {relationshipName}</strong><span>{state.bond} 亲密</span></div>
                <div className="m-progress-track"><div className="m-progress-fill" style={{ width: `${levelProgress}%` }} /></div>
                <div className="m-level-caption"><span>下一枚纪念章</span><span>{state.bond % 24} / 24</span></div>
              </div>
              <div className="m-inventory-grid">
                <div className="m-inventory-card"><span className="m-inventory-icon">🪙</span><span className="m-inventory-copy"><small>零钱</small><strong>{state.coins}</strong></span></div>
                <div className="m-inventory-card"><span className="m-inventory-icon">🌱</span><span className="m-inventory-copy"><small>花种</small><strong>{state.seeds}</strong></span></div>
                <div className="m-inventory-card"><span className="m-inventory-icon">💐</span><span className="m-inventory-copy"><small>花朵</small><strong>{state.flowers}</strong></span></div>
                <div className="m-inventory-card"><span className="m-inventory-icon">🎖️</span><span className="m-inventory-copy"><small>纪念物</small><strong>{state.mementos}</strong></span></div>
              </div>
              <h2 className="m-section-label">一起去过的地方</h2>
              <div className="m-place-row">
                {SCENES.map((scene) => (
                  <span key={scene.id} className={`m-place-chip${state.exploredScenes.includes(scene.id) ? "" : " m-unseen"}`}>
                    {state.exploredScenes.includes(scene.id) ? "✓ " : "· "}{scene.icon} {scene.name}
                  </span>
                ))}
              </div>
            </section>
          )}

          {tab === "journal" && (
            <section className="m-screen" aria-labelledby="journal-title">
              <div className="m-screen-heading"><div><h1 id="journal-title">生活小记</h1><p>那些一起度过的片刻</p></div></div>
              <h2 className="m-section-label">最近的日子</h2>
              <div className="m-journal-list">
                {state.journal.length ? state.journal.map((entry) => (
                  <article className="m-journal-entry" key={entry.id}>
                    <span className="m-journal-dot" aria-hidden="true" />
                    <div><p>{entry.text}</p><time>{new Date(entry.time).toLocaleDateString("zh-CN", { month: "long", day: "numeric" })}</time></div>
                  </article>
                )) : <p className="m-empty-journal">新的一页还空着。探索时，新的故事会留在这里。</p>}
              </div>
              <a className="m-text-link" href="?desktop">打开桌面版</a>
            </section>
          )}

          {tab === "chat" && (
            <section className="m-screen m-chat-screen" aria-labelledby="chat-title">
              <div className="m-screen-heading"><div><h1 id="chat-title">和雯宝聊会儿</h1><p>{currentScene.name} · 她就在你身边</p></div></div>
              <div className={`m-chat-status${companionStatusState === "ready" && modelAvailable ? " m-connected" : ""}${companionStatusState === "error" || (companionStatusState === "ready" && !modelAvailable) ? " m-error" : ""}`} role="status">
                <span className="m-chat-status-copy"><span className="m-chat-status-dot" aria-hidden="true" />{chatStatusText}</span>
                <button className="m-chat-retry" type="button" onClick={() => void checkCompanionStatus()} disabled={companionStatusState === "loading"}>
                  {companionStatusState === "loading" ? "连接中" : companionStatusState === "error" ? "重试连接" : "刷新状态"}
                </button>
              </div>
              <div className="m-chat-card">
                <div className="m-chat-log" ref={chatLogRef} aria-live="polite" aria-relevant="additions text">
                  {!chatMessages.length && !chatBusy && <p className="m-chat-empty">今天想和雯宝聊些什么？</p>}
                  {chatMessages.map((message, index) => (
                    <div key={`${index}-${message.role}`} className={`m-chat-msg${message.role === "user" ? " m-user" : ""}`}>{message.text}</div>
                  ))}
                  {chatBusy && <div className="m-chat-msg m-chat-thinking" role="status">雯宝正在想…</div>}
                </div>
                {!chatMessages.length && <div className="m-chat-topics" aria-label="聊天开场">
                  {quickPrompts.map((prompt) => (
                    <button key={prompt} type="button" className="m-topic-btn" onClick={() => void sendMessage(prompt)} disabled={chatBusy}>{prompt}</button>
                  ))}
                </div>}
                {chatError && <div className="m-chat-error" role="alert"><span>{chatError}</span>{lastFailedText && <button className="m-chat-retry" type="button" onClick={() => void sendMessage(lastFailedText, false)} disabled={chatBusy}>重试发送</button>}</div>}
                <form className="m-chat-compose" onSubmit={(event) => { event.preventDefault(); void sendMessage(); }}>
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(event) => setChatInput(event.target.value)}
                    placeholder="和雯宝说说话…"
                    aria-label="输入要对雯宝说的话"
                    maxLength={400}
                    disabled={chatBusy}
                  />
                  <button className="m-chat-send" type="submit" disabled={chatBusy || !chatInput.trim()}>{chatBusy ? "发送中" : "发送"}</button>
                </form>
              </div>
            </section>
          )}
        </main>

        <nav className="m-tabbar" aria-label="游戏导航">
          <button type="button" className={`m-tab-btn${tab === "home" ? " m-active" : ""}`} aria-current={tab === "home" ? "page" : undefined} onClick={() => { setCoplayOpen(false); setFindOpen(false); setTab("home"); }}>
            <span className="m-tab-icon" aria-hidden="true">🏠</span><span>陪伴</span>
          </button>
          <button type="button" className={`m-tab-btn${tab === "collection" ? " m-active" : ""}`} aria-current={tab === "collection" ? "page" : undefined} onClick={() => { setCoplayOpen(false); setFindOpen(false); setTab("collection"); }}>
            <span className="m-tab-icon" aria-hidden="true">🎒</span><span>收藏</span>
          </button>
          <button type="button" className={`m-tab-btn${tab === "journal" ? " m-active" : ""}`} aria-current={tab === "journal" ? "page" : undefined} onClick={() => { setCoplayOpen(false); setFindOpen(false); setTab("journal"); }}>
            <span className="m-tab-icon" aria-hidden="true">📔</span><span>手账</span>
          </button>
          <button type="button" className={`m-tab-btn${tab === "chat" ? " m-active" : ""}`} aria-current={tab === "chat" ? "page" : undefined} onClick={() => { setCoplayOpen(false); setFindOpen(false); setTab("chat"); }}>
            <span className="m-tab-icon" aria-hidden="true">💬</span><span>聊聊</span>
          </button>
        </nav>

        {/* 盖住底栏：避免短码面板被 tabbar 裁切 */}
        <FindPartnerSheet
          open={findOpen}
          roomId={roomId}
          hasPartner={hasPartner}
          partnerName={partner?.name}
          onClose={() => setFindOpen(false)}
          onEnterRoom={(nextId) => {
            enterRoom(nextId);
          }}
          onLeaveRoom={leaveRoom}
        />
      </div>
    </>
  );
}

function accessibleFurnitureName(id: string) {
  const names: Record<string, string> = {
    "window-a": "窗边", "window-b": "窗边", "plant-a": "小盆栽", bed: "床铺", "toy-box": "玩具箱",
    armchair: "扶手椅", "record-player": "唱片机", lamp: "小台灯", desk: "书桌", snack: "点心",
    "home-door": "出门", "balcony-plant": "阳台花盆", "balcony-chair": "阳台椅", railing: "栏杆",
    "sky-view": "天空", "balcony-exit": "下楼", "street-fountain": "喷泉", "street-flower": "街边花摊",
    "street-bench": "长椅", "street-sign": "路牌", "street-gate": "回家", "cafe-counter": "咖啡吧台",
    "cafe-table": "靠窗桌", "cafe-exit": "离开咖啡馆",
  };
  return names[id] || "场景物件";
}
