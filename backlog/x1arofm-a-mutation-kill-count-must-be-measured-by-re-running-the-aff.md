---
kind: task
status: open
dateOpened: "2026-08-25"
tags: []
---

# A mutation-kill count must be measured by re-running the affected case in isolation

A kill count taken from one contended full-suite run cannot tell a killed case from a load flake, so the usual
repair — subtract the baseline failure from every row — silently deletes real kills. On PR #1561 that
subtraction turned a true `wake-cli` count of **6** into **5**. The rule: attribute a kill by re-running the
reddened FILE alone against its own green baseline, never by differencing two whole-suite runs.
`we:scripts/operations/mutation-check.mjs` already refuses a red baseline; it does not yet require the named
suite to be narrow enough for the count to attribute.

## Done when

1. **Executable** — a check that refuses a mutation-kill COUNT taken from a suite broader than the file(s) it
   reddens, and accepts the same count re-measured with that file run alone. Provisional shape: extend
   `we:scripts/operations/mutation-check.mjs` so a `killed` verdict carries per-case attribution only when
   `input.suite` names the reddened file(s), and returns `unrun('count-unattributable', …)` — alongside the
   existing `baseline-red` arm — when it names a broader path. Verify at head `11a7d778` of
   `lane/test-harness-fake-claude` with the "prompt moved to the front of `buildAgentArgv`'s return" mutant,
   on a `PATH` built from the toolchain minus `claude`:
   - **must refuse** `suite: we:scripts/operations/__tests__/` — measured there, that run reports
     `Tests 6 failed | 1127 passed (1133)` across four files, and two of the six do not survive isolation:
     `dispatch-spawn-live`'s `` `--bg` RETURNS … `` case and a `wake-cli` case failing
     `spawnSync … node ETIMEDOUT`.
   - **must accept** `suite: we:scripts/operations/__tests__/dispatch-spawn-live.test.mjs` — run alone, twice,
     it reports `Tests 1 failed | 5 passed (6)` against a green 6/6 baseline, and the one is
     `the argv the dispatcher builds is ACCEPTED by a CLI that parses like the real one`.

Owed as prevention by the round-5 correctness review of #1561, which found the subtraction had made a true
number false. It is one step past the two rules the same PR already files — "A subprocess PATH-resolution test
must be run once against a PATH stripped of ambient dev tools" and "A PR body's gate line must be the CI
result, not a local run" — both of which are about WHERE a number is measured; this one is about whether the
measurement can attribute at all.
