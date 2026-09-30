---
bornAs: x3jdaea
kind: story
size: 5
status: open
dateOpened: "2026-09-30"
tags: []
---

# Make builder edits tests and completion reporting fail atomically

A failed macOS sed edit in 4295 still launched a 3.44-minute suite; 4480 required a 1.43-minute failed wrapper gate and resume, and 4331 reported done after an edit failed. Replace shell-chain success inference with structured step results. See we:reports/2026-09-30-builder-postmortem.md.

## Evidence and cost

T4295 lines 159–160: BSD sed failed but **3.44 minutes** of broad testing still ran. Six builds contain observed BSD sed errors. T4331 lines 85–100 and T4480 lines 60–76 emitted done after failed edits. T4480's earlier stale expectation caused a **1.43-minute red wrapper gate**, then a resume and **2.39-minute** valid second gate. The first gate failure was not caused by the later sed error. These costs overlap the test-selection card.

## Root cause and change

Unstructured shell chains infer success from the final command/pipeline; a free-standing completion report is not bound to prerequisites. Use portable structured edits with match assertions, explicit test process status, and latest-tree completion receipts. Prevent dependent actions after failed prerequisites. Distinguish implementation-ready from verified and invalidate stale receipts after resumed changes.

## Done when

Extend we:scripts/operations/__tests__/delivery-report-record.test.mjs and we:scripts/operations/__tests__/deliver-item-wrapper.test.mjs with failed edit, failed piped test, stale tree, duplicate report and resume cases. A fake failed editor followed by a successful report command must never produce verified completion. Live isolated proof: force a safe edit mismatch, observe zero dependent test launches and no valid completion, then repair and observe one verified receipt.
