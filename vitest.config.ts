import { defineConfig } from "vitest/config";

/**
 * Mirrors donaldgifford/design-system/vitest.config.ts so promoted
 * candidate tests run as-is on the destination. Differences:
 * - Adds `setupFiles` for @testing-library/jest-dom matchers (RTL).
 * - `resolve.dedupe` for react / react-dom — required while the
 *   design-system is consumed via `bun link`. The linked dist resolves
 *   `react` through node_modules, but without dedupe Vitest can wire
 *   two React instances (one per resolution root), producing the
 *   classic "Cannot read properties of null (reading 'useState')"
 *   crash. Safe to keep when consuming the published package.
 * - Coverage thresholds dropped until the portal has source code to
 *   meaningfully cover; re-add per Phase 5 / 6.
 */
export default defineConfig({
  resolve: {
    dedupe: ["react", "react-dom"],
  },
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
