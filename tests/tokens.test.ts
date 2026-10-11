import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  resolve(__dirname, "..", "src", "styles", "tokens.css"),
  "utf8",
);

function block(selector: RegExp): Record<string, string> {
  const m = selector.exec(css);
  if (!m) throw new Error(`no block ${selector}`);
  const start = css.indexOf("{", m.index) + 1;
  const end = css.indexOf("}", start);
  const out: Record<string, string> = {};
  for (const d of css.slice(start, end).matchAll(/--(wb-[\w-]+):\s*([^;]+);/g))
    out[d[1] ?? ""] = (d[2] ?? "").trim();
  return out;
}

type RGBA = [number, number, number, number];

function parse(value: string, vars: Record<string, string>): RGBA {
  const ref = /^var\(--(wb-[\w-]+)\)$/.exec(value);
  if (ref) return parse(vars[ref[1] ?? ""] ?? "", vars);
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value);
  if (hex) {
    let h = hex[1] ?? "";
    if (h.length === 3) h = [...h].map((c) => c + c).join("");
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

const light = block(/:root,\s*\[data-theme="light"\]\s*\{/);
const dark = { ...light, ...block(/\[data-theme="dark"\]\s*\{/) };
const TONES = ["success", "warning", "danger", "info", "neutral"];

/** Backgrounds that carry small secondary and muted text. */
function textBackgrounds(
  theme: "light" | "dark",
  vars: Record<string, string>,
): RGBA[] {
  const bgs = ["wb-page", "wb-surface", "wb-surface-2"].map((b) =>
    parse(vars[b] ?? "", vars),
  );
  // Dark hover/pressed states put muted text on surface-3 as well.
  if (theme === "dark") bgs.push(parse(vars["wb-surface-3"] ?? "", vars));
  for (const base of ["wb-page", "wb-surface"]) {
    bgs.push(
      over(
        parse(vars["wb-accent-weak"] ?? "", vars),
        parse(vars[base] ?? "", vars),
      ),
    );
  }
  return bgs;
}

describe.each([
  ["light", light],
  ["dark", dark],
] as const)("%s theme tokens", (_name, vars) => {
  it.each(TONES)(
    "%s text on its weak background meets WCAG AA (4.5:1) on surface and page",
    (tone) => {
      for (const bgName of ["wb-surface", "wb-page"]) {
        const bg = parse(vars[bgName] ?? "", vars);
        const weak = over(parse(vars[`wb-${tone}-weak`] ?? "", vars), bg);
        const text = parse(vars[`wb-${tone}-text`] ?? "", vars);
        expect(
          contrast(text, weak),
          `${tone} on ${bgName}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    },
  );

  it.each(["success", "warning", "danger", "neutral"])(
    "white text on solid %s meets 4.5:1",
    (tone) => {
      expect(
        contrast([255, 255, 255, 1], parse(vars[`wb-${tone}`] ?? "", vars)),
      ).toBeGreaterThanOrEqual(4.5);
    },
  );

  it.each(["wb-muted", "wb-fg-2"])(
    "%s text meets AA on page, surface, surface-2 and selected (accent-weak) backgrounds",
    (token) => {
      const text = parse(vars[token] ?? "", vars);
      for (const bg of textBackgrounds(_name, vars)) {
        expect(
          contrast(text, bg),
          `${token} on rgb(${bg.slice(0, 3).map(Math.round).join(",")})`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    },
  );

  it("body text meets AA on every surface", () => {
    for (const bg of [
      "wb-page",
      "wb-surface",
      "wb-surface-2",
      "wb-surface-3",
    ]) {
      const b = parse(vars[bg] ?? "", vars);
      expect(
        contrast(parse(vars["wb-fg"] ?? "", vars), b),
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrast(parse(vars["wb-fg-2"] ?? "", vars), b),
      ).toBeGreaterThanOrEqual(4.5);
    }
  });
});

// The palette as the kit defines it. Muted text and the solid tone fills are
// set by contrast (see the AA tests above and the README, "Tokens"); the rest
// is the visual identity of the kit.
const PALETTE: Record<"light" | "dark", Record<string, string>> = {
  light: {
    "wb-page": "#f6f6f3",
    "wb-surface": "#fcfcfb",
    "wb-surface-2": "#f1f0ec",
    "wb-surface-3": "#e8e7e2",
    "wb-border": "rgba(11, 11, 11, 0.09)",
    "wb-border-strong": "rgba(11, 11, 11, 0.16)",
    "wb-fg": "#0b0b0b",
    "wb-fg-2": "#52514e",
    "wb-muted": "#6a6964",
    "wb-accent": "#2a78d6",
    "wb-accent-weak": "rgba(42, 120, 214, 0.09)",
    "wb-accent-text": "#1c5cab",
    "wb-on-accent": "#fff",
    "wb-scrim": "rgba(20, 20, 18, 0.28)",
    "wb-success": "#1a7f37",
    "wb-success-text": "#116329",
    "wb-success-weak": "rgba(26, 127, 55, 0.1)",
    "wb-success-border": "rgba(26, 127, 55, 0.3)",
    "wb-warning": "#9a6700",
    "wb-warning-text": "#7d4e00",
    "wb-warning-weak": "rgba(191, 135, 0, 0.14)",
    "wb-warning-border": "rgba(191, 135, 0, 0.38)",
    "wb-danger": "#cf222e",
    "wb-danger-text": "#a40e26",
    "wb-danger-weak": "rgba(207, 34, 46, 0.09)",
    "wb-danger-border": "rgba(207, 34, 46, 0.3)",
    "wb-info-border": "rgba(42, 120, 214, 0.3)",
    "wb-neutral": "#6b6a65",
    "wb-neutral-text": "#52514e",
    "wb-neutral-weak": "rgba(11, 11, 11, 0.06)",
    "wb-neutral-border": "rgba(11, 11, 11, 0.16)",
    "wb-grid": "#e1e0d9",
    "wb-axis": "#c3c2b7",
    "wb-deemph": "#cfcec7",
    "wb-s1": "#2a78d6",
    "wb-s2": "#eb6834",
    "wb-s3": "#1baf7a",
    "wb-s4": "#eda100",
    "wb-s5": "#e87ba4",
    "wb-s6": "#008300",
    "wb-s7": "#4a3aa7",
    "wb-s8": "#e34948",
    "wb-seq-0": "#eeede8",
    "wb-seq-1": "#cde2fb",
    "wb-seq-2": "#9ec5f4",
    "wb-seq-3": "#5598e7",
    "wb-seq-4": "#2a78d6",
    "wb-seq-5": "#184f95",
  },
  dark: {
    "wb-page": "#0d0d0d",
    "wb-surface": "#1a1a19",
    "wb-surface-2": "#232322",
    "wb-surface-3": "#2e2e2c",
    "wb-border": "rgba(255, 255, 255, 0.08)",
    "wb-border-strong": "rgba(255, 255, 255, 0.15)",
    "wb-fg": "#f5f5f3",
    "wb-fg-2": "#c3c2b7",
    "wb-muted": "#97958f",
    "wb-accent": "#3987e5",
    "wb-accent-weak": "rgba(57, 135, 229, 0.15)",
    "wb-accent-text": "#86b6ef",
    "wb-on-accent": "#fff",
    "wb-scrim": "rgba(0, 0, 0, 0.5)",
    "wb-success": "#238636",
    "wb-success-text": "#56d364",
    "wb-success-weak": "rgba(63, 185, 80, 0.15)",
    "wb-success-border": "rgba(63, 185, 80, 0.4)",
    "wb-warning": "#9e6a03",
    "wb-warning-text": "#e3b341",
    "wb-warning-weak": "rgba(210, 153, 34, 0.15)",
    "wb-warning-border": "rgba(210, 153, 34, 0.4)",
    "wb-danger": "#da3633",
    "wb-danger-text": "#ff7b72",
    "wb-danger-weak": "rgba(248, 81, 73, 0.15)",
    "wb-danger-border": "rgba(248, 81, 73, 0.4)",
    "wb-info-border": "rgba(57, 135, 229, 0.4)",
    "wb-neutral": "#6e6d68",
    "wb-neutral-text": "#c3c2b7",
    "wb-neutral-weak": "rgba(255, 255, 255, 0.08)",
    "wb-neutral-border": "rgba(255, 255, 255, 0.15)",
    "wb-grid": "#2c2c2a",
    "wb-axis": "#383835",
    "wb-deemph": "#454542",
    "wb-s1": "#3987e5",
    "wb-s2": "#d95926",
    "wb-s3": "#199e70",
    "wb-s4": "#c98500",
    "wb-s5": "#d55181",
    "wb-s6": "#008300",
    "wb-s7": "#9085e9",
    "wb-s8": "#e66767",
    "wb-seq-0": "#262625",
    "wb-seq-1": "#0d366b",
    "wb-seq-2": "#184f95",
    "wb-seq-3": "#256abf",
    "wb-seq-4": "#3987e5",
    "wb-seq-5": "#86b6ef",
  },
};

// Tokens whose value is fixed by a contrast requirement, and that the README
// and the tokens.css header state by value: muted text on the pane
// backgrounds, white text on the solid tone fills.
const CONTRAST_SET = ["wb-muted", "wb-success", "wb-danger", "wb-warning"];

const readme = readFileSync(resolve(__dirname, "..", "README.md"), "utf8");
const contrastNotes = readme.slice(
  readme.indexOf("**Contrast.**"),
  readme.indexOf("Tones are `success`"),
);
const tokensHeader = css.slice(0, css.indexOf("*/"));

describe.each([
  ["light", light],
  ["dark", dark],
] as const)("%s theme palette", (theme, vars) => {
  it("defines the documented colour values", () => {
    for (const [token, value] of Object.entries(PALETTE[theme]))
      expect(vars[token], token).toBe(value);
  });

  it("defines no colour value that is not pinned here", () => {
    const pinned = new Set(Object.keys(PALETTE[theme]));
    const unpinned = Object.entries(vars)
      .filter(([token, value]) => /^(#|rgba)/.test(value) && !pinned.has(token))
      .map(([token]) => token);
    expect(unpinned).toEqual([]);
  });

  it("the README and the tokens.css header state the contrast-set values", () => {
    expect(contrastNotes).not.toBe("");
    for (const token of CONTRAST_SET) {
      expect(contrastNotes).toContain(`\`--${token}\``);
      expect(tokensHeader).toContain(`--${token}`);
      const value = vars[token] ?? "";
      expect(contrastNotes, `${token} ${value}`).toContain(`\`${value}\``);
      expect(tokensHeader, `${token} ${value}`).toContain(value);
    }
  });
});
