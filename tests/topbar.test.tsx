import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Brand, NavTab, NavTabs, TopBar, TopSearch, TopStatus } from "../src";

const STEP_ATTRS = [
  "data-wb-brand",
  "data-wb-search",
  "data-wb-status",
  "data-wb-nav-icons",
];

/**
 * jsdom has no layout: fake it. The nav gets `room` px plus 100px for every
 * compaction step applied to the bar; each visible tab needs 150px and the
 * "More" button 80px.
 */
function fakeLayout(room: number) {
  const width = (el: HTMLElement): { client: number; scroll: number } => {
    if (el.classList.contains("wb-nav")) {
      const bar = el.closest(".wb-topbar");
      const steps = STEP_ATTRS.filter((a) => bar?.hasAttribute(a)).length;
      const client = room + steps * 100;
      const tabs = el.querySelectorAll(
        ":scope > .wb-nav-tab:not(.wb-nav-more-btn):not([data-wb-overflow])",
      ).length;
      const scroll = tabs * 150 + (el.hasAttribute("data-wb-more") ? 80 : 0);
      return { client, scroll: Math.max(client, scroll) };
    }
    if (el.classList.contains("wb-top-status-text")) {
      // 400px of room; 10px per character.
      return { client: 400, scroll: (el.textContent ?? "").length * 10 };
    }
    return { client: 0, scroll: 0 };
  };
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(
    function (this: HTMLElement) {
      return width(this).client;
    },
  );
  vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockImplementation(
    function (this: HTMLElement) {
      return width(this).scroll;
    },
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

function Bar() {
  return (
    <TopBar>
      <Brand name="Workbench" href="#/" />
      <NavTabs>
        <NavTab href="#/events">Events</NavTab>
        <NavTab href="#/rules">Rules</NavTab>
        <NavTab href="#/people">People</NavTab>
        <NavTab
          href="#/catalog"
          count={2}
          countTone="danger"
          countLabel="2 need review"
        >
          Catalog
        </NavTab>
        <NavTab href="#/audit">Audit</NavTab>
        <NavTab href="#/settings" current>
          Settings
        </NavTab>
      </NavTabs>
      <TopSearch onClick={() => {}} placeholder="Search" />
      <TopStatus label="r5 active · native on · LLM off" shortLabel="r5" />
    </TopBar>
  );
}

describe("crowded top bar", () => {
  it("leaves a roomy bar alone", () => {
    fakeLayout(2000);
    render(<Bar />);
    const bar = screen.getByRole("banner");
    for (const a of STEP_ATTRS) expect(bar).not.toHaveAttribute(a);
    expect(
      screen.getByRole("navigation", { name: "Main" }),
    ).not.toHaveAttribute("data-wb-more");
  });

  it("compacts step by step before moving tabs into More", () => {
    fakeLayout(650); // six tabs need 900px
    render(<Bar />);
    const bar = screen.getByRole("banner");
    // 650 + 100 (brand) = 750 < 900; + 100 (search) = 850 < 900; + status = 950.
    expect(bar).toHaveAttribute("data-wb-brand", "compact");
    expect(bar).toHaveAttribute("data-wb-search", "icon");
    expect(bar).toHaveAttribute("data-wb-status", "short");
    expect(bar).not.toHaveAttribute("data-wb-nav-icons");
    expect(screen.getByRole("navigation")).not.toHaveAttribute("data-wb-more");
  });

  it("moves the last tabs (never the current one) into an announced More menu", async () => {
    const user = userEvent.setup();
    fakeLayout(300); // 700 at full compaction: More + 4 tabs
    render(<Bar />);
    const bar = screen.getByRole("banner");
    for (const a of STEP_ATTRS) expect(bar).toHaveAttribute(a);
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(nav).toHaveAttribute("data-wb-more");
    const hidden = Array.from(
      nav.querySelectorAll("[data-wb-overflow]"),
      (e) => e.textContent,
    );
    expect(hidden).toEqual(["Catalog 22 need review", "Audit"]);
    // The current tab stays in the bar.
    expect(screen.getByRole("link", { name: "Settings" })).not.toHaveAttribute(
      "data-wb-overflow",
    );
    // More says that a moved tab needs attention.
    const more = screen.getByRole("button", { name: "More, 2 need review" });
    await user.click(more);
    const items = screen.getAllByRole("menuitem");
    expect(items.map((i) => i.textContent)).toEqual(["Catalog2", "Audit"]);
    expect(items.map((i) => i.getAttribute("href"))).toEqual([
      "#/catalog",
      "#/audit",
    ]);
  });

  it("keeps compacted text available to assistive technology", () => {
    fakeLayout(300);
    render(<Bar />);
    // Brand name and full status stay in the DOM (visually hidden by CSS).
    expect(screen.getByRole("link", { name: "Workbench" })).toBeInTheDocument();
    expect(
      screen.getByText("r5 active · native on · LLM off"),
    ).toBeInTheDocument();
    expect(screen.getByText("r5")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("button", { name: "Search" })).toBeInTheDocument();
  });
});

describe("refitting", () => {
  it("refits when content changes without re-rendering TopBar", async () => {
    fakeLayout(2000);
    let grow: () => void = () => {};
    function SelfUpdatingStatus() {
      const [long, setLong] = useState(false);
      useEffect(() => {
        grow = () => setLong(true);
      }, []);
      return (
        <TopStatus
          label={
            long ? "r6 active · native on · LLM on · managed · 12 rules" : "r5"
          }
          shortLabel="r6"
        />
      );
    }
    render(
      <TopBar>
        <Brand name="Workbench" />
        <SelfUpdatingStatus />
      </TopBar>,
    );
    const bar = screen.getByRole("banner");
    expect(bar).not.toHaveAttribute("data-wb-status");
    await act(async () => {
      grow();
    });
    expect(bar).toHaveAttribute("data-wb-status", "short");
  });
});
