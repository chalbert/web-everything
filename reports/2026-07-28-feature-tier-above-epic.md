# Feature tier above epic — deterministic feature→epic rollup (prep for #2691)

Prep research for decision **#2691** — the feature-tracking screen (#2705, RATIFIED) rolls up
`slice → epic → feature`, but the backlog has no "feature" tier: `kind ∈ story | epic | task |
decision` (SoT: `we:scripts/check-standards-rules.mjs:40`), and the largest grouping is `epic`.
This report grounds the call in (1) the real backlog data model, (2) the prior single-`kind`-axis
ruling #466, and (3) how mature trackers model a tier above epic.

## The real backlog model (grounded, not assumed)

- **One structural `kind` axis.** `BACKLOG_KINDS = new Set(['story','epic','task','decision'])`
  (`we:scripts/check-standards-rules.mjs:40`). This is the *retired-to-one-axis* end state of
  decision **#466** (resolved 2026-06-13, `codifiedIn: one-off`): the old `type` (idea/issue/decision)
  + `workItem` (story/epic/task) pair was collapsed into a single `kind`, `size` kept separate, and
  fix/feature nature demoted to `tags`. The migration lives at `we:scripts/backlog/migrate-kind.mjs`
  (`kind = type==='decision' ? 'decision' : workItem`). Prior art: `/research/backlog-kind-axis/`.
- **Hierarchy is a `parent` pointer, not a fixed depth.** Every item may carry `parent: "<NNN>"`.
  Measured over the live tree (`backlog/*.md`, 2717 items, 205 epics):
  - **88 epics carry a parent; 81 of those parents are themselves `kind: epic`.** Epics nest.
  - **Max `parent`-chain depth = 5.** Chains are deep and multi-level.
  - **105 distinct roots** over open items. The largest root `#2445` has **87 descendants**; the
    next `#089` has 20. Roots are wildly uneven in size.
  - **124 epics have no epic-parent** (top-of-epic-chain). Neither "root" nor "top epic" is a
    curated product grouping.
- **Epic-keyed validation already exists** and would need a feature analogue:
  - Parent-deadlock guard keys on the parent being `kind: epic` (`we:scripts/check-standards.mjs:794`).
  - Epic↔child status coherence (resolved-epic-with-open-child, all-slices-done nudge) keys on
    `item.kind === 'epic'` (`we:scripts/check-standards.mjs:833`, `:863`).
  - The **kind-vocabulary drift guard** (`we:scripts/check-standards.mjs:1488`, "§10"): any kind added
    to `BACKLOG_KINDS` must also appear in every kind-filter list in `we:src/backlog.njk`, or items of
    that kind **render but are permanently invisible** (no filter chip) — the exact way `type: review`
    items vanished (#602/#610). Adding a kind is a known, gated operation.
  - `HUMAN_GATE_KINDS` and per-item kind validation (`we:scripts/check-standards-rules.mjs:172`).

The decisive fact: **the `parent` chain alone cannot say which ancestor is "the feature."** With
81 epic→epic edges and depth-5 chains, "feature = epics reachable from a root" makes `#2445` a single
87-item mega-feature and folds `#2505`/`#2527`/`#2676` (the screen's *separate* feature rows) into
**one** feature. That is the red-team's "grouped under different roots" instability, restated:
structure-only derivation has no canonical, stable feature identity.

## Prior art — a tier above epic

| Tracker | Tier above epic | How it's modelled |
|---|---|---|
| **Jira** (Advanced Roadmaps) | **Initiative** (and Theme above that) | An **issue *type*** in the same one-type enum as Epic/Story — hierarchy levels are configured, each level a type. Parent link is the relation. |
| **Linear** | **Initiative** → Project → Issue | Initiative is a **distinct first-class entity**, not an issue; projects roll into it by explicit membership. |
| **Shortcut** | **Milestone/Objective** → Epic → Story | Distinct object above epic; epics belong by explicit reference. |
| **Azure DevOps** | (Epic is top; **Feature sits *below* Epic**) | Fixed `Epic > Feature > Story` ladder — note "Feature" is *below* epic here, a naming caveat. |
| **GitHub** (sub-issues, GA 2025) | no fixed tier names | Arbitrary nesting via sub-issue parent links; hierarchy is derived from the link graph, no named "feature" level. |
| **Asana** | **Portfolio** | A separate grouping container over projects. |

**Cross-tool invariant:** the tier above epic is an **explicitly-marked node** (its own type/level or
its own entity), *never* "whichever ancestor a walk happens to reach." Trackers that expose deep
arbitrary nesting (GitHub) deliberately do **not** name a fixed "feature" level, precisely because a
derived level is ambiguous. This mirrors #466's finding for the epic level itself: hierarchy-role is
carried on the **one structural axis**, not re-derived. Naming caveat: "feature" above epic matches
Jira **Initiative** / Shortcut **Milestone**; Azure DevOps uses "Feature" *below* epic — the #2691
title fixes "feature = the top grouping the tracker rolls up to," which we honour.

## What this grounds

1. **Derive-from-chains (#2691 option a) is non-deterministic** over the real (deep, multi-level,
   uneven-root) tree — rejected on the data, not on taste.
2. **A parallel grouping field (option c) reintroduces the second axis #466 retired** and is redundant
   with `parent` (an epic already points up-chain).
3. **An explicit `kind: feature` node (option b)** extends the *same* single axis #466 established and
   matches every surveyed tracker's "explicitly-marked tier" invariant. The deterministic rule is then
   trivial and total: **epic E's feature = its nearest `kind: feature` ancestor along `parent`; none ⇒
   Unassigned.** Adding the kind is a gated operation (drift guard §10) with a known checklist.
</content>
</invoke>
