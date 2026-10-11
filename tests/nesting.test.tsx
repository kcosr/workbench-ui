import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  Button,
  Combobox,
  Drawer,
  Field,
  IconButton,
  Input,
  Menu,
  Modal,
  Popover,
  useFocusTrap,
} from "../src";

describe("nested overlays", () => {
  it("a combobox option inside a popover can be picked (portaled listbox counts as inside)", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    function Host() {
      const anchor = useRef<HTMLButtonElement | null>(null);
      const [open, setOpen] = useState(true);
      const [v, setV] = useState<string | null>(null);
      return (
        <>
          <Button ref={anchor}>Filters</Button>
          <Popover
            open={open}
            onClose={() => setOpen(false)}
            anchorRef={anchor}
            label="Filters"
          >
            <Combobox
              aria-label="Service"
              value={v}
              onChange={(x) => {
                setV(x);
                onChange(x);
              }}
              options={[
                { value: "gh", label: "GitHub" },
                { value: "jira", label: "Jira" },
              ]}
            />
          </Popover>
        </>
      );
    }
    render(<Host />);
    await user.click(screen.getByRole("combobox", { name: "Service" }));
    await user.click(screen.getByRole("option", { name: "Jira" }));
    expect(onChange).toHaveBeenCalledWith("jira");
    expect(screen.getByRole("dialog", { name: "Filters" })).toBeInTheDocument();
  });

  it("Tab moves between fields of a popover opened inside a modal", async () => {
    const user = userEvent.setup();
    function Host() {
      const anchor = useRef<HTMLButtonElement | null>(null);
      const [pop, setPop] = useState(false);
      return (
        <Modal open onClose={() => {}} title="Export">
          <Button ref={anchor} onClick={() => setPop(true)}>
            Range
          </Button>
          <Button>After range</Button>
          <Popover
            open={pop}
            onClose={() => setPop(false)}
            anchorRef={anchor}
            label="Custom range"
          >
            <Field label="From">
              <Input />
            </Field>
            <Field label="To">
              <Input />
            </Field>
          </Popover>
        </Modal>
      );
    }
    render(<Host />);
    await user.click(screen.getByRole("button", { name: "Range" }));
    expect(screen.getByLabelText("From")).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText("To")).toHaveFocus();
    expect(
      screen.getByRole("dialog", { name: "Custom range" }),
    ).toBeInTheDocument();
    // Past the last field: the popover closes and focus continues after its anchor.
    await user.tab();
    expect(screen.queryByRole("dialog", { name: "Custom range" })).toBeNull();
    expect(screen.getByRole("button", { name: "After range" })).toHaveFocus();
  });

  it("Escape closes a modal mounted in the same commit as its parent drawer, not the drawer", () => {
    const closed: string[] = [];
    render(
      <Drawer title="Rule" onClose={() => closed.push("drawer")}>
        <Modal open onClose={() => closed.push("modal")} title="Confirm">
          body
        </Modal>
      </Drawer>,
    );
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(closed).toEqual(["modal"]);
  });

  it("menu opened from the keyboard focuses the first (or last) item", async () => {
    const user = userEvent.setup();
    render(
      <Menu
        label="Row"
        items={[
          { id: "a", label: "Alpha" },
          { id: "b", label: "Beta" },
        ]}
        trigger={(props) => <IconButton {...props} icon="more" label="More" />}
      />,
    );
    screen.getByRole("button", { name: "More" }).focus();
    await user.keyboard("{ArrowUp}");
    expect(screen.getByRole("menuitem", { name: "Beta" })).toHaveFocus();
    await user.keyboard("{Escape}");
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Alpha" })).toHaveFocus();
  });

  it("link menu items expose their checked state", async () => {
    const user = userEvent.setup();
    render(
      <Menu
        label="Space"
        items={[
          { id: "admin", label: "Admin", href: "#/admin", checked: true },
          { id: "me", label: "My access", href: "#/me", checked: false },
        ]}
        trigger={(props) => (
          <IconButton {...props} icon="users" label="Space" />
        )}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Space" }));
    expect(
      screen.getByRole("menuitemradio", { name: "Admin" }),
    ).toHaveAttribute("aria-checked", "true");
    expect(
      screen.getByRole("menuitemradio", { name: "My access" }),
    ).toHaveAttribute("aria-checked", "false");
  });
});

describe("useFocusTrap", () => {
  it("captures the opener on every activation", async () => {
    const user = userEvent.setup();
    function Panel() {
      const [active, setActive] = useState(false);
      const box = useRef<HTMLDivElement | null>(null);
      useFocusTrap(box, active);
      return (
        <>
          <button onClick={() => setActive(true)}>Activate</button>
          <div ref={box} hidden={!active}>
            <input aria-label="inner" />
            <button onClick={() => setActive(false)}>Done</button>
          </div>
        </>
      );
    }
    render(<Panel />);
    await user.click(screen.getByRole("button", { name: "Activate" }));
    expect(screen.getByLabelText("inner")).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.getByRole("button", { name: "Activate" })).toHaveFocus();
  });
});

