/**
 * @file scripts/lib/__tests__/verdict-ledger.test.mjs
 * @description Unit tests for the #3007 PHASE-1 verdict ledger — the schema, the append-only fold, the
 *   ledger↔label checker core, and the two claims this slice makes that the card got wrong (the key is not
 *   the content digest; the writers are not single).
 *
 * NOTE ON LOCATION. #3007's `scope` names `we:scripts/__tests__/verdict-ledger.test.mjs`. The module lives at
 * `scripts/lib/verdict-ledger.mjs`, and every sibling library test in this repo sits in `scripts/lib/__tests__/`
 * (`review-escalation.test.mjs`, `jury-ledger.test.mjs`, …). The card's path is corrected rather than followed.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  VERDICTS, VERDICT_VALUES, VERDICT_LEDGER_VERSION, VERDICT_LEDGER_KIND, ACTOR_PROVES,
  AGREEMENT, DISAGREE_DIRECTION,
  buildVerdictRecord, validateVerdictRecord, serializeVerdictRecord, parseVerdictLog,
  verdictClears, verdictLabel, verdictForLabelTarget, labelVerdictOf, foldVerdictLedger, ledgerCoversHead,
  compareLedgerToLabels, summarizeAgreement,
  appendVerdict, readVerdictLedger, foldRepo, verdictLedgerPath, verdictLedgerDir, defaultVerdictLedgerDir,
  listLedgerRepos,
} from '../verdict-ledger.mjs';
import { REVIEW_LABELS, normalizeContributionFingerprint } from '../review-escalation.mjs';
import { REVIEW_LABEL_TARGETS } from '../../review-set-label.mjs';
import { lockDirFor, makeLockEntry } from '../../readiness/file-locks.mjs';

const REPO = 'chalbert/web-everything';
const AT = '2026-08-10T12:00:00.000Z';

/** A minimal valid record, with overrides. */
const rec = (over = {}) => buildVerdictRecord({
  repo: REPO, pr: 1, verdict: VERDICTS.ACCEPTED, at: AT, source: 'test', ...over,
});

