import { useLayoutEffect } from "react";
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OverlayScope, useLayer, useLayerHandle } from "../src";
import type { LayerHandle } from "../src";

describe("layer activity handles", () => {
  it("shares nesting and Escape ownership with kit layers and reads live activity through a stable callback", () => {
    let handle: LayerHandle | undefined;
    const parentClose = vi.fn();
    const childClose = vi.fn();
    function Child() {
      useLayer(true, childClose);
      return null;
    }
    function Host({
      active = true,
      child = false,
    }: {
      active?: boolean;
      child?: boolean;
    }) {
      const layer = useLayerHandle(active, parentClose, false);
      useLayoutEffect(() => {
        handle = layer;
      });
      return (
        <OverlayScope layers={layer.scope}>{child && <Child />}</OverlayScope>
      );
    }
    const view = render(<Host />);
    const isTop = handle!.isTop;
    expect(isTop()).toBe(true);
    view.rerender(<Host child />);
    expect(handle!.isTop).toBe(isTop);
    expect(isTop()).toBe(false);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(childClose).toHaveBeenCalledOnce();
    expect(parentClose).not.toHaveBeenCalled();
    view.rerender(<Host />);
    expect(isTop()).toBe(true);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(parentClose).toHaveBeenCalledOnce();
    view.rerender(<Host active={false} />);
    expect(isTop()).toBe(false);
    view.unmount();
    expect(isTop()).toBe(false);
  });
});
