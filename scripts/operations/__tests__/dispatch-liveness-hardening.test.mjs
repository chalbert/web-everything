/**
 * @file dispatch-liveness-hardening.test.mjs — the five liveness-reading hardenings (#3353), each pinned
 *   against a REAL `claude agents --json` payload rather than a hand-authored one.
 *
 * WHY THIS FILE EXISTS. `stampLiveness`, `assertHandleNotLive` and `createDispatchObservers` all read the same
 * CLI surface, and until #3353 they all trusted its SHAPE on evidence nobody had gathered — no code path in
 * this repo had ever listed a session back. PR #1211's round-3 review accepted that as a named residual (H1/H2)
 * and reassigned the fix to wherever the payload became real. This is that place, and the fixture next door is
 * that payload.
 *
 * THE FAILURE THESE GUARD AGAINST LOOKS LIKE THE STRONG GUARD, NOT A DEGRADED ONE. If the listing ever comes
 * back in a shape these readers do not understand, the old code read it as "every agent is gone", released the
 * lane and put a SECOND agent into the same clone about two minutes later — while the verdict still said
 * `livenessSource: 'claude-agents'`, the label for "checked against a real listing and found clear".
 *
 * PROVENANCE OF THE FIXTURE — `__fixtures__/claude-agents-payload.json`, captured not authored:
 *
 *   $ claude --version   →  2.1.246 (Claude Code)
 *   $ claude agents --json   →  14 elements, re-indented only
 *
 * `claude agents --json` is a READ-ONLY listing: it starts nothing, dispatches nothing and spends nothing, so
 * this fixture cost no agent and no tokens. It is pinned verbatim because the point is what the CLI actually
 * emits, and a fixture edited to be tidy is a fixture that pins the editor's beliefs.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DISPATCH_EFFECT,
  DISPATCH_GUARD_LISTING_GRACE_MINUTES,
  DISPATCH_LISTING_GRACE_MINUTES,
  dispatchStillHolds,
} from '../dispatch-lane.mjs';
import {
  createDispatchObservers,
  findListedSession,
  listedSessionIds,
  normalizeHandle,
  persistLastSeenLive,
  stampLiveness,
} from '../dispatch-lane-io.mjs';
import { assertHandleNotLive } from '../wake.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAYLOAD_PATH = join(HERE, '..', '__fixtures__', 'claude-agents-payload.json');
/** The real listing, re-read per call so no test can mutate another's copy. */
const payload = () => JSON.parse(readFileSync(PAYLOAD_PATH, 'utf8'));

/** A handle that IS in the real listing — taken from the payload, never typed in. */
const LIVE_HANDLE = payload()[0].sessionId;
/** A well-formed v4 UUID that is NOT in the real listing. */
const GONE_HANDLE = '00000000-0000-4000-8000-000000000000';

const NOW = '2026-08-26T12:00:00.000Z';
const isoPlus = (iso, minutes) => new Date(Date.parse(iso) + minutes * 60_000).toISOString();

// ── HARDENING 1 — the payload is REAL, and all three of its element shapes are pinned ─────────────────────────

