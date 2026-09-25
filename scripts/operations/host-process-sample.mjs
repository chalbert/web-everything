#!/usr/bin/env node
/**
 * @file scripts/operations/host-process-sample.mjs
 * @description #3383 follow-on (per-process attribution), REDESIGNED (#3383 telemetry-granularity follow-on —
 * "any process taking substantial capacity should have its own entry"). Sibling to
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
 * WHAT CHANGED, AND WHY (the granularity follow-on). The ORIGINAL six-bucket version of this file categorized
 * every process into `conveyor` / `drain` / `dispatched_agents` / `vscode` / `chrome` / `other` AT COLLECTION
 * TIME, before anything hit disk. On a real capture on this host, `other` alone summed 888 processes into ONE
 * entry (612.7% CPU, 33.6GB) with zero per-process identity retained — a single named app disappearing inside
 * `other` looked identical to a genuine unknown regardless of how much capacity it actually took. Confirmed:
 * that collapse happened AT AGGREGATION, not at `ps` — the raw `ps` snapshot always had full identity; the old
 * `summarizeProcessSample` just never kept it past one function call.
 *
 * THE FIX, per the operator's own direction: collect broadly, categorize LATER, as a separate step.
 *   1. `conveyor` / `drain` / `dispatched_agents` are UNCHANGED — those are this system's OWN processes and
 *      were never the problem; see {@link isConveyorCommand}/{@link isDrainCommand}/
 *      {@link isDispatchedAgentCommand} below, identical to the original file.
 *   2. Everything else (previously silently flattened into `vscode`/`chrome`/`other`) is now kept as
 *      INDIVIDUAL per-process rows — `{pid, command, cpuPct, memBytes}` — real identity, not a bucket label.
 *      See {@link buildProcessSnapshot}.
 *   3. Those individual rows are stored (via {@link processSnapshotMetrics}, called once per tick from
 *      `runner.mjs#emitTickMetrics` exactly like before) ONLY when they clear {@link DEFAULT_PROCESS_CPU_PCT}/
 *      {@link DEFAULT_PROCESS_MEM_BYTES} — see that constant's own docblock for the real-data sizing math
 *      behind why this floor exists and where the number came from. Below it, they are summed into one
 *      `belowFloor` remainder — never dropped, never silently absorbed the way `other` used to be.
 *   4. WHO GETS "THEIR OWN NAMED ENTRY" IN A REPORT is a SEPARATE, later question, answered by
 *      `telemetry.mjs#summarizeHostProcesses` reading the stored rows back — not decided here. This file's job
 *      ends at "collect real per-process detail, cheaply, and don't throw most of it away before it's even
 *      written." Splitting it this way is what lets the reporting bar be revisited (a query-time
 *      `cpuThresholdPct`/`memThresholdBytes` argument) without needing a second collection pass or a schema
 *      migration — see that function's own docblock for why it is capped at what THIS file already stored
 *      rather than free to go arbitrarily fine-grained.
 *
 * MATCHING IS ON THE FULL COMMAND LINE (`ps ... command=`), not the short `comm` name — `comm` truncates to
 * the executable's own basename with no arguments, which cannot distinguish the operator's own interactive
 * `claude` session from a dispatched one, nor "any process under `skills-src/conveyor/`" from an unrelated
 * `node` invocation. Every pattern below was checked against a REAL `ps -Awwo pid=,pcpu=,rss=,command=` capture
 * on this machine (Darwin) while several of the three fixed categories were genuinely running side by side —
 * see the accompanying test's fixtures, which are that real capture, trimmed.
 *
 * PURE except {@link readProcessSample}, the one IO edge — mirrors `runner.mjs#readHostSample`'s own shape and
 * its own stated reason: keeping the categorization logic (the part with real decisions in it) testable
 * against a plain string, with zero real `ps` calls needed to exercise it.
 */

import { execFileSync } from 'node:child_process';

import { redactCommandLine } from './command-redact.mjs';

/** The THREE project-specific categories that stay fixed at collection time, unchanged from the original
 *  design — these are THIS SYSTEM's own processes, always worth a named total regardless of how big or small
 *  any one tick's sample is. Mirrors `telemetry.mjs#METRIC_NAMES`'s own `host.process.<category>.*` list for
 *  these three; the two must never drift apart, and `telemetry.test.mjs` asserts they do not.
 *  `vscode`/`chrome`/`other` are GONE from this list on purpose — see the module docblock's "what changed". */
