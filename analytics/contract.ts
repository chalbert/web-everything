/**
 * Analytics protocol — the **pure-contract half** (#1003, slice #1012).
 *
 * Types and interfaces only: this module is fully **compile-erased** (no runtime emit) so it can become
 * the `@webeverything/contracts/analytics` entry (#872/#874) that FUI depends on (the FUI→WE arrow),
 * superseding byte-replication — exactly like `guard/contract.ts`. The runtime half — the native-first
 * **no-op default tracker** — lives next door in `./provider.ts` (impl, → FUI); the swap registry is the
 * runtime `customTrackers` plug (`plugs/webanalytics/`).
 *
 * The application never knows about Mixpanel / GA4 / Segment — it only knows how to `track()`. A concrete
 * backend is a **swappable** `CustomTracker` resolved through DI (default → project override → custom
 * plug), mirroring the Guard provider seam (#288). The vocabulary is the **Segment Spec** — the *Who*
 * (`identify`), the *What* (`track`), the *Where* (`page`), and B2B account grouping (`group`).
 *
 * Two contract rulings are encoded here, not redecided downstream:
 *  - **Fire-and-forget, not trust-crossing.** Unlike `CustomGuardProvider.evaluate` (async, the answer
 *    crosses a trust boundary and is asserted at the seam), a tracker method returns `void`: emitting an
 *    event is advisory telemetry, never a gate, so there is no decision to validate and no `assert*`.
 *  - **`page` arg order follows the Segment analytics SDK** — `page([category], [name], [properties],
 *    [options])` (category first), deliberately *not* the `(name, category)` order sketched in the early
 *    `analytics.json` draft, so a Segment adapter (#1013) maps positionally with no re-ordering.
 */

/** A free-form trait bag describing a user or account (`{ email, plan, … }`). Opaque to the seam. */
export type AnalyticsTraits = Record<string, unknown>;

/** A free-form property bag describing an event or page (`{ orderId, revenue, … }`). Opaque to the seam. */
export type AnalyticsProperties = Record<string, unknown>;

/**
 * Per-call delivery options (the Segment `options` bag): which integrations receive the call and an
 * optional explicit timestamp. Opaque to the seam — a backend keys delivery off it, the protocol does not.
 */
export interface CustomAnalyticsOptions {
  /** Per-integration on/off, e.g. `{ All: false, Mixpanel: true }`. */
  readonly integrations?: Record<string, boolean>;
  /** Override the event time (defaults to "now" at the backend). */
  readonly timestamp?: Date;
}

/** A semantic event — the *What*. `name` is a human verb-phrase (`'Order Completed'`), never a vendor key. */
export interface CustomAnalyticsEvent {
  readonly name: string;
  readonly properties?: AnalyticsProperties;
  readonly options?: CustomAnalyticsOptions;
}

/** An identity assertion — the *Who*. A stable `userId` plus optional traits. */
export interface CustomAnalyticsIdentity {
  readonly userId: string;
  readonly traits?: AnalyticsTraits;
  readonly options?: CustomAnalyticsOptions;
}

/**
 * The injectable contract every analytics backend satisfies — one interface, swappable impls (the
 * native-first no-op default, a project override, a custom plug). `key` names it for registration
 * (`define` derives the registration key from the tracker's own `key`, mirroring `CustomGuardProvider`).
 *
 * Every method returns `void`: analytics is fire-and-forget telemetry, not a decision the caller awaits.
 */
export interface CustomTracker {
  readonly key: string;
  /** *Who* — associate the current session with a user and optional traits. */
  identify(userId: string, traits?: AnalyticsTraits, options?: CustomAnalyticsOptions): void;
  /** *What* — record a semantic behavior. */
  track(event: string, properties?: AnalyticsProperties, options?: CustomAnalyticsOptions): void;
  /** *Where* — record a page/screen view. Segment arg order: `category` then `name`. */
  page(category?: string, name?: string, properties?: AnalyticsProperties, options?: CustomAnalyticsOptions): void;
  /** B2B — associate the user with an account/organization. */
  group(groupId: string, traits?: AnalyticsTraits, options?: CustomAnalyticsOptions): void;
}
