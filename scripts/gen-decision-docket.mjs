#!/usr/bin/env node
/**
 * @file gen-decision-docket.mjs — regenerate the Decision Docket from a clean JSON data model, deterministically.
 *
 * WHAT THIS FIXES (see scripts/lib/decision-docket-data.mjs's header for the full "why"): the published
 * Decision Docket artifact has been hand-edited HTML each refresh, and hand edits accumulate meta-commentary
 * about the refresh itself ("Correction — 13 September", "second pass", "false alarm") baked directly into
 * the page's content — because there was never a real data model standing between "read the backlog" and
 * "write the HTML". This script is that missing middle: it pulls a clean JSON record per decision item, then
 * renders the page from that JSON through a FIXED function (`renderDocketHtml`, decision-docket-render.mjs).
 * Given the same backlog state, it always produces the same page — there is no path from here to hand-adding
 * a narrative paragraph about a prior mistake into the artifact; that kind of note belongs in `git log` on
 * `<out-data>` (a real, diff-able audit trail), never inline prose in the rendered output.
 *
 * SCOPE — read this before assuming it closes backlog/3562: it does NOT. backlog/3562 is a standing
 * MECHANICAL PASS wired into the conveyor's own tick loop (scripts/conveyor/*-watch.mjs shape) that (a) ranks
 * the top-N leverage decisions, (b) auto-DISPATCHES `/prepare` lane agents for the un-prepared ones via
 * scripts/conveyor/tick-core.mjs's existing planPrepareSpawns/retirePrepareGuards, and (c) calls backlog/3277's
 * still-UNBUILT publish/refresh operation on every tick. This script does none of (a)/(b)/(c) — it has no
 * conveyor wiring, no dispatch, no watch loop, and no dependency on #3277. It is the narrower, immediately
 * buildable piece both #3562 and #3277 will still need once built: a real data extraction step + a pure
 * renderer, so that ANY caller — a hand session running this today, or #3562's mechanical pass once it lands
 * and #3277 exists to call — produces the exact same clean page from the exact same data. Building #3562's
 * full mechanical pass here would also be premature: it is `blockedBy: ["3277"]` for its publish half, and
 * unstarted (no branch/PR exists for it as of this write).
 *
 * USAGE
 *   node scripts/gen-decision-docket.mjs data   [--ref=<git-ref>] [--allow-stale] [--limit=N] [--out=reports/decision-docket-data.json]
 *   node scripts/gen-decision-docket.mjs render [--data=reports/decision-docket-data.json] [--out=reports/decision-docket.html]
 *   node scripts/gen-decision-docket.mjs all    [--ref=<git-ref>] [--allow-stale] [--limit=N]   # both steps, default paths
 *
 * `--allow-stale` bypasses check-readiness.mjs's own diverged-local-main guard — safe to pass whenever `--ref`
 * already points at real, current state (e.g. `--ref=origin/main`), since the ranking read and the file read
 * are two separate steps and `--ref` alone controls the latter.
 *
 * `--ref` reads backlog files via `git show <ref>:<path>` instead of the working tree — use this when the
 * current checkout isn't a fresh `main` (e.g. `--ref=origin/main`), so the docket reflects real landed state
 * rather than whatever this checkout happens to have on disk.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildDecisionRecord } from './lib/decision-docket-data.mjs';
import { renderDocketHtml } from './lib/decision-docket-render.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_DATA_PATH = join(ROOT, 'reports/decision-docket-data.json');
const DEFAULT_HTML_PATH = join(ROOT, 'reports/decision-docket.html');
const TEMPLATE_PATH = join(ROOT, 'skills-src/decision-docket/template.html');

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

/** Read one backlog file's raw text, either off the working tree or a specific git ref (read-only either way). */
function readBacklogFile(id, ref) {
  const relPath = `backlog/${id}.md`;
  try {
    if (ref) return execFileSync('git', ['show', `${ref}:${relPath}`], { cwd: ROOT, encoding: 'utf8' });
    return readFileSync(join(ROOT, relPath), 'utf8');
  } catch {
    return null;
  }
}

