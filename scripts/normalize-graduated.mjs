#!/usr/bin/env node
/*
 * normalize-graduated.mjs — graduatedTo field hygiene (#614).
 *
 * The `graduatedTo` frontmatter field records the entity a resolved backlog item became. The #607
 * audit found it pervasively polluted: bare ids with no type prefix (`disclosure` vs `intent:disclosure`),
 * `file.json#anchor` data refs, and multi-sentence narratives where the entity id is buried in prose —
 * all of which defeat entity-graph joins and the audit's G3 lineage walk (whose reliability is only as
 * good as this field). The canonical grammar is:
 *
 *     graduatedTo: none
 *                | <kind>:<id>            # kind ∈ block|intent|protocol|project|plug|capability|adapter|demo
 *                | <repo/path[.ext]>      # a path inside the constellation
 *
 * A trailing annotation after the leading token (`a/b.ts (note)`, `intent:x — why`) is *tolerated* by the
 * gate (the leading token still resolves) but discouraged; narrative belongs in the item body. This tool
 * CLASSIFIES every value and AUTO-FIXES only the unambiguously-safe class:
 *   - a bare id resolvable in exactly one registry        → `<kind>:<id>`
 *   - a clean `<reg>.json#<id>` data-anchor ref           → `<kind>:<id>`
 * Ambiguous (id in >1 registry), unresolved, narrative-bearing, item-id-split, and object-form values are
 * REPORTED for human handling, never guessed.
 *
 * Usage:
 *   node scripts/normalize-graduated.mjs            # scan: print the classification breakdown
 *   node scripts/normalize-graduated.mjs --write    # apply the safe auto-fixes in place
 *   node scripts/normalize-graduated.mjs --json      # machine-readable classification
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readField, setFrontmatterField, quoteScalar } from './backlog/frontmatter.mjs';
import { loadBlocks } from './lib/blocks-loader.cjs';
import { loadIntents } from './lib/intents-loader.cjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BL = join(ROOT, 'backlog');

// kind → registry id-set, in the constellation's canonical order. The `<reg>.json` file name each kind
// reads from doubles as the file#anchor → kind map (`blocks.json#x` → `block:x`). `blocks.json` is kept
// here as the canonical VIRTUAL anchor even though the file is gone (#882) — the block id-set now comes
// from the per-block specs (src/_data/blocks/<id>.json), assembled below; the `blocks.json#<id>` grammar
// stays a stable cross-backlog contract so existing graduatedTo references keep resolving.
const REG_SPEC = [
  ['block', 'blocks.json'], ['intent', 'intents.json'], ['protocol', 'protocols.json'],
  ['project', 'projects.json'], ['plug', 'plugs.json'], ['adapter', 'adapters.json'], ['demo', 'demos.json'],
];
function loadRegistries() {
  const reg = new Map();          // kind -> Set<id>
  const fileToKind = new Map();   // 'blocks.json' -> 'block'
  for (const [kind, file] of REG_SPEC) {
    fileToKind.set(file, kind);
    let ids = new Set();
    if (kind === 'block') {
      // Per-block specs (#882) — assembled, not a single file; the `blocks.json` anchor stays virtual.
      try { ids = new Set(loadBlocks().map((b) => b.id).filter(Boolean)); } catch { /* none → empty */ }
      reg.set(kind, ids);
      continue;
    }
    if (kind === 'intent') {
      // Per-intent specs (#1145) — assembled; the `intents.json#<id>` graduatedTo anchor stays virtual.
      try { ids = new Set(loadIntents().map((i) => i.id).filter(Boolean)); } catch { /* none → empty */ }
      reg.set(kind, ids);
      continue;
    }
    try {
      const raw = JSON.parse(readFileSync(join(ROOT, 'src/_data', file), 'utf8'));
      const arr = Array.isArray(raw) ? raw : raw.items || [];
      // adapters.json nests its entries under items[] per top-level group
      ids = new Set(arr.flatMap((x) => (x.items ? x.items.map((i) => i.id) : [x.id])).filter(Boolean));
    } catch { /* registry absent → empty */ }
    reg.set(kind, ids);
  }
  return { reg, fileToKind };
}

// Explicit disambiguations for ids that exist in >1 registry (a block AND its intent/protocol twin).
// Each resolved by the item's own title — a "Build the … runtime block" graduated to the block; a
// "Candidate standard … intent" to the intent. Keyed by item id so the tool stays reproducible.
const DISAMBIGUATION = {
  354: 'intent:status-indicator',  // "Candidate standard — Status-indicator intent"
  356: 'intent:master-detail',     // "Candidate standard — Master–detail coordination"
  374: 'block:selection',          // "Loan pipeline consumes a Selection runtime"
  380: 'block:lifecycle',          // "Phase S2 — application lifecycle state machine"
  391: 'block:lifecycle',          // "Build the lifecycle runtime block"
  399: 'block:audit-trail',        // "Build the audit runtime block"
  409: 'intent:master-detail',     // "Decision — Master-detail: standalone intent vs new project"
};

