---
bornAs: xj0bx08
kind: story
size: 3
parent: "3443"
status: resolved
blockedBy: ["3901"]
scope: ["we:scripts/operations/docket-refresh.mjs", "we:scripts/operations/docket-refresh-io.mjs", "we:scripts/operations/__tests__/docket-refresh.test.mjs", "we:scripts/operations/run.mjs", "we:scripts/operations/__tests__/http-adapter.test.mjs"]
dateOpened: "2026-09-21"
dateStarted: "2026-09-25"
dateResolved: "2026-09-25"
tags: []
---

# Graduate we:scripts/operations/docket-refresh.mjs and we:scripts/operations/docket-refresh-io.mjs (new modules) from lane/mechanical-dispatcher to main

Ports #3723's docket-on-completion operation: we:scripts/operations/docket-refresh.mjs (260 lines, pure: read/plan/apply, content hash, publish-owed hand-off) and we:scripts/operations/docket-refresh-io.mjs (151, the reader/sink -- fetches origin main, refuses a primary or non-origin/main checkout, runs the checkout's own we:scripts/gen-decision-docket.mjs generator, hashes and writes a publish-owed record only on a changed hash), with we:scripts/operations/__tests__/docket-refresh.test.mjs (276 lines, 16 tests on real git). No known overlap with other graduation slices. Two real generator defects the build found and fixed travel with it: an absolute --out written inside the checkout, and check-readiness's own git fetch moving origin/main mid-run. Not wired to any trigger yet -- #3720's Stop hook is the intended future caller, a separate slice.

## Done when

1. **Executable** — `npx vitest run we:scripts/operations/__tests__/docket-refresh.test.mjs` passes ON `main` after the port, 16/16, and `git diff origin/main...origin/lane/mechanical-dispatcher -- we:scripts/operations/docket-refresh.mjs we:scripts/operations/docket-refresh-io.mjs we:scripts/operations/__tests__/docket-refresh.test.mjs` reports nothing. `we:scripts/operations/run.mjs` and `we:scripts/operations/__tests__/http-adapter.test.mjs` get only the `docket-refresh` registration/read-only-pin hunk — both files carry other, unrelated branch-only operations too, and none of those hunks belong to this slice.
2. `npm run check:standards` reports 0 errors.
3. Landed as its own PR through the normal lane → `we:scripts/verify-lane.mjs` → `we:scripts/operations/run.mjs open-pr --mode=land` pipeline, never a direct push.

## Order and port notes

- Standalone graduation slice under #3443, no blockers found: `we:scripts/gen-decision-docket.mjs` (the only real dependency beyond generic fs/git helpers) is already on `main`, and its `join(ROOT, --out/--data)` → `resolve(...)` fix — the one defect this operation depends on there — is already present on `main` (confirmed; `main` needs no port for it).
- Not wired to a trigger: nothing on the branch calls `docket-refresh` automatically. #3720's `Stop` hook (a separate slice) is the intended future caller; until then it runs by hand or from a tick, e.g. `WE_COORDINATION_ROOT=<root> node we:scripts/operations/run.mjs docket-refresh --checkout=<lane at origin/main> --apply`.
- Publish is a hand-off record only (a `publish-owed` record naming #3277 as `publishVia`, unbuilt) — no new publish path invented, and no lane or session is spent by the refresh itself.
- Two real generator defects the #3723 build found and fixed travel with this port: an older generator wrote an absolute `--out` INSIDE the checkout (fixed by passing checkout-relative paths); an older generator's `check-readiness` ran its own `git fetch`, moving `origin/main` past the checked `HEAD` mid-run (fixed by passing the checked sha as `--ref` and excluding `generatedFromRef` from the content hash). Both are covered by named tests in `we:scripts/operations/__tests__/docket-refresh.test.mjs`.

## Step 0 re-plan (2026-09-22)

Added blocker 3901: `we:scripts/operations/docket-refresh-io.mjs` imports `we:scripts/operations/coordination-root.mjs`, which is in that slice.
