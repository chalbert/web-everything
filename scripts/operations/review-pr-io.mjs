/**
 * @file scripts/operations/review-pr-io.mjs
 * @description THE IO SHELL of the `review-pr` declaration (#3035, under epic #3029) — the reader its `read`
 *   step is injected with, and the sinks its `record` step's effects are applied through.
 *
 * WHY IT IS A SEPARATE FILE. {@link ./review-pr.mjs} is the DECLARATION: what the operation is. This is the
 * only place it touches the world, which is the same pure-core / io-shell split
 * {@link ./run-record.mjs} / {@link ./run-store.mjs} use, and it is what lets the declaration be unit-tested
 * with a stub reader and stub sinks — no `gh`, no `git`, no network.
 *
 * EVERY BINDING HERE SHELLS AN EXISTING SCRIPT. Nothing in this file decides anything about a review:
 *   - the park context is `we:scripts/review-detail.mjs#assembleReviewDetail`, the PURE assembler, fed by ONE
 *     `gh pr view` — the same single call its own CLI makes;
 *   - the diff and the changed-file list are `computeNetDiffText` / `computeNetDiffPaths`
 *     (`we:scripts/merge-ai-prs.mjs`, #2450/#2901) off ONE shared basis;
 *   - the label swap is `we:scripts/review-set-label.mjs`, the SINGLE HOME (#2644), shelled as a subprocess so
 *     it keeps its own `gh` arc, its `reviewed-sha`/`reviewed-diff`/`reviewed-contribution` markers, its
 *     independence check (#2844) and its #2964 write ordering. Re-implementing any of that here is the exact
 *     defect this slice is forbidden to introduce.
 *
 * IMPURE by construction: `gh`, `git`, `fs`.
 */

import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { assembleReviewDetail } from '../review-detail.mjs';
import { computeNetDiffPaths, computeNetDiffText, resolveNetDiffBasis } from '../merge-ai-prs.mjs';
import { notApplied } from './effect-executor.mjs';
import { REVIEW_EFFECTS } from './review-pr.mjs';
import { isValidRunId } from './run-record.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
/** The repo root, resolved by SCRIPT LOCATION and never by cwd — same reason `run-store.mjs` does it. */
export const REPO_ROOT = resolve(HERE, '..', '..');

/** Where the operation's own scratch lives — the gitignored `.operations/` sidecar, beside `runs/`. */
export function reviewSidecarDir(root = REPO_ROOT) {
  return join(root, '.operations', 'review');
}

/**
 * The staged write-up's path — RUN-SCOPED, and that is the whole point.
 *
 * The name in the payload (`<repo>-<pr>-verdict.md`) is keyed by PR only, so two runs reviewing the SAME PR in
 * the same checkout resolved to the SAME file: run B's write-up overwrote run A's staged bytes, and effect 1
 * then shelled the single home with `--body-file=` pointing at the wrong verdict. Interleaving the two runs'
 * effect 0 / effect 1 makes that a posted comment, not just a clobbered scratch file. A run id is the only
 * thing here that distinguishes them, so it is the directory.
 *
 * ORDINAL 0'S `idempotent: true` SURVIVES THIS, and the reason is that a replay is the SAME RUN. The effect
 * entry is created once and its payload frozen into the run record (`we:scripts/operations/engine.mjs`), and
 * `applyPendingEffects` re-applies the STORED entry with `ctx.runId = run.id` — the id of the record it is
 * resuming. So attempt N and attempt N+1 of one entry compute an identical path from an identical payload and
 * write identical bytes, which is exactly the property the declaration claims. Had the id been minted per
 * ATTEMPT rather than per run, this change would have broken it and would not be worth making.
 *
 * The id is validated with the SAME predicate the run store uses before putting it in a path, so a
 * `--run-id=` from the CLI cannot become a traversal. A missing or malformed id is refused rather than
 * silently falling back to the shared path — a fallback would restore the collision it exists to remove.
 *
 * @param {{root?: string, runId: string, bodyFile: string}} o
 * @returns {string} absolute path under `.operations/review/<runId>/`.
 */
