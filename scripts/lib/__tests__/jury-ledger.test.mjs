/**
 * @file jury-ledger.test.mjs — proof of the #2641 (F4 = logbook, epic #2636) DURABLE jury LOG + the ONE SHARED
 *   FOLD. Covers the PURE pieces directly (the fold, the event builders, log serialize/parse, the subject-slug +
 *   path resolver) plus a real round-trip through the fs append/read shell against a temp `CONVEYOR_JURY_DIR`.
 *   The fold is the SINGLE reconstruction both the conveyor tree and the #2642 console call — so its derivation
 *   rules (roster ∘ status ∘ latest-verdict ∘ finding-supersede ∘ diversity-selection) are pinned here.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  JURY_EVENT_TYPES,
  JUROR_STATUSES,
  VERDICTS,
  VERDICT_STRICTNESS,
} from '../jury-core.mjs';
import {
  subjectSlug,
  juryLogPath,
  jurorRunningEvent,
  findingEvent,
  verdictEvent,
  roundAdvancedEvent,
  serializeJuryEvent,
  parseJuryLog,
  foldJuryLedger,
  appendJuryEvent,
  appendJuryEvents,
  readJuryLog,
  listJurySubjects,
  foldSubject,
  foldAllSubjects,
  buildReviewLedgerEvents,
} from '../jury-ledger.mjs';

// A controlled two-juror roster event (correctness#1, security#1) — built as a raw literal so the fold tests do
// not depend on the care band's jurors-per-lens dial (which seats 2 per lens at `low`).
function rosterEvent(jurors, round = 0) {
  return {
    type: JURY_EVENT_TYPES.ROSTER_PICKED,
    round,
    jurors: jurors || [
      { id: 'correctness#1', lens: 'correctness', charter: 'judge correctness' },
      { id: 'security#1', lens: 'security', charter: 'judge security' },
    ],
  };
}

describe('#2823 round-2 finding 1 — the fold ranks via the SINGLE-SOURCED strictness table (no stale twin)', () => {
  // The round-2 miss: jury-ledger kept a HAND-COPIED VERDICT_STRICTNESS (3 entries) whose doc claimed to "mirror
  // disposition-judge", but it was never extended for `prevention-outstanding` — so the fold compared it as
  // `undefined` and ranked it BELOW accept, rendering ✓ accept for a blocking panel. The fix imports the ONE table
  // from jury-core; these tests prove the fold now ranks prevention-outstanding correctly (it could not, before).
  const roster = [
    { id: 'correctness#1', lens: 'correctness', charter: 'a' },
    { id: 'correctness#2', lens: 'correctness', charter: 'b' },
  ];

  it('the imported table is the single source and is TOTAL over VERDICTS, ranking prevention-outstanding above accept', () => {
    for (const v of Object.values(VERDICTS)) expect(VERDICT_STRICTNESS[v]).toBeTypeOf('number');
    expect(VERDICT_STRICTNESS[VERDICTS.ACCEPT]).toBeLessThan(VERDICT_STRICTNESS[VERDICTS.PREVENTION_OUTSTANDING]);
    expect(VERDICT_STRICTNESS[VERDICTS.PREVENTION_OUTSTANDING]).toBeLessThan(VERDICT_STRICTNESS[VERDICTS.CHANGES]);
    expect(VERDICT_STRICTNESS[VERDICTS.CHANGES]).toBeLessThan(VERDICT_STRICTNESS[VERDICTS.NEEDS_HUMAN]);
  });

  it('a co-juror prevention-outstanding CARRIES the lens over another juror accept (would have lost to accept before)', () => {
    const ledger = foldJuryLedger([
      { type: JURY_EVENT_TYPES.ROSTER_PICKED, round: 0, jurors: roster },
      verdictEvent({ jurorId: 'correctness#1', verdict: VERDICTS.ACCEPT }),
      verdictEvent({ jurorId: 'correctness#2', verdict: VERDICTS.PREVENTION_OUTSTANDING }),
    ]);
    expect(ledger.lensVerdicts.correctness).toBe(VERDICTS.PREVENTION_OUTSTANDING);
    expect(ledger.panelVerdict).toBe(VERDICTS.PREVENTION_OUTSTANDING);
  });

  it('a co-juror needs-human still beats an incumbent prevention-outstanding (2 > undefined no longer discards it)', () => {
    const ledger = foldJuryLedger([
      { type: JURY_EVENT_TYPES.ROSTER_PICKED, round: 0, jurors: roster },
      verdictEvent({ jurorId: 'correctness#1', verdict: VERDICTS.PREVENTION_OUTSTANDING }),
      verdictEvent({ jurorId: 'correctness#2', verdict: VERDICTS.NEEDS_HUMAN }),
    ]);
    expect(ledger.lensVerdicts.correctness).toBe(VERDICTS.NEEDS_HUMAN);
    expect(ledger.panelVerdict).toBe(VERDICTS.NEEDS_HUMAN);
  });
});

describe('subjectSlug — reversible, filesystem-safe subject basenames', () => {
  it('keeps # (a legal filename char) so we#123 stays reversible', () => {
    expect(subjectSlug('we#123')).toBe('we#123');
  });
  it('replaces path separators and whitespace', () => {
    expect(subjectSlug('a/b c')).toBe('a-b-c');
  });
  it('collapses an empty/garbage key to a stable default', () => {
    expect(subjectSlug('   ')).toBe('subject');
    expect(subjectSlug(null)).toBe('subject');
  });
});

describe('juryLogPath — one .jsonl per subject under the .conveyor/jury dir', () => {
  it('honors CONVEYOR_JURY_DIR and slugs the subject', () => {
    const prev = process.env.CONVEYOR_JURY_DIR;
    process.env.CONVEYOR_JURY_DIR = '/tmp/jd';
    try {
      expect(juryLogPath('we#7')).toBe('/tmp/jd/we#7.jsonl');
    } finally {
      if (prev == null) delete process.env.CONVEYOR_JURY_DIR; else process.env.CONVEYOR_JURY_DIR = prev;
    }
  });
});

describe('event builders — build schema-valid raw events', () => {
  it('jurorRunning / finding / verdict / roundAdvanced all validate', () => {
    expect(jurorRunningEvent({ jurorId: 'correctness#1', round: 0 }).type).toBe(JURY_EVENT_TYPES.JUROR_RUNNING);
    expect(findingEvent({ jurorId: 'correctness#1', finding: { summary: 'off-by-one' }, round: 0 }).finding.summary).toBe('off-by-one');
    expect(verdictEvent({ jurorId: 'correctness#1', verdict: 'changes', round: 0 }).verdict).toBe('changes');
    expect(roundAdvancedEvent({ round: 1 }).round).toBe(1);
  });
  it('throws on an invalid event (a programming error, caught by tests)', () => {
    expect(() => verdictEvent({ jurorId: 'x', verdict: 'bogus', round: 0 })).toThrow(/invalid jury event/);
    expect(() => roundAdvancedEvent({ round: 0 })).toThrow(/invalid jury event/); // round-advanced needs round >= 1
  });
});

describe('serializeJuryEvent — validate + stamp + JSONL', () => {
  it('stamps an injected `at` and emits a one-line JSON', () => {
    const { ok, line, event } = serializeJuryEvent(
      { type: JURY_EVENT_TYPES.VERDICT, jurorId: 'security#1', verdict: 'accept', round: 0 },
      { nowIso: '2026-07-27T00:00:00.000Z' },
    );
    expect(ok).toBe(true);
    expect(event.at).toBe('2026-07-27T00:00:00.000Z');
    expect(line.includes('\n')).toBe(false);
    expect(JSON.parse(line).verdict).toBe('accept');
  });
  it('does NOT overwrite a caller-supplied `at`', () => {
    const { event } = serializeJuryEvent(
      { type: JURY_EVENT_TYPES.ROUND_ADVANCED, round: 1, at: '2020-01-01T00:00:00.000Z' },
      { nowIso: '2026-07-27T00:00:00.000Z' },
    );
    expect(event.at).toBe('2020-01-01T00:00:00.000Z');
  });
  it('rejects a malformed event — ok:false, nothing to write', () => {
    const r = serializeJuryEvent({ type: 'nope' }, { nowIso: '2026-07-27T00:00:00.000Z' });
    expect(r.ok).toBe(false);
    expect(r.line).toBeNull();
    expect(r.errors.length).toBeGreaterThan(0);
  });
});

describe('parseJuryLog — tolerant, order-preserving', () => {
  it('skips blank / unparseable / invalid lines, keeps valid ones in order', () => {
    const text = [
      JSON.stringify({ type: JURY_EVENT_TYPES.ROUND_ADVANCED, round: 1 }),
      '',
      'not json',
      JSON.stringify({ type: 'garbage' }),
      JSON.stringify({ type: JURY_EVENT_TYPES.ROUND_ADVANCED, round: 2 }),
    ].join('\n');
    const events = parseJuryLog(text);
    expect(events.map((e) => e.round)).toEqual([1, 2]);
  });
  it('never throws on non-string input', () => {
    expect(parseJuryLog(null)).toEqual([]);
  });
});

describe('foldJuryLedger — the ONE shared reconstruction', () => {
  it('empty / non-roster stream folds to an empty ledger, never throws', () => {
    const l = foldJuryLedger([]);
    expect(l.rosterKnown).toBe(false);
    expect(l.jurors).toEqual([]);
    expect(l.panelVerdict).toBeNull();
    expect(foldJuryLedger(null).jurors).toEqual([]);
  });

  it('derives juror STATUS: pending → running → found (monotonic)', () => {
    const roster = rosterEvent();
    // roster names correctness#1 + security#1 → both pending.
    let l = foldJuryLedger([roster]);
    expect(l.counts).toEqual({ pending: 2, running: 0, found: 0 });
    expect(l.jurors.every((j) => j.status === JUROR_STATUSES.PENDING)).toBe(true);

    // one starts running, the other reports a finding → found.
    l = foldJuryLedger([
      roster,
      jurorRunningEvent({ jurorId: 'correctness#1', round: 0 }),
      findingEvent({ jurorId: 'security#1', finding: { summary: 'unsafe eval' }, round: 0 }),
    ]);
    const byId = Object.fromEntries(l.jurors.map((j) => [j.id, j]));
    expect(byId['correctness#1'].status).toBe(JUROR_STATUSES.RUNNING);
    expect(byId['security#1'].status).toBe(JUROR_STATUSES.FOUND);
    expect(l.counts).toEqual({ pending: 0, running: 1, found: 1 });
  });

  it('keeps each juror charter + findings and the latest verdict (higher round wins)', () => {
    const roster = rosterEvent();
    const l = foldJuryLedger([
      roster,
      verdictEvent({ jurorId: 'correctness#1', verdict: 'changes', round: 0 }),
      findingEvent({ jurorId: 'correctness#1', finding: { summary: 'A', file: 'x.mjs', line: 3 }, round: 0 }),
      verdictEvent({ jurorId: 'correctness#1', verdict: 'accept', round: 1 }), // supersedes round-0 changes
      verdictEvent({ jurorId: 'security#1', verdict: 'accept', round: 0 }),
    ]);
    const c = l.jurors.find((j) => j.id === 'correctness#1');
    expect(c.charter).toBe('judge correctness');
    expect(c.verdict).toBe('accept'); // latest round
    expect(c.findings).toHaveLength(1);
    expect(l.round).toBe(1);
  });

  it('finding re-report in a later round supersedes (no double count)', () => {
    const roster = rosterEvent();
    const l = foldJuryLedger([
      roster,
      findingEvent({ jurorId: 'correctness#1', finding: { summary: 'dup', file: 'x', line: 1 }, round: 0 }),
      findingEvent({ jurorId: 'correctness#1', finding: { summary: 'dup', file: 'x', line: 1, outcome: 'fixed' }, round: 1 }),
    ]);
    const c = l.jurors.find((j) => j.id === 'correctness#1');
    expect(c.findings).toHaveLength(1);
    expect(c.findings[0].outcome).toBe('fixed');
  });

  it('lens + panel verdict is diversity-selection (strictest wins)', () => {
    const roster = rosterEvent();
    const l = foldJuryLedger([
      roster,
      verdictEvent({ jurorId: 'correctness#1', verdict: 'accept', round: 0 }),
      verdictEvent({ jurorId: 'security#1', verdict: 'needs-human', round: 0 }),
    ]);
    expect(l.lensVerdicts).toEqual({ correctness: 'accept', security: 'needs-human' });
    expect(l.panelVerdict).toBe('needs-human'); // strictest across jurors
  });

  it('ignores a verdict from a juror the roster never named (fail-closed)', () => {
    const roster = rosterEvent();
    const l = foldJuryLedger([roster, verdictEvent({ jurorId: 'ghost#9', verdict: 'accept', round: 0 })]);
    expect(l.jurors.every((j) => j.verdict === null)).toBe(true);
    expect(l.panelVerdict).toBeNull();
  });

  it('a re-pick (grown jury) keeps prior jurors’ progress and seats new ones pending', () => {
    const roster = rosterEvent();
    const grown = rosterEvent([
      { id: 'correctness#1', lens: 'correctness', charter: 'judge correctness' },
      { id: 'security#1', lens: 'security', charter: 'judge security' },
      { id: 'simplicity#1', lens: 'simplicity', charter: 'judge simplicity' },
    ], 1);
    const l = foldJuryLedger([
      roster,
      verdictEvent({ jurorId: 'correctness#1', verdict: 'accept', round: 0 }),
      grown, // re-seats correctness#1 + security#1 + adds simplicity#1
    ]);
    const c = l.jurors.find((j) => j.id === 'correctness#1');
    expect(c.verdict).toBe('accept'); // progress preserved across the re-pick
    expect(l.jurors.some((j) => j.lens === 'simplicity' && j.status === JUROR_STATUSES.PENDING)).toBe(true);
  });
});

describe('buildReviewLedgerEvents — the review-pipeline event projection', () => {
  it('emits a schema-valid roster + per-lens running/verdict, folds to the right tree', () => {
    const events = buildReviewLedgerEvents({
      activeLenses: ['correctness', 'security'],
      lensVerdicts: { correctness: 'accept', security: 'changes' },
      findings: [{ summary: 'unsafe eval', category: 'security', file: 'h.mjs', line: 3 }],
      rounds: 1,
    });
    // every built event is schema-valid (normalizeJuryEvent keeps them all).
    expect(parseJuryLog(events.map((e) => JSON.stringify(e)).join('\n'))).toHaveLength(events.length);
    const l = foldJuryLedger(events);
    expect(l.rosterKnown).toBe(true);
    expect(l.jurors.map((j) => j.id).sort()).toEqual(['correctness#1', 'security#1']);
    expect(l.lensVerdicts).toEqual({ correctness: 'accept', security: 'changes' });
    expect(l.jurors.find((j) => j.id === 'security#1').findings).toHaveLength(1);
    expect(l.jurors.find((j) => j.id === 'security#1').charter).toMatch(/injection/);
  });

  it('maps rounds → round-advanced (1-based loop → 0-based ledger); rounds=1 emits none', () => {
    expect(buildReviewLedgerEvents({ activeLenses: ['correctness'], rounds: 1 })
      .filter((e) => e.type === JURY_EVENT_TYPES.ROUND_ADVANCED)).toHaveLength(0);
    const three = buildReviewLedgerEvents({ activeLenses: ['correctness'], rounds: 3 });
    expect(three.filter((e) => e.type === JURY_EVENT_TYPES.ROUND_ADVANCED).map((e) => e.round)).toEqual([1, 2]);
    // the verdict/running events sit at the final (0-based) round = rounds-1.
    expect(foldJuryLedger(three).round).toBe(2);
  });

  it('an "unknown"/failed lens is rostered + running but casts NO verdict event', () => {
    const events = buildReviewLedgerEvents({ activeLenses: ['correctness', 'security'], lensVerdicts: { correctness: 'accept', security: 'unknown' }, rounds: 1 });
    expect(events.some((e) => e.type === JURY_EVENT_TYPES.VERDICT && e.jurorId === 'security#1')).toBe(false);
    const l = foldJuryLedger(events);
    expect(l.jurors.find((j) => j.id === 'security#1').verdict).toBeNull();
    expect(l.jurors.find((j) => j.id === 'security#1').status).toBe(JUROR_STATUSES.RUNNING);
  });

  it('drops a finding whose category is not a rostered lens (cannot attribute it)', () => {
    const events = buildReviewLedgerEvents({ activeLenses: ['correctness'], findings: [{ summary: 'x', category: 'security' }], rounds: 1 });
    expect(events.some((e) => e.type === JURY_EVENT_TYPES.FINDING)).toBe(false);
  });

  it('defaults to the full review panel when no activeLenses given', () => {
    const l = foldJuryLedger(buildReviewLedgerEvents({ rounds: 1 }));
    expect(l.jurors.map((j) => j.lens)).toEqual(['correctness', 'security', 'simplicity', 'standards-conformance']);
  });
});

describe('fs append/read round-trip (temp CONVEYOR_JURY_DIR)', () => {
  let dir;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'jury-ledger-')); process.env.CONVEYOR_JURY_DIR = dir; });
  afterEach(() => { delete process.env.CONVEYOR_JURY_DIR; rmSync(dir, { recursive: true, force: true }); });

  it('appends one event, reads it back, folds to a live ledger', () => {
    const roster = rosterEvent();
    expect(appendJuryEvent('we#123', roster).ok).toBe(true);
    appendJuryEvents('we#123', [
      jurorRunningEvent({ jurorId: 'correctness#1', round: 0 }),
      verdictEvent({ jurorId: 'correctness#1', verdict: 'accept', round: 0 }),
    ]);
    const events = readJuryLog('we#123');
    expect(events.length).toBe(3);
    // every persisted event carries an `at` stamp (the fs shell injects the wall clock).
    expect(events.every((e) => typeof e.at === 'string')).toBe(true);

    const { ledger } = foldSubject('we#123');
    expect(ledger.rosterKnown).toBe(true);
    expect(ledger.jurors.find((j) => j.id === 'correctness#1').verdict).toBe('accept');
  });

  it('a rejected event is NOT written; good neighbors still persist', () => {
    const { appended, rejected } = appendJuryEvents('we#9', [
      verdictEvent({ jurorId: 'correctness#1', verdict: 'accept', round: 0 }),
      { type: 'garbage' },
    ]);
    expect(appended).toBe(1);
    expect(rejected).toHaveLength(1);
    const text = readFileSync(juryLogPath('we#9'), 'utf8');
    expect(text.includes('garbage')).toBe(false);
  });

  it('readJuryLog on a missing subject → [] (no jury run yet)', () => {
    expect(readJuryLog('never#0')).toEqual([]);
  });

  it('listJurySubjects + foldAllSubjects enumerate every logged subject', () => {
    appendJuryEvent('we#1', rosterEvent());
    appendJuryEvent('we#2', rosterEvent());
    expect(listJurySubjects().map((s) => s.subject).sort()).toEqual(['we#1', 'we#2']);
    const all = foldAllSubjects();
    expect(all).toHaveLength(2);
    expect(all.every((s) => s.ledger.rosterKnown)).toBe(true);
  });
});
