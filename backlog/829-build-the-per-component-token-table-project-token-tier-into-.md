---
type: issue
workItem: story
size: 3
status: open
blockedBy: ["801"]
dateOpened: "2026-06-17"
tags: []
---

# Build the per-component token table: project token tier into CEM cssProperties + render /blocks/{id}/ panel

Build slice ratified by #802. Extend gen-cem.mjs to emit cssProperties rows from each block's mapped component token group (resolved via webtheme flattenTokens/resolveTokens), MERGED (union) with #801's authored CEM contract — neither side clobbers the slot. Add an optional componentTokens (string|string[]) field to blocks.json entries naming the defaultTokens group(s) a block draws from (mirrors the fuiDemo precedent). Render a 3-column token panel (override · alias · resolved literal) on /blocks/{id}/. Blocked by #801 because both decisions write cssProperties and must coordinate the union emit. Sparse 2/69 token-tier coverage is a prioritisation input, not a scope cut.
