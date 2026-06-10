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
import {
  BACKLOG_STATUSES, BACKLOG_TYPES, WORK_ITEMS, FIB, FILE,
  dMissingField, dUnresolvedRef, dMissingDescription, buildGraduatedKinds, validateBacklogItem,
  checkStatus, validateProtocol, validateIntent, validateCapability, validateCapabilityMatrix,
  validateReportsNotHidden, findCompiledShadows, permalinkSegment, validateViteProxyCoverage,
} from './check-standards-rules.mjs';

const require = createRequire(import.meta.url);

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'src/_data');
const INC = join(ROOT, 'src/_includes');

// `--json` emits machine-readable failure descriptors (backlog #089 idea 1) so the
// conformance auto-fix agent (#095) can target failures structurally instead of
// scraping ANSI text. Human output is unchanged when the flag is absent.
const JSON_MODE = process.argv.includes('--json');

// Each entry is { message, descriptor? }. The optional descriptor is the structured,
// agent-targetable form of the failure — populated for every class a fixer (deterministic
// or model) can act on. Calls with no descriptor are not yet agent-fixable.
const errors = [];
const warnings = [];
const err = (m, descriptor) => errors.push({ message: m, descriptor });
const warn = (m, descriptor) => warnings.push({ message: m, descriptor });

// ── Failure descriptors (#095 → fed to the auto-fix agent #196) ────────────────
// Every descriptor carries a `kind` (the failure class a fixer matches on) and `fix`: the routing
// call this item (#197) records for each class —
//   'reference' → mechanically fixable. The validator already knows the exact target value, so the
//                 deterministic reference fixer in scripts/autofix/engine.mjs derives the edit (no
//                 model, no key). Only `deprecated-status` qualifies today.
//   'model'     → content-generation. The intended value isn't mechanically derivable (a description
//                 to write, a missing field's value, the right entity for a broken ref), so it's
//                 deferred to the BYO-key model fixer (#196). Emitted now so that fixer gets a
//                 structured, targetable feed instead of scraping ANSI prose.
// `FILE` (spec data-file path per entity, for descriptor pointers), `dMissingField`, `dUnresolvedRef`
// and `dMissingDescription` are imported from ./check-standards-rules.mjs — the single definitions
// shared with the unit tests (#256). The status vocabularies + `checkStatus` live there too.

const readJson = (rel) => {
  const p = join(DATA, rel);
  if (!existsSync(p)) { err(`Missing data file: src/_data/${rel}`); return null; }
  try { return JSON.parse(readFileSync(p, 'utf8')); }
  catch (e) { err(`Invalid JSON in src/_data/${rel}: ${e.message}`); return null; }
};
const arr = (d) => (Array.isArray(d) ? d : []);

// The implementation lifecycle (`LIFECYCLE`/`STATUS_SYNONYMS`) and the `checkStatus` enum check live
// in ./check-standards-rules.mjs (shared with the entity validators + unit tests, #256). `checkStatus`
// is pure — it returns `{message, descriptor?}` entries — so compose it here for blocks/plugs:
const checkStatusInto = (kind, id, status) => {
  for (const e of checkStatus(kind, id, status)) err(e.message, e.descriptor);
};
// Research topics use a separate axis (open question vs answered), not the implementation lifecycle.
const RESEARCH_STATUSES = new Set(['open', 'resolved', 'draft', 'closed']);
// Backlog operational axis (BACKLOG_STATUSES/BACKLOG_TYPES) and the agile sizing axis
// (WORK_ITEMS/FIB) are imported from ./check-standards-rules.mjs — the single definition shared with
// the backlog-rule unit tests (#251). See docs/agent/backlog-workflow.md → "Agile sizing".
const BLOCK_TYPES = new Set(['Store', 'Parser', 'Behavior', 'Directive', 'Component', 'Module']);

// ── Load specs ───────────────────────────────────────────────────────────────
const blocks = arr(readJson('blocks.json'));
const plugs = arr(readJson('plugs.json'));
const semantics = arr(readJson('semantics.json'));
const research = arr(readJson('researchTopics.json'));
const protocols = arr(readJson('protocols.json'));
const projects = arr(readJson('projects.json'));
const intents = arr(readJson('intents.json'));
const capabilities = arr(readJson('capabilities.json'));
const adapters = arr(readJson('adapters.json'));
const demos = arr(readJson('demos.json'));
const capabilityMatrix = readJson('capabilityMatrix.json') || {};
// Backlog feeds off backlog/*.md via the shared data-file loader (single source).
const loadBacklog = require(join(ROOT, 'src/_data/backlog.js'));
const backlog = arr(typeof loadBacklog === 'function' ? loadBacklog() : loadBacklog);