describe("IME composition", () => {
  it("Enter confirming a composition does not select a combobox option", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Combobox
        aria-label="Owner"
        value={null}
        onChange={onChange}
        options={[{ value: "a", label: "Aiko" }]}
      />,
    );
    const input = screen.getByRole("combobox", { name: "Owner" });
    await user.click(input);
    act(() => {
      input.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          bubbles: true,
          cancelable: true,
          isComposing: true,
        }),
      );
    });
    expect(onChange).not.toHaveBeenCalled();
    expect(input).toHaveAttribute("aria-expanded", "true");
  });
});

describe("nested overlays, round 2", () => {
  it("traps Tab in the inner modal when nested modals mount together", async () => {
    const user = userEvent.setup();
    render(
      <Modal open onClose={() => {}} title="Outer">
        <button>outer action</button>
        <Modal open onClose={() => {}} title="Inner">
          <button>inner one</button>
          <button>inner two</button>
        </Modal>
      </Modal>,
    );
    const inner = screen.getByRole("dialog", { name: "Inner" });
    expect(inner.contains(document.activeElement)).toBe(true);
    screen.getByRole("button", { name: "inner two" }).focus();
    await user.tab();
    expect(inner.contains(document.activeElement)).toBe(true);
    await user.tab({ shift: true });
    expect(inner.contains(document.activeElement)).toBe(true);
  });

  it("a drawer or popover mounting with an open child modal leaves focus in the modal", async () => {
    render(
      <Drawer title="Rule" onClose={() => {}}>
        <Modal open onClose={() => {}} title="Confirm">
          <input aria-label="reason" />
        </Modal>
      </Drawer>,
    );
    expect(screen.getByLabelText("reason")).toHaveFocus();
  });

  it("a popover mounting with an open child modal leaves focus in the modal", async () => {
    function Host() {
      const anchor = useRef<HTMLButtonElement | null>(null);
      return (
        <>
          <Button ref={anchor}>anchor</Button>
          <Popover open onClose={() => {}} anchorRef={anchor} label="Pop">
            <button>pop action</button>
            <Modal open onClose={() => {}} title="Child">
              <input aria-label="child field" />
            </Modal>
          </Popover>
        </>
      );
    }
    render(<Host />);
    await act(async () => {});
    expect(screen.getByLabelText("child field")).toHaveFocus();
  });

  it("clicking a child modal's scrim does not close the parent popover", async () => {
    const user = userEvent.setup();
    const closePopover = vi.fn();
    const closeModal = vi.fn();
    function Host() {
      const anchor = useRef<HTMLButtonElement | null>(null);
      return (
        <>
          <Button ref={anchor}>anchor</Button>
          <Popover open onClose={closePopover} anchorRef={anchor} label="Pop">
            <Modal open onClose={closeModal} title="Child" dismissible={false}>
              <input aria-label="child field" />
            </Modal>
          </Popover>
        </>
      );
    }
    render(<Host />);
    const scrim = document.querySelector(".wb-scrim");
    if (!scrim) throw new Error("no scrim");
    await user.click(scrim);
    expect(closePopover).not.toHaveBeenCalled();
    expect(closeModal).not.toHaveBeenCalled();
    // The child modal stacks above its parent popover (depth-based z-index).
    const pop = screen.getByRole("dialog", { name: "Pop" });
    const modal = screen.getByRole("dialog", { name: "Child" });
    expect(pop.style.getPropertyValue("--wb-z-depth")).toBe("1");
    expect(modal.parentElement?.style.getPropertyValue("--wb-z-depth")).toBe(
      "2",
    );
  });
});

describe("paint order follows the layer stack", () => {
  it("a palette opened over a modal nested in a drawer paints above it", async () => {
    const { CommandPalette } = await import("../src");
    function Host({ palette }: { palette: boolean }) {
      return (
        <>
          <Drawer title="Rule" onClose={() => {}}>
            <Modal open onClose={() => {}} title="Nested">
              body
            </Modal>
          </Drawer>
          <CommandPalette open={palette} onClose={() => {}} sources={[]} />
        </>
      );
    }
    const { rerender } = render(<Host palette={false} />);
    const modalRoot = screen.getByRole("dialog", {
      name: "Nested",
    }).parentElement;
    rerender(<Host palette />);
    const paletteRoot = screen.getByRole("dialog", {
      name: "Command palette",
    }).parentElement;
    const depth = (el: HTMLElement | null | undefined) =>
      Number(el?.style.getPropertyValue("--wb-z-depth"));
    expect(depth(paletteRoot)).toBeGreaterThan(depth(modalRoot));
    fireEvent.keyDown(document.body, { key: "Escape" });
  });
});
