/**
 * @file scripts/__tests__/gated-push-wiring.test.mjs
 * @description Pins the gated-`pushIfGreen` wiring contract (#2073). Nothing in the lane/merge/close flow
 * pushed `main`, so `origin/main` silently drifted (185 commits behind local after one parallel batch). The
 * fix is ONE shared helper (`scripts/push-if-green.mjs`) called from BOTH the parallel integrator (Phase 4h)
 * AND the serial/close commit path (the batch SKILL close-out). These are source-string contract checks — a
 * workflow sandbox script + a skill markdown have no runtime we can exercise, so we pin the wiring the way the
 * repo pins other sandbox contracts (mirror-of-a-module pattern): assert the shared helper exists with its
 * ratified rules, and that both call sites reference it. If either call site drops the push, drift returns —
 * this test fails loudly rather than letting GitHub silently freeze again.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

describe('gated pushIfGreen helper (#2073) — the shared publish primitive', () => {
  const src = read('scripts/push-if-green.mjs');

  it('exists and documents its #2073 ratified rules', () => {
    expect(src).toContain('#2073');
    // green-gate precondition + fast-forward-only + per-repo across the constellation
    expect(src.toLowerCase()).toMatch(/fast[- ]forward/);
    expect(src).toMatch(/--assume-green/);
  });

  it('NEVER force-pushes (ff-only; a non-ff aborts, never --force)', () => {
    // No git-push invocation may pass --force / --force-with-lease / +refspec: assert every push call is a
    // plain refspec. (The strings "--force" in this file are all PROSE that REFUSES a force push.)
    const pushCalls = src.match(/git\(\[\s*['"]push['"][\s\S]*?\]\)/g) || [];
    expect(pushCalls.length).toBeGreaterThan(0);
    for (const call of pushCalls) {
      expect(call).not.toMatch(/--force/);
      expect(call).not.toMatch(/force-with-lease/);
      expect(call).not.toMatch(/['"]\+/); // no "+branch:branch" force refspec
    }
    // ff is proven via merge-base --is-ancestor before pushing.
    expect(src).toContain('--is-ancestor');
  });

  it('only ever publishes the branch named main (or --branch) from that branch (never a lane ref)', () => {
    expect(src).toMatch(/wrong-branch/);
    expect(src).toMatch(/BRANCH\s*=/);
  });
});

describe('gated pushIfGreen wiring (#2073) — both call sites publish through the shared helper', () => {
  it('the parallel integrator calls push-if-green at close-out (Phase 4h), gated + ff-only', () => {
    const wf = read('.claude/skills/batch-backlog-items/parallel-execute.workflow.js');
    expect(wf).toContain('push-if-green.mjs');
    expect(wf).toContain('#2073');
    // impl-first/WE-last publish order reuses INTEGRATION_ORDER (WE carries the resolve → published last).
    expect(wf).toMatch(/INTEGRATION_ORDER\.filter/);
    // the integrator already gated each merged tree → the documented --assume-green path.
    expect(wf).toContain('--assume-green');
  });

  it('the serial /batch close-out publishes main through the same helper (not a bespoke push)', () => {
    const skill = read('.claude/skills/batch-backlog-items/SKILL.md');
    expect(skill).toContain('push-if-green.mjs');
    expect(skill).toContain('#2073');
    // the pre-2026-06-29 "never git push" line is generalized into a gated push, not left as-is.
    expect(skill.toLowerCase()).toContain('pushifgreen');
  });
});
