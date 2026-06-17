/**
 * selection intent — the **pure-contract half** (model / immediacy / variant / grouping).
 *
 * Types and interfaces only: this module is fully **compile-erased** (no runtime emit) so it can become
 * the `@webeverything/contracts/selection` entry (#872/#879) that FUI depends on (the FUI→WE arrow),
 * superseding byte-replication. The runtime half — the `SelectionBehavior` (`variant: item`,
 * list-selection realization) — lives next door in `./SelectionBehavior.ts`, which re-exports this
 * surface (`export type * from './contract'`) so existing importers keep one site.
 */

export type SelectionModel = 'single' | 'multiple';

export interface SelectionOptions {
  /** CSS selector (scoped to the host) for the selectable items. */
  itemSelector: string;
  /** `single` (default) keeps at most one selected; `multiple` toggles. */
  model?: SelectionModel;
  /** Class set on selected items in addition to `aria-selected`. Default 'selected'. */
  selectedClass?: string;
  onChange?: (change: SelectionChange) => void;
}

export interface SelectionChange {
  selected: HTMLElement[];
  /** The item whose state just changed (selected or deselected), or null on clear. */
  last: HTMLElement | null;
}
