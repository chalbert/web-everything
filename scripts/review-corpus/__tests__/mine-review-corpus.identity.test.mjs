import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  IDENTITY_FIELDS,
  IDENTITY_NEVER_EMITTED,
  IDENTITY_NOTE,
  IDENTITY_REQUIRED_FOR_SAMENESS,
  buildCases,
  parseReviewerIdentity,
  parseVerdict,
  sameReviewer,
  summariseIdentity,
  verdictComments,
} from '../mine-review-corpus.mjs';

// ── WHY THIS FILE EXISTS (#3363) ──────────────────────────────────────────────────────────────────────────
// #3310 measured, on this corpus, 5 pairs of rounds run against a BYTE-IDENTICAL head sha and found 0 of 7
// pooled findings recurring under the headline matcher, with 1 pair flipping accept→changes on the same
// diff. That number has two readings — juror nondeterminism, or a DIFFERENT REVIEWER between the rounds —
// and the corpus recorded nothing that separated them.
//
// The failure this file exists to prevent is NOT "the field is missing". It is the quieter one: a consumer
// finding no differences between two rounds and reading that as "same reviewer". So the assertions below
// are in TWO directions, and the second is the one that matters:
//   1. a newly mined round carries `reviewerIdentity`, populated from the comment body;
//   2. a round whose identity is not recorded is reported `unknown` — never `same`, never `different`.
//
// AND IT CHECKS THE HONESTY OF THE CLAIM. The miner's only input is the verdict comment body, and that body
// does NOT contain the model id. Rather than trust that sentence, `the model is genuinely not in the input`
// below greps every committed fixture body for it. If the emitter ever starts recording a model, that test
// reddens and this file's caveats get revisited — which is the correct trigger.

const HERE = dirname(fileURLToPath(import.meta.url));
const CORPUS = resolve(HERE, '..');
const FIXTURES = join(HERE, 'fixtures', 'comments');

/** Every recorded comment body the repo has committed, across all fixture PRs. */
const FIXTURE_BODIES = readdirSync(FIXTURES)
  .filter((f) => /^\d+\.json$/.test(f))
  .flatMap((f) => JSON.parse(readFileSync(join(FIXTURES, f), 'utf8')).map((c) => c.body));

const REAL_VERDICT_BODIES = verdictComments(FIXTURE_BODIES);

/** A synthetic write-up in the post-#3335 shape — the earned-vs-seated line no recorded round carries yet. */
const WITH_CARE_LINE = [
  '✅ review — accepted',
  '',
  '**Decision:** `accept` — recorded by operator.',
  '**Lenses:** `correctness` + `security` — 2 juror(s), one per lens, each a separate `judge` step spawned '
    + 'with its own derived session id (#3028) and its own tools (#3319). This is not a `judgePanel` fan-out (#3050).',
  "**Earned vs seated:** this PR's source touch-set scores care `high` (statute change), for which the care "
    + 'dial asks for 5 lens(es) × 2 juror(s)/lens × 3 round(s). The caller declared `--careLevel=high`.',
  'Net basis: `' + 'a'.repeat(40) + '..' + 'b'.repeat(40) + '` — 2 net changed file(s) vs current main (#2450).',
  '',
  '_Recorded through the declared `review-pr` operation (#3035)._',
].join('\n');

