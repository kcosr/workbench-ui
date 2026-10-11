import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  AppShell,
  Avatar,
  Badge,
  Button,
  DataTable,
  Drawer,
  DrawerSection,
  EmptyState,
  ErrorState,
  FilterInput,
  GroupHeader,
  Icon,
  IconButton,
  KeyValue,
  List,
  ListFooter,
  ListPager,
  Main,
  Menu,
  Seg,
  Sidebar,
  SidebarItem,
  SidebarSection,
  Sparkline,
  StateCell,
  StatusDot,
  Switch,
  TableGroupHeader,
  Time,
  Toolbar,
  ToolbarRow,
  TruncateStart,
  findRowTarget,
  formatBytes,
  formatNumber,
  plural,
  useToast,
} from "../../../src";
import type { DataColumn, IconName, SortState, Tone } from "../../../src";
import { hrefFor, useRoute } from "../router";

type Variant = "grants" | "people" | "activity" | "rules" | "sections";

const VARIANTS: { id: Variant; label: string; icon: IconName; note: string }[] =
  [
    {
      id: "grants",
      label: "Grants",
      icon: "shield",
      note: "grouped by service",
    },
    {
      id: "people",
      label: "People",
      icon: "users",
      note: "numbers + sparklines",
    },
    {
      id: "activity",
      label: "Activity",
      icon: "activity",
      note: "live + paging",
    },
    {
      id: "rules",
      label: "Rules",
      icon: "list",
      note: "switches, compact",
    },
    {
      id: "sections",
      label: "Sections",
      icon: "user",
      note: "small tables under section titles",
    },
  ];

// ---------------------------------------------------------------- data

function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function pick<T>(r: () => number, list: readonly T[]): T {
  return list[Math.floor(r() * list.length)] as T;
}

const NOW = Date.now();
const SERVICES = [
  "cloudbees",
  "confluence",
  "github",
  "jira",
  "slack",
] as const;
const SUBJECTS = [
  "group:engineering",
  "group:platform-admins",
  "user:alice.chen",
  "user:bob.okafor",
  "sa:ci-runner",
  "sa:docs-indexer",
  "group:platform-admins-emea-oncall",
  "sa:release-pipeline@build.example.com",
];

type GrantStatus = "active" | "disabled" | "expiring" | "revoked";
const GRANT_STATE: Record<
  GrantStatus,
  { label: string; tone: Tone; icon: IconName }
> = {
  active: { label: "Active", tone: "success", icon: "circle-check" },
  disabled: { label: "Disabled", tone: "muted", icon: "pause" },
  expiring: { label: "Expires soon", tone: "warning", icon: "clock" },
  revoked: { label: "Revoked", tone: "danger", icon: "ban" },
};
const pickStatus = (x: number): GrantStatus =>
  x < 0.72
    ? "active"
    : x < 0.84
      ? "disabled"
      : x < 0.93
        ? "expiring"
        : "revoked";
/** A table cell for a grant's state: the normal state is a quiet dot. */
function GrantState({ status }: { status: GrantStatus }) {
  const s = GRANT_STATE[status];
  return (
    <StateCell label={s.label} tone={s.tone} quiet={status === "active"} />
  );
}

interface Grant {
  id: string;
  name: string;
  subject: string;
  service: string;
  actions: number;
  context: string;
  status: GrantStatus;
  updated: Date;
}
const GRANTS: Grant[] = (() => {
  const r = rng(7);
  const names = [
    "read access",
    "write access",
    "admin",
    "CI tokens",
    "incident response",
    "docs sync",
    "read-only access for quarterly compliance audits",
  ];
  return Array.from({ length: 34 }, (_, i) => {
    const service = pick(r, SERVICES);
    return {
      id: `g-${101 + i}`,
      name: `${service} ${pick(r, names)}`,
      subject: pick(r, SUBJECTS),
      service,
      actions: 1 + Math.floor(r() * 18),
      context: pick(r, ["default", "sandbox", "ci", "any"]),
      status: pickStatus(r()),
      updated: new Date(
        NOW - Math.floor(r() * 60) * 86_400_000 - Math.floor(r() * 86_400_000),
      ),
    };
  });
})();

interface Person {
  id: string;
  name: string;
  requests: number;
  tokens: number;
  cost: number;
  trend: number[];
  last: Date;
}
const PEOPLE: Person[] = (() => {
  const r = rng(11);
  const first = [
    "Alice",
    "Bob",
    "Carmen",
    "Dmitri",
    "Emma",
    "Farah",
    "Goran",
    "Hana",
    "Ivan",
    "Jun",
    "Kira",
    "Luis",
  ];
  const last = [
    "Chen",
    "Okafor",
    "Ruiz",
    "Volkov",
    "Lindqvist",
    "Haddad",
    "Petrov",
    "Sato",
    "Novak",
    "Park",
    "Berg",
    "Mora",
  ];
  return Array.from({ length: 24 }, (_, i) => {
    const base = 20 + r() * 400;
    const trend = Array.from({ length: 14 }, () =>
      Math.round(base * (0.3 + r() * 1.2)),
    );
    const requests = trend.reduce((a, b) => a + b, 0);
    return {
      id: `p-${i + 1}`,
      name: `${pick(r, first)} ${pick(r, last)}`,
      requests,
      tokens: Math.round(requests * (800 + r() * 3000)),
      cost: requests * (0.002 + r() * 0.02),
      trend,
      last: new Date(NOW - Math.floor(r() * 72) * 3_600_000),
    };
  });
})();

