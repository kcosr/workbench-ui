import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AppShell,
  Button,
  DataTable,
  LinkProvider,
  ListPager,
  ListRow,
  Rows,
  SortHeader,
  Sparkline,
  Switch,
  TruncateStart,
  Main,
  Sidebar,
  findRowTarget,
  formatBytes,
  formatRelative,
  hasTextSelection,
  isPlainClick,
  nextSort,
  useAppShell,
  useHotkey,
} from "../src";
import type { DataColumn, LinkProps, SortState } from "../src";

interface Grant {
  id: string;
  name: string;
  service: string;
  actions: number;
  on: boolean;
}

const GRANTS: Grant[] = [
  { id: "g1", name: "read access", service: "github", actions: 3, on: true },
  { id: "g2", name: "write access", service: "github", actions: 9, on: false },
  { id: "g3", name: "admin", service: "jira", actions: 12, on: true },
];

const COLUMNS: DataColumn<Grant>[] = [
  {
    key: "name",
    header: "Grant",
    sortable: true,
    truncate: true,
    cell: (g) => g.name,
  },
  {
    key: "actions",
    header: "Actions",
    sortable: true,
    firstSortDir: "desc",
    align: "end",
    priority: 3,
    cell: (g) => g.actions,
  },
  {
    key: "service",
    header: "Service",
    priority: 2,
    wrap: true,
    cell: (g) => g.service,
  },
];

afterEach(() => {
  window.getSelection()?.removeAllRanges();
});

describe("nextSort / SortHeader", () => {
  it("cycles unsorted → first direction → other → unsorted", () => {
    expect(nextSort(null, "a")).toEqual({ key: "a", dir: "asc" });
    expect(nextSort({ key: "a", dir: "asc" }, "a")).toEqual({
      key: "a",
      dir: "desc",
    });
    expect(nextSort({ key: "a", dir: "desc" }, "a")).toBeNull();
    expect(nextSort({ key: "b", dir: "asc" }, "a", "desc")).toEqual({
      key: "a",
      dir: "desc",
    });
    expect(nextSort({ key: "a", dir: "desc" }, "a", "desc")).toEqual({
      key: "a",
      dir: "asc",
    });
    expect(nextSort({ key: "a", dir: "asc" }, "a", "desc")).toBeNull();
  });

  it("puts aria-sort only on the sorted column", async () => {
    const user = userEvent.setup();
    function T() {
      const [sort, setSort] = useState<SortState | null>(null);
      return (
        <table>
          <thead>
            <tr>
              <SortHeader
                label="Name"
                sortKey="name"
                sort={sort}
                onSortChange={setSort}
              />
              <SortHeader
                label="Hits"
                sortKey="hits"
                sort={sort}
                onSortChange={setSort}
                firstDir="desc"
              />
            </tr>
          </thead>
        </table>
      );
    }
    render(<T />);
    const [name, hits] = screen.getAllByRole("columnheader");
    expect(name).not.toHaveAttribute("aria-sort");
    expect(hits).not.toHaveAttribute("aria-sort");
    await user.click(screen.getByRole("button", { name: "Hits" }));
    expect(hits).toHaveAttribute("aria-sort", "descending");
    expect(name).not.toHaveAttribute("aria-sort");
    await user.click(screen.getByRole("button", { name: "Hits" }));
    expect(hits).toHaveAttribute("aria-sort", "ascending");
    await user.click(screen.getByRole("button", { name: "Hits" }));
    expect(hits).not.toHaveAttribute("aria-sort");
  });
});

