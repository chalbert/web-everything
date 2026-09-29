---
kind: story
size: 2
status: open
scope: ["we:scripts/lib/probation-launcher.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# probation-launcher frontmatterTamperedBeyondClaim: bare-CR (\r-only) smuggled key not caught

frontmatterTamperedBeyondClaim's line splitter now normalizes CRLF (\r\n) and LF (\n) but a lone-CR (\r-only, old-Mac-style) line ending inside an allowed-key line still gets filtered out as that owned key, letting a bare-CR-joined non-owned field slip past the check undetected if a downstream parser treats a bare CR as a line break. Pre-existing (predates #4395's CRLF fix; not introduced or worsened by it) — surfaced live by #4395's converge red-team (security lens), carve-out disposition (out of that item's MVP). Must: a reproduction test feeding a bare-CR-smuggled non-owned key through frontmatterTamperedBeyondClaim, red before, green after. Consider making the tamper check share the same line-terminator handling as whatever downstream parser actually reads the card (rather than a second, independent line splitter).

## Done when

1. **Executable** — a new test in `we:scripts/lib/__tests__/probation-launcher.test.mjs` feeds
   `frontmatterTamperedBeyondClaim` a bare-CR (`\r`-only, no `\n`) before/after pair whose only difference is a
   non-owned field, and asserts `true`. Fails on today's code (the bare `\r` line is filtered out as its owned
   key and the field change goes undetected) and passes once the tamper check's line-terminator handling covers
   a lone `\r`.
