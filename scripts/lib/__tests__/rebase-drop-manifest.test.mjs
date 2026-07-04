/**
 * @file rebase-drop-manifest.test.mjs — proof of the #2198 shared "rebase onto main, drop the transient
 *   `.lane-manifest.json`" plumbing used by the label lander (`scripts/merge-ai-prs.mjs`) and the resume
 *   finisher (`scripts/lane-resume.mjs land`). The git process calls are the I/O boundary (injected `run`);
 *   the merge-tree parse + the manifest-only-vs-real disposition + the plumbing SEQUENCE are decided here.
 */
import { describe, it, expect } from 'vitest';
import {
  LANE_MANIFEST,
  parseMergeTree,
  manifestConflictDisposition,
  rebaseDropManifest,
} from '../rebase-drop-manifest.mjs';

// A `git merge-tree --write-tree` conflict block: line 1 = tree OID, then `<mode> <oid> <stage>\t<path>`
// lines (one per unmerged stage), a blank line, then informational messages.
const conflictOut = (paths) => {
  const info = paths.flatMap((p) => [1, 2, 3].map((stage) => `100644 ${'a'.repeat(40)} ${stage}\t${p}`));
  return ['t'.repeat(40), ...info, '', 'Auto-merging …', `CONFLICT (content): Merge conflict in ${paths[0]}`].join('\n');
};

describe('parseMergeTree', () => {
  it('a clean merge (exit 0): tree OID, no conflicts', () => {
    const r = parseMergeTree('deadbeef'.padEnd(40, '0') + '\n', 0);
    expect(r.clean).toBe(true);
    expect(r.conflictPaths).toEqual([]);
    expect(r.tree).toMatch(/^deadbeef/);
  });
  it('a conflict (exit 1): collects de-duplicated conflicted paths, stops at the blank line', () => {
    const r = parseMergeTree(conflictOut([LANE_MANIFEST]), 1);
    expect(r.clean).toBe(false);
    expect(r.conflictPaths).toEqual([LANE_MANIFEST]); // de-duped across the 3 stage lines
    expect(r.tree).toBe('t'.repeat(40));
  });
  it('collects multiple distinct conflicted paths', () => {
    const r = parseMergeTree(conflictOut([LANE_MANIFEST, 'src/app.ts']), 1);
    expect(r.conflictPaths.sort()).toEqual([LANE_MANIFEST, 'src/app.ts'].sort());
  });
});

describe('manifestConflictDisposition', () => {
  it("clean → 'clean'", () => {
    expect(manifestConflictDisposition({ clean: true, conflictPaths: [] })).toBe('clean');
  });
  it("only the manifest conflicts → 'manifest-only'", () => {
    expect(manifestConflictDisposition({ clean: false, conflictPaths: [LANE_MANIFEST] })).toBe('manifest-only');
  });
  it("a non-manifest path conflicts → 'real' (even alongside the manifest)", () => {
    expect(manifestConflictDisposition({ clean: false, conflictPaths: [LANE_MANIFEST, 'src/app.ts'] })).toBe('real');
    expect(manifestConflictDisposition({ clean: false, conflictPaths: ['src/app.ts'] })).toBe('real');
  });
  it('exit≠0 but no parseable paths → treated as no-op clean', () => {
    expect(manifestConflictDisposition({ clean: false, conflictPaths: [] })).toBe('clean');
  });
});

// A scripted `run` that returns canned results per git subcommand and records the call sequence.
function scriptedRun(script) {
  const calls = [];
  const run = (cmd, args, opts) => {
    calls.push({ cmd, args, env: opts?.env });
    const key = args[0]; // git subcommand
    const handler = script[key];
    const res = typeof handler === 'function' ? handler(args, opts) : handler;
    return { status: 0, stdout: '', stderr: '', ...(res || {}) };
  };
  return { run, calls };
}

const MERGE_TREE_CLEAN = { 'merge-tree': { status: 0, stdout: 'cleanTree'.padEnd(40, '0') + '\n' } };
const RESOLVED_PLUMBING = {
  'read-tree': { status: 0 },
  rm: { status: 0 },
  'write-tree': { status: 0, stdout: 'resolvedTree'.padEnd(40, '0') + '\n' },
  'commit-tree': { status: 0, stdout: 'newCommitSha'.padEnd(40, '0') + '\n' },
  push: { status: 0 },
};

