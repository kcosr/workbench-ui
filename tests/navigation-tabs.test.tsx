import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NavigationTab, NavigationTabs } from "../src";

afterEach(() => vi.restoreAllMocks());

describe("navigation item menus", () => {
  it.each(["button", "contextmenu", "keyboard"])(
    "opens the same inactive item's actions by %s without navigation",
    async (method) => {
      const user = userEvent.setup();
      const navigate = vi.fn((event: { preventDefault: () => void }) =>
        event.preventDefault(),
      );
      const rename = vi.fn();
      render(
        <NavigationTabs label="Documents">
          <NavigationTab href="#first" title="First" current />
          <NavigationTab
            href="#second"
            title="Second"
            onClick={navigate}
            actions={[{ id: "rename", label: "Rename", onSelect: rename }]}
          />
        </NavigationTabs>,
      );
      const link = screen.getByRole("link", { name: "Second" });
      const trigger = screen.getByRole("button", {
        name: "Actions for Second",
      });
      if (method === "button") await user.click(trigger);
      else if (method === "contextmenu") fireEvent.contextMenu(link);
      else {
        link.focus();
        fireEvent.keyDown(link, { key: "F10", shiftKey: true });
      }
      expect(
        await screen.findByRole("menu", { name: "Actions for Second" }),
      ).toBeVisible();
      expect(screen.getByRole("link", { name: "First" })).toHaveAttribute(
        "aria-current",
        "page",
      );
      expect(navigate).not.toHaveBeenCalled();
      await user.click(screen.getByRole("menuitem", { name: "Rename" }));
      expect(rename).toHaveBeenCalledOnce();
      expect(trigger).toHaveFocus();
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    },
  );

  it("supports the context-menu key and restores focus on Escape", async () => {
    const user = userEvent.setup();
    render(
      <NavigationTabs label="Documents">
        <NavigationTab
          href="#first"
          title="First"
          actions={[{ id: "rename", label: "Rename" }]}
        />
      </NavigationTabs>,
    );
    fireEvent.keyDown(screen.getByRole("link"), { key: "ContextMenu" });
    await waitFor(() => expect(screen.getByRole("menuitem")).toHaveFocus());
    await user.keyboard("{Escape}");
    expect(
      screen.getByRole("button", { name: "Actions for First" }),
    ).toHaveFocus();
  });

  it("keeps the browser context menu on items without actions", () => {
    render(<NavigationTab href="#first" title="First" />);
    expect(fireEvent.contextMenu(screen.getByRole("link"))).toBe(true);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("suppresses the browser context menu over its portaled action menu", async () => {
    render(
      <NavigationTab
        href="#first"
        title="First"
        actions={[{ id: "rename", label: "Rename" }]}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Actions for First" }),
    );
    const event = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
    });
    fireEvent(screen.getByRole("menuitem", { name: "Rename" }), event);
    expect(event.defaultPrevented).toBe(true);
    expect(
      screen.getByRole("menu", { name: "Actions for First" }),
    ).toBeVisible();
  });
});

