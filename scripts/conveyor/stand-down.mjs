/**
 * stand-down.mjs — post the durable STAND-DOWN comment when a conveyor fix agent stops to ASK rather than
 * guess (#3296). This is the third sibling of `rearm-review.mjs` (#2643) and `ci-heal-mark.mjs` (#2666), and it
 * shares their difference from the re-arm swap: it posts a durable marker comment and makes **NO LABEL SWAP**.
 * A stand-down leaves the PR exactly as the reviewer left it — `review:changes` stays, `review:human` stays,
 * nothing is cleared. The strongest thing a stood-down agent records is a comment.
 *
 * WHY THIS EXISTS — cause 3 of #3296, the sharpest of the six. `we:skills-src/conveyor/fix-agent-brief.md`
 * has two escalation exits: the ambiguous-finding exit (§2) and the red-gate exit (§4). Both are CORRECT
 * behaviour — an agent that cannot safely make a judgment must not guess — and both wrote **nothing durable**.
 * The PR kept `review:changes`, no comment was posted, and the agent's one-line return went to a calling
 * session that then exited. So on the PR itself, *"a fixer proved the fix wrong and stood down"* was
 * byte-identical to *"a fixer died"*. Any reconciler reading that PR re-dispatches the refusal forever, burning
 * tokens to re-ask a question nobody is there to answer. This marker is the one bit that tells them apart.
 *
 * TERMINAL FOR THE RECONCILER, NOT FOR A PERSON. `planReconcile` treats a PR carrying this marker as terminal
 * with no decay and no clock: it will not dispatch a fixer at this PR again, however long it waits. The
 * intended exit is a HUMAN — who reads the escalation, makes the judgment, and clears the marker (or takes the
 * PR over via `/finish`). That asymmetry is deliberate and it is stated in the comment body itself, because a
 * marker that quietly buries a PR forever would be a worse defect than the one it fixes.
 *
 * WHY A SCRIPT AND NOT PROSE IN THE BRIEF. The brief already asks the agent to RETURN a one-line escalation;
 * asking it to also *remember* to write a durable record is a write-back responsibility placed on prose an LLM
 * must obey (the hazard #3095 names). #3095 explicitly declined to RULE on that hazard — its approach 2 "was
 * declined on COST and SIZE rather than on merit" — so this file does not claim its authority. Script-not-prose
 * stands here on its own argument: the count IS PR state, and a step that must never be skipped belongs in a
 * command the brief shells, not in a sentence it hopes was read. Per
 * [we:docs/agent/platform-decisions.md#deterministic-core-thin-judgment] (#2607).
 *
 * NO PARALLEL STATE STORE (#2612 invariant). The stand-down record lives on the PR's own comment thread, read
 * back by {@link countStandDownComments} — exactly as `countRearmComments` / `countCiHealComments` already work.
 * No new label is minted and no label's meaning changes.
 */
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

/**
 * we:scripts/conveyor/stand-down.mjs#STAND_DOWN_MARKER — the stable FIRST LINE of the durable stand-down comment.
 * Single-sourced HERE and used two ways: the CLI POSTS a comment starting with it whenever a fix agent escalates,
 * and {@link countStandDownComments} MATCHES it to recover "did a fixer already stand down here" from the PR
 * ITSELF (#3296). Distinct from `REARM_COMMENT_MARKER` (#2643) and `CI_HEAL_COMMENT_MARKER` (#2666) so the three
 * durable counts can never cross-count. Treat this line as fixed: changing it orphans the marker on every PR that
 * already carries one, and each of those would read as never-stood-down again — re-opening the infinite
 * re-dispatch this file exists to close.
 */
export const STAND_DOWN_MARKER = '🛑 conveyor fix — stood down, human judgment needed';

/**
 * we:scripts/conveyor/stand-down.mjs#STAND_DOWN_REASONS — the escalation exits the fix-agent brief actually has,
 * named once so the brief's two call sites and this file's comment body cannot drift apart. Keyed by the flag
 * value the brief passes; the value is the clause that goes in the durable comment.
 *
 * These four are the brief's REAL exits, read off it rather than imagined: the ambiguous-finding exit
 * (`fix-agent-brief.md` §2), the red-gate exit (§4), and the two `not-applicable` / conflict stops (§1, §3).
 */
