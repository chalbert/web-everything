---
bornAs: xb7necp
kind: story
size: 8
parent: "3383"
status: open
scope: ["we:.github/workflows/ci.yml", "we:scripts/lib/flake-score.mjs", "we:scripts/lib/__tests__/"]
dateOpened: "2026-10-03"
tags: []
---

# Per-test flake score and a time-boxed quarantine for the required test check

No per-test flake signal exists in this repo; #4149 is a live case of one flaky test turning the required test check red on every PR. Prior art: Meta's probabilistic flakiness score (a per-test Bayesian estimate of failing on good code), Google rerun-and-quarantine (1.5% of test runs flaky), Slack auto-detect and suppress (main stability 20% to 96%), GitHub smarter retries (flaky builds 1 in 11 to under 1 in 200). The batching papers also show flakes shrink the best batch size, so the decider (card 4998) needs this signal. Build: (1) record per-test outcomes from each CI shard of we:.github/workflows/ci.yml (a vitest JSON reporter artifact) into a rolling store; (2) score each test from same-SHA fail-then-pass reruns and failures on SHAs that were otherwise green, over a 14-day window; (3) a quarantine list with owner card, reason and expiry (default 7 days): a quarantined test still runs and is reported, but does not fail the required check; (4) a test enters quarantine only on a score above threshold, never from the PR that breaks it, and the list change goes through the existing anti-test-gaming gate (#3178, #3179); (5) expose the overall flake rate as JSON. Survey: we:reports/2026-10-03-delivery-strategy-survey-and-decider.md. Done when: a replay over recent main and PR runs ranks the tests behind the 2026-10-03 red soak shard; unit tests cover the score, the entry threshold and expiry.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
