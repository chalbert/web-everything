---
bornAs: xwejxwm
kind: task
parent: "3029"
status: open
dateOpened: "2026-08-29"
tags: []
---

# open-pr's classifySubmit doesn't recognize pr-land's dry-run/enqueued outcomes, misreporting successful lands as errors

`classifySubmit` (`we:scripts/operations/open-pr.mjs:306`) reads the `HOME_REASONS` map (`we:scripts/operations/open-pr.mjs:277-292`) to turn `pr-land`'s raw `reason` field into one of three outcomes (`we:scripts/operations/open-pr.mjs:328-329`). The map has no entry for `dry-run` (emitted by `we:scripts/pr-land.mjs:706`, exit 0) or `enqueued` (emitted by `we:scripts/pr-land.mjs:1094`, exit 0) — both real success paths, not refusals. Because `HOME_REASONS[parsed.reason]` comes back `undefined` for either, `classifySubmit` falls through to `outcome: 'unrun'` with `unclassified: true` instead of `outcome: 'opened'`, so a successful `--dry-run` rehearsal or a successful triggered-drain land gets reported as an unresolved/error outcome.

Found while landing PR #1679: both a dry-run rehearsal of `open-pr --mode=land` and the real land call reported spurious "did not report a result"-style errors even though `pr-land` had genuinely succeeded, forcing verification of ground truth via `gh pr view` instead of trusting the wrapper's exit code.

Done: `HOME_REASONS` maps `dry-run` and `enqueued` to `opened`; a test pins that a `pr-land` response carrying `reason: 'dry-run'` or `reason: 'enqueued'` classifies as `outcome: 'opened'`, not `unrun`.

## Done when

1. **Executable** — `we:scripts/operations/open-pr.mjs`'s `HOME_REASONS` maps `dry-run` and `enqueued` to `opened`, and a new test in `we:scripts/operations/open-pr.test.mjs` (or wherever `classifySubmit` is already covered) asserts `classifySubmit({ stdout: JSON.stringify({ reason: 'dry-run', ... }) }).outcome === 'opened'` and the same for `reason: 'enqueued'` — a test that fails against today's map (both currently resolve to `unrun`) and passes once the map is updated.
