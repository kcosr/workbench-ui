import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Combobox, Field, Input, SidebarCheck, SidebarItem } from "../src";
import type { ComboOption } from "../src";

describe("Field", () => {
  it("separates the (optional) marker in the accessible name", () => {
    render(
      <Field label="Display name" optional>
        <Input />
      </Field>,
    );
    expect(
      screen.getByRole("textbox", { name: "Display name (optional)" }),
    ).toBeInTheDocument();
  });
});

const ACTIONS: ComboOption[] = [
  { value: "admin.tokens.issue", label: "admin.tokens.issue" },
  { value: "tokens.issue", label: "tokens.issue" },
  { value: "tokens.list", label: "tokens.list" },
  { value: "tokens.revoke", label: "tokens.revoke", disabled: true },
  { value: "tokens.rotate", label: "tokens.rotate" },
];

function Single({
  onChange,
  ...rest
}: {
  onChange: (v: string | null) => void;
  allowCustom?: boolean;
  commitOnBlur?: boolean;
  initial?: string | null;
  customOptionLabel?: (t: string) => string;
}) {
  const [v, setV] = useState<string | null>(rest.initial ?? null);
  return (
    <>
      <Combobox
        aria-label="Action"
        value={v}
        onChange={(x) => {
          setV(x);
          onChange(x);
        }}
        options={ACTIONS}
        allowCustom={rest.allowCustom}
        commitOnBlur={rest.commitOnBlur}
        customOptionLabel={rest.customOptionLabel}
      />
      <button>next</button>
    </>
  );
}

describe("Combobox selection rules", () => {
  it("Enter prefers an exact label/value match over the first partial match", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Single onChange={onChange} />);
    await user.click(screen.getByRole("combobox", { name: "Action" }));
    await user.keyboard("tokens.issue{Enter}");
    expect(onChange).toHaveBeenLastCalledWith("tokens.issue");
  });

  it("without an exact match Enter takes the first match; arrows move from there", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Single onChange={onChange} />);
    const input = screen.getByRole("combobox", { name: "Action" });
    await user.click(input);
    await user.keyboard("tokens");
    expect(input.getAttribute("aria-activedescendant")).toBe(
      screen.getByRole("option", { name: "admin.tokens.issue" }).id,
    );
    await user.keyboard("{ArrowDown}{Enter}");
    expect(onChange).toHaveBeenLastCalledWith("tokens.issue");
  });

  it("Home/End/PageUp/PageDown move the highlight while open, skipping disabled options", async () => {
    const user = userEvent.setup();
    render(<Single onChange={() => {}} />);
    const input = screen.getByRole("combobox", { name: "Action" });
    await user.click(input);
    const active = () =>
      document.getElementById(input.getAttribute("aria-activedescendant") ?? "")
        ?.textContent;
    await user.keyboard("{End}");
    expect(active()).toBe("tokens.rotate");
    await user.keyboard("{Home}");
    expect(active()).toBe("admin.tokens.issue");
    await user.keyboard("{PageDown}");
    expect(active()).toBe("tokens.rotate");
    await user.keyboard("{PageUp}");
    expect(active()).toBe("admin.tokens.issue");
  });

  it("with allowCustom the typed text is the first option; the wording is configurable", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Single
        onChange={onChange}
        allowCustom
        customOptionLabel={(t) => `Filter by “${t}”`}
      />,
    );
    await user.click(screen.getByRole("combobox", { name: "Action" }));
    await user.keyboard("tok");
    const options = screen.getAllByRole("option");
    expect(options[0]).toHaveTextContent("Filter by “tok”");
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenLastCalledWith("tok");
  });

  it("commitOnBlur keeps typed text on Tab (as typed), clears when erased", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Single onChange={onChange} allowCustom commitOnBlur />);
    const input = screen.getByRole("combobox", { name: "Action" });
    await user.click(input);
    await user.keyboard("deploy");
    await user.tab();
    expect(onChange).toHaveBeenLastCalledWith("deploy");
    expect(input).toHaveValue("deploy");
    await user.click(input);
    // With allowCustom, text is committed as typed (never re-cased).
    await user.keyboard("{Control>}a{/Control}TOKENS.LIST");
    await user.tab();
    expect(onChange).toHaveBeenLastCalledWith("TOKENS.LIST");
    await user.click(input);
    await user.keyboard("{Control>}a{/Control}{Backspace}");
    await user.tab();
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it("without commitOnBlur a single combobox discards typed text on blur", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Single onChange={onChange} initial="tokens.list" />);
    const input = screen.getByRole("combobox", { name: "Action" });
    await user.click(input);
    await user.keyboard("zzz");
    await user.tab();
    expect(onChange).not.toHaveBeenCalled();
    expect(input).toHaveValue("tokens.list");
  });
});

describe("sidebar icon tones", () => {
  it("SidebarItem and SidebarCheck colour their icons", () => {
    const { container } = render(
      <>
        <SidebarItem
          label="Denied"
          icon="ban"
          iconTone="danger"
          onClick={() => {}}
        />
        <SidebarCheck
          label="Allowed"
          icon="shield-check"
          iconTone="success"
          checked
          onChange={() => {}}
        />
      </>,
    );
    const icons = container.querySelectorAll(".wb-side-icon");
    expect(icons[0]).toHaveClass("wb-tone-danger");
    expect(icons[1]).toHaveClass("wb-tone-success");
  });
});
