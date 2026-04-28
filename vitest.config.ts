import { defineConfig } from "vitest/config";

/**
 * Mirrors donaldgifford/design-system/vitest.config.ts so promoted
 * candidate tests run as-is on the destination. Differences:
 * - Adds `setupFiles` for @testing-library/jest-dom matchers (RTL).
 * - Coverage thresholds dropped until the portal has source code to
 *   meaningfully cover; re-add per Phase 5 / 6.
 */
export default defineConfig({
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}", "src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.{ts,tsx}", "src/**/index.ts"],
    },
  },
});
