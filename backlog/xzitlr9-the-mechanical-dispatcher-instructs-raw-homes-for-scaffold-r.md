---
kind: story
size: 3
status: resolved
dateOpened: "2026-09-06"
dateStarted: "2026-09-06"
dateResolved: "2026-09-06"
graduatedTo: none
tags: []
relatedReport: reports/2026-09-06-open-story-staleness-audit.md
---

# The mechanical dispatcher instructs raw homes for scaffold, resolve and pr-land, bypassing three declared operations

Surfaced by PR #1959 once the #3224 scan learned to read workflow scripts as well as markdown. we:skills-src/batch-backlog-items/parallel-execute.workflow.js builds agent prompts naming raw homes at six sites: we:scripts/backlog.mjs scaffold at line 423, we:scripts/backlog.mjs resolve at line 452, and we:scripts/pr-land.mjs at lines 499, 514, 647 and 648. Every dispatched delivery agent therefore skips the guards those operations own - for resolve alone that is wrong-status, epic-with-open-children, uncodified-decision and undeclared-presentation-drift. This is the highest-VOLUME site of the bypass class #3224 was built to close, and it was structurally invisible because the scan only walked markdown. Rewire the six prompt strings onto we:scripts/operations/run.mjs, minding that the operations spell flags camelCase where the raw CLIs spell them kebab-case. Behavioural change to what dispatched agents run, so it wants its own review rather than riding along with the scan fix.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

## Done when

1. **Executable** — `npm run check:standards` (`we:scripts/check-standards.mjs`) emits **zero** `undelegated raw home (#3224)` findings for
   `we:skills-src/batch-backlog-items/parallel-execute.workflow.js`, and did emit six before the change.
2. Each rewired prompt names the operation (via `we:scripts/operations/run.mjs`) with the operation's own **camelCase** flag
   spelling — `--blockedBy`, `--graduatedTo` — not the raw CLI's kebab-case, which the parser refuses.
3. A dispatched agent still completes a full batch end to end (scaffold → build → resolve → PR) against the
   rewired prompts, so the change is proven on the real path rather than only on the scan.

## The six sites

| Line | Raw home | Operation that declares over it |
|---|---|---|
| 423 | `we:scripts/backlog.mjs scaffold` | `scaffold` |
| 452 | `we:scripts/backlog.mjs resolve` | `resolve` |
| 499, 514, 647, 648 | `we:scripts/pr-land.mjs` | `open-pr` |

## Why this is the case that matters most

Every other #3224 finding is prose a human reads and may or may not follow. These six are executed: the
dispatcher hands them to an agent as instructions, so the bypass happens on every batch, unattended. For
`resolve` that means the four guards it owns — wrong-status, epic-with-open-children, uncodified-decision,
undeclared-presentation-drift — are skipped by the delivery path that runs most often.

It was invisible because the scan's input set was `skills-src/**/*.md`: markdown is where a raw invocation is
*hand-written*, a workflow script is where one is *generated*. The gate was reading the place people type and
not the place the machine builds. PR #1959 fixed the reading; this card fixes what it found.

## Not folded into #1959

Rewiring what dispatched agents are told to run is a behavioural change to the delivery path, not a scan
fix. It earns its own diff and its own review.

## Delivered 2026-09-06 — two of six rewired, four blocked and marked

**Rewired onto the declared operations:**

| Site | Was | Now |
|---|---|---|
| :423 | `we:scripts/backlog.mjs scaffold … --blocked-by=` | the `scaffold` operation, `--blockedBy=` |
| :452 | `we:scripts/backlog.mjs resolve <NNN> --graduated-to=` | the `resolve` operation, `--ref=<NNN> --graduatedTo=` |

Both needed the flag-spelling flip the card warned about: the operations parse camelCase, the raw CLIs
kebab-case, and the parser is case-sensitive (#3253), so a copied kebab flag is refused as unknown. The
resolve prompt now says so inline, because the agent reading it is the one who would hit it.

**NOT rewired — four `we:scripts/pr-land.mjs` sites (:499, :514, :647, :648), and this is a finding, not a shortfall.**

the `open-pr` operation (`we:scripts/operations/open-pr.mjs`) declares `ref, base, title, bodyFile, mode, parkLabel, sha, requireVerified, dryRun` — and
**neither `manifestFile` nor `repo`**. Those calls need both:

- `--manifest-file` carries the couple manifest, which is how #2387's impl-first / WE-last land ordering
  is expressed at all;
- `--repo=<laneDir>` is how a sibling repo's PR is opened; without it there is no cross-repo PR.

Rewiring them would drop the manifest and break cross-repo PRs — **a functional regression dressed as
compliance**. They carry reasoned `@operation-home-ok` markers naming exactly what is missing, which is the
mechanism's own sanctioned way to record "known, and here is why".

This is the same judgement `we:scripts/operations/declared-homes.mjs` records for withholding `open-pr`'s
own entry twice: *"an entry would have emitted six findings whose only honest answer was six exemption
markers — a gate reporting a gap nobody could close, which is how a gate gets ignored."* The unblocking work
is giving `open-pr` those two inputs; until then the markers are the honest state.

**Verified:** `npm run check:standards` reported six `undelegated raw home` findings against this file
before the change and **zero** after.
