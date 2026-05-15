import type { Route } from "./+types/$type.$id";
import { getDoc } from "../portal/api/__generated__/docs/docs";
import type { Document } from "../portal/api/__generated__/model";
import { throwIfProblem } from "../portal/api/errors";
import { DocumentView } from "../portal/markdown";

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [{ title: "rfc-site" }];
  return [
    { title: `${loaderData.id} — ${loaderData.title} | rfc-site` },
    { name: "description", content: loaderData.title },
  ];
}

export async function loader({ params }: Route.LoaderArgs): Promise<Document> {
  const response = await getDoc(params.type, params.id);
  throwIfProblem(response);
  return response.data;
}

export default function DocPage({ loaderData }: Route.ComponentProps) {
  const doc = loaderData;
  return (
    <main>
      <h1>
        {doc.id} — {doc.title}
      </h1>
      <p>Phase 0 stub; rebuild lands in Phase 2 per IMPL-0005.</p>
      <DocumentView document={doc} />
    </main>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return (
    <main>
      <h1>Error</h1>
      <pre>{error instanceof Error ? error.message : String(error)}</pre>
    </main>
  );
}

export function HydrateFallback() {
  return (
    <main aria-busy="true">
      <h1>Loading…</h1>
    </main>
  );
}
