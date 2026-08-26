---
kind: decision
parent: "3318"
status: open
dateOpened: "2026-08-26"
tags: []
---

# Should every advisory lens block above the impact bar, or only claim-accuracy

#3314 ruled that what blocks is impact, not the lens — but scoped the blocking set to `claim-accuracy`
alone rather than take the general form. The general form is the obvious next question: if
`impactIfUnfixed >= broken` is the right reason to block a land, why does a `broken` finding from
`simplicity` or `standards-conformance` ride the accept? Taking it would make the mandatory/advisory split of
[#2310](/backlog/2310/) largely redundant — the mandatory pair would become "lenses whose findings are
usually above the bar" rather than a separate mechanism. Not prepared; not ready to rule.

## Why it was not folded into #3314

Scope. #3314 was convened as one lens's promotion, and answering it did not require ruling the general case —
an explicit one-member set is strictly weaker and reversible. Generalizing would have reversed a ratified
decision (#2310) as a side effect of an unrelated call, which is exactly the move `#3320` refused for size.

## What preparing this needs

1. Replay the corpus per advisory lens: how many findings would clear `broken`, and how many of those
   the operator actually bounced on. If `simplicity` rarely produces above-bar findings, the general form is
   free; if it produces many, the general form is a large behaviour change wearing a small diff.
2. State what remains of #2310's split under the general form, and whether `MANDATORY_LENSES` survives as a
   concept or collapses into the bar.
3. Check the failure mode in the other direction: a juror that can block by declaring `broken` has an
   incentive to declare `broken`. The mandatory/advisory split is discretion-proof in a way an impact
   self-declaration is not.

## Done when

1. **Executable** — `npm run check:standards` passes with this item `status: resolved` and `codifiedIn`
   naming the anchor the ruling lands in.
