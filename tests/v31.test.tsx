import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  Badge,
  Button,
  DataTable,
  ErrorState,
  GroupHeader,
  ListGroup,
  ListPager,
  Seg,
  StateCell,
  Toolbar,
  ToolbarRow,
} from "../src";
import type { DataColumn } from "../src";

interface Row {
  id: string;
  name: string;
  desc: string;
  n: number;
}
const ROWS: Row[] = [
  { id: "a", name: "alpha", desc: "first row", n: 1 },
  { id: "b", name: "beta", desc: "second row", n: 22 },
];

function table(columns: DataColumn<Row>[], extra: object = {}) {
  return render(
    <DataTable
      label="Rows"
      rows={ROWS}
      rowId={(r) => r.id}
      columns={columns}
      {...extra}
    />,
  );
}
const header = (name: string) => screen.getByRole("columnheader", { name });
const sizer = (th: HTMLElement) =>
  th.querySelector<HTMLElement>(".wb-th-grow")?.style.gridTemplateColumns;

describe("DataTable widths: fit and grow", () => {
  it("hugs plain columns and lets the primary and truncating columns grow", () => {
    table([
      { key: "name", header: "Name", cell: (r) => r.name },
      { key: "desc", header: "Desc", truncate: true, cell: (r) => r.desc },
      { key: "wrap", header: "Wrap", wrap: true, cell: (r) => r.desc },
      { key: "n", header: "N", align: "end", cell: (r) => r.n },
      { key: "w", header: "W", width: 90, cell: () => "x" },
    ]);
    expect(header("Name")).not.toHaveClass("wb-cell-fit");
    expect(sizer(header("Name"))).toBe("minmax(0, 20000px)");
    expect(sizer(header("Desc"))).toBe("minmax(0, 10000px)");
    expect(sizer(header("Wrap"))).toBe("minmax(0, 10000px)");
    expect(header("N")).toHaveClass("wb-cell-fit");
    expect(sizer(header("N"))).toBeUndefined();
    expect(header("W")).not.toHaveClass("wb-cell-fit");
    expect(sizer(header("W"))).toBeUndefined();
    // the sizer adds nothing to the header's accessible name
    expect(header("Name")).toHaveAccessibleName("Name");
  });

  it("honours explicit fit and grow", () => {
    table(
      [
        { key: "name", header: "Name", grow: 0, cell: (r) => r.name },
        { key: "desc", header: "Desc", grow: 3, cell: (r) => r.desc },
        { key: "n", header: "N", fit: false, cell: (r) => r.n },
        {
          key: "t",
          header: "T",
          truncate: true,
          fit: true,
          grow: 0,
          cell: (r) => r.desc,
        },
      ],
      { sort: null, onSortChange: () => {} },
    );
    expect(sizer(header("Name"))).toBeUndefined();
    // weights are relative: the smallest positive one gets 10000px
    expect(sizer(header("Desc"))).toBe("minmax(0, 10000px)");
    expect(header("Desc")).not.toHaveClass("wb-cell-fit");
    expect(header("N")).not.toHaveClass("wb-cell-fit");
    expect(header("T")).toHaveClass("wb-cell-fit");
  });

  it("normalises weights and hugs non-growing wrapping columns", () => {
    table([
      { key: "name", header: "Name", grow: 0.2, cell: (r) => r.name },
      {
        key: "desc",
        header: "Desc",
        truncate: true,
        grow: 0.1,
        cell: (r) => r.desc,
      },
      { key: "wrap", header: "Wrap", wrap: true, grow: 0, cell: (r) => r.desc },
      { key: "bad", header: "Bad", grow: Number.NaN, cell: (r) => r.n },
    ]);
    expect(sizer(header("Name"))).toBe("minmax(0, 20000px)");
    expect(sizer(header("Desc"))).toBe("minmax(0, 10000px)");
    expect(header("Wrap")).toHaveClass("wb-cell-fit");
    expect(sizer(header("Bad"))).toBeUndefined();
    expect(header("Bad")).toHaveClass("wb-cell-fit");
  });

  it("wrapping cells with maxWidth wrap within the cap (no ellipsis box)", () => {
    table([
      { key: "name", header: "Name", cell: (r) => r.name },
      {
        key: "desc",
        header: "Desc",
        wrap: true,
        maxWidth: 200,
        cell: (r) => r.desc,
      },
    ]);
    const flow = document.querySelector<HTMLElement>("td .wb-cell-flow")!;
    expect(flow.style.maxWidth).toBe("200px");
    expect(document.querySelector("td .wb-cell-cap")).toBeNull();
  });

  it("puts the sizer in sortable headers too", () => {
    table(
      [{ key: "name", header: "Name", sortable: true, cell: (r) => r.name }],
      { sort: null, onSortChange: () => {} },
    );
    expect(sizer(header("Name"))).toBe("minmax(0, 10000px)");
    expect(within(header("Name")).getByRole("button")).toHaveAccessibleName(
      "Name",
    );
  });
});

