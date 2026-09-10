/**
 * @file judge-provider-selection.test.mjs — `--provider`/`providerName` WIRING (#xqa9ttq), proving
 * `resolveJudgeProvider`/`createDefaultJudge` actually reach the Codex provider and the schema transform, not
 * merely that both are importable beside `cli-adapter.mjs`.
 *
 * `codex-judge-spawn.mjs` is MOCKED AT THE MODULE BOUNDARY (the same sanctioned seam `we:scripts/lib/
 * __tests__/nnn-collision-heal.wiring.test.mjs` uses) because `resolveJudgeProvider`'s `'codex'` branch calls
 * the real `codexJudgeSpawn` directly — there is no injection point at that layer, by design: the injection
 * seam for a TEST is `createDefaultJudge({ provider })`, which every other judge test in this repo already
 * uses to substitute a port-shaped fake without touching a real CLI. This file is the one place that instead
 * proves the RESOLUTION itself — the string `'codex'` actually reaching `codexJudgeSpawn`, and the shape
 * actually being transformed before it gets there — is real code, not a docstring's claim about it.
 */

import { describe, it, expect, vi } from 'vitest';

// `importOriginal` keeps `requireAllProperties`/`stripNulls` REAL — `resolveJudgeProvider`'s 'codex' branch
// imports both from this same module (see `cli-adapter.mjs`'s own import comment on why: NOT from
// `jury-core.mjs`, a real import-graph regression that broke the ephemeral-clone CLI tests), and the whole
// point of the second test below is proving the transform ACTUALLY ran on the shape `codexJudgeSpawn` received.
const codexJudgeSpawnCalls = [];
vi.mock('../../lib/codex-judge-spawn.mjs', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    codexJudgeSpawn: async (request) => {
      codexJudgeSpawnCalls.push(request);
      return {
        value: { ok: true }, sessionId: 'codex-sess', costUsd: 0, durationMs: 1, wallMs: 1, numTurns: 1,
        stopReason: 'turn.completed', usage: {}, loadedContextTokens: 0, timedOut: false, argv: [],
      };
    },
  };
});

// `judgeSpawn` ITSELF WOULD SPAWN A REAL `claude` PROCESS if left un-mocked and reached by "defaults to claude"
// below — this repo's own judge tests always substitute it via `createDefaultJudge({ provider })`, and this is
// the one file that deliberately does NOT use that seam (see file header), so it has to stub the module
// instead. `importOriginal` keeps every other export (the classes, the constants) real; only `judgeSpawn` is
// replaced, and it is replaced with a RECORDING stub, never left calling through to the real one.
const claudeJudgeSpawnCalls = [];
vi.mock('../../lib/judge-spawn.mjs', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    judgeSpawn: async (request) => {
      claudeJudgeSpawnCalls.push(request);
      return {
        value: { fromClaude: true }, sessionId: 'claude-sess', costUsd: 0.01, durationMs: 1, wallMs: 1,
        numTurns: 1, stopReason: 'tool_use', usage: {}, loadedContextTokens: 0, timedOut: false, argv: [],
      };
    },
  };
});

const { createDefaultJudge, resolveJudgeProvider, JUDGE_PROVIDER_NAMES, unwrapJudgeOutcome } = await import('../cli-adapter.mjs');
const { judgeSpawn } = await import('../../lib/judge-spawn.mjs');

describe('JUDGE_PROVIDER_NAMES', () => {
  it('is exactly claude, codex — additive, claude first/default', () => {
    expect(JUDGE_PROVIDER_NAMES).toEqual(['claude', 'codex']);
  });
});

describe('resolveJudgeProvider', () => {
  it('resolves \'claude\' (and null/undefined) to the real judgeSpawn, unchanged', () => {
    expect(resolveJudgeProvider('claude')).toBe(judgeSpawn);
    expect(resolveJudgeProvider(null)).toBe(judgeSpawn);
    expect(resolveJudgeProvider(undefined)).toBe(judgeSpawn);
  });

  it('refuses an unrecognised name', () => {
    expect(() => resolveJudgeProvider('gemini')).toThrow(/unknown judge provider/);
  });

  it('\'codex\' resolves to a function that calls the real codexJudgeSpawn with a TRANSFORMED shape', async () => {
    const provider = resolveJudgeProvider('codex');
    expect(provider).not.toBe(judgeSpawn);
    codexJudgeSpawnCalls.length = 0;
    await provider({
      mandate: 'm', input: 'i',
      shape: { type: 'object', properties: { summary: { type: 'string' }, file: { type: 'string' } }, required: ['summary'] },
    });
    expect(codexJudgeSpawnCalls).toHaveLength(1);
    // THE TRANSFORM ACTUALLY RAN (#3371 probes 3/4) — every property is now required.
    expect(codexJudgeSpawnCalls[0].shape.required).toEqual(['summary', 'file']);
    expect(codexJudgeSpawnCalls[0].shape.properties.file.type).toEqual(['string', 'null']);
  });
});

