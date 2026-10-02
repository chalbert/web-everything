/**
 * ci-heal-mark.mjs — post the durable CI-HEAL comment on a conveyor PR that a CI-heal agent has rebased + repaired
 * (#2666). This is the CI-half sibling of `rearm-review.mjs`, with ONE deliberate difference: it posts a durable
 * marker comment but makes NO LABEL SWAP on the ORDINARY path — a CI-heal repairs only the CI axis, so it must
 * NEVER touch a live `review:human` / `review:pending` / `review:changes` (the human review gate stays exactly as
 * it was).
 *
 * An existing acceptance is carried only through the shared CLI's head-bound coverage proof.
 * Failed proof/restamp falls back to the existing accepted-only rearm; other live verdicts remain protected.
 * Both operations are best-effort and report their outcomes separately from the durable heal comment.
 *
 * WHY A DURABLE COMMENT (the whole point — mirrors #2643). The conveyor bounds auto CI-heal at N attempts per PR so
 * a genuinely-broken diff can't flap forever. That cap must survive a conveyor RESTART, which wipes the in-session
 * `ciHealAttempts` map. So each completed heal posts exactly ONE comment whose leading line is
 * {@link CI_HEAL_COMMENT_MARKER}, and the tick core recovers the attempt count by counting those comments
 * ({@link countCiHealComments}) — the count IS PR state, read back off the PR's own thread, with NO parallel state
 * store (#2612). Build and count share ONE marker (single-sourced here) so they can never drift; treat the marker
 * line as fixed — changing it orphans the count on every open CI-heal PR's history (a burned PR would read as zero
 * attempts again, re-exposing the exact restart reset this design prevents).
 *
 * Scripted per [we:docs/agent/platform-decisions.md#deterministic-core-thin-judgment] (#2607): the "how many heals
 * has this PR cost" question is a pure, script-decidable count over the PR's comments — it lives here as a pure
 * function the tick core shells, never a rule the conveyor SKILL re-derives in prose.
 */
import { resolve } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { resolveChildTimeoutMs } from '../lib/bounded-child.mjs';
import { isTrustedMarkerAuthor } from '../lib/marker-authorship.mjs';
import { REVIEW_LABELS, hasReviewLabel } from '../lib/review-escalation.mjs';
import { isBudgetRefusal, postPrComment, recordOwedWrite, resolveOwedRepo } from './ci-heal-owed.mjs';

/**
 * we:scripts/conveyor/ci-heal-mark.mjs#CI_HEAL_COMMENT_MARKER — the stable FIRST LINE of the durable CI-heal comment.
 * Single-sourced and used two ways: the CLI POSTS a comment starting with it on every completed heal, and
 * {@link countCiHealComments} MATCHES it to recover the attempt count from the PR (#2666). Distinct from the fix
 * loop's re-arm marker so the two durable floors never cross-count.
 */
export const CI_HEAL_COMMENT_MARKER = '🩹 conveyor CI-heal — rebased & re-pushed';

/**
 * we:scripts/conveyor/ci-heal-mark.mjs#countCiHealComments — the DURABLE, restart-surviving CI-heal attempt count for
 * a PR (#2666). Every completed CI-heal posts exactly ONE comment whose leading line is {@link CI_HEAL_COMMENT_MARKER},
 * so counting those comments recovers "how many times this PR was auto-CI-healed" from the PR ITSELF — the retry cap
 * then binds even after a conveyor restart wipes the in-session `ciHealAttempts` map (the exact unbounded heal↔red
 * loop the cap exists to prevent). Pure — the caller passes the PR's `comments` exactly as `gh pr view <pr> --json
 * comments` returns them (`[{ body }]`); a bare-string array is tolerated too. A comment is counted only when the
 * marker is its leading line (`trimStart().startsWith`), so a human QUOTING the comment in a reply never inflates it.
 * @param {Array<{body?:string}|string>|null|undefined} comments
 * @returns {number} the number of conveyor CI-heal comments on the PR (0 for a non-array / empty input)
 */
export function countCiHealComments(comments) {
  if (!Array.isArray(comments)) return 0;
  let n = 0;
  for (const c of comments) {
    const body = typeof c === 'string' ? c : c?.body;
    // #3383 — a forged CI-heal marker from an untrusted login must not inflate this PR's CI-heal round cap.
    if (typeof body === 'string' && body.trimStart().startsWith(CI_HEAL_COMMENT_MARKER) && isTrustedMarkerAuthor(c)) n += 1;
  }
  return n;
}

/**
 * we:scripts/conveyor/ci-heal-mark.mjs#buildCiHealComment — the durable comment body a completed heal posts. Its
 * FIRST line MUST be {@link CI_HEAL_COMMENT_MARKER} (single-sourced) so posting and counting can never drift. Pure.
 *
 * #4352 — when `headSha` is known it rides on the SECOND line as `head: <sha>` (the same field shape
 * `ci-heal-escalation-mark.mjs` already uses), so an owed retry can tell "THIS heal's comment already landed" from
 * "an older, unrelated heal posted its own marker" (`ci-heal-owed.mjs#owedWriteAlreadyLive`). Additive only: the
 * count above matches the first line alone, so the cap is unaffected.
 * @param {{ actor?:string, reason?:string, headSha?:string }} o
 * @returns {string}
 */
