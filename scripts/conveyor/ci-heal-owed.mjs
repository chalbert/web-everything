/**
 * ci-heal-owed.mjs — the tiny "record it owed, retry on the next tick" primitive for the TWO CI-heal marker
 * comments whose loss actually matters (we:backlog/4352): `ci-heal-mark.mjs`'s heal comment and
 * `ci-heal-escalation-mark.mjs`'s escalation comment.
 *
 * THE GAP (live 2026-09-27 22:15-22:20Z, `ci-heal-2821`): a shared GraphQL budget block made `gh-throttle.mjs`
 * refuse the heal comment's post, the CLI exited 1, and nothing anywhere remembered the comment was owed — the
 * PR's durable CI-heal count silently lost one attempt. The heal CLI is a ONE-SHOT call inside one agent run, so
 * "its own next invocation" is not a retry: CI can recover, or the cap can bind, before another heal agent is
 * ever dispatched for that PR.
 *
 * THE SHAPE, deliberately small (the anti-#4309 rule — no shared queue, no lease, no claim, no replay daemon):
 *   · WRITE — when a post is refused rate-limit-shaped, the CALLER writes ONE small JSON file keyed by
 *     `(repo, pr, kind)` under the host-shared gh-throttle lock root ({@link owedDir}). One file per key, written
 *     by atomic rename, so two callers owing DIFFERENT writes can never lose each other's record, and a repeat
 *     refusal for the SAME key just refreshes it (the newer head/body is the one worth posting).
 *   · RETRY — `we:scripts/operations/ci-heal-pr-dispatch.mjs#runReconcileCiHealDispatch` calls
 *     {@link flushOwedWrites} at the top of every per-repo tick (the function that genuinely DOES run every
 *     tick), which posts in-process through the SAME {@link postPrComment} the two CLIs use.
 *   · DEDUPE — the HEAD-SCOPED marker the comment itself carries. Before posting, the flush re-reads the PR's
 *     comments and clears the record if a trusted marker comment for THIS kind and THIS head is already live
 *     (the "gh saw a failure but the write actually landed" race included). No op-id, no exactly-once machinery.
 *   · BOUNDED — a record past {@link OWED_MAX_AGE_MS} or {@link OWED_MAX_ATTEMPTS} flush tries is dropped and
 *     reported, never retried forever; a merged/closed PR's record is dropped as moot without posting.
 *
 * `advisory-fix-mark.mjs` is NOT a kind here, on purpose: its marker is not a pure counter (a later marker can
 * retroactively "address" an earlier finding), so a late replay of it needs its own episode-id design.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolveChildTimeoutMs } from '../lib/bounded-child.mjs';
import { ghThrottleLockRoot, isRateLimitShaped } from '../lib/gh-throttle.mjs';
import { CONSTELLATION_REPOS, repoKeyForSlug } from '../lib/constellation-repos.mjs';
import { isTrustedMarkerAuthor } from '../lib/marker-authorship.mjs';

/** The only kinds that may be recorded owed. Frozen — adding one is a design decision, not a call-site tweak. */
export const OWED_KINDS = Object.freeze(['ci-heal', 'ci-heal-escalation']);

/** Wall-clock ceiling on an owed record (matches the "never strand a caller" discipline of `gh-throttle.mjs`'s
 *  own fail-open gates): a GraphQL budget resets hourly, so a write still refused after this is not coming back. */
export const OWED_MAX_AGE_MS = 6 * 60 * 60_000;

/** Flush-try ceiling, independent of the clock — a record that keeps failing for a NON-budget reason stops here. */
export const OWED_MAX_ATTEMPTS = 24;

const OWED_DIRNAME = 'ci-heal-owed';

/** The host-shared directory owed records live in — a sibling of gh-throttle's own lock-root state files. */
export function owedDir(env = process.env) {
  return join(ghThrottleLockRoot(null, env), OWED_DIRNAME);
}

const keyFile = (dir, { repo, pr, kind }) => join(dir, `${repo}__${pr}__${kind}.json`);

/**
 * Was this `gh` failure a budget refusal (`budget_blocked` / `budget_exhausted` from `gh-throttle.mjs`, or a raw
 * GitHub rate-limit)? Pure. Both throttle outcomes surface rate-limit-shaped text, so the throttle's own
 * classifier decides — never a second copy of the rule.
 * @param {unknown} err
 * @returns {boolean}
 */
export function isBudgetRefusal(err) {
  if (!err) return false;
  if (err.budgetBlocked) return true;
  return isRateLimitShaped(`${String(err.stderr ?? '')}\n${String(err.message ?? err)}`);
}

