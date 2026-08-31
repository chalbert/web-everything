---
bornAs: x4a2488
kind: story
size: 1
status: resolved
dateOpened: "2026-08-31"
dateStarted: "2026-08-31"
dateResolved: "2026-08-31"
graduatedTo: none
tags: []
---

# stdout-flush-scan: fix O(n squared) startsRegex rescan that cost 83 percent of check:standards runtime

we:scripts/lib/stdout-flush-scan.mjs's `startsRegex` re-derived its answer by re-scanning the ENTIRE accumulated
output on every slash character in every scanned file -- effectively quadratic per file. Measured: it alone cost
43.7s of check:standards's 52.7s total (83 percent); an incremental O(1) tail-state tracker dropped the whole
gate to 7.5s, identical findings, full unit suite green. Also why we:scripts/__tests__/stdout-flush.test.mjs was
pulled into the slow integration config -- its two heaviest tests hit this bug; now 16.7s, not 88.9s. Algorithmic
fix only, landed ahead of and independent of xdpzhqc/#3417 (the core-cap + worker-pool item) -- unrelated mechanisms.

## Done when

1. **Executable** — `we:scripts/__tests__/stdout-flush.test.mjs` (all 34 cases, including the regex/division
   disambiguation edge cases — `.replace(/[&<>"']/g, …)`, keyword-preceded regexes) passes unchanged, proving
   the incremental tail-state tracker is an exact equivalent of the old whole-string re-derivation, not an
   approximation.
2. **Executable** — `node we:scripts/check-standards.mjs` reports the identical finding set (same error/warning
   counts) before and after, on this repo's corpus — the fix changes performance only, never a verdict.
3. **Observable** — `node we:scripts/lib/stdout-flush-scan.mjs`'s `scanStdoutFlush` over this repo's `scripts/`
   + `skills-src/` tree completes in under 2s (measured: 43.7s → 0.3s), and the full `npm run test:unit` suite
   stays green (measured: 373 files / 9,864 tests).
