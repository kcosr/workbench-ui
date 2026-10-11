import type { ReactNode } from "react";
import {
  AppShell,
  Avatar,
  Badge,
  Button,
  Card,
  Chip,
  EmptyState,
  IconButton,
  List,
  ListRow,
  Main,
  Menu,
  PageHeader,
  LinkTabs,
  Rows,
  Tile,
  Time,
  useToast,
} from "../../../src";
import { DECISIONS, PEOPLE, makeEvents } from "../data";
import { useRoute } from "../router";

const EVENTS = makeEvents();

function Spark({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  const w = 110;
  const h = 34;
  // Drawn in a fixed viewBox and scaled to the slot, so it shrinks with the tile.
  const slot = w / values.length;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      height={h}
      role="img"
      aria-label="Trend"
      className="gal-spark"
    >
      {values.map((v, i) => {
        const bh = Math.max(1, (v / max) * (h - 1));
        return (
          <rect
            key={i}
            x={i * slot + 1.5}
            y={h - bh}
            width={Math.max(1, slot - 3)}
            height={bh}
            rx={1.5}
            className={
              i === values.length - 1 ? "gal-spark-now" : "gal-spark-bar"
            }
          />
        );
      })}
    </svg>
  );
}

export function PersonView({ topBar }: { topBar: ReactNode }) {
  const { path } = useRoute();
  const toast = useToast();
  const id = path.split("/")[2] ?? "u-alice";
  const person = PEOPLE.find((p) => p.id === id) ?? PEOPLE[0];
  const tab = path.split("/")[3] ?? "overview";
  const tabHref = (t: string) =>
    `#/people/${person.id}${t === "overview" ? "" : `/${t}`}`;
  const events = EVENTS.filter((e) => e.principalId === person.id).slice(0, 5);

  return (
    <AppShell topBar={topBar}>
      <Main tint label={person.name}>
        <PageHeader
          back={{ href: "#/", label: "People" }}
          title={
            <span className="gal-person">
              <Avatar
                name={person.name}
                size="xl"
                highlight={person.id === "u-alice"}
              />
              {person.name}
            </span>
          }
          meta={
            <>
              <Badge tone="info">Global admin</Badge>
              <span className="wb-num">{person.id}</span>
              <span className="wb-sep">·</span>
              <span>{person.email}</span>
              <span className="wb-sep">·</span>
              <span>
                last seen <Time value={new Date(Date.now() - 42 * 60_000)} />
              </span>
            </>
          }
          actions={
            <>
              <Button
                icon="key"
                onClick={() => toast("Password reset email sent")}
              >
                Reset password
              </Button>
              <Menu
                label="More actions"
                items={[
                  { id: "disable", label: "Disable user", icon: "pause" },
                  {
                    id: "tokens",
                    label: "Revoke all tokens",
                    icon: "trash",
                    danger: true,
                  },
                ]}
                trigger={(props) => (
                  <IconButton
                    {...props}
                    variant="default"
                    icon="more"
                    label="More actions"
                  />
                )}
              />
            </>
          }
        >
          <LinkTabs
            label="User sections"
            items={[
              {
                href: tabHref("overview"),
                label: "Overview",
                current: tab === "overview",
              },
              {
                href: tabHref("access"),
                label: "Access",
                current: tab === "access",
              },
              {
                href: tabHref("grants"),
                label: "Grants",
                count: 6,
                current: tab === "grants",
              },
              {
                href: tabHref("tokens"),
                label: "Tokens",
                count: 3,
                current: tab === "tokens",
              },
              {
                href: tabHref("activity"),
                label: "Activity",
                current: tab === "activity",
              },
            ]}
          />
        </PageHeader>
        {tab === "overview" ? (
          <div className="gal-page">
            <div className="wb-tiles">
              <Tile
                label="Requests (7 days)"
                value="1,284"
                delta={{
                  value: "12%",
                  direction: "up",
                  good: null,
                  vs: "prior 7 days",
                }}
                spark={<Spark values={[3, 5, 4, 8, 6, 9, 12, 7, 10, 14]} />}
              />
              <Tile
                label="Denied"
                value="37"
                delta={{
                  value: "9",
                  direction: "down",
                  good: true,
                  vs: "prior 7 days",
                }}
                spark={<Spark values={[6, 4, 8, 3, 2, 5, 4, 2, 3, 1]} />}
              />
              <Tile
                label="Redactions"
                value="212"
                delta={{
                  value: "40",
                  direction: "up",
                  good: false,
                  vs: "prior 7 days",
                }}
              />
              <Tile
                label="Median latency"
                value="184"
                unit="ms"
                delta={{ value: "0", direction: "flat" }}
              />
            </div>
            <div className="wb-cards">
              <Card
                title="Recent activity"
                subtitle="last 5 requests"
                actions={
                  <Button size="sm" href="#/">
                    View all
                  </Button>
                }
              >
                {events.length ? (
                  <Rows label="Recent activity">
                    {events.map((e) => (
                      <ListRow
                        key={e.id}
                        compact
                        icon={DECISIONS[e.decision].icon}
                        iconTone={DECISIONS[e.decision].tone}
                        href={`#/?item=${e.id}`}
                        title={`${e.action} on ${e.service}`}
                        side={<Time value={e.at} />}
                      />
                    ))}
                  </Rows>
                ) : (
                  <EmptyState compact title="No recent activity" />
                )}
              </Card>
              <Card
                title="Groups"
                subtitle="membership grants 4 of 6 permissions"
              >
                <div className="wb-inline">
                  <Chip icon="users">platform-admins</Chip>
                  <Chip icon="users">engineering</Chip>
                  <Chip
                    icon="users"
                    readOnly
                    title="Synced from Microsoft Entra"
                  >
                    entra:all-staff
                  </Chip>
                </div>
              </Card>
              <Card title="Tokens" subtitle="3 active" wide>
                <div className="wb-table-card">
                  <table className="wb-table">
                    <thead>
                      <tr>
                        <th scope="col">Name</th>
                        <th scope="col">Boundary</th>
                        <th scope="col">Last used</th>
                        <th scope="col" className="wb-cell-num">
                          Requests
                        </th>
                        <th scope="col">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="wb-cell-strong">laptop-cli</td>
                        <td>github, jira</td>
                        <td>
                          <Time value={new Date(Date.now() - 12 * 60_000)} />
                        </td>
                        <td className="wb-cell-num">9,812</td>
                        <td>
                          <Badge variant="dot" tone="success">
                            Active
                          </Badge>
                        </td>
                      </tr>
                      <tr className="is-selected">
                        <td className="wb-cell-strong">ci-nightly</td>
                        <td>cloudbees</td>
                        <td>
                          <Time value={new Date(Date.now() - 864e5 * 2)} />
                        </td>
                        <td className="wb-cell-num">412</td>
                        <td>
                          <Badge variant="dot" tone="warning">
                            Expires in 3d
                          </Badge>
                        </td>
                      </tr>
                      <tr className="is-dim">
                        <td className="wb-cell-strong">old-agent</td>
                        <td>all services</td>
                        <td>
                          <Time value={new Date(Date.now() - 864e5 * 60)} />
                        </td>
                        <td className="wb-cell-num">3</td>
                        <td>
                          <Badge variant="dot" tone="muted">
                            Paused
                          </Badge>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          </div>
        ) : (
          <List>
            <EmptyState
              icon="layers"
              title={`${tab[0]?.toUpperCase()}${tab.slice(1)} for ${person.name}`}
            >
              This tab is part of the sample; only Overview has content.
            </EmptyState>
          </List>
        )}
      </Main>
    </AppShell>
  );
}
