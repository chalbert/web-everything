#!/usr/bin/env node
/**
 * @file scripts/clear-human-request.mjs
 * @description Perform the `clear-human` ceremony from a GitHub comment the OPERATOR authored, for an operator
 *   who is away from any host that holds a GitHub credential.
 *
 * ── WHY THIS IS NOT THE SAME PATH AS `apply-review-request.mjs`, AND MUST NOT BE MERGED INTO IT ──────────────
 *
 * `we:scripts/apply-review-request.mjs` REFUSES `clear-human`, and that refusal is correct and stays. Its
 * authorisation basis is *a push to a branch*: push access is not personhood, the job runs unattended, and
 * `review:human` is the one tier built to survive a machine with a write token (INVARIANT 2, #2285).
 *
 * This file's basis is different in kind: **GitHub authenticated the actor**. The comment carries a login and an
 * `author_association` that the requester cannot set, and the workflow checks them server-side before this runs.
 * That is a human gesture, evidenced by the forge rather than asserted by us.
 *
 * Two paths, two bases, two answers to the same question. Unifying them would silently give the push path the
 * clearance authority this one earns — the exact escalation #2285 exists to prevent.
 *
 * ── HOW STRONG THE SIGNAL ACTUALLY IS, stated so nobody overstates it later ──────────────────────────────────
 *
 * It proves: *someone holding the owner's GitHub credentials performed a deliberate, named act on this PR.*
 *
 * It does NOT prove a physical human gesture. #2946 (WebAuthn) is that, and stays open.
 *
 * And it is CONDITIONAL, which is the part most likely to be forgotten. #2946's threat model observes that a
 * local construct cannot bind an agent that already has shell access — a laptop agent holds the PAT, so it
 * could post this very comment, and the signal would be worth nothing there. What makes it worth something is
 * that the REQUESTING host cannot act as the operator on GitHub. That is true of a Claude Code cloud VM, where
 * no local process holds a credential and none can be given one (`we:agent-memory-src/`
 * `workflow-cloud-vm-github-api-boundary.md`). The day an agent on the requesting host holds an owner-scoped
 * token, this degrades to exactly the self-assertion #2895 describes, and this comment is the warning.
 *
 * ── WHAT IS PARSED, AND WHAT IS NOT ──────────────────────────────────────────────────────────────────────────
 *
 * #3060 records what it costs to infer a clearance from a prose line. Nothing is inferred here. The trigger is
 * an EXACT command token; everything after it is carried verbatim as the reason and never read for meaning.
 * A comment that merely discusses clearing the gate does not clear it — it does not begin with the token.
 *
 * Usage (from the workflow; every field comes from the verified event payload):
 *   node scripts/clear-human-request.mjs --event=<path to the event JSON>
 *   node scripts/clear-human-request.mjs --event=<path> --check   # validate only, run nothing
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeLineSync } from './lib/write-all-sync.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(HERE, '..');

/** The exact token that begins a clearance. Not a phrase, not a mention — one token, at the start. */
export const CLEAR_TOKEN = '/clear-human';

/**
 * Which `author_association` values may clear. OWNER only, deliberately: `COLLABORATOR` and `MEMBER` are
 * grants an org admin can widen without touching this repo, and the tier is about the person, not the access
 * level. Widening this is a decision, so it must be an edit here rather than a config nobody reads.
 */
export const CLEARING_ASSOCIATIONS = Object.freeze(['OWNER']);

/**
 * Read the clearance out of a comment body. PURE.
 *
 * The token must OPEN the comment: a clearance is a deliberate act, not a sentence buried in a paragraph about
 * one. A reason is mandatory — the single home already refuses `clear-human` without `--reason` (#2895), and
 * catching it here means the refusal names the comment rather than surfacing from a subprocess.
 *
 * @returns {{ok: true, reason: string} | {ok: false, error: string}}
 */
export function parseClearHumanComment(body) {
  const text = typeof body === 'string' ? body.replace(/\r\n/g, '\n').trim() : '';
  if (!text.startsWith(CLEAR_TOKEN)) {
    return { ok: false, error: `not a clearance — a comment must BEGIN with \`${CLEAR_TOKEN}\`` };
  }
  const rest = text.slice(CLEAR_TOKEN.length);
  // `/clear-humanoid …` is not this command. The token must be followed by whitespace or end the comment.
  if (rest && !/^\s/.test(rest)) {
    return { ok: false, error: `not a clearance — \`${CLEAR_TOKEN}\` must be followed by a space and a reason` };
  }
  const reason = rest.trim();
  if (!reason) {
    return {
      ok: false,
      error: `\`${CLEAR_TOKEN}\` requires a stated reason on the same comment — it is posted verbatim in the `
        + 'durable clearance record (#2895), and a clearance nobody explained cannot be reviewed later',
    };
  }
  return { ok: true, reason };
}

