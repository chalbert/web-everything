/**
 * Guard protocol — the **pure-contract half** (#288, graduated `guard`).
 *
 * Types and interfaces only: this module is fully **compile-erased** (no runtime emit) so it can become
 * the `@webeverything/contracts/guard` entry (#872/#874) that FUI depends on (the FUI→WE arrow),
 * superseding byte-replication. The runtime half — the decision guard, the native-first default
 * provider, the error class, the `ALLOW` value — lives next door in `./provider.ts` (impl, → FUI); the
 * swap registry in `./registry.ts`; the default wiring in `./index.ts`.
 *
 * A predicate/policy is attached to a *region* (document / route / modal / element) and evaluated at a
 * region *lifecycle event* (entering it, or trying to leave it), resolved by a **swappable**
 * `CustomGuardProvider` — default → project override → custom plug.
 *
 * Three #288 rulings shape this contract and are encoded here, not redecided downstream:
 *  - The provider contract is **the only lock**: `evaluate` is **async** (a decision can require a
 *    server round-trip), the front-end is a **UX mirror, never enforcement** (the back end is
 *    authoritative), and a grant is **revocable** — `subscribe` lets a provider signal that a
 *    previously-allowed region must re-evaluate (session expired, flag flipped).
 *  - **Deny-outcomes are NOT unified.** The base `GuardDecision` carries only `allow` + an optional
 *    `reason`; each *member* intent owns its own denial family (exit guard → user-mediated confirm;
 *    access control → `hide | redirect | forbid | cloak`). Members layer their outcome on top of this
 *    seam — they do not redefine it.
 *  - The native-first default is **permissive** (no policy ⇒ allow), and *exit* leans on the platform's
 *    own cancelable primitives (`beforeunload`, the Navigation API `navigate` intercept, a dialog
 *    `cancel`) rather than inventing a blocking mechanism — see the default provider in `./provider.ts`.
 */

/** What is being guarded. Opaque to the seam — a provider keys policy off `kind`/`id`, never the node. */
export type GuardRegionKind = 'document' | 'route' | 'modal' | 'element';

/** A region descriptor: its kind plus an optional stable id (route path, modal name, element id). */
export interface GuardRegion {
  readonly kind: GuardRegionKind;
  /** A stable identifier within the kind — e.g. the route path or modal name. Optional for `document`. */
  readonly id?: string;
}

/**
 * The region lifecycle event a guard fires at. `enter` is the *entry* mirror (access control — may I
 * reach this region?); `leave` is the *exit* mirror (exit guard — may I abandon this region?). The two
 * member intents (#178 access control, #273 exit guard) each own one.
 */
export type GuardEvent = 'enter' | 'leave';

/** An opaque per-evaluation context bag (the navigation event, the candidate user, flags…). */
export type GuardContext = Record<string, unknown>;

/**
 * The terminal answer a provider resolves to. **Intentionally minimal** — `allow` plus an optional
 * human-facing `reason`. The denial *strategy* (confirm vs hide/redirect/forbid/cloak) is the member
 * intent's concern, layered on top; the seam never unifies it (#288).
 */
export interface GuardDecision {
  readonly allow: boolean;
  /** Why the region was denied (or allowed-with-warning). Surfaced by the member's deny-outcome. */
  readonly reason?: string;
}

/** Notified when a previously-resolved decision for a region is revoked and must be re-evaluated. */
export type GuardRevocationListener = (region: GuardRegion) => void;

/**
 * The injectable contract every guard provider satisfies — one interface, swappable impls (the
 * native-first default, a project override, a custom plug). `key` names it for registration.
 * `evaluate` is **async** and **trust-crossing**: it may consult the server, and its answer is a UX
 * mirror of the authoritative back-end decision, never the enforcement point. `subscribe` is the
 * optional revocation signal — a provider that can have a grant withdrawn (auth expiry, flag flip)
 * implements it; a static provider omits it.
 */
export interface CustomGuardProvider {
  readonly key: string;
  /** Resolve whether `event` on `region` is allowed, given `context`. Async by contract (#288). */
  evaluate(region: GuardRegion, event: GuardEvent, context?: GuardContext): Promise<GuardDecision>;
  /** Watch for revocation of a region's standing decision; returns an unsubscribe. Optional. */
  subscribe?(region: GuardRegion, onRevoke: GuardRevocationListener): () => void;
}
