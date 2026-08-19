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

/** The verdicts this applier may carry out. */
export const APPLIABLE_TARGETS = Object.freeze(['accepted', 'changes', 'clear-human']);

/**
 * `clear-human` requires this field, and its NAME is the guard. You cannot populate `operatorInstruction`
 * without claiming, in writing, that an operator said something — and it is posted verbatim in the durable
 * comment, where a false one is legible to anyone who looks.
 */
export const CLEARANCE_FIELD = 'operatorInstruction';

/**
 * Validate a staged request. PURE — returns `{ok, request}` or `{ok:false, error}`; never throws, never reads
 * the world, so every refusal below is testable without a runner.
 *
 * ── `clear-human`: REFUSED UNTIL 2026-08-19, NOW ALLOWED WITH ITS AUTHORISATION ATTACHED ────────────────────
 *
 * This file used to refuse `clear-human` outright, on the grounds that CI holding a write token is a machine
 * and a token is not a ceremony. Operator ruling, 2026-08-19, made with the weakness stated in front of them:
 *
 *   "For now, I want to allow you to accept an explicit demand to remove human tag. We will build the ui
 *    approved later."
 *
 * WHAT THAT DOES AND DOES NOT GIVE UP. The sanctioned workstation path is `review-set-label.mjs
 * --to=clear-human --actor=<name> --reason=<quote the operator instruction authorising this>`, and NOTHING
 * there verifies that a human said it either — #2895 shipped the clearance as "the raw command with better
 * manners" and deferred the unforgeable signal to #2946. So relaying an operator's instruction through a
 * request file is exactly as strong as running the command on a laptop, and no stronger. It is not a new
 * weakness; it is the SAME one, reachable from one more place.
 *
 * A day earlier this same session built a comment-triggered clearance that claimed GitHub had authenticated
 * the operator. It had not: every comment an agent posts through the session's GitHub connector carries the
 * operator's own login and `author_association: OWNER`. That design was reverted. The lesson is kept here as
 * the reason this one claims nothing: an honest weak path beats a path that overstates itself.
 *
 * WHAT STILL HOLDS THE LINE, given the signal cannot:
 *   · `operatorInstruction` is MANDATORY and travels verbatim into the durable comment. A clearance nobody
 *     asked for now requires inventing a quote and publishing it under your own name.
 *   · The trust boundary is unchanged in kind and wider in blast radius: whoever can push to
 *     `ops/review-requests` can now also clear a gate-self hold. On a solo repo that is already the same
 *     authority as pushing the code. On a repo with more than one writer it would need revisiting FIRST.
 *   · #2946 (a WebAuthn gesture) remains the durable fix and remains open. This does not close it, and every
 *     record this path writes says so.
 *
 * @param {unknown} raw - the parsed request object
 * @returns {{ok: true, request: object} | {ok: false, error: string}}
 */
export function validateRequest(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'request must be a JSON object' };
  }
  const { repo, pr, to, actor, body, sessionId, channel } = raw;
  const operatorInstruction = raw[CLEARANCE_FIELD];

  if (typeof repo !== 'string' || !/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    return { ok: false, error: `\`repo\` must be <owner/name>, got ${JSON.stringify(repo)}` };
  }
  if (!Number.isInteger(pr) || pr <= 0) {
    return { ok: false, error: `\`pr\` must be a positive integer, got ${JSON.stringify(pr)}` };
  }
  // THE TARGET IS CHECKED FIRST, and the order is the fix rather than a tidy-up. With the field guards ahead of
  // it, a request naming an unknown target AND carrying a stray instruction was refused for the stray field —
  // reporting the second-most-wrong thing about it, and sending a reader to fix the wrong line
  // (review-pr correctness juror on #1477). Whether `to` is a target at all is the more fundamental question,
  // so it is asked first.
  if (!APPLIABLE_TARGETS.includes(to)) {
    return { ok: false, error: `\`to\` must be one of ${APPLIABLE_TARGETS.join('|')}, got ${JSON.stringify(to)}` };
  }
  if (to === 'clear-human' && (typeof operatorInstruction !== 'string' || !operatorInstruction.trim())) {
    return {
      ok: false,
      error: `REFUSED: \`clear-human\` requires \`${CLEARANCE_FIELD}\` — the operator's own words authorising `
        + 'this clearance, quoted verbatim. Nothing verifies them (#2946 is the durable fix and is open), so '
        + 'the record has to be WRITTEN: it is posted in the durable comment under the actor named here.',
    };
  }
  if (to !== 'clear-human' && operatorInstruction !== undefined) {
    // A stray instruction on an ordinary verdict means someone copied a clearance request and edited the
    // target. Refuse rather than silently ignore the field: the next edit is the one that flips it back.
    return { ok: false, error: `\`${CLEARANCE_FIELD}\` belongs only on a \`clear-human\` request` };
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
  return { ok: true, request: { repo, pr, to, actor, body: body ?? '', sessionId, channel, operatorInstruction } };
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
  // The single home requires `--reason` for `clear-human` (#2895) and posts it verbatim. The operator's words
  // ARE the reason — nothing is paraphrased, because a paraphrase is the agent's account of what it was told
  // rather than what it was told.
  if (request.to === 'clear-human') argv.push(`--reason=${request.operatorInstruction}`);
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
