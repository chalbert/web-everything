---
bornAs: xyx95nq
kind: task
status: open
scope: ["we:scripts/operations/__tests__/probation-build-run.test.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# probation-build-run tamper-log test: assert the SECURITY: prefix

Advisory follow-up from PR #2867 (WE #4291): the tamper-log test in we:scripts/operations/__tests__/probation-build-run.test.mjs (~line 310) does not assert the SECURITY: log prefix operators grep for. MVP: assert it.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
