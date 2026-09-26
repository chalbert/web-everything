/**
 * @file dispatch-lane-build-wiring.test.mjs — ported from prototype snapshot `6a2c8c1ab`
 *   (`origin/lane/mechanical-dispatcher`), SCOPED to this port's own subject: the `pid:<n>` detached-handle
 *   LIVENESS reading, not the rest of that snapshot's `dispatch-lane-io.mjs` diff.
 *
 * WHAT THIS FILE PROVES. Main already runs the `build` mechanical provider
 * (`./dispatch-providers/build.mjs`, wired and tested elsewhere — see `./dispatch-provider-registry.test.mjs`,
 * `./dispatch-lane-routing-record.test.mjs`) and already exports the detached-handle primitives from
 * `./detached-dispatch.mjs`. What main did NOT have until this port is a liveness reader that asks the KERNEL
 * for a `pid:<n>` handle instead of `claude agents --json`, which never heard of a detached delivery wrapper and
 * would read it as gone while it is an hour into a build — the double-dispatch risk this port closes.
 *
 * DROPPED FROM THE PROTOTYPE FILE, and why (each is behaviour owned by an earlier main card, not this port):
 *   - the whole "`build` dispatch is MECHANICAL by default" describe block (routing/mode-knob/spawn-shape
 *     assertions) — main's mechanical `build` provider, its mode knob and `routeDispatchProvider` predate this
 *     port entirely (#3645/#3906, already landed and covered by `./dispatch-provider-registry.test.mjs` and
 *     `./dispatch-lane-routing-record.test.mjs`);
 *   - `deliver-item-run.mjs` CLI parsing/provider-selection assertions — `deliver-item-run.mjs` is owned by the
 *     concurrent `deliver-item-*`/`open-pr.mjs` lane per this port's own instructions and untouched here;
 *   - "spawns DETACHED, unref'd..." / "the DEFAULT detached spawner really passes..." — these assert
 *     `defaultSpawnDetached`'s own options, which is `./detached-dispatch.mjs`'s subject and already shipped;
 *   - "`defaultIsPidAlive` answers truthfully..." — asserts `detached-dispatch.mjs#defaultIsPidAlive` itself,
 *     which this port consumes but does not introduce;
 *   - "the handle prefix is one no `claude --bg` handle can collide with" — asserts `DETACHED_HANDLE_PREFIX`/
 *     `detachedHandlePid`, already shipped in `./detached-dispatch.mjs`.
 *
 * ADAPTED for main's design (main differs from the prototype on both axes below):
 *   - every registry row defaults to `agent` on main (`agent` unless `WE_BUILD_DISPATCH_MODE=mechanical`),
 *     where the prototype defaulted `build` to `mechanical` — irrelevant here since no case below dispatches
 *     through the registry at all; every case calls `stampLiveness`/`createDispatchObservers`/
 *     `isDispatchHandleLive` directly;
 *   - `isHandleListed` here is main's OWN pre-existing exact-match-against-`listedSessionIds` logic (which
 *     already covers both `sessionId` and `id`, #3331), extracted into a named export rather than the
 *     prototype's older prefix-match version — see `../dispatch-lane-io.mjs#isHandleListed`'s own docblock.
 *
 * ADDED beyond the prototype's own cases, per this port's brief: the mixed-set case below now also asserts the
 * short-id row is answered by the LISTING specifically (not just that the pid row is answered by the pid probe).
 */

import { describe, it, expect } from 'vitest';

import {
  detachedHandlePid,
  deliveryDispatchLogPath,
  defaultIsPidAlive,
} from '../detached-dispatch.mjs';
import {
  createDispatchObservers,
  isDispatchHandleLive,
  isHandleListed,
  stampLiveness,
} from '../dispatch-lane-io.mjs';
import { DISPATCH_EFFECT, LIVENESS_SOURCES } from '../dispatch-lane.mjs';

