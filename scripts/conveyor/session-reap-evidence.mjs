/**
 * @file scripts/conveyor/session-reap-evidence.mjs
 * @description THE GROUND-TRUTH EVIDENCE of the conveyor session reaper (WE #3435/#3469, epic #3383) — split out of
 *   `session-reaper.mjs` (a MOVE, no logic change). Owns the reads the pure planner (`session-reap-plan.mjs`) receives
 *   as an injected `groundTruthFor` resolver: one local backlog-card read per item-kind target, one bounded `gh pr view`
 *   per PR-kind target. Nothing here decides a reap; it only answers "is this session's own target independently done?".
 *
 * COST DISCIPLINE, mirroring `we:scripts/operations/dispatch-lane-io.mjs`'s own `PR_LIST_TIMEOUT_MS`/
 * `PR_LIST_LIMIT` bounds. A backlog-item ground-truth check is one local file read — no rate-limit concern, so
 * it is unbounded. A PR-target check is one real `gh pr view <pr>` network call, bounded two ways: (1) it
 * reuses `dispatch-lane-io.mjs`'s own `prListTimeoutMs` per-call timeout rather than inventing a second knob
 * for the same class of cost (`defaultLaneRefForPr`'s own docblock names this exact reuse), and (2)
 * {@link makeGroundTruthResolver} caps the number of `gh pr view` calls ONE reaper pass will make
 * ({@link MAX_GH_PR_VIEW_CALLS_PER_TICK}) — a candidate past the cap is left `not-terminal` this tick and
 * re-tried the next one, never an unbounded `gh` burst. Every resolver answer is cached per pass too, so two
 * sessions naming the same target (a retried `conveyor-3441b` alongside `conveyor-3441`) cost one lookup.
 *
 * REPO-LESS PR NAMES (#3383, 2026-09-20). `review-148` was plateau-app#148 (merged 12:20) but its name carries no
 * repo, so the PR ground truth asked `gh` about the wrong repo (its cwd's) and the session stayed.
 * {@link makeGroundTruthResolver} now resolves such a name from `target.repo`, else the session's own follow-up ledger
 * entry, else EVERY constellation repo — done only when the number is merged in every repo where it exists; ambiguous,
 * unreadable or absent everywhere → kept.
 */

import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { readField } from '../backlog/frontmatter.mjs';
import { prListTimeoutMs } from '../operations/dispatch-lane-io.mjs';
import { slugForRepoKey, ledgerRepoKeyFor } from './session-verdicts-io.mjs';
import { CONSTELLATION_REPOS } from '../lib/constellation-repos.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

// ── GROUND-TRUTH IO (owns the backlog-card reads and the bounded `gh pr view` lookups; the pure planner receives
//    this as an injected `groundTruthFor`) ────────────────────────────────────────────────────────────────

/** Default backlog directory, matching `src/_data/backlog.js`'s own `WE_BACKLOG_DIR` override convention
 *  (#3445) so a test can point the ground-truth resolver at a throwaway corpus without touching the real one. */
const DEFAULT_BACKLOG_DIR = process.env.WE_BACKLOG_DIR || join(HERE, '..', '..', 'backlog');

/** How many real `gh pr view` calls ONE reaper pass will make for PR-kind ground-truth checks — see the file
 *  header's "COST DISCIPLINE" section. Generous relative to the live-measured 2026-09-03 count (at most a
 *  handful of `review-*`/`fix-*`/`ci-heal-*` rows in `working`/`blocked` at once) while still bounding a
 *  pathological listing from firing an unbounded `gh` burst in one tick. */
export const MAX_GH_PR_VIEW_CALLS_PER_TICK = 25;

/**
 * The item-kind ground-truth answer for backlog item `id` — `resolved: true` iff its own card's `status:`
 * frontmatter reads exactly `resolved`. A missing card, or one whose `status:` can't be read, answers
 * `resolved: false`/`null` respectively — NEVER `true` on absence, so a mis-derived or since-renumbered id
 * never falsely reads as done. One local file read, no rate-limit concern.
 * @param {string} id
 * @param {{backlogDir?:string, readdirSyncFn?:Function, readFileSyncFn?:Function}} [io]
 * @returns {{resolved:boolean, evidence?:string}|null} `null` only when the backlog directory itself is unreadable.
 */
