import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  Button,
  Combobox,
  Drawer,
  Field,
  Input,
  ListRow,
  Modal,
  Popover,
  Rows,
  tabbableIn,
  useListCursor,
} from "../src";

describe("list cursor and focus", () => {
  function List() {
    const ids = ["a", "b", "c"];
    const [open, setOpen] = useState<string | null>(null);
    const cursor = useListCursor({ ids, activeId: open, onOpen: setOpen });
    return (
      <>
        <Rows>
          {ids.map((id) => (
            <ListRow
              key={id}
              itemId={id}
              title={`Row ${id}`}
              onOpen={() => setOpen(id)}
              cursor={cursor.cursorId === id}
              active={open === id}
            />
          ))}
        </Rows>
        {open ? (
          <Drawer title={`Item ${open}`} onClose={() => setOpen(null)} />
        ) : null}
        <div data-testid="open">{open ?? "none"}</div>
      </>
    );
  }

  it("j/k move focus with the cursor when a row link has focus, so Enter opens the highlighted row", async () => {
    const user = userEvent.setup();
    render(<List />);
    await user.click(screen.getByRole("button", { name: "Row a" }));
    await user.keyboard("{Escape}");
    await act(async () => {
      await new Promise((r) => requestAnimationFrame(() => r(null)));
    });
    expect(screen.getByRole("button", { name: "Row a" })).toHaveFocus();
    await user.keyboard("j");
    expect(screen.getByRole("button", { name: "Row b" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(screen.getByTestId("open")).toHaveTextContent("b");
  });
});

describe("native tab order", () => {
  it("skips unchecked radios in a checked group and controls in a disabled fieldset", () => {
    document.body.innerHTML = `
      <div id="root">
        <input type="radio" name="size" value="s">
        <input type="radio" name="size" value="m" checked>
        <input type="radio" name="size" value="l">
        <input type="radio" name="tone" value="a">
        <input type="radio" name="tone" value="b">
        <button id="ok">OK</button>
        <fieldset disabled><button id="off">Off</button><input id="off2"></fieldset>
      </div>`;
    const root = document.getElementById("root") as HTMLElement;
    const got = tabbableIn(root).map(
      (e) =>
        e.id ||
        `${(e as HTMLInputElement).name}:${(e as HTMLInputElement).value}`,
    );
    expect(got).toEqual(["size:m", "tone:a", "ok"]);
    document.body.innerHTML = "";
  });

  it("a disabled first radio doesn't hide the group's enabled radio", async () => {
    const user = userEvent.setup();
    render(
      <Modal open onClose={() => {}} title="Pick">
        <fieldset disabled>
          <input type="radio" name="q" aria-label="off" />
        </fieldset>
        <input type="radio" name="q" aria-label="on" />
      </Modal>,
    );
    const dialog = screen.getByRole("dialog", { name: "Pick" });
    expect(tabbableIn(dialog).map((e) => e.getAttribute("aria-label"))).toEqual(
      ["Close", "on"],
    );
    screen.getByRole("button", { name: "Close" }).focus();
    await user.tab();
    expect(screen.getByLabelText("on")).toHaveFocus();
  });

  it("the modal trap wraps from the last real Tab stop", async () => {
    const user = userEvent.setup();
    render(
      <Modal open onClose={() => {}} title="Pick">
        <input type="radio" name="p" aria-label="one" defaultChecked />
        <input type="radio" name="p" aria-label="two" />
        <fieldset disabled>
          <button>disabled</button>
        </fieldset>
      </Modal>,
    );
    screen.getByLabelText("one").focus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
  });
});

describe("popover Tab continuation inside a modal", () => {
  it("wraps within the modal instead of escaping to an outer one", async () => {
    const user = userEvent.setup();
    function Inner() {
      const anchor = useRef<HTMLButtonElement | null>(null);
      const [pop, setPop] = useState(false);
      return (
        <Modal open onClose={() => {}} title="Inner">
          <Button ref={anchor} onClick={() => setPop(true)}>
            Range
          </Button>
          <Popover
            open={pop}
            onClose={() => setPop(false)}
            anchorRef={anchor}
            label="Custom range"
          >
            <Field label="From">
              <Input />
            </Field>
          </Popover>
        </Modal>
      );
    }
    render(
      <Modal open onClose={() => {}} title="Outer">
        <button>outer action</button>
        <Inner />
      </Modal>,
    );
    await user.click(screen.getByRole("button", { name: "Range" }));
    expect(screen.getByLabelText("From")).toHaveFocus();
    await user.tab();
    const inner = screen.getByRole("dialog", { name: "Inner" });
    expect(inner.contains(document.activeElement)).toBe(true);
    // Range was the inner modal's last control: continuation wraps to its first (Close).
    expect(document.activeElement).toBe(
      inner.querySelector('button[aria-label="Close"]'),
    );
  });
});

describe("disabling an open combobox", () => {
  it("closes the list and ignores selection", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    function Host({ disabled }: { disabled: boolean }) {
      return (
        <Combobox
          aria-label="Owner"
          value={null}
          onChange={onChange}
          disabled={disabled}
          options={[
            { value: "a", label: "Alice" },
            { value: "b", label: "Bob" },
          ]}
        />
      );
    }
    const { rerender } = render(<Host disabled={false} />);
    await user.click(screen.getByRole("combobox", { name: "Owner" }));
    const bob = screen.getByRole("option", { name: "Bob" });
    rerender(<Host disabled />);
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.getByRole("combobox", { name: "Owner" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(bob.isConnected).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("modal initial focus", () => {
  it("skips a text field inside a disabled fieldset", async () => {
    const user = userEvent.setup();
    function Host() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>Open</button>
          <Modal open={open} onClose={() => setOpen(false)} title="Locked">
            <fieldset disabled>
              <input aria-label="locked" />
            </fieldset>
            <button>Continue</button>
          </Modal>
        </>
      );
    }
    render(<Host />);
    await user.click(screen.getByRole("button", { name: "Open" }));
    const dialog = screen.getByRole("dialog", { name: "Locked" });
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(screen.getByLabelText("locked")).not.toHaveFocus();
  });
});