export function buildCiHealComment({ actor = 'conveyor CI-heal agent', reason = '', headSha = '' } = {}) {
  const why = reason === 'behind' ? 'the branch had fallen BEHIND `main`'
    : reason === 'red-ci' ? 'a required check had gone red after open'
    : 'a required check regressed after open';
  const head = typeof headSha === 'string' ? headSha.trim().toLowerCase() : '';
  return [
    CI_HEAL_COMMENT_MARKER,
    ...(head ? [`head: ${head}`] : []),
    '',
    `${why}; ${actor} rebased onto current \`main\`, repaired the failing check, and re-pushed HEAD.`,
    'This records the CI repair, not a review verdict. Existing `review:human` / `review:pending` holds stay in place; ' +
      'a live `review:accepted` may be re-armed separately for review. The drain lands it once green and reviewed.',
  ].join('\n');
}

/**
 * we:scripts/conveyor/ci-heal-mark.mjs#resolveHealHead — the head sha this heal's comment is FOR (#4352).
 * `--head` wins; otherwise the local `HEAD` of the lane clone the agent just pushed from — a local git read,
 * never a GitHub one (a budget block that refused the comment would refuse that read too). `''` when neither.
 * @param {{headFlag?:string, cwd?:string, exec?:Function}} o
 * @returns {string}
 */
export function resolveHealHead({ headFlag, cwd, exec = execFileSync } = {}) {
  if (typeof headFlag === 'string' && /^[0-9a-f]{40}$/i.test(headFlag.trim())) return headFlag.trim().toLowerCase();
  if (headFlag !== undefined && !/^[0-9a-f]{7,39}$/i.test(headFlag.trim())) return '';
  try {
    const sha = String(exec('git', ['rev-parse', '--verify', headFlag ? `${headFlag.trim()}^{commit}` : 'HEAD'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })).trim();
    return /^[0-9a-f]{40}$/i.test(sha) ? sha.toLowerCase() : '';
  } catch { return ''; }
}

/**
 * we:scripts/conveyor/ci-heal-mark.mjs#postOrOweCiHealComment — post the heal comment; on a BUDGET refusal
 * (`gh-throttle.mjs`'s `budget_blocked`/`budget_exhausted`), record it owed for
 * `ci-heal-pr-dispatch.mjs#runReconcileCiHealDispatch`'s next-tick flush instead of dropping it (#4352, the
 * `ci-heal-2821` incident). Any OTHER failure still throws — it is not a budget problem a later retry fixes.
 * An owe needs a head sha (the dedupe key) and a constellation repo; without either the refusal throws as before.
 * @returns {{commented:true}|{commented:false, owed:object}}
 */
export function postOrOweCiHealComment({ pr, body, headSha, repo, post = postPrComment, owe = recordOwedWrite }) {
  try {
    post({ pr, repo: repo?.slug, body });
    return { commented: true };
  } catch (e) {
    if (!isBudgetRefusal(e) || !headSha || !repo) throw e;
    const owed = owe({ repo: repo.key, slug: repo.slug, pr, kind: 'ci-heal', headSha, body });
    return { commented: false, owed };
  }
}

/**
 * we:scripts/conveyor/ci-heal-mark.mjs#spawnCiHealRearm — #2811. Hand a STALE `review:accepted` back for
 * re-review through the EXISTING, invariant-guarded `rearm-review.mjs` swap (never a second, hand-rolled label
 * write here) — mirrors `we:scripts/merge-ai-prs.mjs#restampAcceptance`'s own child-process shape exactly. The
 * child does its own fresh `gh pr view` and its own idempotent refusal (`decideSetLabel`'s `rearm` branch, #2811
 * follow-up: also re-armable from `review:accepted` alone, never just `review:changes`) — so this is safe to call
 * whenever the caller already knows (or merely suspects) an acceptance might be live; a PR with nothing to
 * re-arm just reports `{ok:false}` and changes nothing.
 * @param {{pr:number|string, repo?:string, cwd?:string, actor?:string, onlyIfAccepted?:boolean, spawn?:Function}} o
 * @returns {{ok:boolean, reason?:string}}
 */
