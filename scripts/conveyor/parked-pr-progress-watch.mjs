#!/usr/bin/env node
/**
 * @file scripts/conveyor/parked-pr-progress-watch.mjs
 * @description THE GENERAL PR-LANDING-PROGRESS WATCH (`we:3550`, epic #3383) — a standing, mechanical pass that
 *   catches an open, review-parked PR (`review:pending`/`review:changes`/`review:human`) sitting long enough
 *   with NO independent review ever dispatched for it, and posts a `review:changes`-shaped finding via
 *   `we:scripts/conveyor/reconcile-finding.mjs`.
 *
 * SCOPE — SIGNAL (a) ONLY, per `we:3549`'s ratified Fork 1. A PR is neglected iff it has carried its current
 * `review:*` hold label longer than the configurable threshold AND no `review-<pr>`/`fix-<pr>` named agent
 * session has EVER appeared in the FULL `claude agents --json --all` listing for it (not just a currently-live
 * one — matching `we:scripts/conveyor/session-reaper.mjs`'s own observation that a `done` row is never pruned).
 * Signal (b) — re-checking whether an EXISTING `review:changes` label's triggering finding has since gone moot
 * (PR #1939's shape) — is deliberately out of scope here; it is the separate follow-on `we:3596`.
 *
 * KNOWN LIMITATION — a PURE-HUMAN review leaves no session trace. `review:human` is one of the three watched
 * hold labels (per the ratified rule), but a human reviewing directly through GitHub's own PR-review UI or
 * comments never mints a `review-<pr>`/`fix-<pr>` agent session — so a `review:human` PR that a human HAS
 * looked at, but only that way, still reads as "never reviewed" here. This is the ratified rule as designed
 * (signal (a) only, see `we:3549`), not a bug; a future signal could read GitHub's own review/comment timeline
 * to close this gap, but that is out of scope for this build.
 *
 * THE TIME SOURCE — `we:3549` Fork 2, ratified (a). No new state store (#2612): the durable start-of-park
 * marker is read straight off GitHub's own issue-events timeline (`gh api .../issues/<pr>/events`), filtered to
 * the most recent `labeled` event for the PR's CURRENT `review:*` hold label. The threshold defaults to 24
 * hours and is a configurable knob ({@link NEGLECT_THRESHOLD_ENV}), never hardcoded.
 *
 * DEDUP — NO SEPARATE STORE, mirrors `we:scripts/conveyor/duplicate-pr-watch.mjs`'s own "the label's presence
 * IS the state" contract. A PR that already carries `review:changes` is skipped outright — whether THIS pass's
 * own prior sweep put it there or a genuine review did, the PR is already parked and re-posting the same
 * finding every tick would only spam a comment with no new information. Unlike the sibling merge-conflict
 * watch's own self-clearing label, this is NOT self-clearing: once flagged, a PR stays flagged until a
 * human/agent explicitly clears or re-arms `review:changes` — "was this ever reviewed" only gets MORE true over
 * time, never less.
 *
 * HOW THE FINDING IS RAISED — REUSED, NOT A THIRD MECHANISM. Posted via `we:scripts/conveyor/reconcile-finding.mjs`,
 * out of process (never in-process — that shim's own shared harness calls `process.exit()` on completion, which
 * would kill a multi-PR sweep after its first finding), exactly like both sibling watches already do.
 *
 * PURE-CORE / IO-SHELL SPLIT (mirrors `we:scripts/conveyor/duplicate-pr-watch.mjs`):
 *   • {@link isParkedCandidate}, {@link currentHoldLabel}, {@link everDispatchedReviewOrFix},
 *     {@link parkedHours}, {@link labeledAtFor}, {@link isNeglectedPr}, and {@link buildNeglectFindingBody}
 *     are PURE — no fs/git/gh/clock/process.
 *   • The IO shell ({@link defaultListParkedPrs}, {@link defaultListLabelEvents}, {@link defaultListAllAgents},
 *     {@link defaultPostFinding}, {@link watchNeglectedPrs}, the CLI) owns every `gh`/`claude`/subprocess call.
 *
 * THE CADENCE. Wired into `we:skills-src/conveyor/runner.mjs#makeCliMechanicalPasses`, beside the
 * `parked-pr-conflict-watch.mjs` and `duplicate-pr-watch.mjs` lines — the same "piggyback on a pass the
 * headless runner already ticks" shape, so neglect is checked every tick with no new cron/daemon.
 */
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

