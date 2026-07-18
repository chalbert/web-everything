/**
 * Web Graph protocol — the **pure-contract half** (#1289, slice #1443; spec settled by #1351/#1352).
 *
 * Types and interfaces only: this module is fully **compile-erased** (no runtime emit) so it can become
 * the `@webeverything/contracts/graph` entry (#872/#874) that FUI depends on (the FUI→WE arrow),
 * superseding byte-replication — exactly like `charts/contract.ts` / `positioning/contract.ts`. The
 * runtime half — the native-first deterministic layered-DAG layout (#1444), the native-first SVG
 * renderer (#1445), every adapter (ELK/dagre/D3-force layouts; Cytoscape/sigma/canvas renderers), and
 * the swap registries — is impl and lives in FUI (per #1290 / constellation-placement rule 1: runtime
 * in FUI, never the WE repo); only the contract crosses the seam (npm scope mirrors layer).
 *
 * The standard is the **spec, not the renderer** — and because a graph's position is *invented* by an
 * algorithm (not derived from data like a chart's `x = f(field)`), the renderer seam **splits in two**
 * (#1352): a `CustomGraphLayout` turns the semantic `GraphSpec` into a `PositionedGraph` (coordinates),
 * and a `CustomGraphRenderer` consumes those coordinates + already-resolved `ResolvedTheme` tokens and
 * decides *how* to draw. `PositionedGraph` is the only thing crossing between the two seams, so any
 * layout pairs with any renderer; the `GraphSpec` is the only lock — swapping the layered default for an
 * ELK/dagre/D3-force layout or the SVG default for a Cytoscape/sigma adapter never touches it.
 *
 * Transcribed verbatim from the ratified spec (`we:src/_includes/project-webgraph.njk`); no design fork.
 */

/**
 * The portable webgraph artifact — a GraphSpec. SEMANTIC plane ONLY: what the nodes/edges mean. The
 * presentation plane (where each node sits, how it is drawn) is invented downstream by CustomGraphLayout
 * + CustomGraphRenderer and never appears here. Grounded on plateau's GraphNode/GraphEdge (the Platform
 * Map consumer this standard exists to reproduce).
 */
export interface GraphSpec {
  nodes: GraphNodeSpec[];
  edges: GraphEdgeSpec[];
  /** default true — the layered-DAG default assumes edge direction. */
  directed?: boolean;
  /** a SEMANTIC hint (which algorithm FAMILY), never coordinates. */
  layout?: LayoutStrategy;
  /**
   * The ordered lane axis for the `swimlane` layout mode (#2533 Fork 7) — a SEMANTIC ordering of
   * `GraphNodeSpec.lane` values, never coordinates. Lanes render as columns (or rows) in list order;
   * the layout assigns each node to its declared lane and routes fork/fan-in wires to honor lane
   * boundaries. Ignored by non-lane-constrained layouts (`layered`/`force`/`tree`/`radial`). BPMN names
   * these "swimlanes" (pools/lanes); git-graph and subway-map layouts assign nodes to lanes the same way.
   */
  lanes?: string[];
}

export interface GraphNodeSpec {
  /** stable join key (project id / provider key / protocol id). */
  id: string;
  /** the accessible/displayed name — a11y-derivable. */
  label?: string;
  /** semantic category; drives grouping/encoding, resolved style = theme. */
  kind?: string;
  /** optional cluster/partition membership (a semantic grouping). */
  group?: string;
  /**
   * Lane/track assignment for the `swimlane` layout mode (#2533 Fork 7) — a SEMANTIC key matching a
   * `GraphSpec.lanes` entry (BPMN pool/lane, git branch, subway line). The swimlane layout constrains the
   * node's position to this lane's column/row; every other layout ignores it. Distinct from `group`
   * (an unordered cluster): a lane is an ORDERED partition the layout renders as a swimlane.
   */
  lane?: string;
}

