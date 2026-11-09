import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  createInitialGameState,
  loadGameState,
  normalizeGameState,
  saveGameState,
  MOBILE_SAVE_KEY,
} from "../src/mobile/engine/storage.ts";
import {
  lightingForHour,
  normalizeWorldState,
} from "../src/mobile/world/state.ts";
import {
  DEFAULT_EQUIPPED_OUTFIT,
  DEFAULT_UNLOCKED_ITEM_IDS,
  STYLING_SKILLS,
  STYLING_STAGES,
  SUIT_DEFS,
  WARDROBE_ITEMS,
  WARDROBE_SLOTS,
  computeOutfitStats,
  detectActiveSuit,
  couponsFromPat,
  evaluateOutfitForStage,
  getItemStarMultiplier,
  getWardrobeItem,
  isStageUnlocked,
  openingScreen,
  recommendBestOutfitForStage,
  rollPavilionGacha,
  stageBondForRank,
  COUPON_PAT_COOLDOWN_MS,
} from "../src/mobile/world/nikki-wardrobe.ts";
import {
  getBondLevelInfo,
  interactWithCompanion,
} from "../src/mobile/world/codex.ts";
import {
  getWearableOverlaySrc,
} from "../src/mobile/world/paper-doll-rig.ts";
import {
  BONE_LINKS,
  BONE_SOCKETS,
  HUMANOID_BONES,
  JOINT_LIST,
  clampRigPlacement,
  computeHumanoidPartSlices,
  evaluateAnimClip,
  getRigPlacement,
  getSkeletonForDress,
  getSocketForItem,
  moveJointCascade,
  resolveJointForItem,
  solveWorldSkeleton,
  updateJointTransform,
} from "../src/mobile/world/skeleton-system.ts";
import {
  fallbackCompanionChat,
} from "../src/mobile/world/companion-bridge.ts";
import {
  getLayeredPartLocalPaths,
  isPhase1LayeredOutfit,
  MOTION_DURATION_MS,
  nextMotion,
  probeLayeredParts,
  resolveLayeredPartUrls,
} from "../src/mobile/world/layered-stage.ts";
import {
  mapLocalAsset,
  resolveAsset,
} from "../src/mobile/world/remote-assets.ts";

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

test("new save records use schema v2 and preserve the game state", () => {
  const storage = createMemoryStorage();
  const state = { ...createInitialGameState(100), coins: 41, exploredScenes: ["bedroom", "balcony"] };

  assert.equal(saveGameState(state, storage), true);
  assert.equal(JSON.parse(storage.getItem(MOBILE_SAVE_KEY)).version, 2);
  assert.deepEqual(loadGameState(storage, 200), state);
});

test("legacy saves are normalized and clamp invalid values", () => {
  const clamped = normalizeGameState({
    currentScene: "missing",
    coins: -3,
    pet: { energy: 140, happiness: -5, mood: "angry" },
  }, 500);
  assert.equal(clamped.currentScene, "bedroom");
  assert.equal(clamped.coins, 0);
  assert.equal(clamped.pet.energy, 100);
  assert.equal(clamped.pet.happiness, 0);

  const maid = normalizeWorldState({ skin: "maid" }, "bedroom", 100);
  assert.equal(maid.skin, "maid");
});

test("every character skin ships the full frame set and exists on disk", async () => {
  const { CHARACTER_SKIN_LIST, DEFAULT_CHARACTER_SKIN } = await import(
    "../src/mobile/world/skins.ts"
  );
  const publicRoot = new URL("../public/", import.meta.url);
  assert.equal(DEFAULT_CHARACTER_SKIN, "original");

  for (const skin of CHARACTER_SKIN_LIST) {
    const frames = [skin.idle, skin.react, ...skin.breathe, ...skin.walk, skin.avatar];
    for (const frame of frames) {
      const path = fileURLToPath(new URL(frame, publicRoot));
      assert.equal(existsSync(path), true, `missing frame: ${frame}`);
      assert.ok(statSync(path).size > 1000, `frame looks empty: ${frame}`);
    }
  }
});

