import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useSearchParams } from "react-router";
import clsx from "clsx";

import styles from "./Tabs.module.css";

/* ── Context ─────────────────────────────────────────────────────── */

interface TabsContextValue {
  readonly value: string;
  readonly setValue: (next: string) => void;
  readonly baseId: string;
  readonly registerTrigger: (value: string, node: HTMLButtonElement | null) => void;
  readonly focusByDirection: (from: string, direction: -1 | 1 | "first" | "last") => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext(): TabsContextValue {
  const ctx = useContext(TabsContext);
  if (ctx === null) {
    throw new Error("<Tabs.*> must be rendered inside a <Tabs> root.");
  }
  return ctx;
}

/* ── Root ────────────────────────────────────────────────────────── */

export interface TabsProps extends Omit<ComponentPropsWithoutRef<"div">, "onChange"> {
  /** Default active tab value (uncontrolled mode). */
  defaultValue?: string;
  /** Controlled active tab value. */
  value?: string;
  /** Controlled-mode change handler. */
  onValueChange?: (next: string) => void;
  /**
   * When set, the active tab syncs to `?<urlParam>=<value>` via RR7's
   * `useSearchParams`. Default is local state (Resolved §5 — URL state
   * is opt-in, not the default). The search param is read on mount;
   * subsequent tab changes push to the URL via setSearchParams.
   */
  urlParam?: string;
  children?: ReactNode;
}

const TabsRoot = forwardRef<HTMLDivElement, TabsProps>(function Tabs(
  { defaultValue, value: controlledValue, onValueChange, urlParam, className, children, ...rest },
  ref,
) {
  const isControlled = controlledValue !== undefined;
  const baseId = useId();

  const [searchParams, setSearchParams] = useSearchParams();
  const urlValue = urlParam === undefined ? undefined : (searchParams.get(urlParam) ?? undefined);

  const [internalValue, setInternalValue] = useState<string>(() => {
    if (urlValue !== undefined && urlValue.length > 0) return urlValue;
    return defaultValue ?? "";
  });

  // When the URL changes externally (back button, deep link), keep
  // local state in sync. Only applies when urlParam is opted into.
  useEffect(() => {
    if (urlParam === undefined) return;
    if (urlValue !== undefined && urlValue !== internalValue) {
      setInternalValue(urlValue);
    }
  }, [urlParam, urlValue, internalValue]);

  const value = isControlled ? controlledValue : internalValue;

  const setValue = useCallback(
    (next: string) => {
      if (!isControlled) setInternalValue(next);
      onValueChange?.(next);
      if (urlParam !== undefined) {
        setSearchParams(
          (prev) => {
            const params = new URLSearchParams(prev);
            params.set(urlParam, next);
            return params;
          },
          { replace: false },
        );
      }
    },
    [isControlled, onValueChange, urlParam, setSearchParams],
  );

  // Track each trigger element so we can imperatively focus on
  // arrow-key navigation per WAI-ARIA Tabs.
  const triggersRef = useRef<Map<string, HTMLButtonElement>>(new Map());

  const registerTrigger = useCallback((triggerValue: string, node: HTMLButtonElement | null) => {
    const map = triggersRef.current;
    if (node === null) {
      map.delete(triggerValue);
    } else {
      map.set(triggerValue, node);
    }
  }, []);

  const focusByDirection = useCallback((from: string, direction: -1 | 1 | "first" | "last") => {
    const map = triggersRef.current;
    const values = Array.from(map.keys());
    if (values.length === 0) return;

    let targetValue: string | undefined;
    if (direction === "first") {
      targetValue = values[0];
    } else if (direction === "last") {
      targetValue = values[values.length - 1];
    } else {
      const currentIndex = values.indexOf(from);
      if (currentIndex < 0) return;
      const nextIndex = (currentIndex + direction + values.length) % values.length;
      targetValue = values[nextIndex];
    }

    if (targetValue === undefined) return;
    const node = map.get(targetValue);
    node?.focus();
  }, []);

  const contextValue = useMemo<TabsContextValue>(
    () => ({ value, setValue, baseId, registerTrigger, focusByDirection }),
    [value, setValue, baseId, registerTrigger, focusByDirection],
  );

  return (
    <TabsContext.Provider value={contextValue}>
      <div ref={ref} className={clsx(styles.root, className)} {...rest}>
        {children}
      </div>
    </TabsContext.Provider>
  );
});

/* ── List ────────────────────────────────────────────────────────── */

export type TabsListProps = ComponentPropsWithoutRef<"div">;

const TabsList = forwardRef<HTMLDivElement, TabsListProps>(function TabsList(
  { className, children, ...rest },
  ref,
) {
  return (
    <div ref={ref} role="tablist" className={clsx(styles.list, className)} {...rest}>
      {children}
    </div>
  );
});

/* ── Trigger ─────────────────────────────────────────────────────── */

export interface TabsTriggerProps extends ComponentPropsWithoutRef<"button"> {
  /** Tab identifier; matches `<Tabs.Content value="…">`. */
  value: string;
}

const TabsTrigger = forwardRef<HTMLButtonElement, TabsTriggerProps>(function TabsTrigger(
  { value, className, onClick, onKeyDown, children, ...rest },
  forwardedRef,
) {
  const ctx = useTabsContext();
  const isActive = ctx.value === value;
  const innerRef = useRef<HTMLButtonElement | null>(null);

  const setRefs = useCallback(
    (node: HTMLButtonElement | null) => {
      innerRef.current = node;
      ctx.registerTrigger(value, node);
      if (typeof forwardedRef === "function") {
        forwardedRef(node);
      } else if (forwardedRef !== null) {
        forwardedRef.current = node;
      }
    },
    [ctx, forwardedRef, value],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      onKeyDown?.(event);
      if (event.defaultPrevented) return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        ctx.focusByDirection(value, 1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        ctx.focusByDirection(value, -1);
      } else if (event.key === "Home") {
        event.preventDefault();
        ctx.focusByDirection(value, "first");
      } else if (event.key === "End") {
        event.preventDefault();
        ctx.focusByDirection(value, "last");
      }
    },
    [ctx, onKeyDown, value],
  );

  return (
    <button
      ref={setRefs}
      type="button"
      role="tab"
      id={`${ctx.baseId}-trigger-${value}`}
      aria-selected={isActive}
      aria-controls={`${ctx.baseId}-panel-${value}`}
      tabIndex={isActive ? 0 : -1}
      data-state={isActive ? "active" : "inactive"}
      data-value={value}
      className={clsx(styles.trigger, className)}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        ctx.setValue(value);
      }}
      onKeyDown={handleKeyDown}
      {...rest}
    >
      {children}
    </button>
  );
});

