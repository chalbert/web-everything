/**
 * @file guard-bash.test.mjs — proof of the PreToolUse(Bash) banned-command table, focused on the #2203
 *   strict lane-only enforcement: a DIRECT push to `main` is blocked, a `lane/*` push is allowed, and the
 *   sanctioned `MAIN_PUSH_OK=1` escape passes through. The stdin/JSON I/O is the boundary; `decide` is pure.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  decide, reason, isBacklogMutation, isPrimaryCwd, isLaneCwd, resolveEffectiveCwd,
  siblingLaneLeases,
  laneRootFromCwd, isDestructiveLaneGitOp, hasDestructiveLaneOp, canonicalGitOp,
  isVerificationRun, isBackgrounded, backgroundedVerificationReason,
  isTreeWritingBuildRun, isGeneratorScriptRun, isFileWriteRedirect, primaryTreeWriteReason,
  mainSessionDelegateNudge, hasLeadingEnvEscape, canonicalCommand, shellTokens, stripHeredocBodies,
  splitSegments, runnerInvocation, parseSegments, unparseableReason, heredocScan,
  nestedCommandStrings,
} from '../guard-bash.mjs';
import { execFileSync } from 'node:child_process';

describe('guard-bash — backgrounded verification is denied (#2833 finding 3)', () => {
  it('isVerificationRun matches the verification set (verify-lane / check:standards / test:unit), not a mention', () => {
    expect(isVerificationRun('node scripts/verify-lane.mjs --gate="npm run check:standards"')).toBe(true);
    expect(isVerificationRun('npm run check:standards')).toBe(true);
    expect(isVerificationRun('npm run test:unit')).toBe(true);
    expect(isVerificationRun('npm test')).toBe(true);
    expect(isVerificationRun('pnpm run test:unit')).toBe(true);
    // a mere mention is not a run
    expect(isVerificationRun('echo "run check:standards later"')).toBe(false);
    expect(isVerificationRun('grep check:standards docs/x.md')).toBe(false);
    expect(isVerificationRun('git commit -m "wire verify-lane"')).toBe(false);
  });
  it('isBackgrounded: run_in_background param, a trailing &, and nohup/setsid/disown — but NOT && / redirections', () => {
    expect(isBackgrounded('npm run check:standards', true)).toBe(true);          // the Bash tool param
    expect(isBackgrounded('npm run check:standards &')).toBe(true);              // shell background operator
    expect(isBackgrounded('nohup npm run test:unit')).toBe(true);
    expect(isBackgrounded('setsid npm test')).toBe(true);
    expect(isBackgrounded('npm run check:standards && echo done')).toBe(false);  // logical AND, not backgrounding
    expect(isBackgrounded('npm run test:unit > log 2>&1')).toBe(false);          // fd redirection, not backgrounding
    expect(isBackgrounded('npm run check:standards')).toBe(false);               // plain foreground
  });
  it('backgroundedVerificationReason fires only when BOTH a verification run AND backgrounded', () => {
    expect(backgroundedVerificationReason('npm run check:standards', true)).toMatch(/SYNCHRONOUSLY in the FOREGROUND/);
    expect(backgroundedVerificationReason('node scripts/verify-lane.mjs &')).toMatch(/#2833 subagent stall/);
    // a foreground verification run → allowed
    expect(backgroundedVerificationReason('npm run check:standards')).toBeNull();
    expect(backgroundedVerificationReason('npm run check:standards', false)).toBeNull();
    // a backgrounded NON-verification command → not our concern
    expect(backgroundedVerificationReason('npm run dev &')).toBeNull();
    expect(backgroundedVerificationReason('sleep 60 &', true)).toBeNull();
  });
  it('decide denies a backgrounded verification run (via the run_in_background ctx) and allows the foreground form', () => {
    expect(decide('npm run check:standards', { runInBackground: true })).toMatch(/never backgrounded/);
    expect(decide('node scripts/verify-lane.mjs --gate="npm run test:unit" &')).toMatch(/never backgrounded/);
    expect(decide('npm run check:standards', { runInBackground: false })).toBeNull();
    expect(decide('npm run check:standards')).toBeNull();
  });
});

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

  it('isDestructiveLaneGitOp: recognizes reset --hard, clean (any force flag), checkout/restore/switch discard, force-push', () => {
    expect(isDestructiveLaneGitOp('git reset --hard origin/main')).toBe(true);
    expect(isDestructiveLaneGitOp('git reset --hard')).toBe(true);
    expect(isDestructiveLaneGitOp('git reset --soft HEAD~1')).toBe(false);
    expect(isDestructiveLaneGitOp('git clean -fd')).toBe(true);
    expect(isDestructiveLaneGitOp('git clean -df')).toBe(true);
    expect(isDestructiveLaneGitOp('git clean -f -d')).toBe(true);
    expect(isDestructiveLaneGitOp('git clean --force -d')).toBe(true);
    expect(isDestructiveLaneGitOp('git clean -f')).toBe(true);        // #2367 gap — -f alone still DELETES untracked files
    expect(isDestructiveLaneGitOp('git clean -fx')).toBe(true);       // -fx (files + ignored) without -d — still destructive
    expect(isDestructiveLaneGitOp('git clean -n')).toBe(false);       // dry-run, no force → harmless
    expect(isDestructiveLaneGitOp('git clean -n -fd')).toBe(true);    // dry-run flag alongside a force flag — matched (conservative)
    expect(isDestructiveLaneGitOp('git checkout -- .')).toBe(true);
    expect(isDestructiveLaneGitOp('git checkout .')).toBe(true);
    expect(isDestructiveLaneGitOp('git checkout HEAD -- .')).toBe(true);  // #2367 gap — ref before the pathspec
    expect(isDestructiveLaneGitOp('git checkout -f main')).toBe(true);    // #2367 gap — force-checkout discards the tree
    expect(isDestructiveLaneGitOp('git checkout -- src/foo.ts')).toBe(false);
    expect(isDestructiveLaneGitOp('git checkout main')).toBe(false);
    expect(isDestructiveLaneGitOp('git restore .')).toBe(true);          // #2367 gap
    expect(isDestructiveLaneGitOp('git restore --worktree .')).toBe(true);
    expect(isDestructiveLaneGitOp('git restore --staged -- .')).toBe(true);
    expect(isDestructiveLaneGitOp('git restore src/foo.ts')).toBe(false);
    expect(isDestructiveLaneGitOp('git switch -f main')).toBe(true);      // #2367 gap — force-switch discards the tree
    expect(isDestructiveLaneGitOp('git switch --discard-changes main')).toBe(true);
    expect(isDestructiveLaneGitOp('git switch main')).toBe(false);
    expect(isDestructiveLaneGitOp('git push --force origin lane/foo')).toBe(true);
    expect(isDestructiveLaneGitOp('git push -f origin lane/foo')).toBe(true);
    expect(isDestructiveLaneGitOp('git push --force-with-lease origin lane/foo')).toBe(true);
    expect(isDestructiveLaneGitOp('git push origin +main')).toBe(true);          // #2367 gap — +refspec force syntax
    expect(isDestructiveLaneGitOp('git push origin +HEAD:lane/x')).toBe(true);
    expect(isDestructiveLaneGitOp('git push origin lane/foo')).toBe(false);
    expect(isDestructiveLaneGitOp('git status')).toBe(false);
    expect(isDestructiveLaneGitOp('')).toBe(false);
  });

  it('canonicalGitOp / isDestructiveLaneGitOp: matcher-BYPASS forms no longer evade the check (#2367)', () => {
    // path-qualified git
    expect(canonicalGitOp('/usr/bin/git reset --hard')).toBe('git reset --hard');
    expect(isDestructiveLaneGitOp('/usr/bin/git reset --hard')).toBe(true);
    // wrapper commands
    expect(isDestructiveLaneGitOp('env git reset --hard')).toBe(true);
    expect(isDestructiveLaneGitOp('env GIT_PAGER=cat git clean -fd')).toBe(true);
    expect(isDestructiveLaneGitOp('time git reset --hard')).toBe(true);
    expect(isDestructiveLaneGitOp('command git reset --hard')).toBe(true);
    expect(isDestructiveLaneGitOp('xargs git reset --hard')).toBe(true);
    expect(isDestructiveLaneGitOp('xargs -n1 git checkout -- .')).toBe(true);
    // git global flags before the subcommand
    expect(canonicalGitOp('git -C /some/path reset --hard')).toBe('git reset --hard');
    expect(isDestructiveLaneGitOp('git -C /some/path reset --hard')).toBe(true);
    expect(isDestructiveLaneGitOp('git -c core.pager=cat clean -fd')).toBe(true);
    // leading subshell / brace-group open
    expect(isDestructiveLaneGitOp('(git reset --hard)')).toBe(true);
    expect(isDestructiveLaneGitOp('{ git clean -fd')).toBe(true);
    // r2 — quoted / backslash-escaped git token normalizes to `git`
    expect(canonicalGitOp('"git" reset --hard')).toBe('git reset --hard');
    expect(canonicalGitOp("'git' reset --hard")).toBe('git reset --hard');
    expect(canonicalGitOp('\\git reset --hard')).toBe('git reset --hard');
    expect(isDestructiveLaneGitOp('"git" reset --hard')).toBe(true);
    expect(isDestructiveLaneGitOp("'git' clean -fd")).toBe(true);
    expect(isDestructiveLaneGitOp('\\git checkout -- .')).toBe(true);
    // r2 — `sudo [-n] [-u <user>]` prefix peeled off before the git token
    expect(canonicalGitOp('sudo git reset --hard')).toBe('git reset --hard');
    expect(canonicalGitOp('sudo -u deploy git reset --hard')).toBe('git reset --hard');
    expect(canonicalGitOp('sudo -n -u deploy git clean -fd')).toBe('git clean -fd');
    expect(isDestructiveLaneGitOp('sudo -u deploy git reset --hard')).toBe(true);
    expect(isDestructiveLaneGitOp('sudo -n git clean -fd')).toBe(true);
    // r2 — a bare `VAR=val` shell-assignment prefix is peeled too (canonicalGitOp is now self-sufficient)
    expect(canonicalGitOp('FOO=1 git reset --hard')).toBe('git reset --hard');
    expect(isDestructiveLaneGitOp('FOO=1 BAR=2 git reset --hard')).toBe(true);
    // still returns '' / false for non-git
    expect(canonicalGitOp('echo git reset --hard')).toBe('');
    expect(isDestructiveLaneGitOp('echo git reset --hard')).toBe(false);
    // DISMISSED (adversarial-evasion gold-plating, #2367 r2) — advisory guard, accidental-collision threat
    // model, one-env-var escape (LANE_CLOBBER_OK=1); an evader never needs these, so they stay UN-matched.
    expect(canonicalGitOp('git$IFS$9reset --hard')).toBe('');   // IFS word-splitting trick
    expect(canonicalGitOp('$(echo git) reset --hard')).toBe(''); // command substitution
    expect(canonicalGitOp('bash -c "git reset --hard"')).toBe(''); // nested shell
    expect(canonicalGitOp('sh -c "git reset --hard"')).toBe('');
    expect(canonicalGitOp('ssh host git reset --hard')).toBe(''); // remote exec
    expect(isDestructiveLaneGitOp('bash -c "git reset --hard"')).toBe(false);
  });

  it('hasDestructiveLaneOp: true if ANY &&/;/| segment is destructive, honouring env/sudo + bypass normalization', () => {
    expect(hasDestructiveLaneOp('git fetch origin && git reset --hard origin/main')).toBe(true);
    expect(hasDestructiveLaneOp('FOO=1 git reset --hard')).toBe(true);
    expect(hasDestructiveLaneOp('git fetch && /usr/bin/git -C . reset --hard')).toBe(true); // bypass form in a later segment
    expect(hasDestructiveLaneOp('echo x | xargs git clean -fd')).toBe(true);
    expect(hasDestructiveLaneOp('git status && sudo -u deploy git reset --hard')).toBe(true); // r2 — sudo -u form
    expect(hasDestructiveLaneOp('git status; git log')).toBe(false);
    expect(hasDestructiveLaneOp('')).toBe(false);
  });

  it('denies a destructive op only when foreignLiveLease is true, not for own/absent/stale-lease lanes', () => {
    const cmd = 'git reset --hard origin/main';
    expect(reason(cmd, { primaryCwd: false, foreignLiveLease: true })).toMatch(/LIVE lease held by ANOTHER session/);
    expect(reason(cmd, { primaryCwd: false, foreignLiveLease: false })).toBeNull(); // own lane / no live lease
    expect(reason(cmd, { primaryCwd: false })).toBeNull();                          // default ctx
  });

  it('r2 — reason() sees through a sudo/quoted disguise on the destructive op', () => {
    expect(reason('sudo -u deploy git reset --hard origin/main', { primaryCwd: false, foreignLiveLease: true }))
      .toMatch(/LIVE lease held by ANOTHER session/);
    expect(reason('"git" clean -fd', { primaryCwd: false, foreignLiveLease: true }))
      .toMatch(/LIVE lease held by ANOTHER session/);
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

describe('guard-bash — marked (workflow-lane) lease slug-assertion block (#2413)', () => {
  const SLUG = 'batch-x-2427';
  const marked = (over = {}) => ({ primaryCwd: false, markedLeaseSlug: SLUG, ...over });

  it('DENIES a destructive op that does NOT assert the lease slug (fail-closed absence)', () => {
    expect(reason('git reset --hard origin/main', marked())).toMatch(/must ASSERT the lease's own slug/);
    expect(reason('git clean -fd', marked())).toMatch(/LANE_SESSION=batch-x-2427/);
    expect(reason('git checkout -- .', marked())).toMatch(/denied fail-closed/);
  });

  it('DENIES a destructive op that asserts the WRONG slug (fail-closed mismatch)', () => {
    expect(reason('LANE_SESSION=batch-x-9999 git reset --hard origin/main', marked())).toMatch(/a MISMATCH/);
  });

  it('ALLOWS the owning lane\'s own op once it re-asserts the exact slug', () => {
    expect(reason(`LANE_SESSION=${SLUG} git reset --hard origin/main`, marked())).toBeNull();
    expect(reason(`LANE_SESSION=${SLUG} git clean -fd`, marked())).toBeNull();
  });

  it('the marked check SUPERSEDES the #2367 ownerSession fail-open (foreignLiveLease is ignored when marked)', () => {
    // A marked lane with NO assertion is denied even though foreignLiveLease is false (own-lane in the #2367
    // regime would have been ALLOWED) — fail-closed replaces fail-open for marked lanes.
    expect(reason('git reset --hard', marked({ foreignLiveLease: false }))).toMatch(/workflow-lane lease/);
    // And a matching assertion allows it even if foreignLiveLease were true — the marked branch wins first.
    expect(reason(`LANE_SESSION=${SLUG} git reset --hard`, marked({ foreignLiveLease: true }))).toBeNull();
  });

  it('the LANE_CLOBBER_OK=1 escape passes a marked-lane destructive op through (mismatch or absence)', () => {
    expect(reason('LANE_CLOBBER_OK=1 git reset --hard', marked())).toBeNull();
    expect(reason('LANE_CLOBBER_OK=1 LANE_SESSION=wrong git clean -fd', marked())).toBeNull();
  });

  it('never fires on a non-destructive command, even under a marked lease', () => {
    expect(reason('git status', marked())).toBeNull();
    expect(reason('git push origin lane/foo', marked())).toBeNull();
    expect(reason(`node scripts/lane-pool.mjs release --lane=3`, marked())).toBeNull();
  });

  it('never fires from a primary cwd (a lane-only concept)', () => {
    expect(reason('git reset --hard', { primaryCwd: true, markedLeaseSlug: SLUG })).toBeNull();
  });

  it('no marked lease (markedLeaseSlug null) → falls back to the #2367 unmarked regime', () => {
    expect(reason('git reset --hard', { primaryCwd: false, markedLeaseSlug: null, foreignLiveLease: true })).toMatch(/LIVE lease held by ANOTHER session/);
    expect(reason('git reset --hard', { primaryCwd: false, markedLeaseSlug: null, foreignLiveLease: false })).toBeNull();
  });

  it('decide() surfaces the #2413 denial across a &&-chained command (the incident shape)', () => {
    expect(decide('git fetch origin && git reset --hard origin/main', marked())).toMatch(/must ASSERT the lease's own slug/);
    // the same chain, slug asserted on the destructive segment → allowed
    expect(decide(`git fetch origin && LANE_SESSION=${SLUG} git reset --hard origin/main`, marked())).toBeNull();
  });
});

// ── #2997 — the contested-sibling arm, and the repro table it closes ─────────────────────────────────────
describe('guard-bash — contested-sibling lease slug-assertion block (#2997)', () => {
  const HOLDER = 'conveyor-delivery-lane-5-9f3a1c07';
  const contested = (over = {}) => ({ primaryCwd: false, contestedHolderSlug: HOLDER, ...over });

  // THE GAP, as the card's repro table states it. Rows 1–3 are the SHIPPED behaviour verified against
  // #2367/#2413; row 4 is the hole this item closes — an unmarked lease whose ownerSession equals mine
  // because a SIBLING AGENT of my own session holds it, which read as "my own lane" and was ALLOWED.
  it('the 3-row repro table still decides exactly as #2367/#2413 shipped it (no refusal weakened)', () => {
    const cmd = 'git reset --hard HEAD~3';
    // row 1 — unmarked lease, ownerSession OTHER ⇒ DENY (#2367)
    expect(reason(cmd, { primaryCwd: false, foreignLiveLease: true })).toMatch(/LIVE lease held by ANOTHER session/);
    // row 2 — marked workflowLane, no slug asserted ⇒ DENY (#2413)
    expect(reason(cmd, { primaryCwd: false, markedLeaseSlug: 'batch-x-2427' })).toMatch(/workflow-lane lease/);
    // row 3 — unmarked lease, ownerSession MINE, and NO sibling holds a lane ⇒ ALLOW (genuinely my own lane)
    expect(reason(cmd, { primaryCwd: false, foreignLiveLease: false, contestedHolderSlug: null })).toBeNull();
  });

  it('row 4 (THE GAP) — an unmarked lease held by a SIBLING of my own session is now DENIED', () => {
    // Pre-#2997 this ctx produced exactly `null`: ownerSession matched, the lease was unmarked, and the
    // guard had no third signal. The 2026-08-08 `reset --hard` in a same-session sibling's lane is this row.
    expect(reason('git reset --hard HEAD~3', contested())).toMatch(/CONTESTED/);
    expect(reason('git clean -fd', contested())).toMatch(/LANE_SESSION=conveyor-delivery-lane-5-9f3a1c07/);
    expect(reason('git checkout -- .', contested())).toMatch(/denied fail-closed/);
    expect(reason('git push --force origin lane/x', contested())).toMatch(/CONTESTED/);
  });

  it('DENIES a destructive op that asserts the WRONG holder slug (fail-closed mismatch)', () => {
    expect(reason('LANE_SESSION=some-other-lane-3-11112222 git reset --hard', contested())).toMatch(/a MISMATCH/);
  });

  it('ALLOWS the true holder\'s own op once it asserts the exact minted slug', () => {
    expect(reason(`LANE_SESSION=${HOLDER} git reset --hard origin/main`, contested())).toBeNull();
    expect(reason(`LANE_SESSION=${HOLDER} git clean -fd`, contested())).toBeNull();
  });

  it('MUST-ALLOW: an uncontested own lane is completely unaffected — no new friction on the normal flow', () => {
    // The solo topology (one session, one lane) never sets contestedHolderSlug, so every ordinary refresh
    // idiom stays exactly as allowed as it was before #2997.
    const solo = { primaryCwd: false, foreignLiveLease: false, contestedHolderSlug: null };
    expect(reason('git reset --hard origin/main', solo)).toBeNull();
    expect(reason('git clean -fd', solo)).toBeNull();
    expect(decide('git fetch origin -q && git reset --hard origin/main && git clean -fd', solo)).toBeNull();
  });

  it('a MARKED lease keeps #2413 precedence — the contested arm never displaces it', () => {
    // Both signals present: the marked message (and the marked slug) must win, so #2413's refusal is intact.
    const both = { primaryCwd: false, markedLeaseSlug: 'batch-x-2427', contestedHolderSlug: HOLDER };
    expect(reason('git reset --hard', both)).toMatch(/workflow-lane lease/);
    expect(reason(`LANE_SESSION=${HOLDER} git reset --hard`, both)).toMatch(/a MISMATCH/); // holder slug is NOT the marked slug
    expect(reason('LANE_SESSION=batch-x-2427 git reset --hard', both)).toBeNull();
  });

  it('the LANE_CLOBBER_OK=1 escape passes a contested destructive op through (absence or mismatch)', () => {
    expect(reason('LANE_CLOBBER_OK=1 git reset --hard', contested())).toBeNull();
    expect(reason('LANE_CLOBBER_OK=1 LANE_SESSION=wrong git clean -fd', contested())).toBeNull();
  });

  it('never fires on a non-destructive command, nor from a primary cwd', () => {
    expect(reason('git status', contested())).toBeNull();
    expect(reason('git push origin lane/foo', contested())).toBeNull();
    expect(reason('git reset --hard', { primaryCwd: true, contestedHolderSlug: HOLDER })).toBeNull();
  });

  it('decide() surfaces the #2997 denial across a &&-chained command (the real refresh idiom)', () => {
    expect(decide('git fetch origin -q && git reset --hard origin/main', contested())).toMatch(/CONTESTED/);
    expect(decide(`git fetch origin -q && LANE_SESSION=${HOLDER} git reset --hard origin/main`, contested())).toBeNull();
  });
});

// The impure half of the #2997 Bash arm: which OTHER lanes in the pool hold a live lease. Proved against a
// real on-disk pool layout, because that is where the "sibling" set actually comes from.
describe('guard-bash — siblingLaneLeases reads the real pool layout (#2997)', () => {
  const root = mkdtempSync(join(realpathSync(tmpdir()), 'guard-bash-pool-'));
  afterAll(() => rmSync(root, { recursive: true, force: true }));
  const pool = join(root, '.lanes', 'web-everything');
  const NOW = Date.parse('2026-08-14T12:00:00.000Z');
  const writeLease = (n, lease) => {
    mkdirSync(join(pool, `lane-${n}`, '.git'), { recursive: true });
    writeFileSync(join(pool, `lane-${n}`, '.git', '.lane-lease'), JSON.stringify(lease));
  };
  const live = (over) => ({ session: 's', acquiredAt: new Date(NOW - 60_000).toISOString(), ttlMinutes: 240, ...over });

  it('returns every OTHER lane\'s LIVE lease, excluding this lane and any stale one', () => {
    writeLease(3, live({ ownerSession: 'sess-shared', holder: 'h-3' }));                                   // this lane
    writeLease(5, live({ ownerSession: 'sess-shared', holder: 'h-5' }));                                   // live sibling
    writeLease(6, live({ ownerSession: 'sess-other', holder: 'h-6' }));                                    // live, other session
    writeLease(7, { session: 's', acquiredAt: '2020-01-01T00:00:00.000Z', ttlMinutes: 240, holder: 'h-7' }); // STALE
    mkdirSync(join(pool, 'lane-8'), { recursive: true });                                                   // no lease at all

    const got = siblingLaneLeases(join(pool, 'lane-3'), NOW).map((l) => l.holder).sort();
    expect(got).toEqual(['h-5', 'h-6']);
  });

  // r2 (independent review of PR #1234, F3/R2). The first cut scanned only `dirname(laneRoot)` — this lane's
  // OWN pool — so a sibling agent holding a lane in a DIFFERENT pool left nothing to find and the destructive
  // op was allowed. That shape is ordinary, not exotic: a cross-locus couple leases one lane in the
  // web-everything pool and one in the plateau-app pool (the exact case `release --all-pools` exists for), and
  // the ambient session id is precisely as ambiguous across pools as within one.
  it('scans EVERY pool under .lanes/, not just this lane\'s own pool (review F3/R2)', () => {
    const other = join(root, '.lanes', 'plateau-app');
    mkdirSync(join(other, 'lane-2', '.git'), { recursive: true });
    writeFileSync(join(other, 'lane-2', '.git', '.lane-lease'), JSON.stringify(live({ ownerSession: 'sess-shared', holder: 'h-cross' })));
    // A file sitting where a pool would be, and a pool holding a stale lease: neither may throw or leak.
    writeFileSync(join(root, '.lanes', 'not-a-pool'), 'x\n');

    const got = siblingLaneLeases(join(pool, 'lane-3'), NOW).map((l) => l.holder).sort();
    expect(got).toContain('h-cross');
    expect(got).toEqual(['h-5', 'h-6', 'h-cross']);
  });

  it('fails OPEN (empty) on a missing pool — a guard fault must never wedge the agent', () => {
    expect(siblingLaneLeases(join(root, 'nope', 'lane-1'), NOW)).toEqual([]);
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

describe('guard-bash — primary-tree-write build backstop (#2749/#2788, 4th arm)', () => {
  it('isTreeWritingBuildRun: an actual RUN of build/build:docs/build:demo (npm/pnpm/yarn/run-s/run-p), excluding build:check + build:plugs', () => {
    expect(isTreeWritingBuildRun('npm run build')).toBe(true);
    expect(isTreeWritingBuildRun('npm run build:docs')).toBe(true);
    expect(isTreeWritingBuildRun('npm run build:demo')).toBe(true);
    expect(isTreeWritingBuildRun('pnpm build')).toBe(true);
    expect(isTreeWritingBuildRun('yarn build')).toBe(true);
    expect(isTreeWritingBuildRun('run-s build:docs build:demo')).toBe(true);
    // excluded — /tmp output + already its own separate arm
    expect(isTreeWritingBuildRun('npm run build:check')).toBe(false);
    expect(isTreeWritingBuildRun('npm run build:plugs')).toBe(false);
    // a mention, not a run
    expect(isTreeWritingBuildRun('echo "run npm run build later"')).toBe(false);
    expect(isTreeWritingBuildRun('git commit -m "wire npm run build into ci"')).toBe(false);
    // an unrelated identifier that merely contains "build" is not a build run
    expect(isTreeWritingBuildRun('npm run buildSomethingElse')).toBe(false);
    expect(isTreeWritingBuildRun('npm test')).toBe(false);
  });

  it('isGeneratorScriptRun: a node invocation of a generate*/scaffold*.mjs script by name', () => {
    expect(isGeneratorScriptRun('node scripts/generate-report.mjs')).toBe(true);
    expect(isGeneratorScriptRun('node scripts/new-standard-scaffold.mjs --name=foo')).toBe(true);
    expect(isGeneratorScriptRun('node scripts/Generate.js')).toBe(true);
    // NOT a generator script: an unrelated script, or a `scaffold` SUBCOMMAND argument (not the script's own name)
    expect(isGeneratorScriptRun('node scripts/backlog.mjs scaffold 1234')).toBe(false);
    expect(isGeneratorScriptRun('node scripts/lane-pool.mjs acquire --lane=1')).toBe(false);
  });

  it('isFileWriteRedirect: sed -i / perl -pi / tee / a trailing shell redirect writing a non-scratch file', () => {
    expect(isFileWriteRedirect('sed -i s/x/y/ config/app.json')).toBe(true);
    expect(isFileWriteRedirect('perl -pi -e "s/x/y/" config/app.json')).toBe(true);
    expect(isFileWriteRedirect('tee config/app.json')).toBe(true);
    expect(isFileWriteRedirect('tee -a config/app.json')).toBe(true);
    expect(isFileWriteRedirect('echo hello > config/app.json')).toBe(true);
    expect(isFileWriteRedirect('cat template.json >> config/app.json')).toBe(true);
    // scratch targets (/tmp, /dev) are allowed — the standard lane-workflow idiom for scratch files
    expect(isFileWriteRedirect('sed -i s/x/y/ /tmp/scratch.json')).toBe(false);
    expect(isFileWriteRedirect('tee /tmp/pr-body-2788.md')).toBe(false);
    expect(isFileWriteRedirect('echo hello > /tmp/out.log')).toBe(false);
    expect(isFileWriteRedirect('node scripts/x.mjs > /dev/null')).toBe(false);
    // a literal `>` inside a quoted string is NOT a redirect (the trailing-anchor + closing-quote breaks it)
    expect(isFileWriteRedirect('git commit -m "fix > bug"')).toBe(false);
    expect(isFileWriteRedirect('git commit -m "fix > bug.txt"')).toBe(false);
    // fd-duplication / combined redirects are not a file write
    expect(isFileWriteRedirect('npm run check:standards > log.txt 2>&1')).toBe(true); // still writes log.txt
    expect(isFileWriteRedirect('npm test 2>&1')).toBe(false);
    // no redirect/tee/sed/perl at all
    expect(isFileWriteRedirect('git status')).toBe(false);
    expect(isFileWriteRedirect('')).toBe(false);
  });

  // ── #2788 review regressions ────────────────────────────────────────────────────────────────────
  // Each case below FAILED on the first cut of this arm and was caught by the review jury.

  it('isFileWriteRedirect: the REAL platform scratch roots are scratch, not primary-tree writes', () => {
    // The sanctioned per-session scratchpad every agent is handed is spelled `/private/tmp/claude-<uid>/…`
    // (macOS resolves `/tmp` through that symlink); `$TMPDIR` resolves to `/var/folders/<xx>/<yy>/T/…`.
    // Matching only `^/tmp/` denied an agent's own scratchpad — the most common legitimate write there is.
    expect(isFileWriteRedirect('echo hi > /private/tmp/claude-501/sess/scratch.txt')).toBe(false);
    expect(isFileWriteRedirect('tee /private/tmp/claude-501/sess/body.md')).toBe(false);
    expect(isFileWriteRedirect('echo hi > /var/folders/ab/cd/T/scratch.txt')).toBe(false);
    expect(isFileWriteRedirect('echo hi > /var/tmp/scratch.txt')).toBe(false);
    // …while a path that merely CONTAINS a temp-looking segment is still a tree write (anchored, not loose)
    expect(isFileWriteRedirect('echo hi > docs/private/tmp/notes.md')).toBe(true);
    expect(isFileWriteRedirect('echo hi > ./tmp/notes.md')).toBe(true);
  });

  it('isTreeWritingBuildRun: an excluded target named ELSEWHERE cannot disarm a real tree build', () => {
    const CHECK = `build:${'check'}`;
    const PLUGS = `build:${'plugs'}`;
    // the exclusion is tested against the MATCHED target, never the whole segment
    expect(isTreeWritingBuildRun(`npm run build && echo ${CHECK}`)).toBe(true);
    expect(isTreeWritingBuildRun(`npm run build # see ${PLUGS}`)).toBe(true);
    // a genuinely excluded target still excludes
    expect(isTreeWritingBuildRun(`npm run ${CHECK}`)).toBe(false);
    expect(isTreeWritingBuildRun(`npm run ${PLUGS}`)).toBe(false);
  });

  // ── #2788 review ROUND 2 regressions ────────────────────────────────────────────────────────────
  // The round-1 fixes were themselves bypassable; each case below failed on that cut.

  it('isTreeWritingBuildRun: NO placement of an excluded target can disarm a real build', () => {
    const CHECK = `build:${'check'}`;
    const PLUGS = `build:${'plugs'}`;
    // r1 extracted ONE target (the first in a greedy match), so an excluded name placed BEFORE a real one
    // disarmed the arm — the same bypass r1 was meant to close, one spelling further out.
    expect(isTreeWritingBuildRun(`run-s ${CHECK} build`)).toBe(true);
    expect(isTreeWritingBuildRun(`run-s build ${CHECK}`)).toBe(true);
    expect(isTreeWritingBuildRun(`run-p ${PLUGS} build:docs`)).toBe(true);
    // …while a segment whose targets are ALL excluded still stays quiet
    expect(isTreeWritingBuildRun(`run-s ${CHECK} ${PLUGS}`)).toBe(false);
    expect(isTreeWritingBuildRun(`npm run ${CHECK}`)).toBe(false);
    // and a word merely CONTAINING "build" is not a build target
    expect(isTreeWritingBuildRun('npm run test --rebuild-cache')).toBe(false);
    expect(isTreeWritingBuildRun('git commit -m "npm run build"')).toBe(false);
  });

  it('isFileWriteRedirect: a QUOTED path is unquoted before the scratch allowlist sees it', () => {
    // r1 tested the raw shell token against an anchored `^/tmp/`, so quoting a scratch path — ordinary
    // hygiene, and required for a path with a space — read as a primary-tree write and was denied.
    expect(isFileWriteRedirect('tee "/tmp/x"')).toBe(false);
    expect(isFileWriteRedirect("tee '/tmp/x'")).toBe(false);
    expect(isFileWriteRedirect('sed -i s/a/b/ "/tmp/x"')).toBe(false);
    expect(isFileWriteRedirect('echo hi > "/private/tmp/claude-501/s.txt"')).toBe(false);
    // …and the mirror bypass: a QUOTED tree target must still be caught (the old `[\w./-]+` class
    // excluded quote chars, so a quoted redirect matched nothing at all).
    expect(isFileWriteRedirect('echo hi > "config/app.json"')).toBe(true);
    expect(isFileWriteRedirect('tee "docs/x.md"')).toBe(true);
  });

  it('hasLeadingEnvEscape: the escape counts only as a LEADING assignment, never as a mention', () => {
    const V = 'MAIN_SESSION_BUILD_OK';
    expect(hasLeadingEnvEscape(`${V}=1 npm run build`, V)).toBe(true);
    expect(hasLeadingEnvEscape(`FOO=x ${V}=1 npm run build`, V)).toBe(true);
    // a mention anywhere else must NOT disarm the guard
    expect(hasLeadingEnvEscape(`git commit -m "see ${V}=1 in docs"`, V)).toBe(false);
    expect(hasLeadingEnvEscape(`echo ${V}=1`, V)).toBe(false);
    expect(hasLeadingEnvEscape(`grep ${V}=1 docs/agent/x.md`, V)).toBe(false);
    // only the documented `=1` value opts out
    expect(hasLeadingEnvEscape(`${V}=0 npm run build`, V)).toBe(false);
    expect(hasLeadingEnvEscape('npm run build', V)).toBe(false);
  });

  it('primaryTreeWriteReason returns a reason for each of the three shapes, null otherwise', () => {
    expect(primaryTreeWriteReason('npm run build')).toMatch(/WRITES the shared PRIMARY tree/);
    expect(primaryTreeWriteReason('node scripts/generate-report.mjs')).toMatch(/generator\/scaffold script/);
    expect(primaryTreeWriteReason('echo hi > config/app.json')).toMatch(/redirect.*writing a file/);
    expect(primaryTreeWriteReason('npm run build:check')).toBeNull();
    expect(primaryTreeWriteReason('git status')).toBeNull();
  });

  it('reason() denies the tree-write ONLY when cwd is primary; a lane clone is untouched', () => {
    expect(reason('npm run build', { primaryCwd: true })).toMatch(/#2749\/#2788/);
    expect(reason('npm run build', { primaryCwd: false })).toBeNull();
    expect(reason('node scripts/generate-report.mjs', { primaryCwd: true })).toMatch(/generator\/scaffold script/);
    expect(reason('node scripts/generate-report.mjs', { primaryCwd: false })).toBeNull();
    expect(reason('echo hi > config/app.json', { primaryCwd: true })).toMatch(/writing a file/);
    expect(reason('echo hi > config/app.json', { primaryCwd: false })).toBeNull();
  });

  it('the MAIN_SESSION_BUILD_OK=1 escape passes a primary-cwd tree-write through (mirrors MAIN_PUSH_OK)', () => {
    expect(reason('MAIN_SESSION_BUILD_OK=1 npm run build', { primaryCwd: true })).toBeNull();
    expect(reason('MAIN_SESSION_BUILD_OK=1 node scripts/generate-report.mjs', { primaryCwd: true })).toBeNull();
    expect(reason('MAIN_SESSION_BUILD_OK=1 echo hi > config/app.json', { primaryCwd: true })).toBeNull();
  });

  it('decide() surfaces the tree-write denial across a full &&-chained command', () => {
    expect(decide('cd /ws/webeverything && npm run build', { primaryCwd: true })).toMatch(/#2749\/#2788/);
  });

  it('does not fire on a genuinely unrelated primary-cwd command', () => {
    expect(reason('git status', { primaryCwd: true })).toBeNull();
    expect(reason('ls backlog', { primaryCwd: true })).toBeNull();
    expect(reason('node scripts/lane-pool.mjs acquire --lane=1', { primaryCwd: true })).toBeNull();
  });

  it('mainSessionDelegateNudge: WARNS (never denies) on a verification-set run at primary cwd; null otherwise', () => {
    expect(mainSessionDelegateNudge('npm run check:standards', { primaryCwd: true })).toMatch(/should delegate mechanical work/);
    expect(mainSessionDelegateNudge('npm test', { primaryCwd: true })).toMatch(/WARN, not a denial/);
    // not primary cwd → no nudge (a lane's own verify is sanctioned, nothing to nudge)
    expect(mainSessionDelegateNudge('npm run check:standards', { primaryCwd: false })).toBeNull();
    expect(mainSessionDelegateNudge('npm run check:standards')).toBeNull(); // default ctx
    // not a verification run → no nudge
    expect(mainSessionDelegateNudge('git status', { primaryCwd: true })).toBeNull();
    // the nudge never feeds the deny channel — reason()/decide() are untouched by it
    expect(reason('npm run check:standards', { primaryCwd: true })).toBeNull();
    expect(decide('npm run check:standards', { primaryCwd: true })).toBeNull();
  });
});

