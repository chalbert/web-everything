---
kind: task
status: open
dateOpened: "2026-08-31"
tags: []
---

# rust-scan backlog_meta: invalid-UTF8 backlog file drops corpus-wide metadata instead of that file's own findings

backlog_meta.rs's load_backlog_items uses fs::read_to_string(...).ok()? to skip a file that fails to read, but JS's readFileSync(path,'utf8') decodes lossily instead of failing. Because this item's frontmatter feeds anchor_owners/pending_hashes/born_as_hashes shared across the whole corpus scan, one file with a stray invalid-UTF8 byte can drop that item's data entirely and turn OTHER files' correct citations into false-positive mismatches. Found by the /review juror on PR #1753 (correctness, carve-out, non-blocking, impact: broken if triggered).

## Done when

1. **Executable** — add a fixture backlog item with one intentionally-invalid-UTF8 byte (well-formed `codifiedIn`/`graduatedTo`/`bornAs` frontmatter otherwise) to the `we:scripts/rust-scan/src/backlog_meta.rs` test corpus, asserting `anchor_owners`/`pending_hashes`/`born_as_hashes` still include that item's frontmatter-derived data (or, short of a lossy-decode fix, that the skip is deliberate and covered) — the fixture reddens before the fix and passes after.
