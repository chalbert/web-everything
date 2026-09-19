---
bornAs: xt8kl97
kind: decision
status: open
scope: ["we:scripts/operations/run.mjs", "we:scripts/operations/__tests__/http-adapter.test.mjs", "we:scripts/conveyor/run-scorecards.json"]
dateOpened: "2026-09-18"
tags: [operations, build-infra, merge-conflicts, process-contention, conveyor, scripting]
crossRef: { url: /backlog/, label: Backlog }
---

# Recurring merge conflicts on three hot shared files — operations registration, test pinning, and scorecard append

**Structural merge-conflict bottleneck on three shared files** — `we:scripts/operations/run.mjs` (operation-registration import block), `we:scripts/operations/__tests__/http-adapter.test.mjs` (pinned operation-name array), and `we:scripts/conveyor/run-scorecards.json` (append-only trial log). Multiple in-flight PRs (#2288, #2292, #2296, #2310) have collided on the same lines multiple times in one evening. As operation registry grows, this serialized write-contention will only worsen. Filed as open/unprepared; investigation angles include auto-discovered registration and append-friendly log formats.

## The problem: recurring merge conflicts from shared-file contention

A structural problem emerged tonight (2026-09-18) in multiple in-flight PRs: any two PRs that touch the same three shared files for different reasons — adding a new operation, logging a trial result, or updating test fixtures — collide on the exact same lines. This has happened at least twice to the same PR (#2292) in a single evening. The pattern is clear, not an accident: these three files act as a shared bottleneck for operation registration and logging.

### The three hot files

1. **`we:scripts/operations/run.mjs`** — operation-registration import block
   - Every PR that adds a new operation must manually add an `import` line to register it
   - Writers: operation-implementation PRs, all editing the same block tail

2. **`we:scripts/operations/__tests__/http-adapter.test.mjs`** — pinned operation-name array
   - Test fixture that lists all known operation names (for a full-suite test)
   - Writers: same operation-implementation PRs, all appending to the same array

3. **`we:scripts/conveyor/run-scorecards.json`** — append-only trial-result log
   - Shared JSON array logging trial outcomes; every writer appends to the tail
   - Writers: multiple PR landings + trial runs, contending on the same line position

### Why this is structural, not a one-off

- **Serialized writes on a shared resource:** Every operation PR must touch two of these files; every trial run appends to the third. Under parallel development (multiple PRs landing within hours), this is inevitable, not rare.
- **Merge-conflict friction:** Each collision forces a rebase, re-testing, and re-landing — costly in a high-velocity scenario.
- **Unbounded growth:** As the operation registry grows, the problem gets worse, not better. A repo with 50 operations will have far more contention than one with 5.

## Investigation angles (not prescribed fixes)

These are realistic mechanisms to explore, not a mandate for one specific solution:

### Angle 1: Auto-discovered operation registration (vs. manual import list)

**Mechanism:** Replace the manually-maintained import block in `we:scripts/operations/run.mjs` with a glob or filesystem scan that auto-discovers operations from a directory pattern.

**Advantage:** No central file to edit; each new operation is self-contained (drop a file in `we:scripts/operations/`, define a named export, done).
**Disadvantage:** Requires hooking the module-discovery system; likely more complex per-operation than a two-line import. May have different semantics for module initialization order (if order matters).
**Test pinning impact:** Would still require pinning the test array, unless the test can also auto-discover. That is the easier half to solve.

### Angle 2: Append-friendly log format for scorecards

**Mechanism:** Instead of a single shared JSON array in `we:scripts/conveyor/run-scorecards.json`, use one of:
- **One-file-per-record:** `we:scripts/conveyor/run-scorecards/<trial-id>.json`, so every write creates a new file, no array tail to contend on.
- **Append-only log format:** `we:scripts/conveyor/run-scorecards.jsonl` (newline-delimited JSON), so every write appends a line without touching prior content.
- **Structured append with lexical ID:** Filenames like `we:scripts/conveyor/run-scorecards/2026-09-18-<uuid>-<trial-name>.json`, exploiting filesystem ordering and avoiding array rewrites.

**Advantage:** Writers never touch the same byte offset; no merge conflicts on append.
**Disadvantage:** Reading requires directory scanning or multiple file opens instead of one JSON parse. Cleanup/retention becomes more complex (manually delete old records vs. trim an array). Requires reader code changes.

## Done when

This item is filed as status: open, not yet prepared for a scoped decision. It should graduate to a `/prepare-decision-item` pass when:

1. One or both investigation angles above have been sketched for feasibility (rough effort, real blockers, compatibility risk).
2. The human judgment on "how bad is this really" is written down (how many PRs have hit this this month? is it a one-week spike or a permanent pattern?).
3. A recommended direction is chosen based on that data, not guessed.

Until then, this serves as a canonical reference for the structural problem, linking the evidence PRs (#2288, #2292, #2296, #2310) and suggesting the investigation angles.