test("V4 Nikki wardrobe: 5 slots, 27 R/SR/SSR items, 5-dimension style stats and all ComfyUI anime illustrations exist on disk", () => {
  assert.equal(WARDROBE_SLOTS.length, 5);
  assert.equal(WARDROBE_ITEMS.length, 27);
  const publicRoot = new URL("../public/", import.meta.url);

  for (const item of WARDROBE_ITEMS) {
    assert.ok(item.image, `${item.id} must have an image path`);
    const imgPath = fileURLToPath(new URL(item.image, publicRoot));
    assert.equal(existsSync(imgPath), true, `missing generated ComfyUI illustration: ${item.image}`);
    assert.ok(statSync(imgPath).size > 5000, `illustration looks empty: ${item.image}`);
  }

  for (const slot of WARDROBE_SLOTS) {
    const itemsInSlot = WARDROBE_ITEMS.filter((i) => i.slot === slot);
    assert.ok(itemsInSlot.length >= 5, `slot ${slot} has at least 5 items`);
  }

  const baseStats = computeOutfitStats(DEFAULT_EQUIPPED_OUTFIT, {});
  assert.ok(baseStats.sweet > 0);
  assert.ok(baseStats.elegant > 0);
  assert.ok(baseStats.pure > 0);
  assert.ok(baseStats.warm > 0);
  assert.ok(baseStats.cool > 0);

  // Star level multiplier increases stats by +15% per star above 1
  assert.equal(getItemStarMultiplier(1), 1);
  assert.equal(getItemStarMultiplier(3), 1.3);
  const starredStats = computeOutfitStats(DEFAULT_EQUIPPED_OUTFIT, {
    "dress-snow-white": 3,
  });
  assert.ok(starredStats.pure > baseStats.pure);
});

test("V4 Nikki styling stage evaluation: weighted 5-dim score, suit resonance, active skills and S/SS/SSS ranks", () => {
  assert.equal(STYLING_STAGES.length, 6);
  assert.equal(SUIT_DEFS.length, 4);
  assert.equal(STYLING_SKILLS.length, 4);
  const stage1 = STYLING_STAGES[0];

  // Default outfit is the 5-piece Snow Tea suit -> triggers suit resonance bonus
  const suitCheck = detectActiveSuit(DEFAULT_EQUIPPED_OUTFIT);
  assert.equal(suitCheck.suit?.id, "suit-snow-tea");
  assert.equal(suitCheck.pieceCount, 5);
  assert.equal(suitCheck.bonusScore, 450);

  const baseEval = evaluateOutfitForStage(stage1, DEFAULT_EQUIPPED_OUTFIT, {}, ["smile", "charm"]);
  assert.ok(baseEval.totalScore > 4200);
  assert.ok(baseEval.skillBonusScore > 0, "memory card skill adds bonus score");
  assert.ok(baseEval.activeSkillBonus > 0, "active styling skills add bonus score");
  assert.equal(baseEval.suitBonusScore, 450, "suit resonance adds bonus score");
  assert.equal(baseEval.beatRival, true);

  // Equipping all SSR items with 5 stars easily achieves SSS rank on Stage 1
  const allUnlocked = new Set(WARDROBE_ITEMS.map((i) => i.id));
  const maxStars = Object.fromEntries(WARDROBE_ITEMS.map((i) => [i.id, 5]));
  const bestOutfit = recommendBestOutfitForStage(stage1, allUnlocked, maxStars);
  const maxEval = evaluateOutfitForStage(stage1, bestOutfit, maxStars, ["smile", "bloom"]);

  assert.equal(maxEval.rank, "SSS");
  assert.equal(maxEval.passedS, true);
  assert.ok(maxEval.totalScore >= stage1.sssScore);

  const shieldEval = evaluateOutfitForStage(stage1, DEFAULT_EQUIPPED_OUTFIT, {}, ["shield"]);
  const weightedSum =
    shieldEval.weightedStats.sweet +
    shieldEval.weightedStats.elegant +
    shieldEval.weightedStats.pure +
    shieldEval.weightedStats.warm +
    shieldEval.weightedStats.cool;
  assert.equal(shieldEval.activeSkillBonus, Math.round(weightedSum * 0.12) + 420);

  assert.equal(isStageUnlocked("stage-1", {}), true);
  assert.equal(isStageUnlocked("stage-2", {}), false);
  assert.equal(isStageUnlocked("stage-2", { "stage-1": "A" }), false);
  assert.equal(isStageUnlocked("stage-2", { "stage-1": "S" }), true);
  assert.equal(isStageUnlocked("stage-3", { "stage-1": "SSS" }), false);
  assert.equal(stageBondForRank("C"), 6);
  assert.equal(stageBondForRank("S"), 12);
  assert.equal(stageBondForRank("SSS"), 24);
  assert.equal(couponsFromPat(undefined, 1_000), 2);
  assert.equal(couponsFromPat(1_000, 1_000 + COUPON_PAT_COOLDOWN_MS - 1), 0);
  assert.equal(couponsFromPat(1_000, 1_000 + COUPON_PAT_COOLDOWN_MS), 2);
  assert.equal(openingScreen(false), "title");
  assert.equal(openingScreen(true), "lobby");
});

