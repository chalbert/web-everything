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