export function groundTruthForItem(id, { backlogDir = DEFAULT_BACKLOG_DIR, readdirSyncFn = readdirSync, readFileSyncFn = readFileSync } = {}) {
  let entries;
  try {
    entries = readdirSyncFn(backlogDir);
  } catch {
    return null; // backlog dir itself unreadable — unknown, never reap on an unreadable signal
  }
  const fname = entries.find((f) => f.endsWith('.md') && (f === `${id}.md` || f.startsWith(`${id}-`)));
  if (!fname) return { resolved: false }; // no card at all — nothing to confirm, not an error
  try {
    const text = readFileSyncFn(join(backlogDir, fname), 'utf8');
    const status = readField(text, 'status');
    return status === 'resolved' ? { resolved: true, evidence: `backlog#${id}:resolved` } : { resolved: false };
  } catch {
    return null; // the one found file itself unreadable — unknown, never reap on an unreadable signal
  }
}

/**
 * Read ONE PR's state in ONE repo: `'merged'`, `'closed'` (closed WITHOUT merging — its review/fix target is gone),
 * `'not-merged'` (still open), `'absent'` (the repo has no PR with that number — `gh`'s "Could not resolve to a
 * PullRequest"), or `null` (unreadable: no `gh`, timeout, any other failure). `slug` omitted means `gh`'s own cwd
 * repo — only the legacy {@link groundTruthForPr} default.
 * @returns {'merged'|'closed'|'not-merged'|'absent'|null}
 */
function readPrState(pr, { exec = execFileSync, env = process.env, slug = null } = {}) {
  try {
    // Reuses `dispatch-lane-io.mjs`'s own `prListTimeoutMs` bound rather than inventing a second knob for the
    // same class of cost (one bounded `gh pr view` network call) — see the file header's "COST DISCIPLINE".
    const out = exec('gh', ['pr', 'view', String(pr), ...(slug ? ['--repo', slug] : []), '--json', 'state,mergedAt'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 1024 * 1024,
      timeout: prListTimeoutMs(env),
      killSignal: 'SIGKILL',
    });
    const parsed = JSON.parse(String(out || '{}'));
    const merged = Boolean(parsed?.mergedAt) || String(parsed?.state || '').toUpperCase() === 'MERGED';
    if (merged) return 'merged';
    return String(parsed?.state || '').toUpperCase() === 'CLOSED' ? 'closed' : 'not-merged';
  } catch (e) {
    return /could not resolve to a pull ?request|no pull requests? found/i.test(`${e?.stderr ?? ''}\n${e?.message ?? ''}`) ? 'absent' : null;
  }
}

/**
 * The PR-kind ground-truth answer for PR `pr` — `resolved: true` iff `gh pr view` reports it merged. Any
 * failure (no `gh`, PR not found, timeout) answers `null` (unknown) rather than throwing — a best-effort
 * check, matching every other `gh`-shelling function in this codebase's own fail-soft convention. `repo` (a
 * constellation repo key) pins the lookup with `--repo`; without it `gh` reads its own cwd repo.
 * @param {string|number} pr
 * @param {{exec?:Function, env?:object, repo?:string|null}} [io]
 * @returns {{resolved:boolean, evidence?:string}|null}
 */
export function groundTruthForPr(pr, { exec = execFileSync, env = process.env, repo = null } = {}) {
  const slug = repo ? slugForRepoKey(repo) : null;
  if (repo && !slug) return null; // an unknown repo key — fail closed, never fall back to the cwd repo
  const state = readPrState(pr, { exec, env, slug });
  if (state === 'merged') return { resolved: true, evidence: `pr#${pr}:merged${repo ? `@${repo}` : ''}` };
  return state === 'not-merged' || state === 'closed' ? { resolved: false } : null; // absent / unreadable — unknown, never reap
}

