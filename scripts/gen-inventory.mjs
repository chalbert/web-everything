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
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

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
  const blocks = arr(readJson('blocks'));
  const plugs = arr(readJson('plugs'));
  const intents = arr(readJson('intents'));
  const semantics = arr(readJson('semantics'));
  const research = arr(readJson('researchTopics'));
  const projects = arr(readJson('projects'));
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

// ── Run as a script: write AGENTS.md ──────────────────────────────────────────
if (import.meta.url === `file://${process.argv[1]}`) {
  const before = readFileSync(AGENTS, 'utf8');
  const after = spliceInventory(before, renderInventory());
  if (after === before) {
    console.log('AGENTS.md inventory already up to date.');
  } else {
    writeFileSync(AGENTS, after);
    console.log('AGENTS.md inventory regenerated.');
  }
}
