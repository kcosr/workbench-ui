import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { describe, expect, it } from "vitest";
import { ContextPanel } from "../src";

function Example({ inline }: { inline: boolean }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={trigger}
        onClick={() => setOpen(true)}
        aria-controls="context"
      >
        Context
      </button>
      <button>Page action</button>
      <ContextPanel
        id="context"
        title="Details"
        inline={inline}
        open={open}
        onClose={() => {
          setOpen(false);
          if (inline) trigger.current?.focus();
        }}
        footer="Additional information"
      >
        <p>Current selection</p>
        <button>Panel action</button>
      </ContextPanel>
    </>
  );
}

describe("ContextPanel", () => {
  it("keeps inline context passive and leaves the page usable", async () => {
    const user = userEvent.setup();
    render(<Example inline />);
    const trigger = screen.getByRole("button", { name: "Context" });
    await user.click(trigger);
    expect(trigger).toHaveFocus();
    const panel = screen.getByRole("complementary", { name: "Details" });
    expect(panel).toHaveAttribute("id", "context");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("Additional information")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Page action" }));
    expect(panel).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("traps overlay focus, closes on Escape and restores its trigger", async () => {
    const user = userEvent.setup();
    render(<Example inline={false} />);
    const trigger = screen.getByRole("button", { name: "Context" });
    await user.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Details" });
    expect(dialog).toHaveAttribute("id", "context");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    const close = screen.getByRole("button", { name: "Close" });
    await waitFor(() => expect(close).toHaveFocus());
    await user.tab();
    expect(screen.getByRole("button", { name: "Panel action" })).toHaveFocus();
    await user.tab();
    expect(close).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("renders nothing while closed in either layout", () => {
    const { rerender } = render(
      <ContextPanel title="Details" inline open={false} onClose={() => {}} />,
    );
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    rerender(
      <ContextPanel
        title="Details"
        inline={false}
        open={false}
        onClose={() => {}}
      />,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
