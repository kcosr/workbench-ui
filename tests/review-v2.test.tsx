import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Combobox, CommandPalette, Disclosure, Meter, Modal } from "../src";
import type { ComboOption } from "../src";

describe("focus traversal", () => {
  it("Tab reaches a disclosure summary inside a modal", async () => {
    const user = userEvent.setup();
    render(
      <Modal open onClose={() => {}} title="Record">
        <Disclosure summary="Raw JSON">
          <pre>{"{}"}</pre>
        </Disclosure>
      </Modal>,
    );
    const close = screen.getByRole("button", { name: "Close" });
    const summary = screen.getByText("Raw JSON").closest("summary");
    if (!summary) throw new Error("no summary");
    // The trap counts the summary: Shift+Tab from the first control wraps
    // to it, Tab from it wraps back. (user-event's own Tab emulation skips
    // summaries; browsers don't, see the gallery check.)
    close.focus();
    await user.tab({ shift: true });
    expect(summary).toHaveFocus();
    await user.tab();
    expect(close).toHaveFocus();
  });
});

describe("async combobox", () => {
  it("never selects results loaded for an earlier query", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const pending = new Map<string, (items: ComboOption[]) => void>();
    const load = (q: string) =>
      new Promise<readonly ComboOption[]>((res) => {
        pending.set(q, res);
      });
    function Host() {
      const [v, setV] = useState<string | null>(null);
      return (
        <Combobox
          aria-label="Principal"
          value={v}
          onChange={(x) => {
            setV(x);
            onChange(x);
          }}
          loadOptions={load}
          debounceMs={0}
          minQuery={1}
        />
      );
    }
    render(<Host />);
    const input = screen.getByRole("combobox", { name: "Principal" });
    await user.click(input);
    await user.keyboard("a");
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5));
      pending.get("a")?.([{ value: "u-alice", label: "Alice" }]);
    });
    expect(screen.getByRole("option", { name: "Alice" })).toBeInTheDocument();
    await user.keyboard("{Backspace}bob");
    // "bob" hasn't loaded: Alice is gone and Enter selects nothing.
    expect(screen.queryByRole("option", { name: "Alice" })).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
    await user.keyboard("{Enter}");
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("command palette IME", () => {
  it("leaves arrow keys to the IME while composing", () => {
    render(
      <CommandPalette
        open
        onClose={() => {}}
        sources={[
          {
            id: "go",
            title: "Go to",
            items: [
              { id: "a", label: "Alpha", onSelect: () => {} },
              { id: "b", label: "Beta", onSelect: () => {} },
            ],
          },
        ]}
      />,
    );
    const input = screen.getByRole("combobox");
    const e = new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      cancelable: true,
      isComposing: true,
    });
    act(() => {
      input.dispatchEvent(e);
    });
    expect(e.defaultPrevented).toBe(false);
    expect(screen.getByRole("option", { name: "Alpha" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});

describe("Meter", () => {
  it("is named by a JSX label", () => {
    render(
      <Meter
        value={3}
        max={10}
        label={
          <span>
            Quota <b>(hourly)</b>
          </span>
        }
      />,
    );
    expect(
      screen.getByRole("meter", { name: "Quota (hourly)" }),
    ).toHaveAttribute("aria-valuetext", "30%");
  });

  it("aria-label overrides the visible label", () => {
    render(
      <Meter value={3} max={10} label="Quota" aria-label="Hourly quota used" />,
    );
    expect(
      screen.getByRole("meter", { name: "Hourly quota used" }),
    ).toBeInTheDocument();
  });
});

describe("refetch progress", () => {
  it("animates inside a clipped track", () => {
    const css = readFileSync(
      resolve(__dirname, "..", "src", "styles", "states.css"),
      "utf8",
    );
    const track = /\.wb-progress > i \{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(track).toMatch(/overflow:\s*hidden/);
    expect(track).toMatch(/right:\s*0/);
    expect(css).toMatch(/\.wb-progress\.is-active > i::before \{\s*animation:/);
  });
});
