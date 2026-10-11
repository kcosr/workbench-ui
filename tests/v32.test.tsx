import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DataTable, ErrorState } from "../src";
import type { DataColumn } from "../src";

interface Row {
  id: string;
  name: string;
  note?: string;
  n: number;
}
const ROWS: Row[] = [
  { id: "g-101", name: "alpha", n: 1 },
  { id: "3f9d2c1e-8b7a-4c55-9e1f-0a2b3c4d5e6f", name: "beta", n: 22 },
];

const ONE = ROWS.slice(0, 1);
const header = (name: string) => screen.getByRole("columnheader", { name });
const headerNames = () =>
  screen.getAllByRole("columnheader").map((h) => h.textContent);

describe("DataColumn.hug", () => {
  it("is fit + grow 0 + a 32ch cap by default, with the cell text as title", () => {
    render(
      <DataTable
        label="Grants"
        rows={ROWS}
        rowId={(r) => r.id}
        columns={[
          { key: "name", header: "Name", cell: (r) => r.name },
          { key: "id", header: "ID", hug: true, cell: (r) => r.id },
        ]}
      />,
    );
    const th = header("ID");
    expect(th).toHaveClass("wb-cell-fit");
    expect(th.querySelector(".wb-th-grow")).toBeNull();
    const cell = screen.getByTitle(ROWS[1]!.id);
    expect(cell.tagName).toBe("TD");
    expect(cell).toHaveClass("wb-cell-hugcol", "wb-cell-fit");
    const cap = cell.querySelector<HTMLElement>(".wb-cell-hug")!;
    // shrinks (in a tight table) down to min(10ch, cap)
    expect(cap.style.getPropertyValue("--wb-hug-min")).toBe("min(10ch, 32ch)");
    expect(cap.style.maxWidth).toBe("32ch");
    expect(cap).toHaveTextContent(ROWS[1]!.id);
  });

  it("takes a cap as a length or px; explicit settings win", () => {
    render(
      <DataTable
        label="Grants"
        rows={ROWS}
        rowId={(r) => r.id}
        columns={[
          { key: "name", header: "Name", cell: (r) => r.name },
          { key: "a", header: "A", hug: "12ch", cell: (r) => r.id },
          { key: "b", header: "B", hug: 120, cell: (r) => r.id },
          {
            key: "c",
            header: "C",
            hug: true,
            grow: 1,
            title: () => "custom",
            cell: (r) => r.id,
          },
          {
            key: "d",
            header: "D",
            hug: true,
            truncate: "start",
            cell: (r) => `path/to/${r.id}`,
          },
        ]}
      />,
    );
    const row = document.querySelector('tr[data-wb-row="g-101"]')!;
    const caps = row.querySelectorAll<HTMLElement>(".wb-cell-hug");
    expect(caps[0]!.style.maxWidth).toBe("12ch");
    expect(caps[1]!.style.maxWidth).toBe("120px");
    // an explicit grow keeps the sizer; an explicit title replaces the default
    expect(header("C").querySelector(".wb-th-grow")).not.toBeNull();
    expect(caps[2]!.closest("td")).toHaveAttribute("title", "custom");
    // hug + truncate "start": a start-ellipsis cap, not a clip
    expect(caps[3]).toHaveClass("wb-cell-hug--start");
    expect(caps[3]!.querySelector("bdi")).toHaveTextContent("path/to/g-101");
    expect(row.querySelector(".wb-cell-clip")).toBeNull();
  });

  it("re-fits when the container's content width changes (padding too)", () => {
    const observers: (() => void)[] = [];
    const RO = globalThis.ResizeObserver;
    globalThis.ResizeObserver = class {
      cb: () => void;
      constructor(cb: () => void) {
        this.cb = cb;
        observers.push(() => this.cb());
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
    const rect = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: HTMLElement) {
        const w = this.tagName === "TABLE" ? 580 : 0;
        return {
          x: 0,
          y: 0,
          top: 0,
          left: 0,
          right: w,
          bottom: 0,
          width: w,
          height: 0,
          toJSON() {},
        } as DOMRect;
      });
    const client = vi
      .spyOn(HTMLElement.prototype, "clientWidth", "get")
      .mockImplementation(() => 600);
    render(
      <div data-testid="box">
        <DataTable
          label="Grants"
          rows={ROWS}
          rowId={(r) => r.id}
          columns={[
            { key: "name", header: "Name", cell: (r) => r.name },
            { key: "id", header: "ID", hug: true, cell: (r) => r.id },
          ]}
        />
      </div>,
    );
    const table = screen.getByRole("table");
    expect(table).not.toHaveAttribute("data-wb-tight");
    // same clientWidth, more padding: 540px available < 580px table
    screen.getByTestId("box").style.padding = "0 30px";
    observers.forEach((fire) => fire());
    expect(table).toHaveAttribute("data-wb-tight");
    rect.mockRestore();
    client.mockRestore();
    globalThis.ResizeObserver = RO;
  });

  it("a minWidth becomes the hug minimum; px caps are converted", () => {
    render(
      <DataTable
        label="Grants"
        rows={ROWS}
        rowId={(r) => r.id}
        columns={[
          { key: "name", header: "Name", cell: (r) => r.name },
          {
            key: "id",
            header: "ID",
            hug: 120,
            minWidth: 64,
            cell: (r) => r.id,
          },
        ]}
      />,
    );
    const hug = document.querySelector<HTMLElement>("td .wb-cell-hug")!;
    expect(hug.style.maxWidth).toBe("120px");
    expect(hug.style.getPropertyValue("--wb-hug-min")).toBe("64px");
    // an explicit minimum also holds while the table isn't tight
    expect(hug.style.minWidth).toBe("64px");
    // the minimum lives on the content, not on the header
    expect(header("ID").style.minWidth).toBe("");
  });

  it("goes tight (shrinkable hugs) only when full values would overflow", () => {
    let tableWidth = 900;
    const rect = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: HTMLElement) {
        const w = this.tagName === "TABLE" ? tableWidth : 0;
        return {
          x: 0,
          y: 0,
          top: 0,
          left: 0,
          right: w,
          bottom: 0,
          width: w,
          height: 0,
          toJSON() {},
        } as DOMRect;
      });
    const client = vi
      .spyOn(HTMLElement.prototype, "clientWidth", "get")
      .mockImplementation(() => 560);
    const cols: DataColumn<Row>[] = [
      { key: "name", header: "Name", cell: (r) => r.name },
      { key: "id", header: "ID", hug: true, cell: (r) => r.id },
    ];
    const { rerender } = render(
      <div>
        <DataTable
          label="Grants"
          rows={ROWS}
          rowId={(r) => r.id}
          columns={cols}
        />
      </div>,
    );
    const table = screen.getByRole("table");
    expect(table).toHaveAttribute("data-wb-tight");
    // content changes re-fit: now it fits
    tableWidth = 560;
    rerender(
      <div>
        <DataTable
          label="Grants"
          rows={ONE}
          rowId={(r) => r.id}
          columns={cols}
        />
      </div>,
    );
    expect(table).not.toHaveAttribute("data-wb-tight");
    // same rows, new column renderers: re-measured too
    tableWidth = 900;
    rerender(
      <div>
        <DataTable
          label="Grants"
          rows={ONE}
          rowId={(r) => r.id}
          columns={[
            { key: "name", header: "Name", cell: (r) => `${r.name} (renamed)` },
            { key: "id", header: "ID", hug: true, cell: (r) => r.id },
          ]}
        />
      </div>,
    );
    expect(table).toHaveAttribute("data-wb-tight");
    // no hug columns: never tight
    tableWidth = 900;
    rerender(
      <div>
        <DataTable
          label="Grants"
          rows={ROWS}
          rowId={(r) => r.id}
          columns={[{ key: "name", header: "Name", cell: (r) => r.name }]}
        />
      </div>,
    );
    expect(table).not.toHaveAttribute("data-wb-tight");
    rect.mockRestore();
    client.mockRestore();
  });

  it("the primary column can hug (its link stays inside the cap)", () => {
    render(
      <DataTable
        label="Accounts"
        rows={ROWS}
        rowId={(r) => r.id}
        rowHref={(r) => `#/${r.id}`}
        columns={[
          { key: "name", header: "Name", hug: true, cell: (r) => r.name },
        ]}
      />,
    );
    const link = screen.getByRole("link", { name: "alpha" });
    expect(link.closest(".wb-cell-hug")).not.toBeNull();
    expect(header("Name").querySelector(".wb-th-grow")).toBeNull();
  });
});

