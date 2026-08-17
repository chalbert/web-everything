---
bornAs: xyp34m5
kind: task
status: resolved
relatedTo: ["1245", "1770"]
scope:
  - "we:blocks/router/"
  - "we:blocks/__tests__/unit/router/"
  - "we:blocks/__tests__/integration/router.test.ts"
  - "we:blocks/renderers/composition/__fixtures__/composition-seam-cases.ts"
  - "we:docs/agent/platform-decisions.md"
  - "we:src/_includes/project-webrouting.njk"
  - "we:backlog/1245-reference-runtime-blocks-router-navigation-are-duplicated-an.md"
  - "we:backlog/423-router-routeview-silent-no-stamp-complex-fragment.md"
  - "we:backlog/454-root-cause-route-view-empty-clone-on-complex-inline-form-fra.md"
dateOpened: "2026-08-17"
dateStarted: "2026-08-17"
dateResolved: "2026-08-17"
tags: [constellation, placement, zero-impl, debt]
---

# Blocks/router (2,843 lines) is one of the last three named families #1245's own plan never finished slicing

**Correction, 2026-08-17: an earlier version of this item wrongly claimed #1245 reads `status: resolved`.**
Verified directly against `backlog/1245-*.md`: it is genuinely `status: open`, `childlessReason: blocked`,
`blockedBy: [1353]` — #1245 was never falsely marked done. The real, corrected finding: #1245's plan named 16
debt-root families to slice out of `we:blocks/` to Frontier UI, and — checked directly against the tree, not
against #1245's own child-item bookkeeping — **13 of the 16 are already deleted**. Only three remain:
`we:blocks/router/`, `we:blocks/resource-loader/`, `we:blocks/renderers/`. Router is the largest and the one
#1245's own plan calls out as safe to delete right now (point 4 of its "Re-scoped plan": *"its WE copy... already
landed FUI-side (the 2026-06-20 hotfix), so deleting `we:blocks/router/` is now safe"*) — 2,843 lines across
19 files, including a 741-line types+fixtures cluster and a 619-line `we:blocks/router/RouteViewElement.ts`,
still fully present despite the plan itself saying the deletion is already unblocked.

## Why this is a real gap, not a nicety

Surfaced during the 2026-08-17 prep pass on #1770 (constellation-placement audit). #1245's `blockedBy: [1353]`
is itself stale — #1353 resolved 2026-06-27 — so the item is likely just sitting unclaimed on a dead block
rather than genuinely obstructed. This is a much narrower, more mundane gap than the original (wrong) framing
of this item suggested: not a false-completion claim, just three named debt families — one of them explicitly
declared safe to remove — sitting on a stale blocker nobody has re-checked.

## Done when

1. **Executable** — `we:blocks/router/` is sliced to Frontier UI per #1245's own already-declared-safe plan
   (verified by its absence, or the WE-resident copy shrinking to a thin reference fixture matching the shape
   of the 13 already-completed families), and #1245's stale `blockedBy: [1353]` edge is dropped or re-pointed
   at whatever, if anything, still genuinely blocks `resource-loader`/`renderers`.

## Progress

**Sliced 2026-08-17.** The gate that #1245's slices section said held router — *"imported only by
`we:plugs/bootstrap.ts` … can drop only after FUI hosts the bootstrap-consuming demos and
`we:plugs/bootstrap.ts` relocates (#606)"* — has cleared: `we:plugs/bootstrap.ts` no longer exists, bootstrap
relocated to `fui:plugs/bootstrap.ts`, and it registers **FUI's** router. The measured import graph confirmed
the WE copy had **zero** runtime consumers: no demo, no page, no build path reached it. Only WE's own unit +
integration suites imported it. So #1245's step 4 (*"deleting `we:blocks/router/` is now safe"*) was the
correct half of its own internal contradiction.

### The runtime/spec seam — why this is a shrink, not a delete

`we:blocks/router/` was never one thing. Two halves with **no** import edge between them:

- **Runtime impl** (duplicated in FUI, deleted here): `we:blocks/router/elements/RouteViewElement.ts`,
  `we:blocks/router/elements/RouteOutletElement.ts`, `we:blocks/router/behaviors/RouteLinkBehavior.ts`,
  `we:blocks/router/behaviors/RoutePrefetchBehavior.ts`, `we:blocks/router/registerRouter.ts`, and
  `we:blocks/router/types.ts` (the `<template route>` parse + URLPattern match helpers). Every one imports
  `@frontierui/plugs/*` and touches the DOM; every one has a live FUI counterpart.
- **WE-owned spec surface** (no FUI counterpart, kept): the #1685/#1721 route-map schema + validator +
  builder, the #1687 route-config schema, the #1736 emitter contract + registry, the #1737/#1738/#1739/#1740
  concrete emitters, the #1741 param-source hook, the #1728 URL-state type-only contract, and their
  conformance-vector fixtures. Each file's own header already declares WE owns the contract and *"the runtime
  impl rides downstream to FUI"*. Pure data — none of it imported anything from the deleted half.

That matches #1245 step 1 exactly (*"leaving the WE-side protocol spec + conformance vectors + types only"*)
and the Done-when's second branch. Deleting the spec half would have destroyed live, tested, WE-owned
standard surface that post-dates #1245 — not sliced a duplicate.

**2,843 lines across 19 files → 1,486 across 13.** `implementedBy: "@frontierui/blocks/router/index.ts"` in
`we:src/_data/blocks/router.json` was already FUI-pointing and is unchanged; `we:custom-elements.json`
likewise already sourced the elements from `@frontierui/blocks/router/index.ts`.

### Nothing dropped silently

The WE and FUI copies were diffed file-by-file first. FUI is comprehensively ahead (#1897 lazy components,
#1720/#1823 runtime route objects + `merge-precedence`, the #841/#908-A `we-*` tags, the #1991/#2048
`route:guard-leave` rename). But the diff was **not one-way**: **four** things existed only WE-side and are
carried forward as a `frontierui`-locus child of #1245 rather than lost —

1. the **#423/#454 stamp diagnostics** (the empty-clone `console.error` + the route-identified `try`/`catch`
   around the stamp `appendChild`); FUI's stamp site is a bare `appendChild` with no guard either side;
