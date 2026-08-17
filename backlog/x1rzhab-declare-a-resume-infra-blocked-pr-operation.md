---
kind: task
status: open
dateOpened: "2026-08-17"
tags: []
---

# Declare a resume-infra-blocked-PR operation

Surfaced by tonight's (2026-08-17) operations audit, alongside x6hczic (the recording bug that silently drops the record for descriptively-named lane refs). Even once x6hczic is fixed, the actual resume step -- checkout the pushed ref, write a fresh body file, re-run we:scripts/pr-land.mjs -- is still a manual ceremony an orchestrating session has to run by hand; the conveyor's own auto-retry only fires when a record exists to retry from. Tonight this was done by hand 3 times (we:lane/file-3128-followups landing as PR #1443, we:lane/resolve-3015-stale-status as #1446, we:lane/file-git-provider-abstraction as #1450), including once discovering mid-outage that the recorded resumeHandle was itself unreliable. A declared operation (or CLI wrapper) that takes a lane ref name and resumes it -- checking whether a PR already exists first, so it's idempotent -- would remove this from manual orchestration.

## Done when

1. **Executable** — a callable command (`node we:scripts/resume-infra-blocked-pr.mjs --ref=<lane-ref>` or a registered operation) checks first whether a PR already exists for the given ref (idempotent — no duplicate open), and if not, checks out the pushed ref, writes a fresh body, and re-runs we:scripts/pr-land.mjs — a test with a fixture "ref pushed, no PR yet" state asserts a PR gets opened, and a fixture "PR already exists" state asserts a clean no-op rather than a duplicate.
2. Depends on x6hczic landing first (or works around its gap directly) — the resume command must not rely on a resumeHandle it can't trust to exist; it should be able to resume from just the ref name alone.
3. `npm run check:standards` is 0 errors and the relevant new test file is green.
