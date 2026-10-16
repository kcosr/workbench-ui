#!/usr/bin/env node
// Verify bounded navigation and wrapping in both gallery themes.
// Usage: node scripts/page-pager-check.mjs [baseUrl] [outDir]
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, expect } from "@playwright/test";

const base = process.argv[2] ?? "http://127.0.0.1:5190/";
const out = process.argv[3];
if (out) mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const results = [];
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(new URL("#/components", base).href);
    for (const theme of ["light", "dark"]) {
      const pager = page.getByRole("navigation", {
        name: `${theme} example pagination`,
      });
      const previous = pager.getByRole("button", { name: "Previous" });
      const next = pager.getByRole("button", { name: "Next" });
      await expect(previous).toBeDisabled();
      await next.press("Enter");
      await expect(pager.getByRole("status")).toHaveText(
        "51–100 of 230 records",
      );
      await expect(next).toBeFocused();
      for (let i = 0; i < 3; i++) await next.click();
      await expect(pager.getByRole("status")).toHaveText(
        "201–230 of 230 records",
      );
      await expect(next).toBeDisabled();
      await previous.press("Enter");
      await expect(pager.getByRole("status")).toHaveText(
        "151–200 of 230 records",
      );
      const loading = page.getByRole("navigation", {
        name: `${theme} loading pagination`,
      });
      for (const control of await loading.getByRole("link").all()) {
        await expect(control).toHaveAttribute("aria-disabled", "true");
        await expect(control).not.toHaveAttribute("href");
      }
      for (const target of [pager, loading]) {
        const fits = await target.evaluate((element) => {
          const outer = element.getBoundingClientRect();
          return [
            ...element.querySelectorAll("button, a, [role=status]"),
          ].every((child) => {
            const inner = child.getBoundingClientRect();
            return (
              inner.left >= outer.left - 1 && inner.right <= outer.right + 1
            );
          });
        });
        expect(fits, `${theme} pager contents fit at ${width}px`).toBe(true);
      }
      if (out)
        await pager.screenshot({
          path: join(out, `pager-${theme}-${width}.png`),
        });
      results.push({ theme, width, passed: true });
      console.log(
        `ok bounds, keyboard, loading links and wrapping: ${theme} ${width}`,
      );
    }
    expect(errors).toEqual([]);
    await page.close();
  }
} finally {
  await browser.close();
  if (out)
    writeFileSync(
      join(out, "page-pager-results.json"),
      JSON.stringify(results, null, 2) + "\n",
    );
}
