import type { Route } from "./+types/$type.$id";
import { Link, useNavigation } from "react-router";
import { getDoc } from "../portal/api/__generated__/docs/docs";
import type { Document } from "../portal/api/__generated__/model";
import { throwIfProblem } from "../portal/api/errors";
import { StatusPill } from "../components/portal/StatusPill";
import { RouteErrorBoundary } from "../components/portal/RouteErrorBoundary";
import styles from "./$type.$id.module.css";

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
  const navigation = useNavigation();
  const isReloading = navigation.state === "loading";
  const doc = loaderData;

  return (
    <main className={styles.shell} aria-busy={isReloading}>
      <nav className={styles.crumbs}>
        <Link to="/" className={styles.crumbLink}>
          Directory
        </Link>
        <span aria-hidden="true">/</span>
        <span>{doc.id}</span>
      </nav>

      <header className={styles.header}>
        <div className={styles.titleRow}>
          <h1 className={styles.heading}>{doc.title}</h1>
          <StatusPill status={doc.status} />
        </div>
        <p className={styles.dateline}>
          {doc.id} · updated <RelativeDate value={doc.updated_at} />
          {doc.created_at !== doc.updated_at ? (
            <>
              {" "}
              · created <RelativeDate value={doc.created_at} />
            </>
          ) : null}
        </p>
        {doc.authors && doc.authors.length > 0 ? (
          <p className={styles.authors}>By {doc.authors.map((a) => a.name).join(", ")}</p>
        ) : null}
      </header>

      <pre className={styles.body}>{doc.body ?? ""}</pre>
    </main>
  );
}

export const ErrorBoundary = RouteErrorBoundary;

function RelativeDate({ value }: { value: string }) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return <time dateTime={value}>{value}</time>;
  return (
    <time dateTime={date.toISOString()}>
      {date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })}
    </time>
  );
}
