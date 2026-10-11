/**
 * Layout lab (not in the nav): fixed-width tables that scripts/layout-check.mjs
 * measures in Chromium to verify DataTable's width rules.
 */
import {
  Button,
  Ctl,
  ListRow,
  Rows,
  DataTable,
  FilterInput,
  Seg,
  Select,
  Spacer,
  Toolbar,
  ToolbarRow,
  ToolbarSummary,
} from "../../../src";
import type { ReactNode } from "react";
import type { DataColumn } from "../../../src";

interface Row {
  id: string;
  name: string;
  desc: string;
  n: number;
}
const LONG =
  "A very long description that keeps going well past any column width, " +
  "repeated to be sure it is longer than three thousand pixels on one line. ".repeat(
    8,
  );
const ROWS: Row[] = [
  { id: "a", name: "alpha", desc: LONG, n: 12 },
  { id: "b", name: "beta gamma", desc: "short", n: 3456 },
];

const cases: {
  id: string;
  columns: DataColumn<Row>[];
  fill?: "spread" | "end";
  cursorRow?: string;
}[] = [
  {
    // fill="end": hugging columns stay at their content width, the filler
    // takes the rest; the cursor ring ends at the last real column
    id: "fillEnd",
    fill: "end",
    cursorRow: "b",
    columns: [
      { key: "name", header: "Name", hug: true, cell: (r) => r.name },
      {
        key: "id",
        header: "Id",
        hug: "12ch",
        cell: (r) => `${r.id}-3f9d2c1e-8b7a-4c55-9e1f-0a2b3c4d5e6f`,
      },
      { key: "n", header: "N", align: "end", cell: (r) => r.n },
    ],
  },
  {
    // the same columns spread (the default): the name grows
    id: "fillSpread",
    columns: [
      { key: "name", header: "Name", cell: (r) => r.name },
      { key: "id", header: "Id", hug: "12ch", cell: (r) => r.id },
      { key: "n", header: "N", align: "end", cell: (r) => r.n },
    ],
  },
  {
    // primary (grow 2) vs a truncating description (grow 1) with long text
    id: "weights",
    columns: [
      { key: "name", header: "Name", truncate: true, cell: (r) => r.name },
      { key: "desc", header: "Desc", truncate: true, cell: (r) => r.desc },
      { key: "n", header: "N", align: "end", cell: (r) => r.n },
    ],
  },
  {
    // a truncating column with grow 0 stays at its minimum
    id: "grow0",
    columns: [
      { key: "name", header: "Name", cell: (r) => r.name },
      {
        key: "desc",
        header: "Desc",
        truncate: true,
        grow: 0,
        cell: (r) => r.desc,
      },
      { key: "n", header: "N", align: "end", cell: (r) => r.n },
    ],
  },
  {
    // unequal weights on wrapping columns; a fixed width is kept
    id: "unequal",
    columns: [
      { key: "name", header: "Name", grow: 0, cell: (r) => r.name },
      { key: "a", header: "A", wrap: true, grow: 3, cell: (r) => r.desc },
      { key: "b", header: "B", wrap: true, grow: 1, cell: (r) => r.desc },
      { key: "w", header: "W", width: 120, cell: (r) => r.n },
    ],
  },
  {
    // relative weights: 0.2:0.1 lays out like 2:1 ("weights")
    id: "fractional",
    columns: [
      {
        key: "name",
        header: "Name",
        truncate: true,
        grow: 0.2,
        cell: (r) => r.name,
      },
      {
        key: "desc",
        header: "Desc",
        truncate: true,
        grow: 0.1,
        cell: (r) => r.desc,
      },
      { key: "n", header: "N", align: "end", cell: (r) => r.n },
    ],
  },
  {
    // a wrapping column with grow 0 stays at its minimum beside a growing one
    id: "wrap0",
    columns: [
      { key: "name", header: "Name", cell: (r) => r.name },
      { key: "desc", header: "Desc", wrap: true, grow: 0, cell: (r) => r.desc },
    ],
  },
  {
    // maxWidth: an ellipsis on one-line cells, wrapping within the cap
    id: "caps",
    columns: [
      { key: "name", header: "Name", cell: (r) => r.name },
      {
        key: "id",
        header: "Id",
        maxWidth: "12ch",
        cell: (r) => `${r.id}-3f9d2c1e-8b7a-4c55-9e1f-0a2b3c4d5e6f`,
      },
      {
        key: "desc",
        header: "Desc",
        wrap: true,
        maxWidth: 200,
        cell: (r) => r.desc,
      },
    ],
  },
];

