import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Combobox } from "../src";
import type { ComboOption } from "../src";

const MODELS: ComboOption[] = [{ value: "ModelA", label: "ModelA" }];

function Multi({
  onChange,
  allowCustom,
  options = MODELS,
}: {
  onChange: (v: string[]) => void;
  allowCustom?: boolean;
  options?: ComboOption[];
}) {
  const [v, setV] = useState<string[]>([]);
  return (
    <>
      <Combobox
        multiple
        aria-label="Models"
        value={v}
        onChange={(x) => {
          setV(x);
          onChange(x);
        }}
        options={options}
        allowCustom={allowCustom}
        commitOnBlur
      />
      <button>after</button>
    </>
  );
}

function Single({
  onChange,
  allowCustom,
  matchCase,
  options = MODELS,
}: {
  onChange: (v: string | null) => void;
  allowCustom?: boolean;
  matchCase?: boolean;
  options?: ComboOption[];
}) {
  const [v, setV] = useState<string | null>(null);
  return (
    <>
      <Combobox
        aria-label="Model"
        value={v}
        onChange={(x) => {
          setV(x);
          onChange(x);
        }}
        options={options}
        allowCustom={allowCustom}
        matchCase={matchCase}
        commitOnBlur
      />
      <button>after</button>
    </>
  );
}

describe("allowCustom: typed text is committed as typed (case-sensitive exact matching)", () => {
  it("multiple, Enter: offers the free text first and commits it unchanged", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Multi onChange={onChange} allowCustom />);
    await user.click(screen.getByRole("combobox", { name: "Models" }));
    await user.keyboard("modela");
    const options = screen.getAllByRole("option");
    expect(options[0]).toHaveTextContent("Add “modela”");
    expect(options[1]).toHaveTextContent("ModelA");
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenLastCalledWith(["modela"]);
  });

  it("multiple, Tab: commits the text unchanged", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Multi onChange={onChange} allowCustom />);
    await user.click(screen.getByRole("combobox", { name: "Models" }));
    await user.keyboard("modela");
    await user.tab();
    expect(onChange).toHaveBeenLastCalledWith(["modela"]);
  });

  it("single, Enter and blur: commit the text unchanged; an exact-case match picks the option", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Single onChange={onChange} allowCustom />);
    const input = screen.getByRole("combobox", { name: "Model" });
    await user.click(input);
    await user.keyboard("modela{Enter}");
    expect(onChange).toHaveBeenLastCalledWith("modela");
    await user.click(input);
    await user.keyboard("{Control>}a{/Control}MODELA");
    await user.tab();
    expect(onChange).toHaveBeenLastCalledWith("MODELA");
    await user.click(input);
    await user.keyboard("{Control>}a{/Control}ModelA");
    expect(screen.queryByRole("option", { name: /Add/ })).toBeNull();
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenLastCalledWith("ModelA");
  });

  it("never swaps in a different option when the typed text is already selected", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Multi onChange={onChange} allowCustom />);
    const input = screen.getByRole("combobox", { name: "Models" });
    await user.click(input);
    await user.keyboard("modela{Enter}");
    expect(onChange).toHaveBeenLastCalledWith(["modela"]);
    await user.keyboard("modela{Enter}");
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe("pick-from-list (no allowCustom)", () => {
  it("single, Enter and blur: a unique case-insensitive match commits the canonical option", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Single onChange={onChange} />);
    const input = screen.getByRole("combobox", { name: "Model" });
    await user.click(input);
    await user.keyboard("modela{Enter}");
    expect(onChange).toHaveBeenLastCalledWith("ModelA");
    await user.click(input);
    await user.keyboard("{Control>}a{/Control}{Backspace}MODELA");
    await user.tab();
    expect(onChange).toHaveBeenLastCalledWith("ModelA");
  });

  it("multiple, blur: commits the canonical option", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Multi onChange={onChange} />);
    await user.click(screen.getByRole("combobox", { name: "Models" }));
    await user.keyboard("modela");
    await user.tab();
    expect(onChange).toHaveBeenLastCalledWith(["ModelA"]);
  });

  it("an ambiguous case-insensitive match is not committed on blur", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Single
        onChange={onChange}
        options={[
          { value: "Foo", label: "Foo" },
          { value: "foo", label: "foo" },
        ]}
      />,
    );
    await user.click(screen.getByRole("combobox", { name: "Model" }));
    await user.keyboard("FOO");
    await user.tab();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("matchCase makes filtering and matching case-sensitive", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Single onChange={onChange} matchCase />);
    await user.click(screen.getByRole("combobox", { name: "Model" }));
    await user.keyboard("modela");
    expect(screen.queryByRole("option")).toBeNull();
    await user.keyboard("{Enter}");
    await user.tab();
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("matchCase: only an exact option is highlighted by default", () => {
  it("a keyword or prefix match needs explicit navigation", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Single
        onChange={onChange}
        matchCase
        options={[{ value: "ModelA", label: "ModelA", keywords: ["modela"] }]}
      />,
    );
    const input = screen.getByRole("combobox", { name: "Model" });
    await user.click(input);
    await user.keyboard("modela");
    expect(screen.getByRole("option", { name: "ModelA" })).toBeInTheDocument();
    expect(input).not.toHaveAttribute("aria-activedescendant");
    await user.keyboard("{Enter}");
    expect(onChange).not.toHaveBeenCalled();
    await user.keyboard("{ArrowDown}{Enter}");
    expect(onChange).toHaveBeenLastCalledWith("ModelA");
  });

  it("a prefix match is not committed by Enter either", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Single onChange={onChange} matchCase />);
    await user.click(screen.getByRole("combobox", { name: "Model" }));
    await user.keyboard("Mod{Enter}");
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("arrow keys from no highlight", () => {
  it("↑ starts at the last enabled option, ↓ at the first", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const options: ComboOption[] = [
      { value: "ModelA", label: "ModelA" },
      { value: "ModelB", label: "ModelB" },
      { value: "ModelC", label: "ModelC" },
      { value: "ModelD", label: "ModelD", disabled: true },
    ];
    render(<Single onChange={onChange} matchCase options={options} />);
    const input = screen.getByRole("combobox", { name: "Model" });
    await user.click(input);
    await user.keyboard("Mod");
    expect(input).not.toHaveAttribute("aria-activedescendant");
    await user.keyboard("{ArrowUp}{Enter}");
    expect(onChange).toHaveBeenLastCalledWith("ModelC");
    await user.click(input);
    await user.keyboard("{Control>}a{/Control}Mod{ArrowDown}{Enter}");
    expect(onChange).toHaveBeenLastCalledWith("ModelA");
  });
});
