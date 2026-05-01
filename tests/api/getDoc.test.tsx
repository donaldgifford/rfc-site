import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createQueryClient } from "../../src/portal/api/queryClient";
import { useGetDoc } from "../../src/portal/api/__generated__/docs/docs";
import type { Document } from "../../src/portal/api/__generated__/model";
import { setupMswLifecycle } from "../utils/msw";

/**
 * Phase-3 smoke test (per IMPL-0001 §Phase 3 Success Criteria), now
 * routed through the fixture-backed MSW handlers (IMPL-0002 Phase 4).
 *
 * - Mounts a `<QueryClientProvider>`.
 * - Lets the shared `setupServer(...handlers)` answer the request.
 * - Calls the generated `useGetDoc` hook for a known fixture id.
 * - Asserts the returned payload narrows to the `Document` shape (200
 *   branch of the orval discriminated-union response) and matches the
 *   fixture's frontmatter.
 *
 * If this test fails after a regen, the orval contract or fetcher
 * contract has drifted — investigate before changing the test.
 */

setupMswLifecycle();

function GetDocProbe({ docType, id }: { docType: string; id: string }) {
  const { data, isLoading, error } = useGetDoc(docType, id);

  if (isLoading) {
    return <p data-testid="state">loading</p>;
  }
  if (error) {
    return <p data-testid="state">error</p>;
  }
  if (!data) {
    return <p data-testid="state">empty</p>;
  }
  if (data.status !== 200) {
    return <p data-testid="state">non-200</p>;
  }

  const doc: Document = data.data;
  return (
    <dl data-testid="doc">
      <dt>id</dt>
      <dd data-testid="id">{doc.id}</dd>
      <dt>type</dt>
      <dd data-testid="type">{doc.type}</dd>
      <dt>title</dt>
      <dd data-testid="title">{doc.title}</dd>
      <dt>status</dt>
      <dd data-testid="status">{doc.status}</dd>
    </dl>
  );
}

describe("orval-generated useGetDoc hook + MSW fixture handlers", () => {
  it("returns a typed Document via TanStack Query against the fixture handler", async () => {
    const queryClient = createQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <GetDocProbe docType="rfc" id="0001" />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("doc")).toBeInTheDocument();
    });

    expect(screen.getByTestId("id")).toHaveTextContent("RFC-0001");
    expect(screen.getByTestId("type")).toHaveTextContent("rfc");
    expect(screen.getByTestId("title")).toHaveTextContent(
      "Adopt MSW-backed dev mode for the portal",
    );
    expect(screen.getByTestId("status")).toHaveTextContent("proposed");
  });
});
