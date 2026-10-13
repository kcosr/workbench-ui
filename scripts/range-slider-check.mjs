#!/usr/bin/env node
// Verify real native range keyboard behavior, which jsdom does not implement.
// Usage: node scripts/range-slider-check.mjs [baseUrl] [outDir]
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, expect } from "@playwright/test";

const base = process.argv[2] ?? "http://127.0.0.1:5190/";
const out = process.argv[3];
if (out) mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const results = [];
try {
  for (const width of [1440, 1024]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(new URL("#/components", base).href);
    for (const theme of ["light", "dark"]) {
      const column = page.locator(`.gal-col[data-theme="${theme}"]`);
      const group = column.getByRole("group", {
        name: "Capacity band",
        exact: true,
      });
      const lower = group.getByRole("slider", { name: "Lower boundary" });
      const upper = group.getByRole("slider", { name: "Upper boundary" });
      await lower.focus();
      await lower.press("ArrowRight");
      await expect(lower).toHaveValue("2");
      await expect(lower).toBeFocused();
      await lower.press("End");
      await expect(lower).toHaveValue("4");
      await lower.press("ArrowRight");
      await expect(lower).toHaveValue("4");
      await lower.press("Home");
      await expect(lower).toHaveValue("0");
      await lower.press("Tab");
      await expect(upper).toBeFocused();
      await upper.press("Home");
      await expect(upper).toHaveValue("1");
      await upper.press("ArrowLeft");
      await expect(upper).toHaveValue("1");
      await upper.press("End");
      await expect(upper).toHaveValue("6");
      await expect(upper).toHaveAttribute("aria-valuetext", "No upper limit");
      await upper.press("ArrowLeft");
      await expect(upper).toHaveValue("5");
      const box = await lower.boundingBox();
      if (!box) throw new Error("Lower endpoint has no layout");
      await lower.click({
        position: { x: box.width * 0.5, y: box.height / 2 },
      });
      await expect(lower).toHaveValue("2");
      await column
        .getByRole("button", { name: "Reset capacity range" })
        .click();
      await expect(lower).toHaveValue("0");
      await expect(upper).toHaveValue("6");
      const disabled = column.getByRole("group", {
        name: "Fixed capacity",
        exact: true,
      });
      for (const slider of await disabled.getByRole("slider").all()) {
        await expect(slider).toBeDisabled();
      }
      const fits = await group.evaluate((element) => {
        const outer = element.getBoundingClientRect();
        return [...element.querySelectorAll("input, label")].every((child) => {
          const inner = child.getBoundingClientRect();
          return inner.left >= outer.left - 1 && inner.right <= outer.right + 1;
        });
      });
      expect(fits).toBe(true);
      if (out) {
        await group.screenshot({
          path: join(out, `range-${theme}-${width}.png`),
        });
      }
      results.push({ theme, width, passed: true });
      console.log(
        `ok native keyboard, focus, pointer, disabled, controlled reset, and layout: ${theme} ${width}`,
      );
    }
    expect(errors).toEqual([]);
    await page.close();
  }
} finally {
  await browser.close();
  if (out)
    writeFileSync(
      join(out, "range-slider-results.json"),
      JSON.stringify(results, null, 2) + "\n",
    );
}
