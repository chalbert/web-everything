---
bornAs: xycb80x
kind: task
parent: "4075"
status: open
blockedBy: ["4273"]
scope: ["we:we:scripts/lib/__tests__/lane-salvage.test.mjs"]
dateOpened: "2026-09-28"
preparedDate: "2026-09-30"
preparedAgainstSha: "0d94db20be1b155e03cd300b984607920ffaad6f"
tags: []
---

# we:laneLivenessGate (#xl5xhmj) has no test proving it fails closed when newestContentMtimeMs throws

#4273 widened `we:scripts/lib/lane-salvage.mjs`'s `newestContentMtimeMs` so it now THROWS on an unreadable/unregistered `.claude/worktrees/` entry, where it previously always swallowed stat errors. The shared salvage gate (`laneLivenessGate`, extracted from `we:scripts/lane-pool.mjs`'s `cmdReclaimSalvage` in #xl5xhmj) already wraps that call in a try/catch that treats any thrown error as "changed just now" (fail-closed, refusing salvage) — but no test anywhere exercises that specific composition. Surfaced by an automated review during #4273's build. Done when: a test exercises `laneLivenessGate` with a stubbed/real `newestContentMtimeMs` throw and asserts the lane is correctly treated as not-quiet/not-reclaimed, closing the drift-detection gap the #4273 "mirror" test explicitly cannot.

## Progress

- **Old Premise/Scope:** The try/catch around `newestContentMtimeMs` lived inline in `we:scripts/lane-pool.mjs`'s `cmdReclaimSalvage` `gate()` closure, which was unexported and had zero test coverage. The `#4273 review` test only mirrored its shape. Original scope was `["we:scripts/lane-pool.mjs"]`.
- **Corrected Premise/Scope:** `cmdReclaimSalvage`'s inline gate was extracted to `laneLivenessGate` in `we:scripts/lib/lane-salvage.mjs` (commit #xl5xhmj) and `cmdReclaimSalvage` now delegates to it. `laneLivenessGate` is fully exported and testable, and contains the `try/catch` block. The factual drift is corrected; the goal remains the same (testing the actual gate). Corrected scope is `["we:we:scripts/lib/__tests__/lane-salvage.test.mjs"]`.

## Design
- The liveness gate (`laneLivenessGate` in `we:scripts/lib/lane-salvage.mjs`) correctly wraps `newestContentMtimeMs(dir)` in a try/catch.
- If it throws, it assigns `newestMtimeMs = nowMs`.
- We will add a test to the existing `describe('laneLivenessGate (#xl5xhmj)')` suite in `we:we:scripts/lib/__tests__/lane-salvage.test.mjs`.
- Because `newestContentMtimeMs` runs `git rev-parse --git-dir` via `dirtyPaths`, providing a non-existent directory string (e.g. `'/pool/unreadable-lane'`) causes a native throw. The `laneLivenessGate` catches it, sets `newestMtimeMs = nowMs`, and combined with a non-zero `quietMs` (e.g. `60000`), returns `eligible: false` because it appears "just touched" (`0 min ago`).
- No changes to production code are needed.

## MVP
1. Add `it('fails CLOSED (treats as freshly touched) when newestContentMtimeMs throws', ...)` to `laneLivenessGate`'s describe block in `we:we:scripts/lib/__tests__/lane-salvage.test.mjs`.
2. Inside it, call `laneLivenessGate({ dir: '/pool/unreadable-lane', readAgents: () => [], readCwds: () => [], quietMs: 60000, lastHolder: {} })`.
3. Assert that `eligible` is `false` and `reason` matches `/changed 0 min ago/`.

## Test plan
- Run `npx vitest run we:scripts/lib/__tests__/lane-salvage.test.mjs`
- Run `npm run check:standards`

## Proof plan
1. Run the new test; it should pass.
2. Temporarily remove the `try/catch` in `we:scripts/lib/lane-salvage.mjs` (`try { newestMtimeMs = newestContentMtimeMs(dir); } catch { newestMtimeMs = nowMs; }` -> `newestMtimeMs = newestContentMtimeMs(dir);`).
3. Run the test again; it should fail with an uncaught exception (`Command failed: git rev-parse`).
4. Restore the `try/catch`.

## Follow-ups
- The old `#4273 review` test that "mirrors the real gate composition" (lines 450-461) can eventually be removed if it becomes fully redundant, as we now test the real gate itself.

## Done when

1. **Executable** — `npx vitest run we:scripts/lib/__tests__/lane-salvage.test.mjs -t "fails CLOSED"` passes, and failing the `try/catch` in `laneLivenessGate` breaks the test.