describe("DataTable cells: maxWidth, title, extra", () => {
  it("caps content at maxWidth with the full value as the tooltip", () => {
    table([
      { key: "name", header: "Name", cell: (r) => r.name },
      {
        key: "id",
        header: "ID",
        maxWidth: "12ch",
        title: (r) => `id ${r.id}`,
        cell: (r) => r.id,
      },
    ]);
    const cell = screen.getByTitle("id a");
    expect(cell.tagName).toBe("TD");
    const cap = cell.querySelector<HTMLElement>(".wb-cell-cap");
    expect(cap).toHaveTextContent("a");
    expect(cap!.style.maxWidth).toBe("12ch");
    expect(header("ID")).toHaveClass("wb-cell-fit");
  });

  it("puts extras beside the row link, outside its accessible name", () => {
    table(
      [
        {
          key: "name",
          header: "Name",
          truncate: true,
          cell: (r) => r.name,
          extra: (r) => (r.n > 10 ? <Badge>broad</Badge> : null),
        },
      ],
      { rowHref: (r: Row) => `#/${r.id}` },
    );
    const link = screen.getByRole("link", { name: "beta" });
    const line = link.closest(".wb-cell-line");
    expect(line).not.toBeNull();
    expect(line!.querySelector(".wb-cell-extra")).toHaveTextContent("broad");
    expect(link).not.toHaveTextContent("broad");
    // no extra, no wrapper
    const plain = screen.getByRole("link", { name: "alpha" });
    expect(plain.closest(".wb-cell-line")).toBeNull();
  });

  it("menu item roles in cells don't open the row", () => {
    const onOpen = vi.fn();
    table(
      [
        { key: "name", header: "Name", cell: (r) => r.name },
        {
          key: "menu",
          header: "Menu",
          cell: (r) => (
            <>
              <span
                role="menuitemradio"
                aria-checked="false"
              >{`radio ${r.id}`}</span>
              <span
                role="menuitemcheckbox"
                aria-checked="false"
              >{`check ${r.id}`}</span>
            </>
          ),
        },
      ],
      { onRowOpen: onOpen },
    );
    fireEvent.click(screen.getByText("radio a"), { detail: 1 });
    fireEvent.click(screen.getByText("check a"), { detail: 1 });
    expect(onOpen).not.toHaveBeenCalled();
  });
});

describe("ToolbarRow primary", () => {
  it("puts the primary action last in a split row", () => {
    render(
      <Toolbar>
        <ToolbarRow primary={<Button variant="primary">New grant</Button>}>
          <input aria-label="Filter" />
          <span>More</span>
        </ToolbarRow>
        <ToolbarRow>
          <span>Plain</span>
        </ToolbarRow>
      </Toolbar>,
    );
    const btn = screen.getByRole("button", { name: "New grant" });
    const row = btn.closest(".wb-toolbar-row")!;
    expect(row).toHaveClass("wb-toolbar-row--split");
    expect(row.lastElementChild).toHaveClass("wb-toolbar-primary");
    expect(row.firstElementChild).toBe(screen.getByLabelText("Filter"));
    expect(screen.getByText("Plain").parentElement).not.toHaveClass(
      "wb-toolbar-row--split",
    );
  });
});

