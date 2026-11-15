import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SyntaxTokens } from "../src";
import type { SyntaxLines } from "../src";

describe("SyntaxTokens", () => {
  it("preserves code text, indentation, blank lines and a trailing newline", () => {
    const lines: SyntaxLines = [
      [
        {
          content: "const",
          style: { color: "var(--wb-syntax-token-keyword)" },
        },
        { content: ' greeting = "hello & goodbye";', style: {} },
      ],
      [],
      [{ content: "\treturn greeting;  ", style: {} }],
      [],
    ];
    const { container } = render(
      <pre>
        <code>
          <SyntaxTokens lines={lines} />
        </code>
      </pre>,
    );
    expect(container.querySelector("code")?.textContent).toBe(
      'const greeting = "hello & goodbye";\n\n\treturn greeting;  \n',
    );
    expect(container.querySelector("span")?.style.color).toBe(
      "var(--wb-syntax-token-keyword)",
    );
  });

  it("keeps HTML-looking code and entities literal when rendering and updating", () => {
    const lines = [
      [{ content: '<img src=x onerror="alert(1)"> &lt;', style: {} }],
    ];
    const { container, rerender } = render(<SyntaxTokens lines={lines} />);
    expect(container.textContent).toBe(lines[0]![0]!.content);
    expect(container.querySelector("img")).toBeNull();
    rerender(
      <SyntaxTokens
        lines={[[{ content: "<script>alert(2)</script>", style: {} }]]}
      />,
    );
    expect(container.textContent).toBe("<script>alert(2)</script>");
    expect(container.querySelector("script")).toBeNull();
    rerender(<SyntaxTokens lines={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
