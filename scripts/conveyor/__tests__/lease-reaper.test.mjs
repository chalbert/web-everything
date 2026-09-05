/**
 * @file scripts/conveyor/__tests__/lease-reaper.test.mjs
 * @description Unit proof of the conveyor LEASE REAPER's PURE core (WE #2667). Drives {@link classifyReap} /
 *   {@link reapPlan} / {@link itemNumFromSession} / {@link laneRefItemNum} directly with fixtures (NO fs / git /
 *   gh / clock) and pins every reap axis — PR-terminal (merged/closed), session-gone (WE #3466/#2412, found live
 *   2026-09-04/05), TTL-stale, the DORMANT pid axis — plus the reserved-lane never-reap invariant and the
 *   session↔head-ref item-number keys the cross-pool couple relies on. Also pins the two independent-review
 *   findings on PR #1921 that hardened session-gone before it landed: the listing-visibility GRACE WINDOW (a
 *   lease acquired moments ago must never be reaped just because its session isn't listed yet — #3283's
 *   failure shape, reintroduced) and the ALL-EMPTY-LISTING degrade (zero background rows must read as "axis
 *   off", never "everyone's gone").
 */
import { describe, it, expect } from 'vitest';
import {
  classifyReap,
  reapPlan,
  itemNumFromSession,
  laneRefItemNum,
  prStatesFromList,
  pidAliveForLease,
  sessionStateByName,
  sessionStatesForReap,
  sessionGoneForLease,
  AGENT_GONE_STATES,
} from '../lease-reaper.mjs';
import { DEFAULT_LEASE_TTL_MINUTES } from '../../lib/lane-lease.mjs';
import { DISPATCH_GUARD_LISTING_GRACE_MINUTES } from '../../operations/dispatch-lane.mjs';

const NOW = Date.parse('2026-07-26T12:00:00Z');
const TTL_MS = DEFAULT_LEASE_TTL_MINUTES * 60_000;
const GRACE_MS = DISPATCH_GUARD_LISTING_GRACE_MINUTES * 60_000;
// A fresh lease acquired 1 minute ago (well within TTL, and well within the listing-visibility grace window) — not stale.
const fresh = (over = {}) => ({ session: 'conveyor-2667', acquiredAt: new Date(NOW - 60_000).toISOString(), ttlMinutes: DEFAULT_LEASE_TTL_MINUTES, host: 'Mac', pid: 111, ...over });
// A lease acquired long past its TTL (and long past the grace window).
const stale = (over = {}) => ({ session: 'conveyor-2500', acquiredAt: new Date(NOW - (DEFAULT_LEASE_TTL_MINUTES + 60) * 60_000).toISOString(), ttlMinutes: DEFAULT_LEASE_TTL_MINUTES, host: 'Mac', pid: 222, ...over });
// A lease past the listing-visibility grace window but nowhere near TTL — the shape session-gone exists for.
const agedPastGrace = (over = {}) => ({ session: 'conveyor-3466', acquiredAt: new Date(NOW - (GRACE_MS + 5 * 60_000)).toISOString(), ttlMinutes: DEFAULT_LEASE_TTL_MINUTES, host: 'Mac', pid: 333, ...over });

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