// ── 1. Spec ↔ description coverage ────────────────────────────────────────────
const hasDesc = (folder, id) => existsSync(join(INC, folder, `${id}.njk`));
for (const b of blocks)
  if (b.id && !hasDesc('block-descriptions', b.id))
    err(`Block "${b.id}" has no src/_includes/block-descriptions/${b.id}.njk`,
      dMissingDescription('Block', b.id, `src/_includes/block-descriptions/${b.id}.njk`));
for (const p of plugs)
  if (p.id && !hasDesc('plug-descriptions', p.id))
    err(`Plug "${p.id}" has no src/_includes/plug-descriptions/${p.id}.njk`,
      dMissingDescription('Plug', p.id, `src/_includes/plug-descriptions/${p.id}.njk`));
for (const r of research)
  if (r.id && !hasDesc('research-descriptions', r.id))
    err(`Research topic "${r.id}" has no src/_includes/research-descriptions/${r.id}.njk`,
      dMissingDescription('Research', r.id, `src/_includes/research-descriptions/${r.id}.njk`));

// ── 2. Spec ↔ implementation ──────────────────────────────────────────────────
for (const b of blocks) {
  if (b.sourcePath && !existsSync(join(ROOT, b.sourcePath)))
    err(`Block "${b.id}" sourcePath does not exist: ${b.sourcePath}`,
      dUnresolvedRef('Block', b.id, FILE.Block, 'sourcePath', b.sourcePath, 'filesystem'));
  if (b.status === 'active' && !b.sourcePath)
    warn(`Block "${b.id}" is status:active but has no sourcePath`);
}

// ── 3. Status / type enums ────────────────────────────────────────────────────
for (const b of blocks) {
  checkStatusInto('Block', b.id, b.status);
  if (b.type && !BLOCK_TYPES.has(b.type)) warn(`Block "${b.id}" has unusual type "${b.type}"`);
}
for (const p of plugs) checkStatusInto('Plug', p.id, p.status);
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
// Per-protocol field + reference rules (incl. the project-partial anchor probe) are the pure
// `validateProtocol` (unit-tested in scripts/__tests__, #256); the script composes it over the live
// registry. The anchor probe's file read is injected via `readProjectPartial`.
const projectById = new Map(projects.map((p) => [p.id, p]));
const intentById = new Map(intents.map((i) => [i.id, i]));
const readProjectPartial = (projectId) => {
  const partial = join(INC, `project-${projectId}.njk`);
  return existsSync(partial) ? readFileSync(partial, 'utf8') : null;
};
const protocolCtx = { projectById, intentById, readProjectPartial };
for (const proto of protocols) {
  const { errors: pe, warnings: pw } = validateProtocol(proto, protocolCtx);
  for (const e of pe) err(e.message, e.descriptor);
  for (const w of pw) warn(w.message, w.descriptor);
}

dupCheck(intents, 'intents.json');

// ── 6c. Intents (UX preference vocabulary, surfaced via /intents/ catalog) ───
// Per-intent field/status/dimensions rules + the requiresCapabilities → capabilities.json resolution
// are the pure `validateIntent` (#256). `capabilityIds` is built below (§6c-bis) before this runs.

// ── 6c-bis. Capability vocabulary + static build-matrix (#204, foundation of epic #203) ──
// Capability ids borrow Baseline / `web-features` keys (D3′); the matrix (the default provider impl,
// D4′) tiers each (impl × capability) at one of three states. Guard the vocabulary, the
// completeness of the grid, and that every cross-reference (matrix → vocab, intent → vocab) resolves
// — so the resolver (#205), the /capabilities/ catalog, and the edge URL key can never drift apart.
// The per-capability vocab rules, the registered-adapter table, and the complete impl × capability
// build-matrix invariants are the pure `validateCapability` / `validateCapabilityMatrix` (#256). The
// matrix's gnarliest logic — grid completeness + the single-native-substrate tiebreak — lives there
// with fixtures. `capabilityIds` (built here) is the shared known-capability id set the matrix and
// intent validators both resolve against.
dupCheck(capabilities, 'capabilities.json');
for (const cap of capabilities) {
  const { errors: ce } = validateCapability(cap);
  for (const e of ce) err(e.message, e.descriptor);
}
const capabilityIds = new Set(capabilities.map((c) => c.id).filter(Boolean));

