import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("licence", () => {
  const root = resolve(__dirname, "..");

  it("the kit is MIT licensed", () => {
    const license = readFileSync(resolve(root, "LICENSE"), "utf8");
    expect(license).toMatch(/^MIT License\n\nCopyright \(c\) 2026 /);
    const pkg = JSON.parse(
      readFileSync(resolve(root, "package.json"), "utf8"),
    ) as { license?: string; private?: boolean };
    expect(pkg.license).toBe("MIT");
    const readme = readFileSync(resolve(root, "README.md"), "utf8");
    expect(readme).toContain("## License");
  });

  it("includes the MIT license in the vendored source snapshot", () => {
    expect(readFileSync(resolve(root, "src/LICENSE"), "utf8")).toBe(
      readFileSync(resolve(root, "LICENSE"), "utf8"),
    );
  });
});
