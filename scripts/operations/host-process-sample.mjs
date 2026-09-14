#!/usr/bin/env node
/**
 * @file scripts/operations/host-process-sample.mjs
 * @description #3383 follow-on (per-process attribution) — CATEGORIZE every process on the host into the six
 * named buckets `telemetry.mjs#METRIC_NAMES` reserves for `host.process.*`, from a `ps` snapshot. Sibling to
 * `skills-src/conveyor/runner.mjs#hostMetrics`/`#readHostSample`: SAME pure-core/one-IO-edge split, same
 * never-throw discipline, sampled at the SAME once-per-tick cadence.
 *
 * WHY THIS EXISTS. `runner.mjs#readHostSample` (the whole-machine `os.loadavg()`/`os.freemem()` gauges landed
 * first) can only ever answer "is the host loaded" — never "loaded BY WHAT". `os` has no process-enumeration
 * API at all in Node (confirmed — there is no `os.processes()` or equivalent on any platform), so answering
 * "what is actually consuming the host" requires shelling out, which `hostMetrics`'s own docblock names as
 * the reason it does not attempt this. This file is that follow-on, kept SEPARATE from the pure `os.*` reads
 * so the no-subprocess discipline documented there still describes exactly what it always did.
 *
 * THE SIX CATEGORIES (mirrors `telemetry.mjs#METRIC_NAMES`'s own `host.process.*` comment — restated here
 * because this is where the actual matching rules live):
 *   • `conveyor`           — the driver/runner process itself and anything under `skills-src/conveyor/`.
 *   • `drain`               — the drain/merge-queue daemon (`scripts/lane-drain.mjs` and its own readiness
 *                             helpers under `scripts/readiness/drain-*`).
 *   • `dispatched_agents`   — a live `claude`/`codex` CHILD spawned BY this system's own dispatch wrappers —
 *                             matched on the exact, distinctive argv shape those wrappers always pass (see
 *                             {@link isDispatchedAgentCommand}), never on the bare binary name alone, because
 *                             the OPERATOR'S OWN interactive `claude` session is also, honestly, a `claude`
 *                             process and must NOT be double-counted into this bucket.
 *   • `vscode` / `chrome`   — the two heaviest, most common desktop consumers on the operator's own machine,
 *                             named explicitly so a capacity read is not "everything else" muddied by them.
 *   • `other`               — the deliberately-honest catch-all. Never omitted, never silently absorbed into
 *                             one of the five named buckets — see {@link summarizeProcessSample}'s own note on
 *                             why the categories must sum to the WHOLE snapshot, not just the interesting part.
 *
 * MATCHING IS ON THE FULL COMMAND LINE (`ps ... command=`), not the short `comm` name — `comm` truncates to
 * the executable's own basename with no arguments, which cannot distinguish the operator's own interactive
 * `claude` session from a dispatched one, nor "any process under `skills-src/conveyor/`" from an unrelated
 * `node` invocation. Every pattern below was checked against a REAL `ps -Awwo pid=,pcpu=,rss=,command=` capture
 * on this machine (Darwin) while several of the six categories were genuinely running side by side — see the
 * accompanying test's fixtures, which are that real capture, trimmed.
 *
 * PURE except {@link readProcessSample}, the one IO edge — mirrors `runner.mjs#readHostSample`'s own shape and
 * its own stated reason: keeping the categorization logic (the part with real decisions in it) testable
 * against a plain string, with zero real `ps` calls needed to exercise it.
 */

import { execFileSync } from 'node:child_process';

/** The closed set of buckets every process on the host is filed into — mirrors
 *  `telemetry.mjs#METRIC_NAMES`'s own `host.process.*` list; the two must never drift apart, and the wiring
 *  test asserts they do not. */
export const PROCESS_CATEGORIES = Object.freeze([
  'conveyor', 'drain', 'dispatched_agents', 'vscode', 'chrome', 'other',
]);

/**
 * PURE. Parse `ps -Awwo pid=,pcpu=,rss=,command=` output (the `=` suffix on every field name suppresses BSD
 * `ps`'s header row and its column-name line — verified live on this Darwin host) into `{pid, pcpu, rssKb,
 * command}` rows. Tolerant, never throwing: a blank line is skipped, a line that does not match the expected
 * `<pid> <pcpu> <rss> <command...>` shape is skipped rather than aborting the whole parse — the same
 * "a corrupt line must not make the rest unreadable" call `telemetry.mjs#parseTelemetryLines` already makes.
 *
 * `command` is the REST of the line (everything after the third whitespace-delimited field), not a fourth
 * split token — a command line very often contains its own internal spaces (flags, quoted arguments), and
 * splitting naively on whitespace would silently truncate it to its first word.
 * @param {string} text
 * @returns {Array<{pid: number, pcpu: number, rssKb: number, command: string}>}
 */
