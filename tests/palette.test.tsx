import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { CommandPalette } from "../src/components/CommandPalette";
import type {
  PaletteItem,
  PaletteSource,
} from "../src/components/CommandPalette";

const item = (label: string): PaletteItem => ({
  id: label,
  label,
  onSelect: vi.fn(),
});
function pending<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

describe("palette search and feedback", () => {
  it.each(["No results", "Nothing matches your search"])(
    "announces %s through the same live region when a query has no matches",
    async (emptyText) => {
      const user = userEvent.setup();
      render(
        <CommandPalette
          open
          onClose={vi.fn()}
          emptyText={emptyText}
          sources={[
            { id: "actions", title: "Actions", items: [item("Settings")] },
          ]}
        />,
      );
      const status = screen.getByRole("status");
      expect(status).toHaveTextContent("1 results.");
      await user.type(screen.getByRole("combobox"), "unmatched");
      expect(screen.getByRole("status")).toBe(status);
      expect(status).toHaveTextContent(emptyText);
      expect(
        screen.getByRole("listbox").querySelector('[role="status"]'),
      ).toBeNull();
      expect(screen.getByRole("listbox")).toHaveTextContent(emptyText);
      await user.clear(screen.getByRole("combobox"));
      expect(screen.getByRole("status")).toBe(status);
      expect(status).toHaveTextContent("1 results.");
    },
  );

  it("expands results with mouse/keyboard without losing focus and resets on query change", async () => {
    const user = userEvent.setup();
    const close = vi.fn();
    render(
      <CommandPalette
        open
        onClose={close}
        sources={[
          {
            id: "actions",
            title: "Actions",
            limit: 1,
            items: [
              item("Open settings"),
              item("Open accounts"),
              item("Open help"),
            ],
          },
        ]}
      />,
    );
    const input = screen.getByRole("combobox");
    expect(screen.getAllByRole("option")).toHaveLength(2);
    await user.click(
      screen.getByRole("option", { name: "Show all 3 Actions" }),
    );
    expect(screen.getAllByRole("option")).toHaveLength(3);
    expect(input).toHaveFocus();
    expect(close).not.toHaveBeenCalled();
    await user.type(input, "open");
    expect(
      screen.getByRole("option", { name: "Show all 3 Actions" }),
    ).toBeInTheDocument();
    await user.keyboard("{ArrowDown}{Enter}");
    expect(screen.getAllByRole("option")).toHaveLength(3);
    expect(input).toHaveFocus();
  });

  it("reports independent loading/errors and retries only the failed remote source", async () => {
    const user = userEvent.setup();
    const first = pending<readonly PaletteItem[]>();
    const failed = pending<readonly PaletteItem[]>();
    const retried = pending<readonly PaletteItem[]>();
    const searchA = vi.fn(() => first.promise);
    const searchB = vi
      .fn()
      .mockReturnValueOnce(failed.promise)
      .mockReturnValueOnce(retried.promise);
    render(
      <CommandPalette
        open
        onClose={vi.fn()}
        debounceMs={0}
        sources={[
          { id: "a", title: "People", minQuery: 0, search: searchA },
          { id: "b", title: "Projects", minQuery: 0, search: searchB },
        ]}
      />,
    );
    await waitFor(() => expect(searchB).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Loading People… Loading Projects…",
    );
    await act(async () => {
      first.resolve([item("Alice")]);
      failed.reject(new Error("offline"));
    });
    expect(screen.getByRole("option", { name: "Alice" })).toBeInTheDocument();
    const retry = screen.getByRole("option", { name: "Retry Projects" });
    expect(retry).toHaveAccessibleDescription(
      "Could not search Projects. Try again.",
    );
    await user.click(retry);
    expect(screen.getByRole("combobox")).toHaveFocus();
    await waitFor(() => expect(searchB).toHaveBeenCalledTimes(2));
    expect(searchA).toHaveBeenCalledTimes(1);
    await act(async () => retried.resolve([item("Workbench")]));
    expect(
      screen.getByRole("option", { name: "Workbench" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Retry Projects" })).toBeNull();
  });

  it.each([
    { externalFailed: false, remoteFailed: true },
    { externalFailed: true, remoteFailed: false },
    { externalFailed: true, remoteFailed: true },
  ])(
    "retries the failed operations of a mixed source ($externalFailed external, $remoteFailed remote)",
    async ({ externalFailed, remoteFailed }) => {
      const user = userEvent.setup();
      const externalRetry = vi.fn();
      const search = vi
        .fn<NonNullable<PaletteSource["search"]>>()
        .mockResolvedValue([item("Remote result")]);
      if (remoteFailed) search.mockRejectedValueOnce(new Error("offline"));
      function Host() {
        const [externalError, setExternalError] = useState(
          externalFailed ? "External refresh failed." : undefined,
        );
        return (
          <CommandPalette
            open
            onClose={vi.fn()}
            debounceMs={0}
            sources={[
              {
                id: "mixed",
                title: "Mixed",
                minQuery: 0,
                search,
                items: [item("Cached result")],
                error: externalError,
                onRetry: () => {
                  externalRetry();
                  setExternalError(undefined);
                },
              },
            ]}
          />
        );
      }
      render(<Host />);
      const retry = await screen.findByRole("option", { name: "Retry Mixed" });
      const messages = [
        ...(externalFailed ? ["External refresh failed."] : []),
        ...(remoteFailed ? ["Could not search Mixed. Try again."] : []),
      ];
      expect(retry).toHaveAccessibleDescription(messages.join(" "));
      await user.click(retry);
      await waitFor(() =>
        expect(search).toHaveBeenCalledTimes(remoteFailed ? 2 : 1),
      );
      expect(externalRetry).toHaveBeenCalledTimes(externalFailed ? 1 : 0);
      await waitFor(() =>
        expect(
          screen.queryByRole("option", { name: "Retry Mixed" }),
        ).toBeNull(),
      );
      expect(
        screen.getByRole("option", { name: "Cached result" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("option", { name: "Remote result" }),
      ).toBeInTheDocument();
      expect(screen.getByRole("combobox")).toHaveFocus();
    },
  );

  it("does not offer a remote retry for an external error without a retry handler", async () => {
    const search = vi
      .fn<NonNullable<PaletteSource["search"]>>()
      .mockResolvedValue([item("Remote result")]);
    render(
      <CommandPalette
        open
        onClose={vi.fn()}
        debounceMs={0}
        sources={[
          {
            id: "mixed",
            title: "Mixed",
            minQuery: 0,
            search,
            error: "External refresh failed.",
          },
        ]}
      />,
    );
    await screen.findByRole("option", { name: "Remote result" });
    expect(screen.getByRole("status")).toHaveTextContent(
      "External refresh failed.",
    );
    expect(screen.queryByRole("option", { name: "Retry Mixed" })).toBeNull();
    expect(search).toHaveBeenCalledOnce();
  });

  it("removes old query results and ignores out-of-order responses from a source ignoring abort", async () => {
    const requests: {
      signal: AbortSignal;
      result: ReturnType<typeof pending<readonly PaletteItem[]>>;
    }[] = [];
    const search = vi.fn((_q: string, signal: AbortSignal) => {
      const result = pending<readonly PaletteItem[]>();
      requests.push({ signal, result });
      return result.promise;
    });
    render(
      <CommandPalette
        open
        onClose={vi.fn()}
        debounceMs={0}
        sources={[{ id: "remote", title: "Results", search }]}
      />,
    );
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "old" } });
    await waitFor(() => expect(requests).toHaveLength(1));
    await act(async () => requests[0]!.result.resolve([item("Old result")]));
    fireEvent.change(input, { target: { value: "next" } });
    expect(screen.queryByRole("option", { name: "Old result" })).toBeNull();
    await waitFor(() => expect(requests).toHaveLength(2));
    fireEvent.change(input, { target: { value: "newest" } });
    await waitFor(() => expect(requests).toHaveLength(3));
    expect(requests[1]!.signal.aborted).toBe(true);
    await act(async () => requests[2]!.result.resolve([item("Newest result")]));
    await act(async () => requests[1]!.result.resolve([item("Late result")]));
    expect(
      screen.getAllByRole("option").map((node) => node.textContent),
    ).toEqual(["Newest result"]);
  });

  it("retains externally cached items and accepts a source-owned retry", async () => {
    const user = userEvent.setup();
    const retry = vi.fn();
    const source: PaletteSource = {
      id: "cached",
      title: "Cached",
      items: [item("Available")],
      error: "Refresh failed",
      onRetry: retry,
    };
    const { rerender } = render(
      <CommandPalette open onClose={vi.fn()} sources={[source]} />,
    );
    await user.click(screen.getByRole("option", { name: "Retry Cached" }));
    expect(retry).toHaveBeenCalledOnce();
    expect(screen.getByRole("combobox")).toHaveFocus();
    rerender(
      <CommandPalette
        open
        onClose={vi.fn()}
        sources={[{ ...source, loading: true, error: undefined }]}
      />,
    );
    expect(
      screen.getByRole("option", { name: "Available" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Loading Cached…");
    expect(screen.queryByRole("option", { name: "Retry Cached" })).toBeNull();
  });
});

describe("application-owned palette steps", () => {
  it("supports controlled queries, rich rows, drill-down, Backspace and keyboard back activation", async () => {
    const user = userEvent.setup();
    const selected = vi.fn();
    function Host() {
      const [query, setQuery] = useState("");
      const [step, setStep] = useState(0);
      const [open, setOpen] = useState(true);
      const go = (next: number) => {
        setStep(next);
        setQuery("");
      };
      const items: PaletteItem[] =
        step === 0
          ? [
              {
                id: "review",
                label: "Review branch",
                keepOpen: true,
                onSelect: () => go(1),
              },
            ]
          : step === 1
            ? [
                {
                  id: "repo",
                  label: "Owner / Repository",
                  keepOpen: true,
                  icon: <svg data-testid="rich-icon" aria-hidden="true" />,
                  renderLabel: (q) => (
                    <>
                      <span>Owner / </span>
                      <strong data-query={q}>Repository</strong>
                    </>
                  ),
                  hint: <em>Private</em>,
                  onSelect: () => go(2),
                },
              ]
            : [{ id: "branch", label: "feature", onSelect: selected }];
      return (
        <CommandPalette
          open={open}
          onClose={() => setOpen(false)}
          query={query}
          onQueryChange={setQuery}
          step={
            step
              ? {
                  id: String(step),
                  title: step === 1 ? "Choose repository" : "Choose branch",
                  onBack: () => go(step - 1),
                }
              : undefined
          }
          sources={[{ id: "step", title: "Choose", items }]}
        />
      );
    }
    render(<Host />);
    const input = screen.getByRole("combobox");
    await user.type(input, "review");
    await user.keyboard("{Enter}");
    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
    const repository = screen.getByRole("option", {
      name: "Owner / Repository",
    });
    expect(repository.querySelector("strong")).toHaveTextContent("Repository");
    expect(screen.getByTestId("rich-icon")).toBeInTheDocument();
    expect(repository.querySelector("em")).toHaveTextContent("Private");
    expect(screen.getByRole("status")).toHaveTextContent("1 results.");
    await user.type(input, "repo");
    expect(repository.querySelector("strong")).toHaveAttribute(
      "data-query",
      "repo",
    );
    await user.keyboard("{Backspace}");
    expect(input).toHaveValue("rep");
    expect(screen.getByText("Choose repository")).toBeInTheDocument();
    await user.clear(input);
    await user.keyboard("{Backspace}");
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
    await user.keyboard("{Enter}{Enter}");
    expect(screen.getByText("Choose branch")).toBeInTheDocument();
    screen.getByRole("button", { name: "Back" }).focus();
    await user.keyboard("{Enter}");
    expect(screen.getByText("Choose repository")).toBeInTheDocument();
    expect(selected).not.toHaveBeenCalled();
    expect(input).toHaveFocus();
    await user.keyboard("{Enter}{Enter}");
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(selected).toHaveBeenCalledOnce());
  });

  it("isolates searches between step identities with the same source id and query", async () => {
    const old = pending<readonly PaletteItem[]>();
    const current = pending<readonly PaletteItem[]>();
    const oldSearch = vi.fn(() => old.promise);
    const newSearch = vi.fn(() => current.promise);
    const props = {
      open: true,
      onClose: vi.fn(),
      query: "same",
      debounceMs: 0,
    };
    const { rerender } = render(
      <CommandPalette
        {...props}
        step={{ id: "repo-1", title: "First", onBack: vi.fn() }}
        sources={[{ id: "branches", title: "Branches", search: oldSearch }]}
      />,
    );
    await waitFor(() => expect(oldSearch).toHaveBeenCalledOnce());
    rerender(
      <CommandPalette
        {...props}
        step={{ id: "repo-2", title: "Second", onBack: vi.fn() }}
        sources={[{ id: "branches", title: "Branches", search: newSearch }]}
      />,
    );
    await waitFor(() => expect(newSearch).toHaveBeenCalledOnce());
    await act(async () => current.resolve([item("Second branch")]));
    await act(async () => old.resolve([item("First branch")]));
    expect(
      screen.getAllByRole("option").map((node) => node.textContent),
    ).toEqual(["Second branch"]);
  });

  it("ignores Enter and Backspace during IME composition", () => {
    const back = vi.fn();
    const select = vi.fn();
    render(
      <CommandPalette
        open
        onClose={vi.fn()}
        step={{ id: "nested", title: "Nested", onBack: back }}
        sources={[
          {
            id: "one",
            title: "One",
            items: [
              { id: "one", label: "One", keepOpen: true, onSelect: select },
            ],
          },
        ]}
      />,
    );
    const input = screen.getByRole("combobox");
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    fireEvent.keyDown(input, { key: "Backspace", keyCode: 229 });
    expect(back).not.toHaveBeenCalled();
    expect(select).not.toHaveBeenCalled();
  });
});
