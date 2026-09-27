#!/usr/bin/env node
/**
 * @file scripts/operations/probation-heal-run.mjs
 * @description THE PROBATION HEAL RUN (agy-launcher-probation, operator 2026-09-27) — the detached per-dispatch
 *   process `dispatch-providers/probation-worker.mjs` starts for one opened, non-critical `ci-heal`. It follows the
 *   same arc as `we:skills-src/conveyor/fix-agent-ci-brief.md`, with the SCRIPT doing every script-decidable step
 *   and the probation worker (Codex / Antigravity-Claude / Antigravity-Gemini) doing only the repair itself:
 *
 *     0. completion `started`, and capture the PR head it is about to examine (EXAMINED_HEAD, #4269);
 *     1. acquire a lane reset to the PR's head ref (`lane-pool.mjs acquire --base=<ref>`);
 *     2. rebase onto `origin/main` — a conflict escalates, exactly as the brief does (no model is spent on it);
 *     3. run the diff-selected gate. `probation-launcher.mjs#workerNeeded` decides whether a model is needed at
 *        all: a clean rebase that turned the gate green is pushed with NO model run;
 *     4. otherwise run the worker SYNCHRONOUSLY through its launcher (`gemini-direct-task.mjs` / `codex-direct-task.mjs`,
 *        both foreground-blocking by design), then re-run the gate;
 *     5. bound the heal diff to the `ci-heal` envelope, and for a worker with a `checker` (Gemini, #3922) get an
 *        `APPROVE` from the checker before anything is pushed;
 *     6. commit (explicit paths, trailers naming the worker), push `--force-with-lease` against EXAMINED_HEAD,
 *        post the durable CI-heal comment (`ci-heal-mark.mjs`), write the completion record;
 *     7. when the worker ran, append one `probation-launch` row to the scorecard store (no outcome yet — the
 *        review decides that; a rebase-only heal is not a trial of the worker and writes no row).
 *
 * FULL REVIEW ON EVERY RESULT. A heal push moves the PR head, and an acceptance is stamped against the head it
 * reviewed (`review-set-label.mjs`'s `restamp` exists only for a head the DRAIN moved), so every pushed heal is
 * reviewed again before it can land. This script never touches a review label and never restamps.
 *
 * NEVER merges, never touches `main`, never releases the lane (same as the brief: the lease ages out).
 * IO lives in the `io` object so the whole arc is testable with fakes; the CLI block at the bottom wires the
 * real processes.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { appendScorecard as appendScorecardRow } from '../conveyor/run-scorecard-store.mjs';
import {
  buildCheckerArgv, buildCheckerTask, buildCiHealTask, buildHealCommitMessage, buildWorkerArgv,
  healDiffWithinEnvelope, launchScorecardRow, parseCheckerVerdict, summarizeNumstat, workerNeeded,
} from '../lib/probation-launcher.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
/** The WE checkout every tool is resolved from — by script location, never cwd. */
export const WE_ROOT = resolve(HERE, '..', '..');
const REPO_SLUG = 'chalbert/web-everything';
const GATE_TIMEOUT_MS = 20 * 60 * 1000;

/** Parse `--k=v` flags. PURE. */
export function parseArgs(argv) {
  const flags = {};
  for (const a of argv) {
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq === -1) flags[a.slice(2)] = true;
    else flags[a.slice(2, eq)] = a.slice(eq + 1);
  }
  const worker = typeof flags.worker === 'string' ? JSON.parse(flags.worker) : null;
  return {
    pr: Number(flags.pr),
    session: String(flags.session ?? ''),
    reason: String(flags.reason ?? 'red-ci'),
    num: flags.num ? String(flags.num) : null,
    lane: flags.lane ? Number(flags.lane) : null,
    scope: typeof flags.scope === 'string' && flags.scope ? flags.scope.split(',') : [],
    worker,
    dryRun: flags['dry-run'] === true,
  };
}

/**
 * THE ARC. Returns `{outcome, executor, detail}` — `executor` is who actually changed code: the worker's
 * executor when it ran, `mechanical` when the rebase alone healed it, `none` when nothing was pushed.
 * @param {ReturnType<typeof parseArgs>} args
 * @param {object} io - see {@link realIo} for the shape.
 */
