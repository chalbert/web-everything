---
kind: task
status: open
dateOpened: "2026-09-06"
tags: []
---

# decideWeReCi compares abbreviated and full shas with strict equality

we:scripts/readiness/couple-plan.mjs decideWeReCi compares landed, base and main with ===, but its own SHA_RE (and the base validation in we:scripts/readiness/lane-manifest.mjs) admits 7 to 64 hex characters. An abbreviated stacked base can therefore never equal the full landed sha, so the ff-skip cannot fire and the printed reason misattributes the mismatch to a squash-merge or a re-stack that did not happen. Fail-safe in direction (it falls back to rebase + re-CI) and the module is model-only today, so the cost is a wasted CI cycle plus a misleading reason string rather than a wrong land.

## Done when

1. **Executable** — a `decideWeReCi` test where `base` is the 7-hex abbreviation of a full-length `landed`
   sha asserts `ff-skip`, not `rebase`. Red before, green after.
2. Comparison is prefix-aware in both directions, matching what `SHA_RE` and `we:scripts/readiness/lane-manifest.mjs` admit.
3. The reason string can no longer attribute a squash-merge or a re-stack to what was only a length mismatch.
