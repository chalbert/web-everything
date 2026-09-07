---
bornAs: x85pd5x
kind: task
status: open
dateOpened: "2026-09-06"
tags: []
---

# The stranded-hash gate is structurally unable to fire in CI, the one place it would block

we:scripts/check-standards.mjs derives its on-main file list with `git ls-tree origin/main` and fails SOFT by design when that ref is unresolvable. The only CI job that runs check:standards - the aggregating `test` job in we:.github/workflows/ci.yml - checks out WITHOUT fetch-depth 0, so origin/main is absent and the whole stranded-hash rule (#2319) is skipped. It therefore fires only on a local checkout. Observed live: 3512 landed on main at ~13:47, its 180s numbering grace expired at ~13:50, check:standards errors on it locally, and the #1956 CI run at 13:57-14:03 passed green with the strand sitting on main.

## Done when

1. **Executable** — a CI run on a branch whose `main` carries a hash-led `we:backlog/` file past the 180s
   grace FAILS the required `test` check. Red before, green after. Reproducing it needs a strand staged
   deliberately: the live one has since been cleared (`3512` → `#3512`), which is the point below.
2. Either arm closes it, and picking between them is the call this item carries:
   - give the `test` job `fetch-depth: 0` (three other workflows already do exactly this where they need
     `origin/main`), or
   - make the rule report an UNRESOLVABLE main explicitly instead of skipping silently, so a CI run that
     cannot evaluate it says so rather than reading as a pass.
3. Whichever is chosen, the fail-soft intent survives for its real case — a genuinely offline or fresh clone
   must still not wedge the gate.

## Why the fail-soft is in the wrong place, not wrong

Skipping on an unresolvable `origin/main` is right for a local run: a developer on a fresh clone should not
be blocked by a rule about main's contents. But the SAME branch makes the rule inert in CI, and CI is the
only place it can actually stop anything. So the guard is present exactly where it is advisory and absent
exactly where it is load-bearing — the inverse of what a gate is for.

`we:scripts/check-standards.mjs`'s own comment states the intent plainly:

> Fail-SOFT: origin/main unresolvable (fresh/offline clone) → skip, never wedge the gate on a git hiccup.

A shallow CI checkout is not a git hiccup. It is the steady state of that job.

## Observed

`3512` landed on `main` at ~13:47. Its `STRANDED_HASH_GRACE_SECONDS` (180s, sized at "~2.5x the measured
7-73s drain numbering-commit lag") expired at ~13:50. `check:standards` errors on it in a local checkout.
The chalbert/web-everything#1956 CI run at 13:57-14:03 passed green with that strand on `main` — and would
have passed at any later time too.

The strand was later cleared — `main` now carries `drain: JIT-number 3512→#3512 at land (#2288)`, ~45
minutes after the land. **That does not close this item, it sizes it.** The window between a strand landing
and the numbering pass clearing it is unbounded from CI's point of view: for those 45 minutes the gate that
exists to catch exactly this was reporting green on every PR, and nothing would have changed had the pass
never run. A guard whose enforcement depends on a separate process happening to fix the problem first is not
enforcing anything.

Found by predicting the opposite: I told the operator #1956 would inherit a red from main, and it did not.
The gate that should have made that prediction true cannot see main from CI.