describe('#3007 schema — versioned, closed, and total over the label targets', () => {
  it('stamps the version + kind on every record', () => {
    const r = rec();
    expect(r.v).toBe(VERDICT_LEDGER_VERSION);
    expect(r.kind).toBe(VERDICT_LEDGER_KIND);
    expect(VERDICT_LEDGER_VERSION).toBeGreaterThanOrEqual(1);
  });

  it('carries every field #3007 requires: PR, content key, verdict, reviewer identity, timestamp, reason', () => {
    const r = rec({ reason: 'reviewer accepted', headSha: 'A'.repeat(40), declaredActor: 'nic', session: 's-1' });
    expect(r.pr).toBe(1);
    expect(r.repo).toBe(REPO);
    expect(r.verdict).toBe(VERDICTS.ACCEPTED);
    expect(r.at).toBe(AT);
    expect(r.reason).toBe('reviewer accepted');
    expect(r.coverage).toEqual({ headSha: 'a'.repeat(40), reviewedDiff: null, reviewedContribution: null });
    expect(r.actor.declared).toBe('nic');
    expect(r.actor.session).toBe('s-1');
  });

  it('the verdict set covers every REVIEW_LABEL_TARGETS member the single home can write', () => {
    // A label target with no ledger verdict is a ledger that is silently narrower than the labels it replaces.
    // Taken through the ONE mapping both the writer and the reconciling sink use — a local table here would be
    // a third copy, and copies of this mapping are what made the reconciler unsound (PR #1149 review).
    for (const target of REVIEW_LABEL_TARGETS) {
      expect(VERDICT_VALUES, `no ledger verdict for --to=${target}`).toContain(verdictForLabelTarget(target));
    }
    // …and the two hold labels the DRAIN parks under are expressible too, which Phase 2 requires.
    expect(VERDICT_VALUES).toContain(VERDICTS.PENDING);
    expect(VERDICT_VALUES).toContain(VERDICTS.HUMAN);
  });

  it('verdictForLabelTarget is total over the targets, fails closed, and inverts verdictLabel', () => {
    expect(verdictForLabelTarget('accepted')).toBe(VERDICTS.ACCEPTED);
    expect(verdictForLabelTarget('changes')).toBe(VERDICTS.CHANGES);
    expect(verdictForLabelTarget('clear-human')).toBe(VERDICTS.CLEAR_HUMAN);
    // `rearm` swaps review:changes → review:pending: a HOLD awaiting review, not a verdict on the diff.
    expect(verdictForLabelTarget('rearm')).toBe(VERDICTS.PENDING);
    // #x5e2ldj — `restamp` re-witnesses an EXISTING acceptance at a head the drain's own rebase moved. It gets
    // its own verdict rather than reusing ACCEPTED, so a reader counting acceptances does not count a carried
    // marker as a review that happened.
    expect(verdictForLabelTarget('restamp')).toBe(VERDICTS.RESTAMPED);
    expect(verdictForLabelTarget('restamp')).not.toBe(VERDICTS.ACCEPTED);
    // FAIL CLOSED. The old private copy of this ternary defaulted an unrecognised target to a verdict, which
    // is how a `clear-human` clearance would have been recorded as a `changes` hold.
    for (const bad of ['', 'merge-it', 'ACCEPTED', null, undefined, 0]) {
      expect(verdictForLabelTarget(bad), `\`${String(bad)}\` must not map to a verdict`).toBeNull();
    }
    // Round-trip: the verdict a target implies mirrors to the label that target's swap actually applies.
    for (const target of REVIEW_LABEL_TARGETS) {
      expect(verdictLabel(verdictForLabelTarget(target))).toBe(
        target === 'clear-human' || target === 'restamp' ? REVIEW_LABELS.accepted
          : target === 'rearm' ? REVIEW_LABELS.pending : REVIEW_LABELS[target],
      );
    }
  });

  it('verdictLabel is total over the closed set and matches decideSetLabel\'s applied labels', () => {
    for (const v of VERDICT_VALUES) expect(verdictLabel(v)).toBeTruthy();
    expect(verdictLabel(VERDICTS.ACCEPTED)).toBe(REVIEW_LABELS.accepted);
    // `clear-human` ADDS review:accepted (decideSetLabel), so it mirrors to the same label.
    expect(verdictLabel(VERDICTS.CLEAR_HUMAN)).toBe(REVIEW_LABELS.accepted);
    expect(verdictLabel(VERDICTS.CHANGES)).toBe(REVIEW_LABELS.changes);
    expect(verdictLabel(VERDICTS.HUMAN)).toBe(REVIEW_LABELS.human);
    expect(verdictLabel(VERDICTS.PENDING)).toBe(REVIEW_LABELS.pending);
    expect(verdictLabel('nonsense')).toBeNull();
  });

  it('only accepted / clear-human clear; an unknown verdict never clears (fail closed)', () => {
    expect(verdictClears(VERDICTS.ACCEPTED)).toBe(true);
    expect(verdictClears(VERDICTS.CLEAR_HUMAN)).toBe(true);
    expect(verdictClears(VERDICTS.CHANGES)).toBe(false);
    expect(verdictClears(VERDICTS.PENDING)).toBe(false);
    expect(verdictClears(VERDICTS.HUMAN)).toBe(false);
    expect(verdictClears('')).toBe(false);
    expect(verdictClears('accepted-ish')).toBe(false);
  });

  it('refuses a malformed record rather than writing a half-shaped row', () => {
    expect(() => rec({ repo: 'not-a-repo' })).toThrow(/owner\/name/);
    expect(() => rec({ pr: 0 })).toThrow(/positive integer/);
    expect(() => rec({ verdict: 'merged' })).toThrow(/unknown verdict/);
    expect(() => rec({ at: 'yesterday' })).toThrow(/ISO-8601/);
    expect(() => buildVerdictRecord({ repo: REPO, pr: 1, verdict: VERDICTS.CHANGES, at: AT })).toThrow(/`source`/);
  });

  it('a malformed content witness degrades to null instead of failing the row', () => {
    // Losing a witness costs a fail-closed coverage test later; losing the ROW costs the verdict itself.
    const r = rec({ headSha: 'zzz', reviewedDiff: 'nope', reviewedContribution: 'f'.repeat(63) });
    expect(r.coverage).toEqual({ headSha: null, reviewedDiff: null, reviewedContribution: null });
  });

  it('caps and single-lines free text so one record is one small append', () => {
    const r = rec({ reason: `${'x'.repeat(5000)}\nsecond line`, declaredActor: 'a\nb' });
    expect(r.reason.length).toBeLessThanOrEqual(500);
    expect(r.reason).not.toContain('\n');
    expect(r.actor.declared).toBe('a b');
    expect(JSON.stringify(r).length).toBeLessThan(4096);
  });
});