/* ── Content ─────────────────────────────────────────────────────── */

export interface TabsContentProps extends ComponentPropsWithoutRef<"div"> {
  /** Tab identifier; matches `<Tabs.Trigger value="…">`. */
  value: string;
  /**
   * When `true`, the panel stays mounted in the DOM even when inactive
   * (visually hidden via `hidden`). Useful for preserving form state.
   * Default `false` — inactive panels unmount.
   */
  forceMount?: boolean;
}

const TabsContent = forwardRef<HTMLDivElement, TabsContentProps>(function TabsContent(
  { value, forceMount = false, className, hidden, children, ...rest },
  ref,
) {
  const ctx = useTabsContext();
  const isActive = ctx.value === value;
  if (!isActive && !forceMount) return null;

  return (
    <div
      ref={ref}
      role="tabpanel"
      id={`${ctx.baseId}-panel-${value}`}
      aria-labelledby={`${ctx.baseId}-trigger-${value}`}
      data-state={isActive ? "active" : "inactive"}
      hidden={hidden ?? (isActive ? undefined : true)}
      className={clsx(styles.content, className)}
      tabIndex={0}
      {...rest}
    >
      {children}
    </div>
  );
});

/* ── Public surface ──────────────────────────────────────────────── */

/**
 * `<Tabs>` — WAI-ARIA-compliant tab switcher with optional URL state.
 *
 * Composition follows the Radix-style namespace pattern; sub-components
 * are attached to the root for dot-notation usage AND exported
 * individually for destructured imports.
 */
export const Tabs = Object.assign(TabsRoot, {
  List: TabsList,
  Trigger: TabsTrigger,
  Content: TabsContent,
});

export { TabsList, TabsTrigger, TabsContent };
