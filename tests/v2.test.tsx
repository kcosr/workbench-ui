import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  AppShell,
  ConfirmDialog,
  Main,
  Modal,
  Sidebar,
  SidebarSection,
  SkipLink,
  TabPanel,
  Tabs,
  TopBar,
  tabId,
  tabPanelId,
} from "../src";

describe("ConfirmDialog", () => {
  it("is an alertdialog described by its message", () => {
    render(
      <ConfirmDialog
        open
        onClose={() => {}}
        title="Delete rule?"
        onConfirm={() => {}}
      >
        Events already redacted are not affected.
      </ConfirmDialog>,
    );
    const dialog = screen.getByRole("alertdialog", { name: "Delete rule?" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleDescription(
      "Events already redacted are not affected.",
    );
  });

  it("plain modals stay dialogs described only by their description", () => {
    render(
      <Modal
        open
        onClose={() => {}}
        title="Issue token"
        description="Shown once."
      >
        <input aria-label="Name" />
      </Modal>,
    );
    expect(
      screen.getByRole("dialog", { name: "Issue token" }),
    ).toHaveAccessibleDescription("Shown once.");
  });
});

describe("skip link", () => {
  it("is the first focusable element and moves focus to the main pane without touching the URL", async () => {
    const user = userEvent.setup();
    window.location.hash = "#/events";
    render(
      <AppShell
        topBar={
          <TopBar>
            <button>brand</button>
          </TopBar>
        }
        sidebar={
          <Sidebar label="Filters">
            <button>filter</button>
          </Sidebar>
        }
      >
        <Main label="Events">
          <button>row</button>
        </Main>
      </AppShell>,
    );
    await user.tab();
    const link = screen.getByRole("link", { name: "Skip to content" });
    expect(link).toHaveFocus();
    await user.keyboard("{Enter}");
    const main = screen.getByRole("main", { name: "Events" });
    expect(main).toHaveFocus();
    expect(main).toHaveAttribute("id", "wb-main");
    expect(window.location.hash).toBe("#/events");
    await user.tab();
    expect(screen.getByRole("button", { name: "row" })).toHaveFocus();
  });

  it("uses a configurable main id and can be turned off", () => {
    const { unmount } = render(
      <AppShell
        topBar={<TopBar>top</TopBar>}
        mainId="content"
        skipLink="Skip to results"
      >
        <Main>main</Main>
      </AppShell>,
    );
    expect(
      screen.getByRole("link", { name: "Skip to results" }),
    ).toHaveAttribute("href", "#content");
    expect(screen.getByRole("main")).toHaveAttribute("id", "content");
    unmount();
    render(
      <AppShell topBar={<TopBar>top</TopBar>} skipLink={false}>
        <Main>main</Main>
      </AppShell>,
    );
    expect(screen.queryByRole("link", { name: /skip/i })).toBeNull();
  });

  it("SkipLink works outside AppShell", async () => {
    const user = userEvent.setup();
    render(
      <>
        <SkipLink targetId="page">Skip</SkipLink>
        <Main id="page">content</Main>
      </>,
    );
    await user.click(screen.getByRole("link", { name: "Skip" }));
    expect(screen.getByRole("main")).toHaveFocus();
  });
});

describe("detached tabs", () => {
  function Detached() {
    const [v, setV] = useState("summary");
    return (
      <>
        <Tabs
          detached
          id="ov"
          label="Overview"
          value={v}
          onChange={setV}
          items={[
            { value: "summary", label: "Summary" },
            { value: "breakdown", label: "Breakdown" },
          ]}
        />
        <div>
          <TabPanel tabsId="ov" value={v}>
            content {v}
          </TabPanel>
        </div>
      </>
    );
  }

  it("wires the tab and a panel rendered elsewhere", async () => {
    const user = userEvent.setup();
    render(<Detached />);
    const tab = screen.getByRole("tab", { name: "Summary" });
    const panel = screen.getByRole("tabpanel", { name: "Summary" });
    expect(tab).toHaveAttribute("id", tabId("ov", "summary"));
    expect(panel).toHaveAttribute("id", tabPanelId("ov", "summary"));
    expect(tab).toHaveAttribute("aria-controls", panel.id);
    await user.click(screen.getByRole("tab", { name: "Breakdown" }));
    const next = screen.getByRole("tabpanel", { name: "Breakdown" });
    expect(screen.getByRole("tab", { name: "Breakdown" })).toHaveAttribute(
      "aria-controls",
      next.id,
    );
    expect(screen.getByRole("tab", { name: "Summary" })).not.toHaveAttribute(
      "aria-controls",
    );
  });

  it("tabs without children or detached emit no dangling aria-controls", () => {
    render(
      <Tabs
        label="Plain"
        value="a"
        onChange={() => {}}
        items={[{ value: "a", label: "A" }]}
      />,
    );
    expect(screen.getByRole("tab", { name: "A" })).not.toHaveAttribute(
      "aria-controls",
    );
  });
});

describe("lazy sidebar sections", () => {
  it("mount children on first open and keep them mounted", async () => {
    const user = userEvent.setup();
    const mounts = vi.fn();
    function Picker() {
      useEffect(() => {
        mounts();
      }, []);
      return <input aria-label="Principal" />;
    }
    render(
      <SidebarSection title="Scope" collapsible defaultOpen={false} lazy>
        <Picker />
      </SidebarSection>,
    );
    expect(mounts).not.toHaveBeenCalled();
    const toggle = screen.getByRole("button", { name: "Scope" });
    expect(toggle).toHaveAttribute("aria-controls");
    await user.click(toggle);
    expect(screen.getByLabelText("Principal")).toBeVisible();
    await user.type(screen.getByLabelText("Principal"), "ali");
    await user.click(toggle);
    await user.click(toggle);
    expect(mounts).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Principal")).toHaveValue("ali");
  });

  it("non-lazy collapsed sections keep children mounted (hidden)", () => {
    render(
      <SidebarSection title="Scope" collapsible defaultOpen={false}>
        <input aria-label="Principal" />
      </SidebarSection>,
    );
    expect(
      screen.getByLabelText("Principal", { selector: "input" }),
    ).not.toBeVisible();
  });
});
