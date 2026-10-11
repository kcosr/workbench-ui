// Shell and control patterns: pausable toasts, useConfirm, showSidebar,
// icons, IconButton indicator, TopStatus links, Combobox token entry,
// Switch size, QualifiedName and the centred card header.
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AppShell,
  Card,
  Combobox,
  ConfirmProvider,
  Drawer,
  Icon,
  IconButton,
  LinkProvider,
  Main,
  QualifiedName,
  Sidebar,
  SidebarToggle,
  Switch,
  ToastProvider,
  TopBar,
  TopStatus,
  iconNames,
  useAppShell,
  useConfirm,
  useToast,
} from "../src";
import type { ConfirmOptions, LinkProps, ToastOptions } from "../src";

afterEach(() => {
  vi.useRealTimers();
});

describe("Toast: pause and dismiss", () => {
  function Trigger({
    message = "Rule deleted",
    options,
  }: {
    message?: string;
    options?: ToastOptions;
  }) {
    const toast = useToast();
    return <button onClick={() => toast(message, options)}>go</button>;
  }

  it("pauses while the pointer is over it and resumes with the time left", () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "go" }));
    const toast = () => screen.queryByText("Rule deleted");
    act(() => vi.advanceTimersByTime(1500));
    expect(toast()).not.toBeNull();
    fireEvent.pointerEnter(toast()!.closest(".wb-toast")!);
    act(() => vi.advanceTimersByTime(30_000));
    expect(toast()).not.toBeNull();
    fireEvent.pointerLeave(toast()!.closest(".wb-toast")!);
    // 700ms were left; a resumed toast keeps at least a second.
    act(() => vi.advanceTimersByTime(900));
    expect(toast()).not.toBeNull();
    act(() => vi.advanceTimersByTime(100));
    expect(toast()).toBeNull();
  });

  it("never takes focus and keeps the live region in place", () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <Trigger options={{ action: { label: "Undo", onClick: () => {} } }} />
      </ToastProvider>,
    );
    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-live", "polite");
    const go = screen.getByRole("button", { name: "go" });
    go.focus();
    fireEvent.click(go);
    expect(region).toHaveTextContent("Rule deleted");
    expect(go).toHaveFocus();
    act(() => vi.advanceTimersByTime(6000));
    expect(screen.queryByText("Rule deleted")).toBeNull();
    expect(screen.getByRole("status")).toBe(region);
  });

  it("pauses while focus is inside; Esc dismisses it and focus goes back", () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(
      <ToastProvider>
        <Trigger options={{ action: { label: "Undo", onClick: () => {} } }} />
        <Drawer title="Rule" onClose={onClose}>
          details
        </Drawer>
      </ToastProvider>,
    );
    const go = screen.getByRole("button", { name: "go" });
    go.focus();
    fireEvent.click(go);
    act(() => screen.getByRole("button", { name: "Undo" }).focus());
    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.queryByText("Rule deleted")).not.toBeNull();

    fireEvent.keyDown(screen.getByRole("button", { name: "Undo" }), {
      key: "Escape",
    });
    expect(screen.queryByText("Rule deleted")).toBeNull();
    expect(go).toHaveFocus();
    // The Escape was the toast's: the drawer behind it stays open.
    expect(onClose).not.toHaveBeenCalled();
  });

  it("resumes when focus leaves", () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <Trigger options={{ action: { label: "Undo", onClick: () => {} } }} />
      </ToastProvider>,
    );
    const go = screen.getByRole("button", { name: "go" });
    fireEvent.click(go);
    act(() => screen.getByRole("button", { name: "Undo" }).focus());
    act(() => vi.advanceTimersByTime(10_000));
    act(() => go.focus());
    expect(screen.queryByText("Rule deleted")).not.toBeNull();
    act(() => vi.advanceTimersByTime(6000));
    expect(screen.queryByText("Rule deleted")).toBeNull();
  });

  it("the action runs once and returns focus when it closes the toast", () => {
    const undo = vi.fn();
    render(
      <ToastProvider>
        <Trigger options={{ action: { label: "Undo", onClick: undo } }} />
      </ToastProvider>,
    );
    const go = screen.getByRole("button", { name: "go" });
    go.focus();
    fireEvent.click(go);
    const action = screen.getByRole("button", { name: "Undo" });
    act(() => action.focus());
    fireEvent.click(action);
    expect(undo).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Rule deleted")).toBeNull();
    expect(go).toHaveFocus();
  });
});