export const FIXED_PROCESS_CATEGORIES = Object.freeze(['conveyor', 'drain', 'dispatched_agents']);

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
 *
 * UNCHANGED from the original file — this parse was never the problem; every process was always captured
 * here. It is the step AFTER this one that used to throw identity away.
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

// ── FIXED-CATEGORY MATCHERS — unchanged from the original file; checked in this order, first match wins ──

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

/**
 * PURE. Categorize ONE command line into one of {@link FIXED_PROCESS_CATEGORIES}, or `null` when it matches
 * none of the three — `null` means "this process keeps its own identity downstream" (see
 * {@link buildProcessSnapshot}), never "discard it". Checked in a fixed priority order (`conveyor` and `drain`
 * first, since both are THIS system's own processes; `dispatched_agents` last of the three, since nothing in
 * this system's own dispatch shape could ever also match the other two).
 * @param {*} command
 * @returns {string|null} one of {@link FIXED_PROCESS_CATEGORIES}, or `null`
 */
export function categorizeProcess(command) {
  const s = String(command ?? '');
  if (isConveyorCommand(s)) return 'conveyor';
  if (isDrainCommand(s)) return 'drain';
  if (isDispatchedAgentCommand(s)) return 'dispatched_agents';
  return null;
}

/**
 * THE STORAGE FLOOR — below this, on BOTH axes, a process is folded into `belowFloor` rather than recorded as
 * its own row. Deliberately set EQUAL to `telemetry.mjs`'s own default "substantial" reporting bar
 * (`DEFAULT_SUBSTANTIAL_CPU_PCT`/`DEFAULT_SUBSTANTIAL_MEM_BYTES`), not lower — this is the sizing tradeoff
 * from #3383's storage-bloat finding, and the number is not a guess:
 *
 * A REAL capture on this host (954 live processes, 2026-09-14) was tested against three candidate floors:
 *   • 0.5% CPU / 20MB  → 302 processes/tick →  ~259 KB/tick → ~182 MB/DAY at the runner's 120s cadence.
 *   • 1.0% CPU / 100MB → 68 processes/tick  →   ~66 KB/tick →  ~46 MB/day.
 *   • 2.0% CPU / 200MB → 40 processes/tick  →   ~37 KB/tick →  ~26 MB/day.
 * A typical day of the EXISTING telemetry file (every span + every other metric combined, this feature not yet
 * added) runs 0.3–3.7MB — the file `#3383`'s own test-pollution bug had already caused to balloon once
 * tonight, which is exactly the failure mode a low floor here would reproduce by a different mechanism. A
 * separate, materially LOWER "worth recording" tier was considered (per-process, decoupled from the reporting
 * bar) and rejected on this evidence: the extra ~260 processes it would add over the 200MB/2% tier are
 * overwhelmingly small system/helper daemons sitting at 20–150MB from having a framework loaded, not
 * "large real users" the way the original `other` bucket's missing 888 processes were — i.e. the marginal
 * processes a lower floor buys are exactly the ones this feature does NOT need to individually name. Even the
 * chosen 2%/200MB tier is a real, ~7–25x increase in this feature's own daily footprint (this file's rows
 * only) versus what the six fixed-bucket version wrote — accepted because it is the minimum needed to actually
 * answer "what is `other`", and because the operator's own suggested bar (">2% CPU or >200MB") independently
 * landed on the same number.
 *
 * THE CONSEQUENCE OF COLLAPSING THE TWO TIERS INTO ONE, STATED PLAINLY: `telemetry.mjs#summarizeHostProcesses`
 * can raise its OWN reporting bar above this floor at query time with no new storage (e.g. "only show me what
 * cleared 5%") — every row it would need is already on disk. It CANNOT lower the bar below this floor —
 * detail for a process that never cleared 2%/200MB on the tick it was sampled was never written, by design,
 * and is recoverable only by raising this collection-time floor (a deliberate, re-evaluatable tradeoff, not an
 * oversight) and re-sampling from then on.
 */
export const DEFAULT_PROCESS_CPU_PCT = 2;
/** @see DEFAULT_PROCESS_CPU_PCT — 200MB, in bytes. */
export const DEFAULT_PROCESS_MEM_BYTES = 200 * 1024 * 1024;