/**
 * Resolve the constellation repo KEY + gh SLUG a CLI invocation targets. `--repo` wins; without it, read the
 * local `origin` remote (a local git call — never a GitHub read, which the very budget block that got us here
 * would refuse too). Returns `null` for anything outside the constellation.
 * @param {{repoFlag?:string, cwd?:string, exec?:Function}} o
 * @returns {{key:string, slug:string}|null}
 */
export function resolveOwedRepo({ repoFlag, cwd, exec = execFileSync } = {}) {
  let v = typeof repoFlag === 'string' && repoFlag ? repoFlag : '';
  if (!v) {
    try {
      const url = String(exec('git', ['remote', 'get-url', 'origin'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })).trim();
      v = (/[:/]([^/:]+\/[^/]+?)(?:\.git)?$/.exec(url) || [])[1] || '';
    } catch { v = ''; }
  }
  const key = repoKeyForSlug(v);
  return key ? { key, slug: CONSTELLATION_REPOS[key].slug } : null;
}

/**
 * Record a write as owed. Atomic per key (temp file + rename). Returns the written record.
 * @param {{repo:string, slug:string, pr:number, kind:string, headSha:string, body:string}} rec
 * @param {{dir?:string, now?:number}} [o]
 */
export function recordOwedWrite({ repo, slug, pr, kind, headSha, body }, { dir = owedDir(), now = Date.now() } = {}) {
  if (!OWED_KINDS.includes(kind)) throw new TypeError(`ci-heal-owed: kind must be one of ${OWED_KINDS.join('|')}, got ${JSON.stringify(kind)}`);
  if (!repo || !slug || !Number.isInteger(pr) || pr <= 0) throw new TypeError('ci-heal-owed: repo, slug and a positive pr are required');
  if (typeof headSha !== 'string' || !headSha.trim()) throw new TypeError('ci-heal-owed: headSha is required (it is the dedupe key)');
  if (typeof body !== 'string' || !body) throw new TypeError('ci-heal-owed: body is required');
  const record = {
    v: 1, repo, slug, pr, kind, headSha: headSha.trim().toLowerCase(), body,
    recordedAt: new Date(now).toISOString(), attempts: 0,
  };
  mkdirSync(dir, { recursive: true });
  const path = keyFile(dir, record);
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(record) + '\n', 'utf8');
  renameSync(tmp, path);
  return record;
}

/** Every well-formed owed record in `dir` (optionally for one repo key). A malformed file, or one whose repo key/slug
 *  disagrees with `CONSTELLATION_REPOS`, is skipped (left on disk), never thrown. */
export function readOwedWrites({ dir = owedDir(), repo = null } = {}) {
  let names;
  try { names = readdirSync(dir); } catch { return []; }
  const out = [];
  for (const name of names.filter((n) => n.endsWith('.json')).sort()) {
    try {
      const r = JSON.parse(readFileSync(join(dir, name), 'utf8'));
      if (!r || !OWED_KINDS.includes(r.kind) || !Number.isInteger(r.pr) || !r.headSha || !r.body) continue;
      // The stored slug is never trusted: it must equal the canonical slug of an OWN constellation key, so a
      // tampered/stale file cannot redirect the flush's PR read and comment post to an outside repo.
      if (typeof r.repo !== 'string' || !Object.hasOwn(CONSTELLATION_REPOS, r.repo)) continue;
      const slug = CONSTELLATION_REPOS[r.repo].slug;
      if (r.slug !== slug) continue;
      if (repo && r.repo !== repo) continue;
      out.push({ ...r, slug });
    } catch { /* malformed — skip */ }
  }
  return out;
}

/** Remove one owed record. Idempotent. */
export function clearOwedWrite(rec, { dir = owedDir() } = {}) {
  rmSync(keyFile(dir, rec), { force: true });
}

function bumpAttempts(rec, dir) {
  const next = { ...rec, attempts: (Number(rec.attempts) || 0) + 1 };
  const path = keyFile(dir, rec);
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(next) + '\n', 'utf8');
  renameSync(tmp, path);
  return next;
}

/**
 * Is a trusted marker comment for THIS owed record's kind and head already on the PR? Pure. The heal comment
 * carries `head: <sha>` on its second line (`ci-heal-mark.mjs#buildCiHealComment`); the escalation comment has
 * always carried one (`ci-heal-escalation-mark.mjs#latestCiHealEscalationForHead`). The owed record's own first
 * line IS the marker the posted comment will lead with, so matching on it needs no import of either CLI.
 * @param {Array<object>} comments
 * @param {{kind:string, headSha:string, body:string}} rec
 */
