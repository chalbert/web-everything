---
bornAs: x33k64v
kind: story
size: 2
status: open
scope: ["we:scripts/operations/open-pr.mjs"]
dateOpened: "2026-09-28"
tags: []
---

# open-pr reports complete on a refused submit; push-failed when the lane lacks the branch ref

Live 2026-09-28 ~9:12 PM ET: we:scripts/operations/open-pr.mjs printed 'complete. 1 effect(s) applied' while the submit effect's result was outcome refused (reason unverified) and no PR opened; an operator reading the default render believed the PR was open. Separately, run from a lane whose HEAD was not the branch tip it halted with 'push-failed'. MVP: the default render names the submit outcome (opened #N / refused: reason) and exits non-zero on refused; the push-failed halt says the lane HEAD is not the ref's tip and how to fix it (acquire --base=<tip>). Must: tests for both renders.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
