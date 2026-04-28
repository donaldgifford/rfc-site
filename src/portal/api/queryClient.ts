import { QueryClient } from "@tanstack/react-query";

/**
 * Default options resolved per IMPL-0001 §Phase 3 open questions:
 *
 * - `staleTime: 5 minutes` — content in rfc-api is reviewed and merged,
 *   not high-frequency, so 5 minutes balances staleness vs request
 *   chatter on tab switches.
 * - `refetchOnWindowFocus: false` — a docs portal isn't realtime; the
 *   default refetch-on-focus is just noise.
 * - `retry: 1` — one retry papers over transient blips without masking
 *   real outages.
 *
 * Override per-query as needed; these are sensible v1 defaults.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });
}
