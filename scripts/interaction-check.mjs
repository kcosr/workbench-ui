#!/usr/bin/env node
// Exercise the gallery's shared palette steps, optional AppShell drawer,
// toast pause/dismiss, useConfirm, copy blocks (scrolling, wrapped and
// fallback) and sidebar reveal in Chromium. Start the gallery first; an
// optional output directory retains shots.
// Usage: node scripts/interaction-check.mjs [baseUrl] [outDir]
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, expect } from "@playwright/test";

const base = process.argv[2] ?? "http://127.0.0.1:5190/";
const out = process.argv[3];
if (out) mkdirSync(out, { recursive: true });
const results = [];
const browser = await chromium.launch();
let page;
let current = "startup";
const record = (description) => {
  results.push({ check: `${current}: ${description}`, passed: true });
  console.log(`ok  ${current}: ${description}`);
};
const shot = async (name) => {
  if (out) await page.screenshot({ path: join(out, `${name}.png`) });
};
const storageKey = "workbench-gallery:drawer-width";
const storedWidth = () =>
  page.evaluate((key) => localStorage.getItem(key), storageKey);

try {
  for (const theme of ["light", "dark"]) {
    current = theme;
    // Isolated preferences make both theme runs deterministic, including reset.
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      // Copy blocks write to the real clipboard; the check reads it back.
      permissions: ["clipboard-read", "clipboard-write"],
    });
    page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(new URL(`?theme=${theme}#/`, base).href);
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    record("requested theme applied");

    // Keep app-owned navigation state visible while exercising the kit's
    // combobox, rich rendering and input focus across multiple steps.
    await page.locator(".wb-top-search").click();
    const palette = page.getByRole("dialog", { name: "Command palette" });
    const query = palette.getByRole("combobox");
    await query.fill("Browse examples");
    await query.press("Enter");
    await expect(query).toHaveValue("");
    await expect(query).toBeFocused();
    await expect(query).toHaveAttribute("placeholder", "Choose a collection…");
    await palette.getByRole("option", { name: /^Layouts/ }).click();
    await expect(query).toHaveAttribute("placeholder", "Choose an example…");
    await expect(query).toBeFocused();
    await query.fill("Resizable");
    const example = palette.getByRole("option", {
      name: "Layouts / Resizable detail drawer",
      exact: true,
    });
    await expect(example.locator("strong mark")).toHaveText("Resizable");
    await expect(query).toHaveAttribute(
      "aria-activedescendant",
      await example.getAttribute("id"),
    );
    await shot(`${theme}-palette-step`);
    record("two-level drill-down, rich matching and active option");

    await query.press("Backspace");
    await expect(query).toHaveValue("Resizabl");
    await expect(query).toHaveAttribute("placeholder", "Choose an example…");
    await query.fill("");
    await query.press("Backspace");
    await expect(query).toHaveAttribute("placeholder", "Choose a collection…");
    await palette.getByRole("option", { name: /^Layouts/ }).click();
    await palette.getByRole("button", { name: "Back", exact: true }).click();
    await expect(query).toHaveAttribute("placeholder", "Choose a collection…");
    await expect(query).toBeFocused();
    await query.press("Backspace");
    await expect(
      palette.getByRole("button", { name: "Back", exact: true }),
    ).toHaveCount(0);
    record(
      "Backspace edits nonempty queries; empty-query/back-button navigation restores input focus",
    );

    await query.fill("Browse examples");
    await query.press("Enter");
    await palette.getByRole("option", { name: /^Layouts/ }).click();
    await query.fill("Resizable");
    await query.press("Enter");
    await expect(palette).toHaveCount(0);
    await expect(page).toHaveURL(/#\/\?item=ev-4819&resize=1$/);
    const handle = page.getByRole("separator", { name: "Details panel width" });
    const drawer = page.locator(".wb-app-drawer > .wb-drawer");
    const width = (expected) =>
      expect(handle).toHaveAttribute("aria-valuenow", String(expected));
    await expect(drawer).toBeVisible();
    await width(540);
    record(
      "selected example closes the palette and opens the resizable drawer",
    );

    await handle.focus();
    await handle.press("ArrowLeft");
    await width(550);
    await handle.press("Shift+ArrowLeft");
    await width(590);
    await expect.poll(storedWidth).toBe("590");
    record(
      "left-edge keyboard resize uses 10px and Shift 40px, persisting preference",
    );

    let box = await handle.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 60, box.y + box.height / 2, {
      steps: 6,
    });
    await page.mouse.up();
    await width(650);
    await expect.poll(storedWidth).toBe("650");
    await page.reload();
    await width(650);
    record("pointer resize persists across a full reload");

    box = await handle.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 80, box.y + box.height / 2, {
      steps: 6,
    });
    await width(730);
    await page.keyboard.press("Escape");
    await page.mouse.up();
    await width(650);
    await expect(drawer).toBeVisible();
    await expect.poll(storedWidth).toBe("650");
    record(
      "Escape cancels an in-progress drag without dismissing the drawer or saving it",
    );

    await handle.press("Home");
    await width(380);
    await handle.press("End");
    await width(900);
    await expect.poll(storedWidth).toBe("900");
    await page.setViewportSize({ width: 1024, height: 800 });
    await expect
      .poll(async () => Number(await handle.getAttribute("aria-valuenow")))
      .toBeLessThan(900);
    const mainWidth = () =>
      page
        .locator(".wb-main")
        .evaluate((node) => node.getBoundingClientRect().width);
    await expect.poll(mainWidth).toBeGreaterThanOrEqual(360);
    await expect.poll(storedWidth).toBe("900");
    const fitted = Number(await handle.getAttribute("aria-valuenow"));
    await handle.press("End");
    await width(fitted);
    await expect.poll(storedWidth).toBe("900");
    await shot(`${theme}-drawer-1024`);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await width(900);
    record(
      "Home/End bounds, 1024px main minimum, and wider preference survive viewport fitting",
    );

    await handle.dblclick();
    await width(540);
    await expect.poll(storedWidth).toBeNull();
    await page.reload();
    await width(540);
    await shot(`${theme}-drawer-reset`);
    record("double-click reset clears stored preference and survives reload");

    await handle.focus();
    await handle.press("Escape");
    await expect(drawer).toHaveCount(0);
    await expect(
      page.locator('[data-wb-row="ev-4819"] .wb-row-link'),
    ).toBeFocused();
    record("closing from the resize separator returns focus to the event row");

    await page.locator(".wb-top-search").click();
    await expect(query).toHaveValue("");
    await expect(query).toHaveAttribute(
      "placeholder",
      "Search events, people, views, actions…",
    );
    await expect(
      palette.getByRole("button", { name: "Back", exact: true }),
    ).toHaveCount(0);
    await query.press("Escape");
    await expect(palette).toHaveCount(0);
    expect(errors).toEqual([]);
    record("reopening returns to the root; no browser exceptions");

    // Toasts: the pointer or focus pauses the timer; Esc dismisses a
    // focused toast and returns focus; the toast never takes focus.
    await page.goto(new URL(`?theme=${theme}#/components`, base).href);
    await page.evaluate(() => document.fonts.ready);
    const toastEl = page.locator(".wb-toast");
    const plainToast = page.getByRole("button", { name: "Toast", exact: true });
    await plainToast.click();
    await expect(toastEl).toHaveText("Token revoked");
    await expect(plainToast).toBeFocused();
    await toastEl.hover();
    await page.waitForTimeout(3200);
    await expect(toastEl).toBeVisible();
    await shot(`${theme}-toast-hover-paused`);
    await page.mouse.move(8, 400);
    await page.waitForTimeout(700);
    await expect(toastEl).toBeVisible();
    await expect(toastEl).toHaveCount(0, { timeout: 2000 });
    record("hovering pauses a 2.2s toast; it resumes and leaves afterwards");

    const actionToast = page.getByRole("button", { name: "Toast with action" });
    await actionToast.click();
    const undo = page.getByRole("button", { name: "Undo", exact: true });
    await undo.focus();
    await page.waitForTimeout(7000);
    await expect(toastEl).toHaveText(/Rule deleted/);
    await shot(`${theme}-toast-focus-paused`);
    await undo.press("Escape");
    await expect(toastEl).toHaveCount(0);
    await expect(actionToast).toBeFocused();
    record(
      "focus inside pauses a 6s toast; Esc dismisses it and focus returns",
    );

    // useConfirm: pending while the action runs, then resolves true.
    const ask = page.getByRole("button", { name: "useConfirm (async)" });
    await ask.click();
    const confirmDialog = page.getByRole("alertdialog", {
      name: "Remove octo/atlas?",
    });
    await expect(confirmDialog).toBeVisible();
    await expect(
      confirmDialog.getByRole("button", { name: "Cancel" }),
    ).toBeFocused();
    await confirmDialog.getByRole("button", { name: "Remove" }).click();
    await expect(
      confirmDialog.getByRole("button", { name: "Remove" }),
    ).toHaveAttribute("aria-busy", "true");
    await shot(`${theme}-confirm-pending`);
    await page.keyboard.press("Escape");
    await expect(confirmDialog).toBeVisible();
    await expect(confirmDialog).toHaveCount(0, { timeout: 3000 });
    await expect(toastEl).toHaveText("Removed octo/atlas");
    await expect(ask).toBeFocused();
    await ask.click();
    await page.keyboard.press("Escape");
    await expect(confirmDialog).toHaveCount(0);
    await expect(toastEl).toHaveText("Kept octo/atlas");
    record(
      "useConfirm stays pending (not dismissible), resolves true after the action, false on Esc",
    );

    // CopyBlock: the clipboard receives the exact text and "Copied" reverts;
    // one long line scrolls rather than wrapping; Ctrl/⌘ A selects only the
    // focused block; a rejected write selects the text for a keyboard copy.
    const column = page.locator(`.gal-col[data-theme="${theme}"]`);
    const copyBlock = (label) =>
      column.locator(".wb-copy", {
        has: page.getByRole("button", { name: label, exact: true }),
      });
    const clipboard = () => page.evaluate(() => navigator.clipboard.readText());
    const selection = () =>
      page.evaluate(() => document.getSelection()?.toString() ?? "");
    const urlBlock = copyBlock("Copy server URL");
    await urlBlock.scrollIntoViewIfNeeded();
    await urlBlock.getByRole("button").click();
    await expect(urlBlock.getByRole("status")).toHaveText("Copied");
    await expect(urlBlock).toHaveClass(/\bis-copied\b/);
    expect(await clipboard()).toBe("https://server.example.com/v1");
    await shot(`${theme}-copy-block-copied`);
    await expect(urlBlock.getByRole("status")).toHaveText("", {
      timeout: 3000,
    });
    await expect(urlBlock).not.toHaveClass(/\bis-copied\b/);
    record("copy block writes the clipboard, shows Copied, then reverts");

    const commandBlock = copyBlock("Copy command");
    const commandText = commandBlock.locator("code.wb-copy-text");
    const line = await commandText.evaluate((el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      const tops = new Set(
        [...range.getClientRects()].map((r) => Math.round(r.top)),
      );
      return {
        lines: tops.size,
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        font: getComputedStyle(el).fontFamily,
      };
    });
    expect(line.lines).toBe(1);
    expect(line.scrollWidth).toBeGreaterThan(line.clientWidth);
    expect(line.font).toContain("JetBrains Mono");
    const blockBox = await commandBlock.boundingBox();
    const columnBox = await column.boundingBox();
    expect(blockBox.x + blockBox.width).toBeLessThanOrEqual(
      columnBox.x + columnBox.width,
    );
    await commandText.focus();
    await page.keyboard.press("ControlOrMeta+A");
    expect(await selection()).toBe(await commandText.textContent());
    record("a long line scrolls in one line; Ctrl/⌘ A selects only it");

    // wrap: the same long command wraps inside the block with no horizontal
    // overflow, the button stays beside its first line, and both the button
    // and a keyboard copy of the selection give the exact text.
    const lineBoxes = (locator) =>
      locator.evaluate((el) => {
        const range = document.createRange();
        range.selectNodeContents(el);
        const rects = [...range.getClientRects()].sort((a, b) => a.top - b.top);
        return {
          lines: new Set(rects.map((r) => Math.round(r.top))).size,
          firstLineMid: (rects[0].top + rects[0].bottom) / 2,
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
        };
      });
    const wrappedBlock = copyBlock("Copy wrapped command");
    const wrappedText = wrappedBlock.locator("code.wb-copy-text");
    const wrappedValue = await wrappedText.textContent();
    expect(wrappedValue).toBe(await commandText.textContent());
    const wrapped = await lineBoxes(wrappedText);
    expect(wrapped.lines).toBeGreaterThan(1);
    expect(wrapped.scrollWidth).toBeLessThanOrEqual(wrapped.clientWidth);
    const wrapButton = await wrappedBlock.getByRole("button").boundingBox();
    expect(
      Math.abs(wrapButton.y + wrapButton.height / 2 - wrapped.firstLineMid),
    ).toBeLessThanOrEqual(3);
    await wrappedBlock.getByRole("button").click();
    await expect(wrappedBlock.getByRole("status")).toHaveText("Copied");
    expect(await clipboard()).toBe(wrappedValue);
    await page.evaluate(() => navigator.clipboard.writeText("placeholder"));
    await wrappedText.focus();
    await page.keyboard.press("ControlOrMeta+A");
    expect(await selection()).toBe(wrappedValue);
    await page.keyboard.press("ControlOrMeta+C");
    expect(await clipboard()).toBe(wrappedValue);
    await shot(`${theme}-copy-block-wrapped`);

    const envBlock = copyBlock("Copy environment file");
    const envText = envBlock.locator("pre.wb-copy-text");
    const envValue = await envText.textContent();
    expect(envValue.split("\n")).toHaveLength(3);
    const env = await lineBoxes(envText);
    expect(env.lines).toBeGreaterThan(3);
    expect(env.scrollWidth).toBeLessThanOrEqual(env.clientWidth);
    await envBlock.getByRole("button").click();
    await expect(envBlock.getByRole("status")).toHaveText("Copied");
    expect(await clipboard()).toBe(envValue);
    record(
      "wrap: long lines wrap without horizontal overflow, the button stays on line one, copies are exact",
    );

    await page.evaluate(() => {
      navigator.clipboard.writeText = () =>
        Promise.reject(
          new DOMException("Write permission denied.", "NotAllowedError"),
        );
    });
    const configBlock = copyBlock("Copy config file");
    const configText = configBlock.locator("pre.wb-copy-text");
    const config = await configText.textContent();
    expect(config.split("\n")).toHaveLength(4);
    await configBlock.getByRole("button").click();
    await expect(configBlock.getByRole("status")).toHaveText(
      /^Press (Ctrl\+C|⌘C) to copy$/,
    );
    await expect(configText).toBeFocused();
    expect(await selection()).toBe(config);
    await shot(`${theme}-copy-block-manual`);
    await page.keyboard.press("ControlOrMeta+C");
    expect(await clipboard()).toBe(config);
    await page.evaluate(() => delete navigator.clipboard.writeText);
    await expect(configBlock.getByRole("status")).toHaveText("", {
      timeout: 5000,
    });
    record(
      "a rejected write selects the text, the keyboard copies it, the hint reverts",
    );

    // showSidebar: "s" reveals a collapsed sidebar and focuses its search;
    // it never toggles a shown one closed. The filter button's dot.
    await page.goto(new URL(`?theme=${theme}#/rules`, base).href);
    const sources = page.getByRole("complementary", { name: "Rule sources" });
    const sourceSearch = page.getByRole("searchbox", {
      name: "Filter sources…",
    });
    await page.getByRole("button", { name: "Hide sidebar" }).click();
    await expect(sources).toBeHidden();
    await page.keyboard.press("s");
    await expect(sources).toBeVisible();
    await expect(sourceSearch).toBeFocused();
    await expect(sourceSearch).toHaveValue("");
    await sourceSearch.press("Escape");
    await expect(sourceSearch).not.toBeFocused();
    await page.keyboard.press("s");
    await expect(sources).toBeVisible();
    await expect(sourceSearch).toBeFocused();
    record(
      "s reveals the collapsed sidebar and focuses its search; idempotent",
    );

    const usage = page.getByRole("button", { name: "Usage: Any" });
    await expect(usage.locator(".wb-btn-indicator")).toHaveCount(0);
    await usage.click();
    await page.getByRole("menuitemradio", { name: "Unused" }).click();
    const narrowed = page.getByRole("button", { name: "Usage: Unused" });
    await expect(narrowed.locator(".wb-btn-indicator")).toBeVisible();
    await expect(narrowed).toBeFocused();
    await shot(`${theme}-sidebar-indicator`);
    record("the narrowing filter shows the indicator dot; the label names it");
    expect(errors).toEqual([]);
    await context.close();
  }
} catch (error) {
  results.push({ check: current, passed: false, error: String(error) });
  console.error(error);
  try {
    await shot(`${current}-failure`);
  } catch {
    /* Keep the original failure. */
  }
  process.exitCode = 1;
} finally {
  if (out)
    writeFileSync(
      join(out, "results.json"),
      `${JSON.stringify(results, null, 2)}\n`,
    );
  await browser.close();
}
