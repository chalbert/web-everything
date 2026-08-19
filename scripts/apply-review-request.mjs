#!/usr/bin/env node
/**
 * @file scripts/apply-review-request.mjs
 * @description Apply ONE staged review request by running the SINGLE HOME (#2644) —
 *   `we:scripts/review-set-label.mjs` — on a host that can actually authenticate to GitHub.
 *
 * WHY THIS EXISTS. A judging host is not always a writing host. A Claude Code cloud VM can run the whole
 * `review-pr` operation — measured 2026-08-18: four PRs judged, ten findings, nine real defects — and then
 * cannot record a single verdict, because no local process there holds a GitHub credential and none can be
 * given one (see `we:agent-memory-src/workflow-cloud-vm-github-api-boundary.md`). Its ONE outbound write
 * channel is `git push`. So the verdict travels as a pushed FILE, and CI — which has `gh` and a token —
 * applies it.
 *
 * IT RUNS THE REAL SCRIPT. Nothing here re-implements the label arc. The markers
 * (`reviewed-sha`/`reviewed-diff`/`reviewed-contribution`), the #2964 write ordering, the #2844 independence
 * check and every refusal stay exactly where they are. This file's whole job is: read a request, refuse the
 * ones a bot must not perform, and shell the CLI. A second implementation of the label arc is the defect this
 * is forbidden to introduce.
 *
 * THE VERDICT IS DATA, NEVER PROSE. It arrives as JSON in a committed file — reviewable in a diff — and is
 * never parsed back out of a comment. #3060 records what happens when a clearance is inferred from a prose
 * line, and this must not re-open it.
 *
 * Usage:
 *   node scripts/apply-review-request.mjs <request.json>          # apply it
 *   node scripts/apply-review-request.mjs <request.json> --check  # validate only, run nothing
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeLineSync } from './lib/write-all-sync.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(HERE, '..');

/** The verdicts a MACHINE applier may carry out. */
export const APPLIABLE_TARGETS = Object.freeze(['accepted', 'changes']);

/**
 * Validate a staged request. PURE — returns `{ok, request}` or `{ok:false, error}`; never throws, never reads
 * the world, so every refusal below is testable without a runner.
 *
 * `clear-human` IS REFUSED HERE, and it is the one rule in this file that is not merely validation.
 * `review:human` is human-ceremony-only (INVARIANT 2, #2285): the whole tier exists so that a gate-self edit
 * cannot be cleared by a machine. CI holding a write token is still a machine, and a token is not a ceremony —
 * so it is refused BEFORE the CLI is reached, rather than relying on the CLI's own guard. Two refusals for one
 * rule is deliberate: this path is unattended, and the failure mode is silent escalation of the exact tier
 * built to stop it.
 *
 * @param {unknown} raw - the parsed request object
 * @returns {{ok: true, request: object} | {ok: false, error: string}}
 */
export function validateRequest(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'request must be a JSON object' };
  }
  const { repo, pr, to, actor, body, sessionId, channel } = raw;

  if (typeof repo !== 'string' || !/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    return { ok: false, error: `\`repo\` must be <owner/name>, got ${JSON.stringify(repo)}` };
  }
  if (!Number.isInteger(pr) || pr <= 0) {
    return { ok: false, error: `\`pr\` must be a positive integer, got ${JSON.stringify(pr)}` };
  }
  if (to === 'clear-human') {
    return {
      ok: false,
      error: 'REFUSED: `clear-human` is human-ceremony-only (INVARIANT 2, #2285) and a machine applier may '
        + 'never perform it. CI holding a write token is still a machine; a token is not a ceremony. Clear it '
        + 'from a session, by a human.',
    };
  }
  if (!APPLIABLE_TARGETS.includes(to)) {
    return { ok: false, error: `\`to\` must be one of ${APPLIABLE_TARGETS.join('|')}, got ${JSON.stringify(to)}` };
  }
  // The single home REFUSES an empty `--to=changes` (#xd6moh1) — a bounce with no findings tells an author
  // nothing. Catch it here too so the request is rejected at validation rather than after a subprocess.
  if (to === 'changes' && (typeof body !== 'string' || !body.trim())) {
    return { ok: false, error: '`changes` requires a non-empty `body` — a bounce with no findings lands nothing' };
  }
  if (typeof actor !== 'string' || !actor.trim()) {
    return { ok: false, error: '`actor` is required — a verdict with no named actor is not attributable' };
  }
  // OPTIONAL, and its absence is honest rather than fatal: without it `currentActorId()` finds nothing and the
  // durable comment records independence as UNPROVEN, which is the truth. Fabricating one here would be worse.
  if (sessionId !== undefined && (typeof sessionId !== 'string' || !sessionId.trim())) {
    return { ok: false, error: '`sessionId`, when present, must be a non-empty string' };
  }
  if (channel !== undefined && (typeof channel !== 'string' || !channel.trim())) {
    return { ok: false, error: '`channel`, when present, must be a non-empty string' };
  }
  return { ok: true, request: { repo, pr, to, actor, body: body ?? '', sessionId, channel } };
}