export function parsePsOutput(text) {
  const rows = [];
  for (const raw of String(text ?? '').split('\n')) {
    const line = raw.trim();
    if (line === '') continue;
    const m = /^(\d+)\s+([\d.]+)\s+(\d+)\s+(\S.*)$/.exec(line);
    if (!m) continue;
    const pid = Number(m[1]);
    const pcpu = Number(m[2]);
    const rssKb = Number(m[3]);
    if (!Number.isFinite(pid) || !Number.isFinite(pcpu) || !Number.isFinite(rssKb)) continue;
    rows.push({ pid, pcpu, rssKb, command: m[4] });
  }
  return rows;
}

// ── CATEGORY MATCHERS — checked in this order; first match wins ────────────────────────────────────────

/** The conveyor driver itself, or any process running a script under `skills-src/conveyor/` — the runner's
 *  own tick loop, and every mechanical pass it shells out to from that directory. */
function isConveyorCommand(s) {
  return /skills-src\/conveyor\//.test(s);
}

/** The drain/merge-queue daemon — `scripts/lane-drain.mjs` (the resident driver) and the readiness helpers
 *  that run alongside it under `scripts/readiness/drain-*`. */
function isDrainCommand(s) {
  return /scripts\/lane-drain\.mjs/.test(s) || /scripts\/readiness\/drain-/.test(s);
}

/**
 * A DISPATCHED agent child — a `claude` or `codex` process this system's own wrapper spawned, never the
 * operator's own interactive session. Matched on the argv SHAPE every dispatch wrapper actually passes,
 * never on the bare binary name:
 *   • Claude — `minimal-context-provider.mjs#buildRestrictedProviderArgv`'s fixed flag set is
 *     `--restricted ... --strict-mcp-config ...`, always both, together, on every one of the six wrappers.
 *     An interactive operator session never carries `--restricted`.
 *   • Codex — `codex-delivery-provider.mjs#buildCodexDeliveryArgv` always opens with `exec` (`exec -C <cwd>
 *     ...` fresh, `exec resume <id> ...` on a gate-failure retry) — the one Codex CLI verb this repo's own
 *     dispatch ever uses.
 */
function isDispatchedAgentCommand(s) {
  if (/\bcodex\b[\s\S]*\bexec\b/.test(s)) return true;
  return /\bclaude\b/.test(s) && /--restricted\b/.test(s) && /--strict-mcp-config\b/.test(s);
}

/** Visual Studio Code and every one of its Electron helper processes (GPU/utility/renderer/extension host) —
 *  all of them carry `Visual Studio Code` or `Code Helper` somewhere in their full command line, verified
 *  against a real capture on this machine. */
function isVscodeCommand(s) {
  return /Visual Studio Code/.test(s) || /Code Helper/.test(s);
}

/** Google Chrome and every one of its helper/renderer/GPU processes — same shape as the VS Code matcher. */
function isChromeCommand(s) {
  return /Google Chrome/.test(s);
}

/**
 * PURE. Categorize ONE command line into exactly one of {@link PROCESS_CATEGORIES}, checked in a fixed
 * priority order (`conveyor` and `drain` first, since both are THIS system's own processes and must never be
 * miscounted as `other`; `dispatched_agents` next, ahead of the two desktop-app buckets, since nothing in this
 * system's own dispatch shape could ever also match `Visual Studio Code`/`Google Chrome`). `other` is the
 * default for anything that matches none of the five named patterns — see {@link summarizeProcessSample} for
 * why that bucket is load-bearing rather than a shrug.
 * @param {*} command
 * @returns {string} one of {@link PROCESS_CATEGORIES}
 */
export function categorizeProcess(command) {
  const s = String(command ?? '');
  if (isConveyorCommand(s)) return 'conveyor';
  if (isDrainCommand(s)) return 'drain';
  if (isDispatchedAgentCommand(s)) return 'dispatched_agents';
  if (isVscodeCommand(s)) return 'vscode';
  if (isChromeCommand(s)) return 'chrome';
  return 'other';
}

