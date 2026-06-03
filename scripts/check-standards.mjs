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
import { createRequire } from 'node:module';
import { renderInventory, spliceInventory } from './gen-inventory.mjs';

const require = createRequire(import.meta.url);

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
// Backlog uses its own operational axis (not the implementation lifecycle).
const BACKLOG_STATUSES = new Set(['open', 'active', 'parked', 'resolved']);
const BACKLOG_TYPES = new Set(['idea', 'issue', 'review', 'decision']);
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
const protocols = arr(readJson('protocols.json'));
const projects = arr(readJson('projects.json'));
const intents = arr(readJson('intents.json'));
// Backlog feeds off backlog/*.md via the shared data-file loader (single source).
const loadBacklog = require(join(ROOT, 'src/_data/backlog.js'));
const backlog = arr(typeof loadBacklog === 'function' ? loadBacklog() : loadBacklog);

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
dupCheck(protocols, 'protocols.json');

// ── 6b. Protocols (first-class entity, owned by a Project) ───────────────────
const projectById = new Map(projects.map((p) => [p.id, p]));
const intentById = new Map(intents.map((i) => [i.id, i]));
for (const proto of protocols) {
  for (const f of ['id', 'name', 'summary', 'status', 'ownedByProject', 'anchor']) {
    if (!proto[f]) err(`Protocol "${proto.id || '<no id>'}" missing required field "${f}"`);
  }
  checkStatus('Protocol', proto.id, proto.status);
  if (proto.ownedByProject && !projectById.has(proto.ownedByProject))
    err(`Protocol "${proto.id}" ownedByProject "${proto.ownedByProject}" does not resolve in projects.json`);
  if (proto.realizesIntent && !intentById.has(proto.realizesIntent))
    err(`Protocol "${proto.id}" realizesIntent "${proto.realizesIntent}" does not resolve in intents.json`);
  if (proto.ownedByProject && proto.anchor) {
    const partial = join(INC, `project-${proto.ownedByProject}.njk`);
    if (!existsSync(partial)) {
      err(`Protocol "${proto.id}" expects project partial src/_includes/project-${proto.ownedByProject}.njk`);
    } else {
      const body = readFileSync(partial, 'utf8');
      if (!body.includes(`id="${proto.anchor}"`))
        err(`Protocol "${proto.id}" anchor "${proto.anchor}" not found in project-${proto.ownedByProject}.njk`);
    }
  }
}

dupCheck(intents, 'intents.json');

// ── 6c. Intents (UX preference vocabulary, surfaced via /intents/ catalog) ───
for (const intent of intents) {
  for (const f of ['id', 'name', 'summary', 'status', 'dimensions']) {
    if (intent[f] === undefined || intent[f] === null || intent[f] === '')
      err(`Intent "${intent.id || '<no id>'}" missing required field "${f}"`);
  }
  checkStatus('Intent', intent.id, intent.status);
  const dimCount = intent.dimensions && typeof intent.dimensions === 'object'
    ? Object.keys(intent.dimensions).length
    : 0;
  if (!dimCount) warn(`Intent "${intent.id}" has no dimensions — /intents/ catalog needs at least one axis`);
}

dupCheck(backlog, 'backlog/');

// ── 6d. Backlog (single source of truth for ideas/issues/reviews/decisions) ──
// Feeds off backlog/*.md (frontmatter = fields, body = the per-item page).
// Validate the registry shape and that every outward reference resolves.
for (const item of backlog) {
  for (const f of ['id', 'title', 'type', 'status', 'summary', 'dateOpened']) {
    if (item[f] === undefined || item[f] === null || item[f] === '')
      err(`Backlog item "${item.id || '<no id>'}" missing required field "${f}"`);
  }
  if (item.type && !BACKLOG_TYPES.has(item.type))
    err(`Backlog item "${item.id}" has invalid type "${item.type}" (expected ${[...BACKLOG_TYPES].join(' / ')})`);
  if (item.status && !BACKLOG_STATUSES.has(item.status))
    err(`Backlog item "${item.id}" has invalid status "${item.status}" (expected ${[...BACKLOG_STATUSES].join(' / ')})`);
  if (item.relatedProject && !projectById.has(item.relatedProject))
    err(`Backlog item "${item.id}" relatedProject "${item.relatedProject}" does not resolve in projects.json`);
  if (item.relatedReport && !existsSync(join(ROOT, item.relatedReport)))
    err(`Backlog item "${item.id}" relatedReport does not exist: ${item.relatedReport}`);
  if (item.crossRef && (!item.crossRef.url || !item.crossRef.label))
    err(`Backlog item "${item.id}" crossRef must have both "url" and "label"`);
  if (item.status === 'resolved' && !item.graduatedTo && item.type !== 'issue' && item.type !== 'review')
    warn(`Backlog item "${item.id}" is resolved but has no graduatedTo — record what it became`);
}

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
  `${DIM}(checked ${blocks.length} blocks, ${plugs.length} plugs, ${protocols.length} protocols, ${intents.length} intents, ${semantics.length} terms, ${research.length} research topics, ${backlog.length} backlog items)${RST}`,
);
process.exit(errors.length ? 1 : 0);
