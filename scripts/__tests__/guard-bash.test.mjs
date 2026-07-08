/**
 * @file guard-bash.test.mjs — proof of the PreToolUse(Bash) banned-command table, focused on the #2203
 *   strict lane-only enforcement: a DIRECT push to `main` is blocked, a `lane/*` push is allowed, and the
 *   sanctioned `MAIN_PUSH_OK=1` escape passes through. The stdin/JSON I/O is the boundary; `decide` is pure.
 */
import { describe, it, expect } from 'vitest';
import { decide, reason, isBacklogMutation, isPrimaryCwd, isLaneCwd } from '../guard-bash.mjs';

describe('guard-bash — primary-cwd backlog-mutation block (#2302)', () => {
  const P = ['/ws/webeverything', '/ws/frontierui'];
  it('isBacklogMutation matches EVERY item-mutation verb (incl. release/cost), not the session-state verbs', () => {
    for (const v of ['claim', 'resolve', 'release', 'scaffold', 'settle', 'retype', 'yield', 'cost', 'prepare-stamp'])
      expect(isBacklogMutation(`node scripts/backlog.mjs ${v} 2279`)).toBe(true);
    for (const v of ['reserve', 'unreserve', 'queue', 'unqueue', 'calibrate', 'prepare-hold', 'prepare-release']) // don't touch an item .md → not blocked
      expect(isBacklogMutation(`node scripts/backlog.mjs ${v} 2279 --session=s`)).toBe(false);
    expect(isBacklogMutation('echo backlog.mjs claim 1')).toBe(false); // a mention, not a `node` invocation
  });
  it('isPrimaryCwd: a primary root is primary, a lane clone is not', () => {
    expect(isPrimaryCwd('/ws/webeverything', P)).toBe(true);
    expect(isPrimaryCwd('/ws/webeverything/scripts', P)).toBe(true);
    expect(isPrimaryCwd('/ws/.lanes/pipeline-2302/lane-1', P)).toBe(false); // lane clone → allowed
    expect(isPrimaryCwd('/ws/some-other-repo', P)).toBe(false);
  });
  it('denies a claim/resolve/scaffold ONLY when cwd is primary', () => {
    const cmd = 'node scripts/backlog.mjs resolve 2287';
    expect(reason(cmd, { primaryCwd: true })).toMatch(/must run in a LANE clone/);
    expect(reason(cmd, { primaryCwd: false })).toBeNull();      // in a lane → allowed
    expect(reason(cmd)).toBeNull();                              // default ctx (no cwd known) → allow
  });
  it('release + cost are blocked from primary too (same writeBacklogMd path — #2302 PR review)', () => {
    for (const v of ['release', 'cost']) {
      expect(reason(`node scripts/backlog.mjs ${v} 2287`, { primaryCwd: true })).toMatch(/must run in a LANE clone/);
      expect(reason(`node scripts/backlog.mjs ${v} 2287`, { primaryCwd: false })).toBeNull(); // in a lane → allowed
    }
  });
  it('the BACKLOG_MUTATE_OK=1 override passes through even from primary', () => {
    expect(reason('BACKLOG_MUTATE_OK=1 node scripts/backlog.mjs resolve 2287', { primaryCwd: true })).toBeNull();
  });
  it('a session-state verb (reserve) is allowed from primary', () => {
    expect(reason('node scripts/backlog.mjs reserve 2279 --session=s', { primaryCwd: true })).toBeNull();
  });
  it('prepare-stamp is blocked from primary (item-file splice); prepare-hold/release are local-only → allowed', () => {
    expect(reason('node scripts/backlog.mjs prepare-stamp 2264', { primaryCwd: true })).toMatch(/must run in a LANE clone/);
    expect(reason('node scripts/backlog.mjs prepare-stamp 2264', { primaryCwd: false })).toBeNull(); // in a lane → allowed
    for (const v of ['prepare-hold', 'prepare-release'])
      expect(reason(`node scripts/backlog.mjs ${v} 2264`, { primaryCwd: true })).toBeNull(); // local token, not a mutation
  });
});

