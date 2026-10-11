#!/usr/bin/env node
// Check DataTable width rules in Chromium against the gallery's layout lab
// (#/lab) and the toolbar split. The gallery dev server must be running.
// Usage: node scripts/layout-check.mjs [baseUrl]
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "http://127.0.0.1:5190/";
const failures = [];
const check = (ok, message) => {
  if (!ok) failures.push(message);
  console.log(`${ok ? "ok  " : "FAIL"} ${message}`);
};

const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 900 },
  });
  await page.goto(new URL("?theme=light#/lab", base).href);
  await page.waitForSelector("[data-case] table");
  await page.evaluate(() => document.fonts.ready);
  // Column widths at 1000px, and each column's minimum (the widths when
  // the table is squeezed to 1px): growing columns share what is above
  // their minimums by weight.
  const widths = await page.evaluate(() => {
    const measure = (c) => {
      const cols = {};
      for (const th of c.querySelectorAll("thead th"))
        cols[th.textContent.trim()] = th.getBoundingClientRect().width;
      return cols;
    };
    const out = {};
    for (const c of document.querySelectorAll("[data-case]")) {
      const table = c.querySelector("table");
      const cols = measure(c);
      table.style.width = "1px";
      const min = measure(c);
      table.style.width = "";
      out[c.dataset.case] = { cols, min };
    }
    return out;
  });
  const share = (w, col) => w.cols[col] - w.min[col];

  // weights: Name (grow 2) gets twice Desc's (grow 1) share of the spare
  // width, although Desc's text is thousands of pixels long.
  {
    const w = widths.weights;
    const ratio = share(w, "Name") / share(w, "Desc");
    check(
      Math.abs(ratio - 2) < 0.2,
      `weights: name/desc share ratio ${ratio.toFixed(2)} ≈ 2 (name ${w.cols.Name.toFixed(0)}, desc ${w.cols.Desc.toFixed(0)})`,
    );
  }
  // grow 0: the truncating column stays at its minimum
  {
    const w = widths.grow0;
    check(
      Math.abs(share(w, "Desc")) < 2,
      `grow0: desc ${w.cols.Desc.toFixed(0)} = its minimum ${w.min.Desc.toFixed(0)}`,
    );
  }
  // unequal weights 3:1 on wrapping columns; the fixed width is kept
  {
    const w = widths.unequal;
    const ratio = share(w, "A") / share(w, "B");
    check(
      Math.abs(ratio - 3) < 0.3,
      `unequal: A/B share ratio ${ratio.toFixed(2)} ≈ 3 (A ${w.cols.A.toFixed(0)}, B ${w.cols.B.toFixed(0)})`,
    );
    check(
      Math.abs(w.cols.W - 120) < 1.5,
      `unequal: fixed W ${w.cols.W.toFixed(0)} = 120`,
    );
  }

  // fill="end": hugging columns keep their content width and the filler
  // takes the rest; the ring's right edge is on the last real column
  {
    const fill = await page.evaluate(() => {
      const c = document.querySelector('[data-case="fillEnd"]');
      const ths = [...c.querySelectorAll("thead th")];
      const filler = c.querySelector("thead th.wb-cell-filler");
      const table = c.querySelector("table").getBoundingClientRect().width;
      const row = c.querySelector("tr.is-cursor");
      const cells = [...row.children];
      const ring = (el) => {
        const s = getComputedStyle(el);
        return {
          r: s.getPropertyValue("--wb-ring-r").trim(),
          shadow: s.boxShadow,
        };
      };
      const idCap = c.querySelector("td .wb-cell-hug");
      return {
        table,
        filler: filler.getBoundingClientRect().width,
        real: ths
          .filter((t) => t !== filler)
          .reduce((a, t) => a + t.getBoundingClientRect().width, 0),
        lastReal: ring(cells[cells.length - 2]),
        fillerCell: ring(cells[cells.length - 1]),
        fillerHidden: filler.getAttribute("aria-hidden"),
        idTitle: idCap.closest("td").title,
        idCapped: idCap.scrollWidth > idCap.clientWidth + 0.5,
      };
    });
    check(
      fill.filler > fill.table * 0.5 && fill.real < fill.table * 0.5,
      `fillEnd: real columns ${fill.real.toFixed(0)}px, filler ${fill.filler.toFixed(0)}px of ${fill.table.toFixed(0)}px`,
    );
    check(
      fill.lastReal.r === "1.5px" && fill.fillerCell.shadow === "none",
      `fillEnd: ring right edge on the last real column (--wb-ring-r ${fill.lastReal.r || "unset"}), none on the filler`,
    );
    check(
      fill.fillerHidden === "true" &&
        fill.idCapped &&
        fill.idTitle.includes("3f9d2c1e"),
      "fillEnd: filler aria-hidden; hugged ID capped with its full value as title",
    );
    const spread = widths.fillSpread.cols;
    check(
      spread.Name > widths.fillEnd.cols.Name * 3,
      `fillSpread: the name grows by default (${spread.Name.toFixed(0)}px vs ${widths.fillEnd.cols.Name.toFixed(0)}px hugged)`,
    );
  }

  // fill="end" with a growing column: the filler takes nothing (no padding
  // either), in a card and in compact density
  for (const v of ["card", "compact"]) {
    const w = await page.evaluate((v) => {
      const c = document.querySelector(`[data-case="fillGrow-${v}"]`);
      return [...c.querySelectorAll(".wb-cell-filler")].map(
        (el) => el.getBoundingClientRect().width,
      );
    }, v);
    check(
      w.length > 0 && w.every((x) => x < 0.5),
      `fillGrow-${v}: filler cells ${w.map((x) => x.toFixed(1)).join("/")}px wide`,
    );
  }

  // Audit: hug columns shrink with an ellipsis in a narrow pane (no
  // overflow), and show full values packed left in a wide one
  {
    const audit = await page.evaluate(() => {
      const measure = (id) => {
        const host = document.querySelector(`[data-case="${id}"]`);
        const table = host.querySelector("table");
        const list = table.parentElement;
        const row = table.querySelector('tr[data-wb-row="a1"]');
        const hugs = [...row.querySelectorAll(".wb-cell-hug")].map((h) => {
          const inner = h.firstElementChild;
          const cell = h.closest("td, th");
          return {
            clipped: inner.scrollWidth > inner.clientWidth + 0.5,
            width: h.getBoundingClientRect().width,
            min: parseFloat(getComputedStyle(h).minWidth) || 0,
            title: cell.title,
            text: inner.textContent,
          };
        });
        return {
          tight: table.hasAttribute("data-wb-tight"),
          overflow:
            table.getBoundingClientRect().right >
            list.getBoundingClientRect().right + 10.5,
          hugs,
          filler:
            table
              .querySelector("thead .wb-cell-filler")
              ?.getBoundingClientRect().width ?? 0,
        };
      };
      return { narrow: measure("auditNarrow"), wide: measure("auditWide") };
    });
    const n = audit.narrow;
    check(n.tight && !n.overflow, `auditNarrow (main 560): tight, no overflow`);
    check(
      n.hugs.some((h) => h.clipped) &&
        n.hugs.every((h) => h.width >= h.min - 0.5 && h.title === h.text),
      `auditNarrow: hug values shrink with an ellipsis (${n.hugs.map((h) => h.width.toFixed(0)).join("/")}px, min ${n.hugs.map((h) => h.min.toFixed(0)).join("/")}px), full value as title`,
    );
    const w = audit.wide;
    check(
      !w.tight &&
        !w.overflow &&
        w.hugs.every((h) => !h.clipped) &&
        w.filler > 300,
      `auditWide (main 1392): full values, packed left (filler ${w.filler.toFixed(0)}px)`,
    );
  }

  // Visually hidden text after clipped text doesn't widen the scroll area
  {
    const sr = await page.evaluate(() => {
      const host = document.querySelector('[data-case="srOnly"]');
      return {
        scroll: host.scrollWidth,
        client: host.clientWidth,
        tight: host.querySelector("table").hasAttribute("data-wb-tight"),
      };
    });
    check(
      sr.scroll <= sr.client,
      `srOnly: hidden suffixes stay inside the pane (scroll ${sr.scroll}px, client ${sr.client}px, tight ${sr.tight})`,
    );
  }

  // relative weights: 0.2:0.1 is laid out exactly like 2:1
  {
    const a = widths.weights.cols;
    const b = widths.fractional.cols;
    check(
      Math.abs(a.Name - b.Name) < 1 && Math.abs(a.Desc - b.Desc) < 1,
      `fractional: 0.2:0.1 matches 2:1 (name ${b.Name.toFixed(0)}/${a.Name.toFixed(0)}, desc ${b.Desc.toFixed(0)}/${a.Desc.toFixed(0)})`,
    );
  }
  // a wrapping column with grow 0 takes no spare width
  {
    const w = widths.wrap0;
    check(
      Math.abs(share(w, "Desc")) < 2,
      `wrap0: desc ${w.cols.Desc.toFixed(0)} = its minimum ${w.min.Desc.toFixed(0)}`,
    );
  }
  // maxWidth: one-line cells end in an ellipsis at the cap; wrapping cells
  // wrap within it
  {
    const caps = await page.evaluate(() => {
      const c = document.querySelector('[data-case="caps"]');
      const cap = c.querySelector(".wb-cell-cap");
      const flow = c.querySelector(".wb-cell-flow");
      const line = parseFloat(getComputedStyle(flow).lineHeight);
      return {
        capWidth: cap.getBoundingClientRect().width,
        capCh: parseFloat(getComputedStyle(cap).maxWidth),
        capClipped: cap.scrollWidth > cap.clientWidth,
        capEllipsis: getComputedStyle(cap).textOverflow,
        flowWidth: flow.getBoundingClientRect().width,
        flowLines: Math.round(flow.getBoundingClientRect().height / line),
      };
    });
    check(
      caps.capClipped &&
        caps.capEllipsis === "ellipsis" &&
        caps.capWidth <= caps.capCh + 0.5,
      `caps: one-line cap ${caps.capWidth.toFixed(0)}px ≤ ${caps.capCh.toFixed(0)}px with an ellipsis`,
    );
    check(
      caps.flowWidth <= 200.5 && caps.flowLines > 1,
      `caps: wrapping cell ${caps.flowWidth.toFixed(0)}px ≤ 200px over ${caps.flowLines} lines`,
    );
  }

  // Crowded toolbars (#/lab) at main 552 / 1012 / 1400: one line when it
  // fits; otherwise first control + primary on line 1 and the rest on line
  // 2 (never a third line, never the primary alone).
  {
    const bars = await page.evaluate(() =>
      [...document.querySelectorAll("[data-toolbar]")].map((host) => {
        const row = host.querySelector(".wb-toolbar-row");
        const items = [...row.children]
          .map((el) => ({ el, r: el.getBoundingClientRect() }))
          .filter(({ r }) => r.width > 0 && r.height > 0);
        // group items into lines by vertical overlap
        const lines = [];
        for (const it of items.sort((a, b) => a.r.top - b.r.top)) {
          const line = lines.find(
            (l) => it.r.top < l.bottom - 1 && it.r.bottom > l.top + 1,
          );
          if (line) {
            line.items.push(it.el);
            line.top = Math.min(line.top, it.r.top);
            line.bottom = Math.max(line.bottom, it.r.bottom);
          } else
            lines.push({ top: it.r.top, bottom: it.r.bottom, items: [it.el] });
        }
        const primary = row.querySelector(".wb-toolbar-primary");
        const pLine = lines.find((l) => l.items.includes(primary));
        const overflow = row.scrollWidth > row.clientWidth + 1;
        return {
          id: host.dataset.toolbar,
          width: Number(host.dataset.width),
          lines: lines.length,
          split: row.hasAttribute("data-wb-split"),
          primaryAlone: pLine.items.length === 1,
          firstWithPrimary: pLine.items.includes(row.firstElementChild),
          overflow,
        };
      }),
    );
    for (const b of bars) {
      const ok =
        !b.overflow &&
        (b.lines === 1
          ? !b.split
          : b.lines === 2 && b.split && b.firstWithPrimary && !b.primaryAlone);
      check(
        ok,
        `toolbar ${b.id} at main ${b.width}: ${b.lines} line(s)${b.split ? ", split" : ""}${b.lines > 1 ? `, first control + primary together: ${b.firstWithPrimary}` : ""}`,
      );
    }
    const wide = bars.filter((b) => b.width === 1400);
    check(
      wide.every((b) => b.lines === 1),
      "toolbars at main 1400 stay on one line",
    );
  }

  // Toolbar split: in a narrow main pane (drawer open at 1024), the first
  // control and the primary action share the first line.
  for (const width of [1024, 900]) {
    await page.setViewportSize({ width, height: 700 });
    await page.goto(new URL("?theme=light#/tables?item=g-105", base).href);
    await page.waitForSelector(".wb-toolbar-primary");
    const rows = await page.evaluate(() => {
      const row = document.querySelector(".wb-toolbar-row--split");
      const first = row.firstElementChild.getBoundingClientRect();
      const primary = row
        .querySelector(".wb-toolbar-primary")
        .getBoundingClientRect();
      return {
        main: document.querySelector(".wb-main").getBoundingClientRect().width,
        sameLine: Math.abs(first.top - primary.top) < 4,
        lines: new Set(
          [...row.children].map((c) =>
            Math.round(c.getBoundingClientRect().top),
          ),
        ).size,
      };
    });
    check(
      rows.sameLine && rows.lines === 2,
      `toolbar at ${width}px (main ${rows.main.toFixed(0)}): first control + primary on line 1, ${rows.lines} lines`,
    );
  }
} finally {
  await browser.close();
}
if (failures.length) {
  console.error(`${failures.length} layout check(s) failed`);
  process.exit(1);
}