interface Turn {
  id: string;
  at: Date;
  principal: string;
  model: string;
  decision: "allowed" | "denied" | "redacted";
  bytes: number;
  latencyMs: number;
  state: "pending" | "done";
}
const MODELS = ["claude-opus-5", "claude-sonnet-5", "gpt-5.5", "gemma-4-31b"];
const DECISION: Record<Turn["decision"], { tone: Tone; icon: IconName }> = {
  allowed: { tone: "success", icon: "shield-check" },
  denied: { tone: "danger", icon: "ban" },
  redacted: { tone: "warning", icon: "eye-off" },
};
let turnSeq = 5000;
function makeTurn(
  r: () => number,
  at: number,
  state: Turn["state"] = "done",
): Turn {
  const roll = r();
  return {
    id: `t-${turnSeq++}`,
    at: new Date(at),
    principal: pick(r, PEOPLE).name,
    model: pick(r, MODELS),
    decision: roll < 0.75 ? "allowed" : roll < 0.9 ? "redacted" : "denied",
    bytes: Math.round(200 + r() * 90_000),
    latencyMs: Math.round(120 + r() * 4000),
    state,
  };
}
const TURN_TOTAL = 150;
const PAGE = 30;

interface Rule {
  id: string;
  kind: "literal" | "regex" | "catalog";
  description: string;
  source: string;
  action: "redact" | "block" | "audit";
  hits: number;
  enabled: boolean;
}
const RULES: Rule[] = [
  {
    id: "aws-access-key",
    kind: "regex",
    description: "AWS access key IDs in any response body",
    source: "rules.d/cloud/aws/credentials.toml",
    action: "redact",
    hits: 1284,
    enabled: true,
  },
  {
    id: "pii-email",
    kind: "catalog",
    description: "Email addresses outside the company domain",
    source: "catalog/pii/email.toml",
    action: "redact",
    hits: 9120,
    enabled: true,
  },
  {
    id: "project-nightingale",
    kind: "literal",
    description: "Internal codename; never leaves the network",
    source: "rules.d/codenames/nightingale.toml",
    action: "block",
    hits: 12,
    enabled: true,
  },
  {
    id: "gitleaks_aws_access_token",
    kind: "catalog",
    description: "gitleaks: AWS access tokens (AKIA, ASIA)",
    source: "catalog/vendor/gitleaks/2026-09/aws.toml",
    action: "redact",
    hits: 341,
    enabled: false,
  },
  {
    id: "jwt-token",
    kind: "regex",
    description: "JSON Web Tokens in logs and build output",
    source: "rules.d/auth/jwt.toml",
    action: "redact",
    hits: 77,
    enabled: true,
  },
  {
    id: "iban",
    kind: "catalog",
    description: "International bank account numbers",
    source: "catalog/finance/iban.toml",
    action: "audit",
    hits: 3,
    enabled: true,
  },
  {
    id: "db-primary-host",
    kind: "literal",
    description: "Hostname of the primary database cluster",
    source: "rules.d/infra/hosts.toml",
    action: "block",
    hits: 0,
    enabled: false,
  },
];
const KIND_ICON: Record<Rule["kind"], IconName> = {
  literal: "code",
  regex: "braces",
  catalog: "book",
};
const ACTION_TONE: Record<Rule["action"], Tone> = {
  redact: "warning",
  block: "danger",
  audit: "neutral",
};

// ---------------------------------------------------------------- helpers

function compare(a: unknown, b: unknown): number {
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}
function sortRows<T>(
  rows: readonly T[],
  sort: SortState | null,
  get: (row: T, key: string) => unknown,
): T[] {
  if (!sort) return [...rows];
  const dir = sort.dir === "asc" ? 1 : -1;
  return [...rows].sort(
    (a, b) => dir * compare(get(a, sort.key), get(b, sort.key)),
  );
}
function parseSort(v: string | null): SortState | null {
  if (!v) return null;
  const [key, dir] = v.split(":");
  return key && (dir === "asc" || dir === "desc") ? { key, dir } : null;
}
// "none" records an explicitly cleared sort, so a view's default sort only
// applies while the URL has no sort at all.
const sortParam = (s: SortState | null) => (s ? `${s.key}:${s.dir}` : "none");
const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

// ---------------------------------------------------------------- view

