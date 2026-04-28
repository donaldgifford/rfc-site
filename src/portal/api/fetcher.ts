import { getApiUrl } from "./config";

/**
 * Custom fetch mutator for orval (`httpClient: "fetch"`).
 *
 * orval's fetch mode generates call sites of the form:
 *
 *     rfcApiFetcher<MyResponse>(getMyUrl(params), { ...options, method: "GET" })
 *
 * The mutator's job is therefore narrow: prepend the rfc-api base URL,
 * dispatch via the platform `fetch`, and return `{ data, status, headers }`
 * — orval typed `MyResponse` as a discriminated union of those shapes.
 *
 * Behaviour:
 *
 * - Concatenates the relative URL onto `getApiUrl()`.
 * - Forces `accept: application/json, application/problem+json` so the
 *   server's RFC 7807 error envelope is selected for non-2xx responses.
 * - Returns a `{ data, status, headers }` triple regardless of status:
 *   the discriminated-union return type lets the consuming page narrow
 *   on `status` to know which shape `data` has. Network errors throw
 *   so TanStack Query's `error` channel can surface them.
 * - 204 No Content returns `data: null` cast to the union so void
 *   operations typecheck.
 */

export interface RfcApiResponse<T> {
  readonly data: T;
  readonly status: number;
  readonly headers: Headers;
}

export async function rfcApiFetcher<T>(url: string, init: RequestInit = {}): Promise<T> {
  const baseUrl = getApiUrl();
  const target = new URL(url, baseUrl);

  const headers = new Headers(init.headers);
  if (!headers.has("accept")) {
    headers.set("accept", "application/json, application/problem+json");
  }
  if (init.body !== undefined && init.body !== null && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const response = await fetch(target, { ...init, headers });

  let data: unknown = null;
  if (response.status !== 204) {
    const text = await response.text();
    if (text.length > 0) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }
  }

  return {
    data,
    status: response.status,
    headers: response.headers,
  } as T;
}