describe("ToolbarRow measured split", () => {
  // Fake geometry: data-top/data-h on each child.
  function geometry() {
    return vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: HTMLElement) {
        const top = Number(this.dataset.top ?? 0);
        const h = Number(this.dataset.h ?? 30);
        return {
          x: 0,
          y: top,
          top,
          left: 0,
          right: 100,
          bottom: top + h,
          width: 100,
          height: h,
          toJSON() {},
        } as DOMRect;
      });
  }
  it("splits only when the one-line layout wraps", () => {
    const spy = geometry();
    const { rerender } = render(
      <Toolbar>
        <ToolbarRow primary={<Button data-top="0">Create</Button>}>
          <span data-top="0">Seg</span>
          <span data-top="5" data-h="20">
            summary
          </span>
        </ToolbarRow>
      </Toolbar>,
    );
    const row = () => document.querySelector(".wb-toolbar-row")!;
    // same line (a shorter, centred item is not a new line)
    expect(row()).not.toHaveAttribute("data-wb-split");
    rerender(
      <Toolbar>
        <ToolbarRow primary={<Button>Create</Button>}>
          <span data-top="0">Seg</span>
          <b data-top="38">summary</b>
        </ToolbarRow>
      </Toolbar>,
    );
    // a content change re-measures (MutationObserver): now it wraps
    return Promise.resolve().then(() => {
      expect(row()).toHaveAttribute("data-wb-split");
      spy.mockRestore();
    });
  });
  it("ignores zero-height children such as Spacer", () => {
    const spy = geometry();
    render(
      <ToolbarRow primary={<Button>Create</Button>}>
        <span data-top="0">filter</span>
        <span data-top="15" data-h="0">
          {""}
        </span>
        <span data-top="0">summary</span>
      </ToolbarRow>,
    );
    expect(document.querySelector(".wb-toolbar-row")).not.toHaveAttribute(
      "data-wb-split",
    );
    spy.mockRestore();
  });
  it("never splits without a primary action", () => {
    const spy = geometry();
    render(
      <ToolbarRow>
        <span data-top="0">a</span>
        <span data-top="40">b</span>
      </ToolbarRow>,
    );
    expect(document.querySelector(".wb-toolbar-row")).not.toHaveAttribute(
      "data-wb-split",
    );
    spy.mockRestore();
  });
});

describe("Seg density", () => {
  const options = [
    { value: "all", label: "All", count: 34 },
    { value: "on", label: "Active", icon: "circle-check" as const, count: 20 },
    { value: "icon", label: "", icon: "ban" as const, title: "Revoked" },
  ];
  it("compact tightens and marks segments whose icon can go", () => {
    render(
      <Seg
        label="Status"
        value="all"
        onChange={() => {}}
        options={options}
        density="compact"
      />,
    );
    const group = screen.getByRole("group", { name: "Status" });
    expect(group).toHaveClass("wb-seg--compact");
    expect(screen.getByRole("button", { name: "Active 20" })).toHaveClass(
      "wb-seg-btn--labelled",
    );
    expect(screen.getByRole("button", { name: "All 34" })).not.toHaveClass(
      "wb-seg-btn--labelled",
    );
    // icon-only segments keep their icon
    expect(screen.getByTitle("Revoked")).not.toHaveClass(
      "wb-seg-btn--labelled",
    );
  });
  it("keeps icons on icon-only segments (iconOnly or a screen-reader-only label)", () => {
    render(
      <Seg
        label="View"
        value="grid"
        onChange={() => {}}
        density="compact"
        options={[
          { value: "grid", label: "Grid", icon: "grid", iconOnly: true },
          {
            value: "list",
            label: <span className="wb-sr-only">List</span>,
            icon: "list",
          },
        ]}
      />,
    );
    const grid = screen.getByRole("button", { name: "Grid" });
    const list = screen.getByRole("button", { name: "List" });
    expect(grid).not.toHaveClass("wb-seg-btn--labelled");
    expect(grid.querySelector(".wb-sr-only")).toHaveTextContent("Grid");
    expect(list).not.toHaveClass("wb-seg-btn--labelled");
  });
  it("defaults to the normal density", () => {
    render(
      <Seg label="Status" value="all" onChange={() => {}} options={options} />,
    );
    expect(screen.getByRole("group", { name: "Status" })).not.toHaveClass(
      "wb-seg--compact",
    );
  });
});

