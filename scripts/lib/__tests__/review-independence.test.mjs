/**
 * @file review-independence.test.mjs — proof of the #2844 clearer-identity record and its independence decider.
 *   These are the SUPPORTING unit tests: the load-bearing proofs that a self-clear is actually REFUSED live at
 *   the seams (`auto-land-seam.test.mjs`, `review-set-label.test.mjs`), driven adversarially through the real
 *   appliers. What this file pins is the record FORMAT (a marker a writer emits and a reader gets back, proven
 *   round-trip through both halves rather than by substring) and the decider's total behaviour over the four
 *   statuses — including the two fail-closed "cannot establish it" cases, which are the ones a future edit is
 *   most likely to quietly relax into "assume independence".
 */
import { describe, it, expect } from 'vitest';
import {
  ACTOR_ENV, currentActorId, AUTHOR_ACTOR_MARKER, CLEARER_ACTOR_MARKER, STAMP_LOST_MARKER,
  buildAuthorActorMarker, buildClearerActorMarker, buildStampLostMarker, hasStampLostMarker,
  parseAuthorActorId, parseClearerActorId, readAuthorActorStamps, decideClearerIndependence, INDEPENDENCE,
  STAMP_REGIME_START, STAMP_STATUS, distinguishMissingAuthorStamp,
} from '../review-independence.mjs';

describe('currentActorId — the harness session identity, never an argv field', () => {
  it('reads the #2367 session env var and trims it', () => {
    expect(currentActorId({ [ACTOR_ENV]: '  sess-1  ' })).toBe('sess-1');
  });

  it("returns '' when the harness supplies nothing — the caller must treat that as NOT established", () => {
    for (const env of [{}, { [ACTOR_ENV]: '' }, { [ACTOR_ENV]: '   ' }, { [ACTOR_ENV]: 42 }]) {
      expect(currentActorId(env)).toBe('');
    }
  });

  it('names the env var #2367 already uses for lane-lease ownership, not a new one', () => {
    expect(ACTOR_ENV).toBe('CLAUDE_CODE_SESSION_ID');
  });
});

