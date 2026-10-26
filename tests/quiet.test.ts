import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { appliedStyle, applyStyle, STYLE_ATTRIBUTE } from "../src";

const styles = resolve(__dirname, "..", "src", "styles");
const css = readFileSync(resolve(styles, "quiet.css"), "utf8");
const tokensCss = readFileSync(resolve(styles, "tokens.css"), "utf8");
const readme = readFileSync(resolve(__dirname, "..", "README.md"), "utf8");
const Q = '[data-wb-style="quiet"]';

function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** Custom properties declared by the first rule whose prelude matches. */
function block(source: string, selector: RegExp): Record<string, string> {
  const text = stripComments(source);
  const m = selector.exec(text);
  if (!m) throw new Error(`no block ${selector}`);
  const start = text.indexOf("{", m.index) + 1;
  const end = text.indexOf("}", start);
  const out: Record<string, string> = {};
  for (const d of text.slice(start, end).matchAll(/--(wb-[\w-]+):\s*([^;]+);/g))
    out[d[1] ?? ""] = (d[2] ?? "").replace(/\s+/g, " ").trim();
  return out;
}

/** Every style rule: its selector list and declarations. */
function rules(source: string): { selector: string; body: string }[] {
  const text = stripComments(source);
  const out: { selector: string; body: string }[] = [];
  let prelude = "";
  let depth = 0;
  let ruleStart = -1;
  let ruleDepth = -1;
  let selector = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "{") {
      const p = prelude.trim();
      if (!p.startsWith("@") && ruleDepth < 0) {
        selector = p;
        ruleStart = i + 1;
        ruleDepth = depth;
      }
      depth++;
      prelude = "";
    } else if (ch === "}") {
      depth--;
      if (depth === ruleDepth) {
        out.push({ selector, body: text.slice(ruleStart, i) });
        ruleDepth = -1;
      }
      prelude = "";
    } else if (ch === ";") {
      prelude = "";
    } else {
      prelude += ch;
    }
  }
  return out;
}

/** Split a selector list on top-level commas. */
function selectors(list: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of list) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  out.push(cur.trim());
  return out.map((s) => s.replace(/\s+/g, " "));
}

type RGBA = [number, number, number, number];

function parse(value: string, vars: Record<string, string>): RGBA {
  const ref = /^var\(--(wb-[\w-]+)\)$/.exec(value);
  if (ref) return parse(vars[ref[1] ?? ""] ?? "", vars);
  const hex = /^#([0-9a-f]{6})$/i.exec(value);
  if (hex) {
    const h = hex[1] ?? "";
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
      1,
    ];
  }
  const rgba = /^rgba\(([\d.]+),\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)\)$/.exec(
    value,
  );
  if (rgba)
    return [Number(rgba[1]), Number(rgba[2]), Number(rgba[3]), Number(rgba[4])];
  throw new Error(`cannot parse colour ${value}`);
}

function over([r, g, b, a]: RGBA, [br, bg, bb]: RGBA): RGBA {
  return [r * a + br * (1 - a), g * a + bg * (1 - a), b * a + bb * (1 - a), 1];
}

function luminance([r, g, b]: RGBA): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: RGBA, b: RGBA): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (hi + 0.05) / (lo + 0.05);
}

const light = block(
  css,
  /\[data-wb-style="quiet"\],\s*\[data-wb-style="quiet"\] \[data-theme="light"\]/,
);
const dark = block(css, /\[data-wb-style="quiet"\]\[data-theme="dark"\],/);
const TONES = ["success", "warning", "danger", "info"];
const TINTS = TONES.map((t) => `wb-${t}-weak`);