describe('#3007 identity — what the actor block can and cannot prove', () => {
  it('every row states its claim, and the claim is only `sanctioned-path`', () => {
    expect(rec().actor.proves).toBe(ACTOR_PROVES);
    expect(ACTOR_PROVES).toBe('sanctioned-path');
  });

  it('`proves` is derived on read, so a forged row cannot upgrade its own claim', () => {
    const forged = { ...rec(), actor: { ...rec().actor, proves: 'human-verified-by-webauthn' } };
    const { valid, record } = validateVerdictRecord(forged);
    expect(valid).toBe(true);
    expect(record.actor.proves).toBe(ACTOR_PROVES);
  });

  it('`clears` is derived on read too — a row cannot say "changes, but it clears"', () => {
    const forged = { ...rec({ verdict: VERDICTS.CHANGES }), clears: true };
    const { record } = validateVerdictRecord(forged);
    expect(record.verdict).toBe(VERDICTS.CHANGES);
    expect(record.clears).toBe(false);
  });

  it('records the machine-checked independence status verbatim, including the benign self-clear', () => {
    // A subagent inherits its parent session id, so `self-clear` on a clear-human row is the ORDINARY
    // operator workflow (#2844 exemption), not an alarm. The ledger records the status; it does not judge it.
    const r = rec({ verdict: VERDICTS.CLEAR_HUMAN, independence: 'self-clear' });
    expect(r.actor.independence).toBe('self-clear');
    expect(r.clears).toBe(true);
  });
});

describe('#3007 append-only — records are added, never edited, and latest wins', () => {
  it('a newer verdict supersedes an older one for the same PR, with both rows retained', () => {
    const folded = foldVerdictLedger([
      rec({ pr: 7, verdict: VERDICTS.PENDING, at: '2026-08-10T10:00:00.000Z' }),
      rec({ pr: 7, verdict: VERDICTS.ACCEPTED, at: '2026-08-10T11:00:00.000Z' }),
    ]).get(7);
    expect(folded.current.verdict).toBe(VERDICTS.ACCEPTED);
    expect(folded.clears).toBe(true);
    expect(folded.history).toHaveLength(2);
    expect(folded.history[0].verdict).toBe(VERDICTS.PENDING);
  });

  it('a hold is cleared by a LATER clearing record, never by removing the hold', () => {
    const stream = [
      rec({ pr: 9, verdict: VERDICTS.HUMAN, at: '2026-08-10T10:00:00.000Z' }),
      rec({ pr: 9, verdict: VERDICTS.CLEAR_HUMAN, at: '2026-08-10T11:00:00.000Z', declaredActor: 'nic' }),
    ];
    const folded = foldVerdictLedger(stream).get(9);
    expect(folded.clears).toBe(true);
    expect(folded.outstandingHolds).toEqual([]);
    // The hold row is STILL THERE — clearing is an addition, not a deletion.
    expect(folded.history.map((r) => r.verdict)).toEqual([VERDICTS.HUMAN, VERDICTS.CLEAR_HUMAN]);
  });

  it('a hold appended AFTER a clearance is outstanding again (the re-hold shape)', () => {
    const folded = foldVerdictLedger([
      rec({ pr: 9, verdict: VERDICTS.CLEAR_HUMAN, at: '2026-08-10T10:00:00.000Z' }),
      rec({ pr: 9, verdict: VERDICTS.HUMAN, at: '2026-08-10T11:00:00.000Z', reason: 'stale acceptance' }),
    ]).get(9);
    expect(folded.clears).toBe(false);
    expect(folded.outstandingHolds).toHaveLength(1);
    expect(folded.outstandingHolds[0].reason).toBe('stale acceptance');
  });

  it('folds many PRs independently and keeps append order per PR', () => {
    const folded = foldVerdictLedger([
      rec({ pr: 1, verdict: VERDICTS.CHANGES }),
      rec({ pr: 2, verdict: VERDICTS.ACCEPTED }),
      rec({ pr: 1, verdict: VERDICTS.ACCEPTED }),
    ]);
    expect(folded.get(1).current.verdict).toBe(VERDICTS.ACCEPTED);
    expect(folded.get(1).history).toHaveLength(2);
    expect(folded.get(2).history).toHaveLength(1);
  });

  it('an empty / garbage stream folds to an empty ledger rather than throwing', () => {
    expect(foldVerdictLedger([]).size).toBe(0);
    expect(foldVerdictLedger(null).size).toBe(0);
    expect(foldVerdictLedger([null, 42, {}]).size).toBe(0);
  });
});

