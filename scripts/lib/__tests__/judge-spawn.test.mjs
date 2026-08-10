/**
 * @file judge-spawn.test.mjs — the juror spawn's flag contract, proved WITHOUT spawning anything (#3028).
 *
 * `buildJudgeArgv` and `parseJudgeOutcome` are pure, and that is the whole point of the seam: the recipe
 * every `judge` step depends on is assertable at zero cost and zero latency, so the one test that pays for
 * a real `claude` process (`judge-spawn.integration.test.mjs`) only has to prove the CLI still honours it.
 *
 * THE LOAD-BEARING TEST IN HERE is the `--bare` refusal. #3028 records the trap: `--bare` strips more
 * context than `--safe-mode` but forces key-based auth, so on a subscription the spawn dies "Not logged in".
 * Reproduced while writing this: exit 1, `is_error: true`, zero tokens billed. A comment would rot; three
 * tests will not, and they pin three DIFFERENT things — say which, because an earlier version of this header
 * claimed more than was actually held:
 *   1. `buildJudgeArgv` never EMITS `--bare`, across the whole care→rigor dial.
 *   2. `assertNoForbiddenArgv` REFUSES any argv carrying it, whatever produced that argv (called directly).
 *   3. `judgeSpawn`'s own CALL to that guard is pinned — the route is a flag-shaped `model`, which
 *      `buildJudgeArgv` accepts as a plain non-empty string and drops into argv as `--model --bare`. Deleting
 *      the guard call therefore turns that test red. What is still NOT pinned by any test is the guard's
 *      stated belt-and-braces case (a future edit making `buildJudgeArgv` emit `--bare` literally); that is
 *      unreachable from the public API by construction, and no test here pretends otherwise.
 */

import { describe, it, expect } from 'vitest';
import {
  JUDGE_CLI,
  FORBIDDEN_ARGV,
  assertNoForbiddenArgv,
  EFFORT_LEVELS,
  DEFAULT_MODEL,
  DEFAULT_EFFORT,
  DEFAULT_BUDGET_USD,
  deriveSessionId,
  sessionSeed,
  buildJudgeArgv,
  parseJudgeOutcome,
  loadedContextTokens,
  judgeSpawn,
} from '../judge-spawn.mjs';

const SHAPE = {
  type: 'object',
  properties: { verdict: { type: 'string' }, findings: { type: 'array', items: { type: 'string' } } },
  required: ['verdict', 'findings'],
  additionalProperties: false,
};
const SID = deriveSessionId(sessionSeed(['run-7', 'rigor']));

/** The flag/value pair a caller asked for, so assertions read as the recipe rather than as indices. */
function flagValue(argv, flag) {
  const i = argv.indexOf(flag);
  return i === -1 ? undefined : argv[i + 1];
}

describe('the recorded `--bare` trap is a gate, not a comment', () => {
  it('`FORBIDDEN_ARGV` names `--bare` — the flag that forces key-based auth and cannot see a subscription', () => {
    expect(FORBIDDEN_ARGV).toContain('--bare');
  });

  it('buildJudgeArgv NEVER emits `--bare`, across every combination of the care→rigor dial', () => {
    for (const model of ['sonnet', 'opus', 'haiku', 'claude-sonnet-5']) {
      for (const effort of EFFORT_LEVELS) {
        const argv = buildJudgeArgv({ mandate: 'judge it', shape: SHAPE, model, effort, budget: 1, sessionId: SID });
        expect(argv).not.toContain('--bare');
      }
    }
  });

  it('tier one uses `--safe-mode` INSTEAD — the flag that keeps the subscription login visible', () => {
    const argv = buildJudgeArgv({ mandate: 'judge it', shape: SHAPE, sessionId: SID });
    expect(argv).toContain('--safe-mode');
    expect(argv).not.toContain('--bare');
  });

  it('the runtime guard REFUSES an argv carrying `--bare`, whatever produced it', () => {
    const poisoned = [...buildJudgeArgv({ mandate: 'm', shape: SHAPE, sessionId: SID }), '--bare'];
    expect(() => assertNoForbiddenArgv(poisoned)).toThrow(/--bare/);
  });

  it('the runtime guard lets the real recipe through — the refusal is targeted, not paranoid', () => {
    expect(() => assertNoForbiddenArgv(buildJudgeArgv({ mandate: 'm', shape: SHAPE, sessionId: SID }))).not.toThrow();
  });

  it('the guard is total over an empty or absent argv', () => {
    expect(() => assertNoForbiddenArgv()).not.toThrow();
    expect(() => assertNoForbiddenArgv([])).not.toThrow();
  });

  it('judgeSpawn CALLS that guard before spawning — a flag-shaped `model` smuggles `--bare` into argv', async () => {
    // `buildJudgeArgv` only checks `model` is a non-empty string, so `--model --bare` is a well-formed argv
    // it will happily produce. This is the one route by which a forbidden flag reaches the guard through the
    // public API, and it is what pins the call site: delete `assertNoForbiddenArgv(argv)` from `judgeSpawn`
    // and this test goes red because the spawn starts.
    let started = false;
    const spawnFn = () => { started = true; };
    await expect(judgeSpawn({ mandate: 'm', input: 'i', shape: SHAPE, model: '--bare', sessionId: SID, spawnFn }))
      .rejects.toThrow(/refusing to spawn with --bare/);
    expect(started).toBe(false);
  });
});

