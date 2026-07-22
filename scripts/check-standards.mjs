#!/usr/bin/env node
/**
 * check-standards.mjs — consistency & convention validator for Web Everything.
 *
 * Verifies the invariants that keep the spec (src/_data/*.json), the descriptions
 * (src/_includes/*-descriptions/*.njk), and the implementation in sync — so agents
 * (and humans) can't silently let documentation drift from code.
 *
 * Run: `npm run check:standards`  (exits 1 on any error; warnings don't fail)
 *
 * Flags (all leave the default no-flag whole-repo-strict run untouched — CI / close-out unchanged):
 *   --json                machine-readable failure feed (#095/#196)
 *   --scope=<session>     block only on THIS session's files vs its claim baseline (#952) — concurrent batching
 *   --local [--files=…]   per-lane gating for the parallel-batch orchestrator (#1144/#1147): `--files=<comma|space
 *                         list>` scopes the blocking set to findings on those files; `--local` additionally
 *                         demotes path-less GLOBAL/RELATIONAL findings (dup ids, the blockedBy cycle walk,
 *                         registry joins) to notes — a lane in its own worktree can't cause a cross-lane
 *                         invariant, so those are the MERGE gate's job, not the lane's.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { createRequire } from 'node:module';
import { renderInventory, spliceInventory } from './gen-inventory.mjs';
import { parseClaims, mineFiles, porcelainFiles, partitionFindings, partitionLocal } from './readiness/claimScope.mjs';
import { checkDemos } from './check-demos.mjs';
import { buildReport, source as reportSource, finding as reportFinding, section as reportSection } from './lib/buildReport.mjs';
import { loadBlocks } from './lib/blocks-loader.cjs';
import { loadIntents } from './lib/intents-loader.cjs';
import { loadResearch } from './lib/research-loader.cjs';
import { loadProtocols } from './lib/protocols-loader.cjs';
import { loadDemos } from './lib/demos-loader.cjs';
import { loadSemantics } from './lib/semantics-loader.cjs';
import { loadPresets } from './lib/presets-loader.cjs';
import { loadDataRegistry } from './lib/registry-loader.cjs';
import { loadAdapters } from './lib/adapters-loader.cjs';
import {
  BACKLOG_STATUSES, BACKLOG_KINDS, FIB, FILE, blockSpecFile,
  dMissingField, dUnresolvedRef, dMissingDescription, buildGraduatedKinds, validateBacklogItem, validatePolyglotWideningGate, isCanonicalGraduated, detectClassificationCollapse, computeNativeFirstConformance, computeDesignKnowledgeConformance,
  checkStatus, validateProjectTier, advisoryTierCrossCheck, validateProtocol, validatePreset, validateDesignSystem, validateIntent, validateCapability, validateCapabilityMatrix,
  validateReportsNotHidden, findCompiledShadows, permalinkSegment, validateViteProxyCoverage,
  validateModuleResolutionLock,
  validateRenderersNotPublished, validateReferenceRuntimeForms,
  validateNoDuplicateManifestKeys,
  findUnquotedColonScalars, lintBacklogItemRendering,
  RESEARCH_REVIEW_HORIZON_DEFAULT, deriveResearchFreshness,
  validateCapabilityPresence, validateRetirementShape,
  validatePlugDualMode, validateTemplateA11y, validateBlockImplConformance,
  validateBlockComposesTraits, COMPOSE_DENY_LIST,
  validateBlockExportShape,
  validatePlugWeFuiDrift, PLUG_SHARED_CORE_FILES,
  scanRepoLocusPrefixes, REPO_LOCUS_PREFIX_ENFORCED,
  classifySurfacePaths,
  validateUntrackedDerivedArtifacts, DERIVED_ARTIFACT_DIRS,
  duplicateBacklogNums,
  strandedHashesOnMain,
  validatePlaywrightContainerPin, extractPlaywrightContainerTags, PLAYWRIGHT_CONTAINER_PIN_REQUIRED_FILES,
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
// Backlog operational axis (BACKLOG_STATUSES) and the merged kind+sizing axis (BACKLOG_KINDS/FIB) are
// imported from ./check-standards-rules.mjs — the single definition shared with the backlog-rule unit
// tests (#251). See docs/agent/backlog-workflow.md → "Agile sizing".
const BLOCK_TYPES = new Set(['Store', 'Parser', 'Behavior', 'Directive', 'Component', 'Module']);

// ── Load specs ───────────────────────────────────────────────────────────────
const blocks = arr(loadBlocks()); // per-block specs src/_data/blocks/<id>.json, assembled (#882)
const plugs = arr(loadDataRegistry('plugs')); // per-plug specs src/_data/plugs/<id>.json, assembled (#1157)
const semantics = arr(loadSemantics()); // per-term specs src/_data/semantics/<slug>.json, assembled (#1146)
const research = arr(loadResearch()); // per-topic specs src/_data/researchTopics/<id>.json, assembled (#1145)
const protocols = arr(loadProtocols()); // per-protocol specs src/_data/protocols/<id>.json, assembled (#1146)
const presets = arr(loadPresets()); // per-preset specs src/_data/assemblerPresets/<name>.json, assembled (#1146)
const designSystems = arr(loadDataRegistry('designSystems')); // per-entry src/_data/designSystems/<id>.json (#1157)
const projects = arr(loadDataRegistry('projects')); // per-project specs src/_data/projects/<id>.json (#1157)
const intents = arr(loadIntents()); // per-intent specs src/_data/intents/<id>.json, assembled (#1145)
const capabilities = arr(loadDataRegistry('capabilities')); // per-capability specs src/_data/capabilities/<id>.json (#1157)
const adapters = arr(loadAdapters()); // per-adapter specs src/_data/adapters/<id>.json + _groups.json, assembled (#1938)
const demos = arr(loadDemos()); // per-demo specs src/_data/demos/<id>.json, assembled (#1146)
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
// Adapters render via src/adapter-pages.njk, which `include`s adapter-descriptions/<id>.njk by id (NOT
// "ignore missing") — a new adapter without its partial crashes the WHOLE Eleventy build. The gate is
// otherwise blind to that njk render, so a missing partial would only surface as a build crash (#1388,
// hit by the #1374 graph plugs). Mirror the block/plug/research coverage so the failure shifts left to a
// gate error. The page paginates collections.flatAdapters = adapters.flatMap(c => c.items), so iterate
// the same flat item set (adapters is the assembled [ { id, items: [ { id, … } ] } ] nested-group array,
// per-adapter files src/_data/adapters/<id>.json since #1938).
for (const cat of adapters)
  for (const a of (Array.isArray(cat.items) ? cat.items : []))
    if (a.id && !hasDesc('adapter-descriptions', a.id))
      err(`Adapter "${a.id}" has no src/_includes/adapter-descriptions/${a.id}.njk (src/adapter-pages.njk includes it by id; a missing partial crashes the Eleventy build, #1388)`,
        dMissingDescription('Adapter', a.id, `src/_includes/adapter-descriptions/${a.id}.njk`));

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
      dUnresolvedRef('Block', b.id, blockSpecFile(b.id), 'implementedBy', b.implementedBy, 'contract-form'));
  if (b.status === 'active' && !b.implementedBy)
    warn(`Block "${b.id}" is status:active but has no implementedBy (@frontierui/blocks impl reference)`);
}

// ── 3. Status / type enums ────────────────────────────────────────────────────
for (const b of blocks) {
  checkStatusInto('Block', b.id, b.status);
  if (b.type && !BLOCK_TYPES.has(b.type)) warn(`Block "${b.id}" has unusual type "${b.type}"`);
}
for (const p of plugs) checkStatusInto('Plug', p.id, p.status);

// ── 3a. Portfolio project tier — the importance axis (#2088, codified #portfolio-project-tiering) ──
// Orthogonal to project `status` (which stays deliberately outside LIFECYCLE). Every project carries an
// enum-validated `tier` (core | contextual | exploratory) by the named-consumer evidence bar; every
// non-exploratory project additionally names its consumer via a non-empty `tierEvidence` one-liner.
for (const p of projects)
  for (const e of validateProjectTier(p.id, p.tier, p.tierEvidence)) err(e.message, e.descriptor);

// Derived advisory tier cross-check (#2135, demoted from #2088 Fork 3 (c)) — WARN-ONLY. Joins the
// DECLARED benchmarkCoverage.projectDomainDemand[] domain→project edge to the live stamped tier and
// nudges when an `exploratory` project's domain shows benchmark demand. Never owns the tier value.
{
  const projectTierById = new Map(projects.map((p) => [p.id, p.tier]));
  const coverage = readJson('benchmarkCoverage.json') || {};
  const { warnings: advWarnings } = advisoryTierCrossCheck(coverage.projectDomainDemand, projectTierById);
  for (const w of advWarnings) warn(w.message, w.descriptor);
}

// ── 3b. composesBehaviors resolution (#936, Fork 2 of #933) ───────────────────
// A block's `traits[]` records the named behaviors it PROVIDES (`withSortableHeader`, …); the new
// `composesBehaviors[]` records the behaviors it CONSUMES. The de-facto behavior registry is the
// union of every provided `traits[].name` — each composesBehaviors entry must resolve to one, so a
// declared composition can't name a behavior that no block provides (the #933 "compose, don't
// hand-roll" signal). The legacy field name `composesTraits` is rejected — it collides with "The
// Map" (the trait-manifest concept, src/_data/traits.json) — authors must use `composesBehaviors`.
{
  const traitName = (t) => (typeof t === 'string' ? t : t && t.name);
  const providedBehaviors = new Set(
    blocks.flatMap((b) => (Array.isArray(b.traits) ? b.traits.map(traitName) : [])).filter(Boolean));
  for (const b of blocks) {
    if (b.composesTraits !== undefined)
      err(`Block "${b.id}" uses reserved field "composesTraits" — it collides with The Map (the trait manifest, src/_data/traits.json); use "composesBehaviors" (#936)`,
        dUnresolvedRef('Block', b.id, blockSpecFile(b.id), 'composesTraits', 'composesTraits', 'composesBehaviors'));
    if (b.composesBehaviors === undefined) continue;
    if (!Array.isArray(b.composesBehaviors)) {
      err(`Block "${b.id}" composesBehaviors must be an array of behavior names (or {name} objects)`,
        dUnresolvedRef('Block', b.id, blockSpecFile(b.id), 'composesBehaviors', String(b.composesBehaviors), 'array'));
      continue;
    }
    for (const entry of b.composesBehaviors) {
      const name = traitName(entry);
      if (!name)
        err(`Block "${b.id}" composesBehaviors entry has no name: ${JSON.stringify(entry).slice(0, 60)}`,
          dUnresolvedRef('Block', b.id, blockSpecFile(b.id), 'composesBehaviors', JSON.stringify(entry).slice(0, 40), 'trait manifest'));
      else if (!providedBehaviors.has(name))
        err(`Block "${b.id}" composesBehaviors "${name}" does not resolve to a provided trait (no block declares it in traits[]) — #936`,
          dUnresolvedRef('Block', b.id, blockSpecFile(b.id), 'composesBehaviors', name, 'trait manifest'));
    }
  }
}

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

// ── 5a. Semantics glossary COVERAGE (#1371 slice B of #1327; scope ratified #1343) ───────────────
// The glossary is the project's ubiquitous vocabulary of CONCEPTS. The concept-bearing registries —
// intents + protocols + capabilities — should each have a matching glossary term; a block/plug earns
// a term only when it opts in via `isConcept: true` (the #1343 contested-name carve, consumed by the
// #1368 curation pass). WARN-only (matches the other coverage warnings) so partial coverage is a valid
// state and the gate stays green while A1 (#1369 intents) / A2 (#1370 protocols) backfill it.
{
  // Normalize a name/term to its concept key: drop a trailing standard-kind suffix word, lowercase.
  // Mirrors the #1327 audit join (term vs name, suffix-stripped) so "Action Intent" ↦ term "Action".
  const KIND_SUFFIX = /\s+(Intent|Protocol|Plug|Capability|Block)$/i;
  const conceptKey = (s) => String(s || '').replace(KIND_SUFFIX, '').trim().toLowerCase();
  const termSet = new Set(semantics.map((t) => conceptKey(t.term)).filter(Boolean));
  const hasTerm = (name) => { const k = conceptKey(name); return !!k && termSet.has(k); };

  // Wholesale-scope concept registries — every in-scope entry should carry a term.
  for (const [label, list, getName] of [
    ['intent', intents, (x) => x.name],
    ['protocol', protocols, (x) => x.name],
    ['capability', capabilities, (x) => x.label || x.name],
  ]) {
    for (const item of list) {
      const nm = getName(item);
      if (!nm) continue;
      if (!hasTerm(nm))
        warn(`Glossary coverage: ${label} "${item.id}" ("${nm}") has no matching semantics term — add src/_data/semantics/<slug>.json { term, definition, usage } (warn-level, #1327)`);
    }
  }

  // isConcept opt-in — a block/plug flagged `isConcept: true` MUST have a glossary term (#1343 / #1368).
  for (const [label, list] of [['block', blocks], ['plug', plugs]]) {
    for (const item of list) {
      if (item.isConcept !== true) continue;
      const nm = item.name || item.id;
      if (!hasTerm(nm))
        warn(`Glossary coverage: ${label} "${item.id}" ("${nm}") is flagged isConcept:true but has no matching semantics term — add one (#1343 isConcept opt-in)`);
    }
  }
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
  // 2) references links — per-entry specs src/_data/references/<slug>.json, assembled (#1157).
  for (const group of loadDataRegistry('references') || [])
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

// ── 6b-ter. Design systems (#747 Fork-3-A / #871, theme+intents bundles, surfaced via /design-systems/) ──
// A thin `designSystems.json` rendering index pointing at manifests of shape
// `{ extends, themeTokens (DTCG ref), intentDefaults?, traitDefaults? }`. The per-entry field/status/
// reference rules + the manifest-shape checks (themeTokens resolves, extends resolves, optional fields)
// are the pure `validateDesignSystem`; the script injects the manifest reads (resolved from repo root,
// the DTCG ref resolved relative to its own manifest's dir).
const readManifest = (rel) => {
  const p = join(ROOT, rel);
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; }
};
const tokenRefResolves = (manifestRel, tokenRef) =>
  existsSync(join(dirname(join(ROOT, manifestRel)), tokenRef));
const designSystemIds = new Set(designSystems.map((d) => d.id).filter(Boolean));
const designSystemCtx = { projectById, intentById, designSystemIds, readManifest, tokenRefResolves };
for (const ds of designSystems) {
  const { errors: de, warnings: dw } = validateDesignSystem(ds, designSystemCtx);
  for (const e of de) err(e.message, e.descriptor);
  for (const w of dw) warn(w.message, w.descriptor);
}
dupCheck(designSystems, 'designSystems.json');

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
const intentCtx = { capabilityIds, intentById };
for (const intent of intents) {
  const { errors: ie, warnings: iw } = validateIntent(intent, intentCtx);
  for (const e of ie) err(e.message, e.descriptor);
  for (const w of iw) warn(w.message, w.descriptor);
}

dupCheck(backlog, 'backlog/');

// Backlog filenames are `NNN-slug.md`: NNN (item.num) is the stable unique id used in the URL.
// Enforce the prefix and that numbers don't collide, so authoring a new item can't silently reuse
// or drop an id. See docs/agent/backlog-workflow.md → "Authoring an item".
for (const item of backlog) {
  if (!item.num) err(`Backlog item "${item.id}" is missing the NNN- id prefix — rename to "<NNN>-${item.id}.md"`);
}
// #2248 — the duplicate-NNN tripwire, now a pure unit-tested detector (was inline). A collision silently drops
// one item from the loader's last-wins byNum Map, so it must ERROR (caught on the second colliding PR's CI).
for (const msg of duplicateBacklogNums(backlog)) err(msg);
// #2319 — hash-on-main invariant: a backlog file on origin/main with a non-numeric leading id means a land route
// bypassed JIT numbering (#2288) and stranded a hash. Read the MAIN tree (not the working tree) so in-lane
// pre-land hashes on a lane/* branch don't false-trip. Fail-SOFT: origin/main unresolvable (fresh/offline
// clone) → skip, never wedge the gate on a git hiccup.
try {
  const mainBacklog = execFileSync('git', ['ls-tree', '-r', '--name-only', 'origin/main', '--', 'backlog/'], { cwd: ROOT, encoding: 'utf8' })
    .split('\n').filter(Boolean);
  for (const msg of strandedHashesOnMain(mainBacklog)) err(msg);
} catch { /* origin/main not resolvable here — the drain's post-land assert still guards the land path */ }
// Every item's num — for `blockedBy`/parent resolution below (the dup check above owns collision reporting).
const seenNums = new Set(backlog.map((i) => i.num).filter(Boolean));