export function reviewBodyPath({ root = REPO_ROOT, runId, bodyFile } = {}) {
  if (!isValidRunId(runId)) {
    throw new TypeError(
      `operations: the review write-up is staged per RUN, so it needs a valid run id — got ${JSON.stringify(runId)}. ` +
      'The sink reads it from the executor context (`ctx.runId`); a caller invoking the sink directly must supply one.',
    );
  }
  const name = String(bodyFile ?? '');
  if (!name || name.includes('/') || name.includes('\\') || name === '.' || name === '..') {
    throw new TypeError(`operations: invalid review write-up file name ${JSON.stringify(bodyFile)} — expected a bare file name`);
  }
  return join(reviewSidecarDir(root), runId, name);
}

/**
 * THE `exec` CONTRACT, spelled once. `resolveNetDiffBasis` and friends call it as
 * `exec('git', ['diff', …], { encoding: 'utf8', … })` — THREE positional args, `execFileSync`-shaped. The
 * natural-looking shell-exec `(cmd, opts) => execSync(cmd, opts)` receives the ARGS ARRAY in its `opts` slot and
 * throws inside a swallowed `try`, which surfaces as an unscored basis rather than as the caller bug it is
 * (#2952). `shapeReadFinding` REFUSES that case rather than falling back; this is the shape that avoids it.
 */
const execFileIn = (cwd) => (cmd, args, opts) => execFileSync(cmd, args, { ...opts, cwd });

/**
 * Read one PR's review context. The `readPr` the declaration is injected with.
 *
 * ONE `gh pr view`, then ONE net-diff basis shared by the text and the path list — the same economy
 * `computeNetDiffSignals` documents (independent resolution measured 5 → 11 subprocesses per PR).
 *
 * @param {{pr: number, repo: string, exec?: Function, cwd?: string}} o
 * @returns {{detail: object, net: object, diff: object, headRefName: string, body: string}}
 */
export function readPr({ pr, repo, exec = null, cwd = REPO_ROOT } = {}) {
  // The net-diff helpers take no `cwd`, so it is baked into the injected `exec` (the drain does the same thing
  // for the opposite reason — see the `escCwd` note in `we:scripts/merge-ai-prs.mjs`).
  const gitExec = exec || execFileIn(cwd);
  if (!Number.isInteger(pr) || pr <= 0) throw new TypeError(`review-pr-io: \`pr\` must be a positive integer, got ${JSON.stringify(pr)}`);
  if (typeof repo !== 'string' || !/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    throw new TypeError(`review-pr-io: \`repo\` must be <owner/name>, got ${JSON.stringify(repo)}`);
  }

  let view;
  try {
    view = JSON.parse(execFileSync('gh', [
      'pr', 'view', String(pr), '--repo', repo, '--json',
      'number,title,url,body,labels,comments,files,headRefName',
    ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, cwd }));
  } catch (e) {
    const msg = String((e && (e.stderr || e.message)) || e).split('\n').filter(Boolean).pop() || 'gh pr view failed';
    throw new Error(`review-pr-io: could not read ${repo}#${pr} — ${msg}`);
  }
  // `gh pr view` does not echo the repo back; carry the requested one, exactly as review-detail.mjs's CLI does.
  view.repo = repo;
  const detail = assembleReviewDetail({ view });
  const headRefName = typeof view.headRefName === 'string' ? view.headRefName : '';

  // ONE basis, shared. `fetchExtraRefs` carries the head ref so a lane branch this clone has never seen still
  // resolves — and NOTHING here moves HEAD (#2336): it fetches tracking refs and diffs two trees in place.
  const basis = resolveNetDiffBasis({
    exec: gitExec, rev: headRefName, fetchExtraRefs: headRefName ? [headRefName] : [],
  });
  const netText = computeNetDiffText({ exec: gitExec, rev: headRefName, fetchExtraRefs: [], basis });
  // `computeNetDiffPaths` resolves its own basis (it takes no `basis` param); the fetch above has already put
  // the head ref in this clone, so the second resolution is a local probe, not a second network round trip.
  const netPaths = computeNetDiffPaths({ exec: gitExec, rev: headRefName, fetchExtraRefs: [] });

  return {
    detail,
    headRefName,
    body: typeof view.body === 'string' ? view.body : '',
    // PIN THE REV. `computeNetDiffPaths` reports `rev` as the candidate it resolved — `origin/<headRefName>`,
    // a MUTABLE ref — so the recorded basis stopped describing the judged diff as soon as the lane pushed
    // again. Resolve it here, in the io shell, where the git call belongs; `shapeReadFinding` keeps both the
    // commit and the ref. It is the SAME candidate the diff was taken from and not the PR's `headRefOid`:
    // `headRefOid` is GitHub's view of the head, which can differ from the ref this clone actually diffed, and
    // recording it would pin the basis to a tree that was never read.
    net: { ...netPaths, revSha: revParseCommit(gitExec, netPaths.rev) },
    diff: netText,
  };
}

