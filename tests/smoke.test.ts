import { describe, expect, it } from "vitest";

// Trivial smoke test — confirms the vitest + jsdom config picks up
// `tests/**/*.test.ts`. Removed once Phase 3 ships the first generated-hook
// test against MSW handlers (see IMPL-0001 §Open Questions §Phase 1).
describe("smoke", () => {
  it("vitest is wired up", () => {
    expect(1).toBe(1);
  });
});