export function TablesView({ topBar }: { topBar: ReactNode }) {
  const { params, setParams } = useRoute();
  const toast = useToast();
  const [retrying, setRetrying] = useState(false);
  const variant = (params.get("v") as Variant | null) ?? "grants";
  const q = params.get("q") ?? "";
  const state = params.get("state") ?? "data";
  const compact =
    params.get("density") === "compact" ||
    (variant === "rules" && params.get("density") !== "default");
  const rawSort = params.get("sort");
  const sort =
    rawSort === null && variant === "people"
      ? ({ key: "requests", dir: "desc" } as const)
      : parseSort(rawSort);
  const openId = params.get("item");
  const link = (patch: Record<string, string | null>) => {
    const next = Object.fromEntries(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) delete next[k];
      else next[k] = v;
    }
    return hrefFor("/tables", next);
  };
  const setSort = (s: SortState | null) => setParams({ sort: sortParam(s) });

  // "stale": rows are shown but the latest refetch failed.
  const rowsShown = state === "data" || state === "stale";
  const stateRows = <T,>(rows: T[]): T[] => (rowsShown ? rows : []);
  const loading = state === "loading" || retrying;
  const retryRefresh = () => {
    setRetrying(true);
    setTimeout(() => {
      setRetrying(false);
      setParams({ state: null });
    }, 900);
  };
  const error =
    state === "error" ? (
      <ErrorState
        compact
        error={new Error("GET /api/grants failed: 502 Bad Gateway")}
        onRetry={() => setParams({ state: null })}
      />
    ) : state === "stale" ? (
      <ErrorState
        compact
        title={`Couldn’t refresh ${variant}`}
        error={
          new Error(
            "GET /api/grants?include=deleted failed: 503. Showing the last loaded rows.",
          )
        }
        onRetry={retryRefresh}
        retrying={retrying}
      />
    ) : undefined;
  const empty = (
    <EmptyState
      compact
      icon="search"
      title={q ? `Nothing matches “${q}”` : "Nothing here yet"}
      actions={
        q ? (
          <Button onClick={() => setParams({ q: null })}>Clear filter</Button>
        ) : null
      }
    >
      Try another filter.
    </EmptyState>
  );

  const sidebar = (
    <Sidebar label="Table variants">
      <SidebarSection title="Variants">
        {VARIANTS.map((v) => (
          <SidebarItem
            key={v.id}
            icon={v.icon}
            label={v.label}
            current={variant === v.id}
            href={hrefFor("/tables", { v: v.id })}
            title={v.note}
          />
        ))}
      </SidebarSection>
      <SidebarSection title="Shows">
        <div className="gal-side-note">
          {VARIANTS.find((v) => v.id === variant)?.note}
        </div>
      </SidebarSection>
      <SidebarSection title="Demo">
        <div className="gal-side-pad gal-side-stack">
          <Seg
            label="State"
            size="sm"
            full
            value={state}
            onChange={(v) => setParams({ state: v === "data" ? null : v })}
            options={[
              { value: "data", label: "Data" },
              { value: "loading", label: "Loading" },
              { value: "empty", label: "Empty" },
              { value: "error", label: "Error" },
              { value: "stale", label: "Stale" },
            ]}
          />
          <Seg
            label="Density"
            size="sm"
            full
            value={compact ? "compact" : "default"}
            onChange={(v) => setParams({ density: v })}
            options={[
              { value: "default", label: "Default" },
              { value: "compact", label: "Compact" },
            ]}
          />
        </div>
      </SidebarSection>
    </Sidebar>
  );

  // Status filter per variant: a real app toolbar (filter, a status
  // segment with counts, the page's primary action).
  const statusParam = params.get("status") ?? "all";
  const setStatus = (v: string) =>
    setParams({ status: v === "all" ? null : v, item: null });
  let statusSeg: ReactNode = null;
  let primary: ReactNode = (
    <Button icon="download" onClick={() => toast("Exported")}>
      Export
    </Button>
  );
  if (variant === "grants") {
    const count = (st: GrantStatus) =>
      GRANTS.filter((g) => g.status === st).length;
    statusSeg = (
      <Seg
        label="Status"
        value={statusParam}
        onChange={setStatus}
        options={[
          { value: "all", label: "All", count: GRANTS.length },
          ...(Object.keys(GRANT_STATE) as GrantStatus[]).map((st) => ({
            value: st,
            label: st === "expiring" ? "Expiring" : GRANT_STATE[st].label,
            icon: GRANT_STATE[st].icon,
            tone: GRANT_STATE[st].tone,
            count: count(st),
          })),
        ]}
      />
    );
    primary = (
      <Button variant="primary" icon="plus" onClick={() => toast("New grant")}>
        New grant
      </Button>
    );
  } else if (variant === "activity") {
    statusSeg = (
      <Seg
        label="Decision"
        value={statusParam}
        onChange={setStatus}
        options={[
          { value: "all", label: "All" },
          ...(["allowed", "redacted", "denied"] as const).map((d) => ({
            value: d,
            label: d[0]!.toUpperCase() + d.slice(1),
            icon: DECISION[d].icon,
            tone: DECISION[d].tone,
          })),
        ]}
      />
    );
  } else if (variant === "rules") {
    statusSeg = (
      <Seg
        label="Enabled"
        value={statusParam}
        onChange={setStatus}
        options={[
          { value: "all", label: "All", count: RULES.length },
          {
            value: "on",
            label: "Enabled",
            icon: "circle-check",
            tone: "success",
            count: RULES.filter((r) => r.enabled).length,
          },
          {
            value: "off",
            label: "Disabled",
            icon: "pause",
            count: RULES.filter((r) => !r.enabled).length,
          },
        ]}
      />
    );
    primary = (
      <Button variant="primary" icon="plus" onClick={() => toast("New rule")}>
        New rule
      </Button>
    );
  } else if (variant === "sections") {
    primary = null;
  }

  const toolbar = (
    <Toolbar>
      <ToolbarRow primary={primary}>
        <FilterInput
          value={q}
          onChange={(v) => setParams({ q: v || null }, { replace: true })}
          placeholder={`Filter ${variant}…`}
          debounceMs={150}
        />
        {statusSeg}
      </ToolbarRow>
    </Toolbar>
  );

  let content: ReactNode;
  let drawer: ReactNode = null;
  const closeDrawer = () => setParams({ item: null });

  if (variant === "grants") {
    const rows = stateRows(
      sortRows(
        GRANTS.filter(
          (g) =>
            (statusParam === "all" || g.status === statusParam) &&
            (!q ||
              `${g.name} ${g.subject} ${g.id}`
                .toLowerCase()
                .includes(q.toLowerCase())),
        ),
        sort,
        (g, k) => g[k as keyof Grant],
      ).sort((a, b) => a.service.localeCompare(b.service)),
    );
    const columns: DataColumn<Grant>[] = [
      {
        key: "name",
        header: "Grant",
        sortable: true,
        truncate: true,
        cell: (g) => g.name,
        // beside the link, not part of its accessible name
        extra: (g) =>
          g.actions > 15 ? (
            <Badge
              tone="warning"
              variant="outline"
              title="More than 15 actions"
            >
              broad
            </Badge>
          ) : null,
      },
      {
        key: "subject",
        header: "Subject",
        sortable: true,
        priority: 2,
        truncate: true,
        // ids need a few more characters than the default 10ch to be useful
        minWidth: "16ch",
        cell: (g) => <span className="wb-mono">{g.subject}</span>,
      },
      {
        key: "actions",
        header: "Actions",
        sortable: true,
        firstSortDir: "desc",
        align: "end",
        priority: 3,
        cell: (g) => formatNumber(g.actions),
      },
      {
        key: "context",
        header: "Context",
        priority: 4,
        cell: (g) => <code>{g.context}</code>,
      },
      {
        key: "status",
        header: "Status",
        cell: (g) => <GrantState status={g.status} />,
      },
      {
        key: "updated",
        header: "Updated",
        sortable: true,
        firstSortDir: "desc",
        priority: 3,
        cell: (g) => <Time value={g.updated} />,
      },
      {
        key: "menu",
        header: <span className="wb-sr-only">Actions</span>,
        className: "wb-cell-actions",
        cell: (g) => (
          <div className="wb-row-actions">
            <Menu
              label={`Actions for ${g.name}`}
              items={[
                {
                  id: "edit",
                  label: "Edit",
                  icon: "pencil",
                  onSelect: () => toast(`Edit ${g.id}`),
                },
                {
                  id: "audit",
                  label: "View audit",
                  icon: "list",
                  onSelect: () => toast(`Audit for ${g.id}`),
                },
                { type: "separator" },
                {
                  id: "disable",
                  label: g.status === "active" ? "Disable" : "Enable",
                  icon: "pause",
                  onSelect: () => toast("Toggled"),
                },
              ]}
              trigger={(props) => (
                <IconButton
                  {...props}
                  icon="more"
                  label={`Actions for ${g.name}`}
                  size="sm"
                />
              )}
            />
          </div>
        ),
      },
    ];
    content = (
      <List full>
        <DataTable
          label="Grants"
          rows={rows}
          rowId={(g) => g.id}
          columns={columns}
          sort={sort}
          onSortChange={setSort}
          groupBy={(g) => g.service}
          groupHeader={({ key, rows: gr }) => (
            <TableGroupHeader
              title={key}
              sub="service"
              count={`${gr.length} ${plural(gr.length, "grant")}`}
            />
          )}
          activeId={openId}
          rowHref={(g) => link({ item: openId === g.id ? null : g.id })}
          onRowFollow={(g) => setParams({ item: g.id }, { replace: true })}
          rowDim={(g) => g.status === "disabled" || g.status === "revoked"}
          cursorResetKey={`${q}|${params.get("sort")}`}
          loading={loading}
          empty={empty}
          error={error}
          compact={compact}
          bleed
        />
        {state === "data" ? (
          <ListFooter
            hints={[
              [["j", "k"], "move"],
              [["↵"], "open"],
              [["/"], "filter"],
            ]}
          />
        ) : null}
      </List>
    );
    const g = GRANTS.find((x) => x.id === openId);
    if (g) {
      drawer = (
        <Drawer
          resetKey={g.id}
          onClose={closeDrawer}
          returnFocus={() => findRowTarget(g.id)}
          kicker={
            <>
              <Icon name="shield" />
              <span className="wb-num">{g.id}</span>
            </>
          }
          title={g.name}
          meta={
            <Badge variant="dot" tone={GRANT_STATE[g.status].tone}>
              {GRANT_STATE[g.status].label}
            </Badge>
          }
        >
          <DrawerSection title="Grant">
            <KeyValue
              items={[
                { label: "Service", value: g.service },
                {
                  label: "Subject",
                  value: <span className="wb-mono">{g.subject}</span>,
                },
                { label: "Actions", value: g.actions },
                { label: "Context", value: <code>{g.context}</code> },
                {
                  label: "Updated",
                  value: <Time value={g.updated} format="datetime" />,
                },
              ]}
            />
          </DrawerSection>
        </Drawer>
      );
    }
  } else if (variant === "people") {
    const rows = stateRows(
      sortRows(
        PEOPLE.filter(
          (p) => !q || p.name.toLowerCase().includes(q.toLowerCase()),
        ),
        sort,
        (p, k) => p[k as keyof Person],
      ),
    );
    const columns: DataColumn<Person>[] = [
      {
        key: "name",
        header: "Principal",
        sortable: true,
        cell: (p) => (
          <span className="gal-person-cell">
            <Avatar name={p.name} size="md" />
            {p.name}
          </span>
        ),
      },
      {
        key: "requests",
        header: "Requests",
        sortable: true,
        firstSortDir: "desc",
        align: "end",
        width: 100,
        cell: (p) => formatNumber(p.requests),
      },
      {
        key: "trend",
        header: "14 days",
        priority: 2,
        width: 96,
        className: "wb-cell-spark",
        cell: (p) => (
          <Sparkline
            values={p.trend}
            label={`Requests per day for ${p.name}, last 14 days; latest ${formatNumber(p.trend[p.trend.length - 1] ?? 0)}`}
          />
        ),
      },
      {
        key: "tokens",
        header: "Tokens",
        sortable: true,
        firstSortDir: "desc",
        align: "end",
        priority: 3,
        width: 110,
        cell: (p) => formatNumber(p.tokens),
      },
      {
        key: "cost",
        header: "Cost",
        sortable: true,
        firstSortDir: "desc",
        align: "end",
        width: 100,
        cell: (p) => usd.format(p.cost),
      },
      {
        key: "last",
        header: "Last active",
        sortable: true,
        firstSortDir: "desc",
        priority: 4,
        width: 110,
        cell: (p) => <Time value={p.last} />,
      },
    ];
    content = (
      <List full>
        <DataTable
          label="People"
          rows={rows}
          rowId={(p) => p.id}
          columns={columns}
          sort={sort}
          onSortChange={setSort}
          activeId={openId}
          rowHref={(p) => link({ item: openId === p.id ? null : p.id })}
          onRowFollow={(p) => setParams({ item: p.id }, { replace: true })}
          cursorResetKey={`${q}|${params.get("sort")}`}
          loading={loading}
          empty={empty}
          error={error}
          compact={compact}
          bleed
        />
      </List>
    );
    const p = PEOPLE.find((x) => x.id === openId);
    if (p) {
      drawer = (
        <Drawer
          resetKey={p.id}
          onClose={closeDrawer}
          returnFocus={() => findRowTarget(p.id)}
          kicker={
            <>
              <Icon name="user" />
              <span className="wb-num">{p.id}</span>
            </>
          }
          title={p.name}
          actions={
            <Button variant="primary" icon="external" href="#/people/u-alice">
              Open full page
            </Button>
          }
        >
          <DrawerSection title="Usage (14 days)">
            <Sparkline
              values={p.trend}
              variant="line"
              width={460}
              height={64}
              label={`Requests per day for ${p.name}`}
            />
            <KeyValue
              items={[
                { label: "Requests", value: formatNumber(p.requests) },
                { label: "Tokens", value: formatNumber(p.tokens) },
                { label: "Cost", value: usd.format(p.cost) },
              ]}
            />
          </DrawerSection>
        </Drawer>
      );
    }
  } else if (variant === "activity") {
    content = (
      <ActivityTable
        q={q}
        loading={loading}
        decision={statusParam}
        openId={openId}
        state={rowsShown ? "data" : state}
        compact={compact}
        empty={empty}
        error={error}
        link={link}
      />
    );
    drawer = openId ? (
      <Drawer
        resetKey={openId}
        onClose={closeDrawer}
        returnFocus={() => findRowTarget(openId)}
        kicker={
          <>
            <Icon name="activity" />
            <span className="wb-num">{openId}</span>
          </>
        }
        title={`Turn ${openId}`}
      >
        <DrawerSection title="Turn">
          <p className="gal-note">
            Details for {openId}. j/k move the cursor and this drawer follows.
          </p>
        </DrawerSection>
      </Drawer>
    ) : null;
  } else if (variant === "sections") {
    content = (
      <SectionsPage
        q={q}
        loading={loading}
        openId={openId}
        state={rowsShown ? "data" : state}
        compact={compact}
        link={link}
      />
    );
    const t = TOKENS.find((x) => x.id === openId);
    if (t) {
      drawer = (
        <Drawer
          resetKey={t.id}
          onClose={closeDrawer}
          returnFocus={() => findRowTarget(t.id)}
          kicker={
            <>
              <Icon name="key" />
              <span className="wb-num">{t.id}</span>
            </>
          }
          title={t.name}
          meta={
            <Badge variant="dot" tone={TOKEN_STATE[t.state].tone}>
              {TOKEN_STATE[t.state].label}
            </Badge>
          }
        >
          <DrawerSection title="Token">
            <KeyValue
              items={[
                { label: "Scope", value: <code>{t.scope}</code> },
                {
                  label: "Created",
                  value: <Time value={t.created} format="datetime" />,
                },
                {
                  label: "Last used",
                  value: t.lastUsed ? <Time value={t.lastUsed} /> : "Never",
                },
              ]}
            />
          </DrawerSection>
        </Drawer>
      );
    }
  } else {
    content = (
      <RulesTable
        q={q}
        loading={loading}
        enabledFilter={statusParam}
        state={rowsShown ? "data" : state}
        compact={compact}
        empty={empty}
        error={error}
        openId={openId}
        link={link}
      />
    );
    const r = RULES.find((x) => x.id === openId);
    if (r) {
      drawer = (
        <Drawer
          size="wide"
          resetKey={r.id}
          onClose={closeDrawer}
          returnFocus={() => findRowTarget(r.id)}
          kicker={
            <>
              <Icon name={KIND_ICON[r.kind]} />
              {r.kind}
            </>
          }
          title={<span className="wb-mono gal-title-mono">{r.id}</span>}
          label={`Rule ${r.id}`}
        >
          <DrawerSection title="Definition">
            <KeyValue
              items={[
                { label: "Description", value: r.description },
                {
                  label: "Source",
                  value: <TruncateStart>{r.source}</TruncateStart>,
                },
                {
                  label: "Action",
                  value: <Badge tone={ACTION_TONE[r.action]}>{r.action}</Badge>,
                },
              ]}
            />
          </DrawerSection>
        </Drawer>
      );
    }
  }

  return (
    <AppShell
      topBar={topBar}
      sidebar={sidebar}
      sidebarStorageKey="workbench-gallery:sidebar"
      drawer={drawer}
    >
      <Main toolbar={toolbar} label="Tables">
        {content}
      </Main>
    </AppShell>
  );
}

