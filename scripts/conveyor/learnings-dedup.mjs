#!/usr/bin/env node
/**
 * learnings-dedup.mjs — cluster near-duplicate learnings drop-box entries into a deduped, ranked list
 * (#2614, under conveyor #2612).
 *
 * WHY: many delivery agents hit the SAME friction in one session, so the raw drop-box (learnings-drop.mjs)
 * is full of near-duplicates. The `/closing-session` sweep must not feed N restatements of one lesson into
 * the memory red-team — it feeds ONE representative per cluster, ranked by how many agents hit it (frequency
 * = signal strength). Clustering is script-decidable, so per we:docs/agent/platform-decisions.md
 * #deterministic-core-thin-judgment it is a pure, tested core the sweep + any UI SHELL — never re-derived.
 *
 * ALGORITHM (pure): entries cluster when they share the same `kind` AND a normalized `area`, AND their
 * `summary` token-sets are similar (Jaccard ≥ threshold). Single-link agglomeration: an entry joins the
 * first existing cluster it matches, else opens a new one. Each cluster emits { kind, area, summary,
 * suggestion } from its representative (the longest/most-specific summary) plus `count` and the member
 * `summaries`. Output is ranked by count desc, then first-seen order (stable).
 *
 * Usage (CLI):
 *   node scripts/conveyor/learnings-dedup.mjs <drop-box.jsonl> [--threshold=0.6] [--json]
 *   cat drop-box.jsonl | node scripts/conveyor/learnings-dedup.mjs --stdin [--json]
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const DEFAULT_THRESHOLD = 0.6;

const STOP = new Set(['the', 'a', 'an', 'to', 'of', 'in', 'on', 'for', 'and', 'or', 'is', 'are', 'be',
  'it', 'this', 'that', 'with', 'as', 'at', 'by', 'from', 'we', 'our', 'not', 'no', 'but', 'so', 'even']);

/** normArea(s) → a coarse comparison key: lowercased, punctuation→space, stop-words dropped, sorted tokens. */
export function normArea(s) {
  return tokens(s).sort().join(' ');
}

/** tokens(s) → normalized, stop-word-free word list (for Jaccard). Pure. */
export function tokens(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t && t.length > 1 && !STOP.has(t));
}

/** jaccard(aTokens, bTokens) → |∩| / |∪| over the two token SETS. 1 = identical set, 0 = disjoint. */
export function jaccard(aTokens, bTokens) {
  const A = new Set(aTokens);
  const B = new Set(bTokens);
  if (A.size === 0 && B.size === 0) return 1;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

/** Two entries are near-duplicates: same kind, same normalized area, and similar summary. Pure. */
export function isNearDup(a, b, threshold = DEFAULT_THRESHOLD) {
  if (a.kind !== b.kind) return false;
  if (normArea(a.area) !== normArea(b.area)) return false;
  return jaccard(tokens(a.summary), tokens(b.summary)) >= threshold;
}

/**
 * dedup(entries, { threshold }) → { clusters, stats }.
 * Pure clustering core. `clusters` is ranked (count desc, then first-seen). Each cluster:
 *   { kind, area, summary, suggestion, count, summaries: string[], suggestions: string[] }
 * The representative is the member with the LONGEST summary (most specific), area/suggestion taken from it.
 */
export function dedup(entries, { threshold = DEFAULT_THRESHOLD } = {}) {
  const clusters = [];
  let order = 0;
  for (const e of entries) {
    // Single-link: join the FIRST cluster this entry near-duplicates (compare against each member).
    let target = null;
    for (const c of clusters) {
      if (c.members.some((m) => isNearDup(m, e, threshold))) { target = c; break; }
    }
    if (target) {
      target.members.push(e);
    } else {
      clusters.push({ members: [e], first: order++ });
    }
  }
  const shaped = clusters.map((c) => {
    // Representative = longest summary (ties → first seen).
    const rep = c.members.reduce((best, m) =>
      (String(m.summary).length > String(best.summary).length ? m : best), c.members[0]);
    return {
      kind: rep.kind,
      area: rep.area,
      summary: rep.summary,
      suggestion: rep.suggestion,
      count: c.members.length,
      summaries: c.members.map((m) => m.summary),
      suggestions: [...new Set(c.members.map((m) => m.suggestion))],
      _first: c.first,
    };
  });
  shaped.sort((a, b) => (b.count - a.count) || (a._first - b._first));
  const clustersOut = shaped.map(({ _first, ...rest }) => rest);
  return {
    clusters: clustersOut,
    stats: { entries: entries.length, clusters: clustersOut.length, collapsed: entries.length - clustersOut.length },
  };
}

/** parseJsonl(text) → array of parsed objects, skipping blank/comment lines. Bad lines throw. */
export function parseJsonl(text) {
  const out = [];
  for (const line of String(text).split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    out.push(JSON.parse(t));
  }
  return out;
}

// ── thin CLI ──────────────────────────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const flags = {};
  const pos = [];
  for (const a of argv) {
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq === -1) flags[a.slice(2)] = true;
      else flags[a.slice(2, eq)] = a.slice(eq + 1);
    } else pos.push(a);
  }
  return { flags, pos };
}

function main(argv) {
  const { flags, pos } = parseArgs(argv);
  const threshold = flags.threshold != null ? Number(flags.threshold) : DEFAULT_THRESHOLD;
  let text;
  try {
    text = flags.stdin || pos.length === 0 ? readFileSync(0, 'utf8') : readFileSync(pos[0], 'utf8');
  } catch (e) {
    console.error(`learnings-dedup: cannot read input (${e.message})`);
    process.exit(2);
  }
  let entries;
  try { entries = parseJsonl(text); } catch (e) {
    console.error(`learnings-dedup: malformed JSONL (${e.message})`);
    process.exit(2);
  }
  const result = dedup(entries, { threshold });
  if (flags.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`${result.stats.entries} entries → ${result.stats.clusters} clusters (${result.stats.collapsed} collapsed)`);
    for (const c of result.clusters) {
      console.log(`  [${c.kind}] ×${c.count}  ${c.area}\n     ${c.summary}\n     → ${c.suggestion}`);
    }
  }
  process.exit(0);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2));
}
