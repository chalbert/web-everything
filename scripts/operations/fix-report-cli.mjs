#!/usr/bin/env node
/**
 * @file scripts/operations/fix-report-cli.mjs
 * @description THE ONE COMMAND a minimal fix agent shells to report its outcome (#xu2pp2m, downstream of
 * #3627's `we:scripts/operations/delivery-report-cli.mjs`). The agent's entire sanctioned output is
 * `report --status=started` once at the top of its run, and `report --status=done --outcome=... --reason=...
 * --files=...` once at the end — nothing about lane-pool mechanics, `gh pr` mechanics, `rearm-review.mjs`/
 * `stand-down.mjs`, verify-lane polling, or converge mechanics ever appears in this CLI's surface. A THIN
 * shell over the pure/io split in {@link ./fix-report-record.mjs} / {@link ./fix-report-store.mjs}, mirroring
 * `we:scripts/operations/delivery-report-cli.mjs`'s own argv-parsing-only scope.
 *
 * Usage:
 *   node scripts/operations/fix-report-cli.mjs report --pr=2108 --item=3629 --session=<slug> --status=started
 *   node scripts/operations/fix-report-cli.mjs report --pr=2108 --session=<slug> --status=done \
 *     --outcome=fixed --files=scripts/foo.mjs
 *   node scripts/operations/fix-report-cli.mjs report --pr=2108 --session=<slug> --status=done \
 *     --outcome=blocked --reason="the finding no longer applies — already fixed on main"
 *   node scripts/operations/fix-report-cli.mjs report --pr=2108 --session=<slug> --status=done \
 *     --outcome=escalated-needs-judgment --reason="two valid ways to word the error; product call"
 *   node scripts/operations/fix-report-cli.mjs report --pr=2108 --session=<slug> --status=done \
 *     --outcome=escalated-conflict --reason="main's own rewrite of this function overlaps the finding's fix"
 *   node scripts/operations/fix-report-cli.mjs show --session=<slug>
 *
 * `--learning-kind`/`--learning-summary`/`--learning-area`/`--learning-suggestion` are an OPTIONAL group —
 * give all four or none, mirroring `delivery-report-cli.mjs`'s own group. The agent hands the WRAPPER a
 * lesson in its own words; it never invokes `we:scripts/conveyor/learnings-drop.mjs` itself.
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { applyFixUpdate, newFixReport, tryReadFixReport, writeFixReport } from './fix-report-store.mjs';
import { writeAllSync, writeLineSync } from '../lib/write-all-sync.mjs';

function parseFlags(argv) {
  const flags = {};
  for (const a of argv) {
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq === -1) flags[a.slice(2)] = true;
    else flags[a.slice(2, eq)] = a.slice(eq + 1);
  }
  return flags;
}

/** `--files=a.mjs,b.mjs` → `['a.mjs','b.mjs']`; absent/empty → `null`. Exported for the wrapper's own tests. */
export function parseFilesFlag(value) {
  if (value === undefined || value === null || value === true || String(value).trim() === '') return null;
  return String(value).split(',').map((s) => s.trim()).filter(Boolean);
}

/** Builds the optional `learning` sub-object from the four `--learning-*` flags, or `null` if none were given. */
export function parseLearningFlags(flags) {
  const given = ['learning-kind', 'learning-summary', 'learning-area', 'learning-suggestion'].filter((k) => Object.hasOwn(flags, k));
  if (given.length === 0) return null;
  if (given.length < 4) {
    throw new Error('report: --learning-kind/--learning-summary/--learning-area/--learning-suggestion must all be given together, or none at all');
  }
  return {
    kind: flags['learning-kind'],
    summary: flags['learning-summary'],
    area: flags['learning-area'],
    suggestion: flags['learning-suggestion'],
  };
}

export function runReport(flags) {
  const pr = flags.pr;
  const session = flags.session;
  if (!session) throw new Error('usage: fix-report-cli.mjs report --session=<slug> --pr=<num> --status=started|done ...');
  if (flags.status !== 'started' && flags.status !== 'done') throw new Error('report requires --status=started|done');

  if (flags.status === 'started') {
    if (!pr) throw new Error('report --status=started requires --pr=<num>');
    const existing = tryReadFixReport(session);
    // Idempotent within the same dispatch generation only — same reasoning as completion-cli.mjs's/
    // delivery-report-cli.mjs's own started-report idempotency (#3436): a retried `started` must never
    // clobber the first one.
    if (existing?.status === 'started') return { changed: false, record: existing };
    const record = newFixReport({ session, pr, item: flags.item ?? null });
    writeFixReport(record);
    return { changed: true, record };
  }

  const existing = tryReadFixReport(session);
  const patch = {};
  if (Object.hasOwn(flags, 'outcome')) patch.outcome = flags.outcome;
  if (Object.hasOwn(flags, 'reason')) patch.reason = flags.reason;
  if (Object.hasOwn(flags, 'files')) patch.filesTouched = parseFilesFlag(flags.files);
  const learning = parseLearningFlags(flags);
  if (learning) patch.learning = learning;

  const base = existing ?? newFixReport({ session, pr: pr ?? existing?.pr, item: flags.item ?? existing?.item ?? null });
  const record = applyFixUpdate(base, { status: 'done', ...patch });
  writeFixReport(record);
  return { changed: true, record };
}

export function runShow(flags) {
  const session = flags.session;
  if (!session) throw new Error('usage: fix-report-cli.mjs show --session=<slug>');
  const record = tryReadFixReport(session);
  return record ? { found: true, ...record } : { found: false, session };
}

const IS_CLI = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (IS_CLI) {
  const [sub, ...rest] = process.argv.slice(2);
  const flags = parseFlags(rest);
  try {
    if (sub === 'report') {
      writeAllSync(1, `${JSON.stringify(runReport(flags))}\n`);
    } else if (sub === 'show') {
      writeAllSync(1, `${JSON.stringify(runShow(flags))}\n`);
    } else {
      writeLineSync(2, 'usage: fix-report-cli.mjs report|show --session=<slug> [--pr=<num>] [--status=started|done] ...');
      process.exitCode = 2;
    }
  } catch (e) {
    writeLineSync(2, `error: ${String(e?.message ?? e)}`);
    process.exitCode = 1;
  }
}
