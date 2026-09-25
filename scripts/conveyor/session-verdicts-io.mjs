/**
 * @file scripts/conveyor/session-verdicts-io.mjs
 * @description THE IO SHELL for {@link ./session-verdicts.mjs} (#3383 item 11): gathers, for ONE session row, the
 *   evidence the pure classifier needs — the result files, the completion record, the transcript's mtime, the
 *   follow-up ledger's redispatch count, and (review/fix sessions only) the newest `review:*` label or verdict comment
 *   on the PR. Shared by the reaper and land-advance; it imports neither (the ledger is INJECTED, so there is no
 *   cycle with `land-advance-io.mjs`). Every source is best-effort and isolated: an unreadable one is `unknown`
 *   (absent from the evidence), never a guess and never a throw.
 *
 * Result-file evidence, in order: the convention `<jobsDir>/<session-name>.result.md`, the follow-up ledger entry's
 * `expectedResultPath` when one exists, then the completion record (`completion-store.mjs`). The classifier, not this
 * shell, decides whether each is NEWER than the session's own start.
 */
import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { dispatchGrammar } from './session-verdicts.mjs';
import { tryReadCompletion } from '../operations/completion-store.mjs';
import { isValidSessionSlug } from '../operations/completion-record.mjs';
import { CONSTELLATION_REPOS } from '../lib/constellation-repos.mjs';

/** `OPERATION_JOBS_DIR` overrides (tests); default is the operator's `~/workspace/.operations/jobs`. */
export function defaultJobsDir(env = process.env, home = homedir()) {
  return env.OPERATION_JOBS_DIR && env.OPERATION_JOBS_DIR.trim() ? env.OPERATION_JOBS_DIR.trim() : join(home, 'workspace/.operations/jobs');
}

/** Bounds ONE pass's `gh` PR-signal lookups (two `gh api` calls each) — same discipline as the ground-truth cap. */
export const MAX_PR_SIGNAL_LOOKUPS_PER_TICK = 10;

/** The GitHub `owner/repo` for a ledger target key (`we` / `frontierui` / `plateau-app`), or `null`. */
export function slugForRepoKey(key) {
  const meta = Object.hasOwn(CONSTELLATION_REPOS, key) ? CONSTELLATION_REPOS[key] : null;
  if (!meta) return null;
  return meta.slug.includes('/') ? meta.slug : `chalbert/${meta.slug}`;
}

/** Does follow-up ledger entry `e` belong to session row `s`? (Matched on the short `id` or the full `sessionId`.) */
export function sessionOwnsEntry(e, s) {
  return Boolean(e?.session) && [s?.id, s?.sessionId].includes(e.session);
}

/**
 * The constellation repo KEY the session's own ledger entry names for PR `pr` (`target: "plateau-app#148"` →
 * `plateau-app`), or `null`: no owned entry, an entry for a different PR number, or an unknown repo key. A repo-less
 * session name (`review-148`) is resolved from this before any cross-repo guess — the ledger is what dispatched it.
 */
export function ledgerRepoKeyFor(session, followUps, pr) {
  const entry = (Array.isArray(followUps) ? followUps : []).find((e) => sessionOwnsEntry(e, session));
  if (!entry?.target) return null;
  const [key, ledgerPr] = String(entry.target).split('#');
  return ledgerPr === String(pr) && slugForRepoKey(key) ? key : null;
}

/**
 * The newest `review:*` label event or verdict comment (the `<!-- reviewed-sha: … -->` marker) on `pr` in `slug`, as
 * `{reviewSignalAtMs, what}`; `{reviewSignalAtMs: null}` when there is none; `null` when `gh` fails (unknown).
 */