describe('#3363 — a mined round records WHO reviewed it', () => {
  it('#3363 every mined case carries a reviewerIdentity object, populated from the comment body', () => {
    const verdicts = REAL_VERDICT_BODIES.map(parseVerdict).filter(Boolean);
    expect(verdicts.length).toBeGreaterThan(0);
    const cases = buildCases(1561, verdicts, { cwd: CORPUS });
    for (const k of cases) {
      expect(k.reviewerIdentity).toBeTypeOf('object');
      expect(k.reviewerIdentity).not.toBeNull();
      // Every declared field is PRESENT as a key — value or explicit null. A missing key is the shape a
      // consumer skips over; an explicit null is the shape it has to handle.
      for (const f of IDENTITY_FIELDS) expect(Object.hasOwn(k.reviewerIdentity, f)).toBe(true);
      expect(Array.isArray(k.reviewerIdentity.unknown)).toBe(true);
    }
  });

  it('#3363 reads the roster, the panel shape and the recording operation off a REAL recorded body', () => {
    const id = parseReviewerIdentity(REAL_VERDICT_BODIES[0]);
    expect(id.roster).toEqual(['correctness']);
    expect(id.panelShape).toBe('single-lens');
    expect(id.operation).toBe('review-pr');
    expect(id.writeUpMarkers).toContain('#3035');
  });

  it('#3363 takes the roster from the SEAT list only, not from the prose after it', () => {
    // THE BUG THIS PINS, caught on a real fixture before it landed: sweeping the whole `**Lens:**` line for
    // backticked words mined `["correctness", "judge"]` — `judge` comes from "One `judge` step, one juror,
    // one lens", which is prose about the mechanism, not a lens. A roster with a phantom seat in it would
    // make two identical rounds compare as identical for the wrong reason, and would make a genuine roster
    // change harder to see.
    const id = parseReviewerIdentity(REAL_VERDICT_BODIES[0]);
    expect(id.roster).not.toContain('judge');
    expect(id.roster).not.toContain('juror');
  });

  it('#3363 reads the care level and the declared care level when the write-up carries them', () => {
    const id = parseReviewerIdentity(WITH_CARE_LINE);
    expect(id.careLevel).toBe('high');
    expect(id.declaredCareLevel).toBe('high');
    expect(id.roster).toEqual(['correctness', 'security']);
    expect(id.panelShape).toBe('multi-lens');
    // The renderer-build marker set moves with the boilerplate, which is the only build signal there is.
    expect(id.writeUpMarkers).toEqual(['#2450', '#3028', '#3035', '#3050', '#3319']);
  });

  it('#3363 records `none` — not null — when the caller explicitly declared no care level', () => {
    // "declared nothing" and "we could not tell" are different facts about the run, and collapsing them
    // would let an unknown masquerade as a recorded value.
    const body = WITH_CARE_LINE.replace(
      'The caller declared `--careLevel=high`.',
      'The caller declared no `--careLevel`, so nothing checked the shape this run was dialled for.',
    );
    expect(parseReviewerIdentity(body).declaredCareLevel).toBe('none');
    expect(parseReviewerIdentity(WITH_CARE_LINE.replace(/The caller declared.*$/m, '')).declaredCareLevel).toBeNull();
  });
});

describe('#3363 — what the miner CANNOT see, said out loud', () => {
  it('#3363 the model is genuinely not in the miner\'s input — checked, not asserted in prose', () => {
    // `JUDGE_MODEL` is a module literal in the EMITTER and never reaches the comment. This greps for it in
    // every committed recorded body rather than trusting the sentence. When the emitter starts writing it,
    // this test reddens — which is the signal to widen the parser and revisit every caveat below.
    const emitter = readFileSync(resolve(CORPUS, '..', 'operations', 'review-pr.mjs'), 'utf8');
    const declared = emitter.match(/export const JUDGE_MODEL = '([\w.-]+)'/);
    expect(declared).not.toBeNull();
    for (const body of REAL_VERDICT_BODIES) {
      expect(body).not.toContain(`\`${declared[1]}\``);
      expect(body).not.toMatch(/\*\*Model:\*\*/);
    }
  });

  it('#3363 leaves model, effort and prompt revision null and NAMES them in `unknown`', () => {
    const id = parseReviewerIdentity(REAL_VERDICT_BODIES[0]);
    for (const f of IDENTITY_NEVER_EMITTED) {
      expect(id[f]).toBeNull();
      expect(id.unknown).toContain(f);
    }
    expect(id.comparable).toBe(false);
  });

  it('#3363 an empty body yields every field null and every field listed as unknown', () => {
    const id = parseReviewerIdentity('');
    expect(IDENTITY_FIELDS.every((f) => id[f] === null)).toBe(true);
    expect(id.unknown).toEqual([...IDENTITY_FIELDS]);
    expect(id.comparable).toBe(false);
  });
});

