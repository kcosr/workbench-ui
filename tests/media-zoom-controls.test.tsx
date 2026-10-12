import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MediaFrame, MediaZoomControls } from "../src";

const props = () => ({
  label: "Example preview zoom",
  zoomPercent: 75,
  canZoomOut: true,
  canZoomIn: true,
  onZoomOut: vi.fn(),
  onZoomIn: vi.fn(),
  onFit: vi.fn(),
  onActualSize: vi.fn(),
});

describe("MediaZoomControls", () => {
  it("renders a named floating control group without adding a frame header", () => {
    const { container } = render(
      <MediaFrame>
        <img alt="Example" />
        <MediaZoomControls {...props()} className="example-controls" />
      </MediaFrame>,
    );
    const controls = screen.getByRole("group", {
      name: "Example preview zoom",
    });
    expect(controls).toHaveClass("wb-media-zoom", "example-controls");
    expect(
      within(controls)
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label")),
    ).toEqual(["Zoom out", "Zoom in", "Fit to view", "Actual size (100%)"]);
    expect(
      within(controls).getByLabelText("Zoom percentage"),
    ).toHaveTextContent("75%");
    expect(
      within(controls).getByRole("button", { name: "Actual size (100%)" }),
    ).toHaveTextContent("1:1");
    expect(
      within(controls)
        .getByRole("button", { name: "Fit to view" })
        .querySelector("svg"),
    ).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector(".wb-media-frame-header")).toBeNull();
    expect(container.querySelector("[style]")).toBeNull();
  });

  it("delegates every zoom action and preserves disabled bounds", async () => {
    const callbacks = props();
    const user = userEvent.setup();
    const { rerender } = render(<MediaZoomControls {...callbacks} />);
    for (const name of [
      "Zoom out",
      "Zoom in",
      "Fit to view",
      "Actual size (100%)",
    ]) {
      await user.click(screen.getByRole("button", { name }));
    }
    for (const callback of [
      callbacks.onZoomOut,
      callbacks.onZoomIn,
      callbacks.onFit,
      callbacks.onActualSize,
    ])
      expect(callback).toHaveBeenCalledOnce();
    rerender(
      <MediaZoomControls
        {...callbacks}
        canZoomOut={false}
        canZoomIn={false}
        zoomPercent={123.45}
      />,
    );
    expect(screen.getByLabelText("Zoom percentage")).toHaveTextContent("123%");
    await user.click(screen.getByRole("button", { name: "Zoom out" }));
    await user.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(callbacks.onZoomOut).toHaveBeenCalledOnce();
    expect(callbacks.onZoomIn).toHaveBeenCalledOnce();
  });

  it("offers optional presets and restores percentage focus after choosing", async () => {
    const onZoomToPercent = vi.fn();
    const user = userEvent.setup();
    render(
      <MediaZoomControls {...props()} onZoomToPercent={onZoomToPercent} />,
    );
    const percentage = screen.getByRole("button", {
      name: "Zoom percentage: 75%",
    });
    await user.click(percentage);
    expect(percentage).toHaveAttribute("aria-expanded", "true");
    const presets = screen.getByRole("group", { name: "Zoom presets" });
    expect(
      within(presets).getByRole("button", { name: "75%" }),
    ).toHaveAttribute("aria-pressed", "true");
    await user.click(within(presets).getByRole("button", { name: "150%" }));
    expect(onZoomToPercent).toHaveBeenCalledWith(150);
    expect(screen.queryByRole("group", { name: "Zoom presets" })).toBeNull();
    expect(percentage).toHaveFocus();
  });

  it("closes presets on Escape, outside pointer interaction and focus leaving the controls", async () => {
    const user = userEvent.setup();
    render(
      <>
        <MediaZoomControls {...props()} onZoomToPercent={vi.fn()} />
        <button>Outside</button>
      </>,
    );
    const percentage = screen.getByRole("button", {
      name: "Zoom percentage: 75%",
    });
    await user.click(percentage);
    await user.tab();
    await user.keyboard("{Escape}");
    expect(percentage).toHaveFocus();
    expect(screen.queryByRole("group", { name: "Zoom presets" })).toBeNull();
    await user.click(percentage);
    await user.click(screen.getByRole("button", { name: "Outside" }));
    expect(screen.queryByRole("group", { name: "Zoom presets" })).toBeNull();
    await user.click(percentage);
    act(() => screen.getByRole("button", { name: "Outside" }).focus());
    expect(screen.queryByRole("group", { name: "Zoom presets" })).toBeNull();
  });

  it("keeps floating layout and all visible theming in the standalone media stylesheet", () => {
    const css = readFileSync(
      resolve(__dirname, "../src/styles/media-frame.css"),
      "utf8",
    );
    const root = css.match(/\.wb-media-zoom\s*\{([^}]+)\}/)?.[1];
    expect(root).toContain("position: absolute");
    expect(root).toContain("left: 50%");
    expect(root).toContain("bottom: var(--wb-media-controls-offset");
    expect(root).toContain("width: max-content");
    for (const token of [
      "--wb-media-controls-background",
      "--wb-media-controls-hover-background",
      "--wb-media-color",
      "--wb-media-border",
      "--wb-media-focus",
    ])
      expect(css).toContain(token);
    expect(css).not.toContain("@import");
  });
});
