import { useState } from "react";
import type { ReactNode } from "react";
import {
  AppShell,
  Badge,
  Banner,
  Button,
  Combobox,
  ConfirmDialog,
  Disclosure,
  Input,
  KeyValue,
  Main,
  Meter,
  Seg,
  Select,
  SettingsPage,
  SettingsRow,
  SettingsSection,
  Switch,
  Time,
  Toolbar,
  ToolbarRow,
  ToolbarTitle,
  useToast,
} from "../../../src";

export function SettingsView({ topBar }: { topBar: ReactNode }) {
  const toast = useToast();
  const [capture, setCapture] = useState(true);
  const [interval, setIntervalValue] = useState("30");
  const [mode, setMode] = useState<"native" | "llm" | "both">("native");
  const [emails, setEmails] = useState<string[]>(["alice.chen@example.com"]);
  const [retention, setRetention] = useState("30");
  const [confirmReload, setConfirmReload] = useState(false);
  const intervalOk =
    /^\d+$/.test(interval) && Number(interval) >= 5 && Number(interval) <= 1440;

  return (
    <AppShell topBar={topBar}>
      <Main
        tint
        label="Settings"
        toolbar={
          <Toolbar>
            <ToolbarRow>
              <ToolbarTitle>Settings</ToolbarTitle>
              <span className="wb-spacer" />
              <Button icon="file-text" href="#/components">
                API docs
              </Button>
              <Button icon="braces" href="#/components">
                OpenAPI
              </Button>
            </ToolbarRow>
          </Toolbar>
        }
      >
        <SettingsPage>
          <SettingsSection
            title="Runtime"
            description="Read-only facts about the running service."
          >
            <KeyValue
              items={[
                {
                  label: "Status",
                  value: (
                    <Badge variant="dot" tone="success">
                      Healthy
                    </Badge>
                  ),
                },
                {
                  label: "Revision",
                  value: (
                    <>
                      <b>r5</b>{" "}
                      <span className="wb-muted">
                        · applied{" "}
                        <Time value={new Date(Date.now() - 36e5 * 3)} />
                      </span>
                    </>
                  ),
                },
                {
                  label: "Database",
                  value: <span className="wb-num">/var/lib/app/state.db</span>,
                },
                {
                  label: "Last reload",
                  value: (
                    <Time
                      value={new Date(Date.now() - 36e5 * 3)}
                      format="datetime"
                    />
                  ),
                },
              ]}
            />
            <div className="gal-meter">
              <Meter
                label="Disk used"
                value={31}
                max={50}
                valueText="31 GB of 50 GB"
                tone="warning"
              />
            </div>
            <div className="wb-settings-actions">
              <Button icon="refresh" onClick={() => setConfirmReload(true)}>
                Reload runtime
              </Button>
            </div>
          </SettingsSection>

          <SettingsSection
            title="Capture"
            description="What the service records for each request."
          >
            <SettingsRow
              label="Capture requests"
              help="Store request metadata for the Events view."
            >
              <Switch
                checked={capture}
                onChange={(e) => setCapture(e.target.checked)}
              />
            </SettingsRow>
            <SettingsRow
              label="Sync interval"
              help="Minutes between background syncs (5–1440)."
            >
              <Input
                numeric
                value={interval}
                onChange={(e) => setIntervalValue(e.target.value)}
                aria-invalid={!intervalOk}
                inputMode="numeric"
              />
              <span>min</span>
              {!intervalOk ? (
                <span className="gal-err">Enter 5 to 1440</span>
              ) : null}
            </SettingsRow>
            <SettingsRow
              label="Screening"
              help="Which engines screen responses."
              group
            >
              <Seg
                label="Screening"
                value={mode}
                onChange={setMode}
                options={[
                  { value: "native", label: "Native rules" },
                  { value: "llm", label: "LLM" },
                  { value: "both", label: "Both" },
                ]}
              />
            </SettingsRow>
            <SettingsRow
              label="Retention"
              help="How long captured events are kept."
            >
              <Select
                value={retention}
                onChange={(e) => setRetention(e.target.value)}
                options={[
                  { value: "7", label: "7 days" },
                  { value: "30", label: "30 days" },
                  { value: "90", label: "90 days" },
                ]}
              />
            </SettingsRow>
            <SettingsRow
              label="Alert emails"
              help="Enter adds an address; Backspace removes the last."
              stack
            >
              <Combobox
                multiple
                allowCustom
                value={emails}
                onChange={setEmails}
                options={[]}
                placeholder="you@example.com"
                emptyText="Type an address"
              />
            </SettingsRow>
            <div className="wb-settings-actions">
              <Button
                variant="primary"
                disabled={!intervalOk}
                onClick={() => toast("Settings saved", { tone: "success" })}
              >
                Save changes
              </Button>
              <Button>Reset</Button>
            </div>
          </SettingsSection>

          <SettingsSection
            title="File-owned settings"
            description="Set in app.toml; change them there and reload."
          >
            <Banner tone="warning" title="Restart required" slim>
              The listen address changed on disk and applies after a restart.
            </Banner>
            <div className="gal-gap" />
            <KeyValue
              labelWidth={140}
              items={[
                { label: "Listen", value: <code>127.0.0.1:8790</code> },
                {
                  label: "Catalog",
                  value: <span className="wb-num">sha256:3f9a…e1</span>,
                },
              ]}
            />
            <div className="gal-gap" />
            <Disclosure summary="How to change these">
              <pre className="wb-code">
                {'[server]\nlisten = "127.0.0.1:8790"'}
              </pre>
            </Disclosure>
          </SettingsSection>
        </SettingsPage>
      </Main>
      <ConfirmDialog
        open={confirmReload}
        onClose={() => setConfirmReload(false)}
        title="Reload runtime?"
        tone="primary"
        confirmLabel="Reload"
        onConfirm={() =>
          new Promise<void>((resolve) =>
            setTimeout(() => {
              toast("Runtime reloaded");
              resolve();
            }, 600),
          )
        }
      >
        <p>
          In-flight requests finish on the current revision; new ones use r5
          from disk.
        </p>
      </ConfirmDialog>
    </AppShell>
  );
}
