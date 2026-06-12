/**
 * @file scripts/readiness/engine.mjs
 * @description Deterministic backlog-readiness engine — backlog #250.
 *
 * The readiness analogue of the conformance auto-fix engine (#095), one domain over and with a
 * deliberately NARROWER mandate: this never authors content. It performs only structural repairs
 * that follow mechanically from the dependency graph (#248) and the readiness function (#249) —
 * both already derived by the shared loader in `src/_data/backlog.js` and handed in here as the
 * `tier` / `blockers` fields on each item. We REUSE those derivations; we never recompute the rubric.
 *
 * Two things it produces, both a pure function of current backlog state (same state → identical
 * output every run — the determinism acceptance criterion):
 *
 *   1. **Cascade re-evaluation** — the single highest-value deterministic "fix". An open issue/idea
 *      whose every `blockedBy` prerequisite is now `resolved` has `tier === 'A'` (the loader said so);
 *      the ones that got there by clearing real edges (≥1 blocker, all resolved) are the items that
 *      just became agent-ready. We report them, plus the still-blocked ones and the open blockers
 *      gating each — no LLM, no guesswork.
 *
 *   2. **Structural normalization** — pure field hygiene the graph decides mechanically:
 *        - `stale-edge`        a `blockedBy` entry pointing at an already-`resolved` item. The edge no
 *                              longer gates anything → droppable. This is the ONLY class `--apply`
 *                              acts on (a reversible frontmatter splice, body untouched).
 *        - `missing-date-started`  an `active` item with no `dateStarted`. Flag only — the real start
 *                              date isn't mechanically derivable, so we never invent one.
 *        - `missing-size`      a `story` with no Fibonacci `size`. Flag only — the point estimate is
 *                              human judgment. (Scoped to stories, matching the validator's hard rule.)
 *
 * It REFUSES anything requiring judgment: it writes no body prose, invents no file paths, and leaves
 * Tier C (`decision`/`review`) items untouched. Authoring is non-deterministic by nature and is
 * quarantined out of this core (a spec-gap proposer, if ever wanted, is its own `--dry-run` item).
 *
 * This module is PURE — no fs, no process. The CLI (`scripts/check-readiness.mjs`) injects the loaded
 * items and the read/write callbacks, so the same logic runs against the live backlog or an in-memory
 * fixture in tests.
 */

/** Numeric-stable ascending sort by the leading NNN id, so output never depends on load order. */
const byNum = (a, b) => Number(a.num) - Number(b.num);

/** Is this item a buildable (non-decision/review) work item the readiness rubric can gate? */
const isBuildable = (it) => it.type === 'issue' || it.type === 'idea';

/**
 * Compute the deterministic readiness report for a set of loaded backlog items.
 *
 * @param {Array<object>} items  Items from `src/_data/backlog.js` — each carries the loader-derived
 *   `tier` (#249) and `blockers` (#248: `[{ num, status, ... }]`) we reuse rather than recompute.
 * @returns {{
 *   cascade: {
 *     nowReady: Array<{ num: string, id: string, title: string, clearedBlockers: string[] }>,
 *     stillBlocked: Array<{ num: string, id: string, title: string, openBlockers: Array<{ num: string, status: string }> }>,
 *   },
 *   normalization: Array<{ kind: string, num: string, id: string, file: string, applicable: boolean, detail: string, staleBlockers?: string[] }>,
 * }}
 */
