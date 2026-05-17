import type { HttpMethod } from "../../portal/openapi/loader";
import styles from "./ApiPage.module.css";

interface MethodChipProps {
  method: HttpMethod;
}

const METHOD_CLASS: Record<HttpMethod, string | undefined> = {
  get: styles.methodGet,
  post: styles.methodPost,
  put: styles.methodPut,
  patch: styles.methodPatch,
  delete: styles.methodDelete,
};

/**
 * HTTP method badge — mockup §1624-1645.
 *
 * Compact 44px-min pill, color-mix-tinted on the method colour. Variants:
 * GET (`--code-function`), POST (`--status-accepted`), PUT (`--status-draft`),
 * PATCH (`--code-type`), DELETE (`--status-rejected`).
 */
export function MethodChip({ method }: MethodChipProps) {
  return (
    <span className={[styles.method, METHOD_CLASS[method]].filter(Boolean).join(" ")}>
      {method.toUpperCase()}
    </span>
  );
}