describe('the actor markers — a writer and a reader that agree (round-trip, not substring)', () => {
  it('an author stamp survives a round trip through a realistic PR body', () => {
    const body = `Resolve #2844: something.\n\n${buildAuthorActorMarker('sess-author')}\n`;
    expect(parseAuthorActorId(body)).toBe('sess-author');
  });

  it('a clearer stamp survives a round trip through a realistic verdict comment', () => {
    const comment = `✅ review — accepted\n\nRecorded by op.\n\n${buildClearerActorMarker('sess-reviewer')}`;
    expect(parseClearerActorId([{ body: comment }])).toBe('sess-reviewer');
  });

  // The AUTHOR read is AGREEMENT-OR-NOTHING, and the PR #1100 review is why it is not first-match-wins: a
  // first match is POSITIONAL, not temporal, so the "a second stamp can only be someone re-writing history,
  // therefore keep the earliest" reasoning was simply false — a PREPENDED forgery wins a first-match scan.
  // These four pin the real property, including the proof that neither position can be bought.
  it('a body stamped ONCE resolves to that id (the ordinary case)', () => {
    expect(parseAuthorActorId(`x\n\n${buildAuthorActorMarker('sess-original')}\n`)).toBe('sess-original');
  });

  it('the SAME id stamped twice still resolves — duplication is not a conflict', () => {
    const body = `${buildAuthorActorMarker('sess-a')}\n\nedit\n\n${buildAuthorActorMarker('sess-a')}`;
    expect(parseAuthorActorId(body)).toBe('sess-a');
    expect(readAuthorActorStamps(body)).toEqual(['sess-a']);
  });

  it("CONFLICTING stamps resolve to '' — ambiguity fails CLOSED, it does not pick a winner", () => {
    // APPENDED forgery (what first-match-wins claimed to stop)…
    const appended = `${buildAuthorActorMarker('sess-original')}\n\n${buildAuthorActorMarker('sess-forger')}`;
    expect(parseAuthorActorId(appended)).toBe('');
    // …and PREPENDED forgery (what first-match-wins actually HANDED to the forger — the PR #1100 proof).
    const prepended = `${buildAuthorActorMarker('sess-forger')}\n\n${buildAuthorActorMarker('sess-original')}`;
    expect(parseAuthorActorId(prepended)).toBe('');
    // Neither forger gets attributed authorship, and neither does the original: the record is unproven, which
    // the autonomous seam refuses outright and the CLI states verbatim in the durable comment.
    expect(readAuthorActorStamps(prepended)).toEqual(['sess-forger', 'sess-original']);
  });

  it('readAuthorActorStamps answers PRESENCE, which is a different question from the resolved id', () => {
    // `pr-land.mjs#withAuthorStamp` relies on exactly this distinction: an AMBIGUOUS body must not be re-stamped
    // on every producer re-run just because its id will not resolve.
    const ambiguous = `${buildAuthorActorMarker('a')}\n${buildAuthorActorMarker('b')}`;
    expect(parseAuthorActorId(ambiguous)).toBe('');
    expect(readAuthorActorStamps(ambiguous).length).toBe(2);
    expect(readAuthorActorStamps('no stamp here')).toEqual([]);
  });

  it('the CLEARER read is LAST-wins across comments — the latest verdict is the operative one', () => {
    // Mirrors `parseReviewedSha`: a re-verdict after a bounce must outrank the earlier record.
    const comments = [
      { body: buildClearerActorMarker('sess-first') },
      { body: 'a chatty comment with no marker' },
      { body: buildClearerActorMarker('sess-latest') },
    ];
    expect(parseClearerActorId(comments)).toBe('sess-latest');
  });

  it("an unusable id yields NO marker — a reader sees 'not established' instead of a value it would trust", () => {
    for (const bad of ['', '   ', undefined, null, 42, 'has<angle>', 'multi\nline', 'x'.repeat(201)]) {
      expect(buildAuthorActorMarker(bad)).toBe('');
      expect(buildClearerActorMarker(bad)).toBe('');
    }
  });

  it("a body/comment set with no marker parses to '' rather than throwing or guessing", () => {
    expect(parseAuthorActorId('')).toBe('');
    expect(parseAuthorActorId(undefined)).toBe('');
    expect(parseAuthorActorId('an ordinary body <!-- other-marker: x -->')).toBe('');
    expect(parseClearerActorId([])).toBe('');
    expect(parseClearerActorId(undefined)).toBe('');
    expect(parseClearerActorId(['a raw string comment'])).toBe('');
  });

  it('the two markers are DISTINCT names — an author stamp must never read as a clearance', () => {
    expect(AUTHOR_ACTOR_MARKER).not.toBe(CLEARER_ACTOR_MARKER);
    expect(parseClearerActorId([{ body: buildAuthorActorMarker('sess-a') }])).toBe('');
    expect(parseAuthorActorId(buildClearerActorMarker('sess-a'))).toBe('');
  });

  // #3067 — the stamp-lost marker: presence-only, same shape as the other two markers, and DISTINCT from both.
  it('the stamp-lost marker round-trips and is presence-only, not an id', () => {
    const body = `PR body\n\n${buildStampLostMarker()}\n`;
    expect(hasStampLostMarker(body)).toBe(true);
    expect(hasStampLostMarker('no marker here')).toBe(false);
    expect(hasStampLostMarker('')).toBe(false);
    expect(hasStampLostMarker(undefined)).toBe(false);
  });

  it('the stamp-lost marker is a THIRD distinct name — never read as an author or clearer stamp', () => {
    expect(STAMP_LOST_MARKER).not.toBe(AUTHOR_ACTOR_MARKER);
    expect(STAMP_LOST_MARKER).not.toBe(CLEARER_ACTOR_MARKER);
    expect(parseAuthorActorId(buildStampLostMarker())).toBe('');
    expect(readAuthorActorStamps(buildStampLostMarker())).toEqual([]);
    expect(parseClearerActorId([{ body: buildStampLostMarker() }])).toBe('');
  });
});

