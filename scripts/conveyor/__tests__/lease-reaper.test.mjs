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
 *
 *   #3383 (2026-09-14 mechanical-dispatcher incident) — ALSO pins the PHANTOM-LISTING widening: a
 *   `claude agents --json --all` row can be LISTED, in a non-terminal state, with NO backing OS process at all
 *   (confirmed live: 12 of 14 "leased" lanes had no corroborating process anywhere on the box via `ps`/`lsof`,
 *   several sessions silent 4+ hours, none within their 240-minute TTL). `sessionPidAliveByName` (the real
 *   process-liveness reduction, reusing `driver-watchdog.mjs`'s own two-signal probe) and
 *   `sessionGoneForLease`'s new `pidAlive` input are exercised directly, proving a listed-but-dead session now
 *   reaps even while its recorded state is still `working`/`blocked` and its lease is nowhere near TTL.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  classifyReap,
  reapPlan,
  itemNumFromSession,
  prNumFromSession,
  sessionSlugAttemptTag,
  laneRefItemNum,
  laneRefAttemptTag,
  prStatesFromList,
  prStatesByPrNumber,
  pidAliveForLease,
  sessionStateByName,
  sessionStatesForReap,
  sessionGoneForLease,
  sessionPidAliveByName,
  AGENT_GONE_STATES,
  repoKeyForPool,
  fetchPrStatesForRepo,
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

describe('itemNumFromSession — the couple key encoded in a lease session (TRUE item-kind sessions ONLY)', () => {
  it('conveyor-/prepare-/prepare-decision- sessions → the trailing item number', () => {
    expect(itemNumFromSession('conveyor-2667')).toBe('2667');
    expect(itemNumFromSession('prepare-2604')).toBe('2604');
    expect(itemNumFromSession('prepare-decision-2647')).toBe('2647');
  });
  // #x5wm9ot — `fix-<N>`'s `N` IS A PR NUMBER (`mintSessionSlug({kind:'fix', id: pr})`, every real call site),
  // a DIFFERENT namespace from a true item number — see `prNumFromSession` for the function that reads it out.
  // This used to return `N` here too, which is exactly bug #1: a `fix-<PR>` session's PR number, fed into a
  // Map keyed by the item number embedded in a PR's own head ref, hit the wrong (or no) entry.
  it('fix-<PR> (and every other PR_KIND) is NOT an item number — null here, use prNumFromSession instead', () => {
    expect(itemNumFromSession('fix-2630')).toBeNull();
    expect(itemNumFromSession('review-2630')).toBeNull();
    expect(itemNumFromSession('ci-heal-2630')).toBeNull();
    expect(itemNumFromSession('inspect-2630')).toBeNull();
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

// #x5wm9ot — the PR-number counterpart to itemNumFromSession: EVERY PR_KIND (review/fix/ci-heal/inspect, not
// fix alone — bug #2's own widening) resolves its own PR number here; every item-kind session (and every
// non-dispatcher name) is null. The two functions must never both resolve the SAME session to a non-null
// value — that would mean a lease's number is ambiguous between "a PR" and "a backlog item".
describe('prNumFromSession — the PR number a PR_KIND session slug encodes (a DIFFERENT namespace from itemNumFromSession)', () => {
  it('every PR_KIND resolves its PR number', () => {
    expect(prNumFromSession('fix-2630')).toBe('2630');
    expect(prNumFromSession('review-2630')).toBe('2630');
    expect(prNumFromSession('ci-heal-2630')).toBe('2630');
    expect(prNumFromSession('inspect-2630')).toBe('2630');
  });
  it('a multi-repo tag still resolves the PR number (#xr4ygg7 widening, unaffected by the #x5wm9ot split)', () => {
    expect(prNumFromSession('fix-fui-49')).toBe('49');
    expect(prNumFromSession('review-pa-49')).toBe('49');
  });
  it('item-kind sessions are NOT PR numbers — null here', () => {
    expect(prNumFromSession('conveyor-2667')).toBeNull();
    expect(prNumFromSession('prepare-2604')).toBeNull();
    expect(prNumFromSession('prepare-decision-2647')).toBeNull();
  });
  it('a non-dispatcher name → null', () => {
    expect(prNumFromSession('Mac:24827')).toBeNull();
    expect(prNumFromSession('')).toBeNull();
    expect(prNumFromSession(null)).toBeNull();
  });
  it('itemNumFromSession and prNumFromSession never both resolve the same session — the two namespaces are disjoint', () => {
    for (const s of ['conveyor-2667', 'fix-2630', 'review-49', 'ci-heal-1', 'inspect-9', 'prepare-1', 'Mac:1', 'probe1', '', null]) {
      expect(itemNumFromSession(s) !== null && prNumFromSession(s) !== null).toBe(false);
    }
  });
});

// #3110 — the retry-suffix letter, previously parsed only to be discarded, now read as the entry's own
// attempt identity so `classifyDispatchPr` can tell "my own retry's PR" from "a sibling attempt's PR".
describe('sessionSlugAttemptTag — the attempt identity a conveyor-<id>[a-z] session slug carries', () => {
  it('an unsuffixed slug is a genuine first attempt — empty string, not null', () => {
    expect(sessionSlugAttemptTag('conveyor-2667')).toBe('');
    expect(sessionSlugAttemptTag('fix-2630')).toBe('');
    expect(sessionSlugAttemptTag('prepare-2604')).toBe('');
    expect(sessionSlugAttemptTag('prepare-decision-2647')).toBe('');
  });
  it('a retry-suffixed slug carries its letter', () => {
    expect(sessionSlugAttemptTag('conveyor-2500b')).toBe('b');
    expect(sessionSlugAttemptTag('conveyor-2500c')).toBe('c');
  });
  it('lower-cases a shouty suffix, matching itemNumFromSession\'s own convention', () => {
    expect(sessionSlugAttemptTag('conveyor-2500B')).toBe('b');
  });
  it('not a conveyor session slug at all → null, distinct from the empty-string first-attempt tag', () => {
    expect(sessionSlugAttemptTag('Mac:24827')).toBe(null);
    expect(sessionSlugAttemptTag('shell-fix')).toBe(null);
    expect(sessionSlugAttemptTag('')).toBe(null);
    expect(sessionSlugAttemptTag(null)).toBe(null);
  });
  it('agrees with itemNumFromSession about which ITEM-KIND slugs match (both read the same underlying grammar)', () => {
    for (const s of ['conveyor-2667', 'conveyor-2500b', 'Mac:24827', 'probe1', '', null]) {
      expect(sessionSlugAttemptTag(s) === null).toBe(itemNumFromSession(s) === null);
    }
  });
  // #x5wm9ot — sessionSlugAttemptTag matches EVERY kind matchSessionSlug recognizes (item-kind AND every
  // PR_KIND — it only ever reads the attempt letter, which carries no PR-vs-item ambiguity), so for a PR_KIND
  // slug it now DISAGREES with itemNumFromSession on purpose: itemNumFromSession is item-kind-only (see its own
  // describe block), but a `fix-`/`review-`/`ci-heal-`/`inspect-` slug is still a real, recognized session —
  // just not an item number. `prNumFromSession` is the one that agrees with sessionSlugAttemptTag here.
  it('a PR_KIND slug is recognized (non-null tag) even though itemNumFromSession reads it as null — prNumFromSession is the one that agrees', () => {
    for (const s of ['fix-2630', 'review-49', 'ci-heal-1', 'inspect-9']) {
      expect(sessionSlugAttemptTag(s)).not.toBeNull();
      expect(itemNumFromSession(s)).toBeNull();
      expect(prNumFromSession(s)).not.toBeNull();
    }
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

  // #3110
  it('laneRefAttemptTag mirrors sessionSlugAttemptTag\'s null/empty-string distinction', () => {
    expect(laneRefAttemptTag('lane/2667-conveyor-auto-release')).toBe(''); // first attempt
    expect(laneRefAttemptTag('lane/2500b-retry-slug')).toBe('b');
    expect(laneRefAttemptTag('lane/2500B-shouty')).toBe('b');
    expect(laneRefAttemptTag('lane/x9ylkp7-hash-item')).toBe(''); // a hash-id ref is a first attempt too
    expect(laneRefAttemptTag('main')).toBe(null);
    expect(laneRefAttemptTag('lane/build-3095')).toBe(null); // matches no item at all
    expect(laneRefAttemptTag(null)).toBe(null);
  });
  it('never disagrees with laneRefItemNum about which refs match at all', () => {
    for (const r of ['lane/2667-x', 'lane/2500b-x', 'main', 'lane/build-3095', 'lane/2667', null]) {
      expect(laneRefAttemptTag(r) === null).toBe(laneRefItemNum(r) === null);
    }
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

// #x5wm9ot (bug #1) — the PR-NUMBER-keyed counterpart to prStatesFromList's item-number-keyed Map. A PR_KIND
// lease's PR-terminal check must read THIS Map (by the PR's own number), never the head-ref-keyed one.
describe('prStatesByPrNumber — PR-number → state reduction (same open-wins priority as prStatesFromList, different key)', () => {
  it('keys by the PR\'s OWN number, ignoring headRefName entirely', () => {
    const m = prStatesByPrNumber([
      { number: 900, headRefName: 'lane/181-something', state: 'MERGED', mergedAt: '2026-09-22T00:00:00Z' },
      { number: 901, headRefName: 'some-other-branch', state: 'CLOSED' },
      { number: 902, headRefName: null, state: 'OPEN' },
    ]);
    expect(m.get('900')).toBe('merged');
    expect(m.get('901')).toBe('closed');
    expect(m.get('902')).toBe('open');
    // Critically, the ITEM number embedded in PR #900's head ref (181) is NOT a key in this Map at all.
    expect(m.has('181')).toBe(false);
  });
  it('open wins over a terminal state for the SAME PR number (defensive — gh never actually reuses one)', () => {
    const m = prStatesByPrNumber([{ number: 5, state: 'CLOSED' }, { number: 5, state: 'OPEN' }]);
    expect(m.get('5')).toBe('open');
  });
  it('a PR with no usable number is ignored; empty input → empty map', () => {
    expect(prStatesByPrNumber([{ state: 'MERGED' }, null, {}]).size).toBe(0);
    expect(prStatesByPrNumber([]).size).toBe(0);
    expect(prStatesByPrNumber(null).size).toBe(0);
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

  // #x2psfwz (bug #5) — review-<PR>/fix-<PR> carry no attempt suffix, so a round-2 dispatch reuses round 1's
  // exact name. `claude agents --json --all` can list BOTH a not-yet-pruned round-1 row and round-2's own live
  // row under that one name, in an order this CLI documents nowhere. This used to be a bare `.set()` per row —
  // whichever came LAST in the array won, so a live round-2 session could be masked as done/failed/stopped by
  // a stale duplicate that merely happened to sort after it.
  describe('duplicate names (round-2 reuse, #x2psfwz) — a terminal row never masks an already-recorded LIVE one', () => {
    it('live-then-terminal (stale duplicate arrives AFTER the live row): the live reading survives', () => {
      const m = sessionStateByName([
        { kind: 'background', name: 'review-1234', state: 'working' },  // round 2, live
        { kind: 'background', name: 'review-1234', state: 'done' },    // stale round-1 duplicate, listed later
      ]);
      expect(m.get('review-1234')).toBe('working');
    });
    it('terminal-then-live (order the OLD code happened to get right) still reads live — order must never matter', () => {
      const m = sessionStateByName([
        { kind: 'background', name: 'review-1234', state: 'done' },
        { kind: 'background', name: 'review-1234', state: 'working' },
      ]);
      expect(m.get('review-1234')).toBe('working');
    });
    it('two terminal duplicates: either is a correct "gone" reading — harmless either way', () => {
      const m = sessionStateByName([
        { kind: 'background', name: 'fix-99', state: 'failed' },
        { kind: 'background', name: 'fix-99', state: 'done' },
      ]);
      expect(AGENT_GONE_STATES.has(m.get('fix-99'))).toBe(true);
    });
    it('two live duplicates: either live reading is correct — harmless either way', () => {
      const m = sessionStateByName([
        { kind: 'background', name: 'fix-99', state: 'blocked' },
        { kind: 'background', name: 'fix-99', state: 'working' },
      ]);
      expect(AGENT_GONE_STATES.has(m.get('fix-99'))).toBe(false);
    });
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

  // #x5wm9ot (bug #2) — review-/ci-heal-/inspect- sessions used to fail the dispatcher-minted gate ABOVE
  // (`matchSessionSlug` matched only itemKind || kind==='fix'), so this whole axis was permanently OFF for
  // them — a dead review/ci-heal/inspect lane was reclaimed only by the 4h TTL backstop, never pre-TTL, no
  // matter how confidently `claude agents` reported it done. Now every PR_KIND is recognized here too.
  it('bug #2 — review-/ci-heal-/inspect- sessions are NOW recognized by this gate (were: always null, TTL-only)', () => {
    const states = sessionStateByName([
      { kind: 'background', name: 'review-1871', state: 'done' },
      { kind: 'background', name: 'ci-heal-1872', state: 'working' },
    ]);
    expect(sessionGoneForLease({ session: 'review-1871' }, states, { nowMs: NOW })).toBe(true);  // listed, terminal → gone
    expect(sessionGoneForLease({ session: 'ci-heal-1872' }, states, { nowMs: NOW })).toBe(false); // listed, still working → not gone
    // Absent + past the grace window → gone, exactly like an item-kind session already worked.
    expect(sessionGoneForLease({ session: 'inspect-1873', acquiredAt: new Date(NOW - (GRACE_MS + 5 * 60_000)).toISOString() }, states, { nowMs: NOW })).toBe(true);
  });

  // ── #3383 (2026-09-14) — THE PHANTOM-LISTING WIDENING: a LISTED, non-terminal session with NO real process ──

  it('LIVE INCIDENT SHAPE: listed as "working" (not terminal) but pidAlive=false → gone, no grace/age needed', () => {
    // This is exactly what made 12 of 14 lane leases un-reapable for hours: the registered session still shows
    // up in the listing with a perfectly ordinary in-progress state, so neither the absence branch nor
    // AGENT_GONE_STATES ever fires — only a REAL liveness read catches it.
    const states = sessionStateByName([{ kind: 'background', name: 'conveyor-62', state: 'working' }]);
    expect(sessionGoneForLease({ session: 'conveyor-62' }, states, { pidAlive: false })).toBe(true);
    // No nowMs supplied at all — the pidAlive branch needs no age/clock, unlike the absence branch.
    expect(sessionGoneForLease({ session: 'conveyor-62' }, states, { pidAlive: false })).toBe(true);
  });
  it('listed as "blocked" with pidAlive=false → gone too (any non-terminal state, not just "working")', () => {
    const states = sessionStateByName([{ kind: 'background', name: 'conveyor-63', state: 'blocked' }]);
    expect(sessionGoneForLease({ session: 'conveyor-63' }, states, { pidAlive: false })).toBe(true);
  });
  it('pidAlive=false wins even for a lease acquired moments ago — it is a direct read, not an inference needing a grace window', () => {
    const states = sessionStateByName([{ kind: 'background', name: 'conveyor-64', state: 'working' }]);
    const justAcquired = { session: 'conveyor-64', acquiredAt: new Date(NOW - 5_000).toISOString() };
    expect(sessionGoneForLease(justAcquired, states, { nowMs: NOW, pidAlive: false })).toBe(true);
  });
  it('pidAlive=true → unchanged (a listed, non-terminal, REALLY alive session stays kept)', () => {
    const states = sessionStateByName([{ kind: 'background', name: 'conveyor-65', state: 'working' }]);
    expect(sessionGoneForLease({ session: 'conveyor-65' }, states, { pidAlive: true })).toBe(false);
  });
  it('pidAlive=null (unknown/not supplied) → falls through to the pre-#3383 listed-state logic unchanged', () => {
    const states = sessionStateByName([{ kind: 'background', name: 'conveyor-66', state: 'working' }]);
    expect(sessionGoneForLease({ session: 'conveyor-66' }, states, { pidAlive: null })).toBe(false);
    expect(sessionGoneForLease({ session: 'conveyor-66' }, states)).toBe(false); // default omitted entirely
  });
  it('pidAlive=false on a session absent from the listing altogether → still gone (the stronger signal still fires)', () => {
    const states = sessionStateByName([{ kind: 'background', name: 'conveyor-9999', state: 'working' }]);
    expect(sessionGoneForLease({ session: 'conveyor-67' }, states, { pidAlive: false })).toBe(true);
  });
});

describe('sessionPidAliveByName — #3383 real process-liveness per session, reusing driver-watchdog\'s own probe', () => {
  it('a row with its own pid uses the direct kill(pid,0) probe, never the ps scan', () => {
    const isPidAlive = vi.fn((pid) => pid === 111);
    const m = sessionPidAliveByName(
      [{ kind: 'background', name: 'conveyor-1', pid: 111 }, { kind: 'background', name: 'conveyor-2', pid: 222 }],
      { psOutput: 'irrelevant', isPidAlive },
    );
    expect(m.get('conveyor-1')).toBe(true);
    expect(m.get('conveyor-2')).toBe(false);
  });
  it('a row with only a sessionId falls back to scanning the ps aux capture for its full id', () => {
    const m = sessionPidAliveByName(
      [
        { kind: 'background', name: 'conveyor-live', sessionId: 'aaaa1111-bbbb-cccc-dddd-eeeeeeeeeeee' },
        { kind: 'background', name: 'conveyor-dead', sessionId: 'ffff2222-bbbb-cccc-dddd-eeeeeeeeeeee' },
      ],
      { psOutput: 'claude --resume=aaaa1111-bbbb-cccc-dddd-eeeeeeeeeeee some-other-flags' },
    );
    expect(m.get('conveyor-live')).toBe(true);
    expect(m.get('conveyor-dead')).toBe(false);
  });
  it('no pid, no sessionId, or psOutput unavailable → null (unknown, never a false death)', () => {
    const m = sessionPidAliveByName([{ kind: 'background', name: 'conveyor-x' }], { psOutput: null });
    expect(m.get('conveyor-x')).toBe(null);
  });
  it('interactive rows are excluded, matching sessionStateByName\'s own guard', () => {
    const m = sessionPidAliveByName([{ kind: 'interactive', name: 'conveyor-1', pid: 111 }], { isPidAlive: () => true });
    expect(m.has('conveyor-1')).toBe(false);
  });
  it('malformed/empty input → empty map', () => {
    expect(sessionPidAliveByName([null, {}, { kind: 'background' }]).size).toBe(0);
    expect(sessionPidAliveByName([]).size).toBe(0);
    expect(sessionPidAliveByName(null).size).toBe(0);
  });
});

describe('reapPlan — the #3383 phantom-listing shape end to end (classifyReap + sessionGoneForLease + sessionPidAliveByName)', () => {
  it('a fresh, well-within-TTL lease whose session is listed "working" but has NO real process → reaped as session-gone', () => {
    // The exact incident shape: lane-62's lease looked identical to a healthy in-progress build from every axis
    // except real process liveness — acquired recently, session still in the listing, state ordinary, TTL nowhere
    // close. Only the ps-scan-backed pidAlive read tells them apart.
    const lease = fresh({ session: 'conveyor-62' });
    const sessions = [{ kind: 'background', name: 'conveyor-62', sessionId: 'dead0000-0000-0000-0000-000000000000', state: 'working' }];
    const sessionStates = sessionStatesForReap(sessions);
    const pidAliveByName = sessionPidAliveByName(sessions, { psOutput: 'no matching session ids in this ps aux capture' });
    const signalsFor = (c) => ({
      prState: null,
      sessionGone: sessionGoneForLease(c.lease, sessionStates, { nowMs: NOW, pidAlive: pidAliveByName.get(c.lease.session) ?? null }),
      pidAlive: null,
    });
    const { reap, keep } = reapPlan([{ pool: 'web-everything', lane: 62, dir: '/x/lane-62', lease }], { nowMs: NOW, ttlMs: TTL_MS, signalsFor });
    expect(reap).toHaveLength(1);
    expect(reap[0].reason).toBe('session-gone');
    expect(keep).toHaveLength(0);
  });
  it('the SAME shape but the ps aux capture DOES contain the session id (a real live process) → kept', () => {
    const lease = fresh({ session: 'conveyor-63' });
    const sessions = [{ kind: 'background', name: 'conveyor-63', sessionId: 'aliv0000-0000-0000-0000-000000000000', state: 'working' }];
    const sessionStates = sessionStatesForReap(sessions);
    const pidAliveByName = sessionPidAliveByName(sessions, { psOutput: 'claude --resume=aliv0000-0000-0000-0000-000000000000' });
    const signalsFor = (c) => ({
      prState: null,
      sessionGone: sessionGoneForLease(c.lease, sessionStates, { nowMs: NOW, pidAlive: pidAliveByName.get(c.lease.session) ?? null }),
      pidAlive: null,
    });
    const { reap, keep } = reapPlan([{ pool: 'web-everything', lane: 63, dir: '/x/lane-63', lease }], { nowMs: NOW, ttlMs: TTL_MS, signalsFor });
    expect(reap).toHaveLength(0);
    expect(keep).toHaveLength(1);
  });
  it('a RESERVED lease is never reaped even when its session reads phantom-dead (reserved short-circuits first)', () => {
    const lease = fresh({ session: 'mem-lane', reserved: true });
    const sessions = [{ kind: 'background', name: 'mem-lane', sessionId: 'dead0000-0000-0000-0000-000000000000', state: 'working' }];
    const sessionStates = sessionStatesForReap(sessions);
    const pidAliveByName = sessionPidAliveByName(sessions, { psOutput: '' });
    const signalsFor = (c) => ({
      prState: null,
      sessionGone: sessionGoneForLease(c.lease, sessionStates, { nowMs: NOW, pidAlive: pidAliveByName.get(c.lease.session) ?? null }),
      pidAlive: null,
    });
    const { reap, keep } = reapPlan([{ pool: 'web-everything', lane: 7, dir: '/x/lane-7', lease }], { nowMs: NOW, ttlMs: TTL_MS, signalsFor });
    expect(reap).toHaveLength(0);
    expect(keep).toHaveLength(1);
    expect(keep[0].reason).toBe('reserved');
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

// #xr4ygg7 (multi-repo slice 9) + #x5wm9ot (bug #2) — a PR_KIND session (fix/review/ci-heal/inspect) now
// resolves its PR number for ANY constellation repo, via prNumFromSession — never itemNumFromSession, which is
// item-kind-only (bug #1's fix). Before #x5wm9ot, `review-`/`ci-heal-`/`inspect-` sessions matched NEITHER
// function at all (only `fix` did) — bug #2's exact TTL-only fallback.
it('every PR_KIND session (fix/review/ci-heal/inspect) resolves its PR number for ANY constellation repo — never itemNumFromSession', () => {
  for (const kind of ['fix', 'review', 'ci-heal', 'inspect']) {
    expect(prNumFromSession(`${kind}-fui-49`)).toBe('49');
    expect(prNumFromSession(`${kind}-pa-49`)).toBe('49');
    expect(prNumFromSession(`${kind}-49`)).toBe('49');
    expect(itemNumFromSession(`${kind}-49`)).toBeNull();
  }
});

describe('repoKeyForPool — #xr4ygg7 the repo a lane-pool DIRECTORY NAME names (ground truth)', () => {
  it('maps every known pool dir name to its repo key', () => {
    expect(repoKeyForPool('web-everything')).toBe('we');
    expect(repoKeyForPool('webeverything')).toBe('we');
    expect(repoKeyForPool('frontierui')).toBe('frontierui');
    expect(repoKeyForPool('plateau-app')).toBe('plateau-app');
  });
  it('an unrecognized pool dir name → null (a one-off scratch clone, never a real per-repo lane pool)', () => {
    expect(repoKeyForPool('we-drain-daemon')).toBeNull();
    expect(repoKeyForPool('pipeline-2248')).toBeNull();
    expect(repoKeyForPool('')).toBeNull();
  });
});

describe('fetchPrStatesForRepo — #xr4ygg7 ONE gh pr list PER REPO, never one shared always-WE read', () => {
  it('scopes the gh call to the repo\'s own constellation slug via --repo, and returns BOTH keyspaces from the one fetch (#x5wm9ot)', () => {
    const calls = [];
    // PR #900 has head ref `lane/181-x` (item 181's couple) — its OWN PR number (900) is a DIFFERENT number
    // from that item number, on purpose: this is exactly the fix-<PR>-vs-item-number distinction bug #1 named.
    const exec = (cmd, args) => { calls.push({ cmd, args }); return JSON.stringify([{ number: 900, headRefName: 'lane/181-x', state: 'MERGED', mergedAt: '2026-09-22T00:00:00Z' }]); };
    const states = fetchPrStatesForRepo('plateau-app', {}, { exec });
    expect(calls).toHaveLength(1);
    expect(calls[0].cmd).toBe('gh');
    expect(calls[0].args).toContain('--repo');
    expect(calls[0].args[calls[0].args.indexOf('--repo') + 1]).toBe('chalbert/plateau-app');
    expect(states.byItem.get('181')).toBe('merged');  // an item-kind (conveyor-181) lookup
    expect(states.byPr.get('900')).toBe('merged');    // a PR_KIND (fix-900) lookup — DIFFERENT key, same fetch
    expect(states.byItem.get('900')).toBeUndefined(); // the PR's own number is NOT in the item-keyed map
    expect(states.byPr.get('181')).toBeUndefined();   // the item number is NOT in the PR-keyed map
  });
  it('--pr-repo overrides the slug for we ONLY — a sibling repo always reads its own real slug', () => {
    const calls = [];
    const exec = (cmd, args) => { calls.push(args); return '[]'; };
    fetchPrStatesForRepo('we', { 'pr-repo': 'chalbert/some-fork' }, { exec });
    expect(calls[0][calls[0].indexOf('--repo') + 1]).toBe('chalbert/some-fork');
    fetchPrStatesForRepo('frontierui', { 'pr-repo': 'chalbert/some-fork' }, { exec });
    expect(calls[1][calls[1].indexOf('--repo') + 1]).toBe('chalbert/frontierui');
  });
  it('--no-check-prs disables the axis with no exec call at all', () => {
    const exec = () => { throw new Error('must not be called'); };
    expect(fetchPrStatesForRepo('we', { 'no-check-prs': true }, { exec })).toBeNull();
  });
  it('an unrecognized repo key → null, no exec call (no slug to scope the read to)', () => {
    const exec = () => { throw new Error('must not be called'); };
    expect(fetchPrStatesForRepo('not-a-real-repo', {}, { exec })).toBeNull();
  });
  it('a gh failure degrades this repo\'s axis to null (TTL-stale still applies), never throws', () => {
    const exec = () => { throw new Error('gh: not authenticated'); };
    expect(fetchPrStatesForRepo('we', {}, { exec })).toBeNull();
  });
});

describe('#xr4ygg7 — the collision hazard the per-repo split closes: same NUMBER, different repos', () => {
  // Reproduces main()'s own composition (candidates tagged by POOL via repoKeyForPool, one {byItem, byPr} pair
  // per distinct repo, signalsFor scoped by each candidate's own repoKey AND its own itemKind-vs-PR_KIND split)
  // using only the exported pure pieces — no fs/gh touched. Proves the exact hazard `fetchPrStatesForRepo`'s
  // docblock names never actually fires: a WE PR #49 merging must NEVER reap a plateau-app lease for its OWN,
  // unrelated item 49 whose real PR is open.
  it('never reaps a live plateau-app lease just because a same-numbered WE PR merged', () => {
    const candidates = [
      { pool: 'web-everything', lane: 3, dir: '/x/web-everything/lane-3', lease: { session: 'fix-49', acquiredAt: new Date(NOW - 60_000).toISOString(), ttlMinutes: DEFAULT_LEASE_TTL_MINUTES }, repoKey: repoKeyForPool('web-everything') },
      { pool: 'plateau-app', lane: 6, dir: '/x/plateau-app/lane-6', lease: { session: 'fix-pa-49', acquiredAt: new Date(NOW - 60_000).toISOString(), ttlMinutes: DEFAULT_LEASE_TTL_MINUTES }, repoKey: repoKeyForPool('plateau-app') },
    ];
    const prStatesByRepo = new Map([
      ['we', { byItem: new Map(), byPr: new Map([['49', 'merged']]) }],       // WE's own PR #49 merged
      ['plateau-app', { byItem: new Map(), byPr: new Map([['49', 'open']]) }], // plateau-app's own PR #49 is still open — unrelated work
    ]);
    const signalsFor = (c) => {
      const itemNum = itemNumFromSession(c.lease?.session);
      const prNum = prNumFromSession(c.lease?.session);
      const repoStates = c.repoKey ? prStatesByRepo.get(c.repoKey) : null;
      const prState = repoStates ? (itemNum != null ? repoStates.byItem.get(itemNum) : prNum != null ? repoStates.byPr.get(prNum) : null) ?? null : null;
      return { prState, sessionGone: null, pidAlive: null };
    };
    const { reap, keep } = reapPlan(candidates, { nowMs: NOW, ttlMs: TTL_MS, signalsFor });
    expect(reap.map((c) => `${c.pool}/lane-${c.lane}:${c.reason}`)).toEqual(['web-everything/lane-3:pr-merged']);
    expect(keep.map((c) => `${c.pool}/lane-${c.lane}`)).toEqual(['plateau-app/lane-6']);
  });

  // #x5wm9ot — bug #1's OWN reproduction: a fix-<PR> session's PR number must be checked against the PR-keyed
  // Map, never the item-number-keyed one, even when they happen to share a repo. Here the couple's ITEM number
  // (181) and the fix session's PR number (49) are DELIBERATELY DIFFERENT and DELIBERATELY DISAGREE in state
  // (open vs merged) — using the wrong Map for either lookup would flip the verdict.
  it('bug #1 — a fix-<PR> session checks the PR-keyed Map by its OWN PR number, never the item-keyed Map', () => {
    const candidates = [
      { pool: 'web-everything', lane: 9, dir: '/x/web-everything/lane-9', lease: { session: 'fix-49', acquiredAt: new Date(NOW - 60_000).toISOString(), ttlMinutes: DEFAULT_LEASE_TTL_MINUTES }, repoKey: 'we' },
    ];
    // item 181 (an unrelated card, coincidentally open) vs PR #49 (the fix session's OWN target, merged).
    const repoStates = { byItem: new Map([['181', 'open']]), byPr: new Map([['49', 'merged']]) };
    const signalsFor = (c) => {
      const itemNum = itemNumFromSession(c.lease?.session);
      const prNum = prNumFromSession(c.lease?.session);
      const prState = (itemNum != null ? repoStates.byItem.get(itemNum) : prNum != null ? repoStates.byPr.get(prNum) : null) ?? null;
      return { prState, sessionGone: null, pidAlive: null };
    };
    const { reap } = reapPlan(candidates, { nowMs: NOW, ttlMs: TTL_MS, signalsFor });
    // Correctly reaped via the PR-keyed lookup (PR #49 is merged) — the old bug would have looked itemNum (null,
    // since itemNumFromSession('fix-49') is null post-fix) up nowhere, or, pre-fix, have used '49' as an ITEM
    // number and wrongly read item 181's unrelated 'open' state (or nothing at all).
    expect(reap.map((c) => `${c.pool}/lane-${c.lane}:${c.reason}`)).toEqual(['web-everything/lane-9:pr-merged']);
  });
});
