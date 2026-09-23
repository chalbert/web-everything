/**
 * @file scripts/operations/telemetry-summary.mjs
 * @description THE `telemetry-summary` DECLARATION (backlog `xaxks4j`, epic `xjtmptc`) — assembles
 * `TelemetrySnapshot` v1 (plateau-app `docs/telemetry-page.md`, `lane/xjtmptc-telemetry-design`): the usage
 * half (`week`/`today`/`last10`, backlog `xs0eutz`) plus the machine and source-health halves this slice adds
 * (`machine`, `sources`, `hazards`, `degraded`), wrapped in the wire envelope (`v`, `observedAt`, `timezone`).
 *
 * An OPERATION, in the `gate-health`/`suggest-next` shape, because the page (`we:docs/telemetry-page.md`'s
 * sibling, plateau-app's) reads this exact JSON through the /wip relay's ask channel and a dev-server route —
 * two callers of one declaration, never a re-implementation on either side. The one step is `compute`, so
 * `./http-adapter.mjs` derives a GET-only surface with no run record, exactly as `gate-health` and
 * `suggest-next` do.
 *
 * ONE STEP, DELIBERATELY, NOT `facts` → `assemble`. `gate-health`'s two-step shape works because its
 * `history` finding is capped at 1000 small PR records; this operation's raw input is the opposite —
 * thousands of individual OTel/host-sampler lines across ~18 day files plus a tail-bounded host read — and
 * the engine PERSISTS every step's finding onto the run record (`we:scripts/operations/engine.mjs#frozenCopy`
 * round-trips it through `JSON.stringify`, and the CLI's file-backed run store writes that to disk). A
 * `facts` step returning those raw records as its own finding was tried first and produced a 69 MB run-record
 * file from one real invocation — the "≤ 64 KB" requirement is about the SNAPSHOT this step returns, and nothing
 * upstream of it should ever be durable. Keeping ingestion and reduction in one `fn` means the raw arrays are
 * local variables that vanish when it returns; only the small assembled object below is ever a finding.
 *
 * Its import graph holds no `node:` specifier and cannot reach `./telemetry-summary-io.mjs`, so the step
 * function has no filesystem reader in scope — `fs`, `plutil` and the clock live in the io module and only
 * read. The arithmetic is `../lib/telemetry-summary.mjs` (usage) and `../lib/telemetry-machine.mjs`
 * (machine, sources, hazard). Arithmetic in THIS file is a bug.
 */
import { op } from './registry.mjs';
import { compute } from './step-kinds.mjs';
import { summarizeTelemetryUsage, PLAN_WEEK_RENEWAL } from '../lib/telemetry-summary.mjs';
import {
  computeMachineNow, todayHourlyBusyPct, machineDays, shapeSources, collectorHazards, etDayHour,
} from '../lib/telemetry-machine.mjs';

export const TELEMETRY_SUMMARY_OP = 'telemetry-summary';

/**
 * Validate + normalize the injected read's raw shape. Refuses an unknown shape rather than assembling a
 * snapshot out of a broken reader's guesses — the same reasoning `we:scripts/operations/gate-health.mjs`'s
 * `shapeHistoryFinding` uses for its own injected read.
 *
 * NOT a step finding (see this file's header) — a plain function called from inside the one `compute` step,
 * so its return value is a local variable the engine never sees or persists.
 */
export function shapeFacts(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('telemetry-summary: the injected reader must return an object');
  }
  const now = raw.now instanceof Date ? raw.now : new Date(raw.now);
  if (!Number.isFinite(now.getTime())) {
    throw new Error('telemetry-summary: the injected reader must return a valid `now`');
  }
  if (!raw.timezone || typeof raw.timezone !== 'string') {
    throw new Error('telemetry-summary: the injected reader must return a `timezone`');
  }
  if (!raw.sources || typeof raw.sources !== 'object') {
    throw new Error('telemetry-summary: the injected reader must return `sources`');
  }
  const m = raw.machine || {};
  return {
    now,
    timezone: raw.timezone,
    renewal: raw.renewal || PLAN_WEEK_RENEWAL,
    usageRecords: Array.isArray(raw.usage?.records) ? raw.usage.records : [],
    machine: {
      busySamples: Array.isArray(m.busySamples) ? m.busySamples : [],
      sessionSamples: Array.isArray(m.sessionSamples) ? m.sessionSamples : [],
      pressureSamples: Array.isArray(m.pressureSamples) ? m.pressureSamples : [],
      coreSamples: Array.isArray(m.coreSamples) ? m.coreSamples : [],
      fallbackCores: m.fallbackCores ?? null,
      hourlySamples: Array.isArray(m.hourlySamples) ? m.hourlySamples : [],
      rollups: Array.isArray(m.rollups) ? m.rollups : [],
    },
    sources: raw.sources,
    hazard: raw.hazard || { plistFound: false, scriptPath: null, scriptExists: null },
  };
}

/** Pure reduction from validated facts to the wire `TelemetrySnapshot` v1. No io, no `Date.now()`. */
export function assembleSnapshot(f) {
  const usage = summarizeTelemetryUsage({
    records: f.usageRecords, now: f.now, renewal: f.renewal, timezone: f.timezone,
  });
  const { now: machineNow, cores } = computeMachineNow({
    busySamples: f.machine.busySamples,
    sessionSamples: f.machine.sessionSamples,
    pressureSamples: f.machine.pressureSamples,
    coreSamples: f.machine.coreSamples,
    fallbackCores: f.machine.fallbackCores,
  });
  const { sources, degraded } = shapeSources(f.sources, f.now.getTime(), machineNow.claudeSessions);
  const hazards = collectorHazards(f.hazard);
  const todayEtKey = etDayHour(f.now, f.timezone).dayKey;

  return {
    v: 1,
    observedAt: f.now.toISOString(),
    timezone: f.timezone,
    week: usage.week,
    today: usage.today,
    last10: usage.last10,
    machine: {
      cores,
      now: machineNow,
      todayHourlyBusyPct: todayHourlyBusyPct(f.machine.hourlySamples, todayEtKey, f.now, f.timezone),
      days: machineDays(f.machine.rollups),
    },
    sources,
    hazards,
    degraded,
  };
}

/**
 * @param {object} deps
 * @param {() => object} deps.loadFacts - `./telemetry-summary-io.mjs`'s `createTelemetrySummaryReader()`
 *   supplies the real reader; tests supply fixtures. Takes NO argument — unlike `gate-health`'s
 *   `loadHistory`, this operation declares no input field the reader would need to see: there is one
 *   laptop, one collector, one host store, nothing a caller could ask for instead.
 */
export function telemetrySummaryOperation({ loadFacts } = {}) {
  if (typeof loadFacts !== 'function') {
    throw new TypeError(
      'telemetry-summary: needs a `loadFacts()` reader — the io is injected so the declaration stays '
      + 'testable without touching a disk',
    );
  }

  return op(TELEMETRY_SUMMARY_OP, {
    verdictFrom: 'snapshot',
    snapshot: compute({
      reads: [],
      fn: () => assembleSnapshot(shapeFacts(loadFacts())),
    }),
  });
}
