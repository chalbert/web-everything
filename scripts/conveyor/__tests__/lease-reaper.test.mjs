/**
 * @file scripts/conveyor/__tests__/lease-reaper.test.mjs
 * @description Unit proof of the conveyor LEASE REAPER's PURE core (WE #2667). Drives {@link classifyReap} /
 *   {@link reapPlan} / {@link itemNumFromSession} / {@link laneRefItemNum} directly with fixtures (NO fs / git /
 *   gh / clock) and pins every reap axis — PR-terminal (merged/closed), TTL-stale, the DORMANT pid axis — plus
 *   the reserved-lane never-reap invariant and the session↔head-ref item-number keys the cross-pool couple relies on.
 */
import { describe, it, expect } from 'vitest';
import {
  classifyReap,
  reapPlan,
  itemNumFromSession,
  laneRefItemNum,
  prStatesFromList,
  pidAliveForLease,
} from '../lease-reaper.mjs';
import { DEFAULT_LEASE_TTL_MINUTES } from '../../lib/lane-lease.mjs';

const NOW = Date.parse('2026-07-26T12:00:00Z');
const TTL_MS = DEFAULT_LEASE_TTL_MINUTES * 60_000;
// A fresh lease acquired 1 minute ago (well within TTL) — not stale.
const fresh = (over = {}) => ({ session: 'conveyor-2667', acquiredAt: new Date(NOW - 60_000).toISOString(), ttlMinutes: DEFAULT_LEASE_TTL_MINUTES, host: 'Mac', pid: 111, ...over });
// A lease acquired long past its TTL.
const stale = (over = {}) => ({ session: 'conveyor-2500', acquiredAt: new Date(NOW - (DEFAULT_LEASE_TTL_MINUTES + 60) * 60_000).toISOString(), ttlMinutes: DEFAULT_LEASE_TTL_MINUTES, host: 'Mac', pid: 222, ...over });

describe('itemNumFromSession — the couple key encoded in a lease session', () => {
  it('conveyor-/fix-/prepare- sessions → the trailing item number', () => {
    expect(itemNumFromSession('conveyor-2667')).toBe('2667');
    expect(itemNumFromSession('fix-2630')).toBe('2630');
    expect(itemNumFromSession('prepare-2604')).toBe('2604');
    expect(itemNumFromSession('prepare-decision-2647')).toBe('2647');
  });
  it('a retry suffix (conveyor-2500b) still resolves the base item number', () => {
    expect(itemNumFromSession('conveyor-2500b')).toBe('2500');
  });
  it('a non-item session → null', () => {
    // #3283 — a session that merely ENDS in digits is not an item reference. `Mac:24827`'s trailing run is the
    // shell `ppid` that `defaultSession()` stamps (`we:scripts/lane-pool.mjs:526`), so reading it as item 24827
    // aliased a plain `acquire` onto whatever card that number happens to name. This assertion previously read
    // `.toBe('24827')` inside this very `it` — it now agrees with the title it always had.
    expect(itemNumFromSession('Mac:24827')).toBe(null);
    expect(itemNumFromSession('shell-fix')).toBe(null);
    expect(itemNumFromSession('')).toBe(null);
    expect(itemNumFromSession(null)).toBe(null);
  });

  // ── #3283 — the couple key is a GRAMMAR, not "the trailing digit run of anything" ────────────────────

  it('#3283 — a GENUINE item-encoding slug still resolves', () => {
    expect(itemNumFromSession('conveyor-2500')).toBe('2500');
    expect(itemNumFromSession('prepare-2500')).toBe('2500');
    expect(itemNumFromSession('prepare-decision-2500')).toBe('2500');
    expect(itemNumFromSession('fix-2500')).toBe('2500');
    expect(itemNumFromSession('conveyor-2500b')).toBe('2500'); // the retry suffix still collapses
  });

  it('#3283 — an ARBITRARY digit-tailed slug no longer aliases onto a backlog item', () => {
    // Every one of these resolved to a real item number before the fix, and ~4 in 5 backlog ids name a
    // `status: resolved` card — so each was a lease the acquire-native reaper would reclaim on sight.
    expect(itemNumFromSession('probe1')).toBe(null);                     // not item 1
    expect(itemNumFromSession('rv1566j')).toBe(null);                    // a juror for PR 1566, not item 1566
    expect(itemNumFromSession('Mac:24827')).toBe(null);                  // `defaultSession()` — host:ppid
    expect(itemNumFromSession('build-3283-lane-27-df14bb76')).toBe(null); // a minted `holder` slug (hex tail)
    expect(itemNumFromSession('lane-27')).toBe(null);
  });
});

