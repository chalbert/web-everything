/**
 * @file call-log.test.mjs — the call-visibility log and its store (#3451, fork 2 of #3427).
 *
 * THE LOAD-BEARING TESTS: a `compute`-only operation — the four shipped today are `gate-health`,
 * `suggest-next`, `verify`, `pr-status` — left ZERO trace of being called before this. `(b)`/`(c)` below
 * prove the gap is closed on both derived callers: a fixture compute-only declaration driven through
 * `cli-adapter.mjs#runOperationCli` and through `http-adapter.mjs`'s `GET …/run` route each produce exactly
 * one appended call-log line, using an in-memory store injected exactly like `store` (#run-record.mjs)
 * already is — mirroring `run-store.test.mjs`'s shape for the sibling store, and its `createMemoryRunStore`
 * pattern rather than touching real disk.
 */

import { mkdtempSync, appendFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  CALLER_KINDS,
  MAX_DIGEST_LENGTH,
  OUTCOME_STATUSES,
  assertCallLogLine,
  buildOutcome,
  digestFromOutcome,
  newCallLogLine,
  outcomeStatus,
  parseCallLogLine,
  serializeCallLogLine,
  truncateDigest,
  validateCallLogLine,
} from '../call-log.mjs';
import {
  appendCallLogLine,
  callsDir,
  callLogPath,
  createFileCallLogStore,
  createMemoryCallLogStore,
  dayKey,
  listCallLogDays,
  readCallLog,
  resolveCallsDir,
} from '../call-log-store.mjs';
import { runsDir } from '../run-store.mjs';

import { createRegistry, op } from '../registry.mjs';
import { compute } from '../step-kinds.mjs';
import { createMemoryRunStore } from '../run-store.mjs';
import { runOperationCli } from '../cli-adapter.mjs';
import { handleOperationRequest, runReadOnly } from '../http-adapter.mjs';

const sampleLine = () => newCallLogLine({
  operation: 'gate-health',
  timestamp: '2026-09-03T12:00:00.000Z',
  callerKind: 'cli',
  outcome: { status: 'ok', digest: 'stopped=complete' },
});

/** A `compute`-only declaration — the shape none of the four shipped read-only operations differ from for
 *  this test's purposes. */
function fixtureReadOnlyOp(name = 'fixture-compute') {
  return op(name, {
    input: {},
    verdictFrom: 'lookup',
    lookup: compute({ reads: [], fn: () => ({ ok: true }) }),
  });
}

