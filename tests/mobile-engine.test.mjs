import assert from "node:assert/strict";
import test from "node:test";
import { PET_ACTIONS } from "../src/mobile/data/pet-actions.ts";
import { SCENE_FURNITURE } from "../src/mobile/data/scenes.ts";
import { COPLAY_ACTIONS } from "../src/mobile/data/coplay-actions.ts";
import {
  applyCoplay,
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
import { furnitureNearSlots, preferredSlot } from "../src/mobile/data/slots.ts";
import {
  createRoomCode,
  displayCodeFromRoomId,
  isValidRoomCode,
  normalizeRoomCode,
  roomIdFromCode,
} from "../src/mobile/multiplayer/room-code.ts";

import { ROOMS, getProp } from "../src/mobile/world/rooms.ts";
import {
  createInitialWorldState,
  normalizeWorldState,
  PLOT_GROW_MS,
  plotStage,
} from "../src/mobile/world/state.ts";
import {
  applyPropAction,
  cooldownLeftMs,
  enterRoom,
  recordBallCatch,
  recordBallKick,
} from "../src/mobile/world/actions.ts";
import { CATCH_RANGE, WorldRuntime } from "../src/mobile/world/runtime.ts";

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

function tick(runtime, ms, step = 16) {
  let elapsed = 0;
  while (elapsed < ms) {
    runtime.tick(step);
    elapsed += step;
  }
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
  assert.equal(state.player, null);
  assert.equal("daily" in state, false);
  assert.equal("streak" in state, false);
});

test("coplay verbs require a player and leave journal traces for all six actions", () => {
  const noPlayer = applyCoplay(createInitialGameState(100), "greet", 100);
  assert.equal(noPlayer.blockedMessage.includes("创建"), true);

  let state = {
    ...createInitialGameState(100),
    player: { playerId: "p-test-deer", name: "小鹿", lookId: "soft", createdAt: 50 },
  };

  assert.ok(COPLAY_ACTIONS.length >= 5);

  for (const [index, action] of COPLAY_ACTIONS.entries()) {
    const result = applyCoplay(state, action.id, 200 + index);
    assert.equal(result.blockedMessage, "");
    assert.equal(result.state.lastCoplayId, action.id);
    assert.equal(result.state.journal[0].text.includes("小鹿"), true);
    state = result.state;
  }

  assert.equal(state.bondedMoments.filter((id) => id.startsWith("coplay:")).length, COPLAY_ACTIONS.length);
});

test("player profile is preserved and invalid player falls back to null (needs create flow)", () => {
  const withPlayer = normalizeGameState({
    player: { name: " 小鹿 ", lookId: "bright", createdAt: 99 },
  }, 500);
  assert.equal(withPlayer.player?.name, "小鹿");
  assert.equal(withPlayer.player?.lookId, "bright");
  assert.ok(withPlayer.player?.playerId);

  const withId = normalizeGameState({
    player: { playerId: "fixed-id", name: "小鹿", lookId: "soft", createdAt: 99 },
  }, 500);
  assert.equal(withId.player?.playerId, "fixed-id");

  const legacyNoPlayer = normalizeGameState({ coins: 3 }, 500);
  assert.equal(legacyNoPlayer.player, null);

  const badPlayer = normalizeGameState({ player: { name: "  ", lookId: "nope" } }, 500);
  assert.equal(badPlayer.player, null);
});

test("coplay furniture hints stay scene-local for short approaches", async () => {
  const { coplayFurnitureHint, nearPoseForActor } = await import("../src/mobile/engine/stage-motion.ts");
  assert.equal(coplayFurnitureHint("sit", "bedroom"), "armchair");
  assert.equal(coplayFurnitureHint("look", "bedroom"), "window-a");
  assert.equal(coplayFurnitureHint("greet", "bedroom"), null);
  const chair = SCENE_FURNITURE.bedroom.find((item) => item.id === "armchair");
  assert.ok(chair);
  const selfNear = nearPoseForActor(chair, "self");
  assert.equal(selfNear.bottom <= 14, true);
});

test("room short codes normalize and map to stable room ids", () => {
  assert.equal(normalizeRoomCode(" k7m2 "), "K7M2");
  assert.equal(isValidRoomCode("ab"), false);
  assert.equal(isValidRoomCode("K7M2"), true);
  assert.equal(roomIdFromCode("k7m2"), "wb-K7M2");
  assert.equal(displayCodeFromRoomId("wb-K7M2"), "K7M2");
  assert.equal(createRoomCode().length, 4);
});