// graduatedTo value resolution (#247): the kind → {registry id-set, source file} table. A graduatedTo
// written in the compact `kind:slug` ref form is resolved against the matching registry, so a typo'd
// kind (`intnet:droplist`) or a stale slug is an ERROR — not silently accepted like a correct one.
// #614 tightened the rest: the field must LEAD with a resolvable entity reference (`none`, `kind:slug`,
// a repo path, or a bare registry id) so entity-graph joins + the G3 lineage walk can read it; pure prose
// where the entity is buried is non-canonical and surfaced as one aggregated nudge below (not per-item).
// Adapters live nested under the assembled `items[]` (per-adapter files since #1938; `adapters.json#<id>`
// stays a virtual graduatedTo anchor). (Table + rule body live in check-standards-rules.mjs
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
  knownNums: new Set(backlog.map((i) => i.num).filter(Boolean)), // every item's num — for parent resolution
  reportExists: (rel) => existsSync(join(ROOT, rel)),
};
for (const item of backlog) {
  const { errors: itemErrors, warnings: itemWarnings } = validateBacklogItem(item, backlogCtx);
  for (const e of itemErrors) err(e.message, e.descriptor);
  for (const w of itemWarnings) warn(w.message, w.descriptor);
  // Polyglot-widening start-gate (#2089 Fork 2(a) / #forward-target-start-gate, enforcement #2131):
  // a `polyglot-widening`-tagged item must carry the evidence edge or a carve-out. Frontmatter-only.
  const { errors: pgErrors, warnings: pgWarnings } = validatePolyglotWideningGate(item);
  for (const m of pgErrors) err(m);
  for (const m of pgWarnings) warn(m);
}
// #1247 — classification-axis loud-fail. If the merged `kind` axis is unpopulated for the whole
// collection (the #487 near-miss: consumers ahead of the producer → `kind` undefined everywhere), all
// three Prioritisation pools collapse to zero at once while the board still renders a silent empty
// tab. Catch that observable signature (open items exist but {batchable, tierB, sliceable} all zero) as
// a hard error rather than a quiet zero board — the during-migration window #487's after-cutover
// leftover-field backstop does not cover.
const collapse = detectClassificationCollapse(backlog);
if (collapse)
  err(`Backlog classification axis is unpopulated — ${collapse.openCount} open item(s) but 0 batchable / 0 Tier-B decision / 0 sliceable epic (the Prioritisation board would render a silent all-zero tab). ${collapse.kindlessOpen} open item(s) have no resolvable \`kind\`. This is the #487-class collapse: a consumer reading \`item.kind\`/\`item.tier\`/\`item.batchable\` ahead of the loader populating it, or a break in the batchable/tier derivation. Fix the producer (src/_data/backlog.js) before the board ships empty.`);

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

