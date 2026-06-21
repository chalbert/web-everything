// @webeverything/contracts/graph — the Web Graph protocol's pure-contract surface (#1289/#1351/#1352, slice #1443).
// Type-only re-export (zero runtime emit) of the canonical contract module; the runtime impl is FUI's
// (the native-first deterministic layered-DAG layout #1444, the native-first SVG renderer #1445, every
// ELK/dagre/D3-force layout + Cytoscape/sigma/canvas renderer adapter, and the swap registries all live
// in FUI, statute #1290). This is the FUI→WE arrow over which the standard resolves: any layout
// satisfies `CustomGraphLayout` and any drawing engine satisfies `CustomGraphRenderer` by consuming the
// semantic `GraphSpec` / `PositionedGraph` + `ResolvedTheme` without any runtime crossing the seam,
// exactly like `./charts` and `./positioning`. #1444 + #1445 (the FUI defaults) import these types.
export type * from '../graphs/contract';
