/**
 * @file run-store.test.mjs — the run record and its store (#3032).
 *
 * THE LOAD-BEARING TEST IN HERE is `a corrupt record is REFUSED, never read as absent`. It is the one place
 * this store deliberately behaves UNLIKE `we:scripts/conveyor/queue-store.mjs`, whose `parseQueue` degrades
 * a corrupt file to `[]` so a dispatch tick is never wedged. The nature of the state is different: a run
 * record read as "absent" would restart a run whose effects may already be half-applied, so it follows the
 * `we:scripts/lib/lane-verify.mjs` precedent (#2833) and refuses instead.
 */

import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it, expect } from 'vitest';

import {
  RUN_RECORD_VERSION,
  assertRunRecord,
  effectKey,
  isValidRunId,
  newRunRecord,
  normalizeJudgeTelemetry,
  parseRunRecord,
  serializeRunRecord,
  totalJudgeSpend,
  validateRunRecord,
  isPollableHandle,
} from '../run-record.mjs';
import { inFlight, inFlightEntries } from '../effect-executor.mjs';
import {
  createFileRunStore,
  createMemoryRunStore,
  deleteRun,
  listRunIds,
  newRunId,
  readRun,
  resolveRunsDir,
  runPath,
  runsDir,
  tryReadRun,
  writeRun,
} from '../run-store.mjs';

let dir;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'we-op-runs-')); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

const sample = () => newRunRecord({ id: 'run-sample', op: 'fixture-review', input: { pr: 1 } });

