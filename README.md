# workbench-ui

A small shared UI kit — plain CSS plus React components — for building
dense, desktop-first tool UIs. It provides a shell: a 52px top bar with view
tabs, a resizable sidebar of filters, a main pane with a toolbar and dense
grouped rows, a push-style detail drawer, a command palette, settings pages and
toasts.

- **Plain CSS** with custom properties. Every class is `wb-` prefixed, every
  custom property `--wb-` prefixed, everything lives in `@layer wb`.
- **React 19** components with no runtime dependencies besides React. Router
  agnostic: works with react-router and with plain hash links.
- **Desktop only.** Designed for 1280–2560px, usable (no overlap, no clipping)
  at 1024px. Applications keep their own mobile composition; adopting the
  shared primitives does not add a phone layout to AppShell.
- **CSP safe** for `style-src 'self'` / `script-src 'self'`: no `<style>`
  injection, no inline scripts, no `eval`, fonts are bundled files.
- **Bundled fonts:** Inter Variable and JetBrains Mono 400/500 from Fontsource
  5.3.0, including Latin, extended Latin, Cyrillic, Greek and Vietnamese subsets
  (SIL OFL 1.1, licences in `src/fonts/`).

The gallery (`npm run dev`) is the reference: a sample app composing the whole
shell (`#/`, `#/rules`, `#/people/u-alice`, `#/settings`) and a catalog of
every component in light and dark (`#/components`). Copy patterns from it.

## Contents

