import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { handlers } from "../../src/portal/api/msw/handlers";

/**
 * Shared MSW server for API integration tests.
 *
 * Mounts the same handlers used by `API_MODE=msw` dev mode (IMPL-0002
 * Phase 3 / 4) so tests exercise real fixture-backed responses by
 * default. Per-test overrides go through `server.use(...)` — typically
 * either a `mockProblem(...)` for error-path injection or an inline
 * `http.get(...)` when a test needs to assert request shape.
 *
 * Lifecycle is wired by `setupMswLifecycle(server)` in each test file
 * so handler overrides don't leak between tests.
 */
export const server = setupServer(...handlers);

/**
 * Override any URL pattern with a 7807 problem+json response. Use this
 * for explicit error-path tests where the default fixture-backed
 * handler would otherwise return a 200.
 *
 * Example:
 *
 *   mockProblem("*\/api/v1/:type/:id", 500, {
 *     type: "/problems/internal",
 *     status: 500,
 *     request_id: "01HTZ-…",
 *   });
 */
export function mockProblem(
  urlPattern: string,
  status: number,
  body: Record<string, unknown>,
): void {
  server.use(
    http.get(urlPattern, () =>
      HttpResponse.json(body, {
        status,
        headers: { "content-type": "application/problem+json" },
      }),
    ),
  );
}
