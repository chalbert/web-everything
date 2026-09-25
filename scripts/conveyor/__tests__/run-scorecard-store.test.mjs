import { describe, it, expect, afterEach } from 'vitest';
import { join } from 'node:path';
import {
  validateScorecard, readStore, writeStore, appendScorecard, meanScore,
  resolveScorecardStorePath, DEFAULT_SCORECARD_STORE_PATH,
} from '../run-scorecard-store.mjs';

const baseRow = () => ({
  rubricVersion: '2026-09-13.1',
  provider: 'codex',
  model: 'gpt-6-astra',
  effort: 'medium',
  item: '3388',
  handle: 'build-3388-a1',
  subjectClass: 'work-agent',
  dispatchKind: 'fix',
  criteriaEvaluated: 5,
  deductions: [],
  score: 100,
});

function memIo(initial = { version: 1, records: [] }) {
  let store = initial;
  return {
    read: () => JSON.stringify(store),
    write: (_p, s) => { store = JSON.parse(s); },
    exists: () => true,
  };
}

describe('validateScorecard', () => {
  it('accepts a well-formed row', () => {
    expect(validateScorecard(baseRow()).ok).toBe(true);
  });
  it('requires provider AND model — never a bare model string', () => {
    const { provider, ...rest } = baseRow();
    expect(validateScorecard(rest).ok).toBe(false);
  });
  it('requires rubricVersion', () => {
    const row = baseRow(); delete row.rubricVersion;
    expect(validateScorecard(row).ok).toBe(false);
  });
  it('refuses score:100 when criteriaEvaluated is 0 — never 100 on an empty read', () => {
    expect(validateScorecard({ ...baseRow(), criteriaEvaluated: 0, score: 100 }).ok).toBe(false);
    expect(validateScorecard({ ...baseRow(), criteriaEvaluated: 0, score: null }).ok).toBe(true);
  });
  it('refuses an out-of-range score', () => {
    expect(validateScorecard({ ...baseRow(), score: 150 }).ok).toBe(false);
    expect(validateScorecard({ ...baseRow(), score: -1 }).ok).toBe(false);
  });
  it('requires subjectClass to be exactly work-agent or driver', () => {
    expect(validateScorecard({ ...baseRow(), subjectClass: 'something-else' }).ok).toBe(false);
  });
  it('refuses a deduction whose evidence still fails the scrub — defence in depth', () => {
    const row = { ...baseRow(), deductions: [{ criterion: 'x', weight: 1, count: 1, evidence: '/Users/x/workspace/webeverything/secret.env' }] };
    expect(validateScorecard(row).ok).toBe(false);
  });
});

describe('readStore/writeStore — IO shell', () => {
  it('readStore degrades to empty on a missing file', () => {
    expect(readStore({ exists: () => false }).records).toEqual([]);
  });
  it('readStore degrades to empty on malformed JSON, never throws', () => {
    expect(() => readStore({ exists: () => true, read: () => 'not json' })).not.toThrow();
    expect(readStore({ exists: () => true, read: () => 'not json' }).records).toEqual([]);
  });
  it('round-trips through the injected write/read pair', () => {
    const io = memIo();
    writeStore({ version: 1, records: [baseRow()] }, io);
    expect(readStore(io).records).toHaveLength(1);
  });
});

describe('appendScorecard', () => {
  it('appends a valid row and stamps v/outcome/scoredAt', () => {
    const io = memIo();
    const stored = appendScorecard(baseRow(), io);
    expect(stored.v).toBe(1);
    expect(stored.outcome).toBeNull();
    expect(typeof stored.scoredAt).toBe('string');
    expect(readStore(io).records).toHaveLength(1);
  });
  it('refuses (throws) an invalid row — never silently coerces or drops', () => {
    const io = memIo();
    expect(() => appendScorecard({ ...baseRow(), provider: '' }, io)).toThrow(/refusing/);
    expect(readStore(io).records).toHaveLength(0);
  });
  it('accumulates multiple rows across calls', () => {
    const io = memIo();
    appendScorecard(baseRow(), io);
    appendScorecard({ ...baseRow(), item: '3389' }, io);
    expect(readStore(io).records).toHaveLength(2);
  });
});

