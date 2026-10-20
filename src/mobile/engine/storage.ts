import { SCENES, type SceneId } from "../data/scenes.ts";
import { INITIAL_PET_STATE, type PetMood } from "../data/pet-actions.ts";
import { PLAYER_LOOKS, type PlayerLookId } from "../data/player-looks.ts";
import type { GameState, JournalEntry, PlayerProfile } from "./types.ts";

export const MOBILE_SAVE_KEY = "wenbebi-mobile-game-v2";
const LEGACY_SAVE_KEY = "wenbebi-mobile-game-v1";
const JOURNAL_LIMIT = 48;
const MOODS: PetMood[] = ["happy", "normal", "sleepy", "excited", "curious"];
const LOOK_IDS = new Set(PLAYER_LOOKS.map((look) => look.id));

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clamp(value: unknown, fallback: number, max = 9_999_999) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(max, Math.floor(value)))
    : fallback;
}

function isSceneId(value: unknown): value is SceneId {
  return SCENES.some((scene) => scene.id === value);
}

function ensurePlayerId(value: unknown): string {
  if (typeof value === "string" && value.trim()) return value.trim().slice(0, 64);
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizePlayer(value: unknown, now: number): PlayerProfile | null {
  if (!isRecord(value)) return null;
  if (typeof value.name !== "string") return null;
  const name = value.name.trim().slice(0, 12);
  if (!name) return null;
  const lookId = LOOK_IDS.has(value.lookId as PlayerLookId)
    ? (value.lookId as PlayerLookId)
    : PLAYER_LOOKS[0].id;
  return {
    playerId: ensurePlayerId(value.playerId),
    name,
    lookId,
    createdAt: clamp(value.createdAt, now, Number.MAX_SAFE_INTEGER),
  };
}

export function createPlayerId(): string {
  return ensurePlayerId(undefined);
}

export function createInitialGameState(now = Date.now()): GameState {
  return {
    currentScene: "bedroom",
    pet: { ...INITIAL_PET_STATE, lastInteraction: now },
    player: null,
    coins: 18,
    seeds: 1,
    flowers: 0,
    mementos: 0,
    bond: 0,
    exploredScenes: ["bedroom"],
    bondedMoments: [],
    journal: [],
    lastCoplayId: null,
    lastCoplayAt: 0,
  };
}

export function normalizeGameState(value: unknown, now = Date.now()): GameState {
  const fresh = createInitialGameState(now);
  if (!isRecord(value)) return fresh;

  const currentScene = isSceneId(value.currentScene) ? value.currentScene : fresh.currentScene;
  const savedPet = isRecord(value.pet) ? value.pet : {};
  const exploredScenes = Array.isArray(value.exploredScenes)
    ? Array.from(new Set(value.exploredScenes.filter(isSceneId)))
    : fresh.exploredScenes;
  const bondedMoments = Array.isArray(value.bondedMoments)
    ? Array.from(new Set(value.bondedMoments.filter((item): item is string => typeof item === "string")))
    : [];
  const journal: JournalEntry[] = [];

  if (Array.isArray(value.journal)) {
    for (const [index, item] of value.journal.entries()) {
      if (!isRecord(item) || typeof item.text !== "string" || !Number.isFinite(item.time)) continue;
      journal.push({
        id: typeof item.id === "string" ? item.id : `${item.time}-${index}`,
        text: item.text,
        time: Number(item.time),
      });
      if (journal.length === JOURNAL_LIMIT) break;
    }
  }

  return {
    ...fresh,
    currentScene,
    pet: {
      ...fresh.pet,
      currentAction: "idle",
      mood: MOODS.includes(savedPet.mood as PetMood) ? savedPet.mood as PetMood : "normal",
      energy: clamp(savedPet.energy, fresh.pet.energy, 100),
      happiness: clamp(savedPet.happiness, fresh.pet.happiness, 100),
      lastInteraction: clamp(savedPet.lastInteraction, now, Number.MAX_SAFE_INTEGER),
    },
    player: normalizePlayer(value.player, now),
    coins: clamp(value.coins, fresh.coins),
    seeds: clamp(value.seeds, fresh.seeds),
    flowers: clamp(value.flowers, fresh.flowers),
    mementos: clamp(value.mementos, fresh.mementos),
    bond: clamp(value.bond, fresh.bond),
    exploredScenes: exploredScenes.length ? exploredScenes : ["bedroom"],
    bondedMoments,
    journal,
    lastCoplayId: typeof value.lastCoplayId === "string" ? value.lastCoplayId : null,
    lastCoplayAt: clamp(value.lastCoplayAt, 0, Number.MAX_SAFE_INTEGER),
  };
}

function browserStorage(): StorageLike | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadGameState(storage = browserStorage(), now = Date.now()): GameState {
  const fresh = createInitialGameState(now);
  if (!storage) return fresh;

  for (const key of [MOBILE_SAVE_KEY, LEGACY_SAVE_KEY]) {
    try {
      const serialized = storage.getItem(key);
      if (serialized) return normalizeGameState(JSON.parse(serialized), now);
    } catch {
      // Try the previous save key if the latest record is malformed.
    }
  }

  return fresh;
}

export function saveGameState(state: GameState, storage = browserStorage()): boolean {
  if (!storage) return false;
  try {
    storage.setItem(MOBILE_SAVE_KEY, JSON.stringify({ version: 2, ...state }));
    return true;
  } catch {
    return false;
  }
}
