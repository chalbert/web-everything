#!/usr/bin/env node
/**
 * gen-dogfooding-progress.mjs — derive first-party dogfooding progress from the backlog.
 *
 * The dogfooding effort (rebuild each constellation layer's UI on FUI components, per
 * docs/agent/platform-decisions.md#first-party-dogfood) is tracked as three epics and their
 * child slices. This script reads the SINGLE canonical backlog loader (src/_data/backlog.js —
 * the same source /backlog/ and check:readiness use) and reduces each epic's child edges to a
 * progress summary: adoption %, per-surface state, gated slices, and last-moved date.
 *
 * It is DERIVED data — deterministic in (the backlog), deterministic out — so it is generated
 * live, never hand-maintained. plateau-app's admin dashboard (#1520) exec's this with `--json`
 * at request time, so the dashboard is always current with the backlog (no snapshot to go stale).
 *
 *   node scripts/gen-dogfooding-progress.mjs --json   # print the progress JSON to stdout
 *   node scripts/gen-dogfooding-progress.mjs          # pretty human summary
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const loadBacklog = require(join(ROOT, 'src/_data/backlog.js')); // the SINGLE loader (#248/#249)

// The dogfooding epics, one per constellation layer. Add a layer here and the dashboard grows a
// section — the only place the layer↔epic mapping lives.
const LAYERS = [
  { layer: 'WE-docs', epic: '777', blurb: 'WE docs site chrome rendered from FUI components' },
  { layer: 'plateau-app', epic: '1254', blurb: "plateau-app's product UI rebuilt on FUI components" },
  { layer: 'Deck', epic: '1210', blurb: 'WE pitch decks rendered on FUI deck components' },
];

/** Map a child item's status (+ open blockers) to a coarse surface state. */
function surfaceState(item) {
  if (!item) return 'todo';
  if (item.status === 'resolved') return 'done';
  if (item.status === 'active') return 'in-progress';
  if (item.status === 'parked') return 'parked';
  if (item.status === 'open' && (item.openBlockers?.length || 0) > 0) return 'gated';
  return 'todo'; // open, unblocked
}

/** Build the progress summary for every dogfooding layer. Pure function of the backlog. */
export function deriveDogfoodingProgress() {
  const items = typeof loadBacklog === 'function' ? loadBacklog() : loadBacklog;
  const byNum = new Map(items.map((i) => [String(i.num), i]));

  const layers = LAYERS.map(({ layer, epic, blurb }) => {
    const epicItem = byNum.get(String(epic));
    const childRefs = epicItem?.children ?? [];

    const surfaces = childRefs.map((ref) => {
      const full = byNum.get(String(ref.num)) || ref;
      return {
        num: ref.num,
        slug: ref.slug,
        title: ref.title,
        kind: ref.kind,
        state: surfaceState(full),
        gatedOn: full.openBlockers ?? [],
        dateResolved: full.dateResolved ?? null,
      };
    });

    const total = surfaces.length;
    const done = surfaces.filter((s) => s.state === 'done').length;
    const gaps = [...new Set(surfaces.flatMap((s) => s.gatedOn))].sort();
    const lastMoved = [epicItem?.dateResolved, ...surfaces.map((s) => s.dateResolved)]
      .filter(Boolean)
      .sort()
      .pop() ?? null;

    return {
      layer,
      epic,
      epicTitle: epicItem?.title ?? `#${epic} (missing)`,
      epicStatus: epicItem?.status ?? 'missing',
      blurb,
      total,
      done,
      pct: total ? Math.round((done / total) * 100) : 0,
      openGaps: gaps,
      lastMoved,
      surfaces,
    };
  });

  return { generatedAt: new Date().toISOString(), layers };
}

// ── CLI ───────────────────────────────────────────────────────────────────────
function main() {
  const data = deriveDogfoodingProgress();
  if (process.argv.includes('--json')) {
    process.stdout.write(JSON.stringify(data, null, 2) + '\n');
    return;
  }
  for (const l of data.layers) {
    console.log(`\n${l.layer} — ${l.done}/${l.total} (${l.pct}%)  [epic #${l.epic} ${l.epicStatus}]`);
    for (const s of l.surfaces) {
      const tag = { done: '✓', 'in-progress': '▶', gated: '⛔', parked: '⏸', todo: '·' }[s.state] || '·';
      const gate = s.gatedOn.length ? `  ← blocked on ${s.gatedOn.map((n) => '#' + n).join(', ')}` : '';
      console.log(`  ${tag} #${s.num} ${s.title}${gate}`);
    }
    if (l.lastMoved) console.log(`  last moved: ${l.lastMoved}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
