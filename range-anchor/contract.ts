/**
 * Durable Range Anchor protocol — the **pure-contract half** (#1471, ratified #1408 Fork 2 split).
 *
 * Types and interfaces only: this module is fully **compile-erased** (no runtime emit) so it can become
 * the `@webeverything/contracts/range-anchor` entry (#872/#874) — the foundational slice the `annotation`
 * intent + any FUI behavior block import (the contract-ts-is-a-separate-slice rule: those consumers can't
 * import it until it lands). The runtime half — the serializer/resolver impls, the fuzzy matcher — is
 * impl and lives in FUI; only the contract crosses the seam.
 *
 * The genuinely hard, recurring, *unowned* problem this standardizes: capture a `Range`, serialize it to
 * a robust selector bundle that survives the document being re-fetched / lightly edited, and re-resolve
 * it later — with a **fuzzy fallback** and a **first-class orphan state** when the text is gone. It is
 * **target-agnostic** (reusable for annotation, deep-linking, citations, `#:~:text=`-style scroll-to-text,
 * durable test selectors), which is why it is its own standard, not annotation-internal machinery.
 *
 * **W3C Web Annotation selector vocabulary, adopted wholesale at the wire layer** (#1408 / standards-bodies-
 * are-upstream): `TextQuoteSelector` / `TextPositionSelector` / `RangeSelector` are the upstream shapes,
 * not re-minted. Robustness comes from storing *several* selectors together (a {@link SelectorBundle}) and
 * re-resolving against the best survivor (the Hypothesis / RecogitoJS precedent).
 */

/**
 * Anchor by the **quoted text** + surrounding context — survives the offset shifting (text inserted/removed
 * elsewhere) but not the quote itself being edited. W3C `TextQuoteSelector`, verbatim.
 */
export interface TextQuoteSelector {
  readonly type: 'TextQuoteSelector';
  /** The exact selected substring. */
  readonly exact: string;
  /** A snippet immediately before `exact` — disambiguates repeated quotes. */
  readonly prefix?: string;
  /** A snippet immediately after `exact`. */
  readonly suffix?: string;
}

/**
 * Anchor by **character offset** into the root's text content — exact while the document is byte-identical,
 * brittle under any edit. W3C `TextPositionSelector`, verbatim. The fast path + the disambiguator for a
 * repeated quote.
 */
export interface TextPositionSelector {
  readonly type: 'TextPositionSelector';
  /** Start offset (UTF-16 code units) into the normalized text of the refinement root. */
  readonly start: number;
  /** End offset (exclusive). */
  readonly end: number;
}

/**
 * Anchor by a **DOM Range** between two sub-selectors — used when the selection spans elements. W3C
 * `RangeSelector`, verbatim; its endpoints are themselves selectors (typically position/quote).
 */
export interface RangeSelector {
  readonly type: 'RangeSelector';
  readonly startSelector: TextQuoteSelector | TextPositionSelector;
  readonly endSelector: TextQuoteSelector | TextPositionSelector;
}

/** Any single W3C selector this standard understands. */
export type Selector = TextQuoteSelector | TextPositionSelector | RangeSelector;

/**
 * The stored **bundle** — several selectors describing the *same* range, kept together so re-resolution
 * can fall back from the brittle-but-exact (`position`) to the robust (`quote`) survivor. The W3C "multiple
 * selectors refine each other" pattern; the durability mechanism of the whole standard.
 */
export interface SelectorBundle {
  readonly selectors: Selector[];
  /** Which strategy produced/should-drive this bundle (see {@link AnchorStrategy}). */
  readonly strategy: AnchorStrategy;
}

/**
 * The `anchorStrategy` dimension (#1408 Fork 3, homed here) — *which* selector(s) to capture and prefer.
 * `quote` (context-robust), `position` (offset-exact), or `bundle` (both, fall back fuzzy). **Default
 * `bundle`** (the most-flexible / most-robust value; restriction to a single strategy is the author's
 * opt-in). Mandating one was the rejected branch (less robust).
 */
export type AnchorStrategy = 'quote' | 'position' | 'bundle';

/** The most-flexible default for {@link AnchorStrategy} — robustness first. */
export const DEFAULT_ANCHOR_STRATEGY: AnchorStrategy = 'bundle';

/**
 * The outcome of re-resolving a {@link SelectorBundle} against a (possibly changed) document. **Orphan is
 * a first-class state** (#1408 / Hypothesis precedent): a failed re-anchor is a real, surfaceable outcome,
 * never a thrown error or a silent drop.
 */
export type AnchorResolution =
  /** Re-anchored exactly — every preferred selector agreed. */
  | { readonly status: 'anchored'; readonly range: Range }
  /** Re-anchored via the fuzzy fallback — the text moved/changed; `confidence` ∈ [0,1]. */
  | { readonly status: 'fuzzy'; readonly range: Range; readonly confidence: number }
  /** The anchored text could not be found — a first-class orphan, surfaced to the consumer. */
  | { readonly status: 'orphan' };

/** Options for capturing a range into a bundle. */
export interface SerializeOptions {
  /** Which strategy to capture (default {@link DEFAULT_ANCHOR_STRATEGY}). */
  readonly strategy?: AnchorStrategy;
  /** Context length (chars) to store as quote prefix/suffix. Impl-defaulted; a tuning knob, not a fork. */
  readonly contextLength?: number;
}

/** Options for re-resolving a bundle, including the fuzzy-match floor. */
export interface ResolveOptions {
  /**
   * Minimum fuzzy-match confidence ∈ [0,1] below which a near-match is reported as `orphan` rather than
   * `fuzzy`. Impl-defaulted; lets a consumer trade recall for precision.
   */
  readonly minConfidence?: number;
}

/**
 * The injectable serialize/resolve contract — one interface, swappable impls (a FUI default, a project
 * override, a custom plug). **Target-agnostic**: `root` is any element/document whose text the bundle is
 * relative to, so the same anchor works for annotation, deep-linking, citations, or durable test selectors.
 * The runtime (the actual offset math + fuzzy matcher) is FUI's; this seam is the only lock.
 */
export interface RangeAnchor {
  readonly key: string;
  /** Capture a live `Range` (relative to `root`) into a durable, target-agnostic selector bundle. */
  serialize(range: Range, root: Node, options?: SerializeOptions): SelectorBundle;
  /** Re-resolve a stored bundle against `root`, with fuzzy fallback + a first-class orphan outcome. */
  resolve(bundle: SelectorBundle, root: Node, options?: ResolveOptions): AnchorResolution;
}