// ---------------------------------------------------------------- live activity with paging

function ActivityTable({
  q,
  loading,
  decision,
  openId,
  state,
  compact,
  empty,
  error,
  link,
}: {
  q: string;
  loading: boolean;
  decision: string;
  openId: string | null;
  state: string;
  compact: boolean;
  empty: ReactNode;
  error: ReactNode;
  link: (patch: Record<string, string | null>) => string;
}) {
  const { setParams } = useRoute();
  const r = useRef(rng(23));
  const [rows, setRows] = useState<Turn[]>(() => {
    const out: Turn[] = [];
    let t = NOW - 30_000;
    for (let i = 0; i < PAGE; i++) {
      out.push(makeTurn(r.current, t));
      t -= Math.round(r.current() * 600_000);
    }
    return out;
  });
  const [loaded, setLoaded] = useState(PAGE);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failNext, setFailNext] = useState(false);
  const [pageError, setPageError] = useState(false);
  // A new result set (filter change) is loading: Load more waits.
  const [refreshing, setRefreshing] = useState(false);
  const firstFilter = useRef(true);
  useEffect(() => {
    if (firstFilter.current) {
      firstFilter.current = false;
      return;
    }
    setRefreshing(true);
    const t = setTimeout(() => setRefreshing(false), 900);
    return () => clearTimeout(t);
  }, [decision, q]);
  const [follow, setFollow] = useState(true);
  const [held, setHeld] = useState<Turn[]>([]);
  const [cursorId, setCursorId] = useState<string | null>(null);
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set());
  const wrap = useRef<HTMLDivElement | null>(null);

  // Hold new rows while the user is on a row (cursor, open drawer, focus in the table).
  const onRow = useRef(false);
  onRow.current = cursorId !== null || openId !== null;
  const busy = () =>
    onRow.current || !!wrap.current?.contains(document.activeElement);

  useEffect(() => {
    if (!follow || state !== "data") return;
    const t = setInterval(() => {
      const turn = makeTurn(r.current, Date.now(), "pending");
      if (busy()) setHeld((h) => [turn, ...h]);
      else {
        setRows((rs) => [turn, ...rs]);
        setFresh(new Set([turn.id]));
      }
      // The turn completes a bit later: updated in place, never reordered.
      setTimeout(() => {
        const done = (x: Turn) =>
          x.id === turn.id ? { ...x, state: "done" as const } : x;
        setRows((rs) => rs.map(done));
        setHeld((h) => h.map(done));
      }, 1800);
    }, 2600);
    return () => clearInterval(t);
  }, [follow, state]);

  const showHeld = () => {
    setRows((rs) => [...held, ...rs]);
    setFresh(new Set(held.map((h) => h.id)));
    setHeld([]);
  };

  const loadMore = () => {
    setLoadingMore(true);
    setPageError(false);
    setTimeout(() => {
      setLoadingMore(false);
      if (failNext) {
        setPageError(true);
        setFailNext(false);
        return;
      }
      setRows((rs) => {
        const out = [...rs];
        let t = (rs[rs.length - 1]?.at.getTime() ?? NOW) - 60_000;
        for (let i = 0; i < PAGE && loaded + i < TURN_TOTAL; i++) {
          out.push(makeTurn(r.current, t));
          t -= Math.round(r.current() * 600_000);
        }
        return out;
      });
      setLoaded((n) => Math.min(TURN_TOTAL, n + PAGE));
    }, 700);
  };

  const shown =
    state === "data"
      ? rows.filter(
          (t) =>
            (decision === "all" ||
              (t.state === "done" && t.decision === decision)) &&
            (!q ||
              `${t.principal} ${t.model} ${t.id}`
                .toLowerCase()
                .includes(q.toLowerCase())),
        )
      : [];
  const columns: DataColumn<Turn>[] = [
    {
      key: "at",
      header: "Time",
      width: 90,
      cell: (t) => <Time value={t.at} />,
    },
    {
      key: "id",
      header: "Turn",
      primary: true,
      width: 90,
      className: "wb-cell-mono",
      cell: (t) => t.id,
    },
    {
      key: "principal",
      header: "Principal",
      truncate: true,
      cell: (t) => t.principal,
    },
    {
      key: "model",
      header: "Model",
      priority: 2,
      width: 150,
      className: "wb-cell-mono",
      cell: (t) => t.model,
    },
    {
      key: "decision",
      header: "Decision",
      width: 120,
      cell: (t) =>
        t.state === "pending" ? (
          <span className="gal-pending">
            <StatusDot tone="info" pulse label="In progress" /> running
          </span>
        ) : (
          <Badge
            tone={DECISION[t.decision].tone}
            icon={DECISION[t.decision].icon}
          >
            {t.decision}
          </Badge>
        ),
    },
    {
      key: "bytes",
      header: "Size",
      align: "end",
      priority: 3,
      width: 90,
      cell: (t) => formatBytes(t.bytes),
    },
    {
      key: "latency",
      header: "Latency",
      align: "end",
      priority: 4,
      width: 90,
      cell: (t) =>
        t.state === "pending" ? "—" : `${formatNumber(t.latencyMs)} ms`,
    },
  ];

  return (
    <List full>
      <div className="gal-live-bar">
        <Switch
          label="Follow live"
          checked={follow}
          onChange={(e) => setFollow(e.target.checked)}
        />
        <Switch
          label="Fail next page"
          checked={failNext}
          onChange={(e) => setFailNext(e.target.checked)}
        />
        {/* New rows wait here while the user is on a row, so nothing shifts under them. */}
        <span role="status" className="gal-held">
          {held.length > 0 ? (
            <Button size="sm" icon="arrow-up" onClick={showHeld}>
              {held.length} new {plural(held.length, "turn")} · Show
            </Button>
          ) : null}
        </span>
      </div>
      <div ref={wrap}>
        <DataTable
          label="Activity"
          rows={shown}
          rowId={(t) => t.id}
          columns={columns}
          activeId={openId}
          rowHref={(t) => link({ item: openId === t.id ? null : t.id })}
          onRowFollow={(t) => setParams({ item: t.id }, { replace: true })}
          onCursorChange={setCursorId}
          rowClassName={(t) => (fresh.has(t.id) ? "is-new" : undefined)}
          loading={loading}
          empty={empty}
          error={error}
          compact={compact}
          bleed
        />
      </div>
      {state === "data" ? (
        <ListPager
          shown={rows.length}
          total={TURN_TOTAL + (rows.length - loaded)}
          noun="turn"
          hasMore={loaded < TURN_TOTAL}
          onLoadMore={loadMore}
          loadingMore={loadingMore}
          error={pageError}
          updating={follow || refreshing}
          disabled={refreshing}
        />
      ) : null}
    </List>
  );
}

