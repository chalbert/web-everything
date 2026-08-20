---
kind: story
size: 3
status: open
dateOpened: "2026-08-20"
tags: []
---

# A juror that found nothing and a juror that barely looked reduce to the same accept

deriveVerdict maps an empty findings list straight to ACCEPT, and nothing anywhere asks whether the juror actually did the work. The spawn already records numTurns, costUsd, loadedContextTokens and output tokens, so the evidence of effort exists and is simply never consulted. A juror that returned in one cheap turn having read nothing produces the same verdict as one that spent eleven turns and a dollar thirty-five. This is the shape the verify operation closes one layer down: absence of findings is being read as evidence of correctness.

## How it was found

Reviewing PR #1496 through `review-pr`, the correctness juror returned `findings: []`, which
`deriveVerdict` reduced to `accept`. Checking whether that was a real result or a truncated one meant
reading the telemetry by hand: 11 turns, 290s, 923k context loaded, 26,826 output tokens, $1.35. Those
numbers are what made the verdict believable — and **nothing in the pipeline looked at any of them.**

The check that mattered was performed by a human reading a JSON blob. That is the definition of a gate
that does not exist.

## The claim, precisely

`we:scripts/lib/jury-core.mjs`'s `deriveVerdict` is correct as written: given a findings list, it reduces
it. The gap is upstream of it — **nothing establishes that the findings list is the product of a real
investigation** before it is reduced.

Concretely, these two produce byte-identical verdicts:

| | turns | cost | context | findings | verdict |
| --- | --- | --- | --- | --- | --- |
| a juror that investigated and found nothing | 11 | $1.35 | 923k | `[]` | `accept` |
| a juror that answered immediately | 1 | $0.02 | 20k | `[]` | `accept` |

The second is not hypothetical in kind: a juror whose prompt failed to land, whose lane was empty, or
which decided the task was not for it, all terminate normally with a well-formed empty structured output.
`we:scripts/lib/judge-spawn.mjs` throws when `structured_output` is absent — so a juror that produced
*nothing* is caught — but one that produced *an empty answer* is indistinguishable from a clean bill of
health.

**This is `verify`'s `unrun` (#xp240uk) one layer up.** There, a check that could not run must never
satisfy a gate; the same argument applies to a judgment that was never really made. Absence of evidence
is not evidence of absence.

## Not in scope, and why

This is **not** a proposal to gate acceptance on spend. A cheap juror can be a correct juror, and a floor
on cost would reward padding. The distinction wanted is between *investigated* and *did not investigate*,
and cost is only a proxy for it.

Nor is it a claim that PR #1496's review was wrong. It looks sound; the point is that its soundness was
established by a human reading telemetry, not by the pipeline.

## The fork this needs settled first

Three candidate shapes, and picking among them is a design call rather than a build:

- **(a) A third verdict value.** `unjudged` alongside accept/changes, derived from the telemetry the
  spawn already records. Mirrors `verify` exactly, and is the most honest — but it needs a defensible
  rule for what counts as "did not investigate", and every consumer of `deriveVerdict` grows a branch.
- **(b) A required non-empty rationale.** The juror must state what it examined, and an empty findings
  list with no account of the search is refused at the `structured_output` boundary. Cheaper, catches
  the realistic case, and puts the burden on the juror rather than on a threshold nobody can justify.
- **(c) Report, do not gate.** Surface the effort telemetry in the confirm prompt so the operator sees
  `1 turn, $0.02` next to `accept` before deciding. Smallest change, keeps judgment with the human, and
  does nothing at all for an unattended run.

(b) looks strongest — it asks the juror for the evidence rather than inferring it from a proxy — but the
call belongs to the operator, and this card should not be built until it is made.

## Done when

The fork above is settled and the chosen shape is implemented, such that a juror returning an empty
findings list without having investigated does **not** reduce to `accept`. A test drives a juror stub
that returns an empty findings list with minimal effort telemetry and asserts the verdict is not an
acceptance.
