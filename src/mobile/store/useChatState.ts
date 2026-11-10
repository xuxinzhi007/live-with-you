import { useCallback, useState } from "react";
import type { ChatTurn, CompanionConnection } from "../world/companion-bridge";

export interface UseChatState {
  chatHistory: ChatTurn[];
  setChatHistory: React.Dispatch<React.SetStateAction<ChatTurn[]>>;
  chatInput: string;
  setChatInput: React.Dispatch<React.SetStateAction<string>>;
  chatBusy: boolean;
  setChatBusy: React.Dispatch<React.SetStateAction<boolean>>;
  companionConn: CompanionConnection | null;
  setCompanionConn: React.Dispatch<React.SetStateAction<CompanionConnection | null>>;
  appendChat: (turn: ChatTurn) => void;
}

export function useChatState(): UseChatState {
  const [chatHistory, setChatHistory] = useState<ChatTurn[]>([
    {
      role: "assistant",
      content:
        "欢迎来到高定搭配工坊～每套生成的衣服现在都有自己独立的骨骼树，进入『🦴 骨骼』模式可以直接按住我身上的关节点拖动微调哦！",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [companionConn, setCompanionConn] = useState<CompanionConnection | null>(null);

  const appendChat = useCallback((turn: ChatTurn) => {
    setChatHistory((prev) => [...prev, turn]);
  }, []);

  return {
    chatHistory,
    setChatHistory,
    chatInput,
    setChatInput,
    chatBusy,
    setChatBusy,
    companionConn,
    setCompanionConn,
    appendChat,
  };
}
