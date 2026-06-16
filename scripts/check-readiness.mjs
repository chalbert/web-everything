#!/usr/bin/env node
/**
 * check-readiness.mjs — the deterministic backlog-readiness CLI (backlog #250).
 *
 * Mirrors the conformance auto-fix CLI (#095) one domain over, but with a strictly DETERMINISTIC
 * core: it never authors content. It reports the dependency-graph cascade (which open items just
 * became agent-ready because their `blockedBy` prerequisites are all resolved) and pure structural
 * normalization findings — and, only with `--apply`, performs the one mechanical, reversible edit:
 * dropping stale (already-resolved) `blockedBy` edges via a frontmatter splice. Bodies are never
 * touched, and Tier C (`decision`) items are left alone.
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
import { computeReadiness, computeSelection, computeBatchPack, buildReadinessReport, spliceStaleEdges } from './readiness/engine.mjs';
import { parseReservations, emptyState, foreignHolds, deprioritizeReserved } from './readiness/reservations.mjs';
import { LOCI } from './check-standards-rules.mjs';

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
const batchPack = computeBatchPack(tierAforPack, budget); // the suggested points-budgeted batch (reservation-aware, locus-agnostic — each item gated in its own locus)

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
  console.log(JSON.stringify({ ...report, selection, batch: { capacity, budget, ...batchPack }, report: buildReadinessReport(selection, batchPack, budget), reservations: reservationsOut, applied: APPLY ? applied : undefined, gaveUp: APPLY ? gaveUp : undefined }, null, 2));
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
  console.log(`${BLD}${c.open} open${RST} · ${GRN}${c.agentReady} agent-ready${RST} (${CYA}${c.batchable} batchable${RST})${c.sliceable ? ` · ${CYA}${c.sliceable} epics${RST}${DIM} (${c.epicActionable} need action)${RST}` : ''} · ${YEL}${c.tierB} Tier B (decisions${c.tierBPrepared ? `, ${GRN}${c.tierBPrepared} prepared${YEL}` : ''})${RST} · ${DIM}${c.tierC} Tier C${RST}${c.inFlight ? ` · ${DIM}${c.inFlight} in flight${RST}` : ''}\n`);

  if (foreign.size) console.log(`${DIM}${foreign.size} item(s) soft-held by another session${MY_SESSION ? ` (yours: ${MY_SESSION}, not penalized)` : ''} — deprioritized below, not excluded (#083).${RST}`);
  // Legible-stop (#083): when the pool is thin/empty but items are in flight elsewhere, say so — a
  // batch's "no eligible Tier-A left" stop then reads as "drained by a concurrent session, re-run
  // shortly," not "backlog empty." Derived live from `status: active`, so it's never a stale signal.
  if (selection.inFlight.length) console.log(`${DIM}${selection.inFlight.length} batch-shaped item(s) in flight (${YEL}status: active${RST}${DIM} — likely another session); if the pool below is thin, that pool is drained, not empty — re-run after they resolve (#083).${RST}`);

  // Stop-the-world guard (#466/#487): an open item tagged `stop-the-world` bulk-rewrites every
  // backlog/*.md and must run on a QUIESCENT backlog — claiming it while another session holds a
  // status:active claim or a live reservation risks a file-level collision between its bulk rewrite and
  // a concurrent claim/resolve splice. Warn (never block) so nobody picks it up mid-collision; the
  // backlog is quiescent only when no foreign claim is in flight AND no reservation is held.
  const stopTheWorld = items.filter((it) => it.status === 'open' && Array.isArray(it.tags) && it.tags.includes('stop-the-world'));
  if (stopTheWorld.length) {
    const quiescent = selection.inFlight.length === 0 && foreign.size === 0;
    const names = stopTheWorld.map((it) => `#${it.num}`).join(', ');
    if (quiescent) console.log(`${GRN}✓ backlog quiescent — stop-the-world item(s) ${names} are safe to claim (no active claims, no reservations).${RST}`);
    else console.log(`${YEL}${BLD}⚠ stop-the-world item(s) ${names} present but the backlog is NOT quiescent${RST}${YEL} — ${selection.inFlight.length} active claim(s) + ${foreign.size} reservation(s) in flight. Don't claim a stop-the-world migration now; wait for the backlog to drain (its own run-precondition).${RST}`);
  }
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
    const lociInPack = new Set();
    batchPack.picked.forEach((it) => {
      run += it.batchCost;
      const lc = it.locus ?? 'webeverything';
      if (lc !== 'webeverything') lociInPack.add(lc);
      // Repo-LOCUS (#498/#500): the pack is locus-agnostic; flag each cross-repo item with its gate home so
      // close-out runs THAT locus's gate (LOCI registry), never this repo's by default. WE items stay unmarked.
      const locusTag = lc !== 'webeverything' ? ` · ${YEL}⌂ ${lc}${RST}${DIM}` : '';
      console.log(`  ${CYA}＋${RST} #${it.num} ${it.id.replace(/^\d+-/, '')} ${DIM}— ${eff(it)} · cost ${it.batchCost} · running ${run}/${budget}${locusTag}${RST}`);
    });
    console.log(`  ${DIM}= ${batchPack.spent}/${budget} pts packed across ${batchPack.picked.length} item(s). Pre-flight each body for a buried fork; the count is whatever fills the budget.${RST}`);
    // Per-locus gate legend — for each cross-repo locus in the pack, show the gate the loop must run to
    // honestly close its items (and where), so a cross-locus batch is self-documenting at the seam.
    if (lociInPack.size) {
      console.log(`  ${DIM}Cross-locus pack — close each ⌂ item with its own gate:${RST}`);
      [...lociInPack].sort().forEach((lc) => {
        const reg = LOCI[lc];
        console.log(`    ${YEL}⌂ ${lc}${RST} ${DIM}→ \`${reg.gateCommand}\` in ${reg.repoPath}${reg.closeoutDiscipline ? ` · ${reg.closeoutDiscipline}` : ''} (commit → ${reg.commitTarget})${RST}`);
      });
    }
  } else console.log(`${DIM}  none eligible — no Tier-A item fits the budget${selection.inFlight.length ? `; ${selection.inFlight.length} batch-shaped item(s) are in flight (status: active) — pool likely drained by a concurrent session, re-run shortly (#083)` : ''}.${RST}`);

  // Tier-A non-batchable splits two ways: buildable-but-large (story·≥13 / unsized story) an agent can
  // still implement, versus epics — unblocked but only ready to SLICE (work lives in child slices, not
  // the epic). Keep them in separate sections so an epic never reads as a buildable to-do (#double-count).
  const restA = tierAforPack.filter((it) => !it.batchable && it.workItem !== 'epic');
  const sliceA = tierAforPack.filter((it) => it.workItem === 'epic');
  console.log(`\n${GRN}${BLD}Other Tier-A — agent-ready, single-item (story·≥13 / unsized)${RST}`);
  if (restA.length) restA.forEach((it) => line(it, it.reservedBy ? `${YEL}⊘${RST}` : `${GRN}▲${RST}`));
  else console.log(`${DIM}  none.${RST}`);

  // Epics split by what they actually need: unsliced (→ /slice) and all-children-done (→ resolve) are
  // ACTIONABLE; the rest just track open children (no epic-level action — their work is those children,
  // already in the pool above). Listing them apart stops a passive rollup reading as a buildable to-do.
  const epicAction = sliceA.filter((it) => it.epicState === 'unsliced' || it.epicState === 'done');
  // No epic-level action: 'tracking' (open children) or 'parked' (a childlessReason gates decomposition —
  // blocked / undecided / untriaged / program). Listed compactly so a parked/tracking epic never reads
  // as a slice to-do; a parked one shows its recorded reason (that reason IS its blocker).
  const epicNoAction = sliceA.filter((it) => it.epicState === 'tracking' || it.epicState === 'parked');
  const epicTag = (it) => it.epicState === 'unsliced' ? `${CYA}slice${RST}` : `${GRN}resolve${RST}`;
  console.log(`\n${CYA}${BLD}Epics needing action — /slice the unsliced (no reason yet), resolve those whose children are all done${RST}`);
  if (epicAction.length) epicAction.forEach((it) => line(it, it.reservedBy ? `${YEL}⊘${RST}` : `${CYA}▣ ${epicTag(it)}`));
  else console.log(`${DIM}  none.${RST}`);
  if (epicNoAction.length) console.log(`${DIM}  + ${epicNoAction.length} epic(s) no action — ${epicNoAction.map((it) => '#' + it.num + (it.epicState === 'parked' ? `(parked: ${it.childlessReason || 'no reason'})` : '')).join(', ')}${RST}`);

  // In flight — only shown when non-empty (keeps the common single-session run unchanged). These are
  // batch-shaped items a sibling session has `claim`ed (status:active); they're excluded from the pool
  // above but listed here so a drained pool is legibly "in flight elsewhere," not "nothing to do."
  if (selection.inFlight.length) {
    console.log(`\n${DIM}${BLD}In flight — batch-shaped items being worked elsewhere (status: active)${RST}`);
    selection.inFlight.forEach((it) => console.log(`  ${YEL}▶${RST} #${it.num} ${it.id.replace(/^\d+-/, '')} ${DIM}— ${eff(it)}${RST}`));
  }

  console.log(`\n${YEL}${BLD}Tier B — decisions (prepared-first, then by leverage; discuss, don't auto-build)${RST}`);
  if (selection.tierB.length) selection.tierB.forEach((it) => {
    const tag = it.prepared ? `${GRN}✓ ready to ratify${RST}` : `${DIM}○ needs prep${RST}`;
    console.log(`  ${YEL}◐${RST} #${it.num} ${it.id.replace(/^\d+-/, '')} ${DIM}—${RST} ${eff(it)} ${tag} ${lev(it)}`);
  });
  else console.log(`${DIM}  none.${RST}`);

  // D3-READINESS (#608) — open builds the loader DEMOTED out of Tier A because their `relatedProject` is
  // a `concept` project with no shipped surface yet (the standard must exist first). Surfaced so the human
  // sees WHY they're held — it's not a `blockedBy` edge, so they'd otherwise look mysteriously absent.
  const pending = items.filter((it) => it.projectPending);
  if (pending.length) {
    console.log(`\n${YEL}${BLD}Held — project pending (D3-readiness): the relatedProject is \`concept\` with no shipped surface; the standard must exist first${RST}`);
    pending.forEach((it) => console.log(`  ${YEL}⊗${RST} #${it.num} ${it.id.replace(/^\d+-/, '')} ${DIM}— relatedProject \`${it.relatedProject}\` (${it.relatedProjectStatus}); demoted to Tier C until the project ships${RST}`));
  }

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
