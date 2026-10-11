import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  AppShell,
  Button,
  Combobox,
  CommandPalette,
  ConfirmDialog,
  Drawer,
  IconButton,
  Main,
  Menu,
  Modal,
  Sidebar,
  ToastProvider,
  TopBar,
  useToast,
} from "../src";
import type { ComboOption, PaletteSource } from "../src";

const OPTIONS: ComboOption[] = [
  { value: "gh", label: "GitHub" },
  { value: "jira", label: "Jira" },
  { value: "slack", label: "Slack", disabled: true },
  { value: "pd", label: "PagerDuty" },
];

describe("Combobox", () => {
  function Multi({ onChange }: { onChange?: (v: string[]) => void }) {
    const [v, setV] = useState<string[]>(["jira"]);
    return (
      <Combobox
        multiple
        aria-label="Services"
        value={v}
        onChange={(next) => {
          setV(next);
          onChange?.(next);
        }}
        options={OPTIONS}
      />
    );
  }

  it("filters as you type and selects with arrows + Enter (multiple)", async () => {
    const user = userEvent.setup();
    render(<Multi />);
    const input = screen.getByRole("combobox", { name: "Services" });
    expect(input).toHaveAttribute("aria-expanded", "false");
    await user.click(input);
    await user.keyboard("gi");
    expect(input).toHaveAttribute("aria-expanded", "true");
    const listbox = screen.getByRole("listbox");
    expect(listbox).toHaveAttribute("aria-multiselectable", "true");
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
      "GitHub",
    ]);
    await user.keyboard("{ArrowDown}");
    expect(input.getAttribute("aria-activedescendant")).toBe(
      screen.getByRole("option").id,
    );
    await user.keyboard("{Enter}");
    expect(
      screen.getByRole("button", { name: "Remove GitHub" }),
    ).toBeInTheDocument();
    expect(input).toHaveValue("");
  });

  it("Backspace on empty text removes the last chip; Escape closes then clears", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Multi onChange={onChange} />);
    const input = screen.getByRole("combobox", { name: "Services" });
    await user.click(input);
    await user.keyboard("{Backspace}");
    expect(onChange).toHaveBeenLastCalledWith([]);
    await user.keyboard("pa");
    expect(input).toHaveAttribute("aria-expanded", "true");
    await user.keyboard("{Escape}");
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(input).toHaveValue("pa");
    await user.keyboard("{Escape}");
    expect(input).toHaveValue("");
  });

  it("skips disabled options and marks selection (single)", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    function Single() {
      const [v, setV] = useState<string | null>("gh");
      return (
        <Combobox
          aria-label="Service"
          value={v}
          onChange={(x) => {
            setV(x);
            onChange(x);
          }}
          options={OPTIONS}
        />
      );
    }
    render(<Single />);
    const input = screen.getByRole("combobox", { name: "Service" });
    expect(input).toHaveValue("GitHub");
    await user.click(input);
    // opens on the selected option
    expect(input.getAttribute("aria-activedescendant")).toBe(
      screen.getByRole("option", { name: "GitHub" }).id,
    );
    expect(screen.getByRole("option", { name: "GitHub" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    // Jira, then Slack is disabled and skipped
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(onChange).toHaveBeenLastCalledWith("pd");
    expect(input).toHaveValue("PagerDuty");
  });

  it("loads async options", async () => {
    const user = userEvent.setup();
    const load = vi.fn(async (q: string) =>
      OPTIONS.filter((o) => o.label.toLowerCase().includes(q.toLowerCase())),
    );
    function Async() {
      const [v, setV] = useState<string | null>(null);
      return (
        <Combobox
          aria-label="Owner"
          value={v}
          onChange={setV}
          loadOptions={load}
          debounceMs={0}
        />
      );
    }
    render(<Async />);
    await user.click(screen.getByRole("combobox", { name: "Owner" }));
    await user.keyboard("ji");
    await waitFor(() =>
      expect(screen.getByRole("option", { name: "Jira" })).toBeInTheDocument(),
    );
    expect(load).toHaveBeenLastCalledWith("ji", expect.any(AbortSignal));
  });
});

