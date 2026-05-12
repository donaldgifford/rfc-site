/**
 * `<RFCPreviewCard>` — hover/focus popover that previews a cross-RFC
 * link's target metadata without leaving the current page.
 *
 * IMPL-0004 Phase 8b. Wraps a single trigger child (typically an RR7
 * `<Link>` produced by `<Anchor>`) and opens a `<Card>`-chrome popover
 * after a short delay. The orval-generated `useGetDoc` hook fetches the
 * target lazily — disabled until the first hover/focus — so untouched
 * preview-enabled links cost nothing.
 *
 * Accessibility (Resolved §9):
 *   - Triggers on hover AND focus so keyboard users see the same
 *     affordance as mouse users.
 *   - `aria-describedby` wires the trigger to the popover when open.
 *   - `Escape` closes the popover and returns focus state to normal.
 *
 * Positioning (Resolved §10):
 *   - CSS-only `position: absolute` anchored to the trigger; viewport-
 *     edge handling is a later concern (swap in `@floating-ui/react`
 *     if it gets squirrely).
 */

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Badge, Card } from "@donaldgifford/design-system";

import { useGetDoc, type getDocResponse } from "../../../portal/api/__generated__/docs/docs";
import { classifyProblem } from "../../../portal/api/errors";

import styles from "./RFCPreviewCard.module.css";

export interface RFCPreviewCardProps {
  /** Document type segment (`"rfc"`, `"adr"`, …). */
  type: string;
  /** URL-form id (`"0001"`) — pre-translated by the caller. */
  id: string;
  /**
   * The trigger element — usually an RR7 `<Link>`. Wrapped in a span
   * so hover / focus / blur handlers can be attached without forcing
   * the consumer's element to be polymorphic.
   */
  children: ReactNode;
  /**
   * Delay before opening on hover (ms). Defaults to `150` to debounce
   * accidental flyovers; pass `0` in tests for synchronous behaviour.
   */
  openDelay?: number;
}

export function RFCPreviewCard({ type, id, children, openDelay = 150 }: RFCPreviewCardProps) {
  const popoverId = useId();
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearOpenTimer = useCallback(() => {
    if (openTimer.current !== null) {
      clearTimeout(openTimer.current);
      openTimer.current = null;
    }
  }, []);

  const handleEnter = useCallback(() => {
    setEnabled(true);
    clearOpenTimer();
    if (openDelay <= 0) {
      setOpen(true);
      return;
    }
    openTimer.current = setTimeout(() => {
      setOpen(true);
    }, openDelay);
  }, [clearOpenTimer, openDelay]);

  const handleLeave = useCallback(() => {
    clearOpenTimer();
    setOpen(false);
  }, [clearOpenTimer]);

  useEffect(() => {
    return () => {
      clearOpenTimer();
    };
  }, [clearOpenTimer]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const query = useGetDoc(type, id, {
    query: {
      enabled,
      staleTime: 5 * 60 * 1000,
    },
  });

  return (
    <span
      className={styles.wrapper}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onFocus={handleEnter}
      onBlur={handleLeave}
      aria-describedby={open ? popoverId : undefined}
      data-state={open ? "open" : "closed"}
    >
      {children}
      {open ? (
        <Card
          variant="elevated"
          padding="md"
          role="tooltip"
          id={popoverId}
          className={styles.popover}
        >
          <PopoverBody query={query} fallbackId={`${type.toUpperCase()}-${id}`} />
        </Card>
      ) : null}
    </span>
  );
}

interface PopoverBodyProps {
  query: {
    data: getDocResponse | undefined;
    isLoading: boolean;
    isFetching: boolean;
    isError: boolean;
  };
  fallbackId: string;
}

function PopoverBody({ query, fallbackId }: PopoverBodyProps) {
  if (query.isLoading || query.isFetching) {
    return <span className={styles.loading}>Loading {fallbackId}…</span>;
  }

  if (query.isError) {
    return <span className={styles.errored}>Couldn’t load {fallbackId}</span>;
  }

  const response = query.data;
  if (response === undefined) {
    return <span className={styles.loading}>Loading {fallbackId}…</span>;
  }

  // The orval response is `{ data, status, headers }`; problem responses
  // come through with a non-200 status. Use the shared classifier so the
  // popover renders an inert error surface for not-found / server-error
  // targets instead of crashing.
  if (response.status !== 200) {
    const kind = classifyProblem(response.data);
    return (
      <span className={styles.errored}>
        {kind === "not-found" ? `${fallbackId} not found` : `Couldn’t load ${fallbackId}`}
      </span>
    );
  }

  const doc = response.data;
  const authors = (doc.authors ?? []).map((a) => a.name).join(", ");
  return (
    <div className={styles.body}>
      <div className={styles.head}>
        <span className={styles.id}>{doc.id}</span>
        <Badge status={doc.status} size="sm" />
      </div>
      <h3 className={styles.title}>{doc.title}</h3>
      {authors.length > 0 ? <p className={styles.authors}>{authors}</p> : null}
      <p className={styles.dateline}>
        Updated <time dateTime={doc.updated_at}>{formatDate(doc.updated_at)}</time>
      </p>
    </div>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