export async function runProbationHeal(args, io) {
  const { pr, session, reason, worker } = args;
  if (!Number.isInteger(pr) || pr <= 0 || !session || !worker?.id) throw new Error('probation-heal-run: --pr, --session and --worker are required');
  const log = (m) => io.log(`probation-heal-run PR #${pr} [${worker.id}]: ${m}`);
  const complete = (status, outcome) => io.completion({ pr, session, item: args.num, status, outcome });
  const finish = (outcome, executor, detail, row = {}) => {
    complete('done', outcome);
    // One `probation-launch` row per heal the WORKER actually ran — a rebase-only heal is not a trial of it.
    if (executor === worker.executor) {
      io.appendScorecard(launchScorecardRow({ worker, pr, repo: REPO_SLUG, handle: session, item: args.num, launchOutcome: outcome, ...row }));
    }
    log(`${outcome} — ${detail}`);
    return { outcome, executor, detail };
  };

  complete('started', null);
  const head = io.prHead(pr);
  if (!head || head.state !== 'OPEN') return finish('not-applicable', 'none', 'the PR is not open');
  const examinedHead = head.headRefOid;

  const lanePath = io.acquireLane({ ref: head.headRefName, lane: args.lane, session, scope: args.scope });
  if (!lanePath) {
    io.escalate({ pr, head: examinedHead, reason: `lane ref gone — ${head.headRefName} no longer resolves` });
    return finish('not-applicable', 'none', 'could not acquire a lane on the PR head');
  }

  if (!io.rebaseOntoMain(lanePath)) {
    io.escalate({ pr, head: examinedHead, reason: 'conflict with main during rebase' });
    return finish('escalated-conflict', 'none', 'rebase onto main conflicted');
  }
  const rebaseMovedHead = io.headSha(lanePath) !== examinedHead;
  let gate = io.runGate(lanePath);
  const need = workerNeeded({ gateGreen: gate.pass, reason, rebaseMovedHead });
  log(`after rebase: gate ${gate.pass ? 'green' : 'red'}, head ${rebaseMovedHead ? 'moved' : 'unchanged'} — ${need.why}`);

  let executor = 'mechanical';
  let checkerRow = null;
  let diffRow = null;
  if (need.needed) {
    const baseSha = io.headSha(lanePath);
    const task = buildCiHealTask({ pr, reason, scope: args.scope, failingChecks: io.failingChecks(pr), gateOutput: gate.output, logTail: io.failedLogTail(pr) });
    const taskFile = io.writeTaskFile(lanePath, 'probation-heal-task.md', task);
    log(`running ${worker.launcher} --model=${worker.model}`);
    const run = io.runWorker(buildWorkerArgv({ worker, weRoot: WE_ROOT, dir: lanePath, taskFile }));
    executor = worker.executor;
    const summary = summarizeNumstat(io.diffNumstat(lanePath, baseSha));
    diffRow = { files: summary.files, loc: summary.loc };
    if (!summary.files) return finish('escalated-needs-human', executor, `the worker changed nothing (${run.ok ? 'it finished' : 'it failed'})`, { diff: diffRow });
    const fits = healDiffWithinEnvelope(summary);
    if (!fits.ok) {
      io.discardChanges(lanePath, baseSha);
      return finish('gate-red', executor, `not pushed: ${fits.reason}`, { diff: diffRow });
    }
    gate = io.runGate(lanePath);
    if (!gate.pass) return finish('gate-red', executor, 'the gate is still red after the worker\'s repair', { diff: diffRow });
    if (worker.checker) {
      const checkerTask = io.writeTaskFile(lanePath, 'probation-heal-check.md', buildCheckerTask({ pr, reason, diff: io.diffText(lanePath, baseSha), failingChecks: io.failingChecks(pr) }));
      const verdict = parseCheckerVerdict(io.runChecker(buildCheckerArgv({ checker: worker.checker, weRoot: WE_ROOT, dir: lanePath, taskFile: checkerTask })));
      checkerRow = { provider: worker.checker, verdict: verdict.verdict, reason: verdict.reason };
      if (!verdict.approved) return finish('gate-red', executor, `the ${worker.checker} checker did not approve: ${verdict.verdict} ${verdict.reason}`, { diff: diffRow, checker: checkerRow });
    }
    io.commit(lanePath, summary.paths, buildHealCommitMessage({ pr, reason, worker, item: args.num }));
  } else if (!gate.pass || !rebaseMovedHead) {
    return finish('no-change', 'none', need.why);
  }

  if (!io.push(lanePath, head.headRefName, examinedHead)) {
    return finish('blocked-on-infra', executor, 'the push was refused (the PR head moved, or the remote is unreachable)', { diff: diffRow, checker: checkerRow });
  }
  io.markHealed({ pr, reason });
  return finish(executor === 'mechanical' ? 'no-change' : 'healed', executor, executor === 'mechanical' ? 'the rebase alone healed it; pushed' : 'repaired and pushed; a full review is owed', { diff: diffRow, checker: checkerRow });
}

// ─── the real processes ────────────────────────────────────────────────────────────────────────────────────

function sh(bin, args, opts = {}) {
  return execFileSync(bin, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024, ...opts });
}
function trySh(bin, args, opts = {}) {
  try { return { ok: true, out: sh(bin, args, opts) }; } catch (e) { return { ok: false, out: `${e?.stdout ?? ''}${e?.stderr ?? e?.message ?? ''}` }; }
}
const node = (script, args, opts) => trySh(process.execPath, [join(WE_ROOT, script), ...args], opts);

