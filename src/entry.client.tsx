/**
 * Custom client entry — overrides RR7's auto-generated default to
 * boot the MSW worker before hydration when `VITE_API_MODE=msw`
 * (IMPL-0002 Phase 5).
 *
 * The worker has to be `start()`-ed before any `fetch` resolves so the
 * very first hydrated query is intercepted, which means it must run
 * before `hydrateRoot`. A side-effect module would be too late — by
 * the time it executes, hydration has already kicked off.
 *
 * In production builds (`MODE !== "development"`) and in any dev run
 * without the flag, the dynamic `await import("./portal/api/msw/browser")`
 * is dead-code-eliminated by Vite's tree-shaker because both branches
 * of the guard are statically analyzable. PLAN-0001 §Approach
 * documents the rationale.
 */

import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";

async function enableMocking(): Promise<void> {
  if (import.meta.env.MODE !== "development") return;
  if (import.meta.env.VITE_API_MODE !== "msw") return;
  const { worker } = await import("./portal/api/msw/browser");
  await worker.start({ onUnhandledRequest: "bypass" });
}

void enableMocking().then(() => {
  startTransition(() => {
    hydrateRoot(
      document,
      <StrictMode>
        <HydratedRouter />
      </StrictMode>,
    );
  });
});
