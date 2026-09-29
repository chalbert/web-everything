---
bornAs: xbha495
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/lib/git-hook-surface.mjs", "we:scripts/lib/__tests__/git-hook-surface.test.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2954's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/lib/git-hook-surface.mjs:232` — Have snapshotHookSurface record an explicit configState ('absent' | 'present' | 'unreadable') and act only on 'absent'. A unit test should cover the unreadable case.
2. `we:scripts/lib/__tests__/git-hook-surface.test.mjs:244` — Add a review-lens checklist item: every new try/catch that flips a status flag needs a test that drives the catch.
3. `we:scripts/lib/git-hook-surface.mjs:232` — Make `snapshotHookSurface` record `configBytes: null` only on ENOENT and mark other read errors (for example `configUnreadable: true`), then have reset skip the delete for the unreadable case. A lint rule flagging a bare empty `catch` whose result gates an `rmSync` would catch the wider class.
4. `we:scripts/lib/git-hook-surface.mjs:236` — A linter rule enforcing DRY principles (e.g., eslint-plugin-sonarjs no-identical-expressions or no-duplicate-string) or standard code review focused on scope reuse.
5. `we:scripts/lib/git-hook-surface.mjs:236` — A strict branch-coverage gate (e.g. 100% branch coverage required for new/touched lines) that would flag the `catch` block as uncovered.
6. `we:scripts/lib/__tests__/git-hook-surface.test.mjs:244` — A strict branch coverage gate enforcing 100% coverage on new code, ensuring catch blocks are executed by tests.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2954@3ce84db0d414861df0d5f4cf8c323e08c430792b

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
