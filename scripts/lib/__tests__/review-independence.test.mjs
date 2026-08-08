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
  ACTOR_ENV, currentActorId, AUTHOR_ACTOR_MARKER, CLEARER_ACTOR_MARKER,
  buildAuthorActorMarker, buildClearerActorMarker, parseAuthorActorId, parseClearerActorId,
  decideClearerIndependence, INDEPENDENCE,
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

  it('the AUTHOR read is FIRST-wins — a later appended stamp cannot re-attribute authorship', () => {
    // pr-land writes the stamp ONCE at open and never overwrites one. So a body carrying two can only be
    // someone re-writing history, and the ORIGINAL must survive — otherwise the cheapest possible forge is
    // "append your own id to the body, then clear your own PR".
    const body = `${buildAuthorActorMarker('sess-original')}\n\nlater edit\n\n${buildAuthorActorMarker('sess-forger')}`;
    expect(parseAuthorActorId(body)).toBe('sess-original');
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

  it('no author stamp → UNKNOWN_AUTHOR, and independence is NOT assumed', () => {
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

  it('every status carries a non-empty human reason (the record has to be readable, not just machine-true)', () => {
    const cases = [
      { authorId: 'a', clearerId: 'b' }, { authorId: 'a', clearerId: 'a' },
      { authorId: '', clearerId: 'b' }, { authorId: 'a', clearerId: '' },
    ];
    for (const c of cases) expect(decideClearerIndependence(c).reason.length).toBeGreaterThan(20);
  });

  it('INDEPENDENCE is frozen and exactly the four statuses the deciders branch on', () => {
    expect(Object.isFrozen(INDEPENDENCE)).toBe(true);
    expect(new Set(Object.values(INDEPENDENCE)).size).toBe(4);
    // `independent` must be true for EXACTLY ONE status — the property every consumer relies on.
    const produced = [
      decideClearerIndependence({ authorId: 'a', clearerId: 'b' }),
      decideClearerIndependence({ authorId: 'a', clearerId: 'a' }),
      decideClearerIndependence({ authorId: '', clearerId: 'b' }),
      decideClearerIndependence({ authorId: 'a', clearerId: '' }),
    ];
    expect(produced.filter((d) => d.independent)).toHaveLength(1);
    expect(new Set(produced.map((d) => d.status))).toEqual(new Set(Object.values(INDEPENDENCE)));
  });
});
