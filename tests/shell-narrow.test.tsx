import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AppShell,
  Brand,
  Main,
  Popover,
  Sidebar,
  SidebarFoot,
  SidebarItem,
  SidebarNav,
  SidebarToggle,
  TopBar,
  useAppShell,
  useMediaQuery,
} from "../src";

const QUERY = "(max-width: 900px)";

/** A matchMedia whose QUERY result the test sets; listeners hear changes. */
function stubMedia(initial: boolean) {
  let matches = initial;
  const listeners = new Set<() => void>();
  vi.stubGlobal("matchMedia", (query: string) => ({
    get matches() {
      return query === QUERY && matches;
    },
    media: query,
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  }));
  return (next: boolean) =>
    act(() => {
      matches = next;
      for (const fn of listeners) fn();
    });
}

function SwitchProject() {
  const shell = useAppShell();
  return (
    <button type="button" onClick={() => shell?.closeMenu("main")}>
      Switch project
    </button>
  );
}

function Health() {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement | null>(null);
  return (
    <>
      <button ref={anchor} type="button" onClick={() => setOpen(true)}>
        Health
      </button>
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={anchor}
        label="Health details"
      >
        <a href="#/checks">Checks</a>
      </Popover>
    </>
  );
}

function Shell({ topBar = false }: { topBar?: boolean }) {
  return (
    <AppShell
      narrow={QUERY}
      narrowBar={<span>Bar title</span>}
      topBar={
        topBar ? (
          <TopBar>
            <SidebarToggle />
          </TopBar>
        ) : undefined
      }
      sidebar={
        <Sidebar label="Sidebar">
          <Brand name="Sample" href="#/home" icon={null} />
          <SidebarNav label="Main">
            <SidebarItem href="#/home" label="Home" />
            <SidebarItem href="#/rules" label="Rules" />
          </SidebarNav>
          <SidebarFoot>
            <SwitchProject />
            <Health />
          </SidebarFoot>
        </Sidebar>
      }
    >
      <Main>page</Main>
    </AppShell>
  );
}

const menu = () => screen.getByRole("button", { name: "Menu" });
const nav = () => screen.queryByRole("navigation", { name: "Main" });

beforeEach(() => {
  window.location.hash = "#/home";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AppShell narrow layout", () => {
  it("keeps the sidebar in place while the query doesn't match", () => {
    stubMedia(false);
    const { container } = render(<Shell />);
    expect(screen.queryByRole("button", { name: "Menu" })).toBeNull();
    expect(nav()).toBeVisible();
    expect(container.querySelector(".wb-app")).not.toHaveClass(
      "wb-app--narrow",
    );
  });

  it("opens the sidebar over the inert page from Menu and closes it with Escape", async () => {
    stubMedia(true);
    const user = userEvent.setup();
    const { container } = render(<Shell />);
    const app = container.querySelector(".wb-app")!;
    expect(app).toHaveClass("wb-app--narrow");
    expect(screen.getByText("Bar title")).toBeVisible();
    expect(nav()).toBeNull();
    expect(menu()).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("link", { name: "Skip to content" })).toBeTruthy();

    await user.click(menu());
    expect(nav()).toBeVisible();
    expect(app).toHaveClass("is-menu-open");
    expect(container.querySelector(".wb-narrow-scrim")).not.toBeNull();
    expect(container.querySelector(".wb-app-main")).toHaveAttribute("inert");
    expect(screen.queryByRole("link", { name: "Skip to content" })).toBeNull();
    // Focus moves in and Tab wraps at both ends.
    const brand = screen.getByRole("link", { name: "Sample" });
    expect(brand).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Health" })).toHaveFocus();
    await user.tab();
    expect(brand).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(nav()).toBeNull();
    expect(container.querySelector(".wb-app-main")).not.toHaveAttribute(
      "inert",
    );
    expect(menu()).toHaveFocus();
  });

  it("closes on the scrim, returning focus to Menu", async () => {
    stubMedia(true);
    const user = userEvent.setup();
    const { container } = render(<Shell />);
    await user.click(menu());
    await user.click(container.querySelector(".wb-narrow-scrim")!);
    expect(nav()).toBeNull();
    expect(menu()).toHaveFocus();
  });

  it("closes on a link: to another page focus goes to the main pane, to the page shown back to Menu", async () => {
    stubMedia(true);
    const user = userEvent.setup();
    render(<Shell />);
    await user.click(menu());
    await user.click(screen.getByRole("link", { name: "Home" }));
    expect(nav()).toBeNull();
    expect(menu()).toHaveFocus();

    await user.click(menu());
    await user.click(screen.getByRole("link", { name: "Rules" }));
    expect(nav()).toBeNull();
    expect(screen.getByRole("main")).toHaveFocus();
  });

  it("closes on a navigation, and from the sidebar with focus on the main pane", async () => {
    stubMedia(true);
    const user = userEvent.setup();
    render(<Shell />);
    await user.click(menu());
    act(() => {
      window.location.hash = "#/elsewhere";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(nav()).toBeNull();
    expect(screen.getByRole("main")).toHaveFocus();

    await user.click(menu());
    await user.click(screen.getByRole("button", { name: "Switch project" }));
    expect(nav()).toBeNull();
    expect(screen.getByRole("main")).toHaveFocus();
  });

  it("closes an overlay opened from the sidebar before the sidebar", async () => {
    stubMedia(true);
    const user = userEvent.setup();
    render(<Shell />);
    await user.click(menu());
    await user.click(screen.getByRole("button", { name: "Health" }));
    expect(screen.getByRole("dialog", { name: "Health details" })).toBeTruthy();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Health details" })).toBeNull();
    expect(nav()).toBeVisible();
    await user.keyboard("{Escape}");
    expect(nav()).toBeNull();
  });

  it("widening shows the sidebar in place; narrowing again starts closed", async () => {
    const setNarrow = stubMedia(true);
    const user = userEvent.setup();
    render(<Shell topBar />);
    // The collapse toggle is for the wide layout.
    expect(screen.queryByRole("button", { name: "Hide sidebar" })).toBeNull();
    await user.click(menu());
    setNarrow(false);
    expect(screen.queryByRole("button", { name: "Menu" })).toBeNull();
    expect(nav()).toBeVisible();
    expect(screen.getByRole("button", { name: "Hide sidebar" })).toBeTruthy();
    setNarrow(true);
    expect(nav()).toBeNull();
    expect(menu()).toHaveAttribute("aria-expanded", "false");
  });
});

describe("useMediaQuery", () => {
  function Probe({ query }: { query: string | undefined }) {
    return <span>{useMediaQuery(query) ? "match" : "no match"}</span>;
  }

  it("follows the query and is false without one", () => {
    const setNarrow = stubMedia(false);
    const { rerender } = render(<Probe query={QUERY} />);
    expect(screen.getByText("no match")).toBeTruthy();
    setNarrow(true);
    expect(screen.getByText("match")).toBeTruthy();
    rerender(<Probe query={undefined} />);
    expect(screen.getByText("no match")).toBeTruthy();
  });
});