export const STAND_DOWN_REASONS = Object.freeze({
  'needs-judgment': 'the reviewer\'s finding needs a judgment the fix agent could not safely make, so it did NOT guess',
  'gate-red': 'the gate stayed RED after the repair, and a red diff must never be re-pushed',
  'conflict': 'a genuine same-line conflict with `main` blocked the repair',
  'lane-ref-gone': 'the PR\'s lane ref no longer resolves, so the ~done work could not be reconstituted',
});

/**
 * DELIBERATELY NOT A REASON HERE: a permission / tool-use denial while applying an otherwise-clear fix (live
 * 2026-09-23, PR #2518 — a `python3` heredoc rewriting `backlog/3945-*.md` was denied by Claude Code's own
 * auto-mode classifier, `[Modify Shared Resources]`). That is infrastructure friction, not a judgment call: the
 * WHAT to do stayed unambiguous, only the HOW failed. Adding a `blocked-by-permission`-shaped entry here would
 * make it terminal (this marker has no decay, no clock — see the file header) when the right behaviour is a
 * RETRY once the friction clears. `we:skills-src/conveyor/fix-agent-brief.md` step 3 routes this case through
 * `completion-cli.mjs report --outcome=blocked-on-infra` instead — the same self-reported-done channel
 * `we:scripts/conveyor/reconcile-core.mjs#markSelfReportedDone` already retries after
 * `INFRA_RETRY_COOLOFF_MS` — and never through this script. Keep it that way: a future reason added here for
 * "the tool call was denied" would re-introduce the exact misclassification this comment documents.
 */

/**
 * we:scripts/conveyor/stand-down.mjs#standDownComments — every comment on a PR whose LEADING line is
 * {@link STAND_DOWN_MARKER}, normalized to `{ body, createdAt }` in the order `comments` was given. Pure, and the
 * ONE place the leading-line match rule is written — {@link countStandDownComments} is just its length, and any
 * caller that needs to read a stand-down comment BACK (not just know one exists — e.g. the operator queue's
 * STOOD DOWN section, which surfaces when it stood down and why) filters through this, never re-derives the rule.
 *
 * The caller passes the PR's `comments` exactly as `gh pr view <pr> --json comments` returns them
 * (`[{ body, createdAt }]`); a bare-string array is tolerated too (its `createdAt` comes back `null`). A comment
 * matches only when the marker is its LEADING line (`trimStart().startsWith`), so a human QUOTING the stand-down
 * comment in a reply never counts — the same narrowing `countRearmComments` and `countCiHealComments` apply, for
 * the same reason.
 * @param {Array<{body?:string, createdAt?:string}|string>|null|undefined} comments
 * @returns {Array<{body: string, createdAt: ?string}>}
 */
export function standDownComments(comments) {
  if (!Array.isArray(comments)) return [];
  const out = [];
  for (const c of comments) {
    const body = typeof c === 'string' ? c : c?.body;
    if (typeof body === 'string' && body.trimStart().startsWith(STAND_DOWN_MARKER)) {
      out.push({ body, createdAt: (typeof c === 'string' ? null : c?.createdAt) ?? null });
    }
  }
  return out;
}

/**
 * we:scripts/conveyor/stand-down.mjs#countStandDownComments — the DURABLE, restart-surviving stand-down count for
 * a PR (#3296). Every fix-agent escalation posts exactly ONE comment whose leading line is
 * {@link STAND_DOWN_MARKER}, so counting those comments recovers "has a fixer already stopped to ask here" from
 * the PR ITSELF. `planReconcile` refuses to dispatch a fixer at any PR whose count is above zero — terminal, with
 * no decay and no clock, because re-running an agent that stood down only re-asks the same question.
 *
 * Pure — built on {@link standDownComments}, which is where the leading-line match rule actually lives.
 * @param {Array<{body?:string}|string>|null|undefined} comments
 * @returns {number} the number of conveyor stand-down comments on the PR (0 for a non-array / empty input)
 */
export function countStandDownComments(comments) {
  return standDownComments(comments).length;
}

