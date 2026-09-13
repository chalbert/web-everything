---
bornAs: xoppas2
kind: story
size: 3
parent: "3383"
status: open
scope: ["we:scripts/operations/deliver-item-wrapper.mjs", "we:scripts/operations/fix-dispatch-wrapper.mjs", "we:scripts/operations/ci-heal-dispatch-wrapper.mjs", "we:scripts/operations/prepare-decision-wrapper.mjs", "we:scripts/operations/prepare-scope-wrapper.mjs", "we:scripts/operations/delivery-report-store.mjs", "we:scripts/operations/fix-report-store.mjs"]
dateOpened: "2026-09-13"
tags: []
---

# Delivery-report reports dir resolved from wrapper's own script location, not the target lane (broke non-Claude delivery)

Every mechanical dispatch wrapper (we:scripts/operations/deliver-item-wrapper.mjs, we:scripts/operations/fix-dispatch-wrapper.mjs, we:scripts/operations/ci-heal-dispatch-wrapper.mjs, we:scripts/operations/prepare-decision-wrapper.mjs, we:scripts/operations/prepare-scope-wrapper.mjs) resolved the delivery-report/fix-report output directory (we:scripts/operations/delivery-report-store.mjs#resolveDeliveryReportsDir, we:scripts/operations/fix-report-store.mjs#resolveFixReportsDir) with no argument, so it fell back to a SCRIPT-LOCATION default naming the wrapper's own process root (always the primary checkout, never the target lane), and handed that wrong path to the spawned build agent as OPERATION_DELIVERY_REPORTS_DIR/OPERATION_FIX_REPORTS_DIR. Claude's --restricted mode never caught it (the agent writes its report via a Bash-shelled CLI, invisible to the Edit/Write-only we:scripts/guard-lane.mjs / we:scripts/guard-bash.mjs hooks); Codex's real OS-level lane sandbox correctly refused with EPERM, surfaced live during item #3476's first Codex delivery trial. FIXED on lane/mechanical-dispatcher: resolveDeliveryReportsDir/resolveFixReportsDir now take an optional lane-path root, every provider.spawn (Claude and Codex, across all five wrapper kinds) calls it WITH the resolved lane path, and every wrapper-side report read-back (runAgentToCompletion, runGateWithOneRetry, runFixAgentToCompletion, runFixGateWithOneRetry, runCiHealAgentToCompletion, runPrepareAgentToCompletion, runPrepareGateWithOneRetry) resolves the same lane-scoped directory before reading. Regression tests added asserting resolveReportsDir is called WITH the lane path, never bare. Verified: full existing Claude-provider test suites for all five wrappers plus both report-store files pass (310+ tests); check:standards shows no new errors versus the primary checkout on the same commit.

## Done when

1. **Executable** — `npx vitest run we:scripts/operations/__tests__/deliver-item-wrapper.test.mjs we:scripts/operations/__tests__/fix-dispatch-wrapper.test.mjs we:scripts/operations/__tests__/ci-heal-dispatch-wrapper.test.mjs we:scripts/operations/__tests__/prepare-decision-wrapper.test.mjs we:scripts/operations/__tests__/prepare-scope-wrapper.test.mjs` passes, including each suite's new "resolves the reports dir WITH the resolved lane path — never bare" regression test (fails on the pre-fix `resolveReportsDir()` bare-call shape, passes once every `provider.spawn`/report read-back is threaded the resolved lane path).

## Progress

Fixed directly on `lane/mechanical-dispatcher` in the same session that filed this card (epic #3383, "fix what you find" default for prototype-internal work). See the digest above for the root cause, why Claude's soft sandbox never caught it, and the exact fix shape. All done-when checks pass; `check:standards` shows no new errors versus the primary checkout on the same commit.
