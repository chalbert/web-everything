---
bornAs: x2zl9ow
kind: story
size: 2
parent: "3383"
status: open
scope: ["we:scripts/operations/run.mjs"]
dateOpened: "2026-09-25"
tags: []
---

# Operations runner prints complete when an effect's outcome was refused

Live 2026-09-25: node we:scripts/operations/run.mjs open-pr printed 'complete. 1 effect(s) applied.' while the open-pr.submit effect's recorded result was outcome refused, reason verify-unfinished, pr null — the refusal was only visible by reading the run record under .operations/runs/. The default render must surface an effect-level refused/failed outcome (reason plus detail) and exit non-zero, so a caller never mistakes a refusal for success. Prove on the live open-pr verify-unfinished case, before and after.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
