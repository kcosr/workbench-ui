import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  AppShell,
  LinkProvider,
  Main,
  SegLinks,
  Sidebar,
  SidebarToggle,
  TopBar,
} from "../src";
import type { LinkProps } from "../src";

function Shell() {
  return (
    <AppShell
      topBar={
        <TopBar>
          <SidebarToggle />
        </TopBar>
      }
      sidebar={<Sidebar label="Filters">facets</Sidebar>}
      sidebarStorageKey="t:shell"
    >
      <Main>main</Main>
    </AppShell>
  );
}

describe("sidebar collapse", () => {
  it("toggles from the top bar, persists, and shows a rail to expand again", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Shell />);
    const toggle = screen.getByRole("button", { name: "Hide sidebar" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("complementary", { name: "Filters" }),
    ).toBeVisible();
    await user.click(toggle);
    expect(screen.queryByRole("complementary", { name: "Filters" })).toBeNull();
    expect(window.localStorage.getItem("t:shell:collapsed")).toBe("1");
    expect(
      screen.getAllByRole("button", { name: "Show sidebar" }),
    ).toHaveLength(2);
    unmount();

    render(<Shell />);
    expect(screen.queryByRole("complementary", { name: "Filters" })).toBeNull();
    const rail = screen.getAllByRole("button", { name: "Show sidebar" })[1];
    if (!rail) throw new Error("no rail");
    await user.click(rail);
    expect(
      screen.getByRole("complementary", { name: "Filters" }),
    ).toBeVisible();
    expect(window.localStorage.getItem("t:shell:collapsed")).toBeNull();
  });

  it("SidebarToggle renders nothing without a sidebar", () => {
    render(
      <AppShell
        topBar={
          <TopBar>
            <SidebarToggle />
          </TopBar>
        }
      >
        <Main>main</Main>
      </AppShell>,
    );
    expect(screen.queryByRole("button", { name: /sidebar/ })).toBeNull();
  });
});

describe("SegLinks", () => {
  it("is navigation with the current link marked, through the app's link component", () => {
    const seen = vi.fn();
    function RouterLink(props: LinkProps) {
      seen(props.href);
      return <a {...props} data-router="yes" />;
    }
    render(
      <LinkProvider component={RouterLink}>
        <SegLinks
          label="Space"
          items={[
            { href: "/admin", label: "Admin", current: true },
            { href: "/me", label: "My access", current: false, count: 2 },
          ]}
        />
      </LinkProvider>,
    );
    expect(screen.getByRole("navigation", { name: "Space" })).toHaveClass(
      "wb-seg",
    );
    const admin = screen.getByRole("link", { name: "Admin" });
    expect(admin).toHaveAttribute("aria-current", "page");
    expect(admin).toHaveClass("wb-seg-btn");
    expect(admin).toHaveAttribute("data-router", "yes");
    expect(
      screen.getByRole("link", { name: "My access 2" }),
    ).not.toHaveAttribute("aria-current");
    expect(seen).toHaveBeenCalledWith("/me");
  });
});

describe("sidebar focus", () => {
  it("expanding from the rail moves focus into the sidebar", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem("t:rail:collapsed", "1");
    render(
      <AppShell
        topBar={<TopBar>top</TopBar>}
        sidebar={
          <Sidebar label="Filters">
            <button>first filter</button>
          </Sidebar>
        }
        sidebarStorageKey="t:rail"
      >
        <Main>main</Main>
      </AppShell>,
    );
    await user.click(screen.getByRole("button", { name: "Show sidebar" }));
    expect(screen.getByRole("button", { name: "first filter" })).toHaveFocus();
  });
});

describe("drawer focus return with an auto-collapsed sidebar", () => {
  it("returns focus to the row that opened the drawer, not the re-expanded sidebar", async () => {
    const { Drawer } = await import("../src");
    const { useState } = await import("react");
    // Give the frame a narrow layout so an open drawer auto-collapses the sidebar.
    const spy = vi
      .spyOn(HTMLElement.prototype, "clientWidth", "get")
      .mockImplementation(function (this: HTMLElement) {
        return this.classList.contains("wb-app") ? 650 : 0;
      });
    const user = userEvent.setup();
    function Host() {
      const [open, setOpen] = useState(false);
      return (
        <AppShell
          topBar={<TopBar>top</TopBar>}
          sidebar={
            <Sidebar label="Filters">
              <button>first filter</button>
            </Sidebar>
          }
          drawer={
            open ? <Drawer title="Item" onClose={() => setOpen(false)} /> : null
          }
        >
          <Main>
            <button onClick={() => setOpen(true)}>row</button>
          </Main>
        </AppShell>
      );
    }
    render(<Host />);
    const row = screen.getByRole("button", { name: "row" });
    await user.click(row);
    expect(screen.queryByRole("complementary", { name: "Filters" })).toBeNull();
    await user.keyboard("{Escape}");
    expect(
      screen.getByRole("complementary", { name: "Filters" }),
    ).toBeVisible();
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    expect(row).toHaveFocus();
    spy.mockRestore();
  });
});

describe("bounded drawer preferences", () => {
  it("keeps the sidebar visible when a saved wide drawer is clamped by its current bound", async () => {
    const { Drawer } = await import("../src");
    const spy = vi
      .spyOn(HTMLElement.prototype, "clientWidth", "get")
      .mockImplementation(function (this: HTMLElement) {
        return this.classList.contains("wb-app") ? 1350 : 0;
      });
    window.localStorage.setItem("t:bounded-drawer", "720");
    function Host({ bound }: { bound: number }) {
      return (
        <AppShell
          sidebar={<Sidebar label="Filters">filters</Sidebar>}
          sidebarMin={200}
          sidebarMax={320}
          sidebarDefault={216}
          drawer={<Drawer title="Item" onClose={() => {}} />}
          drawerResizable
          drawerMin={320}
          drawerMax={bound}
          drawerDefault={360}
          drawerStorageKey="t:bounded-drawer"
        >
          <Main>main</Main>
        </AppShell>
      );
    }
    try {
      const view = render(<Host bound={720} />);
      expect(
        screen.queryByRole("complementary", { name: "Filters" }),
      ).toBeNull();

      view.rerender(<Host bound={372} />);
      expect(
        screen.getByRole("complementary", { name: "Filters" }),
      ).toBeVisible();
      expect(
        screen.getByRole("separator", { name: "Details panel width" }),
      ).toHaveAttribute("aria-valuenow", "372");
      expect(document.querySelector(".wb-app")).toHaveStyle({
        "--wb-resized-drawer-w": "372px",
      });
      expect(window.localStorage.getItem("t:bounded-drawer")).toBe("720");

      view.rerender(<Host bound={720} />);
      expect(
        screen.getByRole("separator", { name: "Details panel width" }),
      ).toHaveAttribute("aria-valuenow", "720");
      expect(window.localStorage.getItem("t:bounded-drawer")).toBe("720");
    } finally {
      spy.mockRestore();
    }
  });
});
