---
kind: story
size: 2
parent: "3318"
status: open
scope:
  - we:scripts/merge-ai-prs.mjs
dateOpened: "2026-08-26"
tags: []
---

# An automated rebase defeats the drain's re-sync, because that re-sync requires CI green

The drain rebuilds a stale PR only if it is certified AND its required check is green. Anything that rebases a waiting PR restarts CI, which makes it ineligible — so a helper that rebases on a timer converts a self-healing queue into a livelock.

## The mechanism, verified

`isRebaseDropCandidate` in `we:scripts/merge-ai-prs.mjs`:

```js
export function isRebaseDropCandidate(v) {
  if (!v || v.decision !== 'skip') return false;
  const certified = !!(v.certifyLabel || v.aiGenerated);
  if (!certified || !v.testGreen) return false;
  …
}
```

Its docblock states the intent plainly: a red `test` is *"a real bug, not a manifest artefact"*, so such a PR is
deliberately **not** rebuilt. That is correct — auto-resolving a branch whose tests are failing is exactly what
it should refuse.

The trap is what happens when something else rebases the PR while it waits. A rebase moves the head, which
**restarts the required check**. For the duration of that run `testGreen` is false, so the PR is not a
rebase-drop candidate, so the drain skips it. A helper rebasing on a short timer re-arms that condition before
CI can ever finish.

**The precondition can then never hold, and the helper is the reason.**

## Observed

Eight PRs accepted, one merged in thirty minutes, the other seven `BEHIND`. A sibling session's rebase helper
was running throughout that window, rebasing waiting PRs roughly every two minutes.

It also explains what neither session could account for at the time: **the queue drained the moment merges
started flowing.** Not because anything was fixed — because PRs finally sat still long enough for CI to go
green and become eligible again.

**Consistent with, but not proof of, the diagnosis:** #1598 merged within minutes of the helper being stopped,
and was the first land in that window. One PR, and others were maturing anyway — so it is corroboration, not
evidence. The mechanism above stands on the source, not on this observation, and the observation is recorded
here only so a later reader does not mistake it for the argument.

## What is NOT claimed, and why the retraction matters

Two earlier drafts of this card asserted causes that were **wrong**, and both were retracted before landing:

1. ~~"The drain skips a `BEHIND` PR by design and never rebases it."~~ **False.** It re-syncs by default on two
   paths — `rebase-drop-manifest` (#2198) and `rebase-drop-content` (#2371), the latter safe-unioning any
   conflict whose hunks are non-overlapping. Only a genuinely overlapping conflict is left for a human. The
   sentence that claim came from — *"the sweep never force-updates someone's branch"* — describes the skip path
   inside the mergeable gate, not the whole behaviour.
2. ~~"Conflict rate is a function of queue latency."~~ **Not established.** It may still be true, but the
   measurement that motivated it was taken while a tool was holding `testGreen` false, so it is not clean
   evidence of a latency effect. **The figure is deliberately not carried forward.** Anyone wanting the claim
   must measure it again with nothing interfering.

Both wrong causes were confidently asserted between two sessions, and each time the receiving session had no
reason to re-derive them. That is the same failure as the gate-aperture retraction on [#3319](/backlog/3319/),
running in the other direction. The pattern is worth more than either bug: **neither session checks a peer's
claim the way it would check its own.**

**And the two wrong causes shared a method, which is the more fixable half.** Both came from reading a single
docblock line and generalising it into a mechanism, without opening the function it described. `:35` says
*"the sweep never force-updates someone's branch"*; `isRebaseDropCandidate` sits forty lines later and says the
opposite for the certified-and-green case. The prose was not wrong — it was scoped to the skip path, and the
scope was only visible in the code.

So the operative rule is narrower and more actionable than "verify claims": **a docblock line describes the
branch it sits on, not the function's whole behaviour. Read the function before quoting its comment as a
mechanism.** That would have stopped both retractions here, and it is checkable in the moment in a way that
general scepticism is not.

## What still stands on its own

#1585 went stale-then-conflicting while queued, and was resolved by hand. That conflict was **correctly** left
for a human: both sides added different names to the same import lines in
`we:scripts/operations/__tests__/review-pr.test.mjs`, so the hunks genuinely overlapped and `rebase-drop-content`
rightly declined to guess. Nothing malfunctioned there.

## The generalizable rule

**Any automation that touches a waiting branch restarts its checks, so it must never run against a precondition
gated on those checks being green.** The two are individually sensible and jointly a livelock. Before adding a
helper that rebases, retries, or re-pushes queued work, check what downstream conditions depend on check state —
the helper's own success metric (*"nothing is BEHIND any more"*) can be satisfied while the thing it was built
to accelerate never happens.

This has the signature of the hardest class to catch: **no gate fires, and every component reports success.**
The drain correctly skipped. The helper correctly rebased. CI correctly ran. Only the elapsed time was wrong.

## Done when

1. **Executable** — a test asserting `isRebaseDropCandidate` returns `false` for a certified PR whose
   `testGreen` is false, and `true` once it is green, with the livelock documented at the call site so the next
   person adding a rebase helper meets the constraint before writing it.
2. A note in `we:scripts/merge-ai-prs.mjs` stating the invariant: **do not rebase a queued PR from outside the
   drain.**
3. `npm run check:standards` — 0 errors.
