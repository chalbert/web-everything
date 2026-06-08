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
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { renderInventory, spliceInventory } from './gen-inventory.mjs';

const require = createRequire(import.meta.url);

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'src/_data');
const INC = join(ROOT, 'src/_includes');

// `--json` emits machine-readable failure descriptors (backlog #089 idea 1) so the
// conformance auto-fix agent (#095) can target failures structurally instead of
// scraping ANSI text. Human output is unchanged when the flag is absent.
const JSON_MODE = process.argv.includes('--json');

// Each entry is { message, descriptor? }. The optional descriptor is the structured,
// agent-targetable form of the failure — populated only for the classes a fixer can
// act on (MVP: deprecated-status). Most calls pass a message only.
const errors = [];
const warnings = [];
const err = (m, descriptor) => errors.push({ message: m, descriptor });
const warn = (m, descriptor) => warnings.push({ message: m, descriptor });

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
// Agile sizing axis (orthogonal to type/status). Points live at exactly one
// level — see docs/agent/backlog-workflow.md → "Agile sizing".
const WORK_ITEMS = new Set(['story', 'epic', 'task']);
const FIB = new Set([1, 2, 3, 5, 8, 13]);
// Deprecated synonyms → canonical. Flagged as errors so the drift can't return.
const STATUS_SYNONYMS = { implemented: 'active', stable: 'active', done: 'active', planned: 'concept', wip: 'draft' };
const BLOCK_TYPES = new Set(['Store', 'Parser', 'Behavior', 'Directive', 'Component', 'Module']);

// Which spec file each status-bearing entity lives in — lets the deprecated-status
// descriptor point a fixer (#095) at the exact JSON array to edit.
const KIND_FILE = { Block: 'src/_data/blocks.json', Plug: 'src/_data/plugs.json', Protocol: 'src/_data/protocols.json', Intent: 'src/_data/intents.json' };

const checkStatus = (kind, id, status) => {
  if (!status) return;
  if (STATUS_SYNONYMS[status]) {
    const to = STATUS_SYNONYMS[status];
    err(
      `${kind} "${id}" uses deprecated status "${status}" — use canonical "${to}"`,
      // Deterministically fixable: the canonical target is known, so #095's reference
      // fixer can rewrite the field and the verify gate confirms it cleared.
      KIND_FILE[kind] ? { kind: 'deprecated-status', entity: kind, id, file: KIND_FILE[kind], field: 'status', from: status, to } : undefined,
    );
  } else if (!LIFECYCLE.has(status))
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

// Backlog filenames are `NNN-slug.md`: NNN (item.num) is the stable unique id used in the URL.
// Enforce the prefix and that numbers don't collide, so authoring a new item can't silently reuse
// or drop an id. See docs/agent/backlog-workflow.md → "Authoring an item".
const seenNums = new Map();
for (const item of backlog) {
  if (!item.num) {
    err(`Backlog item "${item.id}" is missing the NNN- id prefix — rename to "<NNN>-${item.id}.md"`);
  } else if (seenNums.has(item.num)) {
    err(`Backlog id #${item.num} is used by both "${seenNums.get(item.num)}" and "${item.id}" — ids must be unique`);
  } else {
    seenNums.set(item.num, item.id);
  }
}

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

  // ── Agile sizing — drives the /backlog/ burndown ──
  // Every item is a story | epic | task; points (`size`, Fibonacci) sit on
  // stories and unstoried epics only, so the burndown never double-counts.
  if (!item.workItem)
    err(`Backlog item "${item.id}" missing required field "workItem" (story / epic / task)`);
  else if (!WORK_ITEMS.has(item.workItem))
    err(`Backlog item "${item.id}" has invalid workItem "${item.workItem}" (expected ${[...WORK_ITEMS].join(' / ')})`);
  if (item.size !== undefined && !FIB.has(item.size))
    err(`Backlog item "${item.id}" has non-Fibonacci size "${item.size}" (expected one of ${[...FIB].join(', ')})`);
  if (item.workItem === 'story' && item.size === undefined)
    err(`Backlog item "${item.id}" is a story but has no size — every story must carry Fibonacci points`);
  if (item.workItem === 'task' && item.size !== undefined)
    err(`Backlog item "${item.id}" is a task but has a size — tasks are never sized (they roll up under a story/epic)`);
  if (item.parent !== undefined && !seenNums.has(String(item.parent)) && !backlog.some((b) => b.num === String(item.parent)))
    err(`Backlog item "${item.id}" parent "#${item.parent}" does not resolve to an existing item`);
  // Resolution date is what the burndown plots — required once resolved.
  if (item.status === 'resolved' && !item.dateResolved)
    err(`Backlog item "${item.id}" is resolved but has no dateResolved — the burndown needs the resolution date`);
}

// Double-counting guard: an UNstoried epic (one that carries its own size) must
// have no sized child; a sized child means its points are already counted, so
// the epic must be storied (no size) instead.
const sizedChildrenOf = new Map();
for (const item of backlog) {
  if (item.parent !== undefined && typeof item.size === 'number') {
    const p = String(item.parent);
    sizedChildrenOf.set(p, (sizedChildrenOf.get(p) || 0) + 1);
  }
}
for (const item of backlog) {
  if (item.workItem === 'epic' && typeof item.size === 'number' && sizedChildrenOf.get(item.num))
    err(`Backlog item "${item.id}" is a sized (unstoried) epic but has ${sizedChildrenOf.get(item.num)} sized child item(s) — that double-counts. Make it storied (drop its size) or re-parent the children.`);
}