describe('hardening 1: the pinned payload is a real `claude agents --json` listing', () => {
  it('carries all THREE element shapes the CLI returns in one response, not one tidy shape', () => {
    // A fixture that pins ONE shape pins the wrong thing. This listing mixes three, and the 7-row minimal one
    // — no `state`, no `status`, no `id` — is the majority. Anything reading `id` or `state` as though it were
    // always there would pass against a one-shape fixture and fail against the CLI.
    const shapes = new Map();
    for (const row of payload()) {
      const key = Object.keys(row).sort().join('+');
      shapes.set(key, (shapes.get(key) ?? 0) + 1);
    }
    expect([...shapes.keys()].sort()).toEqual([
      'cwd+id+kind+name+sessionId+startedAt+state',
      'cwd+id+kind+name+pid+sessionId+startedAt+state+status+waitingFor'.split('+').sort().join('+'),
      'cwd+kind+name+pid+sessionId+startedAt',
    ].sort());
    expect(shapes.size).toBe(3);
  });

  it('`sessionId` is on EVERY row and `id` is not — which is why nothing reads `id`', () => {
    const rows = payload();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => typeof r.sessionId === 'string' && r.sessionId)).toBe(true);
    // `id` is absent from half the listing, and where present it is a PREFIX — never a handle to compare.
    expect(rows.some((r) => r.id === undefined)).toBe(true);
  });

  it('every id is a lower-case v4 UUID — the measurement hardening 3 is deliberately NOT justified by', () => {
    // Recorded so the drift-defence claim in `normalizeHandle`'s docblock stays honest. No case mismatch has
    // ever been observed; this asserts the observation, not a defect.
    const ids = payload().map((r) => r.sessionId);
    expect(ids.every((i) => i === i.toLowerCase())).toBe(true);
    expect(ids.every((i) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(i))).toBe(true);
  });

  it('the listing includes `kind: "interactive"` rows, so it is NOT only backgrounded agents', () => {
    // `defaultListAgents` deliberately passes no `--all`, and this is what that still returns. A reader that
    // assumed every row was one of its own dispatches would be wrong about most of them.
    expect(payload().some((r) => r.kind === 'interactive')).toBe(true);
  });
});

// ── HARDENING 2 — non-empty-but-unmatchable reads as `unreadable`, in all three readers ───────────────────────

/**
 * The listing that CANNOT HAPPEN AGAINST CLI 2.1.246, and is the whole reason these branches exist.
 *
 * Every row of the real payload carries a usable `sessionId`, so `listed.size === 0` after the filter is
 * unreachable against the observed CLI — **this mutation test is the ONLY possible cover for these branches,
 * and no live dispatch can ever exercise them.** That is not a reason to drop them: they are fail-closed cover
 * for a shape nobody has seen, and the cost of being wrong about it is two agents in one lane clone. A later
 * reader should not go hunting for the real listing that reddens this; there is none.
 */
const unmatchable = () => payload().map(({ sessionId, ...rest }) => rest);

describe('hardening 2: a non-empty listing yielding zero usable ids is UNREADABLE, not "everyone is gone"', () => {
  it('stampLiveness — reddens on revert: the old code stamped `live: false` on every row', () => {
    const rows = [{ runId: 'a', key: '3037', handle: LIVE_HANDLE }, { runId: 'b', key: '3096', handle: GONE_HANDLE }];
    const out = stampLiveness({ runs: rows, unreadable: 0 }, { listAgents: unmatchable });
    expect(out.runs.map((r) => r.live)).toEqual([null, null]);
    // The label matters as much as the answer: a weaker guard must never wear the strong one's name.
    expect(out.livenessSource).toBe('unreadable');
  });

  it('assertHandleNotLive — REFUSES rather than closing out an entry whose agent might be alive', () => {
    // Reverted, `.some()` returns false against an unmatchable listing and `--resolve` un-parks the run; the
    // executor then retries, which for a dispatch means a second agent under the same session slug.
    expect(() => assertHandleNotLive({ handle: GONE_HANDLE }, { listAgents: unmatchable }))
      .toThrow(/not one carried a usable/);
    // Same refusal the not-an-array branch gives, and `--force` is still the way through.
    expect(() => assertHandleNotLive({ handle: GONE_HANDLE }, { listAgents: unmatchable }))
      .toThrow(/refusing to close out an entry whose agent MIGHT be alive/);
  });

  it('createDispatchObservers — raises rather than falling into `unresolved` on a read that told it nothing', async () => {
    const observe = createDispatchObservers({ listAgents: unmatchable, listPrs: () => [] })[DISPATCH_EFFECT];
    await expect(observe({ handle: GONE_HANDLE, startedAt: NOW }, {}))
      .rejects.toThrow(/not one carried a usable/);
  });

  it('an EMPTY listing is still a legitimate "nobody is running" answer — the branch is size-gated', () => {
    // The guard is `sessions.length && !listed.size`. A genuinely empty array is a read that SUCCEEDED and
    // found nothing; conflating it with an unreadable one would wedge every dispatch on an idle machine.
    const out = stampLiveness({ runs: [{ runId: 'a', key: '3037', handle: GONE_HANDLE }], unreadable: 0 }, { listAgents: () => [] });
    expect(out.runs[0].live).toBe(false);
    expect(out.livenessSource).toBe('claude-agents');
    expect(() => assertHandleNotLive({ handle: GONE_HANDLE }, { listAgents: () => [] })).not.toThrow();
  });
});