describe('createDefaultJudge — providerName selection end to end (no injected provider stub)', () => {
  it('defaults to claude — reaches the (mocked) judgeSpawn, never codexJudgeSpawn', async () => {
    claudeJudgeSpawnCalls.length = 0;
    codexJudgeSpawnCalls.length = 0;
    const judgeFn = createDefaultJudge({});
    const returned = await judgeFn({ mandate: 'm', input: 'i', shape: { type: 'object' } });
    expect(claudeJudgeSpawnCalls).toHaveLength(1);
    expect(codexJudgeSpawnCalls).toHaveLength(0);
    expect(unwrapJudgeOutcome(returned).value).toEqual({ fromClaude: true });
  });

  it('providerName: \'codex\' reaches the mocked codexJudgeSpawn, with a transformed shape, and returns its answer', async () => {
    codexJudgeSpawnCalls.length = 0;
    const judgeFn = createDefaultJudge({ providerName: 'codex' });
    const returned = await judgeFn({
      mandate: 'm', input: 'i',
      shape: { type: 'object', properties: { a: { type: 'string' } } },
      runId: 'run-1', lens: 'correctness',
    });
    expect(codexJudgeSpawnCalls).toHaveLength(1);
    expect(codexJudgeSpawnCalls[0].shape.required).toEqual(['a']);
    const { value, telemetry } = unwrapJudgeOutcome(returned);
    expect(value).toEqual({ ok: true });
    expect(telemetry.sessionId).toBe('codex-sess');
    expect(telemetry.costUsd).toBe(0);
  });

  it('an explicit `provider` function OVERRIDES `providerName` — the existing test-injection seam is untouched', async () => {
    codexJudgeSpawnCalls.length = 0;
    const calls = [];
    const stub = async (req) => { calls.push(req); return { value: { stubbed: true } }; };
    const judgeFn = createDefaultJudge({ providerName: 'codex', provider: stub });
    await judgeFn({ mandate: 'm', input: 'i', shape: { type: 'object' } });
    expect(calls).toHaveLength(1);
    expect(codexJudgeSpawnCalls).toHaveLength(0); // the mocked codex provider was never reached
  });

  it('refuses providerName: \'codex\' combined with a TOOL-BEARING request — tool-free panelist only (#3581)', async () => {
    const judgeFn = createDefaultJudge({ providerName: 'codex' });
    await expect(judgeFn({
      mandate: 'm', input: 'i', shape: { type: 'object' }, allowedTools: ['Read'], cwd: '/tmp/x',
    })).rejects.toThrow(/TOOL-FREE panelist only/);
  });
});

