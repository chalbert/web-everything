---
kind: story
size: 5
parent: "4075"
status: open
scope: ["we:scripts/readiness/test-selection.mjs", "we:scripts/lib/verify-lane-gate.mjs", "we:scripts/verify-lane.mjs", "we:scripts/lib/repo-profile.mjs", "we:scripts/guard-bash.mjs", "we:skills-src/conveyor/fix-agent-brief.md", "we:skills-src/conveyor/fix-agent-ci-brief.md"]
dateOpened: "2026-09-25"
tags: []
---

# Local agent gate runs only diff-selected tests; guard denies bare full-suite runs

Operator instruction 2026-09-25: run the minimum of unit tests locally and enforce it. Dispatched fixers (fix-*, ci-heal-*) ran the FULL suite as their gate (GATE_COMMAND from gateFor in we:scripts/lib/repo-profile.mjs = npm run test:unit && npm run check:standards): 10+ min each, several at once, host load 1.8/core, starving lane pickup and every review. verify-lane already had a diff-driven default (#3372) but reused the CI deny-by-default allow-list (docs/research/tests only), so any code change fell back to the full suite. Fix: (1) a LOCAL selection policy in we:scripts/readiness/test-selection.mjs — vitest related on the actual diff vs origin/main (working tree included) plus tests that name a changed file, full-suite fallback only when the static graph cannot see the effect (package/lockfile, *.config.*, vitest setup/shared, tsconfig, shared test helpers/fixtures, a deleted source file), stated in the output; CI keeps the full suite as the backstop. (2) we:scripts/verify-lane.mjs prints the selection and gains a marker-free run mode; gateFor returns it. (3) we:scripts/guard-bash.mjs denies a bare full-suite run (npm run test:unit, npm test, vitest with no file filter, the heavy-admission wrapper around a bare vitest run) naming the selected-gate command, with a logged WE_FULL_SUITE_OK=1 escape. (4) fix/ci-heal briefs updated.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
