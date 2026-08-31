/**
 * @file dispatch-abort.test.mjs — the stop-then-close-out composition and the trust-grant, both mechanized
 *   from #3383's 2026-08-31 live-fire session (see `../dispatch-abort.mjs`'s own header for the incident).
 *
 * WHAT THIS FILE COVERS:
 *   - `stopSession` shells `claude stop <id>`, never `kill` — the exact primitive whose absence let a stopped
 *     agent come back under a new pid and double-dispatch onto a lane.
 *   - `trustCheckout` grants trust through the SAME `withTrustedDirs` primitive the bootstrap step uses, is a
 *     no-op when already trusted, and never touches an unreadable config.
 *   - `abortDispatch` stops the handle FIRST when (and only when) it is still listed live, then closes the run
 *     out — so `wake.mjs`'s own `assertHandleNotLive` passes without `--force`; and it never calls `claude
 *     stop` on a handle that already isn't listed.
 *   - the lane hint names the lane from the effect's own payload, and says nothing when there wasn't one.
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

import { advanceWhileRunning, runStatus, startRun } from '../engine.mjs';
import { applyPendingEffects } from '../effect-executor.mjs';
import { createFileRunStore } from '../run-store.mjs';
import { createRegistry } from '../registry.mjs';
import { DISPATCH_LANE_OP, dispatchLaneOperation } from '../dispatch-lane.mjs';
import { createDispatchSinks } from '../dispatch-lane-io.mjs';
import { abortDispatch, stopSession, trustCheckout } from '../dispatch-abort.mjs';

const RUN_ID = 'run-dispatch-abort';
const KEY = `${RUN_ID}#2#0`;
const HANDLE = 'aaaaaaaa-1111-2222-3333-444444444444';
const PRIMARY = '/primary/webeverything';
const BRIEF = 'build #{{ITEM_NUM}} at {{ITEM_SPEC_PATH}} in lane {{LANE}} as {{SESSION_SLUG}} scoped {{SCOPE}}';

let dir;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'we-dispatch-abort-runs-')); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

/** Park a real in-flight dispatch on disk, its handle minted, its lane recorded on the effect payload. */
async function parkOneDispatch() {
  const registry = createRegistry();
  registry.register(dispatchLaneOperation({
    readTick: () => ({
      resolvedNum: '3412',
      launch: { num: '3412', lane: 5 },
      suppressed: null,
      item: { num: '3412', slug: 'example', specPath: 'backlog/3412-example.md', scope: ['we:scripts/x.mjs'] },
      briefTemplate: BRIEF,
      nextState: { tick: 1, buildGuards: [{ num: '3412', lane: 5, spawnedTick: 0 }] },
      statusLine: 'conveyor · 1 building',
      notes: [],
      bookkeepingSource: 'file',
      observedAt: new Date().toISOString(),
    }),
  }));
  const store = createFileRunStore(dir);
  let run = advanceWhileRunning(startRun({ op: DISPATCH_LANE_OP, id: RUN_ID, input: { num: '3412' }, registry }), { registry });
  expect(runStatus(run, { registry })).toBe('awaiting-effect');
  const sinks = createDispatchSinks({ root: PRIMARY, spawnAgent: () => '', mintSessionId: () => HANDLE });
  run = (await applyPendingEffects(run, { sinks, store })).run;
  expect(run.effects[0].status).toBe('in-flight');
  return { store };
}

describe('stopSession', () => {
  it('shells `claude stop <id>`, never `kill`', () => {
    const exec = vi.fn(() => 'stopped aaaaaaaa');
    const res = stopSession({ handle: HANDLE, exec });
    expect(exec).toHaveBeenCalledWith('claude', ['stop', HANDLE], expect.objectContaining({ encoding: 'utf8' }));
    expect(res).toEqual({ stopped: true, output: 'stopped aaaaaaaa' });
  });

  it('refuses with no handle', () => {
    expect(() => stopSession({ exec: vi.fn() })).toThrow(/needs a handle/);
  });

  it('surfaces a failed `claude stop` rather than swallowing it', () => {
    const exec = vi.fn(() => { throw new Error('exit 1: no such session'); });
    expect(() => stopSession({ handle: HANDLE, exec })).toThrow(/claude stop .* failed/);
  });
});

