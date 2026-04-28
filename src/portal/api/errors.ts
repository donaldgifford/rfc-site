/**
 * Error helpers for the rfc-api integration.
 *
 * The orval-generated call sites return a discriminated union of
 * `{ data, status, headers }` shapes. This module narrows that union
 * into something route loaders can throw to RR7's ErrorBoundary, and
 * surfaces the RFC 7807 sentinel + request_id per the integration
 * reference (`docs/integration/rfc-api-reference.md#error-contract`).
 */

export interface ProblemPayload {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly detail?: string;
  readonly instance?: string;
  readonly request_id?: string;
}

export type ProblemSentinel =
  | "not-found"
  | "invalid-input"
  | "conflict"
  | "upstream"
  | "unauthenticated"
  | "rate-limited"
  | "internal"
  | "unknown";

export function classifyProblem(problem: ProblemPayload | undefined): ProblemSentinel {
  if (!problem) return "unknown";
  const tail = problem.type.split("/").pop() ?? "";
  switch (tail) {
    case "not-found":
    case "invalid-input":
    case "conflict":
    case "upstream":
    case "unauthenticated":
    case "rate-limited":
    case "internal":
      return tail;
    default:
      return "unknown";
  }
}

export function isProblem(value: unknown): value is ProblemPayload {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<ProblemPayload>;
  return (
    typeof candidate.type === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.status === "number"
  );
}

/**
 * Convert an orval response (`{ data, status, headers }`) into a thrown
 * Response when status is non-2xx. RR7's ErrorBoundary picks up the
 * `Response` and renders the error page with the original status.
 *
 * The thrown Response carries the RFC 7807 payload as JSON so the
 * boundary can render `request_id`, sentinel-specific copy, etc.
 */
export function throwIfProblem<T extends { data: unknown; status: number; headers: Headers }>(
  response: T,
): asserts response is T & { status: 200 | 201 | 204 } {
  if (response.status >= 200 && response.status < 300) return;
  const problem: ProblemPayload = isProblem(response.data)
    ? response.data
    : {
        type: "about:blank",
        title: response.headers.get("x-error-title") ?? "Request failed",
        status: response.status,
      };
  // RR7 routes propagate `Response` through the ErrorBoundary path —
  // throwing a Response is the documented escape hatch from a loader.
  // eslint-disable-next-line @typescript-eslint/only-throw-error
  throw new Response(JSON.stringify(problem), {
    status: problem.status,
    headers: { "content-type": "application/problem+json" },
  });
}