describe("useConfirm", () => {
  function Asker({
    options,
    onResult,
  }: {
    options: ConfirmOptions;
    onResult: (ok: boolean) => void;
  }) {
    const confirm = useConfirm();
    return (
      <button onClick={() => void confirm(options).then(onResult)}>
        Delete
      </button>
    );
  }

  it("keeps the dialog pending while the action runs, then resolves true", async () => {
    const user = userEvent.setup();
    let finish: () => void = () => {};
    const action = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const onResult = vi.fn();
    render(
      <ConfirmProvider>
        <Asker
          onResult={onResult}
          options={{
            title: "Delete rule aws-access-key?",
            body: "Events already redacted are not affected.",
            confirmLabel: "Delete rule",
            action,
          }}
        />
      </ConfirmProvider>,
    );
    const trigger = screen.getByRole("button", { name: "Delete" });
    await user.click(trigger);
    const dialog = screen.getByRole("alertdialog", {
      name: "Delete rule aws-access-key?",
    });
    expect(dialog).toHaveAccessibleDescription(
      "Events already redacted are not affected.",
    );
    // Danger by default: Cancel first.
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Delete rule" }));
    expect(action).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Delete rule" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    await user.keyboard("{Escape}");
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(onResult).not.toHaveBeenCalled();

    await act(async () => finish());
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(onResult).toHaveBeenCalledWith(true);
    expect(trigger).toHaveFocus();
  });

  it("shows a failed action's error and stays open; cancelling resolves false", async () => {
    const user = userEvent.setup();
    const onResult = vi.fn();
    render(
      <ConfirmProvider>
        <Asker
          onResult={onResult}
          options={{
            title: "Sign out?",
            tone: "primary",
            confirmLabel: "Sign out",
            action: () => Promise.reject(new Error("409: sync running")),
          }}
        />
      </ConfirmProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Delete" }));
    // Primary: the confirm button first.
    expect(screen.getByRole("button", { name: "Sign out" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "409: sync running",
    );
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(onResult).toHaveBeenCalledWith(false);
  });

  it("resolves true at once without an action, and false on Escape", async () => {
    const user = userEvent.setup();
    const results: boolean[] = [];
    function Twice() {
      const confirm = useConfirm();
      return (
        <button
          onClick={() => {
            void confirm({ title: "First?" }).then((ok) => results.push(ok));
            void confirm({ title: "Second?" }).then((ok) => results.push(ok));
          }}
        >
          Ask
        </button>
      );
    }
    render(
      <ConfirmProvider>
        <Twice />
      </ConfirmProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Ask" }));
    // One at a time: the second waits for the first.
    expect(screen.getAllByRole("alertdialog")).toHaveLength(1);
    expect(screen.getByRole("alertdialog", { name: "First?" })).toBeVisible();
    await user.keyboard("{Escape}");
    expect(screen.getByRole("alertdialog", { name: "Second?" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(results).toEqual([false, true]);
  });

  it("returns focus to the opener after queued dialogs, however each closes", async () => {
    const user = userEvent.setup();
    function Twice() {
      const confirm = useConfirm();
      return (
        <button
          onClick={() => {
            void confirm({ title: "First?" });
            void confirm({ title: "Second?" });
          }}
        >
          Ask
        </button>
      );
    }
    render(
      <ConfirmProvider>
        <Twice />
      </ConfirmProvider>,
    );
    const ask = screen.getByRole("button", { name: "Ask" });
    for (const close of [
      ["{Escape}", "{Escape}"],
      ["{Escape}", "Confirm"],
      ["Confirm", "Confirm"],
    ]) {
      await user.click(ask);
      for (const how of close) {
        if (how === "Confirm") {
          await user.click(screen.getByRole("button", { name: "Confirm" }));
        } else {
          await user.keyboard(how);
        }
      }
      expect(screen.queryByRole("alertdialog")).toBeNull();
      expect(ask).toHaveFocus();
    }
  });

  it("rejects without a ConfirmProvider", async () => {
    let confirm: ReturnType<typeof useConfirm> | null = null;
    function Grab() {
      confirm = useConfirm();
      return null;
    }
    render(<Grab />);
    await expect(confirm!({ title: "Delete?" })).rejects.toThrow(
      /ConfirmProvider/,
    );
  });

  it("cancels open requests when the provider unmounts", async () => {
    const user = userEvent.setup();
    const onResult = vi.fn();
    const { unmount } = render(
      <ConfirmProvider>
        <Asker onResult={onResult} options={{ title: "Delete?" }} />
      </ConfirmProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Delete" }));
    unmount();
    await act(async () => {});
    expect(onResult).toHaveBeenCalledWith(false);
  });
});

describe("showSidebar / hideSidebar", () => {
  function Controls() {
    const shell = useAppShell();
    return (
      <>
        <button
          onClick={() =>
            shell?.showSidebar({
              focus: (pane) => pane.querySelector("input"),
            })
          }
        >
          Search filters
        </button>
        <button onClick={() => shell?.hideSidebar()}>Hide filters</button>
      </>
    );
  }

  function Shell() {
    return (
      <AppShell
        topBar={
          <TopBar>
            <SidebarToggle />
          </TopBar>
        }
        sidebar={
          <Sidebar label="Filters">
            <button>first</button>
            <input aria-label="Filter repositories" />
          </Sidebar>
        }
        sidebarStorageKey="t:reveal"
      >
        <Main>
          <Controls />
        </Main>
      </AppShell>
    );
  }

  it("are idempotent; showing focuses the requested element once visible", async () => {
    const user = userEvent.setup();
    render(<Shell />);
    const search = () =>
      screen.getByRole("textbox", { name: "Filter repositories" });
    // Already shown: nothing toggles, focus still moves.
    await user.click(screen.getByRole("button", { name: "Search filters" }));
    expect(
      screen.getByRole("complementary", { name: "Filters" }),
    ).toBeVisible();
    expect(search()).toHaveFocus();
    expect(window.localStorage.getItem("t:reveal:collapsed")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Hide filters" }));
    expect(screen.queryByRole("complementary", { name: "Filters" })).toBeNull();
    expect(window.localStorage.getItem("t:reveal:collapsed")).toBe("1");
    await user.click(screen.getByRole("button", { name: "Hide filters" }));
    expect(screen.queryByRole("complementary", { name: "Filters" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Search filters" }));
    expect(
      screen.getByRole("complementary", { name: "Filters" }),
    ).toBeVisible();
    expect(search()).toHaveFocus();
    expect(window.localStorage.getItem("t:reveal:collapsed")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Hide sidebar" }),
    ).toHaveAttribute("aria-expanded", "true");
  });

  it("the rail still focuses the first control, and toggling still works", async () => {
    const user = userEvent.setup();
    render(<Shell />);
    await user.click(screen.getByRole("button", { name: "Hide sidebar" }));
    const rail = screen.getAllByRole("button", { name: "Show sidebar" })[1];
    if (!rail) throw new Error("no rail");
    await user.click(rail);
    expect(screen.getByRole("button", { name: "first" })).toHaveFocus();
  });

  it("do nothing without a sidebar", async () => {
    const user = userEvent.setup();
    render(
      <AppShell topBar={<TopBar>bar</TopBar>}>
        <Main>
          <Controls />
        </Main>
      </AppShell>,
    );
    await user.click(screen.getByRole("button", { name: "Hide filters" }));
    await user.click(screen.getByRole("button", { name: "Search filters" }));
    expect(
      screen.getByRole("button", { name: "Search filters" }),
    ).toHaveFocus();
  });
});

describe("icons", () => {
  it("includes branch, comment and diff, drawn as 1.5 stroke paths", () => {
    for (const name of ["branch", "comment", "diff"] as const) {
      expect(iconNames).toContain(name);
      const { container, unmount } = render(<Icon name={name} />);
      const svg = container.querySelector("svg.wb-icon");
      expect(svg).toHaveAttribute("stroke-width", "1.5");
      expect(svg?.querySelectorAll("path").length).toBeGreaterThan(0);
      unmount();
    }
  });
});

describe("IconButton indicator", () => {
  it("adds a decorative dot; the label says what is active", () => {
    render(
      <>
        <IconButton icon="filter" label="Visibility: Private" indicator />
        <IconButton icon="filter" label="Visibility: Any" />
        <IconButton
          icon="filter"
          label="Filters: 2 active"
          href="#/filters"
          indicator
        />
      </>,
    );
    const on = screen.getByRole("button", { name: "Visibility: Private" });
    const dot = on.querySelector(".wb-btn-indicator");
    expect(dot).toHaveAttribute("aria-hidden", "true");
    expect(on).toHaveAccessibleName("Visibility: Private");
    expect(
      screen
        .getByRole("button", { name: "Visibility: Any" })
        .querySelector(".wb-btn-indicator"),
    ).toBeNull();
    expect(
      screen
        .getByRole("link", { name: "Filters: 2 active" })
        .querySelector(".wb-btn-indicator"),
    ).not.toBeNull();
  });
});

describe("TopStatus href", () => {
  it("renders a link through LinkProvider; onClick still runs", async () => {
    const user = userEvent.setup();
    const seen = vi.fn();
    const onClick = vi.fn();
    function RouterLink({ href, onClick: click, ...rest }: LinkProps) {
      return (
        <a
          {...rest}
          href={href}
          data-router="yes"
          onClick={(e) => {
            e.preventDefault();
            seen(href);
            click?.(e);
          }}
        />
      );
    }
    render(
      <LinkProvider component={RouterLink}>
        <TopStatus
          label="Synced 2 m ago"
          detail="Next sync in 3 minutes"
          href="/settings#sources"
          onClick={onClick}
        />
        <TopStatus label="Live" onClick={() => {}} />
        <TopStatus label="Idle" />
      </LinkProvider>,
    );
    const link = screen.getByRole("link", { name: "Synced 2 m ago" });
    expect(link).toHaveAttribute("data-router", "yes");
    expect(link).toHaveClass("wb-top-status");
    expect(link).toHaveAttribute("title", "Next sync in 3 minutes");
    await user.click(link);
    expect(seen).toHaveBeenCalledWith("/settings#sources");
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Live" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Idle" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Idle" })).toBeNull();
  });
});

describe("Combobox token entry", () => {
  function Emails({
    separators = [",", " "],
    parse,
    allowCustom = true,
    initial = [],
    options,
  }: {
    separators?: string[];
    parse?: (text: string) => string[];
    allowCustom?: boolean;
    initial?: string[];
    options?: { value: string; label: string }[];
  }) {
    const [v, setV] = useState<string[]>(initial);
    return (
      <>
        <Combobox
          multiple
          allowCustom={allowCustom}
          aria-label="Recipients"
          value={v}
          onChange={setV}
          separators={separators}
          parse={parse}
          options={options}
        />
        <output data-testid="value">{v.join("|")}</output>
      </>
    );
  }
  const value = () => screen.getByTestId("value").textContent;
  const input = () => screen.getByRole("combobox", { name: "Recipients" });

  it("a separator commits the typed text and is never typed", async () => {
    const user = userEvent.setup();
    render(<Emails />);
    await user.click(input());
    await user.keyboard("alice@example.com,");
    expect(value()).toBe("alice@example.com");
    expect(input()).toHaveValue("");
    await user.keyboard(" bob@example.com ");
    expect(value()).toBe("alice@example.com|bob@example.com");
    expect(input()).toHaveValue("");
    // Enter and Backspace work as before.
    await user.keyboard("carol@example.com{Enter}");
    expect(value()).toBe("alice@example.com|bob@example.com|carol@example.com");
    await user.keyboard("{Backspace}");
    expect(value()).toBe("alice@example.com|bob@example.com");
  });

  it("splits a pasted list (separators and line breaks), skipping duplicates", async () => {
    const user = userEvent.setup();
    render(<Emails initial={["alice@example.com"]} />);
    await user.click(input());
    await user.paste("bob@example.com, alice@example.com\ncarol@example.com");
    expect(value()).toBe("alice@example.com|bob@example.com|carol@example.com");
    expect(input()).toHaveValue("");
    // A single value pastes as text.
    await user.paste("dave@example.com");
    expect(input()).toHaveValue("dave@example.com");
    expect(value()).toBe("alice@example.com|bob@example.com|carol@example.com");
  });

  it("parse normalizes and can reject text, on separators, Enter and blur", async () => {
    const user = userEvent.setup();
    const parse = (text: string) =>
      text
        .split(/[\s,]+/)
        .map((s) => s.trim().toLowerCase())
        .filter((s) => s.includes("@"));
    render(<Emails parse={parse} />);
    await user.click(input());
    await user.keyboard("Alice@Example.com,");
    expect(value()).toBe("alice@example.com");
    await user.keyboard("nope,");
    expect(value()).toBe("alice@example.com");
    expect(input()).toHaveValue("nope");
    await user.clear(input());
    await user.keyboard("Bob@Example.com{Escape}{Enter}");
    expect(value()).toBe("alice@example.com|bob@example.com");
    await user.keyboard("Carol@Example.com");
    await user.tab();
    expect(value()).toBe("alice@example.com|bob@example.com|carol@example.com");
  });

  it("without allowCustom only text naming an option commits; the rest stays", async () => {
    const user = userEvent.setup();
    render(
      <Emails
        allowCustom={false}
        options={[
          { value: "gh", label: "github" },
          { value: "jira", label: "jira" },
        ]}
      />,
    );
    await user.click(input());
    await user.paste("jira, nope");
    expect(value()).toBe("jira");
    expect(input()).toHaveValue("nope");
  });

  it("a plain multiple combobox ignores separators", async () => {
    const user = userEvent.setup();
    function Plain() {
      const [v, setV] = useState<string[]>([]);
      return (
        <>
          <Combobox
            multiple
            allowCustom
            aria-label="Recipients"
            value={v}
            onChange={setV}
          />
          <output data-testid="value">{v.join("|")}</output>
        </>
      );
    }
    render(<Plain />);
    await user.click(input());
    await user.keyboard("a, b");
    expect(input()).toHaveValue("a, b");
    await user.keyboard("{Enter}");
    expect(value()).toBe("a, b");
  });
});

describe("Switch size", () => {
  it("sm adds the small modifier to the switch", () => {
    render(
      <>
        <Switch aria-label="Follow agents" size="sm" />
        <Switch label="Notify" size="sm" />
        <Switch aria-label="Default" />
      </>,
    );
    expect(screen.getByRole("switch", { name: "Follow agents" })).toHaveClass(
      "wb-switch",
      "wb-switch--sm",
    );
    expect(screen.getByRole("switch", { name: "Notify" })).toHaveClass(
      "wb-switch--sm",
    );
    expect(screen.getByRole("switch", { name: "Default" })).not.toHaveClass(
      "wb-switch--sm",
    );
  });
});

describe("QualifiedName", () => {
  it("renders a muted prefix before the name, with the full text as title", () => {
    const { container } = render(
      <>
        <QualifiedName prefix="octo-org" name="atlas" />
        <QualifiedName name="workbench-ui" />
      </>,
    );
    const [full, bare] = Array.from(container.querySelectorAll(".wb-qname"));
    expect(full).toHaveTextContent("octo-org/atlas");
    expect(full).toHaveAttribute("title", "octo-org/atlas");
    expect(full?.querySelector(".wb-qname-prefix-text")).toHaveTextContent(
      "octo-org",
    );
    expect(full?.querySelector(".wb-qname-name")).toHaveTextContent("atlas");
    expect(bare?.querySelector(".wb-qname-prefix")).toBeNull();
    expect(bare).toHaveAttribute("title", "workbench-ui");
  });
});

describe("Card headAlign", () => {
  it("center adds the one-row header modifier", () => {
    const { container } = render(
      <>
        <Card title="Branches" subtitle="newest first" headAlign="center" />
        <Card title="Pull requests" />
      </>,
    );
    const heads = container.querySelectorAll(".wb-card-head");
    expect(heads[0]).toHaveClass("wb-card-head--center");
    expect(heads[1]).not.toHaveClass("wb-card-head--center");
  });
});