describe('laneRefItemNum — the couple key encoded in a lane/<num>-<slug> head ref', () => {
  it('a lane/<num>-<slug> head ref → the item number', () => {
    expect(laneRefItemNum('lane/2667-conveyor-auto-release')).toBe('2667');
    expect(laneRefItemNum('lane/2500b-retry-slug')).toBe('2500');
  });
  it('a non-lane ref → null', () => {
    expect(laneRefItemNum('main')).toBe(null);
    expect(laneRefItemNum('feature/x')).toBe(null);
    expect(laneRefItemNum(null)).toBe(null);
  });

  // ── #x9ylkp7 — the grammar is `pr-land`'s, so the reaper and the dispatch observer cannot disagree ─────────

  it('a `bornAs` HASH ref resolves too — `pr-land` accepts `lane/xNNNNNN-*` and this used to read it as no item', () => {
    // `we:scripts/pr-land.mjs` parses `^lane\/(x[a-z0-9]{5,7}|\d+)`, and the delivery-agent brief documents
    // `{{ITEM_NUM}}` as "the backlog item number (or `xNNNNNN` hash)". Only the digit half matched here, so a
    // hash-identified item's PR was invisible to everything keying through this function.
    expect(laneRefItemNum('lane/x9ylkp7-give-the-observer-a-completion-signal')).toBe('x9ylkp7');
    expect(laneRefItemNum('lane/xaibmeu-route-the-conveyor')).toBe('xaibmeu');
    // Case-folded on the way out, matching `normNum`'s convention for a non-numeric id.
    expect(laneRefItemNum('lane/X9YLKP7-shouty')).toBe('x9ylkp7');
  });

  it('still refuses a ref that is neither — the widening is a second alternative, not a wildcard', () => {
    expect(laneRefItemNum('lane/build-3095')).toBe(null); // no leading `x`, not digits
    expect(laneRefItemNum('lane/x9yl-too-short')).toBe(null); // `x` + 3 < the 5-char floor
    expect(laneRefItemNum('lane/2667')).toBe(null); // no `-<slug>` at all
  });

  it('the REAPER is unaffected by the widening: a hash key is unreachable from a lease session', () => {
    // The claim in `laneRefItemNum`'s docblock, asserted rather than asserted-about. `prStatesFromList` now
    // mints hash keys, but `itemNumFromSession` — the only lookup on the reap path — can only ever produce
    // digits, so no hash key is reachable and none collides with an existing one.
    const states = prStatesFromList([
      { headRefName: 'lane/x9ylkp7-hash-item', state: 'MERGED', mergedAt: '2026-08-13T00:00:00Z' },
      { headRefName: 'lane/2667-digit-item', state: 'OPEN' },
    ]);
    expect(states.get('x9ylkp7')).toBe('merged');
    expect(states.get('2667')).toBe('open');
    // A lease for the hash item is named `conveyor-x9ylkp7`. #3283 — that slug carries no DIGIT item number at
    // all, so it resolves to null; it previously read as item `7`, a DIFFERENT, real, `status: resolved` card,
    // which made every hash-item lease instantly reapable. `:85`'s conclusion is unchanged and now holds for
    // the stronger reason: a hash key is not merely unreachable, the lookup key itself is absent.
    expect(itemNumFromSession('conveyor-x9ylkp7')).toBe(null);
    expect(states.get(itemNumFromSession('conveyor-x9ylkp7'))).toBeUndefined();
  });
});

describe('classifyReap — PR-terminal axis (work done/abandoned → reclaim even pre-TTL)', () => {
  it('a FRESH lease whose item PR MERGED → reap (pr-merged)', () => {
    expect(classifyReap(fresh(), { nowMs: NOW, ttlMs: TTL_MS, prState: 'merged' })).toEqual({ reap: true, reason: 'pr-merged' });
  });
  it('a FRESH lease whose item PR CLOSED → reap (pr-closed)', () => {
    expect(classifyReap(fresh(), { nowMs: NOW, ttlMs: TTL_MS, prState: 'closed' })).toEqual({ reap: true, reason: 'pr-closed' });
  });
  it('a FRESH lease whose item PR is still OPEN → keep (still in flight)', () => {
    expect(classifyReap(fresh(), { nowMs: NOW, ttlMs: TTL_MS, prState: 'open' })).toEqual({ reap: false, reason: null });
  });
  it('unknown PR state (axis off) + fresh lease → keep', () => {
    expect(classifyReap(fresh(), { nowMs: NOW, ttlMs: TTL_MS, prState: null })).toEqual({ reap: false, reason: null });
  });
});

