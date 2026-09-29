---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/lib/lane-salvage.mjs", "we:scripts/lib/salvage-index.mjs", "we:scripts/lib/__tests__/lane-salvage.test.mjs", "we:scripts/lib/__tests__/salvage-index.test.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2888's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/lib/lane-salvage.mjs:279` — Add a laneLivenessGate test that fails closed on a throwing mtime reader. As a review rule, any new throw path in a helper must name and test its call sites, found by grep.
2. `we:scripts/lib/lane-salvage.mjs:420` — Give copyLitterTreeSync an lstat-type allowlist (regular file, dir, symlink) that skips or records anything else. Add a test with a real mkfifo/socket, guarded by a timeout. Correct x7pj0mw's description from 'aborts' to 'hangs'.
3. `we:scripts/lib/lane-salvage.mjs:240` — Reject or treat as a single leaf a root whose lstat isSymbolicLink(). Add a test with a symlinked .claude/worktrees pointing outside the lane. Longer term, a shared safeReaddir helper that lstat-asserts a non-symlink directory before descending.
4. `we:scripts/lib/lane-salvage.mjs:240` — A test that passes a symlinked `dir` path to `listUnregisteredWorktreeLitter` and asserts that valid registered worktrees are still successfully excluded.
5. `we:scripts/lib/lane-salvage.mjs:244` — A test that places a dangling symlink at `.claude/worktrees` and asserts that `salvageLane` survives and gracefully handles it (e.g., treats it as empty).
6. `we:scripts/lib/salvage-index.mjs` — A static lint rule requiring all rmSync and unlinkSync paths within we:scripts/lib/salvage-index.mjs to be explicitly gated by an isUnderSalvageRoot check.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2888@140828a7bfdef76029bb8ce23228987f91fc29c4

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
