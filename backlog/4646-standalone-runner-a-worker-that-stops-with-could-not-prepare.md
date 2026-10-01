---
bornAs: xv8zde3
kind: story
size: 3
status: resolved
scope: ["we:scripts/operations/probation-build-run.mjs"]
dateOpened: "2026-09-30"
dateResolved: "2026-09-30"
tags: []
---

# Standalone runner: a worker that stops with could-not-prepare is reported as gate-red and its premise finding is lost

Live 2026-09-30: we:scripts/operations/probation-build-run.mjs ran #4397 with --taskType=prepare on Codex. Codex correctly stopped with no diff and reported could-not-prepare: the premise is stale (we:scripts/lib/lane-salvage.mjs:428 now uses copyLitterTreeSync/copyFileSync, not cpSync; a real FIFO probe timed out instead of throwing). The runner reported outcome gate-red ("prepare requires a card-only diff"), which reads as a worker failure, and wrote the finding nowhere, so the card stays open with a wrong premise and the next prepare hits the same wall. Fix: a no-diff could-not-prepare is its own outcome (not gate-red); the finding is recorded on the card (a re-prepare note or hold with the reason) so the builder and the next worker see it. Same for the builder prepare path if it shares the classification. Proof: re-run #4397 prepare and show the new outcome + the recorded note.

## Done when

1. **Executable** — `npx vitest run we:scripts/operations/__tests__/probation-build-run.test.mjs` (strip the `we:` locator prefix when executing). The incident regression fails before this change and passes after; guard cases must remain green.

## Design

In we:scripts/operations/probation-build-run.mjs, recognize a clean no-diff `could-not-prepare:` report after hook and card-tampering checks, before the card-only diff gate. Record the sanitized finding through the existing hold/Findings route, remove obsolete preparation stamps, and publish only the open card through the existing gated publication path. Return `could-not-prepare`, including the finding PR, rather than `gate-red`. Do not claim, stamp, resolve, or credit a completed preparation. Builder prepare dispatch uses this same runner and receives the terminal result through its existing settlement callback.

## Progress

- Before: the new #4397 replay assertion returned `gate-red` instead of `could-not-prepare`; no card-write occurred. The combined focused run had 3 failures and 120 passes (the other failures belong to #4650).
- After: focused no-diff regression passes and observes a card-only finding publication, with no stamp or resolve. A checkout-card replay uses the actual #4397 card, real Git diff observation and real filesystem writes in a temporary clone; it replays the supplied stale-premise report and verifies the recorded Findings and open status.
- Proof boundary: worker output is replayed; gate/publication callbacks are observed without publishing. No fresh Codex prepare, live commit, push, or PR was performed, honoring this job's explicit no-publication rule.

- Verification: the wider `node we:scripts/verify-lane.mjs run` selection passed 341 tests across 6 files and `npm run check:standards` reported 0 errors. The final matching-test adjustment passed all 9 targeted ownership cases, including test-fix mode. The default verifier was attempted but the sandbox denied its we:.git marker write; marker-free mode used a temporary coordination root because shared admission storage was also read-only. No gate or assertion was weakened.
- Resolution: `node we:scripts/operations/run.mjs resolve --ref=4646` completed with one effect applied.

## Follow-ups

Run a fresh #4397 prepare through the deployed runner when publication is authorized. Keep the recorded premise finding distinct from a successful preparation; a genuine gate failure still reports `gate-red`.
