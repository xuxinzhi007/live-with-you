import assert from "node:assert/strict";
import test from "node:test";
import { PET_ACTIONS } from "../src/mobile/data/pet-actions.ts";
import { SCENE_FURNITURE } from "../src/mobile/data/scenes.ts";
import {
  interactWithFurniture,
  petCompanion,
  switchScene,
} from "../src/mobile/engine/game-rules.ts";
import {
  createInitialGameState,
  loadGameState,
  normalizeGameState,
  saveGameState,
  MOBILE_SAVE_KEY,
} from "../src/mobile/engine/storage.ts";

function createMemoryStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}

test("new save records use schema v2 and preserve the mobile game state", () => {
  const storage = createMemoryStorage();
  const state = { ...createInitialGameState(100), coins: 41, exploredScenes: ["bedroom", "balcony"] };

  assert.equal(saveGameState(state, storage), true);
  assert.equal(JSON.parse(storage.getItem(MOBILE_SAVE_KEY)).version, 2);
  assert.deepEqual(loadGameState(storage, 200), state);
});

test("legacy mobile saves are normalized without daily task state", () => {
  const storage = createMemoryStorage({
    "wenbebi-mobile-game-v1": JSON.stringify({
      currentScene: "balcony",
      coins: 12,
      seeds: 2,
      daily: { completed: true },
      streak: 9,
    }),
  });

  const state = loadGameState(storage, 200);
  assert.equal(state.currentScene, "balcony");
  assert.equal(state.coins, 12);
  assert.equal("daily" in state, false);
  assert.equal("streak" in state, false);
});

test("save normalization clamps values and drops invalid scenes", () => {
  const state = normalizeGameState({
    currentScene: "missing",
    coins: -3,
    pet: { energy: 140, happiness: -5, mood: "angry" },
    exploredScenes: ["balcony", "missing", "balcony"],
  }, 500);

  assert.equal(state.currentScene, "bedroom");
  assert.equal(state.coins, 0);
  assert.equal(state.pet.energy, 100);
  assert.equal(state.pet.happiness, 0);
  assert.equal(state.pet.mood, "normal");
  assert.deepEqual(state.exploredScenes, ["balcony"]);
});

test("furniture costs and rewards are data-driven and one interaction cannot be bonded repeatedly", () => {
  const state = createInitialGameState(100);
  const snack = SCENE_FURNITURE.bedroom.find((item) => item.id === "snack");
  const treat = PET_ACTIONS.find((action) => action.id === "treat");
  assert.ok(snack && treat);

  const result = interactWithFurniture(state, snack, treat, 200);
  assert.equal(result.blockedMessage, "");
  assert.equal(result.state.coins, 15);
  assert.equal(result.state.pet.happiness, state.pet.happiness + 10);
  assert.equal(result.state.bond, 1);

  const repeated = interactWithFurniture(result.state, snack, treat, 300);
  assert.equal(repeated.state.coins, 12);
  assert.equal(repeated.state.bond, 1);
});

test("insufficient resources block the configured furniture action", () => {
  const state = { ...createInitialGameState(100), coins: 0 };
  const snack = SCENE_FURNITURE.bedroom.find((item) => item.id === "snack");
  const treat = PET_ACTIONS.find((action) => action.id === "treat");
  assert.ok(snack && treat);

  const result = interactWithFurniture(state, snack, treat, 200);
  assert.match(result.blockedMessage, /零钱不够/);
  assert.equal(result.state, state);
});

test("discovering a location journals it once, and repeated petting is not a progression task", () => {
  const initial = createInitialGameState(100);
  const firstVisit = switchScene(initial, "balcony", 200);
  const returnVisit = switchScene(firstVisit, "bedroom", 300);
  const revisit = switchScene(returnVisit, "balcony", 400);

  assert.equal(revisit.journal.length, 1);
  assert.equal(revisit.bond, 2);
  const firstPet = petCompanion(revisit, 500);
  const secondPet = petCompanion(firstPet, 600);
  assert.equal(firstPet.bond, 3);
  assert.equal(secondPet.bond, 3);
});
