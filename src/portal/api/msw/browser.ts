/**
 * MSW worker (browser) for `API_MODE=msw` dev mode (IMPL-0002 Phase 3).
 *
 * Importing this file in a node context throws — the SSR entry is
 * `./server.ts`. Both files exist so Vite's SSR/client split surfaces
 * a clear error if a wire crosses, instead of a silent "request not
 * intercepted".
 */

import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

if (typeof window === "undefined") {
  throw new Error(
    "src/portal/api/msw/browser.ts was imported in a node context. " +
      "Use src/portal/api/msw/server.ts on the SSR side.",
  );
}

export const worker = setupWorker(...handlers);
