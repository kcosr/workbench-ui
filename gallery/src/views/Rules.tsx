import { useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  AppShell,
  Badge,
  Button,
  ConfirmDialog,
  DataTable,
  DraftBar,
  Drawer,
  DrawerSection,
  Field,
  FilterInput,
  Icon,
  IconButton,
  Input,
  List,
  Main,
  Menu,
  Seg,
  Sidebar,
  SidebarCheck,
  SidebarItem,
  SidebarSection,
  SidebarTop,
  Switch,
  Textarea,
  Time,
  Toolbar,
  ToolbarRow,
  ToolbarSummary,
  useAppShell,
  useHotkey,
  useToast,
} from "../../../src";
import type { DataColumn, IconName, SortState, Tone } from "../../../src";
import { hrefFor, useRoute } from "../router";

interface Rule {
  id: string;
  kind: "literal" | "regex" | "catalog" | "llm";
  name: string;
  description: string;
  action: "redact" | "block" | "audit";
  hits: number;
  updated: Date;
  enabled: boolean;
}

const KIND: Record<Rule["kind"], { icon: IconName; label: string }> = {
  literal: { icon: "code", label: "Literal" },
  regex: { icon: "braces", label: "Regex" },
  catalog: { icon: "book", label: "Catalog" },
  llm: { icon: "zap", label: "LLM category" },
};
const ACTION_TONE: Record<Rule["action"], Tone> = {
  redact: "warning",
  block: "danger",
  audit: "neutral",
};

const now = Date.now();
const RULES: Rule[] = [
  {
    id: "r-regex-aws",
    kind: "regex",
    name: "aws-access-key",
    description: "AWS access key IDs (AKIA…) in any response body",
    action: "redact",
    hits: 1284,
    updated: new Date(now - 36e5 * 5),
    enabled: true,
  },
  {
    id: "r-cat-pii",
    kind: "catalog",
    name: "pii-email",
    description: "Email addresses outside the company domain",
    action: "redact",
    hits: 9120,
    updated: new Date(now - 864e5 * 3),
    enabled: true,
  },
  {
    id: "r-lit-proj",
    kind: "literal",
    name: "project-nightingale",
    description: "Internal codename; never leaves the network",
    action: "block",
    hits: 12,
    updated: new Date(now - 864e5 * 12),
    enabled: true,
  },
  {
    id: "r-llm-cust",
    kind: "llm",
    name: "customer-data",
    description: "Customer contracts, pricing and support transcripts",
    action: "redact",
    hits: 341,
    updated: new Date(now - 864e5),
    enabled: false,
  },
  {
    id: "r-regex-jwt",
    kind: "regex",
    name: "jwt-token",
    description: "JSON Web Tokens in logs and build output",
    action: "redact",
    hits: 77,
    updated: new Date(now - 864e5 * 40),
    enabled: true,
  },
  {
    id: "r-cat-iban",
    kind: "catalog",
    name: "iban",
    description: "International bank account numbers",
    action: "audit",
    hits: 3,
    updated: new Date(now - 864e5 * 90),
    enabled: true,
  },
  {
    id: "r-lit-host",
    kind: "literal",
    name: "db-primary-host",
    description: "Hostname of the primary database cluster",
    action: "block",
    hits: 0,
    updated: new Date(now - 864e5 * 7),
    enabled: false,
  },
];

type Usage = "any" | "used" | "unused";
const USAGE: Record<Usage, string> = {
  any: "Any",
  used: "Used",
  unused: "Unused",
};

/**
 * A sidebar search row: a filter, and a menu whose button shows a
 * dot while it narrows the rules. "s" focuses the search, revealing a
 * collapsed sidebar first (showSidebar is idempotent: it never hides it).
 */