describe('meanScore — the required-rubricVersion/provider/model aggregate, never a per-run headline', () => {
  it('requires rubricVersion, provider, and model', () => {
    expect(() => meanScore({ provider: 'codex', model: 'gpt-6-astra' })).toThrow(/rubricVersion/);
    expect(() => meanScore({ rubricVersion: 'v1', model: 'gpt-6-astra' })).toThrow(/provider/);
    expect(() => meanScore({ rubricVersion: 'v1', provider: 'codex' })).toThrow(/model/);
  });

  it('averages only matching rows, defaulting subjectClass to work-agent', () => {
    const io = memIo();
    appendScorecard({ ...baseRow(), score: 90 }, io);
    appendScorecard({ ...baseRow(), score: 70 }, io);
    appendScorecard({ ...baseRow(), score: 10, subjectClass: 'driver' }, io); // excluded by default
    const { mean, n } = meanScore({ rubricVersion: '2026-09-13.1', provider: 'codex', model: 'gpt-6-astra' }, io);
    expect(n).toBe(2);
    expect(mean).toBe(80);
  });

  it('NEVER blends two different models — a future model upgrade starts its own average', () => {
    const io = memIo();
    appendScorecard({ ...baseRow(), score: 90 }, io);
    appendScorecard({ ...baseRow(), score: 0, model: 'gpt-7-hypothetical' }, io);
    const { mean, n } = meanScore({ rubricVersion: '2026-09-13.1', provider: 'codex', model: 'gpt-6-astra' }, io);
    expect(n).toBe(1);
    expect(mean).toBe(90);
  });

  it('never blends across rubricVersion', () => {
    const io = memIo();
    appendScorecard({ ...baseRow(), score: 90 }, io);
    appendScorecard({ ...baseRow(), score: 0, rubricVersion: '2099-01-01.1' }, io);
    const { n } = meanScore({ rubricVersion: '2026-09-13.1', provider: 'codex', model: 'gpt-6-astra' }, io);
    expect(n).toBe(1);
  });

  it('excludes null-score rows from the average rather than treating them as 0', () => {
    const io = memIo();
    appendScorecard({ ...baseRow(), score: 90 }, io);
    appendScorecard({ ...baseRow(), score: null, criteriaEvaluated: 0 }, io);
    const { mean, n } = meanScore({ rubricVersion: '2026-09-13.1', provider: 'codex', model: 'gpt-6-astra' }, io);
    expect(n).toBe(1);
    expect(mean).toBe(90);
  });

  it('returns null/0 when nothing matches, rather than throwing or returning NaN', () => {
    const io = memIo();
    const { mean, n } = meanScore({ rubricVersion: 'nope', provider: 'codex', model: 'gpt-6-astra' }, io);
    expect(mean).toBeNull();
    expect(n).toBe(0);
  });
});

describe('resolveScorecardStorePath — CONVEYOR_STATE_ROOT (#4052)', () => {
  const savedEnv = { ...process.env };
  afterEach(() => {
    if (savedEnv.CONVEYOR_STATE_ROOT === undefined) delete process.env.CONVEYOR_STATE_ROOT;
    else process.env.CONVEYOR_STATE_ROOT = savedEnv.CONVEYOR_STATE_ROOT;
  });

  it('defaults to the script-colocated, git-tracked location — TODAY\'s location, unchanged', () => {
    expect(resolveScorecardStorePath({})).toBe(DEFAULT_SCORECARD_STORE_PATH);
  });

  it('moves under the pinned root, OUT of this repo\'s git tree, once CONVEYOR_STATE_ROOT is set', () => {
    const path = resolveScorecardStorePath({ CONVEYOR_STATE_ROOT: '/tmp/operator-primary' });
    expect(path).toBe(join('/tmp/operator-primary', '.conveyor', 'run-scorecards.json'));
    expect(path).not.toBe(DEFAULT_SCORECARD_STORE_PATH);
  });

  it('readStore/writeStore honor the live pin (not a frozen import-time default)', () => {
    process.env.CONVEYOR_STATE_ROOT = '/tmp/never-actually-touched-because-io-is-injected';
    const writes = [];
    writeStore({ version: 1, records: [] }, { write: (p) => writes.push(p) });
    expect(writes[0]).toBe(join('/tmp/never-actually-touched-because-io-is-injected', '.conveyor', 'run-scorecards.json'));
  });
});
