# Backlog split analysis — 2026-06-30

Focused run: `/slice 1971`.

## Candidate

**#1971** — *Phase 2 — nested-directive lifecycle composition (declarative-HTML deep structural)*
· `kind: epic`, was `size: 13`, `parent: 1963`, no children → **unsliced epic (kind b)**.
Condition (1) "size is volume not a fork" is settled at the parent (#1963, resolved) — the epic is the
decision to decompose. Slices seeded from its build list, verified against the real FUI tree.

### Investigation pass (grounding)

Implementation lives in **Frontier UI** (WE holds zero impl). Phase-1 foundation is built; Phase-2 wiring
is the work.

| Build-list bullet | State today | Grounding |
|---|---|---|
| Comment-anchor directive base | ✅ built | `fui:plugs/webdirectives/CustomComment.ts`, `fui:plugs/webdirectives/CustomCommentRegistry.ts` (upgrade/downgrade/whenDefined) |
| View / ForEach directives | ✅ built (one-time + manual `refresh()`) | `fui:blocks/view/ViewIfDirective.ts`, `fui:blocks/view/ViewSwitchDirective.ts`; `fui:blocks/for-each/ForEachBehavior.ts:129` `refresh()` |
| Parent-child nesting / ownership | ⚠️ inspection-only, no runtime lifecycle | `fui:plugs/webdirectives/directiveInspector.ts:185` `surfaceDirectiveRegions`, `:76` `children[]`, `:255` `markOwned` — reconstructs the nesting tree for devtools, but parents don't drive children at runtime |
| Reactive cascade | ❌ gap (primitive exists, unwired) | `fui:plugs/webstates/CustomChangeStrategyRegistry.ts:90` `observe(target,onChange):Disposable` exists; directives never call it (`fui:blocks/for-each/ForEachBehavior.ts:10` "reactive updates deferred to Phase 2") |
| Keyed reconciliation | ⚠️ key stored, unused | `fui:blocks/for-each/ForEachBehavior.ts:75-76,99` — `#key` read, `// future diffing (Phase 2)`; `refresh()` re-stamps wholesale |
| moveBefore state-preserving moves | ✅ pattern exists elsewhere, not in directives | `fui:blocks/renderers/reorderable-list/reorderState.ts:36-48` (feature-detect + `insertBefore` fallback); cross-browser fallback already ratified in sibling **#1969** |
| SSR / hydration of comment regions | ❌ gap — no SSR surface at all in FUI | no server renderer, no hydration hook; only `fui:plugs/webdirectives/CustomCommentParser.ts` (parse, not render) |
| DOM Parts `ChildNodePart` | ❌ not used | epic asks to *align the migration path*, not to adopt now — a design constraint, not a build |

## Could split — #1971 → 4 slices (+ 1 deferred branch)

Scaffolded: A=#2001, B=#2003, C=#2002, D=#2004; deferred E=#2005.

| Slice | kind / size | scope | files | blockedBy |
|---|---|---|---|---|
| **A — Parent-child lifecycle & ownership ordering** (#2001) | story · 5 | Promote `directiveInspector`'s nesting reconstruction from inspection to runtime: parent directives discover/own nested children (within their marker boundaries), and connect/disconnect ordering cascades (parent connect → children connect; reverse on teardown). Nesting tests (bullet 6) land here. Marker convention documented to map onto `ChildNodePart` start/end (alignment note, not adoption). | `fui:plugs/webdirectives/directiveInspector.ts`, `fui:plugs/webdirectives/CustomCommentRegistry.ts`, `fui:blocks/view/ViewIfDirective.ts`, `fui:blocks/for-each/ForEachBehavior.ts` | — |
| **B — Reactive cascade (observe → auto-refresh)** (#2003) | story · 5 | Wire directive state resolution through `CustomChangeStrategyRegistry.observe()`; on change, auto-`refresh()` (microtask-batched). Combined with A, a parent refresh cascades to owned children. | `fui:plugs/webstates/CustomChangeStrategyRegistry.ts`, `fui:blocks/view/resolveBinding.ts`, `fui:blocks/for-each/ForEachBehavior.ts`, `fui:blocks/view/ViewIfDirective.ts` | **A** (#2001) |
| **C — Keyed reconciliation in ForEach** (#2002) | story · 5 | Implement the diff `#key` was reserved for: reuse stamped DOM for matching keys, stamp/unstamp only the delta, index-fallback when unkeyed. Reorder via `insertBefore` (correct; D upgrades it). | `fui:blocks/for-each/ForEachBehavior.ts:75-76,99,129` | — |
| **D — moveBefore state-preserving moves** (#2004) | task · 2 | In reconciliation reorders, use `Element.moveBefore()` (feature-detected, `insertBefore` fallback per #1969's ratified pattern) so reused nodes keep focus/media/iframe state. | `fui:blocks/for-each/ForEachBehavior.ts`, reuse `fui:blocks/renderers/reorderable-list/reorderState.ts:36-48` | **C** (#2002) |

**DAG:** `A → B`, `C → D`. Two independent roots (**A** and **C**) → satisfies "≥2 proceed independently";
each slice also ships valid on its own (incremental delivery). Acyclic. All ≤5/task.

**Rubric check (A–D):** (2) 4 nameable slices, real homes ✓ · (3) each re-estimates ≤5, files `file:line`-cited ✓ ·
(4) clean DAG, 2 independent roots ✓ · (5) each leaves a demoable state (nested-lifecycle demo / reactive
demo / keyed-reuse demo / state-preserved-reorder demo), no half-protocol ✓ · (1-within) no slice buries a
fork — mechanisms are all settled (comment-anchor pattern, `observe()` handle, key-map diff, `moveBefore`+#1969
fallback) ✓.

## Could not split (deferred within the epic)

| Branch | Failing condition | Unblocking action |
|---|---|---|
| **E — SSR & hydration of comment regions** (#2005) | (3) re-estimates **8–13**, and the investigation pass can't ground it: **no SSR surface exists in FUI** (no server renderer, no hydration hook) — a true build-GAP with no design item. Splitting now would be guessing seams over a surface that doesn't exist. | Scaffolded now as a **deferred child epic** under #1971 seeded with the lineage (a future `/slice` candidate), left out of the batchable set. First land a foundational **SSR-of-comment-regions design/spike** (how comment-anchor regions + directive state serialize to HTML and re-upgrade on the client); once it exposes the surface, `/slice` #2005 into serialize / server-render / hydrate / streaming-hydrate stories. |

**Non-slice:** *DOM Parts `ChildNodePart` alignment* is a forward-compat **design constraint** folded into A/C's
marker convention (a design-review-only slice leaves no demoable state → fails rubric (5)); not carved.

## Net

- **Split #1971** into **A (#2001), B (#2003), C (#2002), D (#2004)** + a deferred **E (#2005)** child epic (SSR, design-gated). `+5`, #1971 stays an epic (residual `size` dropped).
- Freshly batchable after scaffold: **A** and **C** (roots); **B**/**D** unlock as their blockers land.