describe('#3007 log parsing — tolerant, never throws', () => {
  it('skips blank, unparseable and schema-invalid lines and keeps the rest in order', () => {
    const good = serializeVerdictRecord(rec({ pr: 3 }));
    const good2 = serializeVerdictRecord(rec({ pr: 4, verdict: VERDICTS.CHANGES }));
    expect(good.ok).toBe(true);
    const text = [
      '',
      '   ',
      '{not json',
      JSON.stringify({ v: 1, kind: 'something.else', repo: REPO, pr: 5, verdict: 'accepted', at: AT }),
      JSON.stringify({ v: 1, kind: VERDICT_LEDGER_KIND, repo: REPO, pr: 6, verdict: 'bogus', at: AT }),
      good.line,
      good2.line,
    ].join('\n');
    const parsed = parseVerdictLog(text);
    expect(parsed.map((r) => r.pr)).toEqual([3, 4]);
  });

  it('serialize refuses an invalid record and reports why (nothing is written)', () => {
    const bad = serializeVerdictRecord({ v: 1, kind: VERDICT_LEDGER_KIND, repo: 'x', pr: -1, verdict: 'nope', at: 'no' });
    expect(bad.ok).toBe(false);
    expect(bad.line).toBeNull();
    expect(bad.errors.join(' ')).toMatch(/repo/);
    expect(bad.errors.join(' ')).toMatch(/pr/);
  });

  it('round-trips a record through serialize → parse unchanged', () => {
    const r = rec({ pr: 11, headSha: 'b'.repeat(40), reviewedDiff: 'c'.repeat(64), findingCount: 3 });
    const [back] = parseVerdictLog(serializeVerdictRecord(r).line);
    expect(back).toEqual(r);
  });
});

describe('#3007 THE KEY — a rebase that breaks the fingerprint must NOT break the record', () => {
  // The card asked for records "keyed by PR + the diff content-hash the verdict covered". #3046 and #3052
  // proved that digest DIVERGED on a byte-identical contribution; #3054 has since repaired it, and the key is
  // STILL `repo` + `pr` + append order — see the first test for the reason that outlived the repair.

  it('#3046 is FIXED — that same base move no longer diverges the digest, and the key still is not it', () => {
    // One contribution, two bases: `main` grew a DIFFERENT number of lines above each of the two hunks
    // (a non-uniform base move). Every `+`/`-` line, hunk length and section heading is identical.
    const diffAt = (startA, startB) => [
      'diff --git a/src/thing.mjs b/src/thing.mjs',
      'index 1111111..2222222 100644',
      '--- a/src/thing.mjs',
      '+++ b/src/thing.mjs',
      `@@ -${startA},6 +${startA},7 @@ export function alpha() {`,
      '   one();',
      '   two();',
      '   three();',
      '+  guard();',
      '   four();',
      '   five();',
      `@@ -${startB},6 +${startB},7 @@ export function beta() {`,
      '   six();',
      '   seven();',
      '   eight();',
      '+  guard();',
      '   nine();',
      '   ten();',
      '',
    ].join('\n');
    // accept-time: hunks at 100 and 200 (gap 100). post-rebase: main grew 15 lines above the first hunk and 4
    // above the second → 115 and 219 (gap 104). Same contribution, different digest.
    const before = normalizeContributionFingerprint(diffAt(100, 200));
    const after = normalizeContributionFingerprint(diffAt(115, 219));
    expect(before).toBeTruthy();
    expect(after).toBeTruthy();
    // #3054 (via #3046/#3052) dropped both base-derived position signals, so this now HOLDS. The key decision
    // below is unchanged by that, and this test is kept rather than deleted to say why: the digest is a
    // COVERAGE witness, not an identity. It is still not usable as a lookup key, for a reason the repair did
    // not remove and deliberately widened — two DIFFERENT contributions collide whenever one is a relocation of
    // the other (#3021, open, pinned in `we:scripts/lib/__tests__/review-escalation.test.mjs`). A key that two
    // different verdicts can share is worse than one that a rebase breaks.
    expect(after).toBe(before);
  });

  it('the ledger record for that PR is still found after the digest diverges', () => {
    // THE WHOLE POINT. A record keyed on the digest would be unreachable after the rebase above. Keyed on
    // repo + pr + append order, the clearance is still the live verdict, and the stale witness is visible as
    // data rather than as a lost row.
    const cleared = rec({ pr: 1106, verdict: VERDICTS.CLEAR_HUMAN, reviewedContribution: 'a'.repeat(64) });
    const folded = foldVerdictLedger([cleared]).get(1106);
    expect(folded.current.verdict).toBe(VERDICTS.CLEAR_HUMAN);
    expect(folded.clears).toBe(true);
    expect(folded.current.coverage.reviewedContribution).toBe('a'.repeat(64));
  });

  it('ledgerCoversHead delegates to acceptanceCoversHead — one staleness rule, not a second one', () => {
    const r = rec({ pr: 5, headSha: 'a'.repeat(40), reviewedContribution: 'c'.repeat(64) });
    // Same head → covered.
    expect(ledgerCoversHead({ record: r, headSha: 'a'.repeat(40) }).covers).toBe(true);
    // Head moved, contribution witness matches → covered by the #x9xqexm escape, inherited not re-derived.
    expect(ledgerCoversHead({
      record: r, headSha: 'b'.repeat(40), headContribution: 'c'.repeat(64),
    }).covers).toBe(true);
    // Head moved, witnesses differ → stale, exactly as the shared gate says.
    const stale = ledgerCoversHead({ record: r, headSha: 'b'.repeat(40), headContribution: 'd'.repeat(64) });
    expect(stale.covers).toBe(false);
    expect(stale.reason).toMatch(/head advanced/);
    // No record → nothing to contradict, fails OPEN like the shared gate on a missing marker.
    expect(ledgerCoversHead({ record: null, headSha: 'b'.repeat(40) }).covers).toBe(true);
  });
});

