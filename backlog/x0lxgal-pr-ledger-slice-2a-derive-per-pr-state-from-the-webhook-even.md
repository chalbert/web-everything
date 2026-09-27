---
kind: story
size: 5
parent: "4075"
status: open
scope: ["we:scripts/conveyor/pr-events-worker/core.mjs", "we:scripts/conveyor/pr-events-worker/worker.mjs", "we:scripts/conveyor/pr-events-worker/__tests__/core.test.mjs"]
dateOpened: "2026-09-27"
tags: []
relatedTo: ["3007", "3038"]
---

# PR ledger slice 2a: derive per-PR state from the webhook event feed

Slice 2 of webhooks-not-polling (slice 1 = the pr-events Worker + daemon wake, we:scripts/conveyor/pr-events-worker/ and we:scripts/lib/pr-events.mjs). Fold the compact event log into a per-PR derived state inside the same Durable Object: head sha, draft, labels, latest check conclusion per name per sha, latest review state, merged/closed. Expose it as GET /prs (read-token authed) with the same cursor, so one call returns state plus deltas.

Must handle check_suite/check_run deliveries whose pull_requests array is empty (seen on the real PR #2708 replay) by keeping a sha to PR index fed from pull_request events. Backfill on first deploy from one gh pr list per repo. This is the substrate #3007 (verdict ledger as merge authority) and #3038 (jury ledger to a shared store) need; link both.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