/**
 * The argv handed to the single home. PURE, and exported so a test can assert it without running anything —
 * the same discipline `we:scripts/lib/review-label-provider.mjs` applies to its own `gh` argv.
 */
export function buildLabelArgv(request, bodyFile) {
  const argv = [
    join(REPO_ROOT, 'scripts', 'review-set-label.mjs'),
    String(request.pr),
    `--repo=${request.repo}`,
    `--to=${request.to}`,
    `--actor=${request.actor}`,
  ];
  if (bodyFile) argv.push(`--body-file=${bodyFile}`);
  if (request.channel) argv.push(`--channel=${request.channel}`);
  return argv;
}

/**
 * The environment the CLI runs under. `CLAUDE_CODE_SESSION_ID` carries the JUDGING session's identity so
 * `currentActorId()` records who decided — not the runner, which decided nothing.
 *
 * STATE THE LIMIT PLAINLY: the request declares that id and nothing verifies it, exactly as an env var on a
 * workstation is unverified today. This relocates the self-assertion; it does not remove it. #2946 (the
 * unforgeable human-presence signal) is the durable fix and this does not pretend to be it.
 */
export function buildEnv(request, base = process.env) {
  const env = { ...base };
  if (request.sessionId) env.CLAUDE_CODE_SESSION_ID = request.sessionId;
  else delete env.CLAUDE_CODE_SESSION_ID;
  return env;
}

function main(argv) {
  const path = argv.find((a) => !a.startsWith('-'));
  if (!path) throw new Error('usage: apply-review-request.mjs <request.json> [--check]');
  const checkOnly = argv.includes('--check');

  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    throw new Error(`could not read ${path} — ${e.message}`);
  }

  const verdict = validateRequest(parsed);
  if (!verdict.ok) throw new Error(`${path}: ${verdict.error}`);
  const { request } = verdict;

  if (checkOnly) {
    writeLineSync(1, `ok — ${request.repo}#${request.pr} → ${request.to} (validated, nothing run)`);
    return 0;
  }

  // The body reaches the CLI by FILE for the same reason the CLI passes it to `gh` by file: it carries
  // newlines and emoji, and shell-quoting them works until one verdict does not.
  const bodyFile = request.body ? join(tmpdir(), `review-request-${request.pr}-${process.pid}.md`) : null;
  try {
    if (bodyFile) writeFileSync(bodyFile, request.body, 'utf8');
    const r = spawnSync(process.execPath, buildLabelArgv(request, bodyFile), {
      encoding: 'utf8', env: buildEnv(request), cwd: REPO_ROOT,
    });
    // The CLI speaks the `{"error":…}` / `{"ok":true,…}` JSON contract on stdout. Pass it straight through:
    // this file adds no interpretation, so an operator reads the single home's own words.
    if (r.stdout) writeLineSync(1, r.stdout.trim());
    if (r.status !== 0) {
      if (r.stderr) writeLineSync(2, r.stderr.trim());
      return r.status ?? 1;
    }
    return 0;
  } finally {
    if (bodyFile) { try { unlinkSync(bodyFile); } catch { /* best-effort */ } }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (e) {
    writeLineSync(2, `apply-review-request: ${e.message}`);
    process.exitCode = 2;
  }
}
