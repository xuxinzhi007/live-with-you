import { useCallback, useState } from "react";
import type { PavilionPullItem, WishPool } from "../world/nikki-wardrobe";

export interface UsePavilionState {
  gachaResults: PavilionPullItem[] | null;
  setGachaResults: React.Dispatch<React.SetStateAction<PavilionPullItem[] | null>>;
  wishPhase: "idle" | "charge" | "reveal";
  setWishPhase: React.Dispatch<React.SetStateAction<"idle" | "charge" | "reveal">>;
  wishPool: WishPool;
  setWishPool: React.Dispatch<React.SetStateAction<WishPool>>;
  revealedPulls: number;
  setRevealedPulls: React.Dispatch<React.SetStateAction<number>>;
  comfyPrompt: string;
  setComfyPrompt: React.Dispatch<React.SetStateAction<string>>;
  comfyBusy: boolean;
  setComfyBusy: React.Dispatch<React.SetStateAction<boolean>>;
  showAtelier: boolean;
  setShowAtelier: React.Dispatch<React.SetStateAction<boolean>>;
}

export function usePavilionState(): UsePavilionState {
  const [gachaResults, setGachaResults] = useState<PavilionPullItem[] | null>(null);
  const [wishPhase, setWishPhase] = useState<"idle" | "charge" | "reveal">("idle");
  const [wishPool, setWishPool] = useState<WishPool>("all");
  const [revealedPulls, setRevealedPulls] = useState(0);
  const [comfyPrompt, setComfyPrompt] = useState(
    "wearing a pastel pink sakura dress with white lace ribbon",
  );
  const [comfyBusy, setComfyBusy] = useState(false);
  const [showAtelier, setShowAtelier] = useState(false);

  return {
    gachaResults,
    setGachaResults,
    wishPhase,
    setWishPhase,
    wishPool,
    setWishPool,
    revealedPulls,
    setRevealedPulls,
    comfyPrompt,
    setComfyPrompt,
    comfyBusy,
    setComfyBusy,
    showAtelier,
    setShowAtelier,
  };
}
