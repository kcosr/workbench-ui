#!/usr/bin/env node
// Check the styles' computed results in Chromium, light and dark: a quiet
// subtree inside a default-style page gets the quiet font and tokens; Brand
// keeps its default spacing in a sidebar unless the shell has no top bar;
// hovered quiet sidebar items keep their counts at WCAG AA; the expanded
// textarea editor gets its own size over the modal's, on desktop and full
// screen below 640px. The gallery dev server must be running.
// Usage: node scripts/style-check.mjs [baseUrl]
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "http://127.0.0.1:5190/";
const failures = [];
const check = (ok, message) => {
  if (!ok) failures.push(message);
  console.log(`${ok ? "ok  " : "FAIL"} ${message}`);
};

/** rgb(), rgba() or color(srgb …) as [r, g, b, a] in 0–255 (alpha 0–1). */
function rgba(value) {
  const nums = (value.match(/[\d.]+/g) ?? []).map(Number);
  if (value.startsWith("color(srgb"))
    return [nums[0] * 255, nums[1] * 255, nums[2] * 255, nums[3] ?? 1];
  return [nums[0], nums[1], nums[2], nums[3] ?? 1];
}
const over = ([r, g, b, a], [br, bg, bb]) => [
  r * a + br * (1 - a),
  g * a + bg * (1 - a),
  b * a + bb * (1 - a),
  1,
];
const luminance = ([r, g, b]) => {
  const lin = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const browser = await chromium.launch();
try {
  for (const theme of ["light", "dark"]) {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 800 },
    });

    // A default-style page with a quiet subtree and Brand in sidebars.
    await page.goto(new URL(`?theme=${theme}&style=default#/`, base).href);
    await page.waitForSelector(".wb-app");
    const fixture = await page.evaluate(() => {
      const host = document.createElement("div");
      host.innerHTML = `
        <div data-wb-style="quiet" id="q">
          <p id="q-text">Quiet text</p>
          <span class="wb-mono" id="q-mono">run_954d</span>
          <span class="wb-muted" id="q-muted">muted</span>
          <div data-theme="dark"><span class="wb-muted" id="q-dark-muted">muted</span></div>
        </div>
        <span class="wb-brand" id="b-alone">Brand</span>
        <aside class="wb-sidebar"><span class="wb-brand" id="b-plain">Brand</span></aside>
        <div class="wb-app"><div class="wb-sidebar-pane"><aside class="wb-sidebar">
          <span class="wb-brand" id="b-topbar">Brand</span></aside></div></div>
        <div class="wb-app wb-app--no-topbar"><div class="wb-sidebar-pane"><aside class="wb-sidebar">
          <span class="wb-brand" id="b-nav">Brand</span></aside></div></div>`;
      document.body.append(host);
      const cs = (id) => getComputedStyle(document.getElementById(id));
      return {
        body: getComputedStyle(document.body).fontFamily,
        text: cs("q-text").fontFamily,
        mono: cs("q-mono").fontFamily,
        muted: cs("q-muted").color,
        darkMuted: cs("q-dark-muted").color,
        alone: cs("b-alone").margin,
        plain: cs("b-plain").margin,
        inTopbarShell: cs("b-topbar").margin,
        inNavShell: cs("b-nav").margin,
      };
    });
    check(
      fixture.body.startsWith('"Inter Variable"'),
      `${theme}: the default page is set in Inter (${fixture.body.split(",")[0]})`,
    );
    check(
      fixture.text.startsWith('"IBM Plex Sans"'),
      `${theme}: a quiet subtree in a default page is set in IBM Plex Sans (${fixture.text.split(",")[0]})`,
    );
    check(
      fixture.mono.startsWith('"IBM Plex Mono"'),
      `${theme}: its identifiers in IBM Plex Mono (${fixture.mono.split(",")[0]})`,
    );
    check(
      fixture.muted === "rgb(114, 111, 104)" &&
        fixture.darkMuted === "rgb(138, 135, 128)",
      `${theme}: its tokens are quiet, a data-theme inside picks quiet light or dark (${fixture.muted}, ${fixture.darkMuted})`,
    );
    check(
      fixture.plain === fixture.alone &&
        fixture.inTopbarShell === fixture.alone,
      `${theme}: Brand in a default Sidebar keeps its default spacing (${fixture.alone}; in a Sidebar ${fixture.plain}, in a top-bar shell ${fixture.inTopbarShell})`,
    );
    check(
      fixture.inNavShell === "2px 8px 12px",
      `${theme}: Brand in a shell without a top bar gets the sidebar spacing (${fixture.inNavShell})`,
    );

    // Quiet: hovered sidebar items keep their counts at AA.
    await page.goto(new URL(`?theme=${theme}&style=quiet#/`, base).href);
    await page.waitForSelector(".wb-side-item");
    const body = await page.evaluate(
      () => getComputedStyle(document.body).fontFamily,
    );
    check(
      body.startsWith('"IBM Plex Sans"'),
      `${theme}: a quiet page is set in IBM Plex Sans`,
    );
    const item = page
      .locator(".wb-side-item:not([aria-current])")
      .filter({ has: page.locator(".wb-side-item-count") })
      .first();
    await item.hover();
    await page.waitForTimeout(200);
    const hovered = await item.evaluate((el) => ({
      label: el.querySelector(".wb-side-item-label").textContent,
      count: getComputedStyle(el.querySelector(".wb-side-item-count")).color,
      background: getComputedStyle(el).backgroundColor,
      side: getComputedStyle(el.closest(".wb-sidebar")).backgroundColor,
    }));
    const ratio = contrast(
      rgba(hovered.count),
      over(rgba(hovered.background), rgba(hovered.side)),
    );
    check(
      ratio >= 4.5,
      `${theme}: a hovered quiet sidebar item ("${hovered.label}") keeps its count at ${ratio.toFixed(2)}:1`,
    );
    await page.close();
  }

  // The expanded editor: 1120px wide (at most 94vw), 90vh tall and 5vh from
  // the top on desktop; the whole viewport below 640px.
  for (const [width, height] of [
    [1280, 800],
    [600, 800],
  ]) {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.goto(new URL("?theme=light#/components", base).href);
    await page.waitForSelector(".wb-expandable-textarea");
    await page
      .locator(".wb-expandable-textarea-actions button")
      .first()
      .click();
    const box = await page.locator(".wb-textarea-editor").evaluate((el) => {
      const r = el.getBoundingClientRect();
      return [r.left, r.top, r.width, r.height].map(Math.round);
    });
    const want =
      width > 640
        ? [
            Math.round((width - Math.min(1120, width * 0.94)) / 2),
            Math.round(height * 0.05),
            Math.round(Math.min(1120, width * 0.94)),
            Math.round(height * 0.9),
          ]
        : [0, 0, width, height];
    check(
      box.every((v, i) => Math.abs(v - want[i]) <= 1),
      `expanded editor at ${width}×${height}: x, y, width, height ${box.join(", ")} (want ${want.join(", ")})`,
    );
    await page.close();
  }
} finally {
  await browser.close();
}
if (failures.length) {
  console.error(`${failures.length} style check(s) failed`);
  process.exit(1);
}
