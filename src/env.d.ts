/**
 * Type augmentation for `API_MODE=msw` dev mode (IMPL-0002 Phase 5).
 *
 * `vite/client` declares `import.meta.env` permissively as a string
 * record, and `@types/node` declares `process.env` similarly. This
 * file pins the two flags we read in `setup.ts` and `entry.client.tsx`
 * to the exact union we expect — a typo at the call site (e.g.,
 * `VITE_API_MODE === "MSW"`) will fail typecheck instead of silently
 * leaving MSW disabled.
 */

interface ImportMetaEnv {
  readonly VITE_API_MODE?: "msw";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare namespace NodeJS {
  interface ProcessEnv {
    readonly API_MODE?: "msw";
  }
}