describe("GroupHeader", () => {
  it("can be a static section title with actions", async () => {
    const user = userEvent.setup();
    const issue = vi.fn();
    const { container } = render(
      <GroupHeader
        title="Management tokens"
        count="3 tokens"
        sticky={false}
        actions={<Button onClick={issue}>Issue token</Button>}
      />,
    );
    const h = container.querySelector(".wb-group-h")!;
    expect(h).toHaveClass("wb-group-h--static");
    expect(
      screen.getByRole("heading", { name: "Management tokens" }),
    ).toBeInTheDocument();
    await user.click(
      within(h as HTMLElement).getByRole("button", { name: "Issue token" }),
    );
    expect(issue).toHaveBeenCalled();
  });
  it("sticks by default; ListGroup passes sticky and actions through", () => {
    const { container } = render(
      <ListGroup
        title="Today"
        sticky={false}
        actions={<button>Mark read</button>}
      >
        <li>x</li>
      </ListGroup>,
    );
    expect(container.querySelector(".wb-group-h")).toHaveClass(
      "wb-group-h--static",
    );
    expect(container.querySelector(".wb-group-actions")).toHaveTextContent(
      "Mark read",
    );
    const { container: c2 } = render(<GroupHeader title="Sticky" />);
    expect(c2.querySelector(".wb-group-h")).not.toHaveClass(
      "wb-group-h--static",
    );
  });
});

describe("sticky GroupHeader height", () => {
  it("publishes its height to its parent for row scroll margins", () => {
    const spy = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: HTMLElement) {
        const h = this.classList.contains("wb-group-h") ? 76.4 : 0;
        return {
          x: 0,
          y: 0,
          top: 0,
          left: 0,
          right: 0,
          bottom: h,
          width: 0,
          height: h,
          toJSON() {},
        } as DOMRect;
      });
    const { container, unmount } = render(
      <section className="parent">
        <GroupHeader title="Today" actions={<button>Mark read</button>} />
      </section>,
    );
    const parent = container.querySelector<HTMLElement>(".parent")!;
    expect(parent.style.getPropertyValue("--wb-group-h")).toBe("77px");
    spy.mockRestore();
    unmount();
    expect(parent.style.getPropertyValue("--wb-group-h")).toBe("");
  });
  it("static headers publish nothing", () => {
    const { container } = render(
      <section className="parent">
        <GroupHeader title="Tokens" sticky={false} />
      </section>,
    );
    expect(
      container
        .querySelector<HTMLElement>(".parent")!
        .style.getPropertyValue("--wb-group-h"),
    ).toBe("");
  });
});

