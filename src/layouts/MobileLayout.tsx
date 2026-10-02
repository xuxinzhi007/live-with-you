import { useState, useCallback, useRef, useEffect } from "react";
import { wenbebi } from "../game/data/pet";
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
import { useGameEngine } from "../mobile/engine/GameEngine";

// ============ 内联样式 - 最高优先级隔离 ============
const STYLES = `
  /* ===== ROOT - 完全覆盖 ===== */
  #mobile-game-root {
    position: fixed !important;
    top: 0 !important; left: 0 !important;
    width: 100vw !important; height: 100dvh !important;
    max-height: 100dvh !important;
    overflow: hidden !important;
    background: #2c1810 !important;
    font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif !important;
    z-index: 999999 !important;
    margin: 0 !important; padding: 0 !important;
    display: flex !important;
    flex-direction: column !important;
    box-sizing: border-box !important;
    -webkit-tap-highlight-color: transparent !important;
    user-select: none !important;
    -webkit-user-select: none !important;
  }
  #mobile-game-root *,
  #mobile-game-root *::before,
  #mobile-game-root *::after {
    box-sizing: border-box !important;
    margin: 0 !important;
    padding: 0 !important;
    border: none !important;
    outline: none !important;
  }

  /* ===== 场景区域 ===== */
  .m-scene-area {
    flex: 1 !important;
    position: relative !important;
    overflow: hidden !important;
    width: 100% !important;
    min-height: 0 !important;
  }
  .m-scene-bg {
    position: absolute !important;
    inset: 0 !important;
    z-index: 0 !important;
  }
  .m-floor {
    position: absolute !important;
    left: 0 !important; right: 0 !important;
    bottom: 0 !important;
    height: 32% !important;
    z-index: 1 !important;
  }

  /* ===== 家具 ===== */
  .m-furn {
    position: absolute !important;
    z-index: 5 !important;
    cursor: pointer !important;
    display: flex !important;
    align-items: flex-end !important;
    justify-content: center !important;
    transition: transform 0.15s ease, filter 0.15s ease !important;
    -webkit-tap-highlight-color: transparent !important;
    touch-action: manipulation !important;
  }
  .m-furn:active {
    transform: scale(0.95) !important;
    filter: brightness(1.1) !important;
  }
  .m-furn-label {
    font-size: 10px !important;
    color: rgba(255,255,255,0.85) !important;
    text-shadow: 0 1px 3px rgba(0,0,0,0.6) !important;
    padding: 2px 6px !important;
    background: rgba(0,0,0,0.3) !important;
    border-radius: 8px !important;
    margin-bottom: 4px !important;
    pointer-events: none !important;
    white-space: nowrap !important;
    line-height: 1.2 !important;
  }
  .m-furn--portal .m-furn-label {
    background: rgba(232,115,74,0.8) !important;
    color: #fff !important;
  }
  .m-furn--interactive {
    animation: m-pulse 2s ease-in-out infinite !important;
  }
  @keyframes m-pulse {
    0%, 100% { filter: brightness(1); }
    50% { filter: brightness(1.15); }
  }

  /* ===== 宠物 ===== */
  .m-pet-wrap {
    position: absolute !important;
    left: 50% !important;
    bottom: 28% !important;
    transform: translateX(-50%) !important;
    z-index: 10 !important;
    width: 80px !important;
    height: 120px !important;
    cursor: pointer !important;
    transition: transform 0.3s ease !important;
  }
  .m-pet-wrap:active {
    transform: translateX(-50%) scale(0.9) !important;
  }
  .m-pet-wrap.m-pet-action {
    animation: m-bounce 0.5s ease !important;
  }
  @keyframes m-bounce {
    0%, 100% { transform: translateX(-50%) translateY(0); }
    40% { transform: translateX(-50%) translateY(-20px); }
    60% { transform: translateX(-50%) translateY(-10px); }
  }
  .m-pet-img {
    width: 100% !important;
    height: 100% !important;
    object-fit: contain !important;
    display: block !important;
    filter: drop-shadow(0 4px 8px rgba(0,0,0,0.2)) !important;
    pointer-events: none !important;
  }
  .m-pet-shadow {
    position: absolute !important;
    left: 15% !important; right: 15% !important;
    bottom: -6px !important;
    height: 10px !important;
    border-radius: 50% !important;
    background: rgba(0,0,0,0.2) !important;
    filter: blur(3px) !important;
    pointer-events: none !important;
  }

  /* ===== 场景标题 ===== */
  .m-scene-title {
    position: absolute !important;
    top: 48px !important;
    left: 50% !important;
    transform: translateX(-50%) !important;
    background: rgba(0,0,0,0.5) !important;
    backdrop-filter: blur(10px) !important;
    -webkit-backdrop-filter: blur(10px) !important;
    color: #fff !important;
    padding: 6px 20px !important;
    border-radius: 20px !important;
    font-size: 14px !important;
    font-weight: 600 !important;
    z-index: 20 !important;
    letter-spacing: 1px !important;
    pointer-events: none !important;
  }

  /* ===== 顶部导航 ===== */
  .m-top-nav {
    position: absolute !important;
    top: 0 !important; left: 0 !important; right: 0 !important;
    height: 44px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    z-index: 25 !important;
    gap: 8px !important;
    padding: 0 12px !important;
  }
  .m-top-nav-btn {
    padding: 6px 16px !important;
    border-radius: 18px !important;
    font-size: 13px !important;
    font-weight: 500 !important;
    cursor: pointer !important;
    transition: all 0.2s ease !important;
    display: flex !important;
    align-items: center !important;
    gap: 4px !important;
    background: rgba(255,255,255,0.7) !important;
    color: #5a3e28 !important;
    border: none !important;
    backdrop-filter: blur(8px) !important;
    -webkit-backdrop-filter: blur(8px) !important;
    -webkit-tap-highlight-color: transparent !important;
    touch-action: manipulation !important;
  }
  .m-top-nav-btn:active {
    transform: scale(0.95) !important;
    background: rgba(255,255,255,0.9) !important;
  }
  .m-top-nav-btn.m-active {
    background: rgba(232,115,74,0.85) !important;
    color: #fff !important;
  }

  /* ===== 底部Tab栏 ===== */
  .m-tabbar {
    display: flex !important;
    align-items: center !important;
    justify-content: space-around !important;
    height: 60px !important;
    min-height: 60px !important;
    background: linear-gradient(180deg, #fdf6ec 0%, #f5e6d3 100%) !important;
    border-top: 1px solid rgba(0,0,0,0.08) !important;
    padding: 0 !important;
    z-index: 30 !important;
    flex-shrink: 0 !important;
    padding-bottom: env(safe-area-inset-bottom, 0) !important;
  }
  .m-tab-btn {
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 3px !important;
    flex: 1 !important;
    height: 100% !important;
    background: transparent !important;
    color: #9a8c7a !important;
    font-size: 10px !important;
    cursor: pointer !important;
    -webkit-tap-highlight-color: transparent !important;
    touch-action: manipulation !important;
    transition: color 0.2s ease !important;
    border: none !important;
    outline: none !important;
  }
  .m-tab-btn:active {
    transform: scale(0.92) !important;
  }
  .m-tab-btn .m-tab-icon {
    font-size: 22px !important;
    line-height: 1 !important;
    transition: transform 0.2s ease !important;
  }
  .m-tab-btn.m-active {
    color: #e8734a !important;
  }
  .m-tab-btn.m-active .m-tab-icon {
    transform: scale(1.1) !important;
  }

  /* ===== 动作菜单 ===== */
  .m-action-menu {
    position: absolute !important;
    z-index: 100 !important;
    background: rgba(255,255,255,0.95) !important;
    backdrop-filter: blur(16px) !important;
    -webkit-backdrop-filter: blur(16px) !important;
    border-radius: 16px !important;
    padding: 12px !important;
    box-shadow: 0 8px 32px rgba(0,0,0,0.2) !important;
    display: flex !important;
    flex-wrap: wrap !important;
    gap: 8px !important;
    max-width: 280px !important;
    animation: m-menu-pop 0.2s ease !important;
  }
  @keyframes m-menu-pop {
    0% { transform: scale(0.8); opacity: 0; }
    100% { transform: scale(1); opacity: 1; }
  }
  .m-action-btn {
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 4px !important;
    width: 64px !important;
    height: 56px !important;
    border-radius: 12px !important;
    background: linear-gradient(135deg, #fdf6ec, #f5e6d3) !important;
    border: 2px solid rgba(0,0,0,0.06) !important;
    cursor: pointer !important;
    font-size: 11px !important;
    color: #5a3e28 !important;
    -webkit-tap-highlight-color: transparent !important;
    touch-action: manipulation !important;
    transition: all 0.15s ease !important;
  }
  .m-action-btn:active {
    transform: scale(0.92) !important;
    border-color: #e8734a !important;
    background: linear-gradient(135deg, #ffe8d6, #ffd4b8) !important;
  }
  .m-action-btn .m-action-icon {
    font-size: 22px !important;
    line-height: 1 !important;
  }

  /* ===== 对话气泡 ===== */
  .m-dialogue {
    position: absolute !important;
    z-index: 15 !important;
    background: #fff !important;
    border-radius: 16px !important;
    padding: 10px 14px !important;
    font-size: 13px !important;
    color: #3a2f28 !important;
    box-shadow: 0 4px 16px rgba(0,0,0,0.12) !important;
    max-width: 200px !important;
    text-align: center !important;
    line-height: 1.4 !important;
    animation: m-dialogue-in 0.3s ease !important;
  }
  .m-dialogue::after {
    content: '' !important;
    position: absolute !important;
    bottom: -8px !important;
    left: 50% !important;
    transform: translateX(-50%) !important;
    width: 0 !important; height: 0 !important;
    border-left: 8px solid transparent !important;
    border-right: 8px solid transparent !important;
    border-top: 8px solid #fff !important;
  }
  @keyframes m-dialogue-in {
    0% { transform: translateY(10px); opacity: 0; }
    100% { transform: translateY(0); opacity: 1; }
  }

  /* ===== 面板叠加层 ===== */
  .m-overlay {
    position: absolute !important;
    inset: 0 !important;
    background: rgba(0,0,0,0.4) !important;
    z-index: 200 !important;
    display: flex !important;
    align-items: flex-end !important;
    justify-content: center !important;
    animation: m-fade-in 0.2s ease !important;
  }
  @keyframes m-fade-in {
    0% { opacity: 0; }
    100% { opacity: 1; }
  }
  .m-panel {
    width: 92% !important;
    max-height: 75% !important;
    background: linear-gradient(180deg, #fff 0%, #fdf6ec 100%) !important;
    border-radius: 20px 20px 0 0 !important;
    padding: 20px 16px 24px !important;
    overflow-y: auto !important;
    animation: m-slide-up 0.3s ease !important;
  }
  @keyframes m-slide-up {
    0% { transform: translateY(100%); }
    100% { transform: translateY(0); }
  }
  .m-panel-title {
    font-size: 18px !important;
    font-weight: 700 !important;
    color: #3a2f28 !important;
    margin-bottom: 16px !important;
    text-align: center !important;
  }
  .m-panel-close {
    position: absolute !important;
    top: 12px !important; right: 16px !important;
    width: 32px !important; height: 32px !important;
    border-radius: 50% !important;
    background: rgba(0,0,0,0.06) !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    font-size: 16px !important;
    cursor: pointer !important;
    border: none !important;
    -webkit-tap-highlight-color: transparent !important;
  }
  .m-stats-grid {
    display: grid !important;
    grid-template-columns: 1fr 1fr !important;
    gap: 12px !important;
    margin-top: 12px !important;
  }
  .m-stat-card {
    background: linear-gradient(135deg, #fdf6ec, #f5e6d3) !important;
    border-radius: 14px !important;
    padding: 14px !important;
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    gap: 6px !important;
  }
  .m-stat-icon {
    font-size: 28px !important;
  }
  .m-stat-label {
    font-size: 12px !important;
    color: #9a8c7a !important;
  }
  .m-stat-value {
    font-size: 20px !important;
    font-weight: 700 !important;
    color: #3a2f28 !important;
  }
  .m-menu-list {
    display: flex !important;
    flex-direction: column !important;
    gap: 10px !important;
    margin-top: 12px !important;
  }
  .m-menu-item {
    display: flex !important;
    align-items: center !important;
    gap: 14px !important;
    padding: 14px !important;
    background: linear-gradient(135deg, #fdf6ec, #f5e6d3) !important;
    border-radius: 14px !important;
    font-size: 14px !important;
    color: #3a2f28 !important;
    cursor: pointer !important;
    text-decoration: none !important;
    -webkit-tap-highlight-color: transparent !important;
    touch-action: manipulation !important;
    transition: transform 0.15s ease !important;
    border: none !important;
    width: 100% !important;
    text-align: left !important;
  }
  .m-menu-item:active {
    transform: scale(0.97) !important;
  }
  .m-menu-icon {
    font-size: 24px !important;
    width: 40px !important;
    height: 40px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    background: rgba(255,255,255,0.6) !important;
    border-radius: 12px !important;
  }
  .m-menu-text strong {
    display: block !important;
    font-size: 14px !important;
    font-weight: 600 !important;
  }
  .m-menu-text small {
    display: block !important;
    color: #9a8c7a !important;
    font-size: 11px !important;
    margin-top: 2px !important;
  }

  /* ===== 聊天面板 ===== */
  .m-chat-panel {
    position: absolute !important;
    left: 0 !important; right: 0 !important;
    bottom: 60px !important;
    height: 60% !important;
    background: linear-gradient(180deg, #fff 0%, #fdf6ec 100%) !important;
    border-radius: 20px 20px 0 0 !important;
    box-shadow: 0 -4px 24px rgba(0,0,0,0.15) !important;
    z-index: 150 !important;
    display: flex !important;
    flex-direction: column !important;
    overflow: hidden !important;
    animation: m-slide-up 0.3s ease !important;
  }
  .m-chat-header {
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    padding: 14px 16px !important;
    border-bottom: 1px solid rgba(0,0,0,0.06) !important;
    flex-shrink: 0 !important;
  }
  .m-chat-header-title {
    font-weight: 600 !important;
    font-size: 16px !important;
    color: #3a2f28 !important;
  }
  .m-chat-close {
    width: 32px !important; height: 32px !important;
    border-radius: 50% !important;
    background: rgba(0,0,0,0.06) !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    font-size: 14px !important;
    cursor: pointer !important;
    border: none !important;
    -webkit-tap-highlight-color: transparent !important;
  }
  .m-chat-body {
    flex: 1 !important;
    overflow-y: auto !important;
    padding: 16px !important;
    display: flex !important;
    flex-direction: column !important;
    gap: 12px !important;
  }
  .m-chat-msg {
    padding: 12px 16px !important;
    border-radius: 16px !important;
    font-size: 14px !important;
    line-height: 1.5 !important;
    max-width: 85% !important;
    word-break: break-word !important;
  }
  .m-chat-msg.m-assistant {
    background: linear-gradient(135deg, #fdf6ec, #f5e6d3) !important;
    color: #3a2f28 !important;
    align-self: flex-start !important;
    border-bottom-left-radius: 4px !important;
  }
  .m-chat-msg.m-user {
    background: linear-gradient(135deg, #e8734a, #d4603a) !important;
    color: #fff !important;
    align-self: flex-end !important;
    border-bottom-right-radius: 4px !important;
  }
  .m-chat-input-row {
    display: flex !important;
    gap: 10px !important;
    padding: 12px 16px !important;
    border-top: 1px solid rgba(0,0,0,0.06) !important;
    flex-shrink: 0 !important;
    padding-bottom: calc(12px + env(safe-area-inset-bottom, 0)) !important;
  }
  .m-chat-input {
    flex: 1 !important;
    height: 40px !important;
    border: 2px solid rgba(0,0,0,0.08) !important;
    border-radius: 20px !important;
    padding: 0 16px !important;
    font-size: 14px !important;
    background: #fff !important;
    color: #3a2f28 !important;
    outline: none !important;
  }
  .m-chat-input:focus {
    border-color: #e8734a !important;
  }
  .m-chat-send {
    width: 64px !important; height: 40px !important;
    border: none !important;
    border-radius: 20px !important;
    background: linear-gradient(135deg, #e8734a, #d4603a) !important;
    color: #fff !important;
    font-size: 14px !important;
    font-weight: 600 !important;
    cursor: pointer !important;
    -webkit-tap-highlight-color: transparent !important;
    touch-action: manipulation !important;
  }
  .m-chat-send:active {
    transform: scale(0.95) !important;
  }

  /* ===== 宠物状态指示器 ===== */
  .m-pet-status {
    position: absolute !important;
    top: 96px !important;
    left: 12px !important;
    display: flex !important;
    flex-direction: column !important;
    gap: 8px !important;
    z-index: 25 !important;
  }
  .m-status-bar {
    width: 100px !important;
    height: 8px !important;
    background: rgba(0,0,0,0.15) !important;
    border-radius: 4px !important;
    overflow: hidden !important;
  }
  .m-status-fill {
    height: 100% !important;
    border-radius: 4px !important;
    transition: width 0.3s ease !important;
  }
  .m-status-fill.m-energy {
    background: linear-gradient(90deg, #f2c94c, #f7dc6f) !important;
  }
  .m-status-fill.m-happy {
    background: linear-gradient(90deg, #e8734a, #f5a87c) !important;
  }
  .m-status-label {
    font-size: 9px !important;
    color: rgba(255,255,255,0.8) !important;
    text-shadow: 0 1px 2px rgba(0,0,0,0.5) !important;
    margin-bottom: -4px !important;
  }
`;

