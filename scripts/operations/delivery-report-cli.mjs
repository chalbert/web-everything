#!/usr/bin/env node
/**
 * @file scripts/operations/delivery-report-cli.mjs
 * @description PROTOTYPE (#3627 design) — THE ONE COMMAND a minimal delivery agent shells to report its
 * outcome. This IS the "schema-constrained completion message to a specific endpoint" the operator asked
 * for: the agent's entire sanctioned output is `report --status=started` once at the top of its run, and
 * `report --status=done --outcome=... --reason=... --files=...` once at the end — nothing about lane-pool
 * mechanics, verify-lane polling, PR modes, labels, or exit codes ever appears in this CLI's surface.
 * A THIN shell over the pure/io split in {@link ./delivery-report-record.mjs} / {@link ./delivery-report-store.mjs},
 * mirroring `we:scripts/operations/completion-cli.mjs`'s own argv-parsing-only scope (#3436).
 *
 * NOT WIRED IN — see `delivery-report-record.mjs`'s header. `we:skills-src/conveyor/delivery-agent-brief-v2.md`
 * is the prototype brief that would shell this, once ratified.
 *
 * Usage:
 *   node scripts/operations/delivery-report-cli.mjs report --item=3627 --session=<slug> --status=started
 *   node scripts/operations/delivery-report-cli.mjs report --item=3627 --session=<slug> --status=done \
 *     --outcome=done --files=scripts/foo.mjs,scripts/foo.test.mjs
 *   node scripts/operations/delivery-report-cli.mjs report --item=3627 --session=<slug> --status=done \
 *     --outcome=blocked --reason="blockedBy 3612 re-opened"
 *   node scripts/operations/delivery-report-cli.mjs report --item=3627 --session=<slug> --status=done \
 *     --outcome=needs-human-judgment --reason="two valid empty-state copy treatments; product call"
 *   node scripts/operations/delivery-report-cli.mjs show --session=<slug>
 *
 * `--learning-kind`/`--learning-summary`/`--learning-area`/`--learning-suggestion` are an OPTIONAL group —
 * give all four or none. The agent hands the WRAPPER a lesson in its own words; it never invokes
 * `we:scripts/conveyor/learnings-drop.mjs` itself (that CLI's scrub/allow-list mechanics are exactly the kind
 * of orchestration-adjacent detail #3627 wants out of the agent's job — the wrapper forwards this group to it).
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { applyDeliveryUpdate, newDeliveryReport, tryReadDeliveryReport, writeDeliveryReport } from './delivery-report-store.mjs';
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
  const item = flags.item;
  const session = flags.session;
  if (!session) throw new Error('usage: delivery-report-cli.mjs report --session=<slug> --item=<num> --status=started|done ...');
  if (flags.status !== 'started' && flags.status !== 'done') throw new Error('report requires --status=started|done');

  if (flags.status === 'started') {
    if (!item) throw new Error('report --status=started requires --item=<num>');
    const existing = tryReadDeliveryReport(session);
    // Idempotent within the same dispatch generation only — same reasoning as completion-cli.mjs's own
    // started-report idempotency (#3436): a retried `started` must never clobber the first one, but a
    // session slug reused across a later RETRY of the same item starts fresh once the prior run is `done`.
    if (existing?.status === 'started') return { changed: false, record: existing };
    const record = newDeliveryReport({ session, item });
    writeDeliveryReport(record);
    return { changed: true, record };
  }

  const existing = tryReadDeliveryReport(session);
  const patch = {};
  if (Object.hasOwn(flags, 'outcome')) patch.outcome = flags.outcome;
  if (Object.hasOwn(flags, 'reason')) patch.reason = flags.reason;
  if (Object.hasOwn(flags, 'files')) patch.filesTouched = parseFilesFlag(flags.files);
  const learning = parseLearningFlags(flags);
  if (learning) patch.learning = learning;

  const base = existing ?? newDeliveryReport({ session, item: item ?? existing?.item });
  const record = applyDeliveryUpdate(base, { status: 'done', ...patch });
  writeDeliveryReport(record);
  return { changed: true, record };
}

export function runShow(flags) {
  const session = flags.session;
  if (!session) throw new Error('usage: delivery-report-cli.mjs show --session=<slug>');
  const record = tryReadDeliveryReport(session);
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
      writeLineSync(2, 'usage: delivery-report-cli.mjs report|show --session=<slug> [--item=<num>] [--status=started|done] ...');
      process.exitCode = 2;
    }
  } catch (e) {
    writeLineSync(2, `error: ${String(e?.message ?? e)}`);
    process.exitCode = 1;
  }
}
