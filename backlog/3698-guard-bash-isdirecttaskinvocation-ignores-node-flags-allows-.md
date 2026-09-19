---
bornAs: xvuo49h
kind: task
status: open
scope: ["we:scripts/guard-bash.mjs"]
dateOpened: "2026-09-18"
tags: ["prevention-outstanding", "guard-bypass"]
crossRef:
  url: /pull/2304
  label: "Finding from PR #2304 independent review"
---

# guard-bash isDirectTaskInvocation ignores Node flags; allows bypass

we:scripts/guard-bash.mjs's `isDirectTaskInvocation` function (line ~331) only inspects the single token immediately after `node` when checking whether a Bash command invokes we:scripts/codex-direct-task.mjs or we:scripts/gemini-direct-task.mjs. Any Node flag placed first defeats the check entirely — e.g. `node --max-old-space-size=4096 we:scripts/codex-direct-task.mjs &` bypasses the guard undetected. This is the exact orphaned-backgrounded-process failure PR #2304 (merged) exists to close, so the guard has a real, confirmed hole in its own coverage. Reproduced directly during independent review of PR #2304 (2026-09-18). Real confirmed finding — not speculative. The check needs to scan all arguments/flags before the script path, not just the first token after `node`.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