// ---------------------------------------------------------------- rules with switches

function RulesTable({
  q,
  loading,
  enabledFilter,
  state,
  compact,
  empty,
  error,
  openId,
  link,
}: {
  q: string;
  loading: boolean;
  enabledFilter: string;
  state: string;
  compact: boolean;
  empty: ReactNode;
  error: ReactNode;
  openId: string | null;
  link: (patch: Record<string, string | null>) => string;
}) {
  const toast = useToast();
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(RULES.map((r) => [r.id, r.enabled])),
  );
  const rows = useMemo(
    () =>
      state === "data"
        ? RULES.filter(
            (r) =>
              (enabledFilter === "all" ||
                (enabledFilter === "on") === (enabled[r.id] ?? r.enabled)) &&
              (!q ||
                `${r.id} ${r.description}`
                  .toLowerCase()
                  .includes(q.toLowerCase())),
          )
        : [],
    [q, state, enabledFilter, enabled],
  );
  const columns: DataColumn<Rule>[] = [
    {
      key: "id",
      header: "Rule",
      primary: true,
      cell: (r) => (
        <span className="gal-kind">
          <Icon name={KIND_ICON[r.kind]} title={r.kind} />
          <span className="wb-mono">{r.id}</span>
        </span>
      ),
    },
    {
      key: "description",
      header: "Description",
      truncate: true,
      priority: 3,
      cell: (r) => r.description,
    },
    {
      key: "source",
      header: "Source",
      priority: 4,
      truncate: "start",
      cell: (r) => r.source,
    },
    {
      key: "action",
      header: "Action",
      priority: 2,
      width: 90,
      cell: (r) => <Badge tone={ACTION_TONE[r.action]}>{r.action}</Badge>,
    },
    {
      key: "hits",
      header: "Hits",
      align: "end",
      priority: 3,
      width: 80,
      cell: (r) => formatNumber(r.hits),
    },
    {
      key: "enabled",
      header: "Enabled",
      width: 80,
      cell: (r) => (
        <Switch
          aria-label={`Enable ${r.id}`}
          checked={enabled[r.id] ?? false}
          onChange={(e) => {
            const on = e.target.checked;
            setEnabled((m) => ({ ...m, [r.id]: on }));
            toast(`${r.id} ${on ? "enabled" : "disabled"}`);
          }}
        />
      ),
    },
  ];
  return (
    <List full>
      <DataTable
        label="Rules"
        rows={rows}
        rowId={(r) => r.id}
        columns={columns}
        activeId={openId}
        rowHref={(r) => link({ item: openId === r.id ? null : r.id })}
        rowDim={(r) => !enabled[r.id]}
        loading={loading}
        empty={empty}
        error={error}
        compact={compact}
        bleed
      />
    </List>
  );
}

