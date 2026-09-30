---
kind: story
size: 2
status: resolved
scope: ["we:src/_data/backlog.js", "we:scripts/lib/related-report.cjs", "we:scripts/check-standards.mjs", "we:scripts/check-standards-rules.mjs", "we:scripts/__tests__/related-report.test.mjs", "we:scripts/__tests__/check-standards-rules-registry-validators.test.mjs"]
dateOpened: "2026-09-30"
dateResolved: "2026-09-30"
graduatedTo: none
tags: []
---

# Accept we-prefixed relatedReport paths consistently

Fix the recurring locus-prefix conflict by normalizing we: relatedReport paths for report loading, existence checks, and report visibility while retaining unprefixed compatibility. Add regression tests for both forms.

## Done when

1. The report loader mirrors title, summary, details, and date for both qualified and legacy references.
2. The standards existence and hidden-report checks accept both forms and still reject missing reports.
3. Regression coverage in `we:scripts/__tests__/related-report.test.mjs` passes, followed by the standards and lane gates.

## Implementation

Share normalization through `we:scripts/lib/related-report.cjs` across the loader, item validator, and report-visibility index. Preserve authored references for display and diagnostics. Other readers only display, pass through, test presence, or extract dates; they need no filesystem normalization.

## Follow-ups

Keep fixture coverage for both reference spellings and missing reports; use an isolated child process for the loader because its backlog directory is captured at module load. Re-run the lane gate with socket and process-table access before landing; do not weaken those tests.


## Verification

The five related-report regression cases and 90 registry-validator tests pass. The full standards gate passes with zero errors. The lane verifier was invoked; its default marker write is denied by the sandbox on `we:.git/.lane-verify`, so its supported `run` mode executes the same gate without the marker. Shared admission locks use a temporary pool root because the host pool is outside writable roots.

The wider lane suite finished: 226 files passed, three failed; 10,455 tests passed, seven failed, five skipped. The failures are in `we:scripts/operations/__tests__/http-adapter.test.mjs`, `we:scripts/operations/__tests__/restart-runner-io-real.test.mjs`, and `we:scripts/operations/__tests__/clear-stuck-session-io-real.test.mjs`. Direct probes confirm localhost listen returns EPERM and ps is denied by the sandbox. The socket failure also produces one unhandled EPERM error.
