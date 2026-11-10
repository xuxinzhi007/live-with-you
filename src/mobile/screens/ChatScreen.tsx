import "./ChatScreen.css";
import { useEffect, useRef } from "react";
import type { CompanionConnection, ChatTurn } from "../world/companion-bridge";

const QUICK_CHAT_TOPICS = [
  "今天这身搭配和头饰好看吗？",
  "我们去挑战下一章搭配赛吧～",
  "最喜欢深海小鲸鱼还是暮色蔷薇？",
  "陪我聊聊天，充充电吧！",
];

interface ChatScreenProps {
  activeSkinAvatar: string;
  companionConn: CompanionConnection | null;
  chatHistory: ChatTurn[];
  chatBusy: boolean;
  chatInput: string;
  onChatInputChange: (v: string) => void;
  onSendChat: (text?: string) => void;
}

export function ChatScreen({
  activeSkinAvatar,
  companionConn,
  chatHistory,
  chatBusy,
  chatInput,
  onChatInputChange,
  onSendChat,
}: ChatScreenProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chatHistory.length, chatBusy]);

  return (
    <section className="nk-full-view nk-chat-view nk-panel-enter" aria-label="和雯宝聊聊">
      <div className="nk-chat-head">
        <img src={activeSkinAvatar} alt="" />
        <div>
          <h2>和雯宝私语</h2>
          <small>
            {companionConn?.connected ? `已连接 ${companionConn.model}` : "贴心陪伴模式（随时回复）"}
          </small>
        </div>
      </div>
      <div className="nk-chat-messages">
        {chatHistory.map((turn, idx) => (
          <div key={idx} className={`nk-chat-bubble m-${turn.role}`}>
            {turn.content}
          </div>
        ))}
        {chatBusy && <div className="nk-chat-bubble m-assistant">雯宝正在认真想…</div>}
        <div ref={messagesEndRef} />
      </div>
      <div className="nk-chat-topics">
        {QUICK_CHAT_TOPICS.map((topic) => (
          <button key={topic} type="button" onClick={() => onSendChat(topic)} disabled={chatBusy}>
            {topic}
          </button>
        ))}
      </div>
      <form
        className="nk-chat-form"
        onSubmit={(e) => {
          e.preventDefault();
          onSendChat();
        }}
      >
        <input
          type="text"
          value={chatInput}
          onChange={(e) => onChatInputChange(e.target.value)}
          placeholder="对雯宝说点什么吧…"
          maxLength={200}
        />
        <button type="submit" disabled={chatBusy || !chatInput.trim()}>
          发送
        </button>
      </form>
    </section>
  );
}
