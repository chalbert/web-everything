---
kind: story
size: 1
status: open
scope: ["we:scripts/operations/file-item.mjs", "we:scripts/operations/__tests__/file-item.test.mjs"]
dateOpened: "2026-10-01"
tags: []
---

# file-item prints why the card write was refused instead of only a resume hint

Live case 2026-10-01: a file-item call whose digest named a bare backlog path (no we: prefix) halted at its write step and printed only "0 effect(s) landed ... --resume=<run> continues from there", with no reason. The orchestrator retried with a placeholder digest to find out, which filed a junk card that then had to be deleted and un-queued. Fix: when the guarded writer (we:scripts/backlog/guarded-write.mjs) refuses, we:scripts/operations/file-item.mjs prints its refusal (the offending text and the we: form to use) on stderr and exits non-zero.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