// ── 6d-bis. Old-slug redirects (#110): validate `formerSlugs` back-compat aliases ──
// A renamed item lists prior URL segments in `formerSlugs:`; src/backlog-slug-redirects.njk turns
// each into a redirect page at /backlog/<former>/ → /backlog/<id>/. Guard the field so a former slug
// can't shadow a live item or collide with another item's alias (either would make a redirect win
// over a real page, or two redirects fight for one URL).
const realIds = new Set(backlog.map((it) => it.id));
const aliasOwner = new Map();
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
for (const item of backlog) {
  if (item.formerSlugs === undefined) continue;
  if (!Array.isArray(item.formerSlugs)) {
    err(`Backlog item "${item.id}" formerSlugs must be an array of prior URL segments`);
    continue;
  }
  for (const former of item.formerSlugs) {
    if (typeof former !== 'string' || !SLUG_RE.test(former))
      err(`Backlog item "${item.id}" formerSlugs entry "${former}" must be a kebab-case URL segment`);
    else if (former === item.id)
      err(`Backlog item "${item.id}" lists its own current slug in formerSlugs — drop it`);
    else if (realIds.has(former))
      err(`Backlog item "${item.id}" formerSlug "${former}" collides with a live item — a redirect would shadow it`);
    else if (aliasOwner.has(former))
      err(`Backlog formerSlug "${former}" is claimed by both "${aliasOwner.get(former)}" and "${item.id}" — aliases must be unique`);
    else
      aliasOwner.set(former, item.id);
  }
}

// ── 6e. No hidden reports — every report must be exposed somewhere ────────────
// "Three homes": research → a /research/ topic, spec → the website, everything else → a
// backlog item. reports/ is NOT in the 11ty build, so a report is only reachable when it is
// either backed by a research topic (id = its de-dated slug) or referenced by a backlog item
// (relatedReport). A report that is neither is invisible on the website — fail.
const REPORTS = join(ROOT, 'reports');
const reportFiles = existsSync(REPORTS) ? readdirSync(REPORTS).filter((f) => f.endsWith('.md')) : [];
const researchIds = new Set(research.map((r) => r.id).filter(Boolean));
const backlogReportRefs = new Set(
  backlog.map((b) => b.relatedReport).filter(Boolean).map((p) => p.replace(/^reports\//, '')),
);
const deDate = (f) => f.replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/\.md$/, '');
for (const f of reportFiles) {
  const slug = deDate(f);
  if (!researchIds.has(slug) && !backlogReportRefs.has(f))
    err(
      `Report "reports/${f}" is hidden — no /research/ topic (id "${slug}") and no /backlog/ item ` +
      `references it (relatedReport). Promote it to a research topic or add a backlog item.`,
    );
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

// ── 8. No compiled artifacts shadowing TS sources ────────────────────────────
// A stray `tsc <file>` (or an editor "compile on save") emits `.js`/`.d.ts` next to the `.ts`/
// `.tsx` source, ignoring tsconfig `outDir`. Because Vite/vitest resolve extensionless imports
// `.js` BEFORE `.tsx`, the stale `.js` then silently shadows the real source in tests — and tsc
// does not honour `jsxInject`, so JSX fixtures throw `jsx is not defined` while looking "done".
// (This is exactly what masked backlog #067's conformance suite.) Fail on any such shadow so the
// drift can't return; clean with e.g. `find blocks plugs demos -name '*.js' -delete` (paired only).
const COMPILE_ROOTS = ['blocks', 'plugs', 'demos'].map((d) => join(ROOT, d)).filter(existsSync);
const walk = (dir, out = []) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'dist' || e.name === '_site') continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
};
const allCompileFiles = COMPILE_ROOTS.flatMap((r) => walk(r));
const fileSet = new Set(allCompileFiles);
for (const f of allCompileFiles) {
  const base = f.endsWith('.d.ts') ? f.slice(0, -5) : f.endsWith('.js') ? f.slice(0, -3) : null;
  if (!base) continue;
  if (fileSet.has(`${base}.ts`) || fileSet.has(`${base}.tsx`))
    err(
      `Compiled artifact "${f.replace(ROOT + '/', '')}" shadows its TS source — delete it. ` +
      `Stale .js/.d.ts next to .ts/.tsx silently override the source in vitest (.js resolves first).`,
    );
}

// ── Report ────────────────────────────────────────────────────────────────────
const summary = {
  blocks: blocks.length, plugs: plugs.length, protocols: protocols.length, intents: intents.length,
  terms: semantics.length, research: research.length, backlog: backlog.length,
  errors: errors.length, warnings: warnings.length,
};

if (JSON_MODE) {
  // Single JSON object on stdout — the auto-fix agent's failure feed (#095). Exit code
  // still signals pass/fail, so `check:standards --json` is both pipeable and CI-usable.
  const shape = (list) => list.map((x) => (x.descriptor ? { message: x.message, descriptor: x.descriptor } : { message: x.message }));
  console.log(JSON.stringify({ ok: errors.length === 0, summary, errors: shape(errors), warnings: shape(warnings) }, null, 2));
} else {
  const RED = '\x1b[31m', YEL = '\x1b[33m', GRN = '\x1b[32m', DIM = '\x1b[2m', RST = '\x1b[0m';
  console.log(`${DIM}check-standards — Web Everything${RST}`);
  for (const w of warnings) console.log(`${YEL}  warn${RST} ${w.message}`);
  for (const e of errors) console.log(`${RED} error${RST} ${e.message}`);
  console.log(
    `\n${errors.length ? RED : GRN}${errors.length} error(s)${RST}, ${warnings.length} warning(s) ` +
    `${DIM}(checked ${blocks.length} blocks, ${plugs.length} plugs, ${protocols.length} protocols, ${intents.length} intents, ${semantics.length} terms, ${research.length} research topics, ${backlog.length} backlog items)${RST}`,
  );
}
process.exit(errors.length ? 1 : 0);
