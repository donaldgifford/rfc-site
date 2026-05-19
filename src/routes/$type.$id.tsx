import { useRef } from "react";
import type { Route } from "./+types/$type.$id";
import { getDoc } from "../portal/api/__generated__/docs/docs";
import type { Document } from "../portal/api/__generated__/model";
import { throwIfProblem } from "../portal/api/errors";
import { DocumentView } from "../portal/markdown";
import { renderMarkdown } from "../portal/markdown/renderMarkdown";
import {
  DocHeader,
  DocPage,
  DocSidebar,
  ReferencesFooter,
  TableOfContents,
} from "../components/DocPage";

interface LoaderData {
  doc: Document;
  bodyHtml: string;
}

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [{ title: "rfc-site" }];
  return [
    { title: `${loaderData.doc.id} — ${loaderData.doc.title} | rfc-site` },
    { name: "description", content: loaderData.doc.title },
  ];
}

export async function loader({ params }: Route.LoaderArgs): Promise<LoaderData> {
  const response = await getDoc(params.type, params.id);
  throwIfProblem(response);
  const doc = response.data;
  // Render the Markdown body server-side (IMPL-0006). The article HTML
  // lands in the initial response payload so hard refreshes don't
  // flash a redraw of the article column.
  const bodyHtml = await renderMarkdown(doc);
  return { doc, bodyHtml };
}

export default function DocPageRoute({ loaderData }: Route.ComponentProps) {
  const { doc, bodyHtml } = loaderData;
  const articleRef = useRef<HTMLDivElement | null>(null);

  return (
    <DocPage sidebar={<DocSidebar doc={doc} />} toc={<TableOfContents articleRef={articleRef} />}>
      <DocHeader doc={doc} />
      <div ref={articleRef}>
        <DocumentView bodyHtml={bodyHtml} />
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
