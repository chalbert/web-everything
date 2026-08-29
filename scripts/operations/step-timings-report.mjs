#!/usr/bin/env node
/**
 * @file scripts/operations/step-timings-report.mjs
 * @description THE ONE READER `stepTimings` needed to count as done (#3368, citing #19 — a mechanism nothing
 * reads is not done). Prints total wall-clock, grouped by step NAME, across every run in the store — the
 * answer to the questions #3368 was filed to make answerable without watching a terminal: which step
 * dominates a session, how many times has it run, what does it cost on average.
 *
 * DELIBERATELY NOT A DASHBOARD. Raw per-step rows summed by name, nothing sampled or smoothed — the item's own
 * "deliberately NOT in scope" rules out aggregation beyond this one grouping. Once there is enough data to
 * want a distribution, a percentile or a trend, that is a separate card built on top of the rows this prints,
 * not a reason to grow this one.
 *
 * ONLY FINISHED ROWS COUNT. A started-but-not-finished row (a run halted mid-step, or one still in flight) has
 * no `durationMs` to add — see `run-record.mjs#withStepFinish`. Silently skipping it is correct, not lossy:
 * the wall-clock it will eventually cost is not yet known, and guessing would misreport a step as fast because
 * it happened to still be running when this printed.
 *
 * PURE CORE / IO SHELL, same split as everywhere else in this directory: {@link aggregateStepTimings} and
 * {@link renderStepTimingsReport} touch no disk; the CLI block at the bottom is the only io.
 */

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createFileRunStore } from './run-store.mjs';

/**
 * SUM `stepTimings` DURATIONS ACROSS RUNS, GROUPED BY STEP NAME. PURE.
 *
 * Grouped by name alone, not by `(op, name)` — two declarations naming a step `verify` are asking the same
 * question ("how long does verifying take") and #3368 explicitly measures wall-clock, not per-operation cost.
 * A caller wanting the per-operation split has the raw run records; this is the one cut #19 needs a consumer
 * for.
 *
 * @param {object[]} runs - run records, as read from a store. Non-array `stepTimings` (absent, or a
 *   pre-#3368 record) contributes nothing rather than throwing.
 * @returns {{step: string, count: number, totalMs: number}[]} sorted by `totalMs` descending.
 */
export function aggregateStepTimings(runs) {
  const byStep = new Map();
  for (const run of runs ?? []) {
    if (!Array.isArray(run?.stepTimings)) continue;
    for (const row of run.stepTimings) {
      if (typeof row?.durationMs !== 'number' || !Number.isFinite(row.durationMs)) continue; // unfinished — nothing to add
      const entry = byStep.get(row.step) ?? { step: row.step, count: 0, totalMs: 0 };
      entry.count += 1;
      entry.totalMs += row.durationMs;
      byStep.set(row.step, entry);
    }
  }
  return [...byStep.values()].sort((a, b) => b.totalMs - a.totalMs);
}

/** `12345` → `"12.3s"`. PURE. Matches the seconds-with-one-decimal convention `renderSpendLines` already uses. */
function asSeconds(ms) {
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * THE REPORT, as operator-facing lines. PURE. Quiet-but-explicit when nothing has run yet, rather than
 * printing an empty table a first-time reader would have to interpret.
 *
 * @param {{step: string, count: number, totalMs: number}[]} rows - {@link aggregateStepTimings}'s output.
 * @returns {string[]}
 */
export function renderStepTimingsReport(rows) {
  if (!rows.length) return ['step-timings: no finished step yet — nothing in .operations/runs/ has completed a step.'];
  const grandTotalMs = rows.reduce((n, r) => n + r.totalMs, 0);
  const lines = [`step-timings: ${asSeconds(grandTotalMs)} wall-clock over ${rows.length} distinct step name(s):`];
  for (const r of rows) {
    lines.push(`  ${r.step}: ${asSeconds(r.totalMs)} over ${r.count} run(s) — avg ${asSeconds(r.totalMs / r.count)}`);
  }
  return lines;
}

const IS_CLI = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (IS_CLI) {
  const store = createFileRunStore();
  const runs = store.list().map((id) => store.read(id)).filter(Boolean);
  process.stdout.write(`${renderStepTimingsReport(aggregateStepTimings(runs)).join('\n')}\n`);
}
