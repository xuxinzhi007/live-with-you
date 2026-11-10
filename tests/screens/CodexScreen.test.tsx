import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CodexScreen } from "../../src/mobile/screens/CodexScreen";
import {
  DEFAULT_EQUIPPED_OUTFIT,
  DEFAULT_UNLOCKED_ITEM_IDS,
  WARDROBE_ITEMS,
  normalizeNikkiSave,
} from "../../src/mobile/world/nikki-wardrobe";

const baseNikki = normalizeNikkiSave({
  equipped: { ...DEFAULT_EQUIPPED_OUTFIT },
  unlockedIds: [...DEFAULT_UNLOCKED_ITEM_IDS],
});

const itemImage = (item: (typeof WARDROBE_ITEMS)[number]) => item.image;

describe("CodexScreen", () => {
  it("渲染标题与收集进度", () => {
    render(<CodexScreen nikki={baseNikki} unlockedSet={new Set(baseNikki.unlockedIds)} itemImage={itemImage} />);
    expect(screen.getByText("典藏套装与原画图鉴")).toBeInTheDocument();
    const pct = Math.round((baseNikki.unlockedIds.length / WARDROBE_ITEMS.length) * 100);
    expect(screen.getByText(new RegExp(`${baseNikki.unlockedIds.length} / ${WARDROBE_ITEMS.length}`))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`${pct}%`))).toBeInTheDocument();
  });

  it("渲染全部套装卡片", () => {
    render(<CodexScreen nikki={baseNikki} unlockedSet={new Set(baseNikki.unlockedIds)} itemImage={itemImage} />);
    expect(screen.getByText("初雪白茶套装")).toBeInTheDocument();
  });

  it("未解锁单品显示锁定标记", () => {
    render(<CodexScreen nikki={baseNikki} unlockedSet={new Set(baseNikki.unlockedIds)} itemImage={itemImage} />);
    const locked = WARDROBE_ITEMS.find((i) => !baseNikki.unlockedIds.includes(i.id));
    if (locked) {
      expect(screen.getByText(`${locked.name} (未解锁)`)).toBeInTheDocument();
    }
  });
});
