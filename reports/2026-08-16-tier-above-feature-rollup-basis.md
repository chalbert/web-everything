# Naming the tier above feature — rollup basis: points vs bet-progress vs outcome-metrics (prep for #3123)

**Point:** Prior-art survey + statute-overlap check for decision **#3123**, which #2690 ("generalize the
rollup tree to N levels + a program/portfolio zoom above feature") names as its own open fork. No mature
tracker treats the name as free of its aggregation mechanism — each surveyed system couples a specific
label to a specific rollup basis, and WE's own `we:docs/agent/backlog-workflow.md` already ratifies an
unrelated, incompatible meaning of the word "program" that the strongest candidate name would collide
with lexically.

**Plan file:** none (dispatched directly per the `prepare-decision-item` skill, not the `plans/` inbox).
**Research page:** `/research/tier-above-feature-rollup-basis/`

---

## Question

#2690 needs a tier above the ratified `kind: feature` (#2691) in Plateau Loop's feature-tracking rollup
tree. #3123 splits out the open fork already named in #2690's body: what is that tier called, and — the
part that is not cosmetic — what does it roll up? Points (like every tier below it), a bespoke
bet-progress measure, or outcome-metrics?

## Prior art — name and rollup basis travel together in every surveyed system

| System | Tier above feature-equivalent | Rollup basis | Mechanism |
|---|---|---|---|
| SAFe (Scaled Agile) | **Program** (Agile Release Train / Program Increment) | Points/velocity — PI predictability is committed vs delivered story points | Fixed cadence, org-level grouping of Features |
| Jira Advanced Roadmaps | **Initiative** (Theme above that) | No native basis shipped; teams bolt on a point sum or percent-complete | A level in the one issue-type hierarchy |
| Linear | **Initiative** (first-class entity) | Percent-complete by child status | Explicit membership |
| Microsoft Viva Goals / Asana Goals (OKR tools) | **Objective**, rolling up Key Results | Weighted % contribution — weights sum to 100%, no point relationship | Explicitly not a point sum, hand-authored per objective |

Two load-bearing facts for the fork:

1. "Program" already has an established points/velocity-rollup meaning in agile practice (SAFe) — real
   prior art for a PROGRAM + points-rollup default, though SAFe's Program is an organizational/cadence
   concept (an Agile Release Train), not merely "sums points" — the citation authorizes the narrower claim
   ("program" is established vocabulary for a points-tracked grouping), not SAFe's full ART semantics.
2. OKR tooling never reuses a point-sum for Objective progress — confirming #2690/#3123's existing claim
   that an OKR-style rollup is a genuinely different aggregation, not a relabeling of points.

## Statute-overlap — "program" is not a free word in this repo

`we:docs/agent/backlog-workflow.md#program-definition` already ratifies "program" as a specific,
unrelated term: a perpetual `ongoing: true` epic passing a four-part Program Test (standing goal ·
conformance front · currency front · cadence), `codifiedIn`-cited from
`we:docs/agent/platform-decisions.md:3502-3505` as a load-bearing statute anchor.

This decision's answer is not insulated product vocabulary — it is very likely to become the literal next
`kind` enum value on WE's own backlog axis, in the *same* governing file. #2691's own ratified rule
(`we:docs/agent/backlog-workflow.md:163`) already names the extension #3123 fills in: *"Nesting (a
`feature → feature` "initiative"/program tier) is a non-breaking future extension… Program-level
containment that the root rule drops is what that extension is for."* And Plateau Loop (the console that
renders this tier) is explicitly built to dogfood WE's own backlog model and vocabulary
(`we:backlog/2505-plateau-loop-operable-backlog-console-built-fresh-in-platea.md`: *"Web Everything's
backlog setup is the reference for the model and vocabulary… not code to copy"*), starting with WE's own
repo before generalizing to multi-repo.

If `PROGRAM` is picked, `we:docs/agent/backlog-workflow.md` would carry two independently load-bearing,
incompatible definitions of the bare word "program." The collision is lexical, not mechanical (different
fields, different enum — an `ongoing: true` flag on `kind: epic` vs a new `kind: program` value never
occupy the same field or badge), and it is **bounded to WE's own dogfooded repo/backlog** — a third-party
Plateau customer's backlog would not carry WE's governance-specific "Program Test" concept unless they
separately adopted it. Within that bounded scope, a one-time reconciliation clause on
`#program-definition` resolves it. `INITIATIVE` carries no such collision — grepping both governing docs
finds "initiative" used only as an informal gloss, never a ratified, `codifiedIn`-cited term.

## What this grounds (fed into #3123's Fork 1)

- The points-rollup basis (PROGRAM or a collision-free label carrying the same semantics) is the
  strongest default on **merit**, not just engineering cost: the Plateau Loop console this tier renders
  inside is points/velocity-native end to end (every tier below already measures `size`; the honest-
  forecast story, #2718, is velocity-derived), so a tier that switches units at the top is the outlier
  needing justification.
- The label and the rollup basis are separable — nothing requires "initiative" to mean "bet-progress
  measure"; #3123's fork adds a fourth option (a collision-free label carrying PROGRAM's points-rollup
  semantics) that the original three-way framing did not consider.
- Full detail, the fork write-up, and the resolved skeptic/screen passes live in the item itself:
  `/backlog/3123-name-the-tier-above-feature-rollup-basis-points-vs-outcome-m/`.

## Files created/modified

| File | Action |
|---|---|
| `we:backlog/3123-name-the-tier-above-feature-rollup-basis-points-vs-outcome-m.md` | Authored fork, prior art, statute-overlap check, `preparedDate` stamped |
| `we:src/_data/researchTopics/tier-above-feature-rollup-basis.json` | New registry entry |
| `we:src/_includes/research-descriptions/tier-above-feature-rollup-basis.njk` | New write-up |
| `we:reports/2026-08-16-tier-above-feature-rollup-basis.md` | This report |
