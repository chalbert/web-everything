/**
 * @file micro-decision-surface.test.mjs — proof of the #2650 SURFACING half (the per-fork contention reduction
 *   that feeds the plateau-app micro-decision surface). Covers: a clean fork auto-clears (never surfaced), a
 *   dissenting / needs-human / gate-self / no-roster fork surfaces as CONTESTED, the ordered contested queue,
 *   the auto-cleared partition + counts, and that the module CONSUMES the #2652 judge rather than re-deriving
 *   contention. Pure module — plain unit assertions, no I/O.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  classifyForkContention,
  buildMicroDecisionQueue,
  microDecisionSubjectKey,
  validateMicroDecisionRecord,
  foldMicroDecisionRecords,
  appendMicroDecisionRecord,
  readMicroDecisionRecord,
  buildSurfaceFromDisk,
  MICRO_RECORD_KINDS,
} from '../micro-decision-surface.mjs';
import { resolveDispositionConfig } from '../review-policy.mjs';
import { subjectSlug } from '../jury-ledger.mjs';
import { VERDICTS, MANDATORY_LENSES } from '../jury-core.mjs';

// --- ledger builders (mirror disposition-judge.test.mjs) -------------------------------------------------------
function rosterEvent(jurors, round = 0) {
  return { type: 'roster-picked', round, jurors };
}
function verdictEvent(jurorId, verdict, round = 0) {
  return { type: 'verdict', round, jurorId, verdict };
}
const CHARTER = 'judge';

/** A clean two-mandatory-lens ledger, TWO jurors per lens all accepting (diverse jury, no thin-jury refute). */
function cleanDiverseLedger(verdict = VERDICTS.ACCEPT) {
  const jurors = [];
  const verdicts = [];
  for (const lens of MANDATORY_LENSES) {
    for (const slot of [1, 2]) {
      const id = `${lens}#${slot}`;
      jurors.push({ id, lens, charter: CHARTER });
      verdicts.push(verdictEvent(id, verdict));
    }
  }
  return [rosterEvent(jurors), ...verdicts];
}

/** A ledger where one mandatory lens wants changes → the panel does not converge → escalate. */
function dissentingLedger() {
  const jurors = [];
  const verdicts = [];
  for (const lens of MANDATORY_LENSES) {
    for (const slot of [1, 2]) {
      const id = `${lens}#${slot}`;
      jurors.push({ id, lens, charter: CHARTER });
      // correctness#2 wants changes; everyone else accepts.
      verdicts.push(verdictEvent(id, id === 'correctness#2' ? VERDICTS.CHANGES : VERDICTS.ACCEPT));
    }
  }
  return [rosterEvent(jurors), ...verdicts];
}

/**
 * A WEIGHTED-DISSENT-ONLY ledger: every MANDATORY lens (correctness, security) accepts unanimously (two jurors
 * each), and the ONLY dissent comes from a single NON-mandatory lens (`simplicity`) voting CHANGES. Because no
 * mandatory lens objects, the panel-verdict step (strictest mandatory = accept) does NOT short-circuit at
 * `panel-changes` — the judge REACHES the `resolutionMode` / `dissentThreshold` branch. That is the branch the
 * `dissentingLedger` fixture never reached (a mandatory `correctness#2` CHANGES escalates it at `panel-changes`
 * first), so THIS is the ledger that genuinely exercises per-fork disposition-config threading.
 */
function weightedDissentOnlyLedger() {
  const jurors = [];
  const verdicts = [];
  for (const lens of MANDATORY_LENSES) {
    for (const slot of [1, 2]) {
      const id = `${lens}#${slot}`;
      jurors.push({ id, lens, charter: CHARTER });
      verdicts.push(verdictEvent(id, VERDICTS.ACCEPT));
    }
  }
  // A single NON-mandatory-lens dissenter (weight 1 of five jurors → weighted dissent 0.2, below a high threshold).
  jurors.push({ id: 'simplicity#1', lens: 'simplicity', charter: CHARTER });
  verdicts.push(verdictEvent('simplicity#1', VERDICTS.CHANGES));
  return [rosterEvent(jurors), ...verdicts];
}