/**
 * May this commenter clear? PURE, and it checks the association GitHub computed — never a claim in the body.
 *
 * `login` is compared against the repository owner because `author_association` alone is a category, not an
 * identity: it answers "what kind of relationship" and this tier needs "which person".
 */
export function authorizeClearance({ login, association, owner } = {}) {
  if (!login || !owner) return { ok: false, error: 'clearance requires both a commenter login and a repo owner' };
  if (!CLEARING_ASSOCIATIONS.includes(String(association))) {
    return {
      ok: false,
      error: `REFUSED: ${login} has author_association ${JSON.stringify(association)}; `
        + `only ${CLEARING_ASSOCIATIONS.join('|')} may perform a human ceremony (INVARIANT 2, #2285)`,
    };
  }
  if (String(login).toLowerCase() !== String(owner).toLowerCase()) {
    return { ok: false, error: `REFUSED: ${login} is not the repository owner (${owner})` };
  }
  return { ok: true };
}

/**
 * The reason as it will be recorded: the operator's words, then the provenance GitHub can vouch for. The URL is
 * what makes this record checkable by someone who was not there — they can open the comment and see the author
 * badge, which is the whole basis of the clearance.
 */
export function buildReason({ reason, commentUrl, login }) {
  return `${reason}\n\n— cleared by @${login} at ${commentUrl} (GitHub-authenticated comment; `
    + 'proves the owner\'s account acted, not that a physical gesture occurred — #2946 remains open)';
}

/** The argv handed to the SINGLE HOME. PURE, and it builds no `gh` call of its own. */
export function buildLabelArgv({ pr, repo, actor, reason }) {
  return [
    join(REPO_ROOT, 'scripts', 'review-set-label.mjs'),
    String(pr),
    `--repo=${repo}`,
    '--to=clear-human',
    `--actor=${actor}`,
    `--reason=${reason}`,
    '--channel=github-comment',
  ];
}

/**
 * Pull the fields this needs out of a GitHub `issue_comment` event. PURE over the parsed payload.
 * Refuses an event that is not a comment on a PULL REQUEST — an issue has no review label to clear.
 */
export function readEvent(payload) {
  const issue = payload?.issue;
  if (!issue?.pull_request) return { ok: false, error: 'not a pull-request comment — nothing to clear' };
  const pr = Number(issue.number);
  if (!Number.isInteger(pr) || pr <= 0) return { ok: false, error: `unusable PR number ${JSON.stringify(issue.number)}` };
  const repo = payload?.repository?.full_name;
  if (typeof repo !== 'string' || !/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    return { ok: false, error: `unusable repository ${JSON.stringify(repo)}` };
  }
  return {
    ok: true,
    event: {
      pr,
      repo,
      owner: payload?.repository?.owner?.login,
      login: payload?.comment?.user?.login,
      association: payload?.comment?.author_association,
      body: payload?.comment?.body,
      commentUrl: payload?.comment?.html_url,
    },
  };
}

function main(argv) {
  const flag = (name) => {
    const hit = argv.find((a) => a.startsWith(`--${name}=`));
    return hit === undefined ? undefined : hit.slice(name.length + 3);
  };
  const eventPath = flag('event');
  if (!eventPath) throw new Error('usage: clear-human-request.mjs --event=<event.json> [--check]');

  let payload;
  try {
    payload = JSON.parse(readFileSync(eventPath, 'utf8'));
  } catch (e) {
    throw new Error(`could not read ${eventPath} — ${e.message}`);
  }

  const read = readEvent(payload);
  if (!read.ok) throw new Error(read.error);
  const { event } = read;

  // ORDER MATTERS: authorise the PERSON before reading their words. A refusal must never depend on what a
  // non-owner wrote, so an unauthorised comment cannot even reach the parser.
  const allowed = authorizeClearance(event);
  if (!allowed.ok) throw new Error(allowed.error);

  const parsed = parseClearHumanComment(event.body);
  if (!parsed.ok) throw new Error(parsed.error);

  const reason = buildReason({ reason: parsed.reason, commentUrl: event.commentUrl, login: event.login });
  const argvOut = buildLabelArgv({ pr: event.pr, repo: event.repo, actor: event.login, reason });

  if (argv.includes('--check')) {
    writeLineSync(1, `ok — ${event.repo}#${event.pr} clear-human by ${event.login} (validated, nothing run)`);
    return 0;
  }

  const r = spawnSync(process.execPath, argvOut, { encoding: 'utf8', cwd: REPO_ROOT });
  if (r.stdout) writeLineSync(1, r.stdout.trim());
  if (r.status !== 0) {
    if (r.stderr) writeLineSync(2, r.stderr.trim());
    return r.status ?? 1;
  }
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (e) {
    writeLineSync(2, `clear-human-request: ${e.message}`);
    process.exitCode = 2;
  }
}
