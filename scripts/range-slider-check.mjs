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
      const thumbPosition = async (slider) =>
        slider.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          const thumb = parseFloat(
            getComputedStyle(element).getPropertyValue("--wb-range-thumb-size"),
          );
          const min = Number(element.min);
          const max = Number(element.max);
          const fraction =
            max === min ? 0.5 : (element.valueAsNumber - min) / (max - min);
          return rect.left + thumb / 2 + (rect.width - thumb) * fraction;
        });
      await lower.scrollIntoViewIfNeeded();
      const lowerBefore = await thumbPosition(lower);
      await upper.press("Home");
      await expect(upper).toHaveValue("2");
      await expect(lower).toHaveValue("1");
      expect(Math.abs((await thumbPosition(lower)) - lowerBefore)).toBeLessThan(
        0.1,
      );
      await upper.press("End");
      await expect(upper).toHaveValue("6");
      const upperBefore = await thumbPosition(upper);
      await lower.press("End");
      await expect(lower).toHaveValue("5");
      expect(Math.abs((await thumbPosition(upper)) - upperBefore)).toBeLessThan(
        0.1,
      );
      await lower.press("Home");
      await lower.press("ArrowRight");
      await upper.press("ArrowLeft");
      await expect(lower).toHaveValue("1");
      await expect(upper).toHaveValue("5");
      // The same full-rail position selects the same value after the peer moves.
      const rail = lower.locator("..");
      const railBox = await rail.boundingBox();
      if (!railBox) throw new Error("Lower rail has no layout");
      const atOne = railBox.x + 8 + (railBox.width - 16) / 6;
      await lower.press("Home");
      await page.mouse.click(atOne, railBox.y + railBox.height / 2);
      await expect(lower).toHaveValue("1");
      await upper.press("Home");
      await lower.press("Home");
      await page.mouse.click(atOne, railBox.y + railBox.height / 2);
      await expect(lower).toHaveValue("1");
      await upper.press("End");
      await upper.press("ArrowLeft");
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
      const disabledStyle = await disabled.evaluate((element) => {
        const legend = element.querySelector("legend");
        const label = element.querySelector(".wb-range-slider-label");
        const value = element.querySelector(".wb-range-slider-value");
        const input = element.querySelector("input");
        return {
          colors: [legend, label, value].map(
            (node) => getComputedStyle(node).color,
          ),
          cursor: getComputedStyle(input).cursor,
        };
      });
      expect(new Set(disabledStyle.colors).size).toBe(1);
      expect(disabledStyle.cursor).toBe("not-allowed");
      const row = column.locator('[data-gal="range-row"]');
      const rowLayout = await row.evaluate((element) => {
        const field = element.querySelector(".wb-field");
        const range = element.querySelector(".wb-range-slider");
        return {
          fieldFlex: getComputedStyle(field).flex,
          rangeFlex: getComputedStyle(range).flex,
          rangeAlign: getComputedStyle(range).alignSelf,
          margin: getComputedStyle(range).marginTop,
        };
      });
      expect(rowLayout.fieldFlex).toBe(rowLayout.rangeFlex);
      expect(rowLayout.rangeAlign).toBe("flex-start");
      expect(rowLayout.margin).toBe("0px");
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
        `ok native keyboard, focus, stable thumb/pointer scale, disabled, controlled reset, and form layout: ${theme} ${width}`,
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