// ---------------------------------------------------------------- sections (small tables under section titles)

type TokenState = "active" | "expiring" | "revoked";
const TOKEN_STATE: Record<TokenState, { label: string; tone: Tone }> = {
  active: { label: "Active", tone: "success" },
  expiring: { label: "Expires in 3d", tone: "warning" },
  revoked: { label: "Revoked", tone: "danger" },
};
interface Token {
  id: string;
  name: string;
  note?: string;
  scope: string;
  created: Date;
  lastUsed: Date | null;
  state: TokenState;
}
const TOKENS: Token[] = [
  {
    id: "tok-4f2a",
    name: "deploy bot",
    scope: "github:repo.write jira:issue.read",
    created: new Date(NOW - 86_400_000 * 40),
    lastUsed: new Date(NOW - 3_600_000 * 2),
    state: "active",
  },
  {
    id: "tok-91c0",
    name: "nightly export to the compliance data warehouse",
    scope: "audit:read",
    created: new Date(NOW - 86_400_000 * 87),
    lastUsed: new Date(NOW - 86_400_000),
    state: "expiring",
  },
  {
    id: "3f9d2c1e-8b7a-4c55-9e1f-0a2b3c4d5e6f",
    name: "laptop (old)",
    scope: "*",
    created: new Date(NOW - 86_400_000 * 200),
    lastUsed: null,
    state: "revoked",
  },
];
interface ServiceAccount {
  id: string;
  name: string;
  owner: string;
  grants: number;
  state: "active" | "disabled";
}
const ACCOUNTS: ServiceAccount[] = [
  {
    id: "sa-ci",
    name: "ci-runner",
    owner: "platform",
    grants: 12,
    state: "active",
  },
  {
    id: "sa-docs",
    name: "docs-indexer",
    owner: "docs",
    grants: 3,
    state: "disabled",
  },
];

