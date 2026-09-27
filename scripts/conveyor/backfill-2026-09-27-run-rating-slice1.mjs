#!/usr/bin/env node
/**
 * @file scripts/conveyor/backfill-2026-09-27-run-rating-slice1.mjs
 * @description One-time backfill (#4075 slice 1): mechanically rate every dispatched daemon session transcript
 *   and job-mode review log from roughly the last N hours (default 48) and append the ratings to the shared
 *   `run-scorecard-store`. READ-ONLY over every input — transcripts and review-job logs are only ever read,
 *   never mutated, never truncated, never deleted; the sole write is the scorecard append itself (via
 *   `run-rating.mjs#rateAndRecordSession` / `#rateAndRecordReviewJob`, both already best-effort/non-throwing).
 *
 * IDEMPOTENT ON RERUN, same discipline as `backfill-2026-09-14-delegation-trials.mjs`: a row already in the
 * store for the same `(rubricVersion, handle)` — a session name / review-job slug this rubric has already
 * scored — is skipped rather than appended a second time.
 *
 * Retained as the provenance of this batch, not deleted after running once — same convention as every other
 * dated one-time backfill script in this directory.
 *
 * Usage: `node scripts/conveyor/backfill-2026-09-27-run-rating-slice1.mjs [--hours=48] [--dry-run]`
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { parseSessionSlug } from './session-slug.mjs';
import {
  RUBRIC_VERSION, BUILD_KINDS, defaultProjectsRoot, readTranscriptLines, sessionNameFromLines,
  rateSession, rateReviewJobLog, appendRunRating, backlogSizeForItem, resolvePrBouncedViaGh,
} from './run-rating.mjs';
import { readStore } from './run-scorecard-store.mjs';

/** Every daemon clone this machine has ever run a review-job dispatch from, so the backfill is not blind to
 *  whichever clone happened to run the job (`we:scripts/lib/constellation-repos.mjs`'s own multi-clone reality
 *  — a review job's log lives wherever the DAEMON's clone was, not necessarily `wev-review-daemon` by name).
 *  Best-effort: a workspace root that doesn't exist, or has no `.operations/review-jobs`, is silently skipped. */
function candidateReviewJobDirs(workspaceRoot) {
  let names;
  try { names = readdirSync(workspaceRoot, { withFileTypes: true }); } catch { return []; }
  return names
    .filter((d) => d.isDirectory())
    .map((d) => join(workspaceRoot, d.name, '.operations', 'review-jobs'))
    .filter((p) => existsSync(p));
}

function recentFiles(dir, { suffix, sinceMs }) {
  let names;
  try { names = readdirSync(dir); } catch { return []; }
  const out = [];
  for (const name of names) {
    if (!name.endsWith(suffix)) continue;
    const p = join(dir, name);
    try { if (statSync(p).mtimeMs >= sinceMs) out.push(p); } catch { /* raced with a delete — skip */ }
  }
  return out;
}

function listRecentTranscripts(sinceMs) {
  const root = defaultProjectsRoot();
  let entries;
  try { entries = readdirSync(root, { withFileTypes: true }); } catch { return []; }
  const dirs = entries.filter((d) => d.isDirectory() && d.name.includes('operations-dispatch')).map((d) => join(root, d.name));
  return dirs.flatMap((d) => recentFiles(d, { suffix: '.jsonl', sinceMs }));
}

function listRecentReviewLogs(sinceMs, workspaceRoot) {
  const dirs = candidateReviewJobDirs(workspaceRoot);
  return dirs.flatMap((d) => recentFiles(d, { suffix: '.log', sinceMs }));
}

function alreadyScoredHandles() {
  const store = readStore();
  return new Set(store.records.filter((r) => r.rubricVersion === RUBRIC_VERSION).map((r) => r.handle));
}

function main() {
  const args = process.argv.slice(2);
  const hoursFlag = args.find((a) => a.startsWith('--hours='));
  const hours = hoursFlag ? Number(hoursFlag.slice('--hours='.length)) : 48;
  const dryRun = args.includes('--dry-run');
  const sinceMs = Date.now() - hours * 3600_000;
  const workspaceRoot = join(defaultProjectsRoot(), '..', '..', 'workspace');

  // Reading the store is read-only, so a --dry-run checks it too — its preview must report what is already covered.
  const done = alreadyScoredHandles();
  const grades = { A: 0, B: 0, C: 0, D: 0 };
  let scored = 0;
  let skippedAlready = 0;
  let skippedNoEvidence = 0;
  let skippedNoReviewRan = 0;
  let costUsdKnown = 0;
  let costPartialRows = 0;
  let unpricedTokens = 0;
  let tokensKnown = 0;

  for (const path of listRecentTranscripts(sinceMs)) {
    let lines;
    try { lines = readTranscriptLines(path); } catch { skippedNoEvidence++; continue; }
    if (!lines.length) { skippedNoEvidence++; continue; }
    const name = sessionNameFromLines(lines);
    const parsed = name ? parseSessionSlug(name) : null;
    if (!parsed) { skippedNoEvidence++; continue; }
    if (done.has(name)) { skippedAlready++; continue; }
    const id = /^\d+$/.test(parsed.id) ? Number(parsed.id) : parsed.id;
    // Rubric v2 (#4075 recalibration): a BUILD-kind session's grade is capped when its PR bounced, and its
    // baseline scales with the backlog item's own `size` — both looked up here (best-effort, never guessed
    // when absent) since only the backfill's own IO shell can afford the extra `gh`/frontmatter read per row.
    const isBuild = parsed.itemKind && BUILD_KINDS.has(parsed.kind);
    const size = isBuild ? backlogSizeForItem(id) : null;
    const prBounced = isBuild ? resolvePrBouncedViaGh(id) : null;
    const rating = rateSession({
      sessionName: name, kind: parsed.kind, pr: parsed.itemKind ? null : id, item: parsed.itemKind ? id : null,
      transcriptPath: path, size, prBounced,
    });
    if (!rating.ok) { skippedNoEvidence++; continue; }
    if (!dryRun) appendRunRating(rating);
    scored += 1;
    grades[rating.grade] = (grades[rating.grade] ?? 0) + 1;
    if (typeof rating.costUsd === 'number') costUsdKnown += rating.costUsd;
    if (rating.costUsdPartial) costPartialRows += 1;
    unpricedTokens += rating.unpricedTokens ?? 0;
    if (rating.tokens) tokensKnown += rating.tokens.in + rating.tokens.out + rating.tokens.cacheRead + rating.tokens.cacheWrite;
    done.add(name);
  }

  for (const logPath of listRecentReviewLogs(sinceMs, workspaceRoot)) {
    const rating = rateReviewJobLog(logPath);
    if (!rating.ok) {
      if (rating.reason === 'no-review-loop-ran') skippedNoReviewRan++; else skippedNoEvidence++;
      continue;
    }
    const handle = rating.sessionName;
    if (handle && done.has(handle)) { skippedAlready++; continue; }
    if (!dryRun) appendRunRating(rating);
    scored += 1;
    grades[rating.grade] = (grades[rating.grade] ?? 0) + 1;
    if (handle) done.add(handle);
  }

  const summary = {
    hours, sinceIso: new Date(sinceMs).toISOString(), dryRun,
    scored, skippedAlreadyScored: skippedAlready, skippedNoEvidence, skippedNoReviewRan,
    // costUsdKnown is a lower bound whenever costPartialRows > 0 (unpricedTokens had no model rate).
    grades, costUsdKnown: Number(costUsdKnown.toFixed(4)), costPartialRows, unpricedTokens, tokensKnown,
  };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

main();
