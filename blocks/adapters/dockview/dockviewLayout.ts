/**
 * dockview adapter — round-trips dockview's native serialized layout through the WE dockable core schema
 * (backlog #1627, the independent 2nd conforming impl the `#project-protocol-bar` rule requires before the
 * #1486 dockable interchange Protocol can be minted). The inverse pair:
 *
 *   - {@link fromDockview} — dockview `api.toJSON()` output → {@link DockLayout} (the convergent
 *     partition-tree the contract fixes: `row`/`column` splits + `stack` leaves of `tabs`).
 *   - {@link toDockview}   — {@link DockLayout} → a dockview `SerializedDockview` (the input to
 *     `api.fromJSON()`), reconstructing an equivalent layout.
 *
 * The lossy-normalization-hub pattern ([[feedback_adapter_normalization_hub]]): the WE core schema is the
 * pivot, and dockview's divergent encodings — its gridview branch/leaf wrapping, the global `panels` map
 * (contentComponent / params / per-panel constraints), `activeGroup`, floating/popout groups, the canvas
 * `width`/`height` — are NOT part of the convergent core. They round-trip **opaquely through the contract's
 * open extension slot** (`DockNodeBase.ext`, #1486): per-panel residue homed on its `stack` node's
 * `ext.dockview`, the canvas-global residue on the root node's `ext.dockviewRoot`. The core layout never
 * reads `ext`; conformance is a round-trip of the tree (`dockview → core → dockview` is identity).
 *
 * dockview's gridview alternates split orientation by depth (a branch lays out along the gridview
 * `orientation`, its children along the perpendicular). We materialize that into the contract's **explicit**
 * per-node `row`/`column` type on the way in, and recover the gridview orientation from the root on the way
 * out (branches carry no orientation in dockview's serialized form — only the root grid does). dockview is
 * the cleanest target family (explicit JSON tree, framework-agnostic) per
 * `we:reports/2026-06-21-docking-tiling-partition-tree.md`. FUI's render (#1511–#1514) is conforming impl
 * family #1; this adapter is the independent family #2.
 *
 * Pure functions, no I/O and no `dockview` runtime dependency — the serialized JSON shape is the contract,
 * mirroring the report adapters ({@link ../report/ingestReport}).
 */
import type {
  DockLayout,
  DockNode,
  DockSplitNode,
  DockStackNode,
  DockPanel,
} from '../../dockable/contract';

// ── dockview serialized layout (the `api.toJSON()` / `api.fromJSON()` subset we map) ────────────────

/** The gridview split axis. `HORIZONTAL` lays children left-to-right (a `row`); `VERTICAL` top-to-bottom (a `column`). */
export type DockviewOrientation = 'HORIZONTAL' | 'VERTICAL';

/** A gridview leaf — a tab-group of panel ids (dockview's `SerializedLeafNode`). */
export interface DockviewLeafNode {
  type: 'leaf';
  data: {
    /** Panel ids stacked in this group, in tab order. */
    views: string[];
    /** Id of the visible panel; dockview defaults it to the first view. */
    activeView?: string;
    /** Stable group id (the join key for drag-to-dock topology mutation). */
    id: string;
  };
  /** Extent (px) along the parent branch's axis; absent at the root. */
  size?: number;
}

/** A gridview branch — an ordered split of child nodes (dockview's `SerializedBranchNode`). */
export interface DockviewBranchNode {
  type: 'branch';
  /** Child nodes partitioning this branch along its (depth-derived) axis. */
  data: DockviewGridNode[];
  /** Extent (px) along the parent branch's axis; absent at the root. */
  size?: number;
}

/** A node in dockview's serialized gridview. */
export type DockviewGridNode = DockviewLeafNode | DockviewBranchNode;

