import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  Button,
  ChipToggle,
  Field,
  FilterInput,
  IconButton,
  Input,
  LinkProvider,
  LinkTabs,
  NavTab,
  Seg,
  SettingsRow,
  Switch,
  Tabs,
} from "../src";
import type { LinkProps } from "../src";

describe("Seg", () => {
  it("is a labelled group of aria-pressed buttons", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Seg
        label="Status"
        value="a"
        onChange={onChange}
        options={[
          { value: "a", label: "Active", count: 3 },
          { value: "b", label: "Paused" },
        ]}
      />,
    );
    expect(screen.getByRole("group", { name: "Status" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Active 3" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Paused" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await user.click(screen.getByRole("button", { name: "Paused" }));
    expect(onChange).toHaveBeenCalledWith("b");
  });
});

describe("Tabs", () => {
  function T() {
    const [v, setV] = useState("one");
    return (
      <Tabs
        label="Sections"
        value={v}
        onChange={setV}
        items={[
          { value: "one", label: "One" },
          { value: "two", label: "Two", count: 2 },
          { value: "three", label: "Three" },
        ]}
      >
        <p>panel {v}</p>
      </Tabs>
    );
  }

  it("wires tabs to the panel and supports arrow keys", async () => {
    const user = userEvent.setup();
    render(<T />);
    const one = screen.getByRole("tab", { name: "One" });
    expect(one).toHaveAttribute("aria-selected", "true");
    expect(one).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("tab", { name: "Two 2" })).toHaveAttribute(
      "tabindex",
      "-1",
    );
    const panel = screen.getByRole("tabpanel", { name: "One" });
    expect(panel).toHaveTextContent("panel one");
    expect(one).toHaveAttribute("aria-controls", panel.id);
    one.focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Two 2" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Two 2" })).toHaveFocus();
    await user.keyboard("{End}");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("panel three");
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "One" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("LinkTabs are navigation links with aria-current", () => {
    render(
      <LinkTabs
        label="User"
        items={[
          { href: "#/u/1", label: "Overview", current: true },
          { href: "#/u/1/grants", label: "Grants", current: false },
        ]}
      />,
    );
    expect(
      screen.getByRole("navigation", { name: "User" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Grants" })).not.toHaveAttribute(
      "aria-current",
    );
  });
});

describe("links", () => {
  it("default links are plain anchors (hash routing)", () => {
    render(
      <NavTab href="#/events" current>
        Events
      </NavTab>,
    );
    const a = screen.getByRole("link", { name: "Events" });
    expect(a).toHaveAttribute("href", "#/events");
    expect(a).toHaveAttribute("aria-current", "page");
  });

  it("LinkProvider routes every kit link through the app's component", async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();
    function RouterLink({ href, onClick, ...rest }: LinkProps) {
      return (
        <a
          {...rest}
          href={href}
          data-router="yes"
          onClick={(e) => {
            onClick?.(e);
            e.preventDefault();
            navigate(href);
          }}
        />
      );
    }
    render(
      <LinkProvider component={RouterLink}>
        <NavTab href="/tokens">Tokens</NavTab>
        <Button href="/tokens/new">Issue token</Button>
        <Button href="https://example.com" external>
          Docs
        </Button>
      </LinkProvider>,
    );
    expect(screen.getByRole("link", { name: "Tokens" })).toHaveAttribute(
      "data-router",
      "yes",
    );
    await user.click(screen.getByRole("link", { name: "Issue token" }));
    expect(navigate).toHaveBeenCalledWith("/tokens/new");
    const ext = screen.getByRole("link", { name: "Docs" });
    expect(ext).not.toHaveAttribute("data-router");
    expect(ext).toHaveAttribute("target", "_blank");
    expect(ext).toHaveAttribute("rel", "noopener noreferrer");
  });
});

