/**
 * @file scripts/operations/suggest-next.mjs
 * @description THE `suggest-next` DECLARATION — the first operation with an HTTP caller (#3036, epic #3029).
 *
 * WHAT IT IS: read the board, return the ranked shortlist of what to work on next. The operator's own request
 * — *an API that prioritises and returns the next suggested item* — as a declared operation.
 *
 * ── WHY THIS OPERATION SHIPS WITH THE HTTP ADAPTER ──────────────────────────────────────────────────────────
 *
 * It is **pure `compute`, both steps**. The engine's vocabulary is closed at `compute | judge | confirm |
 * effect` ({@link ./step-kinds.mjs}); `compute` is the only kind that cannot reach the world. So this
 * declaration has no juror to spawn, no person to ask, no effect to apply and nothing to write — which is
 * exactly what {@link ./http-adapter.mjs} reads off the step kinds to give it a `GET`-only surface with no run
 * records and no resume route. It exercises the whole HTTP path end to end while being **structurally**
 * incapable of changing anything.
 *
 * It also needs none of the vocabulary the engine is still missing. A *build* is not expressible in any of the
 * four kinds — that is #3030's open spike (`does the background-agent lifecycle cover a dispatch effect?`), and
 * deliberately not this.
 *
 * ── IT RE-DECLARES; IT DOES NOT RE-IMPLEMENT ────────────────────────────────────────────────────────────────
 *
 * The ranking already exists and is not reproduced here. If a reader finds prioritisation LOGIC in this file
 * rather than a call into one of these, that is the bug:
 *
 *   | step        | kind      | the implementation behind it                                                  |
 *   |-------------|-----------|-------------------------------------------------------------------------------|
 *   | `board`     | `compute` | `computeSelection` (`we:scripts/readiness/engine.mjs`, #250/#254) over the      |
 *   |             |           | SINGLE loader `we:src/_data/backlog.js` (#248/#249) — the same ranked view the  |
 *   |             |           | `/backlog/` Prioritisation tab and `check:readiness --select` render. Plus the  |
 *   |             |           | boundary exclusions `check-readiness.mjs` applies: `heldNums`                   |
 *   |             |           | (`we:scripts/readiness/prepare-hold-state.mjs`, #2219(b)/#2264) and             |
 *   |             |           | `openPrItemNums` (`we:scripts/lib/open-pr-items.mjs`).                          |
 *   | `shortlist` | `compute` | pure projection — pick the tier's list, drop the excluded, take `limit`.        |
 *
 * The ordering is `computeSelection`'s and is restated nowhere: leverage desc → smaller first → NNN asc, with
 * Tier-B ranked prepared-first. The `why` line on each suggestion RENDERS those same fields; it does not
 * recompute them.
 *
 * ── THE EXCLUSIONS ARE APPLIED, AND SAID OUT LOUD ───────────────────────────────────────────────────────────
 *
 * `computeSelection` is deliberately byte-deterministic and therefore knows nothing about prepare-holds (a
 * lease) or open PRs (the network). `check-readiness.mjs` applies both at its CLI boundary, and an API that
 * skipped them would re-hand work that is already in a PR — the documented mis-pick that exclusion exists to
 * stop. So they are applied here too, through the SAME two functions, injected as `loadExclusions` for the
 * same reason `review-pr` injects `readPr`: the declaration stays unit-testable with no `gh` and no leases.
 * Every finding reports which exclusion sources were live and which were unavailable, so a caller is never
 * silently given a less-filtered answer than `check:readiness --select` would.
 *
 * WHAT IS NOT APPLIED, and why: the soft cross-session RESERVATION penalty (`deprioritizeReserved`). It is a
 * *batch-packing* signal — "another session plans to take this" — and it reorders rather than excludes. A
 * single-item suggestion has no pack to make room in, and honouring a soft hold would make two callers
 * disagree about the top pick for reasons neither can see. `check:readiness --select` remains the surface for
 * the reservation-aware pack.
 *
 * ── IO IS INJECTED, EXACTLY AS `review-pr` DOES IT ──────────────────────────────────────────────────────────
 *
 * `board` is a `compute` step and loading the board is io. The vocabulary is closed at four kinds and *"an
 * operation that appears to need a fifth kind is a signal to change the model"* (#3031), so the answer is not a
 * `read` kind: the io is INJECTED and the real binding lives in {@link ./suggest-next-io.mjs}. The engine still
 * performs no io of its own and the shaping half stays pure. What is honestly true: the fn the engine calls is
 * a pure shaper wrapped around two injected reads.
 *
 * PURE apart from those injected readers: no fs, no clock, no process, no network in this file.
 */

