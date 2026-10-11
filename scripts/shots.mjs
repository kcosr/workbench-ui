#!/usr/bin/env node
// Screenshot the gallery (dev server or preview must be running).
// Usage: node scripts/shots.mjs [baseUrl] [outDir]
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "http://127.0.0.1:5190/";
const out = process.argv[3] ?? "shots";
mkdirSync(out, { recursive: true });

const shots = [
  { name: "01-events-light", url: "?theme=light#/" },
  { name: "02-events-dark", url: "?theme=dark#/" },
  { name: "03-drawer-light", url: "?theme=light#/?item=ev-4819" },
  { name: "04-drawer-dark", url: "?theme=dark#/?item=ev-4819" },
  { name: "05-palette", url: "?theme=light#/", palette: "al" },
  { name: "06-palette-dark", url: "?theme=dark#/", palette: "" },
  { name: "07-modal", url: "?theme=light#/?modal=new" },
  { name: "08-settings", url: "?theme=light#/settings" },
  { name: "09-settings-dark", url: "?theme=dark#/settings" },
  {
    name: "10-rules-wide-drawer",
    url: "?theme=light#/rules?rule=r-regex-aws&draft=1",
  },
  { name: "11-person", url: "?theme=light#/people/u-alice" },
  {
    name: "12-compact-cursor",
    url: "?theme=light#/?density=compact",
    keys: ["j", "j", "j"],
  },
  {
    name: "13-1024-drawer",
    url: "?theme=light#/?item=ev-4819",
    width: 1024,
    height: 720,
  },
  { name: "14-1024-list", url: "?theme=light#/", width: 1024, height: 720 },
  {
    name: "15-1024-wide-drawer",
    url: "?theme=dark#/rules?rule=r-regex-aws",
    width: 1024,
    height: 720,
  },
  { name: "16-components", url: "?theme=light#/components", height: 4400 },
  {
    name: "17-menu",
    url: "?theme=light#/",
    click: 'button[aria-label^="Theme"]',
  },
  { name: "18-loading", url: "?theme=light#/?loading=1&refetch=1" },
  {
    name: "19-confirm-error",
    url: "?theme=light#/rules?rule=r-regex-aws",
    clickText: "Delete",
    thenText: "Delete rule",
  },
  { name: "22-skip-link", url: "?theme=light#/", keys: ["Tab"] },
  {
    name: "24-1024-crowded-topbar",
    url: "?theme=light&crowded=1#/rules",
    width: 1024,
    height: 720,
  },
  {
    name: "25-900-crowded-more",
    url: "?theme=light&crowded=1#/rules",
    width: 900,
    height: 720,
    click: ".wb-nav-more-btn",
  },
  { name: "20-palette-long-hint", url: "?theme=light#/", palette: "aws" },
  {
    name: "21-1024-compact-drawer",
    url: "?theme=light#/?density=compact&item=ev-4819",
    width: 1024,
    height: 720,
  },
  // Tables (#/tables): one per variant, light and dark at 1440.
  ...[
    ["grants", ""],
    ["people", "?v=people"],
    ["activity", "?v=activity"],
    ["rules-compact", "?v=rules"],
  ].flatMap(([name, query], i) =>
    ["light", "dark"].map((theme, t) => ({
      name: `${26 + i * 2 + t}-tables-${name}-${theme}`,
      url: `?theme=${theme}#/tables${query}`,
      width: 1440,
      height: 900,
      // Activity: put the cursor on a row so new turns are held ("N new · Show").
      ...(name === "activity" ? { keys: ["j", "j"], wait: 5800 } : {}),
      ...(name === "grants" ? { keys: ["j", "j", "j"] } : {}),
    })),
  ),
  {
    name: "34-tables-grants-1024-drawer",
    url: "?theme=light#/tables?item=g-105",
    width: 1024,
    height: 720,
  },
  { name: "35-tables-loading", url: "?theme=light#/tables?state=loading" },
  // small tables under static section titles; fit columns, StateCell,
  // capped IDs, wrapping section actions next to a drawer
  {
    name: "37-tables-sections-1440",
    url: "?theme=light#/tables?v=sections",
    width: 1440,
    height: 700,
  },
  {
    name: "38-tables-sections-1024-drawer",
    url: "?theme=light#/tables?v=sections&item=tok-91c0",
    width: 1024,
    height: 720,
  },
  // a failed refetch: the error sits above the rows, which stay (stale)
  {
    name: "39-tables-refetch-error",
    url: "?theme=light#/tables?state=stale",
    width: 1440,
    height: 700,
  },
  // p3 columns survive a 1024px window with the sidebar and no drawer
  {
    name: "36-tables-grants-1024-sidebar",
    url: "?theme=light#/tables",
    width: 1024,
    height: 720,
  },
];

const only = process.env.ONLY ? new RegExp(process.env.ONLY) : null;
const browser = await chromium.launch();
try {
  for (const s of shots) {
    if (only && !only.test(s.name)) continue;
    const page = await browser.newPage({
      viewport: { width: s.width ?? 1280, height: s.height ?? 800 },
      deviceScaleFactor: 2,
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error" || m.type() === "warning") errors.push(m.text());
    });
    await page.goto(new URL(s.url, base).href);
    await page.waitForSelector(".wb-app");
    await page.evaluate(() => document.fonts.ready);
    if (s.palette !== undefined) {
      await page.keyboard.press("Control+k");
      await page.waitForSelector(".wb-palette");
      if (s.palette) await page.keyboard.type(s.palette, { delay: 30 });
      await page.waitForTimeout(600);
    }
    if (s.keys) await page.mouse.move(4, (s.height ?? 800) - 4);
    for (const key of s.keys ?? []) await page.keyboard.press(key);
    if (s.wait) await page.waitForTimeout(s.wait);
    if (s.click) {
      await page.click(s.click);
      await page.waitForTimeout(200);
    }
    if (s.clickText) {
      await page
        .getByRole("button", { name: s.clickText, exact: true })
        .first()
        .click();
      await page.waitForTimeout(200);
      if (s.thenText) {
        await page
          .getByRole("button", { name: s.thenText, exact: true })
          .click();
        await page.waitForTimeout(800);
      }
    }
    await page.waitForTimeout(300);
    await page.screenshot({
      path: join(out, `${s.name}.png`),
      fullPage: !!s.fullPage,
    });
    if (errors.length) console.log(`${s.name}: ${errors.join(" | ")}`);
    else console.log(`${s.name}: ok`);
    await page.close();
  }
} finally {
  await browser.close();
}
