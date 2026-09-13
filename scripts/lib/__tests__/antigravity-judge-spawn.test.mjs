/**
 * @file antigravity-judge-spawn.test.mjs — the Antigravity (`agy`) `JudgeProvider`'s argv/parsing/error-mapping
 * contract, proved WITHOUT spawning a real process (#3383, mirroring `codex-judge-spawn.test.mjs`'s own split).
 *
 * Every shape asserted here traces to a specific `backlog/3633-probe-antigravity-cli-against-the-judge-
 * contract.md` probe, OR to this module's own "LIVE RE-CONFIRMATION" (re-probed while the module was written,
 * same machine, same `agy` 1.2.1) — each `describe`/`it` title names which.
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import {
  ANTIGRAVITY_CLI,
  ANTIGRAVITY_EFFORT_MAP,
  AntigravityToolDeniedError,
  assertNoAntigravityToolAllowlist,
  buildAntigravityJudgeArgv,
  buildAntigravityPrompt,
  buildAntigravityStreamInput,
  parseAntigravityJudgeOutcome,
  antigravityLoadedContextTokens,
  antigravityJudgeSpawn,
} from '../antigravity-judge-spawn.mjs';
import { JudgeTimeoutError } from '../judge-spawn.mjs';

const SHAPE = {
  type: 'object',
  properties: { verdict: { type: 'string', enum: ['accept', 'reject'] }, finding: { type: 'string' } },
  required: ['verdict', 'finding'],
  additionalProperties: false,
};

describe('ANTIGRAVITY_CLI', () => {
  it('is the agy binary — named once, exactly like judge-spawn.mjs#JUDGE_CLI / codex-judge-spawn.mjs#CODEX_CLI', () => {
    expect(ANTIGRAVITY_CLI).toBe('agy');
  });
});

describe('buildAntigravityJudgeArgv — the argv translation, per #3633\'s probes (5b, 9, 19)', () => {
  const base = { schemaFile: '/tmp/schema.json' };

  it('translates to the stream-json route, --disable-slash-commands MANDATORY, --json-schema UNTRANSFORMED', () => {
    const argv = buildAntigravityJudgeArgv(base);
    expect(argv).toEqual([
      '--input-format', 'stream-json',
      '--output-format', 'stream-json',
      '--disable-slash-commands',
      '--json-schema', '/tmp/schema.json',
      '--print', '',
    ]);
  });

  it('never passes --dangerously-skip-permissions or --sandbox — that is what keeps this seat tool-free', () => {
    const argv = buildAntigravityJudgeArgv({ ...base, model: 'gemini-3.8-flash-low', effort: 'low' });
    expect(argv).not.toContain('--dangerously-skip-permissions');
    expect(argv).not.toContain('--sandbox');
  });

  it('has NO POSITIONAL PROMPT — --print is always the empty string, the prompt rides stdin instead', () => {
    const argv = buildAntigravityJudgeArgv(base);
    const printIdx = argv.indexOf('--print');
    expect(printIdx).toBeGreaterThan(-1);
    expect(argv[printIdx + 1]).toBe('');
  });

  it('adds --model <model> only when a model is given', () => {
    expect(buildAntigravityJudgeArgv(base)).not.toContain('--model');
    expect(buildAntigravityJudgeArgv({ ...base, model: 'gemini-3.1-pro-high' }))
      .toEqual(expect.arrayContaining(['--model', 'gemini-3.1-pro-high']));
  });

  it('refuses a model shaped like a flag', () => {
    expect(() => buildAntigravityJudgeArgv({ ...base, model: '-x' })).toThrow(/plain non-empty string/);
  });

  it('maps effort through ANTIGRAVITY_EFFORT_MAP, via --effort', () => {
    for (const [from, to] of Object.entries(ANTIGRAVITY_EFFORT_MAP)) {
      const argv = buildAntigravityJudgeArgv({ ...base, effort: from });
      expect(argv).toEqual(expect.arrayContaining(['--effort', to]));
    }
  });

  it('clamps xhigh/max DOWN to high — agy\'s --effort only accepts low/medium/high (#3633 probe 9)', () => {
    expect(ANTIGRAVITY_EFFORT_MAP.xhigh).toBe('high');
    expect(ANTIGRAVITY_EFFORT_MAP.max).toBe('high');
  });

  it('refuses an unrecognised effort rather than passing it through silently', () => {
    expect(() => buildAntigravityJudgeArgv({ ...base, effort: 'ludicrous' })).toThrow(/must be one of/);
  });

  it('refuses a missing schemaFile', () => {
    expect(() => buildAntigravityJudgeArgv({ schemaFile: '' })).toThrow(/schemaFile/);
  });
});

describe('buildAntigravityPrompt — folding the mandate into prompt text (no --append-system-prompt equivalent)', () => {
  it('labels the two parts so a captured transcript can tell them apart', () => {
    const prompt = buildAntigravityPrompt('BE TERSE', 'THE-DIFF');
    expect(prompt).toContain('BE TERSE');
    expect(prompt).toContain('THE-DIFF');
    expect(prompt.indexOf('BE TERSE')).toBeLessThan(prompt.indexOf('THE-DIFF'));
  });
});

describe('buildAntigravityStreamInput — #3633 probe 5b\'s undocumented stdin route', () => {
  it('wraps the prompt in a stream-json `user` event, newline-terminated', () => {
    const line = buildAntigravityStreamInput('hello world');
    expect(line.endsWith('\n')).toBe(true);
    const parsed = JSON.parse(line.trim());
    expect(parsed).toEqual({ event: 'user', message: { role: 'user', content: 'hello world' } });
  });
});

describe('assertNoAntigravityToolAllowlist — no configurable allow-list; the ceiling is zero tools by omission', () => {
  it('passes for null/undefined/empty', () => {
    expect(() => assertNoAntigravityToolAllowlist(null)).not.toThrow();
    expect(() => assertNoAntigravityToolAllowlist(undefined)).not.toThrow();
    expect(() => assertNoAntigravityToolAllowlist([])).not.toThrow();
  });

  it('refuses any non-empty tool list', () => {
    expect(() => assertNoAntigravityToolAllowlist(['Read'])).toThrow(/no configurable tool allow-list/);
  });
});

describe('parseAntigravityJudgeOutcome — stream-json JSONL, the answer nests under the `result` event\'s own `result` key', () => {
  it('#3633 probe 1 shape (re-confirmed live, stream-json route): a clean result event', () => {
    const stdout = [
      JSON.stringify({ event: 'init', conversation_id: 'conv-1', init: {} }),
      JSON.stringify({ event: 'step_update', step_update: { step_index: 0 } }),
      JSON.stringify({
        event: 'result',
        result: {
          conversation_id: 'conv-1', status: 'SUCCESS', response: '{"verdict":"reject","finding":"x"}',
          duration_seconds: 1.2, num_turns: 1,
          structured_output: { verdict: 'reject', finding: 'x' },
          usage: { input_tokens: 100, output_tokens: 10, cache_read_tokens: 5 },
        },
      }),
    ].join('\n');
    const out = parseAntigravityJudgeOutcome({ stdout });
    expect(out.value).toEqual({ verdict: 'reject', finding: 'x' });
    expect(out.sessionId).toBe('conv-1');
    expect(out.costUsd).toBe(0);
    expect(out.stopReason).toBe('SUCCESS');
    expect(out.numTurns).toBe(1);
    expect(out.usage).toEqual({ input_tokens: 100, output_tokens: 10, cache_read_tokens: 5 });
  });

  it('reads `line.result.structured_output`, NEVER `line.structured_output` (the nesting this module\'s own '
    + 'header records as easy to misread from #3633\'s prose)', () => {
    // A flat (doc-mode-shaped) line with a top-level `structured_output` is NOT a valid stream-json `result`
    // event — it must be ignored, and since it is the only line, this must throw "no terminal event".
    const stdout = JSON.stringify({ event: 'result', structured_output: { verdict: 'accept', finding: 'x' } });
    expect(() => parseAntigravityJudgeOutcome({ stdout })).toThrow(/no terminal/);
  });

  it('#3633 probe 7, reproduced live — status SUCCESS + empty response + ABSENT structured_output is a HARD '
    + 'FAILURE, never a clean empty-findings accept', () => {
    const stdout = JSON.stringify({
      event: 'result',
      result: {
        conversation_id: 'conv-2', status: 'SUCCESS', response: '', duration_seconds: 5.7, num_turns: 1,
        usage: {}, denied_actions: [{ action: 'command', display_name: 'RunCommand' }],
      },
    });
    expect(() => parseAntigravityJudgeOutcome({ stdout, stderr: 'jetski: no output produced …' }))
      .toThrow(AntigravityToolDeniedError);
    try {
      parseAntigravityJudgeOutcome({ stdout, stderr: 'jetski: no output produced …' });
    } catch (e) {
      expect(e.deniedActions).toEqual([{ action: 'command', display_name: 'RunCommand' }]);
      expect(e.message).toContain('RunCommand');
      expect(e.message).toContain('jetski: no output produced');
    }
  });

  it('an honest ZERO-FINDINGS answer is a PRESENT, non-empty object — never confused with the absent-key failure', () => {
    const stdout = JSON.stringify({
      event: 'result',
      result: {
        conversation_id: 'conv-3', status: 'SUCCESS', response: '{}', num_turns: 1,
        structured_output: { summary: 'nothing found', findings: [] }, usage: {},
      },
    });
    const out = parseAntigravityJudgeOutcome({ stdout });
    expect(out.value).toEqual({ summary: 'nothing found', findings: [] });
  });

  it('#3633 probe 9/17 — status ERROR (bad effort, or auth) throws the CLI\'s own words verbatim', () => {
    const stdout = JSON.stringify({
      event: 'result',
      result: {
        conversation_id: '', status: 'ERROR', response: '',
        error: 'invalid model selection (--model "" --effort "bogus"): invalid --effort "bogus" (valid: low, medium, high)',
        num_turns: 0, usage: {},
      },
    });
    expect(() => parseAntigravityJudgeOutcome({ stdout })).toThrow(/invalid --effort "bogus"/);
  });

  it('#3633 probe 8: a malformed/missing schema file — empty stdout, reason on stderr only, folded in', () => {
    expect(() => parseAntigravityJudgeOutcome({
      stdout: '',
      stderr: 'Error: invalid --json-schema: failed to read schema file "/no/such/schema.json": open …: no such file or directory',
    })).toThrow(/no terminal/);
  });

  it('no result event at all (mid-run) throws a plain Error naming what it saw', () => {
    const stdout = JSON.stringify({ event: 'init', conversation_id: 'conv-4', init: {} });
    expect(() => parseAntigravityJudgeOutcome({ stdout })).toThrow(/no terminal/);
  });

  it('refuses a structured_output that is not a JSON object (e.g. a bare array or scalar)', () => {
    const stdout = JSON.stringify({ event: 'result', result: { status: 'SUCCESS', structured_output: [] } });
    expect(() => parseAntigravityJudgeOutcome({ stdout })).toThrow(/not a JSON object/);
  });
});

describe('antigravityLoadedContextTokens — agy\'s own usage key names (#3633 probe 10)', () => {
  it('sums input_tokens + cache_read_tokens (NOT total_tokens, which excludes the cache-read half)', () => {
    expect(antigravityLoadedContextTokens({ input_tokens: 100, cache_read_tokens: 50, output_tokens: 10, total_tokens: 110 })).toBe(150);
  });
  it('defaults missing fields to 0', () => {
    expect(antigravityLoadedContextTokens({})).toBe(0);
    expect(antigravityLoadedContextTokens()).toBe(0);
  });
});

describe('antigravityJudgeSpawn — exercised over an injected spawn (real temp files, fake process)', () => {
  function resultJsonl(result) {
    return [
      JSON.stringify({ event: 'init', conversation_id: result.conversation_id ?? 'sess-1', init: {} }),
      JSON.stringify({ event: 'result', result }),
    ].join('\n');
  }

  const OK_RESULT = {
    conversation_id: 'sess-1', status: 'SUCCESS', response: '{"verdict":"accept","finding":"ok"}',
    num_turns: 1, structured_output: { verdict: 'accept', finding: 'ok' },
    usage: { input_tokens: 10, output_tokens: 2 },
  };

  function fakeSpawn({ stdout, code = 0 }) {
    const seen = { cli: null, argv: null, opts: null, stdin: '' };
    const fn = (cli, argv, opts) => {
      seen.cli = cli; seen.argv = argv; seen.opts = opts;
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

  it('writes the shape UNTRANSFORMED to a real temp schema file the argv points at', async () => {
    let schemaFileSeenDuringSpawn = null;
    const fn = (cli, argv) => {
      const idx = argv.indexOf('--json-schema');
      schemaFileSeenDuringSpawn = JSON.parse(readFileSync(argv[idx + 1], 'utf8'));
      return {
        stdout: { on: (e, cb) => { if (e === 'data') setTimeout(() => cb(resultJsonl(OK_RESULT)), 0); } },
        stderr: { on: () => {} },
        stdin: { on: () => {}, end: () => {} },
        on: (e, cb) => { if (e === 'close') setTimeout(() => cb(0), 1); },
        kill: () => {},
      };
    };
    await antigravityJudgeSpawn({ mandate: 'm', input: 'i', shape: SHAPE, spawnFn: fn });
    // UNTRANSFORMED — byte for byte the same shape, no requireAllProperties-equivalent applied (#3633 probe 3).
    expect(schemaFileSeenDuringSpawn).toEqual(SHAPE);
  });

  it('closes stdin via .end() with a single stream-json `user` event carrying the mandate + input', async () => {
    const { fn, seen } = fakeSpawn({ stdout: resultJsonl(OK_RESULT) });
    await antigravityJudgeSpawn({ mandate: 'BE TERSE', input: 'THE-DIFF', shape: SHAPE, spawnFn: fn });
    expect(seen.stdin).toContain('BE TERSE');
    expect(seen.stdin).toContain('THE-DIFF');
    expect(seen.argv.join(' ')).not.toContain('THE-DIFF'); // rode stdin, not argv
    const parsed = JSON.parse(seen.stdin.trim());
    expect(parsed.event).toBe('user');
    expect(parsed.message.role).toBe('user');
  });

  it('returns the conversation_id as sessionId, costUsd 0, and the structured_output value', async () => {
    const { fn } = fakeSpawn({ stdout: resultJsonl(OK_RESULT) });
    const r = await antigravityJudgeSpawn({ mandate: 'm', input: 'i', shape: SHAPE, spawnFn: fn });
    expect(r.sessionId).toBe('sess-1');
    expect(r.costUsd).toBe(0);
    expect(r.value).toEqual({ verdict: 'accept', finding: 'ok' });
    expect(r.timedOut).toBe(false);
    expect(typeof r.wallMs).toBe('number');
    expect(r.argv).toEqual(expect.arrayContaining(['--input-format', 'stream-json', '--disable-slash-commands']));
  });

  it('the silent-tool-denial failure (#3633 probe 7) surfaces as a rejection, never a clean empty answer', async () => {
    const deniedResult = {
      conversation_id: 'sess-2', status: 'SUCCESS', response: '', num_turns: 1, usage: {},
      denied_actions: [{ action: 'command', display_name: 'RunCommand' }],
    };
    const { fn } = fakeSpawn({ stdout: resultJsonl(deniedResult) });
    await expect(antigravityJudgeSpawn({ mandate: 'm', input: 'i', shape: SHAPE, spawnFn: fn }))
      .rejects.toThrow(AntigravityToolDeniedError);
  });

  it('refuses a tool-bearing request before ever spawning', async () => {
    const { fn } = fakeSpawn({ stdout: resultJsonl(OK_RESULT) });
    let called = false;
    const spy = (...a) => { called = true; return fn(...a); };
    await expect(antigravityJudgeSpawn({ mandate: 'm', input: 'i', shape: SHAPE, allowedTools: ['Read'], spawnFn: spy }))
      .rejects.toThrow(/no configurable tool allow-list/);
    expect(called).toBe(false);
  });

  it('never passes --dangerously-skip-permissions or --sandbox in the real spawned argv', async () => {
    const { fn, seen } = fakeSpawn({ stdout: resultJsonl(OK_RESULT) });
    await antigravityJudgeSpawn({ mandate: 'm', input: 'i', shape: SHAPE, spawnFn: fn });
    expect(seen.argv).not.toContain('--dangerously-skip-permissions');
    expect(seen.argv).not.toContain('--sandbox');
  });

  it('cleans up its temp working directory after the spawn settles', async () => {
    let workDirSeen = null;
    const fn = (cli, argv, opts) => {
      workDirSeen = opts.cwd;
      return {
        stdout: { on: (e, cb) => { if (e === 'data') setTimeout(() => cb(resultJsonl(OK_RESULT)), 0); } },
        stderr: { on: () => {} },
        stdin: { on: () => {}, end: () => {} },
        on: (e, cb) => { if (e === 'close') setTimeout(() => cb(0), 1); },
        kill: () => {},
      };
    };
    await antigravityJudgeSpawn({ mandate: 'm', input: 'i', shape: SHAPE, spawnFn: fn });
    expect(existsSync(workDirSeen)).toBe(false);
  });

  describe('a juror that hits the wall (#3633 probe 17 — --print-timeout does not cap the auth wait; the parent kills it)', () => {
    function neverEndingSpawn() {
      return () => ({
        stdout: { on: (e, cb) => { if (e === 'data') setTimeout(() => cb(JSON.stringify({ event: 'init', conversation_id: 't' })), 0); } },
        stderr: { on: () => {} },
        stdin: { on: () => {}, end: () => {} },
        on: () => {}, // never fires `close` — only a kill ends this
        kill: () => {},
      });
    }

    it('throws JudgeTimeoutError when the kill leaves nothing parseable', async () => {
      await expect(antigravityJudgeSpawn({ mandate: 'm', input: 'i', shape: SHAPE, timeoutMs: 5, spawnFn: neverEndingSpawn() }))
        .rejects.toThrow(JudgeTimeoutError);
    });

    it('recovers a partial answer if the killed stream happens to be parseable', async () => {
      const partialJsonl = resultJsonl({ ...OK_RESULT, conversation_id: 'killed-sess', structured_output: { verdict: 'accept', finding: 'recovered' } });
      const fn = () => ({
        stdout: { on: (e, cb) => { if (e === 'data') setTimeout(() => cb(partialJsonl), 0); } },
        stderr: { on: () => {} },
        stdin: { on: () => {}, end: () => {} },
        on: () => {},
        kill: () => {},
      });
      const r = await antigravityJudgeSpawn({ mandate: 'm', input: 'i', shape: SHAPE, timeoutMs: 5, spawnFn: fn });
      expect(r.timedOut).toBe(true);
      expect(r.value).toEqual({ verdict: 'accept', finding: 'recovered' });
    });
  });
});