function Grants({
  onOpen,
  onFollow,
  onExternal,
  onCursorChange,
  href = true,
  grouped = false,
  initialOpen = null,
  extra,
}: {
  onOpen?: (g: Grant) => void;
  onFollow?: (g: Grant) => void;
  onExternal?: (g: Grant) => void;
  onCursorChange?: (id: string | null) => void;
  href?: boolean;
  grouped?: boolean;
  initialOpen?: string | null;
  extra?: DataColumn<Grant>[];
}) {
  const [sort, setSort] = useState<SortState | null>(null);
  const [open, setOpen] = useState<string | null>(initialOpen);
  const rows = sort
    ? [...GRANTS].sort(
        (a, b) =>
          (sort.dir === "asc" ? 1 : -1) *
          (sort.key === "actions"
            ? a.actions - b.actions
            : a.name.localeCompare(b.name)),
      )
    : GRANTS;
  return (
    <>
      <DataTable
        label="Grants"
        rows={rows}
        rowId={(g) => g.id}
        columns={extra ? [...COLUMNS, ...extra] : COLUMNS}
        sort={sort}
        onSortChange={setSort}
        activeId={open}
        rowHref={href ? (g) => `#/grants/${g.id}` : undefined}
        onRowOpen={(g) => {
          setOpen(g.id);
          onOpen?.(g);
        }}
        onRowFollow={
          onFollow
            ? (g) => {
                setOpen(g.id);
                onFollow(g);
              }
            : undefined
        }
        onRowExternal={onExternal}
        onCursorChange={onCursorChange}
        groupBy={grouped ? (g) => g.service : undefined}
        rowDim={(g) => !g.on}
      />
      <div data-testid="open">{open ?? "none"}</div>
    </>
  );
}

const rowOf = (id: string) =>
  document.querySelector(`tr[data-wb-row="${id}"]`) as HTMLElement;

