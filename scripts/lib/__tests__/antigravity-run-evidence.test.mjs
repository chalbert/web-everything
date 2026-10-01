import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { agyRunEvidence, readAgyHold, saveAgyHold } from '../antigravity-run-evidence.mjs';
import { normalizeJudgeTelemetry } from '../../operations/run-record.mjs';
import { classifySeatCall } from '../../operations/review-extra-seats.mjs';
const stream = (model, result) => [JSON.stringify({ event: 'init', init: { model } }), JSON.stringify({ event: 'result', result })].join('\n');
describe('agy observed model and quota evidence', () => {
  it('records reported Gemini separately from requested Claude through persisted telemetry', () => {
    const evidence = agyRunEvidence({ requestedModel: 'claude-sonnet-4-6', stdout: stream('gemini-3.1-pro', { status: 'SUCCESS' }) });
    expect(normalizeJudgeTelemetry({ telemetry: evidence })).toMatchObject({ requestedModel: 'claude-sonnet-4-6', servedModel: 'gemini-3.1-pro', servedBackend: 'google', modelEvidence: 'agy-init', fallbackDecision: 'skip-backend-mismatch' });
  });
  it('does not invent a served model from a request or quota from answer text', () => {
    expect(agyRunEvidence({ requestedModel: 'sonnet', stdout: 'null\nnoise\n' + stream(null, { response: 'RESOURCE_EXHAUSTED' }) })).toMatchObject({ servedModel: 'unknown', quotaState: 'unknown' });
  });
  it('holds Claude until the observed reset, across wrappers, without holding Gemini', () => {
    const dir = mkdtempSync(join(tmpdir(), 'agy-hold-test-'));
    try {
      const row = agyRunEvidence({ requestedModel: 'claude-sonnet-4-6', now: 0, stdout: stream('claude-sonnet-4-6', { status: 'ERROR', error: 'Individual quota reached. Resets in 90h29m27s.' }) });
      saveAgyHold(row, { dir });
      expect(readAgyHold('claude-opus-4-6', { dir, now: 1000 })).toMatchObject({ servedModel: 'unknown', fallbackDecision: 'skip-quota-hold' });
      const shorter = { ...row, quotaResetsAt: new Date(2000).toISOString() };
      saveAgyHold(shorter, { dir });
      expect(readAgyHold('sonnet', { dir, now: 3000 })?.quotaResetsAt).toBe(row.quotaResetsAt);
      expect(readAgyHold('gemini-3.1-pro', { dir, now: 1000 })).toBeNull();
      expect(readAgyHold('sonnet', { dir, now: Date.parse(row.quotaResetsAt) })).toBeNull();
      expect(classifySeatCall('agy-claude', { report: { ...row, events: { finalResponse: '{"findings":[]}' } } }).status).toBe('quota-exhausted');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { runAgyDirectExec } from '../../gemini-direct-task.mjs';
import { antigravityJudgeSpawn } from '../antigravity-judge-spawn.mjs';
function spawnStream(stdout, stderr = '') {
  return () => {
    const child = new EventEmitter();
    child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.stdin = new PassThrough();
    child.kill = () => {};
    queueMicrotask(() => { child.stdout.end(stdout); child.stderr.end(stderr); child.emit('close', 0); });
    return child;
  };
}
it('worker records a partial-answer quota failure and the next judge skips without spawning', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'agy-wrapper-test-'));
  try {
    const readHold = (model) => readAgyHold(model, { dir });
    const saveHold = (row) => saveAgyHold(row, { dir });
    const run = await runAgyDirectExec({ dir, task: 'test', model: 'claude-sonnet-4-6', logFile: join(dir, 'run.jsonl'), stream: false,
      readHold, saveHold, spawnFn: spawnStream(stream('claude-sonnet-4-6', { status: 'SUCCESS', response: '{"findings":[]}' }), 'Individual quota reached. Resets in 90h29m27s.') });
    expect(run).toMatchObject({ code: 1, servedModel: 'claude-sonnet-4-6', quotaState: 'exhausted', fallbackDecision: 'skip-quota-exhausted' });
    const rows = [];
    await expect(antigravityJudgeSpawn({ mandate: 'judge', input: 'diff', shape: {}, model: 'claude-sonnet-4-6', readHold, saveHold,
      recordScorecard: (row) => rows.push(row), spawnFn: () => { throw new Error('must not spawn'); } })).rejects.toThrow('skip-quota-hold');
    expect(rows[0]).toMatchObject({ servedModel: 'unknown', modelEvidence: 'not-launched', quotaState: 'exhausted' });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
it('judge refuses a reported substitute and preserves evidence in its scorecard and error', async () => {
  const rows = [];
  await expect(antigravityJudgeSpawn({ mandate: 'judge', input: 'diff', shape: {}, model: 'claude-sonnet-4-6', readHold: () => null, saveHold: () => {},
    persistTranscript: () => null, recordScorecard: (row) => rows.push(row),
    spawnFn: spawnStream(stream('gemini-3.1-pro', { status: 'SUCCESS', structured_output: { findings: [] } })) })).rejects.toMatchObject({ telemetry: { servedBackend: 'google', fallbackDecision: 'skip-backend-mismatch' } });
  expect(rows[0]).toMatchObject({ model: 'gemini-3.1-pro', requestedModel: 'claude-sonnet-4-6' });
});

import { buildSeatRows } from '../../operations/review-extra-seats.mjs';
import { launchScorecardRow } from '../probation-launcher.mjs';
import { createDefaultJudge, unwrapJudgeOutcome } from '../../operations/cli-adapter.mjs';
it('retains provenance through the judge adapter, extra seats and probation rows', async () => {
  const evidence = agyRunEvidence({ requestedModel: 'gemini-3.1-pro-high', stdout: stream('gemini-3.1-pro', { status: 'SUCCESS' }) });
  const judge = createDefaultJudge({ providerName: 'antigravity', provider: async () => ({ value: { findings: [] }, ...evidence }) });
  const { telemetry } = unwrapJudgeOutcome(await judge({ mandate: 'judge', input: 'diff', shape: {}, model: 'gemini-3.1-pro-high' }));
  expect(normalizeJudgeTelemetry({ telemetry })).toMatchObject({ model: 'gemini-3.1-pro', requestedModel: 'gemini-3.1-pro-high', modelEvidence: 'agy-init' });
  expect(buildSeatRows({ evidence, model: 'gemini-3.1-pro-high', seats: [{ key: 'review' }], call: { status: 'ok' }, parsed: { review: { ok: true, findings: [], verdict: 'accept' } } })[0]).toMatchObject({ model: 'gemini-3.1-pro', requestedModel: 'gemini-3.1-pro-high' });
  expect(launchScorecardRow({ worker: { provider: 'antigravity', model: 'gemini-3.1-pro-high' }, modelEvidence: evidence })).toMatchObject({ model: 'gemini-3.1-pro', requestedModel: 'gemini-3.1-pro-high' });
});
it('rejects a changed model within the same backend, while accepting effort suffix resolution', () => {
  expect(agyRunEvidence({ requestedModel: 'claude-sonnet-4-6', stdout: stream('claude-opus-4-6', {}) }).fallbackDecision).toBe('skip-model-mismatch');
  expect(agyRunEvidence({ requestedModel: 'gemini-3.1-pro-high', stdout: stream('gemini-3.1-pro', {}) }).fallbackDecision).toBe('none');
});
