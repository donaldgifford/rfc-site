import { parse } from "yaml";
// Vite imports the raw YAML text at build time; no fs/runtime fetch needed.
// The query suffix is a Vite-specific convention: `?raw` ships the file's
// contents as a default-exported string. See `src/env.d.ts` for the
// `*.yaml?raw` module declaration.
import rawSpec from "../../../api/openapi.yaml?raw";

/**
 * Minimal OpenAPI 3.1 shape we care about for the `/api` reference page.
 *
 * Intentionally narrow: we don't model every OpenAPI feature, only the
 * subset the portal renders. Anything else from the spec passes through
 * untouched but isn't typed.
 */
export interface OpenApiSpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  paths: Record<string, OpenApiPath>;
  components?: {
    parameters?: Record<string, OpenApiParameter>;
    responses?: Record<string, OpenApiResponse>;
  };
}

export interface OpenApiPath {
  parameters?: OpenApiParameter[] | { $ref: string }[];
  get?: OpenApiOperation;
  post?: OpenApiOperation;
  put?: OpenApiOperation;
  patch?: OpenApiOperation;
  delete?: OpenApiOperation;
}

export interface OpenApiOperation {
  tags?: string[];
  summary?: string;
  description?: string;
  operationId?: string;
  parameters?: OpenApiParameter[] | { $ref: string }[];
  responses?: Record<string, OpenApiResponse | { $ref: string }>;
}

export interface OpenApiParameter {
  name: string;
  in: "path" | "query" | "header" | "cookie";
  description?: string;
  required?: boolean;
  schema?: { type?: string; format?: string; default?: unknown; example?: unknown };
}

export interface OpenApiResponse {
  description?: string;
}

export type HttpMethod = "get" | "post" | "put" | "patch" | "delete";

const HTTP_METHODS: readonly HttpMethod[] = ["get", "post", "put", "patch", "delete"];

export interface Endpoint {
  /** Stable identifier — `${method}:${path}`. Used as the URL ?endpoint key. */
  key: string;
  method: HttpMethod;
  path: string;
  tag: string;
  summary: string;
  description: string;
  /**
   * The operation with `$ref`s resolved and any path-level parameters
   * hoisted into `parameters` — callers can render it directly without
   * threading the parent spec for ref resolution.
   */
  operation: ResolvedOperation;
}

export interface ResolvedOperation {
  tags?: string[];
  summary?: string;
  description?: string;
  operationId?: string;
  parameters: OpenApiParameter[];
  responses: Record<string, OpenApiResponse>;
}

/**
 * Eagerly parse the spec at module load. Vite inlines the raw text at
 * build time, so this runs once per import — cheap, deterministic.
 */
let cachedSpec: OpenApiSpec | undefined;

export function loadSpec(): OpenApiSpec {
  if (cachedSpec) return cachedSpec;
  cachedSpec = parse(rawSpec) as OpenApiSpec;
  return cachedSpec;
}

/**
 * Flatten the spec's paths × methods into a single endpoint list ordered
 * by tag, then by method, then by path. Used by the sidebar.
 *
 * Resolves `$ref`s through `components.parameters` and `components.responses`
 * and hoists path-level parameters into each operation so callers don't
 * need to thread the parent spec for ref resolution.
 */
export function listEndpoints(spec: OpenApiSpec = loadSpec()): Endpoint[] {
  const endpoints: Endpoint[] = [];
  for (const [path, pathItem] of Object.entries(spec.paths)) {
    const pathParameters = resolveParameters(pathItem.parameters ?? [], spec);
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (!operation) continue;
      const operationParameters = resolveParameters(operation.parameters ?? [], spec);
      // Path-level params merged with operation-level (op-level wins on name+in collision).
      const seen = new Set(operationParameters.map((p) => `${p.in}:${p.name}`));
      const parameters = [
        ...operationParameters,
        ...pathParameters.filter((p) => !seen.has(`${p.in}:${p.name}`)),
      ];
      const tag = operation.tags?.[0] ?? "Other";
      endpoints.push({
        key: `${method}:${path}`,
        method,
        path,
        tag,
        summary: operation.summary ?? path,
        description: operation.description ?? "",
        operation: {
          tags: operation.tags,
          summary: operation.summary,
          description: operation.description,
          operationId: operation.operationId,
          parameters,
          responses: resolveResponses(operation.responses ?? {}, spec),
        },
      });
    }
  }
  return endpoints;
}

function resolveParameters(
  raw: readonly (OpenApiParameter | { $ref: string })[],
  spec: OpenApiSpec,
): OpenApiParameter[] {
  return raw
    .map((p) => {
      if ("$ref" in p) return derefParameter(p.$ref, spec);
      return p;
    })
    .filter((p): p is OpenApiParameter => p !== undefined);
}

function derefParameter(ref: string, spec: OpenApiSpec): OpenApiParameter | undefined {
  // Only handle `#/components/parameters/Name` form — rfc-api uses this exclusively.
  const prefix = "#/components/parameters/";
  if (!ref.startsWith(prefix)) return undefined;
  const name = ref.slice(prefix.length);
  return spec.components?.parameters?.[name];
}

function resolveResponses(
  raw: Record<string, OpenApiResponse | { $ref: string }>,
  spec: OpenApiSpec,
): Record<string, OpenApiResponse> {
  const out: Record<string, OpenApiResponse> = {};
  for (const [status, value] of Object.entries(raw)) {
    if ("$ref" in value) {
      const resolved = derefResponse(value.$ref, spec);
      if (resolved) out[status] = resolved;
    } else {
      out[status] = value;
    }
  }
  return out;
}

function derefResponse(ref: string, spec: OpenApiSpec): OpenApiResponse | undefined {
  const prefix = "#/components/responses/";
  if (!ref.startsWith(prefix)) return undefined;
  const name = ref.slice(prefix.length);
  return spec.components?.responses?.[name];
}

/**
 * Group endpoints by tag, preserving the order in which tags first
 * appear in the spec. Sidebar uses this for the `Tag — endpoint…`
 * structure from the mockup.
 */
export function groupEndpointsByTag(
  endpoints: readonly Endpoint[],
): { tag: string; endpoints: Endpoint[] }[] {
  const order: string[] = [];
  const groups = new Map<string, Endpoint[]>();
  for (const endpoint of endpoints) {
    if (!groups.has(endpoint.tag)) {
      groups.set(endpoint.tag, []);
      order.push(endpoint.tag);
    }
    groups.get(endpoint.tag)?.push(endpoint);
  }
  return order.map((tag) => ({ tag, endpoints: groups.get(tag) ?? [] }));
}

/**
 * Look up an endpoint by its key (`${method}:${path}`) — returns
 * `undefined` if the key doesn't resolve, callers fall through to the
 * first endpoint.
 */
export function findEndpoint(
  endpoints: readonly Endpoint[],
  key: string | null | undefined,
): Endpoint | undefined {
  if (!key) return undefined;
  return endpoints.find((e) => e.key === key);
}
