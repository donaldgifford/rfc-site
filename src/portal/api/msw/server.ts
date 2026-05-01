/**
 * MSW server (node) for `API_MODE=msw` SSR + tests (IMPL-0002 Phase 3).
 *
 * Importing this file in a browser context throws — the worker entry
 * is `./browser.ts`. Both files exist so Vite's SSR/client split
 * surfaces a clear error if a wire crosses, instead of a silent
 * "request not intercepted".
 */

import { setupServer } from "msw/node";
import { handlers } from "./handlers";

if (typeof window !== "undefined") {
  throw new Error(
    "src/portal/api/msw/server.ts was imported in a browser context. " +
      "Use src/portal/api/msw/browser.ts on the client side.",
  );
}

export const server = setupServer(...handlers);
