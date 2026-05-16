import { useCallback } from "react";
import { useSearchParams } from "react-router";
import type { Endpoint, OpenApiSpec } from "../../portal/openapi/loader";
import { findEndpoint } from "../../portal/openapi/loader";
import { ApiSidebar } from "./ApiSidebar";
import { EndpointDetail } from "./EndpointDetail";
import styles from "./ApiPage.module.css";

interface ApiPageProps {
  spec: OpenApiSpec;
  endpoints: readonly Endpoint[];
}

/**
 * `/api` reference page. Mockup §3729-3892 (View 4).
 *
 * 3-col grid (260px sidebar + 1fr content). Sidebar groups endpoints
 * by OpenAPI tag and tracks the active endpoint via `?endpoint=`. The
 * right column renders the selected endpoint's full detail (header,
 * try-it band, parameters, responses).
 *
 * No live execution — the try-it CTA is inert. Phase 4b ships visual
 * chrome; a future phase can pair this with an in-browser fetch using
 * the existing `rfcApiFetcher`.
 */
export function ApiPage({ spec, endpoints }: ApiPageProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedKey = searchParams.get("endpoint");
  const fallback = endpoints[0];
  const active = findEndpoint(endpoints, requestedKey) ?? fallback;

  const selectEndpoint = useCallback(
    (key: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("endpoint", key);
          return next;
        },
        { replace: false, preventScrollReset: true },
      );
    },
    [setSearchParams],
  );

  if (!active) {
    return (
      <div className={styles.layout}>
        <p className={styles.empty}>No endpoints in the spec.</p>
      </div>
    );
  }

  return (
    <div className={styles.layout}>
      <ApiSidebar
        spec={spec}
        endpoints={endpoints}
        activeKey={active.key}
        onSelect={selectEndpoint}
      />
      <EndpointDetail endpoint={active} />
    </div>
  );
}
