#!/usr/bin/env node
/**
 * gen-inventory.mjs — regenerates the repo summary inside AGENTS.md.
 *
 * The summary is DERIVED data (counts by status), not prose, so it's generated rather than
 * hand-written: deterministic in, deterministic out. `check:standards` imports renderInventory()
 * and fails if AGENTS.md is stale — so the summary can't drift, and no agent ever freehand-edits
 * its own instructions. Keep it compact (counts only); full lists live in src/_data/*.json.
 *
 * Run: `npm run gen:inventory`  (writes AGENTS.md)
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadBlocks } from './lib/blocks-loader.cjs';
import { loadIntents } from './lib/intents-loader.cjs';
import { loadResearch } from './lib/research-loader.cjs';
import { loadSemantics } from './lib/semantics-loader.cjs';
import { loadDataRegistry } from './lib/registry-loader.cjs';

export const START = '<!-- AUTO-GENERATED:inventory — run `npm run gen:inventory`; do not edit by hand -->';
export const END = '<!-- /AUTO-GENERATED:inventory -->';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'src/_data');
const AGENTS = join(ROOT, 'AGENTS.md');

const readJson = (name) => {
  const p = join(DATA, `${name}.json`);
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : [];
};
const arr = (d) => (Array.isArray(d) ? d : []);
const byStatus = (list) => {
  const m = {};
  for (const x of list) if (x && x.status) m[x.status] = (m[x.status] || 0) + 1;
  return Object.keys(m).sort().map((k) => `${m[k]} ${k}`).join(' · ');
};

/** Render the inventory body (between markers). Pure function of the data files. */
export function renderInventory() {
  const blocks = loadBlocks(); // per-block specs src/_data/blocks/<id>.json, assembled (#882)
  const plugs = arr(loadDataRegistry('plugs')); // per-plug specs src/_data/plugs/<id>.json, assembled (#1157)
  const intents = arr(loadIntents()); // per-intent specs src/_data/intents/<id>.json, assembled (#1145)
  const semantics = arr(loadSemantics()); // per-term specs src/_data/semantics/<slug>.json, assembled (#1146)
  const research = arr(loadResearch()); // per-topic specs src/_data/researchTopics/<id>.json, assembled (#1145)
  const projects = arr(loadDataRegistry('projects')); // per-project specs src/_data/projects/<id>.json (#1157)
  const openResearch = research.filter((r) => r.status === 'open').length;
  const projectIds = projects.map((p) => p.id).filter(Boolean).sort().join(', ');

  return [
    `- **Plugs** ${plugs.length} — ${byStatus(plugs)}`,
    `- **Blocks** ${blocks.length} — ${byStatus(blocks)}`,
    `- **Intents** ${intents.length} — ${byStatus(intents)}`,
    `- **Glossary terms** ${semantics.length} · **Research topics** ${research.length} (${openResearch} open)`,
    `- **Projects** ${projects.length}: ${projectIds}`,
  ].join('\n');
}

/** Splice fresh inventory into a file's marked region. Returns the new file contents. */
export function spliceInventory(fileContents, body) {
  const block = `${START}\n${body}\n${END}`;
  if (!fileContents.includes(START) || !fileContents.includes(END))
    throw new Error(`AGENTS.md is missing the inventory markers. Add:\n${START}\n${END}`);
  return fileContents.replace(new RegExp(`${esc(START)}[\\s\\S]*?${esc(END)}`), block);
}
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Files whose staged presence can move a count `renderInventory()` reports (the six per-entry
// registries it assembles, one dir per kind — #882/#1145/#1146/#1157) or the marked block itself.
// Mirrors CORPUS_RE in lint-locus-prefix.mjs: a scoping regex kept next to the check it scopes,
// not centralised, so each write-time gate stays independently auditable.
const INVENTORY_AFFECTING_RE = /^src\/_data\/(blocks|plugs|intents|semantics|researchTopics|projects)\/[^/]+\.json$|^AGENTS\.md$/;

/** Git-staged (added/copied/modified/renamed/deleted) files, relative to repo root. */
function stagedFiles() {
  const out = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMRD'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  return out.split('\n').map((s) => s.trim()).filter(Boolean);
}

/** Regenerate AGENTS.md's inventory block from disk and write it if changed. Returns true if written. */
function regenerate() {
  const before = readFileSync(AGENTS, 'utf8');
  const after = spliceInventory(before, renderInventory());
  if (after === before) return false;
  writeFileSync(AGENTS, after);
  return true;
}

// ── Run as a script ─────────────────────────────────────────────────────────
if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv.includes('--staged')) {
    // Pre-commit write-time regen (#1404 incident — a PR added a research topic without regenerating
    // AGENTS.md, and CI didn't catch it until an already-`review:accepted` PR, costing a round-trip).
    // Scoped to when the commit actually touches inventory-affecting content, so an unrelated commit
    // never re-stages AGENTS.md (which could otherwise sweep in an unrelated unstaged edit to the file —
    // gen-inventory reads/writes the whole file, not just the staged diff). `npm run gen:inventory` (no
    // flag) stays available for a manual/full regen; this is the SAME regenerate(), just gated + re-added
    // to the index. `check:standards`'s inventory check (kind:'inventory') remains as a CI backstop for
    // any commit path that bypasses this hook (e.g. `--no-verify`).
    if (!stagedFiles().some((f) => INVENTORY_AFFECTING_RE.test(f))) {
      process.exit(0); // nothing staged could move the counts — no-op, don't touch AGENTS.md
    }
    if (regenerate()) {
      execFileSync('git', ['add', 'AGENTS.md'], { cwd: ROOT });
      console.log('AGENTS.md inventory regenerated and staged (pre-commit).');
    }
    // else: already up to date — silent, matches lint:locus's quiet-pass convention
  } else {
    if (regenerate()) {
      console.log('AGENTS.md inventory regenerated.');
    } else {
      console.log('AGENTS.md inventory already up to date.');
    }
  }
}