describe('classifyReap — session-gone axis (the real fix for the 2026-09-04/05 dead-session incident)', () => {
  it('a FRESH lease whose session is confirmed gone → reap (session-gone), even pre-TTL', () => {
    expect(classifyReap(fresh(), { nowMs: NOW, ttlMs: TTL_MS, sessionGone: true })).toEqual({ reap: true, reason: 'session-gone' });
  });
  it('a FRESH lease whose session is still alive (sessionGone=false) → keep', () => {
    expect(classifyReap(fresh(), { nowMs: NOW, ttlMs: TTL_MS, sessionGone: false })).toEqual({ reap: false, reason: null });
  });
  it('sessionGone=null (unknown — no dispatcher-minted name, or the listing was unavailable) never reaps a fresh lease', () => {
    expect(classifyReap(fresh(), { nowMs: NOW, ttlMs: TTL_MS, sessionGone: null })).toEqual({ reap: false, reason: null });
  });
  it('PR-terminal still wins over session-gone (a merged PR is the stronger, more specific signal)', () => {
    expect(classifyReap(fresh(), { nowMs: NOW, ttlMs: TTL_MS, prState: 'merged', sessionGone: true })).toEqual({ reap: true, reason: 'pr-merged' });
  });
  it('session-gone wins over TTL-stale in the reported reason (both true → the more informative axis names it)', () => {
    expect(classifyReap(stale(), { nowMs: NOW, ttlMs: TTL_MS, sessionGone: true })).toEqual({ reap: true, reason: 'session-gone' });
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
  it('reserved + session-gone → keep (reserved short-circuits before the session-gone axis too)', () => {
    expect(classifyReap(fresh({ reserved: true }), { nowMs: NOW, ttlMs: TTL_MS, sessionGone: true })).toEqual({ reap: false, reason: 'reserved' });
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

describe('sessionStateByName — claude agents --json --all listing → background-only name→state Map', () => {
  it('maps background rows by name; a live conveyor build reads its own state', () => {
    const m = sessionStateByName([
      { kind: 'background', name: 'conveyor-3466', state: 'working' },
      { kind: 'background', name: 'conveyor-2412', state: 'done' },
    ]);
    expect(m.get('conveyor-3466')).toBe('working');
    expect(m.get('conveyor-2412')).toBe('done');
  });
  it('excludes interactive rows even if named the same as a dispatcher slug', () => {
    const m = sessionStateByName([{ kind: 'interactive', name: 'conveyor-3466', state: 'working' }]);
    expect(m.has('conveyor-3466')).toBe(false);
  });
  it('a row with no usable name is skipped; malformed/empty input → empty map', () => {
    const m = sessionStateByName([{ kind: 'background', state: 'done' }, null, {}]);
    expect(m.size).toBe(0);
    expect(sessionStateByName([]).size).toBe(0);
    expect(sessionStateByName(null).size).toBe(0);
  });
  it('AGENT_GONE_STATES is exactly done/failed/stopped — the vocabulary session-reaper.mjs already reaps on', () => {
    expect([...AGENT_GONE_STATES].sort()).toEqual(['done', 'failed', 'stopped']);
  });
});

describe('sessionStatesForReap — #1921 review fix: an ALL-EMPTY listing degrades to axis-off, not "everyone gone"', () => {
  it('some background rows present → the same Map sessionStateByName would build', () => {
    const sessions = [{ kind: 'background', name: 'conveyor-9999', state: 'working' }];
    expect(sessionStatesForReap(sessions)).toEqual(sessionStateByName(sessions));
  });
  it('ZERO background rows (empty array, all-interactive, or malformed) → null, never an empty Map', () => {
    // A `claude agents --json --all` call that parses but yields nothing usable is indistinguishable from a
    // bad/incomplete read — treating it as "confirmed nobody is dispatched" would read every dispatcher-named
    // lease's session as gone and mass-reap the fleet on one bad read (the exact review finding on #1921).
    expect(sessionStatesForReap([])).toBe(null);
    expect(sessionStatesForReap([{ kind: 'interactive', name: 'conveyor-1', state: 'working' }])).toBe(null);
    expect(sessionStatesForReap(null)).toBe(null);
    expect(sessionStatesForReap(undefined)).toBe(null);
  });
});

describe('sessionGoneForLease — THE FIX: is the lease\'s own delivery-agent session confirmed gone?', () => {
  it('the live 2026-09-04/05 incident shape: session ABSENT + past the listing-visibility grace window → true (gone)', () => {
    // conveyor-3466 (lane-38) and conveyor-2412/2412c (lane-40) died/disappeared entirely from `claude agents
    // --json` — not merely `done`/`failed`, simply not listed at all, confirmed dead via `ps -p <pid>`. Both
    // leases had been held far longer than the listing could plausibly still be "not yet caught up".
    const states = sessionStateByName([{ kind: 'background', name: 'conveyor-9999', state: 'working' }]);
    const agedLease = (session) => ({ session, acquiredAt: new Date(NOW - (GRACE_MS + 5 * 60_000)).toISOString() });
    expect(sessionGoneForLease(agedLease('conveyor-3466'), states, { nowMs: NOW })).toBe(true);
    expect(sessionGoneForLease(agedLease('conveyor-2412'), states, { nowMs: NOW })).toBe(true);
    // The retry variant is an EXACT, separate name — not collapsed — and is checked the same way.
    expect(sessionGoneForLease(agedLease('conveyor-2412c'), states, { nowMs: NOW })).toBe(true);
  });

  // ── #1921 independent review, security/concurrency-race finding (CONFIRMED) — the grace window ─────────────

  it('session ABSENT but the lease is STILL INSIDE the grace window → null (too young to judge, NOT gone)', () => {
    // A lease acquired seconds/minutes ago whose delivery agent has not yet had time to appear in `claude
    // agents --json --all` (dispatch-lane.mjs's own measured listing-visibility lag) must never be reaped just
    // because it isn't listed YET — that force-releases a live lane before its agent has committed anything,
    // reintroducing #3283 ("the lease reaper reclaims a lane seconds after it is acquired") through this axis.
    const states = sessionStateByName([{ kind: 'background', name: 'conveyor-9999', state: 'working' }]);
    expect(sessionGoneForLease(fresh({ session: 'conveyor-3466' }), states, { nowMs: NOW })).toBe(null);
    // Just under the boundary is still too young.
    const almostGrace = { session: 'conveyor-3466', acquiredAt: new Date(NOW - (GRACE_MS - 1000)).toISOString() };
    expect(sessionGoneForLease(almostGrace, states, { nowMs: NOW })).toBe(null);
  });
  it('session ABSENT, exactly at / just past the grace boundary → true (gone)', () => {
    const states = sessionStateByName([{ kind: 'background', name: 'conveyor-9999', state: 'working' }]);
    const atGrace = { session: 'conveyor-3466', acquiredAt: new Date(NOW - GRACE_MS).toISOString() };
    expect(sessionGoneForLease(atGrace, states, { nowMs: NOW })).toBe(true);
  });
  it('session ABSENT + no nowMs supplied → null (never guess at an unknown age), even past what would be the grace window', () => {
    const states = sessionStateByName([{ kind: 'background', name: 'conveyor-9999', state: 'working' }]);
    expect(sessionGoneForLease(agedPastGrace(), states)).toBe(null);
  });
  it('session ABSENT + unparsable/missing acquiredAt → null (never guess at an unknown age)', () => {
    const states = sessionStateByName([{ kind: 'background', name: 'conveyor-9999', state: 'working' }]);
    expect(sessionGoneForLease({ session: 'conveyor-3466' }, states, { nowMs: NOW })).toBe(null);
    expect(sessionGoneForLease({ session: 'conveyor-3466', acquiredAt: 'not-a-date' }, states, { nowMs: NOW })).toBe(null);
  });
  it('a custom graceMs is honored (forward-compat knob, not asserted elsewhere)', () => {
    const states = sessionStateByName([{ kind: 'background', name: 'conveyor-9999', state: 'working' }]);
    const lease = { session: 'conveyor-3466', acquiredAt: new Date(NOW - 60_000).toISOString() }; // 1 min old
    expect(sessionGoneForLease(lease, states, { nowMs: NOW, graceMs: 30_000 })).toBe(true); // past a 30s grace
    expect(sessionGoneForLease(lease, states, { nowMs: NOW, graceMs: 5 * 60_000 })).toBe(null); // inside a 5min grace
  });

  it('a session listed in a terminal state (done/failed/stopped) → true (gone), NO grace check needed', () => {
    // A positive, directly-observed row — not an inference from silence — so even a lease acquired seconds ago
    // reaps immediately once its own session reports a terminal state.
    const states = sessionStateByName([
      { kind: 'background', name: 'conveyor-100', state: 'done' },
      { kind: 'background', name: 'conveyor-101', state: 'failed' },
      { kind: 'background', name: 'conveyor-102', state: 'stopped' },
    ]);
    expect(sessionGoneForLease(fresh({ session: 'conveyor-100' }), states, { nowMs: NOW })).toBe(true);
    expect(sessionGoneForLease(fresh({ session: 'conveyor-101' }), states, { nowMs: NOW })).toBe(true);
    expect(sessionGoneForLease(fresh({ session: 'conveyor-102' }), states, { nowMs: NOW })).toBe(true);
    // Even with no nowMs at all — the terminal-state branch never needs an age.
    expect(sessionGoneForLease({ session: 'conveyor-100' }, states)).toBe(true);
  });
  it('a session listed and still working/blocked → false (a slow build, not a dead one)', () => {
    const states = sessionStateByName([
      { kind: 'background', name: 'conveyor-200', state: 'working' },
      { kind: 'background', name: 'conveyor-201', state: 'blocked' },
    ]);
    expect(sessionGoneForLease({ session: 'conveyor-200' }, states)).toBe(false);
    expect(sessionGoneForLease({ session: 'conveyor-201' }, states)).toBe(false);
  });
  it('a session whose name matches no dispatcher grammar → null (never guess about a manual/interactive lane)', () => {
    const states = sessionStateByName([{ kind: 'background', name: 'conveyor-9', state: 'working' }]);
    expect(sessionGoneForLease({ session: 'Mac:24827' }, states, { nowMs: NOW })).toBe(null);
    expect(sessionGoneForLease({ session: 'some-adhoc-session' }, states, { nowMs: NOW })).toBe(null);
    expect(sessionGoneForLease({}, states, { nowMs: NOW })).toBe(null);
    expect(sessionGoneForLease(null, states, { nowMs: NOW })).toBe(null);
  });
  it('sessionStates not a Map (listing unavailable/all-empty this pass) → null (axis off), even for a dispatcher name', () => {
    expect(sessionGoneForLease({ session: 'conveyor-3466' }, null, { nowMs: NOW })).toBe(null);
    expect(sessionGoneForLease({ session: 'conveyor-3466' }, undefined, { nowMs: NOW })).toBe(null);
  });
});

describe('reapPlan — maps classifyReap over candidates, splitting reap vs keep', () => {
  const candidates = [
    { pool: 'web-everything', lane: 3, dir: '/x/web-everything/lane-3', lease: fresh({ session: 'conveyor-2667' }) },   // fresh, PR open, session alive → keep
    { pool: 'web-everything', lane: 5, dir: '/x/web-everything/lane-5', lease: stale({ session: 'conveyor-2500' }) },   // TTL-stale (and past grace, absent) → reap
    { pool: 'plateau-app', lane: 6, dir: '/x/plateau-app/lane-6', lease: fresh({ session: 'conveyor-2604' }) },         // fresh, PR merged → reap
    { pool: 'web-everything', lane: 7, dir: '/x/web-everything/lane-7', lease: fresh({ session: 'mem', reserved: true, acquiredAt: new Date(NOW - 10 * TTL_MS).toISOString() }) }, // reserved → keep
    { pool: 'web-everything', lane: 8, dir: '/x/web-everything/lane-8', lease: null },                                  // no lease → skipped
    { pool: 'web-everything', lane: 38, dir: '/x/web-everything/lane-38', lease: agedPastGrace() },                     // past grace, session confirmed gone → reap pre-TTL
    { pool: 'web-everything', lane: 40, dir: '/x/web-everything/lane-40', lease: fresh({ session: 'conveyor-2412' }) }, // JUST acquired, session absent but still inside grace → keep (the #1921 finding this pins)
  ];
  const prStates = new Map([['2667', 'open'], ['2604', 'merged']]);
  const sessionStates = sessionStateByName([{ kind: 'background', name: 'conveyor-2667', state: 'working' }]); // 3466/2604/2500/2412 all absent
  const signalsFor = (c) => ({
    prState: prStates.get(itemNumFromSession(c.lease?.session)) ?? null,
    sessionGone: sessionGoneForLease(c.lease, sessionStates, { nowMs: NOW }),
    pidAlive: null,
  });

  it('reaps the TTL-stale, PR-merged, and session-gone lanes; keeps the fresh-alive-open, reserved, and just-acquired; skips the lease-less', () => {
    const { reap, keep } = reapPlan(candidates, { nowMs: NOW, ttlMs: TTL_MS, signalsFor });
    // lane-5's session ('conveyor-2500') is ALSO absent from the listing AND long past the grace window, so
    // session-gone fires (checked before TTL, per classifyReap's axis order) — the more informative real
    // reason, not merely "old enough". lane-40 is absent too but only 1 minute old — inside grace — so it is
    // NOT reaped on this axis (and its TTL is nowhere close either): the #1921 finding this candidate exists
    // to pin.
    expect(reap.map((c) => `${c.pool}/lane-${c.lane}:${c.reason}`).sort()).toEqual([
      'plateau-app/lane-6:pr-merged',
      'web-everything/lane-38:session-gone',
      'web-everything/lane-5:session-gone',
    ]);
    // keep excludes the lease-less candidate (skipped entirely), includes fresh-alive-open + reserved + just-acquired
    expect(keep.map((c) => `${c.pool}/lane-${c.lane}`).sort()).toEqual(['web-everything/lane-3', 'web-everything/lane-40', 'web-everything/lane-7']);
  });

  it('with no signalsFor, only the TTL axis fires (PR/session/pid unknown)', () => {
    const { reap } = reapPlan(candidates, { nowMs: NOW, ttlMs: TTL_MS });
    expect(reap.map((c) => `${c.pool}/lane-${c.lane}:${c.reason}`)).toEqual(['web-everything/lane-5:ttl-stale']);
  });

  it('empty / non-array candidates → empty plan', () => {
    expect(reapPlan([], { nowMs: NOW })).toEqual({ reap: [], keep: [] });
    expect(reapPlan(null, { nowMs: NOW })).toEqual({ reap: [], keep: [] });
  });
});
