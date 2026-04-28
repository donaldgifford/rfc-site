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
 * Per-test handlers still go through the helpers in
 * `tests/api/server.ts` (`mockGetDoc`, `mockListDocs`, `mockProblem`).
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