// ── #2788 review ROUND 3 — the two-sided fixture corpus ─────────────────────────────────────────────────
// Round 3 found the same defect five ways: a hand-written regex validated against the examples it was
// written from, so precision fixes silently ate recall and vice-versa. The durable guard is a TWO-SIDED
// table — every family lists EQUIVALENT SPELLINGS of one effect and asserts they all decide identically —
// so the two sides get tuned against each other instead of one example at a time.
describe('guard-bash — #2788 r3: equivalent spellings decide identically', () => {
  const CHECK = `build:${'check'}`;
  const PLUGS = `build:${'plugs'}`;
  const at = (cmd) => decide(cmd, { primaryCwd: true });

  // MUST ALWAYS DENY — one family per row: the same tree write, spelled every way it is reachable.
  const MUST_DENY = {
    'wrapper-prefixed build (r3 finding 1)': [
      'npm run build', 'env npm run build', 'time npm run build', 'command npm run build',
      'nice npm run build', 'sudo npm run build', 'FOO=1 npm run build', 'npx run-s build:docs',
      'xargs -n1 npm run build', '(npm run build)',
    ],
    'the build TOOL the alias delegates to (r3 finding 5)': [
      'vite build', 'npx vite build', './node_modules/.bin/eleventy', 'npx eleventy',
      'eleventy --output=_site', 'env vite build',
    ],
    'a redirect anywhere in the segment, not just at its end (r3 finding 2)': [
      'echo hi > config/app.json', 'cat t.json >> config/app.json',
      "cat > config/app.json <<'EOF'", '> config/app.json echo hi', '>| config/app.json',
      'echo hi > "config/app.json"', 'echo hi>config/app.json', 'echo hi &> config/app.json',
      'echo hi 2> config/app.json',
    ],
    "this repo's actual generators (r3 finding 3)": [
      'node scripts/gen-inventory.mjs', 'node scripts/gen-reference-index.mjs',
      'node scripts/gen-wrapper/cli.mjs', 'node scripts/gen-cem.mjs', 'npm run gen:inventory',
      'node scripts/generate-report.mjs', 'node scripts/new-standard-scaffold.mjs --name=foo',
      'env node scripts/gen-inventory.mjs',
    ],
    'multi-target / alternate-flag in-place writes (r3 finding 4)': [
      'sed -i s/x/y/ config/app.json', 'sed -i s/x/y/ config/app.json /tmp/x',
      'sed -i s/x/y/ /tmp/x config/app.json', 'sed --in-place s/x/y/ config/app.json',
      'sed -i.bak s/x/y/ config/app.json', 'env sed -i s/x/y/ config/app.json',
      "perl -pi -e 's/x/y/' config/app.json", "perl -i -pe 's/x/y/' config/app.json",
      "perl -i.bak -pe 's/x/y/' config/app.json",
      'tee config/app.json', 'tee -a config/app.json', 'tee /tmp/x config/app.json',
      'tee -a -- config/app.json',
    ],
    // #2994 — the recall half of the quote-aware split. A REAL unquoted redirect after a REAL unquoted pipe
    // must still deny. The quote-blind split used to TEAR at a quoted pipe and leave the tail fragment with
    // an unbalanced quote that SWALLOWED the trailing redirect — so these were wrongly ALLOWED before, and
    // the split fix closes that hole in the same stroke it clears the false denies below.
    'a real unquoted pipe into a real unquoted write (#2994, recall half)': [
      'ls | grep x > config/app.json', 'cat a.txt | tee config/app.json',
      'ls | grep x | tee -a config/app.json', 'echo hi | sed -i s/a/b/ config/app.json',
      "gh pr list --jq '.[] | .number' > config/app.json",
      "gh pr list --jq '.[] | select(.n > 5)' | tee config/app.json",
      "echo 'a | b' > config/app.json", 'echo "a|b" > config/app.json',
      "jq '.a | .b' x.json > config/app.json",
      "perl -i -pe 's/x|y/z/' config/app.json",
      'ls; npm run build', 'ls && echo hi > config/app.json',
    ],
    // The precision family above buys nothing unless its recall mirror holds: the SAME quoted alternation
    // with a REAL trailing redirect must still deny. This is the direction the splitter could plausibly
    // have broken — not cutting inside quotes must not mean failing to see the operator outside them.
    'a quoted alternation followed by a REAL write (#2994 fifth class, recall half)': [
      'grep -cE "a|=>" AGENTS.md > config/app.json',
      'grep -cE "a|=>" AGENTS.md >> config/app.json',
      "grep -cE 'a|=>' AGENTS.md | tee config/app.json",
      'rg -e "x|y=>z" src > config/app.json',
      'sed -n "/a|=>/p" f.txt > config/app.json',
      'node -e \'console.log("a|b" + "=>")\' > config/app.json',
    ],
    // #2986(2) — the recall half of the script-name scan: every real build alias, in every runner spelling.
    'a real build alias, only the script-name position (#2986/2, recall half)': [
      'npm run build', 'npm run-script build', 'npm run --silent build', 'npm run build -- --mode=prod',
      'pnpm build', 'pnpm run build', 'yarn build', 'yarn run build:docs', 'run-s lint build',
      'run-s build build:check', 'npm-run-all --parallel build:demo', 'npm run build-docs',
      // …and the runner-`exec`/`dlx` form, whose remainder is a COMMAND, not a script name.
      'pnpm exec vite build', 'npm exec -- vite build', 'yarn dlx eleventy', 'pnpm dlx vite build',
    ],
    // #2986(1) — the recall half of the empty-operand drop: a BSD `-i ''` edit of a TRACKED file still denies.
    "BSD in-place `-i ''` on a TRACKED path (#2986/1, recall half)": [
      "sed -i '' s/a/b/ config/app.json", 'sed -i "" s/a/b/ config/app.json',
      "sed -i '' -e s/a/b/ config/app.json", "sed -i '' s/a/b/ /tmp/x config/app.json",
      "sed -i '' -e 's/a|b/c/' config/app.json", "tee '' config/app.json",
    ],
    // #2986(3) — the recall half of the eleventy flag allowlist: the flags that REALLY write the site dir.
    // #2994 review r2 — an ESCAPED quote inside a quoted argument. `splitSegments`/`shellTokens` ended a
    // quoted run at the first `"` they found, so `\"` (which bash reads as a LITERAL quote inside a
    // double-quoted run — `bash -c 'echo "a\"b"'` prints `a"b`) left the parser one quote out of phase; the
    // NEXT `"` then opened a run with no closer and swallowed the whole rest of the line as one blob, so
    // EVERY deny arm below read a single unrecognisable segment. An EVEN number of escaped quotes does not
    // re-sync it (`"a\"b\"c"` shifts the phase twice). Escaping a quote inside a commit message / `node -e`
    // / `jq` filter is everyday work, which is what made this a live total bypass rather than a corner case.
    'an escaped quote inside a quoted argument (#2994 r2, recall half)': [
      'git commit -m "guard: reject \\"a|b\\" input" && npm run build',
      'node -e "console.log(\\"hi\\")" && npm run build',
      'jq -r "\\"x\\"" /tmp/a.json && echo y > src/foo.ts',
      "echo \"a\\\"b\" && sed -i '' s/a/b/ config/app.json",
      'echo "a\\"b" && eleventy',
      'echo "a\\"b" && vite build',
      "echo $'a\\'b' && npm run build",          // `$'…'` (ANSI-C) honours `\'` the same way
      'echo "a\\"b\\"c" && npm run build',       // an EVEN count does NOT re-sync the old scanner
      'echo "a\\"b" > config/app.json',          // the same desync in `shellTokens`, no separator involved
    ],
    // #2994 review r2 — the `exec`/`dlx` narrowing only matched `<runner> exec|dlx [--] <program>`, so ANY
    // flag in between became the recursed "program", and the script-name scan took the first non-flag word,
    // so a runner-level selector's VALUE (or a workspace NAME) was mistaken for the subcommand. Every row
    // here is a real build that writes `dist/`/`_site/` at the cwd it runs in.
    'a runner exec/dlx or workspace form with flags in the way (#2994 r2, recall half)': [
      'npm exec --package=vite vite build', 'npm exec --package=vite -- vite build',
      "npm exec -c 'vite build'", 'npm exec --yes vite build', 'npm exec --no vite build',
      'pnpm exec --silent vite build', 'pnpm dlx --package=vite vite build',
      'pnpm --filter web exec vite build', 'pnpm --filter web dlx vite build',
      'yarn workspace web build', 'yarn dlx -q eleventy',
      'npm exec --package=vite -- vite build --mode=prod',
      // …and the spellings that were ALREADY right, pinned so the rewrite keeps them
      'npm run --workspace=web build', 'npm --workspace=web run build', 'pnpm -r run build',
    ],
    // ── #2994 review r3 — the PARSER'S OWN failure modes ──────────────────────────────────────────────
    // Every round of this review closed one shape and opened another of the same class, because the corpus
    // kept testing the class the author was thinking about (which tree writes count) and never the states
    // the PARSER can reach. Not one row above exercises an unterminated quote, a `#` comment or a
    // `\`+newline. These families do. Each was cross-checked against real `bash -c` before being written.
    'an apostrophe in a `#` comment must not swallow the next line (r3 F1)': [
      "# don't forget\nnpm run build",
      "echo one # don't forget\nnpm run build",
      "npm run build:check # don't\nvite build",
      "ls # it's a comment\necho hi > config/app.json",
      "ls # don't\nsed -i s/a/b/ config/app.json",
      'ls # see the "docs"\nnpm run build',
      "ls # don't; npm run build",              // a separator inside a comment still cuts, as it always did
    ],
    'a `#` that does NOT start a comment must not disarm the arm (r3 F1 mirror)': [
      'echo a#b > config/app.json',             // bash: `a#b` is one word, not a comment
      'echo "# not a comment" > config/app.json',
      "sed -i 's/#a/#b/' config/app.json",
      'npm run build "#tag"',
      'echo ${#PATH} > config/app.json',
    ],
    'a `\\`+newline line continuation must not hide the tree write (r3 F2)': [
      'echo a && \\\nnpm run build',            // after a separator — the reported F2 shape
      'echo a; \\\nnpm run build',
      'echo a || \\\nvite build',
      'vite \\\nbuild',                         // mid-command — bash splices it into one word list
      'npm run \\\ngen:inventory',
      'echo hi > \\\nconfig/app.json',
      'tee \\\nconfig/app.json',
      'npm run build \\',                       // a LONE trailing backslash on a real build
      'sed -i \\\ns/a/b/ config/app.json',
    ],
    'a phantom heredoc must not swallow the rest of the command (r3 audit)': [
      'echo "x << EOF"\nnpm run build',         // the `<<` is inside quotes — not an opener
      "echo 'a << b'\nvite build",
      'ls # see <<EOF\nnpm run build',          // …nor inside a comment
    ],
    'a subshell CLOSER must not defeat the arm (r3 audit — found by the differential fuzz)': [
      '(pnpm --filter web exec vite build)', '(npm exec vite build)', '(vite build)', '(vite build) \\',
      '{ npm run build; }', '(env "FOO=a b" npm run build)', 'sudo -u "some user" npm run build',
    ],
    // r5 F2 — the r3 fix above was POSITIONAL: `canonicalCommand` peeled a `)` only when it was the LAST
    // character of the segment, so ONE trailing token re-opened the hole while the r3 test kept passing.
    // Every shape below was confirmed to really build under real bash in a PATH-stubbed sandbox.
    'a subshell closer with a TRAILING token after it (r5 F2)': [
      '(pnpm exec vite build) >/dev/null', '(pnpm exec vite build) 2>/dev/null',
      '(pnpm exec vite build) #x', '(npm exec -- vite build) #x', '(vite build) >/dev/null 2>&1',
      '(npm run build) >/dev/null', '(eleventy) 2>/dev/null', '{ npm run build; } >/dev/null',
      'time (npm run build)', '(pnpm dlx eleventy) | cat',
      // …and the other half of the class: the group's LAST command keeps the closer glued to it when the
      // split cuts the group at a separator inside it.
      '(gh pr list --json number; pnpm dlx eleventy) >/dev/null',
      '(git status; vite build) >/dev/null',
    ],
    // r5 F1 — the text bash RE-EXECUTES. The quote-BLIND split of base tore these open at the separator
    // inside the quoted argument and denied by accident; making the split correct lost that coverage.
    // Recursing into the script-string positions restores it structurally — and covers the separator-free
    // spelling (`bash -c "npm run build"`) that base never caught at all.
    'a command bash RE-EXECUTES from a script string or substitution (r5 F1)': [
      'bash -c "npm run build"', 'sh -c "npm run build"', "bash -c 'npm run build'",
      'bash -c "cd src && npm run build"', 'bash -ec "vite build"', 'sh -c "eleventy"',
      'eval "npm run build"', "eval 'vite build'", 'eval "echo done; echo hi > config/app.json"',
      'OUT="$(cd . && npm run build)"', 'echo "$(npm run build)"', 'X=$(vite build)',
      'echo `npm run build`', 'X=`vite build`', 'echo "`eleventy`"',
      'echo $(gh pr list --json number; node scripts/gen-inventory.mjs)',
      "npm exec -c 'vite build'", 'xargs -n1 bash -c "npm run build"',
    ],
    'eleventy flags that really WRITE the site dir (#2986/3, recall half)': [
      'eleventy', 'eleventy --serve', 'eleventy --watch', 'eleventy --serve --port=8080',
      'eleventy --quiet', 'eleventy --incremental', '11ty --watch', 'npx eleventy',
      // …and `--serve`/`--watch` WIN over the no-write allowlist — they keep writing regardless.
      'eleventy --dryrun --serve', 'eleventy --version --serve', 'eleventy --help --watch',
      // a flag that merely STARTS with an allowlisted name is not on the allowlist
      'eleventy --versionx', 'eleventy --serveme',
    ],
  };

  // MUST NEVER DENY — the mirror side: pure-scratch / read-only work in every flag spelling.
  const MUST_ALLOW = {
    'scratch writes in every flag + quote spelling (r3 finding 6)': [
      'tee /tmp/x.log', 'tee -a /tmp/x.log', 'tee --append /tmp/x.log', 'tee -a -- /tmp/x.log',
      'tee -i -a /tmp/x.log', 'tee "/tmp/x.log"', "tee '/tmp/x.log'",
      'tee /private/tmp/claude-501/sess/body.md', 'tee /var/folders/ab/cd/T/x',
      'sed -i s/x/y/ /tmp/x.json', 'sed --in-place s/x/y/ /tmp/x.json',
      "perl -pi -e 's/x/y/' /tmp/x.json",
      'echo hi > /tmp/out.log', 'echo hi > /dev/null', 'echo hi > "/private/tmp/claude-501/s.txt"',
    ],
    'non-writes that merely LOOK like writes': [
      'git commit -m "fix > bug"', 'git commit -m "npm run build"', 'npm test 2>&1',
      'echo "a > b"', 'sed -n "1,5p" config/app.json', 'grep -rn ">" src/',
      'node scripts/backlog.mjs list', 'git status', 'vite dev', 'vite preview',
      'perl -Mlist::Util -e "print 1" data.txt',
    ],
    // ── the fifth false-deny class, found in ordinary work on 2026-08-08 (#3002 sweep clause) ─────────
    // A QUOTED ALTERNATION whose tail glues a character to `>`. Two conditions must coincide, which is
    // why the 145-command sweep missed it — each half alone is already allowed:
    //   1. a `|` inside quotes, which a quote-BLIND split tears the command at, and
    //   2. an `=`/`-`/digit immediately followed by `>` in the tail, which then reads as a real redirect
    //      operator (`=>`, `->`, `2>`) with the next word as its target.
    // Neither `grep -c "=>" f` nor `grep -c "a|b" f` is denied on base; `grep -cE "a|=>" f` is. The
    // splitter is what fixes it — it never cuts inside the quoted run, so no tail fragment exists.
    'a quoted alternation whose tail glues a char to `>` (#2994 fifth class)': [
      'grep -cE "a|=>" AGENTS.md', "grep -cE 'a|=>' AGENTS.md",
      'grep -E "foo|bar=>baz" README.md', 'grep -cE "a|->" AGENTS.md',
      'grep -cE "a|>=" AGENTS.md', 'grep -cE "a|2>" AGENTS.md',
      'rg -e "x|y=>z" src', 'rg "handler|on[A-Z]\\w+=>" src',
      'sed -n "/a|=>/p" f.txt', 'awk "/a|b/ { print }" f.txt',
      'node -e \'console.log("a|b" + "=>")\'', 'jq -r \'.a | .b\' data.json',
      'command grep -an "splitSegments|=>" scripts/guard-bash.mjs',
      // the arrow shape plus a genuine fd redirect to /dev/null — still a scratch write, still allowed
      'grep -cE "a|=>" AGENTS.md 2>/dev/null',
    ],
    'the excluded / separately-armed build targets': [
      `npm run ${CHECK}`, `run-s ${CHECK} ${CHECK}`, 'eleventy --output=/tmp/we-build-check --quiet',
    ],
    'the sanctioned escape, including through a wrapper': [
      'MAIN_SESSION_BUILD_OK=1 npm run build', 'env MAIN_SESSION_BUILD_OK=1 npm run build',
      'MAIN_SESSION_BUILD_OK=1 sed -i s/x/y/ config/app.json',
      'MAIN_SESSION_BUILD_OK=1 node scripts/gen-inventory.mjs',
    ],
    // ── the four #2986/#2994 false-deny classes. The corpus proved RECALL well (41/41 must-deny) and
    // precision barely at all, which is exactly how all four shipped. These are the mirror side.
    // #2994 — a `|` and a `>` in the SAME quoted argument. Neither alone tripped it; both always did.
    // `--jq '.[] | select(…)'` is *the* house idiom for reading GitHub state, so this one was hit live.
    'a pipe AND an angle bracket inside one quoted argument (#2994)': [
      "gh pr list --jq '.[] | select(.n > 5)' --state open",
      'gh pr list --jq ".[] | select(.n > 5)"',
      "gh pr list --state merged --json number,mergedAt --jq '.[] | select(.mergedAt > \"2026-08-07\") | .number'",
      "jq '.[] | select(.size > 8)' items.json",
      "echo 'a | b > c'", 'echo "a | b > c"',
      "git log --pretty='%h | %s' --since='2026-08-01'",
      "awk -F'|' '$2 > 3 { print }' data.txt",
      "node scripts/backlog.mjs list --filter='size > 8 | open'",
      // …and a real pipe into a real SCRATCH write is still fine
      "gh pr list --jq '.[] | select(.n > 5)' | tee /tmp/prs.json",
      'ls | grep x > /tmp/out.log', 'ls | grep x | tee -a /tmp/out.log',
      'git commit -m "fix: pipe | and > in one message"',
    ],
    // #2986(2) — the word `build` ANYWHERE in a package-runner segment used to fire the arm. Only the
    // runner's script-name argument position is a script name; a path, a package, or a flag is not.
    'the word `build` outside the runner script-name position (#2986/2)': [
      'npm run test:unit -- src/build-graph.test.ts',
      'npm run test:unit scripts/__tests__/build-manifest.test.mjs',
      'npm run test:unit -- --reporter=verbose src/rebuild.test.ts',
      'npm run lint src/build/', 'yarn run lint packages/buildkit',
      'npm install esbuild', 'npm install --build-from-source better-sqlite3',
      'npm ls esbuild', 'pnpm add node-gyp-build',
    ],
    // #2986(1) — BSD's in-place suffix is an EMPTY quoted argument. Counting it as a file operand shifted
    // the `files.slice(1)` so the sed SCRIPT read as the write target.
    "BSD in-place `-i ''` with an empty suffix, on a SCRATCH path (#2986/1)": [
      "sed -i '' s/a/b/ /tmp/scratch.txt", 'sed -i "" s/a/b/ /tmp/scratch.txt',
      "sed -i '' 's/a/b/' /private/tmp/claude-501/sess/x.md",
      "sed -i '' -e s/a/b/ /tmp/scratch.txt",
    ],
    // #2986(3) — bare `eleventy` with a flag that writes nothing. The arm allowed only a scratch `--output=`.
    'eleventy with a NON-build flag (#2986/3)': [
      'eleventy --version', 'eleventy --help', 'eleventy --dryrun', 'eleventy --dry-run',
      'npx eleventy --version', '11ty --version', './node_modules/.bin/eleventy --help',
      'env eleventy --version', 'eleventy --output=_site --dryrun',
    ],
    // #2994 r2 precision mirror — an escaped quote in a command that writes NOTHING must stay allowed, and
    // the single-quote rule must stay DIFFERENT: bash honours no escape inside `'…'`, so `echo 'a\'` is a
    // complete word and applying the double-quote rule there would be a new desync in the other direction.
    'an escaped quote in a command that writes nothing (#2994 r2)': [
      'git commit -m "guard: reject \\"a|b\\" input"',
      'echo "he said \\"hi\\""',
      'node -e "console.log(\\"hi\\")"',
      'gh pr list --jq ".[] | select(.title | test(\\"fix\\"))"',
      'git commit -m "fix \\"quoted\\" > thing"',
      "echo 'a\\' && echo ok",
      'jq -r "\\"x\\"" /tmp/a.json',
      "printf '%s\\n' \"a\\\"b\"",
      'echo "a\\"b" > /tmp/out.log',
      'git commit -m "guard: reject \\"a|b\\" input" && npm run build:check',
      "echo $'a\\'b' && npm run test:unit",
    ],
    // #2994 r2 precision mirror — the exec/dlx rewrite must not turn every flagged runner form into a deny:
    // what matters is the TOOL it lands on, not that a flag was present.
    // ── #2994 review r3 — the precision mirror of the parser's own failure modes ──────────────────────
    // Cross-checked against real `bash -c`: `echo a#b` prints `a#b`; `echo a #b` prints `a`; `echo ${#x}`
    // prints a length; `echo a \`⏎`b` prints `a b`; `echo a \` (lone trailing backslash) prints `a`.
    "the parser's own failure modes, on commands that write NOTHING (r3 audit)": [
      'echo a#b', 'curl https://example.com/#frag', 'git commit -m "fix #123"',
      'echo "# not a comment"', "echo '# nor this'", 'echo ${#PATH}', 'echo $#',
      "ls # don't forget", 'ls # a "quoted" word', 'git status # npm run build:check',
      "ls -la # it's fine\ngit status",
      'echo ok \\', 'ls -la \\', 'echo hello \\\n  world', 'ls -la \\\n  --color=auto',
      "gh pr list \\\n  --jq '.[] | select(.n > 5)'",
      'git status \\\n  --short',
      "cat > /tmp/body.md <<'EOF'\ndon't do it — it's a trap\na \"quoted\" line\nnpm run build\nEOF",
    ],
    // ── r5 precision mirrors — the recursion must not turn every nested command into a deny ─────────
    // The re-execution recursion (F1) reads a `$( )`/backtick body, a subshell body and an
    // `eval`/`sh -c`/`bash -c` string at command position. That is a lot of new text reaching the deny
    // arms, so these are the commands an agent really runs through those same positions.
    'a script string / substitution whose command writes NOTHING (r5 F1)': [
      'echo "$(git rev-parse --short HEAD)"', 'BR="$(git branch --show-current)"; echo "$BR"',
      'N=$(gh pr list --json number --jq "length"); echo $N',
      'test -n "$(git status --porcelain)" && echo dirty',
      'echo `git rev-parse HEAD`', 'X=`date +%s`; echo $X',
      'bash -c "npm run test:unit"', 'sh -c "git status"', 'bash -lc "node --version"',
      'bash scripts/setup.sh', 'eval "$(direnv hook bash)"', 'eval "echo hi"',
      'echo "$(npm run build:check)"', 'for f in $(ls scripts); do echo $f; done',
      // a `"…"` script string arrives with its `\"` escapes RESOLVED, exactly as the inner shell sees it —
      // otherwise the `|` in this message reads as an unquoted separator and #2994's false deny returns
      // one level down.
      'sh -c "git commit -m \\"fix: a | b > c\\""',
      'bash -c "gh pr list --jq \'.[] | select(.n > 5)\'"',
      // …and the sanctioned escape is EXPORTED into the re-executed command, so it must still disarm it
      // (verified: `FOO=1 bash -c \'echo $FOO\'` prints 1).
      'MAIN_SESSION_BUILD_OK=1 bash -c "npm run build"', 'MAIN_SESSION_BUILD_OK=1 eval "npm run build"',
      'MAIN_SESSION_BUILD_OK=1 sh -c "npm run build && npm run build:docs"',
      'MAIN_PUSH_OK=1 bash -c "git push origin main"',
    ],
    'a subshell with a trailing token whose command writes NOTHING (r5 F2)': [
      '(cd /tmp && ls) >/dev/null', '(npm run test:unit) 2>&1', '(git status; git diff) | head -40',
      '{ echo a; echo b; } > /tmp/out.txt', '(eleventy --version) >/dev/null',
      '(eleventy --dryrun) 2>/dev/null', '(npm run build:check) >/dev/null', '(git status) #x',
    ],
    'a runner exec/dlx form whose tool writes nothing (#2994 r2)': [
      'npm exec --package=vitest vitest run', 'npm exec -- tsc --noEmit', 'pnpm exec eslint src/',
      'npm exec --package=vite vite preview', 'yarn workspace web test', 'pnpm --filter web exec eslint .',
      'npm run --workspace=web test:unit', "npm exec -c 'echo build'",
      'npm exec --package=esbuild esbuild --version',
      'pnpm dlx --package=@11ty/eleventy eleventy --version',
      'npm exec', 'npm exec --', 'npm exec -c',
    ],
  };

  for (const [family, cmds] of Object.entries(MUST_DENY)) {
    it(`MUST DENY at primary cwd — ${family}`, () => {
      const allowed = cmds.filter((c) => !at(c));
      expect(allowed).toEqual([]);
      // …and every one of them is untouched in a lane clone (the arm keys on WHERE the write lands).
      expect(cmds.filter((c) => decide(c, { primaryCwd: false }))).toEqual([]);
    });
  }

  for (const [family, cmds] of Object.entries(MUST_ALLOW)) {
    it(`MUST NEVER DENY at primary cwd — ${family}`, () => {
      expect(cmds.filter((c) => at(c))).toEqual([]);
    });
  }

  it(`${PLUGS} still gets its OWN message, not the tree-write one`, () => {
    expect(at(`npm run ${PLUGS}`)).toMatch(/shadow \.js\/\.d\.ts/);
  });

  it('the deny message names the ACTUAL remedy for a caller already in a lane (r3 finding 7)', () => {
    // "Delegate to a lane clone" is useless advice to a delegated subagent whose reported cwd reset to
    // primary (#2335); the remedy is to make the lane cwd explicit, which `resolveEffectiveCwd` honours.
    for (const cmd of ['npm run build', 'node scripts/gen-inventory.mjs', 'echo hi > config/app.json'])
      expect(at(cmd)).toMatch(/cd <lane-path> && <cmd>/);
    // …and that spelling really is allowed.
    expect(decide('cd /ws/.lanes/web-everything/lane-3 && npm run build', { primaryCwd: false })).toBeNull();
  });
});

