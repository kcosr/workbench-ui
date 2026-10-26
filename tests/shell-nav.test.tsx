import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  AppShell,
  Brand,
  Main,
  Sidebar,
  SidebarFoot,
  SidebarItem,
  SidebarNav,
  SidebarToggle,
  TopBar,
} from "../src";

function NavShell() {
  return (
    <AppShell
      sidebar={
        <Sidebar label="Sidebar">
          <Brand name="Example" href="#/" />
          <SidebarNav label="Main">
            <SidebarItem href="#/jobs" label="Jobs" count={8} current />
            <SidebarItem
              href="#/runs"
              label="Runs"
              count="3 running"
              countTone="info"
            />
            <SidebarItem
              href="#/runs?attention=1"
              label="Needs attention"
              count={1}
              countTone="danger"
              nested
            />
          </SidebarNav>
          <SidebarNav title="Administration">
            <SidebarItem href="#/users" label="Users" />
          </SidebarNav>
          <SidebarFoot>
            <span>Ada Admin</span>
            <SidebarToggle />
          </SidebarFoot>
        </Sidebar>
      }
      sidebarStorageKey="t:nav"
    >
      <Main>main</Main>
    </AppShell>
  );
}

describe("navigation sidebar without a top bar", () => {
  it("lays the frame out without a top bar row", () => {
    const { container } = render(<NavShell />);
    const app = container.querySelector(".wb-app");
    expect(app).toHaveClass("wb-app--no-topbar");
    expect(container.querySelector(".wb-topbar")).toBeNull();
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Skip to content" }),
    ).toBeInTheDocument();
  });

  it("keeps the top bar layout when there is one", () => {
    const { container } = render(
      <AppShell topBar={<TopBar>top</TopBar>}>
        <Main>main</Main>
      </AppShell>,
    );
    expect(container.querySelector(".wb-app")).not.toHaveClass(
      "wb-app--no-topbar",
    );
    expect(container.querySelector(".wb-topbar")).toBeInTheDocument();
  });

  it("names each navigation group, by its label or its visible title", () => {
    render(<NavShell />);
    const main = screen.getByRole("navigation", { name: "Main" });
    const admin = screen.getByRole("navigation", { name: "Administration" });
    expect(
      within(main)
        .getAllByRole("link")
        .map((l) => l.textContent),
    ).toEqual(["Jobs 8", "Runs 3 running", "Needs attention 1"]);
    expect(within(admin).getByRole("link", { name: "Users" })).toHaveAttribute(
      "href",
      "#/users",
    );
    expect(within(admin).getByText("Administration")).toHaveClass(
      "wb-side-h-title",
    );
  });

  it("marks the current page, toned counts and nested items", () => {
    render(<NavShell />);
    expect(screen.getByRole("link", { name: "Jobs 8" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByText("3 running")).toHaveClass(
      "wb-side-item-count",
      "wb-tone-info",
    );
    expect(screen.getByText("8")).toHaveClass("wb-side-item-count");
    expect(screen.getByText("8").className).not.toMatch(/wb-tone-/);
    const nested = screen.getByRole("link", { name: "Needs attention 1" });
    expect(nested).toHaveClass("wb-side-item", "wb-side-item--nested");
    expect(screen.getByText("1")).toHaveClass("wb-tone-danger");
  });

  it("puts the foot in the sidebar, where SidebarToggle can collapse it", async () => {
    const user = userEvent.setup();
    const { container } = render(<NavShell />);
    const foot = container.querySelector(".wb-side-foot");
    expect(foot).toHaveTextContent("Ada Admin");
    await user.click(screen.getByRole("button", { name: "Hide sidebar" }));
    expect(screen.queryByRole("navigation", { name: "Main" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Show sidebar" }));
    expect(screen.getByRole("navigation", { name: "Main" })).toBeVisible();
  });
});
