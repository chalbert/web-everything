#!/usr/bin/env node
/**
 * check-standards.mjs — consistency & convention validator for Web Everything.
 *
 * Verifies the invariants that keep the spec (src/_data/*.json), the descriptions
 * (src/_includes/*-descriptions/*.njk), and the implementation in sync — so agents
 * (and humans) can't silently let documentation drift from code.
 *
 * Run: `npm run check:standards`  (exits 1 on any error; warnings don't fail)
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { renderInventory, spliceInventory } from './gen-inventory.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'src/_data');
const INC = join(ROOT, 'src/_includes');

const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

const readJson = (rel) => {
  const p = join(DATA, rel);
  if (!existsSync(p)) { err(`Missing data file: src/_data/${rel}`); return null; }
  try { return JSON.parse(readFileSync(p, 'utf8')); }
  catch (e) { err(`Invalid JSON in src/_data/${rel}: ${e.message}`); return null; }
};
const arr = (d) => (Array.isArray(d) ? d : []);

// Canonical implementation lifecycle — ONE vocabulary for blocks AND plugs (and intents,
// demos, resources, states). Ordered concept → draft → experimental → active.
// Research topics use a separate axis (open question vs answered).
const LIFECYCLE = new Set(['concept', 'draft', 'experimental', 'active']);
const RESEARCH_STATUSES = new Set(['open', 'resolved', 'draft', 'closed']);
// Deprecated synonyms → canonical. Flagged as errors so the drift can't return.
const STATUS_SYNONYMS = { implemented: 'active', stable: 'active', done: 'active', planned: 'concept', wip: 'draft' };
const BLOCK_TYPES = new Set(['Store', 'Parser', 'Behavior', 'Directive', 'Component', 'Module']);

const checkStatus = (kind, id, status) => {
  if (!status) return;
  if (STATUS_SYNONYMS[status])
    err(`${kind} "${id}" uses deprecated status "${status}" — use canonical "${STATUS_SYNONYMS[status]}"`);
  else if (!LIFECYCLE.has(status))
    err(`${kind} "${id}" has invalid status "${status}" (expected ${[...LIFECYCLE].join(' / ')})`);
};

// ── Load specs ───────────────────────────────────────────────────────────────
const blocks = arr(readJson('blocks.json'));
const plugs = arr(readJson('plugs.json'));
const semantics = arr(readJson('semantics.json'));
const research = arr(readJson('researchTopics.json'));

// ── 1. Spec ↔ description coverage ────────────────────────────────────────────
const hasDesc = (folder, id) => existsSync(join(INC, folder, `${id}.njk`));
for (const b of blocks)
  if (b.id && !hasDesc('block-descriptions', b.id))
    err(`Block "${b.id}" has no src/_includes/block-descriptions/${b.id}.njk`);
for (const p of plugs)
  if (p.id && !hasDesc('plug-descriptions', p.id))
    err(`Plug "${p.id}" has no src/_includes/plug-descriptions/${p.id}.njk`);
for (const r of research)
  if (r.id && !hasDesc('research-descriptions', r.id))
    err(`Research topic "${r.id}" has no src/_includes/research-descriptions/${r.id}.njk`);

// ── 2. Spec ↔ implementation ──────────────────────────────────────────────────
for (const b of blocks) {
  if (b.sourcePath && !existsSync(join(ROOT, b.sourcePath)))
    err(`Block "${b.id}" sourcePath does not exist: ${b.sourcePath}`);
  if (b.status === 'active' && !b.sourcePath)
    warn(`Block "${b.id}" is status:active but has no sourcePath`);
}

// ── 3. Status / type enums ────────────────────────────────────────────────────
for (const b of blocks) {
  checkStatus('Block', b.id, b.status);
  if (b.type && !BLOCK_TYPES.has(b.type)) warn(`Block "${b.id}" has unusual type "${b.type}"`);
}
for (const p of plugs) checkStatus('Plug', p.id, p.status);
for (const r of research)
  if (r.status && !RESEARCH_STATUSES.has(r.status)) warn(`Research topic "${r.id}" has unusual status "${r.status}"`);

// ── 4. Naming conventions (across all exports) ────────────────────────────────
const allExports = blocks.flatMap((b) => (Array.isArray(b.exports) ? b.exports.map((e) => [b.id, e]) : []));
for (const [id, name] of allExports) {
  if (/^use[A-Z]/.test(name))
    err(`Export "${name}" (block "${id}") uses reserved "use*" prefix — traits must be "with[Capability]"`);
  if (/Registry$/.test(name) && !/^Custom.+Registry$/.test(name))
    warn(`Export "${name}" (block "${id}") looks like a registry but isn't "Custom[Name]Registry"`);
}

// ── 5. Semantics glossary hygiene ─────────────────────────────────────────────
const seenTerms = new Map();
for (const t of semantics) {
  if (!t.term || !t.definition) { err(`semantics.json entry missing term/definition: ${JSON.stringify(t).slice(0, 80)}`); continue; }
  const key = t.term.toLowerCase();
  if (seenTerms.has(key)) err(`Duplicate glossary term "${t.term}" in semantics.json`);
  seenTerms.set(key, true);
}

// ── 6. Unique ids per registry ────────────────────────────────────────────────
const dupCheck = (list, label) => {
  const seen = new Set();
  for (const x of list) {
    if (!x.id) continue;
    if (seen.has(x.id)) err(`Duplicate id "${x.id}" in ${label}`);
    seen.add(x.id);
  }
};
dupCheck(blocks, 'blocks.json');
dupCheck(plugs, 'plugs.json');
dupCheck(research, 'researchTopics.json');

// ── 7. AGENTS.md inventory must be in sync (generated, not hand-edited) ────────
try {
  const agentsPath = join(ROOT, 'AGENTS.md');
  const current = readFileSync(agentsPath, 'utf8');
  if (spliceInventory(current, renderInventory()) !== current)
    err('AGENTS.md inventory is stale — run `npm run gen:inventory`');
} catch (e) {
  err(`AGENTS.md inventory check failed: ${e.message}`);
}

// ── Report ────────────────────────────────────────────────────────────────────
const RED = '\x1b[31m', YEL = '\x1b[33m', GRN = '\x1b[32m', DIM = '\x1b[2m', RST = '\x1b[0m';
console.log(`${DIM}check-standards — Web Everything${RST}`);
for (const w of warnings) console.log(`${YEL}  warn${RST} ${w}`);
for (const e of errors) console.log(`${RED} error${RST} ${e}`);
console.log(
  `\n${errors.length ? RED : GRN}${errors.length} error(s)${RST}, ${warnings.length} warning(s) ` +
  `${DIM}(checked ${blocks.length} blocks, ${plugs.length} plugs, ${semantics.length} terms, ${research.length} research topics)${RST}`,
);
process.exit(errors.length ? 1 : 0);
