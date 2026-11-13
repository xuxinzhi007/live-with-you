import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WorldApp } from "../../src/mobile/WorldApp";

describe("WorldApp 底栏", () => {
  it("底栏 7 项，密语入口可达", async () => {
    render(<WorldApp />);
    fireEvent.click(screen.getByText(/点击进入小屋/));
    const nav = screen.getByRole("navigation", { name: "主导航" });
    expect(within(nav).getAllByRole("button")).toHaveLength(7);
    expect(within(nav).getByText("密语")).toBeInTheDocument();
    fireEvent.click(within(nav).getByText("密语"));
    expect(await screen.findByText("和雯宝私语")).toBeInTheDocument();
  });
});
