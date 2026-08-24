/**
 * @file git-transport-branch.test.mjs — the worktree dance every credential-less transport pushes through
 *   (#xaoja7a).
 *
 * THESE ARE `record-verdict`'s HAZARDS, ASSERTED WHERE THE CODE NOW LIVES. When the dance was inlined in
 * `we:scripts/operations/record-verdict-io.mjs` its suite pinned each of them; extracting it for the PR-view
 * transport would have left the properties asserted only through one caller, so they are pinned here too — a
 * second caller must not be able to lose them by construction.
 */
import { describe, it, expect } from 'vitest';
import { stageOnTransportBranch } from '../git-transport-branch.mjs';

/** Every side effect stubbed, filesystem included. See the header of the module under test for why. */
const stub = ({ diff = 'ops/x/a.json', onRun } = {}) => {
  const calls = [];
  const run = (args, opts) => {
    calls.push({ args, cwd: opts?.cwd });
    if (onRun) { const r = onRun(args); if (r !== undefined) return r; }
    return args[0] === 'diff' ? diff : '';
  };
  return {
    calls,
    seams: {
      run,
      mkdir: (p) => calls.push({ fs: 'mkdir', path: p }),
      write: (p, c) => calls.push({ fs: 'write', path: p, content: c }),
      rm: (p) => calls.push({ fs: 'rm', path: p }),
      now: () => 111,
    },
  };
};
const stage = (s, over = {}) => stageOnTransportBranch({
  board: '/board', branch: 'ops/x', files: [{ path: 'ops/x/a.json', content: '{}\n' }], message: 'm',
  ...s.seams, ...over,
});

describe('it never checks the transport branch out over the caller\'s tree', () => {
  /**
   * The caller is standing in a lane with uncommitted work. Checking a transport branch out over that lane
   * destroys it — done by hand once, and it disrupted a running juror mid-review.
   */
  it('runs every checkout inside its own worktree, never in the board root', () => {
    const s = stub();
    stage(s);
    const checkouts = s.calls.filter((c) => c.args?.[0] === 'checkout');
    expect(checkouts.length).toBeGreaterThan(0);
    for (const c of checkouts) expect(c.cwd).not.toBe('/board');
  });

  it('writes only under the worktree it created', () => {
    const s = stub();
    stage(s);
    const writes = s.calls.filter((c) => c.fs);
    expect(writes.length).toBeGreaterThan(0);
    for (const w of writes) expect(w.path.startsWith('/board/.operations/transport')).toBe(true);
  });
});

describe('the cleanup that stops one bad run becoming every subsequent one', () => {
  it('removes the directory AND prunes the registration, even when the push throws', () => {
    const s = stub({ onRun: (args) => { if (args[0] === 'push') throw new Error('network'); } });
    expect(() => stage(s)).toThrow(/network/);
    expect(s.calls.some((c) => c.fs === 'rm')).toBe(true);
    expect(s.calls.some((c) => c.args?.[0] === 'worktree' && c.args?.[1] === 'prune')).toBe(true);
  });

  // Pruning in the DRIVER's checkout would leave a stale registration in the repo that will need it (#3261).
  it('prunes in the board, not wherever the driver happens to stand', () => {
    const s = stub();
    stage(s);
    const prune = s.calls.find((c) => c.args?.[0] === 'worktree' && c.args?.[1] === 'prune');
    expect(prune.cwd).toBe('/board');
  });
});

describe('what it pushes, and when it does not', () => {
  it('pushes to the branch CI actually watches', () => {
    const s = stub();
    expect(stage(s).pushed).toBe(true);
    expect(s.calls.find((c) => c.args?.[0] === 'push').args).toContain('HEAD:ops/x');
  });

  // Identical bytes already staged is what `idempotent: true` promises on replay, not a failure to report.
  it('treats "nothing to commit" as success and pushes nothing', () => {
    const s = stub({ diff: '' });
    expect(stage(s)).toMatchObject({ pushed: false });
    expect(s.calls.some((c) => c.args?.[0] === 'push')).toBe(false);
    expect(s.calls.some((c) => c.args?.[0] === 'commit')).toBe(false);
  });

  it('stages every file it was given, not just the first', () => {
    const s = stub();
    stage(s, { files: [{ path: 'ops/x/a.json', content: 'a' }, { path: 'ops/x/b.json', content: 'b' }] });
    const added = s.calls.filter((c) => c.args?.[0] === 'add').map((c) => c.args[2]);
    expect(added).toEqual(['ops/x/a.json', 'ops/x/b.json']);
  });

  it('refuses a call with nothing to stage rather than pushing an empty commit', () => {
    const s = stub();
    expect(() => stage(s, { files: [] })).toThrow(/nothing to stage/);
    expect(() => stageOnTransportBranch({ branch: 'ops/x', files: [{ path: 'a', content: 'b' }] })).toThrow(/`board` and `branch`/);
  });
});
