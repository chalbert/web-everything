#!/usr/bin/env node
/**
 * check-readiness.mjs — the deterministic backlog-readiness CLI (backlog #250).
 *
 * Mirrors the conformance auto-fix CLI (#095) one domain over, but with a strictly DETERMINISTIC
 * core: it never authors content. It reports the dependency-graph cascade (which open items just
 * became agent-ready because their `blockedBy` prerequisites are all resolved) and pure structural
 * normalization findings — and, only with `--apply`, performs the one mechanical, reversible edit:
 * dropping stale (already-resolved) `blockedBy` edges via a frontmatter splice. Bodies are never
 * touched, and Tier C (`decision`/`review`) items are left alone.
 *
 * The cascade + readiness derivations come straight from the shared loader (`src/_data/backlog.js`,
 * via #248/#249) — we reuse its `tier`/`blockers`, we do not recompute the rubric.
 *
 * Usage:
 *   node scripts/check-readiness.mjs            # dry-run (default): print cascade + normalization, write nothing
 *   node scripts/check-readiness.mjs --apply    # also drop stale blockedBy edges (frontmatter splice)
 *   node scripts/check-readiness.mjs --json     # machine-readable report on stdout
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { computeReadiness, computeSelection, spliceStaleEdges } from './readiness/engine.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const loadBacklog = require(join(ROOT, 'src/_data/backlog.js')); // the SINGLE loader (#248/#249 derivations)

const APPLY = process.argv.includes('--apply');
const JSON_MODE = process.argv.includes('--json');
const SELECT = process.argv.includes('--select');

const RED = '\x1b[31m', YEL = '\x1b[33m', GRN = '\x1b[32m', DIM = '\x1b[2m', CYA = '\x1b[36m', BLD = '\x1b[1m', RST = '\x1b[0m';

const items = typeof loadBacklog === 'function' ? loadBacklog() : loadBacklog;
const report = computeReadiness(items);
const selection = computeSelection(items); // the deterministic ranked view (same source as the Prioritisation tab)

// ── --apply: the only mechanical edit — drop stale (resolved) blockedBy edges ────
const applied = [];
const gaveUp = [];
if (APPLY) {
  for (const f of report.normalization.filter((n) => n.kind === 'stale-edge')) {
    const abs = join(ROOT, f.file);
    const before = readFileSync(abs, 'utf8');
    const after = spliceStaleEdges(before, f.staleBlockers);
    if (after === null || after === before) {
      gaveUp.push({ ...f, reason: 'could not safely splice (no flow-style blockedBy line / nothing to drop)' });
      continue;
    }
    writeFileSync(abs, after);
    applied.push(f);
  }
}

if (JSON_MODE) {
  console.log(JSON.stringify({ ...report, selection, applied: APPLY ? applied : undefined, gaveUp: APPLY ? gaveUp : undefined }, null, 2));
  process.exit(0);
}

// ── --select: the deterministic selection view (skills' step 1; instant, zero desync with the tab) ──
if (SELECT) {
  const eff = (it) => `${it.workItem}${typeof it.size === 'number' ? '·' + it.size : ''}`;
  const lev = (it) => (it.leverageScore ? `${DIM}frees ${it.unblocksToReady}·gates ${it.transitiveUnblocks}${RST}` : '');
  const line = (it, mark) => console.log(`  ${mark} #${it.num} ${it.id.replace(/^\d+-/, '')} ${DIM}—${RST} ${eff(it)} ${lev(it)}`);

  console.log(`${DIM}check:readiness --select — deterministic ranking (same source as /backlog/ Prioritisation tab)${RST}`);
  const c = selection.counts;
  console.log(`${BLD}${c.open} open${RST} · ${GRN}${c.tierA} Tier A${RST} · ${CYA}${c.batchable} batchable${RST} · ${YEL}${c.tierB} Tier B (decisions)${RST} · ${DIM}${c.tierC} Tier C${RST}\n`);

  console.log(`${CYA}${BLD}Batchable — small Tier-A (story·≤3 or task) — pre-flight each body for a buried fork before chaining${RST}`);
  if (selection.batchable.length) selection.batchable.forEach((it) => line(it, `${CYA}◆${RST}`));
  else console.log(`${DIM}  none.${RST}`);

  const restA = selection.tierA.filter((it) => !it.batchable);
  console.log(`\n${GRN}${BLD}Other Tier-A — agent-ready, single-item (story·≥5 / epic / unsized)${RST}`);
  if (restA.length) restA.forEach((it) => line(it, `${GRN}▲${RST}`));
  else console.log(`${DIM}  none.${RST}`);

  console.log(`\n${YEL}${BLD}Tier B — decisions one nod away (ranked by leverage; discuss, don't auto-build)${RST}`);
  if (selection.tierB.length) selection.tierB.forEach((it) => line(it, `${YEL}◐${RST}`));
  else console.log(`${DIM}  none.${RST}`);

  console.log(`\n${DIM}Ranking is a pure projection of loader fields (tier/batchable/leverage) — instant, identical to the tab, no rubric re-derived. Body-fork pre-flight (skill) is the only per-item judgment left.${RST}`);
  process.exit(0);
}

// ── Human report ─────────────────────────────────────────────────────────────
console.log(`${DIM}check:readiness — Web Everything (deterministic; ${APPLY ? 'apply' : 'dry-run'})${RST}`);

console.log(`\n${BLD}Cascade — agent-readiness${RST}`);
if (report.cascade.nowReady.length) {
  console.log(`${GRN}  ▲ now Tier A (all prerequisites resolved):${RST}`);
  for (const r of report.cascade.nowReady)
    console.log(`    ${r.id} ${DIM}— cleared #${r.clearedBlockers.join(', #')}${RST}`);
} else {
  console.log(`${DIM}  no items newly unblocked (no open item has a freshly-cleared prerequisite chain).${RST}`);
}
if (report.cascade.stillBlocked.length) {
  console.log(`${YEL}  ◌ still blocked:${RST}`);
  for (const r of report.cascade.stillBlocked)
    console.log(`    ${r.id} ${DIM}— waiting on ${r.openBlockers.map((b) => `#${b.num} (${b.status})`).join(', ')}${RST}`);
}

console.log(`\n${BLD}Structural normalization${RST}`);
if (!report.normalization.length) {
  console.log(`${GRN}  ✓ no structural hygiene findings.${RST}`);
} else {
  for (const n of report.normalization) {
    const tag = n.applicable ? `${CYA}[auto]${RST}` : `${DIM}[flag]${RST}`;
    const mark = APPLY && n.kind === 'stale-edge' && applied.some((a) => a.id === n.id)
      ? `${GRN}fixed${RST} ` : '';
    console.log(`  ${tag} ${mark}${n.id} ${DIM}— ${n.detail}${RST}`);
  }
}

if (APPLY) {
  console.log(
    `\n${applied.length ? GRN : DIM}${applied.length} stale edge(s) dropped${RST}` +
    `${gaveUp.length ? `, ${YEL}${gaveUp.length} skipped${RST}` : ''}.`,
  );
  for (const g of gaveUp) console.log(`  ${YEL}skipped${RST} #${g.num} ${g.id} ${DIM}— ${g.reason}${RST}`);
} else {
  const autoCount = report.normalization.filter((n) => n.applicable).length;
  if (autoCount) console.log(`\n${DIM}Re-run with ${RST}--apply${DIM} to drop ${autoCount} stale edge(s). Flag-only findings need a human value.${RST}`);
}

process.exit(0);
