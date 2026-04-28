import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { setupServer } from "msw/node";
import { createQueryClient } from "../../src/portal/api/queryClient";
import { useGetDoc } from "../../src/portal/api/__generated__/docs/docs";
import { getGetDocMockHandler } from "../../src/portal/api/__generated__/docs/docs.msw";
import type { Document } from "../../src/portal/api/__generated__/model";

/**
 * Phase-3 smoke test (per IMPL-0001 §Phase 3 Success Criteria):
 *
 * - Mounts a `<QueryClientProvider>`.
 * - Wires the orval-generated MSW handler for `GET /api/v1/{type}/{id}`.
 * - Calls the generated `useGetDoc` hook.
 * - Asserts the returned payload narrows to the `Document` shape (200
 *   branch of the orval discriminated-union response).
 *
 * If this test fails after a regen, the orval contract or fetcher
 * contract has drifted — investigate before changing the test.
 */

const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

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

describe("orval-generated useGetDoc hook + MSW", () => {
  it("returns a typed Document via TanStack Query against an MSW handler", async () => {
    const fixture: Document = {
      id: "RFC-0001",
      type: "rfc",
      title: "Adopt portal frontend stack",
      status: "Accepted",
      created_at: "2025-12-01T00:00:00Z",
      updated_at: "2026-04-20T00:00:00Z",
      source: { repo: "donaldgifford/rfc-site", path: "docs/rfc/0001.md" },
    };

    server.use(getGetDocMockHandler(fixture));

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
    expect(screen.getByTestId("title")).toHaveTextContent("Adopt portal frontend stack");
    expect(screen.getByTestId("status")).toHaveTextContent("Accepted");
  });
});
