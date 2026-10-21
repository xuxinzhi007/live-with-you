import { useEffect, useRef } from "react";
import {
  SceneStage as StageEngine,
  type ActorInput,
  type JuiceKind,
} from "./engine/pixi-stage";
import type { FurnitureItem, SceneId } from "./data/scenes";
import type { SlotPose } from "./data/slots";
import type { CoplayJuice } from "./data/coplay-actions";

interface LookLike {
  src: string;
  filter?: string;
}

interface SceneStageProps {
  sceneId: SceneId;
  furniture: FurnitureItem[];
  wall: string;
  floor: string;
  selfPose: SlotPose;
  otherPose: SlotPose;
  selfName: string;
  selfLook: LookLike | null;
  hasPartner: boolean;
  partnerLook: LookLike | null;
  partnerName: string;
  partnerColor: string;
  partnerAway: boolean;
  petSprite: string;
  petName: string;
  selfJuice: boolean;
  peerJuice: boolean;
  petJuice: boolean;
  coplayJuice: CoplayJuice | null;
  metFlash: boolean;
  onFurnitureClick: (item: FurnitureItem, x: number, y: number) => void;
  onPetClick: () => void;
}

function coplayKind(juice: CoplayJuice): { self: JuiceKind; other: JuiceKind } {
  switch (juice) {
    case "sit":
    case "lean":
      return { self: "sit", other: "sit" };
    case "pass":
      return { self: "pass", other: "pop" };
    case "look":
      return { self: "look", other: "look" };
    default:
      return { self: "pop", other: "pop" };
  }
}

export function SceneStage(props: SceneStageProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<StageEngine | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const engine = new StageEngine();
    engineRef.current = engine;
    void engine.mount(host);
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    engineRef.current?.setScene(props.furniture, props.wall, props.floor);
  }, [props.sceneId, props.furniture, props.wall, props.floor]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const inputs: ActorInput[] = [];
    if (props.selfLook) {
      inputs.push({
        key: "self",
        src: props.selfLook.src,
        name: props.selfName,
        tagColor: "#56877a",
        pose: props.selfPose,
      });
    }
    if (props.hasPartner && props.partnerLook) {
      inputs.push({
        key: "peer",
        src: props.partnerLook.src,
        name: props.partnerName,
        tagColor: props.partnerColor,
        pose: props.otherPose,
        away: props.partnerAway,
      });
    } else {
      inputs.push({
        key: "pet",
        src: `assets/${props.petSprite}.webp`,
        name: props.petName,
        tagColor: "#dc795f",
        pose: props.otherPose,
        clickable: true,
      });
    }
    engine.syncActors(inputs);
  }, [
    props.selfLook,
    props.partnerLook,
    props.hasPartner,
    props.selfName,
    props.partnerName,
    props.partnerColor,
    props.partnerAway,
    props.petSprite,
    props.petName,
  ]);

  useEffect(() => {
    engineRef.current?.setPose("self", props.selfPose);
    engineRef.current?.setPose(props.hasPartner ? "peer" : "pet", props.otherPose);
  }, [props.selfPose, props.otherPose, props.hasPartner]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const cp = props.coplayJuice ? coplayKind(props.coplayJuice) : null;
    if (props.selfJuice) engine.juice("self", cp?.self ?? "pop");
    if (props.peerJuice) engine.juice("peer", cp?.other ?? "pop");
    if (props.petJuice) engine.juice("pet", cp?.other ?? "pop");
  }, [props.selfJuice, props.peerJuice, props.petJuice, props.coplayJuice]);

  useEffect(() => {
    if (props.petSprite === "jump") engineRef.current?.juice("pet", "bounce");
  }, [props.petSprite]);

  useEffect(() => {
    if (!props.metFlash) return;
    engineRef.current?.juice("self", "meet");
    if (props.hasPartner) engineRef.current?.juice("peer", "meet");
    else engineRef.current?.juice("pet", "meet");
  }, [props.metFlash, props.hasPartner]);

  useEffect(() => {
    if (engineRef.current) engineRef.current.onFurnitureClick = props.onFurnitureClick;
  }, [props.onFurnitureClick]);

  useEffect(() => {
    if (engineRef.current) engineRef.current.onPetClick = props.onPetClick;
  }, [props.onPetClick]);

  return <div className="m-pixi-stage" ref={hostRef} aria-hidden="true" />;
}
