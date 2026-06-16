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
import { checkDemos } from './check-demos.mjs';
import { buildReport, source as reportSource, finding as reportFinding, section as reportSection } from './lib/buildReport.mjs';
import {
  BACKLOG_STATUSES, BACKLOG_TYPES, WORK_ITEMS, FIB, FILE,
  dMissingField, dUnresolvedRef, dMissingDescription, buildGraduatedKinds, validateBacklogItem, isCanonicalGraduated,
  checkStatus, validateProtocol, validatePreset, validateIntent, validateCapability, validateCapabilityMatrix,
  validateReportsNotHidden, findCompiledShadows, permalinkSegment, validateViteProxyCoverage,
  validateModuleResolutionLock, findRawHtmlInMarkdown, findBuriedForkSections,
  findUnquotedColonScalars, findBadBodyLinks,
  RESEARCH_REVIEW_HORIZON_DEFAULT, deriveResearchFreshness,
  validateCapabilityPresence, validateRetirementShape,
  validatePlugDualMode, validateTemplateA11y,
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
// `superseded` (#441 Fork 1) marks a topic whose canonical report was replaced by a newer dated one.
const RESEARCH_STATUSES = new Set(['open', 'resolved', 'draft', 'closed', 'superseded']);
// Global review-horizon fallback (#441 Fork 4): a topic without its own `reviewHorizon` is reviewed
// against this interval (ISO-8601 duration). Imported from the rules module — its single home, shared
// with the Eleventy freshness badge; staleness derivation is `deriveResearchFreshness` (#477, warn-only below).
const ISO_DURATION = /^P(?:\d+Y)?(?:\d+M)?(?:\d+W)?(?:\d+D)?$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
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
const presets = arr((readJson('assemblerPresets.json') || {}).presets);
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
// Per #641 (block protocol/impl boundary, A/A/A): a WE block entry is a *protocol*,
// not impl. The impl lives in the canonical `@frontierui/blocks` package, named by
// `implementedBy` — NOT a WE-local file. So validate the *form* of the reference,
// not local existence (a contract may precede its impl — Fork 3-A, the 9 WE-only
// families migrate to FUI in #658). A red filesystem check here would re-encode the
// vendored-copy assumption #641 removed.
for (const b of blocks) {
  if (b.implementedBy && !/^@frontierui\/blocks\//.test(b.implementedBy))
    err(`Block "${b.id}" implementedBy must reference the canonical @frontierui/blocks impl: ${b.implementedBy}`,
      dUnresolvedRef('Block', b.id, FILE.Block, 'implementedBy', b.implementedBy, 'contract-form'));
  if (b.status === 'active' && !b.implementedBy)
    warn(`Block "${b.id}" is status:active but has no implementedBy (@frontierui/blocks impl reference)`);
}

// ── 3. Status / type enums ────────────────────────────────────────────────────
for (const b of blocks) {
  checkStatusInto('Block', b.id, b.status);
  if (b.type && !BLOCK_TYPES.has(b.type)) warn(`Block "${b.id}" has unusual type "${b.type}"`);
}
for (const p of plugs) checkStatusInto('Plug', p.id, p.status);
for (const r of research)
  if (r.status && !RESEARCH_STATUSES.has(r.status)) warn(`Research topic "${r.id}" has unusual status "${r.status}"`);
// Research-freshness foundation schema (#441 / #476): validate the shape of the new freshness +
// revision-chain fields when present. Staleness derivation (#477) and the supersedes-as-new-report
// flow (#478) build on this — here we only enforce that the fields are well-formed and the
// supersedes/supersededBy pointers are bidirectional and resolve to known topic ids.
{
  const researchById = new Map(research.filter((r) => r.id).map((r) => [r.id, r]));
  const asIds = (v) => (Array.isArray(v) ? v : v == null ? [] : [v]);
  for (const r of research) {
    if (!r.id) continue;
    if (r.lastReviewed && !ISO_DATE.test(r.lastReviewed))
      err(`Research topic "${r.id}" lastReviewed must be an ISO date (YYYY-MM-DD), got "${r.lastReviewed}"`);
    if (r.reviewHorizon && !ISO_DURATION.test(r.reviewHorizon))
      err(`Research topic "${r.id}" reviewHorizon must be an ISO-8601 duration (e.g. ${RESEARCH_REVIEW_HORIZON_DEFAULT}), got "${r.reviewHorizon}"`);
    for (const target of asIds(r.supersedes)) {
      const t = researchById.get(target);
      if (!t) err(`Research topic "${r.id}" supersedes unknown topic "${target}"`);
      else if (!asIds(t.supersededBy).includes(r.id))
        warn(`Research topic "${r.id}" supersedes "${target}" but "${target}".supersededBy does not point back (bidirectional pointer expected, #441 Fork 1)`);
    }
    for (const target of asIds(r.supersededBy)) {
      const t = researchById.get(target);
      if (!t) err(`Research topic "${r.id}" supersededBy unknown topic "${target}"`);
      else if (!asIds(t.supersedes).includes(r.id))
        warn(`Research topic "${r.id}" supersededBy "${target}" but "${target}".supersedes does not point back (bidirectional pointer expected, #441 Fork 1)`);
    }
    if (asIds(r.supersededBy).length && r.status !== 'superseded')
      warn(`Research topic "${r.id}" has supersededBy but status is "${r.status}" (expected "superseded", #441 Fork 1)`);
    // Staleness derivation (#441 Fork 4 / #477): once past `lastReviewed + reviewHorizon` (or the
    // global P6M fallback) a topic is flagged for re-review. WARN-ONLY by ruling — never a CI error
    // (stale-while-shown: the topic stays published; this only nudges a maintainer to re-review).
    const fr = deriveResearchFreshness(r);
    if (fr.state === 'stale')
      warn(`Research topic "${r.id}" is stale — last reviewed ${fr.lastReviewed}, horizon ${fr.horizon} (due ${fr.dueDate}). Re-review and bump lastReviewed (warn-only, #477).`);
  }
}

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

// ── 6a-bis. Benchmark capability-presence join table (#352) ──────────────────
// Each row of benchmarkCapabilityPresence.json must reference a known capability + corpus source; a
// `verified` row should carry its deep doc URL. Pure rule, composed over the two sibling registries.
{
  const presence = readJson('benchmarkCapabilityPresence.json');
  if (presence) {
    const benchCaps = readJson('benchmarkCapabilities.json') || { capabilities: [] };
    const benchCorpus = readJson('benchmarkCorpus.json') || { sources: [] };
    const { errors: pe, warnings: pw } = validateCapabilityPresence(presence, {
      capabilityIds: new Set((benchCaps.capabilities || []).map((c) => c.id)),
      sourceIds: new Set((benchCorpus.sources || []).map((s) => s.id)),
      provenanceKinds: (presence.provenanceKinds || []).map((k) => k.id),
    });
    for (const e of pe) err(e.message);
    for (const w of pw) warn(w.message);
  }
}

// ── 6a-ter. Reference-retirement convention (#584) ───────────────────────────
// One uniform retirement field-set — the #546 death triplet + the #192 supersededBy pointer — checked
// by a single shared helper across every structured reference home. The markers are opt-in
// (most-permissive), so a home with no retired/superseded entry passes vacuously. The supersededBy
// pointer resolves only where the home has an id space (the corpus). researchTopics.json keeps its own
// bidirectional supersedes/supersededBy rule above (§3) — its pointer space is topic ids, not refs.
// See docs/agent/reference-retirement.md.
{
  const benchCorpus = readJson('benchmarkCorpus.json') || { sources: [] };
  const corpusSourceIds = new Set((benchCorpus.sources || []).map((s) => s.id));
  const inCorpus = (t) => corpusSourceIds.has(t);
  const runShape = (entry, label, opts) => {
    const { errors: re, warnings: rw } = validateRetirementShape(entry, { label, ...opts });
    for (const e of re) err(e.message);
    for (const w of rw) warn(w.message);
  };
  // 1) Corpus sources — the seed home (#546); supersededBy resolves to a sibling source id.
  for (const s of benchCorpus.sources || [])
    runShape(s, `benchmarkCorpus source "${s.id}"`, { resolveSupersededBy: inCorpus });
  // 2) references.json links.
  for (const group of readJson('references.json') || [])
    for (const link of group.links || [])
      runShape(link, `references.json link "${link.title || link.url}"`);
  // 3) designSystemResearch refs on blocks + intents.
  for (const [home, list] of [['block', blocks], ['intent', intents]])
    for (const item of list || [])
      for (const dsr of item.designSystemResearch || [])
        runShape(dsr, `${home} "${item.id}" designSystemResearch "${dsr.system || dsr.reference || ''}"`);
  // 4) capability-presence rows — supersededBy (a moved source) resolves to a corpus source id.
  const presenceRows = readJson('benchmarkCapabilityPresence.json');
  if (presenceRows)
    for (const row of presenceRows.rows || [])
      runShape(row, `capability-presence (${row.capabilityId}, ${row.sourceId})`, { resolveSupersededBy: inCorpus });
}

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

// ── 6b-bis. Assembler presets (#646/#667, registry-item recipes, surfaced via /presets/) ──
// Per-preset field/status/reference rules + the non-empty files[] recipe guard are the pure
// `validatePreset` (mirrors validateProtocol); the script composes it over the live registry.
const blockIds = new Set(blocks.map((b) => b.id));
const presetCtx = { projectById, blockIds, intentById };
for (const preset of presets) {
  const { errors: pe2, warnings: pw2 } = validatePreset(preset, presetCtx);
  for (const e of pe2) err(e.message, e.descriptor);
  for (const w of pw2) warn(w.message, w.descriptor);
}
dupCheck(presets.map((p) => ({ id: p.name })), 'assemblerPresets.json');

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
// #614 tightened the rest: the field must LEAD with a resolvable entity reference (`none`, `kind:slug`,
// a repo path, or a bare registry id) so entity-graph joins + the G3 lineage walk can read it; pure prose
// where the entity is buried is non-canonical and surfaced as one aggregated nudge below (not per-item).
// Adapters live nested under adapters.json `items[]`. (Table + rule body live in check-standards-rules.mjs
// so they're unit-tested with fixtures — #251.)
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
// #614 — aggregated non-canonical graduatedTo nudge. Per-item would flood (≈90 resolved items still
// carry narrative); one summary line points at the normalizer + the tracking item instead.
const nonCanonGrad = backlog
  .filter((it) => it.status === 'resolved' && typeof it.graduatedTo === 'string' && !isCanonicalGraduated(it.graduatedTo, graduatedKinds))
  .map((it) => `#${it.num ?? it.id}`);
if (nonCanonGrad.length)
  warn(`${nonCanonGrad.length} resolved items have a non-canonical graduatedTo (prose/narrative instead of a leading entity ref) — run \`npm run normalize:graduated\` to auto-fix the safe ones; bulk narrative→body cleanup tracked in #619. Items: ${nonCanonGrad.slice(0, 10).join(', ')}${nonCanonGrad.length > 10 ? `, …+${nonCanonGrad.length - 10}` : ''}`);

// #608 — D3-readiness surfacing (forward conformance gate). The loader demotes an open build out of
// Tier A when its `relatedProject` is a `concept` project with no shipped surface ("the standard must
// exist first") — these items are NOT batchable even with a clean frontmatter. check:standards never
// gated on this (it gates mechanics); surface it as one aggregate nudge so the forward gate is visible
// in the standing /check, alongside the deterministic `npm run check:health` (decision-governance + ref
// drift) and the judgment pre-flight documented in backlog-workflow.md → "principle-conformance pre-flight".
const projectPending = backlog.filter((it) => it.projectPending).map((it) => `#${it.num ?? it.id} (${it.relatedProject})`);
if (projectPending.length)
  warn(`${projectPending.length} open build(s) held by D3-readiness — relatedProject is a \`concept\` project with no shipped surface, so the standard must exist first (loader demotes them out of Tier A; not a \`blockedBy\` edge). Either ship/graduate the project or re-home the item. Items: ${projectPending.join(', ')}`);

// ── 6d-bis. Raw-HTML-in-body lint (#290) ──
// An un-backticked HTML tag in a backlog body is passed through by 11ty and parsed by the browser; a
// void/unclosed interactive one (`<select>`, `<dialog>`) swallows the rest of the page, rendering the
// item visibly empty (the #020 bug). Warn (don't fail) so the author wraps it in backticks — balanced
// raw HTML (e.g. #028) renders fine, so this nudges rather than red-gates. The loader exposes only the
// rendered `details`, so read the raw body here and strip the leading frontmatter before scanning.
for (const item of backlog) {
  if (!item.id) continue;
  const p = join(ROOT, 'backlog', `${item.id}.md`);
  if (!existsSync(p)) continue;
  const body = readFileSync(p, 'utf8').replace(/^---\n[\s\S]*?\n---\n/, '');
  const hits = findRawHtmlInMarkdown(body);
  if (!hits.length) continue;
  // One warning per item (not per tag) so a rich-HTML body like #028 doesn't flood the output. List
  // the distinct element names + the body lines so the author can find and backtick-wrap them.
  const tags = [...new Set(hits.map((h) => h.name))].map((n) => `<${n}>`).join(', ');
  const lines = [...new Set(hits.map((h) => h.line))].join(', ');
  warn(`Backlog item "${item.id}" has raw HTML (${tags}) at body line(s) ${lines} outside code — ` +
    `11ty passes it through and the browser parses it as a live element; a void/unclosed interactive ` +
    `tag (e.g. <select>/<script>) swallows the rest of the page. Wrap them in backticks.`);
}

// ── 6d-quater. Buried-fork lint — a fork section in a non-decision body (#441 carve rule) ──
// A fork belongs in a `type: decision` item, never inline in an idea/epic/story (#192 / #315 / #087
// pattern). Flag a fork-shaped section heading in a non-decision, non-resolved item so the author
// carves it to a decision that `blocks` the original (docs/agent/backlog-workflow.md → the carve
// rule). Warn (don't fail): the heading is a strong signal, not proof; a section already pointing at a
// decision (`#NNN` + carve/resolve/block language) is suppressed in the rule, so a carved item is
// quiet. A `decision` item legitimately is the fork; a resolved item's open-questions are historical.
for (const item of backlog) {
  if (!item.id || item.type === 'decision' || item.status === 'resolved') continue;
  const p = join(ROOT, 'backlog', `${item.id}.md`);
  if (!existsSync(p)) continue;
  const body = readFileSync(p, 'utf8').replace(/^---\n[\s\S]*?\n---\n/, '');
  const hits = findBuriedForkSections(body);
  if (!hits.length) continue;
  const where = hits.map((h) => `"${h.heading}" (line ${h.line})`).join(', ');
  warn(`Backlog item "${item.id}" (${item.type}) has a fork-shaped section ${where} in a non-decision ` +
    `body — if it's a live design fork, carve it to a type:decision item that blocks this one; if it's ` +
    `already resolved or deferred elsewhere, reframe the heading or cite the decision (#NNN). ` +
    `See docs/agent/backlog-workflow.md → the carve rule.`);
}

// ── 6d-sexies. Bad-body-link lint — leaked authoring syntax in a rendered body ──
// A backlog body renders at /backlog/<id>/, so editor-only or dead links read as 404s/garbage there.
// `[[wikilink]]` is MEMORY-only syntax with no page → ERROR; localhost/abs-file links and backlog→backlog
// `.md` links (should be /backlog/NNN-slug/) → WARN. Reports/docs `.md` refs are the sanctioned
// agent-facing convention and are not flagged. One message per item per kind so output stays scannable.
for (const item of backlog) {
  if (!item.id) continue;
  const p = join(ROOT, 'backlog', `${item.id}.md`);
  if (!existsSync(p)) continue;
  const body = readFileSync(p, 'utf8').replace(/^---\n[\s\S]*?\n---\n/, '');
  const hits = findBadBodyLinks(body);
  if (!hits.length) continue;
  const byKind = (k) => hits.filter((h) => h.kind === k);
  const lines = (k) => [...new Set(byKind(k).map((h) => h.line))].join(', ');
  if (byKind('wikilink').length) {
    err(`Backlog item "${item.id}" uses [[wiki-link]] syntax at body line(s) ${lines('wikilink')} — ` +
      `that is MEMORY-files-only; markdown renders it literally and the slug has no page. In a backlog ` +
      `body, link another item as /backlog/NNN-slug/ or drop to plain prose.`);
  }
  // Item-to-item `.md` links are a guaranteed 404 on the live site (the route is /backlog/NNN-slug/) and
  // a known, mechanical fix → ERROR so they can't recur. localhost/abs-file links stay WARN (likelier to
  // be a deliberate editor-only ref). One message per item per severity so output stays scannable.
  if (byKind('backlog-md').length) {
    err(`Backlog item "${item.id}" links to another item with a dead .md path @ line(s) ${lines('backlog-md')} ` +
      `— a bare/relative \`NNN-slug.md\` renders as a 404 from /backlog/${item.id}/. ` +
      `Use the rendered URL \`/backlog/NNN-slug/\` instead.`);
  }
  const warnKinds = ['localhost', 'absfile'].filter((k) => byKind(k).length);
  if (warnKinds.length) {
    const detail = warnKinds.map((k) => `${k === 'absfile' ? 'absolute /Users//file:// link' :
      'localhost link'} @ line(s) ${lines(k)}`).join('; ');
    warn(`Backlog item "${item.id}" has a body link that is dead on the live site — ${detail}. ` +
      `Use the rendered /backlog/NNN-slug/ URL (or a site-relative path); editor-only refs to ` +
      `reports/ and docs/agent/ are fine.`);
  }
}

// ── 6d-quinquies. Unquoted-colon scalar in frontmatter (#453) ──
// Scan the RAW backlog/*.md files, NOT the loader output — the loader (#430) already skips an item
// whose frontmatter is malformed YAML and only warns, so the broken item is absent from `backlog`
// here. An unquoted plain scalar embedding `: ` (e.g. `graduatedTo: a/b.json: foo`) is the recurring
// trigger; YAML reads it as a nested mapping and the parse dies, silently dropping the item from the
// board. Error (not warn): a vanished backlog item escapes every other check, so the gate must catch
// the typo at author time and prompt the quote-fix.
for (const file of readdirSync(join(ROOT, 'backlog')).filter((f) => f.endsWith('.md'))) {
  const raw = readFileSync(join(ROOT, 'backlog', file), 'utf8');
  const hits = findUnquotedColonScalars(raw);
  for (const h of hits) {
    err(`Backlog item "${file.replace(/\.md$/, '')}" has an unquoted colon in frontmatter — ` +
      `\`${h.key}: ${h.value}\` (line ${h.line}). YAML reads the embedded \`: \` as a nested mapping ` +
      `and the loader silently SKIPS the whole item. Quote the value: \`${h.key}: "${h.value}"\`.`);
  }
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

// Sliced-epic guard: an epic is either UNSLICED (no children → carries its own
// `size`) or SLICED (≥1 child of ANY kind → no `size`, a pure umbrella). There is
// no middle state — gaining the first child (story OR task) flips it to sliced, so
// the `size` must be dropped in that same edit. A sized child additionally double-
// counts (its points are already on the child), so we give that the sharper message.
const childrenOf = new Map(); // parent num -> [child item, …]
for (const item of backlog) {
  if (item.parent !== undefined) {
    const p = String(item.parent);
    if (!childrenOf.has(p)) childrenOf.set(p, []);
    childrenOf.get(p).push(item);
  }
}
for (const item of backlog) {
  if (item.workItem !== 'epic' || typeof item.size !== 'number') continue;
  const kids = childrenOf.get(item.num) || [];
  const sized = kids.filter((k) => typeof k.size === 'number').length;
  if (sized)
    err(`Backlog item "${item.id}" is a sized epic but has ${sized} sized child item(s) — that double-counts. Make it storied (drop its size) or re-parent the children.`);
  else if (kids.length)
    err(`Backlog item "${item.id}" is a sized epic but has ${kids.length} child item(s) — an epic with any child is SLICED and must carry no \`size\` (its scope lives on the children). Drop the epic's size, or detach the child if the epic is genuinely an unsliced bucket.`);
}

// Epic ↔ child status coherence (docs/agent/backlog-workflow.md → "Closing out" step 4):
// an epic's resolution state must agree with its children.
//   B — a RESOLVED epic with an open child is the `⚠ open slice` contradiction: the
//       umbrella was closed while work still lives under it. Reopen the epic or close the child.
//   A — a non-resolved epic that is BLOCKED and has no open child must say WHY it's stalled
//       (a `childlessReason`) so the tile doesn't read as abandoned.
//   C — a storied epic whose every child is resolved is the `all slices done` review cue:
//       reconcile it (resolve the epic, or add the next slice). Warn, don't fail — it's a nudge.
const CHILDLESS_REASONS = new Set(['blocked', 'undecided', 'untriaged', 'program']);
for (const item of backlog) {
  if (item.workItem !== 'epic') continue;
  const kids = childrenOf.get(item.num) || [];
  if (!kids.length) continue;
  const openKids = kids.filter((k) => k.status !== 'resolved');
  if (item.status === 'resolved' && openKids.length)
    err(`Backlog item "${item.id}" is a resolved epic but has ${openKids.length} open child slice(s) (${openKids.map((k) => `#${k.num}`).join(', ')}) — a closed umbrella with live work under it. Reopen the epic or resolve/re-parent the open child(ren).`);
  else if (item.status !== 'resolved' && (item.blockedBy?.length) && !openKids.length && !CHILDLESS_REASONS.has(item.childlessReason))
    err(`Backlog item "${item.id}" is a blocked epic with no open children and no childlessReason — set childlessReason: ${[...CHILDLESS_REASONS].join('|')} so the board shows why it's stalled, or add the next slice.`);
  else if (item.status !== 'resolved' && !openKids.length)
    warn(`Backlog item "${item.id}" is an epic whose every child is resolved ('all slices done') — reconcile it: resolve the epic (its scope is delivered) or scaffold the next slice.`);
}

// Date↔status coherence: dateResolved only makes sense on a resolved item (the burndown
// plots resolutions; a stray date on an open item would mis-place it on the chart).
for (const item of backlog) {
  if (item.dateResolved && item.status !== 'resolved')
    err(`Backlog item "${item.id}" has dateResolved "${item.dateResolved}" but status is "${item.status}" — clear the date or set status: resolved.`);
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

// ── 8b. Plug runtime dual-mode conformance (#636, enforcing the #606 invariants) ─
// Every plug domain must ship passing tests for BOTH the unplugged (non-invasive)
// and plugged modes, and none may require plugged mode (the unplugged form is the
// mandatory real-app surface; plugged is POC). The fs walk lives here; the pure
// rule is `validatePlugDualMode`. Skip silently when the plug runtime isn't checked
// out here — #606 makes Frontier UI the canonical home, so a WE tree without plugs/
// (post-#449) is expected, not a failure.
{
  const plugsRoot = join(ROOT, 'plugs');
  if (existsSync(plugsRoot)) {
    const sharedTestsDir = join(plugsRoot, '__tests__');
    const sharedTests = existsSync(sharedTestsDir)
      ? walk(sharedTestsDir).filter((f) => /\.(test|spec)\.[tj]sx?$/.test(f))
      : [];
    const sharedTestBlobs = sharedTests.map((f) => ({ f, c: readFileSync(f, 'utf8') }));
    const domains = readdirSync(plugsRoot, { withFileTypes: true })
      .filter((e) => e.isDirectory() && /^web/.test(e.name))
      .map((e) => {
        const dir = join(plugsRoot, e.name);
        const files = walk(dir);
        const isTest = (f) => /\.(test|spec)\.[tj]sx?$/.test(f);
        const hasSource = files.some((f) => /\.tsx?$/.test(f) && !isTest(f) && !f.includes('/__tests__/'));
        const localTests = files.filter(isTest).map((f) => ({ f, c: readFileSync(f, 'utf8') }));
        const allTests = [...localTests, ...sharedTestBlobs];
        // unplugged-mode test = imports the non-invasive `unplugged` API AND touches this domain.
        const hasUnpluggedTest = allTests.some(
          ({ f, c }) => /unplugged/.test(c) && (c.includes(`/${e.name}/`) || f.includes(e.name)),
        );
        // plugged-mode test = the domain's own tests (register + upgrade in real DOM) or a shared
        // e2e/integration spec exercising it via the global-patched path.
        const hasPluggedTest =
          localTests.length > 0 || sharedTestBlobs.some(({ f, c }) => f.includes(e.name) || c.includes(`/${e.name}/`));
        return { name: e.name, hasSource, hasUnpluggedTest, hasPluggedTest };
      });
    const { errors: pe, warnings: pw } = validatePlugDualMode(domains);
    for (const e of pe) err(e.message, e.descriptor);
    for (const w of pw) warn(w.message, w.descriptor);
  }
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

// ── 9b. Module-resolution exports-lock (#274/#271) ──
// Gather every `@frontierui/*` (locked-scope) entry from the project's SHIPPED native resolution
// manifests — vite `resolve.alias` + every `<script type="importmap">` in the served catalog pages
// (src/*.{njk,html}) — and assert each terminates at the package exports (URL / node_modules / bare
// specifier), never a raw in-repo source path. The lock is "protocol is the only lock"; it guards a
// frontierui repoint (#265) from silently aliasing the shipped config back to WE/foreign source.
// Scope note: POC sandbox demos (demos/*.html) are intentionally NOT scanned — they predate the
// published package and stand-in with a local src path by design (Demo-First); the lock governs the
// project's real resolution config, not throwaway sandboxes. (maas-consumer-demo's @frontierui/jsx
// importmap is a known such case, to be cleaned up with the jsx-runtime dedupe #265/#081.)
try {
  const entries = [];
  // vite resolve.alias: `'key': 'value'` string pairs inside the alias block.
  const viteCfg = readFileSync(join(ROOT, 'vite.config.mts'), 'utf8');
  for (const m of viteCfg.matchAll(/(['"])(@[^'"]+)\1\s*:\s*(['"])([^'"]+)\3/g))
    entries.push({ specifier: m[2], target: m[4], source: 'vite.config.mts resolve.alias' });
  // importmaps in served catalog pages: parse each `<script type="importmap">…</script>` JSON `imports`.
  const importmapSources = [];
  const srcDir = join(ROOT, 'src');
  for (const f of readdirSync(srcDir).filter((n) => n.endsWith('.njk') || n.endsWith('.html')))
    importmapSources.push([`src/${f}`, readFileSync(join(srcDir, f), 'utf8')]);
  for (const [source, body] of importmapSources) {
    for (const block of body.matchAll(/<script[^>]*type=["']importmap["'][^>]*>([\s\S]*?)<\/script>/gi)) {
      let map;
      try { map = JSON.parse(block[1]); } catch { continue; } // skip non-JSON / templated importmaps
      for (const [specifier, target] of Object.entries(map.imports ?? {}))
        entries.push({ specifier, target, source: `${source} importmap` });
    }
  }
  const { errors: me } = validateModuleResolutionLock(entries);
  for (const e of me) err(e.message, e.descriptor);
} catch (e) {
  err(`Module-resolution exports-lock check failed: ${e.message}`);
}

// ── Demos: operational-wiring gate (routing/base-path/registry/dev-fallback) ────
// Complements check:app-conformance (which validates standard USE). The static checks live in
// check-demos.mjs and are composed here so the everyday gate catches the base-path reload bug class
// (loan-origination / auto-insurance #317/#318). The --live HTTP probe stays opt-in on `check:demos`.
try {
  const { errors: de, warnings: dw } = checkDemos();
  for (const e of de) err(e.message, e.descriptor);
  for (const w of dw) warn(w.message, w.descriptor);
} catch (e) {
  err(`Demo operational-wiring check failed: ${e.message}`);
}

// ── 10. Backlog type-filter UI must cover every BACKLOG_TYPE ───────────────────
// The /backlog/ board hides any card whose `data-type` is not an *active filter chip*
// (src/assets/js/home-display.js → `failType`). The chip set is built from hard-coded type
// lists in src/backlog.njk (the "Tracked work" facet + the "Prioritisation" table facet). When a
// new type is added to BACKLOG_TYPES (the SoT in check-standards-rules.mjs) but a UI list is not
// updated, EVERY item of that type renders into the DOM yet is permanently invisible — there is no
// chip to re-enable it. That is exactly how `type: review` items (#602/#610) vanished from the board
// while passing every other check. Assert each hard-coded list covers the full type vocabulary so
// the drift fails the gate instead of silently swallowing a whole class of items.
try {
  const njk = readFileSync(join(ROOT, 'src/backlog.njk'), 'utf8');
  // Both facets declare their order as a bracketed string-array literal of type tokens. Match every
  // `[ "idea", "issue", … ]` whose members are all known types — that uniquely identifies the two
  // type-filter lists without coupling to surrounding template syntax.
  const TYPE_TOKENS = [...BACKLOG_TYPES];
  const listLiterals = [...njk.matchAll(/\[((?:\s*["'][a-z]+["']\s*,?)+)\]/g)]
    .map((m) => m[1].match(/["']([a-z]+)["']/g).map((q) => q.replace(/["']/g, '')))
    .filter((toks) => toks.every((t) => BACKLOG_TYPES.has(t)) && toks.includes('decision'));
  if (!listLiterals.length)
    err('Backlog type-filter check: could not find any type-list literal in src/backlog.njk (template shape changed — update check-standards.mjs §10)');
  for (const toks of listLiterals) {
    const missing = TYPE_TOKENS.filter((t) => !toks.includes(t));
    if (missing.length)
      err(`src/backlog.njk type-filter list [${toks.join(', ')}] omits backlog type(s) ${missing.map((t) => `"${t}"`).join(', ')} — those items render but are permanently hidden (no filter chip). Add them to every type list in backlog.njk.`);
  }
} catch (e) {
  err(`Backlog type-filter coverage check failed: ${e.message}`);
}

// ── 11. Static template a11y lint (#772, complements the #770/#771 rendered axe gate) ──
// Structural a11y rules that live in the .njk source and a headless axe run cannot observe from the
// computed page (it sees rendered DOM, not the authoring miss). Scoped to the site-chrome layouts —
// the #762 regression locus — so spec-content and breadcrumb navs never false-positive.
try {
  const LAYOUTS = join(ROOT, 'src/_layouts');
  const layouts = readdirSync(LAYOUTS)
    .filter((f) => f.endsWith('.njk') || f.endsWith('.html'))
    .map((f) => ({ path: `src/_layouts/${f}`, content: readFileSync(join(LAYOUTS, f), 'utf8') }));
  const { errors: ae, warnings: aw } = validateTemplateA11y(layouts);
  for (const e of ae) err(e.message);
  for (const w of aw) warn(w.message);
} catch (e) {
  err(`Static template a11y lint failed: ${e.message}`);
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
  // Map a check-standards `{message, descriptor?}` entry onto a report-model Finding (#431). The
  // descriptor's `kind` becomes the `ruleId` and its `file` the location, so the structured failure
  // class survives into SARIF/JUnit; the terminal/ANSI path below stays bespoke (only `--json` migrates).
  const toFinding = (severity) => (e, i) => reportFinding({
    id: `check-standards/${severity}/${i}`,
    severity,
    title: e.message,
    ruleId: e.descriptor?.kind,
    location: e.descriptor?.file ? { path: e.descriptor.file } : undefined,
    detail: e.descriptor ? JSON.stringify(e.descriptor) : undefined,
    source: 'check-standards',
  });
  const report = buildReport({
    id: 'check-standards',
    title: 'Web Everything — check:standards',
    sources: [reportSource({ id: 'check-standards', name: 'check:standards', kind: 'validator' })],
    sections: [reportSection({
      id: 'findings',
      title: 'Standards conformance findings',
      findings: [...errors.map(toFinding('error')), ...warnings.map(toFinding('warn'))],
    })],
  });
  // `report` is the #431 model-valid view (pipes through the #432 renderers + #434 SARIF/JUnit adapters);
  // `errors`/`warnings` stay for the existing #196 auto-fix feed that targets descriptors directly.
  console.log(JSON.stringify({ ok: errors.length === 0, summary, report, errors: shape(errors), warnings: shape(warnings) }, null, 2));
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
