// @webeverything/contracts/suggested-edit — the Suggested-Edit contract's pure-contract surface
// (#2145, ratified #2029 Fork 1 standalone split).  Type-only re-export (zero runtime emit) of the
// canonical contract module; the runtime half (apply dispatch, CRDT integration, optimistic-revert)
// is FUI's.  Composed by: the `annotation` intent (suggestion motivation body) and the Editor Engine
// protocol (apply transaction).  The `target` field composes the #1471 RangeAnchor contract
// (@webeverything/contracts/range-anchor) — this contract owns the propose→accept/reject lifecycle;
// range-anchor owns the durable location.  WAI-ARIA 1.3 `role=suggestion` grounding: models the
// insertion+deletion wrap that the spec defines inside the suggestion element; works over read-only
// hosts (record-only — no engine, no mutation).
export type * from '../suggested-edit/contract';
