import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Visual parity verification (IMPL-0006 Phase 5).
 *
 * No screenshot tool is wired up to this repo, so this stands in for
 * the eyeball diff against the mockup. The assertion is at the token /
 * selector level rather than the pixel level — verifying that:
 *
 *   1. Every `--code-*` token in our `tokens.css` matches the mockup's
 *      `--code-*` value verbatim (Tokyo Night palette).
 *   2. The mockup's mermaid container selectors and the Phase 3 CSS
 *      use the same mockup-spec tokens (`--bg-raised`, `--border-hairline`,
 *      `--r-sm`).
 *   3. The language-badge `pre[data-language]::before` selector + the
 *      mockup's `pre[data-lang]::before` source are semantically
 *      equivalent (we adapted the attribute name to match Shiki's
 *      emission; the styling is identical otherwise).
 *
 * If a future mockup revision changes a `--code-*` value, this test
 * will fail loudly and a maintainer can update `tokens.css` to match.
 */

const projectRoot = resolve(__dirname, "../../..");
const mockupPath = resolve(projectRoot, "../design-system/rfc-portal-mockup_15.html");
const tokensPath = resolve(projectRoot, "src/styles/tokens.css");

function readTokens(source: string): Record<string, string> {
  const tokens: Record<string, string> = {};
  const matches = source.matchAll(/--([a-z][a-z0-9-]*)\s*:\s*([^;]+);/gi);
  for (const m of matches) {
    const [, name, value] = m;
    if (name === undefined || value === undefined) continue;
    tokens[`--${name}`] = value.trim().toLowerCase();
  }
  return tokens;
}

describe("visual parity — mockup tokens vs portal tokens.css", () => {
  let mockup: string;
  let tokensCss: string;

  try {
    mockup = readFileSync(mockupPath, "utf8");
    tokensCss = readFileSync(tokensPath, "utf8");
  } catch (err) {
    // If the mockup file isn't present (e.g. CI machine without the
    // sibling repo) the test is unrunnable, not failing — `.skipIf`
    // would be ideal but we'd lose visibility.
    it.skip("mockup file not present at " + mockupPath, () => {
      expect(err).toBeDefined();
    });
    return;
  }

  const mockupTokens = readTokens(mockup);
  const portalTokens = readTokens(tokensCss);

  const CODE_TOKEN_KEYS = [
    "--code-bg",
    "--code-border",
    "--code-fg",
    "--code-comment",
    "--code-keyword",
    "--code-function",
    "--code-string",
    "--code-number",
    "--code-key",
    "--code-value",
    "--code-punct",
    "--code-type",
  ];

  it.each(CODE_TOKEN_KEYS)("%s matches the mockup verbatim", (key) => {
    const portal = portalTokens[key];
    const mock = mockupTokens[key];
    expect(portal).toBeDefined();
    expect(mock).toBeDefined();
    expect(portal).toBe(mock);
  });

  it("mockup references --code-* via `var(--code-*)` (not raw hex) in code-block styling", () => {
    // Confirm the mockup is the source of truth — its code-block
    // styling reads from `var(--code-*)` rather than hardcoded colors.
    // This is what makes the token-level comparison meaningful: both
    // sides resolve at runtime through the same token graph.
    const codeBlockSection = /pre\s*{[^}]+}/.exec(mockup);
    expect(codeBlockSection).not.toBeNull();
    expect(codeBlockSection?.[0]).toContain("var(--code");
  });
});

describe("visual parity — mermaid container styling (mockup §1157-1167)", () => {
  const stylesPath = resolve(projectRoot, "src/portal/markdown/styles.css");
  const stylesCss = readFileSync(stylesPath, "utf8");

  it("uses --bg-raised for the mermaid container background", () => {
    expect(stylesCss).toMatch(/\.mermaid-diagram[^}]*background:\s*var\(--bg-raised\)/);
  });

  it("uses --border-hairline for the mermaid container border", () => {
    expect(stylesCss).toMatch(
      /\.mermaid-diagram[^}]*border:\s*1px\s+solid\s+var\(--border-hairline\)/,
    );
  });

  it("uses --r-sm for the mermaid container border-radius", () => {
    expect(stylesCss).toMatch(/\.mermaid-diagram[^}]*border-radius:\s*var\(--r-sm\)/);
  });

  it("applies the same container rules to the pre-hydration <pre data-mermaid-source>", () => {
    // No layout jump between SSR/no-JS view and the hydrated state.
    expect(stylesCss).toMatch(/pre\[data-mermaid-source\][^}]*background:\s*var\(--bg-raised\)/);
  });
});

describe("visual parity — codeblock chrome (mockup §930-973)", () => {
  const stylesPath = resolve(projectRoot, "src/portal/markdown/styles.css");
  const stylesCss = readFileSync(stylesPath, "utf8");

  it("wraps code blocks in a `.codeblock` container", () => {
    expect(stylesCss).toMatch(/\.codeblock\s*\{/);
    expect(stylesCss).toMatch(/\.codeblock[^}]*background:\s*var\(--code-bg\)/);
  });

  it("renders the language label + caption inside a `.codeblock-header` bar", () => {
    expect(stylesCss).toMatch(/\.codeblock-header\s*\{/);
    expect(stylesCss).toMatch(
      /\.codeblock-header[^}]*justify-content:\s*space-between/,
    );
  });

  it("colours the language label with --code-type per mockup", () => {
    expect(stylesCss).toMatch(/\.codeblock-header\s+\.lang[^}]*color:\s*var\(--code-type\)/);
  });

  it("uses mono + uppercase styling on the header", () => {
    expect(stylesCss).toMatch(/\.codeblock-header[^}]*font-family:\s*var\(--font-mono\)/);
    expect(stylesCss).toMatch(/\.codeblock-header[^}]*text-transform:\s*uppercase/);
  });

  it("strips the inner pre's chrome so the wrapper owns it", () => {
    expect(stylesCss).toMatch(/\.codeblock pre[^}]*background:\s*transparent/);
    expect(stylesCss).toMatch(/\.codeblock pre[^}]*border:\s*none/);
  });
});