export function computeReadiness(items) {
  const fileOf = (it) => `backlog/${it.id}.md`;

  // ── 1. Cascade re-evaluation ────────────────────────────────────────────────
  const nowReady = [];
  const stillBlocked = [];
  for (const it of items) {
    if (it.status !== 'open' || !isBuildable(it)) continue; // tier is moot for non-open / non-buildable
    const blockers = Array.isArray(it.blockers) ? it.blockers : [];
    if (blockers.length === 0) continue; // never had a prerequisite — not a cascade event
    const openBlockers = blockers.filter((b) => b.status !== 'resolved');
    if (openBlockers.length === 0) {
      // Every prerequisite cleared → the loader put this at tier A. This is the item the cascade frees.
      nowReady.push({ num: it.num, id: it.id, title: it.title, clearedBlockers: blockers.map((b) => b.num) });
    } else {
      stillBlocked.push({
        num: it.num, id: it.id, title: it.title,
        openBlockers: openBlockers.map((b) => ({ num: b.num, status: b.status })),
      });
    }
  }

  // ── 2. Structural normalization ─────────────────────────────────────────────
  const normalization = [];
  for (const it of items) {
    // stale-edge — resolved prerequisite still listed in blockedBy. The ONLY auto-applicable class.
    const stale = (Array.isArray(it.blockers) ? it.blockers : []).filter((b) => b.status === 'resolved');
    if (stale.length) {
      const nums = stale.map((b) => b.num);
      normalization.push({
        kind: 'stale-edge', num: it.num, id: it.id, file: fileOf(it), applicable: true,
        staleBlockers: nums,
        detail: `blockedBy lists already-resolved #${nums.join(', #')} — edge no longer gates, can be dropped`,
      });
    }
    // missing-date-started — an active claim with no start date. Flag only (no derivable value).
    if (it.status === 'active' && !it.dateStarted) {
      normalization.push({
        kind: 'missing-date-started', num: it.num, id: it.id, file: fileOf(it), applicable: false,
        detail: 'active but has no dateStarted — burndown needs it; supply the real claim date by hand',
      });
    }
    // missing-size — a story with no Fibonacci points. Flag only (the estimate is human judgment).
    // Scoped to stories to match the validator's hard rule exactly; an epic's points depend on
    // whether it is unstoried (a parent-graph judgment), so epics are deliberately not flagged here.
    if (it.workItem === 'story' && it.size === undefined) {
      normalization.push({
        kind: 'missing-size', num: it.num, id: it.id, file: fileOf(it), applicable: false,
        detail: 'story has no size — assign Fibonacci points by hand',
      });
    }
  }

  return {
    cascade: { nowReady: nowReady.sort(byNum), stillBlocked: stillBlocked.sort(byNum) },
    normalization: normalization.sort((a, b) => byNum(a, b) || a.kind.localeCompare(b.kind)),
  };
}

/**
 * The deterministic SELECTION view — the same ranking the `/backlog/` Prioritisation tab renders,
 * exposed as a CLI so the `next-backlog-item` / `batch-backlog-items` skills CONSUME it instead of
 * re-globbing `backlog/*.md` and re-running the readiness rubric in prose (the bug: the tab found 23
 * batchable items instantly, while a hand-derived `/batch` pass found 2 after minutes). It is a pure
 * projection of loader-derived fields (`tier` #249, `batchable`/`leverageScore` #254) — it RECOMPUTES
 * NOTHING. The skills run this once for the ranked shortlist, then apply the only judgment a field
 * can't decide: the body-fork pre-flight, on the shortlist only.
 *
 * Ordering (deterministic; same state → same order): leverage desc (unblock-the-chain-first) → issue
 * before idea → smaller first (task=0, then `size`) → NNN asc. The Tier-A list and its `batchable`
 * subset share this order; Tier B (decisions, one nod away) is ranked by leverage for decision-mode.
 *
 * @param {Array<object>} items  Loader items — each carries `tier`, `batchable`, `leverageScore`,
 *   `directUnblocks`, `transitiveUnblocks`, `unblocksToReady` (all `src/_data/backlog.js` derivations).
 * @returns {{
 *   counts: { open: number, tierA: number, tierB: number, tierC: number, batchable: number },
 *   tierA: Array<object>, batchable: Array<object>, tierB: Array<object>,
 * }}
 */
export function computeSelection(items) {
  const project = (it) => ({
    num: it.num, id: it.id, title: it.title, type: it.type,
    workItem: it.workItem, size: it.size, tier: it.tier, batchable: !!it.batchable,
    batchCost: it.batchCost,
    // A decision is PREPARED once `preparedDate` is set — its forks are researched, the research is
    // published as a /research/ topic, and each fork states options + a bold default (the
    // "prepared-fork shape", backlog-workflow.md). A prepared Tier-B item is ready to *ratify*, not research.
    prepared: !!it.preparedDate, preparedDate: it.preparedDate ?? null,
    leverageScore: it.leverageScore ?? 0,
    directUnblocks: it.directUnblocks ?? 0,
    transitiveUnblocks: it.transitiveUnblocks ?? 0,
    unblocksToReady: it.unblocksToReady ?? 0,
  });
  // Smaller-first key: a `task` is bounded sub-work (0); a sized story uses its points; anything
  // unsized sorts last. Effort tiebreak only — leverage and type dominate.
  const sizeKey = (it) => (it.workItem === 'task' ? 0 : typeof it.size === 'number' ? it.size : 99);
  const typeKey = (it) => (it.type === 'issue' ? 0 : 1); // issue (known fix) before idea (build)
  const rank = (a, b) =>
    (b.leverageScore ?? 0) - (a.leverageScore ?? 0)
    || typeKey(a) - typeKey(b)
    || sizeKey(a) - sizeKey(b)
    || Number(a.num) - Number(b.num);

  // Tier-B (decisions): a PREPARED decision (`preparedDate` set — forks researched, options stated)
  // is ready to ratify, so it ranks above an un-prepared fork that still needs a research pass; within
  // each group the usual leverage order applies. Surfacing prepared-first is the payoff of doing the
  // fork-readiness prep ahead of the call.
  const rankB = (a, b) => (Number(!!b.preparedDate) - Number(!!a.preparedDate)) || rank(a, b);

  const open = items.filter((it) => it.status === 'open');
  const tierA = open.filter((it) => it.tier === 'A').sort(rank).map(project);
  const tierB = open.filter((it) => it.tier === 'B').sort(rankB).map(project);
  const tierC = open.filter((it) => it.tier === 'C');
  const batchable = tierA.filter((it) => it.batchable);

  return {
    counts: { open: open.length, tierA: tierA.length, tierB: tierB.length, tierBPrepared: tierB.filter((it) => it.prepared).length, tierC: tierC.length, batchable: batchable.length },
    tierA, batchable, tierB,
  };
}

