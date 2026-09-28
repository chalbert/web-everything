---
bornAs: xtpvwlv
kind: story
size: 2
priority: high
tier: pinned
rank: y
status: resolved
scope: ["we:scripts/lib/dispatch-contracts.mjs", "we:scripts/lib/__tests__/dispatch-contracts-trial.test.mjs", "we:scripts/lib/__tests__/judge-spawn.test.mjs", "we:scripts/conveyor/__tests__/concurrent-baseline-comparison.test.mjs", "we:scripts/conveyor/__tests__/run-rating.test.mjs", "we:scripts/__tests__/telemetry.test.mjs", "we:scripts/__tests__/telemetry-summary.test.mjs", "we:scripts/operations/__tests__/telemetry-summary.test.mjs", "we:scripts/operations/__tests__/agent-usage-report.test.mjs", "we:scripts/operations/__tests__/dispatch-lane-routing-record.test.mjs", "we:scripts/usage-report/__tests__/usage-report.test.mjs"]
dateOpened: "2026-09-28"
dateStarted: "2026-09-28"
dateResolved: "2026-09-28"
preparedDate: "2026-09-28"
preparedAgainstSha: "7b014e355619cd456edb582b4a5582f0edc39ac9"
tags: []
---

# Use Claude Sonnet 5.5 for the sonnet tier

Claude Code 2.1.284 accepts the model id claude-sonnet-5-5 (verified 2026-09-28 2:10 PM ET); the CLI's own sonnet alias still resolves to claude-sonnet-5. we:scripts/lib/dispatch-contracts.mjs's CLAUDE_NATIVE_MODEL_BY_TIER.sonnet (L527) and the matching SUPERVISOR_CANDIDATES roster entry (L620) pin the literal string claude-sonnet-5 — update both to claude-sonnet-5-5, then check for and update every other pinned sonnet id this repo carries (tests, docs, review-seat config), not just the two named lines.

## Scope

- **we:scripts/lib/dispatch-contracts.mjs** — `CLAUDE_NATIVE_MODEL_BY_TIER.sonnet` (L527, currently
  `'claude-sonnet-5'`) and the `SUPERVISOR_CANDIDATES` roster entry `{ id: 'claude-sonnet-5', ... }` (L620) —
  both the model id and the roster entry's own `id` field name the same literal string today.
- A confirmed grep of the literal string `'claude-sonnet-5'` across `scripts/` and `skills-src/` turns up **11
  files total**: the source file above plus 10 test files that assert against it —
  `we:scripts/lib/__tests__/dispatch-contracts-trial.test.mjs`, `we:scripts/lib/__tests__/judge-spawn.test.mjs`,
  `we:scripts/conveyor/__tests__/concurrent-baseline-comparison.test.mjs`,
  `we:scripts/conveyor/__tests__/run-rating.test.mjs`, `we:scripts/__tests__/telemetry.test.mjs`,
  `we:scripts/__tests__/telemetry-summary.test.mjs`, `we:scripts/operations/__tests__/telemetry-summary.test.mjs`,
  `we:scripts/operations/__tests__/agent-usage-report.test.mjs`,
  `we:scripts/operations/__tests__/dispatch-lane-routing-record.test.mjs`,
  `we:scripts/usage-report/__tests__/usage-report.test.mjs`. Every hit needs a live re-check at implementation
  time (this list can drift) rather than trusting this count.

## Risks

- **`SUPERVISOR_CANDIDATES`'s `id` field is a routing key, not just a display label.** `SUPERVISOR_LADDERS`
  (same file, ~L625) builds its per-`risk/complexity` fallback chains from `SUPERVISOR_CANDIDATES.map(c =>
  c.id)`, and other call sites may look a candidate up BY that `id` string. Renaming the roster entry's `id`
  from `'claude-sonnet-5'` to `'claude-sonnet-5-5'` (as literally instructed) therefore risks a dangling
  reference anywhere else in the codebase that matches on the OLD id string specifically — not just the model
  string. This needs its own grep pass (`'id: .claude-sonnet-5.'` and any code that indexes
  `SUPERVISOR_CANDIDATES`/`SUPERVISOR_LADDERS` by id), separate from the model-string grep above, before
  assuming the rename is contained to the two named lines.
- **The `sonnet` alias in Claude Code's own CLI still resolves to `claude-sonnet-5`, independent of this repo.**
  This card only controls WE's own dispatch pin; it does not and cannot change what a bare `--model sonnet`
  invocation resolves to outside WE's own dispatch path — worth stating so the live proof (below) targets a
  WE-DISPATCHED session, not a bare CLI invocation.
- **Some of the 10 test files may assert the OLD id as a fixture value unrelated to the sonnet tier itself**
  (e.g. a generic "any known model id" fixture) — each needs to be read, not just string-replaced, to confirm
  the assertion is actually ABOUT the sonnet pin before changing it.

## Test plan (each fails before the fix, passes after)

1. `we:scripts/lib/__tests__/dispatch-contracts-trial.test.mjs` and `we:scripts/lib/__tests__/judge-spawn.test.mjs`:
   updated to assert `CLAUDE_NATIVE_MODEL_BY_TIER.sonnet === 'claude-sonnet-5-5'` and the matching roster
   entry's `model`/`id`.
2. `grep -rn "'claude-sonnet-5'" scripts/ skills-src/` (excluding a literal `'claude-sonnet-5-5'` match) finds
   nothing after the change — proving no stray pinned reference (source or test) was missed.
3. Each of the other 9 listed test files still passes, confirmed individually rather than assumed from the
   grep alone.

## Tasks

1. Re-run the grep from Scope at implementation time (file set may have drifted) and read each hit to confirm
   it is actually about the sonnet pin before touching it.
2. Update `we:scripts/lib/dispatch-contracts.mjs` L527 and L620 (model id AND roster `id` field) to
   `'claude-sonnet-5-5'`; grep for any OTHER code that indexes `SUPERVISOR_CANDIDATES`/`SUPERVISOR_LADDERS` by
   the literal old `id` string (Risks, above) and update those call sites too.
3. Update the 10 test files' literal-string assertions to match.
4. Check for pinned sonnet ids outside `scripts/`/`skills-src/` per the operator's own instruction — docs and
   any review-seat config — and update any found.
5. Gate with the `verify` operation; open with `open-pr`; run the proof plan below.

## Proof plan (live, before/after)

- **Before:** a WE-dispatched sonnet-tier session (via `we:scripts/lib/dispatch-contracts.mjs`'s own selection
  path) reports its model as `claude-sonnet-5`.
- **After:** the same dispatch path, unchanged otherwise, reports `claude-sonnet-5-5` — record the actual
  dispatched session's reported model as the live evidence, not just the passing unit tests.