// ── #2994 review r2 — the escaped-quote desync, on the arms the corpus above cannot cover ───────────────
// The MUST_DENY loop asserts every row is untouched in a lane clone, which is only true of the cwd-GATED
// tree-write arm. These arms deny regardless of cwd (push/rm/pkill) or only inside a leased lane clone
// (the #2367/#2413 clobber arm), so they get their own assertions — and the clobber arm is exactly where
// the desync did the most damage, because `hasDestructiveLaneOp` is the CLI's pre-filter for reading the
// lease at all: one unrecognisable blob ⇒ no lease read ⇒ a peer's clone clobbered with no deny.
describe('guard-bash — an escaped quote must not bypass the cwd-independent arms (#2994 r2)', () => {
  it('the push / backlog-rm / pkill arms still fire behind an escaped quote, at ANY cwd', () => {
    const rows = [
      ['git commit -m "guard: reject \\"a|b\\" input" && git push origin main', /lane\/\*|MAIN_PUSH_OK/],
      ['echo "he said \\"hi\\"" && rm backlog/2986-x.md', /backlog/],
      ['printf "%s\\n" "a\\"b" ; pkill -f vite', /dev server|pkill|kill/i],
    ];
    for (const [cmd, msg] of rows) {
      expect(decide(cmd, { primaryCwd: true }), cmd).toMatch(msg);
      expect(decide(cmd, { primaryCwd: false }), cmd).toMatch(msg);
    }
  });

  it('hasDestructiveLaneOp (the CLI lease-read pre-filter) still sees the op behind an escaped quote', () => {
    const rows = [
      'echo "a\\"b" && git reset --hard origin/main',
      'git commit -m "fix \\"x\\"" && git reset --hard',
      'echo "a\\"b" && git clean -fd',
      'echo "a\\"b" && git checkout -- .',
      'echo "a\\"b" && git push --force origin lane/x',
    ];
    for (const cmd of rows) expect(hasDestructiveLaneOp(cmd), cmd).toBe(true);
  });

  it('the lane-clobber arm denies behind an escaped quote, in BOTH lease regimes', () => {
    const rows = [
      'echo "a\\"b" && git reset --hard origin/main',
      'git commit -m "fix \\"x\\"" && git reset --hard',
      'echo "a\\"b" && git clean -fd',
      'echo "a\\"b" && git checkout -- .',
      'echo "a\\"b" && git push --force origin lane/x',
    ];
    for (const cmd of rows) {
      expect(decide(cmd, { foreignLiveLease: true }), cmd).toBeTruthy();        // #2367 unmarked-foreign
      expect(decide(cmd, { markedLeaseSlug: 'wf-slug-abc' }), cmd).toBeTruthy(); // #2413 marked, slug unasserted
    }
    // …and the owning caller's slug assertion still passes, escaped quote and all (no new false deny).
    expect(decide('echo "a\\"b" && LANE_SESSION=wf-slug-abc git reset --hard origin/main', { markedLeaseSlug: 'wf-slug-abc' })).toBeNull();
    expect(decide('echo "a\\"b" && LANE_CLOBBER_OK=1 git reset --hard origin/main', { foreignLiveLease: true })).toBeNull();
  });

  it('splitSegments honours bash\'s ACTUAL escape rules — per quote kind, not one rule everywhere', () => {
    // `"…"` — a backslash escapes the next char, so `\"` does NOT close the run.
    expect(splitSegments('git commit -m "a \\"b|c\\" d" && npm run build'))
      .toEqual(['git commit -m "a \\"b|c\\" d" ', ' npm run build']);
    // `$'…'` (ANSI-C) — same, for `\'`.
    expect(splitSegments("echo $'a\\'b' && npm run build")).toEqual(["echo $'a\\'b' ", ' npm run build']);
    // `'…'` — NOTHING is special, not even a backslash: the run ends at the very next `'`.
    // (verified against bash: `bash -c "echo 'a\\' && echo ok"` prints `a\` then `ok`.)
    expect(splitSegments("echo 'a\\' && npm run build")).toEqual(["echo 'a\\' ", ' npm run build']);
    // an unterminated run still consumes to end of string (unchanged fail-safe)
    expect(splitSegments('echo "a && npm run build')).toEqual(['echo "a && npm run build']);
  });

  it('shellTokens ends a quoted token at the REAL closing quote (the same desync, one layer down)', () => {
    expect(shellTokens('echo "a\\"b" > config/app.json').map((t) => t.text))
      .toEqual(['echo', 'a\\"b', '>', 'config/app.json']);
    expect(shellTokens("sed -i '' s/a/b/ /tmp/x").map((t) => t.text)).toEqual(['sed', '-i', '', 's/a/b/', '/tmp/x']);
  });
});

