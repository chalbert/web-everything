---
bornAs: xpc3krl
kind: story
size: 5
parent: "4075"
status: resolved
scope: ["we:scripts/lib/__tests__/main-staleness.test.mjs", "we:scripts/operations/__tests__/review-dispatch.test.mjs", "we:scripts/conveyor/__tests__/reconcile-fix-dispatch.test.mjs", "we:scripts/lib/__tests__/daemon-self-sync.test.mjs", "we:scripts/operations/__tests__/route-pr-outcome-io-live.test.mjs", "we:scripts/operations/review-dispatch.mjs", "we:scripts/conveyor/reconcile-fix-dispatch.mjs", "we:scripts/lib/main-staleness.mjs", "we:vitest.setup.ts", "we:vitest.config.ts", "we:vitest.integration.config.ts", "we:vitest.soak.config.ts"]
dateOpened: "2026-09-25"
dateResolved: "2026-09-25"
tags: []
---

# Make host-state-leaking tests hermetic (home settings file, gh auth, daemon state, git config)

ci-heal-2684 found 12 of 13 local vitest failures reproduce on origin/main with NO PR in a lane on this Mac, while CI on main stays green. Root cause: the tests (and in places the source under test) read real host state instead of being hermetic -- the real we:.claude/settings.json (today's weekend WE_HEAVY_ADMISSION_CAP=3 trial + other keys), real gh auth, real we:scripts/lib/daemon-self-sync.mjs state, and host git config. Affected: we:scripts/lib/__tests__/main-staleness.test.mjs, we:scripts/operations/__tests__/review-dispatch.test.mjs, we:scripts/conveyor/__tests__/reconcile-fix-dispatch.test.mjs, we:scripts/lib/__tests__/daemon-self-sync.test.mjs, we:scripts/operations/__tests__/route-pr-outcome-io-live.test.mjs. Fix: point each test at a temp HOME/settings path or a fake gh on PATH; where the SOURCE wrongly defaults to reading the real we:.claude by default (e.g. resolveSettings in we:scripts/operations/review-dispatch.mjs / we:scripts/conveyor/reconcile-fix-dispatch.mjs), fix the source seam to accept an injected settings path/object; consider a we:vitest.setup.ts guard that fails any test touching real host state under we:.claude. Proof required: each test red on this host before, green after, at most 2 files per vitest command; and green again with HOME pointed at a temp dir (simulating CI).

## Done when

1. **Executable** — `WE_DAEMON_MANAGED_CLONE=1 npx vitest run we:scripts/lib/__tests__/main-staleness.test.mjs we:scripts/operations/__tests__/review-dispatch.test.mjs we:scripts/lib/__tests__/daemon-self-sync.test.mjs` fails before this item lands (ambient `WE_DAEMON_MANAGED_CLONE=1` flips assertMainNotStale's managed-clone branch even for tests that never set it) and passes after (we:vitest.setup.ts now sanitizes it once, before the run's first test).
2. **Executable** — `WE_GITHUB_APP_ID=1 WE_GITHUB_APP_INSTALLATION_ID=1 WE_GITHUB_APP_PRIVATE_KEY_PATH=/tmp/fake-key.pem npx vitest run we:scripts/conveyor/__tests__/reconcile-fix-dispatch.test.mjs we:scripts/operations/__tests__/review-dispatch.test.mjs` fails before (the "REAL default resolveSettingsEnv"/"spawns exactly once" tests assume an unconfigured host) and passes after.
3. **Executable** — `PATH="$HOME/.claude/github-app-token/gh-shim:$PATH" npx vitest run we:scripts/operations/__tests__/route-pr-outcome-io-live.test.mjs` fails before (the shim on PATH answers from its own cached token, masking the "real unauthenticated gh" case this test proves) and passes after (resolveRealGhBinary skips the shim).
4. All five files above also pass with HOME pointed at a fresh temp dir (simulating CI).

Not reproduced independently on this host: we:scripts/lib/__tests__/daemon-self-sync.test.mjs's "a skipped tick is an empty tick every real daemon onTick can log" test. Read both onTick implementations (we:skills-src/conveyor/review-daemon.mjs, we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs) end to end -- neither throws on skippedTick's shape regardless of the ambient-env conditions above, alone or combined. Likely a full-suite-only artifact (worker-thread module-cache cross-file state); the sanitization above removes its most likely shared cause. Flagged, not silently dropped.

## Operator-approved extension: sandbox by default + CI-identical local gate

we:vitest.setup.ts now sandboxes every default-config test BEFORE anything reads process.env: a fake `gh` ahead of everything else on PATH (fails like a real unauthenticated gh), plus every ambient WE_*/CONVEYOR_*/GH_*/CLAUDE_* env var stripped (one allowlisted key: WE_TELEMETRY, an operator's own explicit local opt-in). we:scripts/verify-lane.mjs needed no separate change: it already shells straight into `npm run test:unit`/vitest, which loads this same we:vitest.setup.ts, so the local gate is now sandboxed identically to CI with zero extra wiring.

Tried and DROPPED, both live-caught: (1) a throwaway $HOME redirect -- broke we:scripts/conveyor/__tests__/lane-pool-health-watch.test.mjs because `os.homedir()`'s native binding does not consult a vitest worker thread's own process.env (only a spawned child's inherited env does; confirmed with a minimal worker_threads repro) -- a real HOME sandbox needs the forks pool or a per-call-site change, never a setup-file patch. (2) A general "fails a test for touching real ~/.claude" fs guard -- mutating node:fs's exported functions from a setup file does not intercept a test file's own `import { writeFileSync } from 'node:fs'` named-import calls (confirmed the same way), this codebase's dominant fs import style. Both notes are for the separate detection-checks follow-up card so it does not re-reach for either.

we:scripts/operations/__tests__/route-pr-outcome-io-live.test.mjs moved to we:vitest.integration.config.ts (matching the existing real-subprocess tier for we:scripts/operations/__tests__/dispatch-spawn-live.test.mjs) since the new fake-gh-on-PATH would otherwise mask its whole point (a real, unauthenticated gh failure). we:vitest.integration.config.ts and we:vitest.soak.config.ts both opt out of the sandbox via `env: { WE_TEST_SANDBOX: '0' }`.

Proof: the 5 originally-fixed files stay green plain and under simulated ambient pollution; we:scripts/lib/__tests__/gh-throttle.fidelity.test.mjs now self-skips cleanly via its own documented contract instead of running for real against this operator's personal gh auth (matching CI, which has no gh auth either); we:scripts/operations/__tests__/route-pr-outcome-io-live.test.mjs still passes for real under the integration config; a ~15-file diverse sample across the default suite stayed green, including the one regression the dropped $HOME attempt caused (now reverted).
