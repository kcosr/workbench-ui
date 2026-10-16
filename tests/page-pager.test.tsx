import { useState } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LinkProvider, PagePager } from "../src";
import type { LinkProps } from "../src";

describe("PagePager", () => {
  it("pages through local results and stops at both bounds", async () => {
    const user = userEvent.setup();
    function Example() {
      const [page, setPage] = useState(0);
      return (
        <PagePager
          label="Records pagination"
          start={page * 50 + 1}
          shown={Math.min(50, 120 - page * 50)}
          total={120}
          noun="record"
          onPrevious={() => setPage((current) => current - 1)}
          onNext={() => setPage((current) => current + 1)}
        />
      );
    }
    render(<Example />);
    const pager = screen.getByRole("navigation", {
      name: "Records pagination",
    });
    const previous = within(pager).getByRole("button", { name: "Previous" });
    const next = within(pager).getByRole("button", { name: "Next" });
    expect(within(pager).getByRole("status")).toHaveTextContent(
      "1–50 of 120 records",
    );
    expect(previous).toBeDisabled();
    await user.click(previous);
    await user.tab();
    expect(next).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(within(pager).getByRole("status")).toHaveTextContent(
      "51–100 of 120 records",
    );
    expect(previous).toBeEnabled();
    await user.click(next);
    expect(within(pager).getByRole("status")).toHaveTextContent(
      "101–120 of 120 records",
    );
    expect(next).toBeDisabled();
    await user.click(next);
    await user.click(previous);
    expect(within(pager).getByRole("status")).toHaveTextContent(
      "51–100 of 120 records",
    );
  });

  it("uses router links and blocks unavailable destinations", async () => {
    const user = userEvent.setup();
    const navigation = vi.fn();
    function RouterLink(props: LinkProps) {
      return (
        <a
          {...props}
          data-router-link="true"
          onClick={(event) => {
            event.preventDefault();
            navigation(props.href);
          }}
        />
      );
    }
    render(
      <LinkProvider component={RouterLink}>
        <PagePager
          start={1}
          shown={50}
          total={230}
          previousHref="/records?page=0"
          nextHref="/records?page=2"
        />
      </LinkProvider>,
    );
    const previous = screen.getByRole("link", { name: "Previous" });
    const next = screen.getByRole("link", { name: "Next" });
    expect(previous).toHaveAttribute("aria-disabled", "true");
    expect(previous).toHaveAttribute("tabindex", "-1");
    expect(previous).toHaveAttribute("data-router-link", "true");
    expect(next).toHaveAttribute("href", "/records?page=2");
    expect(next).toHaveAttribute("data-router-link", "true");
    await user.click(previous);
    expect(navigation).not.toHaveBeenCalled();
    await user.tab();
    expect(next).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(navigation).toHaveBeenCalledWith("/records?page=2");
  });

  it("blocks local navigation while loading or disabled, but permits background updates", async () => {
    const user = userEvent.setup();
    const previous = vi.fn();
    const next = vi.fn();
    const props = {
      start: 51,
      shown: 50,
      total: 230,
      onPrevious: previous,
      onNext: next,
    };
    const { rerender } = render(<PagePager {...props} loading />);
    expect(screen.getByText("Loading…")).toHaveAttribute("role", "status");
    expect(screen.getByText("51–100 of 230 items")).toBeInTheDocument();
    for (const control of screen.getAllByRole("button")) {
      expect(control).toBeDisabled();
      await user.click(control);
    }
    expect(previous).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();

    rerender(<PagePager {...props} disabled />);
    expect(screen.queryByText("Loading…")).toBeNull();
    for (const control of screen.getAllByRole("button")) {
      expect(control).toBeDisabled();
      await user.click(control);
    }
    expect(previous).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();

    rerender(<PagePager {...props} updating />);
    expect(screen.getByText("Updating…")).toHaveAttribute("role", "status");
    await user.click(screen.getByRole("button", { name: "Previous" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(previous).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledOnce();
  });

  it.each(["loading", "disabled"] as const)(
    "blocks mouse, keyboard and alternate link activation while %s",
    async (state) => {
      const user = userEvent.setup();
      render(
        <PagePager
          start={51}
          shown={50}
          total={230}
          previousHref="/records?page=1"
          nextHref="/records?page=3"
          {...{ [state]: true }}
        />,
      );
      for (const link of screen.getAllByRole("link")) {
        expect(link).toHaveAttribute("aria-disabled", "true");
        expect(link).toHaveAttribute("tabindex", "-1");
        expect(fireEvent.click(link)).toBe(false);
        expect(fireEvent.click(link, { ctrlKey: true })).toBe(false);
        expect(
          fireEvent(
            link,
            new MouseEvent("auxclick", {
              bubbles: true,
              cancelable: true,
              button: 1,
            }),
          ),
        ).toBe(false);
        expect(fireEvent.contextMenu(link)).toBe(false);
        expect(fireEvent.dragStart(link)).toBe(false);
        expect(fireEvent.keyDown(link, { key: "Enter" })).toBe(false);
        expect(fireEvent.keyDown(link, { key: " " })).toBe(false);
      }
      await user.tab();
      expect(document.activeElement).toBe(document.body);
    },
  );

  it("preserves the same focused router link from Enter through loading and the last page", async () => {
    const user = userEvent.setup();
    const navigation = vi.fn();
    let finish: () => void = () => {};
    let begin: () => void = () => {};
    function RouterLink(props: LinkProps) {
      return (
        <a
          {...props}
          onClick={(event) => {
            event.preventDefault();
            navigation(props.href);
            begin();
          }}
        />
      );
    }
    function Example() {
      const [page, setPage] = useState(0);
      const [loading, setLoading] = useState(false);
      begin = () => setLoading(true);
      finish = () => {
        setPage((current) => current + 1);
        setLoading(false);
      };
      return (
        <LinkProvider component={RouterLink}>
          <PagePager
            start={page * 50 + 1}
            shown={50}
            total={150}
            previousHref={page > 0 ? `/records?page=${page}` : undefined}
            nextHref={page < 2 ? `/records?page=${page + 2}` : undefined}
            loading={loading}
          />
        </LinkProvider>
      );
    }
    render(<Example />);
    const next = screen.getByRole("link", { name: "Next" });
    next.focus();
    await user.keyboard("{Enter}");
    expect(navigation).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Next" })).toBe(next);
    expect(next).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(navigation).toHaveBeenCalledTimes(1);
    act(() => finish());
    expect(next).toHaveFocus();
    expect(next).toHaveAttribute("href", "/records?page=3");
    expect(screen.getByRole("status")).toHaveTextContent("51–100 of 150 items");
    await user.keyboard("{Enter}");
    expect(navigation).toHaveBeenCalledTimes(2);
    act(() => finish());
    expect(screen.getByRole("link", { name: "Next" })).toBe(next);
    expect(next).toHaveFocus();
    expect(next).toHaveAttribute("aria-disabled", "true");
    await user.keyboard("{Enter}");
    expect(navigation).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("status")).toHaveTextContent(
      "101–150 of 150 items",
    );
  });

  it("leaves enabled modifier clicks, middle clicks and context menus native", () => {
    render(
      <PagePager
        start={51}
        shown={50}
        total={230}
        previousHref="#previous"
        nextHref="#next"
      />,
    );
    const next = screen.getByRole("link", { name: "Next" });
    expect(fireEvent.click(next, { ctrlKey: true })).toBe(true);
    expect(fireEvent.click(next, { metaKey: true })).toBe(true);
    expect(
      fireEvent(
        next,
        new MouseEvent("auxclick", {
          bubbles: true,
          cancelable: true,
          button: 1,
        }),
      ),
    ).toBe(true);
    expect(fireEvent.contextMenu(next)).toBe(true);
    expect(fireEvent.dragStart(next)).toBe(true);
  });

  it("handles empty and singular results and irregular nouns", () => {
    const { rerender } = render(
      <PagePager start={0} shown={0} total={0} noun={["entry", "entries"]} />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("0 of 0 entries");
    for (const control of screen.getAllByRole("button"))
      expect(control).toBeDisabled();
    rerender(
      <PagePager start={1} shown={1} total={1} noun={["entry", "entries"]} />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("1–1 of 1 entry");
  });

  it("honors explicit bounds and disables controls without destinations", () => {
    const { rerender } = render(
      <PagePager
        start={51}
        shown={50}
        total={230}
        previousHref="/records?page=1"
        nextHref="/records?page=3"
        hasPrevious={false}
        hasNext={false}
      />,
    );
    for (const control of screen.getAllByRole("link"))
      expect(control).toHaveAttribute("aria-disabled", "true");
    rerender(<PagePager start={51} shown={50} total={230} />);
    for (const control of screen.getAllByRole("button"))
      expect(control).toBeDisabled();
  });
});
