/**
 * @file scripts/lib/__tests__/verify-lane-gate.test.mjs
 * @description Executable proof for #3372: `verify-lane.mjs`'s default gate must invoke the diff-driven test
 *   selection (#2681) instead of an unconditional `npm run test:unit`, AND the fail-safe direction must not
 *   regress — a diff under a sensitive or otherwise-unlisted surface with no allow-list entry must still run the
 *   FULL suite. Tests the pure decision core (`resolveDefaultGate`) directly with an injected `runGit`, mirroring
 *   `scripts/readiness/__tests__/test-selection.test.mjs`'s own convention (no real git/npm/vitest IO — fast,
 *   hermetic, and immune to whatever the *current* diff of the repo happens to be). A source-wiring guard at the
 *   bottom pins that `verify-lane.mjs` actually calls this function for its default gate, so the decision core
 *   being correct can never silently drift from what ships.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { resolveDefaultGate, FULL_GATE } from '../verify-lane-gate.mjs';

/** A synthetic git runner: `merge-base` resolves to a fixed sha; `diff --name-only` returns the configured
 *  changed-file list. Mirrors test-selection.test.mjs's injectable-runGit convention — no real git process. */
function fakeGit(changedFiles) {
  return (args) => {
    if (args[0] === 'merge-base') return 'deadbeef';
    if (args[0] === 'diff') return changedFiles.join('\n');
    throw new Error(`unexpected git invocation in test: ${args.join(' ')}`);
  };
}

describe('resolveDefaultGate (#3372) — verify-lane default gate wired to diff-driven selection', () => {
  it('a shrinkable diff (docs only) invokes `vitest related`, never a bare `npm run test:unit`', () => {
    const { command, decision } = resolveDefaultGate({ runGit: fakeGit(['docs/readme.md']), env: {} });
    expect(decision.mode).toBe('shrink');
    expect(command).toContain('vitest related');
    expect(command).toContain("'docs/readme.md'");
    expect(command).not.toContain('npm run test:unit');
    expect(command).toContain('npm run check:standards'); // the repo health gate always still runs
  });

  it('FAIL-SAFE: a diff under a sensitive surface with no allow-list entry still runs the FULL suite', () => {
    // scripts/ is a blast-radius (gate-self) surface — exactly the shape #3372 warns must not regress.
    const { command, decision } = resolveDefaultGate({ runGit: fakeGit(['scripts/verify-lane.mjs']), env: {} });
    expect(decision.mode).toBe('full');
    expect(decision.humanRequired).toBe(true);
    expect(command).toBe(FULL_GATE);
    expect(command).toBe('npm run test:unit && npm run check:standards');
  });

  it('FAIL-SAFE: an unlisted surface (neither sensitive nor allow-listed) still runs the FULL suite (deny-by-default)', () => {
    const { command, decision } = resolveDefaultGate({ runGit: fakeGit(['src/components/widget.ts']), env: {} });
    expect(decision.mode).toBe('full');
    expect(command).toBe(FULL_GATE);
  });

  it('FAIL-SAFE: a mixed diff (one shrinkable + one sensitive file) still runs the FULL suite', () => {
    const { command, decision } = resolveDefaultGate({
      runGit: fakeGit(['docs/readme.md', 'package.json']),
      env: {},
    });
    expect(decision.mode).toBe('full');
    expect(command).toBe(FULL_GATE);
  });

  it('defaults the selection flag ON for its own decision even when the ambient env has not set it', () => {
    // verify-lane must not require the operator to separately export WE_DIFF_TEST_SELECTION for its own gate.
    const { decision } = resolveDefaultGate({ runGit: fakeGit(['research/topic.md']), env: {} });
    expect(decision.mode).toBe('shrink');
  });

  it('an explicit ambient opt-out (WE_DIFF_TEST_SELECTION=0) still runs the FULL suite', () => {
    const { command, decision } = resolveDefaultGate({
      runGit: fakeGit(['docs/readme.md']),
      env: { WE_DIFF_TEST_SELECTION: '0' },
    });
    expect(decision.mode).toBe('full');
    expect(command).toBe(FULL_GATE);
  });

  it('FAIL-SAFE: a git failure (no computable diff) falls back to the FULL suite, never silently shrinks', () => {
    const throwingGit = () => { throw new Error('no such ref'); };
    const { command, decision } = resolveDefaultGate({ runGit: throwingGit, env: {} });
    expect(decision.mode).toBe('full');
    expect(command).toBe(FULL_GATE);
  });
});

describe('verify-lane.mjs source wiring — the default gate actually calls resolveDefaultGate', () => {
  it('imports resolveDefaultGate from ./lib/verify-lane-gate.mjs and uses it to build the default GATE', () => {
    const src = readFileSync(resolve(process.cwd(), 'scripts/verify-lane.mjs'), 'utf8');
    expect(src).toMatch(/from ['"]\.\/lib\/verify-lane-gate\.mjs['"]/);
    expect(src).toMatch(/resolveDefaultGate\(/);
    // The literal bare default must be GONE — only the fallback constant inside verify-lane-gate.mjs keeps it.
    expect(src).not.toMatch(/const GATE = typeof flags\.gate === 'string' \? flags\.gate : 'npm run test:unit/);
  });
});
