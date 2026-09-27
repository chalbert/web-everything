/**
 * @file scripts/lib/probation-launcher.mjs
 * @description THE PURE HALF OF THE PROBATION LAUNCHER (agy-launcher-probation, operator 2026-09-27) — every
 *   decision `we:scripts/operations/probation-heal-run.mjs` makes, as data in, data out. No fs, no spawn, no clock.
 *
 * WHAT IT LAUNCHES. A {@link ./provider-routing.mjs#selectProbationWorker} pick — Codex, Antigravity-Claude or
 * Antigravity-Gemini — through the two synchronous launcher scripts that already exist and already block until
 * the model's turn ends: `we:scripts/gemini-direct-task.mjs` (agy) and `we:scripts/codex-direct-task.mjs`. Both
 * NEVER commit or push; the run script owns the commit, the push and every PR write, so a probation worker
 * only ever edits files in its lane.
 *
 * THE CHECKS AROUND THE MODEL (deterministic core, thin judgment):
 *   - {@link healDiffWithinEnvelope} — the heal's own diff must fit `PROVEN_TASK_ENVELOPES['ci-heal']`, or it is
 *     not pushed (the router cannot bound a heal up front; this bounds it after the run).
 *   - {@link parseCheckerVerdict} — a worker with a `checker` (Antigravity-Gemini, #3922) is pushed only when the
 *     checker's first line is `APPROVE`. Anything else — silence, a parse failure, `REJECT` — blocks the push.
 */

import { PROVEN_TASK_ENVELOPES } from './provider-routing.mjs';

/** The launcher scripts a probation worker may name, repo-relative. */
export const PROBATION_LAUNCHERS = Object.freeze(['scripts/gemini-direct-task.mjs', 'scripts/codex-direct-task.mjs']);

/** Per-attempt model wall for one heal turn (both launchers accept `--timeout-ms`). */
export const PROBATION_TURN_TIMEOUT_MS = 30 * 60 * 1000;

/**
 * argv (after `node`) for ONE synchronous worker run in `dir`. PURE.
 * @param {{worker: {launcher: string, model: string}, weRoot: string, dir: string, taskFile: string,
 *   timeoutMs?: number}} o
 * @returns {string[]}
 */
export function buildWorkerArgv({ worker, weRoot, dir, taskFile, timeoutMs = PROBATION_TURN_TIMEOUT_MS }) {
  if (!PROBATION_LAUNCHERS.includes(worker?.launcher)) {
    throw new TypeError(`probation-launcher: unknown launcher ${JSON.stringify(worker?.launcher)} — one of ${PROBATION_LAUNCHERS.join(', ')}`);
  }
  for (const [name, v] of Object.entries({ weRoot, dir, taskFile, model: worker.model })) {
    if (typeof v !== 'string' || !v.trim()) throw new TypeError(`probation-launcher: ${name} is required`);
  }
  return [
    `${weRoot}/${worker.launcher}`,
    `--dir=${dir}`,
    `--task-file=${taskFile}`,
    `--model=${worker.model}`,
    `--timeout-ms=${timeoutMs}`,
    '--gate=none',
    '--json',
  ];
}

/**
 * argv (after `node`) for the READ-ONLY checker run over a heal diff. PURE. The checker is Codex today (the only
 * value `PROBATION_WORKERS` names); its `--review` mode runs under `-s read-only` and answers in `lastMessage`.
 * @param {{checker: string, weRoot: string, dir: string, taskFile: string}} o
 * @returns {string[]}
 */
export function buildCheckerArgv({ checker, weRoot, dir, taskFile }) {
  if (checker !== 'codex') throw new TypeError(`probation-launcher: unsupported checker ${JSON.stringify(checker)}`);
  return [`${weRoot}/scripts/codex-direct-task.mjs`, '--review', `--dir=${dir}`, `--task-file=${taskFile}`, '--gate=none', '--json'];
}

/**
 * The task text a worker gets for one CI heal. PURE. It carries everything the worker needs, because the worker
 * has no brief of its own: the PR, why the heal fired, what failed, and the rules a heal keeps.
 * @param {{pr: number, reason: string, scope: string[], failingChecks: string, gateOutput: string, logTail?: string}} o
 * @returns {string}
 */
