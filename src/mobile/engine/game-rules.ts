import { SCENES, type FurnitureItem, type SceneId } from "../data/scenes.ts";
import type { PetAction } from "../data/pet-actions";
import { getCoplayAction, type CoplayAction } from "../data/coplay-actions.ts";
import { wenbebi } from "../../game/data/pet.js";
import type { GameState, JournalEntry } from "./types.ts";

const BOND_PER_LEVEL = 24;
const JOURNAL_LIMIT = 48;

export function relationshipLevel(bond: number) {
  return Math.floor(Math.max(0, bond) / BOND_PER_LEVEL) + 1;
}

function addJournal(state: GameState, text: string, now: number): GameState {
  const entry: JournalEntry = {
    id: `${now}-${state.journal.length}`,
    text,
    time: now,
  };
  return { ...state, journal: [entry, ...state.journal].slice(0, JOURNAL_LIMIT) };
}

function addBond(state: GameState, amount: number, now: number): GameState {
  const previousLevel = relationshipLevel(state.bond);
  let next = { ...state, bond: state.bond + amount };
  const nextLevel = relationshipLevel(next.bond);

  for (let level = previousLevel + 1; level <= nextLevel; level += 1) {
    next = { ...next, coins: next.coins + 10, mementos: next.mementos + 1 };
    next = addJournal(next, `亲密度升到 ${level} 级，收下了一枚纪念章。`, now);
  }

  return next;
}

function addBondForMoment(state: GameState, momentId: string, amount: number, now: number) {
  if (state.bondedMoments.includes(momentId)) return state;
  const next = { ...state, bondedMoments: [...state.bondedMoments, momentId] };
  return addBond(next, amount, now);
}

export function switchScene(state: GameState, sceneId: SceneId, now = Date.now()): GameState {
  if (sceneId === state.currentScene) return state;

  const firstVisit = !state.exploredScenes.includes(sceneId);
  let next: GameState = {
    ...state,
    currentScene: sceneId,
    exploredScenes: firstVisit ? [...state.exploredScenes, sceneId] : state.exploredScenes,
  };

  if (!firstVisit) return next;

  next = { ...next, coins: next.coins + 3, mementos: next.mementos + 1 };
  next = addBond(next, 2, now);
  const sceneName = SCENES.find((scene) => scene.id === sceneId)?.name ?? "新地方";
  return addJournal(next, `第一次和雯宝来到${sceneName}。`, now);
}

export function getInteractionBlockMessage(state: GameState, furniture: FurnitureItem, actionId: string) {
  const effect = furniture.effects?.[actionId];
  if (!effect?.cost) return "";

  for (const [resource, amount] of Object.entries(effect.cost)) {
    if (amount && state[resource as "coins" | "seeds"] < amount) {
      return effect.insufficientMessage || "现在还不能进行这项互动。";
    }
  }

  return "";
}

export interface ActionResult {
  state: GameState;
  blockedMessage: string;
}

export function interactWithFurniture(
  state: GameState,
  furniture: FurnitureItem,
  action: PetAction,
  now = Date.now(),
): ActionResult {
  if (!furniture.actions.includes(action.id)) {
    return { state, blockedMessage: "这件物品现在没有这种互动。" };
  }

  const blockedMessage = getInteractionBlockMessage(state, furniture, action.id);
  if (blockedMessage) return { state, blockedMessage };

  const effect = furniture.effects?.[action.id];
  let next: GameState = {
    ...state,
    coins: state.coins - (effect?.cost?.coins ?? 0) + (effect?.reward?.coins ?? 0),
    seeds: state.seeds - (effect?.cost?.seeds ?? 0) + (effect?.reward?.seeds ?? 0),
    flowers: state.flowers + (effect?.reward?.flowers ?? 0),
    mementos: state.mementos + (effect?.reward?.mementos ?? 0),
    pet: {
      ...state.pet,
      currentAction: action.id,
      mood: action.mood,
      energy: Math.max(0, Math.min(100, state.pet.energy + (action.energyChange ?? 0))),
      happiness: Math.max(0, Math.min(100, state.pet.happiness + (action.happinessChange ?? 0))),
      lastInteraction: now,
    },
  };

  next = addBondForMoment(next, `furniture:${furniture.id}`, effect?.bond ?? 1, now);
  if (effect?.journal) next = addJournal(next, effect.journal, now);
  return { state: next, blockedMessage: "" };
}

export function petCompanion(state: GameState, now = Date.now()): GameState {
  let next: GameState = {
    ...state,
    pet: {
      ...state.pet,
      currentAction: "happy",
      mood: "happy",
      happiness: Math.min(100, state.pet.happiness + 7),
      lastInteraction: now,
    },
  };
  return addBondForMoment(next, "pet", 1, now);
}

export interface CoplayResult {
  state: GameState;
  action: CoplayAction | null;
  blockedMessage: string;
}

/** 共处动词：需要已创建 player；本地把雯宝当作同屏另一方。 */
export function applyCoplay(state: GameState, actionId: string, now = Date.now()): CoplayResult {
  if (!state.player) {
    return { state, action: null, blockedMessage: "先创建自己的角色，才能一起做点什么。" };
  }

  const action = getCoplayAction(actionId);
  if (!action) {
    return { state, action: null, blockedMessage: "还没有这种共处互动。" };
  }

  const me = state.player.name;
  const her = wenbebi.name;
  let next: GameState = {
    ...state,
    lastCoplayId: action.id,
    lastCoplayAt: now,
    pet: {
      ...state.pet,
      currentAction: action.petAction,
      mood: action.petAction === "sleep" || action.petAction === "rest" ? "sleepy" : "happy",
      happiness: Math.min(100, state.pet.happiness + 5),
      lastInteraction: now,
    },
  };

  next = addBondForMoment(next, `coplay:${action.id}`, action.bond, now);
  next = addJournal(
    next,
    action.journal.replaceAll("{me}", me).replaceAll("{her}", her),
    now,
  );

  return { state: next, action, blockedMessage: "" };
}