// ── #xqa9ttq round 2 — THE PER-REQUEST `providerName` OVERRIDE (review-pr's opt-in `judgeAdvisory` seat) ──────
describe('createDefaultJudge — a REQUEST-level `providerName` overrides the factory\'s own', () => {
  it('a factory bound to claude (the default) still reaches codex when ONE request pins its own providerName', async () => {
    claudeJudgeSpawnCalls.length = 0;
    codexJudgeSpawnCalls.length = 0;
    // No `providerName` at the FACTORY at all — this is the shape review-pr's SAME judge factory instance is
    // in for its two existing (unmodified) seats: whatever `--provider`/env resolved, default `claude`.
    const judgeFn = createDefaultJudge({});
    const returned = await judgeFn({
      mandate: 'm', input: 'i', shape: { type: 'object' }, providerName: 'codex',
    });
    expect(codexJudgeSpawnCalls).toHaveLength(1);
    expect(claudeJudgeSpawnCalls).toHaveLength(0);
    expect(unwrapJudgeOutcome(returned).value).toEqual({ ok: true });
  });

  it('a SIBLING call through the SAME judge function, with no providerName, still reaches claude — one factory, two providers', async () => {
    claudeJudgeSpawnCalls.length = 0;
    codexJudgeSpawnCalls.length = 0;
    const judgeFn = createDefaultJudge({});
    await judgeFn({ mandate: 'm1', input: 'i1', shape: { type: 'object' }, providerName: 'codex' });
    await judgeFn({ mandate: 'm2', input: 'i2', shape: { type: 'object' } });
    expect(codexJudgeSpawnCalls).toHaveLength(1);
    expect(claudeJudgeSpawnCalls).toHaveLength(1);
  });

  it('refuses an unrecognised request-level providerName', async () => {
    const judgeFn = createDefaultJudge({});
    await expect(judgeFn({
      mandate: 'm', input: 'i', shape: { type: 'object' }, providerName: 'gemini',
    })).rejects.toThrow(/unknown judge provider/);
  });

  it('also refuses a request-level providerName: codex combined with allowedTools (not only the factory-level case)', async () => {
    const judgeFn = createDefaultJudge({}); // factory default stays `claude`
    await expect(judgeFn({
      mandate: 'm', input: 'i', shape: { type: 'object' }, providerName: 'codex', allowedTools: ['Read'], cwd: '/tmp/x',
    })).rejects.toThrow(/TOOL-FREE panelist only/);
  });

  it('an explicit factory-level `provider` stub WINS when the request carries no providerName of its own (unchanged)', async () => {
    const calls = [];
    const stub = async (req) => { calls.push(req); return { value: { stubbed: true } }; };
    const judgeFn = createDefaultJudge({ provider: stub, providerName: 'codex' });
    codexJudgeSpawnCalls.length = 0;
    await judgeFn({ mandate: 'm', input: 'i', shape: { type: 'object' } });
    expect(calls).toHaveLength(1);
    expect(codexJudgeSpawnCalls).toHaveLength(0);
  });

  it('a REQUEST-level providerName resolves via the real resolver even when an unrelated `provider` stub is bound at the factory', async () => {
    // The stub at the factory level was injected for a DIFFERENT seat's test; a request that pins its own
    // provider must not be silently intercepted by it.
    codexJudgeSpawnCalls.length = 0;
    const calls = [];
    const stub = async (req) => { calls.push(req); return { value: { stubbed: true } }; };
    const judgeFn = createDefaultJudge({ provider: stub }); // stub wins when request has no providerName
    await judgeFn({ mandate: 'm', input: 'i', shape: { type: 'object' }, providerName: 'codex' });
    expect(calls).toHaveLength(0);
    expect(codexJudgeSpawnCalls).toHaveLength(1);
  });

  it('an injectable `resolveProvider` lets a test substitute BOTH providers without the module-mock seam', async () => {
    const seen = [];
    const resolveProvider = (name) => async (req) => { seen.push({ name, req }); return { value: { via: name } }; };
    const judgeFn = createDefaultJudge({ resolveProvider });
    const a = await judgeFn({ mandate: 'm', input: 'i', shape: { type: 'object' } }); // factory default: claude
    const b = await judgeFn({ mandate: 'm', input: 'i', shape: { type: 'object' }, providerName: 'codex' });
    expect(unwrapJudgeOutcome(a).value).toEqual({ via: 'claude' });
    expect(unwrapJudgeOutcome(b).value).toEqual({ via: 'codex' });
    expect(seen.map((s) => s.name)).toEqual(['claude', 'codex']);
  });

  it('the operator\'s `--model` override never reaches a request whose EFFECTIVE provider is codex', async () => {
    codexJudgeSpawnCalls.length = 0;
    // The factory carries an operator `--model` override (as `run.mjs`'s CLI wiring would, for the seat(s)
    // the operator is actually steering) — a request pinned to codex must never receive it.
    const judgeFn = createDefaultJudge({ model: 'opus' });
    await judgeFn({ mandate: 'm', input: 'i', shape: { type: 'object' }, providerName: 'codex' });
    expect(codexJudgeSpawnCalls).toHaveLength(1);
    expect(codexJudgeSpawnCalls[0].model).toBeUndefined();
  });

  it('…while an ordinary claude-provider request still gets the operator\'s `--model` override, unchanged', async () => {
    claudeJudgeSpawnCalls.length = 0;
    const judgeFn = createDefaultJudge({ model: 'opus' });
    await judgeFn({ mandate: 'm', input: 'i', shape: { type: 'object' } });
    expect(claudeJudgeSpawnCalls).toHaveLength(1);
    expect(claudeJudgeSpawnCalls[0].model).toBe('opus');
  });
});
