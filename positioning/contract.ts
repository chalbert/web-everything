/**
 * Positioning protocol — the **pure-contract half** (#1018, slice #1048).
 *
 * Types and interfaces only: this module is fully **compile-erased** (no runtime emit) so it can become
 * the `@webeverything/contracts/positioning` entry (#872/#874) that FUI depends on (the FUI→WE arrow),
 * superseding byte-replication — exactly like `guard/contract.ts` and `analytics/contract.ts`. The
 * runtime half — the native CSS-anchor strategy, the JS fallback, the feature-detected resolver, and the
 * `customPositioning` swap registry — is impl and lives in FUI (`fui:blocks/droplist/positioning/`); only
 * the contract crosses the seam (npm scope mirrors layer).
 *
 * A surface (listbox / menu / popover) declares **intent** — a preferred `placement` plus collision
 * flags — and a swappable `PositioningStrategy` decides **how** to realize it: native CSS Anchor
 * Positioning, a JS placement loop, or any adapter (Floating UI) swapped in over the injector chain
 * (#149). This is a genuine Protocol, not just an intent: there is a real **provider seam** (independent
 * positioning engines conform to one `PositioningStrategy` contract) per the Project/Protocol bar.
 *
 * Two contract rulings are encoded here, not redecided downstream:
 *  - **Placement is declarative intent, never CSS.** A `PlacementContext` carries the trigger, the
 *    surface, a `Placement`, an `anchorName`, and the collision flags — the strategy owns every CSS and
 *    script decision. The CSS `position-area` mapping is a native-impl detail and stays in FUI, not the
 *    contract.
 *  - **A strategy is reversible.** `place` returns a `PositioningTeardown` that undoes *every* DOM
 *    mutation it made (styles, listeners, observers), so a surface is left exactly as it was found — the
 *    same revocable shape the rest of the platform's seams use.
 */

/**
 * The placements a surface can request, relative to its trigger. A `<side>` or a `<side>-<align>`; the
 * native strategy maps each to a CSS `position-area`, but the mapping itself is impl (→ FUI), not part of
 * the contract. Tightens FUI's loose `string` to the known set.
 */
export type Placement =
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'top-start'
  | 'top-end'
  | 'bottom-start'
  | 'bottom-end'
  | 'left-start'
  | 'left-end'
  | 'right-start'
  | 'right-end';

/**
 * Everything a strategy needs to place a surface relative to its trigger — pure *intent*, no CSS and no
 * script decisions. The strategy owns the "how".
 */
export interface PlacementContext {
  /** The element the surface is anchored to (the combobox input, button, …). */
  readonly trigger: HTMLElement;
  /** The surface being positioned (the listbox / menu / popover). */
  readonly surface: HTMLElement;
  /** Preferred placement, e.g. `bottom-start`. */
  readonly placement: Placement;
  /** A stable CSS `anchor-name` identity linking surface ↔ trigger (the native strategy keys off it). */
  readonly anchorName: string;
  /** Re-place to the opposite side when the preferred side overflows. */
  readonly flip?: boolean;
  /** Slide along the axis to stay within the viewport. */
  readonly shift?: boolean;
  /** Shrink to the available space rather than overflow. */
  readonly resize?: boolean;
}

/**
 * The teardown a strategy returns from `place`: calling it undoes every DOM mutation the placement made
 * (styles, listeners, observers), restoring the surface to its pre-placement state.
 */
export type PositioningTeardown = () => void;

/**
 * A positioning strategy — the swappable provider. `place` realizes the `PlacementContext` and returns a
 * `PositioningTeardown`. Concrete strategies (native anchor, JS fallback, Floating-UI adapter) are impl
 * and live in FUI; they are resolved nearest-scope-wins through the injector chain, defaulting to the
 * feature-detected native/JS choice when no provider is set.
 */
export interface PositioningStrategy {
  /** Stable identifier, surfaced for legibility (`data-positioning-strategy`). */
  readonly name: string;
  place(context: PlacementContext): PositioningTeardown;
}