// #1137 — HUMAN-GATE shape + surfacing. A `humanGate` (a residual only a person can clear) demotes an
// open item out of Tier A like project-pending. Validate the shape (must be `{ kind, what }`, kind in the
// known set) so a typo doesn't silently mis-render, and surface the held set as one aggregate nudge — the
// human-action analogue of the D3 nudge above, so the standing /check shows what's parked on a person.
const { HUMAN_GATE_KINDS } = require(join(ROOT, 'src/_data/backlog.js'));
const humanGated = [];
for (const it of backlog) {
  if (!it.humanGate) continue;
  const ref = `#${it.num ?? it.id}`;
  const g = it.humanGate;
  if (typeof g !== 'object' || Array.isArray(g))
    err(`Backlog item "${it.id}" has a malformed \`humanGate\` — it must be a mapping \`{ kind, what }\` (kind ∈ ${[...HUMAN_GATE_KINDS].join('|')}; what = the one-line human action).`);
  else {
    if (!HUMAN_GATE_KINDS.has(g.kind))
      err(`Backlog item "${it.id}" has \`humanGate.kind: ${g.kind ?? '(missing)'}\` — must be one of ${[...HUMAN_GATE_KINDS].join('|')}.`);
    if (!g.what || typeof g.what !== 'string')
      err(`Backlog item "${it.id}" has a \`humanGate\` with no \`what\` — record the one-line human action (a runbook pointer / the feedback asked for) so the holder knows what to do.`);
  }
  // A human-gate only makes sense on an OPEN, otherwise-agent-ready item; on a resolved/active one it's stale.
  if (it.status !== 'open') warn(`Backlog item "${it.id}" carries a \`humanGate\` but status is \`${it.status}\` — clear the gate when the work is claimed/done (the gate holds an OPEN item out of Tier A).`);
  humanGated.push(`${ref} (${g && g.kind ? g.kind : '?'})`);
}
if (humanGated.length)
  warn(`${humanGated.length} open item(s) held by a HUMAN GATE — the only residual is a human-only action (credentialed deploy / agent-training feedback / setup / review), not a \`blockedBy\` edge, so the loader demotes them out of Tier A and the selector lists them under "Held — awaiting a human action". Do the action, then remove \`humanGate\`. Items: ${humanGated.join(', ')}`);

// #1267 — FRONT-A native-first conformance metric (platform-standards watch #1257). Count the tracked
// native equivalents that a WE standard has not yet repointed to (native-first, #031), so the next watch
// run is quantitative. A nudge, not an error: the registrations are tracked open work (#1261-#1265, #291).
try {
  const watch = JSON.parse(readFileSync(join(ROOT, 'src/_data/nativeFirstWatch.json'), 'utf8'));
  const m = computeNativeFirstConformance(watch);
  if (m.pending > 0)
    warn(`Front-A native-first conformance (platform-standards watch #1257): ${m.registered}/${m.total} tracked native equivalents are registered as their standard's resolver; ${m.pending} still pending — ${m.pendingList.join(', ')}. Each lands when its registration item flips \`registered: true\` in src/_data/nativeFirstWatch.json.`);
} catch { /* ledger missing/malformed → skip the metric (degrade, don't crash the gate) */ }

// #1586 — FRONT-A design-knowledge conformance metric (design-knowledge intake program #1585). Count the
// admitted authoritative sources not yet distilled into the codified #1034 design-critique rubric (#1587
// carries the provenance), so the next watch run is quantitative. A nudge, not an error: distillation is
// tracked open work (#1589, blockedBy the #1588 admission/credibility-weight decision).
try {
  const dkWatch = JSON.parse(readFileSync(join(ROOT, 'src/_data/designKnowledgeWatch.json'), 'utf8'));
  const dk = computeDesignKnowledgeConformance(dkWatch);
  if (dk.pending > 0)
    warn(`Front-A design-knowledge conformance (design-knowledge intake program #1585): ${dk.distilled}/${dk.total} admitted sources are distilled into the #1034 design-critique rubric; ${dk.pending} still pending — ${dk.pendingList.join(', ')}. Each lands when its distillation item fills \`distilledInto\` (the rubric axis/version) in src/_data/designKnowledgeWatch.json.`);
} catch { /* ledger missing/malformed → skip the metric (degrade, don't crash the gate) */ }

// #1275 — CTA INVARIANT (hard gate). Every OPEN item MUST carry a call-to-action: a pill on the
// Prioritisation table telling whoever picks it up what to do next, or a passive reason it's parked.
// The loader derives `hasCta` as the exact union of every renderable pill (tier badge / batch / slice /
// split / stop-the-world / human-gate / blocked-by / project-pending); if it's false the item would
// render a bare tier badge with no next step — the dead end #1004 surfaced (a project-pending epic whose
// only signal was "project pending", with no "slice me" cue). This makes that state IMPOSSIBLE to ship:
// every not-ready item must resolve to one of the known next-actions. To fix a flagged item, give it the
// state that earns a pill — a `blockedBy` edge (→ blocked), unsliced-epic shape (→ slice), `size > 8`
// story (→ split), a `relatedProject` to graduate (→ project-pending), or a `humanGate` (→ human action).
const ctaless = backlog
  .filter((it) => it.status === 'open' && !it.hasCta)
  .map((it) => `#${it.num ?? it.id} (${it.kind})`);
if (ctaless.length)
  err(`${ctaless.length} OPEN item(s) have NO call-to-action — they would render a bare tier badge with no next step (the #1004 dead-end class). Every not-ready item must resolve to a known next-action: build (Tier A) / ratify (decision) / slice (epic) / split (story>8) / unblock (blockedBy) / graduate the project (relatedProject) / clear a human gate. Fix each item's state so a pill renders. Items: ${ctaless.join(', ')}`);