describe('rebaseDropManifest', () => {
  it('a manifest-only conflict → resolves and pushes a rebuilt tip (dropped=true)', () => {
    const { run, calls } = scriptedRun({
      'merge-tree': { status: 1, stdout: conflictOut([LANE_MANIFEST]) },
      ...RESOLVED_PLUMBING,
    });
    const r = rebaseDropManifest({ laneRef: 'lane/x-2198', run });
    expect(r.action).toBe('rebased');
    expect(r.dropped).toBe(true);
    expect(r.newCommit).toBe('newCommitSha'.padEnd(40, '0'));
    // commit-tree makes base the FIRST parent (so GitHub sees the branch up-to-date); the second parent is the
    // RESOLVED remote-tracking ref (#2231 — the bare `lane/x-2198` does not resolve in a fresh clone).
    const ct = calls.find((c) => c.args[0] === 'commit-tree');
    expect(ct.args).toEqual(['commit-tree', 'resolvedTree'.padEnd(40, '0'), '-p', 'origin/main', '-p', 'origin/lane/x-2198', '-m', expect.any(String)]);
    // the manifest is dropped from a TEMP index (GIT_INDEX_FILE set), never the working tree.
    const rm = calls.find((c) => c.args[0] === 'rm');
    expect(rm.args).toEqual(['rm', '--cached', '--ignore-unmatch', LANE_MANIFEST]);
    expect(rm.env?.GIT_INDEX_FILE).toBeTruthy();
    // push is a fast-forward of the lane/* ref (no checkout).
    const push = calls.find((c) => c.args[0] === 'push');
    expect(push.args).toEqual(['push', 'origin', `newCommitSha`.padEnd(40, '0') + ':refs/heads/lane/x-2198']);
  });

  it('a clean merge (behind only) → still rebuilds to fast-forward, dropped=false', () => {
    const { run } = scriptedRun({ ...MERGE_TREE_CLEAN, ...RESOLVED_PLUMBING });
    const r = rebaseDropManifest({ laneRef: 'lane/x-2199', run });
    expect(r.action).toBe('rebased');
    expect(r.dropped).toBe(false);
  });

  it('a real (non-manifest) conflict → skip, no commit-tree/push', () => {
    const { run, calls } = scriptedRun({
      'merge-tree': { status: 1, stdout: conflictOut([LANE_MANIFEST, 'src/app.ts']) },
      ...RESOLVED_PLUMBING,
    });
    const r = rebaseDropManifest({ laneRef: 'lane/x-real', run });
    expect(r.action).toBe('skip');
    expect(r.conflictPaths).toContain('src/app.ts');
    expect(calls.some((c) => c.args[0] === 'commit-tree')).toBe(false);
    expect(calls.some((c) => c.args[0] === 'push')).toBe(false);
  });

  it('a failed plumbing step (write-tree) → error, no push', () => {
    const { run, calls } = scriptedRun({
      'merge-tree': { status: 1, stdout: conflictOut([LANE_MANIFEST]) },
      'read-tree': { status: 0 },
      rm: { status: 0 },
      'write-tree': { status: 1, stderr: 'fatal: bad index' },
    });
    const r = rebaseDropManifest({ laneRef: 'lane/x-err', run });
    expect(r.action).toBe('error');
    expect(r.reason).toMatch(/write-tree/);
    expect(calls.some((c) => c.args[0] === 'push')).toBe(false);
  });

  it('no laneRef → error', () => {
    expect(rebaseDropManifest({ run: () => ({ status: 0, stdout: '' }) }).action).toBe('error');
  });

  // #2231 — in a fresh clone the lane branch is only the remote-tracking ref `origin/<laneRef>`; the bare name
  // does not resolve. The merge INPUTS (merge-tree, commit-tree) must read the resolved ref; the PUSH stays bare.
  it('feeds the RESOLVED remote-tracking ref to merge-tree/commit-tree, pushes to the BARE lane ref', () => {
    const { run, calls } = scriptedRun({ ...MERGE_TREE_CLEAN, ...RESOLVED_PLUMBING });
    const r = rebaseDropManifest({ laneRef: 'lane/x-2231', run });
    expect(r.action).toBe('rebased');
    // merge-tree reads origin/lane/x-2231, NOT the bare lane/x-2231.
    const mt = calls.find((c) => c.args[0] === 'merge-tree');
    expect(mt.args).toEqual(['merge-tree', '--write-tree', 'origin/main', 'origin/lane/x-2231']);
    // commit-tree's second parent is likewise the resolved ref.
    const ct = calls.find((c) => c.args[0] === 'commit-tree');
    expect(ct.args[5]).toBe('origin/lane/x-2231');
    // but the push target is the BARE ref (that half was always correct).
    const push = calls.find((c) => c.args[0] === 'push');
    expect(push.args[2]).toMatch(/:refs\/heads\/lane\/x-2231$/);
  });

  it('fetches the lane ref before reading it (so the remote-tracking ref is current in a fresh clone)', () => {
    const { run, calls } = scriptedRun({ ...MERGE_TREE_CLEAN, ...RESOLVED_PLUMBING });
    rebaseDropManifest({ laneRef: 'lane/x-2231', run });
    const fetch = calls.find((c) => c.args[0] === 'fetch');
    expect(fetch.args).toEqual(['fetch', 'origin', 'lane/x-2231']);
    // fetch happens BEFORE the merge-tree read.
    expect(calls.findIndex((c) => c.args[0] === 'fetch')).toBeLessThan(calls.findIndex((c) => c.args[0] === 'merge-tree'));
  });

  it('a failed fetch → error, no merge-tree/push (the lane ref never resolved)', () => {
    const { run, calls } = scriptedRun({ fetch: { status: 1, stderr: 'fatal: couldn’t find remote ref' }, ...MERGE_TREE_CLEAN, ...RESOLVED_PLUMBING });
    const r = rebaseDropManifest({ laneRef: 'lane/x-gone', run });
    expect(r.action).toBe('error');
    expect(r.reason).toMatch(/fetch/);
    expect(calls.some((c) => c.args[0] === 'merge-tree')).toBe(false);
    expect(calls.some((c) => c.args[0] === 'push')).toBe(false);
  });

  it('fetch:false skips the fetch (caller already fetched) but still reads the resolved ref', () => {
    const { run, calls } = scriptedRun({ ...MERGE_TREE_CLEAN, ...RESOLVED_PLUMBING });
    rebaseDropManifest({ laneRef: 'lane/x-2231', fetch: false, run });
    expect(calls.some((c) => c.args[0] === 'fetch')).toBe(false);
    expect(calls.find((c) => c.args[0] === 'merge-tree').args[3]).toBe('origin/lane/x-2231');
  });
});