describe("navigation scrolling", () => {
  it.each(["hidden", "arrow", "unreported scroll"])(
    "releases a held position for %s without waiting for a scroll event",
    (transition) => {
      const row = (
        <NavigationTabs label="Documents">
          <NavigationTab href="#last" title="Last" current />
        </NavigationTabs>
      );
      const { rerender } = render(row);
      const track = document.querySelector<HTMLElement>(
        ".wb-navigation-tabs-track",
      )!;
      const item = screen.getByRole("link", { name: "Last" }).parentElement!;
      let width = 330;
      let scroll = 600;
      const write = vi.fn((value: number) => {
        if (width > 0) scroll = value;
      });
      Object.defineProperties(track, {
        clientWidth: { configurable: true, get: () => width },
        scrollWidth: { configurable: true, value: 1600 },
        scrollLeft: {
          configurable: true,
          get: () => (width > 0 ? scroll : 0),
          set: write,
        },
      });
      vi.spyOn(track, "getBoundingClientRect").mockImplementation(
        () => ({ left: 0, right: width }) as DOMRect,
      );
      vi.spyOn(item, "getBoundingClientRect").mockImplementation(
        () =>
          ({
            left: width > 0 ? 800 - scroll : 0,
            right: width > 0 ? 1000 - scroll : 0,
          }) as DOMRect,
      );
      fireEvent.click(screen.getByRole("link"), { detail: 1 });
      const poll = () =>
        rerender(
          <NavigationTabs label="Documents">
            <NavigationTab href="#last" title="Last" current />
          </NavigationTabs>,
        );
      poll();
      expect(write).not.toHaveBeenCalled(); // A no-op write can cancel an in-flight smooth scroll.
      if (transition === "hidden") {
        width = 0;
        poll();
        width = 330;
        poll();
        expect(scroll).toBe(600);
      } else {
        if (transition === "arrow") {
          track.scrollBy = vi.fn();
          fireEvent.click(
            screen.getByRole("button", { name: "Scroll documents right" }),
          );
          poll(); // Before the browser advances the smooth scroll.
          expect(track.scrollBy).toHaveBeenCalledOnce();
        }
        scroll = 700;
        poll(); // After it advances, but before the queued scroll event arrives.
        expect(scroll).toBe(700);
      }
      expect(write).not.toHaveBeenCalled();
    },
  );

  it("holds a pointer-selected tab through a delayed selection and inventory reorder, until manual scrolling", () => {
    const row = (key: string, selected: boolean) => (
      <NavigationTabs label="Documents" revealKey={key}>
        <NavigationTab href="#first" title="First" current={!selected} />
        <NavigationTab href="#last" title="Last" current={selected} />
      </NavigationTabs>
    );
    const { rerender } = render(row("first", false));
    const track = document.querySelector<HTMLElement>(
      ".wb-navigation-tabs-track",
    )!;
    const first = screen.getByRole("link", { name: "First" }).parentElement!;
    const last = screen.getByRole("link", { name: "Last" }).parentElement!;
    Object.defineProperties(track, {
      clientWidth: { configurable: true, value: 330 },
      scrollWidth: { configurable: true, value: 1600 },
    });
    let offset = 800;
    vi.spyOn(track, "getBoundingClientRect").mockImplementation(
      () => ({ left: 0, right: 330 }) as DOMRect,
    );
    vi.spyOn(first, "getBoundingClientRect").mockImplementation(
      () =>
        ({ left: -track.scrollLeft, right: 200 - track.scrollLeft }) as DOMRect,
    );
    vi.spyOn(last, "getBoundingClientRect").mockImplementation(
      () =>
        ({
          left: offset - track.scrollLeft,
          right: offset + 200 - track.scrollLeft,
        }) as DOMRect,
    );
    rerender(row("first", false));
    track.scrollLeft = 600;
    fireEvent.scroll(track);
    fireEvent.click(screen.getByRole("link", { name: "Last" }), { detail: 1 });
    // Routing can publish its key before the children publish their selection.
    rerender(row("last", false));
    expect(track.scrollLeft).toBe(600);
    rerender(row("last", true));
    expect(track.scrollLeft).toBe(600);
    offset = 1000;
    rerender(row("last", true));
    expect(track.scrollLeft).toBe(800);
    track.scrollLeft = 100;
    fireEvent.scroll(track);
    offset = 1200;
    rerender(row("last", true));
    expect(track.scrollLeft).toBe(100);
    rerender(row("external", true));
    expect(track.scrollLeft).toBe(1070);
  });

  it("skips both scroll arrows in the tab order when all items fit", async () => {
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(400);
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(400);
    const user = userEvent.setup();
    render(
      <>
        <button>Before</button>
        <NavigationTabs label="Documents">
          <NavigationTab href="#first" title="First" />
        </NavigationTabs>
        <button>After</button>
      </>,
    );
    await user.tab();
    expect(screen.getByRole("button", { name: "Before" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("link", { name: "First" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "After" })).toHaveFocus();
    for (const direction of ["left", "right"]) {
      expect(
        screen.getByRole("button", { name: `Scroll documents ${direction}` }),
      ).toHaveAttribute("tabindex", "-1");
    }
  });

  it("reveals after loading and navigation, preserves manual scroll during polls, and updates arrows", () => {
    const child = <NavigationTab href="#last" title="Last" current />;
    const { rerender } = render(
      <NavigationTabs label="Documents" revealKey="first" settled={false}>
        {child}
      </NavigationTabs>,
    );
    const track = document.querySelector<HTMLElement>(
      ".wb-navigation-tabs-track",
    )!;
    const item = document.querySelector<HTMLElement>(".wb-navigation-tab")!;
    Object.defineProperties(track, {
      clientWidth: { configurable: true, value: 200 },
      scrollWidth: { configurable: true, value: 600 },
    });
    vi.spyOn(track, "getBoundingClientRect").mockImplementation(
      () => ({ left: 0, right: 200 }) as DOMRect,
    );
    vi.spyOn(item, "getBoundingClientRect").mockImplementation(
      () =>
        ({
          left: 400 - track.scrollLeft,
          right: 590 - track.scrollLeft,
        }) as DOMRect,
    );
    rerender(
      <NavigationTabs label="Documents" revealKey="first" settled>
        {child}
      </NavigationTabs>,
    );
    expect(track.scrollLeft).toBe(390);
    track.scrollLeft = 0;
    fireEvent.scroll(track);
    expect(
      screen.getByRole("button", { name: "Scroll documents left" }),
    ).toHaveAttribute("aria-disabled", "true");
    expect(
      screen.getByRole("button", { name: "Scroll documents right" }),
    ).toHaveAttribute("aria-disabled", "false");
    rerender(
      <NavigationTabs label="Documents" revealKey="first" settled>
        {child}
      </NavigationTabs>,
    );
    expect(track.scrollLeft).toBe(0);
    rerender(
      <NavigationTabs label="Documents" revealKey="second" settled>
        {child}
      </NavigationTabs>,
    );
    expect(track.scrollLeft).toBe(390);
    track.scrollLeft = 400;
    fireEvent.scroll(track);
    expect(
      screen.getByRole("button", { name: "Scroll documents right" }),
    ).toHaveAttribute("aria-disabled", "true");
  });

  it("keeps arrow focus at the scroll endpoint and ignores further activations", async () => {
    render(
      <NavigationTabs label="Documents">
        <NavigationTab href="#first" title="First" />
      </NavigationTabs>,
    );
    const track = document.querySelector<HTMLElement>(
      ".wb-navigation-tabs-track",
    )!;
    Object.defineProperties(track, {
      clientWidth: { configurable: true, value: 200 },
      scrollWidth: { configurable: true, value: 600 },
    });
    track.scrollBy = vi.fn(() => {
      track.scrollLeft = 400;
      fireEvent.scroll(track);
    });
    fireEvent.scroll(track);
    const arrow = screen.getByRole("button", {
      name: "Scroll documents right",
    });
    await userEvent.click(arrow);
    expect(arrow).toHaveFocus();
    expect(arrow).toHaveAttribute("aria-disabled", "true");
    expect(arrow).not.toBeDisabled();
    expect(track.scrollBy).toHaveBeenCalledOnce();
    await userEvent.click(arrow);
    expect(track.scrollBy).toHaveBeenCalledOnce();
    expect(arrow).toHaveFocus();
  });
});
