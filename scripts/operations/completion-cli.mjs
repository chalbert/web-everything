#!/usr/bin/env node
/**
 * @file scripts/operations/completion-cli.mjs
 * @description THE COMPLETION CLI (#3436) — the write side a dispatched review/fix agent shells at its own
 * start and exit, and the read side that recovers "what did the one that just finished actually conclude"
 * with NO `claude logs` call and NO ANSI parsing anywhere in the read path (`we:backlog/3436-*.md`, done-when
 * #1/#2). A THIN shell over the pure/io split in {@link ./completion-record.mjs} / {@link ./completion-store.mjs}
 * — this file owns only argv parsing and stdout/stderr.
 *
 * TWO SUBCOMMANDS:
 *   `report` — write. `--status=started` mints a fresh record (idempotent: re-reporting `started` for a
 *     session that already has one is a no-op, never a throw — a retried brief must not lose its first
 *     record). `--status=done` merges onto the EXISTING record when one exists (preserving `startedAt`), or
 *     mints one directly when it does not (a brief that skipped the `started` report, or a race) — either way
 *     a `done` report always leaves a record behind.
 *   `show` — read. Resolve a session either directly (`--session=`) or by `--pr=` + `--kind=` using the SAME
 *     `review-<pr>` / `fix-<pr>` grammar `we:scripts/operations/dispatch-lane.mjs#sessionSlugFor` and
 *     `we:scripts/conveyor/session-reaper.mjs#sessionTarget` already mint/parse (duplicated here, not
 *     imported — the same "re-derive, never share the binding" choice `session-reaper.mjs`'s own header makes
 *     for its unrelated liveness axis). Prints the record as JSON, or `{"found":false}` when none exists.
 *
 * SCRIPT, NOT PROSE (#2607/#3296's own precedent — see `we:scripts/conveyor/stand-down.mjs`'s header). The
 * write must happen even when the agent following the brief is under stress (about to crash, about to be
 * refused an effect); asking it to also *remember* to hand-author a record is the exact write-back-onto-prose
 * hazard #3296 already named for a fixer's own stand-down marker.
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { applyCompletionUpdate, newCompletionRecord, tryReadCompletion, writeCompletion } from './completion-store.mjs';
import { writeAllSync, writeLineSync } from '../lib/write-all-sync.mjs';

/** The SAME two grammars `dispatch-lane.mjs#sessionSlugFor` (fix) and `review-dispatch.mjs` (review) mint. */
export function sessionSlugForCompletion({ kind, pr }) {
  if (kind !== 'review' && kind !== 'fix') throw new TypeError(`operations: completion --kind must be review or fix, got ${JSON.stringify(kind)}`);
  if (pr === undefined || pr === null || String(pr).trim() === '') throw new TypeError('operations: completion --pr is required when --session is not given');
  return `${kind}-${String(pr).trim()}`;
}

/**
 * PURE-ish (fs read only) core of `report --status=done`: reuse the existing record's `session`/`kind`/`pr`/
 * `item`/`startedAt` when one is on disk, otherwise mint a fresh one — so a `done` report never depends on a
 * `started` report having happened first.
 * @returns {object} the record to write
 */
export function planDoneReport({ existing, session, kind, pr, item, patch, now }) {
  const base = existing ?? newCompletionRecord({ session, kind, pr, item, now });
  return applyCompletionUpdate(base, { status: 'done', ...patch }, now);
}

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

export function runReport(flags) {
  const kind = flags.kind;
  const pr = flags.pr ?? null;
  const item = flags.item ?? null;
  const session = flags.session || (kind && pr ? sessionSlugForCompletion({ kind, pr }) : undefined);
  if (!session) throw new Error('usage: completion-cli.mjs report --session=<slug>|--kind=review|fix --pr=<n> --status=started|done [...]');
  if (flags.status !== 'started' && flags.status !== 'done') throw new Error('report requires --status=started|done');

  if (flags.status === 'started') {
    const existing = tryReadCompletion(session);
    // Idempotent ONLY within the SAME dispatch generation (existing is still `started`) — a retried `started`
    // report must never clobber the first one. A session slug (`review-<pr>`/`fix-<pr>`) is reused across
    // dispatch GENERATIONS on the same PR (a fixer re-dispatched after a later bounce, a review re-run once
    // the diff changed), so an existing `done` record is the PREVIOUS generation's, not this one's — starting
    // fresh here is what stops a crashed new generation from reading back as "already concluded" with a stale
    // outcome (review finding, #3436).
    if (existing?.status === 'started') return { changed: false, record: existing };
    if (!kind) throw new Error('report --status=started requires --kind=review|fix (no existing record to infer it from)');
    const record = newCompletionRecord({ session, kind, pr, item });
    writeCompletion(record);
    return { changed: true, record };
  }

  const existing = tryReadCompletion(session);
  const patch = {};
  for (const key of ['outcome', 'verdict', 'label', 'runId']) {
    if (Object.hasOwn(flags, key)) patch[key] = flags[key];
  }
  const record = planDoneReport({
    existing,
    session,
    kind: kind || existing?.kind,
    pr: pr ?? existing?.pr,
    item: item ?? existing?.item,
    patch,
    now: () => new Date().toISOString(),
  });
  writeCompletion(record);
  return { changed: true, record };
}

export function runShow(flags) {
  const session = flags.session || (flags.kind && flags.pr ? sessionSlugForCompletion({ kind: flags.kind, pr: flags.pr }) : undefined);
  if (!session) throw new Error('usage: completion-cli.mjs show --session=<slug>|--kind=review|fix --pr=<n>');
  const record = tryReadCompletion(session);
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
      writeLineSync(2, 'usage: completion-cli.mjs report|show [--session=<slug>] [--kind=review|fix] [--pr=<n>] ...');
      process.exitCode = 2;
    }
  } catch (e) {
    writeLineSync(2, `error: ${String(e?.message ?? e)}`);
    process.exitCode = 1;
  }
}