// ── #2994 review r2 — the runner-invocation parse ───────────────────────────────────────────────────────
describe('guard-bash — runnerInvocation reads a package-runner line the way the runner does (#2994 r2)', () => {
  it('an exec/dlx form yields the COMMAND, past any runner-level flags', () => {
    expect(runnerInvocation('pnpm exec vite build')).toEqual({ exec: 'vite build' });
    expect(runnerInvocation('npm exec -- vite build')).toEqual({ exec: 'vite build' });
    expect(runnerInvocation('npm exec --package=vite vite build')).toEqual({ exec: 'vite build' });
    expect(runnerInvocation('npm exec --package=vite -- vite build')).toEqual({ exec: 'vite build' });
    expect(runnerInvocation('npm exec --package vite vite build')).toEqual({ exec: 'vite build' });
    expect(runnerInvocation('npm exec --yes vite build')).toEqual({ exec: 'vite build' });
    expect(runnerInvocation('pnpm exec --silent vite build')).toEqual({ exec: 'vite build' });
    expect(runnerInvocation('pnpm --filter web exec vite build')).toEqual({ exec: 'vite build' });
    expect(runnerInvocation('yarn dlx -q eleventy')).toEqual({ exec: 'eleventy' });
    // npm's `--call/-c` hides the command inside a quoted argument
    expect(runnerInvocation("npm exec -c 'vite build'")).toEqual({ exec: 'vite build' });
    expect(runnerInvocation('npm exec --call="vite build"')).toEqual({ exec: 'vite build' });
    // the remainder is handed on VERBATIM — rejoining unquoted words would drop a `sed -i ''` empty argument
    expect(runnerInvocation("npm exec -- sed -i '' s/a/b/ config/app.json")).toEqual({ exec: "sed -i '' s/a/b/ config/app.json" });
  });

  it('a script form yields ONLY the script-name positions', () => {
    expect(runnerInvocation('npm run build')).toEqual({ names: ['build'] });
    expect(runnerInvocation('npm run --silent build')).toEqual({ names: ['build'] });
    expect(runnerInvocation('npm run --workspace=web build')).toEqual({ names: ['build'] });
    expect(runnerInvocation('npm --workspace=web run build')).toEqual({ names: ['build'] });
    expect(runnerInvocation('pnpm -r run build')).toEqual({ names: ['build'] });
    expect(runnerInvocation('yarn workspace web build')).toEqual({ names: ['build'] });
    expect(runnerInvocation('pnpm --filter web build')).toEqual({ names: ['build'] });
    expect(runnerInvocation('yarn build')).toEqual({ names: ['build'] });
    expect(runnerInvocation('run-s build:check build')).toEqual({ names: ['build:check', 'build'] });
    expect(runnerInvocation('npm run test:unit -- src/build-graph.test.ts')).toEqual({ names: ['test:unit'] });
    // npm has no bare-script form — `npm install …` is never a script name
    expect(runnerInvocation('npm install --build-from-source better-sqlite3')).toEqual({ names: [] });
    expect(runnerInvocation('npm ls esbuild')).toEqual({ names: [] });
  });

  it('degenerate / non-runner input never throws and never invents a command', () => {
    expect(runnerInvocation('git status')).toBeNull();
    expect(runnerInvocation('')).toBeNull();
    expect(runnerInvocation('npm exec')).toEqual({ names: [] });
    expect(runnerInvocation('npm exec --')).toEqual({ names: [] });
    expect(runnerInvocation('npm exec -c')).toEqual({ exec: '' });
  });
});