describe('classifyReap — TTL-stale axis (the zero-IO dead-agent backstop)', () => {
  it('a TTL-stale lease with no PR signal → reap (ttl-stale)', () => {
    expect(classifyReap(stale(), { nowMs: NOW, ttlMs: TTL_MS })).toEqual({ reap: true, reason: 'ttl-stale' });
  });
  it('a stale lease whose PR merged reports the PR axis (it wins over TTL)', () => {
    expect(classifyReap(stale(), { nowMs: NOW, ttlMs: TTL_MS, prState: 'merged' })).toEqual({ reap: true, reason: 'pr-merged' });
  });
  it('a lease exactly at the TTL edge is stale (>=)', () => {
    const at = { session: 'conveyor-1', acquiredAt: new Date(NOW - TTL_MS).toISOString(), ttlMinutes: DEFAULT_LEASE_TTL_MINUTES };
    expect(classifyReap(at, { nowMs: NOW, ttlMs: TTL_MS }).reap).toBe(true);
  });
});

describe('classifyReap — pid axis (DORMANT under today\'s schema)', () => {
  it('pidAlive=false → reap (pid-dead) — the forward-compat branch when a trustworthy agentPid exists', () => {
    expect(classifyReap(fresh(), { nowMs: NOW, ttlMs: TTL_MS, pidAlive: false })).toEqual({ reap: true, reason: 'pid-dead' });
  });
  it('pidAlive=null (unknown — the shell\'s value today) never reaps a fresh lease', () => {
    expect(classifyReap(fresh(), { nowMs: NOW, ttlMs: TTL_MS, pidAlive: null })).toEqual({ reap: false, reason: null });
  });
  it('pidAlive=true never reaps a fresh lease', () => {
    expect(classifyReap(fresh(), { nowMs: NOW, ttlMs: TTL_MS, pidAlive: true })).toEqual({ reap: false, reason: null });
  });
});

describe('classifyReap — RESERVED (permanent memory) leases are NEVER reaped on any axis', () => {
  it('reserved + TTL-stale → keep (reason reserved)', () => {
    expect(classifyReap(stale({ reserved: true }), { nowMs: NOW, ttlMs: TTL_MS })).toEqual({ reap: false, reason: 'reserved' });
  });
  it('reserved + PR merged → keep (reserved short-circuits before the PR axis)', () => {
    expect(classifyReap(fresh({ reserved: true }), { nowMs: NOW, ttlMs: TTL_MS, prState: 'merged' })).toEqual({ reap: false, reason: 'reserved' });
  });
  it('reserved + pid dead → keep', () => {
    expect(classifyReap(fresh({ reserved: true }), { nowMs: NOW, ttlMs: TTL_MS, pidAlive: false })).toEqual({ reap: false, reason: 'reserved' });
  });
});

describe('classifyReap — degenerate inputs', () => {
  it('null / non-object lease → keep (never reap what we cannot read)', () => {
    expect(classifyReap(null, { nowMs: NOW, ttlMs: TTL_MS })).toEqual({ reap: false, reason: null });
    expect(classifyReap(undefined, { nowMs: NOW, ttlMs: TTL_MS })).toEqual({ reap: false, reason: null });
  });
});

describe('prStatesFromList — head-ref → num state reduction (OPEN WINS: never reap a live retry lane)', () => {
  it('a single merged PR → merged; a single open PR → open; a single closed PR → closed', () => {
    const m = prStatesFromList([
      { headRefName: 'lane/2667-x', state: 'MERGED', mergedAt: '2026-07-26T10:00:00Z' },
      { headRefName: 'lane/100-y', state: 'OPEN', mergedAt: null },
      { headRefName: 'lane/200-z', state: 'CLOSED', mergedAt: null },
    ]);
    expect(m.get('2667')).toBe('merged');
    expect(m.get('100')).toBe('open');
    expect(m.get('200')).toBe('closed');
  });

  it('CRITICAL — a base num with a terminal PR AND a live open retry PR reads OPEN (never reaps the live lane)', () => {
    // The #2267 hazard: lane/2500-v1 CLOSED (bounced) while retry lane/2500b-v2 is a LIVE open PR — both
    // collapse to base num 2500. Open must WIN so the reaper never releases the live 2500b lane.
    const closedThenOpen = prStatesFromList([
      { headRefName: 'lane/2500-v1', state: 'CLOSED', mergedAt: null },
      { headRefName: 'lane/2500b-v2', state: 'OPEN', mergedAt: null },
    ]);
    expect(closedThenOpen.get('2500')).toBe('open');
    // Same with a MERGED old PR + a live open retry — still open (order-independent).
    const mergedThenOpen = prStatesFromList([
      { headRefName: 'lane/2500b-v2', state: 'OPEN', mergedAt: null },
      { headRefName: 'lane/2500-v1', state: 'MERGED', mergedAt: '2026-07-26T09:00:00Z' },
    ]);
    expect(mergedThenOpen.get('2500')).toBe('open');
  });

  it('among terminal-only PRs of one num, merged wins over closed (the work landed)', () => {
    expect(prStatesFromList([
      { headRefName: 'lane/300-v1', state: 'CLOSED', mergedAt: null },
      { headRefName: 'lane/300-v2', state: 'MERGED', mergedAt: '2026-07-26T09:00:00Z' },
    ]).get('300')).toBe('merged');
  });

  it('non-lane / malformed head refs are ignored; empty input → empty map', () => {
    const m = prStatesFromList([{ headRefName: 'main', state: 'MERGED' }, { headRefName: null }, {}]);
    expect(m.size).toBe(0);
    expect(prStatesFromList([]).size).toBe(0);
    expect(prStatesFromList(null).size).toBe(0);
  });
});