describe('#3007 PHASE-1 CHECKER — ledger vs label', () => {
  const folded = (verdict, over = {}) => foldVerdictLedger([rec({ pr: 1, verdict, ...over })]).get(1);
  const L = (...names) => names.map((name) => ({ name }));

  it('labelVerdictOf uses decideReviewGate precedence: accepted → changes → human → pending', () => {
    expect(labelVerdictOf(L(REVIEW_LABELS.accepted, REVIEW_LABELS.human))).toBe(VERDICTS.ACCEPTED);
    expect(labelVerdictOf(L(REVIEW_LABELS.changes, REVIEW_LABELS.human))).toBe(VERDICTS.CHANGES);
    expect(labelVerdictOf(L(REVIEW_LABELS.human, REVIEW_LABELS.pending))).toBe(VERDICTS.HUMAN);
    expect(labelVerdictOf(L(REVIEW_LABELS.pending))).toBe(VERDICTS.PENDING);
    expect(labelVerdictOf(L('size/S'))).toBeNull();
    expect(labelVerdictOf([])).toBeNull();
  });

  it('agrees when the two sides match', () => {
    const row = compareLedgerToLabels({ pr: 1, labels: L(REVIEW_LABELS.accepted), folded: folded(VERDICTS.ACCEPTED) });
    expect(row.status).toBe(AGREEMENT.AGREE);
    expect(row.direction).toBeNull();
  });

  it('agrees when a clear-human row faces the review:accepted label it applies', () => {
    const row = compareLedgerToLabels({
      pr: 1, labels: L(REVIEW_LABELS.accepted), folded: folded(VERDICTS.CLEAR_HUMAN),
    });
    expect(row.status).toBe(AGREEMENT.AGREE);
  });

  it('flags the DANGEROUS direction: the ledger holds while the label clears', () => {
    const row = compareLedgerToLabels({ pr: 1, labels: L(REVIEW_LABELS.accepted), folded: folded(VERDICTS.HUMAN) });
    expect(row.status).toBe(AGREEMENT.DISAGREE);
    expect(row.direction).toBe(DISAGREE_DIRECTION.LEDGER_HOLDS_LABEL_CLEARS);
    expect(row.ledgerClears).toBe(false);
    expect(row.labelClears).toBe(true);
  });

  it('flags the safe direction separately: the ledger clears while the label holds', () => {
    const row = compareLedgerToLabels({ pr: 1, labels: L(REVIEW_LABELS.human), folded: folded(VERDICTS.CLEAR_HUMAN) });
    expect(row.status).toBe(AGREEMENT.DISAGREE);
    expect(row.direction).toBe(DISAGREE_DIRECTION.LEDGER_CLEARS_LABEL_HOLDS);
  });

  it('flags a same-side divergence (both hold, different labels) without calling it dangerous', () => {
    const row = compareLedgerToLabels({ pr: 1, labels: L(REVIEW_LABELS.pending), folded: folded(VERDICTS.CHANGES) });
    expect(row.status).toBe(AGREEMENT.DISAGREE);
    expect(row.direction).toBe(DISAGREE_DIRECTION.SAME_SIDE);
  });

  it('reports an unledgered label separately from a disagreement', () => {
    const row = compareLedgerToLabels({ pr: 1, labels: L(REVIEW_LABELS.pending), folded: null });
    expect(row.status).toBe(AGREEMENT.UNLEDGERED);
    expect(row.detail).toMatch(/park path/);
  });

  it('reports an orphan ledger row with no label at all', () => {
    const row = compareLedgerToLabels({ pr: 1, labels: L('size/M'), folded: folded(VERDICTS.ACCEPTED) });
    expect(row.status).toBe(AGREEMENT.UNLABELED);
  });

  it('a PR with neither a row nor a label is agreement, not a finding', () => {
    const row = compareLedgerToLabels({ pr: 1, labels: [], folded: null });
    expect(row.status).toBe(AGREEMENT.AGREE);
  });

  it('summarizes into the Phase-2 decision, counting the two hazards apart', () => {
    const rows = [
      compareLedgerToLabels({ pr: 1, labels: L(REVIEW_LABELS.accepted), folded: folded(VERDICTS.ACCEPTED) }),
      compareLedgerToLabels({ pr: 2, labels: L(REVIEW_LABELS.accepted), folded: folded(VERDICTS.HUMAN) }),
      compareLedgerToLabels({ pr: 3, labels: L(REVIEW_LABELS.pending), folded: null }),
    ];
    const s = summarizeAgreement(rows);
    expect(s.total).toBe(3);
    expect(s.counts).toEqual({ agree: 1, disagree: 1, unledgered: 1, unlabeled: 0 });
    expect(s.dangerous.map((r) => r.pr)).toEqual([2]);
    expect(s.owedBeforePhase2).toBe(1);
    expect(s.phase2Safe).toBe(false);
  });

  it('phase2Safe is true only with zero disagreements AND zero unledgered labels', () => {
    const clean = summarizeAgreement([
      compareLedgerToLabels({ pr: 1, labels: L(REVIEW_LABELS.accepted), folded: folded(VERDICTS.ACCEPTED) }),
    ]);
    expect(clean.phase2Safe).toBe(true);
    const owed = summarizeAgreement([compareLedgerToLabels({ pr: 1, labels: L(REVIEW_LABELS.human), folded: null })]);
    expect(owed.phase2Safe).toBe(false);
    expect(owed.counts.disagree).toBe(0);
  });
});

