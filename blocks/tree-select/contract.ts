/**
 * tree-select block — the **pure-contract half** (#296), the hierarchical member of the droplist family.
 *
 * Types and interfaces only: this module is fully **compile-erased** (no runtime emit) so it can become
 * the `@webeverything/contracts/tree-select` entry (#872/#879) that FUI depends on (the FUI→WE arrow),
 * superseding byte-replication. The runtime half — the `TreeSelectBehavior` (the `hierarchy` intent's
 * `role="tree"` keyboard + ARIA realization, with optional cascade) — lives next door in
 * `./TreeSelectBehavior.ts`, which re-exports this surface (`export type * from './contract'`) so
 * existing importers keep one site.
 */

export interface TreeNode {
  id: string;
  label: string;
  children?: TreeNode[];
  /** Whether this node can be checked (a leaf coverage, or a selectable group). */
  selectable?: boolean;
}

export type TreeModel = 'single' | 'multiple';

export interface TreeSelectOptions {
  model?: TreeModel;
  /** Toggling a node toggles all its descendants; a partially-checked parent reads mixed. */
  cascade?: boolean;
  defaultExpanded?: boolean;
  onChange?: (selectedIds: string[]) => void;
}
