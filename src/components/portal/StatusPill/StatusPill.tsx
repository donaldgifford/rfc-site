import styles from "./StatusPill.module.css";

/**
 * Inline portal pill rendering `Document.status`.
 *
 * Phase 4 keeps this in `portal/` so the visual shape is established
 * against real data. Phase 5 promotes a stable subset of this to a
 * `<Badge>` `ds-candidate` (per IMPL-0001 §Phase 5 first candidate).
 *
 * Status strings come from rfc-api as opaque text. We `data-status`
 * the lower-cased value so `StatusPill.module.css` can map known
 * values onto the design-system `--color-status-*` tokens; unknown
 * values fall back to the `--color-status-abandoned` muted tone.
 */
export function StatusPill({ status }: { status: string }) {
  const variant = status.toLowerCase().replace(/\s+/g, "-");
  return (
    <span className={styles.pill} data-status={variant} aria-label={`Status: ${status}`}>
      {status}
    </span>
  );
}
