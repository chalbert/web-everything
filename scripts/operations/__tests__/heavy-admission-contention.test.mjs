/**
 * @file scripts/operations/__tests__/heavy-admission-contention.test.mjs
 * @description THE #3461 "fails pre-fix, passes after" regression test (mirroring `we:backlog/3449-*.md`'s own
 *   fails-pre-fix Done-when discipline). It reproduces heavy-command CONTENTION with the cap ABSENT and asserts
 *   the admission queue bounds it: spawn N concurrent invocations of a stubbed heavy command PAST the chosen
 *   cap and assert AT MOST `cap` ever run at once, with the rest observably queued (the waiting-intent markers
 *   this module writes) rather than started immediately.
 *
 *   FAILS BEFORE THIS ITEM LANDS: `scripts/readiness/heavy-admission.mjs` did not exist before #3461 — this
 *   test's own import throws `ERR_MODULE_NOT_FOUND`, a hard failure. AFTER #3461 the semaphore exists and this
 *   test proves it actually bounds concurrency end-to-end against a real lock root (real fs, real async
 *   interleaving — not a fake clock), which is exactly #3383's finding-4 contention failure mode: several
 *   dispatched lanes' heavy commands (`check:standards` / `test:unit` / `npm ci`-class work) racing the host's
 *   CPU/memory at once.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { acquireSlotBlocking, releaseOwnedSlot, listWaiting } from '../../readiness/heavy-admission.mjs';

let lockRoot;
beforeEach(() => { lockRoot = mkdtempSync(join(tmpdir(), 'heavy-admission-contention-')); });
afterEach(() => { rmSync(lockRoot, { recursive: true, force: true }); });

/** A stubbed heavy command: acquire a slot, hold it for `holdMs` (simulating check:standards/test:unit doing
 *  real work), release it. Records `{ owner, start, end }` into `timeline` so the test can reconstruct, at
 *  any instant, how many owners were concurrently INSIDE their held window. */
async function runStubbedHeavyCommand({ lockRoot, cap, owner, holdMs, timeline, concurrentCounter }) {
  const admission = await acquireSlotBlocking({ lockRoot, cap, owner, pollMs: 15, timeoutMs: 30_000 });
  expect(admission.ok).toBe(true); // this test's cap/timeout are sized so nobody times out — a timeout here is a test bug, not the behavior under test
  concurrentCounter.current += 1;
  concurrentCounter.max = Math.max(concurrentCounter.max, concurrentCounter.current);
  const start = Date.now();
  await new Promise((r) => setTimeout(r, holdMs));
  const end = Date.now();
  concurrentCounter.current -= 1;
  timeline.push({ owner, start, end });
  releaseOwnedSlot({ lockRoot, cap, owner });
}

describe('heavy-command admission queue — contention regression (#3461, fails pre-fix)', () => {
  it('bounds N=5 concurrent stubbed heavy-command invocations to at most cap=2 running at once', async () => {
    const cap = 2;
    const N = 5;
    const holdMs = 120;
    const timeline = [];
    const concurrentCounter = { current: 0, max: 0 };

    await Promise.all(
      Array.from({ length: N }, (_, i) =>
        runStubbedHeavyCommand({ lockRoot, cap, owner: `owner-${i}`, holdMs, timeline, concurrentCounter })),
    );

    // The core assertion: never more than `cap` were inside their held window at once, live-tracked via the
    // increment/decrement counter (not reconstructed after the fact from timestamps, which would be racy).
    expect(concurrentCounter.max).toBeLessThanOrEqual(cap);
    // And the semaphore actually did something — with 5 owners racing 120ms holds against a cap of 2, SOME
    // pair genuinely overlapped (proves this isn't accidentally serializing everything down to 1-at-a-time,
    // which would also satisfy "≤ cap" but would misrepresent the semaphore's actual value).
    expect(timeline).toHaveLength(N);
    const overlaps = timeline.some((a) =>
      timeline.some((b) => a !== b && a.start < b.end && b.start < a.end));
    expect(overlaps).toBe(true);
    // No lingering waiting markers or held slots after every owner released.
    expect(listWaiting(lockRoot)).toHaveLength(0);
  });

  it('the excess owners are OBSERVABLY queued while the cap is saturated (Done-when #1: "the rest observably queued")', async () => {
    const cap = 1;
    // Hold slot-0 for the whole assertion window via a real acquire (not a fake) so a second owner genuinely blocks.
    const holder = await acquireSlotBlocking({ lockRoot, cap, owner: 'HOLDER', pollMs: 15, timeoutMs: 5000 });
    expect(holder.ok).toBe(true);

    // A second owner starts waiting — this call won't resolve until HOLDER releases below.
    const waiterPromise = acquireSlotBlocking({ lockRoot, cap, owner: 'WAITER', lane: '3', pollMs: 15, timeoutMs: 5000 });

    // Give the waiter's first poll a moment to land and mark itself waiting.
    await new Promise((r) => setTimeout(r, 60));
    const waiting = listWaiting(lockRoot);
    expect(waiting).toHaveLength(1);
    expect(waiting[0]).toMatchObject({ owner: 'WAITER', lane: '3' });

    releaseOwnedSlot({ lockRoot, cap, owner: 'HOLDER' });
    const waiterResult = await waiterPromise;
    expect(waiterResult.ok).toBe(true);
    expect(listWaiting(lockRoot)).toHaveLength(0); // cleared the instant it won its slot
    releaseOwnedSlot({ lockRoot, cap, owner: 'WAITER' });
  });
});
