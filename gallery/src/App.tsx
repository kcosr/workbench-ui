import { useState } from "react";
import type { ReactNode } from "react";
import {
  Brand,
  ConfirmProvider,
  IconButton,
  Menu,
  NavTab,
  NavTabs,
  SegLinks,
  SidebarToggle,
  Spacer,
  ThemeMenu,
  ToastProvider,
  TopBar,
  TopSearch,
  TopStatus,
  useCommandPaletteHotkey,
  useTheme,
  useToast,
} from "../../src";
import { GalleryPalette } from "./palette";
import { useRoute } from "./router";
import { CatalogView } from "./views/Catalog";
import { EventsView } from "./views/Events";
import { PersonView } from "./views/Person";
import { RulesView } from "./views/Rules";
import { SettingsView } from "./views/Settings";
import { LabView } from "./views/Lab";
import { TablesView } from "./views/Tables";

export const THEME_KEY = "workbench-gallery:theme";
/** ?crowded=1 (before the #): a crowded top bar. */
const CROWDED =
  new URLSearchParams(window.location.search).get("crowded") === "1";

export function App() {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <Shell />
      </ConfirmProvider>
    </ToastProvider>
  );
}

function Shell() {
  const route = useRoute();
  const theme = useTheme(THEME_KEY);
  const toast = useToast();
  const [paletteOpen, setPaletteOpen] = useState(
    () => route.params.get("palette") === "1",
  );
  useCommandPaletteHotkey(() => setPaletteOpen((open) => !open));
  const view = route.path.split("/")[1] || "events";

  const topBar: ReactNode = (
    <TopBar>
      <SidebarToggle />
      <Brand name="Workbench" href="#/" icon="shield" />
      {CROWDED ? (
        <SegLinks
          label="Space"
          size="sm"
          items={[
            { href: "#/", label: "Admin", current: true },
            { href: "#/people/u-alice", label: "My access", current: false },
          ]}
        />
      ) : null}
      <NavTabs>
        <NavTab href="#/" current={view === "events"} icon="activity">
          Events
        </NavTab>
        <NavTab
          href="#/rules"
          current={view === "rules"}
          icon="list"
          count={3}
          countTone="warning"
          countLabel="3 rules need review"
        >
          Rules
        </NavTab>
        <NavTab
          href="#/people/u-alice"
          current={view === "people"}
          icon="users"
        >
          People
        </NavTab>
        <NavTab href="#/tables" current={view === "tables"} icon="table">
          Tables
        </NavTab>
        <NavTab href="#/components" current={view === "components"} icon="grid">
          Components
        </NavTab>
        {CROWDED ? (
          <NavTab
            href="#/settings"
            current={view === "settings"}
            icon="shield-check"
            count={2}
            countTone="danger"
            countLabel="2 denials to review"
          >
            Audit
          </NavTab>
        ) : null}
      </NavTabs>
      <Spacer />
      <TopSearch
        onClick={() => setPaletteOpen(true)}
        placeholder="Search events, people, views…"
      />
      <TopStatus
        tone="success"
        pulse
        label={
          CROWDED
            ? "r5 active · native on · LLM off · managed"
            : "Live · r5 active"
        }
        shortLabel="r5"
        detail="Revision r5 active since 09:12 · native rules on · LLM off"
      />
      <IconButton
        icon="refresh"
        label="Refresh"
        onClick={() => toast("Refreshed")}
      />
      <ThemeMenu mode={theme.mode} onChange={theme.setMode} />
      <IconButton
        href="#/settings"
        icon="gear"
        label="Settings"
        aria-current={view === "settings" ? "page" : undefined}
      />
      <Menu
        label="Account"
        items={[
          {
            type: "heading",
            label: "Signed in as",
            sub: "alice.chen@example.com",
          },
          { type: "separator" },
          {
            id: "account",
            label: "Account settings",
            icon: "user",
            href: "#/settings",
          },
          {
            id: "shortcuts",
            label: "Keyboard shortcuts",
            icon: "command",
            hint: "?",
            onSelect: () =>
              toast("j / k move · ↵ open · / filter · Ctrl K search"),
          },
          { type: "separator" },
          {
            id: "signout",
            label: "Sign out",
            icon: "log-out",
            onSelect: () => toast("Signed out (demo)"),
          },
        ]}
        trigger={(props) => (
          <IconButton {...props} icon="user" label="Account" />
        )}
      />
    </TopBar>
  );

  let body: ReactNode;
  if (view === "settings") body = <SettingsView topBar={topBar} />;
  else if (view === "rules") body = <RulesView topBar={topBar} />;
  else if (view === "people") body = <PersonView topBar={topBar} />;
  else if (view === "components") body = <CatalogView topBar={topBar} />;
  else if (view === "tables") body = <TablesView topBar={topBar} />;
  else if (view === "lab") body = <LabView />;
  else body = <EventsView topBar={topBar} />;

  return (
    <>
      {body}
      {paletteOpen ? (
        <GalleryPalette
          onClose={() => setPaletteOpen(false)}
          mode={theme.mode}
          setMode={theme.setMode}
        />
      ) : null}
    </>
  );
}
