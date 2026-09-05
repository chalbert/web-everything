#!/usr/bin/env node
/**
 * @file scripts/conveyor/branch-drift.mjs
 * @description The branch-drift RECONCILIATION CADENCE (#3464, epic #3383) — a mechanical, no-human check of
 *   how far a long-lived dispatched-work branch (e.g. `origin/lane/mechanical-dispatcher`) has diverged from
 *   its integration target (e.g. `origin/main`), and whether reconciling them would even succeed.
 *
 * WHY THIS EXISTS. #3464's own incident: `origin/lane/mechanical-dispatcher` sat 78 commits behind / 29 ahead
 * of `origin/main`, with a real content conflict, because every prior reconciliation was a HUMAN OR SESSION
 * noticing the drift and rebasing by hand — no mechanized cadence ever ran this. The scope/lease machinery this
 * repo already has (`we:scripts/readiness/file-locks.mjs`, `we:scripts/lane-pool.mjs`'s `--scope`,
 * `we:scripts/readiness/dispatch-plan.mjs`'s scope-overlap gate) all arbitrate WITHIN one pool of lanes tracking
 * ONE branch — none of it reaches a second, separately-checked-out branch. This file is the missing check.
 *
 * PURE-CORE / IO-SHELL SPLIT (mirrors `scripts/prune-landed-lanes.mjs#classifyLaneBranch`):
 *   • {@link classifyBranchDrift} is PURE — no fs/git/clock — so it is unit-tested directly against precomputed
 *     ahead/behind/conflict inputs.
 *   • The IO shell (`sweep` / `check` CLI verbs, gated on the main-module check) owns every git call: computing
 *     ahead/behind (`git rev-list --left-right --count`) and the DRY-RUN, working-tree-free conflict probe
 *     (`git merge-tree --write-tree` — the exact plumbing `prune-landed-lanes.mjs` / `scripts/lib/rebase-drop-
 *     manifest.mjs` already use; this file reuses the pattern rather than inventing a second one).
 *
 * THE DURABLE, CHECKABLE PLACE — a git note, not a new store. A `git note` pushed to a dedicated ref
 * (`refs/notes/branch-drift` by default) is attached to the branch's own tip commit: it persists on `origin`
 * independent of any one scratch checkout's lifetime (unlike `.claude/locks`, which #3464's own investigation
 * found is explicitly LOCAL to one clone and never reaches a second), and any fresh clone can read it back with
 * a plain `git fetch` + `git notes show` — no PR required (this branch has none by design, per epic #3383's own
 * "build in a dedicated branch, without the per-commit review tax" doctrine) and no new state store invented
 * (per the #2612 "no parallel state store" ruling — this is a git-native primitive, not a bespoke file/DB).
 * Pushing a `refs/notes/*` ref is unaffected by the `refs/heads/main` protections (`scripts/guard-git-push.mjs`
 * / `scripts/guard-bash.mjs`'s lane-only heuristic) — it never touches `main`.
 *
 * THE CADENCE — wired into `skills-src/conveyor/runner.mjs`'s existing best-effort mechanical passes (the SAME
 * shape #3449 used to reconcile lane-pool leases without a live session: piggyback on a pass the headless
 * runner already runs every tick, rather than standing up a new cron). `sweep` runs there automatically, with
 * no human or interactive session needed to notice drift.
 *
 * THE CEILING. `classifyBranchDrift` returns `blocked` once EITHER the dry-run merge conflicts OR the branch is
 * more than `maxBehind` commits behind — `we:scripts/readiness/dispatch-plan.mjs` reads the latest `check`
 * verdict and, when `blocked`, holds further WE-pool dispatch onto the SAME scope the drifting branch is
 * carrying unreconciled changes in (`branch-drift-blocked`) — the exact scope both sides of #3464's own incident
 * collided on. `watch` is a softer, informational pre-ceiling warning; only `blocked` gates dispatch.
 */

import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

/** Default long-lived branch this cadence watches (#3464's own subject) and its integration target. Both
 *  overridable (`--branch=` / `--target=`, or `WE_BRANCH_DRIFT_BRANCH` / `WE_BRANCH_DRIFT_TARGET`) so this stays
 *  a general tool, not a hardcoded one-off — the regression fixtures exercise it against throwaway branches. */
