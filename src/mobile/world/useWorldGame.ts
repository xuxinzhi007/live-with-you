/**
 * V3 世界状态与操作钩子：
 * - 统一管理 GameState 本地存储
 * - 暴露高频陪伴互动（摸摸头/吃点心/送花）、自选花种播种、出售花束、喷泉扭蛋、街区奇遇二选一、聊天记手账
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { CharacterSkinId, FlowerKind, GameState, WorldRoomId } from "../engine/types";
import { loadGameState, saveGameState } from "../engine/storage";
import {
  applyPropAction,
  enterRoom as enterRoomState,
  recordBallCatch,
  recordBallKick,
  type ActionOutcome,
} from "./actions";
import {
  drawFountainWish,
  getBondLevelInfo,
  interactWithCompanion,
  plantChosenFlower,
  resolveEncounterChoice,
  sellFlowerBouquet,
  type StreetEncounter,
  type WishDrawResult,
} from "./codex";
import type { RoomProp } from "./rooms";

export interface ActionDelta {
  bondDelta: number;
  coinsDelta: number;
  leveledUp: boolean;
  newLevel: number;
}

function computeDelta(prev: GameState, next: GameState): ActionDelta {
  const prevLv = getBondLevelInfo(prev.bond).level;
  const nextLv = getBondLevelInfo(next.bond).level;
  return {
    bondDelta: next.bond - prev.bond,
    coinsDelta: next.coins - prev.coins,
    leveledUp: nextLv > prevLv,
    newLevel: nextLv,
  };
}

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

  const commit = useCallback((next: GameState): ActionDelta => {
    const prev = stateRef.current;
    stateRef.current = next;
    setState(next);
    return computeDelta(prev, next);
  }, []);

  const runProp = useCallback((prop: RoomProp): ActionOutcome & { delta: ActionDelta } => {
    const prev = stateRef.current;
    const outcome = applyPropAction(prev, prop);
    const delta = commit(outcome.state);
    return { ...outcome, delta };
  }, [commit]);

  const enterRoom = useCallback((room: WorldRoomId): ActionDelta => {
    const next = enterRoomState(stateRef.current, room);
    return commit(next);
  }, [commit]);

  const catchBall = useCallback((combo: number): ActionDelta => {
    const next = recordBallCatch(stateRef.current, combo);
    return commit(next);
  }, [commit]);

  const recordKick = useCallback((): ActionDelta => {
    const next = recordBallKick(stateRef.current);
    return commit(next);
  }, [commit]);

  const setSkin = useCallback((skin: CharacterSkinId) => {
    const current = stateRef.current;
    if (current.world.skin === skin) return;
    commit({ ...current, world: { ...current.world, skin } });
  }, [commit]);

  const markIntroSeen = useCallback(() => {
    const current = stateRef.current;
    if (current.world.seenIntro) return;
    commit({ ...current, world: { ...current.world, seenIntro: true } });
  }, [commit]);

  const appendJournal = useCallback((text: string) => {
    const clean = text.trim();
    if (!clean) return;
    const current = stateRef.current;
    if (current.journal[0]?.text === clean) return;
    const now = Date.now();
    const entry = {
      id: `${now}-${current.journal.length}`,
      text: clean,
      time: now,
    };
    commit({
      ...current,
      journal: [entry, ...current.journal].slice(0, 48),
    });
  }, [commit]);

  /** 高频陪伴动作：摸摸头 / 吃曲奇 / 送花 */
  const companionAct = useCallback((act: "pat" | "snack" | "giftFlower", wishBonus = false) => {
    const res = interactWithCompanion(stateRef.current, act, wishBonus);
    commit(res.state);
    return res;
  }, [commit]);

  /** 自选花种播种 */
  const plantSeed = useCallback((plotIndex: number, kind: FlowerKind) => {
    const res = plantChosenFlower(stateRef.current, plotIndex, kind);
    const delta = commit(res.state);
    return { ...res, delta };
  }, [commit]);

  /** 花摊卖花束换零钱 */
  const sellBouquet = useCallback(() => {
    const res = sellFlowerBouquet(stateRef.current);
    const delta = commit(res.state);
    return { ...res, delta };
  }, [commit]);

  /** 喷泉许愿扭蛋 */
  const wishGacha = useCallback((payWith: "coins" | "flower" = "coins"): { ok: false; reason: string } | { ok: true; result: WishDrawResult } => {
    const res = drawFountainWish(stateRef.current, payWith);
    if (!res.ok) return { ok: false, reason: res.reason };
    commit(res.result.state);
    return res;
  }, [commit]);

  /** 街区奇遇二选一结算 */
  const chooseEncounter = useCallback((encounter: StreetEncounter, choiceIndex: 0 | 1) => {
    const res = resolveEncounterChoice(stateRef.current, encounter, choiceIndex);
    commit(res.state);
    return res;
  }, [commit]);

  return {
    state,
    runProp,
    enterRoom,
    catchBall,
    recordKick,
    setSkin,
    markIntroSeen,
    appendJournal,
    companionAct,
    plantSeed,
    sellBouquet,
    wishGacha,
    chooseEncounter,
  };
}
