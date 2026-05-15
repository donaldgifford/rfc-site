import { useRef } from "react";
import type { Route } from "./+types/$type.$id";
import { getDoc } from "../portal/api/__generated__/docs/docs";
import type { Document } from "../portal/api/__generated__/model";
import { throwIfProblem } from "../portal/api/errors";
import { DocumentView } from "../portal/markdown";
import {
  DocHeader,
  DocPage,
  DocSidebar,
  ReferencesFooter,
  TableOfContents,
} from "../components/DocPage";

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

export default function DocPageRoute({ loaderData }: Route.ComponentProps) {
  const doc = loaderData;
  const articleRef = useRef<HTMLDivElement | null>(null);

  return (
    <DocPage sidebar={<DocSidebar doc={doc} />} toc={<TableOfContents articleRef={articleRef} />}>
      <DocHeader doc={doc} />
      <div ref={articleRef}>
        <DocumentView document={doc} />
      </div>
      <ReferencesFooter doc={doc} />
    </DocPage>
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