test("standing slots assign L/R stably by playerId and furniture near slots prefer anchors", () => {
  assert.equal(preferredSlot("a", ["b"]), "L");
  assert.equal(preferredSlot("b", ["a"]), "R");
  const armchair = SCENE_FURNITURE.bedroom.find((item) => item.id === "armchair");
  assert.ok(armchair?.anchors);
  assert.deepEqual(furnitureNearSlots(armchair), armchair.anchors);
  assert.deepEqual(
    furnitureNearSlots({ left: 10, bottom: 14, w: 20 }),
    { L: { left: 15.6, bottom: 13 }, R: { left: 24.4, bottom: 13 } },
  );
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

test("V2 world state is additive, migrates old scenes and clamps bad clocks", () => {
  const fresh = normalizeGameState({}, 100);
  assert.equal(fresh.world.room, "home");
  assert.equal(fresh.world.skin, "original");
  assert.equal(fresh.world.plots.length, 3);
  assert.equal(fresh.world.seenIntro, false);
  assert.deepEqual(fresh.world.collection, { daisy: 0, rose: 0, sunflower: 0 });

  const legacy = normalizeGameState({ currentScene: "balcony", coins: 4 }, 100);
  assert.equal(legacy.world.room, "garden");
  assert.equal(legacy.coins, 4);

  const skewed = normalizeWorldState({ cooldowns: { bed: 100 + 10_000_000 } }, "bedroom", 100);
  assert.equal(skewed.cooldowns.bed, 100 + 10 * 60_000);

  const bad = normalizeWorldState({ room: "moon", plots: [{ kind: "tree" }, null] }, "bedroom", 100);
  assert.equal(bad.room, "home");
  assert.equal(bad.plots[0].kind, null);
  assert.equal(bad.plots.length, 3);
});

test("character skin defaults to the original white look and survives bad values", () => {
  const fresh = normalizeGameState({}, 100);
  assert.equal(fresh.world.skin, "original");

  const maid = normalizeWorldState({ skin: "maid" }, "bedroom", 100);
  assert.equal(maid.skin, "maid");

  const unknown = normalizeWorldState({ skin: "whale" }, "bedroom", 100);
  assert.equal(unknown.skin, "original");

  const notAString = normalizeWorldState({ skin: 42 }, "bedroom", 100);
  assert.equal(notAString.skin, "original");

  const legacy = normalizeGameState({ currentScene: "balcony" }, 100);
  assert.equal(legacy.world.skin, "original", "old saves without a skin use the white one");

  const storage = createMemoryStorage();
  const saved = { ...createInitialGameState(100) };
  saved.world = { ...saved.world, skin: "maid" };
  assert.equal(saveGameState(saved, storage), true);
  assert.equal(loadGameState(storage, 200).world.skin, "maid");
});

test("every character skin ships the full frame set and shares one baseline", async () => {
  const { CHARACTER_SKINS, CHARACTER_SKIN_LIST, DEFAULT_CHARACTER_SKIN } = await import(
    "../src/mobile/world/skins.ts"
  );
  assert.equal(DEFAULT_CHARACTER_SKIN, "original");
  assert.deepEqual(CHARACTER_SKIN_LIST.map((skin) => skin.id), ["original", "maid"]);

  for (const skin of CHARACTER_SKIN_LIST) {
    assert.equal(skin.metrics.frame, 760);
    assert.equal(skin.metrics.baseline, 748 / 760);
    assert.ok(skin.metrics.visibleHeight > 600 && skin.metrics.visibleHeight <= 760);
    assert.equal(skin.walk.length, 4);
    assert.ok(skin.idle.includes(`/characters/${skin.id}/`));
    assert.ok(skin.react.includes(`/characters/${skin.id}/`));
    assert.ok(skin.avatar.includes(`/characters/${skin.id}/`));
    for (const frame of skin.walk) assert.ok(frame.includes(`/characters/${skin.id}/`));
  }

  assert.equal(CHARACTER_SKINS.original.label, "白色");
  assert.equal(CHARACTER_SKINS.maid.label, "小鲸鱼");
});

test("every room keeps a clear walking lane and key props are character-scaled", () => {
  for (const room of Object.values(ROOMS)) {
    for (let x = room.walk.x0 + 10; x <= room.walk.x1 - 10; x += 10) {
      const runtime = new WorldRuntime(room, { x, y: 880 });
      assert.equal(runtime.canStand(x, 880), true, `${room.id} blocked at x=${x}`);
    }
  }

  const heroHeight = 300;
  const keyProps = [
    ["home", "bed"],
    ["home", "desk"],
    ["home", "shelf"],
    ["home", "home-street-door"],
  ];
  for (const [roomId, propId] of keyProps) {
    const prop = getProp(roomId, propId);
    assert.ok(prop, `${propId} missing`);
    const ratio = prop.h / heroHeight;
    assert.ok(ratio >= 0.6 && ratio <= 1.5, `${propId} ratio ${ratio.toFixed(2)}`);
  }
});

test("walking follows the lane, stops at the target and moves the camera", () => {
  const room = ROOMS.home;
  const runtime = new WorldRuntime(room, room.defaultSpawn);
  runtime.setViewport(500);
  runtime.snapCamera();

  const bed = getProp("home", "bed");
  assert.ok(bed);
  runtime.moveTo(bed.x, 880);
  tick(runtime, 1600);

  assert.ok(Math.abs(runtime.player.x - bed.x) < 6);
  assert.equal(runtime.player.moving, false);
  assert.ok(runtime.cameraX > 0);
  assert.ok(Math.abs(runtime.cameraX - (runtime.player.x - 250)) < 46);
});

test("the garden ball can be kicked and caught while it is still moving", () => {
  const ballProp = getProp("garden", "garden-ball");
  assert.ok(ballProp);
  const runtime = new WorldRuntime(ROOMS.garden, { x: ballProp.x, y: 884 });
  runtime.setViewport(500);
  const ball = runtime.ball;
  assert.ok(ball);

  runtime.kickBall();
  assert.ok(ball.flight, "ball should be in flight");
  tick(runtime, 700);
  assert.equal(runtime.canCatch(), true);
  assert.ok(runtime.ballDistance() <= CATCH_RANGE);

  assert.equal(runtime.catchBall(), true);
  assert.equal(ball.combo, 1);
  assert.ok(runtime.ballDistance() <= CATCH_RANGE, "ball returns to the player");

  tick(runtime, 700);
  runtime.kickBall();
  tick(runtime, 700);
  assert.equal(runtime.catchBall(), true);
  assert.equal(ball.combo, 2);
});

test("garden plant, water and harvest form a closed loop that keeps a seed", () => {
  const plot = getProp("garden", "plot-0");
  assert.ok(plot);

  const base = { ...createInitialGameState(100), seeds: 1 };
  const planted = applyPropAction(base, plot, 1000);
  assert.equal(planted.tone, "ok");
  assert.equal(planted.state.world.plots[0].kind, "daisy");
  assert.equal(planted.state.seeds, 0);
  assert.equal(plotStage(planted.state.world.plots[0], 2000), 1);

  const watered = applyPropAction(planted.state, plot, 2000);
  assert.ok(watered.state.world.plots[0].wateredAt > 0);
  assert.match(watered.line, /浇了水/);

  const harvested = applyPropAction(watered.state, plot, 2000 + PLOT_GROW_MS + 1);
  assert.equal(harvested.tone, "reward");
  assert.equal(harvested.state.flowers, 1);
  assert.equal(harvested.state.seeds, 1, "harvest leaves a seed for the next round");
  assert.equal(harvested.state.world.collection.daisy, 1);
  assert.equal(harvested.state.mementos, 1);
  assert.equal(harvested.state.world.plots[0].kind, null);
  assert.ok(harvested.state.journal[0].text.includes("雏菊"));
});

test("prop actions apply a gentle cooldown and can never soft-lock the player", () => {
  const bed = getProp("home", "bed");
  assert.ok(bed);
  const state = {
    ...createInitialGameState(100),
    pet: { ...createInitialGameState(100).pet, energy: 90 },
  };

  const first = applyPropAction(state, bed, 1000);
  assert.equal(first.tone, "ok");
  assert.equal(first.state.pet.energy, 100);
  assert.ok(cooldownLeftMs(first.state, "bed", 1500) > 0);

  const second = applyPropAction(first.state, bed, 2000);
  assert.equal(second.tone, "blocked");
  assert.match(second.line, /歇/);
});

test("street shop, room visits and ball milestones respect low-pressure rules", () => {
  const stall = getProp("street", "flower-stall");
  assert.ok(stall);

  const rich = { ...createInitialGameState(100), coins: 10, seeds: 0 };
  const bought = applyPropAction(rich, stall, 1000);
  assert.equal(bought.state.coins, 4);
  assert.equal(bought.state.seeds, 2);

  const poor = applyPropAction({ ...createInitialGameState(200), coins: 3 }, stall, 1000);
  assert.equal(poor.tone, "blocked");
  assert.match(poor.line, /零钱/);

  const entered = enterRoom(createInitialGameState(100), "garden", 300);
  assert.equal(entered.currentScene, "balcony");
  assert.equal(entered.world.room, "garden");
  assert.equal(entered.coins, 21);
  assert.equal(entered.journal.length, 1);
  assert.equal(enterRoom(entered, "garden", 400).journal.length, 1);

  const kicked = recordBallKick(createInitialGameState(100));
  assert.equal(kicked.world.kicks, 1);
  const caught = recordBallCatch(kicked, 3, 500);
  assert.equal(caught.world.bestCombo, 3);
  assert.equal(caught.mementos, 1);
  assert.ok(caught.journal[0].text.includes("连续接住 3 次球"));
});

test("V2 world state round-trips through the mobile save", () => {
  const storage = createMemoryStorage();
  const base = createInitialGameState(100);
  const state = {
    ...base,
    seeds: 2,
    world: {
      ...base.world,
      room: "garden",
      seenIntro: true,
      planted: 1,
      harvested: 1,
      collection: { daisy: 2, rose: 0, sunflower: 0 },
      plots: [
        { kind: "rose", plantedAt: 50, wateredAt: 60 },
        { kind: null, plantedAt: 0, wateredAt: 0 },
        { kind: null, plantedAt: 0, wateredAt: 0 },
      ],
      visited: ["home", "garden"],
    },
  };

  assert.equal(saveGameState(state, storage), true);
  const loaded = loadGameState(storage, 200);
  assert.equal(loaded.world.room, "garden");
  assert.equal(loaded.world.seenIntro, true);
  assert.equal(loaded.world.collection.daisy, 2);
  assert.equal(loaded.world.plots[0].kind, "rose");
  assert.deepEqual(loaded.world.visited, ["home", "garden"]);
});