/** A panel descriptor from dockview's global `panels` map (`SerializedDockviewPanel`). */
export interface DockviewPanel {
  id: string;
  /** dockview content component key — divergent (a framework binding, not part of the core tree). */
  contentComponent?: string;
  tabComponent?: string;
  title?: string;
  /** Opaque per-panel params bag. */
  params?: Record<string, unknown>;
  minimumWidth?: number;
  maximumWidth?: number;
  minimumHeight?: number;
  maximumHeight?: number;
  [extra: string]: unknown;
}

/** dockview's full serialized layout — the gridview tree plus the keyed panel map and canvas-global state. */
export interface SerializedDockview {
  grid: {
    root: DockviewGridNode;
    height: number;
    width: number;
    orientation: DockviewOrientation;
  };
  /** Every panel keyed by id (content/params live here, NOT inline in the tree). */
  panels: Record<string, DockviewPanel>;
  activeGroup?: string;
  floatingGroups?: unknown[];
  popoutGroups?: unknown[];
  [extra: string]: unknown;
}

// ── orientation <-> split-type ──────────────────────────────────────────────────────────────────────

const orientationToType = (o: DockviewOrientation): 'row' | 'column' =>
  o === 'HORIZONTAL' ? 'row' : 'column';
const typeToOrientation = (t: 'row' | 'column'): DockviewOrientation =>
  t === 'row' ? 'HORIZONTAL' : 'VERTICAL';
const flip = (o: DockviewOrientation): DockviewOrientation =>
  o === 'HORIZONTAL' ? 'VERTICAL' : 'HORIZONTAL';

/** Per-panel fields that are NOT in the core tree (everything except the id/title the core captures). */
function panelResidue(p: DockviewPanel): Record<string, unknown> {
  const { id: _id, title: _title, ...rest } = p;
  return rest;
}

// ── dockview → WE dockable core ───────────────────────────────────────────────────────────────────

function nodeFromGrid(
  node: DockviewGridNode,
  orientation: DockviewOrientation,
  panels: Record<string, DockviewPanel>,
): DockNode {
  if (node.type === 'branch') {
    const split: DockSplitNode = {
      type: orientationToType(orientation),
      children: node.data.map((c) => nodeFromGrid(c, flip(orientation), panels)),
    };
    if (node.size !== undefined) split.size = { unit: 'pixel', value: node.size };
    return split;
  }

  // leaf → stack
  const views = node.data.views;
  const tabs: DockPanel[] = views.map((id) => {
    const p = panels[id];
    const tab: DockPanel = { id };
    if (p?.title !== undefined) tab.title = p.title;
    return tab;
  });
  const stack: DockStackNode = { type: 'stack', id: node.data.id, tabs };
  if (node.size !== undefined) stack.size = { unit: 'pixel', value: node.size };

  const activeIdx = node.data.activeView !== undefined ? views.indexOf(node.data.activeView) : -1;
  if (activeIdx > 0) stack.activeTab = activeIdx; // 0 is the default; omit it

  // Divergent per-panel residue rides the stack's ext slot, keyed by panel id (the core never reads it).
  const panelExt: Record<string, Record<string, unknown>> = {};
  for (const id of views) {
    if (panels[id]) panelExt[id] = panelResidue(panels[id]);
  }
  stack.ext = {
    dockview: {
      // verbatim activeView so reconstruction is exact even when it is the first view or absent
      activeView: node.data.activeView,
      panels: panelExt,
    },
  };
  return stack;
}

/**
 * dockview `api.toJSON()` output → {@link DockLayout}. The gridview tree becomes the contract's explicit
 * `row`/`column`/`stack` partition tree (orientation materialized from depth parity); every dockview-specific
 * bit that has no place in the convergent core round-trips opaquely through `ext` — per-panel residue on each
 * stack's `ext.dockview`, the canvas-global residue (orientation / width / height / activeGroup / floating /
 * popout groups) on the root node's `ext.dockviewRoot`. Inverse of {@link toDockview}.
 */
