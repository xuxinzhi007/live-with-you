import { useEffect, useState } from "react";
import {
  createRoomCode,
  displayCodeFromRoomId,
  isValidRoomCode,
  normalizeRoomCode,
} from "./multiplayer/room-code";

type SheetMode = "menu" | "host" | "join";

interface FindPartnerSheetProps {
  open: boolean;
  roomId: string | null;
  hasPartner: boolean;
  partnerName?: string;
  onClose: () => void;
  onEnterRoom: (roomId: string) => void;
  onLeaveRoom: () => void;
}

export function FindPartnerSheet({
  open,
  roomId,
  hasPartner,
  partnerName,
  onClose,
  onEnterRoom,
  onLeaveRoom,
}: FindPartnerSheetProps) {
  const [mode, setMode] = useState<SheetMode>("menu");
  const [joinInput, setJoinInput] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [hostCode, setHostCode] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError("");
    setCopied(false);
    setJoinInput("");
    if (roomId) {
      setMode("menu");
      setHostCode(displayCodeFromRoomId(roomId));
    } else {
      setMode("menu");
      setHostCode(null);
    }
  }, [open, roomId]);

  if (!open) return null;

  const activeCode = roomId ? displayCodeFromRoomId(roomId) : hostCode;

  const startHost = () => {
    const code = createRoomCode();
    setHostCode(code);
    setMode("host");
    setError("");
    onEnterRoom(`wb-${code}`);
  };

  const submitJoin = () => {
    if (!isValidRoomCode(joinInput)) {
      setError("请输入 4 位房间短码");
      return;
    }
    const code = normalizeRoomCode(joinInput);
    setError("");
    onEnterRoom(`wb-${code}`);
    onClose();
  };

  const copyCode = async () => {
    if (!activeCode) return;
    try {
      await navigator.clipboard.writeText(activeCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("复制失败，请手动记下短码");
    }
  };

  return (
    <div className="m-find-layer" role="presentation">
      <button type="button" className="m-find-scrim" aria-label="关闭找对方" onClick={onClose} />
      <div
        id="m-find-sheet"
        className="m-find-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="m-find-title"
      >
        <div className="m-find-head">
          <div>
            <p className="m-find-eyebrow">一起玩</p>
            <h2 id="m-find-title">找对方</h2>
          </div>
          <button type="button" className="m-coplay-close" aria-label="关闭" onClick={onClose}>
            ×
          </button>
        </div>

        {mode === "menu" && (
          <>
            <p className="m-find-lead">
              {roomId
                ? hasPartner
                  ? `已与 ${partnerName ?? "对方"} 在同一房间。`
                  : "房间已开，把短码告诉对方即可。"
                : "创建一间临时房，或输入对方的短码加入。不是陌生人大厅。"}
            </p>

            {roomId && activeCode && (
              <div className="m-find-code-card">
                <span>当前短码</span>
                <strong>{activeCode}</strong>
                <button type="button" className="m-find-copy" onClick={() => void copyCode()}>
                  {copied ? "已复制" : "复制"}
                </button>
              </div>
            )}

            {!roomId && (
              <div className="m-find-actions">
                <button type="button" className="m-create-primary" onClick={startHost}>
                  创建房间
                </button>
                <button type="button" className="m-create-ghost m-find-full" onClick={() => setMode("join")}>
                  输入短码加入
                </button>
              </div>
            )}

            {roomId && (
              <div className="m-find-actions">
                {!hasPartner && (
                  <button type="button" className="m-create-ghost m-find-full" onClick={() => setMode("join")}>
                    换一个短码加入
                  </button>
                )}
                <button
                  type="button"
                  className="m-find-leave"
                  onClick={() => {
                    onLeaveRoom();
                    onClose();
                  }}
                >
                  离开房间
                </button>
              </div>
            )}
          </>
        )}

        {mode === "host" && activeCode && (
          <>
            <p className="m-find-lead">把短码发给对方，对方选择「输入短码加入」。</p>
            <div className="m-find-code-hero" aria-live="polite">
              {activeCode.split("").map((ch, index) => (
                <span key={`${ch}-${index}`}>{ch}</span>
              ))}
            </div>
            <div className="m-find-actions">
              <button type="button" className="m-create-primary" onClick={() => void copyCode()}>
                {copied ? "已复制短码" : "复制短码"}
              </button>
              <button type="button" className="m-create-ghost m-find-full" onClick={onClose}>
                回到小屋等候
              </button>
            </div>
            {error && <p className="m-create-error" role="alert">{error}</p>}
          </>
        )}

        {mode === "join" && (
          <>
            <p className="m-find-lead">输入对方给你的 4 位短码。</p>
            <label className="m-create-label" htmlFor="m-find-code-input">房间短码</label>
            <input
              id="m-find-code-input"
              className="m-create-input m-find-code-input"
              value={joinInput}
              maxLength={4}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              placeholder="例如 K7M2"
              onChange={(event) => {
                setJoinInput(normalizeRoomCode(event.target.value));
                if (error) setError("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") submitJoin();
              }}
            />
            {error && <p className="m-create-error" role="alert">{error}</p>}
            <div className="m-create-row">
              <button type="button" className="m-create-ghost" onClick={() => setMode(roomId ? "menu" : "menu")}>
                返回
              </button>
              <button type="button" className="m-create-primary" onClick={submitJoin}>
                加入房间
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
