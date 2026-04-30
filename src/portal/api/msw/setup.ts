/**
 * Side-effect SSR boot for `API_MODE=msw` dev mode (IMPL-0002 Phase 5).
 *
 * Imported at the top of `src/root.tsx`. On the server side (and only
 * when `API_MODE=msw` is set) it dynamically imports the MSW node
 * `setupServer` instance and starts intercepting `fetch` calls before
 * the first route loader runs.
 *
 * Why a side-effect module instead of overriding `entry.server.tsx`:
 *
 * - RR7 framework mode auto-generates `entry.server.tsx`. Overriding
 *   it locks us into mirroring whatever default RR7 ships per release.
 * - A side-effect import in `root.tsx` runs once at module load (before
 *   any route loader resolves) and is trivial to remove if MSW is
 *   ever swapped for a different stub.
 * - Dynamic `await import("./server")` keeps `msw/node` out of the
 *   non-MSW SSR bundle: Vite externalizes the import, so a `bun run
 *   build` followed by `bun run start` (the production path) does
 *   not load any MSW code at all.
 *
 * The browser side is bootstrapped separately in `src/entry.client.tsx`
 * — the worker has to start *before* hydration, which can't be done
 * from a side-effect module that runs after the bundle is parsed.
 */

// Two build-time guards keep MSW out of production artefacts entirely:
//
//   - `import.meta.env.SSR` — `false` in the client bundle, so the
//     branch (and its dynamic import) is dead-code-eliminated from
//     the browser graph. A runtime `typeof window === "undefined"`
//     check is too late: Vite emits the chunk regardless and the
//     browser preloader fetches it.
//
//   - `import.meta.env.DEV` — `false` in production builds (both
//     client and SSR), so `react-router build` also DCE's the dynamic
//     import. Only `react-router dev` and `dev:msw` keep it live.
//     This is the SSR-side equivalent of MSW's recommended
//     `import.meta.env.MODE !== "development"` guard for the worker.
//
// The runtime `process.env.API_MODE` check then decides whether to
// actually start the server. Dev without the flag pays only the cost
// of the if-statement.
if (import.meta.env.SSR && import.meta.env.DEV && process.env.API_MODE === "msw") {
  const { server } = await import("./server");
  server.listen({ onUnhandledRequest: "bypass" });
}
