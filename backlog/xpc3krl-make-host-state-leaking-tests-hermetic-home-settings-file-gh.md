---
kind: story
size: 5
parent: "4075"
status: open
scope: ["we:scripts/lib/__tests__/main-staleness.test.mjs", "we:scripts/operations/__tests__/review-dispatch.test.mjs", "we:scripts/conveyor/__tests__/reconcile-fix-dispatch.test.mjs", "we:scripts/lib/__tests__/daemon-self-sync.test.mjs", "we:scripts/operations/__tests__/route-pr-outcome-io-live.test.mjs", "we:scripts/operations/review-dispatch.mjs", "we:scripts/conveyor/reconcile-fix-dispatch.mjs", "we:scripts/lib/main-staleness.mjs", "we:vitest.setup.ts"]
dateOpened: "2026-09-25"
tags: []
---

# Make host-state-leaking tests hermetic (home settings file, gh auth, daemon state, git config)

ci-heal-2684 found 12 of 13 local vitest failures reproduce on origin/main with NO PR in a lane on this Mac, while CI on main stays green. Root cause: the tests (and in places the source under test) read real host state instead of being hermetic -- the real we:.claude/settings.json (today's weekend WE_HEAVY_ADMISSION_CAP=3 trial + other keys), real gh auth, real we:scripts/lib/daemon-self-sync.mjs state, and host git config. Affected: we:scripts/lib/__tests__/main-staleness.test.mjs, we:scripts/operations/__tests__/review-dispatch.test.mjs, we:scripts/conveyor/__tests__/reconcile-fix-dispatch.test.mjs, we:scripts/lib/__tests__/daemon-self-sync.test.mjs, we:scripts/operations/__tests__/route-pr-outcome-io-live.test.mjs. Fix: point each test at a temp HOME/settings path or a fake gh on PATH; where the SOURCE wrongly defaults to reading the real we:.claude by default (e.g. resolveSettings in we:scripts/operations/review-dispatch.mjs / we:scripts/conveyor/reconcile-fix-dispatch.mjs), fix the source seam to accept an injected settings path/object; consider a we:vitest.setup.ts guard that fails any test touching real host state under we:.claude. Proof required: each test red on this host before, green after, at most 2 files per vitest command; and green again with HOME pointed at a temp dir (simulating CI).

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
