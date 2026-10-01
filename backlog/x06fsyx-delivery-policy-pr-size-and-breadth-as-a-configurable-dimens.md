---
kind: story
size: 3
parent: "4376"
status: open
scope: ["we:scripts/lib/dispatch-routing-policy.json", "we:scripts/lib/dispatch-routing-policy.mjs", "we:skills-src/conveyor/prepare-item-worker-brief.md"]
dateOpened: "2026-10-01"
tags: []
---

# Delivery policy: PR size and breadth as a configurable dimension (split rule), shown and edited in Plateau

Operator, 2026-10-01: "PR size is probably a policy that Plateau should be able to handle in time." Live case: PR #3311 grew to 63 files because one job bundled routing, effort, fix routing and a launch-site audit; it then overlapped almost every other PR and became the bottleneck of a long blocked chain. Add PR size/breadth to the delivery policy (the configurable-dimensions work under #4376): limits such as max changed files, max lines, max distinct areas (top-level directories or owners) per PR, with per-project and per-risk defaults and a split rule (what happens over the limit: split at prepare, or refuse at launch with a proposed split). Enforce at prepare (scope breadth) and at job/builder launch; record the applied limit per run. Plateau shows and later edits the setting with the other delivery policies. Start with a default that would have split #3311 by area.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
