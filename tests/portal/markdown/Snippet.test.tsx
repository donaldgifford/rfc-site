import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";

import { Snippet } from "../../../src/portal/markdown/Snippet";

describe("<Snippet>", () => {
  it("preserves allowlisted inline tags (<em>, <strong>, <mark>, <code>)", () => {
    const { container } = render(
      <Snippet html="<em>em</em> <strong>strong</strong> <mark>mark</mark> <code>code</code>" />,
    );
    expect(container.querySelector("em")).not.toBeNull();
    expect(container.querySelector("strong")).not.toBeNull();
    expect(container.querySelector("mark")).not.toBeNull();
    expect(container.querySelector("code")).not.toBeNull();
  });

  it("strips disallowed tags (<a>, <img>, <script>, <p>)", () => {
    const { container } = render(
      <Snippet html='before<a href="evil">link</a><img src="x"><script>alert(1)</script><p>para</p>after' />,
    );
    expect(container.querySelector("a")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("p")).toBeNull();
    // Inner text of stripped tags is preserved.
    expect(container.textContent).toContain("link");
    expect(container.textContent).toContain("para");
    expect(container.textContent).not.toContain("alert");
  });

  it("strips unknown attributes from allowlisted tags", () => {
    const { container } = render(
      <Snippet html='<mark onclick="alert(1)" data-foo="bar">match</mark>' />,
    );
    const mark = container.querySelector("mark");
    expect(mark).not.toBeNull();
    expect(mark?.getAttribute("onclick")).toBeNull();
    expect(mark?.getAttribute("data-foo")).toBeNull();
  });

  it("renders the plain-text fallback when html is unset", () => {
    const { container } = render(<Snippet fallbackTerms={["alpha", "beta", "gamma"]} />);
    expect(container.textContent).toBe("alpha, beta, gamma");
    expect(container.querySelector(".snippet--fallback")).not.toBeNull();
  });

  it("renders the plain-text fallback when html is an empty string", () => {
    const { container } = render(<Snippet html="" fallbackTerms={["alpha"]} />);
    expect(container.textContent).toBe("alpha");
  });

  it("renders nothing when neither html nor fallbackTerms are provided", () => {
    const { container } = render(<Snippet />);
    expect(container.firstChild).toBeNull();
  });
});
