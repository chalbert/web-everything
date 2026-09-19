---
bornAs: xiem56m
kind: task
status: resolved
dateOpened: "2026-09-06"
dateStarted: "2026-09-13"
dateResolved: "2026-09-13"
tags: []
---

# decideWeReCi compares abbreviated and full shas with strict equality

we:scripts/readiness/couple-plan.mjs decideWeReCi compares landed, base and main with ===, but its own SHA_RE (and the base validation in we:scripts/readiness/lane-manifest.mjs) admits 7 to 64 hex characters. An abbreviated stacked base can therefore never equal the full landed sha, so the ff-skip cannot fire and the printed reason misattributes the mismatch to a squash-merge or a re-stack that did not happen. Fail-safe in direction (it falls back to rebase + re-CI) and the module is model-only today, so the cost is a wasted CI cycle plus a misleading reason string rather than a wrong land.

## Done when

1. **Executable** — a `decideWeReCi` test where `base` is the 7-hex abbreviation of a full-length `landed`
   sha asserts `ff-skip`, not `rebase`. Red before, green after.
2. Comparison is prefix-aware in both directions, matching what `SHA_RE` and `we:scripts/readiness/lane-manifest.mjs` admit.
3. The reason string can no longer attribute a squash-merge or a re-stack to what was only a length mismatch.

## Progress

- Confirmed the spec still applies: both verdict comparisons use strict equality.
- Added regression coverage for bidirectional abbreviations, normalization, invalid inputs, conflicting suffixes, and the CLI call path. Confirmed seven regression failures before implementation, including the required 7-hex base/full landed case and CLI verdict.
- Implemented prefix-aware comparisons after validation, including base/main consistency so an abbreviated landed hash cannot hide conflicting longer hashes. Length-only differences now skip re-CI without a squash/re-stack reason.
- Validation: `node_modules/.bin/vitest run we:scripts/readiness/__tests__/couple-plan.test.mjs` — all 26 tests pass. Working-tree edits are ready for the wrapper.
