import styles from "./StatusBadge.module.css";

/**
 * The set of status values rfc-api emits today. `Document.status` is typed
 * as `string` (the OpenAPI contract leaves it open) so unknown statuses are
 * still rendered — they fall through to the `draft` colour swatch.
 */
type KnownStatus =
  | "draft"
  | "proposed"
  | "accepted"
  | "rejected"
  | "superseded"
  | "abandoned"
  | "published"
  | "discussion";

interface StatusBadgeProps {
  status: string;
  size?: "sm" | "md";
  className?: string;
}

/**
 * Outlined status pill. Mockup §580-608 — `.status-badge` rule.
 *
 * Visual: text-coloured border with 10% bg, mono 11px uppercase, sharp
 * corners. Status colour is derived from `--status-*` token. The
 * `published` / `discussion` aliases share visual treatment with their
 * nearest sibling (accepted / superseded) per the mockup's rule.
 */
export function StatusBadge({ status, size = "md", className }: StatusBadgeProps) {
  const variantClass = statusToVariantClass[status as KnownStatus] ?? styles.draft;
  const sizeClass = size === "sm" ? styles.sm : "";
  return (
    <span className={[styles.badge, variantClass, sizeClass, className].filter(Boolean).join(" ")}>
      {labelFor(status)}
    </span>
  );
}

const statusToVariantClass: Record<KnownStatus, string | undefined> = {
  draft: styles.draft,
  proposed: styles.proposed,
  accepted: styles.accepted,
  rejected: styles.rejected,
  superseded: styles.superseded,
  abandoned: styles.rejected,
  published: styles.accepted,
  discussion: styles.superseded,
};

function labelFor(status: string): string {
  return status.length > 0 ? status.charAt(0).toUpperCase() + status.slice(1) : status;
}
