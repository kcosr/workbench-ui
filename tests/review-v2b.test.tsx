import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Combobox } from "../src";
import type { ComboOption } from "../src";

const OPTS: ComboOption[] = [
  { value: "u-alice", label: "Alice" },
  { value: "tokens.revoke", label: "tokens.revoke", disabled: true },
];

function Host({ onChange }: { onChange: (v: string | null) => void }) {
  const [v, setV] = useState<string | null>("u-alice");
  return (
    <>
      <Combobox
        aria-label="Owner"
        value={v}
        onChange={(x) => {
          setV(x);
          onChange(x);
        }}
        options={OPTS}
        allowCustom
        commitOnBlur
      />
      <button>after</button>
    </>
  );
}

describe("combobox review round 2", () => {
  it("clearing a single value discards pending text", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Host onChange={onChange} />);
    const input = screen.getByRole("combobox", { name: "Owner" });
    await user.click(input);
    await user.keyboard("Bob");
    await user.click(screen.getByRole("button", { name: "Clear selection" }));
    expect(input).toHaveValue("");
    await user.tab();
    expect(onChange.mock.calls).toEqual([[null]]);
  });

  it("free text never selects a disabled option (Enter or blur)", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Host onChange={onChange} />);
    const input = screen.getByRole("combobox", { name: "Owner" });
    await user.click(input);
    await user.keyboard("{Control>}a{/Control}tokens.revoke");
    expect(screen.queryByRole("option", { name: /Add/ })).toBeNull();
    await user.keyboard("{Enter}");
    // With the list closed (Esc) Enter still won't commit it.
    await user.keyboard("{Escape}{Enter}");
    await user.tab();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("with the list closed, Enter confirms typed free text", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Host onChange={onChange} />);
    const input = screen.getByRole("combobox", { name: "Owner" });
    await user.click(input);
    await user.keyboard("{Control>}a{/Control}Bob{Escape}{Enter}");
    expect(onChange).toHaveBeenLastCalledWith("Bob");
  });
});

describe("toned sidebar icons", () => {
  it("the tone rule lives in wb.tones, above the current-item rule in wb.components", () => {
    const css = readFileSync(
      resolve(__dirname, "..", "src", "styles", "utilities.css"),
      "utf8",
    );
    const tones = css.slice(
      css.indexOf("@layer wb.tones"),
      css.indexOf("@layer wb.utilities"),
    );
    expect(tones).toMatch(
      /\.wb-side-icon\[class\*="wb-tone-"\]\s*\{\s*color: var\(--wb-tone\);/,
    );
  });
});

describe("Enter inside a form", () => {
  function FormHost({ onSubmit }: { onSubmit: () => void }) {
    const [v, setV] = useState<string | null>("u-alice");
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <Combobox aria-label="Owner" value={v} onChange={setV} options={OPTS} />
        <button type="submit">Save</button>
      </form>
    );
  }

  it("never submits while the list is open or text is pending, even if nothing is committed", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<FormHost onSubmit={onSubmit} />);
    const input = screen.getByRole("combobox", { name: "Owner" });
    await user.click(input);
    await user.keyboard("{Control>}a{/Control}tokens.revoke{Enter}");
    expect(onSubmit).not.toHaveBeenCalled();
    await user.keyboard("{Escape}{Enter}");
    expect(onSubmit).not.toHaveBeenCalled();
    // Clear the pending text (Esc again): Enter submits the form as usual.
    await user.keyboard("{Escape}{Enter}");
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