export const DEFAULT_DRIFT_BRANCH = 'lane/mechanical-dispatcher';
export const DEFAULT_DRIFT_TARGET = 'main';

/** Default hard ceiling (commits behind) past which further dispatch onto the drifting scope is held until a
 *  fresh reconciliation pass runs. Chosen well above the normal day-to-day drift a branch this active
 *  accumulates between reconciliations, and well below the depth (78) that produced #3464's own real conflict —
 *  a soft `watch` fires at half this, an early signal before the hard hold. Env/flag overridable, same pattern
 *  as `we:scripts/readiness/dispatch-plan.mjs`'s `ALREADY_DONE_AGE_GATE_MS`. */
export const DEFAULT_MAX_BEHIND = 40;
export const MAX_BEHIND_ENV = 'WE_BRANCH_DRIFT_MAX_BEHIND';

/** The default notes ref the report is written to / read from. */
export const DEFAULT_NOTES_REF = 'refs/notes/branch-drift';

// ── PURE CORE (no fs / git / clock — every input is injected) ──────────────────────────────────────────────

/**
 * The drift verdict for one long-lived branch vs its target. PURE.
 * @param {{ahead?:number, behind?:number, conflict?:boolean, maxBehind?:number}} input
 *   `conflict` — true when a dry-run merge (`git merge-tree`) of `branch` into `target` reports a real content
 *   conflict; `false`/`undefined` when it merged cleanly (or wasn't computed, treated as no evidence of one).
 * @returns {{status:'ok'|'watch'|'blocked', reason:string|null}}
 */
export function classifyBranchDrift({ ahead = 0, behind = 0, conflict = false, maxBehind = DEFAULT_MAX_BEHIND } = {}) {
  const ceiling = Number.isFinite(maxBehind) && maxBehind > 0 ? maxBehind : DEFAULT_MAX_BEHIND;
  const behindN = Number(behind) || 0;
  const aheadN = Number(ahead) || 0;
  if (conflict) {
    return {
      status: 'blocked',
      reason: `dry-run merge conflicts (${behindN} behind / ${aheadN} ahead) — reconciliation required before further dispatch onto this scope`,
    };
  }
  if (behindN > ceiling) {
    return {
      status: 'blocked',
      reason: `${behindN} commits behind (ceiling ${ceiling}) — reconciliation required before further dispatch onto this scope`,
    };
  }
  if (behindN > ceiling / 2) {
    return { status: 'watch', reason: `${behindN} commits behind — approaching the ${ceiling}-commit reconciliation ceiling` };
  }
  return { status: 'ok', reason: null };
}

/** Parse `git rev-list --left-right --count <target>...<branch>`'s tab-separated `"<behind>\t<ahead>"` output.
 *  PURE. Returns `{ahead:0, behind:0}` on unparseable input (fails toward "nothing to report" rather than
 *  throwing — the IO shell already logs the raw git failure that produced it). */
export function parseLeftRightCount(raw) {
  const m = /^\s*(\d+)\s+(\d+)\s*$/.exec(String(raw || ''));
  if (!m) return { ahead: 0, behind: 0 };
  return { behind: Number(m[1]), ahead: Number(m[2]) };
}

// ── IO SHELL (git/gh only past this point — the CLI, gated on the main-module check) ───────────────────────

function parseFlags(argv) {
  const flags = {};
  for (const a of argv) {
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq === -1) flags[a.slice(2)] = true;
    else flags[a.slice(2, eq)] = a.slice(eq + 1);
  }
  return flags;
}

function sh(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts });
}

function maxBehindFromFlags(flags) {
  const raw = flags['max-behind'] ?? process.env[MAX_BEHIND_ENV];
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MAX_BEHIND;
}

function branchFromFlags(flags) {
  return typeof flags.branch === 'string' && flags.branch
    ? flags.branch
    : process.env.WE_BRANCH_DRIFT_BRANCH || DEFAULT_DRIFT_BRANCH;
}

