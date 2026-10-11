import { useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  AppShell,
  Avatar,
  Badge,
  Banner,
  Button,
  Card,
  Checkbox,
  Chip,
  ChipToggle,
  Combobox,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  FilterInput,
  Icon,
  IconButton,
  Input,
  Kbd,
  KeyValue,
  LinkTabs,
  ListRow,
  Main,
  Menu,
  Meter,
  Modal,
  Popover,
  ProgressBar,
  Rows,
  Seg,
  SegLinks,
  Select,
  Skeleton,
  SkeletonBlock,
  SkeletonRows,
  Spinner,
  StatePill,
  StatusDot,
  Switch,
  TabPanel,
  Tabs,
  Textarea,
  Tile,
  Time,
  Toolbar,
  ToolbarRow,
  ToolbarTitle,
  TopStatus,
  QualifiedName,
  iconNames,
  useConfirm,
  useToast,
} from "../../../src";
import type { Tone } from "../../../src";

const TONES: Tone[] = [
  "neutral",
  "info",
  "success",
  "warning",
  "danger",
  "muted",
];
const COLOR_TOKENS = [
  "page",
  "surface",
  "surface-2",
  "surface-3",
  "border",
  "border-strong",
  "fg",
  "fg-2",
  "muted",
  "accent",
  "accent-weak",
  "accent-text",
  "success",
  "success-text",
  "success-weak",
  "warning",
  "warning-text",
  "warning-weak",
  "danger",
  "danger-text",
  "danger-weak",
  "neutral",
  "neutral-weak",
  "s1",
  "s2",
  "s3",
  "s4",
  "s5",
  "s6",
  "s7",
  "s8",
  "seq-0",
  "seq-1",
  "seq-2",
  "seq-3",
  "seq-4",
  "seq-5",
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="gal-sec">
      <h2 className="wb-label-caps">{title}</h2>
      <div className="gal-sec-body">{children}</div>
    </section>
  );
}