describe("Button", () => {
  it("pending keeps focusability, sets aria-busy and swallows clicks", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button pending onClick={onClick}>
        Save
      </Button>,
    );
    const b = screen.getByRole("button", { name: "Save" });
    expect(b).toHaveAttribute("aria-busy", "true");
    expect(b).not.toBeDisabled();
    await user.click(b);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("IconButton requires and applies an accessible name", () => {
    render(<IconButton icon="trash" label="Delete rule" />);
    const b = screen.getByRole("button", { name: "Delete rule" });
    expect(b).toHaveClass("wb-btn", "wb-btn--ghost", "wb-btn--icon");
    expect(b).toHaveAttribute("title", "Delete rule");
  });

  it("ChipToggle toggles aria-pressed", async () => {
    const user = userEvent.setup();
    function C() {
      const [on, setOn] = useState(false);
      return (
        <ChipToggle pressed={on} onPressedChange={setOn}>
          Live
        </ChipToggle>
      );
    }
    render(<C />);
    const b = screen.getByRole("button", { name: "Live" });
    expect(b).toHaveAttribute("aria-pressed", "false");
    await user.click(b);
    expect(b).toHaveAttribute("aria-pressed", "true");
  });
});

describe("Field wiring", () => {
  it("labels the control and describes it with hint and error", () => {
    render(
      <Field label="Name" hint="Shown in lists." error="Required">
        <Input />
      </Field>,
    );
    const input = screen.getByLabelText("Name");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Required Shown in lists.");
  });

  it("SettingsRow labels its control and uses the help as description", () => {
    render(
      <SettingsRow label="Capture" help="Store metadata.">
        <Switch />
      </SettingsRow>,
    );
    const sw = screen.getByRole("switch", { name: "Capture" });
    expect(sw).toHaveAccessibleDescription("Store metadata.");
  });
});

describe("FilterInput", () => {
  function F({ onChange }: { onChange: (v: string) => void }) {
    const [v, setV] = useState("");
    return (
      <>
        <button>elsewhere</button>
        <FilterInput
          value={v}
          onChange={(x) => {
            setV(x);
            onChange(x);
          }}
          placeholder="Filter rules"
        />
      </>
    );
  }

  it("/ focuses it, Escape clears it, × clears it", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<F onChange={onChange} />);
    screen.getByRole("button", { name: "elsewhere" }).focus();
    await user.keyboard("/");
    const input = screen.getByRole("searchbox", { name: "Filter rules" });
    expect(input).toHaveFocus();
    expect(input).toHaveValue("");
    await user.keyboard("abc");
    expect(onChange).toHaveBeenLastCalledWith("abc");
    await user.keyboard("{Escape}");
    expect(input).toHaveValue("");
    expect(onChange).toHaveBeenLastCalledWith("");
    await user.keyboard("x");
    await user.click(screen.getByRole("button", { name: "Clear filter" }));
    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
  });

  it("does not steal / while typing elsewhere", async () => {
    const user = userEvent.setup();
    render(
      <>
        <input aria-label="other" />
        <FilterInput value="" onChange={() => {}} placeholder="Filter" />
      </>,
    );
    await user.click(screen.getByLabelText("other"));
    await user.keyboard("/");
    expect(screen.getByLabelText("other")).toHaveValue("/");
  });
});

describe("accessible names of labelled controls", () => {
  it("Checkbox: the description is a description, not part of the name", async () => {
    const { Checkbox } = await import("../src");
    render(
      <Checkbox
        label="Include LLM in this test"
        description="Sends masked sample text to the model."
      />,
    );
    const box = screen.getByRole("checkbox", {
      name: "Include LLM in this test",
    });
    expect(box).toHaveAccessibleDescription(
      "Sends masked sample text to the model.",
    );
    expect(screen.queryByLabelText(/Sends masked/)).toBeNull();
  });

  it("SidebarCheck: the count describes the checkbox instead of naming it", async () => {
    const { SidebarCheck } = await import("../src");
    render(
      <SidebarCheck
        label="github"
        count={12}
        checked={false}
        onChange={() => {}}
      />,
    );
    const box = screen.getByRole("checkbox", { name: "github" });
    expect(box).toHaveAccessibleDescription("12");
  });
});

describe("compact rows", () => {
  it("keep title badges outside the truncating title", async () => {
    const { ListRow, Rows, Badge } = await import("../src");
    render(
      <Rows>
        <ListRow
          compact
          title="synthetic_example_secret"
          titleExtra={<Badge>Redact</Badge>}
          meta="catalog · 5h ago"
        />
      </Rows>,
    );
    const badge = screen.getByText("Redact");
    expect(badge.closest(".wb-row-title")).toBeNull();
    expect(badge.closest(".wb-row-main")).not.toBeNull();
  });
});
