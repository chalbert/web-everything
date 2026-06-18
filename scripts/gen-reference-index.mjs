#!/usr/bin/env node
/**
 * gen-reference-index.mjs — builds the single deduped index of every EXTERNAL reference the project
 * cites, walking only the five STRUCTURED reference homes (deterministic JSON walks, no judgement).
 * Slice #597 of the reference-health epic (#583); the liveness sweep (#585) fetches what this lists,
 * and the retirement convention (#584) applies to its rows — this slice only *indexes*, it never
 * fetches or classifies.
 *
 * The five homes (and their URL-bearing fields):
 *   corpus            src/_data/benchmarkCorpus.json           sources[].docsUrl, sources[].repoUrl
 *   references        src/_data/references.json                [].links[].url   (external only)
 *   blocks            src/_data/blocks/*.json                  [].webStandards.*.reference
 *   capability        src/_data/benchmarkCapabilityPresence.json  rows[].url
 *   intents           src/_data/intents.json                   URLs inside HTML description
 *
 * Freeform homes (reports/*.md, researchTopics.json prose) and internal-only refs (backlog crossRef,
 * adapters/protocols.json) are OUT OF SCOPE per #597 — a markdown-citation parser is a separate lossy
 * concern. Output is DERIVED, deterministic data (no timestamp), so the committed file can't drift and
 * a re-run over unchanged sources is a no-op diff.
 *
 * Run: `npm run gen:reference-index`  (writes src/_data/referenceIndex.json)
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadBlocks } from './lib/blocks-loader.cjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'src/_data');
const OUT = join(DATA, 'referenceIndex.json');

const SOURCES = {
  corpus: 'benchmarkCorpus.json',
  references: 'references.json',
  // blocks are read via the per-block loader (#882), not this path; the key stays so `blocks`
  // remains one of the structured homes listed in `homes` (Object.keys(SOURCES)).
  blocks: 'blocks/*.json',
  capability: 'benchmarkCapabilityPresence.json',
  intents: 'intents.json',
};

const readJson = (name) => {
  const p = join(DATA, name);
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null;
};

const isExternal = (u) => typeof u === 'string' && /^https?:\/\//i.test(u.trim());

/**
 * Canonical URL form for dedup: lowercase protocol + host, drop a default port, strip a trailing
 * slash from a non-root path. Query and **fragment are kept** — a capability-presence deep link
 * (`…/collapse#demo-accordion`) is a distinct reference from the bare component page. An unparseable
 * URL falls back to its trimmed self so it still indexes (never silently dropped).
 */
function canonicalize(raw) {
  const s = raw.trim();
  try {
    const u = new URL(s);
    u.protocol = u.protocol.toLowerCase();
    u.hostname = u.hostname.toLowerCase();
    if (u.pathname.length > 1 && u.pathname.endsWith('/')) u.pathname = u.pathname.replace(/\/+$/, '');
    return u.toString();
  } catch {
    return s;
  }
}

/** Collect `{ rawUrl, home, sourceId, label }` occurrences from every structured home. */
function collect() {
  const out = [];
  const push = (rawUrl, home, sourceId, label) => {
    if (isExternal(rawUrl)) out.push({ rawUrl: rawUrl.trim(), home, sourceId, label });
  };

  // 1. Corpus sources — docsUrl + repoUrl
  const corpus = readJson(SOURCES.corpus);
  for (const s of corpus?.sources ?? []) {
    push(s.docsUrl, 'corpus', s.id, `${s.name} (docs)`);
    push(s.repoUrl, 'corpus', s.id, `${s.name} (repo)`);
  }

  // 2. Design reference library — external links only
  const references = readJson(SOURCES.references);
  for (const cat of references ?? []) {
    for (const link of cat.links ?? []) push(link.url, 'references', cat.category, link.title);
  }

  // 3. Web-standard refs on blocks (assembled from per-block specs src/_data/blocks/<id>.json, #882)
  const blocks = loadBlocks();
  for (const b of blocks ?? []) {
    for (const [key, std] of Object.entries(b.webStandards ?? {})) {
      push(std?.reference, 'blocks', b.id, `${b.name} · ${key}`);
    }
  }

  // 4. Capability-presence rows
  const capability = readJson(SOURCES.capability);
  for (const r of capability?.rows ?? []) {
    push(r.url, 'capability', r.sourceId, r.sourceName || `${r.sourceId} · ${r.capabilityId}`);
  }

  // 5. Intent docs — URLs embedded in the HTML description
  const intents = readJson(SOURCES.intents);
  for (const i of intents ?? []) {
    const urls = (i.description || '').match(/https?:\/\/[^\s"'<)]+/g) || [];
    for (const u of urls) push(u, 'intents', i.id, i.name);
  }

  return out;
}

/** Dedup occurrences by canonical URL into one row each, recording every home the URL appears in. */
function buildIndex(occurrences) {
  const byUrl = new Map();
  for (const o of occurrences) {
    const url = canonicalize(o.rawUrl);
    let row = byUrl.get(url);
    if (!row) {
      // First occurrence wins the primary {home, sourceId, label}; homes accumulates all.
      row = { url, home: o.home, sourceId: o.sourceId, label: o.label, homes: [], occurrences: 0 };
      byUrl.set(url, row);
    }
    row.occurrences += 1;
    if (!row.homes.includes(o.home)) row.homes.push(o.home);
  }
  return [...byUrl.values()].sort((a, b) => a.url.localeCompare(b.url));
}

function main() {
  const occurrences = collect();
  const references = buildIndex(occurrences);

  const byHome = {};
  for (const o of occurrences) byHome[o.home] = (byHome[o.home] || 0) + 1;

  const index = {
    id: 'reference-index',
    description:
      'Deduped index of every external reference the project cites across the five structured homes. ' +
      'Generated by scripts/gen-reference-index.mjs (npm run gen:reference-index) — do not edit by hand. ' +
      'Slice #597 of reference-health epic #583; the #585 liveness sweep fetches these rows.',
    homes: Object.keys(SOURCES),
    summary: {
      uniqueUrls: references.length,
      totalOccurrences: occurrences.length,
      byHome,
    },
    references,
  };

  writeFileSync(OUT, JSON.stringify(index, null, 2) + '\n');
  console.log(
    `referenceIndex.json regenerated — ${references.length} unique URL(s) from ${occurrences.length} occurrence(s):`,
  );
  for (const [home, n] of Object.entries(byHome)) console.log(`  ${home.padEnd(12)} ${n}`);
}

main();
