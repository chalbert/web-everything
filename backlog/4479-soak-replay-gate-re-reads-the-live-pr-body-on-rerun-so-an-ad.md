---
bornAs: xzbrscd
kind: story
size: 2
status: open
scope: ["we:.github/workflows/soak-replay-gate.yml", "we:scripts/lib/soak-replay-gate.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# soak-replay-gate re-reads the live PR body on rerun, so an added soak-waiver takes effect

Live 2026-09-29: worker for #4312 (PR #2939) added a soak-waiver line to the PR body after soak-replay-gate flagged the diff, but the check's CI run reads a body snapshot taken when the PR opened, so a body edit plus gh run rerun did not clear it; the worker parked the PR review:human instead. (Another worker, PR #2938, reported a rerun did clear, so behaviour is inconsistent.) MVP: the gate (we:.github/workflows/soak-replay-gate.yml and we:scripts/lib/soak-replay-gate.mjs) fetches the current PR body at run time, and a pull_request edited event re-triggers it. Must: test; live proof: a waiver added after open clears the gate on the next run.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
