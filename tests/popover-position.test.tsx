import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { expect, it, vi } from "vitest";
import { Popover } from "../src";

it("sizes to a separate layout anchor while preserving trigger focus and dismissal", async () => {
  const user = userEvent.setup();
  function Example() {
    const trigger = useRef<HTMLButtonElement>(null);
    const container = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);
    return (
      <div ref={container} data-testid="container">
        <button ref={trigger} onClick={() => setOpen(true)}>
          Choose
        </button>
        <button>Next action</button>
        <Popover
          open={open}
          onClose={() => setOpen(false)}
          anchorRef={trigger}
          positionRef={container}
          matchWidth
          label="Choices"
        >
          <input aria-label="Search choices" />
        </Popover>
      </div>
    );
  }
  render(<Example />);
  let width = 560;
  vi.spyOn(
    screen.getByTestId("container"),
    "getBoundingClientRect",
  ).mockImplementation(() => ({
    x: 100,
    y: 100,
    left: 100,
    right: 100 + width,
    top: 100,
    bottom: 140,
    width,
    height: 40,
    toJSON() {},
  }));
  const trigger = screen.getByRole("button", { name: "Choose" });
  await user.click(trigger);
  const popover = screen.getByRole("dialog", { name: "Choices" });
  expect(popover).toHaveStyle({ width: "560px", left: "100px", top: "146px" });
  expect(screen.getByRole("textbox")).toHaveFocus();
  width = 320;
  fireEvent(window, new Event("resize"));
  expect(popover).toHaveStyle({ width: "320px" });
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
  await user.click(trigger);
  await user.tab();
  expect(screen.getByRole("button", { name: "Next action" })).toHaveFocus();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  await user.click(trigger);
  await user.click(screen.getByRole("button", { name: "Next action" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
