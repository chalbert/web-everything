---
bornAs: xv8zde3
kind: story
size: 3
status: open
scope: ["we:scripts/operations/probation-build-run.mjs"]
dateOpened: "2026-09-30"
tags: []
---

# Standalone runner: a worker that stops with could-not-prepare is reported as gate-red and its premise finding is lost

Live 2026-09-30: we:scripts/operations/probation-build-run.mjs ran #4397 with --taskType=prepare on Codex. Codex correctly stopped with no diff and reported could-not-prepare: the premise is stale (we:scripts/lib/lane-salvage.mjs:428 now uses copyLitterTreeSync/copyFileSync, not cpSync; a real FIFO probe timed out instead of throwing). The runner reported outcome gate-red ("prepare requires a card-only diff"), which reads as a worker failure, and wrote the finding nowhere, so the card stays open with a wrong premise and the next prepare hits the same wall. Fix: a no-diff could-not-prepare is its own outcome (not gate-red); the finding is recorded on the card (a re-prepare note or hold with the reason) so the builder and the next worker see it. Same for the builder prepare path if it shares the classification. Proof: re-run #4397 prepare and show the new outcome + the recorded note.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
