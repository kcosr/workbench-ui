import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "..", "src");
const read = (p: string) => readFileSync(join(root, p), "utf8");
const cssFiles = readdirSync(join(root, "styles")).filter((f) =>
  f.endsWith(".css"),
);
const tsFiles = [
  ...readdirSync(join(root, "components")).map((f) => `components/${f}`),
  ...readdirSync(join(root, "lib")).map((f) => `lib/${f}`),
  "index.ts",
];

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

describe("CSS conventions", () => {
  it("every class is wb- prefixed (state classes use is-)", () => {
    const bad = new Set<string>();
    for (const f of cssFiles) {
      const css = stripComments(read(`styles/${f}`))
        .replace(/url\([^)]*\)/g, "")
        .replace(/@(layer|import)[^{;]*/g, "");
      for (const m of css.matchAll(/(?<![\w-])\.(-?[a-zA-Z_][\w-]*)/g)) {
        const name = m[1] ?? "";
        if (/^\d/.test(name)) continue;
        if (!name.startsWith("wb-") && !name.startsWith("is-"))
          bad.add(`${f}: .${name}`);
      }
    }
    expect([...bad]).toEqual([]);
  });

  it("every custom property is --wb- prefixed", () => {
    const bad: string[] = [];
    for (const f of cssFiles) {
      const css = stripComments(read(`styles/${f}`));
      for (const m of css.matchAll(/(?<![\w-])--([a-zA-Z][\w-]*)/g)) {
        if (!(m[1] ?? "").startsWith("wb-")) bad.push(`${f}: --${m[1]}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("all rules live inside @layer wb.*", () => {
    for (const f of cssFiles) {
      if (f === "index.css") continue;
      const css = stripComments(read(`styles/${f}`)).trim();
      expect(css, f).toMatch(/^@layer wb\.[a-z]+ \{/);
      // Top level holds only @layer blocks.
      let depth = 0;
      let top = "";
      for (const ch of css) {
        if (ch === "{") depth++;
        if (depth === 0) top += ch;
        if (ch === "}") depth--;
      }
      expect(top.replace(/@layer wb\.[a-z]+\s*/g, "").trim(), f).toBe("");
    }
  });

  it("index.css declares the layer order and imports every stylesheet", () => {
    const index = read("styles/index.css");
    expect(index).toContain(
      "@layer wb.fonts, wb.tokens, wb.base, wb.components, wb.tones, wb.utilities;",
    );
    for (const f of cssFiles)
      if (f !== "index.css") expect(index).toContain(`@import "./${f}";`);
  });

  it("fonts are relative file urls (no CDN, no data:)", () => {
    const fonts = read("styles/fonts.css");
    const urls = [...fonts.matchAll(/url\("([^"]+)"\)/g)].map((m) => m[1]);
    expect(urls.length).toBe(19);
    for (const u of urls)
      expect(u).toMatch(/^\.\.\/fonts\/[\w-]+\.woff2\?no-inline$/);
    for (const f of cssFiles)
      expect(read(`styles/${f}`)).not.toMatch(/url\(\s*["']?(data:|https?:)/);
  });
});

describe("repository hygiene", () => {
  it("tracks no symlinks (e.g. a node_modules link from a worktree)", () => {
    const kit = resolve(__dirname, "..");
    const links = execFileSync("git", ["-C", kit, "ls-files", "-s"], {
      encoding: "utf8",
    })
      .split("\n")
      .filter((l) => l.startsWith("120000"));
    expect(links).toEqual([]);
  });
});

describe("CSP safety of the sources", () => {
  it("never injects styles or scripts", () => {
    for (const f of tsFiles) {
      const src = read(f);
      expect(src, f).not.toMatch(
        /dangerouslySetInnerHTML|innerHTML|insertRule|createElement\(\s*["'](style|script)["']|\beval\(|new Function\(|setAttribute\(\s*["']style["']|cssText/,
      );
    }
  });

  it("has no runtime imports beyond React", () => {
    for (const f of tsFiles) {
      for (const m of read(f).matchAll(
        /^import\s+(?!type\b)[^"']*["']([^"']+)["']/gm,
      )) {
        const spec = m[1] ?? "";
        expect(
          spec.startsWith(".") || spec === "react" || spec === "react-dom",
          `${f}: ${spec}`,
        ).toBe(true);
      }
    }
  });
});
