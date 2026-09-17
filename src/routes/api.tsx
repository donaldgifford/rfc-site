import type { Route } from "./+types/api";
import { ApiPage } from "../components/ApiPage/ApiPage";
import { listEndpoints, loadSpec } from "../portal/openapi/loader";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "API — rfc-site" },
    {
      name: "description",
      content: "OpenAPI reference for rfc-api, parsed from the vendored api/openapi.yaml.",
    },
  ];
}

export default function ApiRoute() {
  const spec = loadSpec();
  const endpoints = listEndpoints(spec);
  return <ApiPage spec={spec} endpoints={endpoints} />;
}
