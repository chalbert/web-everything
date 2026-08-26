---
kind: story
size: 2
parent: "xjbdhzb"
status: open
dateOpened: "2026-08-26"
tags: []
---

# A guard that blocks a compound command loses the writes bundled with it

guard-bash refuses before execution, so a chained command loses every step, including file writes that were not the reason for the refusal. It cost this session twice: a git add -A refusal dropped the heredoc writing a PR body, and open-pr then refused an empty body; earlier the same shape dropped a body edit that was reported as applied. Neither left a trace at the write site. Either name the dropped writes in the refusal, or gate at the offending step so unrelated ones still run.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