describe('#3363 — sameReviewer is THREE-valued, and never guesses `same`', () => {
  const id = (over = {}) => ({ ...parseReviewerIdentity(''), ...over });

  it('#3363 two rounds whose observable fields all agree read `unknown`, NOT `same`', () => {
    // THE CENTRAL ASSERTION. This is the exact shape of #1556 r6→r7 — the pair that flipped accept→changes
    // on one sha: same roster, same panel shape, same operation, same markers, and no model on either side.
    // Answering `same` here is what would let #3310's churn be quoted as pure nondeterminism. Absence of a
    // difference is not evidence of sameness.
    const a = parseReviewerIdentity(REAL_VERDICT_BODIES[0]);
    const b = parseReviewerIdentity(REAL_VERDICT_BODIES[0]);
    const answer = sameReviewer(a, b);
    expect(answer.answer).toBe('unknown');
    expect(answer.answer).not.toBe('same');
    expect(answer.differing).toEqual([]);
    expect(answer.unknown).toEqual(expect.arrayContaining([...IDENTITY_NEVER_EMITTED]));
  });

  it('#3363 a round with NO identity recorded at all reads `unknown`, not `different`', () => {
    // A case mined before this field existed has no `reviewerIdentity` key. It must not read as a DIFFERENT
    // reviewer either — that would manufacture version drift out of a missing field, the mirror-image error.
    const mined = parseReviewerIdentity(REAL_VERDICT_BODIES[0]);
    expect(sameReviewer(mined, null).answer).toBe('unknown');
    expect(sameReviewer(null, null).answer).toBe('unknown');
    expect(sameReviewer({ pr: 1, round: 1 }, { reviewerIdentity: mined }).answer).toBe('unknown');
  });

  it('#3363 ONE differing observable field proves `different`, even with the model unknown on both sides', () => {
    // The asymmetry that makes the field worth recording at all: a changed roster is positive evidence of a
    // changed reviewer configuration, and it is sound without the model id. This is the arm that could
    // actually reclassify some of #3310's churn as version drift, once such a pair exists.
    const a = parseReviewerIdentity(REAL_VERDICT_BODIES[0]);
    const b = { ...a, roster: ['correctness', 'security'] };
    const answer = sameReviewer(a, b);
    expect(answer.answer).toBe('different');
    expect(answer.differing).toContain('roster');
  });

  it('#3363 answers `same` ONLY when every sameness-critical field is recorded on both sides and equal', () => {
    // Proves the mechanism is live rather than hard-wired to `unknown`: the moment the emitter records a
    // model and a prompt revision, this same code starts answering the question, with no change here.
    const stamped = { model: 'sonnet', promptRevision: 'r7', effort: 'high' };
    expect(sameReviewer(id(stamped), id(stamped)).answer).toBe('same');
    expect(sameReviewer(id(stamped), id({ ...stamped, model: 'opus' })).answer).toBe('different');
    // Drop ONE required field and it falls back to unknown — not to `same` on the strength of the other.
    expect(sameReviewer(id(stamped), id({ ...stamped, promptRevision: null })).answer).toBe('unknown');
  });

  it('#3363 states its sameness bar as DATA, so the prose describing it can be checked', () => {
    expect(Object.isFrozen(IDENTITY_REQUIRED_FOR_SAMENESS)).toBe(true);
    expect([...IDENTITY_REQUIRED_FOR_SAMENESS]).toEqual(['model', 'promptRevision']);
    expect(Object.isFrozen(IDENTITY_FIELDS)).toBe(true);
    expect(IDENTITY_FIELDS).toHaveLength(9);
  });
});

describe('#3363 — the corpus roll-up reports the gap instead of hiding it', () => {
  it('#3363 classifies every same-head pair, and today every one of them is UNKNOWN', () => {
    const head = 'c'.repeat(40);
    const withId = (round) => ({
      pr: 1556, round, head, findings: [], reviewerIdentity: parseReviewerIdentity(REAL_VERDICT_BODIES[0]),
    });
    const s = summariseIdentity([withId(6), withId(7)]);
    expect(s.sameHeadPairs).toEqual({ same: 0, different: 0, unknown: 1 });
    expect(s.roundsWithIdentity).toBe(2);
    expect(s.recorded.roster).toBe(2);
    expect(s.recorded.model).toBe(0);
    expect(s.neverEmitted).toEqual([...IDENTITY_NEVER_EMITTED]);
  });

  it('#3363 counts a round mined BEFORE the field as carrying no identity, rather than as agreeing', () => {
    const head = 'd'.repeat(40);
    const s = summariseIdentity([
      { pr: 1, round: 1, head, findings: [], reviewerIdentity: parseReviewerIdentity(REAL_VERDICT_BODIES[0]) },
      { pr: 1, round: 2, head, findings: [] }, // legacy case: no `reviewerIdentity` key at all
    ]);
    expect(s.roundsWithIdentity).toBe(1);
    expect(s.sameHeadPairs.unknown).toBe(1);
    expect(s.sameHeadPairs.same).toBe(0);
  });

  it('#3363 the caveat travels WITH the corpus, and says what is not recorded', () => {
    // Same reason as `PROVENANCE` (#1569 r3 f9): a consumer who only ever reads the mined tree must still
    // learn that sameness was never established, without having to find this file.
    expect(IDENTITY_NOTE).toMatch(/does NOT record the model id/i);
    expect(IDENTITY_NOTE).toMatch(/MUST NOT be read as `same`/);
    expect(IDENTITY_NOTE).toMatch(/separate change to a separate file/);
    expect(summariseIdentity([]).note).toBe(IDENTITY_NOTE);
  });
});
