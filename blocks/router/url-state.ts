/**
 * @file blocks/router/url-state.ts
 * @description The webrouting **URL-as-state declaration + coordinator seam** contract (#1728, ratified
 * #1686, codified docs/agent/platform-decisions.md#url-as-state-per-component-seam).
 *
 * Type-only (the contract; the runtime impl rides downstream to FUI). When a stateful component projects a
 * state slice to/from the URL — a grid's filter/sort/page, a tab, a wizard step, pagination — it **declares**
 * which slices sync, **router-agnostically** (it syncs whether or not a router is mounted; the pagination
 * block, `blocks/renderers/pagination/PaginationBehavior.ts`, already writes the URL router-free). The
 * declaration is never a central router-coupled provider.
 *
 * Three facets the contract fixes:
 *  1. a per-slice {@link UrlStateSlice} declaration (persistence axis + namespaced key + the {@link UrlCodec});
 *  2. **intra-component microtask coalescing** — always one write per component per tick, History-guarded; and
 *  3. an **optional** {@link UrlStateCoordinator} that batches *cross-component* concurrent writes into ONE
 *     history entry (the nuqs batching model). Both write paths share the SAME per-slice codec — one
 *     encoding, never two; only the commit (one entry vs N) differs.
 */

/**
 * The persistence axis for a state slice — the Navigation Intent's `persistence`
 * (`we:src/_data/intents/navigation.json`) generalized from whole-view navigation down to one slice. URL =
 * shareable / navigable / history-tied; `session`/`memory` are the non-URL homes. Sync is **never forced** —
 * a slice opts in, with a permissive non-URL default (most-flexible-default).
 */
export type UrlStatePersistence = 'url' | 'session' | 'memory';

/**
 * The typed per-slice codec — the {@link ../../src/_data/protocols/custom-url-codec-strategy CustomUrlCodecStrategy}
 * protocol (#1727) as a TS interface. WE ships the contract + the native-first built-in codecs; Zod / nuqs /
 * a custom codec plug in behind it. The same codec is used on both read (decode) and write (encode).
 */
export interface UrlCodec<T> {
  /** Which native-first coercion this codec realizes (or `string` for the raw escape hatch). */
  readonly kind: 'number' | 'boolean' | 'enum' | 'date' | 'array' | 'string';
  /** Typed value → the URL query-param string. */
  encode(value: T): string;
  /** The URL query-param string → typed value. */
  decode(raw: string): T;
}

/**
 * One component's declaration that a state slice syncs. Router-agnostic: the component reads/writes the slice
 * through this declaration whether or not a router is mounted. The `key` is namespaced (the cross-component
 * collision arbiter); `persistence` decides the home; the `codec` is the typed string↔value bridge.
 */
export interface UrlStateSlice<T> {
  /** The namespaced query/storage key (collision arbiter across components on one page). */
  readonly key: string;
  /** Where this slice persists — `url` syncs to the address bar; `session`/`memory` do not. */
  readonly persistence: UrlStatePersistence;
  /** The typed codec used on both read and write (shared — one encoding, never two). */
  readonly codec: UrlCodec<T>;
  /** The slice's default value when the URL/store carries none (popstate/navigate restores the true state). */
  readonly defaultValue: T;
}

/**
 * The optional cross-component write coordinator — batches concurrent writes from several components in one
 * tick into a **single** history entry (the nuqs batching model), instead of N entries that spam back/forward.
 * Optional by design: a component coalesces its OWN writes via the always-on intra-component microtask path;
 * the coordinator only adds cross-component batching when a page opts into it. A pure-per-component model with
 * no coordinator is rejected (#1686 — re-creates cross-component history-spam).
 */
export interface UrlStateCoordinator {
  /**
   * Enqueue a slice write; the coordinator coalesces all writes enqueued in the same tick and commits them
   * as one history entry on the microtask. The codec on the slice does the encoding (shared write path).
   */
  enqueue<T>(slice: UrlStateSlice<T>, value: T): void;
}
