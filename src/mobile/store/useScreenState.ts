import { useCallback, useState } from "react";

export type GameScreen =
  | "title"
  | "lobby"
  | "world"
  | "wardrobe"
  | "rig"
  | "stages"
  | "pavilion"
  | "codex"
  | "chat";

const ALLOWED: GameScreen[] = [
  "title",
  "lobby",
  "world",
  "wardrobe",
  "rig",
  "stages",
  "pavilion",
  "codex",
  "chat",
];

function readScreenFromUrl(): GameScreen | null {
  if (typeof location === "undefined") return null;
  const want = new URLSearchParams(location.search).get("screen");
  return ALLOWED.includes(want as GameScreen) ? (want as GameScreen) : null;
}

export interface UseScreenState {
  screen: GameScreen;
  setScreen: (s: GameScreen) => void;
}

export function useScreenState(): UseScreenState {
  const [screen, setScreenState] = useState<GameScreen>(
    () => readScreenFromUrl() ?? "title",
  );

  const setScreen = useCallback((s: GameScreen) => {
    setScreenState(s);
    if (typeof history !== "undefined") {
      history.pushState(null, "", `?screen=${s}`);
    }
  }, []);

  return { screen, setScreen };
}
