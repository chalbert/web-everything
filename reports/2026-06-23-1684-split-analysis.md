# Backlog split analysis — `/slice 1684` (webrouting epic)

**Date:** 2026-06-23 · **Focus:** #1684 *Scaffold the webrouting standard*

## Verdict — no new safe slice right now

#1684 is **already partially sliced** and its two un-carved deliverables are each **gated
behind an unresolved decision**. Nothing new splits safely this pass.

## Investigation (real-tree)

#1684 is an epic with 7 existing children, all carved from the two *resolved* shape-forks:

| Child | Deliverable | From fork |
| --- | --- | --- |
| #1725 | slice A — project node + skeleton spec page | structural |
| #1726 | slice B — route-format semantic profile + terms | #1685 ✓ |
| #1727 | slice C — URL-as-state codec strategy-lock protocol | #1686 ✓ |
| #1728 | slice D — URL-as-state declaration + coordinator seam | #1686 ✓ |
| #1729 | slice E — route-format + URL-as-state conformance vectors | #1685/#1686 ✓ |
| #1721 | serializable route-map projection schema + vectors | #1685 ✓ |
| #1720 | runtime/dynamic route ingestion (FUI) | #1685 ✓ |

The epic's Definition of Done requires **all four** forks (#1685–#1688) ratified before its
remaining build slices carve. Status today: #1685 resolved, #1686 resolved, **#1687 active**,
**#1688 active**.

## Could split

None new. The resolved forks (#1685/#1686) are already carved into A–E + #1720/#1721.

## Could not split (each fails: *a slice may not bury its own fork*)

| Deliverable | Failing condition | Unblocking action |
| --- | --- | --- |
| **Technical-config schema** (#1687) | governing decision #1687 is `active`, not ratified | **Ratify #1687** (reframed ruling: *support every route-config setting with merit, place by serializability*). Then carve: (1) WE story — route-config schema + conformance vectors; (2) deferred plateau Configurator cards, one per documented technical setting (#499-gated, build-deferred). |
| **Sitemap deriver** (#1688) | governing decision #1688 is `active`, not ratified | **Ratify #1688** (sitemap-derivation v1 artifact set). Then carve the v1 emitter slice. |

## Net

`/slice 1684` carves **0 slices** this pass — the epic is sliced for its resolved forks; the
remaining two deliverables unblock the moment #1687 / #1688 ratify. #1687 is one explicit
ratify-go away (reframed and gate-green this session).