// Crowded toolbars, measured at main widths 552 (drawer open at
// 1280 with the sidebar), 1012 (1280 with the sidebar) and 1400.
const noop = () => {};
const statusSeg = (
  <Seg
    label="Status"
    value="all"
    onChange={noop}
    options={[
      { value: "all", label: "All", count: 34 },
      {
        value: "on",
        label: "Active",
        icon: "circle-check",
        tone: "success",
        count: 20,
      },
      { value: "off", label: "Disabled", icon: "pause", count: 3 },
      {
        value: "exp",
        label: "Expiring",
        icon: "clock",
        tone: "warning",
        count: 6,
      },
      { value: "rev", label: "Revoked", icon: "ban", tone: "danger", count: 5 },
    ]}
  />
);
const filter = (
  <FilterInput value="" onChange={noop} placeholder="Filter…" hotkey={null} />
);
const group = (
  <Ctl label="Group">
    <Seg
      label="Group"
      size="sm"
      value="svc"
      onChange={noop}
      options={[
        { value: "svc", label: "Service" },
        { value: "none", label: "None" },
      ]}
    />
  </Ctl>
);
const summary = (
  <ToolbarSummary grow>
    <b>10</b> of 10 grants
  </ToolbarSummary>
);
const toolbars: { id: string; row: ReactNode }[] = [
  {
    id: "policies",
    row: (
      <ToolbarRow
        primary={
          <Button variant="primary" icon="plus">
            Create grant
          </Button>
        }
      >
        {statusSeg}
        {filter}
        {group}
        {summary}
      </ToolbarRow>
    ),
  },
  {
    id: "catalog",
    row: (
      <ToolbarRow
        primary={
          <Button variant="primary" icon="plus">
            Add resource
          </Button>
        }
      >
        <Seg
          label="Kind"
          value="all"
          onChange={noop}
          options={[
            { value: "all", label: "All", count: 48 },
            { value: "svc", label: "Services", count: 12 },
            { value: "host", label: "Hosts", count: 36 },
          ]}
        />
        <Select
          aria-label="Type"
          inputSize="sm"
          options={[
            { value: "", label: "Any type" },
            { value: "api", label: "API" },
          ]}
        />
        {filter}
        {group}
        {summary}
      </ToolbarRow>
    ),
  },
  {
    // a Spacer (zero height) must not count as a line of its own
    id: "spacer",
    row: (
      <ToolbarRow
        primary={
          <Button variant="primary" icon="plus">
            New grant
          </Button>
        }
      >
        {filter}
        <Spacer />
        {summary}
      </ToolbarRow>
    ),
  },
  {
    id: "filter-first",
    row: (
      <ToolbarRow
        primary={
          <Button variant="primary" icon="plus">
            New grant
          </Button>
        }
      >
        {filter}
        {statusSeg}
        {summary}
      </ToolbarRow>
    ),
  },
];

interface Audit {
  id: string;
  time: string;
  action: string;
  principal: string;
  decision: string;
  service: string;
}
const AUDIT: Audit[] = [
  {
    id: "a1",
    time: "2h ago",
    action: "admin.tokens.issue_for_service_account_x", // 40 chars
    principal: "sa:release-pipeline@ci-x", // 24 chars
    decision: "allowed",
    service: "github",
  },
  {
    id: "a2",
    time: "3h ago",
    action: "tokens.list",
    principal: "alice.chen",
    decision: "denied",
    service: "jira",
  },
];
const auditColumns: DataColumn<Audit>[] = [
  { key: "time", header: "Time", cell: (r) => r.time },
  {
    key: "action",
    header: "Action",
    primary: true,
    hug: "48ch",
    className: "wb-cell-mono",
    cell: (r) => r.action,
  },
  {
    key: "principal",
    header: "Principal",
    hug: true,
    cell: (r) => r.principal,
  },
  { key: "decision", header: "Decision", cell: (r) => r.decision },
  { key: "service", header: "Service", cell: (r) => r.service },
];

