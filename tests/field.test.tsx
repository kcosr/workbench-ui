import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Field, Input } from "../src";

describe("Field", () => {
  it("describes the control with the hint, the focus hint and the error", () => {
    render(
      <Field
        label="Phrase"
        hint="Stops all jobs."
        focusHint="Queued runs are cancelled."
        error="Must not be empty"
      >
        <Input />
      </Field>,
    );
    const input = screen.getByRole("textbox", { name: "Phrase" });
    expect(input).toHaveAccessibleDescription(
      "Must not be empty Stops all jobs. Queued runs are cancelled.",
    );
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Queued runs are cancelled.")).toHaveClass(
      "wb-field-hint",
      "wb-field-focus-hint",
    );
  });

  it("passes other props to its root element", () => {
    const onBlur = vi.fn();
    const { container } = render(
      <Field label="Name" data-path="trigger.word" onBlur={onBlur}>
        <Input />
      </Field>,
    );
    const root = container.querySelector(".wb-field")!;
    expect(root).toHaveAttribute("data-path", "trigger.word");
    fireEvent.blur(screen.getByRole("textbox", { name: "Name" }));
    expect(onBlur).toHaveBeenCalledTimes(1);
  });
});
