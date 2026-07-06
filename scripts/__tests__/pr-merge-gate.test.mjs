/**
 * @file scripts/__tests__/pr-merge-gate.test.mjs
 * @description Proof of the shared merge gate (`scripts/lib/pr-merge-gate.mjs`, #2290) — the ONE place a
 *   `gh pr merge` to `main` may originate. The transition invariant: only the drain may merge; every other
 *   route is rejected unless the documented `WE_MERGE_BREAK_GLASS=1` admin override is armed (which then emits
 *   a loud audit line). The gh shell is injected (never actually called).
 */
import { describe, it, expect, vi } from 'vitest';
import { mergePr, assertMayMerge, buildGateMergeArgs, mergeMethodFlag } from '../lib/pr-merge-gate.mjs';

// A capturing fake gh exec + a capturing stderr sink, so nothing shells out and the audit line is observable.
const fakeExec = () => { const calls = []; const exec = (cmd, args, opts) => { calls.push({ cmd, args, opts }); return { ok: true }; }; return { exec, calls }; };
const fakeLog = () => { const lines = []; return { log: { write: (s) => lines.push(s) }, lines }; };

describe('pr-merge-gate — buildGateMergeArgs (mirrors the merge-ai-prs inline call)', () => {
  it('builds `pr merge <n> --merge --delete-branch` with no --repo for the cwd repo', () => {
    expect(buildGateMergeArgs({ pr: 12 })).toEqual(['pr', 'merge', '12', '--merge', '--delete-branch']);
  });
  it('threads --repo <slug> when a repo is given (the multi-repo drain)', () => {
    expect(buildGateMergeArgs({ pr: 7, repo: 'chalbert/frontierui' }))
      .toEqual(['pr', 'merge', '7', '--repo', 'chalbert/frontierui', '--merge', '--delete-branch']);
  });
  it('honours the merge method flag and never emits --auto (the drain owns ordering)', () => {
    expect(mergeMethodFlag('squash')).toBe('--squash');
    expect(mergeMethodFlag('rebase')).toBe('--rebase');
    expect(mergeMethodFlag('merge')).toBe('--merge');
    expect(mergeMethodFlag(undefined)).toBe('--merge');
    expect(buildGateMergeArgs({ pr: 1, method: 'squash' })).not.toContain('--auto');
  });
});

describe('pr-merge-gate — mergePr caller invariant (#2290)', () => {
  it('caller "drain" PROCEEDS and shells the gh merge', () => {
    const { exec, calls } = fakeExec();
    const r = mergePr({ pr: 5, repo: null, method: 'merge', caller: 'drain', exec, env: {} });
    expect(calls).toHaveLength(1);
    expect(calls[0].cmd).toBe('gh');
    expect(calls[0].args).toEqual(['pr', 'merge', '5', '--merge', '--delete-branch']);
    expect(r).toEqual({ ok: true }); // returns whatever exec returns (the inline call's shape)
  });

  it('caller "pr-land" THROWS (no merge) with the enqueue-instead guidance', () => {
    const { exec, calls } = fakeExec();
    expect(() => mergePr({ pr: 5, caller: 'pr-land', exec, env: {} }))
      .toThrow(/only the drain may merge to main \(route pr-land is not the drain\)/);
    expect(calls).toHaveLength(0); // never shelled a merge
  });

  it('caller "lane-resume" THROWS (no merge)', () => {
    const { exec, calls } = fakeExec();
    expect(() => mergePr({ pr: 9, caller: 'lane-resume', exec, env: {} })).toThrow(/only the drain may merge to main/);
    expect(calls).toHaveLength(0);
  });

  it('WE_MERGE_BREAK_GLASS=1 lets a non-drain caller PROCEED and emits the loud audit line', () => {
    const { exec, calls } = fakeExec();
    const { log, lines } = fakeLog();
    const r = mergePr({ pr: 42, repo: 'chalbert/plateau-app', caller: 'pr-land', exec, env: { WE_MERGE_BREAK_GLASS: '1' }, log });
    expect(calls).toHaveLength(1); // the merge WAS shelled under break-glass
    expect(calls[0].args).toContain('--repo');
    expect(lines.join('')).toMatch(/BREAK-GLASS merge by route=pr-land pr=42 repo=chalbert\/plateau-app — off the normal path/);
    expect(r).toEqual({ ok: true });
  });
});

describe('pr-merge-gate — assertMayMerge (the no-gh write-to-main guard, e.g. fallback-git)', () => {
  it('drain passes silently (no audit line)', () => {
    const { log, lines } = fakeLog();
    expect(assertMayMerge({ caller: 'drain', env: {}, log })).toEqual({ breakGlass: false });
    expect(lines).toHaveLength(0);
  });
  it('a non-drain route throws without break-glass', () => {
    expect(() => assertMayMerge({ caller: 'pr-land', env: {} })).toThrow(/only the drain may merge to main/);
  });
  it('break-glass lets it through and audits', () => {
    const { log, lines } = fakeLog();
    const r = assertMayMerge({ caller: 'pr-land', pr: null, repo: null, env: { WE_MERGE_BREAK_GLASS: '1' }, log });
    expect(r).toEqual({ breakGlass: true });
    expect(lines.join('')).toMatch(/BREAK-GLASS merge by route=pr-land pr=null repo=cwd/);
  });
});
