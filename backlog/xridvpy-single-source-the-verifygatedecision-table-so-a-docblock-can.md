---
kind: story
size: 2
status: open
relatedTo: ["2833"]
scope: ["we:scripts/lib/lane-verify.mjs", "we:scripts/pr-land.mjs", "we:scripts/__tests__/lane-verify.test.mjs"]
dateOpened: "2026-08-02"
tags: [gate, verification, docs-drift]
---

# Single-source the verifyGateDecision table so a docblock cannot contradict a cell

Correct the four sites that still claim a `running` marker is refused unconditionally (the #2833 TTL degrade made that false), then make the drift structurally impossible: export the gate's cells as one frozen table and pin every documented cell to a real `verifyGateDecision` call in a test.

## Why — the same drift hit this gate twice in one review

`verifyGateDecision` (`we:scripts/lib/lane-verify.mjs`) is a decision table: `{absent, running, red, green, corrupt, other-sha}` × `requireVerified` × `breakGlass`. Both rounds of the #983 review found a **cell whose prose and code disagreed**, in the same function:

- **Round 1, finding 2** — the docs promised "absent/**red** under `--require-verified`" while the code refused a matching `red` unconditionally. Fixed by making `red` conditional.
- **Round 3 (the accept pass)** — finding 1's fix made a past-TTL `running` record degrade to the non-blocking `untracked` verdict when `requireVerified` is false, but four sites still assert the old unconditional rule.

Twice is a class, not a slip. The prose is written by hand from the author's mental model of the table, so any cell that later moves leaves a true-sounding sentence behind — and the sentence is what the next reader (and the next reviewer) trusts.

## The four stale sites

Each says, in substance, "a `running` marker is always refused", which is now false in the default (non-`--require-verified`) mode:

- `we:scripts/lib/lane-verify.mjs` — the `DEFAULT_VERIFY_TTL_MINUTES` docblock: "This only refines the human message (`abandoned` vs `in-flight`) … so the gate refuses regardless of age."
- `we:scripts/lib/lane-verify.mjs` — the `verifyGateDecision` docblock: "'never finished' (`running`) is always refused".
- `we:scripts/pr-land.mjs` — the finish-guard block comment: "A `running` marker for THIS HEAD is ALWAYS refused (a half-run must never look complete)".
- #2833's own resolution bullet: "REFUSES when the verification is `running` (unfinished — the exact stall) always".

The last one matters most: a resolution note is a durable record that later items cite as settled precedent.

## The guard

A lint for "a comment saying *always* must match the code" is not script-decidable. What **is** decidable is the pattern this repo already uses for the `check-standards` policy contract (pinned equal to the engine's exported constants): **single-source the contract, then test the prose against it.**

- Export the cells as one frozen `VERIFY_GATE_TABLE` — each entry `{ status, requireVerified, breakGlass, ok, reason, summary }`, where `summary` is the one-line human description.
- `verifyGateDecision` reduces **through** that table, so a cell cannot change without the table changing.
- The docblock summary is derived from (or asserted equal to) the table's `summary` strings, so editing behaviour without editing the prose fails a test rather than shipping.
- A unit test walks every table row, calls `verifyGateDecision` with that row's inputs, and asserts the returned `{ ok, reason }` — no documented cell may be unreachable, and no reachable cell may be undocumented.

## Definition of done

- All four sites above state the actual rule: a fresh in-flight `running` is always refused; a past-TTL `running` degrades to `untracked` when `requireVerified` is false and is refused under it.
- `VERIFY_GATE_TABLE` is exported and frozen, and `verifyGateDecision`'s branches are driven by it.
- A test asserts every table row against a real `verifyGateDecision` call, and fails when a documented cell has no reachable branch (or a branch has no documented cell).
- `check:standards` → 0 errors.
