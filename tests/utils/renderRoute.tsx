import { render } from "@testing-library/react";
import { createRoutesStub, type ActionFunction, type LoaderFunction } from "react-router";
import type { ComponentType } from "react";

/**
 * Mounts a single RR7 route via `createRoutesStub` and renders it with
 * the given `initialEntries`. Returns whatever `@testing-library/react`'s
 * `render()` returns so test code can call `screen.*` directly.
 *
 * Why this helper: the route's framework-mode `Route.LoaderArgs` types
 * narrow `params` to the route pattern, but `createRoutesStub` uses a
 * generic `Params<string>` — straight assignment hits a TS variance
 * error. The cast lives here once instead of in every test file.
 */
export interface RouteFixture {
  path: string;
  // RR7 routes accept any prop shape from createRoutesStub's runtime —
  // we only mount them, never call them. Using `any` here mirrors
  // createRoutesStub's own typing and keeps the helper generic.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Component: ComponentType<any>;
  loader?: unknown;
  action?: unknown;
  HydrateFallback?: ComponentType;
  ErrorBoundary?: ComponentType;
}

export function renderRoute(
  fixture: RouteFixture,
  initialEntries: readonly [string, ...string[]],
): ReturnType<typeof render> {
  const Stub = createRoutesStub([
    {
      path: fixture.path,
      Component: fixture.Component,
      loader: fixture.loader as LoaderFunction | undefined,
      action: fixture.action as ActionFunction | undefined,
      HydrateFallback: fixture.HydrateFallback,
      ErrorBoundary: fixture.ErrorBoundary,
    },
  ]);
  return render(<Stub initialEntries={[...initialEntries]} />);
}