describe('guard-bash — the shared normalizers the #2788 arms and canonicalGitOp both use (r3 finding 1)', () => {
  it('canonicalCommand peels the SAME wrapper table canonicalGitOp knows about', () => {
    for (const w of ['env', 'time', 'command', 'builtin', 'nice', 'sudo', 'npx'])
      expect(canonicalCommand(`${w} npm run build`)).toBe('npm run build');
    expect(canonicalCommand('FOO=1 BAR=2 npm run build')).toBe('npm run build');
    expect(canonicalCommand('env FOO=1 npm run build')).toBe('npm run build');
    expect(canonicalCommand('./node_modules/.bin/eleventy --quiet')).toBe('eleventy --quiet');
    expect(canonicalCommand('')).toBe('');
  });

  it('canonicalGitOp keeps its #2367 behaviour through the shared peeler', () => {
    expect(canonicalGitOp('env FOO=1 /usr/bin/git -C /x reset --hard')).toBe('git reset --hard');
    expect(canonicalGitOp('npm run build')).toBe('');
    expect(canonicalGitOp('')).toBe('');
  });

  it('splitSegments cuts on UNQUOTED separators only (#2994)', () => {
    // the ordinary separators still cut, and a run of them collapses to one cut
    expect(splitSegments('a && b').map((s) => s.trim())).toEqual(['a', 'b']);
    expect(splitSegments('a || b; c | d & e\nf').map((s) => s.trim())).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
    // …but a separator INSIDE quotes is text, in either quote style — this is the whole bug
    expect(splitSegments("gh pr list --jq '.[] | select(.n > 5)'")).toHaveLength(1);
    expect(splitSegments('gh pr list --jq ".[] | select(.n > 5)"')).toHaveLength(1);
    expect(splitSegments("echo 'a; b && c'")).toHaveLength(1);
    // the RAW text (quotes intact) is returned — every caller re-parses it
    expect(splitSegments("echo 'a | b' > x")[0]).toBe("echo 'a | b' > x");
    // a redirect operator run is consumed whole, so its glued `|`/`&` is never a separator
    expect(splitSegments('cmd >| x')).toHaveLength(1);
    expect(splitSegments('cmd 2>&1')).toHaveLength(1);
    expect(splitSegments('echo hi &> x')).toHaveLength(1);
    expect(splitSegments('cmd >> x')).toHaveLength(1);
    // an unterminated quote runs to end of string rather than dropping the tail
    expect(splitSegments("echo 'a | b")).toHaveLength(1);
    expect(splitSegments('')).toEqual(['']);
  });

  // The fifth false-deny class (#3002 sweep clause), pinned at the mechanism rather than the outcome.
  // The quote-blind split cut at the `|` inside `"a|=>"`, leaving the tail `=>" AGENTS.md`, in which the
  // `>` read as a redirect whose target was `AGENTS.md`. Cutting nothing keeps the `>` inside a quoted
  // run, where no redirect scan can reach it.
  it('splitSegments does not cut inside a quoted alternation, so a glued `=>` is not a redirect', () => {
    for (const cmd of [
      'grep -cE "a|=>" AGENTS.md', "grep -cE 'a|=>' AGENTS.md",
      'grep -cE "a|->" AGENTS.md', 'grep -cE "a|2>" AGENTS.md',
      'rg -e "x|y=>z" src',
    ]) expect(splitSegments(cmd)).toEqual([cmd]);
    // …and the operator OUTSIDE the quotes is still seen: one segment, redirect intact for the write scan
    expect(splitSegments('grep -cE "a|=>" AGENTS.md > out.txt')).toEqual(['grep -cE "a|=>" AGENTS.md > out.txt']);
    // the quoted `|` is not a separator, but an UNQUOTED one after it still is
    expect(splitSegments('grep -cE "a|=>" f | tee out.txt').map((s) => s.trim()))
      .toEqual(['grep -cE "a|=>" f', 'tee out.txt']);
  });

  it('the quote-aware split closes a real hole, not just the false denies (#2994)', () => {
    // BEFORE: the tear at the quoted pipe left the tail fragment with an UNBALANCED quote that swallowed
    // the trailing redirect, so a genuine primary-tree write was ALLOWED. Both directions are asserted.
    expect(decide("gh pr list --jq '.[] | .number' > config/app.json", { primaryCwd: true })).toMatch(/writing a file/);
    expect(decide("perl -i -pe 's/x|y/z/' config/app.json", { primaryCwd: true })).toMatch(/writing a file/);
    expect(decide("gh pr list --jq '.[] | .number' > /tmp/prs.json", { primaryCwd: true })).toBeNull();
  });

  it('isTreeWritingBuildRun reads only the runner SCRIPT-NAME position (#2986/2)', () => {
    expect(isTreeWritingBuildRun('npm run build')).toBe(true);
    expect(isTreeWritingBuildRun('yarn build')).toBe(true);          // yarn takes a bare script name
    expect(isTreeWritingBuildRun('run-s lint build')).toBe(true);    // every positional is a script name
    expect(isTreeWritingBuildRun('npm run lint src/build/')).toBe(false);
    expect(isTreeWritingBuildRun('npm install --build-from-source better-sqlite3')).toBe(false);
    expect(isTreeWritingBuildRun('npm install esbuild')).toBe(false); // npm has no bare-script form
    expect(isTreeWritingBuildRun('pnpm add node-gyp-build')).toBe(false);
    expect(isTreeWritingBuildRun('pnpm exec vite build')).toBe(true); // `exec` remainder is a COMMAND
  });

  it('the eleventy no-write flag allowlist, and what overrides it (#2986/3)', () => {
    expect(isTreeWritingBuildRun('eleventy --version')).toBe(false);
    expect(isTreeWritingBuildRun('eleventy --dryrun')).toBe(false);
    expect(isTreeWritingBuildRun('eleventy')).toBe(true);
    expect(isTreeWritingBuildRun('eleventy --serve')).toBe(true);
    expect(isTreeWritingBuildRun('eleventy --dryrun --serve')).toBe(true); // writing flags win
    expect(isTreeWritingBuildRun('eleventy --versionx')).toBe(true);       // prefix ≠ allowlisted
  });

  it("fileOperands drops an EMPTY operand, so BSD `sed -i ''` doesn't shift the target slice (#2986/1)", () => {
    expect(isFileWriteRedirect("sed -i '' s/a/b/ /tmp/scratch.txt")).toBe(false);
    expect(isFileWriteRedirect("sed -i '' s/a/b/ config/app.json")).toBe(true);
    expect(isFileWriteRedirect("sed -i '' -e s/a/b/ /tmp/scratch.txt")).toBe(false);
    expect(isFileWriteRedirect("tee '' config/app.json")).toBe(true);
  });

  it('shellTokens: quoting is resolved and redirect operators are split out with their fd prefix', () => {
    expect(shellTokens('echo hi > x').map((t) => t.text)).toEqual(['echo', 'hi', '>', 'x']);
    expect(shellTokens('echo hi>x').map((t) => t.text)).toEqual(['echo', 'hi', '>', 'x']);
    expect(shellTokens('cmd 2>&1').map((t) => t.text)).toEqual(['cmd', '2>&', '1']);
    expect(shellTokens('cmd >| x').map((t) => t.text)).toEqual(['cmd', '>|', 'x']);
    // a `>` inside quotes is TEXT, never an operator — this is what replaces the old end-of-segment anchor
    expect(shellTokens('git commit -m "fix > bug"').map((t) => t.text)).toEqual(['git', 'commit', '-m', 'fix > bug']);
    expect(shellTokens('git commit -m "fix > bug"').some((t) => t.op)).toBe(false);
  });

  it('stripHeredocBodies drops the BODY (and terminator) but keeps the opener line', () => {
    const cmd = "cat > /tmp/body.md <<'EOF'\nFix the > thing\nsed -i s/a/b/ config/app.json\nEOF\necho done";
    expect(stripHeredocBodies(cmd)).toBe("cat > /tmp/body.md <<'EOF'\necho done");
    expect(stripHeredocBodies('echo hi')).toBe('echo hi');
    // …so heredoc PROSE can never produce a phantom denial, while the heredoc's own target still can
    expect(decide(cmd, { primaryCwd: true })).toBeNull();
    expect(decide(cmd.replace('/tmp/body.md', 'config/app.json'), { primaryCwd: true })).toMatch(/writing a file/);
  });
});