describe('#4212 — pid:<n> detached-handle liveness', () => {
  it('liveness for a detached delivery is answered by the KERNEL, not by a `claude agents` listing', () => {
    expect(detachedHandlePid('pid:4242')).toBe(4242);
    expect(detachedHandlePid('1ae0905c')).toBeNull();
    expect(detachedHandlePid('pid:0')).toBeNull();

    // A running wrapper reads LIVE even though `claude agents` has never heard of it — the whole point.
    expect(isDispatchHandleLive('pid:4242', [], { isPidAlive: (p) => p === 4242 })).toBe(true);
    expect(isDispatchHandleLive('pid:4242', [{ sessionId: 'pid:4242' }], { isPidAlive: () => false })).toBe(false);
    // A `claude --bg` handle is still answered by the listing, unaffected by the pid probe existing at all.
    expect(isDispatchHandleLive('1ae0905c', [{ sessionId: '1ae0905c' }], {
      isPidAlive: () => { throw new Error('a claude handle must never reach the pid probe'); },
    })).toBe(true);
  });

  it('`isHandleListed` is the one comparison both the guard read and the observer now share', () => {
    expect(isHandleListed('1ae0905c', [{ sessionId: '1ae0905c' }])).toBe(true);
    expect(isHandleListed('1ae0905c', [{ id: '1ae0905c' }])).toBe(true);
    expect(isHandleListed('1ae0905c', [{ sessionId: 'deadbeef' }])).toBe(false);
    expect(isHandleListed('', [{ sessionId: '' }])).toBe(false);
  });

  it('stampLiveness: an ALL-PID in-flight set answers `wrapper-pid` without ever calling `listAgents`', () => {
    const stamped = stampLiveness(
      { runs: [{ runId: 'r1', handle: 'pid:4242', startedAt: '2026-09-12T10:00:00Z' }], unreadable: 0 },
      {
        listAgents: () => { throw new Error('`claude agents` must not be shelled for an all-pid in-flight set'); },
        isPidAlive: () => true,
      },
    );
    expect(stamped.runs[0].live).toBe(true);
    expect(stamped.livenessSource).toBe('wrapper-pid');
    // A restarted runner reads this the same way — no dependency on the process that dispatched it.
    expect(LIVENESS_SOURCES).toContain('wrapper-pid');
  });

  it('stampLiveness: a MIXED set answers a pid row from the kernel and a short-id row from the listing', () => {
    const stamped = stampLiveness(
      {
        runs: [
          { runId: 'r1', handle: 'pid:4242' },
          { runId: 'r2', handle: '1ae0905c' },
        ],
        unreadable: 0,
      },
      {
        listAgents: () => [{ sessionId: '1ae0905c' }],
        isPidAlive: () => false,
      },
    );
    expect(stamped.runs.map((r) => r.live)).toEqual([false, true]);
    expect(stamped.livenessSource).toBe('claude-agents');
  });

  it('observer: a live detached delivery reports `running` without shelling `claude`', async () => {
    const observers = createDispatchObservers({
      listAgents: () => { throw new Error('the observer must not shell `claude` for a pid handle'); },
      listPrs: () => [],
      isPidAlive: () => true,
    });
    const entry = {
      handle: 'pid:4242',
      startedAt: new Date().toISOString(),
      payload: { num: '3645', sessionSlug: 'conveyor-3645' },
    };
    await expect(observers[DISPATCH_EFFECT](entry, { handle: 'pid:4242' }))
      .resolves.toEqual({ status: 'running', result: null });
  });

  it('observer: a detached delivery DEAD past the listing grace is `unresolved`, naming its log — never `succeeded`', async () => {
    const observers = createDispatchObservers({
      listAgents: () => { throw new Error('the observer must not shell `claude` for a pid handle'); },
      listPrs: () => [],
      isPidAlive: () => false,
      now: () => new Date('2026-09-12T12:00:00Z'),
    });
    const entry = {
      handle: 'pid:4242',
      startedAt: '2026-09-12T10:00:00Z',
      payload: { num: '3645', sessionSlug: 'conveyor-3645' },
    };
    const out = await observers[DISPATCH_EFFECT](entry, { handle: 'pid:4242' });
    expect(out.status).toBe('unresolved');
    expect(out.error).toContain(deliveryDispatchLogPath('conveyor-3645'));
  });

  it('observer: a detached delivery still within the listing grace reads `running`, not `unresolved`', async () => {
    const observers = createDispatchObservers({
      listAgents: () => { throw new Error('the observer must not shell `claude` for a pid handle'); },
      listPrs: () => [],
      isPidAlive: () => false,
      now: () => new Date('2026-09-12T10:00:30Z'),
    });
    const entry = {
      handle: 'pid:4242',
      startedAt: '2026-09-12T10:00:00Z',
      payload: { num: '3645', sessionSlug: 'conveyor-3645' },
    };
    await expect(observers[DISPATCH_EFFECT](entry, { handle: 'pid:4242' }))
      .resolves.toEqual({ status: 'running', result: null });
  });

  it('`defaultIsPidAlive` is the default probe every reader here falls back to when none is injected', () => {
    expect(defaultIsPidAlive(process.pid)).toBe(true);
    expect(defaultIsPidAlive(2 ** 30)).toBe(false);
    // No `isPidAlive` override: `isDispatchHandleLive` still answers correctly for THIS real process's pid.
    expect(isDispatchHandleLive(`pid:${process.pid}`, [])).toBe(true);
  });
});