describe('classifyForkContention', () => {
  it('auto-clears a clean, unanimous fork (NOT contested)', () => {
    const dto = classifyForkContention({ n: 1, question: 'Read-time or baked?', ledger: cleanDiverseLedger() });
    expect(dto.contested).toBe(false);
    expect(dto.disposition).toBe('auto-dispose');
    expect(dto.n).toBe(1);
    expect(dto.question).toBe('Read-time or baked?');
    expect(Array.isArray(dto.trail)).toBe(true);
  });

  it('marks a dissenting fork CONTESTED with the judge reason + trail', () => {
    const dto = classifyForkContention({ n: 2, ledger: dissentingLedger() });
    expect(dto.contested).toBe(true);
    expect(dto.disposition).toBe('escalate');
    expect(dto.reason).toBe('panel-changes');
    expect(dto.trail.length).toBeGreaterThan(0);
    // no question supplied → the `Fork N` fallback.
    expect(dto.question).toBe('Fork 2');
  });

  it('surfaces a gate-self fork CONTESTED regardless of a clean ledger (fail-closed hard invariant)', () => {
    const dto = classifyForkContention({ n: 3, ledger: cleanDiverseLedger(), signals: { gateSelf: true } });
    expect(dto.contested).toBe(true);
    expect(dto.reason).toBe('gate-self');
  });

  it('surfaces a fork with an unreadable (empty) ledger CONTESTED (fail-closed)', () => {
    const dto = classifyForkContention({ n: 4, ledger: [] });
    expect(dto.contested).toBe(true);
    expect(dto.disposition).toBe('escalate');
  });

  it('carries recommendedDefault through when present, omits it when absent', () => {
    const withRec = classifyForkContention({ n: 1, ledger: cleanDiverseLedger(), recommendedDefault: 'Recommended default: Fork 1 (b)' });
    expect(withRec.recommendedDefault).toBe('Recommended default: Fork 1 (b)');
    const without = classifyForkContention({ n: 1, ledger: cleanDiverseLedger() });
    expect(without).not.toHaveProperty('recommendedDefault');
  });

  it('a per-fork accept-best config cannot loosen the MANDATORY panel (mandatory-lens changes escalates at panel-changes, before the dissent branch)', () => {
    // A mandatory lens (`correctness#2`) wants changes, so the judge escalates at the panel-verdict step
    // (`panel-changes`) BEFORE the resolutionMode / dissentThreshold branch is ever reached. A per-fork
    // accept-best config — however high its threshold — can never buy off a mandatory-lens objection. This case
    // guards that invariant; it does NOT exercise the config-threading branch (it short-circuits first), which is
    // exactly why the vacuous version of this test proved nothing about threading. The branch itself is exercised
    // by the weighted-dissent-only case below.
    const acceptBest = resolveDispositionConfig({ override: { resolutionMode: 'accept-best', dissentThreshold: 0.9 } });
    const dto = classifyForkContention({ n: 1, ledger: dissentingLedger(), config: acceptBest });
    expect(dto.disposition).toBe('escalate');
    expect(dto.reason).toBe('panel-changes'); // escalated at the mandatory panel, NOT the tolerated-dissent branch
  });

  it('threads a per-fork accept-best config INTO the resolutionMode/dissentThreshold branch (weighted-dissent-only ledger)', () => {
    // The genuine config-threading proof the previous case only claimed. The weighted-dissent-only ledger has the
    // mandatory panel unanimously accepting, so the judge REACHES step 5 (the dissent policy) — the branch the
    // per-fork config actually steers. We assert the SAME ledger disposes DIFFERENTLY under two configs, which is
    // only possible if the fork's own config is threaded through `classifyForkContention`; strip the `config`
    // argument's threading and accept-best falls back to the shared default → both reasons collapse to
    // `dissent-present` and every assertion below fails.
    const ledger = weightedDissentOnlyLedger();

    // Shared DEFAULT config (present-unless-all-agree): any weighted dissent escalates at the GREEN judge. It
    // reaches the dissent branch (reason `dissent-present`), NOT `panel-changes` — the mandatory panel accepted.
    const withDefault = classifyForkContention({ n: 1, ledger });
    expect(withDefault.disposition).toBe('escalate');
    expect(withDefault.reason).toBe('dissent-present');

    // Per-fork ACCEPT-BEST (dissentThreshold 0.9): the GREEN judge PROPOSES auto-dispose because the weighted
    // dissent (0.2) is within tolerance — the trail records that accept-best decision, proving the fork's config
    // reached the dissentThreshold branch. The RED judge then refutes the tolerated dissent (a load-bearing
    // disagreement always reaches a human — the module consumes the COMBINED judge, `disposeVerdict`, not the
    // green proposal alone), so the fork still surfaces, now with reason `red-refuted`. That reason FLIP vs the
    // default on the identical ledger is the config-threading proof.
    const acceptBest = resolveDispositionConfig({ override: { resolutionMode: 'accept-best', dissentThreshold: 0.9 } });
    const withAcceptBest = classifyForkContention({ n: 1, ledger, config: acceptBest });
    expect(withAcceptBest.reason).toBe('red-refuted');
    expect(withAcceptBest.trail.some((line) => /accept-best/.test(line) && /dissentThreshold 0\.9/.test(line))).toBe(true);
    expect(withAcceptBest.reason).not.toBe(withDefault.reason);
  });
});