/**
 * PURE. The collection-time split: bucket a parsed `ps` row list into (a) the three FIXED-category aggregate
 * totals, unchanged in shape from the original file's `summarizeProcessSample`, (b) an array of INDIVIDUAL
 * per-process rows for everything else that clears the storage floor — real `{pid, command, cpuPct, memBytes}`
 * identity, not a category label — and (c) one `belowFloor` aggregate for everything else that does not.
 *
 * THE HONESTY INVARIANT, carried over from the original file's `other` bucket and now spread across THREE
 * places instead of one: `categories` (3) + `processes` (however many cleared the floor) + `belowFloor` must
 * always account for the WHOLE sample — see the accompanying test. This is what makes the six-figure — now
 * N-figure — breakdown auditable against the whole-machine `host.cpu.load1`/`host.mem.free_bytes` samples
 * recorded alongside it, exactly the property the original module docblock called out for `other`.
 * @param {Array<{pcpu?: number, rssKb?: number, command?: string, pid?: number}>} rows
 * @param {{cpuFloorPct?: number, memFloorBytes?: number}} [opts] injectable for tests; production always uses
 *   the defaults (kept equal to `telemetry.mjs`'s reporting bar — see {@link DEFAULT_PROCESS_CPU_PCT}).
 * @returns {{categories: Record<string, {cpuPct: number, memBytes: number, count: number}>,
 *   processes: Array<{pid: number|null, command: string, cpuPct: number, memBytes: number}>,
 *   belowFloor: {cpuPct: number, memBytes: number, count: number}}}
 */
export function buildProcessSnapshot(rows, { cpuFloorPct = DEFAULT_PROCESS_CPU_PCT, memFloorBytes = DEFAULT_PROCESS_MEM_BYTES } = {}) {
  const categories = {};
  for (const cat of FIXED_PROCESS_CATEGORIES) categories[cat] = { cpuPct: 0, memBytes: 0, count: 0 };
  const processes = [];
  const belowFloor = { cpuPct: 0, memBytes: 0, count: 0 };

  for (const r of Array.isArray(rows) ? rows : []) {
    if (!r || typeof r !== 'object') continue;
    const cpuPct = Number.isFinite(r.pcpu) ? r.pcpu : 0;
    const memBytes = Number.isFinite(r.rssKb) ? r.rssKb * 1024 : 0;
    const fixed = categorizeProcess(r.command);
    if (fixed) {
      const b = categories[fixed];
      b.cpuPct += cpuPct;
      b.memBytes += memBytes;
      b.count += 1;
      continue;
    }
    if (cpuPct > cpuFloorPct || memBytes > memFloorBytes) {
      processes.push({ pid: Number.isFinite(r.pid) ? r.pid : null, command: String(r.command ?? ''), cpuPct, memBytes });
    } else {
      belowFloor.cpuPct += cpuPct;
      belowFloor.memBytes += memBytes;
      belowFloor.count += 1;
    }
  }
  return { categories, processes, belowFloor };
}

/** Max characters of a `command` kept in a metric's `attributes` — matches `telemetry.mjs#MAX_VALUE_LENGTH`
 *  (500) with headroom for the recorder's own truncation marker; kept here too so a caller inspecting
 *  {@link processSnapshotMetrics}'s OWN output (before it ever reaches the recorder) sees the same bound. */
const MAX_COMMAND_LENGTH = 480;

/**
 * PURE. Shape {@link buildProcessSnapshot}'s output into the metric-sample array
 * `skills-src/conveyor/runner.mjs#emitTickMetrics` records:
 *   • the 3 fixed categories → 2 metrics each (`cpu_pct`/`mem_bytes`), IDENTICAL shape and names to the
 *     original file — `host.process.<category>.cpu_pct`/`.mem_bytes`.
 *   • each individual process row → 2 metrics under the SAME low-cardinality name for every process,
 *     `host.process.entry.cpu_pct`/`.mem_bytes` — never a per-PID or per-command metric NAME, which would
 *     blow up `METRIC_NAMES`'s closed vocabulary; the real identity (`pid`, `command`) travels in
 *     `attributes` instead, the same "low-cardinality name, high-cardinality detail in attributes" rule
 *     `telemetry.mjs`'s own header already establishes for `dispatch.tokens.*`. The `command` attribute is
 *     passed through `command-redact.mjs#redactCommandLine` before it is built (credential-shaped argv values
 *     masked, control characters replaced) and only THEN truncated — argv is where secrets live, and this
 *     file is durable.
 *   • the `belowFloor` remainder → 2 metrics, `host.process.below_floor_remainder.cpu_pct`/`.mem_bytes` —
 *     clearly labeled as a remainder (unlike the old `other`, which read as a category), carrying
 *     `processCount` so a reader can see how many small processes it represents.
 * @param {ReturnType<typeof buildProcessSnapshot>} snapshot
 * @returns {Array<{name: string, value: number, unit: string, attributes: object}>}
 */
