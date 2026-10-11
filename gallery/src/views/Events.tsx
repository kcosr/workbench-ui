import { useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  AppShell,
  Avatar,
  Badge,
  Button,
  Checkbox,
  ChipToggle,
  Combobox,
  ConfirmDialog,
  Ctl,
  Disclosure,
  Drawer,
  DrawerSection,
  EmptyState,
  Field,
  FilterInput,
  Icon,
  IconButton,
  Input,
  KeyValue,
  List,
  ListFooter,
  ListGroup,
  ListRow,
  Main,
  Menu,
  Modal,
  Seg,
  Select,
  Sidebar,
  SidebarCheck,
  SidebarItem,
  SidebarSection,
  SidebarTop,
  SkeletonRows,
  StatePill,
  Switch,
  Tabs,
  Textarea,
  Time,
  Toolbar,
  ToolbarRow,
  ToolbarSummary,
  findRowTarget,
  formatNumber,
  plural,
  useListCursor,
  useToast,
} from "../../../src";
import {
  DECISIONS,
  PEOPLE,
  SERVICES,
  dayKey,
  dayTitle,
  makeEvents,
} from "../data";
import type { Decision, SampleEvent } from "../data";
import { hrefFor, useRoute } from "../router";

const EVENTS = makeEvents();
const RANGES = [
  { id: "24h", label: "Last 24 hours" },
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
] as const;

type Status = "all" | Decision;

