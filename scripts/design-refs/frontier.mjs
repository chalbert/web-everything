// design-refs/frontier.mjs — scheduled small-model frontier re-benchmark / stay-current harness
// (backlog #515, epic #490, #488 F5).
//
// Slice B (#512) gave us a benchmark that scores ONE provider over the held-out split. This harness is the
// recurring layer on top: a scheduled agent re-runs that benchmark over newly-released student/quantization
// candidates and this module decides — and records — whether any candidate now BEATS the bundled on-device
// default, so a better small model surfaces automatically rather than being missed (#488 F5). It does NOT
// run a model itself; it folds `runBenchmark` results (or any object with the same `graduation`/`agreement`/
// `quarantineRecall` shape) into a history-preserving ledger and exposes a freshness signal (the #192
// cadence). Every decision function is PURE and takes `now` as a parameter, so the whole thing is
// fixture-tested with no model, browser, or corpus — like the scorer it sits above.
//
// No-leakage (#475): a candidate is identified by an opaque id only; this names no vendor.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LEDGER_PATH = resolve(__dirname, '..', '..', 'design-refs', 'frontier-ledger.json');

/** The cadence default (days) after which the frontier is "overdue" for a re-benchmark. */
export const DEFAULT_CADENCE_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

// ---- pure metric helpers ---------------------------------------------------

/**
 * Reduce a benchmark result (from `scoreBenchmark`/`runBenchmark`) to the compact metric tuple the ledger
 * stores. `graduated` is true only when every gated floor passed.
 */
export function summarizeResult(result = {}) {
  return {
    verdictAgreement: result.agreement?.fraction ?? null,
    quarantineRecall: result.quarantineRecall?.overall?.fraction ?? null,
    graduated: result.graduation?.pass === true,
  };
}

/**
 * Does `candidate` beat the current `bundled` default? A candidate can only win if it GRADUATES (meets both
 * floors) — a non-graduating model is never promoted regardless of raw numbers. Against no champion, the
 * first graduating candidate wins. Against an existing champion, the candidate must strictly improve overall
 * verdict-agreement without regressing quarantine-recall (the asymmetric safety metric must not drop).
 * Returns `{ beats, reason, deltas }`.
 */
export function beatsBundled(candidate, bundled = null) {
  const c = candidate; // already a summary tuple ({ verdictAgreement, quarantineRecall, graduated })
  const deltas = {
    verdictAgreement: round(num(c.verdictAgreement) - num(bundled?.verdictAgreement)),
    quarantineRecall: round(num(c.quarantineRecall) - num(bundled?.quarantineRecall)),
  };
  if (!c.graduated) return { beats: false, reason: 'candidate did not graduate (a floor unmet)', deltas };
  if (!bundled) return { beats: true, reason: 'first graduating candidate — no bundled default yet', deltas };
  if (num(c.quarantineRecall) < num(bundled.quarantineRecall)) {
    return { beats: false, reason: 'regresses quarantine-recall (the asymmetric safety floor)', deltas };
  }
  if (num(c.verdictAgreement) > num(bundled.verdictAgreement)) {
    return { beats: true, reason: 'improves verdict-agreement without regressing quarantine-recall', deltas };
  }
  return { beats: false, reason: 'no verdict-agreement improvement over the bundled default', deltas };
}

/** True when the last benchmark is older than the cadence horizon (or never run). */
export function isOverdue(lastBenchmarked, cadenceDays, now) {
  if (!lastBenchmarked) return true;
  const last = Date.parse(lastBenchmarked);
  if (Number.isNaN(last)) return true;
  return now - last > cadenceDays * DAY_MS;
}

/**
 * Fold a new benchmark run into the ledger, history-preserving (#192 cap.1 — never overwrite a prior run).
 * Appends a dated run, decides `beatsBundled`, promotes the champion when it wins, and stamps
 * `lastBenchmarked`. Pure: returns a NEW ledger, mutates nothing.
 */