import { REVIEW_LABELS, REVIEW_HOLD_LABELS, hasReviewLabel } from '../lib/review-escalation.mjs';
import { defaultListAgents } from '../operations/dispatch-lane-io.mjs';
import { writeAllSync, writeLineSync } from '../lib/write-all-sync.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

/** The repo root, resolved from this file's own location — same derivation as
 *  `we:scripts/conveyor/duplicate-pr-watch.mjs#REPO_ROOT`. */
export const REPO_ROOT = resolve(HERE, '..', '..');

/** How many open PRs one `gh pr list` call reads per repo — matches both sibling watches' own limit. */
export const PR_LIST_LIMIT = 200;

/** The name of THIS pass, threaded into `reconcile-finding.mjs --agent=` for comment attribution. */
export const AGENT_NAME = 'parked-pr-progress-watch';

/** The bold default from `we:3549` Fork 2 — long enough that a PR waiting on a normal daily check-in is never
 *  false-flagged, short enough to catch a genuine multi-day silent stall well within one working day. */
export const DEFAULT_NEGLECT_THRESHOLD_HOURS = 24;

/** The env-var knob `we:3549` Fork 2 requires — never hardcode the threshold. */
export const NEGLECT_THRESHOLD_ENV = 'WE_PR_NEGLECT_THRESHOLD_HOURS';

// ── PURE CORE (no fs / git / gh / clock / process — every input is injected) ───────────────────────────────

/**
 * Read {@link NEGLECT_THRESHOLD_ENV} from `env`, or {@link DEFAULT_NEGLECT_THRESHOLD_HOURS} when unset. Throws
 * on a non-positive/non-finite override — a bad knob should fail loud, not silently disable the watch.
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {number}
 */
export function neglectThresholdHours(env = process.env) {
  const raw = String(env?.[NEGLECT_THRESHOLD_ENV] ?? '').trim();
  if (!raw) return DEFAULT_NEGLECT_THRESHOLD_HOURS;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    throw new TypeError(
      `${NEGLECT_THRESHOLD_ENV} must be a positive number of hours, got ${JSON.stringify(raw)}`,
    );
  }
  return n;
}

/**
 * Which ratified hold label (if any) this PR currently carries, in {@link REVIEW_HOLD_LABELS} order. Pure.
 * @param {Array<{name?:string}|string>} labels
 * @returns {string|null}
 */
export function currentHoldLabel(labels) {
  return REVIEW_HOLD_LABELS.find((name) => hasReviewLabel(labels, name)) ?? null;
}

/**
 * Is this open PR even worth the extra per-PR `gh api` label-timeline fetch? Pure, and deliberately CHEAP — it
 * narrows the open-PR population down to the small minority the IO shell must pay for, mirroring
 * `we:scripts/conveyor/parked-pr-conflict-watch.mjs#GH_FILES_GRAPHQL_CAP`'s own "pay the extra fetch only on an
 * already-narrowed candidate set" pattern. A PR already carrying `review:changes` is excluded here — the dedup
 * rule (see file header) — so it never even reaches the label-timeline lookup.
 * @param {{labels?:Array}} pr
 * @returns {boolean}
 */
export function isParkedCandidate(pr) {
  if (hasReviewLabel(pr?.labels, REVIEW_LABELS.changes)) return false; // dedup — already flagged/held
  return currentHoldLabel(pr?.labels) !== null;
}