describe('distinguishMissingAuthorStamp — #3067 detect + distinguish, a checkable date comparison', () => {
  const BEFORE = '2026-08-01T00:00:00-04:00'; // predates STAMP_REGIME_START
  const AFTER = '2026-08-10T00:00:00-04:00';  // postdates it

  it('a PR predating the stamp regime is NEVER_STAMPED — old, tolerate', () => {
    expect(distinguishMissingAuthorStamp({ prCreatedAt: BEFORE })).toBe(STAMP_STATUS.NEVER_STAMPED);
  });

  it('a PR postdating the stamp regime, with no stamp, is STRIPPED — do not tolerate', () => {
    expect(distinguishMissingAuthorStamp({ prCreatedAt: AFTER })).toBe(STAMP_STATUS.STRIPPED);
  });

  it('exactly at the regime start counts as covered (>=), not excluded', () => {
    expect(distinguishMissingAuthorStamp({ prCreatedAt: STAMP_REGIME_START })).toBe(STAMP_STATUS.STRIPPED);
  });

  it('an authorId present means nothing to distinguish, regardless of the date', () => {
    expect(distinguishMissingAuthorStamp({ authorId: 'sess-a', prCreatedAt: AFTER })).toBe('');
  });

  it('a missing/unparseable date fails toward the OLD, tolerant behaviour, never invents a refusal', () => {
    for (const prCreatedAt of [undefined, null, '', 'not-a-date', 42]) {
      expect(distinguishMissingAuthorStamp({ prCreatedAt })).toBe(STAMP_STATUS.NEVER_STAMPED);
    }
  });

  it('a custom regimeStart is honoured (injectable, so the constant is not hard-baked into every caller)', () => {
    expect(distinguishMissingAuthorStamp({ prCreatedAt: BEFORE, regimeStart: '2026-07-01T00:00:00-04:00' }))
      .toBe(STAMP_STATUS.STRIPPED);
  });
});