// ── HARDENING 3 — the compares are case- and whitespace-tolerant, on BOTH sides ───────────────────────────────

describe('hardening 3: session ids compare normalized — drift-defence, not an observed bug', () => {
  it('all three readers match a handle whose case differs from the listing', () => {
    // CLI 2.1.246 emits lower-case (asserted above), so nothing here reproduces a real defect. What it pins is
    // the cost if that ever changed: under an exact match EVERY dispatch would miss its own row, read
    // `live: false`, and the guard would hand the same lane to a second agent.
    const shouted = LIVE_HANDLE.toUpperCase();
    const out = stampLiveness({ runs: [{ runId: 'a', key: '3037', handle: shouted }], unreadable: 0 }, { listAgents: payload });
    expect(out.runs[0].live).toBe(true);
    expect(() => assertHandleNotLive({ handle: shouted }, { listAgents: payload })).toThrow(/is ALIVE/);
  });

  it('and a handle carrying stray whitespace', () => {
    const padded = `  ${LIVE_HANDLE}\n`;
    const out = stampLiveness({ runs: [{ runId: 'a', key: '3037', handle: padded }], unreadable: 0 }, { listAgents: payload });
    expect(out.runs[0].live).toBe(true);
  });

  it('normalizes the LISTING side too — a listing that shouts back still matches a stored handle', () => {
    const shoutingListing = () => payload().map((r) => ({ ...r, sessionId: r.sessionId.toUpperCase() }));
    const out = stampLiveness({ runs: [{ runId: 'a', key: '3037', handle: LIVE_HANDLE }], unreadable: 0 }, { listAgents: shoutingListing });
    expect(out.runs[0].live).toBe(true);
  });

  it('normalizeHandle / listedSessionIds drop what is not comparable rather than inventing a match', () => {
    expect(normalizeHandle(null)).toBe('');
    expect(normalizeHandle(undefined)).toBe('');
    expect(normalizeHandle('  ABC ')).toBe('abc');
    // An empty-string id must never become a Set member, or a handle-less row would "match" it.
    expect(listedSessionIds([{ sessionId: '' }, { sessionId: '  ' }, null]).size).toBe(0);
    expect(listedSessionIds(payload()).size).toBe(payload().length);
  });
});

// ── HARDENING 4 — `live: false` ages from `lastSeenLiveAt`, not `startedAt` ───────────────────────────────────

