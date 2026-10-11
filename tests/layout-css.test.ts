import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (f: string) =>
  readFileSync(resolve(__dirname, "..", "src", "styles", f), "utf8");
const list = read("list.css");
const forms = read("forms.css");
const utilities = read("utilities.css");
const readme = readFileSync(resolve(__dirname, "..", "README.md"), "utf8");

/** The declarations of the rule whose selector list is exactly `selector`. */
function rule(css: string, selector: string): Record<string, string> {
  const escaped = selector
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "\\s+");
  const m = new RegExp(`(?:^|[}/])\\s*${escaped}\\s*\\{([^}]*)\\}`).exec(css);
  if (!m) throw new Error(`no rule ${selector}`);
  const out: Record<string, string> = {};
  for (const d of (m[1] ?? "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .matchAll(/([\w-]+):\s*([^;]+);/g))
    out[d[1] ?? ""] = (d[2] ?? "").trim();
  return out;
}
const px = (v: string | undefined) => parseFloat(v ?? "NaN");

describe("grouped list rows under content-visibility", () => {
  // Paint containment clips at the group's padding box, and rows sit
  // outset by `margin: 0 -12px`.
  const outset = -px(rule(list, ".wb-row").margin?.split(/\s+/)[1]);

  it("rows are outset", () => {
    expect(outset).toBe(12);
  });

  it("the group pads by the outset and pulls it back, so nothing moves", () => {
    const group = rule(list, ".wb-group");
    expect(group["content-visibility"]).toBe("auto");
    expect(px(group["padding-inline"])).toBe(outset);
    expect(px(group["margin-inline"])).toBe(-outset);
  });

  it("the sticky header covers the outset of rows scrolling under it", () => {
    const header = rule(list, ".wb-group > .wb-group-h");
    expect(px(header["padding-inline"])).toBe(outset);
    expect(px(header["margin-inline"])).toBe(-outset);
  });
});

describe("form layout", () => {
  const fieldGap = px(rule(forms, ".wb-field + .wb-field")["margin-top"]);

  it("wb-form-stack is a column spaced like consecutive fields", () => {
    const stack = rule(forms, ".wb-form-stack");
    expect(stack.display).toBe("flex");
    expect(stack["flex-direction"]).toBe("column");
    expect(px(stack.gap)).toBe(fieldGap);
    expect(stack["min-width"]).toBe("0");
  });

  it("a fieldset stack loses the fieldset frame", () => {
    expect(rule(forms, "fieldset.wb-form-stack")).toEqual({
      margin: "0",
      padding: "0",
      border: "0",
    });
  });

  it("wb-form-row wraps fields side by side, top-aligned, with other children at the bottom", () => {
    const row = rule(forms, ".wb-form-row");
    expect(row.display).toBe("flex");
    expect(row["flex-wrap"]).toBe("wrap");
    expect(row["align-items"]).toBe("flex-start");
    expect(px(row.gap?.split(/\s+/)[0])).toBe(fieldGap);
    expect(rule(forms, ".wb-form-row > .wb-field").flex).toBe("1 1 200px");
    expect(rule(forms, ".wb-form-row > :not(.wb-field)")["align-self"]).toBe(
      "flex-end",
    );
  });

  it("the gaps replace the fields' own margins, after the field rule", () => {
    const selector =
      ".wb-form-stack > :is(.wb-field, .wb-form-error),\n  .wb-form-row > .wb-field";
    expect(rule(forms, selector)["margin-top"]).toBe("0");
    // same specificity as .wb-field + .wb-field: source order decides
    expect(forms.indexOf(".wb-form-stack > :is(")).toBeGreaterThan(
      forms.indexOf(".wb-field + .wb-field"),
    );
  });

  it("is documented in the class inventory", () => {
    expect(readme).toContain("`wb-form-stack`, `wb-form-row`");
    expect(readme).toContain("**Form layout.**");
  });
});

describe("small switch", () => {
  // the knob starts `inset` from the left and travels to `inset` from the right
  function geometry(base: string) {
    const track = rule(forms, base);
    const knob = rule(forms, `${base}::after`);
    const on = rule(forms, `${base}:checked::after`);
    return {
      width: px(track.width),
      height: px(track.height),
      knob: px(knob.width),
      knobHeight: px(knob.height),
      travel: px(/translateX\(([\d.]+)px\)/.exec(on.transform ?? "")?.[1]),
    };
  }
  const inset = px(rule(forms, ".wb-switch::after").left);

  it.each([
    [".wb-switch", 34, 20],
    [".wb-switch--sm", 26, 16],
  ])("%s is %ix%i and its knob ends where it started", (base, w, h) => {
    const g = geometry(base);
    expect([g.width, g.height]).toEqual([w, h]);
    expect(g.knob).toBe(g.knobHeight);
    expect(g.knob + 2 * inset).toBe(g.height);
    expect(inset + g.knob + g.travel + inset).toBe(g.width);
  });

  it("comes after the default switch rules (equal specificity)", () => {
    expect(forms.indexOf(".wb-switch--sm:checked::after")).toBeGreaterThan(
      forms.indexOf(".wb-switch:checked::after"),
    );
  });
});

describe("disabled wb-link", () => {
  it("only underlines on hover while enabled", () => {
    const hover = rule(
      utilities,
      '.wb-link:not(:disabled, [aria-disabled="true"]):hover',
    );
    expect(hover["text-decoration"]).toBe("underline");
    expect(utilities).not.toMatch(/\.wb-link:hover\s*\{/);
  });

  it("is muted with a default cursor", () => {
    const disabled = rule(
      utilities,
      '.wb-link:disabled,\n  .wb-link[aria-disabled="true"]',
    );
    expect(disabled.color).toBe("var(--wb-muted)");
    expect(disabled.cursor).toBe("default");
  });
});
