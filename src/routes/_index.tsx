import type { Route } from "./+types/_index";
import { ThemeToggle } from "../components/portal/ThemeToggle";
import styles from "./_index.module.css";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "rfc-site" },
    { name: "description", content: "SSR portal for the rfc-api Markdown documents." },
  ];
}

export default function Index() {
  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <h1 className={styles.heading}>rfc-site</h1>
        <ThemeToggle />
      </header>
      <section className={styles.card}>
        <p className={styles.lede}>
          Phase 2 scaffold is live. Tokens flow from{" "}
          <code className={styles.code}>@donaldgifford/design-system</code>; the toggle above flips{" "}
          <code className={styles.code}>data-theme</code> on{" "}
          <code className={styles.code}>&lt;html&gt;</code> and persists to localStorage.
        </p>
        <p className={styles.muted}>
          Phase 3 wires orval + TanStack Query against rfc-api; Phase 4 lights up the first real
          route.
        </p>
      </section>
    </main>
  );
}