describe("Menu", () => {
  function M({ onEdit }: { onEdit: () => void }) {
    return (
      <Menu
        label="Row actions"
        items={[
          { id: "edit", label: "Edit", onSelect: onEdit },
          { type: "separator" },
          { id: "off", label: "Disabled", disabled: true },
          { id: "del", label: "Delete", danger: true },
        ]}
        trigger={(props) => <IconButton {...props} icon="more" label="More" />}
      />
    );
  }

  it("opens with focus on the first item, arrows move, Escape returns focus", async () => {
    const user = userEvent.setup();
    render(<M onEdit={() => {}} />);
    const trigger = screen.getByRole("button", { name: "More" });
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("menu", { name: "Row actions" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Edit" })).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Delete" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it("activates items and closes", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(<M onEdit={onEdit} />);
    await user.click(screen.getByRole("button", { name: "More" }));
    await user.keyboard("{Enter}");
    expect(onEdit).toHaveBeenCalled();
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("closes on outside click", async () => {
    const user = userEvent.setup();
    render(
      <>
        <M onEdit={() => {}} />
        <button>outside</button>
      </>,
    );
    await user.click(screen.getByRole("button", { name: "More" }));
    await user.click(screen.getByRole("button", { name: "outside" }));
    expect(screen.queryByRole("menu")).toBeNull();
  });
});

describe("Modal", () => {
  function Host() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Open</Button>
        <Modal
          open={open}
          onClose={() => setOpen(false)}
          title="Issue token"
          footer={
            <>
              <Button onClick={() => setOpen(false)}>Cancel</Button>
              <Button variant="primary">Issue</Button>
            </>
          }
        >
          <input aria-label="Name" />
        </Modal>
      </>
    );
  }

  it("is a labelled modal dialog that traps focus and restores it", async () => {
    const user = userEvent.setup();
    render(<Host />);
    const opener = screen.getByRole("button", { name: "Open" });
    await user.click(opener);
    const dialog = screen.getByRole("dialog", { name: "Issue token" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByLabelText("Name")).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    await user.tab();
    await user.tab();
    // wraps around: Close (×) is first in DOM order
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(opener).toHaveFocus();
  });
});

describe("ConfirmDialog", () => {
  it("shows pending, then the error, and stays open on failure", async () => {
    const user = userEvent.setup();
    let reject: (e: Error) => void = () => {};
    const onClose = vi.fn();
    render(
      <ConfirmDialog
        open
        onClose={onClose}
        title="Delete rule?"
        confirmLabel="Delete"
        onConfirm={() =>
          new Promise((_, r) => {
            reject = r;
          })
        }
      >
        This cannot be undone.
      </ConfirmDialog>,
    );
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByRole("button", { name: "Delete" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    await act(async () => reject(new Error("409 conflict")));
    expect(screen.getByRole("alert")).toHaveTextContent("409 conflict");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes after a successful confirm", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <ConfirmDialog
        open
        onClose={onClose}
        title="Reload?"
        tone="primary"
        onConfirm={async () => {}}
      >
        Reload now.
      </ConfirmDialog>,
    );
    expect(screen.getByRole("button", { name: "Confirm" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});

describe("CommandPalette", () => {
  it("filters sync items, loads async ones, highlights matches and runs on Enter", async () => {
    const user = userEvent.setup();
    const go = vi.fn();
    const person = vi.fn();
    const sources: PaletteSource[] = [
      {
        id: "go",
        title: "Go to",
        items: [
          {
            id: "tokens",
            label: "Tokens",
            icon: "key",
            onSelect: () => go("tokens"),
          },
          {
            id: "audit",
            label: "Audit",
            icon: "list",
            onSelect: () => go("audit"),
          },
        ],
      },
      {
        id: "people",
        title: "People",
        search: async (q) =>
          q.startsWith("a")
            ? [{ id: "alice", label: "Alice Chen", onSelect: person }]
            : [],
      },
    ];
    function Host() {
      const [open, setOpen] = useState(true);
      return (
        <CommandPalette
          open={open}
          onClose={() => setOpen(false)}
          sources={sources}
          debounceMs={0}
        />
      );
    }
    render(<Host />);
    const input = screen.getByRole("combobox");
    expect(input).toHaveFocus();
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Tokens",
      "Audit",
    ]);
    await user.keyboard("a");
    await waitFor(() =>
      expect(
        screen.getByRole("option", { name: /Alice Chen/ }),
      ).toBeInTheDocument(),
    );
    expect(
      screen.getByRole("option", { name: /Audit/ }).querySelector("mark"),
    ).toHaveTextContent("A");
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("option", { name: /Alice Chen/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await user.keyboard("{Enter}");
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(person).toHaveBeenCalled());
  });

  it("Escape closes it", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<CommandPalette open onClose={onClose} sources={[]} />);
    expect(screen.getByRole("listbox")).toHaveTextContent("No results");
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });
});

describe("Drawer", () => {
  function Host() {
    const [open, setOpen] = useState(false);
    return (
      <AppShell
        topBar={<TopBar>top</TopBar>}
        sidebar={<Sidebar label="Filters">side</Sidebar>}
        drawer={
          open ? (
            <Drawer title="Token laptop-cli" onClose={() => setOpen(false)}>
              <button>inside</button>
            </Drawer>
          ) : null
        }
      >
        <Main label="Tokens">
          <Button onClick={() => setOpen(true)}>Open drawer</Button>
        </Main>
      </AppShell>
    );
  }

  it("moves focus in on open, closes on Escape and returns focus", async () => {
    const user = userEvent.setup();
    render(<Host />);
    const opener = screen.getByRole("button", { name: "Open drawer" });
    await user.click(opener);
    const drawer = screen.getByRole("complementary", {
      name: "Token laptop-cli",
    });
    expect(drawer).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(
      screen.queryByRole("complementary", { name: "Token laptop-cli" }),
    ).toBeNull();
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it("closes with the × button", async () => {
    const user = userEvent.setup();
    render(<Host />);
    await user.click(screen.getByRole("button", { name: "Open drawer" }));
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(
      screen.queryByRole("complementary", { name: "Token laptop-cli" }),
    ).toBeNull();
  });
});

describe("AppShell sidebar", () => {
  it("resizes with the keyboard and persists the width", async () => {
    const user = userEvent.setup();
    render(
      <AppShell
        topBar={<TopBar>top</TopBar>}
        sidebar={<Sidebar label="Filters">x</Sidebar>}
        sidebarStorageKey="t:side"
      >
        <Main>main</Main>
      </AppShell>,
    );
    const sep = screen.getByRole("separator", { name: "Sidebar width" });
    expect(sep).toHaveAttribute("aria-valuenow", "268");
    sep.focus();
    await user.keyboard("{ArrowRight}");
    expect(sep).toHaveAttribute("aria-valuenow", "278");
    expect(window.localStorage.getItem("t:side")).toBe("278");
    await user.keyboard("{Home}");
    expect(sep).toHaveAttribute("aria-valuenow", "220");
    expect(
      document
        .querySelector<HTMLElement>(".wb-app")
        ?.style.getPropertyValue("--wb-side-w"),
    ).toBe("220px");
  });

  it("reads a persisted width", () => {
    window.localStorage.setItem("t:side", "300");
    render(
      <AppShell
        topBar={<TopBar>top</TopBar>}
        sidebar={<Sidebar label="Filters">x</Sidebar>}
        sidebarStorageKey="t:side"
      >
        <Main>main</Main>
      </AppShell>,
    );
    expect(screen.getByRole("separator")).toHaveAttribute(
      "aria-valuenow",
      "300",
    );
  });
});

describe("Toast", () => {
  it("announces the newest message in a polite live region", async () => {
    const user = userEvent.setup();
    function C() {
      const toast = useToast();
      return <button onClick={() => toast("Token revoked")}>go</button>;
    }
    render(
      <ToastProvider>
        <C />
      </ToastProvider>,
    );
    await user.click(screen.getByRole("button", { name: "go" }));
    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveTextContent("Token revoked");
  });
});