describe('buildJudgeArgv — the recipe, pinned exactly (#3028)', () => {
  it('produces the full flag list in a fixed order for a representative per-lens call', () => {
    const argv = buildJudgeArgv({
      mandate: 'You are the rigor juror.',
      shape: SHAPE,
      model: 'opus',
      effort: 'high',
      budget: 0.75,
      sessionId: SID,
    });
    expect(argv).toEqual([
      '-p',
      '--output-format', 'json',
      '--safe-mode',
      '--tools', '',
      '--model', 'opus',
      '--effort', 'high',
      '--max-budget-usd', '0.75',
      '--no-session-persistence',
      '--session-id', SID,
      '--append-system-prompt', 'You are the rigor juror.',
      '--json-schema', JSON.stringify(SHAPE),
    ]);
  });

  it('grants no tools — `--tools ""` is the structural guarantee, not a reminder in the mandate', () => {
    const argv = buildJudgeArgv({ mandate: 'm', shape: SHAPE, sessionId: SID });
    expect(flagValue(argv, '--tools')).toBe('');
  });

  it('follows the VARIADIC `--tools ""` with an option token, so nothing is swallowed as a tool name', () => {
    const argv = buildJudgeArgv({ mandate: 'm', shape: SHAPE, sessionId: SID });
    const after = argv[argv.indexOf('--tools') + 2];
    expect(after.startsWith('--')).toBe(true);
  });

  it('carries the judged material NOWHERE in argv — the input rides stdin, so argv has no ARG_MAX ceiling', () => {
    const argv = buildJudgeArgv({ mandate: 'm', shape: SHAPE, sessionId: SID });
    expect(argv.join('')).not.toContain('THE-DIFF-SENTINEL');
    // …and there is no positional prompt slot at all: every token is a flag or a flag's value.
    expect(argv[argv.length - 2]).toBe('--json-schema');
  });

  it('enforces the shape as SERIALIZED JSON Schema, so the answer is forced rather than requested', () => {
    const argv = buildJudgeArgv({ mandate: 'm', shape: SHAPE, sessionId: SID });
    expect(JSON.parse(flagValue(argv, '--json-schema'))).toEqual(SHAPE);
  });

  it('makes the care→rigor dial two flags rather than prompt tuning', () => {
    const gentle = buildJudgeArgv({ mandate: 'm', shape: SHAPE, model: 'haiku', effort: 'low', sessionId: SID });
    const severe = buildJudgeArgv({ mandate: 'm', shape: SHAPE, model: 'opus', effort: 'max', sessionId: SID });
    expect([flagValue(gentle, '--model'), flagValue(gentle, '--effort')]).toEqual(['haiku', 'low']);
    expect([flagValue(severe, '--model'), flagValue(severe, '--effort')]).toEqual(['opus', 'max']);
    // The mandate is IDENTICAL across the dial — that is the claim.
    expect(flagValue(gentle, '--append-system-prompt')).toBe(flagValue(severe, '--append-system-prompt'));
  });

  it('caps every juror with a hard budget and keeps the session throwaway', () => {
    const argv = buildJudgeArgv({ mandate: 'm', shape: SHAPE, budget: 2.5, sessionId: SID });
    expect(flagValue(argv, '--max-budget-usd')).toBe('2.5');
    expect(argv).toContain('--no-session-persistence');
  });

  it('defaults the dial to the documented middle', () => {
    const argv = buildJudgeArgv({ mandate: 'm', shape: SHAPE, sessionId: SID });
    expect(flagValue(argv, '--model')).toBe(DEFAULT_MODEL);
    expect(flagValue(argv, '--effort')).toBe(DEFAULT_EFFORT);
    expect(flagValue(argv, '--max-budget-usd')).toBe(String(DEFAULT_BUDGET_USD));
  });

  it('is PURE — the same input yields an identical list, and no environment is read', () => {
    const a = buildJudgeArgv({ mandate: 'm', shape: SHAPE, sessionId: SID });
    const b = buildJudgeArgv({ mandate: 'm', shape: SHAPE, sessionId: SID });
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
  });

  it('names the CLI once, so a caller can point at another binary without re-deriving flags', () => {
    expect(JUDGE_CLI).toBe('claude');
  });
});