describe('pidAliveForLease — DORMANT under today\'s schema (no durable agentPid)', () => {
  it('a lease with no agentPid (today\'s schema — only the acquire-CLI `pid`) → null (axis inert)', () => {
    expect(pidAliveForLease({ session: 'conveyor-2667', pid: 12345, host: 'Mac' })).toBe(null);
    expect(pidAliveForLease({})).toBe(null);
    expect(pidAliveForLease(null)).toBe(null);
  });
  it('an agentPid on a DIFFERENT host → null (cannot check a pid on another host)', () => {
    expect(pidAliveForLease({ agentPid: 999999, host: 'some-other-host-not-mine' })).toBe(null);
  });
});

describe('reapPlan — maps classifyReap over candidates, splitting reap vs keep', () => {
  const candidates = [
    { pool: 'web-everything', lane: 3, dir: '/x/web-everything/lane-3', lease: fresh({ session: 'conveyor-2667' }) },   // fresh, PR open → keep
    { pool: 'web-everything', lane: 5, dir: '/x/web-everything/lane-5', lease: stale({ session: 'conveyor-2500' }) },   // TTL-stale → reap
    { pool: 'plateau-app', lane: 6, dir: '/x/plateau-app/lane-6', lease: fresh({ session: 'conveyor-2604' }) },         // fresh, PR merged → reap
    { pool: 'web-everything', lane: 7, dir: '/x/web-everything/lane-7', lease: fresh({ session: 'mem', reserved: true, acquiredAt: new Date(NOW - 10 * TTL_MS).toISOString() }) }, // reserved → keep
    { pool: 'web-everything', lane: 8, dir: '/x/web-everything/lane-8', lease: null },                                  // no lease → skipped
  ];
  const prStates = new Map([['2667', 'open'], ['2604', 'merged']]);
  const signalsFor = (c) => ({ prState: prStates.get(itemNumFromSession(c.lease?.session)) ?? null, pidAlive: null });

  it('reaps the TTL-stale and PR-merged lanes; keeps the fresh-open and reserved; skips the lease-less', () => {
    const { reap, keep } = reapPlan(candidates, { nowMs: NOW, ttlMs: TTL_MS, signalsFor });
    expect(reap.map((c) => `${c.pool}/lane-${c.lane}:${c.reason}`).sort()).toEqual([
      'plateau-app/lane-6:pr-merged',
      'web-everything/lane-5:ttl-stale',
    ]);
    // keep excludes the lease-less candidate (skipped entirely), includes fresh-open + reserved
    expect(keep.map((c) => `${c.pool}/lane-${c.lane}`).sort()).toEqual(['web-everything/lane-3', 'web-everything/lane-7']);
  });

  it('with no signalsFor, only the TTL axis fires (PR/pid unknown)', () => {
    const { reap } = reapPlan(candidates, { nowMs: NOW, ttlMs: TTL_MS });
    expect(reap.map((c) => `${c.pool}/lane-${c.lane}:${c.reason}`)).toEqual(['web-everything/lane-5:ttl-stale']);
  });

  it('empty / non-array candidates → empty plan', () => {
    expect(reapPlan([], { nowMs: NOW })).toEqual({ reap: [], keep: [] });
    expect(reapPlan(null, { nowMs: NOW })).toEqual({ reap: [], keep: [] });
  });
});
