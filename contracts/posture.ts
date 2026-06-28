// @webeverything/contracts/posture — the plugged↔unplugged posture-spectrum contract (#1872, type-only).
//
// Per the layer carve ratified in #1872 (docs/agent/platform-decisions.md#observe-only-posture-spectrum):
// the posture ENUM + the per-plug/global selection SHAPE are a WE **type-only** contract (zero runtime emit,
// #1282 — a WE artifact never ships impl); the observe-only INSTRUMENT + the upgrade QUEUE are FUI
// (`fui:plugs/observeOnly.ts`, build #1899); and the *selected* posture VALUE is project config
// (config-extends-platform-default).

/**
 * A plug's runtime posture along the unplugged↔plugged spectrum (#1872). The invariant of the observe-only
 * band is that **native method semantics are never altered** — it only observes and, at most, schedules a
 * deferred `upgrade(root)`.
 *
 * - `unplugged`  — manual `register`/`upgrade`, zero global footprint (the supported product surface, #606).
 *                  May carry a pure-`MutationObserver` {@link UnpluggedAutoUpgradeConfig.autoUpgrade} knob —
 *                  it patches nothing, so it folds *into* unplugged rather than being a separate rung.
 * - `diagnostic` — observe-only: a prototype-method **wrapper** (observe-then-forward, never altering native
 *                  semantics) over the same method set plugged patches, giving the call-site + creation-time
 *                  attribution a `MutationObserver` cannot. Earns separate-rung status because it *must*
 *                  patch a method to attribute. Defers a microtask-batched `upgrade`.
 * - `plugged`    — full prototype patching that reaches true residue (the proposed-standard POC).
 */
export type PluggedPosture = 'unplugged' | 'diagnostic' | 'plugged';

/**
 * Per-plug + global posture selection (config-extends-platform-default). A plug with no explicit entry takes
 * {@link default}. Diagnostic/compatibility default **off in prod**; switching a plug's posture at runtime
 * requires a page reload (insertion-patch teardown is irreversible).
 */
export interface PostureSelection {
  /** The global default posture when a plug has no explicit `perPlug` entry. */
  default: PluggedPosture;
  /** Per-plug overrides, keyed by plug `localName`. */
  perPlug?: Readonly<Record<string, PluggedPosture>>;
}

/**
 * The unplugged `autoUpgrade` knob (#1872 fold): a global `MutationObserver` that schedules a deferred
 * upgrade on any connected insertion. It patches **no** prototype member, so it is semantics-safe and lives
 * *inside* unplugged — not as a separate posture. Candidate default-on, but always overridable (a global
 * observer is semantics-safe yet not footprint-free).
 */
export interface UnpluggedAutoUpgradeConfig {
  autoUpgrade?: boolean;
}
