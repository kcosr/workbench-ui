import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  Time,
  formatDate,
  formatDateTime,
  formatDuration,
  formatRelative,
  toDate,
} from "../src";

const now = new Date(2026, 8, 28, 12, 0, 0).getTime();

describe("time", () => {
  it("formats relative times", () => {
    expect(formatRelative(now - 20_000, now)).toBe("just now");
    expect(formatRelative(now - 5 * 60_000, now)).toBe("5m ago");
    expect(formatRelative(now - 3 * 3_600_000, now)).toBe("3h ago");
    expect(formatRelative(now - 2 * 86_400_000, now)).toBe("2d ago");
    expect(formatRelative(now - 15 * 86_400_000, now)).toBe("2w ago");
    expect(formatRelative(now - 100 * 86_400_000, now)).toBe("3mo ago");
    expect(formatRelative(now - 800 * 86_400_000, now)).toBe("2y ago");
    expect(formatRelative(now + 10 * 60_000, now)).toBe("in 10m");
  });

  it("formats dates with the year only when it differs", () => {
    expect(formatDate(new Date(2026, 8, 3), now)).toBe("Sep 3");
    expect(formatDate(new Date(2025, 8, 3), now)).toBe("Sep 3, 2025");
    expect(formatDateTime(new Date(2026, 8, 27, 19, 45, 12))).toBe(
      "Sep 27, 2026, 7:45 PM",
    );
    expect(
      formatDateTime(new Date(2026, 8, 27, 19, 45, 12), { seconds: true }),
    ).toBe("Sep 27, 2026, 7:45:12 PM");
  });

  it("formats durations", () => {
    expect(formatDuration(850)).toBe("850 ms");
    expect(formatDuration(4_200)).toBe("4.2 s");
    expect(formatDuration(45_000)).toBe("45 s");
    expect(formatDuration(4 * 60_000)).toBe("4 min");
    expect(formatDuration(26 * 3_600_000)).toBe("26 h");
    expect(formatDuration(3.2 * 86_400_000)).toBe("3.2 days");
  });

  it("rejects invalid input", () => {
    expect(toDate("")).toBeNull();
    expect(toDate("not a date")).toBeNull();
    expect(toDate(null)).toBeNull();
  });

  it("<Time> renders relative text with the absolute time in title", () => {
    const at = new Date(Date.now() - 5 * 60_000);
    render(<Time value={at} />);
    const el = screen.getByText("5m ago");
    expect(el.tagName).toBe("TIME");
    expect(el).toHaveAttribute("dateTime", at.toISOString());
    expect(el.getAttribute("title")).toMatch(
      /\d{4}, \d{1,2}:\d{2}:\d{2} [AP]M$/,
    );
  });

  it("<Time> shows the fallback for missing values", () => {
    render(<Time value={undefined} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