function SourceSearch({
  value,
  onChange,
  usage,
  onUsage,
}: {
  value: string;
  onChange: (v: string) => void;
  usage: Usage;
  onUsage: (u: Usage) => void;
}) {
  const shell = useAppShell();
  const input = useRef<HTMLInputElement | null>(null);
  // A visible FilterInput takes "s" itself; this covers the collapsed sidebar.
  useHotkey("s", () => shell?.showSidebar({ focus: () => input.current }), {
    enabled: !!shell?.hasSidebar,
  });
  const what = `Usage: ${USAGE[usage]}`;
  return (
    <div className="gal-side-search">
      <FilterInput
        ref={input}
        value={value}
        onChange={onChange}
        placeholder="Filter sources…"
        hotkey="s"
      />
      <Menu
        label="Usage"
        items={(Object.keys(USAGE) as Usage[]).map((u) => ({
          id: u,
          label: USAGE[u],
          checked: u === usage,
          onSelect: () => onUsage(u),
        }))}
        trigger={(props) => (
          <IconButton
            {...props}
            icon="filter"
            variant="default"
            label={what}
            indicator={usage !== "any"}
          />
        )}
      />
    </div>
  );
}

export function RulesView({ topBar }: { topBar: ReactNode }) {
  const { params, setParams } = useRoute();
  const toast = useToast();
  const [rules, setRules] = useState(RULES);
  const [staged, setStaged] = useState<Set<string>>(
    new Set(params.get("draft") === "1" ? ["r-llm-cust", "r-lit-host"] : []),
  );
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "on" | "off">("all");
  const [sourceQ, setSourceQ] = useState("");
  const [usage, setUsage] = useState<Usage>("any");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const openId = params.get("rule");
  const open = rules.find((r) => r.id === openId) ?? null;
  const kind = params.get("kind");
  const shown = rules.filter(
    (r) =>
      (!kind || r.kind === kind) &&
      (status === "all" || (status === "on") === r.enabled) &&
      (usage === "any" || (usage === "used") === r.hits > 0) &&
      (!q ||
        `${r.name} ${r.description}`.toLowerCase().includes(q.toLowerCase())),
  );
  const toggle = (id: string) => {
    setRules((rs) =>
      rs.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)),
    );
    setStaged((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const [sortKey, sortDir] = (params.get("sort") ?? "").split(":");
  const sort: SortState | null =
    sortKey && (sortDir === "asc" || sortDir === "desc")
      ? { key: sortKey, dir: sortDir }
      : null;
  const sorted = sort
    ? [...shown].sort((a, b) => {
        const d = sort.dir === "asc" ? 1 : -1;
        if (sort.key === "hits") return d * (a.hits - b.hits);
        if (sort.key === "updated")
          return d * (a.updated.getTime() - b.updated.getTime());
        return d * a.name.localeCompare(b.name);
      })
    : shown;
  const keep = Object.fromEntries(params);
  const columns: DataColumn<Rule>[] = [
    {
      key: "name",
      header: "Rule",
      sortable: true,
      className: "wb-cell-nowrap",
      cell: (r) => (
        <span className="gal-kind">
          <Icon name={KIND[r.kind].icon} title={KIND[r.kind].label} />
          <span className="wb-mono">{r.name}</span>
        </span>
      ),
    },
    {
      key: "description",
      header: "Description",
      priority: 3,
      truncate: true,
      cell: (r) => r.description,
    },
    {
      key: "action",
      header: "Action",
      cell: (r) => <Badge tone={ACTION_TONE[r.action]}>{r.action}</Badge>,
    },
    {
      key: "hits",
      header: "Hits",
      sortable: true,
      firstSortDir: "desc",
      align: "end",
      priority: 3,
      cell: (r) => r.hits.toLocaleString("en-US"),
    },
    {
      key: "updated",
      header: "Updated",
      sortable: true,
      firstSortDir: "desc",
      priority: 4,
      className: "wb-cell-nowrap",
      cell: (r) => <Time value={r.updated} />,
    },
    {
      key: "enabled",
      header: "Enabled",
      cell: (r) => (
        <Switch
          checked={r.enabled}
          onChange={() => toggle(r.id)}
          aria-label={`Enable ${r.name}`}
        />
      ),
    },
    {
      key: "actions",
      header: <span className="wb-sr-only">Actions</span>,
      className: "wb-cell-actions",
      cell: (r) => (
        <div className="wb-row-actions">
          <IconButton
            icon="flask"
            label={`Test ${r.name}`}
            size="sm"
            onClick={() => toast("Opened tester")}
          />
          <IconButton
            icon="pencil"
            label={`Edit ${r.name}`}
            size="sm"
            href={hrefFor("/rules", { ...keep, rule: r.id })}
          />
        </div>
      ),
    },
  ];

  const sidebar = (
    <Sidebar label="Rule sources">
      <SidebarTop>
        <SourceSearch
          value={sourceQ}
          onChange={setSourceQ}
          usage={usage}
          onUsage={setUsage}
        />
      </SidebarTop>
      <SidebarSection title="Source">
        <SidebarItem
          icon="layers"
          label="All rules"
          count={rules.length}
          current={!kind}
          href={hrefFor("/rules")}
        />
        {(Object.keys(KIND) as Rule["kind"][])
          .filter((k) =>
            KIND[k].label.toLowerCase().includes(sourceQ.trim().toLowerCase()),
          )
          .map((k) => (
            <SidebarItem
              key={k}
              icon={KIND[k].icon}
              label={KIND[k].label}
              count={rules.filter((r) => r.kind === k).length}
              current={kind === k}
              href={hrefFor("/rules", { kind: k })}
            />
          ))}
      </SidebarSection>
      <SidebarSection title="Action" collapsible>
        <SidebarCheck label="Redact" checked onChange={() => {}} count={4} />
        <SidebarCheck label="Block" checked onChange={() => {}} count={2} />
        <SidebarCheck
          label="Audit only"
          checked={false}
          onChange={() => {}}
          count={1}
        />
      </SidebarSection>
      <SidebarSection title="Policy">
        <SidebarItem
          icon="sliders"
          label="LLM policy"
          href={hrefFor("/rules", { kind: "llm" })}
        />
      </SidebarSection>
    </Sidebar>
  );

  const drawer = open ? (
    <Drawer
      size="wide"
      resetKey={open.id}
      onClose={() => setParams({ rule: null })}
      kicker={
        <>
          <Icon name={KIND[open.kind].icon} />
          {KIND[open.kind].label}
          <span className="wb-num">{open.id}</span>
        </>
      }
      title={<span className="wb-mono gal-title-mono">{open.name}</span>}
      label={`Rule ${open.name}`}
      meta={
        <>
          <Badge tone={ACTION_TONE[open.action]}>{open.action}</Badge>
          <Badge variant="dot" tone={open.enabled ? "success" : "muted"}>
            {open.enabled ? "Enabled" : "Disabled"}
          </Badge>
          · updated <Time value={open.updated} />
        </>
      }
      footer={
        <>
          <Button
            variant="danger-ghost"
            icon="trash"
            onClick={() => setConfirmDelete(true)}
          >
            Delete
          </Button>
          <span className="wb-spacer" />
          <span>Saving creates revision r6</span>
          <Button onClick={() => setParams({ rule: null })}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => toast("Rule saved as r6", { tone: "success" })}
          >
            Save
          </Button>
        </>
      }
    >
      <DrawerSection title="Definition">
        <Field label="Rule ID">
          <Input mono defaultValue={open.name} />
        </Field>
        <Field label="Description">
          <Input defaultValue={open.description} />
        </Field>
        <Field label="Pattern" hint="RE2 syntax; matched case-sensitively.">
          <Textarea mono rows={4} defaultValue={"\\bAKIA[0-9A-Z]{16}\\b"} />
        </Field>
      </DrawerSection>
      <DrawerSection title="Action">
        <Seg
          label="Action"
          value={open.action}
          onChange={() => toast("Action changed")}
          options={[
            { value: "redact", label: "Redact", icon: "eye-off" },
            { value: "block", label: "Block", icon: "ban" },
            { value: "audit", label: "Audit only", icon: "eye" },
          ]}
        />
      </DrawerSection>
      <DrawerSection title="Recent events" count={3}>
        <ul className="gal-links">
          <li>
            <a className="wb-link" href="#/?item=ev-4818">
              ev-4818
            </a>{" "}
            <span className="wb-muted">
              · github · <Time value={new Date(now - 6e5)} />
            </span>
          </li>
          <li>
            <a className="wb-link" href="#/?item=ev-4809">
              ev-4809
            </a>{" "}
            <span className="wb-muted">
              · cloudbees · <Time value={new Date(now - 36e5)} />
            </span>
          </li>
          <li>
            <a className="wb-link" href="#/?item=ev-4790">
              ev-4790
            </a>{" "}
            <span className="wb-muted">
              · jira · <Time value={new Date(now - 864e5)} />
            </span>
          </li>
        </ul>
      </DrawerSection>
    </Drawer>
  ) : null;

  return (
    <AppShell
      topBar={topBar}
      sidebar={sidebar}
      sidebarStorageKey="workbench-gallery:sidebar"
      drawer={drawer}
    >
      <Main
        label="Rules"
        toolbar={
          <Toolbar>
            <ToolbarRow
              primary={
                <Button
                  variant="primary"
                  icon="plus"
                  href={hrefFor("/", { modal: "new" })}
                >
                  New rule
                </Button>
              }
            >
              <Seg
                label="Status"
                value={status}
                onChange={setStatus}
                options={[
                  { value: "all", label: "All", count: rules.length },
                  {
                    value: "on",
                    label: "Enabled",
                    icon: "circle-check",
                    tone: "success",
                    count: rules.filter((r) => r.enabled).length,
                  },
                  {
                    value: "off",
                    label: "Disabled",
                    count: rules.filter((r) => !r.enabled).length,
                  },
                ]}
              />
              <FilterInput
                value={q}
                onChange={setQ}
                placeholder="Filter rules…"
              />
              <ToolbarSummary grow>
                <b>{shown.length}</b> of {rules.length} rules
              </ToolbarSummary>
            </ToolbarRow>
          </Toolbar>
        }
        footer={
          staged.size > 0 ? (
            <DraftBar
              actions={
                <>
                  <Button size="sm" onClick={() => toast("Draft is valid")}>
                    Validate
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setStaged(new Set())}
                  >
                    Discard
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => {
                      setStaged(new Set());
                      toast("Applied as r6", { tone: "success" });
                    }}
                  >
                    Save
                  </Button>
                </>
              }
            >
              <b>
                {staged.size} uncommitted{" "}
                {staged.size === 1 ? "change" : "changes"}
              </b>{" "}
              · LLM policy and categories apply together
            </DraftBar>
          ) : null
        }
      >
        <List full>
          <DataTable
            label="Rules"
            className="gal-rules"
            bleed
            rows={sorted}
            rowId={(r) => r.id}
            columns={columns}
            sort={sort}
            onSortChange={(s) =>
              setParams({ sort: s ? `${s.key}:${s.dir}` : null })
            }
            activeId={openId}
            rowHref={(r) => hrefFor("/rules", { ...keep, rule: r.id })}
            onRowFollow={(r) => setParams({ rule: r.id }, { replace: true })}
            rowDim={(r) => !r.enabled}
            cursorResetKey={`${kind}|${status}|${q}`}
          />
        </List>
      </Main>
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Delete rule ${open?.name ?? ""}?`}
        confirmLabel="Delete rule"
        onConfirm={() =>
          Promise.reject(
            new Error(
              "Revision r5 changed on the server; reload and try again.",
            ),
          )
        }
      >
        <p>
          This saves a new revision without the rule. Events already redacted
          are not affected.
        </p>
      </ConfirmDialog>
    </AppShell>
  );
}