export function EventsView({ topBar }: { topBar: ReactNode }) {
  const route = useRoute();
  const { params, setParams } = route;
  const toast = useToast();
  const status = (params.get("status") as Status | null) ?? "all";
  const q = params.get("q") ?? "";
  const services = params.get("svc")?.split(",").filter(Boolean) ?? [];
  const people = params.get("who")?.split(",").filter(Boolean) ?? [];
  const range = params.get("range") ?? "7d";
  const group = params.get("group") ?? "day";
  const compact = params.get("density") === "compact";
  const openId = params.get("item");
  const modal = params.get("modal");
  const loading = params.get("loading") === "1";
  const [mine, setMine] = useState(false);
  const [live, setLive] = useState(true);
  const [confirm, setConfirm] = useState<SampleEvent | null>(null);
  const [drawerTab, setDrawerTab] = useState<"summary" | "timeline" | "raw">(
    "summary",
  );

  const base = useMemo(
    () =>
      EVENTS.filter(
        (e) =>
          (services.length === 0 || services.includes(e.service)) &&
          (people.length === 0 || people.includes(e.principalId)) &&
          (!mine || e.principalId === "u-alice") &&
          (!q ||
            `${e.principal} ${e.service} ${e.action} ${e.reason} ${e.id}`
              .toLowerCase()
              .includes(q.toLowerCase())),
      ),
    [services.join(), people.join(), mine, q],
  );
  const counts = useMemo(() => {
    const c: Record<Status, number> = {
      all: base.length,
      allow: 0,
      deny: 0,
      redact: 0,
      error: 0,
    };
    for (const e of base) c[e.decision] += 1;
    return c;
  }, [base]);
  const shown =
    status === "all" ? base : base.filter((e) => e.decision === status);

  const groups = useMemo(() => {
    const map = new Map<
      string,
      { key: string; title: string; sub: string; items: SampleEvent[] }
    >();
    for (const e of shown) {
      const key = group === "service" ? e.service : dayKey(e.at);
      let g = map.get(key);
      if (!g) {
        const t =
          group === "service" ? { title: e.service, sub: "" } : dayTitle(e.at);
        g = { key, ...t, items: [] };
        map.set(key, g);
      }
      g.items.push(e);
    }
    return [...map.values()];
  }, [shown, group]);
  const ids = useMemo(
    () => groups.flatMap((g) => g.items.map((e) => e.id)),
    [groups],
  );
  const open = openId ? (EVENTS.find((e) => e.id === openId) ?? null) : null;

  const cursor = useListCursor({
    ids,
    activeId: openId,
    onOpen: (id) => setParams({ item: id }),
    onFollow: (id) => setParams({ item: id }, { replace: true }),
    onExternal: (id) => toast(`Would open ${id} in the upstream system`),
    resetKey: `${status}|${q}|${services.join()}|${people.join()}|${group}`,
  });

  const serviceCounts = useMemo(() => {
    const c = new Map<string, number>();
    for (const e of EVENTS) c.set(e.service, (c.get(e.service) ?? 0) + 1);
    return c;
  }, []);
  const toggleService = (s: string, on: boolean) => {
    const next = on ? [...services, s] : services.filter((x) => x !== s);
    setParams({ svc: next.join(",") || null });
  };
  const activeFilters =
    services.length + people.length + (status === "all" ? 0 : 1) + (q ? 1 : 0);

  const sidebar = (
    <Sidebar label="Event filters">
      <SidebarTop>
        <Seg
          label="Time range"
          full
          size="sm"
          value={range}
          onChange={(v) => setParams({ range: v === "7d" ? null : v })}
          options={RANGES.map((r) => ({ value: r.id, label: r.id }))}
        />
      </SidebarTop>
      <SidebarSection title="Quick views">
        <SidebarItem
          icon="inbox"
          label="All events"
          count={counts.all}
          current={status === "all"}
          href={hrefFor("/", {})}
        />
        <SidebarItem
          icon="ban"
          iconTone="danger"
          label="Blocks"
          count={counts.deny}
          current={status === "deny"}
          href={hrefFor("/", { status: "deny" })}
        />
        <SidebarItem
          icon="eye-off"
          iconTone="warning"
          label="Redactions"
          count={counts.redact}
          current={status === "redact"}
          href={hrefFor("/", { status: "redact" })}
        />
        <SidebarItem
          icon="alert-circle"
          iconTone="neutral"
          label="Failures"
          count={counts.error}
          current={status === "error"}
          href={hrefFor("/", { status: "error" })}
        />
      </SidebarSection>
      <SidebarSection
        title="Service"
        collapsible
        activeCount={services.length}
        action={
          services.length
            ? {
                label: "Clear service filter",
                text: "Clear",
                onClick: () => setParams({ svc: null }),
              }
            : undefined
        }
      >
        {SERVICES.map((s) => (
          <SidebarCheck
            key={s}
            label={s}
            checked={services.includes(s)}
            onChange={(on) => toggleService(s, on)}
            count={serviceCounts.get(s) ?? 0}
          />
        ))}
      </SidebarSection>
      <SidebarSection
        title="Principal"
        collapsible
        lazy
        defaultOpen={people.length > 0}
        activeCount={people.length}
      >
        <div className="gal-side-pad">
          <Combobox
            multiple
            aria-label="Principals"
            placeholder="Filter by principal…"
            value={people}
            onChange={(v) => setParams({ who: v.join(",") || null })}
            options={PEOPLE.map((p) => ({
              value: p.id,
              label: p.name,
              description: p.email,
            }))}
          />
        </div>
      </SidebarSection>
      <SidebarSection
        title="Saved views"
        action={{
          label: "Save current view",
          onClick: () => toast("View saved"),
        }}
      >
        <SidebarItem
          icon="bookmark"
          label="Denied on GitHub"
          href={hrefFor("/", { status: "deny", svc: "github" })}
          action={{
            label: "Delete view Denied on GitHub",
            onClick: () => toast("View deleted"),
          }}
        />
        <SidebarItem
          icon="bookmark"
          label="CI service account"
          href={hrefFor("/", { who: "sa-ci" })}
          action={{
            label: "Delete view CI service account",
            onClick: () => toast("View deleted"),
          }}
        />
      </SidebarSection>
    </Sidebar>
  );

  const toolbar = (
    <Toolbar>
      <ToolbarRow>
        <Seg
          label="Decision"
          value={status}
          onChange={(v) =>
            setParams({ status: v === "all" ? null : v, item: null })
          }
          options={[
            { value: "all", label: "All", count: counts.all },
            {
              value: "allow",
              label: "Allowed",
              icon: "shield-check",
              tone: "success",
              count: counts.allow,
            },
            {
              value: "deny",
              label: "Denied",
              icon: "ban",
              tone: "danger",
              count: counts.deny,
            },
            {
              value: "redact",
              label: "Redacted",
              icon: "eye-off",
              tone: "warning",
              count: counts.redact,
            },
          ]}
        />
        <Menu
          label="Time range"
          placement="bottom-start"
          items={RANGES.map((r) => ({
            id: r.id,
            label: r.label,
            checked: r.id === range,
            onSelect: () => setParams({ range: r.id === "7d" ? null : r.id }),
          }))}
          trigger={(props) => (
            <Button {...props} icon="calendar" iconRight="chevron-down">
              {RANGES.find((r) => r.id === range)?.label ?? "Last 7 days"}
            </Button>
          )}
        />
        <ToolbarSummary grow>
          <b>{formatNumber(shown.length)}</b> {plural(shown.length, "event")} ·{" "}
          {services.length || SERVICES.length} services ·{" "}
          {RANGES.find((r) => r.id === range)?.label.toLowerCase()}
        </ToolbarSummary>
        <span className="wb-btn-group">
          <Button
            icon="download"
            onClick={() => toast("Exported 64 events as CSV")}
          >
            Export
          </Button>
          <Button
            variant="primary"
            icon="plus"
            href={hrefFor("/", { modal: "new" })}
          >
            New rule
          </Button>
        </span>
      </ToolbarRow>
      <ToolbarRow>
        <FilterInput
          value={q}
          onChange={(v) => setParams({ q: v || null }, { replace: true })}
          placeholder="Filter by principal, action, reason…"
          debounceMs={200}
        />
        <ChipToggle pressed={mine} onPressedChange={setMine} icon="user">
          Only mine
        </ChipToggle>
        <ChipToggle pressed={live} onPressedChange={setLive} icon="activity">
          Follow live
        </ChipToggle>
        <span className="wb-spacer" />
        <Ctl label="Group">
          <Seg
            label="Group by"
            size="sm"
            value={group}
            onChange={(v) => setParams({ group: v === "day" ? null : v })}
            options={[
              { value: "day", label: "Day" },
              { value: "service", label: "Service" },
            ]}
          />
        </Ctl>
        <Ctl label="Show">
          <Seg
            label="Density"
            size="sm"
            value={compact ? "compact" : "rows"}
            onChange={(v) =>
              setParams({ density: v === "compact" ? "compact" : null })
            }
            options={[
              { value: "rows", label: "Rows" },
              { value: "compact", label: "Compact" },
            ]}
          />
        </Ctl>
      </ToolbarRow>
    </Toolbar>
  );

  const drawer = open ? (
    <Drawer
      key="event"
      resetKey={open.id}
      onClose={() => setParams({ item: null })}
      returnFocus={() => findRowTarget(open.id)}
      kicker={
        <>
          <span
            className={`wb-tone-${DECISIONS[open.decision].tone} wb-tone-color`}
          >
            <Icon name={DECISIONS[open.decision].icon} />
          </span>
          <span className="wb-num">{open.id}</span>
          <Badge variant="outline">{open.node}</Badge>
        </>
      }
      title={
        <>
          {open.action} <span className="gal-on">on</span> {open.service}
        </>
      }
      label={`Event ${open.id}`}
      meta={
        <>
          <StatePill
            tone={DECISIONS[open.decision].tone}
            icon={DECISIONS[open.decision].icon}
          >
            {DECISIONS[open.decision].label}
          </StatePill>
          <Avatar name={open.principal} size="md" />
          <b>{open.principal}</b> in <code>{open.context}</code> ·{" "}
          <Time value={open.at} />
        </>
      }
      actions={
        <>
          <Button
            variant="primary"
            icon="user"
            href={`#/people/${open.principalId}`}
          >
            Open principal
          </Button>
          <Button icon="copy" onClick={() => toast("Link copied")}>
            Copy link
          </Button>
          <Button
            variant="danger-ghost"
            icon="trash"
            onClick={() => setConfirm(open)}
          >
            Revoke token
          </Button>
        </>
      }
    >
      <Tabs
        label="Event details"
        value={drawerTab}
        onChange={setDrawerTab}
        items={[
          { value: "summary", label: "Summary" },
          { value: "timeline", label: "Timeline", count: 4 },
          { value: "raw", label: "Raw record" },
        ]}
      >
        {drawerTab === "summary" ? (
          <>
            <DrawerSection title="Decision">
              <KeyValue
                items={[
                  {
                    label: "Decision",
                    value: (
                      <Badge tone={DECISIONS[open.decision].tone}>
                        {DECISIONS[open.decision].label}
                      </Badge>
                    ),
                  },
                  { label: "Reason", value: open.reason },
                  open.grant
                    ? {
                        label: "Grant",
                        value: (
                          <a className="wb-link" href="#/rules">
                            {open.grant}
                          </a>
                        ),
                      }
                    : null,
                  { label: "Context", value: <code>{open.context}</code> },
                  { label: "Latency", value: `${open.latencyMs} ms` },
                  {
                    label: "Request",
                    value: (
                      <span className="wb-num">
                        req_{open.id.slice(3)}a9f2c
                      </span>
                    ),
                  },
                ]}
              />
            </DrawerSection>
            <DrawerSection title="Contributors" count={2}>
              <ul className="gal-links">
                <li>
                  <a className="wb-link" href="#/rules?rule=r-regex-aws">
                    regex/aws-access-key
                  </a>
                  <span className="wb-muted"> · 2 matches</span>
                </li>
                <li>
                  <a className="wb-link" href="#/rules?rule=r-cat-pii">
                    catalog/pii-email
                  </a>
                  <span className="wb-muted"> · 1 match</span>
                </li>
              </ul>
            </DrawerSection>
            <DrawerSection title="Counters">
              <KeyValue
                labelWidth={140}
                items={[
                  { label: "Requests today", value: "1,284" },
                  { label: "Denied today", value: "37" },
                  { label: "Quota", value: "412 / 5,000 per hour" },
                ]}
              />
            </DrawerSection>
          </>
        ) : drawerTab === "timeline" ? (
          <DrawerSection title="Request timeline" count={4}>
            <ol className="gal-timeline">
              <li>
                <Time value={new Date(open.at.getTime() - 900)} format="time" />{" "}
                Received from {open.principal}
              </li>
              <li>
                <Time value={new Date(open.at.getTime() - 640)} format="time" />{" "}
                Grant evaluation
              </li>
              <li>
                <Time value={new Date(open.at.getTime() - 200)} format="time" />{" "}
                Upstream call ({open.latencyMs} ms)
              </li>
              <li>
                <Time value={open.at} format="time" />{" "}
                {DECISIONS[open.decision].label}
              </li>
            </ol>
          </DrawerSection>
        ) : (
          <DrawerSection title="Raw record">
            <Disclosure summary="Show JSON" defaultOpen>
              <pre className="wb-code">
                {JSON.stringify(
                  { ...open, at: open.at.toISOString() },
                  null,
                  2,
                )}
              </pre>
            </Disclosure>
          </DrawerSection>
        )}
      </Tabs>
    </Drawer>
  ) : null;

  return (
    <AppShell
      topBar={topBar}
      sidebar={sidebar}
      sidebarStorageKey="workbench-gallery:sidebar"
      drawer={drawer}
      drawerResizable={params.get("resize") === "1"}
      drawerStorageKey="workbench-gallery:drawer-width"
    >
      <Main
        toolbar={toolbar}
        refetching={live && params.get("refetch") === "1"}
        label="Events"
      >
        <List>
          {loading ? (
            <SkeletonRows compact={compact} />
          ) : groups.length === 0 ? (
            <EmptyState
              icon="search"
              title={`No events${q ? ` matching “${q}”` : ""}`}
              actions={
                activeFilters > 0 ? (
                  <Button
                    onClick={() =>
                      setParams({ q: null, svc: null, who: null, status: null })
                    }
                  >
                    Clear filters
                  </Button>
                ) : null
              }
            >
              Try a longer time range or fewer filters.
            </EmptyState>
          ) : (
            <>
              {groups.map((g) => (
                <ListGroup
                  key={g.key}
                  title={g.title}
                  sub={g.sub}
                  count={`${g.items.length} ${plural(g.items.length, "event")}`}
                  actions={
                    <>
                      <Button
                        size="sm"
                        onClick={() => toast("Marked reviewed")}
                      >
                        Mark reviewed
                      </Button>
                      <Button size="sm" onClick={() => toast("Exported")}>
                        Export group
                      </Button>
                    </>
                  }
                >
                  {g.items.map((e) => (
                    <ListRow
                      key={e.id}
                      itemId={e.id}
                      icon={DECISIONS[e.decision].icon}
                      iconTone={DECISIONS[e.decision].tone}
                      compact={compact}
                      cursor={cursor.cursorId === e.id}
                      active={openId === e.id}
                      href={hrefFor("/", {
                        ...Object.fromEntries(params),
                        item: openId === e.id ? null : e.id,
                      })}
                      title={
                        <>
                          {e.action} <span className="gal-on">on</span>{" "}
                          {e.service}
                        </>
                      }
                      titleExtra={
                        e.decision === "allow" ? null : (
                          <Badge tone={DECISIONS[e.decision].tone}>
                            {DECISIONS[e.decision].label}
                          </Badge>
                        )
                      }
                      meta={
                        <>
                          <span className="wb-num">{e.id}</span>
                          <span className="wb-sep">·</span>
                          <span>by</span>
                          <Avatar name={e.principal} />
                          <b>{e.principal}</b>
                          <span className="wb-sep">·</span>
                          <span>{e.context}</span>
                          <span className="wb-sep">·</span>
                          <span className="wb-tabular">{e.latencyMs} ms</span>
                        </>
                      }
                      description={e.reason}
                      side={<Time value={e.at} />}
                      actions={
                        <>
                          <IconButton
                            icon="copy"
                            label={`Copy link to ${e.id}`}
                            size="sm"
                            onClick={() => toast("Link copied")}
                          />
                          <IconButton
                            icon="external"
                            label={`Open ${e.id} upstream`}
                            size="sm"
                            onClick={() => toast("Opened upstream")}
                          />
                        </>
                      }
                    />
                  ))}
                </ListGroup>
              ))}
              <ListFooter
                hints={[
                  [["j", "k"], "move"],
                  [["↵"], "details"],
                  [["o"], "open upstream"],
                  [["/"], "filter"],
                  [["Ctrl K"], "jump anywhere"],
                ]}
              />
            </>
          )}
        </List>
      </Main>
      <NewRuleModal
        open={modal === "new"}
        onClose={() => setParams({ modal: null })}
      />
      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title="Revoke token?"
        confirmLabel="Revoke token"
        onConfirm={() =>
          new Promise<void>((resolve) => {
            setTimeout(() => {
              toast(`Token for ${confirm?.principal ?? ""} revoked`, {
                tone: "success",
              });
              resolve();
            }, 700);
          })
        }
      >
        <p>
          The token <span className="wb-num">tok_8f2a…c91</span> used by{" "}
          <b>{confirm?.principal}</b> stops working immediately. Agents using it
          will get 401 responses.
        </p>
      </ConfirmDialog>
    </AppShell>
  );
}

function NewRuleModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [kind, setKind] = useState("regex");
  const [services, setServices] = useState<string[]>(["github"]);
  const [enabled, setEnabled] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const nameRef = useRef<HTMLInputElement | null>(null);
  const invalid = submitted && !/^[a-z0-9-]+$/.test(name);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New rule"
      description="Rules apply to responses from the selected services."
      initialFocusRef={nameRef}
      onSubmit={() => {
        setSubmitted(true);
        if (!/^[a-z0-9-]+$/.test(name)) return;
        toast(`Rule ${name} created`, { tone: "success" });
        onClose();
      }}
      footerNote="Saved as a new revision"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary">
            Create rule
          </Button>
        </>
      }
    >
      <Field
        label="Rule ID"
        hint="Lowercase letters, digits and dashes."
        error={
          invalid ? "Use lowercase letters, digits and dashes only." : undefined
        }
      >
        <Input
          ref={nameRef}
          mono
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="aws-access-key"
        />
      </Field>
      <Field label="Kind">
        <Select
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          options={[
            { value: "literal", label: "Literal" },
            { value: "regex", label: "Regular expression" },
            { value: "llm", label: "LLM category" },
          ]}
        />
      </Field>
      <Field label="Pattern">
        <Textarea mono rows={3} defaultValue={"AKIA[0-9A-Z]{16}"} />
      </Field>
      <Field
        label="Services"
        hint="Type to search; Backspace removes the last one."
      >
        <Combobox
          multiple
          value={services}
          onChange={setServices}
          options={SERVICES.map((s) => ({ value: s, label: s }))}
          placeholder="Add a service…"
        />
      </Field>
      <Field label="Notes" optional>
        <Input placeholder="Why this rule exists" />
      </Field>
      <div className="gal-row-gap">
        <Switch
          label="Enabled"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        <Checkbox
          label="Audit only"
          description="Log matches without redacting."
        />
      </div>
    </Modal>
  );
}
