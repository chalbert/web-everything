---
kind: task
status: open
dateOpened: "2026-08-31"
tags: []
---

# rust-scan citation_check: context_around counts chars, JS reference counts UTF-16 code units

citation_check.rs's context_around measures its 30/80-char window in Rust char (Unicode scalar) counts, but JS's flat.slice(idx-30, idx+80) counts UTF-16 code units. The two diverge for astral characters (emoji, some rare CJK), so the reported context string can differ by a character or two from the JS reference around such input. Found by the /review juror on PR #1753 (correctness, carve-out, non-blocking, impact: cosmetic).

## Done when

1. **Executable** — add an astral-character fixture (e.g. an emoji within 30-80 chars of a citation match) to `we:scripts/__tests__/rust-scan-citation-check-parity.test.mjs` asserting exact `context` string equality between the Rust and JS reference; the fixture reddens before `context_around` in `we:scripts/rust-scan/src/citation_check.rs` counts UTF-16 code units instead of Rust chars, and passes after.