describe('trustCheckout', () => {
  it('grants trust via withTrustedDirs when the dir is not yet trusted', () => {
    const writeConfig = vi.fn();
    const line = trustCheckout({
      dir: '/scratch/wev-2',
      readConfig: () => ({ projects: {} }),
      writeConfig,
    });
    expect(line).toMatch(/trusted \/scratch\/wev-2/);
    expect(writeConfig).toHaveBeenCalledWith({
      projects: { '/scratch/wev-2': { hasTrustDialogAccepted: true } },
    });
  });

  it('is a no-op when already trusted', () => {
    const writeConfig = vi.fn();
    const line = trustCheckout({
      dir: '/scratch/wev-2',
      readConfig: () => ({ projects: { '/scratch/wev-2': { hasTrustDialogAccepted: true } } }),
      writeConfig,
    });
    expect(line).toMatch(/already trusted/);
    expect(writeConfig).not.toHaveBeenCalled();
  });

  it('refuses to guess when the config cannot be read', () => {
    const writeConfig = vi.fn();
    const line = trustCheckout({ dir: '/scratch/wev-2', readConfig: () => null, writeConfig });
    expect(line).toMatch(/could not read/);
    expect(writeConfig).not.toHaveBeenCalled();
  });
});

describe('abortDispatch', () => {
  it('stops the handle FIRST, then closes out — no --force needed because the listing already agrees', async () => {
    const { store } = await parkOneDispatch();
    const exec = vi.fn(() => 'stopped');
    // First read (inside abortDispatch's own live check): still listed. Second read (inside closeOutEntry's
    // assertHandleNotLive, called AFTER the stop): gone. This is the exact ordering the composition exists for.
    const listAgents = vi.fn()
      .mockReturnValueOnce([{ sessionId: HANDLE, name: 'prepare-3412' }])
      .mockReturnValueOnce([]);

    const line = abortDispatch({ runId: RUN_ID, key: KEY, store, listAgents, exec });

    expect(exec).toHaveBeenCalledWith('claude', ['stop', HANDLE], expect.anything());
    expect(line).toMatch(new RegExp(`stopped ${HANDLE}`));
    expect(line).toMatch(/closed out as `failed`/);
    expect(line).toMatch(/Lane 5 may still be leased/);

    const after = store.read(RUN_ID);
    expect(after.effects[0].status).toBe('failed');
  });

  it('never calls `claude stop` when the handle is already gone from the listing', async () => {
    const { store } = await parkOneDispatch();
    const exec = vi.fn();
    const listAgents = vi.fn(() => []); // gone on every read

    const line = abortDispatch({ runId: RUN_ID, key: KEY, store, listAgents, exec });

    expect(exec).not.toHaveBeenCalled();
    expect(line).toMatch(/was not listed live — nothing to stop/);
    expect(line).toMatch(/closed out as `failed`/);
  });

  it('propagates assertHandleNotLive\'s refusal when the stop did not actually take (still listed after)', async () => {
    const { store } = await parkOneDispatch();
    const exec = vi.fn(() => 'stopped');
    // Both reads say still listed — the stop call happened but, per this test, did not actually clear the
    // listing. closeOutEntry must still refuse rather than close out a possibly-live agent.
    const listAgents = vi.fn(() => [{ sessionId: HANDLE, name: 'prepare-3412' }]);

    expect(() => abortDispatch({ runId: RUN_ID, key: KEY, store, listAgents, exec }))
      .toThrow(/STILL LISTED/);
    expect(exec).toHaveBeenCalledTimes(1); // the stop was attempted exactly once, not retried in a loop
  });

  it('reports no lane hint when the dispatch never had one', async () => {
    const { store } = await parkOneDispatch();
    const run = store.read(RUN_ID);
    // Strip the lane the way a non-build launch kind's payload might lack one.
    run.effects[0].payload = { ...run.effects[0].payload, lane: undefined };
    store.write(run);
    const listAgents = vi.fn(() => []);

    const line = abortDispatch({ runId: RUN_ID, key: KEY, store, listAgents, exec: vi.fn() });
    expect(line).not.toMatch(/Lane/);
  });

  it('refuses with no runId/key, same message shape as wake.mjs', () => {
    expect(() => abortDispatch({ store: createFileRunStore(dir) })).toThrow(/needs both runId and key/);
  });
});
