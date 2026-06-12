#!/usr/bin/env node
/**
 * gap-sweep-status.mjs — the helper for the competitive coverage gap sweep (backlog epic #315).
 *
 * The sweep's data lives in three files under src/_data/:
 *   benchmarkCorpus.json        (phase 1 / #316) — the design-system + UI-library corpus
 *   benchmarkCapabilities.json  (phase 2 / #346) — the normalized capability matrix
 *   benchmarkCoverage.json      (phase 3 / #347) — capability -> WE entity, covered/partial/missing
 *
 * This CLI does three things, none of which re-derives the data (that's the agent's job, per the
 * gap-sweep-rerun skill) — it makes a re-run auditable and idempotent:
 *
 *   (no args)        print the current state + run the health/invariant gate (exit 1 on violation)
 *   --snapshot       save the current three files as one baseline under reports/gap-sweep-snapshots/
 *   --baseline=PATH  diff the current state against a saved baseline and print the delta
 *
 * Idempotency contract (#349): a re-run over an unchanged landscape must produce a no-op delta and
 * open 0 new backlog items. `--baseline` is how you prove it.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DATA = join(ROOT, 'src', '_data');
const SNAP_DIR = join(ROOT, 'reports', 'gap-sweep-snapshots');

const read = (f) => JSON.parse(readFileSync(join(DATA, f), 'utf8'));

function load() {
  return {
    corpus: read('benchmarkCorpus.json'),
    capabilities: read('benchmarkCapabilities.json'),
    coverage: read('benchmarkCoverage.json'),
  };
}

// ---- invariant gate -------------------------------------------------------
function validate({ corpus, capabilities, coverage }) {
  const errs = [];
  const capIds = new Set();
  for (const c of capabilities.capabilities) {
    if (capIds.has(c.id)) errs.push(`duplicate capability id: ${c.id}`);
    capIds.add(c.id);
    if (!c.kind) errs.push(`capability ${c.id} missing kind`);
  }
  const sourceIds = new Set(corpus.sources.map((s) => s.id));
  for (const c of capabilities.capabilities)
    for (const n of c.notableIn || [])
      if (!sourceIds.has(n)) errs.push(`capability ${c.id} notableIn unknown source: ${n}`);

  const known = (id) => capIds.has(id);
  for (const g of coverage.gaps) {
    // a gap id is either a capability id, or a synthetic cross-capability gap that lists capabilityRefs
    if (!known(g.id)) {
      if (!Array.isArray(g.capabilityRefs) || !g.capabilityRefs.length)
        errs.push(`coverage gap references unknown capability: ${g.id} (add capabilityRefs for a synthetic gap)`);
      else for (const r of g.capabilityRefs)
        if (!known(r)) errs.push(`gap ${g.id} capabilityRefs unknown capability: ${r}`);
    }
    if (!g.gapNote) errs.push(`gap ${g.id} missing gapNote`);
    if (!g.triage || typeof g.triage.rank !== 'number') errs.push(`gap ${g.id} missing triage.rank`);
  }
  for (const t of coverage.alreadyTracked) {
    if (!known(t.id)) errs.push(`alreadyTracked references unknown capability: ${t.id}`);
    if (!t.trackedBy) errs.push(`alreadyTracked ${t.id} missing trackedBy`);
  }
  const s = coverage.summary || {};
  if (s.fileableGaps !== coverage.gaps.length)
    errs.push(`summary.fileableGaps (${s.fileableGaps}) != gaps.length (${coverage.gaps.length})`);
  if (s.alreadyTracked !== coverage.alreadyTracked.length)
    errs.push(`summary.alreadyTracked (${s.alreadyTracked}) != alreadyTracked.length (${coverage.alreadyTracked.length})`);
  return errs;
}

// ---- status ---------------------------------------------------------------
function byKey(arr, key) {
  const m = {};
  for (const x of arr) m[x[key]] = (m[x[key]] || 0) + 1;
  return m;
}
const fmt = (o) => Object.entries(o).map(([k, v]) => `${k}:${v}`).join('  ');

function printStatus(d) {
  const { corpus, capabilities, coverage } = d;
  console.log(`\ngap sweep — status (corpus v${corpus.version}, lastSwept ${corpus.lastSwept})\n`);
  console.log(`corpus:       ${corpus.sources.length} sources   ${fmt(byKey(corpus.sources, 'category'))}`);
  console.log(`capabilities: ${capabilities.capabilities.length} total     ${fmt(byKey(capabilities.capabilities, 'kind'))}`);
  const s = coverage.summary;
  console.log(`coverage:     covered:${s.covered} native:${s.nativeCovered} partial:${s.partial} missing:${s.missing}`);
  console.log(`gaps:         ${coverage.gaps.length} fileable   ${coverage.alreadyTracked.length} already-tracked   ${(coverage.skippedLowValue||[]).length} skipped-low`);
  if (coverage.gaps.length) {
    console.log(`\nfileable gaps (ranked):`);
    for (const g of [...coverage.gaps].sort((a, b) => a.triage.rank - b.triage.rank))
      console.log(`  #${g.triage.rank}  ${g.id.padEnd(22)} ${g.coverage.padEnd(8)} gap:${g.triage.gap} effort:${g.triage.effort}`);
  }
}

// ---- snapshot / diff ------------------------------------------------------
function snapshot(d) {
  if (!existsSync(SNAP_DIR)) mkdirSync(SNAP_DIR, { recursive: true });
  const file = join(SNAP_DIR, `${d.corpus.lastSwept}.json`);
  writeFileSync(file, JSON.stringify(d, null, 2) + '\n');
  console.log(`snapshot written: ${file.replace(ROOT + '/', '')}`);
}

function diffSet(prev, curr, key) {
  const p = new Set(prev.map((x) => x[key]));
  const c = new Set(curr.map((x) => x[key]));
  return {
    added: [...c].filter((x) => !p.has(x)),
    removed: [...p].filter((x) => !c.has(x)),
  };
}

function diff(baselinePath, curr) {
  const prev = JSON.parse(readFileSync(resolve(baselinePath), 'utf8'));
  console.log(`\ngap sweep — delta vs ${baselinePath}\n`);

  const cs = diffSet(prev.corpus.sources, curr.corpus.sources, 'id');
  console.log(`corpus sources:   +[${cs.added.join(', ') || '—'}]  -[${cs.removed.join(', ') || '—'}]`);

  const cap = diffSet(prev.capabilities.capabilities, curr.capabilities.capabilities, 'id');
  console.log(`capabilities:     +[${cap.added.join(', ') || '—'}]  -[${cap.removed.join(', ') || '—'}]`);
  // re-kinded
  const prevKind = Object.fromEntries(prev.capabilities.capabilities.map((c) => [c.id, c.kind]));
  const reKinded = curr.capabilities.capabilities
    .filter((c) => prevKind[c.id] && prevKind[c.id] !== c.kind)
    .map((c) => `${c.id}:${prevKind[c.id]}->${c.kind}`);
  if (reKinded.length) console.log(`re-kinded:        ${reKinded.join(', ')}`);

  const gp = diffSet(prev.coverage.gaps, curr.coverage.gaps, 'id');
  console.log(`fileable gaps:    +[${gp.added.join(', ') || '—'}]  -[${gp.removed.join(', ') || '—'}]`);
  const tr = diffSet(prev.coverage.alreadyTracked, curr.coverage.alreadyTracked, 'id');
  console.log(`newly tracked:    +[${tr.added.join(', ') || '—'}]`);

  const noop = !cs.added.length && !cs.removed.length && !cap.added.length && !cap.removed.length &&
    !reKinded.length && !gp.added.length && !gp.removed.length && !tr.added.length;
  console.log(`\n${noop ? '✓ no-op delta — idempotent (open 0 new items)' : '→ changes detected — file only the NEW fileable gaps (per the skill)'}`);
  return noop;
}

// ---- main -----------------------------------------------------------------
const args = process.argv.slice(2);
const d = load();
const errs = validate(d);
if (errs.length) {
  console.error(`\n✗ gap-sweep invariant violations (${errs.length}):`);
  for (const e of errs) console.error(`  - ${e}`);
  process.exit(1);
}

const baseline = args.find((a) => a.startsWith('--baseline='));
if (args.includes('--snapshot')) snapshot(d);
else if (baseline) diff(baseline.slice('--baseline='.length), d);
else printStatus(d);

console.log(`\n✓ invariants ok`);
