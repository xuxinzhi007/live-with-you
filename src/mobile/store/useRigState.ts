import { useCallback, useState } from "react";
import type { AnimClipId, JointId } from "../world/skeleton-system";
import type { StageMotion } from "../world/layered-stage";

export type RigMode = "setup" | "pose";

export interface UseRigState {
  rigMode: RigMode;
  setRigMode: React.Dispatch<React.SetStateAction<RigMode>>;
  animClip: AnimClipId;
  setAnimClip: React.Dispatch<React.SetStateAction<AnimClipId>>;
  selectedJoint: JointId;
  setSelectedJoint: React.Dispatch<React.SetStateAction<JointId>>;
  draggingJoint: JointId | null;
  setDraggingJoint: React.Dispatch<React.SetStateAction<JointId | null>>;
  animTime: number;
  setAnimTime: React.Dispatch<React.SetStateAction<number>>;
  breatheIdx: number;
  setBreatheIdx: React.Dispatch<React.SetStateAction<number>>;
  reacting: boolean;
  setReacting: React.Dispatch<React.SetStateAction<boolean>>;
  stageMotion: StageMotion;
  setStageMotion: React.Dispatch<React.SetStateAction<StageMotion>>;
  equipBurstKey: number;
  setEquipBurstKey: React.Dispatch<React.SetStateAction<number>>;
  cutoutMap: Record<string, string>;
  setCutoutMap: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  layeredReady: boolean;
  setLayeredReady: React.Dispatch<React.SetStateAction<boolean>>;
  lobbyLine: string;
  setLobbyLine: React.Dispatch<React.SetStateAction<string>>;
}

export function useRigState(): UseRigState {
  const [rigMode, setRigMode] = useState<RigMode>("pose");
  const [animClip, setAnimClip] = useState<AnimClipId>("idle");
  const [selectedJoint, setSelectedJoint] = useState<JointId>("head");
  const [draggingJoint, setDraggingJoint] = useState<JointId | null>(null);
  const [animTime, setAnimTime] = useState(0);
  const [breatheIdx, setBreatheIdx] = useState(0);
  const [reacting, setReacting] = useState(false);
  const [stageMotion, setStageMotion] = useState<StageMotion>("idle");
  const [equipBurstKey, setEquipBurstKey] = useState(0);
  const [cutoutMap, setCutoutMap] = useState<Record<string, string>>({});
  const [layeredReady, setLayeredReady] = useState(false);
  const [lobbyLine, setLobbyLine] = useState(
    "「欢迎回来～点右边『换装』试新裙子，或点『骨骼』直接拖动关节点位哦！」",
  );

  return {
    rigMode,
    setRigMode,
    animClip,
    setAnimClip,
    selectedJoint,
    setSelectedJoint,
    draggingJoint,
    setDraggingJoint,
    animTime,
    setAnimTime,
    breatheIdx,
    setBreatheIdx,
    reacting,
    setReacting,
    stageMotion,
    setStageMotion,
    equipBurstKey,
    setEquipBurstKey,
    cutoutMap,
    setCutoutMap,
    layeredReady,
    setLayeredReady,
    lobbyLine,
    setLobbyLine,
  };
}
