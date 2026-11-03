import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LinkTabs, Tabs } from "../src";

/** jsdom has no layout: give every element a scroll width wider than its client width. */
function overflow(client: number, scroll: number) {
  const proto = HTMLElement.prototype;
  const spies = [
    vi.spyOn(proto, "clientWidth", "get").mockReturnValue(client),
    vi.spyOn(proto, "scrollWidth", "get").mockReturnValue(scroll),
  ];
  return () => spies.forEach((s) => s.mockRestore());
}

afterEach(() => {
  vi.restoreAllMocks();
});

const items = ["Report", "Activity", "Setup", "Files"].map((label) => ({
  href: `#/${label.toLowerCase()}`,
  label,
  current: label === "Report",
}));

describe("tab rows that overflow", () => {
  it("fade the edge more link tabs hide past, following the scroll", () => {
    overflow(200, 500);
    render(<LinkTabs label="Sections" items={items} />);
    const nav = screen.getByRole("navigation", { name: "Sections" });
    expect(nav).toHaveClass("is-fade-end");
    expect(nav).not.toHaveClass("is-fade-start");
    nav.scrollLeft = 300;
    fireEvent.scroll(nav);
    expect(nav).toHaveClass("is-fade-start");
    expect(nav).not.toHaveClass("is-fade-end");
  });

  it("fade in-page tabs too, and nothing fades when they fit", () => {
    overflow(500, 500);
    render(
      <Tabs
        label="Client"
        value="a"
        onChange={() => {}}
        items={[
          { value: "a", label: "A" },
          { value: "b", label: "B" },
        ]}
      />,
    );
    const list = screen.getByRole("tablist", { name: "Client" });
    expect(list.className).not.toMatch(/fade/);
  });
});

describe("LinkTabs", () => {
  it("passes an item's onClick to its link", async () => {
    const onClick = vi.fn((e: { preventDefault: () => void }) =>
      e.preventDefault(),
    );
    render(
      <LinkTabs
        label="Sections"
        items={items.map((item) => ({ ...item, onClick }))}
      />,
    );
    await userEvent.click(screen.getByRole("link", { name: "Setup" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
