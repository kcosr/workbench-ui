import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { RangeSlider } from "../src";

function Controlled() {
  const [value, setValue] = useState<[number, number]>([1, 5]);
  return (
    <RangeSlider
      label="Capacity"
      min={0}
      max={6}
      value={value}
      onChange={setValue}
    />
  );
}

describe("RangeSlider", () => {
  it("names the group and endpoints with visible labels and formatted value text", () => {
    render(
      <RangeSlider
        label="Capacity"
        min={0}
        max={6}
        value={[1, 6]}
        onChange={() => {}}
        minLabel="From"
        maxLabel="To"
        formatValue={(value) =>
          value === 6 ? "No upper limit" : `${value * 50} units`
        }
      />,
    );
    expect(screen.getByRole("group", { name: "Capacity" })).toBeInTheDocument();
    const lower = screen.getByRole("slider", { name: "From" });
    const upper = screen.getByRole("slider", { name: "To" });
    expect(lower).toHaveValue("1");
    expect(lower).toHaveAttribute("aria-valuetext", "50 units");
    expect(upper).toHaveAttribute("aria-valuetext", "No upper limit");
    expect(screen.getByText("50 units")).toBeVisible();
    expect(screen.getByText("No upper limit")).toBeVisible();
    expect(lower).toHaveAttribute("max", "5");
    expect(upper).toHaveAttribute("min", "2");
  });

  it("keeps controlled values until the caller accepts an edit or changes the range", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <RangeSlider
        label="Capacity"
        min={0}
        max={6}
        value={[1, 5]}
        onChange={onChange}
      />,
    );
    const lower = screen.getByRole("slider", { name: "Minimum" });
    fireEvent.change(lower, { target: { value: "3" } });
    expect(onChange).toHaveBeenCalledWith([3, 5]);
    expect(lower).toHaveValue("1");
    rerender(
      <RangeSlider
        label="Capacity"
        min={0}
        max={6}
        value={[3, 6]}
        onChange={onChange}
      />,
    );
    expect(lower).toHaveValue("3");
    expect(screen.getByRole("slider", { name: "Maximum" })).toHaveValue("6");
  });

  it("uses changing native limits to keep endpoints separated", () => {
    render(<Controlled />);
    const lower = screen.getByRole("slider", { name: "Minimum" });
    const upper = screen.getByRole("slider", { name: "Maximum" });
    fireEvent.change(lower, { target: { value: "6" } });
    expect(lower).toHaveValue("4");
    expect(upper).toHaveAttribute("min", "5");
    fireEvent.change(upper, { target: { value: "0" } });
    expect(upper).toHaveValue("5");
    fireEvent.change(lower, { target: { value: "0" } });
    fireEvent.change(upper, { target: { value: "2" } });
    expect(lower).toHaveAttribute("max", "1");
    expect(upper).toHaveValue("2");
  });

  it("supports nonzero bounds and steps greater than one", () => {
    const onChange = vi.fn();
    render(
      <RangeSlider
        label="Window"
        min={10}
        max={30}
        step={5}
        value={[15, 25]}
        onChange={onChange}
      />,
    );
    const lower = screen.getByRole("slider", { name: "Minimum" });
    const upper = screen.getByRole("slider", { name: "Maximum" });
    expect(lower).toHaveAttribute("min", "10");
    expect(lower).toHaveAttribute("max", "20");
    expect(lower).toHaveAttribute("step", "5");
    expect(upper).toHaveAttribute("min", "20");
    fireEvent.change(upper, { target: { value: "30" } });
    expect(onChange).toHaveBeenCalledWith([15, 30]);
  });

  it("keeps decimal steps on the grid without floating-point bounds tails", () => {
    const onChange = vi.fn();
    render(
      <RangeSlider
        label="Ratio"
        min={0}
        max={1}
        step={0.1}
        value={[0.2, 0.3]}
        onChange={onChange}
      />,
    );
    expect(screen.getByRole("slider", { name: "Minimum" })).toHaveAttribute(
      "max",
      "0.2",
    );
    expect(screen.getByRole("slider", { name: "Maximum" })).toHaveAttribute(
      "min",
      "0.3",
    );
    fireEvent.change(screen.getByRole("slider", { name: "Minimum" }), {
      target: { value: "0.1" },
    });
    expect(onChange).toHaveBeenCalledWith([0.1, 0.3]);
  });

  it("keeps separate tab stops and skips disabled endpoints", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <>
        <Controlled />
        <button>After</button>
      </>,
    );
    await user.tab();
    expect(screen.getByRole("slider", { name: "Minimum" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("slider", { name: "Maximum" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "After" })).toHaveFocus();
    const onChange = vi.fn();
    rerender(
      <>
        <RangeSlider
          label="Capacity"
          min={0}
          max={6}
          value={[1, 5]}
          onChange={onChange}
          disabled
        />
        <button>After</button>
      </>,
    );
    for (const slider of screen.getAllByRole("slider"))
      expect(slider).toBeDisabled();
    fireEvent.change(screen.getByRole("slider", { name: "Minimum" }), {
      target: { value: "3" },
    });
    expect(onChange).not.toHaveBeenCalled();
    await user.tab();
    await user.tab();
    expect(screen.getByRole("button", { name: "After" })).toHaveFocus();
  });

  it.each([
    { min: 0, max: 6, step: 2, value: [1, 5] as const },
    { min: 0, max: 6, step: 0, value: [1, 5] as const },
    { min: 0, max: 6, step: 1, value: [3, 3] as const },
    { min: 0, max: 6, step: 1, value: [-1, 5] as const },
    { min: 0, max: 6, step: 1, value: [1, 7] as const },
    { min: 0, max: 6, step: 1, value: [1, Number.NaN] as const },
  ])("rejects invalid controlled bounds: %j", (props) => {
    expect(() =>
      render(<RangeSlider {...props} label="Capacity" onChange={() => {}} />),
    ).toThrow(RangeError);
  });
});