describe('guard-bash — stale-lane backlog-mutation block (#2323)', () => {
  it('isLaneCwd: a `.lanes/` path is a lane clone; a primary or unrelated path is not', () => {
    expect(isLaneCwd('/ws/.lanes/web-everything/lane-1')).toBe(true);
    expect(isLaneCwd('/ws/.lanes/web-everything/lane-12/scripts')).toBe(true);
    expect(isLaneCwd('/ws/webeverything')).toBe(false);
    expect(isLaneCwd('/ws/some-other-repo')).toBe(false);
    expect(isLaneCwd(undefined)).toBe(false);
  });
  it('denies a claim/resolve/scaffold in a lane whose HEAD is behind its upstream', () => {
    const cmd = 'node scripts/backlog.mjs claim 2323';
    expect(reason(cmd, { primaryCwd: false, staleBehind: 19 })).toMatch(/19 commit\(s\) behind origin\/main/);
    expect(reason(cmd, { primaryCwd: false, staleBehind: 1 })).toMatch(/behind origin\/main/);
  });
  it('allows the same mutation once the lane is caught up (staleBehind: 0, the default)', () => {
    expect(reason('node scripts/backlog.mjs claim 2323', { primaryCwd: false, staleBehind: 0 })).toBeNull();
    expect(reason('node scripts/backlog.mjs claim 2323', { primaryCwd: false })).toBeNull(); // default ctx
  });
  it('never fires from a primary cwd — that path is already denied by the #2302 rule instead', () => {
    // primaryCwd:true wins the #2302 message even if a stale count were (incorrectly) supplied.
    expect(reason('node scripts/backlog.mjs claim 2323', { primaryCwd: true, staleBehind: 19 })).toMatch(/must run in a LANE clone/);
  });
  it('does not fire on a non-mutation verb, even when stale', () => {
    expect(reason('node scripts/backlog.mjs reserve 2323 --session=s', { primaryCwd: false, staleBehind: 19 })).toBeNull();
  });
  it('the STALE_LANE_OK=1 override passes a stale-lane mutation through', () => {
    expect(reason('STALE_LANE_OK=1 node scripts/backlog.mjs claim 2323', { primaryCwd: false, staleBehind: 19 })).toBeNull();
  });
});

describe('guard-bash — direct-push-to-main block (#2203)', () => {
  const blocked = (c) => expect(decide(c), c).toMatch(/direct push to `main` is blocked/);
  const allowed = (c) => expect(decide(c), c).toBeNull();

  it('blocks an explicit push to main (bare branch, HEAD:main, refs/heads/main)', () => {
    blocked('git push origin main');
    blocked('git push origin HEAD:main');
    blocked('git push origin HEAD:refs/heads/main');
    blocked('git push origin main:main');
    blocked('git push --force origin main');
  });
  it('blocks a bare push (defaults to the current branch — on the primary that is main)', () => {
    blocked('git push');
    blocked('git push origin');
    blocked('git push --force-with-lease');
  });
  it('ALLOWS a lane/* push (the sanctioned path — PR-gated)', () => {
    allowed('git push origin HEAD:refs/heads/lane/foo-2210');
    allowed('git push origin abc123:refs/heads/lane/batch-x-1');
    allowed('git push origin HEAD:refs/heads/lane/x --force-with-lease');
    allowed('git push origin --delete lane/old'); // deleting a lane ref
  });
  it('the MAIN_PUSH_OK=1 escape passes a main push through (pr-land --fallback-git, emergencies)', () => {
    allowed('MAIN_PUSH_OK=1 git push origin main:main');
    allowed('MAIN_PUSH_OK=1 git push origin HEAD:refs/heads/main');
  });
  it('does not fire on non-push git, or a push MENTIONED in a message', () => {
    allowed('git fetch origin main');
    allowed('git pull --ff-only origin main');
    allowed('git log origin/main');
    allowed('echo "remember to git push origin main"'); // command word is echo, not git
    allowed('git commit -m "wire git push origin main into the drain"');
  });
  it('still enforces the pre-existing rules (regression guard)', () => {
    expect(decide('pkill -f vite')).toMatch(/dev server/);
    expect(decide('git rm backlog/2200-foo.md')).toMatch(/Never delete a backlog/);
    expect(decide('git mv backlog/2200-a.md backlog/2201-a.md')).toMatch(/immutable/);
    expect(reason('sed -i s/x/y/ backlog/2200-a.md')).toMatch(/locus-prefix/);
  });
});