/**
 * Resolve a rev to its full commit SHA, or `null`. Never throws: an unresolvable rev is recorded as unpinned
 * (and rendered with a warning) rather than failing a review that has otherwise succeeded.
 */
export function revParseCommit(exec, rev) {
  if (typeof exec !== 'function' || typeof rev !== 'string' || !rev) return null;
  try {
    // `--end-of-options` for the same reason `resolveNetDiffBasis` uses it: `rev` derives from a branch name
    // off the `gh` API, and a dash-leading refname is legal.
    const out = String(exec('git', ['rev-parse', '--verify', '--end-of-options', `${rev}^{commit}`], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }) || '').trim();
    return /^[0-9a-f]{40}$/i.test(out) ? out.toLowerCase() : null;
  } catch {
    return null;
  }
}

/** `readPr` bound to one repo/exec, which is the shape the declaration wants. */
export function createReviewPrReader({ exec = null, cwd = REPO_ROOT } = {}) {
  return ({ pr, repo }) => readPr({ pr, repo, exec, cwd });
}

/**
 * Refusal texts `we:scripts/review-set-label.mjs` emits BEFORE any `gh` mutation. Matching one PROVES nothing
 * landed, so the entry is marked `failed` (retried on replay) instead of the default INDETERMINATE.
 *
 * THE DEFAULT IS THE SAFE ONE, AND THAT IS THE POINT: anything NOT on this list is treated as indeterminate,
 * because the CLI's two write failures surface as `gh`'s own stderr text (`ghErr` replaces the label with the
 * last stderr line), so there is no reliable string to recognise them by. Guessing "nothing landed" on an
 * unrecognised failure is how a comment gets double-posted. This list only ever narrows the refusal; it never
 * widens what counts as safe.
 */
const PRE_WRITE_REFUSALS = Object.freeze([
  'usage: review-set-label.mjs',
  'invalid --repo',
  'invalid --to',
  '--to=clear-human',
  'the rendered comment is',
  'renders a ',
  'gate-self: review:human is human-ceremony-only',
  'no review:human label',
  'no review:changes label',
  ', not OPEN',
  'nothing was changed (#2844)',
]);

/** Is this CLI error text one we can PROVE happened before any write? */
export function isPreWriteRefusal(text) {
  const s = String(text || '');
  return PRE_WRITE_REFUSALS.some((p) => s.includes(p));
}

/**
 * THE FOUR SINKS, bound to a repo root and an output channel.
 *
 * @param {{root?: string, out?: (line: string) => void, runNode?: Function}} [o] - `runNode` is the injectable
 *   subprocess runner (`(argv) => stdout`), so the label sink is testable without `gh`.
 * @returns {Record<string, Function>} effect type → `async (payload, ctx) => result`.
 */
