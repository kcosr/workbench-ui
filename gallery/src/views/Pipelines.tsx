/**
 * #/pipelines: a sample app whose sidebar carries the navigation (brand, a
 * selector, nav groups, a foot with the user, theme and health) and no top
 * bar. A list with history strips and a detail page with steps, a
 * left-ruled failure notice and a fact list. Pick the quiet style to see it
 * as designed.
 */
import { useState } from "react";
import type { ReactNode } from "react";
import {
  AppLink,
  AppShell,
  Badge,
  Banner,
  Brand,
  Button,
  DataTable,
  FilterInput,
  HistoryStrip,
  IconButton,
  KeyValue,
  LinkTabs,
  Main,
  PageHeader,
  Select,
  Sidebar,
  SidebarFoot,
  SidebarItem,
  SidebarNav,
  SidebarToggle,
  SidebarTop,
  Spacer,
  Status,
  Steps,
  Tabs,
  ThemeMenu,
  Time,
  Toolbar,
  ToolbarRow,
  ToolbarTitle,
  TopStatus,
  useTheme,
  useToast,
} from "../../../src";
import type { DataColumn, HistoryItem, StatusTone } from "../../../src";
import { THEME_KEY } from "../App";
import { useRoute } from "../router";
import { StyleMenu } from "../style";

interface Pipeline {
  id: string;
  name: string;
  tag?: ReactNode;
  source: string;
  target: string;
  condition?: string;
  owner: string;
  /** Oldest first: o ok, x failed, r running, w waiting, - none. */
  history: string;
  last: ReactNode;
  paused?: boolean;
}

const MIN = 60_000;
const ago = (minutes: number) => new Date(Date.now() - minutes * MIN);

const PIPELINES: Pipeline[] = [
  {
    id: "p-scan",
    name: "Quality alert scan",
    tag: <span className="wb-small wb-muted">Paused</span>,
    source: "Schedule",
    target: "every 15 min",
    owner: "Summarizer",
    history: "ooooooooxoooooooooxo",
    last: <Time value={ago(180)} />,
    paused: true,
  },
  {
    id: "p-review",
    name: "Controller review",
    source: "Git",
    target: "acme/controller",
    condition: "mentions, new changes",
    owner: "Reviewer",
    history: "oooooooooowoww",
    last: <Status tone="waiting">waiting for CI</Status>,
  },
  {
    id: "p-incident",
    name: "Incident summary",
    tag: <Badge tone="info">Draft · not activated</Badge>,
    source: "API",
    target: "POST …/incident-summary",
    owner: "Summarizer",
    history: "",
    last: <span className="wb-muted">never</span>,
  },
  {
    id: "p-notes",
    name: "Release notes draft",
    source: "API",
    target: "POST …/release-notes",
    owner: "Summarizer",
    history: "ooooooooooooooo",
    last: <Time value={ago(57)} />,
  },
  {
    id: "p-intake",
    name: "Intake triage",
    tag: <Badge>Draft v2 pending</Badge>,
    source: "Tracker",
    target: "INT",
    condition: "new issues",
    owner: "Triage",
    history: "oooooooooooor",
    last: <Status tone="running">running · 1 min</Status>,
  },
  {
    id: "p-portal",
    name: "Portal issue helper",
    source: "Git",
    target: "acme/portal",
    condition: "issues",
    owner: "Reviewer",
    history: "oooooooooooooooooooo",
    last: <Time value={ago(300)} />,
  },
  {
    id: "p-support",
    name: "Support triage",
    tag: (
      <span className="wb-small wb-tone-warning gal-tone-text">
        1 needs attention
      </span>
    ),
    source: "Tracker",
    target: "SUP",
    condition: "mentions",
    owner: "Triage",
    history: "ooooxoooooooooxooxoo",
    last: <Time value={ago(24)} />,
  },
  {
    id: "p-bookings",
    name: "Bookings review",
    source: "Git",
    target: "acme/bookings",
    condition: "mentions, changes",
    owner: "Reviewer",
    history: "ooxoooooxoooooorrwww",
    last: <Status tone="running">2 running</Status>,
  },
];

const TONE: Record<string, StatusTone> = {
  o: "ok",
  x: "failed",
  r: "running",
  w: "waiting",
};
const WORD: Record<StatusTone, string> = {
  ok: "Succeeded",
  failed: "Failed",
  running: "Running",
  waiting: "Waiting",
  skipped: "Skipped",
  neutral: "Cancelled",
};

function historyItems(pattern: string): HistoryItem[] {
  return [...pattern].map((c, i) => {
    const tone = TONE[c] ?? "ok";
    return { tone, label: `${WORD[tone]} · run ${480 + i}` };
  });
}