export function LabView() {
  return (
    <div className="gal-lab">
      {/* Visually hidden text after clipped text (a " on jira" suffix in a
          row link) must not widen the scroll area: in a tight table's
          primary hug cell, a truncating cell, and a compact list row. */}
      <div
        className="gal-lab-main gal-lab-scroll"
        data-case="srOnly"
        style={{ width: 420 }}
      >
        <div className="wb-list wb-list--full" style={{ padding: "0 12px" }}>
          <DataTable
            label="srOnly"
            rows={AUDIT}
            rowId={(r) => r.id}
            rowHref={(r) => `#/lab?item=${r.id}`}
            columns={[
              {
                key: "action",
                header: "Action",
                hug: "48ch",
                cell: (r) => (
                  <>
                    {r.action}
                    <span className="wb-sr-only">
                      {" "}
                      on {r.service}, decided by policy
                    </span>
                  </>
                ),
              },
              {
                key: "principal",
                header: "Principal",
                truncate: true,
                cell: (r) => (
                  <>
                    {r.principal}
                    <span className="wb-sr-only">
                      {" "}
                      ({r.decision}) with a long hidden explanation
                    </span>
                  </>
                ),
              },
              { key: "decision", header: "Decision", cell: (r) => r.decision },
            ]}
            cursor={false}
            bleed
          />
          <Rows>
            <ListRow
              itemId="l1"
              compact
              href="#/lab"
              title={
                <>
                  {AUDIT[0]!.action} for a very long list row title
                  <span className="wb-sr-only">
                    {" "}
                    on github, decided by policy
                  </span>
                </>
              }
            />
          </Rows>
        </div>
      </div>
      {/* Audit: hug columns for a long action and principal. At a
          560px main pane (1024 + drawer) they shrink with an ellipsis
          instead of overflowing; at 1400 they show in full, packed left. */}
      {(
        [
          ["auditNarrow", 544],
          ["auditWide", 1376],
        ] as const
      ).map(([id, w]) => (
        <div
          key={id}
          className="gal-lab-main"
          data-case={id}
          style={{ width: w + 16 }}
        >
          <div className="wb-list wb-list--full" style={{ padding: "0 8px" }}>
            <DataTable
              label={id}
              rows={AUDIT}
              rowId={(r) => r.id}
              columns={auditColumns}
              fill="end"
              bleed
              cursor={false}
            />
          </div>
        </div>
      ))}
      {/* fill="end" with a growing name: the filler stays zero-width, also
          inside a card and in compact density */}
      {(["card", "compact"] as const).map((v) => (
        <div key={v} className="gal-lab-case" data-case={`fillGrow-${v}`}>
          <div className={v === "card" ? "wb-table-card" : undefined}>
            <DataTable
              label={`fillGrow-${v}`}
              rows={ROWS}
              rowId={(r) => r.id}
              columns={[
                { key: "name", header: "Name", cell: (r) => r.name },
                { key: "n", header: "N", align: "end", cell: (r) => r.n },
              ]}
              fill="end"
              compact={v === "compact"}
              cursor={false}
            />
          </div>
        </div>
      ))}
      {toolbars.map((t) =>
        [552, 1012, 1400].map((w) => (
          <div
            key={`${t.id}-${w}`}
            className="gal-lab-main"
            data-toolbar={t.id}
            data-width={w}
            style={{ width: w }}
          >
            <Toolbar>{t.row}</Toolbar>
          </div>
        )),
      )}
      {cases.map((c) => (
        <div key={c.id} className="gal-lab-case" data-case={c.id}>
          <DataTable
            label={c.id}
            rows={ROWS}
            rowId={(r) => r.id}
            columns={c.columns}
            fill={c.fill}
            cursor={false}
            rowClassName={(r) =>
              r.id === c.cursorRow ? "is-cursor" : undefined
            }
          />
        </div>
      ))}
    </div>
  );
}
