/**
 * @file scripts/__tests__/guard-bash-full-suite.test.mjs
 * @description xpnhz4o — the PreToolUse(Bash) guard denies a BARE full-suite unit run from an agent session,
 *   names the diff-selected gate instead, allows every targeted / selected spelling, and keeps a LOGGED
 *   `WE_FULL_SUITE_OK=1` escape. Pure `decide` cases plus one real hook invocation (stdin PreToolUse JSON →
 *   stdout decision) so the wiring, not only the predicate, is pinned.
 */
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { decide, isFullSuiteHead, fullSuiteEscapeUsed } from '../guard-bash.mjs';

const GUARD = resolve(process.cwd(), 'scripts/guard-bash.mjs');

describe('xpnhz4o — a bare full-suite run is denied, naming the selected gate', () => {
  it.each([
    'npm run test:unit',
    'npm test',
    'npm t',
    'npm run test:coverage',
    'yarn test',
    'pnpm test:unit',
    'npx vitest',
    'npx vitest run',
    'vitest run --reporter=dot',
    'npm run test:unit -- --shard=1/2',
    'node scripts/readiness/heavy-admission.mjs run -- vitest run',
    'cd /tmp/lane && npm run test:unit',
    'npm run test:unit && npm run check:standards',
    'npx vitest run .',
    'npx vitest run ./',
    'npm run test:unit -- .',
    'npx vitest run --exclude tests/slow/**',
    'npm run test:unit -- -t foo',
    'npx vitest --run',
  ])('denies %j', (cmd) => {
    const r = decide(cmd, {});
    expect(r).toMatch(/bare FULL-SUITE unit run/);
    expect(r).toContain('node scripts/verify-lane.mjs run');
    expect(r).toContain('WE_FULL_SUITE_OK=1');
  });

  it.each([
    'node scripts/verify-lane.mjs run',
    'node scripts/verify-lane.mjs',
    'npx vitest related scripts/a.mjs --run --passWithNoTests',
    'npx vitest run scripts/__tests__/a.test.mjs',
    'npm run test:unit -- scripts/__tests__/a.test.mjs',
    'node scripts/readiness/heavy-admission.mjs run -- npx vitest run a.test.mjs b.test.mjs c.test.mjs',
    'npx vitest --version',
    'npm run test:integration',
    'npm run check:standards',
    'echo "npm run test:unit"',
    'git commit -m "stop running npm run test:unit"',
    'WE_FULL_SUITE_OK=1 npm run test:unit',
  ])('allows %j', (cmd) => {
    expect(decide(cmd, {})).toBeNull();
  });

  it('the escape only counts as a LEADING assignment — a mention elsewhere never disarms the deny', () => {
    expect(decide('echo WE_FULL_SUITE_OK=1 && npm run test:unit', {})).toMatch(/bare FULL-SUITE/);
    expect(fullSuiteEscapeUsed('WE_FULL_SUITE_OK=1 npm run test:unit')).toBe(true);
    expect(fullSuiteEscapeUsed('WE_FULL_SUITE_OK=1 npx vitest run a.test.mjs')).toBe(false);
  });

  it('isFullSuiteHead sees through the heavy-admission wrapper but not past a file target', () => {
    expect(isFullSuiteHead('node scripts/readiness/heavy-admission.mjs run -- vitest run')).toBe(true);
    expect(isFullSuiteHead('node scripts/readiness/heavy-admission.mjs run -- vitest run x.test.mjs')).toBe(false);
  });

  it('the >2-file raw vitest message no longer steers to the (now denied) `npm run test:unit`', () => {
    const r = decide('npx vitest run a.test.mjs b.test.mjs c.test.mjs', {});
    expect(r).toContain('node scripts/verify-lane.mjs run');
    expect(r).not.toMatch(/instead: `npm run test:unit`/);
  });
});

describe('xpnhz4o — the real hook (stdin → stdout), deny and logged escape', () => {
  const run = (command, env = {}) => spawnSync('node', [GUARD], {
    input: JSON.stringify({ tool_name: 'Bash', tool_input: { command }, cwd: tmpdir() }),
    encoding: 'utf8',
    env: { ...process.env, WE_DISPATCH_KIND: '', ...env },
  });

  it('denies `npm run test:unit` in a session with no WE_DISPATCH_KIND (the live fixer shape)', () => {
    const out = run('npm run test:unit');
    const decision = JSON.parse(out.stdout).hookSpecificOutput;
    expect(decision.permissionDecision).toBe('deny');
    expect(decision.permissionDecisionReason).toContain('node scripts/verify-lane.mjs run');
  });

  it('allows the selected gate with no output at all', () => {
    expect(run('node scripts/verify-lane.mjs run').stdout).toBe('');
  });

  it('allows the escape and LOGS it (stderr + a JSON line in the escape log; stdout stays free of a deny)', () => {
    const log = join(mkdtempSync(join(tmpdir(), 'full-suite-escape-')), 'escape.log');
    const out = run('WE_FULL_SUITE_OK=1 npm run test:unit', { WE_FULL_SUITE_ESCAPE_LOG: log });
    expect(out.stdout).not.toMatch(/"deny"/);
    expect(out.stderr).toMatch(/ESCAPE — WE_FULL_SUITE_OK=1/);
    expect(existsSync(log)).toBe(true);
    expect(JSON.parse(readFileSync(log, 'utf8').trim()).command).toBe('WE_FULL_SUITE_OK=1 npm run test:unit');
  });
});