describe("StateCell", () => {
  it("quiet: a dot whose label is announced and shown as a tooltip", () => {
    const { container } = render(
      <StateCell label="Active" tone="success" quiet />,
    );
    const cell = container.querySelector(".wb-state-cell")!;
    expect(cell).toHaveClass("wb-state-cell--quiet", "wb-tone-success");
    expect(cell).toHaveAttribute("title", "Active");
    expect(screen.getByText("Active")).toHaveClass("wb-sr-only");
  });
  it("other states show dot and label", () => {
    const { container } = render(<StateCell label="Revoked" tone="danger" />);
    expect(screen.getByText("Revoked")).toHaveClass("wb-state-cell-label");
    expect(container.querySelector(".wb-state-cell")).not.toHaveAttribute(
      "title",
    );
    expect(container.querySelector(".wb-state-cell-dot")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });
});

describe("ListPager disabled", () => {
  it("disables Load more and Retry but keeps the count", () => {
    const more = vi.fn();
    const { rerender } = render(
      <ListPager
        shown={30}
        total={150}
        noun="turn"
        hasMore
        onLoadMore={more}
        disabled
        updating
      />,
    );
    expect(screen.getByText("30 of 150 turns")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Load more turns" }),
    ).toBeDisabled();
    rerender(
      <ListPager
        shown={30}
        total={150}
        noun="turn"
        hasMore
        onLoadMore={more}
        disabled
        error
      />,
    );
    expect(screen.getByRole("button", { name: "Retry" })).toBeDisabled();
  });
});

describe("DataTable error with rows shown (failed refetch)", () => {
  const cols: DataColumn<Row>[] = [
    { key: "name", header: "Name", cell: (r) => r.name },
    { key: "n", header: "N", align: "end", cell: (r) => r.n },
  ];
  it("keeps the rows, marks them stale and shows the error with its Retry above them", async () => {
    const user = userEvent.setup();
    const retry = vi.fn();
    const { rerender } = render(
      <DataTable
        label="Grants"
        rows={ROWS}
        rowId={(r) => r.id}
        columns={cols}
        onRowOpen={() => {}}
        error={
          <ErrorState
            compact
            title="Couldn’t refresh grants"
            error={new Error("503")}
            onRetry={retry}
          />
        }
      />,
    );
    const table = screen.getByRole("table", { name: "Grants" });
    expect(table).toHaveClass("is-stale");
    // rows stay
    expect(table.querySelectorAll("tr[data-wb-row]")).toHaveLength(2);
    // the alert row comes first, spans the table and holds the error node
    const alertRow = table.querySelector(
      "tbody:first-of-type > tr.wb-table-alert",
    )!;
    expect(alertRow).not.toBeNull();
    expect(alertRow.querySelector("td")).toHaveAttribute("colspan", "2");
    const alert = screen.getByRole("alert");
    expect(alertRow).toContainElement(alert);
    expect(alert).toHaveTextContent("Couldn’t refresh grants");
    await user.click(within(alert).getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalledTimes(1);
    // the alert row is not a data row: j lands on the first real row
    fireEvent.keyDown(document.body, { key: "j" });
    expect(table.querySelector('tr[data-wb-row="a"]')).toHaveClass("is-cursor");
    // retrying: busy; success clears the error and the stale mark
    rerender(
      <DataTable
        label="Grants"
        rows={ROWS}
        rowId={(r) => r.id}
        columns={cols}
        loading
        error={
          <ErrorState
            compact
            error={new Error("503")}
            onRetry={retry}
            retrying
          />
        }
      />,
    );
    expect(table).toHaveAttribute("aria-busy", "true");
    expect(table).toHaveClass("is-stale");
    rerender(
      <DataTable
        label="Grants"
        rows={ROWS}
        rowId={(r) => r.id}
        columns={cols}
      />,
    );
    expect(table).not.toHaveClass("is-stale");
    expect(table.querySelector(".wb-table-alert")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("puts the alert above group rows too, and wraps plain text in a danger alert", () => {
    render(
      <DataTable
        label="Grants"
        rows={ROWS}
        rowId={(r) => r.id}
        columns={cols}
        groupBy={(r) => (r.n > 10 ? "big" : "small")}
        error="Couldn’t load deleted grants."
      />,
    );
    const table = screen.getByRole("table");
    const bodies = table.querySelectorAll("tbody");
    expect(bodies[0]).toHaveClass("wb-table-alert-body");
    expect(bodies[1]!.querySelector("th[scope=rowgroup]")).not.toBeNull();
    const alert = screen.getByRole("alert");
    expect(alert).toHaveClass("wb-banner", "wb-tone-danger");
    expect(alert).toHaveTextContent("Couldn’t load deleted grants.");
  });

  it("shows numeric errors (even 0) as text", () => {
    render(
      <DataTable
        label="Grants"
        rows={ROWS}
        rowId={(r) => r.id}
        columns={cols}
        error={0}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("0");
  });

  it("with no rows the error still fills the table and nothing is stale", () => {
    render(
      <DataTable
        label="Grants"
        rows={[]}
        rowId={(r: Row) => r.id}
        columns={cols}
        error={<ErrorState compact error={new Error("502")} />}
        empty={<p>No grants</p>}
      />,
    );
    const table = screen.getByRole("table");
    expect(table).not.toHaveClass("is-stale");
    expect(table.querySelector("tr.wb-table-empty")).toContainElement(
      screen.getByRole("alert"),
    );
    expect(screen.queryByText("No grants")).toBeNull();
  });
});