/**
 * Has an independent `review-<pr>` or `fix-<pr>` named agent session EVER appeared for this PR, in the FULL
 * (`--all`) `claude agents` listing? Pure — matched by NAME alone, the same session-name grammar
 * `we:scripts/conveyor/session-reaper.mjs` and `we:scripts/conveyor/review-status-tag.mjs` already use, but over
 * every row regardless of `state` (a finished `done` row still proves a review was once dispatched — this is
 * "ever", not "right now").
 * @param {{pr:number|string, agents?:Array<{name?:string}>}} o
 * @returns {boolean}
 */
export function everDispatchedReviewOrFix({ pr, agents = [] } = {}) {
  const reviewName = `review-${pr}`;
  const fixName = `fix-${pr}`;
  return (Array.isArray(agents) ? agents : []).some((a) => a?.name === reviewName || a?.name === fixName);
}

/**
 * How many hours have elapsed between `labeledAt` and `now`. Pure. Returns `null` (never a negative/NaN
 * number) when `labeledAt` cannot be parsed — the caller must fail CLOSED (never flag) on that, since the
 * whole point of this check is a real elapsed duration.
 * @param {string|number|Date|null|undefined} labeledAt
 * @param {number|Date} [now]
 * @returns {number|null}
 */
export function parkedHours(labeledAt, now = Date.now()) {
  if (labeledAt === null || labeledAt === undefined) return null;
  const t = labeledAt instanceof Date ? labeledAt.getTime() : new Date(labeledAt).getTime();
  if (!Number.isFinite(t)) return null;
  const nowMs = now instanceof Date ? now.getTime() : now;
  const hours = (nowMs - t) / (1000 * 60 * 60);
  return hours < 0 ? null : hours;
}

/**
 * The durable start-of-park marker for `labelName`: the most recent `labeled` timeline event naming it. Pure —
 * `events` is already the flattened `{createdAt, labelName}` list {@link defaultListLabelEvents} fetched.
 * Returns `null` when the label was never seen applied (e.g. the events read failed, or the label predates
 * this pass) — the caller fails closed on that.
 * @param {Array<{createdAt?:string, labelName?:string}>} events
 * @param {string|null} labelName
 * @returns {string|null}
 */
export function labeledAtFor(events, labelName) {
  if (!labelName) return null;
  const matches = (Array.isArray(events) ? events : []).filter((e) => e?.labelName === labelName && e?.createdAt);
  if (!matches.length) return null;
  // Picks by the LATEST parsed timestamp, not by array position — the events timeline is documented to read
  // oldest→newest, but this never trusts that ordering alone (an unverified assumption about a live API is
  // not a safety property); an unparseable createdAt sorts as -Infinity so it never wins over a real one.
  let best = matches[0];
  let bestMs = Date.parse(best.createdAt);
  for (const m of matches.slice(1)) {
    const ms = Date.parse(m.createdAt);
    if (Number.isFinite(ms) && (!Number.isFinite(bestMs) || ms >= bestMs)) { best = m; bestMs = ms; }
  }
  return best.createdAt;
}

/**
 * THE WHOLE DECISION, covering the four ratified branches `we:3550`'s own task list names (already-
 * `review:changes` → false, dedup, checked first; parked but not long enough → false regardless of review
 * history; parked long enough AND never reviewed → true; parked long enough but a review/fix session was found
 * in the full agents history → false) plus the not-parked-at-all case, also false. Pure — every input already
 * resolved by the caller. `hours`, when the caller has already computed it (see {@link watchNeglectedPrs}),
 * is used verbatim instead of re-deriving it from `labelEvents`/`now` — the two must never disagree.
 * @param {{pr:number|string, labels?:Array, agents?:Array<{name?:string}>, labelEvents?:Array,
 *   now?:number|Date, thresholdHours?:number, hours?:number|null}} o
 * @returns {boolean}
 */
