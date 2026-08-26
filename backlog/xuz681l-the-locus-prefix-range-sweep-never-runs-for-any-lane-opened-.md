---
kind: task
parent: "3318"
status: open
dateOpened: "2026-08-26"
scope:
  - we:scripts/pr-land.mjs
tags: []
---

# The locus-prefix range sweep never runs for any lane-opened PR

pr-land runs the sweep from the primary checkout, which does not have the lane's commit, so the range resolves to nothing and every lane-opened PR skips the check with a non-fatal warning.

## The failure

Every PR opened through `we:scripts/pr-land.mjs` from a lane clone prints:

```
locus-prefix range sweep could not run (Command failed: node …/lint-locus-prefix.mjs
  --range=origin/main..<sha>) — CI still backstops it
fatal: Invalid revision range origin/main..<sha>
```

`rangeCorpusFiles` in `we:scripts/lint-locus-prefix.mjs` shells out to git to enumerate the range. The commit
being landed lives in the **lane clone**; the sweep runs in the **primary checkout**, which has never fetched
it. So the range names a revision that does not exist there, git exits 128, and the sweep is skipped.

Because every AI edit routes through a lane (#2123/#104), and every lane PR is opened by this path, **the
sweep is skipped on essentially every PR it was written to cover.** It is not intermittent.

## Why it is worth a card rather than a shrug

The warning says *"CI still backstops it"*, and that is true — the check does run in CI. So the consequence is
not unchecked prose landing; it is that the **fast local signal is dead** and the failure surfaces a CI round
later, on a PR already opened and labelled.

The more durable problem is the shape: a check that fails **open** with a reassuring message, on every
invocation, is indistinguishable from a check that is working. It was found twice today — independently, by two
agents, each treating it as noise from their own change before realising it fires for everyone. That is the same
signature as [#3327](/backlog/3327/): a failure belonging to no one gets read as background.

## Likely fix

Run the sweep **in the lane**, where the commit exists, rather than in the primary checkout — `pr-land` already
knows the lane path, since that is where it publishes the ref from. Failing that, fetch the ref into the primary
checkout before sweeping.

Worth checking whether anything else `pr-land` runs has the same cwd assumption; the sweep may not be the only
step reaching for a commit the primary clone has never seen.

## Done when

1. **Executable** — opening a PR from a lane clone runs the locus-prefix sweep to completion, and a deliberate
   bare code-path reference in the lane's commit is **caught locally** rather than only in CI. Assert both: the
   sweep runs, and it still passes on a clean range.
2. `npm run check:standards` — 0 errors.
