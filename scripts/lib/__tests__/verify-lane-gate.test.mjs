/**
 * @file scripts/lib/__tests__/verify-lane-gate.test.mjs
 * @description Executable proof for #3372 + #3395: `verify-lane.mjs`'s default gate must invoke the diff-driven
 *   test selection (#2681) instead of an unconditional `npm run test:unit`, AND scope its check:standards half to
 *   `--local --files=<changed>` per #1937 whenever the changed set touches neither `backlog/` nor a gate-self/
 *   policy-core path (#3395) — AND the fail-safe direction must not regress for either half. Tests the pure
 *   decision core (`resolveDefaultGate`/`canScopeCheckStandards`) directly with an injected `runGit`, mirroring
 *   `scripts/readiness/__tests__/test-selection.test.mjs`'s own convention (no real git/npm/vitest IO — fast,
 *   hermetic, and immune to whatever the *current* diff of the repo happens to be). A source-wiring guard at the
 *   bottom pins that `verify-lane.mjs` actually calls this function for its default gate, so the decision core
 *   being correct can never silently drift from what ships.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { resolveDefaultGate, canScopeCheckStandards, FULL_GATE } from '../verify-lane-gate.mjs';

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
  it('a shrinkable diff (docs only) invokes `vitest related` AND scopes check:standards (#1937)', () => {
    const { command, decision } = resolveDefaultGate({ runGit: fakeGit(['docs/readme.md']), env: {} });
    expect(decision.mode).toBe('shrink');
    expect(command).toContain('vitest related');
    expect(command).toContain("'docs/readme.md'");
    expect(command).not.toContain('npm run test:unit');
    expect(command).toContain("npm run check:standards -- --local --files='docs/readme.md'");
  });

  it('FAIL-SAFE (vitest half only): a blast-radius surface with no allow-list entry still runs `npm run test:unit`, but check:standards SCOPES — it is not on the gate-self/policy-core list (#3395)', () => {
    // scripts/verify-lane.mjs is a blast-radius (broad `scripts/`) surface for the VITEST shrink's module-graph
    // soundness concern, but it is not in gate-config.mjs's narrow policy-core roster — so per #1937 the
    // check:standards half, whose --local --files= mode never skips a check on a file IN the given set, may
    // still scope to it.
    const { command, decision } = resolveDefaultGate({ runGit: fakeGit(['scripts/verify-lane.mjs']), env: {} });
    expect(decision.mode).toBe('full');
    expect(decision.humanRequired).toBe(true);
    expect(command).toBe("npm run test:unit && npm run check:standards -- --local --files='scripts/verify-lane.mjs'");
    expect(command).not.toBe(FULL_GATE);
  });

  it('FAIL-SAFE (vitest half only): an unlisted surface (neither sensitive nor allow-listed) still runs `npm run test:unit`, but check:standards SCOPES (deny-by-default only gates the vitest half)', () => {
    const { command, decision } = resolveDefaultGate({ runGit: fakeGit(['src/components/widget.ts']), env: {} });
    expect(decision.mode).toBe('full');
    expect(command).toBe("npm run test:unit && npm run check:standards -- --local --files='src/components/widget.ts'");
  });

  it('a mixed diff (one shrinkable + one supply-chain file) runs `npm run test:unit` in full, but check:standards still SCOPES to both — neither is `backlog/` nor gate-self/policy-core', () => {
    const { command, decision } = resolveDefaultGate({
      runGit: fakeGit(['docs/readme.md', 'package.json']),
      env: {},
    });
    expect(decision.mode).toBe('full'); // package.json is supply-chain-sensitive for the vitest shrink
    expect(command).toBe("npm run test:unit && npm run check:standards -- --local --files='docs/readme.md,package.json'");
  });

  it('FAIL-SAFE (both halves): a diff touching `backlog/` keeps check:standards unscoped — the stranded-hash false-red surface #1937/#3395 routes around (own diff, extra margin)', () => {
    const { command, decision } = resolveDefaultGate({ runGit: fakeGit(['backlog/100-example.md']), env: {} });
    expect(canScopeCheckStandards(decision.changedFiles)).toBe(false);
    expect(command).toBe(FULL_GATE);
  });

  it('FAIL-SAFE (both halves): a diff touching a gate-self/policy-core path keeps check:standards unscoped — the gate must see the unscoped signal on a change to itself', () => {
    // review-escalation.mjs is `policy` tier in gate-config.mjs's TRUST_CHAIN — isGateSelfPath/isPolicyCorePath.
    const { command, decision } = resolveDefaultGate({
      runGit: fakeGit(['scripts/lib/review-escalation.mjs']),
      env: {},
    });
    expect(canScopeCheckStandards(decision.changedFiles)).toBe(false);
    expect(command).toBe(FULL_GATE);
  });

  it('defaults the selection flag ON for its own decision even when the ambient env has not set it', () => {
    // verify-lane must not require the operator to separately export WE_DIFF_TEST_SELECTION for its own gate.
    const { decision } = resolveDefaultGate({ runGit: fakeGit(['research/topic.md']), env: {} });
    expect(decision.mode).toBe('shrink');
  });

  it('an explicit ambient opt-out (WE_DIFF_TEST_SELECTION=0) still runs `npm run test:unit` in full, but check:standards still SCOPES — #1937 scoping is independent of the not-yet-defaulted vitest-selection flag', () => {
    const { command, decision } = resolveDefaultGate({
      runGit: fakeGit(['docs/readme.md']),
      env: { WE_DIFF_TEST_SELECTION: '0' },
    });
    expect(decision.mode).toBe('full');
    expect(command).toBe("npm run test:unit && npm run check:standards -- --local --files='docs/readme.md'");
  });

  it('FAIL-SAFE (both halves): a git failure (no computable diff) falls back to the FULL suite, never silently shrinks or scopes', () => {
    const throwingGit = () => { throw new Error('no such ref'); };
    const { command, decision } = resolveDefaultGate({ runGit: throwingGit, env: {} });
    expect(decision.mode).toBe('full');
    expect(decision.changedFiles).toBe(null);
    expect(command).toBe(FULL_GATE);
  });

  it('FAIL-SAFE (both halves): an empty changed set falls back to the FULL suite, never scopes on nothing', () => {
    const { command, decision } = resolveDefaultGate({ runGit: fakeGit([]), env: {} });
    expect(decision.mode).toBe('full');
    expect(decision.changedFiles).toEqual([]);
    expect(command).toBe(FULL_GATE);
  });
});

describe('canScopeCheckStandards (#3395) — the check:standards-scoping predicate in isolation', () => {
  it('is false for null (unreadable/unknown diff)', () => {
    expect(canScopeCheckStandards(null)).toBe(false);
  });

  it('is false for an empty changed set', () => {
    expect(canScopeCheckStandards([])).toBe(false);
  });

  it('is false when any changed file is under backlog/', () => {
    expect(canScopeCheckStandards(['docs/readme.md', 'backlog/100-example.md'])).toBe(false);
  });

  it('is false when any changed file is a gate-self/policy-core path', () => {
    expect(canScopeCheckStandards(['scripts/lib/review-escalation.mjs'])).toBe(false);
  });

  it('is true for a non-empty changed set touching neither surface, even a blast-radius `scripts/` path outside the policy-core roster', () => {
    expect(canScopeCheckStandards(['scripts/verify-lane.mjs', 'package.json'])).toBe(true);
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