const KINDS = REG_SPEC.map(([k]) => k);
const TYPED = new RegExp(`^(${KINDS.join('|')}|capability):([A-Za-z0-9_-]+)$`);
const REPO_PATH = /^[A-Za-z0-9_.@-]+(\/[A-Za-z0-9_.@-]+)+\/?$/;     // a/b, a/b.ts, a/b/ — no spaces
const FILE_ANCHOR = /^([a-z]+\.json)#([A-Za-z0-9_-]+)$/;            // blocks.json#form

/** Strip a YAML end-of-line comment ( ` # …`, hash preceded by whitespace) and surrounding quotes. */
function rawValue(v) {
  return String(v).replace(/\s+#\s.*$/, '').trim().replace(/^["']|["']$/g, '').trim();
}

/**
 * Classify a graduatedTo value. Pure — registries injected.
 * @returns {{ cls, leadToken, narrative, canonical?, kinds? }}
 *   cls ∈ none | typed | path | fix-bare | fix-anchor | review-ambiguous | review-unresolved | review-prose
 */
export function classifyGraduated(value, { reg, fileToKind }) {
  const v = rawValue(value);
  if (v === '' || v === 'none') return { cls: 'none', leadToken: v };
  const lead = v.split(/\s+/)[0].replace(/[.,;]+$/, '');
  const narrative = v.slice(lead.length).trim();

  if (TYPED.test(v)) return { cls: 'typed', leadToken: v, narrative: '' };      // whole value is a clean typed id
  if (TYPED.test(lead)) return { cls: 'typed', leadToken: lead, narrative };     // typed id + trailing prose (tolerated)

  const fa = FILE_ANCHOR.exec(lead);
  if (fa && fileToKind.has(fa[1]) && reg.get(fileToKind.get(fa[1]))?.has(fa[2])) {
    const canonical = `${fileToKind.get(fa[1])}:${fa[2]}`;
    return { cls: narrative ? 'review-prose' : 'fix-anchor', leadToken: lead, narrative, canonical };
  }

  if (REPO_PATH.test(lead)) return { cls: 'path', leadToken: lead, narrative };  // repo path (± trailing prose)

  // a bare slug — resolve across registries
  if (/^[A-Za-z0-9_-]+$/.test(lead)) {
    const hits = KINDS.filter((k) => reg.get(k).has(lead));
    if (hits.length === 1) return { cls: narrative ? 'review-prose' : 'fix-bare', leadToken: lead, narrative, canonical: `${hits[0]}:${lead}` };
    if (hits.length > 1) return { cls: 'review-ambiguous', leadToken: lead, narrative, kinds: hits };
    return { cls: 'review-unresolved', leadToken: lead, narrative };
  }
  return { cls: 'review-prose', leadToken: lead, narrative };                    // item-id list, object, pure prose
}

// ---- CLI ------------------------------------------------------------------
function run() {
  const write = process.argv.includes('--write');
  const asJson = process.argv.includes('--json');
  const registries = loadRegistries();
  const files = readdirSync(BL).filter((f) => /^\d+-.*\.md$/.test(f));
  const buckets = {};
  const fixes = [];
  for (const f of files) {
    const path = join(BL, f);
    const content = readFileSync(path, 'utf8');
    const raw = readField(content, 'graduatedTo');
    if (raw === undefined) continue;
    const id = String(parseInt(f.match(/^(\d+)/)[1], 10));
    const c = classifyGraduated(raw, registries);
    // an explicit per-item disambiguation overrides an ambiguous (multi-registry) classification
    if (c.cls === 'review-ambiguous' && DISAMBIGUATION[id]) { c.cls = 'fix-bare'; c.canonical = DISAMBIGUATION[id]; }
    (buckets[c.cls] ||= []).push({ id, value: rawValue(raw), ...c });
    if (write && (c.cls === 'fix-bare' || c.cls === 'fix-anchor')) {
      const next = setFrontmatterField(content, 'graduatedTo', quoteScalar(c.canonical));
      if (next && next !== content) { writeFileSync(path, next); fixes.push(`#${id} ${rawValue(raw)} → ${c.canonical}`); }
    }
  }
  if (asJson) { console.log(JSON.stringify(buckets, null, 2)); return; }
  const order = ['none', 'typed', 'path', 'fix-bare', 'fix-anchor', 'review-ambiguous', 'review-unresolved', 'review-prose'];
  console.log(write ? '— normalize-graduated (--write) —' : '— normalize-graduated (scan; pass --write to apply fixes) —');
  for (const k of order) {
    const b = buckets[k] || [];
    console.log(`${k.padEnd(18)} ${b.length}`);
    if (k.startsWith('review') && b.length) for (const x of b) console.log(`    #${x.id}  ${x.value.slice(0, 72)}${x.kinds ? `   [${x.kinds.join('|')}]` : ''}`);
  }
  if (write) { console.log(`\napplied ${fixes.length} fix(es):`); for (const f of fixes) console.log('  ' + f); }
  else {
    const auto = (buckets['fix-bare'] || []).length + (buckets['fix-anchor'] || []).length;
    console.log(`\n${auto} auto-fixable (run --write). ${(buckets['review-ambiguous'] || []).length + (buckets['review-unresolved'] || []).length + (buckets['review-prose'] || []).length} need manual review.`);
  }
}
if (import.meta.url === `file://${process.argv[1]}`) run();
