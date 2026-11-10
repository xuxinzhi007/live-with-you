/**
 * 世界状态钩子（V5 精简面）：
 * - 统一管理 GameState 本地存储
 * - 对 WorldApp 暴露 state / setSkin / companionAct / grantBond / enterRoom / runProp
 * - 花圃/喷泉等 V2 动作仍在 actions.ts / codex.ts；enterRoom/runProp 供小世界屏幕使用
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { CharacterSkinId, GameState } from "../engine/types";
import { loadGameState, saveGameState } from "../engine/storage";
import { interactWithCompanion } from "./codex";
import { applyPropAction, enterRoom as enterRoomState } from "./actions";
import type { RoomProp } from "./rooms";
import type { WorldRoomId } from "../engine/types";

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

  const commit = useCallback((next: GameState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const setSkin = useCallback((skin: CharacterSkinId) => {
    const current = stateRef.current;
    if (current.world.skin === skin) return;
    commit({ ...current, world: { ...current.world, skin } });
  }, [commit]);

  /** 高频陪伴动作：摸摸头 / 吃曲奇 / 送花 */
  const companionAct = useCallback((act: "pat" | "snack" | "giftFlower", wishBonus = false) => {
    const res = interactWithCompanion(stateRef.current, act, wishBonus);
    commit(res.state);
    return res;
  }, [commit]);

  /** 把已经算好的亲密原数写入世界档。不走送花，也不另加零钱。 */
  const grantBond = useCallback((amount: number) => {
    const gained = Math.max(0, Math.floor(amount));
    const current = stateRef.current;
    if (!gained) return { bondGained: 0, state: current };
    const next = { ...current, bond: current.bond + gained };
    commit(next);
    return { bondGained: gained, state: next };
  }, [commit]);

  const enterRoom = useCallback((room: WorldRoomId) => {
    commit(enterRoomState(stateRef.current, room));
  }, [commit]);

  const runProp = useCallback((prop: RoomProp) => {
    const outcome = applyPropAction(stateRef.current, prop);
    commit(outcome.state);
    return outcome;
  }, [commit]);

  return {
    state,
    setSkin,
    companionAct,
    grantBond,
    enterRoom,
    runProp,
  };
}