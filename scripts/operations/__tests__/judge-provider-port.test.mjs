/**
 * @file judge-provider-port.test.mjs — `createDefaultJudge` drives ANY `JudgeProvider`, not only `judgeSpawn`
 * (#3370, under #3369).
 *
 * THE FAKE HERE IS PORT-SHAPED, NOT CLI-SHAPED. Every existing judge fake in this repo (the `spawn` stub in
 * `juror-flags.test.mjs`, `fakeSpawn` in `we:scripts/lib/__tests__/judge-spawn.test.mjs`, `withFakeClaude`)
 * either stands in for `child_process.spawn` or for the `claude` binary itself — each still speaks in terms
 * of argv, stdout, or a mocked child process. This fake is neither: it is a hand-written plain async function
 * that receives the engine's `judge` request directly and returns the outcome shape `parseJudgeOutcome`
 * produces, with nothing CLI-shaped anywhere in it. That is the actual claim under test — that
 * `createDefaultJudge`'s `provider` option is a NAMED PORT a second implementation can satisfy (#3371),
 * not a slot that happens to accept whatever `judgeSpawn` looks like today.
 */

import { describe, it, expect } from 'vitest';

import { createDefaultJudge, unwrapJudgeOutcome } from '../cli-adapter.mjs';

/** A hand-written `JudgeProvider` — no argv, no stdout, no child process. Records what it was handed. */
function makeFakeProvider(answer) {
  const calls = [];
  const provider = async (request) => {
    calls.push(request);
    return {
      value: answer,
      sessionId: 'fake-provider-session',
      costUsd: 0.02,
      durationMs: 500,
      wallMs: 550,
      numTurns: 1,
      stopReason: 'end_turn',
      usage: { input_tokens: 10, output_tokens: 5 },
      loadedContextTokens: 10,
      timedOut: false,
    };
  };
  return { provider, calls };
}

describe('#3370 createDefaultJudge drives a hand-written JudgeProvider', () => {
  it('accepts a port-shaped fake and returns its answer, unmodified', async () => {
    const { provider, calls } = makeFakeProvider({ verdict: 'pass', reason: 'looks fine' });
    const judgeFn = createDefaultJudge({ provider });

    const returned = await judgeFn({
      mandate: 'judge the diff',
      input: 'the diff text',
      shape: { type: 'object' },
      model: 'sonnet',
      effort: 'medium',
      budget: 1,
      runId: 'run-3370',
      lens: 'correctness',
    });

    expect(calls).toHaveLength(1);
    // THE SAME REQUEST FIELDS THE REAL SPAWNER RECEIVES — this is what "driven the same way" means: the fake
    // is handed exactly the request shape `judgeSpawn` is handed, not a CLI-adapted approximation of it.
    expect(calls[0]).toMatchObject({
      mandate: 'judge the diff',
      input: 'the diff text',
      shape: { type: 'object' },
      model: 'sonnet',
      effort: 'medium',
      budget: 1,
      runId: 'run-3370',
      lens: 'correctness',
    });

    const { value, telemetry } = unwrapJudgeOutcome(returned);
    expect(value).toEqual({ verdict: 'pass', reason: 'looks fine' });
    expect(telemetry).toMatchObject({
      costUsd: 0.02,
      durationMs: 500,
      wallMs: 550,
      numTurns: 1,
      stopReason: 'end_turn',
      sessionId: 'fake-provider-session',
      loadedContextTokens: 10,
      timedOut: false,
      model: 'sonnet',
    });
  });

  it('omits `cwd` from the request to a port-shaped fake for a tool-free juror, matching the spawner path', async () => {
    const { provider, calls } = makeFakeProvider({ ok: true });
    const judgeFn = createDefaultJudge({ provider });

    await judgeFn({ mandate: 'm', input: 'i', shape: { type: 'object' } });

    expect(calls[0]).not.toHaveProperty('cwd');
  });

  it('passes `cwd` through to a port-shaped fake when the factory was given one, for a tool-bearing juror', async () => {
    const { provider, calls } = makeFakeProvider({ ok: true });
    const judgeFn = createDefaultJudge({ provider, cwd: '/tmp/some-lane' });

    await judgeFn({ mandate: 'm', input: 'i', shape: { type: 'object' }, allowedTools: ['Read'] });

    expect(calls[0].cwd).toBe('/tmp/some-lane');
    expect(calls[0].allowedTools).toEqual(['Read']);
  });
});
