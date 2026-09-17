import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { attachCrossDocClickHandler } from "../../../src/portal/markdown/cross-doc-nav";

function setupRoot(): { root: HTMLElement; cleanup: () => void } {
  const root = document.createElement("div");
  document.body.appendChild(root);
  return {
    root,
    cleanup: () => {
      document.body.removeChild(root);
    },
  };
}

function injectAnchor(parent: HTMLElement, html: string): HTMLAnchorElement {
  parent.innerHTML = html;
  const anchor = parent.querySelector("a");
  if (anchor === null) throw new Error("test fixture did not produce <a>");
  return anchor;
}

describe("attachCrossDocClickHandler", () => {
  let navigate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    navigate = vi.fn();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("intercepts a plain click on [data-cross-doc='1'] and calls navigate(href)", () => {
    const { root, cleanup } = setupRoot();
    const anchor = injectAnchor(root, '<a href="/rfc/0001" data-cross-doc="1">link</a>');
    const detach = attachCrossDocClickHandler(root, navigate);

    const event = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    const prevented = !anchor.dispatchEvent(event);

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith("/rfc/0001");
    expect(prevented).toBe(true);
    detach();
    cleanup();
  });

  it("does not intercept anchors without data-cross-doc", () => {
    const { root, cleanup } = setupRoot();
    const anchor = injectAnchor(root, '<a href="/rfc/0001">link</a>');
    const detach = attachCrossDocClickHandler(root, navigate);

    anchor.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));

    expect(navigate).not.toHaveBeenCalled();
    detach();
    cleanup();
  });

  it("does not intercept modifier-key clicks (meta/ctrl/shift/alt)", () => {
    const { root, cleanup } = setupRoot();
    const anchor = injectAnchor(root, '<a href="/rfc/0001" data-cross-doc="1">link</a>');
    const detach = attachCrossDocClickHandler(root, navigate);

    for (const modifier of ["metaKey", "ctrlKey", "shiftKey", "altKey"] as const) {
      anchor.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          button: 0,
          [modifier]: true,
        }),
      );
    }

    expect(navigate).not.toHaveBeenCalled();
    detach();
    cleanup();
  });

  it("does not intercept middle/right clicks", () => {
    const { root, cleanup } = setupRoot();
    const anchor = injectAnchor(root, '<a href="/rfc/0001" data-cross-doc="1">link</a>');
    const detach = attachCrossDocClickHandler(root, navigate);

    anchor.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 1 }));
    anchor.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 2 }));

    expect(navigate).not.toHaveBeenCalled();
    detach();
    cleanup();
  });

  it("intercepts clicks on descendants of the cross-doc anchor (e.g. <strong>text</strong>)", () => {
    const { root, cleanup } = setupRoot();
    root.innerHTML = '<a href="/rfc/0042" data-cross-doc="1"><strong>nested</strong></a>';
    const strong = root.querySelector("strong");
    if (strong === null) throw new Error("nested fixture missing");
    const detach = attachCrossDocClickHandler(root, navigate);

    strong.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));

    expect(navigate).toHaveBeenCalledWith("/rfc/0042");
    detach();
    cleanup();
  });

  it("ignores anchors with empty or missing href", () => {
    const { root, cleanup } = setupRoot();
    root.innerHTML =
      '<a data-cross-doc="1">no-href</a><a href="" data-cross-doc="1">empty-href</a>';
    const detach = attachCrossDocClickHandler(root, navigate);

    for (const anchor of root.querySelectorAll("a")) {
      anchor.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
    }

    expect(navigate).not.toHaveBeenCalled();
    detach();
    cleanup();
  });

  it("returns a detach function that removes the listener", () => {
    const { root, cleanup } = setupRoot();
    const anchor = injectAnchor(root, '<a href="/rfc/0001" data-cross-doc="1">link</a>');
    const detach = attachCrossDocClickHandler(root, navigate);

    detach();
    anchor.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));

    expect(navigate).not.toHaveBeenCalled();
    cleanup();
  });

  it("ignores clicks where defaultPrevented is already set", () => {
    const { root, cleanup } = setupRoot();
    const anchor = injectAnchor(root, '<a href="/rfc/0001" data-cross-doc="1">link</a>');
    // Pre-handler that prevents default to short-circuit.
    anchor.addEventListener("click", (e) => {
      e.preventDefault();
    });
    const detach = attachCrossDocClickHandler(root, navigate);

    anchor.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));

    expect(navigate).not.toHaveBeenCalled();
    detach();
    cleanup();
  });
});