/** The real `io` for {@link runProbationHeal}. Every call is bounded and never throws past its own contract. */
export function realIo({ session, env = process.env } = {}) {
  const laneEnv = { ...env, LANE_SESSION: session };
  return {
    log: (m) => console.error(m),
    completion: ({ pr, session: s, item, status, outcome }) => {
      const args = ['report', `--repo=${REPO_SLUG}`, `--session=${s}`, '--kind=ci-heal', `--pr=${pr}`, `--status=${status}`];
      if (item) args.push(`--item=${item}`);
      if (outcome) args.push(`--outcome=${outcome}`);
      node('scripts/operations/completion-cli.mjs', args);
    },
    prHead: (pr) => {
      const r = trySh('gh', ['pr', 'view', String(pr), '--repo', REPO_SLUG, '--json', 'headRefOid,headRefName,state']);
      return r.ok ? JSON.parse(r.out) : null;
    },
    acquireLane: ({ ref, lane, session: s, scope }) => {
      const args = ['acquire', `--repo=${WE_ROOT}`, '--purpose=probation-ci-heal', `--session=${s}`, `--base=${ref}`];
      if (lane) args.push(`--lane=${lane}`);
      if (scope?.length) args.push(`--scope=${scope.join(',')}`);
      const r = node('scripts/lane-pool.mjs', args, { env: laneEnv, timeout: 15 * 60 * 1000 });
      if (!r.ok) return null;
      const last = r.out.trim().split('\n').filter(Boolean).at(-1) ?? '';
      return last.startsWith('/') ? last : null;
    },
    rebaseOntoMain: (dir) => {
      if (!trySh('git', ['-C', dir, 'fetch', 'origin', 'main']).ok) return false;
      if (trySh('git', ['-C', dir, 'rebase', 'origin/main']).ok) return true;
      trySh('git', ['-C', dir, 'rebase', '--abort']);
      return false;
    },
    headSha: (dir) => sh('git', ['-C', dir, 'rev-parse', 'HEAD']).trim(),
    runGate: (dir) => {
      const r = node('scripts/verify-lane.mjs', ['run', '--repo=.'], { cwd: dir, env: laneEnv, timeout: GATE_TIMEOUT_MS });
      return { pass: r.ok, output: r.out.slice(-12000) };
    },
    failingChecks: (pr) => {
      const r = trySh('gh', ['pr', 'checks', String(pr), '--repo', REPO_SLUG]);
      return r.out.split('\n').filter((l) => /\tfail/.test(l)).join('\n') || r.out.slice(0, 2000);
    },
    failedLogTail: () => '',
    writeTaskFile: (dir, name, text) => {
      // Inside `.git`, so the task text never shows up in the heal diff.
      const p = join(dir, '.git', name);
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, text);
      return p;
    },
    runWorker: (argv) => {
      // SYNCHRONOUS on purpose: both launchers block until the model's turn ends (see their headers).
      const r = trySh(process.execPath, argv, { env, timeout: 70 * 60 * 1000 });
      return { ok: r.ok, out: r.out.slice(-4000) };
    },
    runChecker: (argv) => {
      const r = trySh(process.execPath, argv, { env, timeout: 20 * 60 * 1000 });
      if (!r.ok) return '';
      try { return JSON.parse(r.out).lastMessage ?? ''; } catch { return ''; }
    },
    diffNumstat: (dir, base) => {
      const untracked = sh('git', ['-C', dir, 'ls-files', '--others', '--exclude-standard']).split('\n').filter(Boolean);
      if (untracked.length) trySh('git', ['-C', dir, 'add', '--intent-to-add', '--', ...untracked]);
      return sh('git', ['-C', dir, 'diff', '--numstat', base]);
    },
    diffText: (dir, base) => sh('git', ['-C', dir, 'diff', base]),
    discardChanges: (dir, base) => { trySh('git', ['-C', dir, 'reset', '--hard', base]); trySh('git', ['-C', dir, 'clean', '-fd']); },
    commit: (dir, paths, message) => {
      const msgFile = join(dir, '.git', 'probation-heal-commit-msg.txt');
      writeFileSync(msgFile, message);
      sh('git', ['-C', dir, 'add', '--', ...paths]);
      sh('git', ['-C', dir, 'commit', '-F', msgFile, '--', ...paths], { env: laneEnv });
    },
    push: (dir, ref, examinedHead) => trySh('git', ['-C', dir, 'push', `--force-with-lease=refs/heads/${ref}:${examinedHead}`, 'origin', `HEAD:refs/heads/${ref}`], { env: laneEnv }).ok,
    markHealed: ({ pr, reason }) => node('scripts/conveyor/ci-heal-mark.mjs', [String(pr), `--repo=${REPO_SLUG}`, `--reason=${reason}`]),
    escalate: ({ pr, head, reason }) => node('scripts/conveyor/ci-heal-escalation-mark.mjs', [String(pr), `--repo=${REPO_SLUG}`, `--head=${head}`, '--outcome=needs-human', `--reason=${reason}`]),
    appendScorecard: (row) => {
      // Best-effort: a lost trial row must never fail a heal that worked.
      try { appendScorecardRow(row); } catch (e) { console.error(`probation-heal-run: scorecard row not written: ${e?.message ?? e}`); }
    },
  };
}

const IS_CLI = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (IS_CLI) {
  const args = parseArgs(process.argv.slice(2));
  runProbationHeal(args, realIo({ session: args.session }))
    .then((r) => { console.log(JSON.stringify(r)); })
    .catch((e) => { console.error(`probation-heal-run: ${e?.message ?? e}`); process.exitCode = 1; });
}
