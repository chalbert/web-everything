---
bornAs: x8exnuj
kind: task
status: resolved
dateOpened: "2026-08-19"
dateStarted: "2026-08-20"
dateResolved: "2026-08-20"
tags: []
---

# the 600s juror wall is now the binding constraint, and it fails by total loss

`we:scripts/lib/judge-spawn.mjs` kills a juror at 600s and rejects, discarding everything it produced. #3200's removal of JUDGE_BUDGET_USD called that wall 'real headroom' on wall times of 167-312s — but those were measured UNDER the ceiling being removed, so the bound moved. Measured 2026-08-19 across eight review-pr rounds: 122, 152, 173, 228, 292, 418, 470s, and one kill at 600s. Two kills this session. A killed round costs full price, returns no partial verdict, cannot resume, and reads as flakiness.

## Why the headroom claim was true when written and is not now

`#3200` removed the cost ceiling for a good reason, and stated its evidence: four runs on 2026-08-18 spent
$0.6152–$0.9042 with wall times of 167–312s, so the inherited $0.50 default would have killed all four. It then
named the 600s kill as the remaining bound and called it *"real headroom, not a fig leaf"*.

The measurement is sound; the inference is the trap. Those wall times were produced by jurors running **under**
the ceiling being removed. A juror that stops when it runs out of budget is a juror that stops early — so the
distribution used to size the wall was the distribution the wall was about to invalidate. Remove the ceiling
and the jurors do more work, which is the entire point of removing it, and the wall they were measured against
no longer has the headroom the measurement showed.

This is not hindsight about the decision. It is a property of any bound justified by data collected under a
different, tighter bound.

## What it measures now

Eight `review-pr` rounds on 2026-08-19, same repo, same lens, tool-bearing jurors:

| round | wall |
|---|---|
| #1485 | 122s |
| #1487 | 152s |
| #1489 | 173s |
| #1488 round 2 | 228s |
| #1486 | 292s |
| #1484 | 418s |
| #1488 round 1 | 470s |
| #1488 round 3 | **killed at 600s** |

Plus one kill on #1482 round 2 earlier the same day. Two of ten rounds died at the wall, and the survivors'
top end sits within 22% of it. That is not headroom.

## Why the failure mode is the worst available one

- **Total loss.** The kill is a `SIGKILL` followed by a `reject`. Whatever the juror had already produced —
  which for a tool-bearing juror is most of a review — is discarded with the process.
- **Full price.** The tokens are spent. A round that dies at 600s costs more than one that finishes at 400s and
  delivers nothing.
- **No resume.** The rejection is an error, not a verdict, so there is no suspended run to continue. The whole
  round is re-run from the top.
- **It reads as flakiness.** Which round dies is a function of how much work the juror chose to do, so the same
  PR passes on a retry. That is exactly the signature that teaches people to re-run rather than to look.

`#3200`'s own header names this shape for the cost ceiling: *"a truncated review is worth less than its own
price."* The wall truncates the same way, later.

## The forks

- **Raise the number.** Honest and cheap, and it is where this ends up if nothing better is chosen — but a
  bound with no principle behind it just moves the next kill. If this is the answer it should be derived (say,
  2× the observed 95th percentile) and re-derived when the juror's work changes, not typed.
- **Make the kill recoverable.** Capture what the juror has emitted and surface it as a partial result rather
  than discarding it. Turns total loss into degraded delivery, which is the failure direction this repo prefers
  everywhere else.
- **Bound the WORK, not the wall.** A turn or tool-call cap fails soft — the juror finishes its current step and
  reports — where a wall-clock kill cannot. Closest in spirit to what the cost ceiling was actually doing, minus
  the silent truncation.

The second and third compose. The first is a stopgap that should not be mistaken for a fix.

## Done when

1. **Executable** — a test in `we:scripts/lib/__tests__/judge-spawn.test.mjs` that drives
   `we:scripts/lib/judge-spawn.mjs`'s `judgeSpawn` past its timeout and asserts the caller receives the juror's
   partial output (or a verdict-shaped degraded result), not only a thrown error. It fails today.
2. Whatever bound remains is DERIVED from a stated measurement, and the source of that measurement is recorded
   beside it — so the next person to widen a ceiling can see whether this bound was sized under it.
3. A run that hits the bound is distinguishable in its record from a run that crashed, because today they are
   not.

## How it was closed

TWO of the three forks, which compose. The third — raise the number — is done too, but as a consequence rather
than a choice.

**The kill resolves instead of rejecting.** It still `SIGKILL`s, but then settles with the streams the process
had already delivered and tries to parse them. A tool-bearing juror at the wall has usually emitted its answer
and merely failed to exit, so that round now returns a real verdict where it used to return nothing. `close`
does the settling (Node delivers the buffered `data` events first); a short grace timer covers a `close` that
never arrives.

**The bound is derived and carries its own provenance.** `JUDGE_TIMEOUT_MS` is 2× the longest surviving run of
the ten measured, rounded UP to the next whole five minutes — 20 minutes. Rounding up follows from the
censoring: two of those ten were killed by the old wall, so the observed maximum is a lower bound on the tail,
not an estimate of it. The measurement and the derivation are recorded on the constant, which is the actual
Done-when 2: the next person to widen a ceiling can see what this was sized against.

That constant caught its own first draft. It read *"rounded to 15 minutes"*, which is BELOW 2 × 470s and so
contradicted the derivation written directly above it. The assertion in the test was written from the
derivation rather than from the number, and failed.

**Hitting the bound is a distinct fact in the record.** `JudgeTimeoutError` is its own type, carrying the
partial streams and saying plainly that a bound was hit rather than a juror crashed. A recovered verdict rides
out with `timedOut: true`, which the run-record whitelist now keeps — only when true, because a `false` on
every row is noise and the fact being recorded is the exception.

Mutation-checked, each independently: restoring the reject reddens 3, never setting `timedOut` reddens 1,
throwing a plain `Error` instead of the typed one reddens 1, dropping the flag from the record whitelist
reddens 1.