function targetFromFlags(flags) {
  return typeof flags.target === 'string' && flags.target
    ? flags.target
    : process.env.WE_BRANCH_DRIFT_TARGET || DEFAULT_DRIFT_TARGET;
}

function notesRefFromFlags(flags) {
  return typeof flags['notes-ref'] === 'string' && flags['notes-ref'] ? flags['notes-ref'] : DEFAULT_NOTES_REF;
}

/** Compute the live ahead/behind + dry-run-merge-conflict picture for `branch` vs `target` on `origin`. Every
 *  git call is best-effort past the two counts: a `merge-tree` failure (conflict OR a transient git error) both
 *  read as `conflict:true` — the SAFE direction (a spurious `blocked` at worst holds dispatch a tick longer;
 *  never the reverse). Returns `null` when the branch/target refs themselves can't be resolved (nothing to
 *  report — e.g. a fixture repo missing one side). */
function computeDrift({ branch, target, cwd, fetch = true }) {
  if (fetch) {
    try {
      // EXPLICIT destination refspecs — a bare `<ref>` source relies on "opportunistic" remote-tracking updates
      // that are not guaranteed across every git/config combination; naming `refs/remotes/origin/<ref>` as the
      // destination makes the subsequent `origin/<ref>` reads reliable regardless.
      sh('git', ['fetch', 'origin', '--quiet', `+${branch}:refs/remotes/origin/${branch}`, `+${target}:refs/remotes/origin/${target}`], { cwd });
    } catch { /* best-effort — stale refs still usable */ }
  }
  let behind = 0, ahead = 0;
  try {
    const raw = sh('git', ['rev-list', '--left-right', '--count', `origin/${target}...origin/${branch}`], { cwd });
    ({ behind, ahead } = parseLeftRightCount(raw));
  } catch {
    return null; // one side doesn't exist / isn't fetched — nothing to report
  }
  let conflict = false;
  try {
    sh('git', ['merge-tree', '--write-tree', `origin/${target}`, `origin/${branch}`], { cwd });
  } catch {
    conflict = true; // non-zero exit = a real conflict (or a transient error) — fail toward "blocked"
  }
  return { ahead, behind, conflict };
}

/** Persist the report as a git note on the branch's tip, pushed to origin (best-effort — a push failure is
 *  reported but never fatal; the local note + the printed summary are still useful within this tick).
 *
 *  FORCE-PUSHES the notes ref, deliberately. This report is a recomputed-every-tick STATUS, not an audit
 *  trail — nothing ever reads its history, only its latest content (`readReport` reads the branch tip's
 *  current note, nothing else). A plain (non-force) push compares against the SERVER's current ref value, so
 *  any sweep run from a checkout whose local notes history isn't a fast-forward descendant of what a PRIOR
 *  sweep (from a DIFFERENT checkout/clone) already pushed is rejected — and on a fresh clone the local notes
 *  ref starts EMPTY (plain `git clone` never fetches `refs/notes/*`), so this is not a rare edge case, it is
 *  the common case the moment more than one checkout ever sweeps the same branch. A silently-swallowed push
 *  failure there does not just fail open harmlessly: it can leave a STALE stuck report (an old `ok` verdict
 *  origin still serves after reality has drifted to `blocked`) that every later sweep recomputes correctly
 *  but can never publish — exactly defeating the point of this cadence. Force-push (last-write-wins) removes
 *  the non-fast-forward rejection entirely; losing prior note HISTORY costs nothing since none is ever read. */
function persistReport(report, { branch, cwd, notesRef, push = true }) {
  let tipSha = null;
  try { tipSha = sh('git', ['rev-parse', `origin/${branch}`], { cwd }).trim(); } catch { return { noted: false, pushed: false, tipSha: null }; }
  try {
    sh('git', ['notes', `--ref=${notesRef}`, 'add', '-f', '-m', JSON.stringify(report), tipSha], { cwd });
  } catch {
    return { noted: false, pushed: false, tipSha };
  }
  if (!push) return { noted: true, pushed: false, tipSha };
  try {
    sh('git', ['push', '--force', 'origin', notesRef], { cwd });
    return { noted: true, pushed: true, tipSha };
  } catch {
    return { noted: true, pushed: false, tipSha };
  }
}

