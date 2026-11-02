import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { appliedStyle, applyStyle, STYLE_ATTRIBUTE } from "../src";

const styles = resolve(__dirname, "..", "src", "styles");
const css = readFileSync(resolve(styles, "quiet.css"), "utf8");
const tokensCss = readFileSync(resolve(styles, "tokens.css"), "utf8");
const controlsCss = readFileSync(resolve(styles, "controls.css"), "utf8");
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
    "wb-accent": "#2556c4",
    "wb-accent-solid": "var(--wb-accent)",
    "wb-accent-weak": "rgba(37, 86, 196, 0.09)",
    "wb-accent-text": "#2150b5",
    "wb-on-accent": "#ffffff",
    "wb-shadow-pop":
      "0 1px 2px rgba(0, 0, 0, 0.04), 0 12px 32px rgba(0, 0, 0, 0.08)",
    "wb-shadow-drawer": "none",
    "wb-shadow-raised": "0 0 0 transparent",
    "wb-success": "#2b7440",
    "wb-success-text": "#2b7440",
    "wb-success-weak": "#f4f8f5",
    "wb-success-border": "rgba(43, 117, 64, 0.35)",
    "wb-success-bar": "#a9cdb2",
    "wb-warning": "#885f09",
    "wb-warning-text": "#885f09",
    "wb-warning-weak": "#fcf8ee",
    "wb-warning-border": "rgba(138, 96, 9, 0.35)",
    "wb-danger": "#c02f2a",
    "wb-danger-text": "#c02f2a",
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
    "wb-surface-2": "#20201e",
    "wb-surface-3": "#2a2926",
    "wb-raised": "var(--wb-surface)",
    "wb-border": "#292826",
    "wb-border-strong": "#3a3936",
    "wb-fg": "#e9e7e2",
    "wb-fg-2": "#a8a59e",
    "wb-muted": "#8a8780",
    "wb-accent": "#7ea6f8",
    "wb-accent-solid": "var(--wb-accent)",
    "wb-accent-weak": "rgba(126, 166, 248, 0.14)",
    "wb-accent-text": "#93b4f9",
    "wb-on-accent": "#0d1424",
    "wb-shadow-pop":
      "0 1px 2px rgba(0, 0, 0, 0.3), 0 16px 40px rgba(0, 0, 0, 0.4)",
    "wb-shadow-drawer": "none",
    "wb-shadow-raised": "0 0 0 transparent",
    "wb-success": "#62b57d",
    "wb-success-text": "#62b57d",
    "wb-success-weak": "rgba(98, 181, 125, 0.08)",
    "wb-success-border": "rgba(98, 181, 125, 0.35)",
    "wb-success-bar": "#3f6b4c",
    "wb-warning": "#d6a24a",
    "wb-warning-text": "#d6a24a",
    "wb-warning-weak": "rgba(214, 162, 74, 0.07)",
    "wb-warning-border": "rgba(214, 162, 74, 0.35)",
    "wb-danger": "#ef7065",
    "wb-danger-text": "#ef7065",
    "wb-danger-weak": "rgba(238, 107, 96, 0.08)",
    "wb-danger-border": "rgba(238, 107, 96, 0.35)",
    "wb-info": "#7ea6f8",
    "wb-info-text": "#7ea6f8",
    "wb-info-weak": "rgba(126, 166, 248, 0.07)",
    "wb-info-border": "rgba(126, 166, 248, 0.35)",
    "wb-neutral": "#8a8780",
    "wb-neutral-text": "#a8a59e",
    "wb-neutral-weak": "#20201e",
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
      ".wb-side-item:hover",
      ".wb-side-check:hover",
      ".wb-nav-tab:hover",
      ".wb-nav-more-btn",
      ".wb-btn:not(",
    ])
      expect(
        repointed.some((s) => s.includes(state)),
        state,
      ).toBe(true);
  });

  it("sets the quiet font at the style boundary, for quiet subtrees in default pages", () => {
    const boundary = rules(css).find(
      (r) => selectors(r.selector).join() === `:where(${Q})`,
    );
    expect(boundary?.body).toMatch(/font-family:\s*var\(--wb-font-sans\)/);
  });
});

/** The background of the quiet rule whose selector list includes `selector`. */
function hoverBackground(selector: string): string {
  const rule = rules(css).find((r) =>
    selectors(r.selector).some((s) => s.includes(selector)),
  );
  const bg = /background:\s*([^;]+);/.exec(rule?.body ?? "")?.[1];
  if (!bg) throw new Error(`no background for ${selector}`);
  return bg.replace(/\s+/g, " ").trim();
}

