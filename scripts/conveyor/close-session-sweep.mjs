#!/usr/bin/env node
/**
 * close-session-sweep.mjs — the deterministic first half of the `/closing-session` learnings sweep (#2614).
 *
 * WHAT THE CLOSE DELEGATES HERE (script-decidable, per we:docs/agent/platform-decisions.md
 * #deterministic-core-thin-judgment): read this session's delivery-agent drop-box (learnings-drop.mjs) →
 * re-validate every entry through the SAME scrub-gate the append used (defence in depth) → dedup/cluster the
 * survivors (learnings-dedup.mjs) → emit a deduped, ranked candidate list. The close then feeds those
 * survivors into its EXISTING memory-improvement intake (§1 candidate drafting → memory-worthiness gate →
 * §1a red-team → lane → PR). It does NOT build a parallel pipeline: capture is distributed (agents drop),
 * curation is centralized (one close sweeps, dedups, red-teams).
 *
 * Each emitted candidate is a memory-candidate DRAFT shape the close's §1 already understands:
 *   { kind, area, summary, suggestion, count, summaries }
 * `count` (how many agents hit it) rides through as a ranking/priority signal for the red-team pass.
 *
 * An ABSENT or EMPTY drop-box is the common, correct case → `{ candidates: [], stats: { entries: 0, … } }`
 * and exit 0, so the close no-ops cleanly (nothing to sweep is not a failure).
 *
 * Usage:
 *   node scripts/conveyor/close-session-sweep.mjs [--session=<slug>] [--file=<path>] [--threshold=0.6] [--json]
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolveDropboxPath, validateEntry } from './learnings-drop.mjs';
import { dedup, parseJsonl, DEFAULT_THRESHOLD } from './learnings-dedup.mjs';

/**
 * sweep(rawEntries, { threshold }) → { candidates, stats }. Pure.
 * Re-scrubs each entry (drops any that fail the gate — belt-and-braces on the write-seam) then dedups.
 * `stats.rejected` counts entries that failed re-validation (they never reach the red-team).
 */
export function sweep(rawEntries, { threshold = DEFAULT_THRESHOLD } = {}) {
  const clean = [];
  const rejected = [];
  for (const e of rawEntries) {
    const { ok, clean: c } = validateEntry(e);
    if (ok) clean.push(c);
    else rejected.push(e);
  }
  const { clusters, stats } = dedup(clean, { threshold });
  const candidates = clusters.map((c) => ({
    kind: c.kind,
    area: c.area,
    summary: c.summary,
    suggestion: c.suggestion,
    count: c.count,
    summaries: c.summaries,
    // Carry the DISTINCT member suggestions through (review fix 8): a chained-in member's own suggestion
    // must still reach the red-team, not be dropped when only the representative's is kept.
    suggestions: c.suggestions,
  }));
  return {
    candidates,
    stats: { received: rawEntries.length, valid: clean.length, rejected: rejected.length, ...stats },
  };
}

/** sweepFile(path, opts) → sweep() over a drop-box file; empty result if the file is absent. */
export function sweepFile(path, opts = {}) {
  if (!path || !existsSync(path)) return { candidates: [], stats: { received: 0, valid: 0, rejected: 0, entries: 0, clusters: 0, collapsed: 0 }, path: path || null };
  const entries = parseJsonl(readFileSync(path, 'utf8'));
  return { ...sweep(entries, opts), path };
}

// ── thin CLI ──────────────────────────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const flags = {};
  for (const a of argv) {
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq === -1) flags[a.slice(2)] = true;
    else flags[a.slice(2, eq)] = a.slice(eq + 1);
  }
  return flags;
}

function main(argv) {
  const f = parseArgs(argv);
  const threshold = f.threshold != null ? Number(f.threshold) : DEFAULT_THRESHOLD;
  const path = resolveDropboxPath({ file: f.file, session: f.session });
  let result;
  try {
    result = sweepFile(path, { threshold });
  } catch (e) {
    console.error(`close-session-sweep: cannot sweep ${path} (${e.message})`);
    process.exit(2);
  }
  if (f.json) {
    console.log(JSON.stringify(result, null, 2));
  } else if (result.stats.received === 0) {
    console.log(`no learnings drop-box to sweep (${path}) — nothing to do.`);
  } else {
    const s = result.stats;
    console.log(`swept ${path}: ${s.received} entries (${s.rejected} rejected) → ${result.candidates.length} ranked candidate(s).`);
    for (const c of result.candidates) {
      console.log(`  [${c.kind}] ×${c.count}  ${c.area}\n     ${c.summary}\n     → ${c.suggestion}`);
    }
  }
  process.exit(0);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2));
}
