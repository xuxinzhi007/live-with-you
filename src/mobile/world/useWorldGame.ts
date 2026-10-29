/**
 * V2 世界状态钩子：包一层 localStorage 读写，供 WorldApp 使用。
 *
 * 旧 MobileLayout / GameEngine 保持不变（可作为 ?legacy 回滚入口），
 * 新主线只依赖这里的 GameState.world。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { GameState, WorldRoomId } from "../engine/types";
import { loadGameState, saveGameState } from "../engine/storage";
import {
  applyPropAction,
  enterRoom as enterRoomState,
  recordBallCatch,
  recordBallKick,
  type ActionOutcome,
} from "./actions";
import type { RoomProp } from "./rooms";

export function useWorldGame() {
  const [state, setState] = useState<GameState>(() => loadGameState());
  const stateRef = useRef(state);
  stateRef.current = state;
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveGameState(state), 120);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [state]);

  const runProp = useCallback((prop: RoomProp): ActionOutcome => {
    const outcome = applyPropAction(stateRef.current, prop);
    stateRef.current = outcome.state;
    setState(outcome.state);
    return outcome;
  }, []);

  const enterRoom = useCallback((room: WorldRoomId) => {
    const next = enterRoomState(stateRef.current, room);
    stateRef.current = next;
    setState(next);
  }, []);

  const catchBall = useCallback((combo: number) => {
    const next = recordBallCatch(stateRef.current, combo);
    stateRef.current = next;
    setState(next);
  }, []);

  const recordKick = useCallback(() => {
    const next = recordBallKick(stateRef.current);
    stateRef.current = next;
    setState(next);
  }, []);

  const markIntroSeen = useCallback(() => {
    const current = stateRef.current;
    if (current.world.seenIntro) return;
    const next = { ...current, world: { ...current.world, seenIntro: true } };
    stateRef.current = next;
    setState(next);
  }, []);

  return {
    state,
    runProp,
    enterRoom,
    catchBall,
    recordKick,
    markIntroSeen,
  };
}
