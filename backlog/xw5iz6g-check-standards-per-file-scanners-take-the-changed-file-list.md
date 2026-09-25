---
kind: story
size: 5
parent: "xq5ggfh"
status: open
blockedBy: ["xy1ml9m"]
scope: ["we:scripts/check-standards.mjs", "we:scripts/check-standards-rules.mjs", "we:scripts/lib/rust-scan-bridge.mjs"]
dateOpened: "2026-09-25"
tags: []
---

# check:standards per-file scanners take the changed-file list instead of walking the repo

Make the per-file content scans in we:scripts/check-standards.mjs accept the scope context's changed-file set in --local mode instead of walking all ~9k tracked files: secret sweep (6f-i, ~1.4s), citation/provenance scans (6f-ii/6f-iii, ~1.5s), repo-locus prefixes (scanRepoLocusPrefixes), invisible-source scan, stdout-flush scan, harness-scaffolding sweep. Linked files are irrelevant for these (they judge one file's own content). Secret sweep stays in the lane, scoped. Keep the we-scan Rust bridge (we:scripts/lib/rust-scan-bridge.mjs) path working with a file list. Done when the replay proof (xy1ml9m) shows zero lane-own misses and before/after timings.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
