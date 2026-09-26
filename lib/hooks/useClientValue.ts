"use client";

// คัดลอกจาก app-template/hooks/useClientValue.ts — แก้ที่นี่แล้วต้องไปแก้ที่ template ด้วย

import { useMemo, useSyncExternalStore } from "react";

const noSubscribe = () => () => {};

/**
 * `false` during SSR and the hydration render, `true` from the next render on.
 *
 * Built on `useSyncExternalStore` rather than `useState` + `useEffect`: setting state
 * from an effect costs an extra render pass and trips React's `set-state-in-effect`
 * rule.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(noSubscribe, () => true, () => false);
}

/**
 * Read a browser-only value (localStorage, `window`, `navigator`, …) *during render*
 * instead of hydrating it in from a `useEffect`.
 *
 * - Returns `fallback` until hydration finishes, so the server HTML and the hydration
 *   render agree. Reading the real value straight away is what produces those
 *   "text content did not match" hydration errors.
 * - `key` is a cache key: change it to force a re-read. Use a counter bumped after
 *   every write, a route, an id — whatever should invalidate the value.
 *
 * ```tsx
 * const [version, reload] = useReducer((n: number) => n + 1, 0);
 * const items = useClientValue(() => loadJSON("items", NONE), NONE, version);
 * // after writing: reload()
 * ```
 *
 * For plain state that lives in localStorage, prefer `useLocalStorage` — it also
 * syncs across tabs. This hook is for values with their own read path (a repository
 * module, a derived count, a media query read once).
 */
export function useClientValue<T>(read: () => T, fallback: T, key?: unknown): T {
  const mounted = useMounted();
  // `read`, `fallback` and `key` are intentionally not all dependencies: `key` is the
  // invalidation signal chosen by the caller, and `read` is usually an inline closure
  // that would re-run this every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => (mounted ? read() : fallback), [mounted, key]);
}
