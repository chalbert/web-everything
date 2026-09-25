import { beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// #3383: isolate tests from home AND from each other's durable action holds.
const ownsCoordinationRoot = process.env.WE_COORDINATION_ROOT === undefined;
let testCoordinationRoot: string | undefined;
if (ownsCoordinationRoot) process.env.WE_COORDINATION_ROOT = mkdtempSync(join(tmpdir(), 'we-coord-test-'));
beforeEach(() => {
  if (ownsCoordinationRoot) {
    testCoordinationRoot = mkdtempSync(join(tmpdir(), 'we-coord-test-'));
    process.env.WE_COORDINATION_ROOT = testCoordinationRoot;
  }
});
afterEach(() => {
  if (testCoordinationRoot) rmSync(testCoordinationRoot, { recursive: true, force: true });
});

// #3383 bugfix: default the delivery-telemetry recorder OFF for the whole unit/integration test run, so
// wrapper tests (`deliver-item-wrapper.test.mjs` and siblings, plus the real-subprocess integration suite)
// that exercise the real dispatch wrappers through `createTelemetryRecorder()`/`recorderFor()` — with
// nothing forcing an in-memory or disabled store — don't append fixture spans to the shared, file-backed
// `.operations/telemetry/*.jsonl` log. Confirmed on disk before this fix: sub-10ms durations and fixture
// item ids (9999/1234/…) made up the large majority of a day's file, drowning out real dispatch data.
//
// `WE_TELEMETRY=0` makes `createTelemetryRecorder` hand back the no-op null recorder (see
// `scripts/operations/telemetry-store.mjs#telemetryEnabled`/`createNullRecorder`) with the EXACT same
// call-site shape as the real one, so nothing about a test's control flow changes.
//
// Wired here — a global Vitest `setupFiles` entry both `vitest.config.ts` (the ~2000-file unit suite) and
// `vitest.integration.config.ts` (the real-subprocess tier, whose spawned `node`/CLI children inherit this
// process's env unless a call site overrides it) load — rather than in each test file, because that
// per-file-opt-in shape is exactly how this regressed silently before: nothing forced it, so it quietly
// didn't happen.
//
// A test that means to exercise the REAL recorder passes `enabled: true` explicitly (see
// `scripts/operations/__tests__/telemetry-wiring.test.mjs` and `telemetry.test.mjs`), which bypasses the
// env check entirely (`createTelemetryRecorder`'s `enabled` param wins over `telemetryEnabled()`) — so this
// default can never block a real telemetry test, only an incidental one.
//
// Respects an operator's own explicit `WE_TELEMETRY` (e.g. `WE_TELEMETRY=1 npm run test:unit` to deliberately
// watch real wrapper tests emit telemetry) rather than clobbering it.
if (process.env.WE_TELEMETRY === undefined) {
  process.env.WE_TELEMETRY = '0';
}

// #xpc3krl (ci-heal-2684, 2026-09-25) — sanitize known daemon/host env leaks ONCE, before the per-test
// snapshot/restore below captures its baseline. That restore (PR #2625) only guards a write LEAKING from one
// test into a LATER one in the same run; it does nothing about the run's own STARTING point, which is
// whatever ambient env the launching process already had. A vitest run started from inside (or by) a live
// daemon-managed clone inherits `WE_DAEMON_MANAGED_CLONE=1` (set by
// `scripts/lib/daemon-self-sync.mjs#withSelfSync` at wrapper construction) or a host that has opted into
// GitHub App auth inherits the three `WE_GITHUB_APP_*` vars (see
// `scripts/lib/github-app-auth-env.mjs#resolveGithubAppEnvConfig`) as that baseline for EVERY test — and
// `main-staleness.mjs#assertMainNotStale` / `gh-app-shim.mjs#buildGhShimSettingsEnv` both read these directly,
// so a polluted baseline silently flips branches in tests that assume the unconfigured default and never set
// these vars themselves. Live-caught on this Mac: 6 tests across main-staleness.test.mjs,
// review-dispatch.test.mjs and reconcile-fix-dispatch.test.mjs failed with the real ambient values set, never
// in CI (which never carries them). A test that means to exercise the CONFIGURED path sets these itself,
// inside its own test body — that always wins, since it runs after this.
for (const key of [
  'WE_DAEMON_MANAGED_CLONE', 'WE_GITHUB_APP_ID', 'WE_GITHUB_APP_INSTALLATION_ID', 'WE_GITHUB_APP_PRIVATE_KEY_PATH',
]) {
  delete process.env[key];
}

// PR #2625 advisory (correctness/test-pollution): a test that writes `process.env` must never leak that write
// into LATER tests. Worker threads are reused across many files, so a leaked `WE_DAEMON_MANAGED_CLONE=1` (set
// on purpose by `daemon-self-sync.mjs#withSelfSync`, whose real children must inherit it) silently flipped
// `main-staleness.mjs#assertMainNotStale` into managed-clone mode in unrelated files, order-dependently.
// Snapshot before each test, restore after it: keys added are deleted, keys changed or deleted are put back.
// Env set at module load or in `beforeAll` is taken before the snapshot, so it is kept.
let envSnapshot: Record<string, string | undefined> | undefined;
beforeEach(() => {
  envSnapshot = { ...process.env };
});
afterEach(() => {
  if (!envSnapshot) return;
  for (const key of Object.keys(process.env)) {
    if (!(key in envSnapshot)) delete process.env[key];
  }
  for (const [key, value] of Object.entries(envSnapshot)) {
    if (process.env[key] !== value) process.env[key] = value;
  }
  envSnapshot = undefined;
});
