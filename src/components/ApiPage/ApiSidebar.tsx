import type { Endpoint, OpenApiSpec } from "../../portal/openapi/loader";
import { groupEndpointsByTag } from "../../portal/openapi/loader";
import { MethodChip } from "./MethodChip";
import styles from "./ApiPage.module.css";

interface ApiSidebarProps {
  spec: OpenApiSpec;
  endpoints: readonly Endpoint[];
  activeKey: string;
  onSelect: (key: string) => void;
}

/**
 * Left sidebar. Mockup §1545-1622.
 *
 * Brand block (`Portal API` + accent version tag + format), then one
 * group per OpenAPI `tag`. Each row is a button rendering a MethodChip
 * + truncated path.
 */
export function ApiSidebar({ spec, endpoints, activeKey, onSelect }: ApiSidebarProps) {
  const groups = groupEndpointsByTag(endpoints);

  return (
    <aside className={styles.sidebar} aria-label="API endpoints">
      <div className={styles.sidebarBrand}>
        <h2 className={styles.brandTitle}>{spec.info.title}</h2>
        <div className={styles.brandVersion}>
          <span className={styles.versionTag}>v{spec.info.version}</span>
          OpenAPI {spec.openapi}
        </div>
      </div>

      {groups.map((group) => (
        <div key={group.tag} className={styles.group}>
          <h3 className={styles.groupTitle}>{group.tag}</h3>
          {group.endpoints.map((endpoint) => {
            const isActive = endpoint.key === activeKey;
            return (
              <button
                key={endpoint.key}
                type="button"
                className={[styles.endpoint, isActive && styles.endpointActive]
                  .filter(Boolean)
                  .join(" ")}
                aria-current={isActive ? "page" : undefined}
                onClick={() => {
                  onSelect(endpoint.key);
                }}
              >
                <MethodChip method={endpoint.method} />
                <span className={styles.endpointPath}>{endpoint.path}</span>
              </button>
            );
          })}
        </div>
      ))}
    </aside>
  );
}