const matrixImpls = arr(capabilityMatrix.impls);
{
  const { errors: me, warnings: mw } = validateCapabilityMatrix(matrixImpls, {
    capabilityIds,
    hasAdapterDesc: (id) => hasDesc('capability-adapter-descriptions', id),
  });
  for (const e of me) err(e.message, e.descriptor);
  for (const w of mw) warn(w.message, w.descriptor);
}

// Intents (§6c) compose `validateIntent` here, now that `capabilityIds` exists — it covers the field/
// status/dimensions rules AND the requiresCapabilities → capabilities.json resolution in one pass.
const intentCtx = { capabilityIds };
for (const intent of intents) {
  const { errors: ie, warnings: iw } = validateIntent(intent, intentCtx);
  for (const e of ie) err(e.message, e.descriptor);
  for (const w of iw) warn(w.message, w.descriptor);
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

// graduatedTo value resolution (#247): the kind → {registry id-set, source file} table. A graduatedTo
// written in the compact `kind:slug` ref form is resolved against the matching registry, so a typo'd
// kind (`intnet:droplist`) or a stale slug is an ERROR — not silently accepted like a correct one.
// Everything NOT in that compact shape (free-form prose describing what was built, a URL or file path,
// a {url,label} crossRef object, or the `none` sentinel) is the sanctioned alternative and is left
// untouched. Adapters live nested under adapters.json `items[]`. (Table + rule body live in
// check-standards-rules.mjs so they're unit-tested with fixtures — #251.)
const graduatedKinds = buildGraduatedKinds({ blocks, intents, protocols, projects, plugs, capabilityIds, adapters, demos });

// ── 6d. Backlog (single source of truth for ideas/issues/reviews/decisions) ──
// Feeds off backlog/*.md (frontmatter = fields, body = the per-item page). The per-item field +
// outward-reference rules are the pure `validateBacklogItem` (unit-tested in scripts/__tests__);
// the script composes it here over the live registry, then layers the cross-item graph checks
// (dup nums, blockedBy DAG, double-count) below.
const backlogCtx = {
  projectById,
  graduatedKinds,
  knownNums: new Set(seenNums.keys()), // every item's num — for parent resolution
  reportExists: (rel) => existsSync(join(ROOT, rel)),
};
for (const item of backlog) {
  const { errors: itemErrors, warnings: itemWarnings } = validateBacklogItem(item, backlogCtx);
  for (const e of itemErrors) err(e.message, e.descriptor);
  for (const w of itemWarnings) warn(w.message, w.descriptor);
}

// ── 6d-ter. blockedBy dependency edges (#248) ──
// `blockedBy: ["NNN", …]` is a directional prerequisite edge ("this can't start until NNN is
// resolved"), making the backlog a real DAG that a deterministic readiness function (#249/#250)
// can score without an LLM. Guard the graph's integrity: every edge must resolve to a real item,
// never point at itself, and never form a cycle (the readiness algorithm assumes acyclicity).
const blockedEdges = new Map(); // num -> [target nums], for the cycle walk
for (const item of backlog) {
  if (item.blockedBy === undefined) continue;
  const backlogFile = item.id ? `backlog/${item.id}.md` : undefined;
  if (!Array.isArray(item.blockedBy)) {
    err(`Backlog item "${item.id}" blockedBy must be an array of NNN ids (e.g. ["079", "092"])`);
    continue;
  }
  const targets = [];
  for (const raw of item.blockedBy) {
    const target = String(raw);
    if (target === item.num) {
      err(`Backlog item "${item.id}" lists itself in blockedBy — an item cannot block itself`);
      continue;
    }
    if (!seenNums.has(target)) {
      err(`Backlog item "${item.id}" blockedBy "#${target}" does not resolve to an existing item`,
        dUnresolvedRef('Backlog', item.id, backlogFile, 'blockedBy', target, 'backlog/'));
      continue;
    }
    targets.push(target);
  }
  if (item.num) blockedEdges.set(item.num, targets);
}
// Cycle detection over the resolved edges (DFS with a colour map). A back-edge means A blocks B
// blocks … blocks A — no item could ever start, so the readiness function would never converge.
{
  const WHITE = 0, GREY = 1, BLACK = 2;
  const colour = new Map();
  const reported = new Set();
  const visit = (n, stack) => {
    colour.set(n, GREY);
    for (const next of blockedEdges.get(n) || []) {
      if (colour.get(next) === GREY) {
        const cycle = [...stack.slice(stack.indexOf(next)), next].join(' → ');
        if (!reported.has(cycle)) { reported.add(cycle); err(`Backlog blockedBy cycle detected: #${cycle}`); }
      } else if ((colour.get(next) || WHITE) === WHITE) {
        visit(next, [...stack, next]);
      }
    }
    colour.set(n, BLACK);
  };
  for (const n of blockedEdges.keys())
    if ((colour.get(n) || WHITE) === WHITE) visit(n, [n]);
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
// The fs walk stays here; the de-date + visibility predicate is the pure `validateReportsNotHidden` (#256).
const REPORTS = join(ROOT, 'reports');
const reportFiles = existsSync(REPORTS) ? readdirSync(REPORTS).filter((f) => f.endsWith('.md')) : [];
const researchIds = new Set(research.map((r) => r.id).filter(Boolean));
const backlogReportRefs = new Set(
  backlog.map((b) => b.relatedReport).filter(Boolean).map((p) => p.replace(/^reports\//, '')),
);
{
  const { errors: re } = validateReportsNotHidden(reportFiles, { researchIds, backlogReportRefs });
  for (const e of re) err(e.message, e.descriptor);
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
// The fs walk stays here; the `.js`/`.d.ts` ↔ `.ts`/`.tsx` pairing is the pure `findCompiledShadows` (#256).
const allCompileFiles = COMPILE_ROOTS.flatMap((r) => walk(r));
{
  const { errors: se } = findCompiledShadows(allCompileFiles, (f) => f.replace(ROOT + '/', ''));
  for (const e of se) err(e.message, e.descriptor);
}

// ── 9. Vite dev-proxy allowlist must cover every 11ty catalog route ────────────
// A new catalog page renders on the 11ty server (:8080) but 404s on the Vite dev server (:3000)
// until its top-level URL segment is hand-added to the proxy allowlist in vite.config.mts. The 11ty
// `--serve` watcher picks a new `.njk` up automatically; the Vite proxy does not — its catalog list
// is a hard-coded alternation, so every new discovery surface is one silent papercut from a broken
// local URL. Cross-check each `src/*.njk` permalink's first path segment against the proxy config so
// the drift fails the build instead of becoming a local-only 404 (backlog #210).
// The fs reads (vite.config.mts + the src/*.njk bodies) stay here; the proxy-key extraction is local,
// but `permalinkSegment` (first-segment parse) and `validateViteProxyCoverage` (the bounded-match
// coverage regex — the gnarly bit) are the pure rules, fixture-tested in __tests__ (#256).
try {
  const SRC = join(ROOT, 'src');
  const viteCfg = readFileSync(join(ROOT, 'vite.config.mts'), 'utf8');
  // Proxy keys are the only quoted, path-like object keys followed by `: {` (resolve aliases map to
  // string values, not blocks; plugins are calls) — collect them as the authoritative set of routes
  // Vite forwards to 8080.
  const proxyKeys = [...viteCfg.matchAll(/^\s*(['"])(\^?\/[^'"]*)\1\s*:\s*\{/gm)].map((m) => m[2]).join(' ');
  const needed = new Map(); // top-level segment → example njk file that produces it
  for (const f of readdirSync(SRC).filter((n) => n.endsWith('.njk'))) {
    if (f === 'index.njk') continue; // root, served by the `^/(index\.html)?$` rule
    const seg = permalinkSegment(readFileSync(join(SRC, f), 'utf8'), f);
    if (seg && !needed.has(seg)) needed.set(seg, f);
  }
  const segments = [...needed].map(([seg, file]) => ({ seg, file }));
  const { errors: ve } = validateViteProxyCoverage(segments, proxyKeys);
  for (const e of ve) err(e.message, e.descriptor);
} catch (e) {
  err(`Vite proxy allowlist check failed: ${e.message}`);
}

// ── Report ────────────────────────────────────────────────────────────────────
const summary = {
  blocks: blocks.length, plugs: plugs.length, protocols: protocols.length, intents: intents.length,
  capabilities: capabilities.length, terms: semantics.length, research: research.length, backlog: backlog.length,
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
    `${DIM}(checked ${blocks.length} blocks, ${plugs.length} plugs, ${protocols.length} protocols, ${intents.length} intents, ${capabilities.length} capabilities, ${semantics.length} terms, ${research.length} research topics, ${backlog.length} backlog items)${RST}`,
  );
}
process.exit(errors.length ? 1 : 0);