export function foldRun(ledger, run, nowIso) {
  const base = normalizeLedger(ledger);
  const summary = summarizeResult(run.result);
  const verdict = beatsBundled(summary, base.champion);
  const entry = {
    date: nowIso,
    candidate: run.candidate ?? 'unnamed-candidate',
    ...summary,
    beatsBundled: verdict.beats,
    reason: verdict.reason,
    deltas: verdict.deltas,
  };
  const champion = verdict.beats
    ? { id: entry.candidate, verdictAgreement: summary.verdictAgreement, quarantineRecall: summary.quarantineRecall }
    : base.champion;
  return {
    ...base,
    lastBenchmarked: nowIso,
    champion,
    runs: [...base.runs, entry],
  };
}

/** Human-readable status line for the CLI / a scheduled-agent log. */
export function formatStatus(ledger, now) {
  const l = normalizeLedger(ledger);
  const overdue = isOverdue(l.lastBenchmarked, l.cadenceDays, now);
  const champ = l.champion ? `${l.champion.id} (agreement ${pct(l.champion.verdictAgreement)})` : 'none (API bridge is the default)';
  const last = l.lastBenchmarked ?? 'never';
  const recentWin = [...l.runs].reverse().find((r) => r.beatsBundled);
  return [
    `frontier re-benchmark — ${l.runs.length} run(s) recorded`,
    `  bundled on-device default: ${champ}`,
    `  last benchmarked: ${last} · cadence ${l.cadenceDays}d · ${overdue ? 'OVERDUE — schedule a re-benchmark' : 'current'}`,
    recentWin ? `  most recent promotion: ${recentWin.candidate} on ${recentWin.date} (${recentWin.reason})` : '  no candidate has beaten the default yet',
  ].join('\n');
}

// ---- internals -------------------------------------------------------------

function normalizeLedger(ledger) {
  return {
    cadenceDays: ledger?.cadenceDays ?? DEFAULT_CADENCE_DAYS,
    lastBenchmarked: ledger?.lastBenchmarked ?? null,
    champion: ledger?.champion ?? null,
    runs: Array.isArray(ledger?.runs) ? ledger.runs : [],
  };
}

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const round = (v) => Math.round(v * 1e6) / 1e6;
const pct = (v) => (typeof v === 'number' ? `${(v * 100).toFixed(1)}%` : 'n/a');

export function loadLedger(path = LEDGER_PATH) {
  if (!existsSync(path)) return normalizeLedger(null);
  return normalizeLedger(JSON.parse(readFileSync(path, 'utf8')));
}

export function saveLedger(ledger, path = LEDGER_PATH) {
  writeFileSync(path, JSON.stringify(normalizeLedger(ledger), null, 2) + '\n');
}

// ---- CLI -------------------------------------------------------------------
// (no args)        print frontier status + freshness; exit 1 when overdue (the scheduled-agent trigger).
// --record <file>  fold a benchmark-result JSON into the ledger and persist (history-preserving).

function main(argv) {
  const recordIdx = argv.indexOf('--record');
  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  if (recordIdx !== -1) {
    const file = argv[recordIdx + 1];
    if (!file) { console.error('frontier --record needs a result JSON path'); process.exit(2); }
    const payload = JSON.parse(readFileSync(resolve(file), 'utf8')); // { candidate, result }
    const next = foldRun(loadLedger(), payload, nowIso);
    saveLedger(next);
    const last = next.runs[next.runs.length - 1];
    console.log(`recorded ${last.candidate}: ${last.beatsBundled ? 'BEATS the bundled default' : 'no promotion'} — ${last.reason}`);
    console.log(formatStatus(next, now));
    return;
  }

  const ledger = loadLedger();
  console.log(formatStatus(ledger, now));
  if (isOverdue(ledger.lastBenchmarked, ledger.cadenceDays, now)) process.exit(1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}