function Themed({ theme }: { theme: "light" | "dark" }) {
  const [seg, setSeg] = useState("active");
  const [chip, setChip] = useState(true);
  const [tab, setTab] = useState("overview");
  const [detached, setDetached] = useState("summary");
  const [q, setQ] = useState("");
  const [one, setOne] = useState<string | null>("github");
  const [many, setMany] = useState<string[]>(["jira", "slack"]);
  const [filter, setFilter] = useState<string | null>(null);
  const services = ["github", "jira", "confluence", "slack", "pagerduty"].map(
    (s) => ({ value: s, label: s }),
  );
  return (
    <div className="gal-col" data-theme={theme}>
      <h1 className="gal-col-title">{theme === "light" ? "Light" : "Dark"}</h1>
      <Section title="Buttons">
        <div className="wb-inline">
          <Button>Default</Button>
          <Button variant="primary" icon="plus">
            Primary
          </Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger" icon="trash">
            Danger
          </Button>
          <Button variant="danger-ghost">Danger ghost</Button>
        </div>
        <div className="wb-inline">
          <Button size="sm" icon="refresh">
            Small
          </Button>
          <Button pending>Saving</Button>
          <Button disabled>Disabled</Button>
          <Button href="#/components" iconRight="arrow-right">
            Link button
          </Button>
          <IconButton icon="gear" label="Settings" />
          <IconButton icon="more" label="More" variant="default" />
          <IconButton icon="x" label="Close" size="sm" />
        </div>
      </Section>
      <Section title="Segmented control, chips">
        <Seg
          label="Status"
          value={seg}
          onChange={setSeg}
          options={[
            {
              value: "active",
              label: "Active",
              icon: "circle-check",
              tone: "success",
              count: 12,
            },
            { value: "paused", label: "Paused", icon: "pause", count: 3 },
            {
              value: "revoked",
              label: "Revoked",
              icon: "ban",
              tone: "danger",
              count: 1,
            },
            { value: "all", label: "All" },
          ]}
        />
        <Seg
          label="Size"
          size="sm"
          value="day"
          onChange={() => {}}
          options={[
            { value: "day", label: "Day" },
            { value: "week", label: "Week" },
            { value: "month", label: "Month" },
          ]}
        />
        <div className="wb-inline">
          <ChipToggle
            pressed={chip}
            onPressedChange={setChip}
            icon="tag"
            count={4}
          >
            Releases
          </ChipToggle>
          <ChipToggle pressed={false} onPressedChange={() => {}} icon="star">
            Stars
          </ChipToggle>
          <Chip onRemove={() => {}}>alice@example.com</Chip>
          <Chip icon="lock" readOnly>
            from config
          </Chip>
        </div>
      </Section>
      <Section title="Badges, pills, dots, kbd, avatars">
        <div className="wb-inline">
          {TONES.map((t) => (
            <Badge key={t} tone={t}>
              {t}
            </Badge>
          ))}
          <Badge variant="outline" icon="lock">
            Private
          </Badge>
        </div>
        <div className="wb-inline">
          {TONES.slice(0, 5).map((t) => (
            <Badge key={t} tone={t} variant="dot">
              {t}
            </Badge>
          ))}
        </div>
        <div className="wb-inline">
          <StatePill tone="success" icon="circle-check">
            Active
          </StatePill>
          <StatePill tone="danger" icon="ban">
            Revoked
          </StatePill>
          <StatePill tone="warning">Expiring</StatePill>
          <StatePill tone="info">Draft</StatePill>
          <StatePill tone="neutral" icon="pause">
            Paused
          </StatePill>
        </div>
        <div className="wb-inline">
          <StatusDot tone="success" label="Live" pulse />
          <StatusDot tone="warning" label="Degraded" />
          <StatusDot tone="danger" label="Down" />
          <StatusDot label="Unknown" />
          <Kbd>/</Kbd>
          <Kbd>Ctrl K</Kbd>
          <Avatar name="Alice Chen" size="md" highlight />
          <Avatar name="Bob Okafor" size="md" />
          <Avatar name="Carmen Ruiz" size="lg" />
          <Spinner label="Loading" />
          <Time value={new Date(Date.now() - 5 * 60_000)} />
        </div>
      </Section>
      <Section title="Tabs, segmented links">
        <Tabs
          label="Example tabs"
          value={tab}
          onChange={setTab}
          items={[
            { value: "overview", label: "Overview" },
            { value: "grants", label: "Grants", count: 6 },
            { value: "tokens", label: "Tokens", icon: "key" },
            { value: "limits", label: "Limits", disabled: true },
          ]}
        >
          <p className="gal-note">Panel for “{tab}”.</p>
        </Tabs>
        <SegLinks
          label="Space"
          items={[
            {
              href: "#/components",
              label: "Admin",
              icon: "shield",
              current: true,
            },
            {
              href: "#/components?space=me",
              label: "My access",
              icon: "user",
              current: false,
              count: 2,
            },
          ]}
        />
        <Tabs
          detached
          id={`gal-detached-${theme}`}
          label="Detached tabs"
          value={detached}
          onChange={setDetached}
          items={[
            { value: "summary", label: "Summary" },
            { value: "breakdown", label: "Breakdown" },
          ]}
        />
        <TabPanel tabsId={`gal-detached-${theme}`} value={detached}>
          <p className="gal-note">
            Detached panel for “{detached}” (tabs in a fixed header, panel in
            the scroll region).
          </p>
        </TabPanel>
        <LinkTabs
          label="Link tabs"
          items={[
            { href: "#/components", label: "Actions", current: true },
            {
              href: "#/components?tab=managers",
              label: "Managers",
              current: false,
            },
            {
              href: "#/components?tab=import",
              label: "Import",
              current: false,
            },
          ]}
        />
      </Section>
      <Section title="Forms">
        <FilterInput
          value={q}
          onChange={setQ}
          placeholder="Filter…"
          hotkey={theme === "light" ? "/" : null}
        />
        <Field label="Display name" hint="Shown in lists and the top bar.">
          <Input defaultValue="Alice Chen" />
        </Field>
        <Field
          label="Token name"
          error="A token with this name already exists."
        >
          <Input mono defaultValue="laptop-cli" />
        </Field>
        <Field label="Service">
          <Combobox
            value={one}
            onChange={setOne}
            options={services}
            placeholder="Pick a service"
          />
        </Field>
        <Field label="Services" optional>
          <Combobox
            multiple
            value={many}
            onChange={setMany}
            options={services}
            placeholder="Add…"
          />
        </Field>
        <Field label="Action filter" hint="Free text; kept on Tab or blur.">
          <Combobox
            value={filter}
            onChange={setFilter}
            options={services}
            allowCustom
            commitOnBlur
            customOptionLabel={(t) => `Filter by “${t}”`}
            customOptionIcon="search"
            placeholder="Any action"
          />
        </Field>
        <Field label="Region">
          <Select
            options={[
              { value: "eu", label: "Europe (Frankfurt)" },
              { value: "us", label: "US East" },
            ]}
          />
        </Field>
        <Field label="Notes">
          <Textarea rows={2} placeholder="Optional notes" />
        </Field>
        <div className="wb-inline">
          <Checkbox label="Remember me" defaultChecked />
          <Checkbox label="Indeterminate" indeterminate />
          <Switch label="Enabled" defaultChecked />
          <Switch label="Off" />
        </div>
      </Section>
      <Section title="Form layout, small switch, text links">
        <fieldset className="wb-form-stack" data-gal="form-stack">
          <Field label="Grant name" hint="Shown in lists and audit events.">
            <Input defaultValue="ci-readonly" />
          </Field>
          <div className="wb-form-row" data-gal="form-row">
            <Field label="Requests">
              <Input numeric defaultValue="600" />
            </Field>
            <Field label="Window" error="Use s, m, h or d, e.g. 1m.">
              <Input mono defaultValue="1 minute" />
            </Field>
          </div>
          <div className="wb-form-row" data-gal="form-row-action">
            <Field label="Repository">
              <Input mono placeholder="namespace/repository" />
            </Field>
            <Button icon="shield-check">Verify</Button>
          </div>
          <Checkbox label="Notify the owner" defaultChecked />
          <div className="wb-form-error">Couldn’t save: the grant exists.</div>
        </fieldset>
        <div className="wb-inline" data-gal="switch-sm">
          <label className="wb-switch-label">
            <Switch className="wb-switch--sm" defaultChecked />
            <span>Small</span>
          </label>
          <label className="wb-switch-label">
            <Switch className="wb-switch--sm" />
            <span>Small, off</span>
          </label>
          <label className="wb-switch-label">
            <Switch defaultChecked />
            <span>Default</span>
          </label>
        </div>
        <div className="wb-inline" data-gal="links">
          <button type="button" className="wb-link">
            Text link
          </button>
          <button type="button" className="wb-link" disabled>
            Disabled
          </button>
          <a className="wb-link" role="link" aria-disabled="true">
            aria-disabled
          </a>
        </div>
      </Section>
      <Section title="Banners">
        <Banner tone="info" title="Heads up">
          Imported services refresh every 6 hours.
        </Banner>
        <Banner
          tone="warning"
          slim
          onDismiss={() => {}}
          actions={<Button size="sm">Verify</Button>}
        >
          2 credentials are unverified.
        </Banner>
        <Banner tone="danger" title="Password change required">
          Your password expired on Sep 20.
        </Banner>
        <Banner tone="success" slim>
          All checks passed.
        </Banner>
      </Section>
      <Section title="Rows">
        <div className="gal-rows">
          <Rows label="Sample rows">
            <ListRow
              icon="key"
              iconTone="success"
              href="#/components"
              title="laptop-cli"
              titleExtra={<Badge tone="success">Active</Badge>}
              meta={
                <>
                  <span className="wb-num">tok_8f2a</span>
                  <span className="wb-sep">·</span>github, jira
                  <span className="wb-sep">·</span>used{" "}
                  <Time value={new Date(Date.now() - 12 * 60_000)} />
                </>
              }
              description="Issued for the laptop CLI; limited to read actions on two services."
              side={
                <Time value={new Date(Date.now() - 864e5 * 3)} format="date" />
              }
              actions={<IconButton icon="copy" label="Copy" size="sm" />}
            />
            <ListRow
              icon="key"
              iconTone="muted"
              href="#/components"
              title="ci-nightly"
              meta="cloudbees · paused"
              side="Sep 3"
              active
            />
            <ListRow
              icon="key"
              iconTone="danger"
              href="#/components"
              title="old-agent"
              meta="revoked"
              side="Aug 12"
              cursor
            />
            <ListRow
              compact
              icon="shield-check"
              iconTone="success"
              href="#/components"
              title="repo.read on github"
              meta="Alice Chen · 212 ms"
              side="5m ago"
            />
            <ListRow
              compact
              icon="braces"
              iconTone="warning"
              href="#/components"
              title={
                <span className="wb-mono">synthetic_example_secret_token</span>
              }
              titleExtra={<Badge tone="warning">Redact</Badge>}
              meta="catalog · updated 5h ago · 1,284 hits in the last 7 days"
              side="1h ago"
            />
            <ListRow
              compact
              icon="ban"
              iconTone="danger"
              href="#/components"
              title="contents.write on github"
              meta="ci-runner · 18 ms"
              side="9m ago"
            />
          </Rows>
        </div>
      </Section>
      <Section title="Tiles, meter, key/value">
        <div className="gal-tiles">
          <Tile
            label="Requests"
            value="1,284"
            delta={{
              value: "12%",
              direction: "up",
              good: true,
              vs: "last week",
            }}
          />
          <Tile
            label="Latency"
            value="184"
            unit="ms"
            delta={{ value: "9 ms", direction: "down", good: false }}
          />
        </div>
        <Meter label="Quota" value={412} max={500} valueText="412 / 500" />
        <Meter label="Disk" value={9} max={10} tone="danger" />
        <div className="gal-progress">
          <ProgressBar active />
        </div>
        <KeyValue
          items={[
            {
              label: "Created",
              value: (
                <Time
                  value={new Date(Date.now() - 864e5 * 30)}
                  format="datetime"
                />
              ),
            },
            {
              label: "Owner",
              value: (
                <>
                  <Avatar name="Alice Chen" /> Alice Chen
                </>
              ),
            },
            {
              label: "Scopes",
              value: (
                <>
                  <Badge>read</Badge>
                  <Badge>write</Badge>
                </>
              ),
            },
          ]}
        />
      </Section>
      <Section title="States">
        <Card>
          <EmptyState
            compact
            icon="key"
            title="No tokens yet"
            actions={
              <Button variant="primary" icon="plus">
                Issue token
              </Button>
            }
          >
            Tokens let agents act on your behalf.
          </EmptyState>
        </Card>
        <Card>
          <ErrorState
            compact
            error={new Error("GET /api/tokens failed: 502 Bad Gateway")}
            onRetry={() => {}}
          />
        </Card>
        <Card>
          <SkeletonRows rows={2} header={false} />
          <SkeletonBlock lines={3} />
          <Skeleton width="40%" />
        </Card>
      </Section>
      <Section title="Table">
        <div className="wb-table-card">
          <table className="wb-table">
            <thead>
              <tr>
                <th scope="col">Service</th>
                <th scope="col" className="wb-cell-num">
                  Requests
                </th>
                <th scope="col" className="wb-cell-num">
                  Denied
                </th>
                <th scope="col" className="wb-cell-actions">
                  <span className="wb-sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {[
                ["github", 9812, 37],
                ["jira", 2210, 4],
                ["cloudbees", 412, 0],
              ].map(([s, r, d]) => (
                <tr
                  key={String(s)}
                  className={s === "jira" ? "is-selected" : undefined}
                >
                  <td className="wb-cell-strong">{s}</td>
                  <td className="wb-cell-num">
                    {Number(r).toLocaleString("en-US")}
                  </td>
                  <td className="wb-cell-num">{d}</td>
                  <td className="wb-cell-actions">
                    <div className="wb-row-actions">
                      <IconButton
                        icon="pencil"
                        label={`Edit ${String(s)}`}
                        size="sm"
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
      <SmallPatterns />
      <Section title="Colour tokens">
        <div className="gal-swatches">
          {COLOR_TOKENS.map((t) => (
            <div key={t} className="gal-swatch">
              <span className={`gal-chip gal-chip-${t}`} />
              <code>--wb-{t}</code>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

/** Small patterns: indicator dot, token entry, small switch, status links, names, one-row card header. */
function SmallPatterns() {
  const [emails, setEmails] = useState<string[]>(["alice@example.com"]);
  const [branchQ, setBranchQ] = useState("");
  return (
    <>
      <Section title="Icon button indicator">
        <div className="wb-inline">
          <IconButton
            icon="filter"
            label="Visibility: Private"
            variant="default"
            indicator
          />
          <IconButton icon="filter" label="Visibility: Any" variant="default" />
          <IconButton icon="sliders" label="Columns: 2 hidden" indicator />
          <IconButton
            icon="filter"
            label="Filters: 1 active"
            size="sm"
            indicator
          />
          <span className="wb-small wb-muted">
            The label says what is active.
          </span>
        </div>
      </Section>
      <Section title="Token entry, switch size">
        <Field label="Notify" hint="Comma, space or paste a list of emails.">
          <Combobox
            multiple
            allowCustom
            separators={[",", " "]}
            parse={(text) =>
              text
                .split(/[\s,;]+/)
                .map((t) => t.toLowerCase())
                .filter((t) => t.includes("@"))
            }
            customOptionIcon="user"
            value={emails}
            onChange={setEmails}
            placeholder="name@example.com"
          />
        </Field>
        <div className="wb-inline">
          <Switch label="Follow agents" size="sm" defaultChecked />
          <Switch label="Default size" defaultChecked />
        </div>
      </Section>
      <Section title="Top bar status, names">
        <div className="wb-inline">
          <TopStatus
            tone="success"
            label="Synced 2 m ago"
            detail="Link: opens the sync settings"
            href="#/settings"
          />
          <TopStatus
            tone="warning"
            label="1 source failing"
            detail="Button: opens details"
            onClick={() => {}}
          />
          <TopStatus tone="info" pulse label="Syncing…" />
        </div>
        <div className="gal-names">
          {[260, 150, 96].map((w) => (
            <div key={w} className={`gal-name-box gal-name-box-${w}`}>
              <QualifiedName prefix="octo-platform-team" name="atlas" />
              <QualifiedName prefix="octo" name="workbench-ui-kit" />
              <QualifiedName name="platform-observability" />
            </div>
          ))}
        </div>
      </Section>
      <Section title="Card header (one row)">
        <Card
          title="Branches"
          subtitle={
            <>
              newest first, compared with <code>main</code>
            </>
          }
          headAlign="center"
          actions={
            <FilterInput
              value={branchQ}
              onChange={setBranchQ}
              placeholder="Filter branches"
              hotkey={null}
              className="gal-card-filter"
            />
          }
        >
          <ul className="gal-links">
            {["feat/token-entry", "fix/toast-pause", "docs/confirm"]
              .filter((b) => b.includes(branchQ.trim()))
              .map((b) => (
                <li key={b} className="gal-kind">
                  <Icon name="branch" />
                  <span className="wb-mono">{b}</span>
                  <Icon name="comment" />
                  <span className="wb-muted">2</span>
                  <Icon name="diff" />
                </li>
              ))}
          </ul>
        </Card>
      </Section>
    </>
  );
}

function Overlays() {
  const toast = useToast();
  const ask = useConfirm();
  const [modal, setModal] = useState<"sm" | "md" | "lg" | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [pop, setPop] = useState(false);
  const anchorEl = useRef<HTMLButtonElement | null>(null);
  return (
    <section className="gal-sec gal-overlays">
      <h2 className="wb-label-caps">
        Overlays (portaled; follow the page theme)
      </h2>
      <div className="wb-inline">
        <Button onClick={() => setModal("sm")}>Small modal</Button>
        <Button onClick={() => setModal("md")}>Modal</Button>
        <Button onClick={() => setModal("lg")}>Large modal</Button>
        <Button variant="danger" onClick={() => setConfirm(true)}>
          Confirm (fails)
        </Button>
        <Menu
          label="Actions"
          items={[
            { id: "edit", label: "Edit", icon: "pencil", hint: "E" },
            { id: "dup", label: "Duplicate", icon: "copy" },
            {
              id: "link",
              label: "Open docs",
              icon: "external",
              href: "#/components",
            },
            { type: "separator" },
            { id: "del", label: "Delete", icon: "trash", danger: true },
          ]}
          trigger={(props) => (
            <Button {...props} iconRight="chevron-down">
              Menu
            </Button>
          )}
        />
        <Button
          ref={anchorEl}
          onClick={() => setPop((p) => !p)}
          aria-expanded={pop}
          aria-haspopup="dialog"
        >
          Popover
        </Button>
        <Button onClick={() => toast("Token revoked")}>Toast</Button>
        <Button
          onClick={() =>
            toast("Couldn’t save: 409 Conflict", { tone: "error" })
          }
        >
          Error toast
        </Button>
        <Button
          onClick={() =>
            toast("Rule deleted", {
              action: { label: "Undo", onClick: () => toast("Restored") },
            })
          }
        >
          Toast with action
        </Button>
      </div>
      <div className="wb-inline">
        <Button
          onClick={async () => {
            const removed = await ask({
              title: "Remove octo/atlas?",
              body: "Its synced data leaves this dashboard. Nothing changes at the source.",
              confirmLabel: "Remove",
              action: () => new Promise((done) => setTimeout(done, 900)),
            });
            toast(removed ? "Removed octo/atlas" : "Kept octo/atlas", {
              tone: removed ? "success" : "default",
            });
          }}
        >
          useConfirm (async)
        </Button>
        <span className="wb-small wb-muted">
          Toasts pause while hovered or focused (Tab to an action); Esc
          dismisses a focused toast.
        </span>
      </div>
      <div className="gal-icons">
        {iconNames.map((n) => (
          <span key={n} className="gal-icon" title={n}>
            <Icon name={n} />
            <span>{n}</span>
          </span>
        ))}
      </div>
      <Popover
        open={pop}
        onClose={() => setPop(false)}
        anchorRef={anchorEl}
        label="Custom range"
        padded
      >
        <Field label="From">
          <Input type="date" defaultValue="2026-09-01" />
        </Field>
        <Field label="To">
          <Input type="date" defaultValue="2026-09-28" />
        </Field>
        <div className="wb-settings-actions">
          <Button variant="primary" onClick={() => setPop(false)}>
            Apply
          </Button>
        </div>
      </Popover>
      <Modal
        open={modal !== null}
        onClose={() => setModal(null)}
        size={modal ?? "md"}
        title={modal === "lg" ? "Export this view" : "Issue token"}
        description="Tokens are shown once; store it in your agent's secret store."
        footerNote="Expires in 30 days"
        footer={
          <>
            <Button onClick={() => setModal(null)}>Cancel</Button>
            <Button variant="primary" onClick={() => setModal(null)}>
              Issue token
            </Button>
          </>
        }
      >
        {Array.from({ length: modal === "lg" ? 12 : 3 }, (_, i) => (
          <Field key={i} label={`Field ${i + 1}`}>
            <Input placeholder="Value" />
          </Field>
        ))}
      </Modal>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Delete service github?"
        confirmLabel="Delete"
        onConfirm={() =>
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error("409: the service has active grants.")),
              500,
            ),
          )
        }
      >
        <p>Grants that reference it are removed as well.</p>
      </ConfirmDialog>
    </section>
  );
}

export function CatalogView({ topBar }: { topBar: ReactNode }) {
  return (
    <AppShell topBar={topBar}>
      <Main
        tint
        label="Component gallery"
        toolbar={
          <Toolbar>
            <ToolbarRow>
              <ToolbarTitle>Components</ToolbarTitle>
              <span className="wb-summary">
                Every component in both themes. Overlays open over the page
                theme.
              </span>
            </ToolbarRow>
          </Toolbar>
        }
      >
        <Overlays />
        <div className="gal-cols">
          <Themed theme="light" />
          <Themed theme="dark" />
        </div>
      </Main>
    </AppShell>
  );
}
