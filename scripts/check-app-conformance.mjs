#!/usr/bin/env node
/**
 * check-app-conformance.mjs — the exercise-app standard-CONFORMANCE benchmark (two layers).
 *
 * Exercise apps (backlog #314) exist to DRIVE Web Everything, not to be products: the app is a forcing
 * function whose job is to surface where the platform is used, reimplemented, or missing.
 *
 * You can only validate against an actual standard. So this is NOT a lint of native APIs (using
 * innerHTML/addEventListener is native-first, fine). It validates two things:
 *
 *   LAYER 1 — CONFORMANCE: for each WE standard the app touches, is it USED (delegated to the standard's
 *             real contract) or REIMPLEMENTED (a bespoke parallel)? A standard with no runtime yet is a
 *             GAP — the WE work this app drives.
 *   LAYER 2 — MISSING-STANDARD DISCOVERY: capabilities the app exhibits for which NO standard exists —
 *             candidate standards (the inverse of Layer 1; the proactive feed for /new-standard).
 *
 * Both run off one CONCEPT-EXTRACTION core (what capabilities does this app exhibit?), so the tool can
 * later run against real external apps (no manifest, inferred concepts). For our apps a conformance.json
 * manifest declares the standards committed to.
 *
 * conformance:  USED (active std + evidence) · REIMPLEMENTED (active std, bespoke) = FAIL
 *               GAP (std not yet active) — acceptable only while tagged `// PLATFORM-GAP: #NNN`
 *               CLAIMED-UNUSED (declared, no evidence) = FAIL
 * "Compliance" = a conformance criterion promoted to a hard gate (--strict); generalized by backlog #351.
 *
 * Run:  npm run check:app-conformance -- --app=demos/<id> [--json] [--strict] [--burndown]
 */
import { readFileSync, existsSync, readdirSync, writeFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, extname } from 'node:path';
import { buildConformanceReport } from './lib/conformanceReport.mjs';
import { loadBlocks } from './lib/blocks-loader.cjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const JSON_MODE = argv.includes('--json');
const STRICT = argv.includes('--strict');
const BURNDOWN = argv.includes('--burndown');
const appArg = argv.find((a) => a.startsWith('--app='));
const APP_REL = (appArg ? appArg.slice(6) : 'demos/loan-origination').replace(/\/$/, '');
const APP_DIR = join(ROOT, APP_REL);
if (!existsSync(APP_DIR)) { console.error(`✗ app not found: ${APP_REL}`); process.exit(2); }

// ── Registries (the only things we can validate against) ────────────────────────
const readJson = (p, dflt) => { try { return JSON.parse(readFileSync(join(ROOT, p), 'utf8')); } catch { return dflt; } };
const blocks = loadBlocks(); // per-block specs src/_data/blocks/<id>.json, assembled (#882)
const intents = readJson('src/_data/intents.json', []);
const protocols = readJson('src/_data/protocols.json', []);
const byId = (arr, id) => arr.find((x) => x.id === id);
const backlogIds = new Set(readdirSync(join(ROOT, 'backlog')).map((f) => (f.match(/^(\d{3})-/) || [])[1]).filter(Boolean));

/** Resolve a standard id to {found, kind, status, available}. available = shipping (status active). */
function resolveStandard(id) {
  const b = byId(blocks, id);
  if (b) return { found: true, kind: 'block', status: b.status, available: b.status === 'active' };
  const i = byId(intents, id);
  if (i) {
    // An intent is a spec; you conform to it by using an ACTIVE block that implements/composes it.
    const impls = blocks.filter((x) => x.implementsIntent === id || (x.composesIntents || []).includes(id));
    const activeImpl = impls.find((x) => x.status === 'active');
    return { found: true, kind: 'intent', status: activeImpl ? `via ${activeImpl.id}` : i.status, available: !!activeImpl };
  }
  // A protocol is a CONTRACT, never itself a shipping runtime — conformance comes via an active block
  // that implements it (which, by convention, shares the protocol id, so the block check above shadows
  // this once the runtime lands). Until then a touched protocol is a gap, not a missing standard.
  const p = byId(protocols, id);
  if (p) return { found: true, kind: 'protocol', status: p.status, available: false };
  return { found: false };
}

