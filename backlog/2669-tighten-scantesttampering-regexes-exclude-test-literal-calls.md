---
bornAs: xzcx25r
kind: story
size: 2
parent: "2410"
status: resolved
blockedBy: ["2440"]
dateOpened: "2026-07-26"
dateStarted: "2026-07-27"
dateResolved: "2026-07-27"
tags: []
scope:
  - we:scripts/lib/pr-merge-gate.mjs
  - we:scripts/__tests__/pr-merge-gate.test.mjs
---

# Tighten scanTestTampering regexes: exclude .test('literal') calls, catch .skip.each/.only.each

Two contained regex tightenings in scanTestTampering (we:scripts/lib/pr-merge-gate.mjs), surfaced by the #752 human review of slice #2440. (1) TEST_CASE_OPENER_RE currently counts .test('literal') assertion calls (e.g. expect(re.test('x')).toBe(true)) as test-case openers, so a refactor consolidating inline RE.test('sample') assertions in a *.test.mjs file nets a removal and mis-parks the couple review:human — a false-positive in the safe direction, but friction. Exclude the .test('literal') method-call form from the case counter. (2) SKIP_FOCUS_MARKER_RE requires ( immediately after skip/only, so .skip.each([...])(...) / .only.each(...) and line-wrapped .skip( bypass the detector — a false-negative that defeats the gate's stated purpose, only partly backstopped by the validator mandate. Extend it to the .each parameterized forms. Both live in the same regex block; fix together. Add regression tests to we:scripts/__tests__/pr-merge-gate.test.mjs for both. Out of scope: the string-literal false-positive (finding 2 of the #752 review) is already documented as a fail-safe residual in the PR.