export function createReviewPrSinks({
  root = REPO_ROOT,
  out = (line) => process.stdout.write(`${line}\n`),
  runNode = (argv, opts) => execFileSync(process.execPath, argv, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, ...opts }),
} = {}) {
  const dir = reviewSidecarDir(root);

  return {
    // ── 0. THE COMMENT BODY, staged locally. Deterministic path, deterministic bytes → safe to redo. ────────
    // The path is RUN-SCOPED (`reviewBodyPath`) so two runs on the same PR in one checkout cannot cross-stage.
    // Deterministic PER RUN is still deterministic for a replay, which is what `idempotent: true` asserts.
    [REVIEW_EFFECTS.WRITE_UP]: async (payload, ctx) => {
      const path = reviewBodyPath({ root, runId: ctx?.runId, bodyFile: payload.bodyFile });
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, String(payload.body), 'utf8');
      return { path, bytes: String(payload.body).length };
    },

    // ── 1. THE LABEL SWAP — the SINGLE HOME, as a subprocess. ───────────────────────────────────────────────
    // It posts the staged write-up (with the markers) AND applies the label, in the #2964 order it owns. This
    // sink adds no policy of its own: it builds argv, runs it, and reports.
    [REVIEW_EFFECTS.LABEL]: async (payload, ctx) => {
      // The SAME run-scoped path effect 0 wrote — both sinks derive it from `ctx.runId`, which is one run's id
      // for every effect in that run, so 1 always posts the write-up 0 staged and never a sibling run's.
      const bodyPath = reviewBodyPath({ root, runId: ctx?.runId, bodyFile: payload.bodyFile });
      const argv = [
        join(root, 'scripts', 'review-set-label.mjs'),
        String(payload.pr),
        `--repo=${payload.repo}`,
        `--to=${payload.to}`,
        `--actor=${payload.actor}`,
        // #2898 — state the surface the verdict actually came through. Conditional because the payload shape
        // predates the flag: a run record written before it (a `--resume` across the upgrade) has no `channel`,
        // and the single home's own default for an absent one is the NEUTRAL sentence, never a wrong channel.
        ...(payload.channel ? [`--channel=${payload.channel}`] : []),
        `--body-file=${bodyPath}`,
      ];
      let stdout = '';
      try {
        stdout = String(runNode(argv, { cwd: root }));
      } catch (e) {
        stdout = String((e && e.stdout) || '');
        const text = parseCliError(stdout) || String((e && e.message) || e).split('\n').filter(Boolean).pop() || 'review-set-label.mjs failed';
        if (isPreWriteRefusal(text)) {
          // PROVABLY nothing landed → `failed`, retried on the next pass.
          throw notApplied(`review-set-label.mjs refused before any write: ${text}`, { argv });
        }
        // INDETERMINATE. A plain throw leaves the entry `pending`; the effect is declared NON-idempotent, so
        // the executor REFUSES to replay it and a person decides. That is the fail-closed answer, and it is
        // what stops a second durable comment being posted on a guess.
        throw new Error(`review-set-label.mjs failed and its outcome is UNKNOWN: ${text}`);
      }
      const parsed = safeJson(stdout);
      if (parsed && parsed.error) {
        if (isPreWriteRefusal(parsed.error)) throw notApplied(`review-set-label.mjs refused: ${parsed.error}`, { argv });
        throw new Error(`review-set-label.mjs reported an error and its outcome is UNKNOWN: ${parsed.error}`);
      }
      return parsed ?? { raw: stdout.trim() };
    },

    // ── 2. THE LEDGER ROW. ──────────────────────────────────────────────────────────────────────────────────
    // THIS IS NOT THE #3007 VERDICT LEDGER, and must not be mistaken for it. #3007 — append-only JSONL keyed by
    // PR + diff content-hash, single-writer via the drain lease, the durable MERGE AUTHORITY — is still OPEN and
    // ships no writer. What this default sink does is append the row to the operation's own gitignored,
    // session-local sidecar: nothing merges on it, nothing reads it back, and no gate consults it. It exists so
    // the declared effect has somewhere honest to land before #3007 registers the real writer behind the SAME
    // effect type, at which point this default is deleted rather than migrated. Under
    // `docs/agent/platform-decisions.md#state-lives-where-its-nature-dictates` clause 1 that is session scratch;
    // clause 2's durable authority is #3007's to build.
    [REVIEW_EFFECTS.LEDGER]: async (payload, ctx) => {
      mkdirSync(dir, { recursive: true });
      const path = join(dir, 'verdicts.pending.jsonl');
      const row = JSON.stringify({ effectKey: ctx.key, runId: ctx.runId, ...payload });
      appendFileSync(path, `${row}\n`, 'utf8');
      return { path, note: 'session-local sidecar — NOT the #3007 verdict ledger' };
    },

    // ── 3. THE EVENT: the operator notice, rendered by `renderReviewNotice` in the declaration. ──────────────
    [REVIEW_EFFECTS.NOTICE]: async (payload) => {
      out(String(payload.notice));
      return { reported: true };
    },
  };
}

/** The `{"error": …}` payload the review CLIs print on a refusal, or `''`. */
function parseCliError(stdout) {
  const parsed = safeJson(stdout);
  return parsed && typeof parsed.error === 'string' ? parsed.error : '';
}

/** Parse the LAST JSON line of a CLI's stdout, tolerating banner noise. Returns `null` when there is none. */
function safeJson(stdout) {
  const lines = String(stdout || '').trim().split('\n').filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    try { return JSON.parse(lines[i]); } catch { /* keep walking back */ }
  }
  return null;
}