/** color-mix(in srgb, var(--a) P%, var(--b) | transparent) over `base`. */
function composite(
  mix: string,
  vars: Record<string, string>,
  base: RGBA,
): RGBA {
  const m =
    /^color-mix\(in srgb, var\(--(wb-[\w-]+)\) ([\d.]+)%, (transparent|var\(--(wb-[\w-]+)\))\)$/.exec(
      mix,
    );
  if (!m) throw new Error(`cannot read ${mix}`);
  const [r, g, b] = parse(vars[m[1] ?? ""] ?? "", vars);
  const share = Number(m[2]) / 100;
  const other = m[4] ? parse(vars[m[4]] ?? "", vars) : base;
  const mixed: RGBA = [
    r * share + other[0] * (1 - share),
    g * share + other[1] * (1 - share),
    b * share + other[2] * (1 - share),
    1,
  ];
  // mixing with transparent leaves the colour at `share` opacity
  return m[4] ? mixed : over([r, g, b, share], base);
}

describe.each([
  ["light", light],
  ["dark", dark],
] as const)("quiet %s hover backgrounds", (_theme, vars) => {
  const bg = (name: string) => parse(vars[name] ?? "", vars);
  const cases: [string, string, string][] = [
    ["sidebar item", ".wb-side-item:hover", "wb-side"],
    ["sidebar check", ".wb-side-check:hover", "wb-side"],
    ["top-bar tab", ".wb-nav-tab:hover", "wb-side"],
    ["button", ".wb-btn:not(", "wb-surface"],
  ];

  it.each(cases)(
    "%s: fg and fg-2 (which muted text becomes there) meet AA",
    (_name, selector, base) => {
      const hover = composite(hoverBackground(selector), vars, bg(base));
      for (const token of ["wb-fg", "wb-fg-2"])
        expect(contrast(bg(token), hover), token).toBeGreaterThanOrEqual(4.5);
    },
  );

  it("the primary button's hover keeps AA for its text", () => {
    const hover = composite(
      hoverBackground(".wb-btn--primary:not("),
      vars,
      bg("wb-page"),
    );
    expect(contrast(bg("wb-on-accent"), hover)).toBeGreaterThanOrEqual(4.5);
  });

  it("counts on the primary button keep AA, at rest and on hover", () => {
    const rule = rules(css).find((r) =>
      selectors(r.selector).some((s) =>
        s.endsWith(".wb-btn--primary .wb-btn-count"),
      ),
    );
    const opacity = Number(
      /opacity:\s*([\d.]+)/.exec(rule?.body ?? "")?.[1] ?? 1,
    );
    const hover = composite(
      hoverBackground(".wb-btn--primary:not("),
      vars,
      bg("wb-page"),
    );
    for (const base of [bg("wb-accent-solid"), hover]) {
      const [r, g, b] = bg("wb-on-accent");
      const count = over([r, g, b, opacity], base);
      expect(contrast(count, base)).toBeGreaterThanOrEqual(4.5);
    }
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
  /** Selected: the accent tint over the page, the side and a surface. */
  const selected = () =>
    ["wb-page", "wb-side", "wb-surface"].map((b) =>
      tinted("wb-accent-weak", b),
    );

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

  it("fg and fg-2 meet AA on selected and neutral-fill backgrounds (muted is repointed there)", () => {
    for (const b of [...selected(), bg("wb-surface-3")]) {
      for (const token of ["wb-fg", "wb-fg-2"])
        expect(contrast(bg(token), b), token).toBeGreaterThanOrEqual(4.5);
      expect(contrast(bg("wb-muted"), b)).toBeLessThan(4.5);
    }
  });

  it.each([...TONES, "neutral", "accent"])(
    "%s text meets AA on every background, selected included",
    (tone) => {
      const text = bg(`wb-${tone}-text`);
      for (const b of [...plain(), ...selected()])
        expect(
          contrast(text, b),
          `on rgb(${b.slice(0, 3).map(Math.round).join(",")})`,
        ).toBeGreaterThanOrEqual(4.5);
    },
  );

  it("the accent itself meets AA as text (the current top-bar tab's icon and label)", () => {
    for (const b of [...plain(), ...selected()])
      expect(contrast(bg("wb-accent"), b)).toBeGreaterThanOrEqual(4.5);
  });

  it("pressed chip-toggle counts keep AA on the selected tint", () => {
    const selector =
      '.wb-chip-toggle[aria-pressed="true"] .wb-chip-toggle-count';
    const opacityIn = (source: string) => {
      const rule = rules(source).find((r) =>
        selectors(r.selector).some((s) => s.endsWith(selector)),
      );
      const m = /opacity:\s*([\d.]+)/.exec(rule?.body ?? "");
      return m ? Number(m[1]) : undefined;
    };
    const opacity = opacityIn(css) ?? opacityIn(controlsCss) ?? 1;
    const [r, g, b] = bg("wb-accent-text");
    for (const base of selected())
      expect(
        contrast(over([r, g, b, opacity], base), base),
      ).toBeGreaterThanOrEqual(4.5);
  });

  it("text on the accent primary (on-accent) meets AA", () => {
    const primary = rules(controlsCss).find((r) =>
      selectors(r.selector).includes(".wb-btn--primary"),
    );
    expect(primary?.body).toMatch(/background:\s*var\(--wb-accent-solid\)/);
    expect(
      contrast(bg("wb-on-accent"), bg("wb-accent-solid")),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it.each([...TONES, "accent"])(
    "%s marks (glyphs, dots, rules) meet the 3:1 non-text minimum",
    (tone) => {
      for (const b of [
        ...["wb-page", "wb-side", "wb-surface", "wb-surface-2"].map(bg),
        bg("wb-surface-3"),
        ...selected(),
      ])
        expect(contrast(bg(`wb-${tone}`), b)).toBeGreaterThanOrEqual(3);
    },
  );

  it("success marks are the success text colour, not a grey", () => {
    expect(vars["wb-success"]).toBe(vars["wb-success-text"]);
    expect(vars["wb-success"]).not.toBe(vars["wb-muted"]);
  });
});

describe("quiet selection and success bars", () => {
  const body = (selector: string) => {
    const rule = rules(css).find((r) =>
      selectors(r.selector).some((s) => s.includes(selector)),
    );
    if (!rule) throw new Error(`no quiet rule for ${selector}`);
    return rule.body.replace(/\s+/g, " ");
  };

  it.each([
    ".wb-side-item[aria-current]",
    ".wb-nav-tab[aria-current]",
    '.wb-seg-btn[aria-pressed="true"]',
  ])("%s is tinted with the accent", (selector) => {
    expect(body(selector)).toMatch(/background: var\(--wb-accent-weak\);/);
  });

  it("the current sidebar item is only tinted, with no rule beside it", () => {
    expect(body(".wb-side-item[aria-current]")).not.toMatch(
      /box-shadow|border/,
    );
  });

  it.each([
    ".wb-side-item:hover",
    ".wb-nav-tab:hover",
    ".wb-side-quick > button:hover",
    ".wb-side-more:hover",
    ".wb-row-actions .wb-btn--icon:hover",
    ".wb-btn:not(",
  ])("%s keeps a grey hover", (selector) => {
    const b = body(selector);
    expect(b).toMatch(/background: color-mix\(in srgb, var\(--wb-surface-3\)/);
    expect(b).not.toMatch(/accent/);
  });

  it("neutral fills stay grey: --wb-surface-3 and --wb-deemph are not tinted", () => {
    for (const vars of [light, dark]) {
      const [r, g, b] = parse(vars["wb-surface-3"] ?? "", vars);
      expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThan(12);
      const [dr, dg, db] = parse(vars["wb-deemph"] ?? "", vars);
      expect(Math.max(dr, dg, db) - Math.min(dr, dg, db)).toBeLessThan(12);
    }
  });

  it("HistoryStrip's ok bars use --wb-success-bar, a green", () => {
    expect(body(".wb-history-bar--ok")).toMatch(
      /background: var\(--wb-success-bar\);/,
    );
    for (const vars of [light, dark]) {
      const [r, g, b] = parse(vars["wb-success-bar"] ?? "", vars);
      expect(g).toBeGreaterThan(r);
      expect(g).toBeGreaterThan(b);
    }
  });
});

describe("quiet contrast notes", () => {
  const notes = readme.slice(
    readme.indexOf("**Quiet contrast.**"),
    readme.indexOf("`tests/quiet.test.ts` pins the quiet palette"),
  );
  const header = css.slice(0, css.indexOf("*/"));

  /** Tokens the notes explain, and the themes whose values they state. */
  const NOTED: [string, ("light" | "dark")[]][] = [
    ["wb-muted", ["light", "dark"]],
    ["wb-accent-text", ["light", "dark"]],
    ["wb-success-text", ["light", "dark"]],
    ["wb-warning", ["light"]],
    ["wb-danger", ["light", "dark"]],
  ];

  it.each(NOTED)(
    "the README and the quiet.css header state %s",
    (token, themes) => {
      expect(notes).not.toBe("");
      expect(notes).toContain(`\`--${token}\``);
      expect(header).toContain(`--${token}`);
      for (const theme of themes) {
        const value = (theme === "light" ? light : dark)[token] ?? "";
        expect(notes, `${token} ${value}`).toContain(`\`${value}\``);
        expect(header, `${token} ${value}`).toContain(value);
      }
    },
  );
});
