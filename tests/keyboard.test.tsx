import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  List,
  ListRow,
  Rows,
  hasBlockingLayer,
  matchesHotkey,
  useCommandPaletteHotkey,
  useLayer,
  useListCursor,
} from "../src";

function key(init: KeyboardEventInit) {
  return new KeyboardEvent("keydown", init);
}

describe("matchesHotkey", () => {
  it("matches mod+k with Ctrl or Cmd, and plain keys without modifiers", () => {
    expect(matchesHotkey(key({ key: "k", ctrlKey: true }), "mod+k")).toBe(true);
    expect(matchesHotkey(key({ key: "k", metaKey: true }), "mod+k")).toBe(true);
    expect(matchesHotkey(key({ key: "k" }), "mod+k")).toBe(false);
    expect(matchesHotkey(key({ key: "/" }), "/")).toBe(true);
    expect(matchesHotkey(key({ key: "j", ctrlKey: true }), "j")).toBe(false);
    expect(matchesHotkey(key({ key: "J", shiftKey: true }), "j")).toBe(false);
    expect(matchesHotkey(key({ key: "?", shiftKey: true }), "?")).toBe(true);
    expect(matchesHotkey(key({ key: "Escape" }), "esc")).toBe(true);
  });
});

function Layer({
  name,
  blocking,
  onClose,
}: {
  name: string;
  blocking: boolean;
  onClose: (n: string) => void;
}) {
  useLayer(true, () => onClose(name), blocking);
  return <div>{name}</div>;
}

describe("layers", () => {
  it("Escape closes only the top-most layer", () => {
    const closed: string[] = [];
    const { rerender } = render(
      <Layer name="drawer" blocking={false} onClose={(n) => closed.push(n)} />,
    );
    expect(hasBlockingLayer()).toBe(false);
    rerender(
      <>
        <Layer name="drawer" blocking={false} onClose={(n) => closed.push(n)} />
        <Layer name="modal" blocking onClose={(n) => closed.push(n)} />
      </>,
    );
    expect(hasBlockingLayer()).toBe(true);
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(closed).toEqual(["modal"]);
  });

  it("does not close a layer when the Escape was already handled", () => {
    const onClose = vi.fn();
    render(<Layer name="x" blocking onClose={onClose} />);
    const e = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });
    e.preventDefault();
    document.body.dispatchEvent(e);
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("useCommandPaletteHotkey", () => {
  it("toggles from anywhere, including inputs", () => {
    const toggle = vi.fn();
    function C() {
      useCommandPaletteHotkey(toggle);
      return <input aria-label="field" />;
    }
    render(<C />);
    screen.getByLabelText("field").focus();
    fireEvent.keyDown(screen.getByLabelText("field"), {
      key: "k",
      ctrlKey: true,
    });
    expect(toggle).toHaveBeenCalledTimes(1);
  });
});

function CursorList({ onExternal }: { onExternal?: (id: string) => void }) {
  const ids = ["a", "b", "c"];
  const [open, setOpen] = useState<string | null>(null);
  const cursor = useListCursor({
    ids,
    activeId: open,
    onOpen: setOpen,
    onExternal,
  });
  return (
    <>
      <input aria-label="search" />
      <List>
        <Rows>
          {ids.map((id) => (
            <ListRow
              key={id}
              itemId={id}
              title={`Item ${id}`}
              onOpen={() => setOpen(id)}
              cursor={cursor.cursorId === id}
              active={open === id}
            />
          ))}
        </Rows>
      </List>
      <div data-testid="open">{open ?? "none"}</div>
      {open ? (
        <Layer name="d" blocking={false} onClose={() => setOpen(null)} />
      ) : null}
    </>
  );
}

describe("useListCursor", () => {
  it("j/k move the cursor, Enter opens, the open item follows the cursor", () => {
    render(<CursorList />);
    const row = (id: string) => screen.getByText(`Item ${id}`).closest("li");
    fireEvent.keyDown(document.body, { key: "j" });
    expect(row("a")).toHaveClass("is-cursor");
    fireEvent.keyDown(document.body, { key: "j" });
    expect(row("b")).toHaveClass("is-cursor");
    fireEvent.keyDown(document.body, { key: "k" });
    expect(row("a")).toHaveClass("is-cursor");
    fireEvent.keyDown(document.body, { key: "Enter" });
    expect(screen.getByTestId("open")).toHaveTextContent("a");
    expect(row("a")).toHaveClass("is-active");
    fireEvent.keyDown(document.body, { key: "j" });
    expect(screen.getByTestId("open")).toHaveTextContent("b");
  });

  it("is suppressed while typing", () => {
    render(<CursorList />);
    const input = screen.getByLabelText("search");
    input.focus();
    fireEvent.keyDown(input, { key: "j" });
    expect(document.querySelector(".is-cursor")).toBeNull();
  });

  it("is suppressed while a blocking layer is open", () => {
    render(
      <>
        <CursorList />
        <Layer name="modal" blocking onClose={() => {}} />
      </>,
    );
    fireEvent.keyDown(document.body, { key: "j" });
    expect(document.querySelector(".is-cursor")).toBeNull();
  });

  it("o opens the cursor item externally", () => {
    const onExternal = vi.fn();
    render(<CursorList onExternal={onExternal} />);
    fireEvent.keyDown(document.body, { key: "j" });
    fireEvent.keyDown(document.body, { key: "o" });
    expect(onExternal).toHaveBeenCalledWith("a");
  });

  it("row titles are real buttons with aria-current for the open row", async () => {
    const user = userEvent.setup();
    render(<CursorList />);
    await user.click(screen.getByRole("button", { name: "Item c" }));
    expect(screen.getByRole("button", { name: "Item c" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    act(() => {
      fireEvent.keyDown(document.body, { key: "Escape" });
    });
    expect(screen.getByTestId("open")).toHaveTextContent("none");
  });
});
