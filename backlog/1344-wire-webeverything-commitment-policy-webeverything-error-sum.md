---
kind: story
size: 2
parent: "1250"
locus: frontierui
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: none
tags: []
---

# Wire @webeverything/commitment-policy + @webeverything/error-summary contract aliases (FUI)

Add @webeverything/commitment-policy + @webeverything/error-summary to fui:tsconfig.json (+ any vite/build mirror), pointing at the sibling WE root trees — same sibling-alias pattern as the 40+ existing @webeverything/* entries (fui:tsconfig.json:18-75). Foundational: unblocks porting the 2 WE-only webvalidation files.

## Progress (2026-06-20, batch-2026-06-20-1344-1342)

Both specifiers wired as **whole-package** root aliases (each WE package's index barrel re-exports
contract+provider+registry / model), mirroring the `@webeverything/capability-manifest` pattern, across
**all three** FUI resolver mirrors:

- `fui:tsconfig.json` (type-check `paths`).
- `fui:vite.config.mts` (runtime block-serve `resolve.alias`).
- `fui:vitest.config.ts` (test `alias`).

Targets verified present in the sibling WE tree: `we:commitment-policy/index.ts`,
`we:error-summary/index.ts`. No subpath aliases needed — the index barrels are the whole public surface.
Done.
