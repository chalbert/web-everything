---
bornAs: xkuxokw
kind: story
size: 2
status: open
scope: ["we:scripts/merge-ai-prs.mjs"]
dateOpened: "2026-09-07"
tags: []
---

# The drain warns of an incomplete review on every PR the rubric said needed none

#3308's coverage notice exists so a later reader can tell an unreviewed change from a reviewed one. On a PR
the escalation rubric correctly exempted, it destroys exactly that distinction — and asserts something false
while doing it.

Observed on PR #1967 (one backlog card, 51 lines, `escalate: false`, opened unparked for that reason):

> ⚠️ **Incomplete review — what was not examined**
> This PR is being merged with its review **skipped or degraded**.
> `no-recorded-review` — no verdict or clearance record was ever posted on this PR.

Nothing was skipped. No review was ever owed. The second line is simply untrue for this shape, and it is the
shape every correctly-unescalated PR has.

## Why it happens

`reviewCoverageGaps` derives its gaps from the PR's COMMENTS alone:

```js
export function reviewCoverageGaps({ comments = [], reliefWaived = false, reliefPassWide = false } = {}) {
  ...
  const latest = records[records.length - 1] || null;
  if (!latest) codes.push('no-recorded-review');
```

There is no input by which it could know whether a review was owed, so "none was recorded" and "none was
required" are the same observation to it. The header calls `no-recorded-review` "the headline case (22.5%)" —
that population is presumably a mix of genuinely-skipped reviews and never-owed ones, which is itself a reason
to separate them before quoting the number.

## The drain already has the missing fact

The escalation result is computed and stamped on every candidate before this point:

```js
v.escalated = score.escalate ? 'yes' : 'no';   // and v.humanRequired
```

and the candidate is in scope at the call site — the same expression already reads `c.reliefWaived` and
`c.reliefPassWide` off it. So the fix is passing a field the drain is already holding, not computing anything
new.

## Done when

1. `reviewCoverageGaps` takes the escalation outcome, and a PR the rubric exempted does NOT emit
   `no-recorded-review`. Either it emits nothing (a clean, no-comment landing, like any normally-reviewed PR)
   or a distinct, non-alarming code that records "the rubric required no review" as a positive fact — decide
   which, and say why on this card.
2. A PR that WAS escalated and still has no recorded review keeps the existing warning verbatim. This must not
   become a way to silence the notice: the exemption is the rubric's, never the lander's.
3. A test pins both directions, and pins that the drain passes the field — a coverage rule that reads the
   right input but is wired to nothing is the failure mode this repo has hit repeatedly.
4. If the 22.5% figure in the header is re-measured after the split, record the corrected number; if it is
   not re-measured, say so rather than leaving a now-ambiguous statistic.

## Found how

Filed from the receiving end: the notice landed on a PR opened by an agent that had run the rubric first and
opened unparked BECAUSE of it. The warning read as a reprimand for following the rule.
