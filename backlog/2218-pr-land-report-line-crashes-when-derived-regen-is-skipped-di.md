---
kind: task
status: resolved
dateOpened: "2026-07-04"
dateStarted: "2026-07-05"
dateResolved: "2026-07-05"
tags: []
---

# pr-land report line crashes when derived-regen is skipped (dirty checkout)

we:scripts/pr-land.mjs reads regen.done.length on its final success-report line, but regen is undefined whenever the post-land derived-artifact regen was skipped (e.g. the checkout has local changes). The merge itself has already succeeded, so the land is complete — but the script then throws a TypeError and exits non-zero with a stack trace, misreporting a successful land as a failure. Fix: optional-chain the read (regen and done length) and guard the regen/heal report lines so a skipped step reports skipped, not a crash. Surfaced landing the /finish rename PR #75.

## Fix

`runCli` in `we:scripts/pr-land.mjs` builds the success line with `regen.done.length`, but the
`--no-regen`/dirty-checkout path leaves `regen` unset. Optional-chain it (`regen?.done?.length`) and treat
the skipped case as `regenerated: none`. Add a unit test for the skipped-regen report path so the report
never throws after a successful merge.
