/**
 * @file scripts/__tests__/drain-push-at-close.test.mjs
 * @description Unit proof of push-at-close (#2395, under #2387) — fire ONE detached, self-terminating,
 *   lease-holding drain when a serial batch closes, and NO-OP when a drain is already in flight. Covers the
 *   item's three named proofs:
 *     • a serial batch lands its chain at close via a SEPARATE (detached) process;
 *     • a SECOND concurrent close only enqueues (lease held ⇒ no spawn);
 *     • an interrupted close leaves a DRAINABLE queue (the launcher is purely additive — it never touches the
 *       enqueued PRs / lease state, so skipping it is always safe).
 *   Drives the pure decision + arg-building directly, and the launcher against a REAL temp lock root with an
 *   injected `spawnFn`/`openLog`, so the detached-spawn contract is asserted without a real drain running. The
 *   merge-ai-prs lease/heartbeat/cap wiring is pinned as a source contract (its watch loop has no unit-drivable
 *   seam without hitting GitHub; the lease primitive itself is unit-tested in readiness/__tests__/drain-lock).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquireDrainLease, drainLeaseStatus, DRAIN_LEASE_PATH } from '../readiness/drain-lock.mjs';
import { readLockEntry } from '../readiness/file-locks.mjs';
import { decidePushAtClose, buildDrainArgs, runPushAtClose } from '../drain-push-at-close.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

let root;
beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'push-at-close-')); });
afterEach(() => { try { rmSync(root, { recursive: true, force: true }); } catch { /* best-effort */ } });

// A fake spawn that records its call and returns an unref-able child handle.
function fakeSpawn() {
  const calls = [];
  const fn = (cmd, args, opts) => {
    const child = { pid: 4242, unref: () => { child.unrefed = true; }, unrefed: false };
    calls.push({ cmd, args, opts, child });
    return child;
  };
  return { fn, calls };
}
const fakeOpenLog = () => ({ path: '/tmp/fake-push-at-close.log', fd: 1 });

describe('decidePushAtClose — fire iff no live drain (#2395)', () => {
  it('lease HELD (a live watch is draining) ⇒ do NOT fire (only enqueue)', () => {
    const d = decidePushAtClose({ held: true, stale: false, owner: 'host:99:drain' });
    expect(d.fire).toBe(false);
    expect(d.reason).toBe('drain-in-flight');
    expect(d.heldBy).toBe('host:99:drain');
  });
  it('lease FREE (no drain) ⇒ fire', () => {
    const d = decidePushAtClose({ held: false, stale: false, owner: null });
    expect(d.fire).toBe(true);
    expect(d.reason).toBe('no-drain-running');
  });
  it('lease STALE (crashed drain) ⇒ fire and reclaim', () => {
    const d = decidePushAtClose({ held: false, stale: true, owner: 'host:1:drain' });
    expect(d.fire).toBe(true);
    expect(d.reason).toBe('stale-lease-reclaim');
  });
});

describe('buildDrainArgs — the detached, lease-holding, capped drain command (#2395)', () => {
  it('is a self-terminating watch that HOLDS the lease and carries a wall-clock cap', () => {
    const a = buildDrainArgs({ intervalSec: 45, maxRuntimeMin: 90, batchFeed: '/p/_site/active-progress.json' });
    expect(a).toContain('--label=ready-to-merge');
    expect(a).toContain('--watch');
    expect(a).toContain('--until-batches-idle');   // self-terminate when the active batch is delivered (#2330)
    expect(a).toContain('--hold-drain-lease');     // the fired drain OWNS the whole-process lease (#2391)
    expect(a).toContain('--interval=45');
    expect(a).toContain('--max-runtime-min=90');   // bounded max lifetime — inert until-batches-idle can't run forever
    expect(a).toContain('--batch-feed=/p/_site/active-progress.json');
  });
  it('omits a zero/absent cap and feed', () => {
    const a = buildDrainArgs({ intervalSec: 0, maxRuntimeMin: 0, batchFeed: null });
    expect(a.some((x) => x.startsWith('--interval='))).toBe(false);
    expect(a.some((x) => x.startsWith('--max-runtime-min='))).toBe(false);
    expect(a.some((x) => x.startsWith('--batch-feed='))).toBe(false);
    // still a lease-holding self-terminating watch
    expect(a).toEqual(expect.arrayContaining(['--watch', '--until-batches-idle', '--hold-drain-lease']));
  });
});

describe('runPushAtClose — proof 1: a free lease fires ONE detached process (#2395)', () => {
  it('spawns node merge-ai-prs DETACHED + unref, carrying the lease-holding watch argv', () => {
    const sp = fakeSpawn();
    const res = runPushAtClose({
      repo: '/primary', lockRoot: root, drainScript: '/primary/scripts/merge-ai-prs.mjs',
      intervalSec: 30, maxRuntimeMin: 60, batchFeed: '/primary/_site/active-progress.json',
      spawnFn: sp.fn, openLog: fakeOpenLog,
    });
    expect(res.fired).toBe(true);
    expect(res.pid).toBe(4242);
    expect(sp.calls).toHaveLength(1);
    const call = sp.calls[0];
    expect(call.cmd).toBe('node');
    expect(call.args[0]).toBe('/primary/scripts/merge-ai-prs.mjs');
    expect(call.args).toEqual(expect.arrayContaining(['--watch', '--until-batches-idle', '--hold-drain-lease']));
    // TRUE detachment: new session leader + fd-backed stdio + parent does not await
    expect(call.opts.detached).toBe(true);
    expect(call.opts.cwd).toBe('/primary');
    expect(call.opts.stdio).toEqual(['ignore', 1, 1]);
    expect(call.child.unrefed).toBe(true);
  });
});