// ── The concept-extraction core ─────────────────────────────────────────────────
// Each concept: a capability detectable in app source. `standardId` = the standard that governs it
// (null = no standard → Layer 2 candidate). `evidence` = proof the app uses the standard's real contract
// (vs reimplementing it). Native-first conveniences (for-each, interpolation) are intentionally NOT here:
// using a native API where a standard merely offers a nicety is not non-conformance.
const CONCEPTS = [
  // Layer 1 — governed by a standard (reimplementing it = non-conformance)
  { name: 'tabular-data', signal: /<table[\s>]|role=["']grid["']/, standardId: 'data-table', evidence: /data-table|DataTableBehavior|aria-sort|<th[^>]*scope=/ },
  { name: 'windowing/paging', signal: /\.slice\(\s*\w/, standardId: 'pagination', evidence: /aria-label=["']pagination|PaginationBehavior|renderers\/pagination/i },
  { name: 'item-selection', signal: /classList\.\w+\(\s*['"]selected['"]/, standardId: 'selection', evidence: /SelectionBehavior|selection-behavior/ },
  { name: 'tab-navigation', signal: /role=["']tab(list)?["']/, standardId: 'tabs', evidence: /tab-list|tab-trigger|command(for)?=/ },
  { name: 'client-navigation', signal: /history\.(pushState|replaceState)|window\.addEventListener\(\s*['"]popstate/, standardId: 'router', evidence: /route:link|<route-view|route=["']/ },
  // Layer 2 — no governing standard (candidate); `candidate` points at the filed backlog item if any
  { name: 'status-indicator (chip/badge)', signal: /class=["'][^"']*\b(chip|badge|pill|status|finding|outcome)-/, standardId: 'status-indicator', evidence: /renderStatusIndicator|StatusIndicatorElement|customStatusIndicators/ },
  { name: 'lifecycle/workflow-state', signal: /ApplicationState|lifecycle|TERMINAL_STATES|state machine|->.*(submitted|approved|underwriting)/i, standardId: 'lifecycle', evidence: /customLifecycles|CustomLifecycleProvider|LifecycleDefinition/ },
  { name: 'decision/evaluation trace', signal: /proof-of-compliance|ruleSet|evaluate\(|\btrace\b/i, standardId: 'decision-trace', evidence: /decisionTraceHTML|renderDecisionTrace|toDecisionRecord/ },
  { name: 'master-detail coordination', signal: /trace-panel|detail-panel|master-detail|selectedId|select\(\s*\w+\.id/i, standardId: 'master-detail', evidence: /MasterDetailBehavior/ },
  { name: 'audit trail', signal: /AuditEvent|audit\b|actor.*(timestamp|at:)/i, standardId: 'audit-trail', evidence: /customAudit\b|auditProvider\.append|\.queryByEntity\(/ },
];

// ── Scan app files ──────────────────────────────────────────────────────────────
function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    if (n.startsWith('.')) return [];
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
const files = walk(APP_DIR).filter((f) => ['.ts', '.tsx', '.js', '.jsx', '.css', '.html'].includes(extname(f)));
const rel = (p) => relative(ROOT, p);
const allText = files.map((f) => readFileSync(f, 'utf8')).join('\n');
const tagFiles = new Set(); // files carrying a live PLATFORM-GAP tag
for (const f of files) for (const m of readFileSync(f, 'utf8').matchAll(/PLATFORM-GAP:\s*#?(\d{3})/g)) if (backlogIds.has(m[1])) tagFiles.add(rel(f));
const hasLiveTag = tagFiles.size > 0;

// Detect each concept: first signal hit (file:line) + whether present at all.
const detected = [];
for (const c of CONCEPTS) {
  let hit = null;
  for (const f of files) {
    const ls = readFileSync(f, 'utf8').split('\n');
    const i = ls.findIndex((ln) => c.signal.test(ln));
    if (i !== -1) { hit = { file: rel(f), line: i + 1 }; break; }
  }
  if (hit) detected.push({ ...c, ...hit, evidencePresent: c.evidence ? c.evidence.test(allText) : false });
}

// ── Manifest (optional — declared mode for our apps) ────────────────────────────
const manifest = readJson(`${APP_REL}/conformance.json`, null);
const declared = manifest?.standards ?? [];
const declaredEvidence = new Map(declared.map((d) => [d.id, d.evidence ? new RegExp(d.evidence) : null]));

// ── Layer 1: conformance over the relevant standards ────────────────────────────
const relevantIds = [...new Set([...declared.map((d) => d.id), ...detected.filter((d) => d.standardId).map((d) => d.standardId)])];
const conformance = [];
for (const id of relevantIds) {
  const std = resolveStandard(id);
  const concept = detected.find((d) => d.standardId === id);
  const evReDeclared = declaredEvidence.get(id);
  const builtin = CONCEPTS.find((c) => c.standardId === id)?.evidence;
  const evidence = (evReDeclared && evReDeclared.test(allText)) || (builtin && builtin.test(allText)) || false;
  const isDeclared = declaredEvidence.has(id);
  const conceptPresent = !!concept;

  let status, severity;
  if (!std.found) { status = 'unknown-standard'; severity = 'FAIL'; }
  else if (std.available) {
    if (evidence) { status = 'conformant'; severity = 'OK'; }
    else if (conceptPresent) { status = 'reimplemented'; severity = 'FAIL'; }
    else { status = 'claimed-unused'; severity = 'FAIL'; }
  } else {
    // Standard not yet active → can't fully conform; this is the WE gap.
    status = evidence ? 'gap-consuming-draft' : (conceptPresent ? 'gap-reimplemented-draft' : 'gap-declared');
    severity = hasLiveTag ? 'GAP' : 'FAIL'; // untagged bypass of a draft standard escalates
  }
  conformance.push({ id, kind: std.kind, stdStatus: std.status, declared: isDeclared, conceptPresent, evidence, status, severity, at: concept ? `${concept.file}:${concept.line}` : null });
}

// ── Layer 2: missing-standard discovery ─────────────────────────────────────────
const candidates = detected.filter((d) => d.standardId === null).map((d) => ({
  concept: d.name, at: `${d.file}:${d.line}`,
  backlog: d.candidate && backlogIds.has(d.candidate) ? `#${d.candidate}` : null,
}));

// ── Score & rollups ─────────────────────────────────────────────────────────────
const conformant = conformance.filter((c) => c.status === 'conformant').length;
const denom = conformance.length;
const score = denom ? Math.round((conformant / denom) * 100) : 100;
const fails = conformance.filter((c) => c.severity === 'FAIL');
const gaps = conformance.filter((c) => c.severity === 'GAP');
const compliant = fails.length === 0 && gaps.every(() => hasLiveTag);

const queue = conformance
  .filter((c) => c.status !== 'conformant')
  .sort((a, b) => (a.stdStatus === b.stdStatus ? 0 : a.stdStatus === 'active' ? -1 : 1))
  .map((c) => ({ id: c.id, status: c.status, stdStatus: c.stdStatus, severity: c.severity,
    action: c.status === 'reimplemented' ? `consume the ${c.id} standard (don't reimplement)` :
            c.status.startsWith('gap') ? `advance ${c.id} (${c.stdStatus}) to a conformable runtime, then consume` :
            c.status === 'claimed-unused' ? `adopt ${c.id} (declared but unused)` : `resolve ${c.id}` }));

if (BURNDOWN) {
  const bpath = join(ROOT, 'reports/app-conformance-burndown.json');
  const log = readJson('reports/app-conformance-burndown.json', {});
  (log[APP_REL] ||= []).push({ date: new Date().toISOString().slice(0, 10), score, fails: fails.length, gaps: gaps.length, candidates: candidates.length });
  writeFileSync(bpath, JSON.stringify(log, null, 2) + '\n');
}

// ── Report ──────────────────────────────────────────────────────────────────────
if (JSON_MODE) {
  // Report-model view (#711, slice C of #435): a coverage-matrix section from layer1_conformance + the
  // --burndown history as series[]. Read the burndown log fresh so it reflects a point just appended by a
  // co-passed --burndown. The legacy keys stay for existing consumers; `report` is the model-valid view.
  const burndownLog = readJson('reports/app-conformance-burndown.json', {});
  const report = buildConformanceReport(APP_REL, conformance, burndownLog[APP_REL] ?? []);
  console.log(JSON.stringify({ ok: compliant, app: APP_REL, score,
    layer1_conformance: conformance, layer1_queue: queue, layer2_candidates: candidates,
    report,
    counts: { conformant, fails: fails.length, gaps: gaps.length, candidates: candidates.length } }, null, 2));
} else {
  const R = '\x1b[31m', Y = '\x1b[33m', G = '\x1b[32m', D = '\x1b[2m', C = '\x1b[36m', M = '\x1b[35m', X = '\x1b[0m';
  console.log(`${D}check-app-conformance — ${APP_REL}${manifest ? '' : ' (no manifest — inferred mode)'}${X}\n`);
  console.log(`${C}Layer 1 — conformance to existing standards${X}`);
  for (const c of conformance) {
    const sev = c.severity === 'OK' ? `${G}  OK${X}` : c.severity === 'GAP' ? `${Y} GAP${X}` : `${R}FAIL${X}`;
    console.log(`  ${sev} ${c.id} ${D}(${c.kind}, ${c.stdStatus})${X} — ${c.status}${c.at ? `  ${D}${c.at}${X}` : ''}`);
  }
  if (!conformance.length) console.log(`  ${D}no standards declared or detected${X}`);

  console.log(`\n${C}WE work queue (Layer 1, ranked)${X}`);
  if (!queue.length) console.log(`  ${D}none — app conforms to every standard it touches${X}`);
  for (const q of queue) {
    const label = q.status === 'reimplemented' ? `${R}reimpl/active${X}` : q.status === 'claimed-unused' ? `${R}unused/active${X}` : `${Y}gap/${q.stdStatus}${X}`;
    console.log(`  [${label}] ${q.id}\n        ${q.action}`);
  }

  console.log(`\n${M}Layer 2 — missing-standard candidates (discovery; heuristic)${X}`);
  if (!candidates.length) console.log(`  ${D}none detected${X}`);
  for (const c of candidates) console.log(`  • ${c.concept}  ${D}${c.at}${X}  ${c.backlog ? `${G}filed ${c.backlog}${X}` : `${Y}unfiled — propose${X}`}`);

  const sc = score === 100 ? G : score >= 50 ? Y : R;
  console.log(`\n  Conformance ${sc}${score}%${X} ${D}(${conformant}/${denom} standards)${X}  ·  ${fails.length} FAIL, ${gaps.length} GAP  ·  ${candidates.length} candidate standard(s)  ·  ${compliant ? G + 'compliant' + X : R + 'not compliant' + X}`);
}
process.exit(STRICT && !compliant ? 1 : 0);
