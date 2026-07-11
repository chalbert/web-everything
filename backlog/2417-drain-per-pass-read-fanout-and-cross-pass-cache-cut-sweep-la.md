---
kind: task
status: open
priority: low
relatedTo: ["2257", "2287", "2194", "2262"]
tags: [lane, drain, merge-queue, perf]
dateOpened: "2026-07-10"
---

# Drain per-pass read fan-out + cross-pass cache — cut sweep latency without touching the serial merge

> **Priority note (2026-07-11, Plateau Loop triage).** Perf tuning of the sweep-from-scratch model a
> resident coordinator replaces (its state is resident — no per-pass re-reads to cache;
> [#xhmav8a](/backlog/xhmav8a-plateau-loop-extract-the-delivery-machinery-into-a-coordinat/)).
> Read-only latency, no correctness impact — settled-but-low-value-now: pickable, out of auto-select.

Each `sweepOnce()` in `we:scripts/merge-ai-prs.mjs` gathers candidate data **fully serially** (the CLI is
`execFileSync` throughout): per repo it runs `gh pr list`, then per PR a separate `gh pr view --json commits`
(`we:scripts/merge-ai-prs.mjs:907-910`) plus a `readPrManifest` fetch. For a ~15-PR queue across 3 repos that
is ~30 sequential `gh` round-trips (tens of seconds) — and under `--watch --interval=N` it re-issues **all of
them every pass** even when nothing changed (memoization today covers only label provisioning + drain-reason
comments, not the per-PR reads).

These reads are **read-only, touch nothing on main, and have no ordering constraint**, so they are safe to
run concurrently. Two changes:

- **Fan out the per-PR reads** (`gh pr view commits` + manifest) with a bounded concurrency pool instead of
  one-at-a-time; also list the 3 repos concurrently.
- **Cache across `--watch` passes**: skip re-fetching commits/manifest for a PR whose head SHA is unchanged
  since the last pass (key on `(repo, number, headSha)`).

## Explicitly OUT of scope — do NOT parallelize the merge cascade

The merge loop (`we:scripts/merge-ai-prs.mjs:1246-1292`) stays **strictly serial**. Red-teamed and rejected:

- The drain is the **sole serial writer to main** — JIT numbering runs under an explicit mutex
  (`withNumberingLock`, #2391) and a racing writer trips the **dup-NNN tripwire**
  (`we:scripts/merge-ai-prs.mjs:1409`, exit 3, manual heal). Parallel merge widens exactly that window.
- Concurrent landing already shipped bad merges (plateau#11, web-everything#290 — the #2366 backstop).
- `plan.ready` is `blockedBy`-independent, **not file-independent**; each PR's `mergeable`/`test` was computed
  against **old** main. The serial cascade re-plans and re-observes mergeable/green against the new main
  between each land — that observation is the point, and parallel discards it.
- It also breaks the exit-2 contract: a parallel race-loss ("no longer mergeable, sibling landed") is
  indistinguishable at the gh layer from a real failure.
- Gain is ~zero anyway: rebase-drop rebuilds manifest-conflicting tips → fresh CI → they land on *different*
  passes, so several-PRs-simultaneously-mergeable barely occurs, and even then it saves seconds vs CI minutes.

The whole win is the read fan-out; the serial merge is load-bearing, not lazy.

## Acceptance

- Per-pass candidate gathering runs the per-PR `gh pr view`/manifest reads concurrently (bounded pool).
- A `--watch` pass reuses cached commits/manifest for any PR whose head SHA is unchanged.
- The merge cascade is byte-for-byte the same serial `blockedBy`-ordered loop (no behavioural change there).
- A test asserts unchanged-SHA PRs are not re-fetched on a second pass.

**Note:** `we:scripts/merge-ai-prs.mjs` is a **gate-self** path (the auto-review trust chain), so the fix PR
is `review:human` and must be cleared by a human, never agent-self-cleared.