describe('buildJudgeArgv — refuses a call it cannot make well-formed', () => {
  it.each([
    ['a missing mandate', { shape: SHAPE, sessionId: SID }, /mandate/],
    ['a blank mandate', { mandate: '   ', shape: SHAPE, sessionId: SID }, /mandate/],
    ['a missing shape', { mandate: 'm', sessionId: SID }, /shape/],
    ['an array shape', { mandate: 'm', shape: [], sessionId: SID }, /shape/],
    ['an effort outside the CLI enum', { mandate: 'm', shape: SHAPE, effort: 'extreme', sessionId: SID }, /effort/],
    ['a zero budget', { mandate: 'm', shape: SHAPE, budget: 0, sessionId: SID }, /budget/],
    ['a negative budget', { mandate: 'm', shape: SHAPE, budget: -1, sessionId: SID }, /budget/],
    ['a non-UUID session id', { mandate: 'm', shape: SHAPE, sessionId: 'run-7' }, /sessionId/],
    ['a missing session id', { mandate: 'm', shape: SHAPE }, /sessionId/],
  ])('throws on %s', (_label, opts, pattern) => {
    expect(() => buildJudgeArgv(opts)).toThrow(pattern);
  });
});

describe('deriveSessionId — the juror is a NAMED actor, not merely a fresh one (#3028 third guarantee)', () => {
  it('is a canonical UUID the CLI accepts for `--session-id`', () => {
    expect(deriveSessionId('run-7 rigor')).toMatch(/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/);
  });

  it('is RFC 9562 version 8 — honest that this is a hash, not randomness (v4) or a namespace (v5)', () => {
    expect(deriveSessionId('run-7 rigor').charAt(14)).toBe('8');
  });

  it('sets the RFC variant bits', () => {
    expect('89ab').toContain(deriveSessionId('run-7 rigor').charAt(19));
  });

  it('is deterministic, so a run record can point at the transcript it named', () => {
    expect(deriveSessionId('run-7 rigor')).toBe(deriveSessionId('run-7 rigor'));
  });

  it('separates the lenses of one panel, so jurors are distinct actors from each other', () => {
    const seen = new Set(['rigor', 'care', 'security', 'a11y', 'perf'].map((l) => deriveSessionId(sessionSeed(['run-7', l]))));
    expect(seen.size).toBe(5);
  });

  it('separates runs, so yesterday\'s juror is not today\'s', () => {
    expect(deriveSessionId(sessionSeed(['run-7', 'rigor']))).not.toBe(deriveSessionId(sessionSeed(['run-8', 'rigor'])));
  });

  it('refuses an empty seed rather than inventing an identity', () => {
    expect(() => deriveSessionId('')).toThrow(/seed/);
    expect(() => deriveSessionId(undefined)).toThrow(/seed/);
  });
});

