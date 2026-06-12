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
import { computeReadiness, computeSelection, computeBatchPack, spliceStaleEdges } from './readiness/engine.mjs';
import { parseReservations, emptyState, foreignHolds, deprioritizeReserved } from './readiness/reservations.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const loadBacklog = require(join(ROOT, 'src/_data/backlog.js')); // the SINGLE loader (#248/#249 derivations)

// Calibrated session capacity for points-budgeted batches (.claude/skills/batch-backlog-items/
// capacity.json, kept current by `backlog.mjs calibrate` at close-out). The batch's point budget is
// `capacityPoints × targetFraction` — "take as many points as possible up to ~half a session's worth,"
// not a fixed item count. Missing/unreadable → a conservative built-in default so the CLI still runs.
const CAPACITY_PATH = join(ROOT, '.claude/skills/batch-backlog-items/capacity.json');
function loadCapacity() {
  try {
    const c = JSON.parse(readFileSync(CAPACITY_PATH, 'utf8'));
    return { capacityPoints: c.capacityPoints ?? 100, targetFraction: c.targetFraction ?? 0.5 };
  } catch { return { capacityPoints: 100, targetFraction: 0.5 }; }
}

// Cross-session batch reservations (#083 selection-tier soft hint). A batch soft-holds the items it
// PLANS (backlog.mjs reserve); here we DEPRIORITIZE — never exclude — items held by ANOTHER session so
// a second concurrent batch packs around them. Pass `--session=<my-slug>` so a batch's OWN top-up
// `--select` doesn't deprioritize its own chain. Time-dependent (TTL) + session-aware, so it lives at
// this CLI boundary, NEVER inside the byte-deterministic `computeSelection` core.
const RESERVATIONS_PATH = join(ROOT, '.claude/skills/batch-backlog-items/reservations.json');
function loadReservations() {
  try { return parseReservations(readFileSync(RESERVATIONS_PATH, 'utf8')); }
  catch { return emptyState(); }
}
const MY_SESSION = (() => {
  const m = process.argv.find((a) => a.startsWith('--session='));
  return m ? m.slice('--session='.length) : undefined;
})();

const APPLY = process.argv.includes('--apply');
const JSON_MODE = process.argv.includes('--json');
const SELECT = process.argv.includes('--select');
// --budget=<P> overrides the calibrated budget. Two uses: `/batch <P>` (a one-off budget), and the
// mid-batch SEAM top-up — pass the REMAINING budget (full budget − cost already resolved) so the
// re-pack fills only what's left, absorbing any items the just-resolved work cascade-freed to Tier A.
const BUDGET_OVERRIDE = (() => {
  const m = process.argv.find((a) => a.startsWith('--budget='));
  const n = m ? Number(m.slice('--budget='.length)) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : undefined;
})();

const RED = '\x1b[31m', YEL = '\x1b[33m', GRN = '\x1b[32m', DIM = '\x1b[2m', CYA = '\x1b[36m', BLD = '\x1b[1m', RST = '\x1b[0m';

const items = typeof loadBacklog === 'function' ? loadBacklog() : loadBacklog;
const report = computeReadiness(items);
const selection = computeSelection(items); // the deterministic ranked view (same source as the Prioritisation tab)
const capacity = loadCapacity();
const budget = BUDGET_OVERRIDE ?? Math.round(capacity.capacityPoints * capacity.targetFraction);

// Apply the soft-reservation penalty AFTER the deterministic ranking: foreign-held items sink to the
// back so the pack fills with un-held items first (deprioritize, not exclude). `selection.*` stays the
// pure projection; only the pack + displayed order reflect reservations.
const reservations = loadReservations();
const foreign = foreignHolds(reservations, Date.now(), MY_SESSION);
const tierAforPack = deprioritizeReserved(selection.tierA, foreign);
const batchableForView = deprioritizeReserved(selection.batchable, foreign);
const batchPack = computeBatchPack(tierAforPack, budget); // the suggested points-budgeted batch (reservation-aware)

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
  const reservationsOut = {
    ttlMinutes: reservations.ttlMinutes,
    mySession: MY_SESSION ?? null,
    foreign: [...foreign.entries()].map(([num, session]) => ({ num, session })),
  };
  console.log(JSON.stringify({ ...report, selection, batch: { capacity, budget, ...batchPack }, reservations: reservationsOut, applied: APPLY ? applied : undefined, gaveUp: APPLY ? gaveUp : undefined }, null, 2));
  process.exit(0);
}

