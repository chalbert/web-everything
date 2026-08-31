---
kind: task
status: open
dateOpened: "2026-08-31"
tags: []
---

# Assert DISPATCHED_AGENT_SYSTEM_PROMPT_FILE resolves to an existing file

review-pr #1729 (correctness, CONFIRMED, carve-out): the constant's path is a hand-counted join(dirname(...), '..','..','skills-src',...) in we:scripts/operations/dispatch-lane-io.mjs, and nothing asserts it resolves to a real file. Mutation-tested (miscounting the '..'s) and the full unit + integration suite stayed green -- the argv-pin tests only compare against the same imported constant, tautologically. Add one assertion next to the existing LAUNCH_KINDS brief-path existence loop in we:scripts/operations/__tests__/dispatch-lane.test.mjs, e.g. expect(readFileSync(DISPATCHED_AGENT_SYSTEM_PROMPT_FILE, 'utf8').trim()).not.toBe(''). Correct as shipped today; this is a coverage gap, not a live bug.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
