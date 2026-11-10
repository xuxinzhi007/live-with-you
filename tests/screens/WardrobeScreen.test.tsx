import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WardrobeScreen } from "../../src/mobile/screens/WardrobeScreen";
import {
  DEFAULT_EQUIPPED_OUTFIT,
  DEFAULT_UNLOCKED_ITEM_IDS,
  WARDROBE_ITEMS,
  getWardrobeItem,
  normalizeNikkiSave,
  type WardrobeSlot,
} from "../../src/mobile/world/nikki-wardrobe";

const baseNikki = normalizeNikkiSave({
  equipped: { ...DEFAULT_EQUIPPED_OUTFIT },
  unlockedIds: [...DEFAULT_UNLOCKED_ITEM_IDS],
});

const slotItems = WARDROBE_ITEMS.filter((i) => i.slot === "dress");
const inspectedItem = getWardrobeItem(DEFAULT_EQUIPPED_OUTFIT.dress);
const itemImage = (item: (typeof WARDROBE_ITEMS)[number]) => item.image;

function renderWardrobe(overrides = {}) {
  const props = {
    nikki: baseNikki,
    activeSlot: "dress" as WardrobeSlot,
    inspectedItem,
    inspectedStars: 1,
    inspectedOwned: true,
    slotItems,
    unlockedSet: new Set(baseNikki.unlockedIds),
    cutoutMap: {},
    itemImage,
    onSelectSlot: vi.fn(),
    onSelectOrEquip: vi.fn(),
    onUpgradeOrCraft: vi.fn(),
    ...overrides,
  };
  render(<WardrobeScreen {...props} />);
  return props;
}

describe("WardrobeScreen", () => {
  it("渲染 5 个槽位 tab", () => {
    renderWardrobe();
    expect(screen.getByText("装扮")).toBeInTheDocument();
    expect(screen.getByText("头饰")).toBeInTheDocument();
    expect(screen.getByText("手持")).toBeInTheDocument();
    expect(screen.getByText("香氛")).toBeInTheDocument();
    expect(screen.getByText("羁绊")).toBeInTheDocument();
  });

  it("点击槽位触发 onSelectSlot", () => {
    const { onSelectSlot } = renderWardrobe();
    fireEvent.click(screen.getByText("头饰"));
    expect(onSelectSlot).toHaveBeenCalledWith("hairAcc");
  });

  it("渲染当前检视单品的升星按钮", () => {
    renderWardrobe();
    expect(screen.getByText(/升星/)).toBeInTheDocument();
  });

  it("点击升星触发 onUpgradeOrCraft", () => {
    const { onUpgradeOrCraft } = renderWardrobe();
    fireEvent.click(screen.getByText(/升星/));
    expect(onUpgradeOrCraft).toHaveBeenCalledWith(inspectedItem);
  });
});
