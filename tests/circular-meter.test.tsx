import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CircularMeter } from "../src";

describe("CircularMeter", () => {
  it("exposes a named value and draws its proportion from the top", () => {
    const { container } = render(
      <CircularMeter
        value={40}
        max={200}
        aria-label="Quota used"
        valueText="40 of 200 items"
      />,
    );
    const meter = screen.getByRole("meter", { name: "Quota used" });
    expect(meter).toHaveAttribute("aria-valuemin", "0");
    expect(meter).toHaveAttribute("aria-valuemax", "200");
    expect(meter).toHaveAttribute("aria-valuenow", "40");
    expect(meter).toHaveAttribute("aria-valuetext", "40 of 200 items");
    const arc = container.querySelector(".wb-circular-meter-value");
    expect(arc).toHaveAttribute("stroke-dasharray", "20 100");
    expect(arc).toHaveAttribute("transform", "rotate(-90 12 12)");
  });

  it.each([-50, 150])(
    "bounds an out-of-range value %s for both the arc and meter",
    (value) => {
      const { container } = render(
        <CircularMeter value={value} aria-label="Capacity used" />,
      );
      expect(screen.getByRole("meter")).toHaveAttribute(
        "aria-valuenow",
        value < 0 ? "0" : "100",
      );
      expect(screen.getByRole("meter")).toHaveAttribute(
        "aria-valuetext",
        value < 0 ? "0%" : "100%",
      );
      const arc = container.querySelector(".wb-circular-meter-value");
      if (value < 0) expect(arc).toBeNull();
      else expect(arc).toHaveAttribute("stroke-dasharray", "100 100");
    },
  );

  it("defaults the value text to the percentage of its maximum", () => {
    render(<CircularMeter value={40} max={200} aria-label="Quota used" />);
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuetext", "20%");
  });

  it.each([
    { value: null, max: 100 },
    { value: Number.NaN, max: 100 },
    { value: Number.POSITIVE_INFINITY, max: 100 },
    { value: 20, max: 0 },
    { value: 20, max: -1 },
    { value: 20, max: Number.POSITIVE_INFINITY },
  ])(
    "does not present unknown or invalid measurements as zero: %j",
    ({ value, max }) => {
      const { container } = render(
        <CircularMeter value={value} max={max} aria-label="Capacity used" />,
      );
      expect(screen.queryByRole("meter")).not.toBeInTheDocument();
      const unknown = screen.getByRole("img", {
        name: "Capacity used: Value unknown",
      });
      expect(unknown).toHaveClass("is-unknown");
      expect(unknown).not.toHaveAttribute("aria-valuenow");
      expect(container.querySelector(".wb-circular-meter-value")).toBeNull();
    },
  );

  it("announces unknown even when a caller supplies stale value text", () => {
    render(
      <CircularMeter
        value={null}
        valueText="0 of 100 items"
        aria-label="Quota used"
      />,
    );
    expect(
      screen.getByRole("img", { name: "Quota used: Value unknown" }),
    ).not.toHaveAttribute("aria-valuetext");
  });

  it("can be decorative within a separately labelled control", () => {
    render(
      <button aria-label="Quota details">
        <CircularMeter value={75} tone="warning" decorative />
      </button>,
    );
    const graphic = screen
      .getByRole("button", { name: "Quota details" })
      .querySelector("svg");
    expect(graphic).toHaveClass("wb-tone-warning");
    expect(graphic).toHaveAttribute("aria-hidden", "true");
    expect(graphic).not.toHaveAttribute("role");
    expect(graphic).not.toHaveAttribute("aria-valuenow");
    expect(graphic).not.toHaveAttribute("aria-label");
  });
});
