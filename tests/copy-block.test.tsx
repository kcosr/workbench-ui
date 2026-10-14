import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CopyBlock, Icon } from "../src";
import type { IconName } from "../src";

const URL_TEXT = "https://server.example.com/v1";
const CONFIG =
  '[server]\nurl = "https://server.example.com/v1"\n  timeout_seconds = 30\n';
const MANUAL_HINT = "Press Ctrl+C to copy";

/** jsdom has no Clipboard API; tests install one where they need it. */
function stubClipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
}

function iconMarkup(name: IconName): string {
  const { container, unmount } = render(<Icon name={name} />);
  const markup = container.querySelector("svg")?.innerHTML ?? "";
  unmount();
  return markup;
}

const shownIcon = (button: HTMLElement) =>
  button.querySelector("svg")?.innerHTML;
const selectedText = () => window.getSelection()?.toString() ?? "";
/** Lets a settled clipboard promise update the block. */
const flush = () => act(async () => {});

afterEach(() => {
  vi.useRealTimers();
  Reflect.deleteProperty(navigator, "clipboard");
  window.getSelection()?.removeAllRanges();
});

describe("CopyBlock: rendering", () => {
  it("shows single-line text as one focusable code line", () => {
    const { container } = render(
      <CopyBlock text={URL_TEXT} label="Copy server URL" className="extra" />,
    );
    const root = container.firstElementChild;
    expect(root).toHaveClass("wb-copy", "extra");
    expect(root).not.toHaveClass("wb-copy--multiline");
    const code = container.querySelector("code.wb-copy-text");
    expect(code?.textContent).toBe(URL_TEXT);
    expect(code).toHaveAttribute("tabindex", "0");
    expect(container.querySelector("pre")).toBeNull();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("keeps multiline text in a pre, exactly, newlines and indent included", () => {
    const { container } = render(
      <CopyBlock multiline text={CONFIG} label="Copy config file" />,
    );
    expect(container.firstElementChild).toHaveClass(
      "wb-copy",
      "wb-copy--multiline",
    );
    const pre = container.querySelector("pre.wb-copy-text");
    expect(pre?.textContent).toBe(CONFIG);
    expect(pre).toHaveAttribute("tabindex", "0");
    expect(container.querySelector("code")).toBeNull();
  });

  it("names the button with the label and keeps an empty polite live region", () => {
    render(<CopyBlock text={URL_TEXT} label="Copy server URL" />);
    const button = screen.getByRole("button", { name: "Copy server URL" });
    expect(button).toHaveAttribute("title", "Copy server URL");
    expect(button).toHaveAttribute("type", "button");
    expect(shownIcon(button)).toBe(iconMarkup("copy"));
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toBeEmptyDOMElement();
  });
});

describe("CopyBlock: styles", () => {
  const css = readFileSync(
    resolve(__dirname, "..", "src", "styles", "pages.css"),
    "utf8",
  );
  /** The declarations of the rule whose selector is exactly `selector`. */
  function rule(selector: string): Record<string, string> {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const m = new RegExp(`(?:^|[}/])\\s*${escaped}\\s*\\{([^}]*)\\}`).exec(css);
    if (!m) throw new Error(`no rule ${selector}`);
    const out: Record<string, string> = {};
    for (const d of (m[1] ?? "").matchAll(/([\w-]+):\s*([^;]+);/g))
      out[d[1] ?? ""] = (d[2] ?? "").trim();
    return out;
  }

  it("scrolls one long line instead of wrapping or truncating it", () => {
    const text = rule(".wb-copy-text");
    expect(text["white-space"]).toBe("pre");
    expect(text["overflow-x"]).toBe("auto");
    expect(text["min-width"]).toBe("0");
    expect(text["text-overflow"]).toBeUndefined();
    expect(text["user-select"]).toBe("text");
    expect(text.font).toContain("var(--wb-font-mono)");
    expect(rule(".wb-copy")["max-width"]).toBe("100%");
  });

  it("gives a multiline block its own scroll", () => {
    const pre = rule(".wb-copy--multiline .wb-copy-text");
    expect(pre.overflow).toBe("auto");
    expect(pre["max-height"]).toBeDefined();
  });
});

describe("CopyBlock: copying", () => {
  it("writes the exact text, shows Copied with a check, then reverts after 2s", async () => {
    vi.useFakeTimers();
    const writeText = vi.fn((_text: string) => Promise.resolve());
    stubClipboard(writeText);
    const { container } = render(
      <CopyBlock multiline text={CONFIG} label="Copy config file" />,
    );
    const button = screen.getByRole("button", { name: "Copy config file" });
    const status = screen.getByRole("status");

    fireEvent.click(button);
    await flush();
    expect(writeText).toHaveBeenCalledExactlyOnceWith(CONFIG);
    expect(status).toHaveTextContent("Copied");
    expect(container.firstElementChild).toHaveClass("is-copied");
    expect(shownIcon(button)).toBe(iconMarkup("check"));
    // The name stays the label; the live region carries the change.
    expect(screen.getByRole("button", { name: "Copy config file" })).toBe(
      button,
    );

    act(() => vi.advanceTimersByTime(1999));
    expect(status).toHaveTextContent("Copied");
    act(() => vi.advanceTimersByTime(1));
    expect(status).toBeEmptyDOMElement();
    expect(container.firstElementChild).not.toHaveClass("is-copied");
    expect(shownIcon(button)).toBe(iconMarkup("copy"));
    expect(screen.getByRole("status")).toBe(status);
  });

  it("copying again restarts the two seconds", async () => {
    vi.useFakeTimers();
    stubClipboard(() => Promise.resolve());
    render(<CopyBlock text={URL_TEXT} label="Copy server URL" />);
    const button = screen.getByRole("button", { name: "Copy server URL" });
    const status = screen.getByRole("status");
    fireEvent.click(button);
    await flush();
    act(() => vi.advanceTimersByTime(1500));
    fireEvent.click(button);
    await flush();
    act(() => vi.advanceTimersByTime(1500));
    expect(status).toHaveTextContent("Copied");
    act(() => vi.advanceTimersByTime(500));
    expect(status).toBeEmptyDOMElement();
  });

  it("selects the text for a manual copy when the clipboard rejects", async () => {
    vi.useFakeTimers();
    stubClipboard(() =>
      Promise.reject(
        new DOMException("Write permission denied.", "NotAllowedError"),
      ),
    );
    const { container } = render(
      <>
        <p>Other text on the page</p>
        <CopyBlock multiline text={CONFIG} label="Copy config file" />
      </>,
    );
    const button = screen.getByRole("button", { name: "Copy config file" });
    const status = screen.getByRole("status");
    button.focus();
    fireEvent.click(button);
    await flush();

    expect(container.querySelector("pre")).toHaveFocus();
    expect(selectedText()).toBe(CONFIG);
    expect(status).toHaveTextContent(MANUAL_HINT);
    expect(container.querySelector(".wb-copy")).toHaveClass("is-manual");
    expect(container.querySelector(".wb-copy")).not.toHaveClass("is-copied");
    expect(shownIcon(button)).toBe(iconMarkup("copy"));

    act(() => vi.advanceTimersByTime(3999));
    expect(status).toHaveTextContent(MANUAL_HINT);
    act(() => vi.advanceTimersByTime(1));
    expect(status).toBeEmptyDOMElement();
  });

  it.each([
    [
      "there is no Clipboard API",
      () => expect("clipboard" in navigator).toBe(false),
    ],
    [
      "writeText throws",
      () =>
        stubClipboard(() => {
          throw new TypeError("Clipboard unavailable");
        }),
    ],
  ])("falls back without throwing when %s", (_case, install) => {
    install();
    const { container } = render(
      <CopyBlock text={URL_TEXT} label="Copy server URL" />,
    );
    const button = screen.getByRole("button", { name: "Copy server URL" });
    // jsdom reports an exception in an event handler as a window error.
    const errors: unknown[] = [];
    const onError = (e: ErrorEvent) => {
      errors.push(e.error);
      e.preventDefault();
    };
    window.addEventListener("error", onError);
    try {
      expect(() => fireEvent.click(button)).not.toThrow();
    } finally {
      window.removeEventListener("error", onError);
    }
    expect(errors).toEqual([]);
    expect(container.querySelector("code")).toHaveFocus();
    expect(selectedText()).toBe(URL_TEXT);
    expect(screen.getByRole("status")).toHaveTextContent(MANUAL_HINT);
  });

  it("a slow earlier attempt never replaces the latest result", async () => {
    const pending: Array<{ resolve: () => void; reject: () => void }> = [];
    stubClipboard(
      () =>
        new Promise<void>((resolve, reject) =>
          pending.push({ resolve, reject: () => reject(new Error("denied")) }),
        ),
    );
    const { container } = render(
      <CopyBlock text={URL_TEXT} label="Copy server URL" />,
    );
    const button = screen.getByRole("button", { name: "Copy server URL" });
    button.focus();
    fireEvent.click(button);
    fireEvent.click(button);
    await act(async () => pending[1]?.resolve());
    expect(screen.getByRole("status")).toHaveTextContent("Copied");
    await act(async () => pending[0]?.reject());
    expect(screen.getByRole("status")).toHaveTextContent("Copied");
    expect(container.querySelector(".wb-copy")).not.toHaveClass("is-manual");
    expect(button).toHaveFocus();
    expect(selectedText()).toBe("");
  });

  it("does not show an earlier result for new text", async () => {
    stubClipboard(() => Promise.resolve());
    const { rerender } = render(<CopyBlock text="first" label="Copy value" />);
    fireEvent.click(screen.getByRole("button", { name: "Copy value" }));
    await flush();
    expect(screen.getByRole("status")).toHaveTextContent("Copied");
    rerender(<CopyBlock text="second" label="Copy value" />);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  describe("a write still pending when the text changes", () => {
    function setup() {
      vi.useFakeTimers();
      const pending: Array<{ resolve: () => void; reject: () => void }> = [];
      stubClipboard(
        () =>
          new Promise<void>((resolve, reject) =>
            pending.push({
              resolve,
              reject: () => reject(new Error("denied")),
            }),
          ),
      );
      const ui = (text: string) => (
        <>
          <button>Elsewhere</button>
          <CopyBlock text={text} label="Copy value" />
        </>
      );
      const { container, rerender } = render(ui("first"));
      fireEvent.click(screen.getByRole("button", { name: "Copy value" }));
      rerender(ui("second"));
      const elsewhere = screen.getByRole("button", { name: "Elsewhere" });
      act(() => elsewhere.focus());
      const block = container.querySelector(".wb-copy");
      // Settling must not schedule a revert timer (jsdom's focus may own one).
      const timers = vi.getTimerCount();
      return { pending, elsewhere, block, timers };
    }

    it("a late rejection leaves focus, selection and status alone", async () => {
      const { pending, elsewhere, block, timers } = setup();
      await act(async () => pending[0]?.reject());
      expect(elsewhere).toHaveFocus();
      expect(selectedText()).toBe("");
      expect(screen.getByRole("status")).toBeEmptyDOMElement();
      expect(block).not.toHaveClass("is-manual");
      expect(vi.getTimerCount()).toBe(timers);
    });

    it("a late success does not report the new text as copied", async () => {
      const { pending, elsewhere, block, timers } = setup();
      await act(async () => pending[0]?.resolve());
      expect(screen.getByRole("status")).toBeEmptyDOMElement();
      expect(block).not.toHaveClass("is-copied");
      expect(
        shownIcon(screen.getByRole("button", { name: "Copy value" })),
      ).toBe(iconMarkup("copy"));
      expect(elsewhere).toHaveFocus();
      expect(vi.getTimerCount()).toBe(timers);
    });
  });
});

describe("CopyBlock: cleanup", () => {
  it("clears the revert timer on unmount", async () => {
    vi.useFakeTimers();
    stubClipboard(() => Promise.resolve());
    const { unmount } = render(
      <CopyBlock text={URL_TEXT} label="Copy server URL" />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Copy server URL" }));
    await flush();
    expect(screen.getByRole("status")).toHaveTextContent("Copied");
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("leaves no timer or selection for a result that settles after unmount", async () => {
    vi.useFakeTimers();
    const pending: Array<{ resolve: () => void; reject: () => void }> = [];
    stubClipboard(
      () =>
        new Promise<void>((resolve, reject) =>
          pending.push({ resolve, reject: () => reject(new Error("denied")) }),
        ),
    );
    const { unmount } = render(
      <>
        <CopyBlock text="one" label="Copy one" />
        <CopyBlock text="two" label="Copy two" />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Copy one" }));
    fireEvent.click(screen.getByRole("button", { name: "Copy two" }));
    unmount();
    await act(async () => {
      pending[0]?.resolve();
      pending[1]?.reject();
    });
    expect(vi.getTimerCount()).toBe(0);
    expect(selectedText()).toBe("");
  });
});

describe("CopyBlock: keyboard selection", () => {
  it("Ctrl/⌘ A in the focused text selects only that block", () => {
    const { container } = render(
      <>
        <p>Other text on the page</p>
        <CopyBlock text={URL_TEXT} label="Copy server URL" />
      </>,
    );
    const code = container.querySelector("code");
    if (!code) throw new Error("no code element");
    code.focus();
    expect(code).toHaveFocus();
    expect(fireEvent.keyDown(code, { key: "a", ctrlKey: true })).toBe(false);
    expect(selectedText()).toBe(URL_TEXT);
    window.getSelection()?.removeAllRanges();
    expect(fireEvent.keyDown(code, { key: "a", metaKey: true })).toBe(false);
    expect(selectedText()).toBe(URL_TEXT);
    // Other keys, including copying the selection, are left to the browser.
    expect(fireEvent.keyDown(code, { key: "c", ctrlKey: true })).toBe(true);
    expect(fireEvent.keyDown(code, { key: "a" })).toBe(true);
  });
});