describe('the pure core', () => {
  it('newRunRecord produces exactly the documented shape', () => {
    expect(sample()).toEqual({
      v: RUN_RECORD_VERSION, id: 'run-sample', op: 'fixture-review',
      input: { pr: 1 }, cursor: 0, findings: {}, verdict: null, effects: [], telemetry: [], pending: null,
    });
  });

  it('round-trips through serialize/parse', () => {
    const parsed = parseRunRecord(serializeRunRecord(sample()));
    expect(parsed.ok).toBe(true);
    expect(parsed.record).toEqual(sample());
  });

  it('refuses an id that could escape the runs directory', () => {
    for (const bad of ['../escape', 'a/b', '', '.', '..', 'x'.repeat(200)]) expect(isValidRunId(bad)).toBe(false);
    expect(isValidRunId('run-8f14e45f')).toBe(true);
    expect(() => newRunRecord({ id: '../escape', op: 'x' })).toThrow(/invalid run id/);
    expect(() => runPath('../escape', dir)).toThrow(/invalid run id/);
  });

  it('reports EVERY validation error, not just the first', () => {
    const { ok, errors } = validateRunRecord({ v: 1, id: 'r', op: '', cursor: -1, findings: null, effects: 'no', pending: 3 });
    expect(ok).toBe(false);
    expect(errors).toEqual(expect.arrayContaining([
      'missing operation name', '`input` must be an object', '`cursor` must be a non-negative integer',
      '`findings` must be an object', '`effects` must be an array', '`pending` must be null or an object',
    ]));
  });

  it('refuses a duplicate effect key — the idempotency key must be unique within a run', () => {
    const record = { ...sample(), effects: [0, 1].map(() => ({ key: 'run-sample#0#0', stepIndex: 0, index: 0, type: 't', status: 'declared' })) };
    expect(validateRunRecord(record).errors).toContain('duplicate effect key "run-sample#0#0" — the idempotency key must be unique within a run');
  });

  /**
   * THE FIELDS `in-flight` DECIDES ON (#3073; PR #1180 review, finding 4). Adding a status to the enum without
   * checking its payload lets a hand-built or truncated record claim a state the executor's rules are keyed on:
   * `handle` decides refuse-vs-resume on replay, `expectedBy` decides running-vs-overdue. A malformed one is a
   * wrong answer to both questions, not a cosmetic defect.
   */
  describe('an in-flight entry carries the fields its own rules read', () => {
    const withEffect = (over) => ({
      ...sample(),
      effects: [{ key: 'run-sample#0#0', stepIndex: 0, index: 0, type: 't', status: 'in-flight', ...over }],
    });

    it('accepts a handle, and accepts null — a dispatch that lost it before reporting', () => {
      expect(validateRunRecord(withEffect({ handle: 'sess-abc' })).ok).toBe(true);
      expect(validateRunRecord(withEffect({ handle: null })).ok).toBe(true);
      expect(validateRunRecord(withEffect({})).ok).toBe(true); // absent is the same as null
    });

    // `''` is falsy, so it would read as "no handle" while looking like one. WHITESPACE is the worse case and
    // is TRUTHY — it passed the first cut, was bucketed `running`, and the driver parked forever telling the
    // operator to poll a blank handle (PR #1180 review, finding 3). `inFlight()` trims, so the validator was
    // looser than the constructor it backstops.
    it('refuses a non-string, empty, or BLANK handle', () => {
      for (const bad of [12345, {}, '', '   ', '\t\n']) {
        expect(validateRunRecord(withEffect({ handle: bad })).errors.join(' ')).toMatch(/in-flight with an invalid handle/);
      }
    });

    // `.trim()` was not enough: a zero-width space is TRUTHY and survives it, so it reached `inFlightEntries`
    // as an observable handle and the operator was told to poll a blank one (PR #1185 review, finding 5).
    it('refuses a handle with no VISIBLE character, however truthy it is', () => {
      for (const invisible of ['\u200b', '\u200b\u200c', '\u00a0', '\ufeff', '\u3000', '\u2028']) {
        expect(`${JSON.stringify(invisible)}: ${validateRunRecord(withEffect({ handle: invisible })).ok}`)
          .toBe(`${JSON.stringify(invisible)}: false`);
      }
      expect(validateRunRecord(withEffect({ handle: ' sess-a ' })).ok).toBe(true); // padded, but pollable
    });

    // AN ALLOWLIST, because two denylists in a row were wrong (PR #1191 review, finding 1). The previous fix
    // was a denylist of the four code points the last reviewer had named, called itself "has a visible
    // character", and let sixteen more through. Built numerically so no invisible literal sits in the source.
    it('refuses every unusable handle the reviewer found, and the four before them', () => {
      const unusable = [
        [0x00, 'NUL'], [0x07, 'BEL'], [0x1b, 'ESC'], [0x7f, 'DEL'], [0x0301, 'combining acute'],
        [0xd800, 'lone surrogate'], [0x00ad, 'soft hyphen'], [0x061c, 'Arabic letter mark'],
        [0x202a, 'LRE'], [0x202e, 'RLO'], [0x2066, 'LRI'], [0x2069, 'PDI'], [0xfe0f, 'VS16'],
        [0x3164, 'Hangul filler'], [0x115f, 'choseong filler'], [0xe0001, 'tag'],
        [0x200b, 'ZWSP'], [0x00a0, 'NBSP'], [0xfeff, 'BOM'], [0x3000, 'ideographic space'],
      ];
      for (const [cp, name] of unusable) {
        const handle = String.fromCodePoint(cp);
        expect(`${name}: ${isPollableHandle(handle)}`).toBe(`${name}: false`);
        expect(`${name}: ${validateRunRecord(withEffect({ handle })).ok}`).toBe(`${name}: false`);
      }
    });

    it('accepts what a handle actually looks like', () => {
      for (const good of ['sess-abc', '12345', 'a', 'build_7', ' sess-a ', 'ab-CD-99']) {
        expect(`${good}: ${isPollableHandle(good)}`).toBe(`${good}: true`);
      }
    });

    // The validator and the constructor ask the SAME question, so they cannot drift apart on it.
    it('agrees with `inFlight()` about what counts as a handle', () => {
      for (const invisible of ['\u200b', '\u00a0', '   ']) {
        expect(() => inFlight({ handle: invisible })).toThrow(/visible character/);
        expect(validateRunRecord(withEffect({ handle: invisible })).ok).toBe(false);
      }
      expect(() => inFlight({ handle: 'sess-a' })).not.toThrow();
      expect(validateRunRecord(withEffect({ handle: 'sess-a' })).ok).toBe(true);
    });

    // An unparseable date makes every entry read as never-overdue, which is exactly what hides a stalled job.
    it('refuses an unparseable expectedBy or startedAt, and accepts an absent one', () => {
      expect(validateRunRecord(withEffect({ handle: 'h', expectedBy: 'soon' })).errors.join(' ')).toMatch(/unparseable expectedBy/);
      expect(validateRunRecord(withEffect({ handle: 'h', startedAt: 'yesterday' })).errors.join(' ')).toMatch(/unparseable startedAt/);
      expect(validateRunRecord(withEffect({ handle: 'h', expectedBy: null })).ok).toBe(true);
      expect(validateRunRecord(withEffect({ handle: 'h', expectedBy: '2099-01-01T00:00:00.000Z' })).ok).toBe(true);
    });

    // The checks are scoped to the status that reads them — a `pending` entry is not asked for a handle.
    // THE READERS ASK IT TOO (PR #1191 review, finding 2). `inFlightEntries` is the function the item named
    // as the failure site and was the last place still using bare truthiness, so a handle the validator
    // refuses still bucketed `running` when a record reached it another way.
    it('inFlightEntries asks the same question, so a refused handle is never `running`', () => {
      const rec = (handle) => ({
        ...sample(),
        effects: [{ key: 'k', stepIndex: 0, index: 0, type: 't', status: 'in-flight', handle }],
      });
      for (const invisible of [String.fromCodePoint(0x200b), String.fromCodePoint(0x00a0), '   ', '']) {
        expect(inFlightEntries(rec(invisible)).unknown).toHaveLength(1);
        expect(inFlightEntries(rec(invisible)).running).toHaveLength(0);
      }
      expect(inFlightEntries(rec('sess-abc')).running).toHaveLength(1);
    });

    it('does not impose the in-flight fields on any other status', () => {
      expect(validateRunRecord({
        ...sample(),
        effects: [{ key: 'k', stepIndex: 0, index: 0, type: 't', status: 'pending', handle: 12345 }],
      }).ok).toBe(true);
    });
  });

  it('effectKey is (run, step, ordinal) — the ordinal is what makes a PARTIAL replay exact (#2964)', () => {
    expect(effectKey('run-1', 3, 0)).toBe('run-1#3#0');
    expect(effectKey('run-1', 3, 1)).toBe('run-1#3#1');
  });

  it('assertRunRecord throws carrying the errors', () => {
    expect(() => assertRunRecord({}, 'thing')).toThrow(/operations: thing is invalid — /);
  });

  // The juror-spend meter. It is written by the ADAPTER (the engine never spawns), so what may land on the
  // record is whitelisted — the record is serialized to disk and printed verbatim by `--json`.
  it('normalizeJudgeTelemetry keeps the meter and drops everything else, including the material', () => {
    const row = normalizeJudgeTelemetry({
      step: 'judge',
      stepIndex: 1,
      telemetry: {
        costUsd: 0.5, durationMs: 100, wallMs: 120, numTurns: 2, loadedContextTokens: 9,
        sessionId: 's', stopReason: 'end_turn', lens: 'correctness', model: 'sonnet', effort: 'high',
        // The three that must NEVER land: the argv (which embeds the mandate), the answer, a NaN.
        argv: ['--append-system-prompt', 'THE MANDATE'], value: { findings: [] }, bogus: NaN,
        usage: { input_tokens: 5, note: 'not a number' },
      },
    });
    expect(row).toEqual({
      step: 'judge', stepIndex: 1, costUsd: 0.5, durationMs: 100, wallMs: 120, numTurns: 2,
      loadedContextTokens: 9, sessionId: 's', stopReason: 'end_turn', lens: 'correctness',
      model: 'sonnet', effort: 'high', usage: { input_tokens: 5 },
    });
    expect(Object.isFrozen(row)).toBe(true);
    expect(JSON.stringify(row)).not.toContain('THE MANDATE');
  });

  /**
   * #3203 — a juror that hit the WALL and a juror that crashed used to produce identical rows, which is what
   * teaches a reader to retry rather than to look. The flag makes them different facts in the record.
   */
  it('normalizeJudgeTelemetry records `timedOut` only when it is true', () => {
    const withFlag = normalizeJudgeTelemetry({ step: 'judge', stepIndex: 1, telemetry: { costUsd: 1, timedOut: true } });
    expect(withFlag.timedOut).toBe(true);
    // Absence is the ordinary case: a `false` on every row is noise, so it is simply not written.
    for (const timedOut of [false, undefined, 'true', 1, null]) {
      expect(normalizeJudgeTelemetry({ step: 'judge', telemetry: { costUsd: 1, timedOut } }))
        .not.toHaveProperty('timedOut');
    }
  });

  it('totalJudgeSpend sums the meter, and reports zero for a run that spawned nothing', () => {
    const run = { ...sample(), telemetry: [{ costUsd: 0.02, wallMs: 100 }, { costUsd: 0.03, wallMs: 250, durationMs: 200 }] };
    expect(totalJudgeSpend(run)).toEqual({ jurors: 2, costUsd: 0.05, wallMs: 350, durationMs: 200 });
    expect(totalJudgeSpend(sample())).toEqual({ jurors: 0, costUsd: 0, wallMs: 0, durationMs: 0 });
    expect(totalJudgeSpend(undefined)).toEqual({ jurors: 0, costUsd: 0, wallMs: 0, durationMs: 0 });
  });

  it('validates `telemetry` when present and TOLERATES it absent — a pre-upgrade record is not corrupt', () => {
    const { telemetry, ...legacy } = sample();
    expect(telemetry).toEqual([]);
    expect(validateRunRecord(legacy).ok).toBe(true);
    expect(validateRunRecord({ ...sample(), telemetry: 'no' }).errors).toContain('`telemetry` must be an array when present');
    expect(validateRunRecord({ ...sample(), telemetry: [1] }).errors).toContain('telemetry[0] must be an object');
  });
});