/**
 * PURE. Bucket an already-parsed `ps` row list into per-category CPU/memory totals: `cpuPct` is the RAW SUM of
 * `ps`'s own `%CPU` column across every process in the bucket (so it is expressed in "percent of one core" —
 * 100 means one fully-busy core, and a multi-process/multi-thread bucket can legitimately exceed 100 on a
 * multi-core host; never normalized against core count here, because `runner.mjs#hostMetrics`'s own
 * `host.cpu.count` sample already carries the core count a later reader divides by). `memBytes` is
 * `rssKb * 1024` summed, matching `host.mem.*`'s own raw-bytes convention (a ratio is one division away; raw
 * is not recoverable from a ratio).
 *
 * EVERY category in {@link PROCESS_CATEGORIES} is always present in the result, even at zero — the same
 * "emitted even when zero" rule `runner.mjs#tickMetrics` documents, and for the identical reason: a bucket
 * that caught nothing this tick is a real, load-bearing observation (the category exists but nothing matched
 * it right now), not an absent key a reader has to special-case.
 *
 * THE CATCH-ALL IS THE HONESTY CHECK. `other`'s sum is not a shrug — added to the five named buckets, it must
 * equal the sample's own total, which is what lets a reader audit these six numbers against the whole-machine
 * `os.loadavg()`/`os.freemem()` figures already recorded: if the six categories' `cpuPct` sum is far below
 * `host.cpu.load1 * 100`, something is either idle-but-blocked (disk/network wait) or mis-sampled — a question
 * this file can raise but never answer on its own (see the module docblock's own "what remains uncaptured").
 * @param {Array<{pcpu?: number, rssKb?: number, command?: string}>} rows
 * @returns {Record<string, {cpuPct: number, memBytes: number, count: number}>}
 */
export function summarizeProcessSample(rows) {
  const totals = {};
  for (const cat of PROCESS_CATEGORIES) totals[cat] = { cpuPct: 0, memBytes: 0, count: 0 };
  for (const r of Array.isArray(rows) ? rows : []) {
    if (!r || typeof r !== 'object') continue;
    const cat = categorizeProcess(r.command);
    const bucket = totals[cat] || totals.other;
    bucket.cpuPct += Number.isFinite(r.pcpu) ? r.pcpu : 0;
    bucket.memBytes += Number.isFinite(r.rssKb) ? r.rssKb * 1024 : 0;
    bucket.count += 1;
  }
  return totals;
}

/**
 * PURE. Shape {@link summarizeProcessSample}'s totals into the metric-sample array
 * `skills-src/conveyor/runner.mjs#emitTickMetrics` records — TWO metrics per category (`cpu_pct` unit
 * `percent`, `mem_bytes` unit `bytes`), matching `telemetry.mjs#METRIC_NAMES`'s `host.process.<category>.*`
 * naming exactly, plus a `processCount` attribute on each sample so a reader can see how many processes fed a
 * given number without a second lookup.
 * @param {Record<string, {cpuPct: number, memBytes: number, count: number}>} totals
 * @returns {Array<{name: string, value: number, unit: string, attributes: object}>}
 */
export function processCategoryMetrics(totals) {
  const t = totals || {};
  const out = [];
  for (const cat of PROCESS_CATEGORIES) {
    const c = t[cat] || { cpuPct: 0, memBytes: 0, count: 0 };
    out.push({ name: `host.process.${cat}.cpu_pct`, value: c.cpuPct, unit: 'percent', attributes: { processCount: c.count } });
    out.push({ name: `host.process.${cat}.mem_bytes`, value: c.memBytes, unit: 'bytes', attributes: { processCount: c.count } });
  }
  return out;
}

/**
 * IO EDGE — the one place this feature shells `ps`, kept to exactly this so every function above stays pure.
 * Never throws: a `ps` failure (missing binary, non-Darwin host with a differently-shaped `ps`, a transient
 * spawn error) degrades to an EMPTY sample — every category reports zero for this tick — rather than taking
 * the resident runner's tick down, the identical discipline `readHostSample` already applies to `os.*`.
 *
 * DARWIN-SPECIFIC INVOCATION, STATED RATHER THAN HIDDEN — `-Awwo pid=,pcpu=,rss=,command=` is BSD `ps` syntax
 * (macOS, the platform this host runs, per the epic's own findings); GNU `ps` (Linux) accepts a compatible
 * `-eo pid,pcpu,rss,args` form but was NOT verified here and is left for whoever runs this on that platform —
 * the empty-sample fallback means a wrong invocation there degrades to "no data" rather than a crash, which is
 * the safe failure mode either way.
 *
 * KEPT CHEAP AND INFREQUENT ON PURPOSE, matching the epic's own instruction: called once per runner tick
 * (`DEFAULT_TICK_INTERVAL_MS`, 120s today) — never on a hot path — because shelling out has a real, if small,
 * cost that a per-dispatch or per-span sampling point cannot absorb the way a 120s cadence can.
 * @param {{exec?: Function}} [io] - injectable for tests; defaults to a real `execFileSync`.
 * @returns {Array<{pid: number, pcpu: number, rssKb: number, command: string}>}
 */
export function readProcessSample({ exec = execFileSync } = {}) {
  try {
    const out = exec('ps', ['-Awwo', 'pid=,pcpu=,rss=,command='], {
      encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'],
    });
    return parsePsOutput(out);
  } catch {
    return [];
  }
}
