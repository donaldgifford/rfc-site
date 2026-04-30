/**
 * Fixture loader for `API_MODE=msw` dev mode (IMPL-0002 Phase 2).
 *
 * Reads `tests/examples/docs/<type>/<id>.md` at startup and exposes a
 * typed in-memory index. Branches on `typeof window`:
 *
 * - **SSR (node)**: dynamic `await import("node:fs")` so the client
 *   bundle never resolves a `node:` builtin. RR7 dev runs from the
 *   project root, so the fixture root is `process.cwd()/tests/examples/docs/`.
 * - **Browser**: Vite's `import.meta.glob` with `?raw` so the worker
 *   bundle is self-contained — the service worker doesn't have to
 *   fetch fixture URLs through itself.
 *
 * Frontmatter is parsed with `yaml` (PLAN-0001 Resolved Q3). The
 * loader is **lazy** — module load is a no-op; the first
 * `loadFixtures()` call does the I/O, and subsequent calls return a
 * cached promise.
 *
 * The Markdown body (everything after the closing `---`) is stuffed
 * verbatim into `Document.body`. The renderer
 * (DESIGN-0002, future IMPL) handles GFM / mermaid / sanitisation.
 */

import { parse as parseYaml } from "yaml";
import type { Document } from "../__generated__/model";

interface RawFixture {
  /** Path relative to the project root, e.g. `tests/examples/docs/rfc/0001-…md`. */
  path: string;
  /** Full file contents (frontmatter + body). */
  raw: string;
}

interface FixtureCache {
  all: Document[];
  byId: Map<string, Document>;
  byTypeBucket: Map<string, Document[]>;
}

let cachePromise: Promise<FixtureCache> | undefined;

/**
 * Returns every fixture as a `Document[]`. Order: stable, sorted by
 * `${type}/${id}` ascending. Cached after first call.
 */
export async function loadFixtures(): Promise<Document[]> {
  return (await getCache()).all;
}

/**
 * O(1) lookup by `(type, id)`. Resolves to `undefined` for misses.
 *
 * Both args are required because the openapi spec keys documents on
 * the (type, id) pair — `id` alone is not unique across types.
 */
export async function findById(type: string, id: string): Promise<Document | undefined> {
  return (await getCache()).byId.get(cacheKey(type, id));
}

/**
 * Returns every fixture for a given type, in stable id order. Empty
 * array (not undefined) for unknown types — keeps callers from having
 * to null-check before iterating.
 */
export async function byType(type: string): Promise<Document[]> {
  return (await getCache()).byTypeBucket.get(type) ?? [];
}

/**
 * Test-only helper: clears the cache so a subsequent call re-reads
 * from disk. Imported directly from tests; not part of the public
 * surface.
 */
export function _resetCacheForTests(): void {
  cachePromise = undefined;
}

function getCache(): Promise<FixtureCache> {
  cachePromise ??= buildCache();
  return cachePromise;
}

