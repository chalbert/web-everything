---
bornAs: x3emz1e
kind: task
status: resolved
scaffoldedBy: "fix-parallel-execute-gate-policy-lane-34-584fc04d"
dateScaffolded: "2026-09-25"
scope: ["we:skills-src/batch-backlog-items/parallel-execute.workflow.js", "we:skills-src/batch-backlog-items/SKILL.md", "we:scripts/__tests__/parallel-execute-workflow.test.mjs"]
dateOpened: "2026-09-25"
dateResolved: "2026-09-25"
tags: []
---

# Align batch-parallel-execute workflow with the diff-selected local gate + no-subagent policy (dd4beb5e5)

dd4beb5e5 (#4157) made WE's local gate diff-selected and guard-bash deny a bare full-suite run — but we:skills-src/batch-backlog-items/parallel-execute.workflow.js step 4 still told each lane to run npm run check:standards + npm test -- run through heavy-admission (the old full-suite pair), and step 7 told it to spawn a Task-tool review subagent, which the review daemon now makes redundant. Replaced step 4 with node we:scripts/verify-lane.mjs run --repo=. (the same {{GATE_COMMAND}} fix/ci-heal briefs use), removed the pre-PR review-subagent step and its dead we:scripts/lane-review.mjs body wiring, added a NO_FULL_SUITE_NO_SUBAGENT_GUARD prompt rule to every lane agent, fixed the equivalent stale --gate override in we:skills-src/batch-backlog-items/SKILL.md, and updated we:scripts/__tests__/parallel-execute-workflow.test.mjs to pin the new invariants.

## Done when

1. **Executable** — `npx vitest related we:scripts/__tests__/parallel-execute-workflow.test.mjs --run` is green,
   including the new `4157 LANE GATE is diff-selected` and `dd4beb5e5 lanes never spawn a subagent` describe
   blocks, which fail against the pre-fix source (they assert the old `heavy-admission`/`npm test -- run`
   pair and the `PRE-PR INDEPENDENT REVIEW` step are GONE and the `we:scripts/verify-lane.mjs run --repo=.`
   gate is present).
