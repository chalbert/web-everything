/**
 * @file dispatch-run-id-effect-key.test.mjs — #4349. `createDispatchSinks`'s `[DISPATCH_EFFECT]` sink already
 * documented `async (payload, ctx) => result` on its own `@returns` (`dispatch-lane-io.mjs`), but never actually
 * accepted the second parameter — so `effect-executor.mjs#applyPendingEffects`'s own `{key, runId, ...}` ctx
 * (real for every effect it calls) was silently discarded for the ONE effect type (`build`) whose provider is a
 * mechanical wrapper that needs to settle itself later, rather than an agent brief that never will.
 *
 * Two halves, tested together because they are one contract: the sink forwards `ctx.runId`/`ctx.key` onto the
 * `request` it hands its `provider`, and `deliverItemDetachedProvider` (the `build` provider,
 * `dispatch-providers/build.mjs`) turns those two request fields into `--run-id=`/`--effect-key=` argv — the
 * SAME two flags `deliver-item-run.mjs#parseDeliverItemRunArgv` parses back out on the other end.
 */
import { describe, it, expect } from 'vitest';
import { DISPATCH_EFFECT } from '../dispatch-lane.mjs';
import { createDispatchSinks } from '../dispatch-lane-io.mjs';
import { deliverItemDetachedProvider } from '../dispatch-providers/build.mjs';

describe('createDispatchSinks — forwards ctx.runId/ctx.key onto the request (#4349)', () => {
  it('a provider sees request.runId/request.effectKey when the executor supplies a ctx', async () => {
    let seen;
    const sinks = createDispatchSinks({
      root: '/primary/webeverything',
      provider: (request) => { seen = request; return 'handle-1'; },
      mintSessionId: () => 'sess-run-id-1',
    });
    await sinks[DISPATCH_EFFECT](
      { num: '9001', sessionSlug: 'conveyor-9001', prompt: '# go', launchKind: 'build' },
      { key: 'dispatch:0:0', runId: 'dispatch-lane-abc123' },
    );
    expect(seen.runId).toBe('dispatch-lane-abc123');
    expect(seen.effectKey).toBe('dispatch:0:0');
  });

  it('a sink call with no ctx (every OLDER caller/test) forwards undefined, never a guess', async () => {
    let seen;
    const sinks = createDispatchSinks({
      root: '/primary/webeverything',
      provider: (request) => { seen = request; return 'handle-1'; },
      mintSessionId: () => 'sess-run-id-2',
    });
    await sinks[DISPATCH_EFFECT]({ num: '9001', sessionSlug: 'conveyor-9001', prompt: '# go', launchKind: 'build' });
    expect(seen.runId).toBeUndefined();
    expect(seen.effectKey).toBeUndefined();
  });
});

describe('deliverItemDetachedProvider — turns request.runId/effectKey into --run-id=/--effect-key= argv (#4349)', () => {
  function fakeSpawnDetached() {
    const calls = [];
    const spawnDetached = (argv, opts) => { calls.push({ argv, opts }); return { pid: 4242 }; };
    return { spawnDetached, calls };
  }

  it('adds both flags when the request carries them', () => {
    const { spawnDetached, calls } = fakeSpawnDetached();
    deliverItemDetachedProvider(
      { num: '1234', lane: '3', sessionSlug: 'conveyor-1234', runId: 'dispatch-lane-abc123', effectKey: 'dispatch:0:0' },
      { spawnDetached, logPathFor: () => '/x/log', readDeliveryAgentMarker: () => null },
    );
    expect(calls[0].argv).toEqual(expect.arrayContaining([
      '--run-id=dispatch-lane-abc123', '--effect-key=dispatch:0:0',
    ]));
  });

  it('omits both flags (never a blank `--run-id=`) when the request carries neither', () => {
    const { spawnDetached, calls } = fakeSpawnDetached();
    deliverItemDetachedProvider(
      { num: '1234', lane: '3', sessionSlug: 'conveyor-1234' },
      { spawnDetached, logPathFor: () => '/x/log', readDeliveryAgentMarker: () => null },
    );
    expect(calls[0].argv.some((a) => a.startsWith('--run-id='))).toBe(false);
    expect(calls[0].argv.some((a) => a.startsWith('--effect-key='))).toBe(false);
  });
});
