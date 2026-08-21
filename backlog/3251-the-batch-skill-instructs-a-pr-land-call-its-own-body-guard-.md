---
bornAs: x2v3kgr
kind: task
parent: "3029"
status: open
dateOpened: "2026-08-21"
tags: []
---

# the batch skill instructs a pr-land call its own body guard would refuse

`we:skills-src/batch-backlog-items/SKILL.md` step 8 tells the agent to run the landing home with `--ref` and `--label-on-green` and NO body file, and nothing earlier in that skill writes one. The home #2332 producer guard REFUSES a bodyless open — it exists precisely because a bodyless PR passes the producer and is then rejected at land, stalling the queue. So the instruction as written cannot succeed, which is a live defect independent of any rewiring: it also blocks naming `open-pr` there, since the operation requires a body for a real open too. Fix the instruction to compose and pass a body, then the site can name the operation like the other five.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