export function spawnCiHealRearm({ pr, repo, cwd, actor = 'conveyor CI-heal agent', onlyIfAccepted = true, spawn = spawnSync } = {}) {
  const args = [new URL('./rearm-review.mjs', import.meta.url).pathname, String(pr), `--actor=${actor}`];
  if (repo) args.push(`--repo=${repo}`);
  // #4333 — validated at the CHILD's mutation boundary: both callers only ever re-arm a stale acceptance, so a
  // `review:changes` verdict that lands between the caller's read and the child's read is never overwritten.
  if (onlyIfAccepted) args.push('--only-if=accepted');
  try {
    // `spawnSync`-shaped (mirrors `restampAcceptance`'s own seam exactly) — NEVER throws on a non-zero exit, so
    // a refused re-arm (nothing to re-arm — the common case, no `review:accepted` live) is a plain `{ok:false}`
    // result, never a reason to fail the heal that already succeeded.
    const r = spawn(process.execPath, args, { encoding: 'utf8', cwd });
    if (r.status === 0) return { ok: true };
    return { ok: false, reason: String(r.stdout || r.stderr || `exit ${r.status}`).trim().split('\n').pop() };
  } catch (e) {
    return { ok: false, reason: String(e && e.message ? e.message : e) };
  }
}

/** Head-bound carry through the shared review write boundary; no new review is granted. */
export function spawnCiHealRestamp({ pr, repo, cwd, headSha, actor = 'conveyor CI-heal agent', spawn = spawnSync } = {}) {
  if (!/^[0-9a-f]{40}$/.test(headSha || '')) return { ok: false, reason: 'heal head is not a full commit SHA' };
  const args = [new URL('../review-set-label.mjs', import.meta.url).pathname, String(pr),
    '--to=restamp', `--expect-head=${headSha}`, `--actor=${actor}`, '--channel=ci-heal',
    '--reason=CI-heal hand-back; carry the existing review only if coverage is proven.'];
  if (repo) args.push(`--repo=${repo}`);
  try {
    const r = spawn(process.execPath, args, { encoding: 'utf8', cwd });
    return r.status === 0 ? { ok: true } : { ok: false, reason: String(r.stdout || r.stderr || `exit ${r.status}`).trim() };
  } catch (e) { return { ok: false, reason: String(e.message || e) }; }
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
    fail('usage: ci-heal-mark.mjs <pr> [--repo=<owner/name>] [--reason=<red-ci|behind>] [--actor=<name>] [--head=<sha>]  (pr must be a positive integer)');
  }
  const headSha = resolveHealHead({ headFlag: typeof flags.head === 'string' ? flags.head : undefined });
  const body = buildCiHealComment({
    actor: typeof flags.actor === 'string' ? flags.actor : undefined,
    reason: typeof flags.reason === 'string' ? flags.reason : undefined,
    headSha,
  });
  // The heal agent runs in its WE lane clone; a missing --repo derives from cwd (gh's own inference for the post,
  // the local `origin` remote for the owed record's key).
  const owedRepo = resolveOwedRepo({ repoFlag: typeof flags.repo === 'string' ? flags.repo : undefined });
  let posted;
  try {
    posted = postOrOweCiHealComment({
      pr, body, headSha, repo: owedRepo,
      // The post itself targets exactly what the caller named (or gh's cwd inference) — unchanged from before.
      post: ({ pr: n, body: b }) => postPrComment({ pr: n, repo: typeof flags.repo === 'string' ? flags.repo : undefined, body: b }),
    });
  } catch (e) {
    fail(`could not post CI-heal comment on PR #${pr}: ${String(e.message || e).split('\n')[0]}`);
  }
  if (!posted.commented) {
    process.stderr.write(`⚠ CI-heal comment on PR #${pr} refused by the GitHub budget — recorded owed (head ${headSha}); the next ci-heal-pr-dispatch tick posts it\n`);
  }
  let rearmed = false;
  let restamped = false;
  let carryReason;
  try {
    const viewArgs = ['pr', 'view', String(pr), '--json', 'labels'];
    if (typeof flags.repo === 'string') viewArgs.push(`--repo=${flags.repo}`);
    const raw = execFileSync('gh', viewArgs, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', timeout: resolveChildTimeoutMs(), killSignal: 'SIGKILL' });
    const labels = JSON.parse(raw || '{}').labels;
    if (hasReviewLabel(labels, REVIEW_LABELS.accepted)) {
      const handback = {
        pr, repo: typeof flags.repo === 'string' ? flags.repo : owedRepo?.slug,
        cwd: process.cwd(), actor: typeof flags.actor === 'string' ? flags.actor : undefined,
      };
      const carry = spawnCiHealRestamp({ ...handback, headSha });
      restamped = carry.ok;
      if (!restamped) {
        carryReason = carry.reason;
        rearmed = spawnCiHealRearm(handback).ok;
      }
    }
  } catch (e) {
    carryReason = String(e.message || e);
    // Best-effort (see the header) — an unreadable label state or a failed rearm never fails this CLI's own
    // exit code; the stale acceptance (if any) is caught by the next push through this same path, or by a human.
  }
  process.stdout.write(JSON.stringify({ ok: true, pr, commented: posted.commented, ...(posted.owed ? { owed: true } : {}), restamped, rearmed, ...(carryReason ? { carryReason } : {}) }) + '\n');
}
