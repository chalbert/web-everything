---
bornAs: x90765m
kind: story
size: 3
parent: "3443"
status: open
scope: ["we:scripts/operations/ci-heal-pr-dispatch.mjs", "we:scripts/operations/__tests__/ci-heal-pr-dispatch.test.mjs"]
dateOpened: "2026-09-21"
tags: []
---

# Graduate we:scripts/operations/ci-heal-pr-dispatch.mjs (new module) from lane/mechanical-dispatcher to main

Graduation slice 4 of 6 for the land-advance operation. we:scripts/operations/ci-heal-pr-dispatch.mjs (41 lines) is missing from main. It dispatches one ci-heal for a PR carrying ci:failed, from land-advance's dispatch-ci-heal row. Its only imports are dispatch-lane and dispatch-lane-io; both are on main with a different body and every named import is exported there. The branch has no test of its own for it (the repair-io test travels with the last slice), so ship a small unit test. Independent of the other five slices.

## Done when

1. **Executable** — `npx vitest run we:scripts/operations/__tests__/ci-heal-pr-dispatch.test.mjs` passes ON `main` after the port (the test is new and small: it drives `dispatchCiHeal` through its injected `readBrief` and `sinks` options: the filled brief carries the PR, lane and scope tokens, a second call for the same PR comes back `held`, and no `review:*` label is touched; the branch's own coverage of it sits in the IO slice's repair-io test), and `git diff origin/main...origin/lane/mechanical-dispatcher -- we:scripts/operations/ci-heal-pr-dispatch.mjs` reports nothing.
2. `npm run check:standards` reports 0 errors.
3. Landed as its own PR through the normal lane → `we:scripts/verify-lane.mjs` → `we:scripts/operations/run.mjs open-pr --mode=land` pipeline, never a direct push.

## Order and port notes

- Part of the six-slice land-advance graduation under #3443. No blockers: independent of the other five, so it can run in parallel with the tools (2), watchdog (1), core (5) and session-verdicts (3) slices. The IO and wiring slice (6) needs it. Order across the six: tools (2) → land-advance core (5) → session-verdicts (3); watchdog (1) and this slice (4) independent; IO and wiring (6) last.
- Under the #3804 statute (`we:docs/agent/platform-decisions.md#poc-branch-mechanical-sync`) a graduation slice ports a file main has moved AS A DIFF and is exempt from the drift hold. Shared modules that exist on `main` with a different body and that this slice imports from: `we:scripts/operations/dispatch-lane.mjs` (five named imports) and `we:scripts/operations/dispatch-lane-io.mjs` (three named imports), all exported on `main` (checked name by name). Do NOT overwrite either with the branch copy. Read the branch module's calls against `main`'s current signatures, not the branch's; if one has changed shape, adapt the new module, and diff-merge a hunk into the shared file only if there is no other way.
