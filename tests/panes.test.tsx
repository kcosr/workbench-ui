import { createRef, useRef, useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppShell, Drawer, fitPaneWidths, usePaneResize } from "../src";

function Host({
  enabled = true,
  limit = 900,
  paneKey = "one",
  preferred = 540,
}: {
  enabled?: boolean;
  limit?: number;
  paneKey?: string;
  preferred?: number;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const [saved, setSaved] = useState(preferred);
  const width = Math.min(saved, limit);
  const pane = usePaneResize(
    {
      label: "Details width",
      controls: "details",
      min: 380,
      max: 900,
      grow: -1,
      cssVar: "--detail-w",
    },
    frame,
    {
      enabled,
      preferred: saved,
      width,
      limit,
      save: setSaved,
      reset: () => setSaved(540),
    },
  );
  return (
    <div
      ref={frame}
      data-testid="frame"
      style={{ "--detail-w": `${width}px` } as React.CSSProperties}
    >
      <output data-testid="saved">{saved}</output>
      <output data-testid="dragging">{String(pane.dragging)}</output>
      <div key={paneKey} id="details">
        {enabled && pane.separator}
      </div>
    </div>
  );
}

function startDrag(el: HTMLElement, x = 700) {
  let captured = false;
  el.setPointerCapture = vi.fn(() => {
    captured = true;
  });
  el.hasPointerCapture = vi.fn(() => captured);
  el.releasePointerCapture = vi.fn(() => {
    captured = false;
  });
  fireEvent.pointerDown(el, {
    pointerId: 7,
    isPrimary: true,
    button: 0,
    clientX: x,
  });
}
function move(el: HTMLElement, x: number) {
  fireEvent.pointerMove(el, { pointerId: 7, isPrimary: true, clientX: x });
}
function shown() {
  return screen.getByTestId("frame").style.getPropertyValue("--detail-w");
}

describe("pane resize interaction", () => {
  it("commits captured leftward drawer drags, bounded by the available room", () => {
    render(<Host limit={620} />);
    const separator = screen.getByRole("separator");
    startDrag(separator);
    move(separator, 500);
    expect(shown()).toBe("620px");
    expect(separator).toHaveAttribute("aria-valuenow", "620");
    expect(screen.getByTestId("saved")).toHaveTextContent("540");
    fireEvent.pointerUp(separator, { pointerId: 7 });
    expect(screen.getByTestId("saved")).toHaveTextContent("620");
    expect(screen.getByTestId("dragging")).toHaveTextContent("false");
    expect(separator.releasePointerCapture).toHaveBeenCalledWith(7);
  });

  it("cancels with Escape without bubbling to a layer or persisting", () => {
    const onKeyDown = vi.fn();
    render(
      <div onKeyDown={onKeyDown}>
        <Host />
      </div>,
    );
    const separator = screen.getByRole("separator");
    startDrag(separator);
    move(separator, 650);
    expect(shown()).toBe("590px");
    fireEvent.keyDown(separator, { key: "Escape" });
    expect(shown()).toBe("540px");
    expect(screen.getByTestId("saved")).toHaveTextContent("540");
    expect(separator.releasePointerCapture).toHaveBeenCalledWith(7);
    expect(onKeyDown).not.toHaveBeenCalled();
  });

  it.each(["pointerCancel", "lostPointerCapture"] as const)(
    "restores the width on %s",
    (event) => {
      render(<Host />);
      const separator = screen.getByRole("separator");
      startDrag(separator);
      move(separator, 620);
      fireEvent[event](separator, { pointerId: 7 });
      expect(shown()).toBe("540px");
      expect(screen.getByTestId("saved")).toHaveTextContent("540");
      expect(screen.getByTestId("dragging")).toHaveTextContent("false");
    },
  );

  it("cancels when the details item replaces the separator mid-drag", () => {
    const view = render(<Host />);
    const separator = screen.getByRole("separator");
    startDrag(separator);
    move(separator, 600);
    view.rerender(<Host paneKey="two" />);
    expect(shown()).toBe("540px");
    expect(screen.getByTestId("saved")).toHaveTextContent("540");
    expect(screen.getByTestId("dragging")).toHaveTextContent("false");
  });

  it("cancels when the pane is disabled or its available space changes", () => {
    const view = render(<Host />);
    let separator = screen.getByRole("separator");
    startDrag(separator);
    move(separator, 550);
    view.rerender(<Host limit={500} />);
    expect(shown()).toBe("500px");
    expect(screen.getByTestId("dragging")).toHaveTextContent("false");
    separator = screen.getByRole("separator");
    startDrag(separator);
    move(separator, 750);
    view.rerender(<Host limit={500} enabled={false} />);
    expect(shown()).toBe("500px");
    expect(screen.getByTestId("dragging")).toHaveTextContent("false");
    expect(screen.getByTestId("saved")).toHaveTextContent("540");
  });

  it("uses the new width when removal and viewport fitting happen in one commit", () => {
    const view = render(<Host />);
    const separator = screen.getByRole("separator");
    startDrag(separator);
    move(separator, 600);
    view.rerender(<Host enabled={false} limit={480} />);
    expect(shown()).toBe("480px");
    expect(screen.getByTestId("saved")).toHaveTextContent("540");
    view.rerender(<Host limit={480} />);
    expect(screen.getByRole("separator")).toHaveAttribute(
      "aria-valuenow",
      "480",
    );
  });

  it("preserves an oversized preference for no-op drags and grow keys", () => {
    render(<Host preferred={800} limit={600} />);
    const separator = screen.getByRole("separator");
    startDrag(separator);
    move(separator, 650);
    fireEvent.pointerUp(separator, { pointerId: 7 });
    fireEvent.keyDown(separator, { key: "ArrowLeft" });
    fireEvent.keyDown(separator, { key: "End" });
    expect(screen.getByTestId("saved")).toHaveTextContent("800");
    fireEvent.keyDown(separator, { key: "ArrowRight", shiftKey: true });
    expect(screen.getByTestId("saved")).toHaveTextContent("560");
    fireEvent.keyDown(separator, { key: "Home" });
    expect(screen.getByTestId("saved")).toHaveTextContent("380");
    fireEvent.keyDown(separator, { key: "End" });
    expect(screen.getByTestId("saved")).toHaveTextContent("600");
    fireEvent.doubleClick(separator);
    expect(screen.getByTestId("saved")).toHaveTextContent("540");
  });
});

describe("pane width fitting", () => {
  it("yields sidebar space first and keeps 360px for the main pane when minima fit", () => {
    for (const windowWidth of [1024, 1200, 1440, 1920]) {
      const fit = fitPaneWidths({
        room: windowWidth - 360,
        sidebar: { min: 220, max: 480, preferred: 400, shown: true },
        drawer: { min: 380, max: 900, preferred: 700, shown: true },
      });
      expect(fit.side + fit.drawer).toBeLessThanOrEqual(windowWidth - 360);
      expect(fit.side).toBeGreaterThanOrEqual(220);
      expect(fit.drawer).toBeGreaterThanOrEqual(380);
    }
    expect(
      fitPaneWidths({
        room: 840,
        sidebar: { min: 220, max: 480, preferred: 400, shown: true },
        drawer: { min: 380, max: 900, preferred: 540, shown: true },
      }),
    ).toEqual({ side: 300, sideMax: 300, drawer: 540, drawerMax: 540 });
  });
});

describe("resizable AppShell drawer", () => {
  it("persists, restores and resets the drawer width without changing default fixed drawers", () => {
    const props = {
      topBar: null,
      drawer: <Drawer title="Details" onClose={() => {}} />,
      drawerResizable: true,
      drawerStorageKey: "test:drawer",
    };
    const view = render(<AppShell {...props} />);
    const separator = screen.getByRole("separator", {
      name: "Details panel width",
    });
    fireEvent.keyDown(separator, { key: "ArrowLeft", shiftKey: true });
    expect(localStorage.getItem("test:drawer")).toBe("580");
    view.unmount();
    const next = render(<AppShell {...props} />);
    expect(screen.getByRole("separator")).toHaveAttribute(
      "aria-valuenow",
      "580",
    );
    fireEvent.doubleClick(screen.getByRole("separator"));
    expect(screen.getByRole("separator")).toHaveAttribute(
      "aria-valuenow",
      "540",
    );
    expect(localStorage.getItem("test:drawer")).toBeNull();
    next.rerender(<AppShell topBar={null} drawer={props.drawer} />);
    expect(screen.queryByRole("separator")).toBeNull();
  });

  it.each(["separator", "outside"] as const)(
    "returns focus after resizing but preserves deliberate %s focus",
    async (focus) => {
      function Host() {
        const [open, setOpen] = useState(false);
        const opener = useRef<HTMLButtonElement>(null);
        return (
          <AppShell
            topBar={null}
            drawerResizable
            drawer={
              open ? (
                <Drawer
                  title="Details"
                  returnFocus={() => opener.current}
                  onClose={() => setOpen(false)}
                />
              ) : null
            }
          >
            <button ref={opener} onClick={() => setOpen(true)}>
              Open details
            </button>
            <button>Outside target</button>
          </AppShell>
        );
      }
      render(<Host />);
      const opener = screen.getByRole("button", { name: "Open details" });
      opener.focus();
      fireEvent.click(opener);
      const separator = screen.getByRole("separator", {
        name: "Details panel width",
      });
      startDrag(separator);
      move(separator, 650);
      fireEvent.pointerUp(separator, { pointerId: 7 });
      expect(separator).toHaveFocus();
      const outside = screen.getByRole("button", { name: "Outside target" });
      if (focus === "outside") outside.focus();
      fireEvent.keyDown(document.activeElement!, { key: "Escape" });
      expect(screen.queryByRole("complementary")).toBeNull();
      await new Promise((resolve) => requestAnimationFrame(resolve));
      expect(focus === "separator" ? opener : outside).toHaveFocus();
    },
  );

  it("exposes a drawer surface ref and id for application-owned focus behavior", () => {
    const ref = createRef<HTMLElement>();
    const view = render(
      <Drawer ref={ref} id="details" title="Details" onClose={() => {}} />,
    );
    expect(ref.current).toBe(screen.getByRole("complementary"));
    expect(ref.current).toHaveAttribute("id", "details");
    view.unmount();
    expect(ref.current).toBeNull();
  });
});
