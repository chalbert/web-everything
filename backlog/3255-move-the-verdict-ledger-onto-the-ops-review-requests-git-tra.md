---
bornAs: xeshb3g
kind: story
size: 8
parent: "3007"
status: open
dateOpened: "2026-08-21"
tags: []
---

# Move the verdict ledger onto the ops/review-requests git transport, as #3214 ruled

#3214 ratified option A′ on 2026-08-20 and its #2626 amendment IS codified (`we:docs/agent/platform-decisions.md`, the "interim by construction" git-transport clause). But the BUILD that decision ruled has **no card**, and it is unbuilt: `verdictLedgerDir()` in `we:scripts/lib/verdict-ledger.mjs` still returns the machine-global `~/.claude/verdict-ledger/<owner>-<name>.jsonl`.

The consequence is a **resolved decision that reads as an unblocked path**. #3007, #3215, #3216 and #3217 all carry `blockedBy: ["3214"]`; #3214 is `resolved`, so the readiness loader sees four items with a satisfied blocker while the durable store they actually depend on does not exist. A decision being made is not the thing being built.

## Seen live, not inferred

PR #1523 round 2, this session, on the credential-less cloud host — the exact case #3214's body describes:

- `review-pr`'s juror ran and returned `accept`; the write-up landed on disk.
- `review.label-swap` (ordinal 1) failed with HTTP 403 — no GitHub credential on this host.
- `applyPendingEffects` HALTED, by design, so `verdict-ledger.append` at ordinal 2 was never attempted.
- The label was routed through `record-verdict`'s file transport instead. `we:.github/workflows/apply-review-request.yml` ran the real `we:scripts/review-set-label.mjs` **on a GitHub runner**, which appended the row to *that runner's* home directory and destroyed it with the container.

So the verdict for #1523 exists as a write-up on this host, as a label and comment on GitHub, and in **no** ledger anywhere. That is exactly the row-destroyed-with-the-runner failure #3214 names, still happening after the decision was made.

## What this is NOT

**Not a request to reorder `record`'s effects.** Putting the ledger before the label was considered and is explicitly refused in `we:scripts/review-set-label.mjs` on stated grounds: *"an orphan row in the merge authority is NOT inert, so it must never precede the label it vouches for."* The halt is correct; the storage is the problem. (Checked while filing this — the reorder was the first hypothesis and it is wrong.)

**Not a re-litigation of #3214.** The fork is ruled. This is the deliverable.

## What A′ requires (its own words, carried here)

1. **The ledger JSONL lives on the `ops/review-requests` branch**, written by a git-backed io-shell behind the existing pure core — so the eventual DO/D1 swap touches one file (#2626's hard requirement).
2. *(Already done — the #2626 amendment is codified. Nothing to build.)*
3. **Fetch-append-retry is an acceptance criterion, not future work**: bounded retries, and a LOUD failure on exhaustion, never a silent drop. A two-writer concurrency test must pass before the store may be called append-only.
4. **The durable comment is demoted to a MIRROR** rendered from the ledger row — one authority, two renderings, neither independently authored.

## Done when

1. **Executable** — a two-writer concurrency test drives two concurrent `appendVerdict` calls at the git-backed store and asserts both rows survive, with the loser having retried rather than dropped. Red before this lands (no such store), green after.
2. **Executable** — `verdictLedgerPath()` resolves to a path on the transport branch, and a row appended from one clone is readable from a second clone of the same repo with no credential. A test that fails on today's machine-global path.
3. Retry exhaustion raises rather than returning `ok: true` — asserted, since a silent drop is the failure class #3007 exists to close.
4. The durable comment is rendered from the ledger row rather than authored beside it.
5. #3007, #3215, #3216 and #3217 name THIS item in `blockedBy` instead of resting on the resolved decision.