export function buildCiHealTask({ pr, reason, scope = [], failingChecks = '', gateOutput = '', logTail = '' }) {
  const clip = (text, max) => {
    const t = String(text ?? '').trim();
    return t.length > max ? `…(clipped)\n${t.slice(-max)}` : t;
  };
  return [
    `# CI heal for pull request #${pr} (${reason})`,
    '',
    'This working directory is the pull request\'s branch, already rebased onto the current `main`.',
    'Its required CI is red (or it was behind `main`). Make the SMALLEST change that turns the failing check green.',
    '',
    'Rules:',
    '- Repair ONLY the CI break. Do not change what the pull request is for, and do not fold in unrelated work.',
    '- Never weaken, skip or delete a test to make it pass.',
    `- Stay inside the pull request's own scope where you can: ${scope.length ? scope.join(', ') : '(no declared scope)'}.`,
    '- Keep the repair small: at most 3 files and about 150 changed lines. A bigger repair is not a CI heal — stop and say so.',
    '- If the red is not a CI break at all (the change itself is wrong, or it needs a design call), change nothing and say so in your final message.',
    '- Do not commit, push, open a pull request, or touch any label. The launcher that started you does those.',
    '',
    '## Failing required checks',
    clip(failingChecks, 4000) || '(none reported by GitHub — the local gate below is red)',
    '',
    '## Local gate output (the diff-selected gate, run after the rebase)',
    clip(gateOutput, 8000) || '(not run)',
    ...(logTail ? ['', '## Failing CI log (tail)', clip(logTail, 8000)] : []),
    '',
  ].join('\n');
}

/**
 * The checker's task: the heal diff and the question. PURE.
 * @param {{pr: number, reason: string, diff: string, failingChecks: string}} o
 */
export function buildCheckerTask({ pr, reason, diff, failingChecks = '' }) {
  const d = String(diff ?? '');
  return [
    `You are checking a small CI repair another model made on pull request #${pr} (${reason}).`,
    'Answer on the FIRST line with exactly `APPROVE` or `REJECT`, then one short paragraph of reasons.',
    'REJECT if the repair weakens, skips or deletes a test, changes what the pull request is for, is broader than the',
    'failing check needs, or would not plausibly turn the failing check green.',
    '',
    '## Failing checks',
    String(failingChecks || '(none reported)').slice(0, 4000),
    '',
    '## The repair diff',
    d.length > 20000 ? `${d.slice(0, 20000)}\n…(clipped)` : d,
  ].join('\n');
}

/**
 * The checker's verdict from its final message. PURE, fail-closed: only a first non-empty line that is exactly
 * `APPROVE` (case-insensitive, markdown emphasis stripped) approves.
 * @param {string|null|undefined} message
 * @returns {{approved: boolean, verdict: 'approve'|'reject'|'unreadable', reason: string}}
 */
