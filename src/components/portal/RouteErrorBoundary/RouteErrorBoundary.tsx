import { isRouteErrorResponse, useRouteError, Link } from "react-router";
import { classifyProblem, isProblem, type ProblemPayload } from "../../../portal/api/errors";
import styles from "./RouteErrorBoundary.module.css";

/**
 * Renders the portal error page for any thrown `Response` (RFC 7807
 * problem+json) coming out of a route loader or action.
 *
 * - `404` (`/problems/not-found`): renders a "doc not found" surface
 *   with a link back to the directory.
 * - `429` (`/problems/rate-limited`): "try again shortly" copy.
 * - everything else: generic surface with the title from the problem
 *   payload (or the status text), surfacing `request_id` so ops can
 *   correlate.
 */
export function RouteErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    const problem = parseProblem(error.data);
    const sentinel = classifyProblem(problem);
    const status = problem?.status ?? error.status;
    const title = problem?.title ?? error.statusText;

    if (sentinel === "not-found") {
      return (
        <main className={styles.shell}>
          <h1 className={styles.heading}>Document not found</h1>
          <p className={styles.lede}>
            {problem?.detail ?? "We couldn't find the document you were looking for."}
          </p>
          <p className={styles.actions}>
            <Link to="/" className={styles.link}>
              Back to the directory
            </Link>
          </p>
          {problem?.request_id ? <RequestIdFootnote requestId={problem.request_id} /> : null}
        </main>
      );
    }

    return (
      <main className={styles.shell}>
        <h1 className={styles.heading}>
          {String(status)} — {title}
        </h1>
        <p className={styles.lede}>{copyForSentinel(sentinel)}</p>
        <p className={styles.actions}>
          <Link to="/" className={styles.link}>
            Back to the directory
          </Link>
        </p>
        {problem?.request_id ? <RequestIdFootnote requestId={problem.request_id} /> : null}
      </main>
    );
  }

  return (
    <main className={styles.shell}>
      <h1 className={styles.heading}>Something went wrong</h1>
      <p className={styles.lede}>
        An unexpected error occurred. Try again, or head back to the directory.
      </p>
      <p className={styles.actions}>
        <Link to="/" className={styles.link}>
          Back to the directory
        </Link>
      </p>
    </main>
  );
}

function parseProblem(data: unknown): ProblemPayload | undefined {
  if (isProblem(data)) return data;
  if (typeof data === "string") {
    try {
      const parsed: unknown = JSON.parse(data);
      if (isProblem(parsed)) return parsed;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function copyForSentinel(sentinel: ReturnType<typeof classifyProblem>): string {
  switch (sentinel) {
    case "rate-limited":
      return "We're being rate-limited. Try again in a minute.";
    case "upstream":
      return "An upstream service is hiccuping. Try again shortly.";
    case "invalid-input":
      return "The request was malformed. This is likely a bug in rfc-site — please report it.";
    case "unauthenticated":
      return "You need to sign in to view this.";
    case "internal":
      return "Something broke on our side. Please report this with the request id below.";
    default:
      return "Something went wrong while loading this page.";
  }
}

function RequestIdFootnote({ requestId }: { requestId: string }) {
  return (
    <footer className={styles.footnote}>
      Request id: <code className={styles.requestId}>{requestId}</code>
    </footer>
  );
}
