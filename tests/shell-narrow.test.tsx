import { act, render, screen, waitFor } from "@testing-library/react";
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

function OpenFromBar() {
  const shell = useAppShell();
  return (
    <button type="button" onClick={() => shell?.openMenu()}>
      All pages
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

function Shell({
  topBar = false,
  keepSections = false,
  keepRules = false,
  sheet = false,
  drawer = false,
}: {
  topBar?: boolean;
  keepSections?: boolean;
  keepRules?: boolean;
  sheet?: boolean;
  drawer?: boolean;
}) {
  return (
    <AppShell
      narrow={QUERY}
      narrowMenu={sheet ? "sheet" : undefined}
      keepMenuOpenAt={keepRules ? (url) => url.hash === "#/rules" : undefined}
      drawer={drawer ? <aside aria-label="Details">details</aside> : undefined}
      narrowBar={
        <>
          <span>Bar title</span>
          <OpenFromBar />
        </>
      }
      keepMenuOpenForLink={
        keepSections ? (link) => link.hash === "#/rules" : undefined
      }
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
      <Main>
        page
        <OpenFromBar />
      </Main>
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

  it("keeps section links open through their navigation but closes for an ordinary link", async () => {
    stubMedia(true);
    const user = userEvent.setup();
    const { container, rerender } = render(<Shell keepSections />);
    await user.click(menu());
    await user.click(screen.getByRole("link", { name: "Rules" }));
    await waitFor(() => expect(window.location.hash).toBe("#/rules"));
    // A router render may replace the predicate between the two browser events.
    rerender(<Shell keepSections />);
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(nav()).toBeVisible();
    expect(menu()).toHaveAttribute("aria-expanded", "true");
    expect(container.querySelector(".wb-app-main")).toHaveAttribute("inert");
    expect(screen.getByRole("link", { name: "Rules" })).toHaveFocus();
    // Selecting the current section also keeps the drawer open.
    await user.click(screen.getByRole("link", { name: "Rules" }));
    expect(nav()).toBeVisible();
    await user.click(screen.getByRole("link", { name: "Home" }));
    expect(nav()).toBeNull();
    expect(screen.getByRole("main")).toHaveFocus();
  });

  it("still closes on history navigation or Escape after a section switch", async () => {
    stubMedia(true);
    const user = userEvent.setup();
    render(<Shell keepSections />);
    await user.click(menu());
    await user.click(screen.getByRole("link", { name: "Rules" }));
    await waitFor(() => expect(window.location.hash).toBe("#/rules"));
    act(() => {
      window.history.replaceState(null, "", "#/home");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(nav()).toBeNull();
    await user.click(menu());
    await user.click(screen.getByRole("link", { name: "Rules" }));
    await waitFor(() => expect(window.location.hash).toBe("#/rules"));
    await user.keyboard("{Escape}");
    expect(nav()).toBeNull();
    expect(menu()).toHaveFocus();
    await user.click(menu());
    // The last section-switch destination is forgotten once the drawer closes.
    act(() => window.dispatchEvent(new PopStateEvent("popstate")));
    expect(nav()).toBeNull();
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

describe("AppShell narrow menu sheet", () => {
  const close = () => screen.getByRole("button", { name: "Close menu" });

  it("opens the sidebar as a sheet with Close menu first, over the inert page", async () => {
    stubMedia(true);
    const user = userEvent.setup();
    const { container } = render(<Shell sheet />);
    const app = container.querySelector(".wb-app")!;
    expect(app).toHaveClass("wb-app--narrow", "wb-app--menu-sheet");
    expect(screen.queryByRole("button", { name: "Close menu" })).toBeNull();

    await user.click(menu());
    expect(nav()).toBeVisible();
    expect(container.querySelector(".wb-narrow-scrim")).toBeNull();
    expect(container.querySelector(".wb-app-main")).toHaveAttribute("inert");
    // Close menu leads the sheet: the first Tab stop, focused on opening.
    const pane = container.querySelector(".wb-sidebar-pane")!;
    expect(pane.firstElementChild).toHaveClass("wb-menu-sheet-bar");
    expect(close()).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Health" })).toHaveFocus();
    await user.tab();
    expect(close()).toHaveFocus();

    await user.click(close());
    expect(nav()).toBeNull();
    expect(container.querySelector(".wb-app-main")).not.toHaveAttribute(
      "inert",
    );
    expect(menu()).toHaveFocus();
  });

  it("closes on Escape, a link and a navigation like the drawer", async () => {
    stubMedia(true);
    const user = userEvent.setup();
    render(<Shell sheet />);
    await user.click(menu());
    await user.keyboard("{Escape}");
    expect(nav()).toBeNull();
    expect(menu()).toHaveFocus();

    await user.click(menu());
    await user.click(screen.getByRole("link", { name: "Rules" }));
    expect(nav()).toBeNull();
    expect(screen.getByRole("main")).toHaveFocus();

    await user.click(menu());
    act(() => {
      window.location.hash = "#/elsewhere";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(nav()).toBeNull();
  });

  it("openMenu opens it; closing returns focus to the bar control that opened it, else to Menu", async () => {
    stubMedia(true);
    const user = userEvent.setup();
    const { container } = render(<Shell sheet />);
    const [inBar, inPage] = screen.getAllByRole("button", {
      name: "All pages",
    });
    await user.click(inBar!);
    expect(nav()).toBeVisible();
    expect(menu()).toHaveAttribute("aria-expanded", "true");
    expect(close()).toHaveFocus();
    await user.click(close());
    expect(nav()).toBeNull();
    expect(inBar).toHaveFocus();

    // A control in the main pane (or the pane itself) would only take the
    // focus again: closing gives it to Menu.
    await user.click(inPage!);
    expect(nav()).toBeVisible();
    await user.keyboard("{Escape}");
    expect(menu()).toHaveFocus();
    expect(container.querySelector(".wb-app")).not.toHaveClass("is-menu-open");
    screen.getByRole("main").focus();
    act(() => inBar!.click());
    // A tap that doesn't focus the button (WebKit) leaves the pane focused.
    expect(nav()).toBeVisible();
    await user.click(close());
    expect(menu()).toHaveFocus();
  });

  it("keepMenuOpenAt keeps it open through links and navigations to matching addresses", async () => {
    stubMedia(true);
    const user = userEvent.setup();
    render(<Shell sheet keepRules />);
    await user.click(menu());
    await user.click(screen.getByRole("link", { name: "Rules" }));
    await waitFor(() => expect(window.location.hash).toBe("#/rules"));
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(nav()).toBeVisible();
    // One made in code, as after deleting what the page showed.
    act(() => {
      window.history.replaceState(null, "", "#/home");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(nav()).toBeNull();
    await user.click(menu());
    act(() => {
      window.history.replaceState(null, "", "#/rules");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(nav()).toBeVisible();
    expect(close()).toHaveFocus();
  });

  it("makes the top bar and the drawer inert with the page while open, drawer or sheet", async () => {
    for (const sheet of [false, true]) {
      stubMedia(true);
      const user = userEvent.setup();
      const { container, unmount } = render(
        <Shell sheet={sheet} topBar drawer />,
      );
      const regions = [".wb-app-topbar", ".wb-app-main", ".wb-app-drawer"].map(
        (selector) => container.querySelector(selector)!,
      );
      expect(
        container.querySelector(".wb-app-topbar > .wb-topbar"),
      ).not.toBeNull();
      for (const region of regions) expect(region).not.toHaveAttribute("inert");
      await user.click(menu());
      for (const region of regions) expect(region).toHaveAttribute("inert");
      await user.keyboard("{Escape}");
      for (const region of regions) expect(region).not.toHaveAttribute("inert");
      unmount();
    }
  });

  it("openMenu does nothing outside the narrow layout, and the drawer has no Close menu", async () => {
    const setNarrow = stubMedia(false);
    const user = userEvent.setup();
    render(<Shell />);
    await user.click(screen.getByRole("button", { name: "All pages" }));
    setNarrow(true);
    expect(nav()).toBeNull();
    await user.click(menu());
    expect(nav()).toBeVisible();
    expect(screen.queryByRole("button", { name: "Close menu" })).toBeNull();
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
