/**
 * @file scripts/__tests__/gated-push-wiring.test.mjs
 * @description Pins the gated-`pushIfGreen` wiring contract (#2073). Nothing in the lane/merge/close flow
 * pushed `main`, so `origin/main` silently drifted (185 commits behind local after one parallel batch). The
 * fix is ONE shared helper (`scripts/push-if-green.mjs`) that every publish site calls. Under #2183/#2185 the
 * publish sites are: the DRAIN (`scripts/lane-drain.mjs`, which advances main when it lands a couple) AND the
 * serial/close commit path (the batch SKILL close-out, until #2186 routes it through a lane→PR too). The
 * parallel `/workflow` producer is NO LONGER a publish site — it makes ZERO commits to main and opens
 * ready-to-merge PRs instead (the drain publishes). These are source-string contract checks — a workflow
 * sandbox script + a skill markdown have no runtime we can exercise, so we pin the wiring the way the repo
 * pins other sandbox contracts (mirror-of-a-module pattern): assert the shared helper exists with its ratified
 * rules, and that the live publish sites reference it. If a publish site drops the gated push, drift returns —
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

describe('gated pushIfGreen wiring (#2073) — every publish site publishes through the shared helper', () => {
  it('the parallel /workflow producer does NOT publish main (#2183/#2185) — it opens ready-to-merge PRs; the drain publishes via push-if-green', () => {
    // #2183 F2/direction-1: the producer makes ZERO commits to main and never integrates inline, so it must
    // NOT reference the main-publish helper at all. Its "publish" is opening a ready-to-merge PR via pr-land.
    const wf = read('.claude/skills/batch-backlog-items/parallel-execute.workflow.js');
    expect(wf).not.toContain('push-if-green.mjs');
    expect(wf).toContain('pr-land.mjs');
    expect(wf).toContain('ready-to-merge');
    // The publish site MOVED to the drain: main advances only when the drain lands a couple — gated + ff-only
    // through the SAME shared helper, so the #2073 anti-drift guarantee still holds at the (new) publish site.
    const drain = read('scripts/lane-drain.mjs');
    expect(drain).toContain('push-if-green.mjs');
    expect(drain).toContain('--assume-green');
  });

  it('the serial /batch close-out opens ready-to-merge PRs and does NOT publish main (#2190) — the drain publishes', () => {
    // #2190: serial /batch lands each item as a ready-to-merge PR from its lane clone (via pr-land + label),
    // so it is NO LONGER a publish site — the close-out must not push main through push-if-green.
    const skill = read('.claude/skills/batch-backlog-items/SKILL.md');
    expect(skill).toContain('ready-to-merge');
    expect(skill).toContain('pr-land');
    // The SOLE publish site is the drain — gated + ff-only through the shared helper (the #2073 guarantee).
    const drain = read('scripts/lane-drain.mjs');
    expect(drain).toContain('push-if-green.mjs');
    expect(drain).toContain('#2073');
  });
});
