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
reason to re-derive them. That is the same failure as the retraction on
[#3319](/backlog/3319-run-the-security-lens-once-per-code-pr/), running in the other direction. The pattern is
worth more than either bug: **neither session checks a peer's claim the way it would check its own.**

> ~~"the **gate-aperture** retraction on #3319"~~ — **that name was wrong, and it was this card's own version
> of the very mistake it is about.** #3319's retraction has nothing to do with gate aperture: it corrects a
> **corpus count and a lens attribution**. That card had asserted *"All 84 recorded verdicts ran correctness
> alone. Security ran once and found two real forgery holes"*; the re-count over
> `we:scripts/review-corpus/cases` found **92** cases, 87 carrying a lens row, **86** of those `correctness`,
> and exactly **one** security finding — the second `we:scripts/operations/explore-io.mjs` hole is filed under
> `correctness` in `we:scripts/review-corpus/cases/1457-r1.json`. Read in this lane at
> `we:backlog/3319-run-the-security-lens-once-per-code-pr.md:17-25`, not recalled.
>
> The *shape* is what the sentence was reaching for, and that half does hold — better than the wrong name did.
> #3319 records that the `84` figure arrived from its **parent `3318`** and was carried forward without being
> re-derived. A peer's claim received unchecked, which is precisely this card's point.

**And the two wrong causes shared a method, which is the more fixable half.** Both came from reading a single
docblock line and generalising it into a mechanism, without opening the function it described. `:35` says
*"the sweep never force-updates someone's branch"*; `isRebaseDropCandidate` at `:609` says the opposite for the
certified-and-green case.

> ~~"`isRebaseDropCandidate` sits **forty lines later**."~~ **Wrong — and wrong in the direction that
> flattered the mistake.** `grep -n` in this lane puts the docblock line at `we:scripts/merge-ai-prs.mjs:35`
> and the function at `we:scripts/merge-ai-prs.mjs:609`. The gap is **574 lines**, not forty. At forty lines
> the miss reads as a glance that stopped a paragraph short. At 574 the comment and the code it describes are
> never on screen together — which is both why the shortcut is tempting and why the rule has to be *open the
> function* rather than *read a bit further*.

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

1. **Executable** — `isRebaseDropCandidate` (`we:scripts/merge-ai-prs.mjs:609`) carries the constraint in its
   own docblock, asserted by a check that **fails today**:

   ```sh
   node -e "const s=require('fs').readFileSync('scripts/merge-ai-prs.mjs','utf8');
            const i=s.indexOf('export function isRebaseDropCandidate');
            process.exit(/do not rebase a queued PR from outside the drain/i.test(s.slice(Math.max(0,i-1200),i))?0:1)"
   ```

   Run in this lane at this card's tip: **exit 1** — the note is absent. Nothing of the kind sits near the
   predicate or its call sites either:

   ```sh
   grep -n 'livelock\|do not rebase a queued' scripts/merge-ai-prs.mjs
   # → 1215, 1425, 1515, 2688 — all the unrelated R2 livelock, and none within
   #   1400 lines of :609 or of the rebase-pass call sites :3047, :3078, :3101.
   ```

2. The note states the invariant **and its reason**: *do not rebase a queued PR from outside the drain, because
   a rebase restarts `test`, `testGreen` goes false, and the PR stops being a rebase-drop candidate.* The
   reason is the load-bearing half — the bare instruction reads as territorial and gets routed around.

3. `npm run check:standards` — no error attributable to this card.

> **Retracted — `Done when` #1 previously asked for work that was already done, and could not have failed.**
> It read: ~~"**Executable** — a test asserting `isRebaseDropCandidate` returns `false` for a certified PR
> whose `testGreen` is false, and `true` once it is green …"~~
>
> **Both halves already exist on `main` and pass today.**
> `we:scripts/__tests__/merge-ai-prs.test.mjs:1042` is the true-when-green case
> (*"a BEHIND (needs-rebase) certified+green PR is a candidate"*); `:1051` is the false-when-red case
> (*"a red `test` is NOT a candidate"*). Confirmed by mutation in this lane, not by reading: dropping
> `|| !v.testGreen` from the guard at `we:scripts/merge-ai-prs.mjs:612` reddens **exactly** `:1051`
> (`1 failed | 6 passed | 393 skipped`); restoring it returns all **7** to green.
>
> An `Executable` criterion has to be able to fail before the item lands and pass after. That one could not
> fail, so the card would have shipped with no way to tell when it was done — the vacuity shape #3340 exists
> to catch. What is genuinely missing is the *call-site constraint*, which is what #1 and #2 now ask for.
