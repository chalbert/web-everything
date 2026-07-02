---
kind: task
status: resolved
dateOpened: "2026-07-02"
dateStarted: "2026-07-02"
dateResolved: "2026-07-02"
tags: []
---

# Stop the compiled-artifact leak: ignore publish-built JavaScript and declaration output in source planes and delete the strays

111 untracked compiled JavaScript and TypeScript-declaration build artifacts sit next to sources (we:contracts/, we:capability-manifest/, we:error-summary/, we:commitment-policy/), one over-broad stage away from being committed; we:.gitignore covers only the sourcemap files. Ignore the built outputs (or point the package tsconfig at we:dist/), delete the strays plus the orphaned sourcemaps in we:blocks/renderers/auto-define/, and remove we:tmp/ and we:tmp-pw-plateau.mjs.

## Progress

- Verified zero tracked `.js`/`.d.ts` in the four package planes (`git ls-files`) — all strays; these packages ship `.ts` sources directly (we:contracts/package.json `files: ['*.ts']`), so compiled output is never legitimate there.
- Deleted 112 stray build files (56 `.js`/`.d.ts` + 56 sourcemaps) across we:contracts/, we:capability-manifest/, we:error-summary/, we:commitment-policy/; deleted the 10 orphaned sourcemaps in we:blocks/renderers/auto-define/; removed empty we:tmp/ and we:tmp-pw-plateau.mjs.
- Added scoped rules to we:.gitignore (`<plane>/**/*.js` + `**/*.d.ts` for the four planes) so future publish builds can't leak into the working tree.
