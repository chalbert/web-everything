/**
 * @file lane-journal-smells.test.mjs — #4370's two lane smells on fixtures, plus the probe/watch plumbing that
 * feeds them: `lane-worker-without-lease` (the lane-21 shape) through `lane-pool-health-watch.mjs`'s
 * `workersWithoutLease` → its JSON line → `health-watch.mjs#probeLanePools`, and `lane-destructive-unpushed`
 * (the lane-18 shape) through `probeLaneJournal` over a fixture pool journal. The real reclaim that writes such
 * a journal line is covered in `scripts/__tests__/lane-pool-lifecycle-journal.test.mjs`.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import workerSmell from '../lane-worker-without-lease.mjs';
import destructiveSmell from '../lane-destructive-unpushed.mjs';
import { workersWithoutLease } from '../../lane-pool-health-watch.mjs';
import { probeLanePools, probeLaneJournal } from '../../health-watch.mjs';
import { laneJournalPath } from '../../../lib/lane-history.mjs';

const NOW = Date.parse('2026-09-28T21:00:14.000Z');
let dir;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'lane-journal-smells-')); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

describe('lane-worker-without-lease', () => {
  it('workersWithoutLease picks unleased lanes with a running worker only (#4544)', () => {
    expect(workersWithoutLease({
      lanes: [
        { lane: 21, exists: true, lease: null, liveOwner: true, liveWorker: true },
        { lane: 22, exists: true, lease: { session: 's' }, liveOwner: true, liveWorker: true },
        { lane: 23, exists: true, lease: null, liveOwner: false, liveWorker: false },
        { lane: 24, exists: false },
        { lane: 25, exists: true, lease: null, liveOwner: true, liveWorker: false },
      ],
    })).toEqual([21]);
    expect(workersWithoutLease(null)).toEqual([]);
  });

  it('fires from the health watch\'s own JSON line, read back through probeLanePools', () => {
    const logsDir = join(dir, 'logs');
    mkdirSync(logsDir);
    const health = { total: 3, leased: 1, acquirable: 1, dirtyUnleased: 0 };
    writeFileSync(join(logsDir, 'lane-pool-health-watch-we.log'), [
      JSON.stringify({ checked: true, health, workerWithoutLease: [21], alert: null, plan: [] }),
      '',
    ].join('\n'));
    const lanePools = probeLanePools(logsDir);
    expect(lanePools[0].workerWithoutLease).toEqual([21]);
    expect(lanePools[0].health).toEqual(health);

    const results = workerSmell.evaluate({ lanePools }, { now: NOW });
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ subject: 'lane:we/lane-21', breach: true, measure: { repo: 'we', lane: 21 } });
    expect(results[0].recommendation).toMatch(/--history 21/);
  });

  it('an older line with no workerWithoutLease (or null) never fires', () => {
    const logsDir = join(dir, 'logs');
    mkdirSync(logsDir);
    writeFileSync(join(logsDir, 'lane-pool-health-watch-we.log'),
      `${JSON.stringify({ checked: true, health: { total: 1 }, workerWithoutLease: null })}\n`);
    const lanePools = probeLanePools(logsDir);
    expect(lanePools[0]).not.toHaveProperty('workerWithoutLease');
    expect(workerSmell.evaluate({ lanePools }, { now: NOW })).toEqual([]);
  });
});

describe('lane-destructive-unpushed', () => {
  const entry = (over) => ({
    ts: '2026-09-28T20:49:34.000Z', lane: 18, action: 'reclaim-reset', unpushed: true,
    actor: { name: 'lane-pool-health-watch', pid: 41, ppid: 40 }, headBefore: 'abc', headAfter: 'def',
    dirtyBefore: 0, aheadBefore: 1, reason: 'why', ...over,
  });

  it('fires once per lane for an unsalvaged destructive action on unpushed work, from a fixture pool journal', () => {
    const poolDir = join(dir, 'web-everything');
    mkdirSync(poolDir);
    writeFileSync(laneJournalPath(poolDir), [
      entry({ lane: 18 }),
      entry({ lane: 18, ts: '2026-09-28T20:50:00.000Z' }), // same lane — one subject
      entry({ lane: 19, action: 'salvage-reset', salvagedTo: '/salvage/lane-19.bundle' }), // saved first — never
      entry({ lane: 20, unpushed: false }), // nothing unpushed — never
      entry({ lane: 21, action: 'release' }), // not destructive — never
      entry({ lane: 22, ts: '2026-09-20T00:00:00.000Z' }), // outside the probe window — never
    ].map((e) => JSON.stringify(e)).join('\n') + '\n');

    const laneJournal = probeLaneJournal({ poolRoot: dir, now: NOW });
    expect(laneJournal).toHaveLength(1);
    const results = destructiveSmell.evaluate({ laneJournal }, { now: NOW });
    expect(results.map((r) => r.subject)).toEqual(['lane:web-everything/lane-18']);
    expect(results[0].measure).toMatchObject({ actor: 'lane-pool-health-watch', pid: 41, headBefore: 'abc', aheadBefore: 1, at: '2026-09-28T20:50:00.000Z' });
    expect(results[0].summary).toMatch(/destroyed unpushed work/);
  });

  it('no pool root / no journal → no readings, no results', () => {
    expect(probeLaneJournal({ poolRoot: null })).toEqual([]);
    expect(probeLaneJournal({ poolRoot: join(dir, 'missing') })).toEqual([]);
    expect(destructiveSmell.evaluate({ laneJournal: [] }, { now: NOW })).toEqual([]);
  });
});
