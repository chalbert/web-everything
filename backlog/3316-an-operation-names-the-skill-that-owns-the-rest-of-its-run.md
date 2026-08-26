---
bornAs: xhqeicv
kind: story
size: 2
parent: "3318"
status: resolved
dateOpened: "2026-08-26"
dateResolved: "2026-08-26"
graduatedTo: none
scope:
  - we:scripts/operations/engine.mjs
tags: []
---

# An operation names the skill that owns the rest of its run

A five-step operation invoked bare is a findings generator, not a review. This session ran review-pr directly, stopped after reduce, hand-read the JSON and hand-applied fixes, then hit the self-clear refusal and read the two clearing routes out of an error string — when we:skills-src/review/SKILL.md had documented both all along. The skill was never loaded because nothing pointed at it. When a run suspends or refuses, name the owning skill in the emitted record so the caller can find the process it is standing outside of.

## Done when

1. **Executable** —

   ```
   npx vitest run engine -t "#3316" | grep -qE "Tests +[0-9]+ passed"
   ```

   The `grep` is load-bearing and is not decoration. `npx vitest run engine -t "#3316"` exits **0** on a tree
   with no matching tests — a filter matching nothing is a selection of zero, and vitest calls an empty
   selection a success — so the exit code alone proves nothing. Asserting that a `Tests N passed` line was
   printed asserts that tests actually RAN.

   On `origin/main` the filter selects nothing, vitest prints `No test found` with no `Tests` summary line,
   and the `grep` exits **1**. On this branch the `#3316` block in
   `we:scripts/operations/__tests__/engine.test.mjs` runs and the pipeline exits **0**.

2. **The declaration owns the pointer, not the engine.** `we:scripts/operations/engine.mjs` is generic across
   operations and stays that way: it reads `declaration.ownedBy` and special-cases no operation. The field is
   validated at registration in `we:scripts/operations/registry.mjs` alongside `verdictFrom` and
   `declaresOver`, so no fifth step kind is introduced (#3031 clause 2).

3. **Optional, and provably so.** An operation that declares no skill produces a `pending` with no `ownedBy`
   key at all — absent, not `null` — and the `--json` envelope it emits is unchanged. Pinned by
   *"an operation that declares NO skill produces the identical record"* in the same block.

## What shipped

Landed on `origin/main` as **PR #1602** (merge commit `f4160eaa`, 2026-08-26). Resolved by bookkeeping
reconciliation after the fact — the card was left `open` at land.

- `we:scripts/operations/registry.mjs` — `op()` accepts an optional `ownedBy` field: one locus-prefixed string
  (#883), validated at registration beside `verdictFrom` and `declaresOver`. No fifth step kind, so #3031
  clause 2's closed four-kind vocabulary is untouched.
- `we:scripts/operations/engine.mjs` — `pendingOn` reads `declaration.ownedBy` and names no operation, so all
  three suspends (`judge`, `confirm`, `effect`) carry the pointer from one line. A declaration with no
  `ownedBy` produces a byte-identical `pending` (conditional spread — the key is **absent**, not `null`), and
  `outcomePayload` omits it the same way.
- `we:scripts/operations/review-pr.mjs` — declares `ownedBy: 'we:skills-src/review/SKILL.md'`, the operation the
  defect was measured on.
- Adapters — `we:scripts/operations/cli-adapter.mjs` and `we:scripts/operations/http-adapter.mjs` surface it;
  `we:scripts/check-standards.mjs` gained a rule for it.
- Tests — `we:scripts/operations/__tests__/engine.test.mjs` (+86 lines),
  `we:scripts/operations/__tests__/registry.test.mjs`, `we:scripts/operations/__tests__/review-pr.test.mjs`.

The `#3316` criterion is red on `origin/main` (`grep` exit 1, bare vitest exit 0 — the empty-selection trap) and
green on the landed tree.