describe('sessionSeed — the ONE injective seed encoding, replacing the ambiguous space join (#3058)', () => {
  const id = (fields) => deriveSessionId(sessionSeed(fields));

  it('THE ORIGINAL DEFECT: a space join maps two different (runId, id) pairs onto one actor', () => {
    // The join itself is the defect — these two DIFFERENT field pairs are ONE string, which on `main` both
    // derived 8f57af23-ca27-80e7-b1f3-c2510e0aa618 through `panelSeats`.
    const spaceJoin = (runId, seatId) => `${runId} ${seatId}`;
    expect(spaceJoin('a', 'b c#1')).toBe(spaceJoin('a b', 'c#1'));
    expect(deriveSessionId(spaceJoin('a', 'b c#1'))).toBe(deriveSessionId(spaceJoin('a b', 'c#1')));
    // The encoder separates exactly that pair — same fields, no longer the same seed and no longer one actor.
    expect(sessionSeed(['a', 'b c#1'])).not.toBe(sessionSeed(['a b', 'c#1']));
    expect(id(['a', 'b c#1'])).not.toBe(id(['a b', 'c#1']));
  });

  it('THE SECOND DEFECT: an absent field no longer collapses onto a present one of the same value', () => {
    // `[runId, lens].filter(Boolean).join(' ')` made these one seed with NO SPACE anywhere in the input.
    expect(id(['same-string', undefined])).not.toBe(id([undefined, 'same-string']));
    expect(id(['same-string', ''])).not.toBe(id(['', 'same-string']));
  });

  it('absent, empty and missing are three different fields, not one', () => {
    const shapes = [
      ['a'],
      ['a', undefined],
      ['a', null],
      ['a', ''],
      ['a', 'b'],
      ['', 'a'],
      [undefined, 'a'],
      ['a', 'b', undefined],
      ['a', 'b', ''],
    ];
    // `undefined` and `null` are BOTH "absent" and deliberately encode the same — the distinction the item
    // asks for is absent-vs-empty-vs-missing, and nothing in this repo means different things by the two
    // nullish values. Everything else must be pairwise distinct.
    expect(sessionSeed(['a', null])).toBe(sessionSeed(['a', undefined]));
    const distinct = shapes.filter((s) => !(s.length === 2 && s[1] === null));
    expect(new Set(distinct.map(id)).size).toBe(distinct.length);
  });

  it('is injective over field values carrying the separators a naive join would reuse', () => {
    const alphabet = ['', ' ', 'a', 'a b', 'b', '#1', 'a#1', 'a b#1', ':', '2:x', '|', 'v1|2|', '~', undefined];
    const pairs = [];
    for (const x of alphabet) for (const y of alphabet) pairs.push([x, y]);
    // Every distinct (x, y) is a distinct seed, and therefore a distinct id.
    expect(new Set(pairs.map((p) => sessionSeed(p))).size).toBe(pairs.length);
    expect(new Set(pairs.map(id)).size).toBe(pairs.length);
  });

  it('is deterministic and declares its own field count, so a decoder cannot mis-split it', () => {
    expect(sessionSeed(['a', 'b c#1'])).toBe(sessionSeed(['a', 'b c#1']));
    expect(sessionSeed(['a', 'b c#1'])).toBe('v1|2|1:a5:b c#1');
    expect(sessionSeed(['a b', 'c#1'])).toBe('v1|2|3:a b3:c#1');
    expect(sessionSeed(['a'])).toBe('v1|1|1:a');
    expect(sessionSeed(['a', undefined])).toBe('v1|2|1:a~');
    expect(sessionSeed(['a', ''])).toBe('v1|2|1:a0:');
  });

  it('refuses a field list it cannot encode rather than stringifying its way past it', () => {
    expect(() => sessionSeed([])).toThrow(/non-empty array/);
    expect(() => sessionSeed('a b')).toThrow(/non-empty array/);
    expect(() => sessionSeed(undefined)).toThrow(/non-empty array/);
    expect(() => sessionSeed(['a', 7])).toThrow(/field 1 must be a string/);
    expect(() => sessionSeed([{ runId: 'a' }])).toThrow(/field 0 must be a string/);
  });
});