describe('runPushAtClose — proof 2: a second concurrent close only enqueues (#2395)', () => {
  it('a LIVE lease held by another drain ⇒ NO spawn, fired:false', () => {
    // Simulate a drain already in flight: it holds a fresh lease in the shared lock root.
    expect(acquireDrainLease(root, 'host:1:drain').ok).toBe(true);
    expect(drainLeaseStatus(root).held).toBe(true);

    const sp = fakeSpawn();
    const res = runPushAtClose({ repo: '/primary', lockRoot: root, drainScript: '/x/merge-ai-prs.mjs', spawnFn: sp.fn, openLog: fakeOpenLog });
    expect(res.fired).toBe(false);
    expect(res.reason).toBe('drain-in-flight');
    expect(res.heldBy).toBe('host:1:drain');
    expect(sp.calls).toHaveLength(0); // only enqueued — the running drain will collect it
  });
});

describe('runPushAtClose — proof 3: the launcher is purely additive (#2395)', () => {
  it('a no-op close does NOT mutate the lease it read (never stomps the running drain)', () => {
    acquireDrainLease(root, 'host:1:drain');
    const before = readLockEntry(root, DRAIN_LEASE_PATH);
    const sp = fakeSpawn();
    runPushAtClose({ repo: '/primary', lockRoot: root, drainScript: '/x/merge-ai-prs.mjs', spawnFn: sp.fn, openLog: fakeOpenLog });
    const after = readLockEntry(root, DRAIN_LEASE_PATH);
    expect(after.owner).toBe(before.owner);              // launcher touched neither owner…
    expect(after.heartbeatAt).toBe(before.heartbeatAt);  // …nor heartbeat — it is read-only on the lease
  });
  it('the launcher never enqueues/labels/unqueues — the enqueued PRs are the sole durable signal (correct with it OFF)', () => {
    // Source contract: the launcher makes NO queue/label mutation, so an interrupted close can never corrupt the
    // already-enqueued (ready-to-merge-labelled) chain — the deferred sweep lands it. It must not shell any gh
    // label edit or unqueue write (prose mentions of pr-land/queued.json are fine — only real mutation verbs fail).
    const src = read('scripts/drain-push-at-close.mjs');
    expect(src).not.toMatch(/gh['" ][\s\S]*\bpr\b[\s\S]*\bedit\b/);
    expect(src).not.toMatch(/--add-label|--remove-label/);
    expect(src).not.toMatch(/writeFileSync[\s\S]*queued/);   // no queue write
    expect(src).not.toMatch(/unqueue/);                      // never dequeues an enqueued item
  });
  it('a dry-run reports the decision but spawns NOTHING', () => {
    const sp = fakeSpawn();
    const res = runPushAtClose({ repo: '/primary', lockRoot: root, drainScript: '/x/merge-ai-prs.mjs', dryRun: true, spawnFn: sp.fn, openLog: fakeOpenLog });
    expect(res.fired).toBe(false);
    expect(res.wouldFire).toBe(true);
    expect(sp.calls).toHaveLength(0);
  });
});

describe('merge-ai-prs whole-process lease wiring (#2395 → #2449 always-on) — the fired drain OWNS its lease', () => {
  const src = read('scripts/merge-ai-prs.mjs');
  it('acquires the whole-process lease by DEFAULT (#2449 — no opt-in flag left in the gate), no-ops on a live lease', () => {
    expect(src).toContain('acquireDrainLease');
    expect(src).toContain('decideDrainLeaseGate'); // the #2449 always-on routing (replaces the #2395 opt-in flag)
    expect(src).toContain("flags['under-lease']"); // the resident daemon's child-pass declaration
    expect(src).toContain('drain-in-progress'); // the second-launch no-op signal
  });
  it('heartbeats each pass and releases on EVERY exit (normal / break / signal)', () => {
    expect(src).toContain('heartbeatDrainLease');
    expect(src).toContain('releaseDrainLease');
    expect(src).toMatch(/process\.on\(\s*['"]exit['"]/);         // release on any break/normal exit
    expect(src).toMatch(/SIGINT|SIGTERM/);                        // release on Ctrl-C / kill
  });
  it('honors a --max-runtime-min wall-clock cap so an inert until-batches-idle can never poll forever', () => {
    expect(src).toContain("flags['max-runtime-min']");
    expect(src).toContain('MAX_RUNTIME_MS');
  });
});

describe('push-at-close wiring (#2395) — the batch close-out fires the launcher', () => {
  it('the batch SKILL close-out invokes drain-push-at-close AFTER enqueueing (pr-land), and documents correct-with-it-off', () => {
    const skill = read('.claude/skills/batch-backlog-items/SKILL.md');
    expect(skill).toContain('drain-push-at-close.mjs');
    expect(skill).toContain('pr-land');       // enqueue happens first (step 3), THEN push-at-close fires
    expect(skill).toMatch(/#2395/);
  });
});