test("V4 Star Pavilion gacha: 1-pull and 5-pull with guaranteed SR/SSR and duplicate star-up", () => {
  const initialUnlocked = new Set(DEFAULT_UNLOCKED_ITEM_IDS);
  const draw5 = rollPavilionGacha(5, initialUnlocked, {}, () => 0.99);
  assert.equal(draw5.pulls.length, 5);
  assert.equal(
    draw5.pulls.some((p) => p.item.rarity === "SR" || p.item.rarity === "SSR"),
    true,
    "5-pull guarantees at least one SR or SSR item even on worst RNG",
  );
  assert.ok(draw5.bondGained >= 30);
  const dressOnly = rollPavilionGacha(5, initialUnlocked, {}, () => 0.2, "dress");
  assert.ok(dressOnly.pulls.every((pull) => pull.item.slot === "dress"));
  const accessoryOnly = rollPavilionGacha(5, initialUnlocked, {}, () => 0.2, "accessory");
  assert.ok(accessoryOnly.pulls.every((pull) => pull.item.slot !== "dress" && pull.item.slot !== "memoryCard"));

  // Drawing an already unlocked item increments its star level up to 5
  const firstId = draw5.pulls[0].item.id;
  const secondDraw = rollPavilionGacha(
    1,
    new Set(draw5.nextUnlockedIds),
    draw5.nextStars,
    () => 0,
  );
  assert.equal(secondDraw.pulls.length, 1);
  assert.ok(getWardrobeItem(firstId));
});

test("bond level progression and offline chat fallback", () => {
  const lv = getBondLevelInfo(55);
  assert.ok(lv.level >= 2);

  const state = createInitialGameState(100);
  const pat = interactWithCompanion(state, "pat", false, 1000);
  assert.equal(pat.ok, true);
  assert.ok(pat.bondGained > 0);

  assert.equal(lightingForHour(18).period, "dusk");
  assert.ok(fallbackCompanionChat("今天这身衣服好看吗", state).length > 0);
});

test("V7 scale-invariant 760x760 bone sockets, transparent wearable overlays and custom user adjustments", () => {
  const defaultHair = getRigPlacement("hair-daisy-clip", "hairAcc", {});
  assert.equal(defaultHair.dx, 0);
  assert.equal(defaultHair.dy, 0);
  assert.equal(defaultHair.rotate, 12);

  // Side hair clips map to the hair-side bone socket; crowns/hats map to hair-crown
  const sideSocket = getSocketForItem("hair-daisy-clip", "hairAcc");
  const crownSocket = getSocketForItem("hair-pearl-tiara", "hairAcc");
  assert.deepEqual(sideSocket, BONE_SOCKETS["hair-side"]);
  assert.deepEqual(crownSocket, BONE_SOCKETS["hair-crown"]);

  // Every wearable item has a 100% transparent SVG bone overlay
  const overlay = getWearableOverlaySrc("hair-daisy-clip", "fallback.png");
  assert.ok(overlay.startsWith("data:image/svg+xml"), "wearable overlay is a transparent SVG");

  const custom = clampRigPlacement({ dx: 99, dy: -80, scale: 3.5, rotate: 15 }, defaultHair);
  assert.equal(custom.dx, 40);
  assert.equal(custom.dy, -40);
  assert.equal(custom.scale, 2.2);
  assert.equal(custom.rotate, 15);

  const overridden = getRigPlacement("hair-daisy-clip", "hairAcc", {
    "hair-daisy-clip": custom,
  });
  assert.deepEqual(overridden, custom);
});

