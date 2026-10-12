import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MediaFrame } from "../src/components/MediaFrame";

describe("MediaFrame", () => {
  it("names media from its visible title and describes it with metadata", () => {
    render(
      <MediaFrame title="Example diagram" metadata="Revision 2">
        <img alt="Flow from start to finish" />
      </MediaFrame>,
    );
    const frame = screen.getByRole("group", { name: "Example diagram" });
    expect(frame).toHaveAccessibleDescription("Revision 2");
    expect(frame).toContainElement(screen.getByRole("img"));
  });

  it("leaves app controls interactive and does not turn the body into a button", async () => {
    const onExpand = vi.fn();
    const user = userEvent.setup();
    render(
      <MediaFrame actions={<button onClick={onExpand}>Expand</button>}>
        <button>Interact with content</button>
      </MediaFrame>,
    );
    await user.click(screen.getByRole("button", { name: "Expand" }));
    expect(onExpand).toHaveBeenCalledOnce();
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });

  it("omits an empty header and supports app-owned labels and body classes", () => {
    const { container } = render(
      <MediaFrame
        title={false}
        metadata={null}
        aria-label="Photo"
        className="photo-frame"
        bodyClassName="photo-body"
      >
        <img alt="Mountains" />
      </MediaFrame>,
    );
    expect(container.querySelector(".wb-media-frame-header")).toBeNull();
    expect(container.querySelector(".photo-frame")).toHaveAttribute(
      "aria-label",
      "Photo",
    );
    expect(container.querySelector(".photo-body")).toContainElement(
      screen.getByRole("img"),
    );
  });
});
