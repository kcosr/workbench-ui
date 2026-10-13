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

// Browser-native PNG decoding samples the actual painting, including vendor
// thumb pseudo-elements whose computed styles Chromium does not expose.
async function forcedRangePaint(track, disabled) {
  const geometry = await track.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const input = element.querySelector("input");
    const inputRect = input.getBoundingClientRect();
    const selected = element
      .querySelector(".wb-range-slider-selection")
      .getBoundingClientRect();
    const thumb = parseFloat(
      getComputedStyle(input).getPropertyValue("--wb-range-thumb-size"),
    );
    const minimum = Number(input.min);
    const maximum = Number(input.max);
    const fraction =
      minimum === maximum
        ? 0.5
        : (input.valueAsNumber - minimum) / (maximum - minimum);
    const swatch = document.createElement("span");
    swatch.style.forcedColorAdjust = "none";
    element.append(swatch);
    const colors = {};
    for (const name of [
      "Canvas",
      "CanvasText",
      "Highlight",
      "ButtonText",
      "GrayText",
    ]) {
      swatch.style.color = name;
      colors[name] = getComputedStyle(swatch).color;
    }
    swatch.remove();
    return {
      rail: (thumb / 2 + selected.left - rect.left) / 2,
      selection: selected.left - rect.left + selected.width / 2,
      thumb:
        inputRect.left -
        rect.left +
        thumb / 2 +
        (inputRect.width - thumb) * fraction,
      width: rect.width,
      y: rect.height / 2,
      colors,
    };
  });
  const png = (await track.screenshot()).toString("base64");
  const painted = await track.page().evaluate(
    async ({ png, geometry }) => {
      const bitmap = await createImageBitmap(
        new Blob([Uint8Array.from(atob(png), (char) => char.charCodeAt(0))], {
          type: "image/png",
        }),
      );
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const context = canvas.getContext("2d");
      context.drawImage(bitmap, 0, 0);
      const sample = (x, y = geometry.y) => [
        ...context.getImageData(Math.round(x), Math.round(y), 1, 1).data,
      ];
      const offThumb =
        geometry.thumb + 20 < geometry.width
          ? geometry.thumb + 20
          : geometry.thumb - 20;
      const result = {
        rail: sample(geometry.rail),
        selection: sample(geometry.selection),
        // Six pixels above the rail is inside the 16px thumb circle, but
        // outside both the rail and selection. The centre row cannot prove
        // thumb visibility when their system colors coincide.
        thumb: sample(geometry.thumb, geometry.y - 6),
        offThumb: sample(offThumb, geometry.y - 6),
        expected: {},
      };
      for (const [name, color] of Object.entries(geometry.colors)) {
        context.fillStyle = color;
        context.fillRect(0, 0, 1, 1);
        result.expected[name] = [...context.getImageData(0, 0, 1, 1).data];
      }
      bitmap.close();
      return result;
    },
    { png, geometry },
  );
  expect(painted.offThumb, "off-thumb pixel must be Canvas").toEqual(
    painted.expected.Canvas,
  );
  for (const [part, system] of [
    ["rail", "CanvasText"],
    ["selection", "Highlight"],
    ["thumb", "ButtonText"],
  ]) {
    expect(
      painted[part],
      `${disabled ? "disabled " : ""}${part} system color`,
    ).toEqual(painted.expected[disabled ? "GrayText" : system]);
    expect(painted[part], `${part} must contrast with Canvas`).not.toEqual(
      painted.expected.Canvas,
    );
  }
}
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
      await page.emulateMedia({ forcedColors: "active" });
      await lower.press("ArrowRight");
      await upper.press("ArrowLeft");
      await expect(lower).toHaveValue("1");
      await expect(upper).toHaveValue("5");
      for (const track of await group.locator(".wb-range-slider-track").all()) {
        await forcedRangePaint(track, false);
      }
      for (const track of await disabled
        .locator(".wb-range-slider-track")
        .all()) {
        await forcedRangePaint(track, true);
      }
      if (out) {
        await group.screenshot({
          path: join(out, `range-forced-${theme}-${width}.png`),
        });
        await disabled.screenshot({
          path: join(out, `range-forced-disabled-${theme}-${width}.png`),
        });
      }
      // Mutation probe: every enabled/disabled thumb must be detected when
      // hidden, even where rail and thumb normally share one system color.
      const hiddenThumbs = await page.addStyleTag({
        content: `
        @media (forced-colors: active) {
          .wb-range-slider input[type="range"]::-webkit-slider-thumb {
            background: transparent !important;
            border-color: transparent !important;
          }
        }
      `,
      });
      try {
        for (const [target, isDisabled] of [
          [group, false],
          [disabled, true],
        ]) {
          for (const track of await target
            .locator(".wb-range-slider-track")
            .all()) {
            await expect(forcedRangePaint(track, isDisabled)).rejects.toThrow(
              /thumb system color/,
            );
          }
        }
      } finally {
        await hiddenThumbs.evaluate((element) => element.remove());
      }
      await page.emulateMedia({ forcedColors: "none" });
      results.push({
        theme,
        width,
        forcedColors: true,
        hiddenThumbsRejected: 4,
        passed: true,
      });
      console.log(
        `ok native keyboard, focus, stable thumb/pointer scale, disabled, controlled reset, form layout, forced-colors painted parts, and hidden-thumb mutation: ${theme} ${width}`,
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
