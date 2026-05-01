import type { Document } from "../api/__generated__/model";

interface DocumentViewProps {
  document: Document;
}

// Phase 1 stub. Phase 2 runs `document.body` through the unified processor;
// Phase 4 wires `<Anchor>` / `<Code>` / `<MermaidBlock>` as the components prop;
// Phase 5 swaps the `<pre>` placeholder in `$type.$id.tsx` for this view.
export function DocumentView(_props: DocumentViewProps): null {
  return null;
}