const PALETTE: Record<"light" | "dark", Record<string, string>> = {
  light: {
    "wb-page": "#fcfcfa",
    "wb-side": "#f4f3ef",
    "wb-surface": "#ffffff",
    "wb-surface-2": "#f5f4f0",
    "wb-surface-3": "#e9e7e1",
    "wb-raised": "var(--wb-surface)",
    "wb-border": "#e8e6e1",
    "wb-border-strong": "#d8d5ce",
    "wb-fg": "#1b1b19",
    "wb-fg-2": "#5b5953",
    "wb-muted": "#726f68",
    "wb-accent": "#1b1b19",
    "wb-accent-weak": "#e9e7e1",
    "wb-accent-text": "#1b1b19",
    "wb-on-accent": "#ffffff",
    "wb-shadow-pop":
      "0 1px 2px rgba(0, 0, 0, 0.04), 0 12px 32px rgba(0, 0, 0, 0.08)",
    "wb-shadow-drawer": "none",
    "wb-shadow-raised": "0 0 0 transparent",
    "wb-success": "var(--wb-muted)",
    "wb-success-text": "#2b7540",
    "wb-success-weak": "#f4f8f5",
    "wb-success-border": "rgba(43, 117, 64, 0.35)",
    "wb-warning": "#8a6009",
    "wb-warning-text": "#8a6009",
    "wb-warning-weak": "#fcf8ee",
    "wb-warning-border": "rgba(138, 96, 9, 0.35)",
    "wb-danger": "#c2302a",
    "wb-danger-text": "#c2302a",
    "wb-danger-weak": "#fdf5f4",
    "wb-danger-border": "rgba(194, 48, 42, 0.35)",
    "wb-info": "#2556c4",
    "wb-info-text": "#2556c4",
    "wb-info-weak": "#f3f6fd",
    "wb-info-border": "rgba(37, 86, 196, 0.35)",
    "wb-neutral": "#726f68",
    "wb-neutral-text": "#5b5953",
    "wb-neutral-weak": "#f5f4f0",
    "wb-neutral-border": "#d8d5ce",
    "wb-grid": "#e8e6e1",
    "wb-axis": "#d8d5ce",
    "wb-deemph": "#d2cfc8",
  },
  dark: {
    "wb-page": "#151514",
    "wb-side": "#1a1a19",
    "wb-surface": "#1d1d1b",
    "wb-surface-2": "#1c1c1b",
    "wb-surface-3": "#2a2926",
    "wb-raised": "var(--wb-surface)",
    "wb-border": "#292826",
    "wb-border-strong": "#3a3936",
    "wb-fg": "#e9e7e2",
    "wb-fg-2": "#a8a59e",
    "wb-muted": "#8a8780",
    "wb-accent": "#e9e7e2",
    "wb-accent-weak": "#2a2926",
    "wb-accent-text": "#e9e7e2",
    "wb-on-accent": "#151514",
    "wb-shadow-pop":
      "0 1px 2px rgba(0, 0, 0, 0.3), 0 16px 40px rgba(0, 0, 0, 0.4)",
    "wb-shadow-drawer": "none",
    "wb-shadow-raised": "0 0 0 transparent",
    "wb-success": "var(--wb-muted)",
    "wb-success-text": "#62b57d",
    "wb-success-weak": "rgba(98, 181, 125, 0.08)",
    "wb-success-border": "rgba(98, 181, 125, 0.35)",
    "wb-warning": "#d6a24a",
    "wb-warning-text": "#d6a24a",
    "wb-warning-weak": "rgba(214, 162, 74, 0.07)",
    "wb-warning-border": "rgba(214, 162, 74, 0.35)",
    "wb-danger": "#ee6b60",
    "wb-danger-text": "#ee6b60",
    "wb-danger-weak": "rgba(238, 107, 96, 0.08)",
    "wb-danger-border": "rgba(238, 107, 96, 0.35)",
    "wb-info": "#7ea6f8",
    "wb-info-text": "#7ea6f8",
    "wb-info-weak": "rgba(126, 166, 248, 0.07)",
    "wb-info-border": "rgba(126, 166, 248, 0.35)",
    "wb-neutral": "#8a8780",
    "wb-neutral-text": "#a8a59e",
    "wb-neutral-weak": "#1c1c1b",
    "wb-neutral-border": "#3a3936",
    "wb-grid": "#292826",
    "wb-axis": "#3a3936",
    "wb-deemph": "#4a4944",
  },
};

describe("style selection", () => {
  it("applyStyle sets data-wb-style on <html>; default removes it", () => {
    const root = document.documentElement;
    expect(STYLE_ATTRIBUTE).toBe("data-wb-style");
    expect(appliedStyle()).toBe("default");
    applyStyle("quiet");
    expect(root.getAttribute(STYLE_ATTRIBUTE)).toBe("quiet");
    expect(appliedStyle()).toBe("quiet");
    applyStyle("default");
    expect(root.hasAttribute(STYLE_ATTRIBUTE)).toBe(false);
    expect(appliedStyle()).toBe("default");
  });

  it("leaves data-theme alone (style and theme are independent)", () => {
    const root = document.documentElement;
    root.dataset.theme = "dark";
    applyStyle("quiet");
    expect(root.dataset.theme).toBe("dark");
    applyStyle("default");
    expect(root.dataset.theme).toBe("dark");
  });
});

