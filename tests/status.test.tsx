import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HistoryStrip, Status, StatusGlyph, Steps } from "../src";
import type { HistoryItem, StatusTone } from "../src";

const TONES: StatusTone[] = [
  "ok",
  "failed",
  "running",
  "waiting",
  "skipped",
  "neutral",
];

describe("Status", () => {
  it.each(TONES)("%s: a decorative glyph and the word", (tone) => {
    const { container } = render(<Status tone={tone}>Word</Status>);
    const status = container.querySelector(".wb-status");
    expect(status).toHaveClass(`wb-status--${tone}`);
    const glyph = status?.querySelector("svg");
    expect(glyph).toHaveClass("wb-status-glyph", `wb-status-glyph--${tone}`);
    expect(glyph).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("Word")).toHaveClass("wb-status-label");
    expect(status).not.toHaveAttribute("title");
  });

  it("glyphOnly keeps the word for screen readers and as the tooltip", () => {
    const { container } = render(
      <Status tone="failed" glyphOnly>
        Failed
      </Status>,
    );
    expect(screen.getByText("Failed")).toHaveClass("wb-sr-only");
    expect(container.querySelector(".wb-status")).toHaveAttribute(
      "title",
      "Failed",
    );
  });

  it("an explicit title wins over the word", () => {
    const { container } = render(
      <Status tone="running" title="Started 14:02">
        Running · 1 min
      </Status>,
    );
    expect(container.querySelector(".wb-status")).toHaveAttribute(
      "title",
      "Started 14:02",
    );
  });

  it("draws a distinct glyph per tone", () => {
    const shapes = TONES.map((tone) => {
      const { container, unmount } = render(<StatusGlyph tone={tone} />);
      const html = container.querySelector("svg")?.innerHTML ?? "";
      unmount();
      return html;
    });
    expect(new Set(shapes).size).toBe(TONES.length);
  });
});

describe("HistoryStrip", () => {
  const items: HistoryItem[] = [
    { tone: "ok", label: "Succeeded · Oct 20" },
    { tone: "failed", label: "Failed · Oct 21" },
    { tone: "waiting", label: "Waiting · Oct 22" },
    { tone: "running", label: "Running · Oct 23" },
  ];

  it("is a named ordered list, oldest first, each bar labelled", () => {
    render(<HistoryStrip label="Last 4 runs" items={items} />);
    const list = screen.getByRole("list", { name: "Last 4 runs" });
    expect(list.tagName).toBe("OL");
    // explicit: Safari drops list semantics from unstyled lists
    expect(list).toHaveAttribute("role", "list");
    const bars = within(list).getAllByRole("listitem");
    expect(bars.map((b) => b.textContent)).toEqual(items.map((i) => i.label));
    expect(bars.map((b) => b.getAttribute("title"))).toEqual(
      items.map((i) => i.label),
    );
    expect(bars.map((b) => b.className)).toEqual([
      "wb-history-bar wb-history-bar--ok",
      "wb-history-bar wb-history-bar--failed",
      "wb-history-bar wb-history-bar--waiting",
      "wb-history-bar wb-history-bar--running",
    ]);
  });

  it("length pads the oldest side with hidden empty slots", () => {
    const { container } = render(
      <HistoryStrip label="Last 6 runs" items={items} length={6} />,
    );
    const slots = [...container.querySelectorAll(".wb-history-bar")];
    expect(slots).toHaveLength(6);
    expect(
      slots.slice(0, 2).every((s) => s.matches(".wb-history-bar--empty")),
    ).toBe(true);
    for (const s of slots.slice(0, 2))
      expect(s).toHaveAttribute("aria-hidden", "true");
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
  });

  it("length keeps only the newest items", () => {
    render(<HistoryStrip label="Last 2 runs" items={items} length={2} />);
    expect(screen.getAllByRole("listitem").map((b) => b.textContent)).toEqual([
      "Waiting · Oct 22",
      "Running · Oct 23",
    ]);
  });

  it("with no history shows only empty slots", () => {
    const { container } = render(
      <HistoryStrip label="Last 20 runs" items={[]} length={20} />,
    );
    expect(container.querySelectorAll(".wb-history-bar--empty")).toHaveLength(
      20,
    );
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });
});

describe("Steps", () => {
  it("lists the steps in order with their state for screen readers", () => {
    render(
      <Steps
        label="Progress"
        steps={[
          { label: "Queued", detail: "12 s", state: "done" },
          { label: "Build", detail: "exit 1", state: "failed" },
          { label: "Deploy", detail: "skipped", state: "not-reached" },
        ]}
      />,
    );
    const list = screen.getByRole("list", { name: "Progress" });
    expect(list.tagName).toBe("OL");
    expect(list).toHaveAttribute("role", "list");
    const steps = within(list).getAllByRole("listitem");
    expect(steps.map((s) => s.textContent)).toEqual([
      "Queued, done12 s",
      "Build, failedexit 1",
      "Deploy, not reachedskipped",
    ]);
    expect(steps.map((s) => s.className)).toEqual([
      "wb-step wb-step--done",
      "wb-step wb-step--failed",
      "wb-step wb-step--not-reached",
    ]);
  });

  it("marks the current or waiting step with aria-current", () => {
    const { rerender } = render(
      <Steps
        label="Progress"
        steps={[
          { label: "Queued", state: "done" },
          { label: "Working", state: "current" },
          { label: "Reply", state: "not-reached" },
        ]}
      />,
    );
    const current = () =>
      screen
        .getAllByRole("listitem")
        .filter((s) => s.getAttribute("aria-current") === "step");
    expect(current().map((s) => s.textContent)).toEqual([
      "Working, in progress",
    ]);
    rerender(
      <Steps
        label="Progress"
        steps={[
          {
            label: "Queued",
            state: "waiting",
            stateLabel: "waiting for a slot",
          },
          { label: "Working", state: "not-reached" },
        ]}
      />,
    );
    expect(current().map((s) => s.textContent)).toEqual([
      "Queued, waiting for a slot",
    ]);
  });

  it("uses the step glyphs: done ok, current running, waiting, failed, not reached skipped", () => {
    const { container } = render(
      <Steps
        label="Progress"
        steps={[
          { label: "A", state: "done" },
          { label: "B", state: "current" },
          { label: "C", state: "waiting" },
          { label: "D", state: "failed" },
          { label: "E", state: "not-reached" },
        ]}
      />,
    );
    expect(
      [...container.querySelectorAll(".wb-status-glyph")].map(
        (g) => g.getAttribute("class")?.split(" ")[1],
      ),
    ).toEqual([
      "wb-status-glyph--ok",
      "wb-status-glyph--running",
      "wb-status-glyph--waiting",
      "wb-status-glyph--failed",
      "wb-status-glyph--skipped",
    ]);
  });

  it("gives string labels a tooltip for when they are truncated", () => {
    const { container } = render(
      <Steps
        label="Progress"
        steps={[
          { label: "Clone a-very-long-repository-name", state: "done" },
          { label: <b>Agent</b>, state: "current", title: "Agent working" },
        ]}
      />,
    );
    expect(
      [...container.querySelectorAll(".wb-step-label")].map((l) =>
        l.getAttribute("title"),
      ),
    ).toEqual(["Clone a-very-long-repository-name", "Agent working"]);
    expect(container.querySelectorAll(".wb-step-detail")).toHaveLength(0);
  });
});
