import { describe, expect, it } from "vitest";
import {
  ANIM_CLIPS,
  evaluateAnimClip,
  getAvailableClipIds,
  sampleTrack,
  type Keyframe,
} from "../../src/mobile/world/anim-clips";

describe("anim-clips", () => {
  describe("sampleTrack", () => {
    const track: Keyframe[] = [
      { time: 0, value: 0, easing: "linear" },
      { time: 1, value: 10, easing: "linear" },
      { time: 2, value: 20, easing: "linear" },
    ];

    it("空轨道返回 0", () => {
      expect(sampleTrack([], 0.5)).toBe(0);
    });

    it("单关键帧返回该值", () => {
      expect(sampleTrack([{ time: 0, value: 42 }], 1.0)).toBe(42);
    });

    it("t 小于首帧返回首帧值", () => {
      expect(sampleTrack(track, -1)).toBe(0);
    });

    it("t 大于末帧返回末帧值", () => {
      expect(sampleTrack(track, 99)).toBe(20);
    });

    it("线性插值", () => {
      expect(sampleTrack(track, 0.5)).toBeCloseTo(5, 5);
      expect(sampleTrack(track, 1.5)).toBeCloseTo(15, 5);
    });

    it("缓动插值 easeIn", () => {
      const easeTrack: Keyframe[] = [
        { time: 0, value: 0, easing: "easeIn" },
        { time: 1, value: 100 },
      ];
      // easeIn: t²，t=0.5 → 25
      expect(sampleTrack(easeTrack, 0.5)).toBeCloseTo(25, 1);
    });

    it("缓动插值 easeOut", () => {
      const easeTrack: Keyframe[] = [
        { time: 0, value: 0, easing: "easeOut" },
        { time: 1, value: 100 },
      ];
      // easeOut: 1-(1-t)²，t=0.5 → 75
      expect(sampleTrack(easeTrack, 0.5)).toBeCloseTo(75, 1);
    });
  });

  describe("evaluateAnimClip", () => {
    it("返回正确的属性集合", () => {
      const r = evaluateAnimClip("idle", 0);
      expect(r).toHaveProperty("torsoRot");
      expect(r).toHaveProperty("headRot");
      expect(r).toHaveProperty("armLRot");
      expect(r).toHaveProperty("armRRot");
      expect(r).toHaveProperty("legLRot");
      expect(r).toHaveProperty("legRRot");
      expect(r).toHaveProperty("pelvisDy");
    });

    it("未知剪辑返回全零", () => {
      const r = evaluateAnimClip("nonexistent", 0);
      expect(r.torsoRot).toBe(0);
      expect(r.headRot).toBe(0);
    });

    it("循环动画 t=duration 时回到起点", () => {
      const clip = ANIM_CLIPS["idle"];
      const r0 = evaluateAnimClip("idle", 0);
      const rEnd = evaluateAnimClip("idle", clip.duration);
      expect(r0.torsoRot).toBeCloseTo(rEnd.torsoRot, 5);
    });

    it("循环动画 t > duration 时取模", () => {
      const clip = ANIM_CLIPS["idle"];
      const r1 = evaluateAnimClip("idle", 0.5);
      const r2 = evaluateAnimClip("idle", clip.duration + 0.5);
      expect(r1.torsoRot).toBeCloseTo(r2.torsoRot, 5);
    });

    it("idle 动画在 t=0 和 t=1.5 时值不同", () => {
      const r0 = evaluateAnimClip("idle", 0);
      const rMid = evaluateAnimClip("idle", 1.5);
      expect(r0.torsoRot).not.toBe(rMid.torsoRot);
    });

    it("walk 动画腿部有摆动", () => {
      const r0 = evaluateAnimClip("walk", 0);
      const rMid = evaluateAnimClip("walk", 0.6);
      expect(r0.legLRot).not.toBe(rMid.legLRot);
    });

    it("cheer 动画手臂有大幅度运动", () => {
      const r0 = evaluateAnimClip("cheer", 0);
      const rPeak = evaluateAnimClip("cheer", 0.3);
      expect(Math.abs(rPeak.armLRot)).toBeGreaterThan(Math.abs(r0.armLRot));
    });
  });

  describe("getAvailableClipIds", () => {
    it("返回 5 个标准剪辑", () => {
      const ids = getAvailableClipIds();
      expect(ids).toContain("idle");
      expect(ids).toContain("tilt");
      expect(ids).toContain("wave");
      expect(ids).toContain("walk");
      expect(ids).toContain("cheer");
    });
  });
});
