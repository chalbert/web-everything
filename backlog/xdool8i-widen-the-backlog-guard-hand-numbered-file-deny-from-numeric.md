---
kind: task
parent: "3383"
status: open
scope: ["we:scripts/backlog-guard.mjs", "we:scripts/backlog/__tests__/backlog-guard-handnumber.test.mjs", "we:scripts/__tests__/publish-secret-gate.test.mjs"]
dateOpened: "2026-09-06"
tags: []
---

# Widen the backlog-guard hand-numbered-file DENY from numeric-only to any new backlog file made via the Write tool

Found live 2026-09-06 while building the `we:scripts/operations/file-item.mjs` prototype (parent #3383): `we:scripts/backlog-guard.mjs`'s existing hand-numbered-file DENY only caught a hand-picked numeric NNN, not a hand-typed `xNNNNNN` hash — yet a hand-authored hash-shaped file is exactly as much a bypass of the declared filing path (scaffold/file-item write via fs directly, never via the Write tool) as a numeric one is, and it skips the #883 locus-prefix scan that path always runs. Widened the DENY to fire on ANY brand-new backlog file created via the Write tool, editing an existing file unaffected. Updated `we:scripts/backlog/__tests__/backlog-guard-handnumber.test.mjs` and `we:scripts/__tests__/publish-secret-gate.test.mjs` (which relied on a hash-shaped id sidestepping the old rule) to match.

## Done when

1. **Executable** — `npx vitest run we:scripts/backlog/__tests__/backlog-guard-handnumber.test.mjs` passes,
   including a case asserting a brand-new hash-shaped (`xNNNNNN`) file made via the `Write` tool is DENIED,
   not just a numeric one.