describe('parseJudgeOutcome — a validated object, or a throw carrying the SPAWN\'S OWN error', () => {
  const ok = {
    is_error: false,
    stop_reason: 'tool_use',
    session_id: 'aaaaaaaa-bbbb-8ccc-9ddd-eeeeeeeeeeee',
    total_cost_usd: 0.014,
    duration_ms: 2100,
    num_turns: 1,
    usage: { input_tokens: 2, cache_creation_input_tokens: 2061, cache_read_input_tokens: 3289, output_tokens: 4 },
    structured_output: { verdict: 'reject', findings: ['divides by zero'] },
  };

  it('returns the shape-enforced answer already parsed — no prose, no fences', () => {
    const r = parseJudgeOutcome(JSON.stringify(ok));
    expect(r.value).toEqual({ verdict: 'reject', findings: ['divides by zero'] });
    expect(typeof r.value).toBe('object');
  });

  it('surfaces the spawned session id, so a caller can RECORD which actor judged', () => {
    expect(parseJudgeOutcome(JSON.stringify(ok)).sessionId).toBe('aaaaaaaa-bbbb-8ccc-9ddd-eeeeeeeeeeee');
  });

  it('reports cost, duration, turns and the forced-tool stop reason', () => {
    const r = parseJudgeOutcome(JSON.stringify(ok));
    expect(r.costUsd).toBe(0.014);
    expect(r.durationMs).toBe(2100);
    expect(r.numTurns).toBe(1);
    expect(r.stopReason).toBe('tool_use');
  });

  it('rethrows the CLI\'s own words VERBATIM — this is how the `--bare` trap surfaces', () => {
    const bare = { is_error: true, result: 'Not logged in · Please run /login' };
    expect(() => parseJudgeOutcome(JSON.stringify(bare))).toThrow('Not logged in · Please run /login');
  });

  it('throws when the enforced shape did not land, naming the stop reason it saw instead', () => {
    const noShape = { is_error: false, stop_reason: 'end_turn', result: 'here are my thoughts' };
    expect(() => parseJudgeOutcome(JSON.stringify(noShape))).toThrow(/structured_output/);
    expect(() => parseJudgeOutcome(JSON.stringify(noShape))).toThrow(/end_turn/);
  });

  it('throws with both streams quoted when stdout is not JSON at all', () => {
    expect(() => parseJudgeOutcome('command not found', 'sh: claude: not found'))
      .toThrow(/parseable JSON[\s\S]*command not found[\s\S]*claude: not found/);
  });
});

describe('loadedContextTokens — the measured quantity, taken from the CLI, never estimated', () => {
  it('counts fresh input PLUS both cache halves, because cache reads are still context the model was given', () => {
    expect(loadedContextTokens({
      input_tokens: 2, cache_creation_input_tokens: 2061, cache_read_input_tokens: 3289, output_tokens: 4,
    })).toBe(5352);
  });

  it('ignores output tokens — they are the answer, not the context', () => {
    expect(loadedContextTokens({ input_tokens: 10, output_tokens: 9999 })).toBe(10);
  });

  it('is total over a missing or partial usage block', () => {
    expect(loadedContextTokens()).toBe(0);
    expect(loadedContextTokens({})).toBe(0);
    expect(loadedContextTokens({ input_tokens: 'nope' })).toBe(0);
  });
});