export function prSignalFromGh(pr, slug, { exec = execFileSync, env = process.env } = {}) {
  const gh = (path, jq) => String(exec('gh', ['api', path, '--paginate', '--jq', jq], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 4 * 1024 * 1024, timeout: Number(env.PR_LIST_TIMEOUT_MS) || 20000, killSignal: 'SIGKILL',
  }));
  try {
    const labels = gh(`repos/${slug}/issues/${pr}/events`, '.[] | select(.event=="labeled" and (.label.name|startswith("review:"))) | .created_at + " " + .label.name');
    const verdicts = gh(`repos/${slug}/issues/${pr}/comments`, '.[] | select(.body | contains("reviewed-sha:")) | .created_at');
    let best = null;
    for (const line of labels.split('\n').filter(Boolean)) {
      const [at, label] = line.split(' ');
      const t = Date.parse(at);
      if (Number.isFinite(t) && (!best || t > best.reviewSignalAtMs)) best = { reviewSignalAtMs: t, what: `label ${label}` };
    }
    for (const line of verdicts.split('\n').filter(Boolean)) {
      const t = Date.parse(line.trim());
      if (Number.isFinite(t) && (!best || t > best.reviewSignalAtMs)) best = { reviewSignalAtMs: t, what: 'verdict comment' };
    }
    return best ?? { reviewSignalAtMs: null };
  } catch {
    return null;
  }
}

/**
 * Build `evidenceFor(session)` for the classifier. Everything but the ledger is read lazily and per session.
 * @param {object} [o]
 * @param {string} [o.jobsDir]
 * @param {string} [o.home]
 * @param {object[]} [o.followUps] - the follow-up ledger entries (`{session, kind, target, launchedAt, expectedResultPath}`), injected.
 * @param {Function} [o.statFn]
 * @param {Function} [o.readCompletionFn] - `(slug) => record|null`; may throw on a corrupt record (→ unknown).
 * @param {((pr:string, slug:string)=>({reviewSignalAtMs:(number|null), what?:string}|null))|null} [o.prSignalFor]
 * @param {number} [o.maxPrSignalLookups]
 * @returns {(session:object) => object}
 */
export function makeEvidenceResolver({
  jobsDir = defaultJobsDir(), home = homedir(), followUps = [], statFn = statSync,
  readCompletionFn = (slug) => tryReadCompletion(slug), prSignalFor = null, maxPrSignalLookups = MAX_PR_SIGNAL_LOOKUPS_PER_TICK,
} = {}) {
  const mtime = (path) => { try { return statFn(path).mtimeMs; } catch { return null; } };
  let lookups = 0;
  return function evidenceFor(session) {
    const name = session?.name;
    const entry = followUps.find((e) => sessionOwnsEntry(e, session)) ?? null;
    const evidence = {};

    const paths = [];
    if (typeof name === 'string' && isValidSessionSlug(name)) paths.push(join(jobsDir, `${name}.result.md`));
    if (entry?.expectedResultPath) paths.push(entry.expectedResultPath);
    evidence.resultFiles = [...new Set(paths)].map((path) => ({ path, mtimeMs: mtime(path) })).filter((f) => f.mtimeMs != null);

    if (typeof name === 'string' && isValidSessionSlug(name)) {
      try { const c = readCompletionFn(name); if (c) evidence.completion = { status: c.status, startedAt: c.startedAt, updatedAt: c.updatedAt }; } catch { /* corrupt/unreadable = unknown */ }
    }

    if (typeof session?.sessionId === 'string' && /^[\w-]+$/.test(session.sessionId)) {
      evidence.transcriptMtimeMs = mtime(join(home, '.claude/projects', String(session.cwd ?? '').replace(/[^A-Za-z0-9]/g, '-'), `${session.sessionId}.jsonl`));
    }

    if (entry) {
      const kind = entry.kind;
      evidence.redispatchAttempts = Math.max(0, followUps.filter((e) => e.target === entry.target && e.kind === kind).length - 1);
    }

    // PR ground truth — review/fix sessions only, and only when nothing cheaper already proves them finished.
    const g = dispatchGrammar(name);
    if (typeof prSignalFor === 'function' && g && (g.kind === 'review' || g.kind === 'fix') && entry?.target && !evidence.resultFiles.length && !evidence.completion && lookups < maxPrSignalLookups) {
      const [key, pr] = String(entry.target).split('#');
      const slug = slugForRepoKey(key);
      if (slug && pr) { lookups++; const sig = prSignalFor(pr, slug); if (sig) evidence.prSignal = sig; }
    }
    return evidence;
  };
}