function SectionsPage({
  q,
  loading,
  openId,
  state,
  compact,
  link,
}: {
  q: string;
  loading: boolean;
  openId: string | null;
  state: string;
  compact: boolean;
  link: (patch: Record<string, string | null>) => string;
}) {
  const toast = useToast();
  const { setParams } = useRoute();
  const match = (text: string) =>
    !q || text.toLowerCase().includes(q.toLowerCase());
  const tokens =
    state === "data" ? TOKENS.filter((t) => match(`${t.name} ${t.id}`)) : [];
  const accounts =
    state === "data"
      ? ACCOUNTS.filter((a) => match(`${a.name} ${a.owner}`))
      : [];
  return (
    <List full>
      <GroupHeader
        sticky={false}
        title="Management tokens"
        sub="for alice.chen"
        count={`${tokens.length} ${plural(tokens.length, "token")}`}
        actions={
          <>
            <Button size="sm" icon="plus" onClick={() => toast("Issue token")}>
              Issue token
            </Button>
            <Button size="sm" onClick={() => toast("Issue service token")}>
              Issue service token
            </Button>
          </>
        }
      />
      <DataTable
        label="Management tokens"
        rows={tokens}
        rowId={(t) => t.id}
        columns={[
          {
            key: "name",
            header: "Token",
            truncate: true,
            cell: (t) => t.name,
          },
          {
            key: "id",
            header: "ID",
            priority: 3,
            className: "wb-cell-mono",
            // an identifier: short ids in full, UUIDs capped at 12ch with
            // the full value on hover (title defaults to the cell text)
            hug: "12ch",
            cell: (t) => t.id,
          },
          {
            // no token has a note: the column stays out (not with 0 rows)
            key: "note",
            header: "Note",
            hideWhenEmpty: true,
            wrap: true,
            cell: (t) => t.note ?? null,
          },
          {
            key: "scope",
            header: "Scope",
            priority: 2,
            truncate: true,
            cell: (t) => <code>{t.scope}</code>,
          },
          {
            key: "created",
            header: "Created",
            priority: 4,
            cell: (t) => <Time value={t.created} />,
          },
          {
            key: "used",
            header: "Last used",
            priority: 3,
            cell: (t) =>
              t.lastUsed ? (
                <Time value={t.lastUsed} />
              ) : (
                <span className="wb-muted">Never</span>
              ),
          },
          {
            key: "state",
            header: "State",
            cell: (t) => (
              <StateCell
                label={TOKEN_STATE[t.state].label}
                tone={TOKEN_STATE[t.state].tone}
                quiet={t.state === "active"}
              />
            ),
          },
        ]}
        activeId={openId}
        rowHref={(t) => link({ item: openId === t.id ? null : t.id })}
        onRowFollow={(t) => setParams({ item: t.id }, { replace: true })}
        rowDim={(t) => t.state === "revoked"}
        loading={loading}
        empty={<EmptyState compact title="No tokens" />}
        compact={compact}
        bleed
      />
      <GroupHeader
        sticky={false}
        title="Service accounts"
        count={`${accounts.length} ${plural(accounts.length, "account")}`}
        actions={
          <Button size="sm" icon="plus" onClick={() => toast("Add account")}>
            Add
          </Button>
        }
      />
      <DataTable
        label="Service accounts"
        rows={accounts}
        rowId={(a) => a.id}
        cursor={false}
        // every column hugs: the filler keeps them packed to the left
        fill="end"
        columns={[
          {
            key: "name",
            header: "Account",
            hug: true,
            className: "wb-cell-mono",
            cell: (a) => a.name,
          },
          { key: "owner", header: "Owner", cell: (a) => a.owner },
          {
            key: "grants",
            header: "Grants",
            align: "end",
            cell: (a) => formatNumber(a.grants),
          },
          {
            key: "state",
            header: "State",
            cell: (a) => (
              <StateCell
                label={a.state === "active" ? "Active" : "Disabled"}
                tone={a.state === "active" ? "success" : "muted"}
                quiet={a.state === "active"}
              />
            ),
          },
        ]}
        onRowOpen={(a) => toast(`Open ${a.name}`)}
        loading={loading}
        empty={<EmptyState compact title="No service accounts" />}
        compact={compact}
        bleed
      />
    </List>
  );
}
