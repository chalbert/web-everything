---
bornAs: xsdy9fr
kind: story
size: 3
parent: "3443"
status: open
scope: ["we:scripts/operations/land-advance-tools.mjs", "we:scripts/operations/__tests__/land-advance-tools.test.mjs"]
dateOpened: "2026-09-21"
tags: []
---

# Graduate we:scripts/operations/land-advance-tools.mjs (new leaf module) from lane/mechanical-dispatcher to main

Graduation slice 2 of 6 for the land-advance operation, which exists only on origin/lane/mechanical-dispatcher. we:scripts/operations/land-advance-tools.mjs is a 26-line leaf with no imports (it holds ALLOWED_TOOLS_BY_KIND and allowedToolsArg) and is missing from main. It is imported by we:scripts/conveyor/session-verdicts.mjs, we:scripts/operations/land-advance-io.mjs and by two land-advance tests, so it lands before them. Port it as a diff onto main under the #3804 statute, never a copy over a file main has moved. Pure and standalone: ship it with a small unit test if the branch has none for it.

## Done when

1. **Executable** — `npx vitest run we:scripts/operations/__tests__/land-advance-tools.test.mjs` passes ON `main` after the port (the test is new: it pins `ALLOWED_TOOLS_BY_KIND` and `allowedToolsArg` for the `review`, `fix` and `build` kinds; the branch has no test file of its own for this module), and `git diff origin/main...origin/lane/mechanical-dispatcher -- we:scripts/operations/land-advance-tools.mjs` reports nothing.
2. `npm run check:standards` reports 0 errors.
3. Landed as its own PR through the normal lane → `we:scripts/verify-lane.mjs` → `we:scripts/operations/run.mjs open-pr --mode=land` pipeline, never a direct push.

## Order and port notes

- Part of the six-slice land-advance graduation under #3443. Order: this slice (2) first; the land-advance core (5) needs it; the session-verdicts slice (3) needs both; the watchdog (1) and ci-heal (4) slices are independent of everything else; the IO and wiring slice (6) lands last. This slice has no blockers.
- Under the #3804 statute (`we:docs/agent/platform-decisions.md#poc-branch-mechanical-sync`) a graduation slice is exempt from the drift hold. Port as a diff, never a copy over a file main has moved. Here that is trivial: the file does not exist on `main`, and it imports nothing, so no shared module needs a diff-merge.
