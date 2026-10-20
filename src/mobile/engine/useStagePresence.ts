import { useCallback, useEffect, useRef, useState } from "react";
import type { FurnitureItem, SceneId } from "../data/scenes.ts";
import type { CoplayJuice } from "../data/coplay-actions.ts";
import type { SlotId, SlotPose } from "../data/slots.ts";
import {
  APPROACH_MS,
  RETURN_HOME_MS,
  SCENE_FADE_MS,
  coplayFurnitureHint,
  coplayPairPoses,
  nearPoseForActor,
  poseFromSlot,
} from "./stage-motion.ts";

function playBandPose(pose: SlotPose): SlotPose {
  // 竖屏玩法带：脚底不要飘到半空（窗等高物件）
  return { left: pose.left, bottom: Math.min(pose.bottom, 14) };
}

export function useStagePresence(homeSelf: SlotId, homeOther: SlotId = "R") {
  const [selfPose, setSelfPose] = useState<SlotPose>(() => poseFromSlot(homeSelf));
  const [otherPose, setOtherPose] = useState<SlotPose>(() => poseFromSlot(homeOther));
  const [sceneFade, setSceneFade] = useState(false);
  const returnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const homeSelfRef = useRef(homeSelf);
  const homeOtherRef = useRef(homeOther);

  useEffect(() => {
    homeSelfRef.current = homeSelf;
    setSelfPose(poseFromSlot(homeSelf));
  }, [homeSelf]);

  useEffect(() => {
    homeOtherRef.current = homeOther;
    setOtherPose(poseFromSlot(homeOther));
  }, [homeOther]);

  useEffect(() => () => {
    if (returnTimer.current) clearTimeout(returnTimer.current);
    if (fadeTimer.current) clearTimeout(fadeTimer.current);
  }, []);

  const scheduleReturnHome = useCallback(() => {
    if (returnTimer.current) clearTimeout(returnTimer.current);
    returnTimer.current = setTimeout(() => {
      setSelfPose(poseFromSlot(homeSelfRef.current));
      setOtherPose(poseFromSlot(homeOtherRef.current));
    }, RETURN_HOME_MS);
  }, []);

  const approachFurniture = useCallback((
    furniture: FurnitureItem,
    withOther: boolean,
    options?: { sticky?: boolean },
  ) => {
    setSelfPose(playBandPose(nearPoseForActor(furniture, "self")));
    if (withOther) {
      setOtherPose(playBandPose(nearPoseForActor(furniture, "other")));
    }
    if (!options?.sticky) scheduleReturnHome();
    else if (returnTimer.current) clearTimeout(returnTimer.current);
  }, [scheduleReturnHome]);

  const returnHome = useCallback(() => {
    if (returnTimer.current) clearTimeout(returnTimer.current);
    setSelfPose(poseFromSlot(homeSelfRef.current));
    setOtherPose(poseFromSlot(homeOtherRef.current));
  }, []);

  const approachCoplay = useCallback((
    juice: CoplayJuice,
    sceneId: SceneId,
    furnitureList: FurnitureItem[],
    withOther: boolean,
  ) => {
    const hint = coplayFurnitureHint(juice, sceneId);
    const target = hint ? furnitureList.find((item) => item.id === hint) : undefined;
    if (target) {
      approachFurniture(target, withOther);
      return;
    }
    const pair = coplayPairPoses();
    // 打招呼/击掌：略微靠拢，不跑远
    setSelfPose({ left: pair.self.left + 4, bottom: pair.self.bottom });
    if (withOther) {
      setOtherPose({ left: pair.other.left - 4, bottom: pair.other.bottom });
    }
    scheduleReturnHome();
  }, [approachFurniture, scheduleReturnHome]);

  const runSceneChange = useCallback((apply: () => void) => {
    setSceneFade(true);
    if (fadeTimer.current) clearTimeout(fadeTimer.current);
    fadeTimer.current = setTimeout(() => {
      apply();
      setSelfPose(poseFromSlot(homeSelfRef.current));
      setOtherPose(poseFromSlot(homeOtherRef.current));
      // 淡入
      requestAnimationFrame(() => setSceneFade(false));
    }, SCENE_FADE_MS);
  }, []);

  return {
    selfPose,
    otherPose,
    sceneFade,
    approachMs: APPROACH_MS,
    approachFurniture,
    approachCoplay,
    returnHome,
    scheduleReturnHome,
    runSceneChange,
  };
}
