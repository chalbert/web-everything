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
import { planDrain, buildPrLandArgs, planWatch } from '../lane-drain.mjs';
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

describe('lane-drain planWatch (#2173 — the outer monitor loop)', () => {
  const man = (item, opts = {}) => buildManifest({ item, repos: [{ repo: 'we', ref: `lane/${item}-we` }], ...opts });

  it('marks a queued couple with no blockers READY, ordered by num', () => {
    const q = queued(2175, 2173);
    const plan = planWatch(q, { '2173': man(2173), '2175': man(2175) });
    expect(plan.ready).toEqual(['2173', '2175']); // sorted
    expect(plan.deferred).toEqual([]);
    expect(plan.invalid).toEqual([]);
    expect(plan.unresolvable).toEqual([]);
  });

  it('DEFERS a couple whose cross-item blockedBy is still queued (chain head first)', () => {
    const q = queued(2173, 2174); // both queued; 2174 blockedBy 2173 (unlanded)
    const plan = planWatch(q, { '2173': man(2173), '2174': man(2174, { blockedBy: [2173] }) });
    expect(plan.ready).toEqual(['2173']);
    expect(plan.deferred).toEqual([{ num: '2174', waitOn: ['2173'] }]);
  });

  it('once the blocker has left the queue (landed), the dependent becomes READY (the cascade across passes)', () => {
    const q = queued(2174); // 2173 already drained → off the queue
    const plan = planWatch(q, { '2174': man(2174, { blockedBy: [2173] }) });
    expect(plan.ready).toEqual(['2174']);
    expect(plan.deferred).toEqual([]);
  });

  it('reports a queued item whose manifest could not be read (null) as unresolvable, never drained', () => {
    const q = queued(2173, 2175);
    const plan = planWatch(q, { '2173': man(2173), '2175': null });
    expect(plan.ready).toEqual(['2173']);
    expect(plan.unresolvable).toEqual(['2175']);
  });

  it('reports a queued item with an INVALID manifest as invalid (skip + report), never ready', () => {
    const q = queued(2173);
    // no WE repo / no resolve carrier → validateManifest fails
    const bad = buildManifest({ item: 2173, repos: [{ repo: 'frontierui', ref: 'lane/x', carriesResolve: false }] });
    const plan = planWatch(q, { '2173': bad });
    expect(plan.ready).toEqual([]);
    expect(plan.invalid.map((i) => i.num)).toEqual(['2173']);
    expect(plan.invalid[0].errors.length).toBeGreaterThan(0);
  });

  it('an empty queue plans nothing (idempotent no-op)', () => {
    const plan = planWatch(queued(), {});
    expect(plan).toEqual({ ready: [], deferred: [], invalid: [], unresolvable: [] });
  });
});

describe('lane-drain watch/drain contract guard (source-level)', () => {
  const src = readFileSync(resolve(process.cwd(), 'scripts/lane-drain.mjs'), 'utf8');
  it('drains ready couples by spawning drain-one — never re-implementing the land', () => {
    expect(src).toMatch(/'drain-one'/);
    expect(src).toMatch(/drainOneCouple/);
  });
  it('regenerates the WE derived-artifact set once (the Phase 4c relocation)', () => {
    expect(src).toMatch(/gen:inventory/);
    expect(src).toMatch(/gen:reference-index/);
  });
  it('guards against the land-but-unqueue-fail hot loop (never re-drains an attempted couple)', () => {
    expect(src).toMatch(/attempted/);
    expect(src).toMatch(/attempted\.has\(/);
  });
  it('exit status reflects whether the queue actually drained (not a stuck-queue exit-0)', () => {
    expect(src).toMatch(/fullyDrained/);
    expect(src).toMatch(/DRY_RUN \|\| fullyDrained \? 0 : 2/);
  });
});