/**
 * we:scripts/conveyor/stand-down.mjs#standDownReason — read back the stated reason clause from a stand-down
 * comment body built by {@link buildStandDownComment}. Pure string parsing — the inverse of that builder: the
 * comment's third line always reads `<actor> stopped rather than guessing: <why>.<detail>`, so the clause between
 * the colon and the sentence's end is what a reader actually wants (the operator queue surfaces it verbatim,
 * per-PR, rather than making a human open the comment to find out).
 *
 * Returns `null` when the body does not carry that sentence — a hand-written or otherwise malformed stand-down
 * comment — so the caller decides how to render "no reason stated"; this never invents one.
 * @param {string} body
 * @returns {?string}
 */
export function standDownReason(body) {
  const match = /stopped rather than guessing:\s*([^\n]*)/.exec(typeof body === 'string' ? body : '');
  if (!match) return null;
  return match[1].trim().replace(/\.$/, '').trim() || null;
}

/**
 * we:scripts/conveyor/stand-down.mjs#buildStandDownComment — the durable comment body an escalating fix agent
 * posts. Its FIRST line MUST be {@link STAND_DOWN_MARKER} (single-sourced) so posting and counting can never
 * drift. Pure.
 *
 * The body states the ASYMMETRY explicitly — terminal for the reconciler, cleared by a person — because that is
 * the difference between a marker and a burial. A reader who finds this comment must be able to see, without
 * reading any code, that the automation has deliberately stopped and that they are the intended next step.
 * @param {{ actor?:string, reason?:string, detail?:string }} o
 * @returns {string}
 */
export function buildStandDownComment({ actor = 'conveyor fix agent', reason = '', detail = '' } = {}) {
  const why = STAND_DOWN_REASONS[reason] || 'the fix agent could not complete the repair safely';
  return [
    STAND_DOWN_MARKER,
    '',
    `${actor} stopped rather than guessing: ${why}.${detail ? ` ${detail}` : ''}`,
    '',
    'The PR was left EXACTLY as the reviewer left it — no label was changed, the review was not re-armed, and ' +
      'nothing was re-pushed. This comment is the durable record that a fixer *deliberately stood down* here, ' +
      'which is what tells the reconciler apart from a fixer that simply died.',
    '',
    '**A human is the intended next step.** The automatic fix loop will NOT try this PR again while this comment ' +
      'stands — re-running it would only re-ask the same question. Take it over with `/finish`, or delete this ' +
      'comment once the blocker is resolved to hand the PR back to the loop.',
  ].join('\n');
}

// ── IO SHELL (runs only as a CLI — the pure exports above stay side-effect-free on import) ────────────────────────
const IS_CLI = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);
if (IS_CLI) {
  const argv = process.argv.slice(2);
  const flags = {};
  const positionals = [];
  for (const a of argv) {
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq === -1) flags[a.slice(2)] = true;
      else flags[a.slice(2, eq)] = a.slice(eq + 1);
    } else positionals.push(a);
  }
  const fail = (m) => {
    process.stderr.write(`✗ ${m}\n`);
    process.exit(1);
  };
  const pr = Number(positionals[0]);
  if (!Number.isInteger(pr) || pr <= 0) {
    fail(`usage: stand-down.mjs <pr> [--repo=<owner/name>] [--reason=<${Object.keys(STAND_DOWN_REASONS).join('|')}>] [--actor=<name>] [--detail=<text>]  (pr must be a positive integer)`);
  }
  const body = buildStandDownComment({
    actor: typeof flags.actor === 'string' ? flags.actor : undefined,
    reason: typeof flags.reason === 'string' ? flags.reason : undefined,
    detail: typeof flags.detail === 'string' ? flags.detail : undefined,
  });
  const args = ['pr', 'comment', String(pr), '--body', body];
  if (typeof flags.repo === 'string') args.push(`--repo=${flags.repo}`); // the fix agent runs in its WE lane clone; a missing --repo derives from cwd.
  try {
    execFileSync('gh', args, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
  } catch (e) {
    fail(`could not post stand-down comment on PR #${pr}: ${String(e.message || e).split('\n')[0]}`);
  }
  process.stdout.write(JSON.stringify({ ok: true, pr, stoodDown: true }) + '\n');
}
