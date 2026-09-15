/**
 * @file codex-judge-spawn.test.mjs — the Codex `JudgeProvider`'s argv/parsing/error-mapping contract, proved
 * WITHOUT spawning anything (#xqa9ttq, mirroring `judge-spawn.test.mjs`'s own split for `judgeSpawn`).
 *
 * Every shape asserted here traces to a specific `#3371` probe — this file's own `describe` titles name which
 * one, so a reader does not have to cross-reference the probe record to see what a given test is pinning.
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import {
  CODEX_CLI,
  CODEX_EFFORT_MAP,
  CodexInvalidSchemaError,
  assertNoCodexTools,
  buildCodexJudgeArgv,
  buildCodexPrompt,
  parseCodexJudgeOutcome,
  codexLoadedContextTokens,
  codexJudgeSpawn,
  requireAllProperties,
  stripNulls,
} from '../codex-judge-spawn.mjs';
import { JudgeTimeoutError } from '../judge-spawn.mjs';

const SHAPE = {
  type: 'object',
  properties: { verdict: { type: 'string', enum: ['accept', 'reject'] }, finding: { type: 'string' } },
  required: ['verdict', 'finding'],
  additionalProperties: false,
};

describe('CODEX_CLI', () => {
  it('is the codex binary — named once, exactly like judge-spawn.mjs#JUDGE_CLI', () => {
    expect(CODEX_CLI).toBe('codex');
  });
});

describe('buildCodexJudgeArgv — the argv translation, per #3371\'s table', () => {
  const base = { schemaFile: '/tmp/schema.json', outputLastMessageFile: '/tmp/last.txt', cwd: '/tmp/scratch' };

  it('translates exec --json --output-schema <file>, never the Claude flags', () => {
    const argv = buildCodexJudgeArgv(base);
    expect(argv).toEqual([
      'exec', '--json',
      '--output-schema', '/tmp/schema.json',
      '--output-last-message', '/tmp/last.txt',
      '-s', 'read-only',
      '--skip-git-repo-check',
      '--ephemeral',
      '-C', '/tmp/scratch',
    ]);
    expect(argv.join(' ')).not.toContain('--json-schema');
    expect(argv.join(' ')).not.toContain('--append-system-prompt');
    expect(argv.join(' ')).not.toContain('--tools');
  });

  it('has NO POSITIONAL PROMPT — probe 0\'s deadlock trap is avoided by never supplying one', () => {
    // The whole argv is a fixed, EVEN number of (flag, value) pairs plus the leading `exec`/`--json` pair —
    // every element is accounted for as a flag or a flag's OWN value. A stray positional prompt would be an
    // odd element out with no flag before it; there is none.
    const argv = buildCodexJudgeArgv(base);
    const FLAGS = new Set(['--json', '--output-schema', '--output-last-message', '-s', '--skip-git-repo-check', '--ephemeral', '-C', '-m', '-c']);
    expect(argv[0]).toBe('exec');
    for (let i = 1; i < argv.length; i += 1) {
      if (FLAGS.has(argv[i])) continue;
      // Not a flag itself: it must be the value immediately following one of the value-taking flags above.
      expect(FLAGS.has(argv[i - 1])).toBe(true);
    }
  });

  it('adds -m <model> only when a model is given', () => {
    expect(buildCodexJudgeArgv(base)).not.toContain('-m');
    expect(buildCodexJudgeArgv({ ...base, model: 'gpt-5-codex' })).toEqual(expect.arrayContaining(['-m', 'gpt-5-codex']));
  });

  it('refuses a model shaped like a flag', () => {
    expect(() => buildCodexJudgeArgv({ ...base, model: '-x' })).toThrow(/plain non-empty string/);
  });

  it('maps effort through CODEX_EFFORT_MAP, via -c model_reasoning_effort=…', () => {
    for (const [from, to] of Object.entries(CODEX_EFFORT_MAP)) {
      const argv = buildCodexJudgeArgv({ ...base, effort: from });
      expect(argv).toEqual(expect.arrayContaining(['-c', `model_reasoning_effort=${to}`]));
    }
  });

  it('clamps xhigh/max DOWN to high — Codex has no level above it', () => {
    expect(CODEX_EFFORT_MAP.xhigh).toBe('high');
    expect(CODEX_EFFORT_MAP.max).toBe('high');
  });

  it('refuses an unrecognised effort rather than passing it through silently', () => {
    expect(() => buildCodexJudgeArgv({ ...base, effort: 'ludicrous' })).toThrow(/must be one of/);
  });

  it('refuses missing schemaFile/outputLastMessageFile/cwd', () => {
    expect(() => buildCodexJudgeArgv({ ...base, schemaFile: '' })).toThrow(/schemaFile/);
    expect(() => buildCodexJudgeArgv({ ...base, outputLastMessageFile: '' })).toThrow(/outputLastMessageFile/);
    expect(() => buildCodexJudgeArgv({ ...base, cwd: '' })).toThrow(/cwd.*scratch/);
  });
});

describe('buildCodexPrompt — folding the mandate into prompt text (no --append-system-prompt equivalent)', () => {
  it('labels the two parts so a captured transcript can tell them apart', () => {
    const prompt = buildCodexPrompt('BE TERSE', 'THE-DIFF');
    expect(prompt).toContain('BE TERSE');
    expect(prompt).toContain('THE-DIFF');
    expect(prompt.indexOf('BE TERSE')).toBeLessThan(prompt.indexOf('THE-DIFF'));
  });
});

describe('assertNoCodexTools — TOOL-FREE ONLY (probe 9, #3581 sequencing)', () => {
  it('passes for null/undefined/empty', () => {
    expect(() => assertNoCodexTools(null)).not.toThrow();
    expect(() => assertNoCodexTools(undefined)).not.toThrow();
    expect(() => assertNoCodexTools([])).not.toThrow();
  });

  it('refuses any non-empty tool list', () => {
    expect(() => assertNoCodexTools(['Read'])).toThrow(/TOOL-FREE panelist only/);
  });
});

describe('parseCodexJudgeOutcome — JSONL, answer is the LAST message, terminal status is the LAST event', () => {
  it('probe 1 shape: a clean turn.completed, answer from --output-last-message', () => {
    const stdout = [
      JSON.stringify({ type: 'thread.started', thread_id: '01a0-thread' }),
      JSON.stringify({ type: 'turn.started' }),
      JSON.stringify({ type: 'item.completed', item: { id: 'item_0', type: 'agent_message', text: '{"verdict":"reject","finding":"x"}' } }),
      JSON.stringify({ type: 'turn.completed', usage: { input_tokens: 100, output_tokens: 10 } }),
    ].join('\n');
    const out = parseCodexJudgeOutcome({ stdout, lastMessage: '{"verdict":"reject","finding":"x"}' });
    expect(out.value).toEqual({ verdict: 'reject', finding: 'x' });
    expect(out.sessionId).toBe('01a0-thread');
    expect(out.costUsd).toBe(0);
    expect(out.stopReason).toBe('turn.completed');
    expect(out.numTurns).toBe(1);
    expect(out.usage).toEqual({ input_tokens: 100, output_tokens: 10 });
  });

  it('probe 4 shape: strips nulls from the answer before returning it', () => {
    const answer = '{"summary":"s","findings":[{"summary":"f","file":null,"line":null,"parallelizable":null}]}';
    const stdout = [
      JSON.stringify({ type: 'thread.started', thread_id: 't' }),
      JSON.stringify({ type: 'turn.completed', usage: {} }),
    ].join('\n');
    const out = parseCodexJudgeOutcome({ stdout, lastMessage: answer });
    expect(out.value).toEqual({ summary: 's', findings: [{ summary: 'f' }] });
  });

  it('probe 7: falls back to the LAST agent_message item when --output-last-message is absent', () => {
    const stdout = [
      JSON.stringify({ type: 'thread.started', thread_id: 't' }),
      JSON.stringify({ type: 'turn.started' }),
      JSON.stringify({ item: { id: 'item_0', type: 'agent_message', text: 'free prose, not the answer' }, type: 'item.completed' }),
      JSON.stringify({ item: { id: 'item_1', type: 'agent_message', text: '{"verdict":"accept","finding":"ok"}' }, type: 'item.completed' }),
      JSON.stringify({ type: 'turn.completed', usage: {} }),
    ].join('\n');
    const out = parseCodexJudgeOutcome({ stdout, lastMessage: null });
    expect(out.value).toEqual({ verdict: 'accept', finding: 'ok' });
  });

  it('probe 5: the TERMINAL event is the LAST one, never the first `error` line in a retry storm', () => {
    const stdout = [
      JSON.stringify({ type: 'thread.started', thread_id: 't' }),
      JSON.stringify({ type: 'turn.started' }),
      JSON.stringify({ type: 'error', message: 'Reconnecting... 2/5 (unexpected status 401 …)' }),
      JSON.stringify({ type: 'error', message: 'Reconnecting... 1/5 (unexpected status 401 …)' }),
      JSON.stringify({ type: 'turn.failed', error: { message: 'unexpected status 401 Unauthorized: Missing bearer …' } }),
    ].join('\n');
    expect(() => parseCodexJudgeOutcome({ stdout, lastMessage: null }))
      .toThrow(/401 Unauthorized/);
    // and NOT the (wrong) first error line's text alone, if a caller matched line 1 instead of the terminal one:
    try {
      parseCodexJudgeOutcome({ stdout, lastMessage: null });
    } catch (e) {
      expect(e.message).toContain('Missing bearer');
      expect(e).not.toBeInstanceOf(CodexInvalidSchemaError);
    }
  });

  it('probe 3: invalid_json_schema 400 is a NEW error class, not a generic failure', () => {
    const schemaError = {
      type: 'error',
      error: {
        type: 'invalid_request_error', code: 'invalid_json_schema',
        message: "In context=('properties', 'findings', 'items'), 'required' is required to be supplied and to be an array including every key in properties. Missing 'file'.",
        param: 'text.format.schema',
      },
      status: 400,
    };
    const stdout = [
      JSON.stringify({ type: 'thread.started', thread_id: 't' }),
      JSON.stringify({ type: 'turn.started' }),
      JSON.stringify({ type: 'turn.failed', error: { message: JSON.stringify(schemaError) } }),
    ].join('\n');
    expect(() => parseCodexJudgeOutcome({ stdout, lastMessage: null })).toThrow(CodexInvalidSchemaError);
    try {
      parseCodexJudgeOutcome({ stdout, lastMessage: null });
    } catch (e) {
      expect(e.schemaMessage).toMatch(/Missing 'file'/);
    }
  });

  it('probe 8: a malformed schema file — empty stdout, reason on stderr only, folded in', () => {
    expect(() => parseCodexJudgeOutcome({ stdout: '', stderr: 'Output schema file <path> is not valid JSON: expected ident at line 1 column 2', lastMessage: null }))
      .toThrow(/not valid JSON/);
  });

  it('no terminal event at all (mid-run) throws a plain Error, distinct from a schema/auth failure', () => {
    const stdout = [
      JSON.stringify({ type: 'thread.started', thread_id: 't' }),
      JSON.stringify({ type: 'turn.started' }),
    ].join('\n');
    expect(() => parseCodexJudgeOutcome({ stdout, lastMessage: null })).toThrow(/no terminal/);
  });

  it('refuses a completed turn whose answer is not valid JSON, despite the schema constraint', () => {
    const stdout = JSON.stringify({ type: 'turn.completed', usage: {} });
    expect(() => parseCodexJudgeOutcome({ stdout, lastMessage: 'not json' })).toThrow(/did not parse as JSON/);
  });
});

describe('codexLoadedContextTokens — Codex\'s own usage key names, distinct from Claude\'s', () => {
  it('sums input_tokens + cached_input_tokens', () => {
    expect(codexLoadedContextTokens({ input_tokens: 100, cached_input_tokens: 50, output_tokens: 10 })).toBe(150);
  });
  it('defaults missing fields to 0', () => {
    expect(codexLoadedContextTokens({})).toBe(0);
    expect(codexLoadedContextTokens()).toBe(0);
  });
});

describe('codexJudgeSpawn — exercised over an injected spawn (real temp files, fake process)', () => {
  /** A fake `child_process.spawn` that writes the last-message file (as the real CLI does) and replays JSONL. */
  function fakeSpawn({ stdout, code = 0, writeLastMessage = null }) {
    const seen = { cli: null, argv: null, opts: null, stdin: '' };
    const fn = (cli, argv, opts) => {
      seen.cli = cli; seen.argv = argv; seen.opts = opts;
      if (writeLastMessage != null) {
        const idx = argv.indexOf('--output-last-message');
        writeFileSync(argv[idx + 1], writeLastMessage);
      }
      const child = {
        stdout: { on: (e, cb) => { if (e === 'data') setTimeout(() => cb(stdout), 0); } },
        stderr: { on: () => {} },
        stdin: { on: () => {}, end: (d) => { seen.stdin = d; } },
        on: (e, cb) => { if (e === 'close') setTimeout(() => cb(code), 1); },
        kill: () => {},
      };
      return child;
    };
    return { fn, seen };
  }

  const okJsonl = [
    JSON.stringify({ type: 'thread.started', thread_id: 'sess-1' }),
    JSON.stringify({ type: 'turn.completed', usage: { input_tokens: 10, output_tokens: 2 } }),
  ].join('\n');

  it('writes the (already-transformed) shape to a real temp schema file the argv points at', async () => {
    let schemaFileSeenDuringSpawn = null;
    const fn = (cli, argv) => {
      const idx = argv.indexOf('--output-schema');
      schemaFileSeenDuringSpawn = JSON.parse(readFileSync(argv[idx + 1], 'utf8'));
      const outIdx = argv.indexOf('--output-last-message');
      writeFileSync(argv[outIdx + 1], '{"verdict":"accept","finding":"ok"}');
      return {
        stdout: { on: (e, cb) => { if (e === 'data') setTimeout(() => cb(okJsonl), 0); } },
        stderr: { on: () => {} },
        stdin: { on: () => {}, end: () => {} },
        on: (e, cb) => { if (e === 'close') setTimeout(() => cb(0), 1); },
        kill: () => {},
      };
    };
    await codexJudgeSpawn({ mandate: 'm', input: 'i', shape: SHAPE, spawnFn: fn });
    expect(schemaFileSeenDuringSpawn).toEqual(SHAPE);
  });

  it('closes stdin via .end() — the exact property probe 0 found safe, with no positional prompt', async () => {
    const { fn, seen } = fakeSpawn({ stdout: okJsonl, writeLastMessage: '{"verdict":"accept","finding":"ok"}' });
    await codexJudgeSpawn({ mandate: 'BE TERSE', input: 'THE-DIFF', shape: SHAPE, spawnFn: fn });
    expect(seen.stdin).toContain('BE TERSE');
    expect(seen.stdin).toContain('THE-DIFF');
    expect(seen.argv.join(' ')).not.toContain('THE-DIFF'); // rode stdin, not argv
  });

  it('returns the thread_id as sessionId, costUsd 0, and the stripped value', async () => {
    const { fn } = fakeSpawn({ stdout: okJsonl, writeLastMessage: '{"verdict":"accept","finding":"ok"}' });
    const r = await codexJudgeSpawn({ mandate: 'm', input: 'i', shape: SHAPE, spawnFn: fn });
    expect(r.sessionId).toBe('sess-1');
    expect(r.costUsd).toBe(0);
    expect(r.value).toEqual({ verdict: 'accept', finding: 'ok' });
    expect(r.timedOut).toBe(false);
    expect(typeof r.wallMs).toBe('number');
    expect(r.argv).toEqual(expect.arrayContaining(['exec', '--json']));
  });

  it('refuses a tool-bearing request before ever spawning', async () => {
    const { fn } = fakeSpawn({ stdout: okJsonl });
    let called = false;
    const spy = (...a) => { called = true; return fn(...a); };
    await expect(codexJudgeSpawn({ mandate: 'm', input: 'i', shape: SHAPE, allowedTools: ['Read'], spawnFn: spy }))
      .rejects.toThrow(/TOOL-FREE panelist only/);
    expect(called).toBe(false);
  });

  it('cleans up its temp working directory after the spawn settles', async () => {
    let workDirSeen = null;
    const fn = (cli, argv, opts) => {
      workDirSeen = opts.cwd;
      const outIdx = argv.indexOf('--output-last-message');
      writeFileSync(argv[outIdx + 1], '{"verdict":"accept","finding":"ok"}');
      return {
        stdout: { on: (e, cb) => { if (e === 'data') setTimeout(() => cb(okJsonl), 0); } },
        stderr: { on: () => {} },
        stdin: { on: () => {}, end: () => {} },
        on: (e, cb) => { if (e === 'close') setTimeout(() => cb(0), 1); },
        kill: () => {},
      };
    };
    await codexJudgeSpawn({ mandate: 'm', input: 'i', shape: SHAPE, spawnFn: fn });
    expect(existsSync(workDirSeen)).toBe(false);
  });

  describe('a juror that hits the wall (probe 6 — no CLI timeout flag; the parent kills it)', () => {
    function neverEndingSpawn() {
      return (cli, argv) => ({
        stdout: { on: (e, cb) => { if (e === 'data') setTimeout(() => cb(JSON.stringify({ type: 'thread.started', thread_id: 't' })), 0); } },
        stderr: { on: () => {} },
        stdin: { on: () => {}, end: () => {} },
        on: () => {}, // never fires `close` — only a kill ends this
        kill: () => {},
      });
    }

    it('throws JudgeTimeoutError when the kill leaves nothing parseable', async () => {
      await expect(codexJudgeSpawn({ mandate: 'm', input: 'i', shape: SHAPE, timeoutMs: 5, spawnFn: neverEndingSpawn() }))
        .rejects.toThrow(JudgeTimeoutError);
    });

    it('recovers a partial answer if the killed stream happens to be parseable (probe 6: JSONL survives a kill)', async () => {
      const partialJsonl = [
        JSON.stringify({ type: 'thread.started', thread_id: 'killed-sess' }),
        JSON.stringify({ type: 'turn.completed', usage: {} }),
      ].join('\n');
      const fn = (cli, argv) => {
        const outIdx = argv.indexOf('--output-last-message');
        writeFileSync(argv[outIdx + 1], '{"verdict":"accept","finding":"recovered"}');
        return {
          stdout: { on: (e, cb) => { if (e === 'data') setTimeout(() => cb(partialJsonl), 0); } },
          stderr: { on: () => {} },
          stdin: { on: () => {}, end: () => {} },
          on: () => {},
          kill: () => {},
        };
      };
      const r = await codexJudgeSpawn({ mandate: 'm', input: 'i', shape: SHAPE, timeoutMs: 5, spawnFn: fn });
      expect(r.timedOut).toBe(true);
      expect(r.value).toEqual({ verdict: 'accept', finding: 'recovered' });
    });
  });
});