describe('buildMicroDecisionQueue', () => {
  const decision = {
    repo: 'webeverything',
    id: '2650-micro',
    num: '2650',
    title: 'A decision with mixed forks',
    forks: [
      { n: 3, question: 'Third — clean', ledger: cleanDiverseLedger() },
      { n: 1, question: 'First — dissent', ledger: dissentingLedger() },
      { n: 2, question: 'Second — gate-self', ledger: cleanDiverseLedger(), signals: { gateSelf: true } },
    ],
  };
  const q = buildMicroDecisionQueue(decision);

  it('surfaces ONLY the contested forks in the queue', () => {
    expect(q.contested.map((f) => f.n)).toEqual([1, 2]); // dissent + gate-self, fork-order ascending
    expect(q.contested.every((f) => f.contested)).toBe(true);
  });

  it('partitions the auto-cleared forks out of the surfaced queue', () => {
    expect(q.autoCleared.map((f) => f.n)).toEqual([3]);
    expect(q.autoCleared.every((f) => !f.contested)).toBe(true);
  });

  it('reports honest counts', () => {
    expect(q.forkCount).toBe(3);
    expect(q.contestedCount).toBe(2);
    expect(q.autoClearedCount).toBe(1);
  });

  it('carries the decision identity through', () => {
    expect(q.repo).toBe('webeverything');
    expect(q.decisionId).toBe('2650-micro');
    expect(q.decisionNum).toBe('2650');
    expect(q.decisionTitle).toBe('A decision with mixed forks');
  });

  it('a decision with no forks yields an honest empty queue (never throws)', () => {
    const empty = buildMicroDecisionQueue({ id: 'x', title: 'no forks', forks: [] });
    expect(empty.contested).toEqual([]);
    expect(empty.autoCleared).toEqual([]);
    expect(empty.contestedCount).toBe(0);
    expect(empty.forkCount).toBe(0);
  });

  it('a decision where every fork auto-clears surfaces nothing (all auto-disposed)', () => {
    const allClean = buildMicroDecisionQueue({
      id: 'y', title: 'all clean',
      forks: [ { n: 1, ledger: cleanDiverseLedger() }, { n: 2, ledger: cleanDiverseLedger() } ],
    });
    expect(allClean.contestedCount).toBe(0);
    expect(allClean.autoClearedCount).toBe(2);
  });
});

// --- #2665 read-port wiring + durable challenge/question record ------------------------------------------------

describe('microDecisionSubjectKey', () => {
  it('is a stable, reversible-ish `repo#decision#forkN` key', () => {
    expect(microDecisionSubjectKey('webeverything', '2665', 3)).toBe('webeverything#2665#fork3');
  });
  it('survives subjectSlug intact (no internal whitespace/dash to collapse)', () => {
    const key = microDecisionSubjectKey('webeverything', '2665', 3);
    expect(subjectSlug(key)).toBe(key);
  });
  it('falls back for empty inputs (never a bare `##fork0` collision on undefined)', () => {
    expect(microDecisionSubjectKey('', '', undefined)).toBe('webeverything#decision#fork0');
  });
});

describe('validateMicroDecisionRecord', () => {
  it('accepts a challenge with text', () => {
    const { ok, record } = validateMicroDecisionRecord({ kind: 'challenge', forkN: 1, text: '  too cautious  ' });
    expect(ok).toBe(true);
    expect(record).toMatchObject({ kind: 'challenge', forkN: 1, text: 'too cautious' });
  });
  it('accepts a withdraw with no text', () => {
    const { ok, record } = validateMicroDecisionRecord({ kind: 'withdraw', forkN: 2 });
    expect(ok).toBe(true);
    expect(record).not.toHaveProperty('text');
  });
  it('rejects an unknown kind, a missing forkN, and empty challenge text', () => {
    expect(validateMicroDecisionRecord({ kind: 'delete', forkN: 1 }).ok).toBe(false);
    expect(validateMicroDecisionRecord({ kind: 'question', text: 'x' }).ok).toBe(false);
    expect(validateMicroDecisionRecord({ kind: 'challenge', forkN: 1, text: '   ' }).ok).toBe(false);
  });
  it('rejects over-length text (durable-log hygiene)', () => {
    expect(validateMicroDecisionRecord({ kind: 'challenge', forkN: 1, text: 'x'.repeat(2001) }).ok).toBe(false);
  });
});

