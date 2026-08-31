---
bornAs: xofq02s
kind: task
status: open
dateOpened: "2026-08-31"
tags: []
---

# rust-scan citation_check: \b word-boundary is Unicode-mode, JS reference is ASCII-only

citation_check.rs's locus_re/hash_ref_re/file_link_re use \b, which the regex crate resolves in Unicode mode (broad \w) by default, unlike JS's non-/u ASCII-only \b. A citation directly abutting a non-ASCII word character (e.g. we:scripts/missing.mjs:10café) silently fails to match in Rust where JS would flag it as dangling. Found by the /review juror on PR #1753 (correctness, carve-out, non-blocking).

## Done when

1. **Executable** — add a non-ASCII-adjacent citation fixture (e.g. `we:scripts/missing.mjs:10café`) to `we:scripts/__tests__/rust-scan-citation-check-parity.test.mjs` asserting the Rust and JS gates agree on it; the fixture reddens before the `\b` boundary handling in `we:scripts/rust-scan/src/citation_check.rs`'s `locus_re`/`hash_ref_re`/`file_link_re` is fixed (e.g. `(?-u)` or an explicit ASCII-only boundary), and passes after.