// ============ 主组件 ============
export function MobileLayout() {
  const {
    state,
    switchScene,
    selectFurniture,
    closeActionMenu,
    executeAction,
    petThePet,
  } = useGameEngine();

  const [tab, setTab] = useState<"home" | "collect" | "chat" | "more">("home");
  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<{ role: string; text: string }[]>([
    { role: "assistant", text: wenbebi.lines.greet?.[0] || "你好呀～" },
  ]);
  const [dialogue, setDialogue] = useState<string | null>(null);
  const dialogueTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentScene = SCENES.find((s) => s.id === state.currentScene)!;
  const furniture = SCENE_FURNITURE[state.currentScene] || [];
  const bg = SCENE_BACKGROUNDS[state.currentScene];
  const petSprite = getSpriteForAction(state.pet.currentAction);

  // 显示对话气泡
  const showDialogue = useCallback((text: string) => {
    if (dialogueTimer.current) clearTimeout(dialogueTimer.current);
    setDialogue(text);
    dialogueTimer.current = setTimeout(() => setDialogue(null), 3000);
  }, []);

  // 家具点击
  const handleFurnitureClick = useCallback(
    (item: FurnitureItem, position: { x: number; y: number }) => {
      if (item.type === "portal" && item.targetScene) {
        switchScene(item.targetScene);
        if (item.dialogue) showDialogue(item.dialogue);
        return;
      }
      if (item.actions.length > 0) {
        selectFurniture(item.id, position);
        if (item.dialogue) showDialogue(item.dialogue);
      }
    },
    [switchScene, selectFurniture, showDialogue]
  );

  // 发送消息
  const sendMessage = useCallback(() => {
    if (!chatInput.trim()) return;
    const newMessages = [
      ...chatMessages,
      { role: "user", text: chatInput },
      { role: "assistant", text: getDialogueForMood(state.pet.mood) },
    ];
    setChatMessages(newMessages);
    setChatInput("");
  }, [chatInput, chatMessages, state.pet.mood]);

  // 动作按钮
  const handleAction = useCallback(
    (action: PetAction) => {
      executeAction(action);
      closeActionMenu();
    },
    [executeAction, closeActionMenu]
  );

  const currentFurniture = state.selectedFurniture
    ? furniture.find((f) => f.id === state.selectedFurniture)
    : null;

  // 获取可用的动作
  const availableActions = currentFurniture
    ? PET_ACTIONS.filter((a) => currentFurniture.actions.includes(a.id))
    : [];

  // 计算动作菜单位置
  const menuStyle: React.CSSProperties = state.actionMenuPosition
    ? {
        left: Math.min(state.actionMenuPosition.x, window.innerWidth - 300),
        top: Math.max(state.actionMenuPosition.y - 80, 60),
      }
    : { left: "50%", top: "40%", transform: "translate(-50%, -50%)" };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />
      <div id="mobile-game-root">
        {/* 场景区域 */}
        <div className="m-scene-area">
          <div className="m-scene-bg" style={{ background: bg.wall }} />
          <div className="m-floor" style={{ background: bg.floor }} />

          {/* 家具 */}
          {furniture.map((item) => (
            <div
              key={item.id}
              className={`m-furn${item.type === "interactive" ? " m-furn--interactive" : ""}${
                item.type === "portal" ? " m-furn--portal" : ""
              }`}
              style={{
                left: `${item.left}%`,
                bottom: `${item.bottom}%`,
                width: `${item.w}%`,
                height: `${item.h}%`,
                backgroundColor: item.color,
                borderRadius: item.borderRadius,
              }}
              onClick={(e) => {
                e.stopPropagation();
                const rect = (e.target as HTMLElement).getBoundingClientRect();
                handleFurnitureClick(item, {
                  x: e.clientX - rect.left,
                  y: e.clientY - rect.top,
                });
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
                const touch = e.touches[0];
                const rect = (e.target as HTMLElement).getBoundingClientRect();
                handleFurnitureClick(item, {
                  x: touch.clientX - rect.left,
                  y: touch.clientY - rect.top,
                });
              }}
            >
              <span className="m-furn-label">{item.label}</span>
            </div>
          ))}

          {/* 宠物 */}
          <div
            className={`m-pet-wrap${state.pet.currentAction === "jump" || state.pet.currentAction === "happy" ? " m-pet-action" : ""}`}
            onClick={() => {
              petThePet();
              showDialogue(getDialogueForMood(state.pet.mood));
            }}
          >
            <img src={`assets/${petSprite}.png`} alt={wenbebi.name} className="m-pet-img" draggable={false} />
            <div className="m-pet-shadow" />
          </div>

          {/* 对话气泡 */}
          {dialogue && (
            <div className="m-dialogue" style={{ left: "50%", bottom: "42%", transform: "translateX(-50%)" }}>
              {dialogue}
            </div>
          )}

          {/* 场景标题 */}
          <div className="m-scene-title">{currentScene.name}</div>

          {/* 宠物状态 */}
          <div className="m-pet-status">
            <div className="m-status-label">活力</div>
            <div className="m-status-bar">
              <div className="m-status-fill m-energy" style={{ width: `${state.pet.energy}%` }} />
            </div>
            <div className="m-status-label">心情</div>
            <div className="m-status-bar">
              <div className="m-status-fill m-happy" style={{ width: `${state.pet.happiness}%` }} />
            </div>
          </div>

          {/* 动作菜单 */}
          {state.showActionMenu && availableActions.length > 0 && (
            <div className="m-action-menu" style={menuStyle}>
              {availableActions.map((action) => (
                <button
                  key={action.id}
                  className="m-action-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAction(action);
                  }}
                >
                  <span className="m-action-icon">{action.icon}</span>
                  <span>{action.label}</span>
                </button>
              ))}
              <button
                className="m-action-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  closeActionMenu();
                }}
                style={{ background: "rgba(0,0,0,0.05)" }}
              >
                <span className="m-action-icon">✕</span>
                <span>关闭</span>
              </button>
            </div>
          )}
        </div>

        {/* 底部Tab栏 */}
        <nav className="m-tabbar">
          <button
            className={`m-tab-btn${tab === "home" ? " m-active" : ""}`}
            onClick={() => setTab("home")}
          >
            <span className="m-tab-icon">🏠</span>
            <span>主页</span>
          </button>
          <button
            className={`m-tab-btn${tab === "collect" ? " m-active" : ""}`}
            onClick={() => setTab("collect")}
          >
            <span className="m-tab-icon">🎒</span>
            <span>收集</span>
          </button>
          <button
            className={`m-tab-btn${tab === "chat" ? " m-active" : ""}`}
            onClick={() => {
              setTab("chat");
              setShowChat(true);
            }}
          >
            <span className="m-tab-icon">💬</span>
            <span>对话</span>
          </button>
          <button
            className={`m-tab-btn${tab === "more" ? " m-active" : ""}`}
            onClick={() => setTab("more")}
          >
            <span className="m-tab-icon">️</span>
            <span>更多</span>
          </button>
        </nav>

        {/* 聊天面板 */}
        {showChat && (
          <div className="m-chat-panel">
            <div className="m-chat-header">
              <span className="m-chat-header-title">与 {wenbebi.name} 对话</span>
              <button className="m-chat-close" onClick={() => setShowChat(false)}>✕</button>
            </div>
            <div className="m-chat-body">
              {chatMessages.map((msg, i) => (
                <div key={i} className={`m-chat-msg m-${msg.role}`}>
                  {msg.text}
                </div>
              ))}
            </div>
            <div className="m-chat-input-row">
              <input
                className="m-chat-input"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder="说点什么..."
              />
              <button className="m-chat-send" onClick={sendMessage}>发送</button>
            </div>
          </div>
        )}

        {/* 收集面板 */}
        {tab === "collect" && (
          <div className="m-overlay" onClick={() => setTab("home")}>
            <div className="m-panel" onClick={(e) => e.stopPropagation()}>
              <button className="m-panel-close" onClick={() => setTab("home")}>✕</button>
              <div className="m-panel-title">收集背包</div>
              <div className="m-stats-grid">
                <div className="m-stat-card">
                  <span className="m-stat-icon">🌸</span>
                  <span className="m-stat-label">花种</span>
                  <span className="m-stat-value">0</span>
                </div>
                <div className="m-stat-card">
                  <span className="m-stat-icon">💐</span>
                  <span className="m-stat-label">花束</span>
                  <span className="m-stat-value">0</span>
                </div>
                <div className="m-stat-card">
                  <span className="m-stat-icon">🎁</span>
                  <span className="m-stat-label">纪念品</span>
                  <span className="m-stat-value">0</span>
                </div>
                <div className="m-stat-card">
                  <span className="m-stat-icon">💰</span>
                  <span className="m-stat-label">零钱</span>
                  <span className="m-stat-value">0</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 更多面板 */}
        {tab === "more" && (
          <div className="m-overlay" onClick={() => setTab("home")}>
            <div className="m-panel" onClick={(e) => e.stopPropagation()}>
              <button className="m-panel-close" onClick={() => setTab("home")}>✕</button>
              <div className="m-panel-title">更多选项</div>
              <div className="m-menu-list">
                <div className="m-menu-item">
                  <span className="m-menu-icon">🎨</span>
                  <div className="m-menu-text">
                    <strong>角色工坊</strong>
                    <small>自定义外观</small>
                  </div>
                </div>
                <div className="m-menu-item">
                  <span className="m-menu-icon">🛋️</span>
                  <div className="m-menu-text">
                    <strong>布置房间</strong>
                    <small>拖拽家具</small>
                  </div>
                </div>
                <a href="?desktop" className="m-menu-item">
                  <span className="m-menu-icon">🖥️</span>
                  <div className="m-menu-text">
                    <strong>桌面版</strong>
                    <small>返回经典玩法</small>
                  </div>
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
