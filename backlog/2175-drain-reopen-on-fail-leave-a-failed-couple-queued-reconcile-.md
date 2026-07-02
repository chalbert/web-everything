---
kind: story
size: 3
parent: "2162"
status: resolved
blockedBy: ["2172"]
dateOpened: "2026-07-02"
dateStarted: "2026-07-02"
dateResolved: "2026-07-02"
tags: []
---

# Drain reopen-on-fail: leave a failed couple queued, reconcile a stranded/partial item back to open

The drain-side of the #2072 reconcile. When a couple fails to land (impl merge red, WE resolve unreachable, cross-repo partial), the drain leaves it queued (never falsely resolved) and reconciles a stranded/partial WE item back to status:open via we:scripts/backlog.mjs release, preserving durable lane/* refs for the next drain pass.

## Progress

In we:scripts/lane-drain.mjs, added the post-drain reconcile keyed off each `drain-one` result:

- **`planPostDrain(result)`** — pure decision (unit-tested): a LANDED couple → `deleteManifest`; a `merge-failed`/`resolve-unreachable` couple → `reopen`; a defer/dry-run/bad-input → neither (never touched main).
- **Reopen-on-fail** (`reopenStrandedItem`) — on a failed land, flips the stranded WE item `active→open` via we:scripts/backlog.mjs `release --force`. Verified that `release` mutates NEITHER we:.claude/skills/batch-backlog-items/queued.json NOR any `lane/*` ref (only `queue`/`unqueue` touch the marker), so the couple stays **queued with its durable refs preserved** for the next drain pass — while the status is honest (open = not-being-worked), the drain-side of the #2072 closeout. The failure paths never delete a ref.
- **Manifest cleanup on success** (`finalizeLand`) — after a couple lands via PR onto origin/main, syncs local main (ff-only `pull`), unqueues, and **deletes the we:.lane-manifest.json** the WE lane commit carried, in one tight-pathspec commit.
- **Publish** — housekeeping commits publish via the SANCTIONED we:scripts/push-if-green.mjs helper (`--assume-green`, since pr-land's CI just gated the tree) — never a raw main push (the #2172 transport contract; its source-guard test refined to assert pr-land+push-if-green precisely rather than a blunt `push.*main`).

Tests: we:scripts/__tests__/lane-drain.test.mjs +7 (planPostDrain outcomes + reopen/cleanup/scoped-commit source-guards); all 27 green.

**Pre-PR independent review (#2170):** HIGH fixed — the reconcile's bare `git commit` would sweep foreign staged hunks (the shared-index commit race); both commits now scope to an explicit `-- <pathspec>` (+ dropped the redundant `git add`, the LOW). 1 dismissed (MED, in the PR body): `pull --ff-only` sync is best-effort under this repo's routinely-dirty tree — the land is never unwound (pr-land already merged), cleanup/publish degrade gracefully and are reported.