// ── #2994 review r3 — the parser must FAIL CLOSED, never silently degrade ───────────────────────────────
// The mechanism behind every loosening this review found: the scanner reached a state it could not
// represent, consumed to end-of-string, and handed the deny arms ONE opaque blob in which nothing is
// anchored at command position — so the tree-write arm, the push arm, the rm-backlog arm and (via
// `hasDestructiveLaneOp`) the entire lane-clobber lease check all missed at once. These assertions pin the
// PROPERTY (an unrepresentable state denies), not the two shapes that happened to be reported.
describe('guard-bash — the parser fails CLOSED on input it cannot represent (#2994 r3)', () => {
  const CONTEXTS = [
    ['primary cwd', { primaryCwd: true }],
    ['a plain lane cwd', { primaryCwd: false }],
    ['a lane with a foreign unmarked lease (#2367)', { primaryCwd: false, foreignLiveLease: true }],
    ['a lane with a marked workflowLane lease (#2413)', { primaryCwd: false, markedLeaseSlug: 'wf-x1' }],
  ];

  it('an UNTERMINATED quote is denied in EVERY context — bash rejects the identical input', () => {
    const cmds = [
      "echo 'abc", 'echo "abc', "echo $'abc", 'echo $"abc',
      "echo 'abc\nnpm run build",                     // …and it can no longer swallow the next line
      'echo "abc\ngit reset --hard origin/main',
      "git commit -m 'oops\ngit push origin main",
      "npm run lint --msg='unclosed",
      'ls "a\nrm backlog/1234-a.md',
    ];
    for (const [label, ctx] of CONTEXTS)
      for (const c of cmds)
        expect(decide(c, ctx), `${label}: ${JSON.stringify(c)}`).toMatch(/UNTERMINATED quote/);
  });

  it('a BALANCED quote — including an apostrophe in a comment or a heredoc body — is NOT that state', () => {
    for (const c of [
      "echo 'abc'", 'echo "abc"', "echo $'a\\'b'", 'echo "a\\"b"', "echo 'a\\'",
      "ls # don't forget", 'ls # a "quoted" word', "ls # don't\nnpm run test:unit",
      "cat > /tmp/b.md <<'EOF'\ndon't do it\nit's fine — a \"quote\" too\nEOF",
      'git commit -m "it\'s fine"',
    ]) expect(unparseableReason(c), JSON.stringify(c)).toBeNull();
  });

  it('there is NO escape hatch for an unparseable command (there is no legitimate one)', () => {
    for (const esc of ['MAIN_SESSION_BUILD_OK=1 ', 'LANE_CLOBBER_OK=1 ', 'MAIN_PUSH_OK=1 ', 'STALE_LANE_OK=1 '])
      expect(decide(`${esc}echo 'abc`, { primaryCwd: true })).toMatch(/UNTERMINATED quote/);
  });

  it('parseSegments REPORTS its state instead of consuming to end of string', () => {
    expect(parseSegments("echo 'a | b").unterminated).toBe(true);
    expect(parseSegments("echo 'a | b'").unterminated).toBe(false);
    // F1 — the comment no longer opens a phantom quoted run, so the newline still cuts.
    const f1 = parseSegments("ls # don't\nnpm run build");
    expect(f1.unterminated).toBe(false);
    expect(f1.segments.map((s) => s.trim())).toEqual(["ls # don't", 'npm run build']);
    // …and a comment's text and separators are STILL handed on, so nothing is hidden from a deny rule.
    expect(parseSegments('ls # a; b').segments.map((s) => s.trim())).toEqual(['ls # a', 'b']);
    // F2 — `\`+newline is spliced the way bash splices it.
    const f2 = parseSegments('echo a && \\\nnpm run build');
    expect(f2.continued).toBe(true);
    expect(f2.segments.map((s) => s.trim())).toEqual(['echo a', 'npm run build']);
    expect(parseSegments('echo a \\\nb').segments).toEqual(['echo a b']);
    // …and the NAIVE reading, which `decide` also checks, reproduces the pre-#2994 text exactly.
    expect(parseSegments('echo a \\\nb', { spliceContinuations: false }).segments)
      .toEqual(['echo a \\', 'b']);
    // A lone trailing backslash is not a continuation at all.
    expect(parseSegments('echo a \\').segments).toEqual(['echo a \\']);
    expect(parseSegments('echo a \\').continued).toBe(false);
  });

  it('heredocScan only opens a heredoc at an UNQUOTED, un-commented `<<`', () => {
    expect(heredocScan('echo "x << EOF"\nnpm run build').text).toBe('echo "x << EOF"\nnpm run build');
    expect(heredocScan('ls # see <<EOF\nnpm run build').text).toBe('ls # see <<EOF\nnpm run build');
    expect(heredocScan("cat <<'EOF'\nbody\nEOF\nls").text).toBe("cat <<'EOF'\nls");
    // …and it reports an unterminated quote in the COMMAND text (a body's apostrophe is data, not a quote)
    expect(heredocScan('echo "abc\ncat <<EOF\nx\nEOF').unterminated).toBe(true);
    expect(heredocScan("cat <<'EOF'\ndon't\nEOF").unterminated).toBe(false);
  });

  it('canonicalCommand is quote-aware, and peels a subshell CLOSER as well as its opener', () => {
    expect(canonicalCommand('(pnpm --filter web exec vite build)')).toBe('pnpm --filter web exec vite build');
    expect(canonicalCommand('(vite build) \\')).toBe('vite build');
    expect(canonicalCommand('{ npm run build }')).toBe('npm run build');
    expect(canonicalCommand('sudo -u "some user" npm run build')).toBe('npm run build');
    expect(canonicalCommand('env "FOO=a b" npm run build')).toBe('npm run build');
    expect(canonicalCommand('echo "a)"')).toBe('echo "a)"');          // a bracket in quotes is not a closer
    expect(canonicalCommand("sed -i '' s/a/b/ /tmp/x")).toBe("sed -i '' s/a/b/ /tmp/x");  // quoting preserved
  });

  it("matches real bash on every parse state it models (bash -c, not an assumption)", () => {
    let bash;
    try { bash = (s) => execFileSync('bash', ['-c', s], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
    catch { return; }
    // `#` starts a comment only at a WORD boundary…
    expect(bash('echo a#b')).toBe('a#b');
    expect(bash('echo a #b')).toBe('a');
    expect(bash('x=abc; echo ${#x}')).toBe('3');
    expect(bash("echo 'a # b'")).toBe('a # b');
    // …an apostrophe inside one is not a quote, and the NEXT line really does run (F1)
    expect(bash("echo one # don't forget\necho two")).toBe('one\ntwo');
    // `\`+newline is a splice (F2), and a lone trailing backslash is dropped
    expect(bash('echo a && \\\necho b')).toBe('a\nb');
    expect(bash('echo a \\\nb')).toBe('a b');
    // r5 F3 — a LONE trailing backslash at end-of-input is bash-VERSION-dependent, so it is not a
    // fidelity fact this suite can pin: bash 3.2 (macOS, the author's shell) DROPS it and prints `a`;
    // bash 5 (the Linux CI runner) keeps it as literal text and prints `a \`. POSIX leaves it undefined.
    // Asserting `'a'` made CI red on this PR's own new test while passing locally — a suite that only
    // passes on one machine is worse than no suite. Both readings are accepted; what the GUARD does with
    // it is asserted separately (canonicalCommand peels it; the tokenizers keep it as literal text).
    expect(['a', 'a \\']).toContain(bash('echo a \\'));
    // an unterminated quote is a SYNTAX ERROR — denying it denies nothing that would have run
    expect(() => bash("echo 'abc")).toThrow();
    expect(() => bash('echo "abc')).toThrow();
  });
});

// ── #2994 review r5 — the text bash RE-EXECUTES, and the STRUCTURAL subshell closer ─────────────────────
// Round 4 made the segment split quote-CORRECT, which lost coverage the quote-BLIND split of base had by
// ACCIDENT: base tore `bash -c "git status && git push origin main"` at the `&&` inside the quoted
// argument, so the tail landed on the `git push` arm at command position. Reading the quoting properly
// keeps it as one argument of `bash`, which no arm inspects — while bash still really pushes. Every shape
// below was confirmed under REAL bash in a PATH-stubbed sandbox whose stubs log NUL-separated argv: a
// regression counted only when bash genuinely executed something the guard denies at command position.
describe('guard-bash — the guard follows the text bash re-executes (#2994 r5 F1)', () => {
  it('nestedCommandStrings reads every re-execution position', () => {
    expect(nestedCommandStrings('echo "$(git push origin main)"')).toContain('git push origin main');
    expect(nestedCommandStrings('echo `npm run build`')).toContain('npm run build');
    expect(nestedCommandStrings('bash -c "npm run build"')).toContain('npm run build');
    expect(nestedCommandStrings("sh -c 'vite build'")).toContain('vite build');
    expect(nestedCommandStrings('bash -ec "vite build"')).toContain('vite build');
    expect(nestedCommandStrings('eval "npm run build"')).toContain('npm run build');
    expect(nestedCommandStrings("npm exec -c 'vite build'")).toContain('vite build');
    expect(nestedCommandStrings('xargs -n1 bash -c "npm run build"')).toContain('npm run build');
    // a SCRIPT FILE argument is not a `-c` string
    expect(nestedCommandStrings('bash scripts/setup.sh')).toEqual([]);
    // …and a single-quoted body expands NOTHING, so there is no substitution inside it
    expect(nestedCommandStrings("echo '$(npm run build)'")).toEqual([]);
  });

  it('a `"…"` script string arrives with its escapes RESOLVED, the way the inner shell reads it', () => {
    // Keeping the `\"` verbatim made the `|` read as an unquoted separator and the tail `b > c\"` as a
    // real redirect — #2994's own false deny, re-created one level down.
    expect(nestedCommandStrings('sh -c "git commit -m \\"fix: a | b > c\\""'))
      .toContain('git commit -m "fix: a | b > c"');
    // a `\'…\'` string resolves nothing, so it is passed through verbatim
    expect(nestedCommandStrings("sh -c 'echo \\\"x\\\"'")).toContain('echo \\"x\\"');
  });

  it('a leading env-assignment is EXPORTED into the re-executed command, so the escape still disarms it', () => {
    // Verified against real bash: `FOO=1 bash -c 'echo $FOO'` prints 1 — and it reaches EVERY command in
    // the string, not just the first.
    expect(nestedCommandStrings('MAIN_SESSION_BUILD_OK=1 bash -c "npm run build && vite build"'))
      .toEqual(expect.arrayContaining([expect.stringContaining('MAIN_SESSION_BUILD_OK=1')]));
    expect(decide('MAIN_SESSION_BUILD_OK=1 bash -c "npm run build"', { primaryCwd: true })).toBeNull();
    expect(decide('MAIN_SESSION_BUILD_OK=1 sh -c "npm run build && npm run build:docs"', { primaryCwd: true })).toBeNull();
    expect(decide('MAIN_PUSH_OK=1 bash -c "git push origin main"', { primaryCwd: true })).toBeNull();
    // …but a substitution is expanded BEFORE the prefix applies, so it does NOT inherit it
    // (`FOO=1 echo "$(echo $FOO)"` prints empty) — assuming it did would be a loosening.
    expect(decide('MAIN_SESSION_BUILD_OK=1 echo "$(npm run build)"', { primaryCwd: true })).toMatch(/WRITES the shared PRIMARY tree/);
  });

  it('the five shapes that really executed under bash while the guard allowed them', () => {
    const at = (c) => decide(c, { primaryCwd: true });
    expect(at('bash -c "git status && git push origin main"')).toMatch(/direct push to `main`/);
    expect(at('bash -c "cd src && npm run build"')).toMatch(/WRITES the shared PRIMARY tree/);
    expect(at('eval "echo done; echo hi > config/app.json"')).toMatch(/redirect/);
    expect(at('OUT="$(cd . && npm run build)"')).toMatch(/WRITES the shared PRIMARY tree/);
    expect(at('echo "$(git status && git push origin main)"')).toMatch(/direct push to `main`/);
    // …and the separator-free spelling base never caught either
    expect(at('bash -c "npm run build"')).toMatch(/WRITES the shared PRIMARY tree/);
  });

  it('a substitution inside a DOUBLE-QUOTED run whose body has its own quotes is still read', () => {
    // Consuming the `"…"` run as one opaque span ended it at the `"` before `*.ts`, so the
    // substitution's tail (a real build) was never seen.
    expect(decide('echo "`find . -name "*.ts"; yarn build`"', { primaryCwd: true }))
      .toMatch(/WRITES the shared PRIMARY tree/);
    // …and an apostrophe in a `#` comment must not open a phantom quoted run over the NEXT line
    expect(decide("# a note — don't forget\necho `pnpm exec vite build`", { primaryCwd: true }))
      .toMatch(/WRITES the shared PRIMARY tree/);
  });

  it('the expansion is BOUNDED — a pathological nest neither wedges nor throws', () => {
    let cmd = 'npm run build';
    for (let i = 0; i < 200; i++) cmd = `bash -c "${cmd.replace(/"/g, '\\"')}"`;
    expect(() => decide(cmd, { primaryCwd: true })).not.toThrow();
    let subst = 'npm run build';
    for (let i = 0; i < 200; i++) subst = `echo "$(${subst})"`;
    expect(() => decide(subst, { primaryCwd: true })).not.toThrow();
  });
});

describe('guard-bash — a subshell closer is matched STRUCTURALLY, not positionally (#2994 r5 F2)', () => {
  it('one trailing token after the `)` no longer re-opens the hole', () => {
    const at = (c) => decide(c, { primaryCwd: true });
    for (const c of ['(pnpm exec vite build) >/dev/null', '(pnpm exec vite build) 2>/dev/null',
      '(pnpm exec vite build) #x', '(npm exec -- vite build) #x', '(vite build) >/dev/null 2>&1',
      '(pnpm exec vite build)'])
      expect(at(c)).toMatch(/WRITES the shared PRIMARY tree/);
  });

  it('…and the group\'s LAST command, which keeps the closer glued to it after the split', () => {
    expect(decide('(git status; pnpm dlx eleventy) >/dev/null', { primaryCwd: true }))
      .toMatch(/WRITES the shared PRIMARY tree/);
    expect(decide('(pkill vite; git status) #x', {})).toMatch(/Never kill the running dev server/);
  });

  it('the flag allowlists terminate on a group closer too, so a no-write command stays allowed', () => {
    // The same positional bug on the precision side: `--version)` was not recognised as `--version`.
    expect(decide('(eleventy --version) >/dev/null', { primaryCwd: true })).toBeNull();
    expect(decide('(eleventy --dryrun) 2>/dev/null', { primaryCwd: true })).toBeNull();
    // …and `--serve)` must still DENY — it really writes the site dir.
    expect(decide('(eleventy --serve) >/dev/null', { primaryCwd: true })).toMatch(/WRITES the shared PRIMARY tree/);
    // a flag that merely starts with an allowlisted name is still not on the allowlist
    expect(decide('(eleventy --versionx) >/dev/null', { primaryCwd: true })).toMatch(/WRITES the shared PRIMARY tree/);
    // …and `vite --outDir build-out` is not a `build` subcommand
    expect(isTreeWritingBuildRun('vite --outDir build-out preview')).toBe(false);
  });

  it('a quoted bracket is never a group closer', () => {
    expect(decide('echo "a)"', { primaryCwd: true })).toBeNull();
    expect(decide("git commit -m 'fix (a) thing'", { primaryCwd: true })).toBeNull();
    expect(nestedCommandStrings('echo "a)"')).toEqual([]);
  });
});

describe('guard-bash — the wrapper-peeled command word reaches every anchored arm (#2994 r5)', () => {
  it('a wrapper no longer hides pkill / rm / mv / sed / git push from their arm', () => {
    expect(decide('time rm backlog/2986-x.md', {})).toMatch(/Never delete a backlog/);
    expect(decide('time pkill -f vite', {})).toMatch(/Never kill the running dev server/);
    expect(decide('env FOO=1 git push origin main', {})).toMatch(/direct push to `main`/);
    expect(decide('/usr/bin/git push origin main', {})).toMatch(/direct push to `main`/);
    expect(decide('(pkill vite)', {})).toMatch(/Never kill the running dev server/);
  });

  it('a trailing token after the mv operands no longer disarms the renumber rule', () => {
    // The rule compared the first and LAST TOKEN, so a trailing comment word became the "destination",
    // carried no NNN, and a real renumber was allowed (confirmed executing under real bash).
    expect(decide('mv backlog/2986-x.md backlog/9999-y.md # trailing note', {})).toMatch(/Never renumber/);
    expect(decide('git mv backlog/2986-x.md backlog/9999-y.md >/dev/null', {})).toMatch(/Never renumber/);
    // …and a same-NNN slug rename is still fine
    expect(decide('git mv backlog/2986-x.md backlog/2986-y.md', {})).toBeNull();
  });

  it('a MENTION is still not an invocation', () => {
    expect(decide('git commit -m "stop using pkill vite"', {})).toBeNull();
    expect(decide('echo "rm backlog/2986-x.md"', {})).toBeNull();
    expect(decide('grep -rn "git push origin main" docs/', {})).toBeNull();
  });
});

/**
 * A commit under a HAND-SET identity. The box already ships the correct identity at `--global`, so an
 * override can only make authorship WRONG — and unsigned commits in a human's name land on `main` and stay
 * there. Observed 2026-08-24: four merged before the tip-commit check noticed.
 *
 * The arm is TOKEN-POSITIONAL rather than a regex over the raw text, and the false-positive cases below are
 * why: the first cut denied `git commit -m "docs: never pass -c user.email=foo"` — the commit that documents
 * this very rule. Same lesson the `pkill` arm already paid for.
 */
describe('commit identity override (#3269)', () => {
  it('denies every door onto the author/committer fields', () => {
    for (const cmd of [
      'git -c user.email=x@y.com commit -m hi',
      'git -c user.email=x -c user.name=Z commit -q -F -',
      'git -cuser.email=x@y commit -m hi',          // glued form — git accepts it
      'git commit --author="A <a@b.c>" -m hi',
      'git commit --author "A <a@b.c>" -m hi',
      'GIT_AUTHOR_EMAIL=a@b.c git commit -m hi',
      'GIT_COMMITTER_NAME=Z git commit -m hi',
    ]) expect(decide(cmd, {}), cmd).toMatch(/identity by hand/);
  });

  it('leaves an ordinary commit, a config write, and an unrelated -c alone', () => {
    for (const cmd of [
      'git commit -m hi',
      'git config user.email noreply@anthropic.com',   // setting the MACHINE's identity is legitimate
      'git -c core.pager=cat log',
      'git -c core.pager=cat commit -m ok',            // a non-identity -c on a commit
      'git push origin HEAD:refs/heads/lane/x',
    ]) expect(decide(cmd, {}), cmd).toBeNull();
  });

  it('never fires on a MESSAGE that merely mentions the flags', () => {
    // The regression that caught the first cut: prose is one quoted token, never argv.
    expect(decide('git commit -m "docs: never pass -c user.email=foo"', {})).toBeNull();
    expect(decide('git commit -m "note about --author= forms"', {})).toBeNull();
  });

  it('honours the sanctioned escape for a deliberate re-attribution', () => {
    expect(decide('COMMIT_IDENTITY_OK=1 git -c user.email=x commit -m repair', {})).toBeNull();
  });
});