describe('judgeSpawn — the one function a `judge` step calls, exercised over an injected spawn', () => {
  /** A fake `child_process.spawn` that replays a canned stdout and records what it was asked to run. */
  function fakeSpawn(stdout, { code = 0, stderr = '' } = {}) {
    const seen = { cli: null, argv: null, opts: null, stdin: '' };
    const fn = (cli, argv, opts) => {
      seen.cli = cli; seen.argv = argv; seen.opts = opts;
      const handlers = {};
      const child = {
        stdout: { on: (e, cb) => { if (e === 'data') setTimeout(() => cb(stdout), 0); } },
        stderr: { on: (e, cb) => { if (e === 'data' && stderr) setTimeout(() => cb(stderr), 0); } },
        stdin: { on: () => {}, end: (d) => { seen.stdin = d; } },
        on: (e, cb) => { handlers[e] = cb; if (e === 'close') setTimeout(() => cb(code), 1); },
        kill: () => {},
      };
      return child;
    };
    return { fn, seen };
  }

  const okJson = JSON.stringify({
    is_error: false,
    stop_reason: 'tool_use',
    session_id: 'aaaaaaaa-bbbb-8ccc-9ddd-eeeeeeeeeeee',
    total_cost_usd: 0.02,
    duration_ms: 1900,
    num_turns: 1,
    usage: { input_tokens: 5, cache_creation_input_tokens: 100, cache_read_input_tokens: 900 },
    structured_output: { verdict: 'accept', findings: [] },
  });

  it('runs the CLI with exactly the pure function\'s argv, and writes the judged input to STDIN', async () => {
    const { fn, seen } = fakeSpawn(okJson);
    const r = await judgeSpawn({
      mandate: 'You are the rigor juror.',
      input: 'THE-DIFF-SENTINEL',
      shape: SHAPE,
      model: 'opus',
      effort: 'high',
      budget: 0.75,
      runId: 'run-7',
      lens: 'rigor',
      spawnFn: fn,
    });
    expect(seen.cli).toBe('claude');
    expect(seen.argv).toEqual(buildJudgeArgv({
      mandate: 'You are the rigor juror.', shape: SHAPE, model: 'opus', effort: 'high', budget: 0.75,
      sessionId: deriveSessionId(sessionSeed(['run-7', 'rigor'])),
    }));
    expect(seen.stdin).toBe('THE-DIFF-SENTINEL');
    expect(seen.argv.join('')).not.toContain('THE-DIFF-SENTINEL');
    expect(r.value).toEqual({ verdict: 'accept', findings: [] });
  });

  it('returns the spawned session id and the loaded-context total alongside the answer', async () => {
    const { fn } = fakeSpawn(okJson);
    const r = await judgeSpawn({ mandate: 'm', input: 'i', shape: SHAPE, runId: 'run-7', lens: 'care', spawnFn: fn });
    expect(r.sessionId).toBe('aaaaaaaa-bbbb-8ccc-9ddd-eeeeeeeeeeee');
    expect(r.loadedContextTokens).toBe(1005);
    expect(r.costUsd).toBe(0.02);
    expect(typeof r.wallMs).toBe('number');
  });

  it('derives the session id from runId+lens, so the panel\'s jurors are distinguishable actors', async () => {
    const a = fakeSpawn(okJson);
    const b = fakeSpawn(okJson);
    await judgeSpawn({ mandate: 'm', input: 'i', shape: SHAPE, runId: 'run-7', lens: 'rigor', spawnFn: a.fn });
    await judgeSpawn({ mandate: 'm', input: 'i', shape: SHAPE, runId: 'run-7', lens: 'care', spawnFn: b.fn });
    const sidOf = (seen) => seen.argv[seen.argv.indexOf('--session-id') + 1];
    expect(sidOf(a.seen)).not.toBe(sidOf(b.seen));
    expect(sidOf(a.seen)).toBe(deriveSessionId(sessionSeed(['run-7', 'rigor'])));
  });

  it('honours an explicit sessionId over the derivation', async () => {
    const { fn, seen } = fakeSpawn(okJson);
    await judgeSpawn({ mandate: 'm', input: 'i', shape: SHAPE, sessionId: SID, spawnFn: fn });
    expect(seen.argv[seen.argv.indexOf('--session-id') + 1]).toBe(SID);
  });

  it('a runId-only spawn and a lens-only spawn carrying the same string are DIFFERENT actors (#3058)', async () => {
    // The `filter(Boolean)` this replaced dropped the absent field before joining, so both of these derived
    // one id with no space anywhere in the input. Driven through the real `judgeSpawn`, not the encoder.
    const a = fakeSpawn(okJson);
    const b = fakeSpawn(okJson);
    await judgeSpawn({ mandate: 'm', input: 'i', shape: SHAPE, runId: 'same-string', spawnFn: a.fn });
    await judgeSpawn({ mandate: 'm', input: 'i', shape: SHAPE, lens: 'same-string', spawnFn: b.fn });
    const sidOf = (seen) => seen.argv[seen.argv.indexOf('--session-id') + 1];
    expect(sidOf(a.seen)).not.toBe(sidOf(b.seen));
    expect(sidOf(a.seen)).toBe(deriveSessionId(sessionSeed(['same-string', undefined])));
    expect(sidOf(b.seen)).toBe(deriveSessionId(sessionSeed([undefined, 'same-string'])));
  });

  it('a runId/lens pair that a space join would have merged stays two actors (#3058)', async () => {
    const a = fakeSpawn(okJson);
    const b = fakeSpawn(okJson);
    await judgeSpawn({ mandate: 'm', input: 'i', shape: SHAPE, runId: 'r 1', lens: 'lens', spawnFn: a.fn });
    await judgeSpawn({ mandate: 'm', input: 'i', shape: SHAPE, runId: 'r', lens: '1 lens', spawnFn: b.fn });
    const sidOf = (seen) => seen.argv[seen.argv.indexOf('--session-id') + 1];
    expect(sidOf(a.seen)).not.toBe(sidOf(b.seen));
  });

  it('an EMPTY lens and an ABSENT lens are different actors, so neither collapses onto the other', async () => {
    const a = fakeSpawn(okJson);
    const b = fakeSpawn(okJson);
    await judgeSpawn({ mandate: 'm', input: 'i', shape: SHAPE, runId: 'run-7', spawnFn: a.fn });
    await judgeSpawn({ mandate: 'm', input: 'i', shape: SHAPE, runId: 'run-7', lens: '', spawnFn: b.fn });
    const sidOf = (seen) => seen.argv[seen.argv.indexOf('--session-id') + 1];
    expect(sidOf(a.seen)).not.toBe(sidOf(b.seen));
  });

  it('still names a distinct actor when no runId or lens is supplied', async () => {
    const a = fakeSpawn(okJson);
    const b = fakeSpawn(okJson);
    await judgeSpawn({ mandate: 'm', input: 'i', shape: SHAPE, spawnFn: a.fn });
    await judgeSpawn({ mandate: 'm', input: 'i', shape: SHAPE, spawnFn: b.fn });
    const sidOf = (seen) => seen.argv[seen.argv.indexOf('--session-id') + 1];
    expect(sidOf(a.seen)).not.toBe(sidOf(b.seen));
  });

  it('passes cwd and env through to the spawn', async () => {
    const { fn, seen } = fakeSpawn(okJson);
    await judgeSpawn({ mandate: 'm', input: 'i', shape: SHAPE, sessionId: SID, cwd: '/tmp/juror', env: { A: '1' }, spawnFn: fn });
    expect(seen.opts.cwd).toBe('/tmp/juror');
    expect(seen.opts.env).toEqual({ A: '1' });
  });

  it('throws the juror\'s OWN failure text rather than a paraphrase', async () => {
    const { fn } = fakeSpawn(JSON.stringify({ is_error: true, result: 'Not logged in · Please run /login' }), { code: 1 });
    await expect(judgeSpawn({ mandate: 'm', input: 'i', shape: SHAPE, sessionId: SID, spawnFn: fn }))
      .rejects.toThrow('Not logged in · Please run /login');
  });

  it('refuses an empty input rather than spawning a juror with nothing to judge', async () => {
    let started = false;
    const spawnFn = () => { started = true; };
    await expect(judgeSpawn({ mandate: 'm', input: '   ', shape: SHAPE, sessionId: SID, spawnFn }))
      .rejects.toThrow(/input/);
    expect(started).toBe(false);
  });

  it('propagates a bad-argv refusal BEFORE spawning anything', async () => {
    let started = false;
    const spawnFn = () => { started = true; };
    await expect(judgeSpawn({ mandate: '', input: 'i', shape: SHAPE, sessionId: SID, spawnFn }))
      .rejects.toThrow(/mandate/);
    expect(started).toBe(false);
  });

  it('SIGKILLs a juror that outlives `timeoutMs` and rejects naming the budget it blew', async () => {
    // A juror that never closes: no `close` event ever fires, so the ONLY thing that can settle the promise
    // is the timeout path. No real `claude` is spawned — the seam is the injected `spawnFn`.
    let killedWith;
    let stdinClosed = false;
    const spawnFn = () => ({
      stdout: { on: () => {} },
      stderr: { on: () => {} },
      stdin: { on: () => {}, end: () => { stdinClosed = true; } },
      on: () => {},
      kill: (signal) => { killedWith = signal; },
    });
    await expect(judgeSpawn({ mandate: 'm', input: 'i', shape: SHAPE, sessionId: SID, timeoutMs: 5, spawnFn }))
      .rejects.toThrow('judge-spawn: the juror exceeded 5ms and was killed');
    // Killed, not merely abandoned — an orphaned `claude -p` would keep billing against the budget.
    expect(killedWith).toBe('SIGKILL');
    expect(stdinClosed).toBe(true);
  });

  it('survives a child whose `kill` throws — the juror is already gone, the timeout still rejects', async () => {
    const spawnFn = () => ({
      stdout: { on: () => {} },
      stderr: { on: () => {} },
      stdin: { on: () => {}, end: () => {} },
      on: () => {},
      kill: () => { throw new Error('ESRCH'); },
    });
    await expect(judgeSpawn({ mandate: 'm', input: 'i', shape: SHAPE, sessionId: SID, timeoutMs: 5, spawnFn }))
      .rejects.toThrow(/exceeded 5ms and was killed/);
  });

  it('reports a missing binary as a start failure naming the CLI', async () => {
    const spawnFn = () => { throw new Error('ENOENT'); };
    await expect(judgeSpawn({ mandate: 'm', input: 'i', shape: SHAPE, sessionId: SID, cli: 'nope', spawnFn }))
      .rejects.toThrow(/could not start `nope`/);
  });
});