describe('hardening 4: a `live: false` reading ages from the last CONFIRMATION, not from the dispatch', () => {
  const gone = (over) => ({ live: false, startedAt: '2026-08-26T06:00:00.000Z', ...over });

  it('reddens on revert: one bad read against a long-running build no longer releases the lane', () => {
    // Six hours since `startedAt`, one minute since a listing said `live: true`. Anchored on `startedAt` this
    // is far past any grace and the item is RELEASED — a second agent into a clone with a live build in it.
    const seenAMinuteAgo = gone({ lastSeenLiveAt: isoPlus(NOW, -1) });
    expect(dispatchStillHolds(seenAMinuteAgo, NOW)).toBe(true);
  });

  it('but two bad reads spaced by the window still let it go — this is not an unbounded hold', () => {
    const stale = gone({ lastSeenLiveAt: isoPlus(NOW, -(DISPATCH_GUARD_LISTING_GRACE_MINUTES + 1)) });
    expect(dispatchStillHolds(stale, NOW)).toBe(false);
  });

  it('falls back to `startedAt` only when it was never set — a dispatch never yet seen alive', () => {
    expect(dispatchStillHolds(gone({ startedAt: isoPlus(NOW, -1) }), NOW)).toBe(true);
    expect(dispatchStillHolds(gone({ startedAt: isoPlus(NOW, -(DISPATCH_GUARD_LISTING_GRACE_MINUTES + 1)) }), NOW)).toBe(false);
    // An unparseable `lastSeenLiveAt` must fall back, not poison the anchor into NaN and hold forever.
    expect(dispatchStillHolds(gone({ lastSeenLiveAt: 'not a date', startedAt: isoPlus(NOW, -60) }), NOW)).toBe(false);
  });

  it('no usable anchor at all still HOLDS — fail-closed, unchanged', () => {
    expect(dispatchStillHolds(gone({ startedAt: null }), NOW)).toBe(true);
  });

  it('persistLastSeenLive writes the confirmation onto the entry — the read site has a write site', () => {
    // Reverted (no write), the field is never set and hardening 4 is a read of something nothing produces.
    const run = {
      id: 'run-1',
      effects: [
        { key: 'k-live', type: DISPATCH_EFFECT, status: 'in-flight', payload: { num: '3037' } },
        { key: 'k-gone', type: DISPATCH_EFFECT, status: 'in-flight', payload: { num: '3096' } },
        { key: 'k-done', type: DISPATCH_EFFECT, status: 'applied', payload: { num: '3110' } },
      ],
    };
    const store = { read: () => run, write: () => run };
    const written = persistLastSeenLive(
      { runs: [{ runId: 'run-1', key: 'k-live', live: true }, { runId: 'run-1', key: 'k-gone', live: false }] },
      { store, now: () => new Date(NOW) },
    );
    expect(written).toBe(1);
    expect(run.effects[0].lastSeenLiveAt).toBe(NOW);
    // ONLY `live === true` is recorded — `false` and `null` are the answers the field exists to survive.
    expect(run.effects[1].lastSeenLiveAt).toBeUndefined();
    // And a settled entry is never touched, whatever a stale row claims about it.
    expect(run.effects[2].lastSeenLiveAt).toBeUndefined();
  });

  it('it is `last`, not `first` — a later confirmation overwrites an earlier one', () => {
    // Stamping once and never again would leave a long-lived agent anchored on its first minute, which is the
    // `startedAt` failure this replaces under a different field name.
    const run = { id: 'r', effects: [{ key: 'k', type: DISPATCH_EFFECT, status: 'in-flight', payload: { num: '1' } }] };
    const store = { read: () => run, write: () => run };
    const stamp = (at) => persistLastSeenLive({ runs: [{ runId: 'r', key: 'k', live: true }] }, { store, now: () => new Date(at) });
    stamp(isoPlus(NOW, -10));
    stamp(NOW);
    expect(run.effects[0].lastSeenLiveAt).toBe(NOW);
  });

  it('a store that will not take the note does NOT take down the dispatch read', () => {
    const throwing = { read: () => { throw new Error('EACCES'); }, write: () => { throw new Error('EACCES'); } };
    expect(() => persistLastSeenLive({ runs: [{ runId: 'r', key: 'k', live: true }] }, { store: throwing })).not.toThrow();
  });
});

// ── HARDENING 5 — the guard's window is its OWN, and larger, at BOTH of its reads ─────────────────────────────