import { op } from './registry.mjs';
import { compute } from './step-kinds.mjs';
import { computeSelection } from '../readiness/engine.mjs';

/** The operation's stable id. Adapters resolve it by this name. */
export const SUGGEST_NEXT_OP = 'suggest-next';

/**
 * The tiers a caller may ask for, as a CLOSED SET on the declaration.
 *
 *  - `A` — agent-ready BUILD work. Unblocked, decided, an agent can start now.
 *  - `B` — open DECISIONS, one nod away from unblocking work. `computeSelection` ranks these prepared-first
 *    (a `preparedDate` means the forks are researched and it is ready to *ratify*, not to research).
 *
 * Declaring the set buys three things from one line (see `normalizeInputSchema` in {@link ./registry.mjs}):
 * `validateInput` refuses anything outside it before a run exists, the command line prints `A|B` instead of
 * `<string>`, and the HTTP adapter's describe route lists it.
 */
export const SUGGEST_TIERS = Object.freeze(['A', 'B']);

/** How many suggestions come back by default, and the ceiling a request is clamped to. */
export const DEFAULT_LIMIT = 5;
export const MAX_LIMIT = 50;

/**
 * WHY `limit` IS CLAMPED RATHER THAN REFUSED — and the gap that forces the choice.
 *
 * The declaration vocabulary has `enum` (a closed set) but **no numeric range**, so "an integer from 1 to 50"
 * is not expressible in `input`. That leaves two places to enforce it: inside the first step, where the refusal
 * arrives *after* a run record exists — the exact anti-pattern `registry.mjs` names when it explains why `enum`
 * is validated before `startRun` — or here, as a clamp. A page size is a display concern, not a correctness
 * gate, so it clamps, and the finding reports BOTH the requested value and the applied one so nothing is
 * silently swallowed.
 *
 * The missing range constraint is a real gap in the declaration shape, not a thing to work around twice. It
 * belongs to the epic, not to this slice — adding a schema feature is its own ruling.
 *
 * @param {number} requested
 * @returns {number}
 */
export function clampLimit(requested) {
  const n = Math.floor(Number(requested));
  if (!Number.isFinite(n)) return DEFAULT_LIMIT;
  return Math.min(Math.max(n, 1), MAX_LIMIT);
}

/** Item numbers are compared zero-padded to 3, exactly as `check-readiness.mjs` compares them. */
const padNum = (num) => String(num).padStart(3, '0');

/**
 * SHAPE the board read into the `board` finding. PURE — separated from the injected readers so every refusal
 * below is testable with no loader, no leases and no `gh`.
 *
 * @param {object} raw
 * @param {Array<object>} raw.items - loader items from `we:src/_data/backlog.js`.
 * @param {{nums?: string[], sources?: Array<object>}} [raw.exclusions]
 * @returns {object} the `board` finding.
 */
