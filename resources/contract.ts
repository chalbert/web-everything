/**
 * Resources protocol — the **pure-contract half** (#1027, slice #1074).
 *
 * Types and interfaces only: this module is fully **compile-erased** (no runtime emit) so it can become
 * the `@webeverything/contracts/resources` entry (#872/#874) that FUI depends on (the FUI→WE arrow),
 * superseding byte-replication — exactly like `guard/contract.ts` and `analytics/contract.ts`. The
 * runtime half — concrete resource clients (REST / GraphQL / WS), the pagination iterators, and the
 * `customResources` registry — is impl and lives in FUI; only the contract crosses the seam (npm scope
 * mirrors layer).
 *
 * Web Resources standardizes the **Policy** layer (cache, auth, pagination, normalization) so it can be
 * injected into any **Transport**, and owns the **client-initiated request/response** delivery transport
 * (the *pull* side — fetch, one-shot; polling = repeated fetch). The server→client transports are homed
 * elsewhere by purpose (#455): closed-app push → webnotifications, open-app realtime → webrealtime. This
 * is a genuine Protocol — independent transports conform to one client contract (a real provider seam,
 * per the Project/Protocol bar; #061 pagination + #455 transport designs).
 *
 * Two rulings are encoded here, not redecided downstream:
 *  - **Pagination strategy is technical, but not UX-neutral** (#061): whether a `total` is available is
 *    the deciding cross-layer fact. `offset`/`page` recompute a window so a `total` exists → drives
 *    jump-to-page + `rangeLabel` (`pageMode: paged`), but the window shifts under concurrent writes;
 *    `cursor` fetches the next N after a stable key so it is write-stable but exposes **no `total`** and
 *    only `next()`/`previous()` → forces `append`/prev-next. The discriminated union below makes that
 *    pairing constraint un-forgeable in the type, the same fact the Collection Operations intent states
 *    from the UX side.
 *  - **Transport is decoupled from policy** — a `CustomResourceClient` `execute`s an operation and
 *    returns a cold `Consumable` (the Apollo-Link posture generalized for any request kind), so the app
 *    requests `users` without knowing REST vs GraphQL.
 */

// ── Delivery-transport (the client-initiated pull side, #455) ───────────────────────────────────────

/**
 * A cold observable — nothing runs until subscribed; each subscription is an independent execution. The
 * resource transport returns one rather than a settled value so retries / cache / cancellation compose.
 * The platform-wide observable shape; defined here so the contract is self-contained (the runtime impl
 * provides the concrete observable).
 */
export interface Consumable<T> {
  subscribe(observer: {
    next?(value: T): void;
    error?(err: unknown): void;
    complete?(): void;
  }): { unsubscribe(): void };
}

/** A normalized transport operation — the same shape for REST, GraphQL, or a socket. */
export interface ResourceOperation {
  kind: 'query' | 'mutation' | 'subscription';
  /** Normalized cache id. */
  key: unknown[];
  context: Record<string, unknown>;
}

/** The result envelope an operation resolves to — opaque payload, transport-normalized. */
export interface ResourceResult<T = unknown> {
  data?: T;
  error?: unknown;
}

/**
 * A resource client — the swap seam decoupling the app from the transport. `execute` returns a cold
 * `Consumable` (Apollo-Link pattern, generalized for any request kind). Concrete clients (REST, GraphQL,
 * WS) are impl and live in FUI, resolved through the injector chain.
 */
export interface CustomResourceClient {
  execute(operation: ResourceOperation): Consumable<ResourceResult>;
}

// ── Pagination (#061) ───────────────────────────────────────────────────────────────────────────────

/**
 * A pagination strategy definition — a discriminated union so the type itself encodes the #061 pairing
 * constraint. `offset`/`page` expose a `total` (jump-to-page + `rangeLabel`), `cursor` exposes none
 * (`append`/prev-next only, write-stable).
 */
export type CustomPaginationDefinition =
  // total available → drives jump-to-page + rangeLabel; window shifts under writes.
  | { strategy: 'offset'; limit?: number }
  | { strategy: 'page'; limit?: number }
  // no total, next()/previous() only → forces append / prev-next; stable under writes.
  | { strategy: 'cursor'; limit?: number; key?: string };

/**
 * The current slice of a paginated collection. `total` is present only for `offset`/`page` strategies
 * (the cross-layer constraint that gates jump-to-page + `rangeLabel`); `cursor` leaves it absent.
 * `next`/`previous` advance the window, returning the next slice.
 */
export interface CustomPagination<T> {
  /** The current slice of data. */
  readonly items: T[];
  readonly hasNext: boolean;
  readonly hasPrevious: boolean;
  /** Present for `offset`/`page`; absent for `cursor`. */
  readonly total?: number;
  next(): Promise<CustomPagination<T>>;
  previous(): Promise<CustomPagination<T>>;
}

/**
 * A resource definition — the per-entity config the `customResources` registry maps a business entity
 * (`'user'`, `'product'`) to, so the app requests it without knowing the transport. The pagination
 * strategy is one facet; the resolver/tracer facets compose other contracts and stay light here.
 */
export interface ResourceDefinition {
  /** Normalizes request params to a cache id. */
  identify?: (params: unknown) => unknown[];
  /** The pagination strategy for list resources. */
  pagination?: CustomPaginationDefinition;
}