describe("DataTable fill", () => {
  const columns: DataColumn<Row>[] = [
    { key: "name", header: "Name", hug: true, cell: (r) => r.name },
    { key: "n", header: "N", align: "end", cell: (r) => r.n },
  ];

  it('"end" adds an aria-hidden filler column that takes the spare width', () => {
    const onOpen = vi.fn();
    render(
      <DataTable
        label="Accounts"
        rows={ROWS}
        rowId={(r) => r.id}
        columns={columns}
        onRowOpen={onOpen}
        fill="end"
      />,
    );
    const table = screen.getByRole("table");
    expect(table).toHaveClass("wb-table--fill-end");
    const filler = table.querySelector("thead th.wb-cell-filler")!;
    expect(filler).toHaveAttribute("aria-hidden", "true");
    // nothing grows, so the filler has the sizer
    expect(filler.querySelector(".wb-th-grow")).not.toBeNull();
    // not a column header anyone can reach
    expect(headerNames()).toEqual(["Name", "N"]);
    for (const tr of table.querySelectorAll("tbody tr[data-wb-row]")) {
      const last = tr.lastElementChild!;
      expect(last).toHaveClass("wb-cell-filler");
      expect(last).toHaveAttribute("aria-hidden", "true");
      expect(last).toBeEmptyDOMElement();
    }
    // clicks on the filler don't open the row; the cells do
    const row = table.querySelector('tr[data-wb-row="g-101"]')!;
    fireEvent.click(row.lastElementChild!, { detail: 1 });
    expect(onOpen).not.toHaveBeenCalled();
    fireEvent.click(row.children[1]!, { detail: 1 });
    expect(onOpen).toHaveBeenCalledTimes(1);
    // j/k still moves over real rows
    fireEvent.keyDown(document.body, { key: "j" });
    expect(row).toHaveClass("is-cursor");
  });

  it("full-width rows span the filler; skeleton rows include it", () => {
    const groups = render(
      <DataTable
        label="Accounts"
        rows={ROWS}
        rowId={(r) => r.id}
        columns={columns}
        groupBy={(r) => (r.n > 10 ? "big" : "small")}
        error={<ErrorState compact error={new Error("503")} />}
        fill="end"
      />,
    );
    const table = screen.getByRole("table");
    expect(table.querySelector("th[scope=rowgroup]")).toHaveAttribute(
      "colspan",
      "3",
    );
    expect(table.querySelector("tr.wb-table-alert > td")).toHaveAttribute(
      "colspan",
      "3",
    );
    groups.unmount();
    const empty = render(
      <DataTable
        label="Accounts"
        rows={[]}
        rowId={(r: Row) => r.id}
        columns={columns}
        empty={<p>None</p>}
        fill="end"
      />,
    );
    expect(screen.getByText("None").closest("td")).toHaveAttribute(
      "colspan",
      "3",
    );
    empty.unmount();
    render(
      <DataTable
        label="Accounts"
        rows={[]}
        rowId={(r: Row) => r.id}
        columns={columns}
        loading
        fill="end"
      />,
    );
    const skel = document.querySelector("tr.wb-table-skel")!;
    expect(skel.children).toHaveLength(3);
    expect(skel.lastElementChild).toHaveClass("wb-cell-filler");
    expect(skel.lastElementChild).toBeEmptyDOMElement();
  });

  it("gives growing columns the spare width first (filler without a sizer)", () => {
    render(
      <DataTable
        label="Grants"
        rows={ROWS}
        rowId={(r) => r.id}
        columns={[
          { key: "name", header: "Name", cell: (r) => r.name },
          { key: "n", header: "N", cell: (r) => r.n },
        ]}
        fill="end"
      />,
    );
    expect(header("Name").querySelector(".wb-th-grow")).not.toBeNull();
    const filler = document.querySelector("thead th.wb-cell-filler")!;
    expect(filler.querySelector(".wb-th-grow")).toBeNull();
  });

  it('"spread" (default) adds no filler', () => {
    render(
      <DataTable
        label="Grants"
        rows={ROWS}
        rowId={(r) => r.id}
        columns={columns}
      />,
    );
    expect(document.querySelector(".wb-cell-filler")).toBeNull();
  });
});

