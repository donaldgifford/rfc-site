import { ExampleTabs } from "./ExampleTabs";
import {
  MCP_BUILD_FROM_SOURCE,
  MCP_CONFIG_SNIPPETS,
  MCP_DOWNLOADS,
  MCP_SERVERS,
  MCP_TOOLS,
  MCP_VERIFY_PROMPT,
} from "./content";
import styles from "./McpPage.module.css";

/**
 * `/mcp` page. Mockup §3920-4056 (View 5).
 *
 * Single-column 1000px max-width. Hero, related-server cards, four
 * numbered setup sections. Content is portal-local (see `content.ts`)
 * because rfcs-mcp itself doesn't ship docs — this view is the
 * canonical install + configure surface.
 *
 * No loader: the page is static (the underlying content module is
 * compiled in, not fetched). When rfcs-mcp goes public the download
 * URLs in `content.ts` get real hrefs; nothing else changes.
 */
export function McpPage() {
  return (
    <main className={styles.layout}>
      <section className={styles.hero}>
        <p className={styles.eyebrow}>Model Context Protocol</p>
        <h1 className={styles.title}>Pull RFCs directly into your editor.</h1>
        <p className={styles.lede}>
          The portal ships a small MCP server that exposes the read API as callable tools. Connect
          Claude Code, Cursor, or any MCP-aware client and search, fetch, and reference RFCs without
          leaving your editor. The same server also serves as the reference implementation for our
          internal docs.
        </p>
      </section>

      <section className={styles.cards} aria-label="Related MCP servers">
        {MCP_SERVERS.map((server) => (
          <a
            key={server.name}
            href={server.sourceHref}
            className={styles.card}
            target="_blank"
            rel="noreferrer noopener"
          >
            <div className={styles.cardHead}>
              <span className={styles.cardTitle}>{server.name}</span>
              <span
                className={[
                  styles.cardTag,
                  server.tagVariant === "related" && styles.cardTagRelated,
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {server.tag}
              </span>
            </div>
            <p
              className={styles.cardDesc}
              dangerouslySetInnerHTML={{ __html: inlineCode(server.description) }}
            />
            <div className={styles.cardMeta}>
              {server.meta.map((bullet) => (
                <span key={bullet}>
                  <span className={styles.cardMetaIcon}>▸</span>
                  {bullet}
                </span>
              ))}
              <span className={styles.cardSource}>view source →</span>
            </div>
          </a>
        ))}
      </section>

      <section className={styles.section} aria-labelledby="mcp-step-1">
        <h2 className={styles.sectionHeading} id="mcp-step-1">
          <span className={styles.stepChip}>1</span>
          Install the server
        </h2>
        <p
          className={styles.sectionBody}
          dangerouslySetInnerHTML={{
            __html: inlineCode(
              "Download the binary for your platform, or install with `go install`. The server is a single static binary with no runtime dependencies — drop it anywhere on your `PATH`.",
            ),
          }}
        />

        <div className={styles.downloads}>
          {MCP_DOWNLOADS.map((download) => (
            <a
              key={download.filename}
              href={download.href}
              className={styles.downloadItem}
              aria-label={`Download ${download.filename}`}
            >
              <div className={styles.downloadLeft}>
                <span className={styles.downloadIcon} aria-hidden="true">
                  {download.icon}
                </span>
                <div className={styles.downloadInfo}>
                  <div className={styles.downloadName}>{download.filename}</div>
                  <div className={styles.downloadPlatform}>{download.platform}</div>
                </div>
              </div>
              <span className={styles.downloadButton}>download</span>
            </a>
          ))}
        </div>

        <p className={styles.sectionBody} style={{ marginTop: 18 }}>
          Or build from source:
        </p>
        <pre className={styles.buildPre}>
          {MCP_BUILD_FROM_SOURCE.split("\n").map((line, idx) => (
            <span key={idx} className={line.startsWith("#") ? styles.comment : undefined}>
              {line}
              {"\n"}
            </span>
          ))}
        </pre>
      </section>

      <section className={styles.section} aria-labelledby="mcp-step-2">
        <h2 className={styles.sectionHeading} id="mcp-step-2">
          <span className={styles.stepChip}>2</span>
          Configure your client
        </h2>
        <p className={styles.sectionBody}>
          Add the server to your MCP client config. The exact path varies by client; examples below
          cover the common ones.
        </p>
        <ExampleTabs snippets={MCP_CONFIG_SNIPPETS} />
      </section>

      <section className={styles.section} aria-labelledby="mcp-step-3">
        <h2 className={styles.sectionHeading} id="mcp-step-3">
          <span className={styles.stepChip}>3</span>
          Available tools
        </h2>
        <p className={styles.sectionBody}>
          Once connected, the following tools are available to your LLM. All are read-only and safe
          to invoke without confirmation.
        </p>
        <ul className={styles.toolList}>
          {MCP_TOOLS.map((tool) => (
            <li key={tool.name}>
              <code>{tool.name}</code> — {tool.description}
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section} aria-labelledby="mcp-step-4">
        <h2 className={styles.sectionHeading} id="mcp-step-4">
          <span className={styles.stepChip}>4</span>
          Verify it works
        </h2>
        <p
          className={styles.sectionBody}
          dangerouslySetInnerHTML={{
            __html: inlineCode(
              "Restart your client and ask it to summarize a recent RFC. The client should invoke `get_rfc` and return a coherent summary. A good sanity check prompt:",
            ),
          }}
        />
        <pre className={styles.verifyPre}>
          {MCP_VERIFY_PROMPT.split("\n").map((line, idx) => (
            <span key={idx} className={line.startsWith("#") ? styles.comment : undefined}>
              {line}
              {"\n"}
            </span>
          ))}
        </pre>
      </section>
    </main>
  );
}

/**
 * Promote inline `code` from the content module to `<code>` in HTML.
 * The content strings are portal-authored and trusted — no user input
 * flows in, so substituting backticks for `<code>` tags is safe.
 */
function inlineCode(input: string): string {
  return input.replace(/`([^`]+)`/g, "<code>$1</code>");
}