describe('decideClearerIndependence — total over the four statuses, fail-closed on both unknowns', () => {
  it('two DIFFERENT ids are independent — the only case that returns true', () => {
    const d = decideClearerIndependence({ authorId: 'sess-a', clearerId: 'sess-b' });
    expect(d.independent).toBe(true);
    expect(d.status).toBe(INDEPENDENCE.INDEPENDENT);
  });

  it('the SAME id is a self-clear — the #2439 bar, refused', () => {
    const d = decideClearerIndependence({ authorId: 'sess-a', clearerId: 'sess-a' });
    expect(d.independent).toBe(false);
    expect(d.status).toBe(INDEPENDENCE.SELF_CLEAR);
    expect(d.reason).toMatch(/SELF-CLEAR REFUSED/);
  });

  it('the SHARED self-clear reason states the FACT and prescribes no remedy (PR #1100 — it misdirected)', () => {
    // The first cut ended "…or let a human clear it", which pointed at a door the same refusal had shut: a
    // subagent inherits its parent's session id, so the human running /review IS the same actor. What works
    // differs per caller, so each caller names its own routes; this shared string must not name any.
    const d = decideClearerIndependence({ authorId: 'sess-a', clearerId: 'sess-a' });
    expect(d.reason).not.toMatch(/let a human clear it/i);
    // …and it DOES state the fact that makes the refusal comprehensible: session ids are inherited.
    expect(d.reason).toMatch(/inherits/i);
    expect(d.reason).toContain(ACTOR_ENV);
  });

  it('whitespace around an id does not defeat the match — trimmed on both sides', () => {
    expect(decideClearerIndependence({ authorId: ' sess-a ', clearerId: 'sess-a' }).status)
      .toBe(INDEPENDENCE.SELF_CLEAR);
  });

  it('comparison is EXACT, not case-folded — a differently-cased id is a DIFFERENT id, and stays so', () => {
    // Folding case could only make two genuinely different opaque tokens collide (a false self-clear) or, worse,
    // let a case-shifted forge read as distinct. Neither direction is worth the convenience.
    expect(decideClearerIndependence({ authorId: 'SESS-A', clearerId: 'sess-a' }).status)
      .toBe(INDEPENDENCE.INDEPENDENT);
  });

  it('no clearer id → UNKNOWN_CLEARER, and independence is NOT assumed', () => {
    for (const clearerId of ['', '   ', undefined, null, 7]) {
      const d = decideClearerIndependence({ authorId: 'sess-a', clearerId });
      expect(d.independent).toBe(false);
      expect(d.status).toBe(INDEPENDENCE.UNKNOWN_CLEARER);
    }
  });

  it('no author stamp, no date/marker info → UNKNOWN_AUTHOR (unchanged — #2844\'s own tolerance)', () => {
    for (const authorId of ['', '   ', undefined, null, 7]) {
      const d = decideClearerIndependence({ authorId, clearerId: 'sess-b' });
      expect(d.independent).toBe(false);
      expect(d.status).toBe(INDEPENDENCE.UNKNOWN_AUTHOR);
    }
  });

  it('called with nothing at all it still refuses — the default must never be "independent"', () => {
    expect(decideClearerIndependence().independent).toBe(false);
    expect(decideClearerIndependence({}).independent).toBe(false);
  });

  // #3067 — the two OPT-IN routes to STAMP_LOST, and the proof neither one fires without the caller asking.
  describe('#3067 — STAMP_LOST: a missing stamp that was written and lost, refused rather than tolerated', () => {
    it('no author stamp + a prCreatedAt AT/AFTER the stamp regime → STAMP_LOST, refused', () => {
      const d = decideClearerIndependence({ clearerId: 'sess-b', prCreatedAt: '2026-08-10T00:00:00-04:00' });
      expect(d.independent).toBe(false);
      expect(d.status).toBe(INDEPENDENCE.STAMP_LOST);
      expect(d.reason).toMatch(/STAMP LOST/);
      expect(d.reason).toMatch(/--repair/);
    });

    it('no author stamp + a prCreatedAt BEFORE the regime → still UNKNOWN_AUTHOR, still tolerated', () => {
      const d = decideClearerIndependence({ clearerId: 'sess-b', prCreatedAt: '2026-08-01T00:00:00-04:00' });
      expect(d.status).toBe(INDEPENDENCE.UNKNOWN_AUTHOR);
    });

    it('no author stamp + stampLostMarked:true → STAMP_LOST, refused, regardless of date', () => {
      const d = decideClearerIndependence({ clearerId: 'sess-b', stampLostMarked: true });
      expect(d.independent).toBe(false);
      expect(d.status).toBe(INDEPENDENCE.STAMP_LOST);
      expect(d.reason).toMatch(/STAMP LOST/);
      expect(d.reason).toContain(STAMP_LOST_MARKER);
    });

    it('an author stamp PRESENT is decided as before — the new inputs never override a real stamp', () => {
      const d = decideClearerIndependence({
        authorId: 'sess-a', clearerId: 'sess-b', prCreatedAt: '2026-08-10T00:00:00-04:00', stampLostMarked: true,
      });
      expect(d.status).toBe(INDEPENDENCE.INDEPENDENT);
    });

    it('a caller that supplies neither new input sees BYTE-IDENTICAL behaviour to before #3067', () => {
      const before = decideClearerIndependence({ authorId: '', clearerId: 'sess-b' });
      const after = decideClearerIndependence({ authorId: '', clearerId: 'sess-b', prCreatedAt: undefined, stampLostMarked: undefined });
      expect(after).toEqual(before);
      expect(after.status).toBe(INDEPENDENCE.UNKNOWN_AUTHOR);
    });
  });

  it('every status carries a non-empty human reason (the record has to be readable, not just machine-true)', () => {
    const cases = [
      { authorId: 'a', clearerId: 'b' }, { authorId: 'a', clearerId: 'a' },
      { authorId: '', clearerId: 'b' }, { authorId: 'a', clearerId: '' },
    ];
    for (const c of cases) expect(decideClearerIndependence(c).reason.length).toBeGreaterThan(20);
  });

  it('INDEPENDENCE is frozen and exactly the five statuses the deciders branch on (#3067 added STAMP_LOST)', () => {
    expect(Object.isFrozen(INDEPENDENCE)).toBe(true);
    expect(new Set(Object.values(INDEPENDENCE)).size).toBe(5);
    // `independent` must be true for EXACTLY ONE status — the property every consumer relies on.
    const produced = [
      decideClearerIndependence({ authorId: 'a', clearerId: 'b' }),
      decideClearerIndependence({ authorId: 'a', clearerId: 'a' }),
      decideClearerIndependence({ authorId: '', clearerId: 'b' }),
      decideClearerIndependence({ authorId: 'a', clearerId: '' }),
      decideClearerIndependence({ authorId: '', clearerId: 'b', stampLostMarked: true }),
    ];
    expect(produced.filter((d) => d.independent)).toHaveLength(1);
    expect(new Set(produced.map((d) => d.status))).toEqual(new Set(Object.values(INDEPENDENCE)));
  });
});
