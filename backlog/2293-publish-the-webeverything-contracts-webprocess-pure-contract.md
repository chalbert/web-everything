---
kind: task
parent: "1294"
status: resolved
dateOpened: "2026-07-06"
dateStarted: "2026-07-07"
dateResolved: "2026-07-07"
graduatedTo: none
relatedReport: reports/2026-07-05-backlog-split-analysis.md
tags: [constellation-placement, reference-runtime, webprocess, relocation]
---

# Publish the @webeverything/contracts/webprocess pure-contract entry

Add the type-only contract barrel we:contracts/webprocess.ts (export type * from ../process/contract) plus the FUI tsconfig path, mirroring we:contracts/webcompliance.ts — the FUI→WE arrow the relocated webprocess runtime imports. First slice of the process relocation cascade under #1294.

## Resolution (2026-07-07)

Two PRs, mirroring the webcompliance entry exactly:
- **WE** (this PR): `we:contracts/webprocess.ts` type-only barrel (`export type * from '../process/contract'`, zero runtime emit) + the `./webprocess` subpath in `we:contracts/package.json` `exports`.
- **frontierui PR #13**: the FUI-side resolution pair — `@webeverything/contracts/webprocess` → `we:process/contract.ts` in `fui:tsconfig.json` **and** the matching `fui:vite.config.mts` alias, same shape as `webcompliance` (which is wired in both).

The arrow is now published and resolvable; it stays inert until the relocated webprocess runtime (a later #1294 slice) imports it. Barrel typechecks clean (`tsc --noEmit`).
