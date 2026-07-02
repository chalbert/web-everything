/**
 * @file scripts/__tests__/lane-drain.test.mjs
 * @description Unit proof of the pure planner in `scripts/lane-drain.mjs` — the deferred merge-queue drain's
 *   CORE slice (drain-one-couple, #2172 under #2162). `planDrain` decides ORDER (impl-first/WE-last),
 *   READINESS (cross-item blockedBy still queued → defer), and the resolve carrier from a manifest + the
 *   queued token; `buildPrLandArgs` builds the pr-land invocation. The git/pr-land driver is the I/O boundary.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { planDrain, buildPrLandArgs } from '../lane-drain.mjs';
import { buildManifest } from '../readiness/lane-manifest.mjs';

const queued = (...nums) => ({ queued: nums.map((n) => ({ num: String(n).padStart(3, '0'), at: null })) });

describe('lane-drain planDrain (#2172 / #2162)', () => {
  it('orders repos impl-first / WE-last and marks WE the resolve carrier', () => {
    const m = buildManifest({ item: 2153, repos: [
      { repo: 'we', ref: 'lane/2153-we' },
      { repo: 'frontierui', ref: 'lane/2153-fui' },
    ] });
    const plan = planDrain(m, queued(2153));
    expect(plan.ok).toBe(true);
    expect(plan.ready).toBe(true);
    expect(plan.steps.map((s) => s.repo)).toEqual(['frontierui', 'we']); // impl first, WE last
    expect(plan.steps.map((s) => s.ref)).toEqual(['lane/2153-fui', 'lane/2153-we']);
    expect(plan.resolveRepo).toBe('we');
    expect(plan.steps.find((s) => s.repo === 'we').carriesResolve).toBe(true);
  });

  it('a WE-only couple plans a single WE step', () => {
    const m = buildManifest({ item: 2172, repos: [{ repo: 'we', ref: 'lane/2172-we' }] });
    const plan = planDrain(m, queued(2172));
    expect(plan.ok).toBe(true);
    expect(plan.ready).toBe(true);
    expect(plan.steps).toEqual([{ repo: 'we', ref: 'lane/2172-we', carriesResolve: true }]);
  });

  it('refuses to drain an item that is NOT queued (nothing ready-to-merge)', () => {
    const m = buildManifest({ item: 2153, repos: [{ repo: 'we', ref: 'lane/2153-we' }] });
    const plan = planDrain(m, queued(9999)); // 2153 not in the queue
    expect(plan.ok).toBe(false);
    expect(plan.ready).toBe(false);
    expect(plan.errors.join(' ')).toMatch(/not queued/);
  });

  it('refuses an INVALID manifest (no WE / no resolve carrier) → ok:false with errors', () => {
    const m = buildManifest({ item: 2153, repos: [{ repo: 'frontierui', ref: 'lane/x', carriesResolve: false }] });
    const plan = planDrain(m, queued(2153));
    expect(plan.ok).toBe(false);
    expect(plan.errors.length).toBeGreaterThan(0);
  });

  it('DEFERS a couple whose cross-item blockedBy dependency is still queued (unlanded)', () => {
    const m = buildManifest({ item: 2162, repos: [{ repo: 'we', ref: 'lane/2162-we' }], blockedBy: [2172] });
    const plan = planDrain(m, queued(2162, 2172)); // 2172 still queued → not landed yet
    expect(plan.ok).toBe(true);
    expect(plan.ready).toBe(false);
    expect(plan.waitOn).toEqual(['2172']);
  });

  it('is READY once the blockedBy dependency has left the queue (landed)', () => {
    const m = buildManifest({ item: 2162, repos: [{ repo: 'we', ref: 'lane/2162-we' }], blockedBy: [2172] });
    const plan = planDrain(m, queued(2162)); // 2172 no longer queued → landed
    expect(plan.ready).toBe(true);
    expect(plan.waitOn).toEqual([]);
  });
});

describe('lane-drain buildPrLandArgs (#2172)', () => {
  it('builds a WE (primary) pr-land call — no --repo, --json by default', () => {
    expect(buildPrLandArgs({ ref: 'lane/2172-we' }))
      .toEqual(['scripts/pr-land.mjs', '--ref=lane/2172-we', '--json']);
  });
  it('adds --repo for a non-primary repo and forwards a body file + dry-run', () => {
    const args = buildPrLandArgs({ ref: 'lane/x-fui', repoPath: '/home/u/workspace/frontierui', bodyFile: '/tmp/b.md', dryRun: true });
    expect(args).toContain('--repo=/home/u/workspace/frontierui');
    expect(args).toContain('--body-file=/tmp/b.md');
    expect(args).toContain('--dry-run');
    expect(args[0]).toBe('scripts/pr-land.mjs');
  });
});

describe('lane-drain contract guard (source-level)', () => {
  const src = readFileSync(resolve(process.cwd(), 'scripts/lane-drain.mjs'), 'utf8');
  it('re-uses pr-land as the transport — never re-implements the merge (no direct git merge/push of main)', () => {
    expect(src).toMatch(/pr-land\.mjs/);
    expect(src).not.toMatch(/'merge'|'--no-ff'|push.*main/);
  });
  it('clears the queued marker only via backlog.mjs unqueue (the single clear point)', () => {
    expect(src).toMatch(/'unqueue'/);
  });
});
