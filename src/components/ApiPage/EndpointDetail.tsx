import type { Endpoint, OpenApiParameter, OpenApiResponse } from "../../portal/openapi/loader";
import { PathLine } from "./PathLine";
import styles from "./ApiPage.module.css";

interface EndpointDetailProps {
  endpoint: Endpoint;
}

/**
 * Right pane of the API page. Renders the selected endpoint's header,
 * try-it band (visual-only — defers live execution), and Path /
 * Query / Responses sections built from the OpenAPI spec.
 *
 * Mockup §1647-1822.
 */
export function EndpointDetail({ endpoint }: EndpointDetailProps) {
  const parameters = endpoint.operation.parameters;
  const pathParams = parameters.filter((p) => p.in === "path");
  const queryParams = parameters.filter((p) => p.in === "query");
  const responses = Object.entries(endpoint.operation.responses);

  return (
    <main className={styles.content}>
      <header className={styles.endpointHeader}>
        <p className={styles.eyebrow}>{endpoint.tag}</p>
        <h1 className={styles.title}>{endpoint.summary}</h1>
        <PathLine method={endpoint.method} path={endpoint.path} />
        {endpoint.description ? <p className={styles.description}>{endpoint.description}</p> : null}
      </header>

      <aside className={styles.tryIt} aria-label="Try it">
        <span className={styles.tryItLabel}>
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            aria-hidden="true"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
          Try it
        </span>
        <span className={styles.tryItAuth}>
          Visual reference — request execution lands in a follow-up phase.
        </span>
        <span className={styles.tryItCta} title="Live execution lands in a follow-up phase">
          send request →
        </span>
      </aside>

      {pathParams.length > 0 ? <ParamSection title="Path parameters" params={pathParams} /> : null}

      {queryParams.length > 0 ? (
        <ParamSection title="Query parameters" params={queryParams} />
      ) : null}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          Responses
          {responses.length > 0 ? (
            <span className={styles.sectionCount}>{responses.length}</span>
          ) : null}
        </h2>
        {responses.length === 0 ? (
          <p className={styles.empty}>No responses documented.</p>
        ) : (
          responses.map(([status, response]) => (
            <ResponseRow key={status} status={status} response={response} />
          ))
        )}
      </section>
    </main>
  );
}

interface ParamSectionProps {
  title: string;
  params: readonly OpenApiParameter[];
}

function ParamSection({ title, params }: ParamSectionProps) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>
        {title}
        <span className={styles.sectionCount}>{params.length}</span>
      </h2>
      {params.map((param) => (
        <ParamRow key={param.name} param={param} />
      ))}
    </section>
  );
}

interface ParamRowProps {
  param: OpenApiParameter;
}

function ParamRow({ param }: ParamRowProps) {
  const defaultValue = param.schema?.default;
  return (
    <div className={styles.paramRow}>
      <div className={styles.paramName}>
        <span>{param.name}</span>
        {param.required ? <span className={styles.requiredBadge}>required</span> : null}
      </div>
      <div className={styles.paramType}>{paramTypeLabel(param)}</div>
      <div className={styles.paramDesc}>
        {param.description ?? "—"}
        {defaultValue !== undefined ? (
          <span className={styles.paramDefault}>
            Default: <code>{JSON.stringify(defaultValue)}</code>
          </span>
        ) : null}
      </div>
    </div>
  );
}

interface ResponseRowProps {
  status: string;
  response: OpenApiResponse;
}

function ResponseRow({ status, response }: ResponseRowProps) {
  return (
    <div className={styles.responseRow}>
      <span className={[styles.responseCode, responseCodeClass(status)].filter(Boolean).join(" ")}>
        {status}
      </span>
      <span className={styles.responseDesc}>{response.description ?? ""}</span>
    </div>
  );
}

function paramTypeLabel(param: OpenApiParameter): string {
  const schema = param.schema;
  if (!schema?.type) return "—";
  if (schema.format && schema.format.length > 0) {
    return `${schema.type} · ${schema.format}`;
  }
  return schema.type;
}

function responseCodeClass(status: string): string | undefined {
  const code = Number(status);
  if (Number.isNaN(code)) return undefined;
  if (code >= 200 && code < 300) return styles.responseCodeOk;
  if (code >= 300 && code < 400) return styles.responseCodeRedir;
  if (code >= 400 && code < 500) return styles.responseCodeErr4;
  if (code >= 500) return styles.responseCodeErr5;
  return undefined;
}
