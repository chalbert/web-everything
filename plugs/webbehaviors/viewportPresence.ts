/**
 * @file viewportPresence.ts
 * @description Runtime for the `viewport-presence` mechanism intent (#320, re-pointing #321) — the one
 *   shared `IntersectionObserver` *trigger* that the in/out-of-view consumers compose instead of each
 *   inlining their own observer. It owns only the observe-vocabulary (`root`, `rootMargin`,
 *   `threshold`, and the enter/leave dispatch); the UX decision — prefetch a route, activate a
 *   visibility-gated trait, fetch the next page — stays with each consumer. Extracting it here means
 *   the `rootMargin`-defaulting fix (and any future observe tweak) lands once, not once per consumer
 *   (#014 Fork 2 / DRY, most-flexible-default bias).
 *
 *   Consumers today: Prefetch `eagerness:viewport` ([RoutePrefetchBehavior]) — one element, one-shot,
 *   `rootMargin: '50px'`; the visibility-gated trait (`when="visible"`, {@link CustomAttributeRegistry})
 *   — one shared observer watching many hosts with enter *and* leave (recurring traits re-close
 *   off-screen). The pagination `advance:auto` observer is unbuilt; it composes the same trigger when
 *   it lands.
 */

/** The observe-vocabulary the `viewport-presence` intent owns, plus the enter/leave dispatch. */
export interface ViewportPresenceOptions {
  /** Intersection root; null/omitted = the browser viewport (native default). */
  root?: Element | Document | null;
  /** Grow/shrink the root box before intersection counts. Native default `'0px'`. */
  rootMargin?: string;
  /** Visibility ratio(s) that flip presence. Native default `0` (any pixel). */
  threshold?: number | number[];
  /** Host entered the root box. */
  onEnter?: (entry: IntersectionObserverEntry, observer: IntersectionObserver) => void;
  /** Host left the root box. Omit for enter-only consumers (e.g. one-shot prefetch). */
  onLeave?: (entry: IntersectionObserverEntry, observer: IntersectionObserver) => void;
}

/**
 * Create the shared viewport-presence `IntersectionObserver`. Each record is routed to
 * `onEnter`/`onLeave` by `isIntersecting`, with the native option defaults applied in one place.
 *
 * Returns `null` when `IntersectionObserver` is unavailable — the caller owns its own no-IO fallback
 * (prefetch-immediately, activate-immediately, …), since *what to do without observation* is a UX
 * call, not a trigger one. The returned value is a plain `IntersectionObserver`: the caller still owns
 * `observe()` / `unobserve()` / `disconnect()` and may watch one element (one-shot) or many (a single
 * shared gate observer).
 */
export function createViewportPresenceObserver(
  options: ViewportPresenceOptions = {},
): IntersectionObserver | null {
  if (typeof IntersectionObserver === 'undefined') return null;
  const { root = null, rootMargin = '0px', threshold = 0, onEnter, onLeave } = options;
  return new IntersectionObserver(
    (records, observer) => {
      for (const record of records) {
        if (record.isIntersecting) onEnter?.(record, observer);
        else onLeave?.(record, observer);
      }
    },
    { root, rootMargin, threshold },
  );
}