// ── --select: the deterministic selection view (skills' step 1; instant, zero desync with the tab) ──
if (SELECT) {
  const eff = (it) => `${it.workItem}${typeof it.size === 'number' ? '·' + it.size : ''}`;
  const lev = (it) => (it.leverageScore ? `${DIM}frees ${it.unblocksToReady}·gates ${it.transitiveUnblocks}${RST}` : '');
  // A foreign-held item carries `reservedBy` (deprioritize, not exclude — #083): tag it so the human
  // sees it was sunk because another session planned it, not skipped.
  const resv = (it) => (it.reservedBy ? ` ${YEL}⊘ held by ${it.reservedBy}${RST}` : '');
  const line = (it, mark) => console.log(`  ${mark} #${it.num} ${it.id.replace(/^\d+-/, '')} ${DIM}—${RST} ${eff(it)} ${lev(it)}${resv(it)}`);

  console.log(`${DIM}check:readiness --select — deterministic ranking (same source as /backlog/ Prioritisation tab)${RST}`);
  const c = selection.counts;
  console.log(`${BLD}${c.open} open${RST} · ${GRN}${c.tierA} Tier A${RST} · ${CYA}${c.batchable} batchable${RST} · ${YEL}${c.tierB} Tier B (decisions${c.tierBPrepared ? `, ${GRN}${c.tierBPrepared} prepared${YEL}` : ''})${RST} · ${DIM}${c.tierC} Tier C${RST}\n`);

  if (foreign.size) console.log(`${DIM}${foreign.size} item(s) soft-held by another session${MY_SESSION ? ` (yours: ${MY_SESSION}, not penalized)` : ''} — deprioritized below, not excluded (#083).${RST}`);
  console.log(`${CYA}${BLD}Batchable — Tier-A task or story·≤8 (the batch pool) — pre-flight each body for a buried fork before chaining${RST}`);
  if (batchableForView.length) batchableForView.forEach((it) => line(it, it.reservedBy ? `${YEL}⊘${RST}` : `${CYA}◆${RST}`));
  else console.log(`${DIM}  none.${RST}`);

  // The suggested points-budgeted batch — "take as many points as possible up to ~half a session,"
  // not a fixed item count. Budget = capacityPoints × targetFraction (calibrated at close-out); cost
  // sums each item's batchCost (size; a task = 2), so a size·8 joins when it fits the remaining points.
  const budgetSrc = BUDGET_OVERRIDE !== undefined ? `override; remaining at a seam` : `${capacity.capacityPoints} capacity × ${capacity.targetFraction}`;
  console.log(`\n${CYA}${BLD}Suggested batch — points budget ${budget}${RST} ${DIM}(${budgetSrc}; cost = size, task = 2)${RST}`);
  if (batchPack.picked.length) {
    let run = 0;
    batchPack.picked.forEach((it) => {
      run += it.batchCost;
      console.log(`  ${CYA}＋${RST} #${it.num} ${it.id.replace(/^\d+-/, '')} ${DIM}— ${eff(it)} · cost ${it.batchCost} · running ${run}/${budget}${RST}`);
    });
    console.log(`  ${DIM}= ${batchPack.spent}/${budget} pts packed across ${batchPack.picked.length} item(s). Pre-flight each body for a buried fork; the count is whatever fills the budget.${RST}`);
  } else console.log(`${DIM}  none eligible — no Tier-A item fits the budget.${RST}`);

  const restA = tierAforPack.filter((it) => !it.batchable);
  console.log(`\n${GRN}${BLD}Other Tier-A — agent-ready, single-item (story·≥13 / epic / unsized)${RST}`);
  if (restA.length) restA.forEach((it) => line(it, it.reservedBy ? `${YEL}⊘${RST}` : `${GRN}▲${RST}`));
  else console.log(`${DIM}  none.${RST}`);

  console.log(`\n${YEL}${BLD}Tier B — decisions (prepared-first, then by leverage; discuss, don't auto-build)${RST}`);
  if (selection.tierB.length) selection.tierB.forEach((it) => {
    const tag = it.prepared ? `${GRN}✓ ready to ratify${RST}` : `${DIM}○ needs prep${RST}`;
    console.log(`  ${YEL}◐${RST} #${it.num} ${it.id.replace(/^\d+-/, '')} ${DIM}—${RST} ${eff(it)} ${tag} ${lev(it)}`);
  });
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