describe("DataTable", () => {
  it("renders a labelled table with row headers, links and aria-current", () => {
    render(<Grants initialOpen="g2" />);
    const table = screen.getByRole("table", { name: "Grants" });
    expect(within(table).getAllByRole("rowheader")).toHaveLength(3);
    const link = screen.getByRole("link", { name: "write access" });
    expect(link).toHaveAttribute("href", "#/grants/g2");
    expect(link).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("link", { name: "admin" })).not.toHaveAttribute(
      "aria-current",
    );
    expect(rowOf("g2")).toHaveClass("is-active", "is-dim", "is-clickable");
  });

  it("routes row links through LinkProvider", () => {
    const seen: string[] = [];
    function RouterLink({ href, ...rest }: LinkProps) {
      seen.push(href);
      return <a data-router="1" href={href} {...rest} />;
    }
    render(
      <LinkProvider component={RouterLink}>
        <Grants />
      </LinkProvider>,
    );
    expect(screen.getByRole("link", { name: "admin" })).toHaveAttribute(
      "data-router",
      "1",
    );
    expect(seen).toContain("#/grants/g3");
  });

  it("sortable headers are controlled; aria-sort only on the sorted column", async () => {
    const user = userEvent.setup();
    render(<Grants />);
    const actions = screen.getByRole("columnheader", { name: "Actions" });
    await user.click(screen.getByRole("button", { name: "Actions" }));
    expect(actions).toHaveAttribute("aria-sort", "descending");
    expect(
      screen.getByRole("columnheader", { name: "Grant" }),
    ).not.toHaveAttribute("aria-sort");
    const names = screen.getAllByRole("rowheader").map((c) => c.textContent);
    expect(names).toEqual(["admin", "write access", "read access"]);
    // Service is not sortable: a plain header, no button
    expect(screen.queryByRole("button", { name: "Service" })).toBeNull();
  });

  it("marks priorities, alignment, one-line cells and truncation", () => {
    render(
      <Grants
        extra={[
          {
            key: "path",
            header: "Path",
            truncate: "start",
            cell: (g) => `a/b/${g.id}.toml`,
          },
        ]}
      />,
    );
    const row = rowOf("g1");
    const [name, actions, service, path] = Array.from(
      row.children,
    ) as HTMLElement[];
    expect(name!.tagName).toBe("TH");
    expect(name).toHaveClass("wb-cell-primary");
    expect(name!.querySelector(".wb-cell-clip > a.wb-row-link")).not.toBeNull();
    expect(actions).toHaveClass("wb-cell-num", "wb-cell-p3", "wb-cell-nowrap");
    expect(service).toHaveClass("wb-cell-p2");
    expect(service).not.toHaveClass("wb-cell-nowrap");
    expect(
      path!.querySelector(".wb-cell-clip.wb-cell-clip--start > span > bdi"),
    ).toHaveTextContent("a/b/g1.toml");
    // headers carry the same priority classes so whole columns hide
    expect(screen.getByRole("columnheader", { name: "Actions" })).toHaveClass(
      "wb-cell-p3",
    );
  });

  it("a plain click on the row opens it through its link; interactive cells and modified clicks don't", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    const onToggle = vi.fn();
    render(
      <Grants
        onOpen={onOpen}
        extra={[
          {
            key: "on",
            header: "Enabled",
            cell: (g) => (
              <Switch
                aria-label={`Enable ${g.name}`}
                checked={g.on}
                onChange={onToggle}
              />
            ),
          },
          {
            key: "menu",
            header: "",
            cell: (g) => <Button size="sm">{`Menu ${g.id}`}</Button>,
          },
        ]}
      />,
    );
    const cell = rowOf("g3").querySelectorAll("td")[1]!;
    fireEvent.click(cell, { ctrlKey: true });
    fireEvent.click(cell, { metaKey: true });
    fireEvent.click(cell, { button: 1 });
    expect(onOpen).not.toHaveBeenCalled();
    await user.click(screen.getByRole("switch", { name: "Enable admin" }));
    expect(onToggle).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Menu g3" }));
    expect(onOpen).not.toHaveBeenCalled();
    await user.click(cell);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen.mock.calls[0]![0]).toMatchObject({ id: "g3" });
    expect(screen.getByTestId("open")).toHaveTextContent("g3");
  });

  it("a Ctrl/⌘-click on the row link leaves it to the browser (no drawer)", () => {
    const onOpen = vi.fn();
    render(<Grants onOpen={onOpen} />);
    const link = screen.getByRole("link", { name: "admin" });
    fireEvent.click(link, { ctrlKey: true });
    fireEvent.click(link, { metaKey: true });
    expect(onOpen).not.toHaveBeenCalled();
    fireEvent.click(link);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("finishing a text selection in a row doesn't open it", () => {
    const onOpen = vi.fn();
    render(<Grants onOpen={onOpen} />);
    const cell = rowOf("g1").querySelectorAll("td")[1]!;
    const range = document.createRange();
    range.selectNodeContents(cell);
    window.getSelection()!.addRange(range);
    expect(hasTextSelection()).toBe(true);
    fireEvent.click(cell, { detail: 1 });
    expect(onOpen).not.toHaveBeenCalled();
    // …nor on the primary link (whose navigation is cancelled too)
    const link = screen.getByRole("link", { name: "read access" });
    range.selectNodeContents(link);
    expect(fireEvent.click(link, { detail: 1 })).toBe(false);
    expect(onOpen).not.toHaveBeenCalled();
    // keyboard activation (detail 0) still opens
    fireEvent.click(link, { detail: 0 });
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("a button primary cell ignores modified clicks and selections", () => {
    const onOpen = vi.fn();
    render(<Grants href={false} onOpen={onOpen} />);
    const btn = screen.getByRole("button", { name: "admin" });
    fireEvent.click(btn, { ctrlKey: true, detail: 1 });
    fireEvent.click(btn, { metaKey: true, detail: 1 });
    expect(onOpen).not.toHaveBeenCalled();
    const range = document.createRange();
    range.selectNodeContents(btn);
    window.getSelection()!.addRange(range);
    fireEvent.click(btn, { detail: 1 });
    expect(onOpen).not.toHaveBeenCalled();
    window.getSelection()!.removeAllRanges();
    fireEvent.click(btn, { detail: 1 });
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("keeps a group's rows (and focus) when an earlier group goes away", () => {
    const rows = (list: Grant[]) => (
      <DataTable
        label="Grants"
        rows={list}
        rowId={(g) => g.id}
        columns={COLUMNS}
        rowHref={(g) => `#/grants/${g.id}`}
        groupBy={(g) => g.service}
      />
    );
    const { rerender } = render(rows(GRANTS));
    const link = screen.getByRole("link", { name: "admin" });
    act(() => link.focus());
    rerender(rows(GRANTS.filter((g) => g.service !== "github")));
    expect(link.isConnected).toBe(true);
    expect(document.activeElement).toBe(link);
    // a key that repeats later in the list gets its own group
    const repeated = [GRANTS[0]!, GRANTS[2]!, GRANTS[1]!];
    rerender(rows(repeated));
    expect(screen.getByRole("table").querySelectorAll("tbody")).toHaveLength(3);
  });

  it("drops the cursor (and reports null) when its row leaves the list", () => {
    const onCursorChange = vi.fn();
    const table = (list: Grant[]) => (
      <DataTable
        label="Grants"
        rows={list}
        rowId={(g) => g.id}
        columns={COLUMNS}
        onRowOpen={() => {}}
        onCursorChange={onCursorChange}
      />
    );
    const { rerender } = render(table(GRANTS));
    fireEvent.keyDown(document.body, { key: "j" });
    expect(onCursorChange).toHaveBeenLastCalledWith("g1");
    rerender(table(GRANTS.slice(1)));
    expect(onCursorChange).toHaveBeenLastCalledWith(null);
    expect(document.querySelector(".is-cursor")).toBeNull();
    fireEvent.keyDown(document.body, { key: "j" });
    expect(rowOf("g2")).toHaveClass("is-cursor");
  });

  it("keeps the cursor on a newly opened row when the old cursor row goes away", () => {
    const onFollow = vi.fn();
    const table = (list: Grant[], open: string) => (
      <DataTable
        label="Grants"
        rows={list}
        rowId={(g) => g.id}
        columns={COLUMNS}
        activeId={open}
        onRowOpen={() => {}}
        onRowFollow={onFollow}
      />
    );
    const { rerender } = render(table(GRANTS, "g1"));
    expect(rowOf("g1")).toHaveClass("is-cursor");
    rerender(table(GRANTS.slice(1), "g3"));
    expect(rowOf("g3")).toHaveClass("is-cursor");
    fireEvent.keyDown(document.body, { key: "k" });
    expect(onFollow).toHaveBeenCalledTimes(1);
    expect(onFollow.mock.calls[0]![0]).toMatchObject({ id: "g2" });
  });

  it("scrolls the open row into view (deep links)", () => {
    const spy = vi.spyOn(Element.prototype, "scrollIntoView");
    render(<Grants initialOpen="g3" />);
    expect(spy.mock.contexts).toContain(rowOf("g3"));
    spy.mockRestore();
  });

  it("without rowHref the primary cell is a button that opens the row", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(<Grants href={false} onOpen={onOpen} />);
    await user.click(screen.getByRole("button", { name: "admin" }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "admin" })).toHaveAttribute(
      "aria-current",
      "true",
    );
  });

  it("groups consecutive rows into a <tbody> each with a rowgroup header", () => {
    render(<Grants grouped />);
    const table = screen.getByRole("table");
    expect(table).toHaveClass("wb-table--grouped");
    const bodies = table.querySelectorAll("tbody");
    expect(bodies).toHaveLength(2);
    const head = bodies[0]!.querySelector(
      "tr.wb-table-group > th[scope=rowgroup]",
    );
    expect(head).toHaveAttribute("colspan", "3");
    expect(head).toHaveTextContent("github");
    expect(head).toHaveTextContent("2");
    expect(bodies[1]!.querySelectorAll("tr[data-wb-row]")).toHaveLength(1);
  });

  it("j/k move the cursor, Enter opens, the open row follows, o opens externally", () => {
    const onFollow = vi.fn();
    const onExternal = vi.fn();
    const onCursorChange = vi.fn();
    render(
      <Grants
        onFollow={onFollow}
        onExternal={onExternal}
        onCursorChange={onCursorChange}
      />,
    );
    fireEvent.keyDown(document.body, { key: "j" });
    expect(rowOf("g1")).toHaveClass("is-cursor");
    expect(onCursorChange).toHaveBeenLastCalledWith("g1");
    fireEvent.keyDown(document.body, { key: "j" });
    expect(rowOf("g2")).toHaveClass("is-cursor");
    expect(rowOf("g1")).not.toHaveClass("is-cursor");
    fireEvent.keyDown(document.body, { key: "o" });
    expect(onExternal.mock.calls[0]![0]).toMatchObject({ id: "g2" });
    fireEvent.keyDown(document.body, { key: "Enter" });
    expect(screen.getByTestId("open")).toHaveTextContent("g2");
    fireEvent.keyDown(document.body, { key: "j" });
    expect(onFollow.mock.calls[0]![0]).toMatchObject({ id: "g3" });
    expect(screen.getByTestId("open")).toHaveTextContent("g3");
    expect(onCursorChange).toHaveBeenLastCalledWith("g3");
  });

  it("focus follows the cursor once a row link has focus", () => {
    render(<Grants />);
    act(() => screen.getByRole("link", { name: "read access" }).focus());
    fireEvent.keyDown(document.activeElement!, { key: "j" });
    fireEvent.keyDown(document.activeElement!, { key: "j" });
    expect(document.activeElement).toBe(
      screen.getByRole("link", { name: "write access" }),
    );
    expect(findRowTarget("g3")).toBe(
      screen.getByRole("link", { name: "admin" }),
    );
  });

  it("cursor={false} leaves j/k alone", () => {
    render(
      <DataTable
        label="People"
        rows={GRANTS}
        rowId={(g) => g.id}
        columns={COLUMNS}
        onRowOpen={() => {}}
        cursor={false}
      />,
    );
    fireEvent.keyDown(document.body, { key: "j" });
    expect(document.querySelector(".is-cursor")).toBeNull();
  });

  it("first load shows skeleton rows and a loading status; refetches keep rows", () => {
    const { rerender } = render(
      <DataTable
        label="Grants"
        rows={[]}
        rowId={(g: Grant) => g.id}
        columns={COLUMNS}
        loading
      />,
    );
    const table = screen.getByRole("table");
    expect(table).toHaveAttribute("aria-busy", "true");
    expect(
      table.querySelectorAll("tr.wb-table-skel[aria-hidden=true]"),
    ).toHaveLength(6);
    expect(table.querySelector("tr.wb-table-skel td:nth-child(2)")).toHaveClass(
      "wb-cell-p3",
    );
    expect(screen.getByRole("status")).toHaveTextContent("Loading Grants…");
    rerender(
      <DataTable
        label="Grants"
        rows={GRANTS}
        rowId={(g: Grant) => g.id}
        columns={COLUMNS}
        loading
      />,
    );
    expect(table.querySelectorAll("tr.wb-table-skel")).toHaveLength(0);
    expect(table.querySelectorAll("tr[data-wb-row]")).toHaveLength(3);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("shows empty or error content in a full-width row", () => {
    const { rerender } = render(
      <DataTable
        label="Grants"
        rows={[]}
        rowId={(g: Grant) => g.id}
        columns={COLUMNS}
        empty={<p>No grants</p>}
      />,
    );
    const cell = screen.getByText("No grants").closest("td");
    expect(cell).toHaveAttribute("colspan", "3");
    rerender(
      <DataTable
        label="Grants"
        rows={[]}
        rowId={(g: Grant) => g.id}
        columns={COLUMNS}
        empty={<p>No grants</p>}
        error={<p>Failed</p>}
      />,
    );
    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.queryByText("No grants")).toBeNull();
  });

  it("keeps truncated columns legible with a minimum (overridable)", () => {
    render(
      <DataTable
        label="Grants"
        rows={GRANTS}
        rowId={(g) => g.id}
        columns={[
          { key: "name", header: "Grant", truncate: true, cell: (g) => g.name },
          {
            key: "sub",
            header: "Subject",
            truncate: true,
            minWidth: "16ch",
            cell: (g) => g.service,
          },
          {
            key: "free",
            header: "Free",
            truncate: true,
            minWidth: 0,
            cell: () => "x",
          },
          {
            key: "note",
            header: "Note",
            wrap: true,
            minWidth: 120,
            cell: () => "y",
          },
        ]}
      />,
    );
    const [name, sub, free] = Array.from(
      rowOf("g1").querySelectorAll<HTMLElement>(".wb-cell-clip"),
    );
    // default comes from CSS (.wb-cell-clip { min-width: 10ch })
    expect(name!.style.minWidth).toBe("");
    expect(sub!.style.minWidth).toBe("16ch");
    expect(free!.style.minWidth).toBe("0px");
    expect(screen.getByRole("columnheader", { name: "Note" })).toHaveStyle({
      minWidth: "120px",
    });
    expect(
      screen.getByRole("columnheader", { name: "Subject" }).style.minWidth,
    ).toBe("");
  });

  it("passes compact, bleed, per-row classes and column widths through", () => {
    render(
      <DataTable
        label="Grants"
        rows={GRANTS}
        rowId={(g) => g.id}
        columns={[
          ...COLUMNS,
          { key: "w", header: "W", width: 90, cell: () => "x" },
        ]}
        compact
        bleed
        rowClassName={(g) => (g.id === "g1" ? "is-new" : undefined)}
      />,
    );
    expect(screen.getByRole("table")).toHaveClass(
      "wb-table--compact",
      "wb-table--bleed",
    );
    expect(rowOf("g1")).toHaveClass("is-new");
    expect(screen.getByRole("columnheader", { name: "W" })).toHaveStyle({
      width: "90px",
    });
  });
});

describe("ListPager", () => {
  it("counts, loads more, and keeps loaded items on error", async () => {
    const user = userEvent.setup();
    const more = vi.fn();
    const { rerender } = render(
      <ListPager
        shown={50}
        total={1284}
        noun="grant"
        hasMore
        onLoadMore={more}
      />,
    );
    expect(screen.getByText("50 of 1,284 grants")).toHaveAttribute(
      "role",
      "status",
    );
    await user.click(screen.getByRole("button", { name: "Load more grants" }));
    expect(more).toHaveBeenCalledTimes(1);
    rerender(
      <ListPager
        shown={50}
        total={1284}
        noun="grant"
        hasMore
        onLoadMore={more}
        loadingMore
      />,
    );
    expect(screen.getByRole("button", { name: /Loading/ })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    rerender(
      <ListPager
        shown={50}
        total={1284}
        noun="grant"
        hasMore
        onLoadMore={more}
        error
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Couldn’t load more grants. The loaded grants are still shown.",
    );
    expect(screen.queryByRole("button", { name: /Load more/ })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(more).toHaveBeenCalledTimes(2);
  });

  it("uses irregular nouns, singular counts and shows Updating…", () => {
    render(<ListPager shown={1} noun={["entry", "entries"]} updating />);
    expect(screen.getByText("1 entry")).toBeInTheDocument();
    expect(screen.getByText("Updating…")).toHaveAttribute("role", "status");
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("Sparkline, TruncateStart, Button count", () => {
  it("Sparkline is one labelled image with the last bar highlighted", () => {
    const { container, rerender } = render(
      <Sparkline values={[3, 0, 5, 2]} label="Requests, 4 days" />,
    );
    const img = screen.getByRole("img", { name: "Requests, 4 days" });
    const bars = img.querySelectorAll(".wb-spark-bar");
    expect(bars).toHaveLength(4);
    expect(bars[1]).toHaveClass("is-zero");
    expect(bars[3]).toHaveClass("is-last");
    rerender(<Sparkline values={[1, 4, 2]} label="Trend" variant="line" />);
    expect(container.querySelector(".wb-spark-line")).not.toBeNull();
    rerender(<Sparkline values={[]} label="Empty" />);
    expect(screen.getByRole("img", { name: "Empty" })).toBeInTheDocument();
  });

  it("TruncateStart isolates the text and keeps a title", () => {
    render(<TruncateStart>catalog/vendor/aws.toml</TruncateStart>);
    const el = screen.getByTitle("catalog/vendor/aws.toml");
    expect(el).toHaveClass("wb-truncate-start");
    expect(el.querySelector("bdi")).toHaveTextContent(
      "catalog/vendor/aws.toml",
    );
  });

  it("Button renders a count badge in its name", () => {
    render(
      <Button count={34} icon="download">
        Export
      </Button>,
    );
    const btn = screen.getByRole("button", { name: "Export 34" });
    expect(btn.querySelector(".wb-btn-count")).toHaveTextContent("34");
  });
});

describe("helpers", () => {
  it("isPlainClick rejects modified, non-primary and handled clicks", () => {
    const seen: boolean[] = [];
    render(<button onClick={(e) => seen.push(isPlainClick(e))}>b</button>);
    const b = screen.getByRole("button");
    fireEvent.click(b);
    fireEvent.click(b, { ctrlKey: true });
    fireEvent.click(b, { metaKey: true });
    fireEvent.click(b, { shiftKey: true });
    fireEvent.click(b, { altKey: true });
    fireEvent.click(b, { button: 1 });
    expect(seen).toEqual([true, false, false, false, false, false]);
    const ev = new MouseEvent("click", { cancelable: true, button: 0 });
    ev.preventDefault();
    expect(isPlainClick(ev)).toBe(false);
  });

  it("formatBytes uses binary units, always abbreviated", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1)).toBe("1 B");
    expect(formatBytes(1004)).toBe("1,004 B");
    expect(formatBytes(3.4 * 1024)).toBe("3.4 KB");
    expect(formatBytes(840 * 1024)).toBe("840 KB");
    expect(formatBytes(1023.9 * 1024)).toBe("1.0 MB");
    expect(formatBytes(1.2 * 1024 ** 3)).toBe("1.2 GB");
    expect(formatBytes(5 * 1024 ** 5)).toBe("5,120 TB");
    expect(formatBytes(Number.NaN)).toBe("");
  });

  it("formatRelative reads anything within a minute as just now", () => {
    const now = new Date("2026-09-28T12:00:00Z");
    expect(formatRelative(new Date(now.getTime() + 20_000), now)).toBe(
      "just now",
    );
    expect(formatRelative(new Date(now.getTime() - 20_000), now)).toBe(
      "just now",
    );
    expect(formatRelative(new Date(now.getTime() + 5 * 60_000), now)).toBe(
      "in 5m",
    );
  });

  it("findRowTarget: the row link, else the first Tab stop, else a focusable row, else null", () => {
    render(
      <table>
        <tbody>
          <tr data-wb-row="a">
            <td>
              <button type="button">Edit</button>
            </td>
          </tr>
          <tr data-wb-row="b" tabIndex={-1}>
            <td>text</td>
          </tr>
          <tr data-wb-row="c">
            <td>text</td>
          </tr>
        </tbody>
      </table>,
    );
    expect(findRowTarget("a")).toBe(
      screen.getByRole("button", { name: "Edit" }),
    );
    expect(findRowTarget("b")).toBe(
      document.querySelector('[data-wb-row="b"]'),
    );
    expect(findRowTarget("c")).toBeNull();
    expect(findRowTarget("missing")).toBeNull();
  });
});

describe("ListRow", () => {
  it("a Ctrl/⌘-click on a row with href and onOpen doesn't also open the drawer", () => {
    const onOpen = vi.fn();
    render(
      <Rows>
        <ListRow itemId="x" title="Item x" href="#/x" onOpen={onOpen} />
      </Rows>,
    );
    const link = screen.getByRole("link", { name: "Item x" });
    fireEvent.click(link, { ctrlKey: true });
    fireEvent.click(link, { metaKey: true });
    fireEvent.click(link, { button: 1 });
    expect(onOpen).not.toHaveBeenCalled();
    fireEvent.click(link);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});

describe("[ toggles the sidebar (README recipe)", () => {
  function Page() {
    const shell = useAppShell();
    useHotkey("[", () => shell?.toggleSidebar(), {
      enabled: !!shell?.hasSidebar,
    });
    return <Main label="Page">content</Main>;
  }
  it("collapses and expands", () => {
    render(
      <AppShell
        topBar={<div />}
        sidebar={<Sidebar label="Filters">side</Sidebar>}
      >
        <Page />
      </AppShell>,
    );
    const pane = () => document.querySelector(".wb-sidebar-pane");
    expect(pane()).not.toHaveAttribute("hidden");
    fireEvent.keyDown(document.body, { key: "[" });
    expect(pane()).toHaveAttribute("hidden");
    fireEvent.keyDown(document.body, { key: "[" });
    expect(pane()).not.toHaveAttribute("hidden");
  });
});

describe("priority breakpoints", () => {
  it("table.css and the README agree (p4, p3, p2 = 940, 700, 520px)", () => {
    const css = readFileSync(
      resolve(__dirname, "../src/styles/table.css"),
      "utf8",
    );
    const readme = readFileSync(resolve(__dirname, "../README.md"), "utf8");
    const found = [
      ...css.matchAll(/@container wb-main \(max-width: (\d+)px\)/g),
    ].map((m) => Number(m[1]));
    expect(new Set(found)).toEqual(new Set([940, 700, 520]));
    expect(readme).toContain("at most 520, 700, 940px wide");
  });
});
