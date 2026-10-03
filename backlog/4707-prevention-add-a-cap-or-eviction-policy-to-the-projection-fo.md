---
bornAs: x2j14r5
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/pr-events-worker/core.mjs", "we:scripts/conveyor/pr-events-worker/__tests__/core.test.mjs"]
dateOpened: "2026-10-01"
tags: []
---

# Prevention — Add a cap or eviction policy to the projection, for example evict closed PRs and checks for superseded… (from chalbert/web-everything#3407 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/conveyor/pr-events-worker/core.mjs:112` — Add a cap or eviction policy to the projection, for example evict closed PRs and checks for superseded SHAs older than N days. Add a we:worker.test.mjs soak assertion on projection row count and /prs payload size. File a backlog item for compaction and add a bounded-growth test as its acceptance gate.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3407@9a1ff8f29657978060f0ac8802fcc7f4fc5b08a3

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
