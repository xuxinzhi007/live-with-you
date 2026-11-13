import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WorldScreen } from "../../src/mobile/world/WorldScreen";

const onPropAction = vi.fn(() => ({ line: "测试台词", tone: "ok" as const }));
const onEnterRoom = vi.fn();
const onBack = vi.fn();

function renderHome() {
  return render(
    <WorldScreen room="home" onEnterRoom={onEnterRoom} onPropAction={onPropAction} onBack={onBack} />,
  );
}

describe("WorldScreen（世界单位渲染）", () => {
  it("她在出生点，道具按世界单位摆放（bottom 来自 y，z-index 按 y 排）", () => {
    renderHome();
    const hero = screen.getByAltText("雯宝");
    // defaultSpawn home = { x: 440, y: 880 } → bottom = (1000-880)/1000 = 12%
    expect(hero.style.bottom).toBe("12%");
    // bed = { x: 292, y: 832 } → bottom 16.8%，z = 100 + round(832/10) = 183
    const bed = screen.getByLabelText("床");
    expect(bed.style.bottom).toBe("16.8%");
    expect(bed.style.zIndex).toBe("183");
  });

  it("地毯没有动作，渲染成纯装饰（不可点）", () => {
    renderHome();
    expect(screen.queryByLabelText("地毯")).not.toBeInTheDocument();
  });

  it("标签降噪：远的物件不显示标签类，走近才出现", () => {
    renderHome();
    // 她在 x=440：床（x=292）在 1.5 身位内 → m-near；收藏架（x=772）不在
    expect(screen.getByLabelText("床").className).toContain("m-near");
    expect(screen.getByLabelText("收藏架").className).not.toContain("m-near");
  });

  it("点家具：她先走过去，到达后才给出台词", async () => {
    renderHome();
    fireEvent.click(screen.getByLabelText("床"));
    expect(onPropAction).not.toHaveBeenCalled();
    expect(await screen.findByText("测试台词", {}, { timeout: 3000 })).toBeInTheDocument();
    expect(onPropAction).toHaveBeenCalledTimes(1);
    expect(onPropAction.mock.calls[0][0].id).toBe("bed");
  });

  it("点门：走到门口后切房间", async () => {
    renderHome();
    fireEvent.click(screen.getByLabelText("庭院"));
    await waitFor(() => expect(onEnterRoom).toHaveBeenCalledWith("garden"), { timeout: 3000 });
  });
});
