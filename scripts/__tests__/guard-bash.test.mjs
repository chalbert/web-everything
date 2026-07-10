/**
 * @file guard-bash.test.mjs — proof of the PreToolUse(Bash) banned-command table, focused on the #2203
 *   strict lane-only enforcement: a DIRECT push to `main` is blocked, a `lane/*` push is allowed, and the
 *   sanctioned `MAIN_PUSH_OK=1` escape passes through. The stdin/JSON I/O is the boundary; `decide` is pure.
 */
import { describe, it, expect } from 'vitest';
import {
  decide, reason, isBacklogMutation, isPrimaryCwd, isLaneCwd, resolveEffectiveCwd,
  laneRootFromCwd, isDestructiveLaneGitOp, hasDestructiveLaneOp,
} from '../guard-bash.mjs';

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
  it('#2339 — the former BACKLOG_MUTATE_OK=1 override is REMOVED; primary is denied unconditionally, no escape', () => {
    expect(reason('BACKLOG_MUTATE_OK=1 node scripts/backlog.mjs resolve 2287', { primaryCwd: true })).toMatch(/must run in a LANE clone/);
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

describe('guard-bash — resolveEffectiveCwd honours a leading `cd` (#2335)', () => {
  const PRIMARY = '/ws/webeverything';
  const LANE = '/ws/.lanes/web-everything/lane-5';

  it('resolves a literal `cd <abs-lane>` regardless of the reported (reset-to-primary) cwd', () => {
    expect(resolveEffectiveCwd(`cd ${LANE} && node scripts/backlog.mjs claim 2335`, PRIMARY)).toBe(LANE);
  });
  it('resolves `cd "$LANE"` against a literal LANE=/abs assignment in the same command (the lane idiom)', () => {
    const cmd = `LANE=${LANE}\ncd "$LANE" && STALE_LANE_OK=1 node scripts/backlog.mjs claim 2335`;
    expect(resolveEffectiveCwd(cmd, PRIMARY)).toBe(LANE);
  });
  it('resolves `cd ${LANE}` brace form too', () => {
    expect(resolveEffectiveCwd(`LANE=${LANE}; cd \${LANE} && ls`, PRIMARY)).toBe(LANE);
  });
  it('falls back to the reported cwd with no cd, or an unresolvable ($VAR unknown / command-subst) target', () => {
    expect(resolveEffectiveCwd('node scripts/backlog.mjs claim 2335', PRIMARY)).toBe(PRIMARY);
    expect(resolveEffectiveCwd('cd "$UNSET" && ls', PRIMARY)).toBe(PRIMARY);
    expect(resolveEffectiveCwd('cd "$(mktemp -d)" && ls', PRIMARY)).toBe(PRIMARY);
  });
  it('a genuine primary mutation (no cd, or cd into the primary) still resolves to the primary → stays denied', () => {
    const P = [PRIMARY];
    const eff1 = resolveEffectiveCwd('node scripts/backlog.mjs resolve 2335', PRIMARY);
    expect(reason('node scripts/backlog.mjs resolve 2335', { primaryCwd: isPrimaryCwd(eff1, P) })).toMatch(/must run in a LANE clone/);
    const eff2 = resolveEffectiveCwd(`cd ${PRIMARY} && node scripts/backlog.mjs resolve 2335`, '/somewhere');
    expect(reason('node scripts/backlog.mjs resolve 2335', { primaryCwd: isPrimaryCwd(eff2, P) })).toMatch(/must run in a LANE clone/);
  });
  it('the lane mutation is ALLOWED once the effective cwd is the lane (no override needed)', () => {
    const eff = resolveEffectiveCwd(`cd ${LANE} && node scripts/backlog.mjs claim 2335`, PRIMARY);
    expect(isPrimaryCwd(eff, [PRIMARY])).toBe(false);
    expect(isLaneCwd(eff)).toBe(true);
    expect(reason('node scripts/backlog.mjs claim 2335', { primaryCwd: false })).toBeNull();
  });
});

describe('guard-bash — foreign-live-lease destructive-op block (#2367)', () => {
  it('laneRootFromCwd: extracts the lane ROOT from cwd at or under it; null off a lane', () => {
    expect(laneRootFromCwd('/ws/.lanes/web-everything/lane-8')).toBe('/ws/.lanes/web-everything/lane-8');
    expect(laneRootFromCwd('/ws/.lanes/web-everything/lane-8/scripts')).toBe('/ws/.lanes/web-everything/lane-8');
    expect(laneRootFromCwd('/ws/.lanes/frontierui/lane-12/src/deep/dir')).toBe('/ws/.lanes/frontierui/lane-12');
    expect(laneRootFromCwd('/ws/webeverything')).toBeNull();
    expect(laneRootFromCwd(undefined)).toBeNull();
  });

  it('isDestructiveLaneGitOp: recognizes reset --hard, clean -fd (any flag order/combo), checkout -- ., force-push', () => {
    expect(isDestructiveLaneGitOp('git reset --hard origin/main')).toBe(true);
    expect(isDestructiveLaneGitOp('git reset --hard')).toBe(true);
    expect(isDestructiveLaneGitOp('git reset --soft HEAD~1')).toBe(false);
    expect(isDestructiveLaneGitOp('git clean -fd')).toBe(true);
    expect(isDestructiveLaneGitOp('git clean -df')).toBe(true);
    expect(isDestructiveLaneGitOp('git clean -f -d')).toBe(true);
    expect(isDestructiveLaneGitOp('git clean --force -d')).toBe(true);
    expect(isDestructiveLaneGitOp('git clean -f')).toBe(false);       // no dir flag → files-only, not the danger case
    expect(isDestructiveLaneGitOp('git clean -n -fd')).toBe(true);    // dry-run flag alongside — still matched (conservative)
    expect(isDestructiveLaneGitOp('git checkout -- .')).toBe(true);
    expect(isDestructiveLaneGitOp('git checkout .')).toBe(true);
    expect(isDestructiveLaneGitOp('git checkout -- src/foo.ts')).toBe(false);
    expect(isDestructiveLaneGitOp('git checkout main')).toBe(false);
    expect(isDestructiveLaneGitOp('git push --force origin lane/foo')).toBe(true);
    expect(isDestructiveLaneGitOp('git push -f origin lane/foo')).toBe(true);
    expect(isDestructiveLaneGitOp('git push --force-with-lease origin lane/foo')).toBe(true);
    expect(isDestructiveLaneGitOp('git push origin lane/foo')).toBe(false);
    expect(isDestructiveLaneGitOp('git status')).toBe(false);
    expect(isDestructiveLaneGitOp('')).toBe(false);
  });

  it('hasDestructiveLaneOp: true if ANY &&/;/| segment is destructive, honouring env/sudo stripping', () => {
    expect(hasDestructiveLaneOp('git fetch origin && git reset --hard origin/main')).toBe(true);
    expect(hasDestructiveLaneOp('FOO=1 git reset --hard')).toBe(true);
    expect(hasDestructiveLaneOp('git status; git log')).toBe(false);
    expect(hasDestructiveLaneOp('')).toBe(false);
  });

  it('denies a destructive op only when foreignLiveLease is true, not for own/absent/stale-lease lanes', () => {
    const cmd = 'git reset --hard origin/main';
    expect(reason(cmd, { primaryCwd: false, foreignLiveLease: true })).toMatch(/LIVE lease held by ANOTHER session/);
    expect(reason(cmd, { primaryCwd: false, foreignLiveLease: false })).toBeNull(); // own lane / no live lease
    expect(reason(cmd, { primaryCwd: false })).toBeNull();                          // default ctx
  });

  it('never fires from a primary cwd (a lane-only concept)', () => {
    expect(reason('git reset --hard', { primaryCwd: true, foreignLiveLease: true })).toBeNull();
  });

  it('does not fire on a non-destructive command, even with a foreign live lease', () => {
    expect(reason('git status', { primaryCwd: false, foreignLiveLease: true })).toBeNull();
    expect(reason('git push origin lane/foo', { primaryCwd: false, foreignLiveLease: true })).toBeNull();
  });

  it('the LANE_CLOBBER_OK=1 override passes a foreign-live-lease destructive op through', () => {
    expect(reason('LANE_CLOBBER_OK=1 git reset --hard', { primaryCwd: false, foreignLiveLease: true })).toBeNull();
    expect(decide('LANE_CLOBBER_OK=1 git clean -fd', { primaryCwd: false, foreignLiveLease: true })).toBeNull();
  });

  it('decide() surfaces the #2367 denial across a full command via ctx', () => {
    expect(decide('git fetch && git reset --hard origin/main', { primaryCwd: false, foreignLiveLease: true }))
      .toMatch(/LIVE lease held by ANOTHER session/);
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