export function shapeBoardFinding(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error(`suggest-next.board: the injected reader returned ${typeof raw}, not a board object`);
  }
  if (!Array.isArray(raw.items)) {
    throw new Error(
      'suggest-next.board: the injected `loadBoard` must return `{ items }` — the array `we:src/_data/backlog.js` '
      + 'produces. Refusing to rank an unknown shape rather than ranking an empty board and reporting "nothing to do".',
    );
  }
  // THE RANKING, NOT A COPY OF IT. Every ordering decision below this line belongs to `computeSelection`.
  const selection = computeSelection(raw.items);
  const exclusions = raw.exclusions && typeof raw.exclusions === 'object' ? raw.exclusions : {};
  const excludedNums = Array.isArray(exclusions.nums) ? [...new Set(exclusions.nums.map(padNum))].sort() : [];
  return {
    counts: selection.counts,
    tierA: selection.tierA,
    batchable: selection.batchable,
    sliceable: selection.sliceable,
    tierB: selection.tierB,
    filler: selection.filler,
    inFlight: selection.inFlight,
    excludedNums,
    // WHICH filters actually ran. A caller must be able to tell "nothing was excluded" from "the exclusion
    // source was unavailable" — the second is a weaker answer wearing the first's clothes.
    exclusionSources: Array.isArray(exclusions.sources)
      ? exclusions.sources.map((s) => ({
        id: String(s.id ?? 'unknown'),
        applied: s.unavailable !== true,
        count: Array.isArray(s.nums) ? s.nums.length : 0,
        reason: s.reason ? String(s.reason) : null,
      }))
      : [],
  };
}

/**
 * The one-line explanation of a suggestion's rank. It RESTATES `computeSelection`'s ordering key — leverage,
 * then effort, then id — in the wording `check:readiness --select` already uses (`frees N · gates M`). It
 * computes no ranking of its own. PURE.
 *
 * @param {object} item - a `computeSelection` projection.
 * @returns {string}
 */
export function explainRank(item) {
  const effort = `${item.kind}${typeof item.size === 'number' ? `·${item.size}` : ''}`;
  const bits = [effort];
  if (item.leverageScore) bits.push(`leverage ${item.leverageScore} (frees ${item.unblocksToReady} · gates ${item.transitiveUnblocks})`);
  else bits.push('leverage 0 — unblocks nothing; ranked by effort then id');
  if (item.tier === 'B') bits.push(item.prepared ? `prepared ${item.preparedDate} — ready to ratify` : 'not prepared — needs a research pass first');
  if (item.epicState === 'unsliced') bits.push('an unsliced epic — needs /slice, not a build');
  if (item.locus && item.locus !== 'webeverything') bits.push(`gate home: ${item.locus}`);
  return bits.join(' · ');
}

/**
 * PROJECT the board finding into the ranked shortlist. PURE, and the ORDER IS NOT TOUCHED: the tier list
 * arrives already ranked by `computeSelection` and this only filters and slices it.
 *
 * @param {object} o
 * @param {object} o.board - the `board` finding.
 * @param {string} o.tier
 * @param {number} o.limit
 * @param {boolean} o.batchableOnly
 * @returns {object} the `shortlist` finding — and the run's verdict.
 */
export function rankShortlist({ board, tier, limit, batchableOnly }) {
  const applied = clampLimit(limit);
  const excluded = new Set(board.excludedNums ?? []);
  const pool = tier === 'B' ? board.tierB : (batchableOnly ? board.batchable : board.tierA);
  const eligible = (pool ?? []).filter((it) => !excluded.has(padNum(it.num)));
  const suggested = eligible.slice(0, applied).map((it, rank) => ({
    rank: rank + 1,
    num: it.num,
    id: it.id,
    title: it.title,
    kind: it.kind,
    size: it.size ?? null,
    tier: it.tier,
    locus: it.locus,
    batchable: it.batchable,
    batchCost: it.batchCost ?? null,
    leverageScore: it.leverageScore,
    unblocksToReady: it.unblocksToReady,
    transitiveUnblocks: it.transitiveUnblocks,
    prepared: it.prepared,
    epicState: it.epicState,
    why: explainRank(it),
  }));
  return {
    tier,
    batchableOnly,
    requestedLimit: limit,
    limit: applied,
    // `next` is the answer to the operator's actual question. `suggested` is the shortlist behind it.
    next: suggested[0] ?? null,
    suggested,
    eligible: eligible.length,
    excludedNums: [...excluded],
    exclusionSources: board.exclusionSources ?? [],
    counts: board.counts,
    // LEGIBLE EMPTY (#083). An empty pool means one of three different things and they are not
    // interchangeable — `computeSelection` already derives the numbers that tell them apart.
    empty: eligible.length === 0
      ? {
        inFlight: board.inFlight?.length ?? 0,
        filler: board.filler?.length ?? 0,
        note: (board.inFlight?.length ?? 0) > 0
          ? 'the pool is DRAINED, not empty — batch-shaped items are `status: active` in another session; re-run after they resolve (#083).'
          : (board.filler?.length ?? 0) > 0
            ? 'nothing agent-ready, but `priority: low` filler exists — browsable and pickable when nothing better does.'
            : 'the pool is genuinely empty at this tier.',
      }
      : null,
  };
}