2. the **#365 `entry`-URL normalization**;
3. the **#320/#321 `viewportPresence` composition** in the prefetch behavior;
4. the **`matchAllRoutes` vectors** — FUI's `fui:blocks/__tests__/unit/router/types.test.ts` already exists
   (351 lines, itself ahead of WE's) and lacks only that one `describe`, including the #1245 catch-all
   regression. Its `matchAllRoutes` *implementation* is fine; only the vectors are missing.

Item 1 is the one that matters most and was **missed on the first pass** — caught by the adversarial
self-review, not by the gate. It is the fix for #423 (`status: resolved`), and its trigger is documented by
an e2e this slice keeps (`we:blocks/__tests__/e2e/router-empty-clone.spec.ts`), whose `empty fragment`
console assertion is vacuous until FUI absorbs the guard. That is called out explicitly in the child item.

Deleted alongside the impl: its four impl-only suites under `we:blocks/__tests__/unit/router/` and
`we:blocks/__tests__/integration/router.test.ts`. **They were safe to delete because FUI already holds a
line-for-line equivalent — import paths aside, plus the integration suite's one `route:guard-leave`
rename — or a larger twin of each.** Measured, not assumed. Lines, WE against FUI: the outlet-element suite
82 / 82 (byte-identical), the link-behavior suite 153 / 153 (differing only in one import line), the
integration suite 300 / 300 (two import lines plus that rename), and the route-view element suite
551 / **734**. The one exception is delta 4 above — the shared-helper suite is 409 in WE against 351 in FUI,
and the surplus is precisely the `matchAllRoutes` describe FUI lacks, which is why it is carried forward
rather than dropped.

**Kept:** the eight spec-side route emitter/schema suites and both e2e specs — those drive the served demo
in a real browser, and the demo boots `fui:plugs/bootstrap.ts`, so they exercise the standard against FUI's
router, never the deleted copy.

### Citations: live surfaces repointed, dated records left alone

Deleting the runtime left prose citations of those files dangling. **Live, forward-looking surfaces were
repointed** `we:` → `fui:`: statute (`we:docs/agent/platform-decisions.md`), the published standard page
(`we:src/_includes/project-webrouting.njk`), the composition seam vector, and the header of
`we:blocks/router/route-map.ts` itself. The two dead relative links on the published backlog
(`we:backlog/423-router-routeview-silent-no-stamp-complex-fragment.md`,
`we:backlog/454-root-cause-route-view-empty-clone-on-complex-inline-form-fra.md`) were de-linked.

**Dated research records were deliberately NOT rewritten.** An in-place repoint of a date-stamped
verification snapshot makes it assert something untrue as of its own date, and — because FUI's runtime is
materially different code — converts citations that were *true of WE* into ones that are *false of FUI*
(the `route:guard:leave` attribute claim is exactly that). The equally-historical decision records
(#1685/#1686/#1688/#1823) cite the same paths, so a piecemeal repoint would also fracture the corpus. That
corpus-wide relocation is captured as its own follow-up rather than half-done here.

**What that choice costs, measured:** deleting the runtime leaves **41 new `#2821` gate-5 warnings** — code
loci of the form `we:blocks/router/…` that no longer resolve in this checkout. By directory: **22** in
`we:backlog/`, **14** in `we:reports/`, **3** in `we:src/_data/researchTopics/`, **2** in
`we:src/_includes/research-descriptions/`. All 41 are the *"no such file"* kind, i.e. every one is created
by this change; none are the pre-existing *"past end-of-file"* kind. They are **warnings, not errors** —
gate 5 runs warn-level under `CITATION_GATES_ENFORCED=false` — so the gate stays green, but the debt is
real and the follow-up item owns it by number. The six files this change itself edits or adds are gate-5
clean: the de-linked `#423`/`#454` refs correctly dropped their `:line`.

Finally, #1245's `blockedBy: [1353]` + `childlessReason: blocked` were dropped — #1353 resolved 2026-06-27,
so the gate was already warning the block was stale.
