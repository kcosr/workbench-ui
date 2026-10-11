import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyStoredTheme,
  readThemeMode,
  setThemeMode,
  useTheme,
} from "../src";

type Listener = (e: { matches: boolean }) => void;

function mockMatchMedia(dark: boolean) {
  const listeners = new Set<Listener>();
  const query = {
    matches: dark,
    media: "(prefers-color-scheme: dark)",
    addEventListener: (_: string, l: Listener) => listeners.add(l),
    removeEventListener: (_: string, l: Listener) => listeners.delete(l),
  };
  vi.stubGlobal("matchMedia", () => query);
  return {
    set(next: boolean) {
      query.matches = next;
      for (const l of listeners) l({ matches: next });
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

function Probe() {
  const { mode, theme, setMode } = useTheme("t:theme");
  return (
    <div>
      <span data-testid="mode">{mode}</span>
      <span data-testid="theme">{theme}</span>
      <button onClick={() => setMode("dark")}>dark</button>
      <button onClick={() => setMode("system")}>system</button>
    </div>
  );
}

describe("theme", () => {
  it("applyStoredTheme resolves system against prefers-color-scheme", () => {
    mockMatchMedia(true);
    expect(applyStoredTheme("t:theme")).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });

  it("applyStoredTheme uses a stored explicit mode", () => {
    mockMatchMedia(true);
    window.localStorage.setItem("t:theme", "light");
    expect(applyStoredTheme("t:theme")).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("ignores garbage in storage", () => {
    window.localStorage.setItem("t:theme", "purple");
    expect(readThemeMode("t:theme")).toBe("system");
  });

  it("useTheme follows the system preference live while in system mode", () => {
    const media = mockMatchMedia(false);
    render(<Probe />);
    expect(screen.getByTestId("mode")).toHaveTextContent("system");
    expect(screen.getByTestId("theme")).toHaveTextContent("light");
    act(() => media.set(true));
    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("setMode persists, applies, and system clears the override", () => {
    mockMatchMedia(false);
    render(<Probe />);
    act(() => screen.getByText("dark").click());
    expect(window.localStorage.getItem("t:theme")).toBe("dark");
    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    act(() => screen.getByText("system").click());
    expect(window.localStorage.getItem("t:theme")).toBeNull();
    expect(screen.getByTestId("theme")).toHaveTextContent("light");
  });

  it("shares state between hook instances", () => {
    mockMatchMedia(false);
    render(
      <>
        <Probe />
        <Probe />
      </>,
    );
    act(() => setThemeMode("t:theme", "dark"));
    for (const el of screen.getAllByTestId("mode"))
      expect(el).toHaveTextContent("dark");
  });
});
