// Historical / hypothetical variants of the REAL flows, as small patches, one per 2026-09-26 daemon break
// (#4075). Each patch rewrites the real flow data back to what the code was BEFORE a fix (or forward to a
// proposed fix for a gap still open on main), citing the commit or branch it reconstructs. The test proves the
// checker flags the broken variant and not the fixed one — i.e. the flow-file diff of the breaking PR would
// have been caught at review time.

const clone = (x) => JSON.parse(JSON.stringify(x));
const step = (flow, id) => {
  const s = flow.steps.find((st) => st.id === id);
  if (!s) throw new Error(`fixture: no step ${id} in ${flow.id}`);
  return s;
};
const state = (flow, id) => {
  const s = flow.states.find((st) => st.id === id);
  if (!s) throw new Error(`fixture: no state ${id} in ${flow.id}`);
  return s;
};

/** Before PR #2701 (70f0cd842^): sessions started in the dispatcher's own WE checkout, whose project
 *  `.claude/settings.json` allows Edit/Write/Bash — lane edits ran without a prompt until #2701 moved the cwd to
 *  a scratch dir (plan log 2026-09-26 1:28 PM: a fixer sat 36 min on a permission prompt). */
const PRE_2701_EDIT = {
  kind: 'permission', name: 'edit:<lane>',
  cite: '.claude/settings.json:9-14 @70f0cd842^', note: 'cwd = the dispatcher checkout → WE project settings load → Edit/Write/Bash allowed',
};
export function before2701BuildDispatch(real) {
  const f = clone(real);
  step(f, 'spawn-claude-bg').provides.push(PRE_2701_EDIT);
  return f;
}
export function before2701CiHeal(real) {
  const f = clone(real);
  step(f, 'spawn-session').provides.push(PRE_2701_EDIT);
  return f;
}
export function before2701Fix(real) {
  const f = clone(real);
  step(f, 'spawn-claude-bg').provides.push(PRE_2701_EDIT);
  return f;
}

/** Before 93b2d603a (xs81oxb): a conflicting PR with no review label was refused forever — nobody acted on it. */
export function before93b2d603aConflict(real) {
  const f = clone(real);
  const s = state(f, 'unowned-mechanical-rebase-attempt');
  s.owner = 'none';
  s.retries = null;
  s.notes = 'pre-93b2d603a: unowned DIRTY PR refused every sweep, no actor (PR #2709 shape)';
  return f;
}

/** Before 759529ac0 (#4044): the rebuild waited on the clone writer lock with no bound. */
export function before759529ac0Rebuild(real) {
  const f = clone(real);
  const s = state(f, 'acquire-write-lock');
  s.wait = { ...s.wait, timeout: null, onTimeout: null, cite: 'scripts/lib/daemon-rebuild.mjs @d85272772' };
  return f;
}

/** PR #2731's branch (origin/lane/xa4qo7n-daemon-rebuild-offlock-smoke, scripts/lib/daemon-rebuild.mjs:1418):
 *  the candidate is smoked OFF the lock in a disposable worktree under the self-sync state dir, so the smoke's
 *  cwd is no longer the real clone under ~/workspace and the lane-pool root it derives is wrong. */
export function offLockSmoke2731Rebuild(real) {
  const f = clone(real);
  const at = f.steps.findIndex((st) => st.id === 'run-live-smoke-checks');
  f.steps.splice(at, 0, {
    id: 'create-candidate-worktree',
    state: f.steps[at].state,
    actor: 'daemon-rebuild (off-lock, #2731)',
    does: 'git worktree add the candidate under ~/.claude/daemon-self-sync-state/<cloneKey>.candidate-<token>; smoke there',
    cite: 'origin/lane/xa4qo7n-daemon-rebuild-offlock-smoke:scripts/lib/daemon-rebuild.mjs:1418',
    provides: [{ kind: 'cwd', name: '<candidate-worktree>' }],
    removes: [{ kind: 'cwd', name: '<daemon-clone>' }, { kind: 'lane', name: 'pool root = <workspace>/.lanes' }],
  });
  return f;
}

/** Proposed fix for the still-open stacked-PR gap (#2729 shape): whoever retargets the base also re-triggers
 *  the required checks and owns the wait with a bound. Not on main — shows the check goes green once fixed. */
export function fixedStackedRetargetCiHeal(real) {
  const f = clone(real);
  const s = state(f, 'base-retargeted');
  s.owner = 'fix-dispatch-daemon (proposed)';
  s.wait = { for: 'required checks on the retargeted head', timeout: '60m', onTimeout: 'retarget-ci-missing' };
  f.states.push({
    id: 'retarget-ci-missing', label: 'Checks never started after retarget', terminal: true, outcome: 'failure',
    escalation: { to: 'operator', how: 'notify + review:human' },
  });
  f.transitions.push({ from: 'base-retargeted', to: 'retarget-ci-missing', on: 'no checks after 60m', kind: 'timeout' });
  f.steps.push({
    id: 'retrigger-required-checks', state: 'base-retargeted', actor: 'fix-dispatch-daemon (proposed)',
    does: 'detect required checks missing on head after a base retarget; re-run / push an empty commit',
    provides: [{ kind: 'ci', name: 'required checks ran on head' }],
  });
  return f;
}
