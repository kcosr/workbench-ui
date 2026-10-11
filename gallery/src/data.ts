/** Deterministic sample data for the gallery. */
import type { IconName, Tone } from "../../src";

export type Decision = "allow" | "deny" | "redact" | "error";

export interface SampleEvent {
  id: string;
  at: Date;
  principal: string;
  principalId: string;
  service: string;
  action: string;
  decision: Decision;
  reason: string;
  node: string;
  latencyMs: number;
  context: string;
  grant: string | null;
}

export const DECISIONS: Record<
  Decision,
  { label: string; tone: Tone; icon: IconName; verb: string }
> = {
  allow: {
    label: "Allowed",
    tone: "success",
    icon: "shield-check",
    verb: "allowed",
  },
  deny: { label: "Denied", tone: "danger", icon: "ban", verb: "denied" },
  redact: {
    label: "Redacted",
    tone: "warning",
    icon: "eye-off",
    verb: "redacted",
  },
  error: {
    label: "Failed",
    tone: "neutral",
    icon: "alert-circle",
    verb: "failed",
  },
};

export const SERVICES = [
  "github",
  "jira",
  "confluence",
  "cloudbees",
  "slack",
  "google-drive",
  "pagerduty",
] as const;

export const PEOPLE = [
  { id: "u-alice", name: "Alice Chen", email: "alice.chen@example.com" },
  { id: "u-bob", name: "Bob Okafor", email: "bob.okafor@example.com" },
  { id: "u-carmen", name: "Carmen Ruiz", email: "carmen.ruiz@example.com" },
  { id: "u-dmitri", name: "Dmitri Volkov", email: "dmitri.volkov@example.com" },
  { id: "u-emma", name: "Emma Lindqvist", email: "emma.lindqvist@example.com" },
  { id: "sa-ci", name: "ci-runner", email: "service account" },
  { id: "sa-docs", name: "docs-indexer", email: "service account" },
  { id: "u-farah", name: "Farah Haddad", email: "farah.haddad@example.com" },
] as const;

const ACTIONS: Record<(typeof SERVICES)[number], string[]> = {
  github: [
    "repo.read",
    "pull_request.create",
    "issue.comment",
    "contents.write",
  ],
  jira: ["issue.read", "issue.transition", "search.jql"],
  confluence: ["page.read", "page.update", "space.list"],
  cloudbees: ["build.log.read", "job.trigger", "artifact.download"],
  slack: ["message.post", "channel.history"],
  "google-drive": ["file.read", "file.search"],
  pagerduty: ["incident.list", "incident.ack"],
};

const REASONS: Record<Decision, string[]> = {
  allow: [
    "Matched grant “Engineering read access” for the default execution context.",
    "Service-account grant covers this action on the ci namespace.",
    "Allowed by personal grant; resource scope matched project KEY-*.",
  ],
  deny: [
    "No grant covers contents.write outside the sandbox execution context.",
    "Token boundary excludes this service; the token was issued for jira only.",
    "Rate limit of 60 requests per minute exceeded for this principal.",
  ],
  redact: [
    "Response contained 2 AWS access keys; masked before delivery.",
    "Email addresses in the page body were masked by the pii-email rule.",
    "LLM category “customer data” matched; 3 spans redacted before delivery.",
  ],
  error: [
    "Upstream returned 502 after 30s; the request was not retried.",
    "Credential for this service is expired; the user must reconnect OAuth.",
  ],
};

function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(r: () => number, list: readonly T[]): T {
  const v = list[Math.floor(r() * list.length)];
  if (v === undefined) throw new Error("empty list");
  return v;
}

export function makeEvents(count = 64, now = Date.now()): SampleEvent[] {
  const r = rng(42);
  const out: SampleEvent[] = [];
  let t = now - 4 * 60_000;
  for (let i = 0; i < count; i++) {
    const service = pick(r, SERVICES);
    const person = pick(r, PEOPLE);
    const roll = r();
    const decision: Decision =
      roll < 0.62
        ? "allow"
        : roll < 0.8
          ? "deny"
          : roll < 0.95
            ? "redact"
            : "error";
    out.push({
      id: `ev-${(4821 - i).toString()}`,
      at: new Date(t),
      principal: person.name,
      principalId: person.id,
      service,
      action: pick(r, ACTIONS[service]),
      decision,
      reason: pick(r, REASONS[decision]),
      node: pick(r, ["core-1", "core-2", "edge-eu"]),
      latencyMs: Math.round(20 + r() * 900),
      context: pick(r, ["default", "sandbox", "ci"]),
      grant: decision === "allow" ? pick(r, ["g-104", "g-221", "g-318"]) : null,
    });
    t -= Math.round(r() * 95 * 60_000);
  }
  return out;
}

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function dayTitle(
  d: Date,
  now = new Date(),
): { title: string; sub: string } {
  const start = (x: Date) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(now) - start(d)) / 86_400_000);
  const sub = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(d);
  if (diff === 0) return { title: "Today", sub };
  if (diff === 1) return { title: "Yesterday", sub };
  return {
    title: new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(d),
    sub,
  };
}
