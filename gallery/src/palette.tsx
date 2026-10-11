import { useMemo, useState } from "react";
import {
  Avatar,
  CommandPalette,
  Icon,
  paletteHighlight,
  useToast,
} from "../../src";
import type { PaletteItem, PaletteSource, ThemeMode } from "../../src";
import { DECISIONS, makeEvents, PEOPLE } from "./data";

const EVENTS = makeEvents();

function go(href: string) {
  window.location.hash = href.replace(/^#/, "");
}

/** Palette sources: static "Go to", async people search, events by id, actions. */
export function usePaletteSources({
  mode,
  setMode,
}: {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}): PaletteSource[] {
  const toast = useToast();
  return useMemo(() => {
    const goTo: PaletteItem[] = [
      {
        id: "go-events",
        label: "Events",
        icon: "activity",
        hint: "#/",
        onSelect: () => go("#/"),
      },
      {
        id: "go-rules",
        label: "Rules",
        icon: "list",
        onSelect: () => go("#/rules"),
      },
      {
        id: "go-people",
        label: "People",
        icon: "users",
        onSelect: () => go("#/people/u-alice"),
      },
      {
        id: "go-settings",
        label: "Settings",
        icon: "gear",
        onSelect: () => go("#/settings"),
      },
      {
        id: "go-components",
        label: "Component gallery",
        icon: "grid",
        keywords: ["kit"],
        onSelect: () => go("#/components"),
      },
    ];
    const people: PaletteSource = {
      id: "people",
      title: "People",
      minQuery: 1,
      search: (query, signal) =>
        new Promise((resolve, reject) => {
          const t = setTimeout(() => {
            const q = query.toLowerCase();
            resolve(
              PEOPLE.filter(
                (p) => p.name.toLowerCase().includes(q) || p.id.includes(q),
              ).map((p) => ({
                id: p.id,
                label: p.name,
                icon: <Avatar name={p.name} />,
                hint: <span className="wb-mono">{p.id}</span>,
                onSelect: () => go(`#/people/${p.id}`),
              })),
            );
          }, 250);
          signal.addEventListener("abort", () => {
            clearTimeout(t);
            reject(new DOMException("aborted", "AbortError"));
          });
        }),
    };
    const events: PaletteSource = {
      id: "events",
      title: "Recent events",
      items: (query) => {
        const q = query.toLowerCase();
        return EVENTS.filter(
          (e) =>
            !q ||
            e.id.includes(q) ||
            e.action.includes(q) ||
            e.service.includes(q),
        ).map((e) => ({
          id: e.id,
          label: `${e.action} on ${e.service}`,
          icon: (
            <span
              className={`wb-tone-color wb-tone-${DECISIONS[e.decision].tone}`}
            >
              <Icon name={DECISIONS[e.decision].icon} />
            </span>
          ),
          hint: (
            <>
              <span className="wb-mono">{e.id}</span> · {e.principal}
            </>
          ),
          onSelect: () => go(`#/?item=${e.id}`),
        }));
      },
      limit: 4,
    };
    const actions: PaletteItem[] = [
      {
        id: "new-rule",
        label: "Create rule",
        icon: "plus",
        onSelect: () => go("#/?modal=new"),
      },
      {
        id: "theme",
        label:
          mode === "dark" ? "Switch to light theme" : "Switch to dark theme",
        icon: mode === "dark" ? "sun" : "moon",
        keywords: ["theme", "dark", "light"],
        onSelect: () => setMode(mode === "dark" ? "light" : "dark"),
      },
      {
        id: "refresh",
        label: "Refresh data",
        icon: "refresh",
        onSelect: () => toast("Refreshed"),
      },
      {
        id: "signout",
        label: "Sign out",
        icon: "log-out",
        onSelect: () => toast("Signed out (demo)"),
      },
    ];
    const rules: PaletteItem[] = [
      {
        id: "rule-gitleaks-aws",
        label: "gitleaks_aws_access_token",
        icon: "braces",
        hint: "Detects AWS access key IDs and secret access keys in response bodies, logs, build output and uploaded artifacts",
        onSelect: () => go("#/rules?rule=r-regex-aws"),
      },
      {
        id: "rule-pii-email",
        label: "pii-email",
        icon: "book",
        hint: "Catalog rule",
        onSelect: () => go("#/rules?rule=r-cat-pii"),
      },
    ];
    return [
      { id: "goto", title: "Go to", items: goTo },
      { id: "rules", title: "Rules", items: rules, showWhenEmpty: false },
      people,
      events,
      { id: "actions", title: "Actions", items: actions },
    ];
  }, [mode, setMode, toast]);
}

const EXAMPLES = [
  {
    id: "layouts",
    label: "Layouts",
    examples: [
      {
        id: "resizable",
        label: "Resizable detail drawer",
        href: "#/?item=ev-4819&resize=1",
      },
      {
        id: "editor",
        label: "Wide rule editor",
        href: "#/rules?rule=r-regex-aws",
      },
      { id: "dense", label: "Dense event list", href: "#/?density=compact" },
    ],
  },
  {
    id: "components",
    label: "Components",
    examples: [
      { id: "catalog", label: "Component catalog", href: "#/components" },
      { id: "tables", label: "Data tables", href: "#/tables" },
      { id: "settings", label: "Settings controls", href: "#/settings" },
    ],
  },
] as const;

/** App-owned root → collection → example stack; the kit owns the surface and focus. */
export function GalleryPalette({
  onClose,
  mode,
  setMode,
}: {
  onClose: () => void;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}) {
  const baseSources = usePaletteSources({ mode, setMode });
  const [query, setQuery] = useState("");
  const [step, setStep] = useState<
    "root" | "collections" | "layouts" | "components"
  >("root");
  const navigate = (next: typeof step) => {
    setQuery("");
    setStep(next);
  };
  const collection = EXAMPLES.find((entry) => entry.id === step);
  const sources: PaletteSource[] = collection
    ? [
        {
          id: "examples",
          title: collection.label,
          items: collection.examples.map((example) => ({
            id: example.id,
            label: `${collection.label} / ${example.label}`,
            renderLabel: (q) => (
              <>
                <span className="wb-muted">{collection.label} / </span>
                <strong>
                  {paletteHighlight(example.label, q).map((part, i) =>
                    part.match ? <mark key={i}>{part.text}</mark> : part.text,
                  )}
                </strong>
              </>
            ),
            icon: <Icon name="grid" />,
            hint: example.href,
            onSelect: () => go(example.href),
          })),
        },
      ]
    : step === "collections"
      ? [
          {
            id: "collections",
            title: "Collections",
            items: EXAMPLES.map((entry) => ({
              id: entry.id,
              label: entry.label,
              icon: "grid",
              hint: `${entry.examples.length} examples`,
              keepOpen: true,
              onSelect: () => navigate(entry.id),
            })),
          },
        ]
      : [
          ...baseSources,
          {
            id: "examples",
            title: "Explore",
            items: [
              {
                id: "browse-examples",
                label: "Browse examples",
                icon: "grid",
                keywords: ["drill-down", "resize", "layout"],
                keepOpen: true,
                onSelect: () => navigate("collections"),
              },
            ],
          },
        ];
  return (
    <CommandPalette
      open
      onClose={onClose}
      sources={sources}
      query={query}
      onQueryChange={setQuery}
      placeholder={
        step === "root"
          ? "Search events, people, views, actions…"
          : collection
            ? "Choose an example…"
            : "Choose a collection…"
      }
      step={
        step === "root"
          ? undefined
          : {
              id: step,
              title: collection
                ? `Examples / ${collection.label}`
                : "Browse examples",
              onBack: () => navigate(collection ? "collections" : "root"),
            }
      }
    />
  );
}