const COLUMNS: DataColumn<Pipeline>[] = [
  {
    key: "name",
    header: "Pipeline",
    primary: true,
    truncate: true,
    cell: (p) => p.name,
    extra: (p) => p.tag,
  },
  {
    key: "trigger",
    header: "Trigger",
    truncate: true,
    priority: 2,
    cell: (p) => (
      <span>
        <span className="wb-muted">{p.source}</span>{" "}
        <span className="wb-mono">{p.target}</span>
        {p.condition ? ` · ${p.condition}` : null}
      </span>
    ),
  },
  {
    key: "owner",
    header: "Owner",
    priority: 3,
    hug: true,
    cell: (p) => p.owner,
  },
  {
    key: "history",
    header: "Last 20 runs",
    fit: true,
    cell: (p) => (
      <HistoryStrip
        label={`${p.name}: last 20 runs, newest last`}
        items={historyItems(p.history)}
        length={20}
      />
    ),
  },
  {
    key: "last",
    header: "Last run",
    align: "end",
    fit: true,
    cell: (p) => p.last,
  },
];

export function PipelinesView() {
  const route = useRoute();
  const theme = useTheme(THEME_KEY);
  const toast = useToast();
  const id = route.path.split("/")[2];
  const sidebar = (
    <Sidebar label="Sidebar">
      <Brand name="Workbench" href="#/pipelines" icon="shield" />
      <SidebarTop>
        <Select
          aria-label="Project"
          block
          options={[
            { value: "default", label: "Default project" },
            { value: "platform", label: "Platform" },
          ]}
        />
      </SidebarTop>
      <SidebarNav label="Main">
        <SidebarItem
          href="#/pipelines"
          label="Pipelines"
          count={PIPELINES.length}
          current
        />
        <SidebarItem
          href="#/pipelines/p-bookings"
          label="Runs"
          count="3 running"
          countTone="info"
        />
        <SidebarItem
          href="#/pipelines/p-support"
          label="Needs attention"
          count={1}
          countTone="danger"
          nested
        />
        <SidebarItem href="#/" label="Events" count={64} />
        <SidebarItem href="#/rules" label="Rules" count={7} />
        <SidebarItem href="#/people/u-alice" label="People" />
      </SidebarNav>
      <SidebarNav title="Gallery">
        <SidebarItem href="#/tables" label="Tables" />
        <SidebarItem href="#/components" label="Components" />
        <SidebarItem href="#/settings" label="Settings" />
      </SidebarNav>
      <SidebarFoot>
        <AppLink href="#/people/u-alice">Alice Chen</AppLink>
        <Spacer />
        <SidebarToggle />
        <IconButton
          icon="log-out"
          label="Sign out"
          onClick={() => toast("Signed out (demo)")}
        />
        <span className="gal-foot-break" />
        <TopStatus
          tone="success"
          label="Healthy"
          detail="All services answering"
        />
        <Spacer />
        <ThemeMenu mode={theme.mode} onChange={theme.setMode} />
        <StyleMenu />
      </SidebarFoot>
    </Sidebar>
  );
  return (
    <AppShell
      sidebar={sidebar}
      sidebarStorageKey="workbench-gallery:nav-sidebar-width"
      sidebarMin={200}
      sidebarMax={320}
      sidebarDefault={216}
    >
      {id ? <PipelineRun id={id} /> : <PipelineList />}
    </AppShell>
  );
}

function PipelineList() {
  const [q, setQ] = useState("");
  const rows = PIPELINES.filter((p) =>
    p.name.toLowerCase().includes(q.trim().toLowerCase()),
  );
  return (
    <Main
      label="Pipelines"
      toolbar={
        <Toolbar>
          <ToolbarRow
            primary={
              <Button variant="primary" icon="plus">
                New pipeline
              </Button>
            }
          >
            <ToolbarTitle>Pipelines</ToolbarTitle>
            <FilterInput
              value={q}
              onChange={setQ}
              placeholder="Filter pipelines"
            />
          </ToolbarRow>
        </Toolbar>
      }
      header={
        <LinkTabs
          label="Views"
          items={[
            { href: "#/pipelines", label: "All", count: 8, current: true },
            {
              href: "#/pipelines?view=active",
              label: "Active",
              count: 6,
              current: false,
            },
            {
              href: "#/pipelines?view=paused",
              label: "Paused",
              count: 1,
              current: false,
            },
            {
              href: "#/pipelines?view=drafts",
              label: "Drafts",
              count: 1,
              current: false,
            },
          ]}
        />
      }
    >
      <div className="gal-pipelines">
        <DataTable
          label="Pipelines"
          rows={rows}
          rowId={(p) => p.id}
          columns={COLUMNS}
          rowHref={(p) => `#/pipelines/${p.id}`}
          rowDim={(p) => !!p.paused}
          cursor={false}
          bleed
        />
        <p className="gal-note">
          Grey bars succeeded; red failed, blue is running and an outlined bar
          is waiting. The newest run is on the right.
        </p>
      </div>
    </Main>
  );
}

