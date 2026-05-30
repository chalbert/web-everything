/**
 * @file blocks/type-ahead/types.ts
 * @description Shared types for the Type-Ahead behavior. Mirrors the
 * Type-Ahead Intent contract (src/_data/intents.json#type-ahead).
 */

/** How typed characters are mapped to items. */
export type TypeAheadMatching = 'prefix' | 'cycle' | 'prefix-then-cycle';

/** Programmatic options for {@link TypeAheadBehavior}. Attributes override these. */
export interface TypeAheadOptions {
  /** Matching strategy. Default `prefix-then-cycle`. */
  matching?: TypeAheadMatching;
  /** Idle ms before the buffer resets. Default 500. */
  resetMs?: number;
  /** Wrap focus past the ends of the collection. Default true. */
  wrap?: boolean;
  /** Override how an item's searchable label is derived. */
  label?: (item: Element) => string;
}

/** The Type-Ahead Intent contract this block implements. */
export interface TypeAheadIntent {
  matching: TypeAheadMatching;
  resetMs: number;
  wrap: boolean;
  label?: (item: Element) => string;
}

/** Detail for the `typeahead-match` event. */
export interface TypeAheadMatchDetail {
  /** The full buffer that produced the match. */
  query: string;
  /** The item focus moved to. */
  matched: HTMLElement;
}

/** Detail for the `typeahead-nomatch` and `typeahead-reset` events. */
export interface TypeAheadQueryDetail {
  /** The buffer at the time of the event. */
  query: string;
}