/** Read back the latest report for `branch` from its git note, fetching the notes ref first (cheap — one small
 *  ref). Returns `{status:'unknown', reason:'no report yet'}` when no note exists / nothing can be resolved —
 *  the fail-open shape `dispatch-plan.mjs` relies on (an absent report never blocks dispatch). */
function readReport({ branch, cwd, notesRef, fetch = true }) {
  if (fetch) {
    try {
      sh('git', ['fetch', 'origin', '--quiet', `+${branch}:refs/remotes/origin/${branch}`, `+${notesRef}:${notesRef}`], { cwd });
    } catch { /* best-effort */ }
  }
  let tipSha = null;
  try { tipSha = sh('git', ['rev-parse', `origin/${branch}`], { cwd }).trim(); } catch { return { status: 'unknown', reason: 'branch ref not resolvable' }; }
  try {
    const raw = sh('git', ['notes', `--ref=${notesRef}`, 'show', tipSha], { cwd });
    const parsed = JSON.parse(raw);
    return { status: 'unknown', reason: null, ...parsed };
  } catch {
    return { status: 'unknown', reason: 'no report yet for this tip' };
  }
}

async function main(argv) {
  const [verb, ...rest] = argv;
  const flags = parseFlags(rest.length ? rest : argv);
  const branch = branchFromFlags(flags);
  const target = targetFromFlags(flags);
  const notesRef = notesRefFromFlags(flags);
  const cwd = typeof flags['repo-dir'] === 'string' && flags['repo-dir'] ? flags['repo-dir'] : process.cwd();
  const asJson = !!flags.json;
  const log = (m) => process.stderr.write(m + '\n');

  if (verb === 'check') {
    const report = readReport({ branch, cwd, notesRef, fetch: !flags['no-fetch'] });
    if (asJson) process.stdout.write(JSON.stringify(report) + '\n');
    else log(`branch-drift check ${branch} vs ${target}: ${report.status}${report.reason ? ` (${report.reason})` : ''}`);
    // process.exitCode (not process.exit) — the exit is the LAST thing that runs, so Node drains stdout
    // naturally; process.exit() here would race an async pipe write and can TRUNCATE it (write-all-sync.mjs).
    process.exitCode = flags['fail-on-blocked'] && report.status === 'blocked' ? 2 : 0;
    return;
  }

  // default verb: sweep
  const drift = computeDrift({ branch, target, cwd, fetch: !flags['no-fetch'] });
  if (!drift) {
    log(`branch-drift sweep: could not resolve origin/${branch} and/or origin/${target} — nothing to report`);
    process.exit(0);
    return;
  }
  const maxBehind = maxBehindFromFlags(flags);
  const verdict = classifyBranchDrift({ ...drift, maxBehind });
  const report = { branch, target, checkedAt: new Date().toISOString(), ahead: drift.ahead, behind: drift.behind, conflict: drift.conflict, maxBehind, ...verdict };
  const persisted = persistReport(report, { branch, cwd, notesRef, push: !flags['no-push'] });

  if (asJson) process.stdout.write(JSON.stringify({ ...report, ...persisted }) + '\n');
  else {
    log(
      `branch-drift sweep ${branch} vs ${target}: ${verdict.status} — ${drift.behind} behind / ${drift.ahead} ahead` +
        `${drift.conflict ? ' (dry-run merge conflicts)' : ''}${persisted.noted ? (persisted.pushed ? ' [reported]' : ' [reported locally — push failed]') : ' [report not persisted]'}`,
    );
    if (verdict.reason) log(`  ${verdict.reason}`);
  }
  // process.exitCode, not process.exit — same drain-safety reason as the `check` verb above.
  process.exitCode = 0;
}

const IS_CLI = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (IS_CLI) {
  main(process.argv.slice(2)).catch((e) => { process.stderr.write(`✗ branch-drift error: ${String(e && e.stack || e)}\n`); process.exit(1); });
}