/**
 * BUILD THE DECLARATION. Built per call so nothing leaks between registries — same discipline as
 * `reviewPrOperation`.
 *
 * @param {object} deps
 * @param {() => {items: Array<object>}} deps.loadBoard - the loader read. `we:scripts/operations/suggest-next-io.mjs`
 *   supplies the real one; tests supply a fixture array.
 * @param {(o: {scanOpenPrs: boolean}) => {nums: string[], sources: Array<object>}} [deps.loadExclusions] -
 *   prepare-holds + open-PR numbers. Omitted ⇒ no exclusions, reported as such in the finding.
 * @returns {object} the frozen declaration from `op()`.
 */
export function suggestNextOperation({ loadBoard, loadExclusions } = {}) {
  if (typeof loadBoard !== 'function') {
    throw new TypeError(
      'suggest-next: needs a `loadBoard()` reader returning `{ items }` — the io is INJECTED so the declaration '
      + 'stays testable without the loader; the real binding is `we:scripts/operations/suggest-next-io.mjs`.',
    );
  }

  return op(SUGGEST_NEXT_OP, {
    input: {
      // Which ranked list to draw from. A CLOSED SET, so `A|B` prints in `--help` and in the HTTP describe
      // route, and anything else is refused before a run record exists.
      tier: { type: 'string', required: false, default: 'A', enum: [...SUGGEST_TIERS] },
      // How many suggestions. Clamped, not refused — see {@link clampLimit} for why, and for the gap.
      limit: { type: 'number', required: false, default: DEFAULT_LIMIT },
      // Tier-A only: restrict to the batch pool (task or story·≤8), which is what `/batch` packs from.
      batchableOnly: { type: 'boolean', required: false, default: false },
      // The open-PR exclusion needs `gh` and the network. ON by default, matching `check:readiness --select`,
      // because a suggestion that re-hands work already sitting in a PR is the documented mis-pick. A caller
      // that wants a fast, network-free read passes `false` and is told in `exclusionSources` what it gave up.
      scanOpenPrs: { type: 'boolean', required: false, default: true },
    },
    // The shortlist IS the run's verdict — declared, not inferred by a caller reading findings.
    verdictFrom: 'shortlist',

    // ── 1. board ────────────────────────────────────────────────────────────────────────────────────────────
    // The whole ranked view, from the single loader through `computeSelection`, plus the two boundary
    // exclusions. Reads only `input.scanOpenPrs`, so the shortlist's own inputs are structurally out of reach
    // here — the projected view does not contain them.
    board: compute({
      reads: ['input.scanOpenPrs'],
      fn: (view) => shapeBoardFinding({
        ...loadBoard(),
        exclusions: typeof loadExclusions === 'function'
          ? loadExclusions({ scanOpenPrs: view.input.scanOpenPrs === true })
          : { nums: [], sources: [] },
      }),
    }),

    // ── 2. shortlist ────────────────────────────────────────────────────────────────────────────────────────
    // Pure projection over the already-ranked lists. Reorders nothing.
    shortlist: compute({
      reads: ['input.tier', 'input.limit', 'input.batchableOnly', 'findings.board'],
      fn: (view) => rankShortlist({
        board: view.findings.board,
        tier: view.input.tier,
        limit: view.input.limit,
        batchableOnly: view.input.batchableOnly === true,
      }),
    }),
  });
}
