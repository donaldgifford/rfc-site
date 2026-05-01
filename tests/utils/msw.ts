import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "../api/server";

/**
 * Shared MSW lifecycle for `tests/api/*.test.ts(x)`.
 *
 * Call `setupMswLifecycle()` once at the top of any test file that
 * hits the rfc-api surface. It boots the server, resets handlers
 * between tests, and tears down at the end — replacing the four-line
 * boilerplate every API test file used to repeat.
 *
 * Per-test overrides go through `server.use(...)` directly, or through
 * `mockProblem(urlPattern, status, body)` for 7807 error-path injection.
 */
export function setupMswLifecycle(): void {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: "error" });
  });

  afterEach(() => {
    server.resetHandlers();
  });

  afterAll(() => {
    server.close();
  });
}