describe('the pure core', () => {
  it('newCallLogLine round-trips a line with all four fields', () => {
    const line = sampleLine();
    expect(line).toEqual({
      operation: 'gate-health',
      timestamp: '2026-09-03T12:00:00.000Z',
      callerKind: 'cli',
      outcome: { status: 'ok', digest: 'stopped=complete' },
    });
    expect(Object.isFrozen(line)).toBe(true);
    expect(Object.isFrozen(line.outcome)).toBe(true);

    const parsed = parseCallLogLine(serializeCallLogLine(line));
    expect(parsed.ok).toBe(true);
    expect(parsed.line).toEqual(line);
  });

  it('validateCallLogLine reports every error, not just the first', () => {
    const { ok, errors } = validateCallLogLine({ operation: '', timestamp: 'soon', callerKind: 'carrier-pigeon', outcome: { status: 'maybe', digest: 5 } });
    expect(ok).toBe(false);
    expect(errors).toEqual(expect.arrayContaining([
      'missing `operation` name',
      expect.stringContaining('`timestamp` must be a parseable ISO 8601 string'),
      expect.stringContaining('`callerKind` must be one of cli|http'),
      expect.stringContaining('`outcome.status` must be one of ok|error'),
      '`outcome.digest` must be a string',
    ]));
  });

  it('assertCallLogLine throws carrying the errors', () => {
    expect(() => assertCallLogLine({}, 'thing')).toThrow(/operations: thing is invalid — /);
  });

  it('CALLER_KINDS and OUTCOME_STATUSES are the closed vocabularies the validator checks against', () => {
    expect(CALLER_KINDS).toEqual(['cli', 'http']);
    expect(OUTCOME_STATUSES).toEqual(['ok', 'error']);
  });

  describe('digestFromOutcome — bounded, and never empty', () => {
    it('names the stop when there is no error', () => {
      expect(digestFromOutcome({ stopped: 'complete' })).toBe('stopped=complete');
    });

    it('leads with the error over the stop when both are present', () => {
      expect(digestFromOutcome({ stopped: 'step-refused', error: new Error('boom') })).toBe('stopped=step-refused error=boom');
      expect(digestFromOutcome({ error: 'plain string boom' })).toBe('error=plain string boom');
    });

    // #3451 review — the `pending` branch (a suspended run, e.g. `awaiting-confirm`) had no direct
    // coverage: only reached when `stopped` names a success and no `error` rode the outcome.
    it('names the pending step for a suspended run with no error', () => {
      expect(digestFromOutcome({ stopped: 'confirm', pending: { step: 'record' } })).toBe('stopped=confirm pending=record');
      expect(digestFromOutcome({ pending: { step: 'record' } })).toBe('pending=record');
    });

    it('falls back to `ok` when nothing distinguishes the call', () => {
      expect(digestFromOutcome()).toBe('ok');
      expect(digestFromOutcome({})).toBe('ok');
    });

    it('never exceeds MAX_DIGEST_LENGTH, however large the source', () => {
      const digest = digestFromOutcome({ stopped: 'complete', verdict: { huge: 'x'.repeat(5000) } });
      expect(digest.length).toBeLessThanOrEqual(MAX_DIGEST_LENGTH);
      expect(digest.endsWith('…')).toBe(true);
    });

    it('truncateDigest marks a cut and leaves a short string untouched', () => {
      expect(truncateDigest('short')).toBe('short');
      const cut = truncateDigest('x'.repeat(300), 10);
      expect(cut).toHaveLength(10);
      expect(cut.endsWith('…')).toBe(true);
    });
  });

  describe('outcomeStatus / buildOutcome', () => {
    it('is `ok` for the stops this repo already exits/answers 2xx on', () => {
      for (const stopped of ['complete', 'confirm', 'effect-in-flight']) {
        expect(outcomeStatus({ stopped })).toBe('ok');
      }
    });

    it('is `error` whenever an error rode the outcome, regardless of `stopped`', () => {
      expect(outcomeStatus({ stopped: 'complete', error: new Error('should not happen but did') })).toBe('error');
    });

    it('is `error` for a stop this repo already exits/answers non-2xx on', () => {
      for (const stopped of ['stuck', 'step-refused', 'effect-halted', undefined, 'error']) {
        expect(outcomeStatus({ stopped })).toBe('error');
      }
    });

    it('buildOutcome wires status + digest together', () => {
      expect(buildOutcome({ stopped: 'complete' })).toEqual({ status: 'ok', digest: 'stopped=complete' });
      expect(buildOutcome({ error: new Error('nope') }).status).toBe('error');
    });
  });
});

describe('a corrupt line is skipped by the reader, never refused like a run record', () => {
  it.each([
    ['empty', ''],
    ['whitespace', '   '],
    ['torn json', '{"operation":"a"'],
    ['valid json, wrong shape', '{"hello":"world"}'],
  ])('%s → corrupt, not thrown', (_label, text) => {
    const parsed = parseCallLogLine(text);
    expect(parsed.ok).toBe(false);
    expect(parsed.corrupt).toBe(true);
    expect(typeof parsed.reason).toBe('string');
  });
});

describe('the fs shell', () => {
  let dir;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'we-op-calls-')); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('appends one line per call, day-rotated by the line\'s own timestamp', () => {
    appendCallLogLine(sampleLine(), dir);
    const { lines, corrupt } = readCallLog('2026-09-03', dir);
    expect(lines).toEqual([sampleLine()]);
    expect(corrupt).toBe(0);
  });

  it('refuses to append a malformed line rather than writing it', () => {
    expect(() => appendCallLogLine({ operation: '' }, dir)).toThrow(/is invalid/);
  });

  it('a corrupt row in the file is skipped and counted, not thrown', () => {
    appendCallLogLine(sampleLine(), dir);
    appendFileSync(callLogPath('2026-09-03', dir), 'not json at all\n');
    const { lines, corrupt } = readCallLog('2026-09-03', dir);
    expect(lines).toHaveLength(1);
    expect(corrupt).toBe(1);
  });

  it('resolves the sidecar by SCRIPT location, and OPERATION_CALLS_DIR overrides it — a directory distinct from .operations/runs', () => {
    const previous = process.env.OPERATION_CALLS_DIR;
    try {
      delete process.env.OPERATION_CALLS_DIR;
      expect(resolveCallsDir()).toBe(callsDir());
      expect(callsDir()).toMatch(/[/\\]\.operations[/\\]calls$/);
      expect(callsDir()).not.toBe(runsDir());
      process.env.OPERATION_CALLS_DIR = dir;
      expect(resolveCallsDir()).toBe(dir);
    } finally {
      if (previous === undefined) delete process.env.OPERATION_CALLS_DIR;
      else process.env.OPERATION_CALLS_DIR = previous;
    }
  });

  it('lists only well-formed day files', () => {
    appendCallLogLine(sampleLine(), dir);
    expect(listCallLogDays(dir)).toEqual(['2026-09-03']);
    expect(listCallLogDays(join(dir, 'nope'))).toEqual([]);
  });

  it('createFileCallLogStore round-trips through the file store handle', () => {
    const store = createFileCallLogStore(dir);
    const line = store.append({ operation: 'verify', callerKind: 'http', source: { stopped: 'complete' }, timestamp: '2026-09-03T00:00:00.000Z' });
    expect(line.operation).toBe('verify');
    expect(store.read('2026-09-03')).toEqual([line]);
    expect(store.days()).toEqual(['2026-09-03']);
  });
});