describe("DataColumn.hideWhenEmpty", () => {
  const columns: DataColumn<Row>[] = [
    { key: "name", header: "Name", cell: (r) => r.name },
    {
      key: "note",
      header: "Note",
      hideWhenEmpty: true,
      cell: (r) => r.note ?? null,
    },
    {
      key: "flag",
      header: "Flag",
      hideWhenEmpty: (r) => r.n < 100,
      cell: (r) => (r.n < 100 ? <span /> : "big"),
    },
    { key: "n", header: "N", align: "end", cell: (r) => r.n },
  ];

  it("leaves out columns empty in every row (value or predicate)", () => {
    render(
      <DataTable
        label="Grants"
        rows={ROWS}
        rowId={(r) => r.id}
        columns={columns}
        groupBy={() => "all"}
      />,
    );
    expect(headerNames()).toEqual(["Name", "N"]);
    const row = document.querySelector('tr[data-wb-row="g-101"]')!;
    expect(row.children).toHaveLength(2);
    expect(document.querySelector("th[scope=rowgroup]")).toHaveAttribute(
      "colspan",
      "2",
    );
  });

  it("keeps a column when any row has content", () => {
    render(
      <DataTable
        label="Grants"
        rows={[
          ...ROWS,
          { id: "x", name: "gamma", note: "", n: 500 },
          { id: "y", name: "d", note: "see", n: 3 },
        ]}
        rowId={(r) => r.id}
        columns={columns}
      />,
    );
    expect(headerNames()).toEqual(["Name", "Note", "Flag", "N"]);
  });

  it("keeps every column while there are no rows (stable headers)", () => {
    render(
      <DataTable
        label="Grants"
        rows={[]}
        rowId={(r: Row) => r.id}
        columns={columns}
        empty={<p>None</p>}
      />,
    );
    expect(headerNames()).toEqual(["Name", "Note", "Flag", "N"]);
    expect(screen.getByText("None").closest("td")).toHaveAttribute(
      "colspan",
      "4",
    );
  });

  it("never hides the primary column; false, 0 and elements count as content", () => {
    render(
      <DataTable
        label="Grants"
        rows={ROWS}
        rowId={(r) => r.id}
        rowHref={(r) => `#/${r.id}`}
        columns={[
          {
            key: "a",
            header: "A",
            primary: true,
            hideWhenEmpty: true,
            cell: () => null,
          },
          { key: "zero", header: "Zero", hideWhenEmpty: true, cell: () => 0 },
          { key: "el", header: "El", hideWhenEmpty: true, cell: () => <i /> },
          { key: "no", header: "No", hideWhenEmpty: true, cell: () => false },
        ]}
      />,
    );
    expect(headerNames()).toEqual(["A", "Zero", "El"]);
    expect(
      within(screen.getByRole("table")).getAllByRole("rowheader"),
    ).toHaveLength(2);
  });

  it("works with priorities (classes stay on the remaining columns)", () => {
    render(
      <DataTable
        label="Grants"
        rows={ROWS}
        rowId={(r) => r.id}
        columns={[
          { key: "name", header: "Name", cell: (r) => r.name },
          {
            key: "note",
            header: "Note",
            priority: 2,
            hideWhenEmpty: true,
            cell: () => null,
          },
          { key: "n", header: "N", priority: 3, cell: (r) => r.n },
        ]}
      />,
    );
    expect(headerNames()).toEqual(["Name", "N"]);
    expect(header("N")).toHaveClass("wb-cell-p3");
    expect(document.querySelector(".wb-cell-p2")).toBeNull();
  });
});