describe('foldMicroDecisionRecords', () => {
  it('is pending on an empty stream', () => {
    expect(foldMicroDecisionRecords([])).toEqual({ status: 'pending' });
  });
  it('latest-wins: a later question supersedes an earlier challenge', () => {
    const folded = foldMicroDecisionRecords([
      { kind: 'challenge', forkN: 1, text: 'wrong call' },
      { kind: 'question', forkN: 1, text: 'does (b) cover read-time?' },
    ]);
    expect(folded.status).toBe('asked');
    expect(folded.question).toBe('does (b) cover read-time?');
    expect(folded.challenge).toBe('wrong call'); // prior text kept so a switch-back restores it
  });
  it('a withdraw reopens to pending', () => {
    const folded = foldMicroDecisionRecords([
      { kind: 'challenge', forkN: 1, text: 'wrong call' },
      { kind: 'withdraw', forkN: 1 },
    ]);
    expect(folded.status).toBe('pending');
  });
});

describe('durable record store + buildSurfaceFromDisk (fs shell)', () => {
  let root; let juryDir; let microDir;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'md-'));
    juryDir = join(root, 'jury');
    microDir = join(root, 'micro');
    mkdirSync(juryDir, { recursive: true });
    mkdirSync(microDir, { recursive: true });
    process.env.CONVEYOR_JURY_DIR = juryDir;
    process.env.CONVEYOR_MICRO_DIR = microDir;
  });
  afterEach(() => {
    delete process.env.CONVEYOR_JURY_DIR;
    delete process.env.CONVEYOR_MICRO_DIR;
    rmSync(root, { recursive: true, force: true });
  });

  it('appends + reads back a durable challenge (round-trip)', () => {
    const key = microDecisionSubjectKey('webeverything', '2665', 1);
    const r = appendMicroDecisionRecord(key, { kind: MICRO_RECORD_KINDS.CHALLENGE, forkN: 1, text: 'over-cautious' });
    expect(r.ok).toBe(true);
    expect(r.record.at).toBeTruthy(); // stamped
    expect(readMicroDecisionRecord(key)).toMatchObject({ status: 'challenged', challenge: 'over-cautious' });
  });

  it('a rejected record is never written', () => {
    const key = microDecisionSubjectKey('webeverything', '2665', 1);
    const r = appendMicroDecisionRecord(key, { kind: 'bogus', forkN: 1 });
    expect(r.ok).toBe(false);
    expect(readMicroDecisionRecord(key)).toEqual({ status: 'pending' });
  });

  it('buildSurfaceFromDisk folds each fork\'s jury ledger + merges its durable record', () => {
    // Fork 1: a clean jury ledger on disk → auto-cleared. Fork 2: no ledger → fail-closed contested.
    const cleanLedger = cleanDiverseLedger();
    const key1 = microDecisionSubjectKey('webeverything', '2665', 1);
    writeFileSync(join(juryDir, `${subjectSlug(key1)}.jsonl`), cleanLedger.map((e) => JSON.stringify(e)).join('\n') + '\n');
    // Durable challenge on the contested fork 2.
    const key2 = microDecisionSubjectKey('webeverything', '2665', 2);
    appendMicroDecisionRecord(key2, { kind: 'challenge', forkN: 2, text: 'disputed' });

    const dto = buildSurfaceFromDisk({
      repo: 'webeverything', decisionKey: '2665', decisionId: '2665-x', decisionNum: '2665', decisionTitle: 'T',
      forks: [ { n: 1, question: 'Clean' }, { n: 2, question: 'No ledger' } ],
    });
    expect(dto.autoCleared.map((f) => f.n)).toEqual([1]);
    expect(dto.contested.map((f) => f.n)).toEqual([2]);
    const fork2 = dto.contested.find((f) => f.n === 2);
    expect(fork2.recordStatus).toBe('challenged');
    expect(fork2.recordedChallenge).toBe('disputed');
  });

  it('buildSurfaceFromDisk never throws on a decision with no forks', () => {
    const dto = buildSurfaceFromDisk({ repo: 'webeverything', decisionKey: '2665', forks: [] });
    expect(dto.contested).toEqual([]);
    expect(dto.forkCount).toBe(0);
  });

  it('a WITHDRAWN fork ships NO recorded text on the DTO (never resurrects a withdrawn challenge)', () => {
    const key = microDecisionSubjectKey('webeverything', '2665', 2);
    appendMicroDecisionRecord(key, { kind: 'challenge', forkN: 2, text: 'disputed' });
    appendMicroDecisionRecord(key, { kind: MICRO_RECORD_KINDS.WITHDRAW, forkN: 2 });
    const dto = buildSurfaceFromDisk({
      repo: 'webeverything', decisionKey: '2665', decisionId: '2665-x', decisionNum: '2665', decisionTitle: 'T',
      forks: [{ n: 2, question: 'No ledger' }],
    });
    const fork2 = dto.contested.find((f) => f.n === 2);
    expect(fork2.recordStatus).toBeUndefined();
    expect(fork2.recordedChallenge).toBeUndefined();
  });
});