export function parseCheckerVerdict(message) {
  const lines = String(message ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return { approved: false, verdict: 'unreadable', reason: 'the checker gave no answer' };
  const head = lines[0].replace(/[*_`#>\s]/g, '').toUpperCase();
  if (head === 'APPROVE') return { approved: true, verdict: 'approve', reason: lines.slice(1).join(' ').slice(0, 500) };
  if (head === 'REJECT') return { approved: false, verdict: 'reject', reason: lines.slice(1).join(' ').slice(0, 500) };
  return { approved: false, verdict: 'unreadable', reason: `the first line was not APPROVE or REJECT: ${lines[0].slice(0, 120)}` };
}

/**
 * Sum `git diff --numstat` output. PURE. Binary files (`-\t-\tpath`) count as one file and zero lines.
 * `exclude` drops paths that were untracked BEFORE the worker ran: `gemini-direct-task.mjs` intent-adds every
 * untracked file for its own diff capture, so such a path shows up in the numstat without being the worker's
 * (live-caught 2026-09-27: a `node_modules` symlink was committed with the first real agy heal).
 * @param {string} numstat
 * @param {{exclude?: string[]}} [o]
 * @returns {{files: number, loc: number, paths: string[]}}
 */
export function summarizeNumstat(numstat, { exclude = [] } = {}) {
  const skip = new Set(exclude);
  const paths = [];
  let loc = 0;
  for (const line of String(numstat ?? '').split('\n')) {
    const m = /^(\d+|-)\t(\d+|-)\t(.+)$/.exec(line.trim());
    if (!m || skip.has(m[3])) continue;
    paths.push(m[3]);
    loc += (m[1] === '-' ? 0 : Number(m[1])) + (m[2] === '-' ? 0 : Number(m[2]));
  }
  return { files: paths.length, loc, paths };
}

/**
 * The untracked paths the WORKER created: `after` minus whatever was already untracked before it ran. PURE.
 * Live-caught on the first real agy run (2026-09-27): an untracked `node_modules` symlink present in the lane
 * before the worker started was swept into the heal commit. Only these paths may be intent-added to the diff.
 * @param {string[]} before
 * @param {string[]} after
 * @returns {string[]}
 */
export function newUntrackedPaths(before, after) {
  const had = new Set(Array.isArray(before) ? before : []);
  return (Array.isArray(after) ? after : []).filter((p) => !had.has(p));
}

/**
 * Does a heal diff fit the probation envelope for `ci-heal`? PURE.
 * @param {{files: number, loc: number}} summary
 * @returns {{ok: boolean, reason: string}}
 */
export function healDiffWithinEnvelope(summary, envelope = PROVEN_TASK_ENVELOPES['ci-heal']) {
  if (summary.files > envelope.maxFiles) return { ok: false, reason: `the heal touched ${summary.files} files (limit ${envelope.maxFiles})` };
  if (summary.loc > envelope.maxLoc) return { ok: false, reason: `the heal changed ${summary.loc} lines (limit ${envelope.maxLoc})` };
  return { ok: true, reason: `${summary.files} file(s), ${summary.loc} line(s) — within the ci-heal envelope` };
}

/**
 * Should the worker run at all? PURE. The deterministic rebase + gate go first; a model is only spent when there
 * is something to repair: the local gate is red, or CI was red and the rebase changed nothing (so the local gate
 * cannot have fixed what CI saw).
 * @param {{gateGreen: boolean, reason: string, rebaseMovedHead: boolean}} o
 */
export function workerNeeded({ gateGreen, reason, rebaseMovedHead }) {
  if (!gateGreen) return { needed: true, why: 'the local gate is red after the rebase' };
  if (reason === 'red-ci' && !rebaseMovedHead) return { needed: true, why: 'CI is red and the rebase changed nothing, so the local gate cannot explain the red' };
  return { needed: false, why: rebaseMovedHead ? 'the rebase alone turned the local gate green' : 'nothing to repair' };
}

/**
 * The `Co-Authored-By` trailer for a commit made on a probation worker's behalf. PURE. Mirrors
 * `deliver-item-wrapper.mjs#coAuthorTrailerFor` (Codex's trailer is that file's), adding the two agy families.
 * @param {{provider: string, model: string}} worker
 */
export function coAuthorTrailerForWorker(worker) {
  if (worker?.provider === 'codex') return 'Co-Authored-By: Codex <noreply@openai.com>';
  if (String(worker?.model ?? '').startsWith('gemini-')) return `Co-Authored-By: Gemini (${worker.model}, via Antigravity) <noreply@google.com>`;
  return `Co-Authored-By: Claude (${worker?.model ?? 'unknown'}, via Antigravity) <noreply@anthropic.com>`;
}

/**
 * The commit message for a probation heal. PURE. The trailers name who did the work, so the review and the
 * trial record can tell a probation heal from a Claude one.
 * @param {{pr: number, reason: string, worker: object, item?: string|null}} o
 */
export function buildHealCommitMessage({ pr, reason, worker, item = null }) {
  const title = `${item ? `WE #${item}` : `PR #${pr}`}: CI-heal PR #${pr} on probation (${worker.executor}/${worker.model}, ${reason})`;
  return [
    title,
    '',
    `Repaired by the ${worker.id} probation worker (agy-launcher-probation); the launcher rebased, ran the gate,`,
    'and committed. Full review and a run rating are owed on this change.',
    '',
    `Probation-Worker: ${worker.id}`,
    `Executor: ${worker.executor}`,
    `Model: ${worker.model}`,
    coAuthorTrailerForWorker(worker),
    '',
  ].join('\n');
}

/**
 * The scorecard row one launch appends (store: `run-scorecard-store.mjs`). PURE. `outcome` and `verifiedBy`
 * stay null: a launch is not a judged trial until its review lands, so it never counts toward graduation — it
 * only moves `selectProbationWorker`'s rotation on and shows up in the probation report as "launched".
 * @param {object} o
 */
export function launchScorecardRow({ worker, pr, repo, handle, item = null, launchOutcome, checker = null, diff = null, scoredAt }) {
  return {
    rubricVersion: 'probation-launch.1',
    provider: worker.provider,
    model: worker.model,
    subjectClass: 'work-agent',
    dispatchKind: 'probation-launch',
    taskType: worker.taskType,
    criteriaEvaluated: 0,
    score: null,
    deductions: [],
    outcome: null,
    verifiedBy: null,
    executor: worker.executor,
    worker: worker.id,
    launchOutcome,
    checker,
    diff,
    pr,
    repo,
    handle,
    item,
    ...(scoredAt ? { scoredAt } : {}),
  };
}