export function owedWriteAlreadyLive(comments, rec) {
  const marker = String(rec.body).split('\n')[0];
  const sha = String(rec.headSha).toLowerCase();
  for (const c of Array.isArray(comments) ? comments : []) {
    const body = typeof c === 'string' ? c : c?.body;
    if (typeof body !== 'string' || !body.trimStart().startsWith(marker) || !isTrustedMarkerAuthor(c)) continue;
    const head = (/^head:\s*(\S+)/m.exec(body) || [])[1];
    if (head && head.toLowerCase() === sha) return true;
  }
  return false;
}

/**
 * Post one PR comment — the SAME call both CI-heal CLIs make, single-sourced so the flush retries through the
 * identical path rather than a look-alike. Throws exactly what `execFileSync('gh', …)` throws.
 */
export function postPrComment({ pr, repo, body, exec = execFileSync }) {
  const args = ['pr', 'comment', String(pr), '--body', body];
  if (repo) args.push(`--repo=${repo}`);
  return exec('gh', args, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', timeout: resolveChildTimeoutMs(), killSignal: 'SIGKILL' });
}

function readPrState({ pr, slug, exec }) {
  const raw = exec('gh', ['pr', 'view', String(pr), '--repo', slug, '--json', 'state,comments'], {
    stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', timeout: resolveChildTimeoutMs(), killSignal: 'SIGKILL', maxBuffer: 64 * 1024 * 1024,
  });
  return JSON.parse(String(raw || '{}'));
}

/**
 * THE PER-TICK FLUSH. For each owed record of `repo`: drop it if past its bound; otherwise read the PR once,
 * drop it as moot if the PR is merged/closed, clear it if its head-scoped marker is already live, else post it
 * and clear on success. A failed read or post bumps the attempt count and keeps the record for the next tick.
 * Never throws — a flush problem must never cost the tick its real job (dispatching heals).
 * @param {{repo:string, dir?:string, exec?:Function, now?:number, maxAgeMs?:number, maxAttempts?:number}} o
 * @returns {{posted:object[], cleared:object[], dropped:object[], kept:object[]}}
 */
export function flushOwedWrites({
  repo, dir = owedDir(), exec = execFileSync, now = Date.now(), maxAgeMs = OWED_MAX_AGE_MS, maxAttempts = OWED_MAX_ATTEMPTS,
} = {}) {
  const out = { posted: [], cleared: [], dropped: [], kept: [] };
  const tag = (r, extra = {}) => ({ repo: r.repo, pr: r.pr, kind: r.kind, headSha: r.headSha, ...extra });
  for (const rec of readOwedWrites({ dir, repo })) {
    try {
      const age = now - Date.parse(rec.recordedAt);
      if (!(age <= maxAgeMs) || (Number(rec.attempts) || 0) >= maxAttempts) {
        clearOwedWrite(rec, { dir });
        out.dropped.push(tag(rec, { why: Number.isFinite(age) && age > maxAgeMs ? 'expired' : 'attempts-exhausted', attempts: rec.attempts }));
        continue;
      }
      let view;
      try {
        view = readPrState({ pr: rec.pr, slug: rec.slug, exec });
      } catch (e) {
        bumpAttempts(rec, dir);
        out.kept.push(tag(rec, { why: `pr read failed: ${String(e?.message || e).split('\n')[0]}` }));
        continue;
      }
      const state = String(view?.state || '').toUpperCase();
      if (state === 'MERGED' || state === 'CLOSED') {
        clearOwedWrite(rec, { dir });
        out.dropped.push(tag(rec, { why: `pr ${state.toLowerCase()} — owed write is moot` }));
        continue;
      }
      if (owedWriteAlreadyLive(view?.comments, rec)) {
        clearOwedWrite(rec, { dir });
        out.cleared.push(tag(rec, { why: 'marker for this head already live' }));
        continue;
      }
      try {
        postPrComment({ pr: rec.pr, repo: rec.slug, body: rec.body, exec });
      } catch (e) {
        bumpAttempts(rec, dir);
        out.kept.push(tag(rec, { why: `post failed: ${String(e?.message || e).split('\n')[0]}` }));
        continue;
      }
      clearOwedWrite(rec, { dir });
      out.posted.push(tag(rec));
    } catch (e) {
      out.kept.push(tag(rec, { why: `flush error: ${String(e?.message || e).split('\n')[0]}` }));
    }
  }
  return out;
}