export function isNeglectedPr({
  pr, labels = [], agents = [], labelEvents = [], now = Date.now(),
  thresholdHours = DEFAULT_NEGLECT_THRESHOLD_HOURS, hours,
} = {}) {
  if (!isParkedCandidate({ labels })) return false; // covers both the dedup skip and "not parked at all"
  const holdLabel = currentHoldLabel(labels);
  const h = hours === undefined ? parkedHours(labeledAtFor(labelEvents, holdLabel), now) : hours;
  if (h === null || h < thresholdHours) return false;
  return !everDispatchedReviewOrFix({ pr, agents });
}

/**
 * The finding write-up handed to `reconcile-finding.mjs --body-file=`. Pure string builder.
 * @param {{pr:number|string, headRefName?:string, holdLabel:string, parkedHours:number, thresholdHours:number}} o
 * @returns {string}
 */
export function buildNeglectFindingBody({ pr, headRefName, holdLabel, parkedHours: hours, thresholdHours } = {}) {
  // The branch name is attacker-controlled (anyone who can open a PR picks it) and would otherwise be embedded
  // unescaped into a backtick markdown span, letting a hostile name break out of the span and inject arbitrary
  // markdown/links into this auto-posted comment. Backticks are stripped for display; this is a display-safety
  // measure only, not a general-purpose markdown sanitizer.
  const safeRef = headRefName ? String(headRefName).replace(/`/g, "'") : '';
  const ref = safeRef ? ` (\`${safeRef}\`)` : '';
  return [
    `**Neglected — this PR has sat \`${holdLabel}\`${ref} for about ${Math.round(hours)}h ` +
      `(threshold ${thresholdHours}h) with no independent review ever dispatched for it.**`,
    '',
    'No `review-<pr>`/`fix-<pr>` named agent session has ever appeared for this PR in the full `claude agents` '
      + 'history. This checks for a dispatched AGENT review specifically — it does not see a human review left '
      + 'directly through GitHub\'s own PR-review UI or comments, which carries no such session. This finding '
      + 'does not say the diff is wrong; it says no independent AGENT review session was ever dispatched for it.',
    '',
    'A human or reconciliation agent should dispatch an independent review for this PR '
      + '(`we:scripts/operations/review-dispatch.mjs`), or otherwise investigate why it stalled.',
    '',
    '_Auto-detected by the general PR-landing-progress watch '
      + `(\`we:scripts/conveyor/parked-pr-progress-watch.mjs\`, \`we:3550\`), per the neglect rule ratified in \`we:3549\`._`,
  ].join('\n');
}

// ── IO SHELL (gh / claude / subprocess only past this point — the CLI, gated on the main-module check) ──────

/**
 * The open-PR discovery query. `exec` is injectable so the argv is assertable with no `gh` on PATH.
 * @param {{exec?:Function, repo?:string|null}} [o]
 * @returns {Array<object>}
 */
export function defaultListParkedPrs({ exec = execFileSync, repo = null } = {}) {
  const argv = ['pr', 'list', '--state', 'open', '--limit', String(PR_LIST_LIMIT),
    '--json', 'number,headRefName,labels'];
  if (repo) argv.push('--repo', repo);
  const out = exec('gh', argv, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
  const parsed = JSON.parse(String(out || '[]'));
  return Array.isArray(parsed) ? parsed : [];
}

/**
 * The lazy, per-candidate extra fetch (see {@link isParkedCandidate}'s docblock for why it is only ever paid
 * for a narrowed candidate set): every `labeled` event on this PR's issue-events timeline, oldest first, as
 * `{createdAt, labelName}` pairs. Uses `--jq` to project (never raw multi-page JSON concatenation — mirrors
 * `we:scripts/conveyor/parked-pr-conflict-watch.mjs#defaultListPrFiles`'s own `--paginate` + `--jq` shape).
 * @param {{number:number|string, repo?:string|null, exec?:Function}} o
 * @returns {Array<{createdAt:string, labelName:string}>}
 */
export function defaultListLabelEvents({ number, repo, exec = execFileSync } = {}) {
  const path = repo ? `repos/${repo}/issues/${number}/events` : `repos/{owner}/{repo}/issues/${number}/events`;
  const argv = ['api', '--paginate', '-X', 'GET', '-F', 'per_page=100', path,
    '--jq', '.[] | select(.event == "labeled") | [.created_at, .label.name] | @tsv'];
  const out = exec('gh', argv, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024 });
  return String(out || '').split('\n').map((l) => l.trim()).filter(Boolean).map((line) => {
    const [createdAt, labelName] = line.split('\t');
    return { createdAt, labelName };
  });
}

/**
 * The FULL (`--all`) `claude agents` listing — never just the currently-live rows, since "ever dispatched" must
 * see a finished `done` row too (`we:scripts/conveyor/session-reaper.mjs`'s own observation that a `done` row
 * is never pruned from this listing).
 * @param {{exec?:Function}} [o]
 * @returns {Array<object>}
 */
export function defaultListAllAgents({ exec = execFileSync } = {}) {
  return defaultListAgents({ exec, all: true });
}

/**
 * Post ONE finding via `we:scripts/conveyor/reconcile-finding.mjs`, out of process (see file header for why).
 * Writes the body to a fresh temp file under `os.tmpdir()` (an allowed `--body-file` root,
 * `we:scripts/review-set-label.mjs#bodyFileRoots`) and always removes it afterward.
 * @param {{repo?:string|null, pr:number, body:string, root?:string, exec?:Function, writeFile?:Function,
 *   removeFile?:Function, tmpDir?:string}} o
 */
export function defaultPostFinding({
  repo = null, pr, body, root = REPO_ROOT, exec = execFileSync,
  writeFile = writeFileSync, removeFile = unlinkSync, tmpDir = tmpdir(),
} = {}) {
  const file = join(tmpDir, `neglect-pr-finding-${pr}-${randomUUID()}.md`);
  writeFile(file, body, 'utf8');
  try {
    const argv = [join(root, 'scripts', 'conveyor', 'reconcile-finding.mjs'), String(pr),
      `--body-file=${file}`, `--agent=${AGENT_NAME}`];
    if (repo) argv.push(`--repo=${repo}`);
    exec('node', argv, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 8 * 1024 * 1024 });
  } finally {
    try { removeFile(file); } catch { /* best-effort cleanup — a leftover temp file is not this pass's failure */ }
  }
}

/**
 * THE IO SHELL. Lists open PRs, narrows to real candidates ({@link isParkedCandidate}), fetches the full agents
 * listing once (shared across every candidate), fetches each candidate's own label-timeline lazily, decides
 * neglect ({@link isNeglectedPr}), and posts a finding for each neglected PR. Never throws on a per-PR read/
 * write failure — one bad `gh`/`reconcile-finding.mjs` call must not stop the sweep from checking the rest
 * (mirrors both sibling watches' own best-effort contract).
 * @param {{repo?:string|null, now?:number, thresholdHours?:number, env?:NodeJS.ProcessEnv, listPrs?:Function,
 *   listAgents?:Function, listLabelEvents?:Function, postFinding?:Function, dryRun?:boolean}} [o]
 * @returns {Array<{pr:number, holdLabel:string, parkedHours:number|null, neglected:boolean, posted:boolean, error?:string}>}
 */
export function watchNeglectedPrs({
  repo = null, now = Date.now(), thresholdHours, env = process.env,
  listPrs = defaultListParkedPrs, listAgents = defaultListAllAgents,
  listLabelEvents = defaultListLabelEvents, postFinding = defaultPostFinding, dryRun = false,
} = {}) {
  const threshold = thresholdHours ?? neglectThresholdHours(env);
  const prs = listPrs({ repo });
  const candidates = prs.filter(isParkedCandidate);
  const results = [];
  if (!candidates.length) return results;
  let agents;
  try {
    agents = listAgents({});
  } catch (e) {
    // A failed agents read must fail CLOSED on every candidate this tick — never guess "never reviewed" from
    // an unreadable listing (same "never act on unverifiable ground truth" bias `hasReviewLabel`'s own caller,
    // `partitionParkedPrsForClearance`, already established).
    writeLineSync(2, `⚠ parked-pr-progress-watch: could not read agents listing, skipping this sweep: ${String((e && e.message) || e).split('\n')[0]}`);
    return results;
  }
  for (const pr of candidates) {
    const holdLabel = currentHoldLabel(pr.labels);
    let events;
    try {
      events = listLabelEvents({ number: pr.number, repo });
    } catch (e) {
      // A fetch failure means neglect was never EVALUATED for this PR — never conflate it with a genuine
      // "flagged" verdict (the CLI's own summary line filters `neglected` for exactly this reason).
      results.push({ pr: pr.number, holdLabel, parkedHours: null, neglected: false, posted: false, error: String((e && e.message) || e).split('\n')[0] });
      continue;
    }
    // Computed ONCE here and handed to `isNeglectedPr` (via its `hours` override) rather than recomputed
    // internally — the two must never disagree about the same fact.
    const hours = parkedHours(labeledAtFor(events, holdLabel), now);
    const neglected = isNeglectedPr({ pr: pr.number, labels: pr.labels, agents, hours, thresholdHours: threshold });
    if (!neglected) continue;
    const entry = { pr: pr.number, holdLabel, parkedHours: hours, neglected: true, posted: false };
    if (dryRun) { results.push(entry); continue; }
    try {
      const body = buildNeglectFindingBody({ pr: pr.number, headRefName: pr.headRefName, holdLabel, parkedHours: hours, thresholdHours: threshold });
      postFinding({ repo, pr: pr.number, body });
      entry.posted = true;
    } catch (e) {
      entry.error = String((e && e.message) || e).split('\n')[0];
    }
    results.push(entry);
  }
  return results;
}

const IS_CLI = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (IS_CLI) {
  const argv = process.argv.slice(2);
  const flag = (name) => (argv.find((a) => a.startsWith(`--${name}=`)) || '').slice(name.length + 3) || undefined;
  const verb = argv.find((a) => !a.startsWith('--')) || 'sweep';
  const repo = flag('repo') || null;
  const dryRun = argv.includes('--dry-run');
  if (verb !== 'sweep') {
    writeLineSync(2, `usage: parked-pr-progress-watch.mjs sweep [--repo=<owner/name>] [--dry-run]`);
    process.exitCode = 2;
  } else {
    try {
      const results = watchNeglectedPrs({ repo, dryRun });
      for (const r of results) {
        const verb2 = dryRun ? 'would flag' : r.error ? 'FAILED to flag' : 'flagged';
        const hoursText = Number.isFinite(r.parkedHours) ? ` (parked ~${Math.round(r.parkedHours)}h)` : '';
        writeLineSync(2, `  ⚠ PR #${r.pr}: ${verb2} as neglected — carries \`${r.holdLabel}\`${hoursText}${r.error ? ` (${r.error})` : ''}`);
      }
      // `flagged` counts only genuinely-neglected entries — never a fetch failure, which `results` also
      // carries so the sweep is fully accounted for (see `watchNeglectedPrs`'s own error-entry comment).
      const flaggedCount = results.filter((r) => r.neglected).length;
      writeAllSync(1, `${JSON.stringify({ checked: true, flagged: flaggedCount, results })}\n`);
    } catch (e) {
      writeLineSync(2, `error: ${String(e?.message ?? e)}`);
      process.exitCode = 1;
    }
  }
}