describe('hardening 5: the guard has its own listing grace, larger than the observer’s', () => {
  it('the two constants are distinct and ordered — reddens if they are ever collapsed back into one', () => {
    expect(DISPATCH_GUARD_LISTING_GRACE_MINUTES).toBeGreaterThan(DISPATCH_LISTING_GRACE_MINUTES);
  });

  it('the DEFAULT is the guard’s constant, not the observer’s', () => {
    const gone = { live: false, startedAt: NOW };
    // Just inside the OBSERVER's two minutes it would hold either way; between the two windows it holds only
    // because the guard has its own. That midpoint is the assertion that reddens on revert.
    expect(dispatchStillHolds(gone, isoPlus(NOW, DISPATCH_LISTING_GRACE_MINUTES + 1))).toBe(true);
    expect(dispatchStillHolds(gone, isoPlus(NOW, DISPATCH_GUARD_LISTING_GRACE_MINUTES + 1))).toBe(false);
  });

  it('and so is the IN-BODY FALLBACK — a malformed `listingGraceMinutes` cannot hand back the observer’s', () => {
    // The hole the default alone leaves open: a caller passing `-1` used to silently get the OBSERVER's two
    // minutes back INSIDE the guard, and Done-when 5 as first written would have passed with it open.
    const gone = { live: false, startedAt: NOW };
    // `null` is deliberately NOT in this list: `Number(null)` is 0, which passes the `>= 0` test as an
    // explicit zero-minute window rather than falling to the fallback. That is pre-existing, unchanged
    // behaviour, and it is asserted on its own below so the omission is not mistaken for an oversight.
    for (const bad of [-1, NaN, 'nonsense', undefined]) {
      expect(dispatchStillHolds(gone, isoPlus(NOW, DISPATCH_LISTING_GRACE_MINUTES + 1), { listingGraceMinutes: bad })).toBe(true);
      expect(dispatchStillHolds(gone, isoPlus(NOW, DISPATCH_GUARD_LISTING_GRACE_MINUTES + 1), { listingGraceMinutes: bad })).toBe(false);
    }
  });

  it('an explicit ZERO is still an explicit zero — `null` and `0` mean "no grace", not "use the fallback"', () => {
    // `Number(null) === 0` and `0 >= 0`, so both reach the comparison as a real window. Unchanged by #3353,
    // pinned here because the fallback test above has to exclude them and a reader deserves to know why.
    for (const zero of [0, null]) {
      expect(dispatchStillHolds({ live: false, startedAt: NOW }, isoPlus(NOW, 1), { listingGraceMinutes: zero })).toBe(false);
    }
  });

  it('an explicit, well-formed window is still honoured — this narrows no caller', () => {
    expect(dispatchStillHolds({ live: false, startedAt: NOW }, isoPlus(NOW, 3), { listingGraceMinutes: 5 })).toBe(true);
    expect(dispatchStillHolds({ live: false, startedAt: NOW }, isoPlus(NOW, 6), { listingGraceMinutes: 5 })).toBe(false);
  });
});

// ── #3331 — the same real payload, read the way a dispatch handle is actually keyed ───────────────────────────

describe('#3331: names are NOT unique in a real listing, and the matcher refuses rather than guessing', () => {
  it('the pinned payload carries the SAME name three times — this is measured, not hypothesised', () => {
    const counts = new Map();
    for (const r of payload()) counts.set(r.name, (counts.get(r.name) ?? 0) + 1);
    // `conveyor-3154` × 3 and `conveyor-3151` × 2, because the pre-#3331 dispatcher named every attempt at one
    // item identically (`payload.sessionSlug || 'conveyor-<num>'` is per-ITEM). This is exactly why the handle
    // now carries a per-attempt token, and why matching on the bare slug would have been a wrong-match bug.
    expect(counts.get('conveyor-3154')).toBe(3);
    expect(counts.get('conveyor-3151')).toBe(2);
    expect([...counts.values()].some((n) => n > 1)).toBe(true);
  });

  it('a bare slug matches THREE rows, so it resolves to none of them', () => {
    expect(findListedSession(payload(), { handle: 'conveyor-3154' })).toMatchObject({ row: null, matches: 3 });
    // …and every reader fails closed on that count, each in its own safe direction.
    const out = stampLiveness({ runs: [{ runId: 'a', key: '3154', handle: 'conveyor-3154' }], unreadable: 0 }, { listAgents: payload });
    expect(out.runs[0].live).toBeNull();
    // `--resolve` REFUSES: "might one of these be alive" is answered yes by an ambiguous match, not no.
    expect(() => assertHandleNotLive({ handle: 'conveyor-3154' }, { listAgents: payload })).toThrow(/STILL LISTED/);
  });

  it('a UNIQUELY named row resolves, and hands back the id the CLI chose', () => {
    const one = payload().find((r) => r.name === 'conveyor-3150');
    const { row, matches } = findListedSession(payload(), { handle: 'conveyor-3150' });
    expect(matches).toBe(1);
    expect(row.sessionId).toBe(one.sessionId);
    // The id is nothing the dispatcher could have minted — that is the whole of #3331 in one assertion.
    expect(row.sessionId).not.toBe('conveyor-3150');
  });

  it('an entry that already knows its real id is matched BY the id, and the ambiguous name stops mattering', () => {
    const rows = payload();
    const one = rows.find((r) => r.name === 'conveyor-3154');
    expect(findListedSession(rows, { sessionId: one.sessionId }).row).toBe(one);
    // …even though its NAME is one of the three ambiguous ones. A known id wins OUTRIGHT rather than ranking
    // first: also accepting name matches here would widen this unique answer back out to three and strand an
    // entry that had already been identified exactly.
    expect(findListedSession(rows, { handle: 'conveyor-3154', sessionId: one.sessionId }))
      .toEqual({ row: one, matches: 1 });
    // And a stored id that is simply not listed is NOT rescued by a name that is — the session is gone.
    expect(findListedSession(rows, { handle: 'conveyor-3154', sessionId: 'no-such-id' }))
      .toEqual({ row: null, matches: 0 });
  });

  it('nothing to compare is not a match — an entry with neither key never attaches to a row', () => {
    expect(findListedSession(payload(), {})).toEqual({ row: null, matches: 0 });
    expect(findListedSession(payload(), { handle: '  ' })).toEqual({ row: null, matches: 0 });
    expect(findListedSession(null, { handle: 'conveyor-3150' })).toEqual({ row: null, matches: 0 });
  });
});