describe('#3007 IO — the machine-global home, the locked append, the tolerant read', () => {
  let dir;
  const prevDir = process.env.WE_VERDICT_LEDGER_DIR;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'we-verdict-ledger-'));
    process.env.WE_VERDICT_LEDGER_DIR = dir;
  });
  afterEach(() => {
    if (prevDir === undefined) delete process.env.WE_VERDICT_LEDGER_DIR;
    else process.env.WE_VERDICT_LEDGER_DIR = prevDir;
    rmSync(dir, { recursive: true, force: true });
    rmSync(`${dir}-locks`, { recursive: true, force: true });
  });

  it('anchors the ledger to HOME, not to the checkout — a per-clone ledger cannot be a merge authority', () => {
    // A lane clone, the primary and the drain's own dedicated clone must all read ONE file, so the home is
    // HOME-anchored exactly like `DRAIN_LOCK_ROOT`. Asserted on the pure resolver: `verdictLedgerDir()` is
    // deliberately redirected under vitest so no test can write to the operator's real ledger.
    expect(defaultVerdictLedgerDir('/Users/someone')).toBe(join('/Users/someone', '.claude', 'verdict-ledger'));
    expect(defaultVerdictLedgerDir('/Users/someone').startsWith(process.cwd())).toBe(false);
  });

  it('never resolves to the real home under a test run, even with no explicit redirect', () => {
    delete process.env.WE_VERDICT_LEDGER_DIR;
    const underTest = verdictLedgerDir();
    process.env.WE_VERDICT_LEDGER_DIR = dir;
    expect(process.env.VITEST).toBeTruthy();
    expect(underTest).not.toBe(defaultVerdictLedgerDir());
    expect(underTest).toBe(join(tmpdir(), 'we-verdict-ledger-vitest'));
  });

  it('one file per repo, named reversibly', () => {
    expect(verdictLedgerPath(REPO)).toBe(join(dir, 'chalbert-web-everything.jsonl'));
  });

  it('appends, reads back, and folds', () => {
    expect(appendVerdict(rec({ pr: 20, verdict: VERDICTS.PENDING })).ok).toBe(true);
    expect(appendVerdict(rec({ pr: 20, verdict: VERDICTS.ACCEPTED })).ok).toBe(true);
    expect(appendVerdict(rec({ pr: 21, verdict: VERDICTS.CHANGES })).ok).toBe(true);
    expect(readVerdictLedger(REPO)).toHaveLength(3);
    const folded = foldRepo(REPO);
    expect(folded.get(20).current.verdict).toBe(VERDICTS.ACCEPTED);
    expect(folded.get(20).history).toHaveLength(2);
    expect(folded.get(21).clears).toBe(false);
    expect(listLedgerRepos()).toEqual(['chalbert-web-everything']);
  });

  it('each append is exactly one newline-terminated line (so one write is one record)', () => {
    appendVerdict(rec({ pr: 30 }));
    appendVerdict(rec({ pr: 31 }));
    const text = readFileSync(verdictLedgerPath(REPO), 'utf8');
    expect(text.endsWith('\n')).toBe(true);
    expect(text.trim().split('\n')).toHaveLength(2);
    for (const line of text.trim().split('\n')) expect(() => JSON.parse(line)).not.toThrow();
  });

  it('takes the writer lock — the card\'s "the drain lease guarantees a single writer" does not hold here', () => {
    // Every writer reaches the ledger through review-set-label.mjs, whose callers (the /review ceremony, the
    // #3035 operation, the console, the conveyor rearm) hold NO drain lease. So the append locks for itself.
    const r = appendVerdict(rec({ pr: 40 }));
    expect(r.ok).toBe(true);
    expect(r.locked).toBe(true);
    expect(r.record.unlocked).toBeUndefined();
  });

  it('a lock it cannot take costs the ROW A FLAG, never the record', () => {
    // Simulate a live holder by planting the lock dir the primitive uses, then confirm the verdict survives.
    const lockRoot = `${dir}-locks`;
    const held = lockDirFor(lockRoot, '<verdict-ledger:append>');
    mkdirSync(held, { recursive: true });
    writeFileSync(join(held, 'lock.json'), `${JSON.stringify(
      makeLockEntry('someone-else', '<verdict-ledger:append>', new Date().toISOString(), 999999), null, 2,
    )}\n`, 'utf8');

    const r = appendVerdict(rec({ pr: 41, verdict: VERDICTS.CHANGES }));
    expect(r.ok).toBe(true);
    expect(r.locked).toBe(false);
    // The record landed AND says the weaker case applied, rather than being silently dropped.
    expect(readVerdictLedger(REPO).map((x) => x.pr)).toContain(41);
    expect(readVerdictLedger(REPO).find((x) => x.pr === 41).unlocked).toBe(true);
  });

  it('refuses an invalid record and writes nothing', () => {
    const bad = appendVerdict({ v: 1, kind: VERDICT_LEDGER_KIND, repo: REPO, pr: 1, verdict: 'nope', at: AT });
    expect(bad.ok).toBe(false);
    expect(bad.errors.length).toBeGreaterThan(0);
    expect(readVerdictLedger(REPO)).toEqual([]);
  });

  it('a missing ledger reads as empty rather than throwing', () => {
    expect(readVerdictLedger('someone/else')).toEqual([]);
    expect(foldRepo('someone/else').size).toBe(0);
  });
});