// #xqa9ttq — the OpenAI-strict schema transform + response-side null strip, proved live against a real
// `codex exec` spawn in `#3371` probes 3/4 before either function existed. See `requireAllProperties`'s own
// header for the full reasoning, INCLUDING why these live in THIS file and not `jury-core.mjs` (a real
// import-graph regression, caught by the repo's ephemeral-clone CLI tests — not a style choice).
describe('#xqa9ttq requireAllProperties — the OpenAI-strict schema transform (#3371 probes 3/4)', () => {
  it('adds every property key to `required`, matching the real REVIEW_JUDGE_SHAPE-shaped 400 probe 3 reproduced', () => {
    const shape = {
      type: 'object',
      properties: {
        summary: { type: 'string' },
        findings: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              summary: { type: 'string' },
              file: { type: 'string' },
              line: { type: 'number' },
            },
            required: ['summary'],
          },
        },
      },
      required: ['summary'],
    };
    const out = requireAllProperties(shape);
    expect(out.required).toEqual(['summary', 'findings']);
    expect(out.properties.findings.items.required).toEqual(['summary', 'file', 'line']);
  });

  it('widens a newly-required property to accept `null`, but leaves an ALREADY-required one\'s type untouched', () => {
    const shape = {
      type: 'object',
      properties: {
        summary: { type: 'string' },
        file: { type: 'string' },
      },
      required: ['summary'],
    };
    const out = requireAllProperties(shape);
    // `summary` was already required — its type is exactly what the schema's author declared, unchanged.
    expect(out.properties.summary.type).toBe('string');
    // `file` was NOT required — probe 4's real response proved OpenAI sends `null` for it, so its type widens.
    expect(out.properties.file.type).toEqual(['string', 'null']);
  });

  it('never mutates the input, at any depth', () => {
    const shape = {
      type: 'object',
      properties: { a: { type: 'string' }, nested: { type: 'object', properties: { b: { type: 'number' } } } },
    };
    const frozenCopy = JSON.parse(JSON.stringify(shape));
    requireAllProperties(shape);
    expect(shape).toEqual(frozenCopy);
  });

  it('leaves a leaf with no `properties` (and no `type` to widen) unchanged', () => {
    expect(requireAllProperties({ type: 'string', enum: ['a', 'b'] })).toEqual({ type: 'string', enum: ['a', 'b'] });
    expect(requireAllProperties({ $ref: '#/$defs/thing' })).toEqual({ $ref: '#/$defs/thing' });
  });

  it('passes non-object, non-array input through unchanged (including null)', () => {
    expect(requireAllProperties(null)).toBeNull();
    expect(requireAllProperties(undefined)).toBeUndefined();
    expect(requireAllProperties('x')).toBe('x');
  });
});

