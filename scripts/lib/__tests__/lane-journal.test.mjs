/**
 * @file scripts/lib/__tests__/lane-journal.test.mjs
 * @description #4370 — the pure/IO pieces of the per-pool lane lifecycle journal (`lib/lane-history.mjs`), its
 *   timeline renderer (`lib/lane-whois-core.mjs#formatLaneTimeline`) and the daemon-log timestamp prefix
 *   (`lib/log-timestamp.mjs`). The real call-path proof (acquire → reaper release → reclaim) lives in
 *   `scripts/__tests__/lane-pool-lifecycle-journal.test.mjs`.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  journalActor, laneJournalEntry, destructiveActionVerdict, isRepeatJournalEntry, isUnsalvagedDestructiveUnpushed,
  laneOfDir, journalLaneEvent, readLaneJournal, readLaneJournalTail, laneJournalPath, LANE_JOURNAL_FILENAME,
} from '../lane-history.mjs';
import { formatLaneTimeline } from '../lane-whois-core.mjs';
import { timestampLines } from '../log-timestamp.mjs';

const T0 = Date.parse('2026-09-28T20:49:34.000Z');
const ACTOR = { name: 'lane-pool-health-watch', script: 'lane-pool reclaim', pid: 41, ppid: 40 };

let base;
beforeEach(() => { base = mkdtempSync(join(tmpdir(), 'lane-journal-')); });
afterEach(() => { rmSync(base, { recursive: true, force: true }); });

describe('journalActor', () => {
  it('names a declaring daemon over the script, and keeps the script + subcommand, pid, ppid, session', () => {
    expect(journalActor({
      env: { LANE_JOURNAL_ACTOR: 'lease-reaper', CLAUDE_CODE_SESSION_ID: 'abc' },
      argv: ['node', '/x/scripts/lane-pool.mjs', 'release', '--lane=3'], pid: 7, ppid: 6, host: 'Mac',
    })).toEqual({ name: 'lease-reaper', script: 'lane-pool release', session: 'abc', pid: 7, ppid: 6, host: 'Mac' });
  });

  it('falls back to the script name; a flag in the subcommand slot is not a subcommand; blank env is ignored', () => {
    expect(journalActor({ env: { LANE_JOURNAL_ACTOR: '  ' }, argv: ['node', 'lane-pool.mjs', '--json'] }))
      .toEqual({ name: 'lane-pool', script: 'lane-pool' });
    expect(journalActor({})).toEqual({ name: 'unknown' });
  });
});

describe('laneJournalEntry', () => {
  it('records HEAD before→after, the before-state and the snapshot\'s own unpushed answer', () => {
    const e = laneJournalEntry({
      nowMs: T0, lane: 18, action: 'reclaim-reset', actor: ACTOR, reason: 'why',
      before: { head: 'aaa', dirty: 0, ahead: 1, unpushedCommits: 0, unpushed: false }, headAfter: 'bbb',
    });
    expect(e).toEqual({
      ts: '2026-09-28T20:49:34.000Z', lane: 18, action: 'reclaim-reset', actor: ACTOR, reason: 'why',
      headBefore: 'aaa', headAfter: 'bbb', dirtyBefore: 0, aheadBefore: 1, unpushedCommitsBefore: 0, unpushed: false,
    });
  });

  it('a lease-only event keeps HEAD (after = before); an explicit unpushed wins; empty extras are omitted', () => {
    const e = laneJournalEntry({
      nowMs: T0, lane: 1, action: 'release', actor: ACTOR, before: { head: 'aaa', dirty: 2, ahead: 0, unpushed: true },
      unpushed: false, leaseSession: '', item: null, removed: ['a'],
    });
    expect(e.headAfter).toBe('aaa');
    expect(e.unpushed).toBe(false);
    expect(e).not.toHaveProperty('leaseSession');
    expect(e).not.toHaveProperty('item');
    expect(e.removed).toEqual(['a']);
  });

  it('unknown before-state is omitted, never written as a guessed zero; no action throws', () => {
    const e = laneJournalEntry({ nowMs: T0, lane: 1, action: 'x', before: { head: null, dirty: null, ahead: null, unpushed: null } });
    expect(e).toEqual({ ts: '2026-09-28T20:49:34.000Z', lane: 1, action: 'x', actor: { name: 'unknown' } });
    expect(() => laneJournalEntry({ lane: 1 })).toThrow(/action/);
  });
});

describe('destructiveActionVerdict (#4370 fork 3)', () => {
  it('nothing unpushed → allowed, quiet', () => {
    expect(destructiveActionVerdict({ unpushed: false })).toMatchObject({ allowed: true, loud: false });
  });
  it('unpushed + owner not proven gone → REFUSED, loud', () => {
    expect(destructiveActionVerdict({ unpushed: true, ownerGone: false, ownerReason: 'owning session is still live' }))
      .toEqual({ allowed: false, loud: true, reason: 'REFUSED — unpushed work and the owner is not proven gone (owning session is still live)' });
    expect(destructiveActionVerdict({ unpushed: true })).toMatchObject({ allowed: false, loud: true }); // ownerGone unknown
  });
  it('unpushed + owner proven gone, or an explicit override → allowed, but loud', () => {
    expect(destructiveActionVerdict({ unpushed: true, ownerGone: true })).toMatchObject({ allowed: true, loud: true });
    expect(destructiveActionVerdict({ unpushed: true, override: true })).toMatchObject({ allowed: true, loud: true });
  });
  it('an unknown unpushed state is never destroyed blind', () => {
    expect(destructiveActionVerdict({ unpushed: null, ownerGone: true })).toMatchObject({ allowed: false, loud: true });
  });
});

describe('isUnsalvagedDestructiveUnpushed / isRepeatJournalEntry', () => {
  it('only a destructive action with unpushed work and no salvage bundle counts', () => {
    expect(isUnsalvagedDestructiveUnpushed({ action: 'reclaim-reset', unpushed: true })).toBe(true);
    expect(isUnsalvagedDestructiveUnpushed({ action: 'salvage-reset', unpushed: true, salvagedTo: '/b' })).toBe(false);
    expect(isUnsalvagedDestructiveUnpushed({ action: 'reclaim-reset', unpushed: false })).toBe(false);
    expect(isUnsalvagedDestructiveUnpushed({ action: 'release', unpushed: true })).toBe(false);
    expect(isUnsalvagedDestructiveUnpushed(null)).toBe(false);
  });
  it('a repeat is same action + reason + state; a changed HEAD is news', () => {
    const a = { action: 'reclaim-refused', reason: 'r', headBefore: 'h', dirtyBefore: 0, aheadBefore: 1, unpushed: true };
    expect(isRepeatJournalEntry(a, { ...a, ts: 'later' })).toBe(true);
    expect(isRepeatJournalEntry(a, { ...a, headBefore: 'h2' })).toBe(false);
    expect(isRepeatJournalEntry(undefined, a)).toBe(false);
  });
});

describe('journalLaneEvent / readLaneJournal (IO)', () => {
  it('appends next to the pool (never inside the lane), per lane, oldest first', () => {
    const poolDir = join(base, 'pool');
    mkdirSync(join(poolDir, 'lane-3'), { recursive: true });
    mkdirSync(join(poolDir, 'lane-4'), { recursive: true });
    expect(laneOfDir(join(poolDir, 'lane-3'))).toEqual({ poolDir, lane: 3 });
    expect(laneOfDir(join(poolDir, 'sibling'))).toBeNull();
    expect(journalLaneEvent(join(poolDir, 'lane-3'), { action: 'acquire', reason: 'a' }, { actor: ACTOR, nowMs: T0 })).toBe(true);
    expect(journalLaneEvent(join(poolDir, 'lane-4'), { action: 'release', reason: 'b' }, { actor: ACTOR, nowMs: T0 + 1 })).toBe(true);
    expect(journalLaneEvent(join(poolDir, 'lane-3'), { action: 'release', reason: 'c' }, { actor: ACTOR, nowMs: T0 + 2 })).toBe(true);
    expect(journalLaneEvent(join(poolDir, 'not-a-lane'), { action: 'x' }, { actor: ACTOR })).toBe(false);
    expect(readLaneJournal(poolDir, { lane: 3 }).map((e) => e.reason)).toEqual(['a', 'c']);
    expect(readLaneJournal(poolDir).length).toBe(3);
    expect(readdirSync(join(poolDir, 'lane-3'))).toEqual([]);
  });

  it('rotates by SIZE (renamed aside, never deleted) and reads across rotations in order', () => {
    const poolDir = join(base, 'pool');
    mkdirSync(join(poolDir, 'lane-1'), { recursive: true });
    for (let i = 0; i < 5; i++) {
      journalLaneEvent(join(poolDir, 'lane-1'), { action: 'acquire', reason: `r${i}` }, { actor: ACTOR, nowMs: T0 + i * 1000, maxBytes: 200 });
    }
    const rotated = readdirSync(poolDir).filter((n) => n.startsWith('.lane-journal.') && n !== LANE_JOURNAL_FILENAME);
    expect(rotated.length).toBeGreaterThan(0);
    expect(readLaneJournal(poolDir, { lane: 1 }).map((e) => e.reason)).toEqual(['r0', 'r1', 'r2', 'r3', 'r4']);
  });

  it('unlessRepeat skips an identical repeat of the lane\'s previous line', () => {
    const poolDir = join(base, 'pool');
    mkdirSync(join(poolDir, 'lane-1'), { recursive: true });
    const f = { action: 'reclaim-refused', reason: 'kept', before: { head: 'h', dirty: 0, ahead: 1, unpushed: true } };
    expect(journalLaneEvent(join(poolDir, 'lane-1'), f, { actor: ACTOR, unlessRepeat: true })).toBe(true);
    expect(journalLaneEvent(join(poolDir, 'lane-1'), f, { actor: ACTOR, unlessRepeat: true })).toBe(false);
    expect(journalLaneEvent(join(poolDir, 'lane-1'), { ...f, before: { ...f.before, head: 'h2' } }, { actor: ACTOR, unlessRepeat: true })).toBe(true);
    expect(readLaneJournal(poolDir).length).toBe(2);
  });

  it('a corrupt / torn line is skipped, never thrown', () => {
    const poolDir = join(base, 'pool');
    mkdirSync(poolDir, { recursive: true });
    writeFileSync(laneJournalPath(poolDir), `${JSON.stringify({ lane: 1, action: 'a' })}\n{"lane":1,"act\n`);
    expect(readLaneJournal(poolDir, { lane: 1 })).toEqual([{ lane: 1, action: 'a' }]);
    expect(readLaneJournalTail(poolDir)).toEqual([{ lane: 1, action: 'a' }]);
    expect(readLaneJournal(join(base, 'missing'))).toEqual([]);
  });
});

describe('formatLaneTimeline', () => {
  it('one line per event: when, what, who (pid/ppid/script), HEAD before→after, state, why; loud flagged', () => {
    const lines = formatLaneTimeline([
      { ts: '2026-09-28T20:06:39.000Z', lane: 18, action: 'acquire', actor: { name: 'lane-pool', pid: 1, script: 'lane-pool acquire' }, headBefore: 'aaaaaaaaaaaa', headAfter: 'aaaaaaaaaaaa', dirtyBefore: 0, aheadBefore: 0, reason: 'acquire' },
      { ts: '2026-09-28T20:49:34.000Z', lane: 18, action: 'reclaim-reset', loud: true, actor: { name: 'lane-pool-health-watch', pid: 41, ppid: 40 }, headBefore: 'bbbbbbbbbbbb', headAfter: 'cccccccccccc', dirtyBefore: 0, aheadBefore: 1, unpushed: true, reason: 'override' },
    ], { lane: 18 });
    expect(lines[0]).toBe('lane-18 lifecycle journal (2 events):');
    expect(lines[1]).toBe('  2026-09-28T20:06:39.000Z  acquire  by lane-pool (pid 1, lane-pool acquire)  HEAD aaaaaaaaa  dirty 0 ahead 0  — acquire');
    expect(lines[2]).toBe('  2026-09-28T20:49:34.000Z  ⚠ reclaim-reset  by lane-pool-health-watch (pid 41, ppid 40)  HEAD bbbbbbbbb→ccccccccc  dirty 0 ahead 1 unpushed YES  — override');
  });

  it('an empty journal says so', () => {
    expect(formatLaneTimeline([], { lane: 5 })).toEqual(['lane-5 lifecycle journal: no events recorded']);
  });
});

describe('timestampLines (#4370 fork 4)', () => {
  it('prefixes every non-empty line, keeps blank lines and the trailing newline', () => {
    expect(timestampLines('  a\n\n  b\n', T0)).toBe('2026-09-28T20:49:34.000Z   a\n\n2026-09-28T20:49:34.000Z   b\n');
  });
});