/**
 * Build a `groundTruthFor` resolver for {@link sessionReapPlan}: routes an item-kind target to
 * {@link groundTruthForItem} (unbounded, local) and a PR-kind target to `gh` (bounded by
 * {@link MAX_GH_PR_VIEW_CALLS_PER_TICK}, network) — each answer cached per target for the life of the returned
 * resolver, so two sessions naming the same target cost one lookup.
 *
 * WHICH REPO A PR NUMBER MEANS. A name like `review-148` carries no repo, and `gh pr view 148` from the reaper's
 * cwd reads WE#148 — wrong for a session reviewing plateau-app#148 (found live 2026-09-20: `review-148`, merged in
 * plateau-app, kept forever). This resolver NEVER guesses one repo. In order:
 *   1. `target.repo` (a repo-marked name) → that repo alone.
 *   2. else the session's own follow-up ledger entry (`followUps`, injected) when its `target` is `<repo>#<this PR>`.
 *   3. else EVERY constellation repo: done ONLY when NO repo has it open (each repo where it exists holds it merged
 *      or closed-unmerged, the operator rule of 2026-09-20: only an OPEN PR blocks) and it exists in at least one.
 *      Open in ANY repo, unreadable in ANY repo, or not found in any → kept. A repo-marked or ledger-named target is
 *      unchanged: a closed-unmerged PR there stays `resolved:false`.
 * Every `gh` call, in any repo, counts against `maxPrViewCalls`; a pass that runs out answers `null` (kept).
 *
 * @param {{exec?:Function, env?:object, backlogDir?:string, readdirSyncFn?:Function, readFileSyncFn?:Function, maxPrViewCalls?:number, followUps?:object[]}} [io]
 * @returns {(target:{kind:'item'|'pr', id:string, repo?:string}, session?:object) => ({resolved:boolean, evidence?:string}|null)}
 */
export function makeGroundTruthResolver({
  exec = execFileSync,
  env = process.env,
  backlogDir = DEFAULT_BACKLOG_DIR,
  readdirSyncFn = readdirSync,
  readFileSyncFn = readFileSync,
  maxPrViewCalls = MAX_GH_PR_VIEW_CALLS_PER_TICK,
  followUps = [],
} = {}) {
  const cache = new Map();
  let prViewCalls = 0;
  /** One bounded `gh pr view` in one repo key; `null` when over the cap, the key is unknown, or `gh` failed. */
  const stateIn = (id, repoKey) => {
    const slug = slugForRepoKey(repoKey);
    if (!slug || prViewCalls >= maxPrViewCalls) return null;
    prViewCalls++;
    return readPrState(id, { exec, env, slug });
  };
  const resolvePr = (id, repo) => {
    if (repo) {
      const state = stateIn(id, repo);
      if (state === 'merged') return { resolved: true, evidence: `pr#${id}:merged@${repo}` };
      return state === 'not-merged' || state === 'closed' ? { resolved: false } : null;
    }
    // Operator rule (2026-09-20, "closed unmerged is terminal"): in the repo-less cross-repo check ONLY an OPEN PR
    // blocks. A PR closed without merging has no review/fix target left, so it counts as terminal like a merged one.
    const mergedIn = [];
    const closedIn = [];
    for (const key of Object.keys(CONSTELLATION_REPOS)) {
      const state = stateIn(id, key);
      if (state === null) return null; // unreadable (or out of budget) in one repo — the answer is unknown
      if (state === 'not-merged') return { resolved: false }; // still open in some repo — never reap
      if (state === 'merged') mergedIn.push(key);
      if (state === 'closed') closedIn.push(key);
    }
    if (!mergedIn.length && !closedIn.length) return { resolved: false }; // exists nowhere — absence is never done
    const evidence = [mergedIn.length ? `merged@${mergedIn.join('+')}` : '', closedIn.length ? `closed@${closedIn.join('+')}` : ''].filter(Boolean).join(',');
    return { resolved: true, evidence: `pr#${id}:${evidence}` };
  };
  return function groundTruthFor(target, session = null) {
    const repo = target.kind === 'pr' ? (target.repo ?? (session ? ledgerRepoKeyFor(session, followUps, target.id) : null)) : null;
    const key = `${target.kind}:${target.id}${target.kind === 'pr' ? `@${repo ?? '*'}` : ''}`;
    if (cache.has(key)) return cache.get(key);
    let result;
    if (target.kind === 'item') {
      result = groundTruthForItem(target.id, { backlogDir, readdirSyncFn, readFileSyncFn });
    } else if (target.kind === 'pr') {
      result = resolvePr(target.id, repo);
    } else {
      result = null;
    }
    cache.set(key, result);
    return result;
  };
}
