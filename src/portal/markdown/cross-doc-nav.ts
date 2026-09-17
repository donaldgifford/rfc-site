import type { NavigateFunction } from "react-router";

/**
 * Cross-doc click interception for SSR'd Markdown (IMPL-0006 Phase 4 / OQ-2).
 *
 * The Markdown body lands in the DOM via `dangerouslySetInnerHTML`, so
 * cross-document anchors are raw `<a>` elements rather than RR7 `<Link>`
 * components. Without this helper, every cross-doc click would trigger a
 * full-page reload and discard the SPA shell.
 *
 * Behaviour: walks up from the click target looking for the closest
 * `<a data-cross-doc="1">` descendant of the article container. On a
 * plain click, `preventDefault` + dispatch via RR7's `navigate(href)`.
 * Modified clicks (ctrl/meta/shift/alt — "open in new tab", "save as",
 * etc.) and middle/right clicks pass through to the browser unchanged so
 * users keep full anchor semantics.
 *
 * Oxide's `<Content>` component renders the asciidoc tree via React
 * components, so their anchors are already RR7 `<Link>`s — they don't
 * need this. Our HTML-injection approach (chosen for cache simplicity)
 * pays for itself with this ~30-line helper. See IMPL-0006 §OQ-2.
 */

const SELECTOR = "a[data-cross-doc='1']";

export function attachCrossDocClickHandler(
  root: HTMLElement,
  navigate: NavigateFunction,
): () => void {
  function handleClick(event: MouseEvent): void {
    if (event.defaultPrevented) return;
    // Skip modified clicks so the browser keeps ownership of
    // open-in-new-tab / save-as / etc.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    // Only intercept primary button clicks. Middle / right click default
    // behaviour stays untouched.
    if (event.button !== 0) return;

    const target = event.target;
    if (!(target instanceof Element)) return;
    const anchor = target.closest<HTMLAnchorElement>(SELECTOR);
    if (anchor === null) return;
    // Defensive — element must actually be a child of the root we were
    // attached to. (`closest` walks the whole DOM upward.)
    if (!root.contains(anchor)) return;

    const href = anchor.getAttribute("href");
    if (href === null || href.length === 0) return;

    event.preventDefault();
    // `navigate` returns `void | Promise<void>` depending on RR7 version.
    // We don't need to await it — RR7 owns the transition lifecycle.
    void navigate(href);
  }

  root.addEventListener("click", handleClick);
  return () => {
    root.removeEventListener("click", handleClick);
  };
}
