/**
 * master-detail intent — the **pure-contract half** (#356).
 *
 * Types and interfaces only: this module is fully **compile-erased** (no runtime emit) so it can become
 * the `@webeverything/contracts/master-detail` entry (#872/#879) that FUI depends on (the FUI→WE arrow),
 * superseding byte-replication. The runtime half — the `MasterDetailBehavior` coordinator (which composes
 * the shipping `SelectionBehavior`) — lives next door in `./MasterDetailBehavior.ts`, which re-exports
 * this surface (`export type * from './contract'`) so existing importers keep one site.
 */

export type FocusFlow = 'retain' | 'advance';
export type EmptyState = 'placeholder' | 'collapse';

export interface MasterDetailOptions {
  /** CSS selector for the selectable master items, within the master element. */
  itemSelector: string;
  /** The coupled detail region. */
  detailEl: HTMLElement;
  /** Map a selected master item to the key its detail is rendered from. */
  keyOf: (item: HTMLElement) => string | null | undefined;
  /** Render the detail for a key into the region (sync or async). */
  renderDetail: (key: string, detailEl: HTMLElement) => void | Promise<void>;
  /** On select: keep focus on the list (`retain`, default) or move it to the detail (`advance`). */
  focusFlow?: FocusFlow;
  /** With nothing selected: show a placeholder (default) or hide the region. */
  emptyState?: EmptyState;
  /** Class the composed SelectionBehavior toggles on the selected item. */
  selectedClass?: string;
  /** Markup for the placeholder empty state. */
  placeholderHTML?: string;
  /** Accessible label for the detail region. */
  detailLabel?: string;
}