export function processSnapshotMetrics(snapshot) {
  const s = snapshot || {};
  const categories = s.categories || {};
  const out = [];
  for (const cat of FIXED_PROCESS_CATEGORIES) {
    const c = categories[cat] || { cpuPct: 0, memBytes: 0, count: 0 };
    out.push({ name: `host.process.${cat}.cpu_pct`, value: c.cpuPct, unit: 'percent', attributes: { processCount: c.count } });
    out.push({ name: `host.process.${cat}.mem_bytes`, value: c.memBytes, unit: 'bytes', attributes: { processCount: c.count } });
  }
  for (const p of Array.isArray(s.processes) ? s.processes : []) {
    if (!p || typeof p !== 'object') continue;
    // REDACT FIRST, THEN TRUNCATE — a secret straddling the length cut would otherwise be left half-visible.
    // The full argv is durable (the NDJSON is retained across days and shared across lane clones), so
    // credential-shaped values and control characters never reach disk — see `command-redact.mjs`.
    const command = redactCommandLine(p.command).slice(0, MAX_COMMAND_LENGTH);
    const attrs = { pid: Number.isFinite(p.pid) ? p.pid : null, command };
    out.push({ name: 'host.process.entry.cpu_pct', value: Number.isFinite(p.cpuPct) ? p.cpuPct : 0, unit: 'percent', attributes: attrs });
    out.push({ name: 'host.process.entry.mem_bytes', value: Number.isFinite(p.memBytes) ? p.memBytes : 0, unit: 'bytes', attributes: attrs });
  }
  const bf = s.belowFloor || { cpuPct: 0, memBytes: 0, count: 0 };
  out.push({ name: 'host.process.below_floor_remainder.cpu_pct', value: bf.cpuPct, unit: 'percent', attributes: { processCount: bf.count } });
  out.push({ name: 'host.process.below_floor_remainder.mem_bytes', value: bf.memBytes, unit: 'bytes', attributes: { processCount: bf.count } });
  return out;
}

/** Upper bound on one `ps` call — see {@link readProcessSample}. A healthy call takes well under a second. */
export const PS_TIMEOUT_MS = 10_000;

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
 * cost that a per-dispatch or per-span sampling point cannot absorb the way a 120s cadence can. Enumerating
 * EVERY process (this machine: ~950 rows, a real capture used to size {@link DEFAULT_PROCESS_CPU_PCT}) is the
 * cheap part — one `ps` call regardless of row count; the storage floor in {@link buildProcessSnapshot} exists
 * to bound what gets WRITTEN, not what `ps` itself returns.
 *
 * BOUNDED IN TIME, NOT JUST IN FAILURE (PR #2636 CI-heal) — `execFileSync` blocks its thread until the child
 * exits, and nothing above it (the runner tick, a vitest per-test timeout) can interrupt a synchronous call.
 * A `ps` that never returns would wedge its caller for good, so the call carries {@link PS_TIMEOUT_MS}: a
 * timed-out `ps` is killed and degrades to the same empty sample as any other `ps` failure.
 * @param {{exec?: Function}} [io] - injectable for tests; defaults to a real `execFileSync`.
 * @returns {Array<{pid: number, pcpu: number, rssKb: number, command: string}>}
 */
export function readProcessSample({ exec = execFileSync } = {}) {
  try {
    const out = exec('ps', ['-Awwo', 'pid=,pcpu=,rss=,command='], {
      encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'],
      timeout: PS_TIMEOUT_MS, killSignal: 'SIGKILL',
    });
    return parsePsOutput(out);
  } catch {
    return [];
  }
}