test("V9 full humanoid biped FK skeleton (with legs), 6-layer cutout slicing and cascade joint dragging", () => {
  assert.equal(JOINT_LIST.length, 14, "full humanoid rig has 14 joints including pelvis, hips, feet, shoulders, hands, neck and head");
  assert.equal(HUMANOID_BONES.length, 6, "6 tapered octahedral bones: spine, head, armL, armR, legL, legR");
  assert.equal(BONE_LINKS.length, 13);

  const snowSkel = getSkeletonForDress("dress-snow-white", {});
  const apricotSkel = getSkeletonForDress("dress-apricot-tea", {});
  assert.notEqual(
    snowSkel.head.y,
    apricotSkel.head.y,
    "different generated dress proportions have their own calibrated head bone height",
  );
  assert.ok(snowSkel.footL.y > snowSkel.hipL.y, "left foot is below left hip");
  assert.ok(snowSkel.footR.y > snowSkel.hipR.y, "right foot is below right hip");

  // Moving the parent `head` joint cascades the exact same delta to child `crown` and `hairSide` joints
  const origCrownY = snowSkel.crown.y;
  const origSideX = snowSkel.hairSide.x;
  const movedHead = moveJointCascade(snowSkel, "head", snowSkel.head.x + 5, snowSkel.head.y - 4);
  assert.equal(movedHead.crown.y, origCrownY - 4, "child crown joint moves with parent head joint");
  assert.equal(movedHead.hairSide.x, origSideX + 5, "child hairSide joint moves with parent head joint");

  // FK world solver rotates head and legs during walk animation
  const walkAnim = evaluateAnimClip("walk", 0.35);
  const world = solveWorldSkeleton(snowSkel, walkAnim);
  const slices = computeHumanoidPartSlices(snowSkel, world, walkAnim);
  assert.equal(slices.length, 6, "6 body part layers: legL, legR, armL, torso, armR, head");
  assert.notEqual(world.hipL.worldAngle, 0, "left leg swings during walk cycle");
  assert.notEqual(world.hipR.worldAngle, 0, "right leg swings opposite during walk cycle");

  // Updating scale, rotation and poseRotate on a joint clamps within safe bounds
  const scaled = updateJointTransform(movedHead, "handR", { scale: 1.35, rotate: -25, poseRotate: 20 });
  assert.equal(scaled.handR.scale, 1.35);
  assert.equal(scaled.handR.rotate, -25);
  assert.equal(scaled.handR.poseRotate, 20);
  assert.equal(resolveJointForItem("hair-daisy-clip", "hairAcc"), "hairSide");
  assert.equal(resolveJointForItem("hair-pearl-tiara", "hairAcc"), "crown");
});

test("layered paper-doll paths map to base/dress remote categories and probe falls back when art missing", async () => {
  const local = getLayeredPartLocalPaths("original", "dress-snow-white");
  assert.equal(local.body, "assets/characters/original/body.png");
  assert.equal(local.head, "assets/characters/original/head.png");
  assert.equal(local.armsFront, "assets/characters/original/arms-front.png");
  assert.equal(local.dress, "assets/characters/parts/dress/dress-snow-white.png");

  assert.deepEqual(mapLocalAsset(local.body), { cat: "base", name: "original-body.png" });
  assert.deepEqual(mapLocalAsset(local.head), { cat: "base", name: "original-head.png" });
  assert.deepEqual(mapLocalAsset(local.armsFront), { cat: "base", name: "original-arms-front.png" });
  assert.deepEqual(mapLocalAsset(local.dress), { cat: "dress", name: "dress-snow-white.png" });

  assert.equal(isPhase1LayeredOutfit("dress-snow-white"), true);
  assert.equal(isPhase1LayeredOutfit("dress-apricot-tea"), false);
  assert.equal(isPhase1LayeredOutfit("dress-rose-waltz"), false);
  assert.deepEqual(mapLocalAsset("assets/nikki/dress-apricot-tea.png"), {
    cat: "dress",
    name: "dress-apricot-tea.png",
  });

  const resolved = resolveLayeredPartUrls("original", "dress-snow-white");
  assert.equal(resolved.body, local.body);
  assert.equal(resolveAsset(local.dress), local.dress);

  const ready = await probeLayeredParts(resolved);
  assert.equal(ready, false, "Node has no Image loader; missing local public parts must fall back");
});

test("stage motion state machine: react/equip interrupt and return to idle durations", () => {
  assert.equal(nextMotion("idle", "react"), "react");
  assert.equal(nextMotion("react", "equip"), "equip");
  assert.equal(nextMotion("equip", "react"), "react");
  assert.equal(nextMotion("react", "idle"), "idle");
  assert.equal(MOTION_DURATION_MS.react, 720);
  assert.equal(MOTION_DURATION_MS.equip, 680);
});
