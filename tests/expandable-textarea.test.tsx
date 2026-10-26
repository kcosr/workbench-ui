import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ExpandableTextarea, Field } from "../src";

describe("ExpandableTextarea", () => {
  function Example({ onSubmit = () => {} }: { onSubmit?: () => void }) {
    const [value, setValue] = useState("Initial instructions");
    return (
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <Field label="Instructions" error="Required guidance is missing.">
          <ExpandableTextarea
            label="Instructions"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            rows={13}
            expandedHint="Describe the task."
            error="Required guidance is missing."
            footerNote="Save the form to keep your edits."
          />
        </Field>
      </form>
    );
  }

  it("shares edits, shows help and errors, and restores focus on Done and Escape", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Example onSubmit={onSubmit} />);
    const inline = screen.getByRole("textbox", { name: "Instructions" });
    const expand = screen.getByRole("button", { name: "Expand Instructions" });
    expect(inline).toHaveAttribute("rows", "13");
    (inline as HTMLTextAreaElement).setSelectionRange(2, 7);
    await user.click(expand);
    const dialog = screen.getByRole("dialog", { name: "Instructions" });
    const enlarged = within(dialog).getByRole("textbox", {
      name: "Instructions",
    });
    expect(enlarged).toHaveFocus();
    expect((enlarged as HTMLTextAreaElement).selectionStart).toBe(2);
    expect((enlarged as HTMLTextAreaElement).selectionEnd).toBe(7);
    expect(enlarged).toHaveAttribute("aria-invalid", "true");
    expect(enlarged).toHaveAccessibleDescription(
      "Required guidance is missing. Describe the task.",
    );
    expect(enlarged.id).not.toBe(inline.id);
    await user.clear(enlarged);
    await user.type(enlarged, "Updated instructions");
    (enlarged as HTMLTextAreaElement).setSelectionRange(3, 10);
    expect(inline).toHaveValue("Updated instructions");
    await user.click(within(dialog).getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(expand).toHaveFocus();
    expect((inline as HTMLTextAreaElement).selectionStart).toBe(3);
    expect((inline as HTMLTextAreaElement).selectionEnd).toBe(10);
    expect(onSubmit).not.toHaveBeenCalled();
    await user.click(expand);
    expect(within(screen.getByRole("dialog")).getByRole("textbox")).toHaveValue(
      "Updated instructions",
    );
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(expand).toHaveFocus();
    expect(inline).toHaveValue("Updated instructions");
  });

  it("keeps disabled editors disabled", () => {
    render(<ExpandableTextarea label="Instructions" value="" disabled />);
    expect(screen.getByRole("textbox")).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Expand Instructions" }),
    ).toBeDisabled();
  });
});

describe("expanded editor size", () => {
  const styles = resolve(__dirname, "..", "src", "styles");
  const editorCss = readFileSync(
    resolve(styles, "expandable-textarea.css"),
    "utf8",
  ).replace(/\/\*[\s\S]*?\*\//g, "");

  it("outranks the modal's own sizes, whatever order the stylesheets load in", () => {
    // Rules that size the dialog box (the modal sets top, width and
    // max-height with one class; a size variant adds another).
    const sizing = [...editorCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter((m) =>
        /(^|[\s;])(top|width|height|max-height|inset):/.test(m[2] ?? ""),
      )
      .map((m) => (m[1] ?? "").trim());
    expect(sizing).toEqual([
      ".wb-modal.wb-textarea-editor",
      ".wb-modal.wb-textarea-editor",
    ]);
  });

  it("is imported after the modal styles", () => {
    const index = readFileSync(resolve(styles, "index.css"), "utf8");
    expect(index.indexOf('"./expandable-textarea.css"')).toBeGreaterThan(
      index.indexOf('"./overlays.css"'),
    );
  });
});