export function fromDockview(sd: SerializedDockview): DockLayout {
  const rootOrientation = sd.grid.orientation;
  const root = nodeFromGrid(sd.grid.root, rootOrientation, sd.panels);

  // Canvas-global residue → root node ext (a distinct key from any per-stack `ext.dockview`).
  const rootResidue: Record<string, unknown> = {
    orientation: sd.grid.orientation,
    width: sd.grid.width,
    height: sd.grid.height,
  };
  if (sd.activeGroup !== undefined) rootResidue.activeGroup = sd.activeGroup;
  if (sd.floatingGroups !== undefined) rootResidue.floatingGroups = sd.floatingGroups;
  if (sd.popoutGroups !== undefined) rootResidue.popoutGroups = sd.popoutGroups;
  root.ext = { ...(root.ext ?? {}), dockviewRoot: rootResidue };

  const layout: DockLayout = { root };
  if (sd.grid.root.type === 'branch') layout.orientation = orientationToType(rootOrientation);
  return layout;
}

// ── WE dockable core → dockview ─────────────────────────────────────────────────────────────────────

function gridFromNode(
  node: DockNode,
  panels: Record<string, DockviewPanel>,
  leafSeq: { n: number },
): DockviewGridNode {
  if (node.type !== 'stack') {
    const branch: DockviewBranchNode = {
      type: 'branch',
      data: node.children.map((c) => gridFromNode(c, panels, leafSeq)),
    };
    if (node.size) branch.size = node.size.value;
    return branch;
  }

  // stack → leaf; rebuild the panels map from core titles + the stashed residue
  const ext = (node.ext?.dockview ?? {}) as {
    activeView?: string;
    panels?: Record<string, Record<string, unknown>>;
  };
  const views = node.tabs.map((t) => t.id);
  for (const tab of node.tabs) {
    const residue = ext.panels?.[tab.id] ?? {};
    const panel: DockviewPanel = { id: tab.id, ...residue };
    if (tab.title !== undefined) panel.title = tab.title;
    panels[tab.id] = panel;
  }
  const activeView =
    ext.activeView !== undefined ? ext.activeView : views[node.activeTab ?? 0];
  const leaf: DockviewLeafNode = {
    type: 'leaf',
    data: { views, id: node.id ?? `group-${++leafSeq.n}` },
  };
  if (activeView !== undefined) leaf.data.activeView = activeView;
  if (node.size) leaf.size = node.size.value;
  return leaf;
}

/**
 * {@link DockLayout} → a dockview `SerializedDockview` (the input to `api.fromJSON()`). Reconstructs the
 * gridview tree, rebuilds the global `panels` map from each stack's core titles + its stashed `ext.dockview`
 * residue, and replays the canvas-global state off the root node's `ext.dockviewRoot`. When the residue is
 * absent (a hand-authored core layout that never came from dockview) it falls back to sensible defaults
 * (`HORIZONTAL` root, a 1280×720 canvas, generated group ids) so the adapter stays a real generator, not
 * just a replay. Inverse of {@link fromDockview}.
 */
export function toDockview(layout: DockLayout): SerializedDockview {
  const panels: Record<string, DockviewPanel> = {};
  const root = gridFromNode(layout.root, panels, { n: 0 });

  const residue = (layout.root.ext?.dockviewRoot ?? {}) as {
    orientation?: DockviewOrientation;
    width?: number;
    height?: number;
    activeGroup?: string;
    floatingGroups?: unknown[];
    popoutGroups?: unknown[];
  };
  const orientation: DockviewOrientation =
    residue.orientation ??
    (layout.root.type === 'row' || layout.root.type === 'column'
      ? typeToOrientation(layout.root.type)
      : 'HORIZONTAL');

  const sd: SerializedDockview = {
    grid: {
      root,
      orientation,
      width: residue.width ?? 1280,
      height: residue.height ?? 720,
    },
    panels,
  };
  if (residue.activeGroup !== undefined) sd.activeGroup = residue.activeGroup;
  if (residue.floatingGroups !== undefined) sd.floatingGroups = residue.floatingGroups;
  if (residue.popoutGroups !== undefined) sd.popoutGroups = residue.popoutGroups;
  return sd;
}
