/**
 * @file judge-spawn.integration.test.mjs — the ONE test that pays for a real `claude` process (#3028).
 *
 * WHAT IT IS FOR. `judge-spawn.test.mjs` proves the argv contract at zero cost, which is exactly why it
 * cannot notice the thing that actually breaks a juror: the CLI changing under it. A renamed flag, a
 * `--json-schema` that stops forcing a tool call, a `--session-id` format that stops being accepted — all
 * of those leave the unit suite green. This test is the canary for that class, and it is deliberately the
 * only one, because every run of it costs real money and real latency.
 *
 * WHY IT IS OPT-IN, WHICH IS A DEPARTURE FROM THIS DIRECTORY'S HABIT. The other subprocess tests here spawn
 * `git` and `node` — free, hermetic, offline. This one spawns a metered API client that REQUIRES an
 * interactive subscription login to be present on the machine. Left ungated it would (a) bill every
 * `npm run test:unit`, and (b) fail in any environment without that login, which is most CI. So it self-skips
 * unless `WE_JUDGE_SPAWN_LIVE=1` is set, and the skip is LOUD in the reporter rather than silent-green.
 *
 *   WE_JUDGE_SPAWN_LIVE=1 npx vitest run scripts/lib/__tests__/judge-spawn.integration.test.mjs
 *
 * The `--bare` trap is ALSO re-proved live here, because "it fails on a subscription" is precisely the kind
 * of claim that a comment preserves after it has stopped being true.
 */

import { describe, it, expect } from 'vitest';
import { spawn } from 'node:child_process';
import { judgeSpawn, buildJudgeArgv, deriveSessionId, JUDGE_CLI } from '../judge-spawn.mjs';

const LIVE = process.env.WE_JUDGE_SPAWN_LIVE === '1';

const SHAPE = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['accept', 'reject'] },
    finding: { type: 'string' },
  },
  required: ['verdict', 'finding'],
  additionalProperties: false,
};
const MANDATE = 'You are a code reviewer. Answer only through the provided schema. Be terse.';
const INPUT = 'Review this change: a function `half(n)` was added that returns `n / 0`. State one finding.';

// The cheapest model, a hard budget ceiling, and one call — this suite must stay cents, not dollars.
const CHEAP = { model: 'haiku', effort: 'low', budget: 0.25 };

describe.skipIf(!LIVE)('judgeSpawn against a REAL claude process (set WE_JUDGE_SPAWN_LIVE=1)', () => {
  it('returns a validated object matching the ENFORCED shape, and names the actor that judged', async () => {
    const sessionId = deriveSessionId(`it-${Date.now()}`);
    const r = await judgeSpawn({ mandate: MANDATE, input: INPUT, shape: SHAPE, sessionId, ...CHEAP });

    // The shape was forced, not requested: the answer arrives as a parsed object obeying the schema.
    expect(typeof r.value).toBe('object');
    expect(['accept', 'reject']).toContain(r.value.verdict);
    expect(typeof r.value.finding).toBe('string');
    expect(r.value.finding.length).toBeGreaterThan(0);
    // …with no key the schema did not allow.
    expect(Object.keys(r.value).sort()).toEqual(['finding', 'verdict']);

    // `--json-schema` is implemented as a FORCED TOOL CALL — this is the observable signature of that.
    expect(r.stopReason).toBe('tool_use');

    // The juror is a NAMED actor: the CLI honoured the session id we derived, so a run record can point at it.
    expect(r.sessionId).toBe(sessionId);

    // …and it is NOT this process's actor. A subagent inherits CLAUDE_CODE_SESSION_ID; a headless spawn does not.
    if (process.env.CLAUDE_CODE_SESSION_ID) {
      expect(r.sessionId).not.toBe(process.env.CLAUDE_CODE_SESSION_ID);
    }

    expect(r.loadedContextTokens).toBeGreaterThan(0);
    expect(r.wallMs).toBeGreaterThan(0);
    expect(r.costUsd).toBeLessThan(CHEAP.budget);
  }, 180_000);

  it('THE RECORDED TRAP still bites: `--bare` cannot see the subscription and fails "Not logged in"', async () => {
    // Built by hand on purpose — the helper cannot emit `--bare`, which is the property under test elsewhere.
    const argv = buildJudgeArgv({ mandate: MANDATE, shape: SHAPE, sessionId: deriveSessionId(`bare-${Date.now()}`), ...CHEAP })
      .filter((t) => t !== '--safe-mode');
    argv.splice(1, 0, '--bare');

    const out = await new Promise((resolve) => {
      const child = spawn(JUDGE_CLI, argv, { stdio: ['pipe', 'pipe', 'pipe'] });
      let s = '';
      child.stdout.on('data', (d) => { s += d; });
      child.on('error', () => resolve(''));
      child.on('close', () => resolve(s));
      child.stdin.on('error', () => {});
      child.stdin.end(INPUT);
    });

    // If this assertion ever fails, the trap has been fixed upstream and #3028's note should be retired —
    // that is a finding, not a flake. Skip rather than fail when an API key IS present: with one, `--bare`
    // is expected to work, and the trap is specifically about the SUBSCRIPTION path.
    if (process.env.ANTHROPIC_API_KEY) return;
    expect(out).toMatch(/Not logged in/);
  }, 180_000);
});

describe.skipIf(LIVE)('the live juror suite is opt-in', () => {
  it('is skipped unless WE_JUDGE_SPAWN_LIVE=1 — it bills a real API call and needs a subscription login', () => {
    expect(LIVE).toBe(false);
  });
});
