/**
 * dockable block — the **pure-contract half** (#1485 slice #1510; intent ratified #1437 Fork 1a).
 *
 * Types and interfaces only: this module is fully **compile-erased** (no runtime emit) so it can become
 * the `@webeverything/contracts/dockable` entry (#872/#874) that FUI depends on (the FUI→WE arrow),
 * superseding byte-replication — exactly like `stepper/contract.ts` / `graphs/contract.ts`. The runtime
 * half — the recursive container render (#1511), drag-to-dock hit-testing + topology mutation (#1512),
 * serialize/restore (#1513), and `popout: window` relocation (#1514) — is impl and lives in FUI (per
 * #1290 / constellation-placement rule 1: runtime in FUI, never the WE repo); only the contract crosses
 * the seam.
 *
 * The model is the **recursive partition-tree** (golden-layout / dockview / FlexLayout / rc-dock family):
 * a node is a `row`, `column`, or `stack`; nesting is arbitrary; space is fully partitioned (no gaps, no
 * overlaps). Splits (`row`/`column`) are the `resizable` linear divider applied recursively; `stack`
 * leaves are tab-stacks (the `tabs` block). This is the convergent core schema that dockview / FlexLayout
 * / golden-layout all emit; the serialized form is also the #1486 interchange Protocol's core schema, with
 * an OPEN EXTENSION SLOT (`ext`) for the divergent popout-state / per-panel-metadata / constraint
 * encodings — conformance is a round-trip of the tree.
 *
 * Transcribed from the ratified intent (`we:src/_data/intents/dockable.json`); no design fork.
 */

/**
 * Per-node sizing within its parent split (`we:src/_data/intents/dockable.json` → `sizing` dimension).
 * `ratio` keeps proportional weights stable across container resizes (the responsive default, mirroring
 * `resizable.unit=percent`); `pixel` fixes the extent and lets siblings absorb the slack.
 */
export type Sizing = 'ratio' | 'pixel';

/**
 * Whether a panel/stack can pop out into a separate OS window (`dockable.json` → `popout` dimension).
 * `none` keeps the whole layout in-page (minimal-core default); `window` relocates a live subtree to
 * another `Window`. Cross-window relocation breaks `moveBefore` and the single-document live-region /
 * roving-tabindex wiring — handled in the realizing build (#1514), not the contract.
 */
export type Popout = 'none' | 'window';

/** Discriminant of a node in the partition tree: a split (`row`/`column`) or a tab-`stack` leaf. */
export type DockNodeType = 'row' | 'column' | 'stack';

/**
 * A node's size within its parent split. `value` is a proportional weight when `unit: 'ratio'` (the
 * default) or a fixed extent in px when `unit: 'pixel'`. `min`/`max` are numeric constraints (not enum
 * values) that bound the split's travel and feed the WAI-ARIA APG Window Splitter `aria-valuemin` /
 * `aria-valuemax` on the divider.
 */
export interface DockSize {
  /** Default `ratio`. */
  unit?: Sizing;
  /** Ratio weight (relative to siblings) or pixel extent, per `unit`. */
  value: number;
  /** Lower travel bound → Window Splitter `aria-valuemin`. */
  min?: number;
  /** Upper travel bound → Window Splitter `aria-valuemax`. */
  max?: number;
}

/** Fields shared by every node in the tree. */
export interface DockNodeBase {
  /** Stable identity for serialization / drag-to-dock topology mutation; optional for inline literals. */
  id?: string;
  /** This node's size within its parent split. Absent at the root (the root fills its host). */
  size?: DockSize;
  /**
   * OPEN EXTENSION SLOT (#1486): divergent per-impl encodings (popout window geometry, per-panel
   * metadata, constraint vocabularies) that are NOT part of the convergent core schema. Round-trip
   * conformance preserves it opaquely; the core layout never reads it.
   */
  ext?: Record<string, unknown>;
}

/**
 * A split container — `row` lays its `children` out horizontally (left-to-right panes), `column`
 * vertically. The split axis IS the node type (the intent's `orientation` dimension only seeds the
 * root). Dragging a separator between two children reflows them via the recursive `resizable` divider;
 * space stays fully partitioned.
 */
export interface DockSplitNode extends DockNodeBase {
  type: 'row' | 'column';
  /** Ordered child nodes partitioning this container along its axis. */
  children: DockNode[];
}

/**
 * A leaf tab-stack — its `tabs` are panels rendered one-at-a-time behind the `tabs` block (WAI-ARIA APG
 * Tabs: roving tabindex, `aria-controls`, arrow navigation). Panels drag-to-dock between stacks.
 */
export interface DockStackNode extends DockNodeBase {
  type: 'stack';
  /** The panels stacked behind this leaf's tab strip. */
  tabs: DockPanel[];
  /** Index into `tabs` of the visible panel; default 0. */
  activeTab?: number;
  /** Whether this whole stack may pop out (`dockable.json` → `popout`); default `none`. */
  popout?: Popout;
}

/** A panel leaf inside a `stack` — the unit a user drags between stacks. */
export interface DockPanel {
  /** Stable identity (join key for the hosted content + drag-to-dock topology mutation). */
  id: string;
  /** Human label shown on the tab. */
  title?: string;
  /** Whether the tab shows a close affordance; default true. */
  closable?: boolean;
  /** Whether this panel alone may pop out (`dockable.json` → `popout`); default `none`. */
  popout?: Popout;
}

/** A node in the recursive partition tree: a `row`/`column` split or a `stack` leaf. */
export type DockNode = DockSplitNode | DockStackNode;

/**
 * The portable dockable artifact — a serialized layout tree. This is the core schema of the #1486
 * interchange Protocol (the conforming impl #1513 round-trips it). The root node fills its host; the
 * `orientation` only documents the seeded root axis (already encoded in `root.type`).
 */
export interface DockLayout {
  /** The partition tree's root container. */
  root: DockNode;
  /** Documents the root split axis seed (`dockable.json` → `orientation`); default `row`. Informational — `root.type` is authoritative. */
  orientation?: 'row' | 'column';
}