describe('a corrupt record is REFUSED, never read as absent', () => {
  it.each([
    ['empty', '', /is empty/],
    ['whitespace', '   \n', /is empty/],
    ['torn json', '{"v":1,"id":"run-x","op":"a","inp', /not parseable JSON/],
    ['valid json, wrong shape', '{"hello":"world"}', /unsupported run record version/],
    ['a JSON array', '[]', /run record must be an object/],
    ['a future schema version', '{"v":2,"id":"run-x","op":"a","input":{},"cursor":0,"findings":{},"verdict":null,"effects":[],"pending":null}', /unsupported run record version 2/],
  ])('%s → corrupt', (_label, text, pattern) => {
    const parsed = parseRunRecord(text);
    expect(parsed.ok).toBe(false);
    expect(parsed.corrupt).toBe(true);
    expect(parsed.reason).toMatch(pattern);
  });

  it('tryReadRun THROWS on a corrupt file rather than returning null (which would restart the run)', () => {
    writeFileSync(join(dir, 'run-torn.json'), '{"v":1,"id":"run-torn"');
    expect(() => tryReadRun('run-torn', dir)).toThrow(/refusing to read run run-torn[\s\S]*never treated as a run that does not exist/);
  });

  it('tryReadRun returns null ONLY when the file genuinely does not exist', () => {
    expect(tryReadRun('run-missing', dir)).toBeNull();
    expect(() => readRun('run-missing', dir)).toThrow(/no run record for "run-missing"/);
  });

  it('the in-memory store refuses a corrupt record just as the file store does', () => {
    const store = createMemoryRunStore();
    expect(() => store.write({ id: 'bad' })).toThrow(/is invalid/);
  });
});

