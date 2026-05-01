/**
 * Resolves the rfc-api base URL.
 *
 * Read from `RFC_API_URL` (Vite exposes via `import.meta.env`); falls back
 * to `http://localhost:8080` for local dev — matches the integration
 * reference's local-stack runbook (`docs/integration/rfc-api-reference.md`).
 *
 * Vite only exposes env vars prefixed with `VITE_*` to the client by
 * default, so `RFC_API_URL` is also read with the `VITE_` prefix when
 * the unprefixed form is not present. CI / SSR set the unprefixed form
 * via the standard process env.
 */

const DEFAULT_API_URL = "http://localhost:8080";

export function getApiUrl(): string {
  const env = import.meta.env as Record<string, string | undefined>;
  const fromImportMeta = env.RFC_API_URL ?? env.VITE_RFC_API_URL;
  if (typeof fromImportMeta === "string" && fromImportMeta.length > 0) {
    return fromImportMeta;
  }

  if (typeof process !== "undefined") {
    const fromProcess = process.env.RFC_API_URL;
    if (typeof fromProcess === "string" && fromProcess.length > 0) {
      return fromProcess;
    }
  }

  return DEFAULT_API_URL;
}