describe('#xqa9ttq stripNulls — strip a Codex answer\'s explicit nulls before normalizeFinding (#3371 probe 4)', () => {
  it('removes every object property whose value is exactly null, recursively', () => {
    const value = {
      summary: 'x', file: null, line: null,
      nested: { a: 1, b: null, deeper: { c: null, d: 'kept' } },
    };
    expect(stripNulls(value)).toEqual({
      summary: 'x', nested: { a: 1, deeper: { d: 'kept' } },
    });
  });

  it('matches probe 4\'s exact real response shape', () => {
    const probe4Response = {
      summary: 'The added half(n) function divides by zero instead of two.',
      findings: [{
        summary: 'Divide by 2 instead of 0.', file: null, line: null, category: 'correctness',
        verdict: 'CONFIRMED', parallelizable: null,
      }],
    };
    expect(stripNulls(probe4Response)).toEqual({
      summary: 'The added half(n) function divides by zero instead of two.',
      findings: [{ summary: 'Divide by 2 instead of 0.', category: 'correctness', verdict: 'CONFIRMED' }],
    });
  });

  it('leaves a null ARRAY ELEMENT in place — dropping it would shift every later index', () => {
    expect(stripNulls([1, null, 3])).toEqual([1, null, 3]);
  });

  it('passes a bare scalar through unchanged, including null itself', () => {
    expect(stripNulls('x')).toBe('x');
    expect(stripNulls(5)).toBe(5);
    expect(stripNulls(null)).toBeNull();
  });

  it('never mutates its input', () => {
    const value = { a: 1, b: null };
    const copy = JSON.parse(JSON.stringify(value));
    stripNulls(value);
    expect(value).toEqual(copy);
  });
});