/**
 * Run `check:readiness --select --json` and return its parsed `selection.tierB` array. check-readiness.mjs's
 * own docs warn never to PIPE `--json` through a pager (head/tail truncate the payload, not just the view, so
 * it stops parsing entirely) — capturing the full stdout buffer straight into this process is the safe
 * alternative that warning itself recommends (redirect-to-a-file-then-read is the shell-side equivalent of
 * what `execFileSync` does here in-process).
 */
function loadTierBRanking({ allowStale } = {}) {
  const args = ['scripts/check-readiness.mjs', '--select', '--json'];
  // check-readiness.mjs refuses to rank against a checkout whose local `main` has diverged from
  // origin/main (own local commits ahead, or behind) rather than silently ranking against stale state. This
  // repo is a busy shared checkout — a caller who already knows its own `--ref` points at real, current state
  // (e.g. `--ref=origin/main` itself) can pass `--allow-stale` to bypass that guard; it never changes what
  // gets READ (still `--ref`), only whether the RANKING step tolerates a diverged local `main`.
  if (allowStale) args.push('--allow-stale');
  const out = execFileSync('node', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const json = JSON.parse(out);
  return json.selection?.tierB ?? [];
}

function buildData({ ref, limit, allowStale } = {}) {
  const tierB = loadTierBRanking({ allowStale });
  const ranked = [...tierB].sort((a, b) => (b.leverageScore ?? 0) - (a.leverageScore ?? 0));
  const limited = limit ? ranked.slice(0, limit) : ranked;
  const now = new Date();
  const items = limited.map((entry) => buildDecisionRecord(entry, readBacklogFile(entry.id, ref), now));
  return {
    generatedAt: now.toISOString(),
    generatedFromRef: ref || null,
    targetCount: limit ?? null,
    items,
  };
}

function cmdData(flags) {
  const data = buildData({ ref: flags.ref, limit: flags.limit ? Number.parseInt(flags.limit, 10) : null, allowStale: !!flags['allow-stale'] });
  const outPath = flags.out ? resolve(ROOT, flags.out) : DEFAULT_DATA_PATH;
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(data, null, 2)}\n`);
  const preparedCount = data.items.filter((i) => i.prepared).length;
  const parseIssues = data.items.filter((i) => i.prepared && !i.parseOk).length;
  process.stdout.write(`wrote ${data.items.length} decision record(s) (${preparedCount} prepared, ${parseIssues} with parse warnings) to ${outPath}\n`);
  return outPath;
}

function cmdRender(flags) {
  const dataPath = flags.data ? resolve(ROOT, flags.data) : DEFAULT_DATA_PATH;
  const outPath = flags.out ? resolve(ROOT, flags.out) : DEFAULT_HTML_PATH;
  const data = JSON.parse(readFileSync(dataPath, 'utf8'));
  const templateHtml = readFileSync(TEMPLATE_PATH, 'utf8');
  const html = renderDocketHtml(data, templateHtml);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, html);
  process.stdout.write(`rendered ${data.items.length} decision record(s) to ${outPath}\n`);
  return outPath;
}

function main(argv) {
  const sub = argv[0];
  const flags = parseFlags(argv.slice(1));
  if (sub === 'data') { cmdData(flags); return; }
  if (sub === 'render') { cmdRender(flags); return; }
  if (sub === 'all') { cmdData(flags); cmdRender(flags); return; }
  process.stderr.write('usage: gen-decision-docket.mjs <data|render|all> [--ref=<git-ref>] [--allow-stale] [--limit=N] [--data=<path>] [--out=<path>]\n');
  process.exitCode = 2;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main(process.argv.slice(2));
}

export { buildData, readBacklogFile };
