---
kind: decision
parent: "1255"
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: none
codifiedIn: one-off
preparedDate: "2026-06-20"
relatedReport: reports/2026-06-20-1255-split-analysis.md
tags: []
---

# Re-parent the FUI-convergence facet epics under #1255, or keep the by-reference map

One structural fork: should the convergence umbrella [#1255](/backlog/1255-fui-convergence-umbrella-coordinating-the-scattered-we-front/) hold true `parent:` edges over its facet epics (#746/#170/#777/#728), or keep coordinating them by-reference (today's Facet map)? De-buried from #1255's body, where it sat as an inline "Open structural decision (deferred)". Its blocker [#487](/backlog/487-migrate-backlog-schema-to-single-kind-axis-per-466-ruling/) (`kind`-axis migration) **resolved 2026-06-20**, lifting the deferral.

## Ruling — RATIFIED 2026-06-20: A (re-parent)

**A — Re-parent** ratified. Set `parent: "1255"` on all six facets: the four open (#746/#170/#777/#728)
**and** the two resolved (#904/#658) for a complete container. #1255 now derives `openChildCount: 4`,
`epicState: 'tracking'` from data; the no-open-slice guard correctly gates its resolve until every facet
closes (matches its own DoD). Framed and ratified as a low-stakes, reversible **backlog-organization**
edge — touches no WE standard, runtime, or architecture; the only effects are the umbrella's derived
display + resolve-gate. Red-team (Bias-Toward-Separation) failed: the edge merges no files, ownership, or
resolvability — it is a grouping lens, not a combine. Residual one-level-rollup granularity ("N of 4 facets
open", not transitive leaf burndown) accepted as appropriate for an umbrella.

## Grounding digest (verified against the shipped loader/validator)

The fork's premise was "re-parent *if* the post-#487 loader aggregates nested-epic burndown cleanly; fall back if epic-under-epic rollup is unsupported or distorts sizing." Reading the real tree **dissolves the risk side of that premise** and surfaces a concrete cost on the *other* branch:

- **Burndown is parent-agnostic — re-parenting causes zero sizing distortion.** [we:src/_data/burndown.js:26-34](src/_data/burndown.js#L26-L34) sums `size` across *all* sized items and never walks `parent`; the header comment ([we:src/_data/burndown.js:1-7](src/_data/burndown.js#L1-L7)) fixes points at exactly one level (a storied epic carries none, an unstoried epic carries its own), so each unit of scope is counted once regardless of nesting. There is **no per-epic burndown anywhere** — the series is one global cumulative ([we:src/_data/burndown.js:69-71](src/_data/burndown.js#L69-L71)). So the fork's "distorts sizing" hazard for re-parenting is **moot**: neither branch changes the burndown.
- **The loader DOES derive convergence state from `parent` edges — and it works on epic-children.** [we:src/_data/backlog.js:512-547](src/_data/backlog.js#L512-L547) rolls children up by `parent` match (kind-blind), exposing `children`, `openChildCount`, and `epicState` (`unsliced`/`parked`/`done`/`tracking`/`program`). Re-parenting the four open facets gives #1255 `openChildCount: 4` and `epicState: 'tracking'` — the derived "how close are we?" lens the umbrella exists to provide, for free.
- **Under B, #1255 reads as a *false* `unsliced` nag.** #1255 is open + epic + no open blockers → `sliceable: true` ([we:src/_data/backlog.js:408-409](src/_data/backlog.js#L408-L409)). With `children.length === 0` and **no** `childlessReason` (confirmed absent in its frontmatter), `epicState` resolves to `'unsliced'` ([we:src/_data/backlog.js:541-546](src/_data/backlog.js#L541-L546)) → it lands in `countEpicUnsliced` ([we:src/_data/backlog.js:592](src/_data/backlog.js#L592)) and the Prioritisation tab nags "ready to /slice now". B therefore requires adding a `childlessReason` band-aid purely to suppress a false to-do.
- **The coupling A introduces is correct umbrella semantics, not a cost.** The no-open-slice guard ([we:scripts/check-standards-rules.mjs:587](scripts/check-standards-rules.mjs#L587)) errors on a resolved epic with an open child, so under A #1255 can't resolve until every facet does. That *matches #1255's own Definition of Done* ("#170 closed … #777 closed"): convergence is not done until its facets are. A models the gate; B lets the umbrella resolve while convergence is incomplete.
- **No validator rule forbids epic-under-epic.** The only `parent` constraint is referential — it must resolve to an existing item ([we:scripts/check-standards-rules.mjs:191-193](scripts/check-standards-rules.mjs#L191-L193)). Re-parenting is mechanically clean post-#487.

This is a decision over **shipped tooling behaviour**, not greenfield design (no new intent/block/plug/protocol), so per *design-first.md* it skips the web prior-art survey; the concrete-refs check above is the prep, and the [#1255 split analysis](/reports/2026-06-20-1255-split-analysis.md) is the linked report.

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|------|---------------------|------------------|------------|
| 1 — Container edges vs by-reference map | **A — Re-parent (true `parent:` edges)** | B — Keep by-reference map | Med-high (~80%) |

## Fork 1 — Re-parent the facets under #1255, or keep the by-reference map

**Why this is a fork:** the two branches are mutually-exclusive end-states — the umbrella either carries `parent:` edges over its facets or it doesn't; the loader's `children`/`epicState` rollup is present under A and absent under B. Both are coherent (a container with real edges; a pure by-reference lens), so it is a genuine either/or, not a forced invariant.

**Crux:** does the umbrella earn its keep as a *derived* "how close to convergence?" rollup ([we:src/_data/backlog.js:512-547](src/_data/backlog.js#L512-L547)), or stay a hand-maintained Facet map in prose? The post-#487 verification above settles the empirical questions the original recommendation hedged on: re-parenting does **not** distort burndown (it's parent-agnostic), and the loader **does** aggregate epic-children cleanly.

- **A — Re-parent** (set `parent: "1255"` on the four open facets #746/#170/#777/#728; optionally also the two resolved #904/#658 for a complete container). #1255 becomes a true container: `openChildCount: 4`, `epicState: 'tracking'`, the tile renders the facet circles. "How close are we?" is derived, not read. Cost (and the point): the no-open-slice guard gates #1255's resolve on all facets — correct, since its DoD already requires exactly that. Facets stay separate files, independently ownable and resolvable on their own clock; the `parent` edge is a grouping lens, not a merge.
- **B — Keep by-reference** (today's state: the Facet-map links, no `parent:` edges). Each facet is independently resolvable (already true under A too). Costs: (1) no derived rollup — convergence progress stays a manual prose read; (2) #1255 falsely reads `epicState: 'unsliced'` and nags "ready to /slice" unless a `childlessReason` is added to mask it. *Rejected as the default* — it buys no real decoupling A lacks (parenting doesn't merge ownership), while losing the derived lens and forcing a band-aid.

**Recommended default: A — Re-parent.** The umbrella's entire reason to exist is to answer "how close are we to one runtime + canonical blocks?"; A makes the loader answer it from data, B keeps it a manual read. The risk that made the original recommendation low-confidence (sizing distortion / unsupported rollup) is disproven against the shipped loader. Scope the edges to the four open facets at minimum; re-parenting the two resolved facets is a tidy-up, not load-bearing.

**Red-team note for the deciding agent.** The separation-bias principle (*Bias Toward Separation*, burden of proof on combining) is the natural attack on A — does adding a `parent` edge "combine" the facets? Trace it: A does *not* merge files, ownership, or resolvability (each facet still resolves on its own clock); it adds one grouping edge that is precisely the lens the umbrella was filed to provide. So the bias doesn't bite — this isn't a combine-vs-split of concerns, it's "does the container have real edges or fake ones." Residual (~20%): the rollup is one-level (direct children, not transitive leaf-slice burndown across facets), so #1255 reads "N of 4 facets open", not a leaf-grain percentage — acceptable for an umbrella, but confirm that granularity is what's wanted before ratifying.

## Concrete examples — what each branch is, on disk

**A — Re-parent.** One line added to each of the four open facets (verified `parent: none` today):

```diff
# backlog/746-block-explorer-….md   (and 170, 777, 728 identically)
 status: open
 kind: epic
+parent: "1255"
```

The loader then derives, for #1255, from [we:src/_data/backlog.js:512-547](src/_data/backlog.js#L512-L547):

```
before (B, today):  children: []            → epicState: 'unsliced'  → Prioritisation nags "ready to /slice now"
after  (A):         children: [746,170,777,728], openChildCount: 4  → epicState: 'tracking'  → tile renders 4 facet circles
```

No facet file changes beyond that one edge — files, ownership, and independent resolvability are untouched.

**B — Keep by-reference.** Facets stay `parent: none`; the umbrella keeps its hand-written Facet map. To
silence the false `unsliced` nag A removes for free, B must add a masking band-aid to #1255:

```diff
# backlog/1255-fui-convergence-umbrella-….md
 status: open
 kind: epic
+childlessReason: "coordinates its facets by-reference (Facet map); not a sliceable container"
```

That `childlessReason` is pure suppression — it asserts "intentionally childless" to dodge the to-do, while
the body still lists four facets it coordinates. A makes that relationship real instead of asserting it away.

## Context

Surfaced by the 2026-06-20 program review and the [#1255 split analysis](/reports/2026-06-20-1255-split-analysis.md) (which found #1255 itself does not split — its decomposition already exists as the facet epics; this fork is the only actionable structural seam). The two resolved facets (#904/#658) are already done, so re-parenting's live touch is the four open epics #746/#170/#777/#728.
