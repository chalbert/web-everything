---
bornAs: xaani98
kind: task
status: open
scope: ["we:scripts/readiness/test-selection.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# test-selection: an incidental basename-string mention sweeps an unrelated test into the diff-driven gate

Split from 4538 (fix 2 of 2; fix 1, making buildCoverageReport hermetic, landed with #4473). we:scripts/readiness/test-selection.mjs's referencedTestNeedles/testsNaming derives a needle from each changed file's own basename and greps every *.test.* file for a literal match, sweeping in ANY test file that merely mentions the string somewhere -- e.g. an unrelated classifyToolCall example command like node we:scripts/verify-lane.mjs run inside we:scripts/conveyor/__tests__/run-rating.test.mjs, which has zero actual coverage relationship to we:scripts/verify-lane.mjs's behavior. This widens every lane's local gate with unrelated (and, per 4538, sometimes non-hermetic/flaky) tests for no real safety benefit, and grows without bound as more test files happen to mention a given filename in passing. Tighten the heuristic -- e.g. only match a needle appearing inside an import/require/dynamic-import path, a mock-module specifier, or a documented we:scripts/verify-lane.mjs-style code-path reference, never inside an arbitrary string literal or comment -- or, if that proves too lossy, document the false-positive class explicitly and give a per-file escape (a leading-comment marker, mirroring the existing @test-only-export-ok / @cohesive conventions) so an incidental mention can opt out without losing real coverage elsewhere in the same file. Edge cases to name: a test file that legitimately imports/covers the changed file AND separately mentions an unrelated one in an example string (must keep the real coverage, drop only the false one); a needle that matches inside a STRING that is itself a real dynamic import path (must not misclassify a real reference as incidental); the CI-authoritative full suite must never be affected, only this LOCAL diff-driven shrink. Needs a wiring test proving a fixture test file that only mentions a filename in an unrelated example string is no longer selected, while a sibling fixture that genuinely imports/tests it still is.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