// ── 7a — the three readers, exercised against the REAL payload ────────────────────────────────────────────────

describe('7a: all three readers run against the pinned real payload, with no agent started', () => {
  it('stampLiveness finds a handle that IS in the real listing, and misses one that is not', () => {
    const out = stampLiveness(
      { runs: [{ runId: 'a', key: '3037', handle: LIVE_HANDLE }, { runId: 'b', key: '3096', handle: GONE_HANDLE }], unreadable: 0 },
      { listAgents: payload },
    );
    expect(out.runs.map((r) => r.live)).toEqual([true, false]);
    expect(out.livenessSource).toBe('claude-agents');
  });

  it('assertHandleNotLive refuses for a listed handle and passes for an unlisted one', () => {
    expect(() => assertHandleNotLive({ handle: LIVE_HANDLE }, { listAgents: payload })).toThrow(/STILL LISTED/);
    expect(() => assertHandleNotLive({ handle: GONE_HANDLE }, { listAgents: payload })).not.toThrow();
  });

  it('createDispatchObservers reads `running` for a listed handle against the real payload', async () => {
    const observe = createDispatchObservers({ listAgents: payload, listPrs: () => [] })[DISPATCH_EFFECT];
    await expect(observe({ handle: LIVE_HANDLE, startedAt: NOW }, {})).resolves.toEqual({ status: 'running', result: null });
  });

  it('and `unresolved` for an unlisted handle past the observer’s grace', async () => {
    const observe = createDispatchObservers({
      listAgents: payload,
      listPrs: () => [],
      now: () => new Date(isoPlus(NOW, 60)),
    })[DISPATCH_EFFECT];
    const out = await observe({ handle: GONE_HANDLE, startedAt: NOW }, {});
    expect(out.status).toBe('unresolved');
  });

  it('the real listing carries sessions BLOCKED ON A PERMISSION PROMPT — alive, and holding nothing', () => {
    // This is verbatim the G1 failure the liveness axis exists for, present in the captured listing rather
    // than hypothesised: a background session stalled on a prompt is ALIVE, holds no lane lease and has
    // claimed no item, so a clock-only guard would hand its lane to a second agent. `stampLiveness` must read
    // every one of them as `live: true`.
    const stalled = payload().filter((r) => r.waitingFor === 'permission prompt');
    expect(stalled.length).toBeGreaterThan(0);
    const out = stampLiveness(
      { runs: stalled.map((r, i) => ({ runId: `r${i}`, key: '3037', handle: r.sessionId })), unreadable: 0 },
      { listAgents: payload },
    );
    expect(out.runs.every((r) => r.live === true)).toBe(true);
    // And the guard holds every one of them at any age — no clock may overrule a live session.
    expect(out.runs.every((r) => dispatchStillHolds({ ...r, startedAt: '2020-01-01T00:00:00.000Z' }, NOW))).toBe(true);
  });
});
