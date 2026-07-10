---
kind: story
size: 8
parent: "2268"
status: resolved
blockedBy: ["2274", "2270", "2271"]
dateOpened: "2026-07-04"
dateStarted: "2026-07-09"
dateResolved: "2026-07-09"
graduatedTo: "we:scripts/session-replay.mjs"
tags: []
---

# Tier-B session-replay harness for judgment skills in an ephemeral worktree

Run a judgment-driven skill (batch, drain, finish, next, review-program) for real inside an ephemeral, revertible git worktree seeded from a corpus fixture, assert the invariant catalogue against the resulting tree, then discard the worktree. Session-run, not CI. Split candidate (size 8): one skill end-to-end first, then generalize the replay driver across skills.

## Progress (2026-07-09) — v1 shipped: `batch` end-to-end

Per #2274 (the ratified substrate: an ephemeral throwaway clone, `mkdtemp`+`git init`/`clone`, discarded
via `rmSync`, never the shared lane pool or `~/workspace/.lanes`) and per this item's own split note (one
skill end-to-end first), built:

- **`we:scripts/lib/replay-substrate.mjs`** — generalizes the pattern already shipping in
  `we:scripts/__tests__/lane-drain-numbering.test.mjs` and `we:scripts/__tests__/lane-pool-refresh-guard.test.mjs`:
  a fabricated bare `origin.git` + a real clone of it under one `mkdtemp` dir, seeded with an initial commit
  and pushed, with a `cleanup()` that `rmSync`s the whole substrate.
- **`we:scripts/session-replay.mjs`** (CLI: `open` / `check` / `close`, also `npm run replay:session`) —
  `open --skill=batch` allocates the substrate, seeds it with a real #2270 golden-corpus `backlog-claim`
  fixture, and writes a `we:.replay-session.json` manifest (skill, fixture id, `mainShaAtOpen`, the Tier-B
  invariant ids from #2271's catalogue that apply to `batch`). It prints instructions for a **live session**
  to `cd` in and drive the `batch-backlog-items` skill for real against the ephemeral repo. `check --dir=`
  then asserts, against the resulting tree: (1) `tier-b.lane-isolation-never-primary-checkout` — the work
  dir is disjoint from the primary checkout / real lane roots; (2) `tier-b.producer-never-merges-never-pushes-main`
  — the fabricated origin's `main` ref is unchanged from fixture-seed time (a direct push/merge would move
  it); (3) `tier-b.batch-hard-stop-guarantees-termination` — the session stamped a terminal marker
  (`stoppedAt`/`itemsProcessed`) in the manifest (self-reported evidence, not independently provable from
  the tree alone — inherent to a judgment-driven skill with no deterministic output). `close --dir=`
  discards the substrate.
- **`we:scripts/lib/invariant-catalogue.json`** — `howChecked` updated (additively, no schema change) on
  the three now-harness-observable Tier-B invariants above to point at this harness; `status` stays
  `judgment-only` since driving the skill itself is still LLM judgment, not hook-enforced.
- **`we:scripts/__tests__/session-replay.test.mjs`** — deterministic Tier-A proof of the harness's own
  mechanics (substrate creation, fixture seeding, PASS/FAIL assertion logic, teardown). It does not and
  cannot test the judgment skill itself — that stays session-run, exactly as scoped.

**Follow-on (not this slice):** `--skill` is parameterized but only `batch` has fixture-seeding wired;
generalizing `open` to drain/finish/next-backlog-item/review-program (and to their skill-specific
invariants, e.g. `tier-b.drain-reuses-shared-transport-never-admin-merge`,
`tier-b.finish-takes-over-in-place-never-restarts-from-scratch`) is the next slice this item's own digest
calls for.