describe('the fs shell', () => {
  it('writes atomically and leaves no temp file behind', () => {
    writeRun(sample(), dir);
    expect(readdirSync(dir)).toEqual(['run-sample.json']);
    expect(JSON.parse(readFileSync(join(dir, 'run-sample.json'), 'utf8'))).toEqual(sample());
  });

  it('round-trips through the file store handle', () => {
    const store = createFileRunStore(dir);
    store.write(sample());
    expect(store.read('run-sample')).toEqual(sample());
    expect(store.list()).toEqual(['run-sample']);
    store.delete('run-sample');
    expect(store.read('run-sample')).toBeNull();
    expect(() => store.delete('run-sample')).not.toThrow();
  });

  it('lists only well-formed run files, ignoring temp and stray names', () => {
    writeRun(sample(), dir);
    writeFileSync(join(dir, 'run-sample.json.123.tmp'), 'x');
    writeFileSync(join(dir, 'notes.txt'), 'x');
    expect(listRunIds(dir)).toEqual(['run-sample']);
    expect(listRunIds(join(dir, 'nope'))).toEqual([]);
  });

  it('resolves the sidecar by SCRIPT location, and OPERATION_RUNS_DIR overrides it', () => {
    const previous = process.env.OPERATION_RUNS_DIR;
    try {
      delete process.env.OPERATION_RUNS_DIR;
      expect(resolveRunsDir()).toBe(runsDir());
      expect(runsDir()).toMatch(/[/\\]\.operations[/\\]runs$/);
      process.env.OPERATION_RUNS_DIR = dir;
      expect(resolveRunsDir()).toBe(dir);
    } finally {
      if (previous === undefined) delete process.env.OPERATION_RUNS_DIR;
      else process.env.OPERATION_RUNS_DIR = previous;
    }
  });

  it('creates the runs directory on first write', () => {
    const nested = join(dir, 'deep', 'runs');
    writeRun(sample(), nested);
    expect(readdirSync(nested)).toEqual(['run-sample.json']);
  });

  it('mints distinct, filename-safe run ids', () => {
    const ids = new Set(Array.from({ length: 50 }, () => newRunId()));
    expect(ids.size).toBe(50);
    for (const id of ids) expect(isValidRunId(id)).toBe(true);
  });

  it('deleteRun on a directory that does not exist is a no-op', () => {
    mkdirSync(join(dir, 'empty'), { recursive: true });
    expect(() => deleteRun('run-nope', join(dir, 'empty'))).not.toThrow();
  });
});