export interface GraphEdgeSpec {
  /** GraphNodeSpec id. */
  from: string;
  /** GraphNodeSpec id. */
  to: string;
  label?: string;
  /** semantic relation type (e.g. "depends-on", "provides"). */
  kind?: string;
  /** per-edge override of the graph-level default. */
  directed?: boolean;
  /** semantic magnitude; the resolved thickness/scale is theme. */
  weight?: number;
}

/**
 * The native-first default layout family. Position is INVENTED by the algorithm, so the family is a
 * swappable dimension: the deterministic `layered` DAG is the conformance-assertable default; `force`
 * (non-deterministic) ships as an adapter behind CustomGraphLayout, never as the default.
 *
 * `swimlane` (#2533 Fork 7, minted as a LAYOUT MODE — not a sibling intent) is a lane-constrained
 * variant: nodes are assigned to lanes (`GraphNodeSpec.lane`, ordered by `GraphSpec.lanes`) that render
 * as columns/rows, and fork/fan-in wires are routed to honor lane boundaries. This is the studied
 * residue once CSS Grid (`grid-column` for contiguous lanes/spans) and the existing graph wires are
 * subtracted: a genuine lane-assignment + fork/rejoin-routing algorithm — BPMN pools/lanes, git commit
 * graphs (GitKraken / `git log --graph` / GitHub network), subway/metro-map line layout, kanban
 * swimlanes, DAW track lanes. It belongs ON Web Graph (which already owns the fork/fan-in topology), so
 * it is deterministic and conformance-assertable like `layered`; a standalone swimlane intent would
 * re-derive graph layout and is rejected.
 */
export type LayoutStrategy = 'layered' | 'force' | 'tree' | 'radial' | 'swimlane';

/**
 * The intermediate the two seams hand off — COORDINATES, never semantics. A GraphSpec becomes a
 * PositionedGraph; the renderer draws that. Splitting here lets any layout pair with any renderer.
 */
export interface PositionedGraph {
  nodes: PositionedNode[];
  edges: PositionedEdge[];
  bounds: { width: number; height: number };
}

export interface PositionedNode {
  id: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
}

export interface PositionedEdge {
  from: string;
  to: string;
  waypoints?: { x: number; y: number }[];
}

/**
 * The layout-swap contract — the first seam. Consumes the SEMANTIC spec; emits coordinates only.
 * The native-first default is a deterministic layered/columnar DAG (#1444); non-deterministic engines
 * (force-directed) and richer layered engines (ELK/dagre) register as adapters, never as the default.
 */
export interface CustomGraphLayout {
  /** which family this layout implements. */
  readonly strategy: LayoutStrategy;
  /**
   * Deterministic layouts (layered) are the conformance-assertable default; non-deterministic ones
   * (force-directed) ship as adapters, never as the default — same input must give same coordinates.
   */
  readonly deterministic: boolean;
  /** SPEC → coordinates; never draws. */
  layout(spec: GraphSpec): PositionedGraph;
}

/**
 * The draw-swap contract — the second seam. Consumes COORDINATES + theme; never the GraphSpec directly,
 * so swapping the renderer leaves both the spec and the layout untouched. The native-first default is a
 * labellable SVG renderer (#1445); Cytoscape/sigma/canvas adapters register as alternatives. Conformance
 * scores semantic fidelity, theme application, and accessibility first-class (the tier-1 adjacency
 * description via `describe()`; tier-2 grounded in the graph-a11y-model research).
 */
export interface CustomGraphRenderer {
  render(positioned: PositionedGraph, theme: ResolvedTheme, target: Element): GraphHandle;
}

/** webtheme tokens already resolved for this graph — the presentation plane the spec defers to. */
export interface ResolvedTheme {
  /** Categorical hues for node `kind`/`group`, in order. */
  palette: string[];
  /** edge thickness range the semantic `weight` maps into. */
  edgeWeightRange?: [number, number];
  // typography / spacing / node-shape tokens flow through here too (webtheme).
}

export interface GraphHandle {
  /** re-draw on a re-layout. */
  update(positioned: PositionedGraph): void;
  destroy(): void;
  /** The adjacency-description a11y text, derivable from the graph — the tier-1 conformance floor. */
  describe(): string;
}