describe('createMemoryCallLogStore — the handle tests inject, mirroring createMemoryRunStore', () => {
  it('builds AND records a line in one call, refusing a malformed one', () => {
    const store = createMemoryCallLogStore();
    const line = store.append({ operation: 'gate-health', callerKind: 'cli', source: { stopped: 'complete' }, timestamp: '2026-09-03T00:00:00.000Z' });
    expect(line).toMatchObject({ operation: 'gate-health', callerKind: 'cli', outcome: { status: 'ok' } });
    expect(store.read('2026-09-03')).toEqual([line]);
    expect(store.days()).toEqual(['2026-09-03']);
    expect(() => store.append({ operation: '', callerKind: 'cli' })).toThrow();
  });
});

// ── (b)/(c) — the gap the item exists to close: a `compute`-only call through EACH derived caller ─────────────

describe('a compute-only call leaves a trace on every derived caller (#3451)', () => {
  it('(b) cli-adapter.mjs — one appended line, non-empty bounded digest', async () => {
    const declaration = fixtureReadOnlyOp();
    const registry = createRegistry();
    registry.register(declaration);
    const callLog = createMemoryCallLogStore();

    const result = await runOperationCli({
      declaration,
      argv: [],
      registry,
      store: createMemoryRunStore(),
      sinks: {},
      newRunId: () => 'run-fixture-cli-001',
      callLog,
    });
    expect(result.stopped).toBe('complete');

    const day = dayKey(new Date().toISOString());
    const lines = callLog.read(day);
    expect(lines).toHaveLength(1);
    expect(lines[0].operation).toBe(declaration.name);
    expect(lines[0].callerKind).toBe('cli');
    expect(lines[0].outcome.status).toBe('ok');
    expect(lines[0].outcome.digest.length).toBeGreaterThan(0);
    expect(lines[0].outcome.digest.length).toBeLessThanOrEqual(MAX_DIGEST_LENGTH);
  });

  it('cli-adapter.mjs omits `callLog` cleanly — no crash, no line, exactly today\'s behaviour for every caller that has not adopted it yet', async () => {
    const declaration = fixtureReadOnlyOp('fixture-compute-cli-no-log');
    const registry = createRegistry();
    registry.register(declaration);

    const result = await runOperationCli({
      declaration, argv: [], registry, store: createMemoryRunStore(), sinks: {}, newRunId: () => 'run-fixture-cli-002',
    });
    expect(result.stopped).toBe('complete');
  });

  it('(c) http-adapter.mjs\'s runReadOnly branch — the test that would have failed today, since that branch writes nothing itself', async () => {
    const declaration = fixtureReadOnlyOp('fixture-compute-http');
    const registry = createRegistry();
    registry.register(declaration);
    const callLog = createMemoryCallLogStore();

    const res = await handleOperationRequest(
      { method: 'GET', url: `/operations/${declaration.name}/run` },
      { resolve: () => ({ declaration, registry, sinks: {} }), names: () => [declaration.name], newRunId: () => 'run-fixture-http-001', callLog },
    );
    expect(res.status).toBe(200);
    expect(res.body.persisted).toBe(false); // structurally: no RUN RECORD — the call-log line is separate

    const day = dayKey(new Date().toISOString());
    const lines = callLog.read(day);
    expect(lines).toHaveLength(1);
    expect(lines[0].operation).toBe(declaration.name);
    expect(lines[0].callerKind).toBe('http');
    expect(lines[0].outcome.status).toBe('ok');
    expect(lines[0].outcome.digest.length).toBeGreaterThan(0);
  });

  it('http-adapter.mjs logs the stateful run-record path too (start + advance), on the same injected handle', async () => {
    const { reviewPrOperation, REVIEW_PR_OP } = await import('../review-pr.mjs');
    const readPr = () => ({
      detail: { pr: 1, repo: 'a/b', title: 't', url: 'https://example.invalid/1', labels: ['review:pending'], humanRequired: false, reviewClass: 'pending', disposition: { mode: 'converge', autoLand: false }, escalationReason: [], advisoryComment: null, humanComment: null, diffStat: [] },
      headRefName: 'lane/thing', state: 'OPEN', body: 'x',
      net: { paths: [], base: 'a'.repeat(40), revSha: 'b'.repeat(40), rev: 'origin/lane/thing', scored: true },
      diff: { text: '', scored: true },
    });
    const { judgeOutcome } = await import('../cli-adapter.mjs');
    const declaration = reviewPrOperation({ readPr });
    const registry = createRegistry();
    registry.register(declaration);
    const callLog = createMemoryCallLogStore();
    const judge = async () => judgeOutcome({ summary: 'nothing blocking', findings: [] }, { costUsd: 0.01, wallMs: 10 });

    const res = await handleOperationRequest(
      { method: 'POST', url: `/operations/${REVIEW_PR_OP}/runs`, body: { pr: 1, repo: 'a/b' } },
      {
        resolve: () => ({ declaration, registry, sinks: {} }),
        names: () => [REVIEW_PR_OP],
        store: createMemoryRunStore(),
        judge,
        newRunId: () => 'run-fixture-http-stateful-001',
        callLog,
      },
    );
    expect([200, 201]).toContain(res.status);
    expect(res.body.stopped).toBe('confirm'); // suspended awaiting the accept/changes/abstain decision

    const day = dayKey(new Date().toISOString());
    const lines = callLog.read(day);
    expect(lines).toHaveLength(1);
    expect(lines[0].operation).toBe(REVIEW_PR_OP);
    expect(lines[0].callerKind).toBe('http');
    // #3451 review — pin the CONTENT, not just the shape: a suspend is `ok` (a run doing exactly what it
    // was asked), and its digest names the pending step so an operator can tell WHERE it parked.
    expect(lines[0].outcome).toEqual({ status: 'ok', digest: 'stopped=confirm pending=confirm' });
  });

  it('runReadOnly itself logs nothing — the call-log line is the ADAPTER\'s doing, not the engine\'s', () => {
    const declaration = fixtureReadOnlyOp('fixture-compute-engine-only');
    const registry = createRegistry();
    registry.register(declaration);
    const run = runReadOnly(declaration, { input: {}, id: 'run-engine-only', registry });
    expect(run).toBeTruthy(); // calling the ENGINE helper directly bypasses the adapter that would log it
  });

  // #3451 review — a telemetry-only failure must never crash a call that otherwise settled cleanly. A
  // `callLog` whose `.append` throws is exactly the fault a bad verdict shape or a disk error would cause.
  it('a throwing callLog is best-effort — it never crashes an otherwise-successful call, on EITHER adapter', async () => {
    const throwingCallLog = { append: () => { throw new Error('disk is full'); } };

    const cliDeclaration = fixtureReadOnlyOp('fixture-compute-cli-besteffort');
    const cliRegistry = createRegistry();
    cliRegistry.register(cliDeclaration);
    const cliResult = await runOperationCli({
      declaration: cliDeclaration, argv: [], registry: cliRegistry, store: createMemoryRunStore(), sinks: {},
      newRunId: () => 'run-fixture-cli-besteffort', callLog: throwingCallLog,
    });
    expect(cliResult.stopped).toBe('complete');

    const httpDeclaration = fixtureReadOnlyOp('fixture-compute-http-besteffort');
    const httpRegistry = createRegistry();
    httpRegistry.register(httpDeclaration);
    const res = await handleOperationRequest(
      { method: 'GET', url: `/operations/${httpDeclaration.name}/run` },
      { resolve: () => ({ declaration: httpDeclaration, registry: httpRegistry, sinks: {} }), names: () => [httpDeclaration.name], newRunId: () => 'run-fixture-http-besteffort', callLog: throwingCallLog },
    );
    expect(res.status).toBe(200);
  });
});
