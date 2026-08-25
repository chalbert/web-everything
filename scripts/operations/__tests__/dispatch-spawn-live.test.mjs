/**
 * @file dispatch-spawn-live.test.mjs — the first test that STARTS A PROCESS to dispatch an agent.
 *
 * `we:scripts/operations/__tests__/dispatch-lane-integration.test.mjs` states the gap this closes, quoting
 * the sink's own docblock: *"NOT YET PROVEN LIVE. No test starts a `claude` process."* Everything about the
 * one effect the delivery loop exists to perform was asserted against stubs.
 *
 * WHAT A STUB COULD NOT ANSWER, and it is not the spelling of the argv — `buildAgentArgv` is pure, exported
 * and already asserted. It is whether a CLI ACCEPTS that spelling. `dispatch-lane-io.mjs`'s own comment
 * records the doubt: the prompt's position was reasoned about and never checked, *"untested against the real
 * CLI, and a wrong bet turns into a dispatch with a mangled prompt"*. A shim that parses argv the way a
 * commander-style CLI does converts that bet into an assertion.
 *
 * These tests run the REAL `defaultSpawnAgent` through the REAL `execFileSync` with `PATH` pointed at the
 * fake — no injected spawner. Overriding the high seam would replace the code under test; this exercises it,
 * the same reasoning the sink gives for separating `exec` from `runNode`.
 *
 * COSTS NOTHING. No model runs, no token is spent. This proves plumbing — argv accepted, `--bg` returns
 * rather than blocks, the pinned session id is the id the observer later finds, a failure surfaces as one.
 * Whether the agent then does GOOD work is a different test with a different budget; this is the harness
 * that makes that one a change of binding rather than a new build.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { withFakeClaude } from './helpers/fake-claude.mjs';
import { buildAgentArgv, defaultSpawnAgent } from '../dispatch-lane-io.mjs';

/** Spawn through the REAL default path, with the fake first on PATH. */
function spawnVia(fake, argv) {
  return defaultSpawnAgent(argv, { env: { ...process.env, ...fake.env } });
}

let fake = null;
afterEach(() => { if (fake) fake.cleanup(); fake = null; });

describe('dispatching an agent, against a real process', () => {
  it('the argv the dispatcher builds is ACCEPTED by a CLI that parses like the real one', () => {
    fake = withFakeClaude();
    const argv = buildAgentArgv({
      sessionId: '11111111-2222-3333-4444-555555555555',
      payload: { num: '4242', sessionSlug: 'conveyor-4242', prompt: '# Deliver item 4242\n\nDo the thing.' },
    });

    expect(() => spawnVia(fake, argv)).not.toThrow();

    const seen = fake.lastArgv();
    expect(seen).toContain('--bg');
    expect(seen[seen.indexOf('--session-id') + 1]).toBe('11111111-2222-3333-4444-555555555555');
    expect(seen[seen.indexOf('-n') + 1]).toBe('conveyor-4242');
    // The prompt survives as the trailing operand rather than being eaten as a flag — the thing the sink's
    // own comment says was never checked against a real parser.
    expect(seen[seen.length - 1]).toBe('# Deliver item 4242\n\nDo the thing.');
  });

  it('pins the handle the observer will later look for — the spawn-to-observe round trip', () => {
    fake = withFakeClaude();
    const sessionId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    spawnVia(fake, buildAgentArgv({
      sessionId,
      payload: { num: '77', sessionSlug: 'conveyor-77', prompt: '# brief' },
    }));

    // The observer's read, run as its own process exactly as production does it.
    const listing = JSON.parse(execFileSync('claude', ['agents', '--json'], {
      encoding: 'utf8', env: { ...process.env, ...fake.env },
    }));

    // Both ends of the chain were previously modelled. This is the one assertion that ties them: the id the
    // dispatcher pinned is the id the liveness listing reports back.
    expect(listing.map((s) => s.sessionId)).toContain(sessionId);
    expect(listing.find((s) => s.sessionId === sessionId).name).toBe('conveyor-77');
  });

  it('a brief beginning with `-` is refused BEFORE any process starts', () => {
    fake = withFakeClaude();
    expect(() => buildAgentArgv({
      sessionId: 'x', payload: { num: '1', prompt: '--help me' },
    })).toThrow(/begins with/);
    // The refusal is worth having only because the alternative is real: a leading dash IS read as a flag.
    expect(fake.calls()).toHaveLength(0);
  });

  it('proves the refusal is not decorative — an unguarded dash really is parsed as a flag', () => {
    fake = withFakeClaude();
    // Hand-built argv, bypassing the guard, to demonstrate what it prevents.
    expect(() => spawnVia(fake, ['--bg', '--session-id', 'z', '-n', 'n', '--not-a-real-flag'])).toThrow();
    const last = fake.calls().at(-1);
    expect(last.argv).toContain('--not-a-real-flag');
  });

  it('a spawn failure surfaces as a throw rather than a silent non-dispatch', () => {
    fake = withFakeClaude();
    const argv = buildAgentArgv({ sessionId: 'q', payload: { num: '9', prompt: '# brief' } });
    expect(() => defaultSpawnAgent(argv, {
      env: { ...process.env, ...fake.env, FAKE_CLAUDE_FAIL: '1' },
    })).toThrow();
  });

  it('`--bg` returns instead of blocking — the property the whole dispatch model rests on', () => {
    fake = withFakeClaude();
    const started = Date.now();
    spawnVia(fake, buildAgentArgv({ sessionId: 'r', payload: { num: '5', prompt: '# brief' } }));
    // Generous bound: the point is that it RETURNS, not that it is fast. A blocking spawn would hit the
    // sink's own timeout instead, which is how a wedged dispatcher would present.
    expect(Date.now() - started).toBeLessThan(10_000);
  });
});