describe("quiet stylesheet scope", () => {
  it("scopes every rule to the quiet attribute, so the default style is untouched", () => {
    const all = rules(css);
    expect(all.length).toBeGreaterThan(50);
    const unscoped = all
      .flatMap((r) => selectors(r.selector))
      .filter((s) => !s.startsWith(Q) && !s.startsWith(`:where(${Q})`));
    expect(unscoped).toEqual([]);
  });

  it("the default fonts never name IBM Plex; the quiet fonts name only IBM Plex", () => {
    const defaults = block(tokensCss, /:root\s*\{/);
    for (const font of ["wb-font-sans", "wb-font-mono"]) {
      expect(defaults[font]).not.toMatch(/Plex/);
    }
    const quiet = block(css, /\[data-wb-style="quiet"\]\s*\{/);
    expect(quiet["wb-font-sans"]).toMatch(/^"IBM Plex Sans",/);
    expect(quiet["wb-font-mono"]).toMatch(/^"IBM Plex Mono",/);
    for (const font of ["wb-font-sans", "wb-font-mono"])
      expect(quiet[font]).not.toMatch(/Inter|JetBrains/);
  });

  it("points --wb-muted at --wb-fg-2 on every selected background", () => {
    const repointed = rules(css)
      .filter((r) => /--wb-muted:\s*var\(--wb-fg-2\)/.test(r.body))
      .flatMap((r) => selectors(r.selector));
    for (const state of [
      ".wb-side-item[aria-current]",
      ".wb-nav-tab[aria-current]",
      ".wb-row.is-active",
      ".wb-table tbody tr.is-selected",
      ".wb-table tbody tr.is-active",
      '.wb-table tbody tr[aria-selected="true"]',
      ".wb-table tbody tr[aria-current]",
      '.wb-chip-toggle[aria-pressed="true"]',
      '.wb-seg-btn[aria-pressed="true"]',
      '.wb-palette-item[aria-selected="true"]',
    ])
      expect(
        repointed.some((s) => s.includes(state)),
        state,
      ).toBe(true);
  });
});

describe.each([
  ["light", light],
  ["dark", dark],
] as const)("quiet %s palette", (theme, vars) => {
  const bg = (name: string) => parse(vars[name] ?? "", vars);
  const tinted = (name: string, base: string) => over(bg(name), bg(base));
  /**
   * Backgrounds small text sits on, selected excepted. Tints are measured
   * over the page; Steps, which tints a surface, raises its muted text there.
   */
  const plain = () => [
    ...["wb-page", "wb-side", "wb-surface", "wb-surface-2"].map(bg),
    ...TINTS.map((t) => tinted(t, "wb-page")),
  ];

  it("defines the documented colour values", () => {
    expect(vars).toEqual(PALETTE[theme]);
  });

  it.each(["wb-fg", "wb-fg-2", "wb-muted"])(
    "%s meets AA on page, side, surface, hover and the status tints",
    (token) => {
      for (const b of plain())
        expect(
          contrast(bg(token), b),
          `${token} on rgb(${b.slice(0, 3).map(Math.round).join(",")})`,
        ).toBeGreaterThanOrEqual(4.5);
    },
  );

  it("fg and fg-2 meet AA on selected backgrounds (muted is repointed there)", () => {
    for (const token of ["wb-fg", "wb-fg-2"])
      expect(contrast(bg(token), bg("wb-surface-3"))).toBeGreaterThanOrEqual(
        4.5,
      );
    expect(contrast(bg("wb-muted"), bg("wb-surface-3"))).toBeLessThan(4.5);
  });

  it.each([...TONES, "neutral"])(
    "%s text meets AA on every background, selected included, and on its tint",
    (tone) => {
      const text = bg(`wb-${tone}-text`);
      for (const b of [...plain(), bg("wb-surface-3")])
        expect(contrast(text, b)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it("text on the ink primary (on-accent) meets AA", () => {
    expect(
      contrast(bg("wb-on-accent"), bg("wb-accent")),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it.each(TONES)(
    "%s marks (glyphs, dots, rules) meet the 3:1 non-text minimum",
    (tone) => {
      for (const b of [
        ...["wb-page", "wb-side", "wb-surface", "wb-surface-2"].map(bg),
        bg("wb-surface-3"),
      ])
        expect(contrast(bg(`wb-${tone}`), b)).toBeGreaterThanOrEqual(3);
    },
  );
});

describe("quiet contrast notes", () => {
  const notes = readme.slice(
    readme.indexOf("**Quiet contrast.**"),
    readme.indexOf("`tests/quiet.test.ts` pins the quiet palette"),
  );
  const header = css.slice(0, css.indexOf("*/"));

  it.each(["wb-muted", "wb-warning", "wb-success-text"])(
    "the README and the quiet.css header state %s",
    (token) => {
      expect(notes).not.toBe("");
      expect(notes).toContain(`\`--${token}\``);
      expect(header).toContain(`--${token}`);
      for (const vars of [light, dark]) {
        const value = vars[token] ?? "";
        if (token === "wb-muted" || vars === light) {
          expect(notes, `${token} ${value}`).toContain(`\`${value}\``);
          expect(header, `${token} ${value}`).toContain(value);
        }
      }
    },
  );
});