async function buildCache(): Promise<FixtureCache> {
  const fixtures = await readRawFixtures();
  const documents: Document[] = [];

  for (const fixture of fixtures) {
    documents.push(parseFixture(fixture));
  }

  // Stable sort: type asc, then id asc. Ensures pagination
  // round-trips deterministically.
  documents.sort((a, b) => {
    if (a.type !== b.type) return a.type < b.type ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  const byId = new Map<string, Document>();
  const byTypeBucket = new Map<string, Document[]>();

  for (const document of documents) {
    byId.set(cacheKey(document.type, document.id), document);
    const bucket = byTypeBucket.get(document.type) ?? [];
    bucket.push(document);
    byTypeBucket.set(document.type, bucket);
  }

  return { all: documents, byId, byTypeBucket };
}

function cacheKey(type: string, id: string): string {
  return `${type}/${id}`;
}

async function readRawFixtures(): Promise<RawFixture[]> {
  if (typeof window === "undefined") {
    return readRawFixturesNode();
  }
  return readRawFixturesBrowser();
}

async function readRawFixturesNode(): Promise<RawFixture[]> {
  // Dynamic imports keep `node:*` builtins out of the client bundle —
  // Vite splits the SSR chunk separately and the dead branch DCEs
  // away on the browser side.
  const fs = await import("node:fs");
  const path = await import("node:path");

  const root = path.join(process.cwd(), "tests", "examples", "docs");
  const fixtures: RawFixture[] = [];

  for (const typeDir of fs.readdirSync(root)) {
    const typeDirPath = path.join(root, typeDir);
    if (!fs.statSync(typeDirPath).isDirectory()) continue;

    for (const file of fs.readdirSync(typeDirPath)) {
      if (!file.endsWith(".md")) continue;
      if (file === "README.md") continue;
      const filePath = path.join(typeDirPath, file);
      const raw = fs.readFileSync(filePath, "utf8");
      fixtures.push({
        path: path.relative(process.cwd(), filePath),
        raw,
      });
    }
  }

  return fixtures;
}

function readRawFixturesBrowser(): RawFixture[] {
  // `import.meta.glob` is rooted at the Vite project root. We exclude
  // README.md explicitly — every other .md under the tree is a fixture.
  const modules = import.meta.glob<string>("/tests/examples/docs/**/*.md", {
    eager: true,
    query: "?raw",
    import: "default",
  });

  const fixtures: RawFixture[] = [];
  for (const [absolutePath, raw] of Object.entries(modules)) {
    if (absolutePath.endsWith("/README.md")) continue;
    fixtures.push({
      path: absolutePath.replace(/^\//, ""),
      raw,
    });
  }
  return fixtures;
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;

function parseFixture(fixture: RawFixture): Document {
  const match = FRONTMATTER_RE.exec(fixture.raw);
  if (!match) {
    throw new Error(`Fixture ${fixture.path}: missing or malformed YAML frontmatter`);
  }
  const frontmatter = match[1] ?? "";
  const body = match[2] ?? "";

  const parsed: unknown = parseYaml(frontmatter);
  const document = validateDocument(parsed, fixture.path);
  document.body = body.trimStart();
  return document;
}

function validateDocument(parsed: unknown, path: string): Document {
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error(`Fixture ${path}: frontmatter must be a YAML mapping at the top level`);
  }
  const record = parsed as Record<string, unknown>;

  requireString(record, "id", path);
  requireString(record, "type", path);
  requireString(record, "title", path);
  requireString(record, "status", path);
  requireString(record, "created_at", path);
  requireString(record, "updated_at", path);
  requireSource(record, path);

  // The openapi spec pins `Document.id` to `^[A-Z]+-[0-9]+$`. We
  // enforce the pattern here so a malformed fixture fails loud
  // rather than passing through to the route loader.
  const id = record.id as string;
  if (!/^[A-Z]+-[0-9]+$/.test(id)) {
    throw new Error(
      `Fixture ${path}: id "${id}" does not match the canonical pattern ^[A-Z]+-[0-9]+$`,
    );
  }

  return record as unknown as Document;
}

function requireString(record: Record<string, unknown>, key: string, path: string): void {
  if (typeof record[key] !== "string") {
    throw new Error(`Fixture ${path}: required string field "${key}" missing`);
  }
}

function requireSource(record: Record<string, unknown>, path: string): void {
  const source = record.source;
  if (typeof source !== "object" || source === null) {
    throw new Error(`Fixture ${path}: required field "source" missing`);
  }
  const sourceRecord = source as Record<string, unknown>;
  if (typeof sourceRecord.repo !== "string") {
    throw new Error(`Fixture ${path}: source.repo must be a string`);
  }
  if (typeof sourceRecord.path !== "string") {
    throw new Error(`Fixture ${path}: source.path must be a string`);
  }
}