// ── 6d-bis. Per-item RENDERING lints (#290 raw-HTML · #441 buried-fork · mis-flagged-batchable · #845 ──
// bad-body-links) — the structural/rendering checks that operate on ONE item's body, consolidated into the
// shared `lintBacklogItemRendering` (#845) so the whole-repo gate and the scoped `check:standards --item NNN`
// validator emit the SAME findings. One raw-body read per item feeds all four (was four separate passes).
// The frontmatter unquoted-colon scan stays its own file-driven loop below (a malformed-YAML item is
// dropped by the loader, so it isn't in `backlog` at all — it must be caught by scanning files directly).
for (const item of backlog) {
  if (!item.id) continue;
  const p = join(ROOT, 'backlog', `${item.id}.md`);
  if (!existsSync(p)) continue;
  const body = readFileSync(p, 'utf8').replace(/^---\n[\s\S]*?\n---\n/, '');
  const { errors: itemErr, warnings: itemWarn } = lintBacklogItemRendering({ item, body });
  for (const m of itemErr) err(m);
  for (const m of itemWarn) warn(m);
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

// ── 6d-sexies. Optional `scope:` predicted touch-set (#x53zzf9) ──
// `scope: ["src/x/", "docs/y/"]` is the item's PREDICTED file-scope (repo-relative path prefixes) a probe
// agent writes once so the deterministic conveyor dispatcher (scripts/readiness/dispatch-plan.mjs) can hold
// overlapping items apart by script. Optional — but WHEN present it must be an array of strings (the shape the
// dispatcher's overlap check reads). The loader NORMALIZES a wrong type to `undefined`, which would hide the
// author error, so this reads the RAW frontmatter (like the unquoted-colon scan above) to catch a bad type at
// author time. Mirrors the blockedBy shape rule below.
{
  const matterFm = require('gray-matter');
  for (const file of readdirSync(join(ROOT, 'backlog')).filter((f) => f.endsWith('.md'))) {
    let raw;
    try { raw = matterFm(readFileSync(join(ROOT, 'backlog', file), 'utf8')).data; }
    catch { continue; } // a malformed-YAML item is already reported by the unquoted-colon scan above
    const scope = raw?.scope;
    if (scope === undefined) continue;
    const id = file.replace(/\.md$/, '');
    if (!Array.isArray(scope)) {
      err(`Backlog item "${id}" scope must be an array of repo-relative path prefixes (e.g. ["src/backlog-view/", "docs/agent/"])`);
      continue;
    }
    // An EMPTY scope is meaningless and is the one value where the two halves could disagree — the loader
    // collapses [] → undefined (unscoped) while a naive shape check would pass it. Error at author time so [] can
    // never reach the loader OR the dispatcher: an unscoped item runs only on the dispatcher's SERIAL FLOOR
    // (alone, in an idle pool — #2613), so to earn parallelism, omit the field for now or list real prefixes.
    if (scope.length === 0) {
      err(`Backlog item "${id}" scope is empty — an empty scope is meaningless (the dispatcher reads absent-or-empty as unscoped: it runs on the serial floor, one at a time). Omit the field, or list real repo-relative path prefixes.`);
      continue;
    }
    if (scope.some((p) => typeof p !== 'string'))
      err(`Backlog item "${id}" scope must contain only strings — every entry is a repo-relative path prefix (e.g. "src/backlog-view/")`);
  }
}

// ── 6d-ter. blockedBy dependency edges (#248) ──
// `blockedBy: ["NNN", …]` is a directional prerequisite edge ("this can't start until NNN is
// resolved"), making the backlog a real DAG that a deterministic readiness function (#249/#250)
// can score without an LLM. Guard the graph's integrity: every edge must resolve to a real item,
// never point at itself, and never form a cycle (the readiness algorithm assumes acyclicity).
const blockedEdges = new Map(); // num -> [target nums], for the cycle walk
const statusByNum = new Map(backlog.map((i) => [i.num, i.status]));
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
  // Stale-block guard: a non-resolved item whose blockedBy edges are ALL resolved is no longer actually
  // blocked — the prerequisite landed but the edge (and any `childlessReason: blocked`) was never updated.
  // This is the #1210 trap, and it's the failure mode the CHILDLESS_REASONS exemption above could mask, so
  // surface it here. Partial-resolved is normal (prereqs land one at a time), so only flag a FULLY cleared
  // block. The fix: start the item, or re-point blockedBy at the genuine remaining open dependency.
  if (item.status !== 'resolved' && targets.length && targets.every((t) => statusByNum.get(t) === 'resolved'))
    warn(`Backlog item "${item.id}" is still marked blocked but every blockedBy target (${targets.map((t) => `#${t}`).join(', ')}) is resolved — the block is stale. Start it, or re-point blockedBy at the real remaining open dependency (and clear \`childlessReason: blocked\` if it no longer applies).`);
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

// Parent-deadlock guard (#142): a child must never list its own EPIC parent in `blockedBy`. An epic
// resolves only AFTER all its children (the no-open-slice rollup guard below) — so "child blocked until
// the epic resolves" is an unbreakable cycle the plain blockedBy walk can't see (the edge is implicit in
// the parent rollup, not in `blockedEdges`): the epic waits on the child, the child waits on the epic.
// Scoped to a child whose parent is `kind: epic` — a SLICED STORY/decision parent resolves on its own
// merits, so "wait for the parent's foundational work" is a legitimate edge there and is NOT flagged.
// Scoped to non-resolved children: a resolved one already escaped the deadlock, so flagging it is noise.
const kindByNum = new Map(backlog.map((i) => [i.num, i.kind]));
for (const item of backlog) {
  if (item.status === 'resolved' || item.parent === undefined || !Array.isArray(item.blockedBy)) continue;
  const parentNum = String(item.parent);
  if (kindByNum.get(parentNum) !== 'epic') continue;
  if (item.blockedBy.some((raw) => String(raw) === parentNum))
    err(`Backlog item "${item.id}" lists its own epic parent #${parentNum} in \`blockedBy\` — a deadlock: an epic resolves only after all its children, so the child can never start. The \`parent: ${parentNum}\` edge already expresses the rollup; drop #${parentNum} from blockedBy (re-point it at the real open prerequisite if one exists).`);
}

// Build the parent→children index once (reused by the epic↔child coherence block below).
const childrenOf = new Map(); // parent num -> [child item, …]
for (const item of backlog) {
  if (item.parent !== undefined) {
    const p = String(item.parent);
    if (!childrenOf.has(p)) childrenOf.set(p, []);
    childrenOf.get(p).push(item);
  }
}

// Workflow-intent invariants (#2084) — the cross-item / clock-needing rules the per-item schema validator
// cannot see: sliced-epic sizing (the double-count guard, formerly inline here) + born-active settlement
// TTL (formerly only a check:health O1 candidate). Single tested source in scripts/lib/workflow-invariants
// (standalone: `npm run check:backlog-workflow`).
try {
  const { validateWorkflowInvariants } = require('./lib/workflow-invariants.cjs');
  const today = new Date().toISOString().slice(0, 10);
  const { errors: we, warnings: ww } = validateWorkflowInvariants(backlog, { today });
  for (const e of we) err(e.message, e.descriptor);
  for (const w of ww) warn(w.message, w.descriptor);
} catch (e) {
  err(`Backlog workflow-intent invariants check failed: ${e.message}`);
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
  if (item.kind !== 'epic') continue;
  const kids = childrenOf.get(item.num) || [];
  if (!kids.length) continue;
  const openKids = kids.filter((k) => k.status !== 'resolved');
  if (item.status === 'resolved' && openKids.length)
    err(`Backlog item "${item.id}" is a resolved epic but has ${openKids.length} open child slice(s) (${openKids.map((k) => `#${k.num}`).join(', ')}) — a closed umbrella with live work under it. Reopen the epic or resolve/re-parent the open child(ren).`);
  else if (item.status !== 'resolved' && (item.blockedBy?.length) && !openKids.length && !CHILDLESS_REASONS.has(item.childlessReason))
    err(`Backlog item "${item.id}" is a blocked epic with no open children and no childlessReason — set childlessReason: ${[...CHILDLESS_REASONS].join('|')} so the board shows why it's stalled, or add the next slice.`);
  else if (item.status !== 'resolved' && !openKids.length && !item.ongoing && !CHILDLESS_REASONS.has(item.childlessReason))
    warn(`Backlog item "${item.id}" is an epic whose every child is resolved ('all slices done') — reconcile it: resolve the epic (its scope is delivered) or scaffold the next slice.`);
  // An `ongoing: true` epic (a perpetual program, e.g. the flagship exercise apps) is intentionally never
  // a resolve cue — between slices it legitimately has every child resolved without being "done".
  // Likewise an epic that DECLARES a `childlessReason` (blocked / undecided / untriaged / program) is in a
  // stated steady state — its remaining scope can't be carved yet (it's blocked) or isn't a "done" signal —
  // so it's exempt from the resolve nudge too. Otherwise a blocked epic clears branch A (it gave its reason)
  // only to be told by branch C to resolve — the contradiction of "stalled" and "done" at once.
}

// A program's title is a short bare NAME, not a one-line pitch (docs/agent/backlog-workflow.md →
// "Naming — a program's title is a short bare name, no subtitle"). A program (an epic with `ongoing:
// true` or `childlessReason: program`) is cited for the life of the constellation, so its H1 must read
// as a name — no `—`/`–`/`:` subtitle clause AND no `(parenthetical)` aside. The elaboration (lens shape,
// front-A/B mechanics, the "cards only" discipline) belongs in the body, not the title. (User directive
// 2026-06-21, extended 2026-06-22 to parentheticals.)
// Match a separator FOLLOWED by a space — `Name: clause`, `Name — clause`, `Name – clause` — regardless
// of a leading space, so the unspaced `conversion: register …` form is caught too (the prior `\s+[—–:]\s+`
// required spaces on BOTH sides and silently missed it; #1442). `—`/`–` are em/en dashes only, so a
// hyphenated word (`Block-model`, `Self-Driven`) never trips it. Also flag any `(` — a bare name carries
// no parenthetical aside; the domain belongs IN the name (`Loan-origination exercise app`), not after it.
for (const item of backlog) {
  if (item.kind !== 'epic') continue;
  if (!(item.ongoing === true || item.childlessReason === 'program')) continue;
  const m = (item.title || '').match(/[—–:]\s|\(/);
  if (m)
    err(`Backlog item "${item.id}" is a program but its title carries a subtitle/aside ("${m[0].trim()}") — a program's H1 must be a short bare name (no \`—\`/\`–\`/\`:\` clause, no \`(parenthetical)\`). Fold the elaboration into the opening paragraph and keep the title a name (docs/agent/backlog-workflow.md → Programs → Naming).`,
        { kind: 'program-title-subtitle', file: `backlog/${item.id}.md` });
}

// No epic may embed "needs a decision" as its childless reason. An open design decision that gates an
// epic's slicing is a first-class `kind: decision` work item (the plan of record — never plan mode, never
// an inline body fork), and the epic depends on it through a `blockedBy` edge — NOT a `childlessReason:
// undecided` shortcut that hides the fork inside the umbrella. (User directive 2026-06-20; mirrors the
// "No Decision+Epic Conflation" rule. docs/agent/backlog-workflow.md → decisions are work items.)
for (const item of backlog) {
  if (item.childlessReason === 'undecided')
    err(`Backlog item "${item.id}" has childlessReason: undecided — an epic must not embed an open decision as its slicing blocker. Carve the fork into its own \`kind: decision\` item and point this epic's \`blockedBy\` at it (then drop childlessReason). If the decision is already resolved, just drop childlessReason so the epic shows as ready to slice.`);
}

// `unsplittableReason` — the story-side mirror of an epic's `childlessReason` (src/_data/backlogMeta.js
// → unsplittableReasonMeta). A `/split` run that rules an oversized story could-not-split records the
// reason to clear the split flag (so the board stops re-flagging it). It's only meaningful on an OPEN
// story in the should-split band (size > 8) — anywhere else it's a misplaced field that would silently
// do nothing — and its value must be a known reason. (docs/agent/backlog-workflow.md → "Splitting".)
// `undecided` is intentionally NOT a valid unsplittable reason: a story that can't be split because a
// buried fork would scatter across the slices must carve that fork into a `kind: decision` item and gate
// on it via `blockedBy` — same rule as the epic side above — not park behind an inline "needs decision".
const UNSPLITTABLE_REASONS = new Set(['foundational', 'atomic', 'fixture']);
for (const item of backlog) {
  if (item.unsplittableReason === undefined) continue;
  if (item.unsplittableReason === 'undecided')
    err(`Backlog item "${item.id}" has unsplittableReason: undecided — a buried fork that blocks splitting is a first-class \`kind: decision\` item, not an inline reason. Carve the decision and point this story's \`blockedBy\` at it, then re-run /split once it's resolved.`);
  else if (!UNSPLITTABLE_REASONS.has(item.unsplittableReason))
    err(`Backlog item "${item.id}" has unsplittableReason: "${item.unsplittableReason}" — not a known reason. Use one of: ${[...UNSPLITTABLE_REASONS].join('|')}.`);
  else if (item.kind !== 'story' || typeof item.size !== 'number' || item.size <= 8 || item.status === 'resolved')
    err(`Backlog item "${item.id}" has unsplittableReason but is not an open oversized story (kind: story, size > 8) — the field only clears the /split flag there. Drop it, or re-size/re-kind the item.`);
}

// Date↔status coherence: dateResolved only makes sense on a resolved item (the burndown
// plots resolutions; a stray date on an open item would mis-place it on the chart).
for (const item of backlog) {
  if (item.dateResolved && item.status !== 'resolved')
    err(`Backlog item "${item.id}" has dateResolved "${item.dateResolved}" but status is "${item.status}" — clear the date or set status: resolved.`);
}

// shortTitle length bound (#2549): the console's scanning surfaces render `shortTitle ?? title`, so a
// short title must stay glanceable (3–5 words, ≤ 42 chars). A too-long one defeats the point — warn (not
// err: it still renders, just isn't scannable). An empty shortTitle should be dropped, not kept as noise.
const SHORT_TITLE_MAX = 42;
for (const item of backlog) {
  if (item.shortTitle === undefined) continue;
  if (typeof item.shortTitle !== 'string' || item.shortTitle.trim() === '')
    warn(`Backlog item "${item.id}" has an empty/non-string shortTitle — drop the field (surfaces fall back to the full title).`);
  else if (item.shortTitle.length > SHORT_TITLE_MAX)
    warn(`Backlog item "${item.id}" shortTitle is ${item.shortTitle.length} chars (> ${SHORT_TITLE_MAX}) — tighten it to a glanceable 3–5 words, or drop it to fall back to the title.`);
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

// ── 6e-ii. Untracked derived artifacts — local-vs-CI divergence guard (#2180) ──────────────────────
// `check:standards` reads the working tree. On a dev machine, authored-but-never-committed files in
// `reports/`, `src/_data/researchTopics/`, or `src/_includes/research-descriptions/` make existence and
// inventory checks pass locally while a fresh CI clone (no untracked files) fails. This sub-check
// surfaces that gap BEFORE push, so the developer can commit the paired artifacts. The git invocation
// lives here (an fs concern); the pure classifier lives in validateUntrackedDerivedArtifacts (#2180).
// Skipped when `git ls-files` is unavailable (e.g. non-git environments).
try {
  const untrackedRaw = execFileSync(
    'git', ['ls-files', '--others', '--exclude-standard', '--', ...DERIVED_ARTIFACT_DIRS],
    { cwd: ROOT, encoding: 'utf8' },
  );
  const untrackedPaths = untrackedRaw.split('\n').filter(Boolean);
  const { errors: ue } = validateUntrackedDerivedArtifacts(untrackedPaths);
  for (const e of ue) err(e.message, e.descriptor);
} catch (e) {
  // `git` unavailable or not a git repo — skip gracefully (not a gate failure).
}

// ── 6f. Repo-locus prefix on code-path references (#884, enforces #883; #880 slice B) ─
// Every code-path reference in backlog/*.md + reports/*.md must carry a `<repo>:` locus marker so its
// constellation repo is unambiguous in chat / raw markdown. The fs reads stay here; the carve-out scan
// is the pure `scanRepoLocusPrefixes`.
//
// Emit ONE finding PER FILE (#1389), each keyed to its own `descriptor.file`. The earlier single
// aggregate line carried a `files: [...]` list spanning the whole corpus, which `--scope` (#952) could
// only classify all-or-nothing: if ANY bundled file was the session's, every other session's bare ref
// blocked too (false red); if none was dirty-attributable (e.g. the session already committed its file),
// the session's OWN breakage demoted to a note (false green — the #1389 masking). Per-file keying lets
// `--scope` attribute each correctly — the session's files block, concurrent files demote.
{
  const docs = [];
  for (const f of readdirSync(join(ROOT, 'backlog')).filter((n) => n.endsWith('.md')))
    docs.push({ file: `backlog/${f}`, content: readFileSync(join(ROOT, 'backlog', f), 'utf8') });
  for (const f of reportFiles) docs.push({ file: `reports/${f}`, content: readFileSync(join(REPORTS, f), 'utf8') });
  for (const finding of scanRepoLocusPrefixes(docs)) {
    const msg =
      `${finding.count} code-path reference(s) in ${finding.file} lack a <repo>: locus prefix ` +
      `(#883 convention; #884 detection, #885 enforces) — e.g. ${finding.sample}`;
    const descriptor = { kind: 'repo-locus', file: finding.file };
    if (REPO_LOCUS_PREFIX_ENFORCED) err(msg, descriptor);
    else warn(msg, descriptor);
  }
}

// ── 6g. Catalog-index completeness — every artifact type is reachable from a top-level index + nav ──
// The recurring "expose everything" drift (#1803): a type ships detail pages (/<type>/{id}/) but never
// gets a top-level index (/<type>/) or a nav entry, so it's only reachable by deep-linking. Derive the
// detail-page type set from the templates themselves (a permalink "<type>/{{ …id }}/" right after the
// quote — nested permalinks like "capabilities/adapters/{{ … }}/" don't match, by design) so a NEW
// registry can't silently skip its index. A type is satisfied by (a) an index resolving to /<type>/
// (a src/<type>.njk, or any template with permalink "<type>/") and (b) a weNavLink("/<type>/", …) in
// base.njk — unless it's on an explicit exemption allowlist WITH a reason.
{
  const SRC = join(ROOT, 'src');
  const njk = readdirSync(SRC).filter((f) => f.endsWith('.njk'));
  const fileContent = new Map(njk.map((f) => [f, readFileSync(join(SRC, f), 'utf8')]));
  const navContent = fileContent.get('_layouts/base.njk') // base.njk lives under _layouts; read it directly
    ?? readFileSync(join(SRC, '_layouts', 'base.njk'), 'utf8');

  // A type is exempt from the INDEX and/or NAV requirement only with a stated reason.
  const INDEX_EXEMPT = {
    projects: 'the homepage (/) is the projects catalog — it lists every project grouped by category',
  };
  const NAV_EXEMPT = {
    projects: 'reached from the homepage hero/grid, not the Standards menu (its catalog is /)',
  };

  // Derive detail-page types: permalink "<type>/{{ …id }}/" anchored right after the opening quote.
  const detailTypes = new Set();
  for (const content of fileContent.values()) {
    const m = content.match(/permalink:\s*["']([a-z0-9-]+)\/\{\{/);
    if (m) detailTypes.add(m[1]);
  }

  for (const type of [...detailTypes].sort()) {
    const hasIndexFile = existsSync(join(SRC, `${type}.njk`));
    const hasIndexPermalink = [...fileContent.values()].some((c) =>
      new RegExp(`permalink:\\s*["']${type}/["']`).test(c));
    const hasIndex = hasIndexFile || hasIndexPermalink;
    const hasNav = navContent.includes(`weNavLink("/${type}/"`) || navContent.includes(`weNavLink('/${type}/'`);

    if (!hasIndex && !(type in INDEX_EXEMPT))
      err(`Catalog type "${type}" has detail pages (/${type}/{id}/) but no top-level index resolving to /${type}/ ` +
          `— add a src/${type}.njk index (mirror src/adapters.njk), or add it to INDEX_EXEMPT in check-standards.mjs with a reason (#1803).`,
          { kind: 'catalog-index', file: `src/${type}.njk` });
    if (!hasNav && !(type in NAV_EXEMPT))
      err(`Catalog type "${type}" has detail pages but no nav entry — add weNavLink("/${type}/", "…") to src/_layouts/base.njk, ` +
          `or add it to NAV_EXEMPT in check-standards.mjs with a reason (#1803).`,
          { kind: 'catalog-nav', file: 'src/_layouts/base.njk' });
  }
}

// ── 7. AGENTS.md inventory must be in sync (generated, not hand-edited) ────────
try {
  const agentsPath = join(ROOT, 'AGENTS.md');
  const current = readFileSync(agentsPath, 'utf8');
  if (spliceInventory(current, renderInventory()) !== current)
    // `global: true` — AGENTS.md is a DERIVED artifact the integrator regenerates ONCE after merge; an
    // isolated `--local` lane never runs `gen:inventory`, so this defers to the per-merge gate (#1159).
    err('AGENTS.md inventory is stale — run `npm run gen:inventory`', { kind: 'inventory', file: 'AGENTS.md', global: true });
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

// ── 8c. Block contract↔impl drift conformance (#659, the #606/#641 plugs analogue) ─
// WE blocks are pure protocols; the impl lives in FUI (`implementedBy: @frontierui/blocks/…`).
// When the sibling FUI repo is checked out, every `implementedBy` must resolve to a real impl
// path — a reference that no longer resolves is contract↔impl drift (#170, blocks edition). The
// content arm is detect-or-skip: a WE tree without ../frontierui (CI without the sibling repo) is
// expected, not a failure (mirrors 8b). The fs resolution lives here; the pure rule is
// `validateBlockImplConformance`.
{
  const fuiBlocks = join(ROOT, '..', 'frontierui', 'blocks');
  const fuiPresent = existsSync(fuiBlocks);
  // Resolve `@frontierui/blocks/<rel>` to a real path: a `.ext` reference is a file; an extension-less
  // reference is a dir (optionally with an index module). null when FUI isn't checked out (→ skip).
  const resolveImpl = (implementedBy) => {
    if (!fuiPresent) return null;
    const rel = implementedBy.replace(/^@frontierui\/blocks\//, '').replace(/\/$/, '');
    const target = join(fuiBlocks, rel);
    if (existsSync(target)) return true;
    if (!/\.[a-z]+$/.test(rel)) return ['index.ts', 'index.js'].some((f) => existsSync(join(target, f)));
    return false;
  };
  const blockImpl = blocks
    .filter((b) => b.implementedBy)
    .map((b) => ({ id: b.id, implementedBy: b.implementedBy, implPresent: resolveImpl(b.implementedBy) }));
  // Skip silently when ../frontierui isn't checked out (mirrors 8b) — the content arm just can't run.
  const { errors: be, warnings: bw } = validateBlockImplConformance(blockImpl);
  for (const e of be) err(e.message, e.descriptor);
  for (const w of bw) warn(w.message, w.descriptor);

  // ── 8d. compose-don't-hand-roll deny-list (#937, Fork 1 of #933) ──
  // The inverse of 8c/§3b: a block that hand-rolls behaviour it should have COMPOSED. Curated by block
  // id (COMPOSE_DENY_LIST), so we only read the FUI source of the named targets — concatenate the impl
  // dir's *.ts so a multi-file signature sees the whole surface. The pure rule does the matching; this
  // just gathers source (detect-or-skip when ../frontierui is absent, mirrors 8c).
  {
    const targets = new Set(COMPOSE_DENY_LIST.flatMap((r) => r.appliesTo));
    const readBlockSource = (implementedBy) => {
      if (!fuiPresent || !implementedBy) return null;
      const rel = implementedBy.replace(/^@frontierui\/blocks\//, '').replace(/\/$/, '');
      const target = join(fuiBlocks, rel);
      // implementedBy may name a file or a dir; scan the impl directory's TS either way.
      const dir = /\.[a-z]+$/.test(rel) ? dirname(target) : target;
      if (!existsSync(dir)) return null;
      const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((ent) => {
        const p = join(d, ent.name);
        if (ent.isDirectory()) return walk(p);
        return /\.ts$/.test(ent.name) && !/\.test\.ts$/.test(ent.name) ? [readFileSync(p, 'utf8')] : [];
      });
      return walk(dir).join('\n');
    };
    const composeInput = blocks
      .filter((b) => targets.has(b.id))
      .map((b) => ({ id: b.id, composesBehaviors: b.composesBehaviors, source: readBlockSource(b.implementedBy) }));
    const { errors: ce, warnings: cw } = validateBlockComposesTraits(composeInput);
    for (const e of ce) err(e.message, e.descriptor);
    for (const w of cw) warn(w.message, w.descriptor);
  }

  // ── 8e. Block export-shape drift (#927) — declared `exports` vs the resolved FUI barrel surface ──
  // The deeper #170 arm #659 deferred: not just "does the impl resolve?" (8c) but "does it export the
  // surface the contract declares?". Scoped to barrel blocks (implementedBy `…/index.ts` + a declared
  // `exports`); a real TS program resolves the barrel's actual exports so `export type *` and
  // `@webeverything/contracts/…` re-exports are FOLLOWED (a regex can't). Detect-or-skip when FUI is
  // absent. Warn-first (the pure rule gates on EXPORT_SHAPE_ENFORCED). Renderer/file-pointer blocks have
  // no enumerable barrel → un-coverable here (#1164).
  {
    const barrelBlocks = blocks.filter(
      (b) => b.implementedBy && /\/index\.ts$/.test(b.implementedBy) && Array.isArray(b.exports) && b.exports.length,
    );
    // Build ONE TS program over all barrel entry files, using FUI's tsconfig so the path-mappings
    // (@webeverything/contracts/*, @core/*, …) resolve the re-export specifiers. Wrapped so any TS/FS
    // failure degrades to skip (actualExports=null), never crashes the gate.
    let resolveExports = () => null;
    if (fuiPresent) {
      try {
        const ts = createRequire(import.meta.url)('typescript');
        const fuiRoot = join(ROOT, '..', 'frontierui');
        const entries = barrelBlocks.map((b) =>
          join(fuiRoot, b.implementedBy.replace(/^@frontierui\/blocks\//, 'blocks/')),
        );
        const cfgPath = join(fuiRoot, 'tsconfig.json');
        const cfg = ts.readConfigFile(cfgPath, ts.sys.readFile);
        const parsed = ts.parseJsonConfigFileContent(cfg.config ?? {}, ts.sys, fuiRoot);
        const program = ts.createProgram(entries, {
          ...parsed.options,
          noEmit: true,
          skipLibCheck: true,
          allowJs: true,
        });
        const checker = program.getTypeChecker();
        resolveExports = (absPath) => {
          const sf = program.getSourceFile(absPath);
          if (!sf) return null;
          const sym = checker.getSymbolAtLocation(sf);
          if (!sym) return null;
          return checker.getExportsOfModule(sym).map((s) => s.getName());
        };
      } catch {
        resolveExports = () => null; // TS unavailable / config unreadable → skip the whole arm
      }
    }
    const exportInput = barrelBlocks.map((b) => ({
      id: b.id,
      implementedBy: b.implementedBy,
      declaredExports: b.exports,
      actualExports: resolveExports(join(ROOT, '..', 'frontierui', b.implementedBy.replace(/^@frontierui\/blocks\//, 'blocks/'))),
    }));
    const { errors: ee, warnings: ew } = validateBlockExportShape(exportInput);
    for (const e of ee) err(e.message, e.descriptor);
    for (const w of ew) warn(w.message, w.descriptor);
    // Renderer / file-pointer blocks have no enumerable barrel — logged un-coverable (#1164), not failed.
    const uncoverable = blocks.filter(
      (b) => b.implementedBy && Array.isArray(b.exports) && b.exports.length && !/\/index\.ts$/.test(b.implementedBy),
    );
    if (fuiPresent && uncoverable.length)
      warn(`Block export-shape arm (#927): ${uncoverable.length} non-barrel block(s) are un-coverable (no enumerable index barrel) — renderer/file-pointer impls, tracked by #1164.`);
  }
}

// ── 8f. Plug contract↔impl drift conformance (#1309, the §8c/#659 plugs analogue) ──
// WE owns the plug platform layer; FUI ports each plug domain UP to the WE contract (#1250 reconcile
// epic). Two arms, both detect-or-skip when ../frontierui is absent (mirrors 8c): (1) every we:plugs/
// <domain> must have a fui:plugs/<domain> impl dir; (2) the declared byte-identical plug-core contract
// files (PLUG_SHARED_CORE_FILES, #1304/#1350) must match FUI byte-for-byte. The fs reads live here; the
// pure rule is `validatePlugWeFuiDrift`. Lands after the reconciliation slices, so it is green.
{
  const wePlugsDir = join(ROOT, 'plugs');
  const fuiPlugsDir = join(ROOT, '..', 'frontierui', 'plugs');
  const fuiPresent = existsSync(fuiPlugsDir);
  // Infrastructure entries under plugs/ that are not reconcilable WE↔FUI domains.
  const INFRA = new Set(['core', '__tests__', 'utils']);
  const domains = existsSync(wePlugsDir)
    ? readdirSync(wePlugsDir, { withFileTypes: true })
        .filter((e) => e.isDirectory() && !INFRA.has(e.name))
        .map((e) => ({ domain: e.name, implPresent: fuiPresent ? existsSync(join(fuiPlugsDir, e.name)) : null }))
    : [];
  const parityFiles = PLUG_SHARED_CORE_FILES.map((rel) => {
    const weFile = join(ROOT, rel);
    const fuiFile = join(ROOT, '..', 'frontierui', rel);
    let identical = null; // FUI absent, or the WE file itself is missing → skip
    if (fuiPresent && existsSync(weFile)) {
      // A declared-shared file missing on the FUI side is itself drift; else compare bytes.
      identical = existsSync(fuiFile) && readFileSync(weFile, 'utf8') === readFileSync(fuiFile, 'utf8');
    }
    return { file: rel, identical };
  });
  const { errors: pe, warnings: pw } = validatePlugWeFuiDrift({ domains, parityFiles });
  for (const e of pe) err(e.message, e.descriptor);
  for (const w of pw) warn(w.message, w.descriptor);
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
  // Proxy keys are the only quoted, path-like object keys whose value is a proxy entry — either an
  // inline `: {` block or the shared `: proxyToEleventy(` helper that DRYs the Eleventy-forwarded
  // entries. (resolve aliases map to string values, not entries; other plugins aren't quoted path
  // keys.) Collect them as the authoritative set of routes Vite forwards to 8080.
  const proxyKeys = [...viteCfg.matchAll(/^\s*(['"])(\^?\/[^'"]*)\1\s*:\s*(?:\{|proxyToEleventy\()/gm)].map((m) => m[2]).join(' ');
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

// ── 9a-rules. Statute-layer integrity gate (#1828 resolution + #2083 duplicates/orphans/substance) ──
// The statute layer (docs/agent/platform-decisions.md + 3 siblings) renders at /rules/, and ~229
// `codifiedIn:` frontmatter values across backlog/*.md cite anchors in it. platform-decisions.md is
// edited every decision-resolve, so a renamed heading would silently 404 every inbound cite; a `{#id}`
// defined twice renders a duplicate HTML id; an unreferenced named anchor is a dead cluster; a cited
// anchor with no body is a rule in name only. All four rules live in scripts/lib/validate-rules-anchors.cjs
// (standalone: `npm run check:statute`), re-using the loader's anchor extraction so the gate and the
// rendered page can never disagree.
try {
  const { runStatuteCheck } = require('./lib/validate-rules-anchors.cjs');
  const { errors: re, warnings: rw } = runStatuteCheck();
  for (const e of re) err(e.message, e.descriptor);
  for (const w of rw) warn(w.message, w.descriptor);
} catch (e) {
  err(`Statute-layer integrity check failed: ${e.message}`);
}

// ── 9a′. Agent-memory freshness (#2087) ──
// The hand-curated leaves under .claude/agent-memory/ carry no freshness guarantee: a leaf can cite a
// decision the project has since ruled the other way, or a statute anchor renamed out from under it, and
// an agent applies the stale hook silently. This folds the freshness audit (dangling `#NNNN`, cite to an
// unsettled `kind: decision`, orphaned `docs/agent/*.md#anchor`) into the everyday gate. WARNINGS only —
// a curation nudge, never build-breaking (a leaf may deliberately cite an open decision). Standalone:
// `npm run check:memory-freshness`.
try {
  const { runMemoryFreshnessCheck } = require('./lib/memory-freshness.cjs');
  const { warnings: fw } = runMemoryFreshnessCheck();
  for (const w of fw) warn(w.message, w.descriptor);
} catch (e) {
  warn(`Agent-memory freshness audit failed: ${e.message}`);
}

// ── 9a″. Agent-memory index-tree shape (#2192) ──
// The always-loaded MEMORY.md is injected into every session; the harness silently truncates it above
// its budget, dropping load-bearing rules with no warning. This check enforces: (1) size ≤ budget,
// (2) per-line ≤ 200 chars, (3) MEMORY.md links ONLY index-*.md sub-indexes (not raw leaves), and
// (4) every leaf file is reachable from some index. Errors here are REAL file-local violations authored
// in .claude/agent-memory/ — they block the lane fast-fail. Standalone: `npm run check:memory`.
try {
  const { spawnSync } = require('node:child_process');
  const r = spawnSync(process.execPath, [join(ROOT, 'scripts/check-memory.mjs')], { encoding: 'utf8' });
  if (r.status !== 0) {
    const msg = (r.stderr || r.stdout || '').trim();
    // extract individual violation lines; fall back to the raw output as one error
    const lines = msg.split('\n').filter((l) => l.startsWith('  - ') || l.startsWith('✗'));
    if (lines.length) {
      for (const l of lines.filter((l) => l.startsWith('  - ')))
        err(`memory-index: ${l.replace(/^\s*-\s*/, '')}`, { kind: 'memory-index', file: '.claude/agent-memory/MEMORY.md' });
    } else {
      err(`memory-index: ${msg || 'check:memory failed'}`, { kind: 'memory-index', file: '.claude/agent-memory/MEMORY.md' });
    }
  }
} catch (e) {
  warn(`Agent-memory index-tree check failed: ${e.message}`);
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

// ── 9c. Codegen-placement invariants (#964 — hardening #956's ruling) ──
// #956 settled: `serve()`'s form-generators stay WE-repo reference runtime (#791); `@webeverything`
// ships only contract + vectors (#855). Its skeptic flagged both invariants as true-by-absence; this
// makes them enforced. (1) No `@webeverything/*` published package may re-export `blocks/renderers/*`.
// (2) The WE-side `serve()` form catalog stays frozen to the ratified reference-runtime set — a new
// framework dialect can't be slipped into the WE renderer to manufacture a WE-side codegen consumer; it
// must go through the FUI genWrapper pattern. The fs gather lives here; the pure rules do the asserting.
try {
  // (1) gather every in-repo package.json manifest (root + nested, excluding node_modules) → name + exports.
  const manifests = [];
  const walkPkgs = (dir) => {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      if (ent.name === 'node_modules' || ent.name === '.git' || ent.name.startsWith('.')) continue;
      const p = join(dir, ent.name);
      if (ent.isDirectory()) walkPkgs(p);
      else if (ent.name === 'package.json') {
        const rel = relative(ROOT, p);
        try {
          const raw = readFileSync(p, 'utf8');
          // #2149 Fork 1: duplicate-key merge gate — JSON.parse can't see a dup key, so lint the raw text.
          for (const e of validateNoDuplicateManifestKeys(raw, rel)) err(e.message, e.descriptor);
          const pkg = JSON.parse(raw);
          manifests.push({ name: pkg.name, exports: pkg.exports, source: rel });
        } catch { /* unparseable package.json — skip */ }
      }
    }
  };
  walkPkgs(ROOT);
  const { errors: pe } = validateRenderersNotPublished(manifests);
  for (const e of pe) err(e.message, e.descriptor);

  // (2) parse the WE-side serve() form catalog (`ServeForm` union ids) and assert it stays the ratified set.
  const moduleService = join(ROOT, 'blocks', 'renderers', 'module-service', 'moduleService.ts');
  if (existsSync(moduleService)) {
    const src = readFileSync(moduleService, 'utf8');
    const union = src.match(/export type ServeForm\s*=\s*([^;]+);/);
    const formIds = union
      ? [...union[1].matchAll(/'([^']+)'|"([^"]+)"/g)].map((m) => m[1] ?? m[2])
      : [];
    const { errors: fe } = validateReferenceRuntimeForms(formIds);
    for (const e of fe) err(e.message, e.descriptor);
  }
} catch (e) {
  err(`Codegen-placement invariants check failed: ${e.message}`);
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

// ── Backlog badge single-source (anti-drift) ────────────────────────────────────
// The /backlog/ tile + Prioritisation table (src/backlog.njk) and the /backlog/{id}/ detail page
// (src/backlog-pages.njk) must render every badge/chip from the ONE shared macro file
// (src/_includes/backlog-badges.njk) over the ONE shared vocabulary (src/_data/backlogMeta.js) — never a
// local copy. A re-declared macro is exactly how the two surfaces drifted before (a `preparing`/`program`
// colour added to one but not the other). So: each surface MUST import the shared file, and MUST NOT
// define any of the shared badge macros locally. Mechanical guard so the parity rule isn't just a comment.
{
  const SHARED_BADGE_MACROS = ['kindBadge', 'statusBadge', 'sizeBadge', 'tierBadge', 'unslicedBadge', 'metaBadge', 'epicStatusBadge', 'tagsRow', 'childCircle', 'blockerChip'];
  for (const rel of ['src/backlog.njk', 'src/backlog-pages.njk']) {
    const file = join(ROOT, rel);
    if (!existsSync(file)) continue;
    const src = readFileSync(file, 'utf8');
    if (!/\{%\s*import\s+["']backlog-badges\.njk["']/.test(src))
      err(`${rel} must \`{% import "backlog-badges.njk" as bk with context %}\` — backlog badges render from the one shared macro source (anti-drift), not inline markup.`);
    const localDefs = SHARED_BADGE_MACROS.filter((m) => new RegExp(`\\{%\\s*macro\\s+${m}\\s*\\(`).test(src));
    if (localDefs.length)
      err(`${rel} re-defines shared badge macro(s) locally: ${localDefs.join(', ')}. Delete the local copy and call bk.<name>() — these live only in src/_includes/backlog-badges.njk so the tile and detail page can't drift (#777 dogfood seam).`);
  }
}

// ── 10. Backlog kind-filter UI must cover every BACKLOG_KIND ───────────────────
// The /backlog/ board hides any card whose `data-kind` is not an *active filter chip*
// (src/assets/js/home-display.js → `failKind`). The chip set is built from hard-coded kind
// lists in src/backlog.njk (the "Tracked work" facet + the "Prioritisation" table facet). When a
// new kind is added to BACKLOG_KINDS (the SoT in check-standards-rules.mjs) but a UI list is not
// updated, EVERY item of that kind renders into the DOM yet is permanently invisible — there is no
// chip to re-enable it. That is exactly how `type: review` items (#602/#610) vanished from the board
// while passing every other check. Assert each hard-coded list covers the full kind vocabulary so
// the drift fails the gate instead of silently swallowing a whole class of items.
try {
  const njk = readFileSync(join(ROOT, 'src/backlog.njk'), 'utf8');
  // Both facets declare their order as a bracketed string-array literal of kind tokens. Match every
  // `[ "story", "epic", … ]` whose members are all known kinds — that uniquely identifies the two
  // kind-filter lists without coupling to surrounding template syntax.
  const KIND_TOKENS = [...BACKLOG_KINDS];
  const listLiterals = [...njk.matchAll(/\[((?:\s*["'][a-z]+["']\s*,?)+)\]/g)]
    .map((m) => m[1].match(/["']([a-z]+)["']/g).map((q) => q.replace(/["']/g, '')))
    .filter((toks) => toks.every((t) => BACKLOG_KINDS.has(t)) && toks.includes('decision'));
  if (!listLiterals.length)
    err('Backlog kind-filter check: could not find any kind-list literal in src/backlog.njk (template shape changed — update check-standards.mjs §10)');
  for (const toks of listLiterals) {
    const missing = KIND_TOKENS.filter((t) => !toks.includes(t));
    if (missing.length)
      err(`src/backlog.njk kind-filter list [${toks.join(', ')}] omits backlog kind(s) ${missing.map((t) => `"${t}"`).join(', ')} — those items render but are permanently hidden (no filter chip). Add them to every kind list in backlog.njk.`);
  }
} catch (e) {
  err(`Backlog kind-filter coverage check failed: ${e.message}`);
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

// ── 12. Standard-vs-site surface classifier (#2052, interim per #2006 Fork 2(b)) ──
// The WE repo intermingles WE-the-standard (zero-impl defs/gate/backlog) with the WE-website render (an
// artifact-producing 11ty+Vite product, mis-homed — end-state extraction gated on #872). #2006 Fork 2(b)
// ratified a directory boundary whose interim carrier is this fail-closed classifier: every path in the
// render-tree zone (`src/**`, where the two surfaces interleave) must classify as EXACTLY ONE of
// {standard, site}; a zone path matching neither is a HARD ERROR — so new site code can never masquerade
// as standard, nor a new standard def hide among the loaders, ahead of the physical `site/**` lift. The
// pure classifier (classifySurfacePaths) does the matching; the fs read (tracked paths) lives here.
try {
  const tracked = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' })
    .split('\n').filter(Boolean);
  const { unclassified } = classifySurfacePaths(tracked);
  for (const p of unclassified)
    err(
      `Unclassified surface path "${p}" (#2052/#2006 Fork 2(b)): it lives under the render-tree zone (src/**) but matches neither the site-surface nor the standard-surface set, so the standard-vs-site boundary is ambiguous. Place it on the correct side of the seam — a render file (.njk/.js loader/layout/partial/asset/css) is SITE; a definition (.json registry/data file) is STANDARD — so new site code can't masquerade as standard. Extend the matchers in scripts/check-standards-rules.mjs only if a genuinely new surface class is introduced.`,
      { kind: 'surface-unclassified', file: p, global: false },
    );
} catch (e) {
  err(`Standard-vs-site surface classifier failed: ${e.message}`);
}

// ── 13. Playwright container-image pin lockstep (#2234) ────────────────────────
// The visual-regression CI jobs (ci.yml's `visual` job + update-visual-baselines.yml) render inside a
// version-locked `mcr.microsoft.com/playwright:vX.Y.Z-jammy` container so rendered pixels stay
// byte-reproducible across machines/CI. Fail loud if the image tag ever drifts from the installed
// `@playwright/test` version (package-lock.json) — the pure lockstep rule lives in
// check-standards-rules.mjs; the fs reads (workflow YAML + lockfile) stay here.
try {
  const lock = JSON.parse(readFileSync(join(ROOT, 'package-lock.json'), 'utf8'));
  const installedVersion = lock.packages?.['node_modules/@playwright/test']?.version ?? null;
  const filesReferences = PLAYWRIGHT_CONTAINER_PIN_REQUIRED_FILES.map((rel) => {
    const p = join(ROOT, rel);
    const text = existsSync(p) ? readFileSync(p, 'utf8') : '';
    return { file: rel, tags: extractPlaywrightContainerTags(text) };
  });
  const { errors: pce } = validatePlaywrightContainerPin({ installedVersion, filesReferences });
  for (const e of pce) err(e.message, e.descriptor);
} catch (e) {
  err(`Playwright container pin check failed: ${e.message}`);
}

// ── Scope attribution (#952, ratified #949 Fork 3-A) ───────────────────────────
// `--scope=<session>` (alias `--mine=<session>`) partitions errors by ownership: an error on a file THIS
// session dirtied (per its claim-time baseline, #949 Fork 2-A) BLOCKS; a concurrent/pre-existing red is
// printed as a non-failing note. A path-less finding can't be proven foreign, so it stays blocking
// (fail-safe). The DEFAULT no-flag run is untouched — whole-repo-strict (CI / close-out unchanged).
const scopeArg = process.argv.find((a) => a.startsWith('--scope=') || a.startsWith('--mine='));
const scopeSession = scopeArg ? scopeArg.split('=').slice(1).join('=') : null;
let externalErrors = []; // errors attributed to other sessions under --scope (printed, non-blocking)
let scopeNote = null;
if (scopeSession) {
  try {
    const claims = parseClaims(readFileSync(join(ROOT, '.claude/skills/batch-backlog-items/claims.json'), 'utf8'));
    const dirty = porcelainFiles(execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }));
    const mine = mineFiles(claims, scopeSession, dirty);
    if (mine === null) {
      scopeNote = `--scope="${scopeSession}" has no recorded claim baseline — running whole-repo-strict.`;
    } else {
      const { blocking, external } = partitionFindings(errors, mine);
      externalErrors = external;
      errors.length = 0; errors.push(...blocking); // only my-scope (+ unattributable) errors gate
      scopeNote = `--scope="${scopeSession}" — ${mine.size} owned file(s); ${external.length} external error(s) demoted to notes.`;
    }
  } catch (e) {
    scopeNote = `--scope failed to resolve a baseline (${e.message}) — running whole-repo-strict.`;
  }
}

// ── Local / per-lane gating (#1144, consumed by the parallel-batch orchestrator #1147) ─────────
// `--files=<comma|space list>` scopes the BLOCKING set to findings attributable to those files — an
// explicit-list sibling of `--scope` (which derives the set from a session's claim baseline). `--local`
// additionally demotes the GLOBAL-CONSISTENCY findings to non-failing notes — both the path-less ones
// (dup ids, the blockedBy cycle walk) AND the `descriptor.global`-marked ones that DO attribute to a
// lane-edited file but depend on whole-repo / sibling-lane state (cross-registry `unresolved-ref` joins,
// the AGENTS.md derived-artifact `inventory` coherence). A lane runs in its OWN worktree and cannot see
// sibling lanes, so those invariants only become real at MERGE, where the full no-flag gate is the
// authority (#1159). Combined, `--local --files=<lane files>` blocks ONLY on the lane's own file-local
// findings. Applied AFTER
// `--scope` so the two compose (scope demotes concurrent sessions' files; --files/--local narrows further).
const filesArg = process.argv.find((a) => a.startsWith('--files='));
const LOCAL_MODE = process.argv.includes('--local');
let localNote = null;
let list = null;
if (filesArg || LOCAL_MODE) {
  list = filesArg
    ? filesArg.split('=').slice(1).join('=').split(/[\s,]+/).map((s) => s.trim()).filter(Boolean)
    : null;
  const fileSet = list ? new Set(list) : null;
  const { blocking, demoted } = partitionLocal(errors, { fileSet, local: LOCAL_MODE });
  externalErrors = [...externalErrors, ...demoted]; // demoted globals/other-file reds print as notes
  errors.length = 0; errors.push(...blocking);
  const scopeDesc = fileSet ? `${fileSet.size} file(s)` : 'file-attributable findings only';
  localNote = `${LOCAL_MODE ? '--local ' : ''}${filesArg ? `--files=${list.join(',')} ` : ''}— scoped to ${scopeDesc}; ${demoted.length} finding(s) demoted to notes.`;
}

// ── Report ────────────────────────────────────────────────────────────────────
const summary = {
  blocks: blocks.length, plugs: plugs.length, protocols: protocols.length, intents: intents.length,
  capabilities: capabilities.length, terms: semantics.length, research: research.length, backlog: backlog.length,
  errors: errors.length, warnings: warnings.length,
  ...(scopeSession ? { scope: scopeSession, externalErrors: externalErrors.length } : {}),
  ...(filesArg || LOCAL_MODE ? { local: LOCAL_MODE, files: list ?? null, externalErrors: externalErrors.length } : {}),
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
  console.log(JSON.stringify({ ok: errors.length === 0, summary, report, errors: shape(errors), warnings: shape(warnings), ...(scopeSession ? { externalErrors: shape(externalErrors) } : {}) }, null, 2));
} else {
  const RED = '\x1b[31m', YEL = '\x1b[33m', GRN = '\x1b[32m', CYN = '\x1b[36m', DIM = '\x1b[2m', RST = '\x1b[0m';
  console.log(`${DIM}check-standards — Web Everything${RST}`);
  if (scopeNote) console.log(`${CYN}  scope${RST} ${DIM}${scopeNote}${RST}`);
  if (localNote) console.log(`${CYN}  local${RST} ${DIM}${localNote}${RST}`);
  for (const w of warnings) console.log(`${YEL}  warn${RST} ${w.message}`);
  for (const e of externalErrors) console.log(`${DIM}  note (external) ${e.message}${RST}`);
  for (const e of errors) console.log(`${RED} error${RST} ${e.message}`);
  console.log(
    `\n${errors.length ? RED : GRN}${errors.length} error(s)${RST}, ${warnings.length} warning(s) ` +
    `${DIM}(checked ${blocks.length} blocks, ${plugs.length} plugs, ${protocols.length} protocols, ${intents.length} intents, ${capabilities.length} capabilities, ${semantics.length} terms, ${research.length} research topics, ${backlog.length} backlog items)${RST}`,
  );
}
process.exit(errors.length ? 1 : 0);
