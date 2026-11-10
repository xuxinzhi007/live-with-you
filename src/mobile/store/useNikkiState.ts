import { useCallback, useEffect, useState } from "react";
import {
  NIKKI_SAVE_KEY,
  loadNikkiSaveFrom,
  normalizeNikkiSave,
  type SavedNikkiState,
} from "../world/nikki-wardrobe";

const ENTERED_LOBBY_KEY = "wenbebi-entered-lobby";

function hasEnteredLobby(): boolean {
  try {
    return localStorage.getItem(ENTERED_LOBBY_KEY) === "1";
  } catch {
    return false;
  }
}

function markEnteredLobby() {
  try {
    localStorage.setItem(ENTERED_LOBBY_KEY, "1");
  } catch {
    // ignore quota / private mode
  }
}

function loadNikkiState(): SavedNikkiState {
  const base = loadNikkiSaveFrom(typeof localStorage === "undefined" ? null : localStorage);
  let lastCouponPatAt: number | undefined;
  try {
    const raw = localStorage.getItem(NIKKI_SAVE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed?.lastCouponPatAt === "number" && Number.isFinite(parsed.lastCouponPatAt)) {
        lastCouponPatAt = parsed.lastCouponPatAt;
      }
    }
  } catch {
    /* ignore */
  }
  return { ...base, lastCouponPatAt };
}

export interface UseNikkiState {
  nikki: SavedNikkiState;
  setNikki: React.Dispatch<React.SetStateAction<SavedNikkiState>>;
  hasEnteredLobby: boolean;
  markEnteredLobby: () => void;
}

export function useNikkiState(): UseNikkiState {
  const [nikki, setNikki] = useState<SavedNikkiState>(loadNikkiState);

  useEffect(() => {
    try {
      localStorage.setItem(NIKKI_SAVE_KEY, JSON.stringify(nikki));
    } catch {
      // ignore quota error
    }
  }, [nikki]);

  const markEntered = useCallback(() => markEnteredLobby(), []);

  return {
    nikki,
    setNikki,
    hasEnteredLobby: hasEnteredLobby(),
    markEnteredLobby: markEntered,
  };
}

export { normalizeNikkiSave };
export type { SavedNikkiState };