1. [Vendoring](#vendoring)
2. [CSS integration and cascade layers](#css-integration-and-cascade-layers)
3. [Theme bootstrap](#theme-bootstrap)
4. [Links and routers](#links-and-routers)
5. [Composing the shell](#composing-the-shell)
6. [Tokens](#tokens)
7. [Class inventory](#class-inventory)
8. [Components](#components)
9. [Keyboard and focus](#keyboard-and-focus)
10. [Conventions](#conventions)
11. [CSP notes](#csp-notes)
12. [Developing the kit](#developing-the-kit)
13. [License](#license)

## Vendoring

Apps copy the kit's `src/` to `<ui dir>/src/workbench/`, pinned by commit:

```sh
# from this repo
node scripts/vendor.mjs /path/to/app/web/src/workbench
```

Commit `src/` and `scripts/verify-vendor.mjs` before running the script.
It copies those files from the selected kit commit, writes the pin and copy
date in `VENDORED.md`, and includes `VENDORED.json` (commit plus SHA-256 file
manifest) and the standalone `verify-vendor.mjs`. Changes to those source
paths, including untracked or ignored files, prevent vendoring. There is no
`--allow-dirty` mode.

The copied `.gitattributes` disables Git line-ending conversion for the entire
snapshot, including generated provenance and the portable verifier. Keep it
with the copy: checkouts with `core.autocrlf=true` must preserve the exact bytes
recorded in the SHA-256 manifest on every platform.

Check an installed copy against its recorded Git revision from the kit:

```sh
node scripts/vendor.mjs /path/to/app/web/src/workbench --check
```

This verifies the source and verifier against the kit's Git history, rather
than trusting the consumer's checksum manifest alone. Fetch the recorded
commit if it is not available locally. Before replacing an existing copy,
the vendor script performs this check and refuses to overwrite changed,
missing or added files. Older copies without a checksum manifest are checked
against their original pinned source tree before being upgraded. Port local
changes into the kit and preserve them in reviewable commits before resolving
a reported difference; do not simply discard the modified consumer directory.
A non-empty directory without valid vendor provenance is also refused.

Consumers can verify their copy without a sibling kit checkout:

```sh
node /path/to/app/web/src/workbench/verify-vendor.mjs
```

Wire this portable check into each new consumer's check/build command, for
example in the application's `package.json`:

```json
{
  "scripts": {
    "check:workbench": "node src/workbench/verify-vendor.mjs",
    "build": "npm run check:workbench && tsc -b && vite build"
  }
}
```

Adapt the build tail to the application. The portable check compares the
installed files with their manifest; the kit-side check additionally verifies
the manifest and files against Git. These checks establish provenance and
catch accidental drift. They are not a security guarantee against someone
changing both files and verification metadata.

**Never edit vendored files.** Fix the kit, commit, re-vendor. The vendored
tree is Prettier-clean (defaults) and typechecks under each app's compiler
options (`strict`, `noUnusedLocals`/`Parameters`, `verbatimModuleSyntax`,
`erasableSyntaxOnly`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`
are all satisfied; TypeScript 5.9 and 6.0 checked). It only uses React APIs
available in 19.0.

Import everything from the barrel:

```ts
import { AppShell, Button, useTheme } from "./workbench";
```

## CSS integration and cascade layers

All kit CSS is inside `@layer wb` with sub-layers
`wb.fonts, wb.tokens, wb.base, wb.components, wb.tones, wb.utilities`.
Unlayered CSS always beats layered CSS, so **any unlayered app rule overrides
the kit** regardless of specificity. Base rules additionally use `:where()`
(zero specificity).

Import `src/workbench/styles/index.css` **once, from `main.tsx`** (not via a
CSS `@import`: Vite 8 duplicates the `@font-face` rules when they are reached
through a nested CSS import; harmless, but wasteful).

### Plain CSS / CSS Modules apps

```ts
// main.tsx
import { applyStoredTheme } from "./workbench";
import "./workbench/styles/index.css"; // kit first
import "./styles.css"; // app CSS (unlayered, wins)

applyStoredTheme("my-app:theme");
```

CSS Modules classes are unlayered too, so they override kit classes.

### Standalone media frame

Applications that already own their layout and theme can adopt `MediaFrame`
alone. Import its module and stylesheet directly; this does not require the
kit's base rules, fonts, tokens, or shell. The frame also fits narrow content
columns without adding an application-level mobile layout.

```tsx
import { MediaFrame } from "./workbench/components/MediaFrame";
import "./workbench/styles/media-frame.css";

<MediaFrame
  title="Example diagram"
  metadata="Revision 2"
  actions={<button onClick={expand}>Expand</button>}
>
  <Diagram />
</MediaFrame>;
```

The header is optional and omitted when `title`, `metadata`, and `actions`
are absent. A visible title labels the group, and metadata supplies its
accessible description. Native div attributes allow app-owned labels and
events. `className` and `bodyClassName` target the frame and contained body.
The body scrolls overflowing content; rendering, sizing, zoom, expansion,
and interaction remain with the application. The frame never executes media.

Style it with `--wb-media-border`, `--wb-media-radius`,
`--wb-media-background`, `--wb-media-header-background`, `--wb-media-color`,
`--wb-media-muted`, `--wb-media-font-size`, `--wb-media-header-padding`, and
`--wb-media-body-padding`. Colour and radius properties use the matching
kit token when available and neutral defaults otherwise. Import only the
standalone stylesheet when the application supplies its own theme.

`MediaZoomControls` uses the same standalone stylesheet. Place it inside a
positioned viewer to get a compact, floating bottom-center strip: minus,
percentage, plus, Fit, and 1:1. It adds no full-width header and owns no zoom
state. `onFit` and `onActualSize` remain separate actions even when both result
in 100% for a particular document.

```tsx
import { MediaZoomControls } from "./workbench/components/MediaZoomControls";

<MediaZoomControls
  label="Diagram zoom"
  zoomPercent={zoom * 100}
  canZoomOut={zoom > minZoom}
  canZoomIn={zoom < maxZoom}
  onZoomOut={zoomOut}
  onZoomIn={zoomIn}
  onFit={fitToView}
  onActualSize={() => setZoom(1)}
  onZoomToPercent={(percent) => setZoom(percent / 100)}
/>;
```

Omit `onZoomToPercent` for a passive percentage display. When supplied, the
percentage opens a preset popover; the caller applies its own zoom limits.
Escape, outside pointer interaction, or leaving the controls closes it.
Escape from the open presets returns focus to the percentage without dismissing
an enclosing dialog; the next Escape is left to the enclosing viewer.
`className` customizes the strip. The viewer supplies a positioned ancestor
and enough space for the controls and optional popover.

The strip inherits `--wb-media-color`, `--wb-media-muted`, `--wb-media-border`,
and `--wb-media-font-size`. Additional controls-specific properties are
`--wb-media-controls-background`, `--wb-media-controls-hover-background`,
`--wb-media-controls-shadow`, `--wb-media-controls-radius`,
`--wb-media-controls-offset`, `--wb-media-controls-z-index`, and
`--wb-media-focus`. These use kit tokens or neutral defaults when unset.

### Tailwind v4

Declare the layer order first so the kit sits above Tailwind's base but below
components and utilities, then import the kit after that stylesheet:

```css
/* src/styles.css */
@layer theme, base, wb, components, utilities;
@import "tailwindcss/theme.css" layer(theme);
@import "tailwindcss/utilities.css" layer(utilities);
/* (preflight omitted on purpose; the kit's wb.base is the reset) */
```

```ts
// main.tsx
import "./styles.css"; // declares the order
import "./workbench/styles/index.css"; // lands in the "wb" slot
```

Utilities (`p-4`, `flex`, `text-sm`…) beat kit components; kit components
beat Tailwind `base`. The `--wb-` prefix keeps kit tokens out of Tailwind's
`--color-*`, `--text-*`, `--font-*`, `--shadow-*`, `--radius-*` namespaces. To
use kit tokens in utilities, map them in `@theme inline`, e.g.
`--color-accent: var(--wb-accent);`.

Verified with `@tailwindcss/vite` 4.3 + Vite 8 (`base: "/ui/"`): fonts are
emitted as hashed files, `url()`s are rebased, no `data:` URIs.

Do not import the kit with `@import … layer(wb)`: the kit already names its
layers and would end up in `wb.wb.*`.

## Theme bootstrap

Modes are `system | light | dark`; the applied theme is `light | dark`, set as
`data-theme` and `color-scheme` on `<html>` (via CSSOM, CSP safe).

```ts
// main.tsx, before createRoot(): no inline <script> needed
import { applyStoredTheme } from "./workbench";
applyStoredTheme("my-app:theme");
```

```tsx
// anywhere in the app (all instances share one store per key)
const { mode, theme, setMode } = useTheme("my-app:theme");
<ThemeMenu mode={mode} onChange={setMode} />;
```

While the mode is `system` the theme follows `prefers-color-scheme` live.
`setMode("system")` removes the stored override. Changes sync across tabs.
Without JavaScript (or before bootstrap) the light tokens apply. Any element
with `data-theme` re-themes its subtree (the gallery shows both themes side by
side this way); portaled overlays follow `<html>`.

## Links and routers

Every kit component that renders a link (`NavTab`, `Brand`, `SidebarItem`,
`Button href`, `IconButton href`, `LinkTabs`, `PageHeader back`, `ListRow
href`, `Menu` items with `href`, `AppLink`) renders through one link component
supplied by the app. The default is a plain `<a href>`, which is all hash
routers need (`href="#/events/49"`).

react-router apps provide an adapter once:

```tsx
import { Link } from "react-router";
import { LinkProvider } from "./workbench";
import type { LinkProps } from "./workbench";

function RouterLink({ href, ...rest }: LinkProps) {
  return <Link to={href} {...rest} />;
}

<LinkProvider component={RouterLink}>
  <App />
</LinkProvider>;
```

The kit never computes "active" itself: pass `current` (`NavTab`,
`SidebarItem`, `LinkTabs` items) from your router state; it renders
`aria-current="page"`. Use `external` for off-site links (plain `<a>`,
`target="_blank" rel="noopener noreferrer"`). App-owned elements can reuse the
looks through class names (`wb-nav-tab`, `wb-side-item`, `wb-tab`) or
`buttonClass({ variant, size })`.

## Composing the shell

```tsx
<AppShell
  topBar={
    <TopBar>
      <Brand name="Example App" icon="activity" href="/" />
      <NavTabs>
        <NavTab href="/overview" current={view === "overview"} icon="chart">Overview</NavTab>
        <NavTab href="/activity" current={view === "activity"} icon="list">Activity</NavTab>
      </NavTabs>
      <Spacer />
      <TopSearch onClick={openPalette} placeholder="Search people, models, views…" />
      <TopStatus tone="success" pulse label="Live" detail="Connected" />
      <ThemeMenu mode={mode} onChange={setMode} />
      <IconButton href="/settings" icon="gear" label="Settings" />
    </TopBar>
  }
  sidebar={<Sidebar label="Filters">…</Sidebar>} // omit on settings pages
  sidebarStorageKey="my-app:sidebar-width"
  drawer={openTurn ? <TurnDrawer id={openTurn} /> : null}
>
  <Main toolbar={<Toolbar>…</Toolbar>} refetching={query.isFetching && !!query.data}>
    <List>
      {groups.map((g) => (
        <ListGroup key={g.key} title={g.title} sub={g.sub} count={`${g.items.length} turns`}>
          {g.items.map((t) => <ListRow key={t.id} itemId={t.id} … />)}
        </ListGroup>
      ))}
    </List>
  </Main>
</AppShell>
```

Grid: `topbar` across; `sidebar | main | drawer` below. Only panes scroll
(`.wb-sidebar`, `.wb-scroll`, `.wb-drawer-body`); the document never does.

Sidebar: resizable (drag, ←/→ ±10px, Shift ±40px, Home/End, double-click
resets) and collapsible (`<SidebarToggle/>` in the top bar, or the button on
the 44px rail shown while collapsed). Width and collapsed state persist under
`sidebarStorageKey` and `<key>:collapsed`.

By default, Drawer is 540px (`wide`: 760px), narrowing at ≤1280px (460/640)
and ≤1100px (420/540). While a drawer is open the shell keeps the main pane readable:

- if a minimum-width sidebar would leave the main pane under 480px, the
  sidebar collapses automatically (wide drawers below ~1460px, any drawer
  below ~1160px). This is not persisted; the user can still expand it while
  the drawer is open.
- the sidebar narrows, and the drawer gets a `--wb-drawer-max`, so the main
  pane never drops below 360px (down to 1024px windows).

Opt into a resizable detail pane on the shell:

```tsx
<AppShell
  topBar={topBar}
  sidebar={sidebar}
  drawer={
    selected ? (
      <Drawer title={selected.name} onClose={close}>
        …
      </Drawer>
    ) : null
  }
  drawerResizable
  drawerStorageKey="my-app:drawer-width"
  drawerMin={380}
  drawerMax={900}
  drawerDefault={540}
>
  <Main>…</Main>
</AppShell>
```

The drawer's left separator supports dragging, arrows (10px; Shift: 40px),
Home/End and double-click reset. Escape cancels an active drag without closing
the drawer. Lost pointer capture, viewport changes and pane removal also
cancel the drag. Saved widths survive temporary viewport constraints: fitting
a smaller window does not overwrite the preference. `drawerResizable` uses
the configured width instead of the default/wide presets. Without a storage
key, the preference lasts only for that shell instance.

Applications that own their desktop/mobile shell can use `fitPaneWidths` and
`usePaneResize` directly. `fitPaneWidths({ room, sidebar, drawer })` takes
`room` after reserving the main pane and each pane's
`{ min, max, preferred, shown }`; it returns `{ side, sideMax, drawer, drawerMax }`.
Minimum widths remain authoritative, so the application must collapse or replace
panes when the available room cannot fit them. `usePaneResize(spec, frameRef,
state)` returns `{ separator, dragging, handle }`: `spec` supplies the accessible
`label`, controlled pane ID (`controls`), width CSS property (`cssVar`),
`min`, `max`, and growth direction (`grow: 1 | -1`); `state` supplies
`enabled`, `preferred`, fitted `width`, current `limit`, `save` and `reset`.
Render `separator` inside the positioned pane, set the frame's CSS property
from the fitted width, and keep persistence and responsive layout in the app.

Put `<SidebarToggle />` first in the `TopBar`; `useAppShell()` exposes
`{ hasSidebar, sidebarCollapsed, toggleSidebar, showSidebar, hideSidebar, sidebarId, mainId }`
for custom controls. Optional `[` shortcut — render it inside
`AppShell`, e.g. in the component that renders `Main`:

```tsx
const shell = useAppShell();
useHotkey("[", () => shell?.toggleSidebar(), { enabled: !!shell?.hasSidebar });
```

`showSidebar({ focus? })` and `hideSidebar()` are idempotent: showing a
shown sidebar (or hiding a collapsed one) changes nothing, so "reveal and
search" flows never toggle it closed. `focus` moves focus into the sidebar
once it is visible: `"first"` (its first control) or `(pane) => element`.
Showing also overrides an automatic collapse for an open drawer, like the
rail. A `/` hotkey can fall back to the sidebar search when the page has no
filter in view (a visible `FilterInput` takes `/` first and the fallback
skips handled keys):

```tsx
const shell = useAppShell();
useHotkey(
  "/",
  () =>
    shell?.showSidebar({
      focus: (pane) => pane.querySelector<HTMLElement>("input[type=search]"),
    }),
  { enabled: !!shell?.hasSidebar },
);
```

Skip link: AppShell renders a "Skip to content" link as its first focusable
element (visible only when focused). It moves focus to the `<main>` rendered
by `Main` (`id` = AppShell's `mainId`, default `wb-main`, `tabIndex={-1}`)
without changing the URL, so hash routers are unaffected. Change the text
with `skipLink="…"`, drop it with `skipLink={false}`, or use `<SkipLink
targetId>` outside AppShell.

## Tokens

Surface, border, text, accent, scrim, tone and chart colours, in two themes.
Light on `:root` and `[data-theme="light"]`, dark on `[data-theme="dark"]`.
The contrast requirements that fix the muted text and solid tone values follow
the table.

| Token                                     | Light                         | Dark                          | Use                                        |
| ----------------------------------------- | ----------------------------- | ----------------------------- | ------------------------------------------ |
| `--wb-page`                               | `#f6f6f3`                     | `#0d0d0d`                     | app background, sidebar, tinted main       |
| `--wb-surface`                            | `#fcfcfb`                     | `#1a1a19`                     | main pane, cards, drawer, overlays         |
| `--wb-surface-2`                          | `#f1f0ec`                     | `#232322`                     | hover, segmented track, chips              |
| `--wb-surface-3`                          | `#e8e7e2`                     | `#2e2e2c`                     | inline code, pressed hover                 |
| `--wb-raised`                             | surface                       | surface-3                     | selected segment                           |
| `--wb-border` / `--wb-border-strong`      | 9% / 16% black                | 8% / 15% white                | hairlines / control borders                |
| `--wb-fg` / `--wb-fg-2` / `--wb-muted`    | `#0b0b0b` `#52514e` `#6a6964` | `#f5f5f3` `#c3c2b7` `#97958f` | text, secondary text, tertiary             |
| `--wb-accent`                             | `#2a78d6`                     | `#3987e5`                     | selection, primary, focus, links           |
| `--wb-accent-weak` / `--wb-accent-text`   | 9% accent / `#1c5cab`         | 15% accent / `#86b6ef`        | selected backgrounds / accent text         |
| `--wb-on-accent`                          | `#fff`                        | `#fff`                        | text on accent                             |
| `--wb-scrim`                              | 28%                           | 50%                           | modal backdrop                             |
| `--wb-shadow-pop` / `-drawer` / `-raised` |                               |                               | overlays / drawer edge / selected segment  |
| `--wb-{tone}`                             |                               |                               | solid fill: dots, state pills (white text) |
| `--wb-{tone}-text` / `-weak` / `-border`  |                               |                               | text on weak bg (AA), tinted bg, border    |
| `--wb-s1` … `--wb-s8`                     | categorical                   | categorical                   | chart series                               |
| `--wb-seq-0` … `--wb-seq-5`               | sequential blues              | sequential blues              | heatmaps                                   |
| `--wb-grid` / `--wb-axis` / `--wb-deemph` |                               |                               | chart grid, axis, de-emphasised marks      |

**Contrast.** Muted text and the solid tone fills are chosen to meet WCAG AA
4.5:1 (lowest ratio over the backgrounds each sits on):

| Token          | Light / dark          | Contrast                        |
| -------------- | --------------------- | ------------------------------- |
| `--wb-muted`   | `#6a6964` / `#97958f` | lowest: light 4.6, dark 4.5     |
| `--wb-success` | `#1a7f37` / `#238636` | white text: light 5.1, dark 4.6 |
| `--wb-danger`  | `#cf222e` / `#da3633` | white text: light 5.4, dark 4.6 |
| `--wb-warning` | `#9a6700` / `#9e6a03` | white text: light 4.9, dark 4.7 |

- `--wb-muted` is the lowest-contrast grey that still lets small muted text
  (key/value labels, row meta, hints, counts) meet AA on page, surface,
  surface-2 and selected (accent-weak) backgrounds, plus surface-3 in dark;
  the table shows the lowest of these. A mid grey such as `#898781` gives only
  3.0–3.5:1 on those light backgrounds, and 3.8–4.4:1 on dark surface-2,
  surface-3 and selected rows.
- Solid tone fills carry white text (state pills, danger buttons, error
  toasts), so each must reach 4.5:1 against white. The dark success and
  danger fills are deep solids rather than the bright greens and reds that
  suit text on dark backgrounds (`#3fb950` and `#f85149` give 2.5:1 and
  3.4:1 with white). The light success and danger fills already pass.
- Amber is too light for white text in both themes at the chart's values
  (`#c98500` gives 3.1:1, `#eda100` gives 2.2:1), so `--wb-warning` is a
  deeper amber.

The rest of the tone families (`-text`, `-weak`, `-border`, and `neutral`)
and the dark drawer and raised shadows complete the set. The chart series are
categorical colours, including amber as `--wb-s4`. `tests/tokens.test.ts` pins
the values above and enforces muted and `fg-2` on the backgrounds above,
white text on the solids, and tone text on tone-weak backgrounds.

Tones are `success` (green), `warning` (amber), `danger` (red), `info`
(= accent), `neutral`. Text-on-weak contrast is at least 5.4:1 in both
themes on page and surface (`tests/tokens.test.ts` enforces 4.5:1). White
on solid success/warning/danger/neutral is ≥4.5:1; `info` equals the accent,
whose white-text contrast is 4.4:1 in light and 3.6:1 in dark.

Scales (theme independent):

| Group    | Tokens                                                                                                                                                                                                                                                                                                          |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fonts    | `--wb-font-sans` (Inter Variable…), `--wb-font-mono` (JetBrains Mono…)                                                                                                                                                                                                                                          |
| Type     | `--wb-fs-10-5 11 11-5 12 12-5 13 13-5 14 14-5 15 16 18 20 22 30` (px; body is 14/1.45)                                                                                                                                                                                                                          |
| Leading  | `--wb-lh` 1.45, `--wb-lh-tight` 1.3, `--wb-lh-prose` 1.55                                                                                                                                                                                                                                                       |
| Weights  | `--wb-fw-regular` 400, `-book` 450, `-medium` 500, `-strong` 550, `-semibold` 600, `-bold` 650                                                                                                                                                                                                                  |
| Tracking | `--wb-tracking-caps` .06em (uppercase labels), `--wb-tracking-tight` -.01em (titles)                                                                                                                                                                                                                            |
| Radii    | `--wb-radius-xs` 4, `-sm` 5, `-seg` 6, `-ctl` 7, `-md` 8, `-row` 10, `-card` 12, `-modal` 14, `-pill` 999                                                                                                                                                                                                       |
| Controls | `--wb-ctl-xs` 24, `-sm` 26, `-md` 30, `-lg` 32 (px heights)                                                                                                                                                                                                                                                     |
| Spacing  | `--wb-space-1 2 3 4 5 6 8 12` = 4 8 12 16 20 24 32 48px; `--wb-pane-x` 24px (18px ≤1100px)                                                                                                                                                                                                                      |
| Z-index  | `--wb-z-sticky` 2, `-resize` 3, `-progress` 5, `-overlay` 60 (modals, popovers, menus, listboxes and the palette add `--wb-z-depth`, their position in the open-layer stack, so paint order always matches the Escape order: the newest overlay on top, a child above its parent), `-tooltip` 200, `-toast` 300 |
| Motion   | `--wb-dur-fast` 120ms, `-base` 180ms, `-slow` 400ms (all 0 under reduced motion), `--wb-ease`                                                                                                                                                                                                                   |
| Layout   | `--wb-topbar-h` 52px, `--wb-side-w` 268px, `--wb-drawer-w` 540px, `--wb-drawer-wide-w` 760px, `--wb-page-max` 860px, `--wb-list-max` 1180px                                                                                                                                                                     |

Panes set `--wb-pane-bg` (surface, or page when tinted) so sticky headers
match whatever they scroll over.

## Class inventory

State is expressed with ARIA attributes where one exists (`aria-current`,
`aria-pressed`, `aria-selected`, `aria-expanded`, `aria-invalid`,
`[disabled]`), otherwise with `is-*` classes (`is-active`, `is-cursor`,
`is-stale`, `is-tint`, `is-pending`, `is-selected`, `is-clickable`, `is-dim`,
`is-resizing`, `is-good`/`is-bad`). Variants are `--modifiers`.

- **Frame:** `wb-skip-link`, `wb-app` (`is-resizing`; sets `--wb-side-w`,
  `--wb-drawer-max`), `wb-app-main`, `wb-app-drawer`, `wb-sidebar-pane`
  (`[hidden]` when collapsed), `wb-sidebar-resize`, `wb-sidebar-rail`.
- **Top bar:** `wb-topbar` (compaction attributes `data-wb-brand`,
  `data-wb-search`, `data-wb-status`, `data-wb-nav-icons`, set by TopBar),
  `wb-brand`, `wb-brand-mark`, `wb-brand-name`, `wb-nav` (`data-wb-more`),
  `wb-nav-tab` (`aria-current`; `data-wb-overflow` when moved into More),
  `wb-nav-count`, `wb-nav-more-btn`, `wb-nav-more-dot`, `wb-top-search`,
  `wb-top-search-text`, `wb-top-status`, `wb-top-status-text`,
  `wb-top-status-short`.
- **Sidebar:** `wb-sidebar`, `wb-side-top`, `wb-side-quick` (+ `-btn`,
  `-note`), `wb-side-section`, `wb-side-h` (+ `-title`, `-toggle`, `-note`,
  `-count`, `-action`), `wb-side-body`, `wb-side-item` (+ `-label`, `-count`;
  `aria-current`), `wb-side-row`, `wb-side-row-action`, `wb-side-check` (+
  `-label`, `-count`), `wb-side-empty`, `wb-side-more`.
- **Main:** `wb-main` (`is-tint`), `wb-toolbar`, `wb-toolbar-row`
  (`--split`), `wb-toolbar-primary`, `wb-toolbar-title`, `wb-toolbar-label`, `wb-ctl`, `wb-summary`
  (`--grow`), `wb-scroll` (`is-stale`), `wb-progress` (`is-active`),
  `wb-main-foot`.
- **Entity page:** `wb-page-head`, `wb-page-back`, `wb-page-head-top`,
  `wb-page-title`, `wb-page-actions`, `wb-page-meta`.
- **Lists:** `wb-list` (`--full`), `wb-group` (skips layout off screen
  with `content-visibility`, padded by the rows' 12px outset so their
  hover, active and cursor-ring edges aren't clipped), `wb-group-h` (`--static`;
  parts `wb-group-title`, `-sub`, `-rule`, `-count`, `-actions`), `wb-rows`, `wb-row` (`--noicon`, `--compact`,
  `--static`, `is-cursor`, `is-active`), `wb-row-icon`, `wb-row-main`,
  `wb-row-title`, `wb-row-link`, `wb-row-extra`, `wb-row-meta`,
  `wb-row-desc`, `wb-row-side`, `wb-row-actions`, `wb-list-foot`,
  `wb-list-note`, `wb-new-dot`.
- **Tables:** `wb-table` (`--bleed`, `--compact`, `--grouped`, `--fill-end`),
  `wb-table-card`, `wb-table-wrap`, `wb-th-sort` (+ `-label`; with
  `th[aria-sort]`), group rows `tr.wb-table-group > th[scope=rowgroup]` with
  `wb-table-group-h`, `wb-table-skel`, `wb-table-empty`, `wb-table-alert`
  (in `wb-table-alert-body`), `is-stale`; cells
  `wb-cell-primary`, `wb-cell-strong`, `wb-cell-num`, `wb-cell-center`,
  `wb-cell-mono`, `wb-cell-muted`, `wb-cell-nowrap`, `wb-cell-truncate`,
  `wb-cell-clip` (`--start`), `wb-cell-flow`, `wb-cell-cap`, `wb-cell-hug` (`--start`; in `wb-cell-hugcol`
  cells; `data-wb-tight` on the table),
  `wb-cell-filler` (with `wb-table--fill-end`), `wb-cell-line` with
  `wb-cell-extra`, `wb-cell-fit`, `wb-th-grow`, `wb-cell-actions`,
  `wb-cell-spark`,
  priorities `wb-cell-p2` / `-p3` / `-p4` (`wb-cell-optional` = p3); rows
  `is-cursor`, `is-active` / `is-selected` / `aria-current`, `is-clickable`,
  `is-dim`, `is-new`; `wb-row-actions` inside cells reveal on row
  hover/focus. `wb-list-pager` (+ `-count`, `-status`, `-error`),
  `wb-spark` (+ `-bar` `is-last`/`is-zero`, `-line`, `-area`, `-dot`).
- **Drawer:** `wb-drawer` (`--wide`), `wb-drawer-body`, `wb-drawer-head`,
  `wb-drawer-top`, `wb-drawer-kicker`, `wb-drawer-close`, `wb-drawer-title`,
  `wb-drawer-meta`, `wb-drawer-actions`, `wb-drawer-section` (+ `-title`,
  `-count`, `-action`), `wb-drawer-foot`, `wb-drawer-missing`, `wb-kv`.
- **Tabs:** `wb-tabs`, `wb-tab` (`aria-selected` or `aria-current`),
  `wb-tab-count`, `wb-tabpanel`.
- **Controls:** `wb-btn` (`--primary`, `--ghost`, `--danger`,
  `--danger-ghost`, `--sm`, `--icon`, `is-pending`), `wb-btn-count`,
  `wb-btn-indicator`, `wb-btn-group`,
  `wb-seg` (`--sm`, `--compact`, `--full`), `wb-seg-btn` (`--labelled`;
  `aria-pressed` for buttons,
  `aria-current` for links),
  `wb-seg-count`, `wb-chip-toggle` (`aria-pressed`), `wb-chip-toggle-count`,
  `wb-chip` (`--removable`, `--readonly`), `wb-chip-label`, `wb-chip-remove`,
  `wb-badge` (`--outline`, `--dot`), `wb-state-pill`, `wb-state-cell`
  (`--quiet`; `-dot`, `-label`), `wb-status-dot`
  (`--pulse`), `wb-kbd`, `wb-avatar` (`--md`, `--lg`, `--xl`), `wb-spinner`,
  `wb-icon`, `wb-qname` with `-prefix`, `-prefix-text`, `-name`.
- **Forms:** `wb-field`, `wb-field-label`, `wb-field-optional`,
  `wb-field-hint`, `wb-field-error`, `wb-form-error`, `wb-input` (`--sm`,
  `--mono`, `--num`, `--auto`), `wb-textarea`, `wb-select` (`--block`),
  `wb-checkbox`, `wb-check` (+ `-text`, `-desc`), `wb-switch` (`--sm`:
  26×16 for dense rows and table cells),
  `wb-switch-label`, `wb-form-stack`, `wb-form-row` (see below),
  `wb-range-slider` (+ `-controls`, `-endpoint`, `-label`, `-value`, `-track`,
  `-selection`; legend uses `wb-field-label`),
  `wb-filter`, `wb-filter-input`, `wb-filter-clear`,
  `wb-combo`, `wb-combo-input`, `wb-combo-toggle`, `wb-listbox`,
  `wb-listbox-note`, `wb-option` (`is-active`; `aria-selected`) and its
  parts.
- **Overlays:** `wb-popover` (`--padded`), `wb-menu-item` (`--danger`),
  `wb-menu-check`, `wb-menu-label-text`, `wb-menu-hint`, `wb-menu-sep`,
  `wb-menu-heading`, `wb-scrim`, `wb-modal` (`--sm`, `--lg`) with `-head`,
  `-titles`, `-title`, `-desc`, `-body`, `-foot`, `-foot-note`, `wb-palette`
  with `-head`, `-input`, `-results`, `-section`, `-item`, `-label`,
  `-hint`, `-empty`, `-foot`, `wb-toast-host`, `wb-toast` (`--error`),
  `wb-toast-action`.
- **States:** `wb-empty` (`--compact`) with `-icon`, `-title`, `-text`,
  `-actions`; `wb-skel` (`--tile`, `--card`), `wb-skel-rows`, `wb-skel-row`
  (`--compact`), `wb-skel-block`, `wb-skel-side`; `wb-meter` with `-head`,
  `-value`, `-track`, `-bar`; `wb-banner` (`--slim`) with `-body`, `-title`,
  `-text`, `-actions`, `-dismiss`; `wb-draftbar` (`--neutral`) with `-text`,
  `-actions`.
- **Pages:** `wb-card` (`--wide`) with `-head` (`--center`), `-titles`,
  `-title`, `-sub`, `-actions`; `wb-cards` (2-column grid); `wb-tiles` (4-column grid) and
  `wb-tile` with `-label`, `-row`, `-main`, `-value`, `-unit`, `-delta`
  (`is-good`/`is-bad`), `-vs`, `-spark`; `wb-settings` (`--center`),
  `wb-settings-sec` with `-head`, `-titles`, `-title`, `-desc`, `-body`;
  `wb-settings-row` (`--top`), `wb-settings-label`, `wb-settings-help`,
  `wb-settings-control` (`--stack`), `wb-settings-actions`; `wb-code`
  (`--nowrap`), `wb-code-key`, `wb-copy` (`--multiline`, `--wrap`; `is-copied`,
  `is-manual`) with `-text`, `-actions`, `-status`, `-btn`; `wb-disclosure`,
  `wb-label-caps`.
- **Tones:** `wb-tone-neutral | info | success | warning | danger | muted`
  set `--wb-tone`, `--wb-tone-text`, `--wb-tone-weak`, `--wb-tone-border` on
  the element; badges, pills, dots, banners, meters, row icons, empty-state
  icons and segment icons consume them. `wb-tone-color` colours an element
  with its tone.
- **Utilities:** `wb-sr-only` (inside table cells and list rows it is
  anchored to the cell or row, so hidden text after an ellipsis, such as a
  " on jira" suffix in a row link, never widens the scroll area),
  `wb-spacer`, `wb-muted`, `wb-fg-2`,
  `wb-small`, `wb-mono`, `wb-num` (IDs: mono 12px), `wb-tabular`,
  `wb-truncate`, `wb-truncate-start` (ellipsis at the start, for paths; put
  the text in a `<bdi>`), `wb-sep`, `wb-link` (a button or link styled as
  text; `:disabled` or `aria-disabled="true"` makes it muted, with no hover
  underline), `wb-stack`, `wb-inline`.

**Form layout.** Consecutive `wb-field`s are 14px apart. Anything else
between them (checks, banners, a form error) needs its own spacing, so put a
form in `wb-form-stack`: a column whose 14px gap spaces every child and
replaces the fields' own margins. On a `<fieldset>` (to disable the whole
form) it also drops the fieldset's border and padding. `wb-form-row` puts
fields side by side, sharing the width and wrapping below 200px each. Fields
align at the top, so an error under one doesn't move its neighbours; other
children, such as a submit button, align with the bottom: the inputs' line
when the fields have no hint.

```tsx
<fieldset className="wb-form-stack" disabled={saving}>
  <Field label="Name">
    <Input value={name} onChange={onName} />
  </Field>
  <div className="wb-form-row">
    <Field label="Requests">
      <Input numeric value={requests} onChange={onRequests} />
    </Field>
    <Field label="Window">
      <Input mono value={period} onChange={onPeriod} />
    </Field>
  </div>
  <Checkbox label="Notify the owner" checked={notify} onChange={onNotify} />
</fieldset>
```

## Components

Props marked `?` are optional. All optional props accept `undefined`
(friendly to `exactOptionalPropertyTypes`). Components forward `className`
where it makes sense.

### Shell

- `AppShell({ topBar, sidebar?, sidebarStorageKey?, sidebarMin? = 220, sidebarMax? = 480, sidebarDefault? = 268, drawer?, drawerResizable? = false, drawerStorageKey?, drawerMin? = 380, drawerMax? = 900, drawerDefault? = 540, mainId? = "wb-main", skipLink? = "Skip to content" | false, children })`,
  `SidebarToggle()`, `useAppShell()`, `SkipLink({ targetId?, children? })`.
- `TopBar({ children })`, `Brand({ name, icon? = "pulse", href? })`,
  `NavTabs({ label? = "Main", moreLabel? = "More", children })`,
  `NavTab({ href, current?, icon?, count?, countTone?, countLabel?, children })`,
  `TopSearch({ onClick, placeholder?, shortcut? })` (shows `⌘K`/`Ctrl K`),
  `TopStatus({ label, shortLabel?, tone?, detail?, pulse?, icon?, href?, onClick? })`
  (a link through `LinkProvider` with `href`, e.g. to the sync settings; a
  button with only `onClick`; otherwise plain text),
  `ThemeMenu({ mode, onChange, label? })`.

  **Crowded bars never clip silently.** TopBar measures its content (on
  resize, web-font loads, re-renders and content changes inside the bar) and, while anything is clipped, applies
  these steps in order: TopSearch's placeholder shrinks (down to 170px);
  the brand name is visually hidden (still the link's name); TopSearch
  becomes its icon button; TopStatus shows `shortLabel` (or only its dot,
  the full label stays for screen readers and `detail` in the tooltip);
  NavTab icons go. If tabs still don't fit, the last ones (never the current
  tab) move into a "More" menu at the end of NavTabs, which shows a dot when a
  moved tab has a count badge. This needs NavTab children directly in
  NavTabs. Apps don't need their own brand/status hiding rules.

- `Sidebar({ label, children })`, `SidebarTop`, `SidebarQuick({ note? })`,
  `SidebarSection({ title, note?, action?: { label, icon?, text?, onClick }, collapsible?, open?, defaultOpen?, onOpenChange?, activeCount?, lazy? })`
  (`lazy`: children mount when the section is first opened, so pickers in
  collapsed groups don't fetch early, and then stay mounted),
  `SidebarItem({ label, icon?, iconTone?, count?, current?, href? | onClick?, action?, trailing? })`,
  `SidebarCheck({ label, checked, onChange, count?, icon?, iconTone?, disabled? })`
  (the whole row toggles; the count describes rather than names it),
  `SidebarEmpty`, `SidebarMore({ expanded, onToggle })`.
- `Main({ toolbar?, header?, footer?, refetching?, stale? = refetching, tint?, label?, id?, scrollRef? })`
  (`<main tabIndex={-1}>`, the skip link's target; `id` defaults to the
  shell's `mainId`),
  `Toolbar`, `ToolbarRow({ primary? })`, `ToolbarTitle` (h1 for
  settings-style pages), `ToolbarSummary({ grow? })`, `Ctl({ label })`,
  `Spacer`.
- `ToolbarRow`'s `primary` is the page's main action ("New grant"), kept at
  the end of the row. When the controls don't fit on one line (a drawer is
  open, a small window, a crowded toolbar at 1280), the row splits: the
  first control and `primary` share line 1 and the other controls move to
  line 2, which packs tighter (a filter takes the room left, 120–290px;
  selects and the summary shrink), so the action never wraps alone and a
  third line appears only when even that can't fit. The split is measured,
  not breakpoint-driven: the row tries one line and splits exactly when it
  would wrap, re-checking on resize, content changes and font loading
  (`data-wb-split` on the row). Put the status `Seg` first where the
  toolbar has one (Seg + primary fit on one line at main 552px), otherwise
  the FilterInput.
- `PageHeader({ title, back?: { href, label }, meta?, actions?, children? /* tabs */ })`.

```tsx
<Toolbar>
  <ToolbarRow
    primary={
      <Button variant="primary" icon="plus" onClick={issue}>
        Issue token
      </Button>
    }
  >
    <Seg
      label="Status"
      value={status}
      onChange={setStatus}
      options={[
        {
          value: "active",
          label: "Active",
          icon: "circle-check",
          tone: "success",
          count: 12,
        },
        { value: "revoked", label: "Revoked", count: 3 },
      ]}
    />
    <ToolbarSummary grow>
      <b>12</b> active tokens · 4 services
    </ToolbarSummary>
  </ToolbarRow>
  <ToolbarRow>
    <FilterInput
      value={q}
      onChange={setQ}
      placeholder="Filter tokens…"
      debounceMs={200}
    />
  </ToolbarRow>
</Toolbar>
```

### Lists and tables

- `List({ full? })`, `ListGroup({ title, sub?, count?, actions?, sticky? })`
  (sticky header), `GroupHeader({ title, sub?, count?, actions?, as?, sticky? = true })`,
  `Rows({ label? })`, `ListFooter({ hints? })`, `ListNote`. The header wraps
  when its `actions` (buttons such as "Issue token") don't fit; a sticky
  header publishes its height (`--wb-group-h` on its parent) so j/k
  scrolls rows clear of it however many lines it takes. As a section
  title above a `DataTable`, use `sticky={false}`: the table's own header
  sticks, and two sticky layers would overlap.
- `ListRow({ itemId?, title, href? | onOpen?, icon?, iconTone?, titleExtra?, meta?, description?, side?, actions?, cursor?, active?, compact?, children? })`.
  The title is the row's link/button; its hit area stretches over the row, so
  the whole row is clickable, middle-click works with `href`, and it is
  reachable with Tab. Other controls in the row stay clickable. `active`
  (open in the drawer) sets `aria-current="true"`. In `compact` rows the
  meta gives way first, then the title; `titleExtra` badges never clip.
- `useListCursor({ ids, activeId?, onOpen, onFollow?, onExternal?, resetKey?, enabled?, rootRef? })`
  → `{ cursorId, setCursorId, isCursor }`. `j`/`k` move (and scroll the row
  into view), `Enter` opens, `o` calls `onExternal`. While an item is open
  (`activeId`), moving calls `onFollow` (default `onOpen`) so the drawer
  follows. If a row's link/button has focus (e.g. a closed drawer returned it
  there), focus moves with the cursor, so Enter opens the highlighted row. Ignored while typing, with modifiers, or while a blocking layer is
  open. `findRow(id)` / `findRowTarget(id)` locate a row for focus return.
- `ListPager({ shown, total?, noun?, hasMore?, onLoadMore?, loadingMore?, loadMoreLabel?, error?, onRetry?, updating?, disabled? })`
  — footer under a paged list or table: "50 of 1,284
  grants", a "Load more grants" button, `error` (true for "Couldn’t load
  more grants. The loaded grants are still shown." with Retry, or your own
  text) and an "Updating…" status for background refreshes. `noun` is a
  word or `[one, many]`. `disabled` keeps Load more (and Retry) visible but
  unusable, e.g. while a filter change loads a new result set
  (`disabled={isFetching && !isFetchingNextPage}`).

#### Tables

`DataTable` is a controlled, router-agnostic record table. Sorting,
filtering, URL state, comparators and fetching stay in the app; the table
renders them and owns the interaction:

- `DataTable({ label, rows, rowId, columns, sort?, onSortChange?, groupBy?, groupHeader?, activeId?, rowHref?, onRowOpen?, onRowFollow?, onRowExternal?, cursor?, cursorResetKey?, onCursorChange?, loading?, skeletonRows?, empty?, error?, rowClassName?, rowDim?, compact?, bleed?, fill? = "spread" | "end", className? })`
- columns: `{ key, header, cell(row), sortable?, firstSortDir?, align? = "start" | "center" | "end", priority? = 1 | 2 | 3 | 4, primary?, truncate? = true | "start", wrap?, fit?, grow?, hug? = true | length, width?, minWidth?, maxWidth?, title?(row), extra?(row), hideWhenEmpty? = true | (row) => boolean, className? }`.
- **Widths:** columns with a `width` keep it; every other column either
  hugs its content (`fit`, `width: 1%`: states, IDs, dates, counts) or
  grows. Growing columns split the spare width by `grow` weight, not by
  text length: default 2 for the primary column, 1 for truncating and
  wrapping columns, 0 for the rest, so a long Description doesn't squeeze
  the name and a three-row table at 1440px doesn't spread every column.
  Weights are relative (0.2:0.1 is 2:1). `grow: 0` never takes spare
  width (a truncating or wrapping column then sits at its minimum);
  `fit: false` lets a plain column share leftovers. Growing columns carry a
  header sizer (10000px of max-content for the smallest weight,
  proportionally more for larger ones; cell content counts up to 5000px),
  so put tables in block, `1fr` or `flex: 1` containers, not shrink-to-fit
  ones (inline-block, `auto` grid tracks).
- **Capped values:** `maxWidth` ("hug up to N") shows short values in full
  and ends long ones (UUIDs) in an ellipsis at the cap (with `wrap`, the
  text wraps within the cap instead). Capped cells get the cell text as
  their `title` (full value on hover) when the cell renders a string or
  number; `title(row)` overrides it and works on any column.
- **`hug` vs `grow`:** titles grow (the primary name takes spare width by
  default); identifiers hug. `hug` (true = 32ch, or a length / px) is
  `fit` + `grow: 0` + `maxWidth` in one: use it for grant IDs, action
  names, token names, UUIDs, emails. A hug column shows the full value up
  to its cap and never takes spare width. When the table's full values
  would overflow its container (a drawer open at 1024px), the table goes
  tight (`data-wb-tight`, measured on resize, content changes and font
  loading): hug columns shrink with an ellipsis down to `min(10ch, cap)`
  (or their `minWidth`, which also holds when the table isn't tight), in
  proportion with truncating columns, and the title keeps the full value.
  The check re-runs when `rows`, `columns` or the table's props change,
  so pass stable (memoized) `columns` to skip it on unrelated re-renders. With `truncate: "start"` the ellipsis goes
  at the start (paths).
- **Fill:** by default spare width is shared by the growing columns (or,
  if none grow, by all). `fill="end"` adds an empty, `aria-hidden` filler
  column after the last one that takes spare width no column wants, so a
  table of hugging columns stays packed to the left on wide panes while
  row lines still run the full width. The filler has no highlight, no
  ring (its right edge stays on the last real column) and doesn't open the
  row; group, empty, error and skeleton rows span it. Growing columns
  still come first, so give the name column `hug` (or `grow: 0`) for a
  packed table.
- **Empty columns:** `hideWhenEmpty` leaves a column out (header and
  cells) when every row is empty: the cell renders null, undefined, "" or
  false (0 and elements count as content), or the predicate says empty
  for every row. It is judged on `rows` only; with no rows every column
  stays, so headers don't jump for empty or filtered results. The primary
  column never hides.
- **Extras:** `extra(row)` renders after the cell content; on the primary
  column it sits beside the row link (badges such as "inherited") without
  joining the link's accessible name, and the name truncates first.
- **Primary column** (`primary`, default the first) is the row header
  (`<th scope="row">`) and holds the row link: `rowHref(row)` renders it
  through `LinkProvider` (router navigation, middle/Ctrl/⌘-click open a
  tab), `onRowOpen` alone renders a button. The open row (`activeId`) gets
  `is-active` and `aria-current="true"` on its link.
- **Row click:** a plain click anywhere on the row opens it (through the
  link when there is one). Clicks on controls in cells (buttons, links,
  inputs, switches, menu items of any kind, comboboxes, sliders,
  `[data-wb-no-row-open]`), modified or
  middle clicks, and clicks that end a text selection are left alone.
- **Cursor:** `j`/`k` move, Enter opens, `o` calls `onRowExternal`; with a
  row open, moving calls `onRowFollow` (default: open), so a drawer follows.
  Focus follows the cursor once a row link has focus (e.g. returned by a
  closed drawer: `returnFocus={() => findRowTarget(id)}`). On by default when
  rows open; `cursor={false}` for secondary tables (one cursor per view).
  `cursorResetKey` clears it when filters or sort change; `onCursorChange`
  reports the cursor row.
- **Sorting:** `sortable` headers are buttons cycling unsorted →
  `firstSortDir` (default `"asc"`; use `"desc"` for counts and dates) → the
  other → unsorted; only the sorted column carries `aria-sort`. Sort `rows`
  yourself from `sort`.
- **Groups:** `groupBy(row)` groups consecutive rows (sort by group first):
  each group is a `<tbody>` whose first row is a sticky
  `<th scope="rowgroup">` below the sticky header. `groupHeader({ key, rows })`
  customises it; `TableGroupHeader({ title, sub?, count? })` matches
  `ListGroup`.
- **Priorities:** columns with `priority` 2, 3, 4 hide when the main pane is
  at most 520, 700, 940px wide (container query on `Main`, so an open drawer
  or sidebar counts; `wb-cell-optional` = p3). The primary column never
  hides; the row ring follows the first and last visible columns. In short:
  p4 needs a roomy pane (no drawer, 1280+ or a collapsed sidebar), p3
  survives a 1024px window with the sidebar, p2 survives a default drawer.
  Main widths with the default 268px sidebar (44px rail when collapsed;
  drawers 540/760, 460/640 at ≤1280, 420/540 at ≤1100, and the sidebar
  collapses automatically when a drawer would leave main under 480):

  | Window | Sidebar   | Drawer  | Main | Visible |
  | ------ | --------- | ------- | ---- | ------- |
  | 1024   | expanded  | —       | 756  | p1–p3   |
  | 1024   | collapsed | —       | 980  | all     |
  | 1024   | auto      | default | 560  | p1–p2   |
  | 1024   | auto      | wide    | 440  | p1      |
  | 1280   | expanded  | —       | 1012 | all     |
  | 1280   | expanded  | default | 552  | p1–p2   |
  | 1280   | collapsed | default | 776  | p1–p3   |
  | 1280   | auto      | wide    | 596  | p1–p2   |
  | 1440   | expanded  | —       | 1172 | all     |
  | 1440   | expanded  | default | 632  | p1–p2   |
  | 1440   | collapsed | default | 856  | p1–p3   |
  | 1440   | auto      | wide    | 636  | p1–p2   |
  | 1920   | expanded  | default | 1112 | all     |

  The thresholds sit at least ~30px from these widths, so a slightly wider
  sidebar doesn't flip a column.

- **One-line cells:** cells don't wrap (`wrap: true` opts a column out).
  `truncate` columns size to their content but give way first when space
  runs out, ending in an ellipsis; `"start"` keeps the end visible (paths).
  They keep a legible minimum (`minWidth`, default `10ch`; any CSS length or
  px, `0` for none), so several truncating columns in a narrow pane don't
  collapse to "p…".
- **States:** `loading` with no rows shows skeleton rows (same columns,
  `aria-hidden`) and a "Loading {label}…" status; with rows (refetch) rows
  stay and the table is `aria-busy`. With no rows, `error` or `empty`
  (EmptyState/ErrorState) fills a full-width row. With rows shown (a failed
  refetch or secondary read), `error` becomes a slim alert row above them:
  an `<ErrorState compact … onRetry>` renders as a one-line danger banner
  that keeps its Retry and `role="alert"` (plain text becomes a danger
  `Banner`), and the rows stay visible, dimmed as stale (`is-stale` on the
  table) until the error clears. Keep passing `loading` while retrying so
  the table is `aria-busy`.
- **Live rows:** keep row ids stable and update rows in place; pass
  `rowClassName={(r) => fresh.has(r.id) ? "is-new" : undefined}` for the
  arrival highlight. To avoid shifting rows under the user, hold new rows
  while `onCursorChange` reports a cursor row, a drawer is open or focus is
  in the table, and offer "N new · Show" outside the table.
- `rowDim(row)` fades disabled rows; `compact` is a denser table
  (padding and font size only; headers keep the uppercase labels); `bleed` aligns cell text with the pane edge (inside `List full`).

```tsx
<List full>
  <DataTable
    label="Grants"
    rows={rows} // filtered, sorted by service then by `sort`
    rowId={(g) => g.id}
    columns={[
      {
        key: "name",
        header: "Grant",
        sortable: true,
        truncate: true,
        cell: (g) => g.name,
      },
      {
        key: "subject",
        header: "Subject",
        priority: 2,
        truncate: true,
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
        key: "status",
        header: "Status",
        cell: (g) => (
          <Badge variant="dot" tone={g.on ? "success" : "muted"}>
            {g.on ? "Active" : "Disabled"}
          </Badge>
        ),
      },
    ]}
    sort={sort}
    onSortChange={setSort}
    groupBy={(g) => g.service}
    activeId={openId}
    rowHref={(g) => `?item=${g.id}`}
    onRowFollow={(g) => setSearch({ item: g.id }, { replace: true })}
    cursorResetKey={filtersKey}
    rowDim={(g) => !g.on}
    loading={query.isPending}
    empty={<EmptyState compact title="No grants match" />}
    error={
      query.error ? (
        <ErrorState compact error={query.error} onRetry={query.refetch} />
      ) : undefined
    }
    bleed
  />
  <ListPager
    shown={rows.length}
    total={total}
    noun="grant"
    hasMore={!!next}
    onLoadMore={fetchNext}
    loadingMore={isFetchingNext}
    error={pageError}
  />
</List>
```

Cells: `Sparkline({ values, label, variant? = "bars" | "line", width?, height? })`
(one labelled image; the latest value is accented; put it in a column with
`className: "wb-cell-spark"`), `TruncateStart({ children, title? })` (start
ellipsis outside tables), `QualifiedName({ name, prefix?, separator? = "/", title? })`
(a muted `owner/` before a name: in a narrow cell the prefix gives way first,
"octo…/atlas", and the name stays whole until it alone doesn't fit;
`title` defaults to the full text), inline `Switch`/`IconButton`/`Menu`
(they never open the row).

Plain markup works too: `<table className="wb-table">` with `thead th`
column headers, `SortHeader({ label, sortKey, sort, onSortChange, firstDir?, align?, style? })`,
`TableGroupHeader`, `TableSkeletonRows({ columns, rows?, cellClassNames? })`
and `TableEmpty({ colSpan })`. The ring for a cursor row is `tr.is-cursor`;
the focus ring shows when the row's `.wb-row-link` has keyboard focus (row
links stay inside their cell). Only `thead th` get header styling; `th` in
`tbody` are row headers. `wb-cell-truncate` on a `td` gives a one-line cell
that takes only the width you give it (a percentage); `<div
class="wb-cell-clip"><span>…</span></div>` inside a cell is the
content-sized version DataTable uses. Boxed tables go in `.wb-table-card`
(`overflow: clip`, so the header still sticks to the pane). As a last
resort for tables that can't fit, wrap in
`<div className="wb-table-wrap" tabIndex={0} role="region" aria-label="…">`
(scrolls horizontally; the header then sticks within the wrapper only).

```tsx
const cursor = useListCursor({
  ids,
  activeId: openId,
  onOpen: (id) => setSearch({ item: id }),
  onFollow: (id) => setSearch({ item: id }, { replace: true }),
  resetKey: filtersKey,
});
<ListRow
  itemId={t.id}
  href={`?item=${t.id}`}
  icon="key"
  iconTone="success"
  title={t.name}
  titleExtra={<Badge tone="warning">Expires soon</Badge>}
  meta={
    <>
      <span className="wb-num">{t.id}</span>
      <span className="wb-sep">·</span>github, jira
    </>
  }
  description={t.note}
  side={<Time value={t.lastUsed} />}
  actions={
    <IconButton icon="copy" label={`Copy ${t.name}`} size="sm" onClick={copy} />
  }
  cursor={cursor.cursorId === t.id}
  active={openId === t.id}
/>;
```

### Drawer

- `Drawer({ title, onClose, ref?, label?, kicker?, meta?, actions?, headerExtra?, footer?, size? = "default" | "wide", resetKey?, returnFocus?, autoFocus? = true, children })`
- `DrawerSection({ title, count?, action? })`, `KeyValue({ items, labelWidth? })`
  (falsy items are skipped).

Render it in `AppShell`'s `drawer` slot. It is non-modal (`<aside>`), closes
on Esc (layer stack) and ×, moves focus into itself when it mounts, and on
close returns focus to `returnFocus()` (e.g. `() => findRowTarget(id)`) or
the element that had focus when it opened. Keep one mounted drawer while j/k
switch items and pass `resetKey={id}` (scrolls to top). Put `<Tabs>` as the
first child for drawer tabs. `ref` exposes the `<aside>` for application-owned
responsive focus behavior. Set `autoFocus={false}` when opening a desktop detail
pane should leave focus in the list; the app can explicitly focus that ref for
its compact layout.

### Navigation and controls

- `Tabs({ label, value, onChange, items: { value, label, icon?, count?, disabled? }[], children?, id? })`
  — ARIA tablist with arrows/Home/End; `children` render in the wired
  tabpanel. For a panel rendered elsewhere (tabs in `Main`'s fixed `header`,
  content in the scroll region) use `detached` with an `id`, and
  `TabPanel({ tabsId, value })` where the content goes:

  ```tsx
  <Main
    header={
      <Tabs
        detached
        id="overview"
        label="Overview"
        value={tab}
        onChange={setTab}
        items={items}
      />
    }
  >
    <TabPanel tabsId="overview" value={tab}>
      …
    </TabPanel>
  </Main>
  ```

  `tabId(tabsId, value)` and `tabPanelId(tabsId, value)` return the ids if
  you wire panels yourself.

- `LinkTabs({ label, items: { href, label, current, icon?, count? }[] })`
  — same look, navigation links for URL-driven tabs (full entity pages).
- `Seg({ label, value, onChange, options: { value, label, icon?, tone?, count?, title?, disabled? }[], size?, density? = "default" | "compact", full? })`
  — `role="group"` of `aria-pressed` buttons. `density="compact"` tightens
  the segments and hides icons on segments that have a label (labels,
  counts and accessible names stay); a Seg in the main pane does this on
  its own when the pane is at most 700px, so a five-option status filter
  with counts fits a toolbar next to a drawer. `SegLinks` takes the same
  `density`. Icon-only segments: `iconOnly: true` (the `label` becomes
  screen-reader-only text and the icon always stays).
- `SegLinks({ label, items: { href, label, current, icon?, tone?, count?, title? }[], size?, full? })`
  — the segmented look for navigation (e.g. a top-bar space switch
  "Admin | My access"): a `<nav>` of links through `LinkProvider`,
  `aria-current="page"` on the current one.
- `ChipToggle({ pressed, onPressedChange, icon?, count? })`,
  `Chip({ children, icon?, onRemove?, removeLabel?, readOnly? })`,
  `Badge({ tone?, variant? = "soft" | "outline" | "dot", icon? })`,
  `StatePill({ tone, icon? })`, `StatusDot({ tone?, label?, pulse? })`,
  `StateCell({ label, tone?, quiet?, title? })` (a state in a table cell:
  `quiet` for the normal state is a dot whose label is announced and shown
  as a tooltip, so exceptions such as "Revoked" or "Expires in 3d", shown
  as dot + label, stand out),
  `Kbd`, `Avatar({ name, size?, highlight? })`, `Spinner({ label? })`.
- `Button({ variant?, size?, icon?, iconRight?, pending?, count?, href?, external?, disabled? })`
  — `pending` shows a spinner, sets `aria-busy` and ignores clicks without
  losing focus; `count` adds a count pill ("Export 34"). `IconButton({ icon, label, variant? = "ghost", size?, href?, indicator? })`
  — `label` is required (accessible name and tooltip). `indicator` adds a
  small accent dot in the corner, e.g. while the filter behind the button
  narrows the list. The dot is decorative (`aria-hidden`): say what is
  active in the label yourself: ``label={`Visibility: ${current}`}``.
- `Icon({ name, title?, size? })` — 16px stroke icons; `iconNames` lists them
  (pull request and issue states, merge, commit, fork, branch, tag, star, pin,
  diff, comment, gear, user(s), shield(-check), key, lock/unlock, search,
  x, check, chevrons, plus/minus, trash, pencil, copy, external, refresh,
  pause, play, filter, sun, moon, monitor, log-out, list, calendar, clock,
  alert(-circle), info, help, eye(-off), more, grip, arrows, database, server,
  activity, trending-up, file(-text), code, braces, sidebar, command, home,
  link, download, upload, globe, zap, bell, history, flask, inbox, package, table,
  ban, circle-check, circle-x…).

### Forms

- `RangeSlider({ label, value: [lower, upper], onChange, min, max, step? = 1, minLabel? = "Minimum", maxLabel? = "Maximum", formatValue? = String, disabled?, className? })`
  is a controlled range with two separately labelled native sliders. Its
  visible legend names the group; each visible endpoint label names its own
  control. `formatValue` supplies visible values and `aria-valuetext`, including
  units or named boundaries. Endpoints cannot cross: each slider's native
  bounds leave at least one step between them. Both rails retain the full
  value scale and show the selected interval; moving one endpoint does not
  move the other thumb. The native input's geometry accounts for thumb width,
  including intervals with only one available value. It shares the kit's
  field spacing and form-row sizing. Tab moves between endpoints;
  arrows, Home, End, and platform range keys retain native browser behavior.
  Values and bounds must be finite, on the `min`/`step` grid, with positive
  `step` and `min <= lower < upper <= max`, separated by at least one step.
  Invalid bounds or ordering throw `RangeError`. Use integer indices for named
  bands, mapping the endpoints to labels in `formatValue`; the component does
  not assign inclusive/exclusive semantics. It has no internal value state.
  `#/components` demonstrates editable and disabled ranges in both themes.

- `Field({ label, hint?, error?, optional?, id? })` wires `id`,
  `aria-describedby` and `aria-invalid` into the control inside.
- `Input({ inputSize?, mono?, numeric? })`, `Textarea({ mono? })`,
  `Select({ options? | children, block?, inputSize? })` (styled native),
  `Checkbox({ label?, description?, indeterminate? })` (the label names it;
  the description is wired with `aria-describedby`, outside the label),
  `Switch({ label?, size? = "default" | "sm" })` (`role="switch"`; `sm`
  for dense rows, toolbars and table cells).
- `FilterInput({ value, onChange, placeholder, label?, hotkey? = "/", debounceMs? })`
  — search icon, `/` hint that focuses it from anywhere (give secondary
  filters `hotkey={null}`), × clears, Esc clears (then blurs when empty).
- `Combobox` — single: `{ value: string | null, onChange }`; multiple:
  `{ multiple: true, value: string[], onChange }`. Plus `options?`,
  `loadOptions?(query, signal)` (async, debounced, aborted), `minQuery?`,
  `allowCustom?` (free text, e.g. emails or filters), `customOptionLabel?(text)`
  (default `Add “x”`), `customOptionIcon?` (default `plus`), `commitOnBlur?`,
  `matchCase?`,
  `getLabel?`, `placeholder?`, `aria-label?`; with `multiple`, token entry:
  `separators?`, `parse?(text)`.
  - **Enter** selects the highlighted option. While typing, the highlight
    goes to the option whose label or value equals the text (so
    "tokens.issue" picks `tokens.issue`, not `admin.tokens.issue`), else to
    the first option. With `allowCustom` and no exact match, the free text
    is listed first, so Enter keeps what was typed.
  - **Case:** filtering and highlighting ignore case. What counts as an
    exact match for committing depends on the mode. With `allowCustom`
    (and with `matchCase`) it is case-sensitive: typed text is never
    re-cased into an option (`modela` stays `modela` next to an option
    `ModelA`), and the default highlight is only ever the exact option or
    the free text; any other option needs ↑/↓ before Enter picks it.
    Pick-from-list comboboxes (no `allowCustom`, no `matchCase`) highlight
    the first match, and accept a unique case-insensitive exact match,
    committing the canonical option. `matchCase` makes filtering and
    highlighting case-sensitive too. ↑/↓ (and the pointer)
    move the highlight; while the list is open Home/End and PageUp/PageDown
    jump (first/last, ±10) instead of moving the caret. With the list
    closed (after Esc), Enter confirms what was typed: the option it names
    exactly, or the text with `allowCustom`. While the list is open or text
    is pending, Enter never submits the surrounding form; otherwise it does.
  - **Blur/Tab** discards typed text, except with `commitOnBlur` (default
    on for `multiple` + `allowCustom`): then an exact match, or the text
    itself with `allowCustom`, is committed, and erasing a single value's
    text clears it. For free-text filter fields use
    ``allowCustom commitOnBlur customOptionLabel={(t) => `Filter by “${t}”`}``.
  - Typed text never selects a disabled option (no free-text entry is
    offered for it either). Async results are only shown and selectable for
    the query they were loaded for. Clearing a single value (×) also
    discards pending text.
  - Esc closes, then clears the text; Backspace on empty text removes the
    last chip (or clears a single value).
  - **Token entry** (`multiple`, opt-in, for lists of free values with
    `allowCustom`): typing one of `separators` (e.g. `[",", " "]`) commits
    the typed text (the separator is never typed), and a pasted text that
    contains one, or a line break or tab, becomes several values at once;
    a single value pastes as text. `parse(text)` splits and normalizes free
    text into values (default: split on the separators, line breaks and
    tabs, trim, drop empty parts); it also applies to Enter and blur, and
    returning `[]` rejects the text, which stays in the field. Values
    already chosen are skipped; parts that stand for nothing (no option
    without `allowCustom`) stay as the text. A separator commits what was
    typed, like leaving the field; Enter still picks the highlighted
    option, and Backspace still removes the last chip.

```tsx
<Field label="Principals" hint="Type to search">
  <Combobox
    multiple
    value={ids}
    onChange={setIds}
    loadOptions={searchPrincipals}
    minQuery={1}
  />
</Field>
<Field label="Notify" hint="Comma, space or paste a list">
  <Combobox
    multiple
    allowCustom
    separators={[",", " "]}
    parse={(text) =>
      text
        .split(/[\s,;]+/)
        .map((s) => s.toLowerCase())
        .filter((s) => s.includes("@"))
    }
    value={emails}
    onChange={setEmails}
  />
</Field>
```

### Overlays

- `Popover({ open, onClose, anchorRef, placement?, label?, padded?, initialFocus? })`
  — fixed position, clamped to the viewport, closes on outside click, Esc and
  focus leaving; returns focus to the anchor. `initialFocus` is `"first"`
  (default), `"container"`, `"none"`, a ref, or `(popover) => element`; it
  is applied once the popover is positioned. Tab past the last control
  closes it and continues after the anchor; Shift+Tab from the first returns
  to the anchor.
- `Menu({ label, items, trigger, placement? })` — `trigger(props)` renders
  the button (spread `props`); items `{ id, label, icon?, hint?, onSelect?, href?, external?, danger?, disabled?, checked? }`,
  `{ type: "separator" }`, `{ type: "heading", label, sub? }`. Arrow keys,
  Home/End, type-ahead, Esc/Tab close.

```tsx
<Menu
  label="Account"
  items={[{ id: "out", label: "Sign out", icon: "log-out", onSelect: signOut }]}
  trigger={(props) => <IconButton {...props} icon="user" label="Account" />}
/>
```

- `Modal({ open, onClose, title, description?, size? = "sm" | "md" | "lg", footer?, footerNote?, headerExtra?, onSubmit?, dismissible?, closeOnScrim?, initialFocusRef?, role? = "dialog" | "alertdialog" })`
  — scrim, focus trap, sticky header/footer, scrolling body; `onSubmit`
  renders a `<form>` so submit buttons work.
- `ConfirmDialog({ open, onClose, title, children, confirmLabel?, cancelLabel?, tone? = "danger", onConfirm })`
  — the one confirmation pattern. `onConfirm` may return a promise: pending
  state, closes on success, shows the error message on failure. Danger
  focuses Cancel first. Renders `role="alertdialog"` described by its
  message (the ARIA confirmation pattern).
- `ConfirmProvider` + `useConfirm()` → `confirm({ title, body?, confirmLabel?, cancelLabel?, tone?, action? })`
  returns `Promise<boolean>`: the same ConfirmDialog, opened from an event
  handler without dialog state in the caller. `action` runs on confirm; the
  dialog stays pending (not dismissible) until it settles and shows its
  error if it throws, so the user can retry or cancel. The promise resolves
  `true` once confirmed (after `action` succeeded) and `false` when
  cancelled, after the dialog has closed and returned focus, so a
  follow-up (navigation, focus) has the last word. Requests made while a
  dialog is open wait their turn. Put the provider once near the root
  (inside `LinkProvider`/`ToastProvider` if actions use them); without one
  `confirm()` rejects.

```tsx
const confirm = useConfirm();
const remove = async () => {
  const removed = await confirm({
    title: `Remove ${repo.name}?`,
    body: "Its synced data leaves this dashboard. Nothing changes at the source.",
    confirmLabel: "Remove",
    action: () => api.removeRepo(repo.id), // pending until it settles
  });
  if (removed) navigate("/repos");
};
```

- `CommandPalette({ open, onClose, sources, placeholder?, emptyText?, debounceMs?, query?, onQueryChange?, step? })`
  with sources `{ id, title, items?: PaletteItem[] | (query) => PaletteItem[], search?(query, signal), minQuery?, limit?, showWhenEmpty?, loading?, error?, onRetry? }`
  and items `{ id, label, icon?, hint?, keywords?, renderLabel?, keepOpen?, onSelect }`.
  Static items match every query word across their label and explicit keywords.
  Ranking favors exact labels, prefixes, phrases, then scattered label words and
  keyword matches, keeping source order for ties. Punctuation is literal; each
  matched word is highlighted. A long hint truncates before the label does.
  A function-valued `items(query)` returns already filtered and ranked rows.
- Async `search` is debounced (160ms by default) and receives an AbortSignal.
  Old-query and old-step results are excluded, even when a source ignores abort.
  Source IDs identify searches; use distinct IDs for distinct data sources.
  `minQuery` defaults to 1; set 0 to search on an empty query. `limit` defaults
  to 6 with a query, 5 without; Show all expands a section instead of silently
  dropping results. Expansion resets when the query or step changes.
- Loading/error feedback and Retry appear per source; retrying a remote source
  does not restart successful siblings. External query hooks can supply
  `loading`, `error` (a user-facing string), and `onRetry`, alongside cached
  `items`. The app owns which cached rows are valid for its current query.
  Retry and Show all keep typing focus in the input. Feedback is announced
  through a live region.
- `renderLabel(query)` supplies rich, **non-interactive** label content;
  `label` remains the searchable and accessible text. `icon` accepts an icon
  name or React element; `hint` accepts React content. `paletteMatchScore`,
  `filterPaletteItems`, and `paletteHighlight` are exported for application
  source assembly and rich label highlighting.
- The palette owns the query by default. For drill-down, pass controlled
  `query`/`onQueryChange` and `step: { id, title, onBack, backLabel? }` while
  nested. The app owns its step stack and clears/restores the query when
  navigating. Include the selected entity in `step.id` to isolate async
  results between, for example, two repositories' branch lists. An item with
  `keepOpen: true` runs immediately without closing; other actions run after
  close and focus restoration. The back button and Backspace on an empty query
  invoke `onBack`; keyboard navigation and IME input remain in the combobox.
  See `GalleryPalette` in `gallery/src/palette.tsx`: Browse examples → collection
  → example demonstrates rich labels and a controlled two-level drill-down.
- `useCommandPaletteHotkey(toggle)` binds Ctrl/⌘-K (works in inputs and over
  open layers).
- `ToastProvider` + `useToast()` → `toast(message, { tone?: "default" | "success" | "error", duration?, action?: { label, onClick } })`.
  An inverted bottom toast, one at a time, polite live region. It
  never takes focus. Its timer (2.2s; errors 4s; with an action 6s) pauses
  while the pointer is over it or focus is inside it (e.g. Tab to its
  action) and resumes with the time left, at least a second (WCAG 2.2.1).
  Esc dismisses it while focus is inside, without closing a layer behind
  it; focus then returns to where it was before it entered the toast.

### States

- `EmptyState({ title, icon? = "inbox", children?, actions?, compact?, tone? })`
- `ErrorState({ error, title?, onRetry?, retrying?, compact? })` — Retry button.
- `Skeleton({ width?, height? })`, `SkeletonRows({ rows?, compact?, header? })`,
  `SkeletonBlock({ lines? })`, `SkeletonSidebar({ lines? })`.
- `ProgressBar({ active })` — the 2px sticky refetch bar (Main renders it).
- `Meter({ value, max?, label?, valueText?, hideValue?, tone?, "aria-label"? })`
  (`role="meter"`, named by its visible `label`, text or JSX, unless
  `aria-label` overrides it).
- `Banner({ tone?, title?, children, icon?, actions?, onDismiss?, slim?, live? })`.
- `DraftBar({ children, actions })` — for `Main`'s `footer`: "3 uncommitted
  changes · Validate · Save · Discard". In narrow panes the message wraps
  and the actions move to their own line. An editor that keeps its own
  `wb-draftbar` footer visible adds `wb-draftbar--neutral` while nothing
  needs attention (no changes, or a complete draft ready to save), keeping the
  warning tone for problems to fix.

Every list: `SkeletonRows` while loading, `EmptyState` when empty (with a
"Clear filters" action when filters are active), `ErrorState` with Retry,
`refetching` on `Main` for background reloads.

### Pages

- `SettingsPage({ center? })` (max 860px column; use in `<Main tint>` without
  a sidebar), `SettingsSection({ title, description?, actions?, id? })`,
  `SettingsRow({ label, help?, group?, stack?, alignTop? })` — the label
  targets the control inside (Input, Select, Switch, Combobox pick up the id);
  `group` labels a group (Seg, chips) instead.
- `Card({ title?, subtitle?, actions?, wide?, headAlign? = "start" | "center" })`
  (inside `.wb-cards` for a 2-column grid; `headAlign="center"` is the
  one-row header that centres actions such as a filter against the title
  and subtitle), `Tile({ label, value, unit?, delta?: { value, direction?, good?, vs? }, spark? })`
  (inside `.wb-tiles`: 4 across, 2 when main <860px, 1 when <560px).
- `Disclosure({ summary, defaultOpen? })` — e.g. raw JSON in a drawer.
- `CopyBlock({ text, label, multiline?, wrap?, className? })` — monospace
  text with a copy button, for a command, a server URL, an API key or a config
  file. `text` is exactly what is shown and copied. One line by default: it
  scrolls horizontally instead of wrapping or truncating, so a long command
  stays whole. `multiline` renders a `<pre>` that keeps line breaks and
  scrolls on its own (320px tall at most). `wrap` wraps long lines inside the
  block instead (at spaces, or anywhere when a word does not fit), so the
  whole value stays visible; use it where a long value may be cut off with no
  cue, as overlay scrollbars show none until scrolled. It applies to
  multiline blocks too: line breaks in `text` are kept, long lines wrap, and
  only vertical scrolling remains. The button stays beside the first line.
  Wrapping is visual only: the button and a selection copy `text` without
  added line breaks. `label` is the button's accessible name and
  tooltip ("Copy server URL"); it never changes. The button writes
  `navigator.clipboard.writeText(text)`; on success its icon turns into a
  check with "Copied" beside it for 2s. If the Clipboard API is missing (an
  insecure origin) or the write is rejected, nothing throws: the block focuses
  and selects its text and shows "Press Ctrl+C to copy" (⌘C on macOS) for 4s.
  These states are announced through a polite live region. The text is
  focusable, so arrows scroll it, and Ctrl/⌘ A selects only this block. The
  component only displays what it is given; deciding whether a value may be
  shown is the application's job.

```tsx
<CopyBlock text={serverUrl} label="Copy server URL" />
<CopyBlock wrap text={installCommand} label="Copy install command" />
<CopyBlock multiline text={configFile} label="Copy config file" />
```

### Helpers

- Time: `<Time value format? = "relative" | "date" | "time" | "datetime" fallback? />`,
  `formatRelative` (within a minute either way is "just now"), `formatDate`,
  `formatTime`, `formatDateTime`, `formatDuration`, `formatNumber`,
  `formatBytes` ("512 B", "1,004 B", "3.4 KB", "840 KB", "1.2 GB": binary
  units, always abbreviated; one decimal below 10), `plural`, `toDate`,
  `useNow()` (shared 30s clock).
- Clicks: `isPlainClick(e)` (primary button, no modifiers, not handled —
  run in-app actions only then, so Ctrl/⌘/middle-click keep opening tabs),
  `hasTextSelection()` (the click ended a text selection).
- Layers: `useLayer(active, close, blocking?, surfaceRef?)` (returns the
  layer chain; a portaled `surfaceRef` gets `--wb-z-depth` = its stack
  position), `useLayerHandle(active, close, blocking?, surfaceRef?)` (returns
  `{ scope, isTop }`; `isTop()` is a stable callback reading the live stack,
  false while inactive), `OverlayScope({ layers?, owner? })`, `useOverlayOwner(ref)`,
  `layerDepth()`, `topLayer()`,
  `hasBlockingLayer()`,
  `useFocusTrap(ref, active?, { initialFocus?, restoreFocus?, owner? })`,
  `tabbableIn(el)` (native Tab stops in document order: skips disabled and
  fieldset-disabled controls, unchecked radios of a group with a checked
  one, inert and hidden elements), `activeTrapRoot()`, `isTypingTarget(el)`. Custom overlays: register with
  `useLayer`, create an owner for the root element, and wrap the content in
  `<OverlayScope layers={…} owner={…}>` so nested overlays stack and count
  as inside. With `useLayerHandle`, pass `scope` as `layers` and call `isTop()`
  inside custom shortcut handlers before acting. All app overlays should join
  this same registry; do not install a second global Escape stack.
- Hotkeys: `useHotkey(combos, handler, { enabled?, allowInInputs?, whenBlocked?, preventDefault? })`,
  `matchesHotkey(e, "mod+k")`, `isMac`, `modKeyLabel`, `paletteShortcutLabel`.
- Theme: `applyStoredTheme`, `useTheme`, `setThemeMode`, `readThemeMode`,
  `resolveTheme`, `systemTheme`, `applyTheme`.
- Misc: `cx(...)`, `toneClass(tone)`, `buttonClass(...)`,
  `computePosition`/`useAnchoredPosition`, `readStorage`/`writeStorage`,
  `errorMessage(error)`.

## Keyboard and focus

| Key                   | Where                    | Does                                                       |
| --------------------- | ------------------------ | ---------------------------------------------------------- |
| Tab (first press)     | page load                | "Skip to content" link; Enter focuses the main pane        |
| Ctrl/⌘ K              | anywhere                 | toggle the command palette                                 |
| `/`                   | anywhere but text fields | focus the page's FilterInput                               |
| `j` / `k`             | lists, DataTable         | move the cursor; the open drawer follows                   |
| Enter / `o`           | lists, DataTable         | open the cursor item / open it externally                  |
| Esc                   | anywhere                 | close the top-most layer (menu → modal → palette → drawer) |
| Esc                   | focus in a toast         | dismiss the toast (layers behind it stay open)             |
| ←/→, Home/End         | tabs, sidebar separator  | switch tab / resize the sidebar                            |
| ↑/↓, Enter, Backspace | combobox, menu, palette  | move, choose, remove last chip                             |
| Home/End, PgUp/PgDn   | open combobox list       | first/last option, ±10                                     |
| Ctrl/⌘ A              | focused copy-block text  | select only that block's text                              |

One document-level Escape handler closes the top-most registered layer
(`useLayer`). Layers nested in the React tree always sit above their
ancestors (a confirm dialog opened from a drawer closes first, even when both
mount together). A component that consumes Escape itself (FilterInput
clearing text, an open combobox, a focused toast) stops propagation; IME composition keys are
left alone. Modals and the palette trap focus and restore it to the element
focused when they opened; the drawer and popovers move focus in and return
it. Overlays portaled from inside another overlay (a combobox listbox in a
popover, a popover in a modal) count as inside it for outside clicks, focus
leaving and the focus trap. Focus
rings are 2px accent outlines on `:focus-visible`; text fields use an
accent border plus 3px halo.

## Conventions

- Desktop only. Test at 1280–2560px and check 1024px (panes narrow, toolbars
  wrap, lower-priority table columns drop).
- Selection, primary actions, links and focus use the accent. Navigation
  (`NavTab`), in-page tabs (`Tabs`, underline), segmented filters (`Seg`,
  grey track) and buttons (bordered) are visually distinct; do not style one
  as another.
- IDs in mono (`wb-num`, `wb-mono`, `Input mono`), display names in sans.
  Prefer display names where available.
- One date format: `<Time>` (relative text, absolute date and time with
  seconds in `title`).
- Uppercase 11px labels (`wb-side-h`, `wb-drawer-section-title`,
  `wb-label-caps`) for section headers only.
- Status colour comes from tones; pair colour with text or an icon.
- Only use `style` props for dynamic values (widths, positions, a computed
  colour); everything else is a class.
- Reduced motion: shimmer, progress sweep, pulse, spinner, toast and scrim
  animations stop; durations drop to 0.

## CSP notes

- No component injects `<style>` or `<script>`, uses `eval`/`new Function`,
  `innerHTML`, `insertRule`, `setAttribute("style", …)` or `cssText`
  (enforced by `tests/conventions.test.ts`).
- Dynamic geometry (sidebar width, popover position, meter width, avatar
  colour, `KeyValue` label width) is set through React `style` props, which
  React applies via CSSOM (`element.style.setProperty`); CSSOM is not governed
  by `style-src`.
- Fonts use relative `url("../fonts/*.woff2?no-inline")`. The Vite query keeps
  small language subsets as external files as well, so `font-src` can fall back
  to `default-src 'self'`. Other bundlers must likewise preserve external font
  assets. No `data:` URIs anywhere in the CSS.
- Theme bootstrap is a function call in `main.tsx`, not an inline script. With
  a deferred module script the first paint may briefly use the light
  background in dark mode; that is the accepted trade-off for
  `script-src 'self'`.
- Vite's dev server injects `<style>` tags for CSS; production builds emit
  stylesheet files. Test CSP against a production build.

## Developing the kit

```sh
npm ci
npm run dev            # gallery at http://127.0.0.1:5190/
npm run typecheck      # whole repo, then src/ alone without ambient types
npm test               # vitest + Testing Library + jsdom
npm run build:gallery  # static gallery in gallery/dist
npm run format:check   # Prettier defaults
node scripts/range-slider-check.mjs http://127.0.0.1:5190/ <dir> # native range keyboard and pointer checks
node scripts/shots.mjs http://127.0.0.1:5190/ <dir>   # Playwright screenshots
node scripts/layout-check.mjs          # Chromium checks: table widths, toolbar split
node scripts/interaction-check.mjs http://127.0.0.1:5190/ <dir> # drawer resize/persistence, palette steps and copy blocks, both themes
```

`scripts/layout-check.mjs` measures the gallery's hidden layout lab
(`#/lab`: grow weights against long text, `grow: 0`, fixed widths, caps,
and crowded toolbars at main 552/1012/1400px) and the toolbar
split next to a drawer; run it (dev server up) after touching table or
toolbar CSS. `scripts/interaction-check.mjs` exercises the gallery in light and
dark Chromium: pointer/keyboard drawer resizing, cancel/reset/persistence,
viewport fitting at 1024px, the palette drill-down/back/navigation flow, and
copy blocks against the real clipboard (copy and revert, one scrolling line,
wrapped lines without horizontal overflow, Ctrl/⌘ A, and the selection
fallback after a rejected write). Its optional
output directory retains screenshots and a JSON result summary.

Gallery URLs accept `?theme=light|dark` (before the `#`), and the sample app
reads `#/?item=ev-4819` (drawer), `?modal=new`, `?palette=1`,
`?density=compact`, `?loading=1`, `?refetch=1`, `#/rules?rule=r-regex-aws`
(wide drawer) and `&draft=1` (draft bar). `?crowded=1` (before the `#`)
gives the sample app a crowded top bar (space switch, five
tabs, long status); resize the window to watch it compact.

Open `#/?item=ev-4819&resize=1` for the resizable detail drawer. Drag its left
separator, use arrows/Shift/Home/End, double-click to reset, or press Escape
while dragging to cancel. The width persists under
`workbench-gallery:drawer-width`. Open the command palette and select Browse
examples → Layouts → Resizable detail drawer to reach the same example through
the drill-down flow; Backspace on an empty query and the back button return one
level. Closing and reopening starts at the root.

## License

MIT; see [LICENSE](LICENSE), also included as `src/LICENSE` in vendored copies.
The bundled Inter and JetBrains Mono fonts are
under the SIL Open Font License 1.1: `src/fonts/LICENSE-Inter.txt` and
`src/fonts/LICENSE-JetBrainsMono.txt`, which vendoring copies with the fonts.