/**
 * Greedy POINTS-BUDGET pack — the suggested batch for a given points budget. Walks the already-ranked
 * Tier-A list (leverage → issue → smaller → NNN) and takes each batchable item whose `batchCost`
 * fits the remaining budget, until the budget is exhausted or the list ends. This is "take as many
 * points as possible," not "take N items": a single `size·8` joins when it fits, and the old count cap
 * + ≤3 gate would have left both the points and the slot on the table. A too-large item is SKIPPED (not
 * a hard break), so a smaller, lower-ranked item still gets packed behind it — maximising points used.
 * Deterministic: ranked input + greedy walk → identical pack for identical state + budget.
 *
 * @param {Array<object>} tierA   Ranked Tier-A projections from {@link computeSelection}.
 * @param {number} budget         The points budget to fill (sum of `batchCost`).
 * @returns {{ picked: Array<object>, spent: number, budget: number, skipped: Array<object> }}
 */
export function computeBatchPack(tierA, budget) {
  const picked = [];
  const skipped = [];
  let spent = 0;
  for (const it of tierA) {
    if (!it.batchable || typeof it.batchCost !== 'number') continue;
    if (spent + it.batchCost > budget) { skipped.push(it); continue; } // doesn't fit — keep scanning
    picked.push(it);
    spent += it.batchCost;
  }
  return { picked, spent, budget, skipped };
}

/**
 * Splice a `stale-edge` fix into a backlog file's frontmatter: drop the resolved NNNs from its
 * `blockedBy` flow array, leaving any still-open prerequisites. SURGICAL — it edits only the one
 * `blockedBy:` line inside the frontmatter and never touches the body (the #250 "splice frontmatter,
 * never rewrite bodies" rule). Returns the new content, or `null` if it can't safely splice (no
 * frontmatter, no flow-style `blockedBy` line, or a parse it doesn't recognise) — in which case the
 * caller leaves the file alone and reports a give-up rather than guessing.
 *
 * @param {string} content       Current file text.
 * @param {string[]} dropNums    NNN ids to remove from blockedBy (the resolved ones).
 * @returns {string|null}
 */
export function spliceStaleEdges(content, dropNums) {
  const drop = new Set(dropNums.map(String));
  // Bound the edit to the frontmatter block (first `---` … next `---`); never reach into the body.
  const fm = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fm) return null;
  const fmStart = fm.index + fm[0].indexOf('\n') + 1;
  const fmEnd = fm.index + fm[0].length - 3; // index of the closing `---`
  const fmText = content.slice(fmStart, fmEnd);

  // Match a single-line flow array: `blockedBy: ["248", "249"]` (the form the repo writes).
  const lineRe = /^(blockedBy:[ \t]*)\[([^\]\n]*)\][ \t]*$/m;
  const m = lineRe.exec(fmText);
  if (!m) return null; // block-style or absent — don't guess; give up safely

  const entries = [...m[2].matchAll(/"([^"]+)"|'([^']+)'|([^\s,]+)/g)]
    .map((e) => (e[1] ?? e[2] ?? e[3]).trim())
    .filter(Boolean);
  const remaining = entries.filter((n) => !drop.has(String(n)));
  if (remaining.length === entries.length) return null; // nothing to drop — no-op, don't rewrite

  const lineStart = fmStart + m.index;
  const lineEnd = lineStart + m[0].length;
  let newContent;
  if (remaining.length === 0) {
    // Whole edge cleared → remove the line entirely (including its trailing newline).
    const after = content.slice(lineEnd);
    const trimmed = after.startsWith('\n') ? after.slice(1) : after.startsWith('\r\n') ? after.slice(2) : after;
    newContent = content.slice(0, lineStart) + trimmed;
  } else {
    const replacement = `${m[1]}[${remaining.map((n) => `"${n}"`).join(', ')}]`;
    newContent = content.slice(0, lineStart) + replacement + content.slice(lineEnd);
  }
  return newContent;
}
