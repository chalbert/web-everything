---
bornAs: xwtj36n
kind: task
parent: "4075"
status: open
scope: ["we:scripts/operations/review-loop-cli.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# Delete the now-unused in-process fileItemForPrevention/buildFileItemArgv from we:scripts/operations/review-loop-cli.mjs

#4493 converge round-1 (simplicity lens): `fileItemForPrevention`/`buildFileItemArgv` (`we:scripts/operations/review-loop-cli.mjs`) drove `file-item` IN PROCESS and were `runReviewLoopOnce`'s default `fileItem` before #4493 swapped it for `fileItemForPreventionViaLandingJob`. #4493 kept both exported + tested rather than deleting them, as a deliberate, documented non-default injectable binding (matching this file's own pre-existing pattern of keeping alternate injectable seams). Once no caller anywhere genuinely needs the in-process variant, delete `fileItemForPrevention`, `buildFileItemArgv`, and their dedicated tests — confirm via a grep/import-closure check that nothing outside this file's own now-removed tests references them before deleting.

## Done when

1. **Executable** — a repo-wide search confirms nothing outside this file's own (now-removed) tests imports
   `fileItemForPrevention`/`buildFileItemArgv`, then both exports and their dedicated `describe` blocks are
   deleted and the file's existing suite still passes:
   ```
   npx vitest run scripts/operations/__tests__/review-loop-cli.test.mjs
   ```
