---
kind: story
size: 3
status: open
scope: ["we:scripts/operations/ci-heal-pr-dispatch.mjs", "we:scripts/operations/__tests__/ci-heal-pr-dispatch.test.mjs", "we:scripts/operations/__tests__/priority-sync.test.mjs"]
dateOpened: "2026-10-02"
tags: []
---

# A CI failure in a test the PR does not touch is re-run, not healed, and never spends the PR heal budget

Live case 2026-10-02: PR #3415 (touches only we:scripts/lane-whois.mjs, we:scripts/lib/atomic-json-file.mjs, we:scripts/lib/gh-rest-read.mjs and their tests) is stuck with its CI-heal cap spent (3 of 3) because test-shard 2 fails on we:scripts/operations/__tests__/priority-sync.test.mjs "is registered on the command line under its own name, with --help derived" timing out at 5000 ms, a test it does not touch. Each heal rebased and re-pushed without addressing it, and now the review daemon says a person must take it. Fix: (1) the CI-heal dispatch (we:scripts/operations/ci-heal-pr-dispatch.mjs) reads the failing test names; when every failing test is outside the PR own files and the failure is a timeout, it re-runs the failed job instead of dispatching a heal, without counting against the cap, and files a flaky-test card after two such re-runs; (2) make the priority-sync --help test fast or give it a realistic timeout. Replay #3415.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