function PipelineRun({ id }: { id: string }) {
  const pipeline = PIPELINES.find((p) => p.id === id) ?? PIPELINES[0];
  const [tab, setTab] = useState("setup");
  const name = pipeline?.name ?? "Pipeline";
  return (
    <Main
      label={`${name} run 484`}
      header={
        <PageHeader
          back={{ href: "#/pipelines", label: "Pipelines" }}
          title={`${name} · run 484`}
          meta={
            <>
              <Status tone="failed">Failed</Status>
              <span className="wb-sep">·</span>
              <span>
                <Time value={ago(49)} />, after 3 min
              </span>
              <span className="wb-sep">·</span>
              <span>new changes pushed</span>
              <span className="wb-sep">·</span>
              <span>Reviewer on the review workspace</span>
            </>
          }
          actions={
            <>
              <Button>Message</Button>
              <Button>Run now…</Button>
              <Button variant="primary">Run again</Button>
            </>
          }
        >
          <Steps
            className="gal-run-steps"
            label="Progress"
            steps={[
              { label: "Queued", detail: "12 s", state: "done" },
              { label: "Sandbox", detail: "9.0 s", state: "done" },
              { label: "Clone acme/bookings", detail: "3.0 s", state: "done" },
              {
                label: "Install dependencies",
                detail: "exit 1 · 2 min 45 s",
                state: "failed",
              },
              { label: "Review", detail: "skipped", state: "not-reached" },
              { label: "Post a note", detail: "skipped", state: "not-reached" },
            ]}
          />
        </PageHeader>
      }
    >
      <div className="gal-run">
        <div className="gal-run-main">
          <Tabs
            label="Run"
            value={tab}
            onChange={setTab}
            items={[
              { value: "report", label: "Report", disabled: true },
              { value: "activity", label: "Activity" },
              { value: "setup", label: "Setup" },
              { value: "trigger", label: "Trigger" },
            ]}
          >
            {tab === "setup" ? (
              <div className="gal-run-body">
                <Banner
                  tone="danger"
                  title="Preparing the workspace failed: npm ci exited with code 1"
                >
                  npm could not resolve dependencies: <code>quotes@2.3.1</code>{" "}
                  needs <code>pricing@^4</code>, but the project requires{" "}
                  <code>5.0.0</code>.
                </Banner>
                <pre className="wb-code wb-code--nowrap">
                  {[
                    "npm http fetch GET 200 https://registry.example.com/date-fns 17ms",
                    "npm error code ERESOLVE",
                    "npm error ERESOLVE could not resolve",
                    "npm error While resolving: quotes@2.3.1",
                    "npm error Found: pricing@5.0.0",
                    "npm error Could not resolve dependency:",
                    'npm error peer pricing@"^4" from quotes@2.3.1',
                  ].join("\n")}
                </pre>
              </div>
            ) : (
              <p className="gal-note gal-run-body">
                The {tab} tab of this run.
              </p>
            )}
          </Tabs>
        </div>
        <aside className="gal-run-facts" aria-label="Run details">
          <h2 className="gal-facts-title">Change 484</h2>
          <KeyValue
            items={[
              { label: "Mode", value: "Automatic" },
              {
                label: "Other runs",
                value: (
                  <AppLink className="wb-link" href="#/pipelines">
                    2 earlier runs
                  </AppLink>
                ),
              },
            ]}
          />
          <hr className="gal-facts-rule" />
          <KeyValue
            items={[
              {
                label: "Pipeline",
                value: (
                  <AppLink className="wb-link" href="#/pipelines">
                    {name}
                  </AppLink>
                ),
              },
              { label: "Version", value: "12" },
              { label: "Owner", value: pipeline?.owner },
              {
                label: "Commit",
                value: <span className="wb-mono">4be81c0d29f1</span>,
              },
              { label: "Attempt", value: "1 of 3" },
              {
                label: "Queued",
                value: <Time value={ago(52)} format="time" />,
              },
              {
                label: "Finished",
                value: <Time value={ago(49)} format="time" />,
              },
              {
                label: "Run ID",
                value: <span className="wb-mono">run_954dc0c2a32e</span>,
              },
            ]}
          />
        </aside>
      </div>
    </Main>
  );
}
