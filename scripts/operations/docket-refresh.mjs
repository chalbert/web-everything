/**
 * @file scripts/operations/docket-refresh.mjs
 * @description THE `docket-refresh` DECLARATION (#3723, under #3718 / epic #3383) — refresh the Decision Docket's
 *   data when work lands, and hand off a publish only when that data really changed.
 *
 * WHY IT EXISTS. The docket's RECORD is already mechanical: `we:scripts/gen-decision-docket.mjs` reads every
 * decision off a git ref. What was not mechanical is the REFRESH (nothing ran it when a PR that prepares or
 * ratifies a decision merged) and the PUBLISH (a session running the `Artifact` tool). This operation is the
 * refresh, and the smallest possible hand-off for the publish. It is the cheapest consumer of the landing
 * trigger (#3720): read-only for every checkout, no lane, no session, so it costs `land-advance` no worker budget
 * and can run on every trigger.
 *
 * ── THE THREE STEPS ────────────────────────────────────────────────────────────────────────────────────────
 *
 *   | step    | kind      | what it does                                                                         |
 *   |---------|-----------|--------------------------------------------------------------------------------------|
 *   | `read`  | `compute` | ONE injected `readFacts` call: the checkout, whether it is a primary, the state paths, the clock |
 *   | `plan`  | `compute` | PURE {@link planDocketRefresh}: refuse a primary checkout; else what an apply would run |
 *   | `apply` | `effect`  | with `--apply`: ONE effect (`docket-refresh-io.mjs`) that runs the sequence below     |
 *
 * WHAT THE APPLY EFFECT RUNS, in the checkout it was given:
 *   a. `git fetch origin main` (best effort), then REFUSES when the checkout's `HEAD` is not the fetched ref:
 *      the generator ranks decisions off the checkout's WORKING TREE (`check-readiness --select`) and only reads
 *      each card's text off `--ref`, so a stale tree would rank stale state no matter what `--ref` says;
 *   b. that checkout's own generator, `data --ref=<the checked sha> --allow-stale --no-fetch --out=<state root>/docket/…`
 *      (paths OUTSIDE every checkout, passed checkout-relative; the tree stays clean and nothing is committed);
 *   c. a CONTENT HASH of the data without its clock and sha fields ({@link stableDocketData}), compared with
 *      `<state root>/docket/state.json`;
 *   d. only when the hash changed: `render` to the page beside the data, `state.json` rewritten, and ONE
 *      hand-off record, `publish-owed.json` ({@link buildPublishOwed}). An unchanged hash writes nothing more.
 *
 * THE PUBLISH HALF IS NOT A NODE CALL, AND THIS FILE INVENTS NO PATH FOR IT. Publishing is the `Artifact` tool,
 * which only a model session has (`we:skills-src/decision-docket/SKILL.md`). The card (#3723, step 5) says a
 * changed hash produces a "publish owed" hand-off: a RECORD now, and a one-shot session dispatched through
 * #3277's publish operation once that exists. #3277 is unbuilt, so the record is the whole hand-off today: the
 * orchestrator reads it (last stdout line `publish: owed`) and dispatches its existing docket-publish worker
 * brief by hand, exactly as before. That dispatch spends a session, so it stays capacity-gated; the refresh
 * does not.
 *
 * PURE. No fs, no clock, no process, no network, no `node:crypto` in this file (the hash is in the IO shell).
 */

import { op } from './registry.mjs';
import { compute, effect as effectStep } from './step-kinds.mjs';

/** The operation's stable id. */
export const DOCKET_REFRESH_OP = 'docket-refresh';

/** The one effect type the `apply` step declares; its sink is in `./docket-refresh-io.mjs`. */
export const DOCKET_REFRESH_EFFECT = 'docket-refresh.run';

/** The directory under the operations state root, and the files in it. */
export const DOCKET_DIR_NAME = 'docket';
export const DATA_FILE = 'decision-docket-data.json';
export const PAGE_FILE = 'decision-docket.html';
export const STATE_FILE = 'state.json';
export const OWED_FILE = 'publish-owed.json';

/** Where the publish goes once #3277 exists. Named, never implemented here. */
export const PUBLISH_VIA = '#3277 (the publish operation; unbuilt): until it exists the orchestrator dispatches its docket-publish worker by hand';

/**
 * The data with every field that is not the backlog removed, as stable text: the top-level `generatedAt` and each
 * item's `ageInDays` change with the time of the run, and `generatedFromRef` is the sha that was read (it moves on
 * every landing, docket-relevant or not), so hashing them would hand off a publish on every run. Object keys are
 * sorted so key order never changes the hash. PURE.
 * @param {object} data the generator's parsed data file
 * @returns {string}
 */
export function stableDocketData(data) {
  const strip = (v, depth) => {
    if (Array.isArray(v)) return v.map((x) => strip(x, depth + 1));
    if (!v || typeof v !== 'object') return v;
    const out = {};
    for (const k of Object.keys(v).sort()) {
      if (depth === 0 && (k === 'generatedAt' || k === 'generatedFromRef')) continue;
      if (k === 'ageInDays') continue;
      out[k] = strip(v[k], depth + 1);
    }
    return out;
  };
  return JSON.stringify(strip(data, 0));
}

/** Parse `state.json` into `{ lastHash, lastChangedAt }`, or `null` (absent, not JSON, not an object). PURE. */
export function parseState(text) {
  if (typeof text !== 'string' || !text.trim()) return null;
  let raw;
  try { raw = JSON.parse(text); } catch { return null; }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const str = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  return { lastHash: str(raw.lastHash), lastChangedAt: str(raw.lastChangedAt) };
}

/** The state as file text, fixed key order. PURE. */
export function formatState({ lastHash = null, lastChangedAt = null } = {}) {
  return `${JSON.stringify({ lastHash, lastChangedAt }, null, 2)}\n`;
}

/**
 * DID THE DATA CHANGE. `changed` is false only when a hash was recorded and equals this one. PURE.
 * @param {{hash: string, state: (object|null)}} o
 */
export function decideHandoff({ hash, state } = {}) {
  if (!hash) throw new Error('docket-refresh: no content hash to compare');
  if (state?.lastHash && state.lastHash === hash) return { changed: false, reason: 'the docket data equals the last refreshed data' };
  return { changed: true, reason: state?.lastHash ? 'the docket data differs from the last refreshed data' : 'no refresh has been recorded yet' };
}

/**
 * THE HAND-OFF RECORD: what a publish session needs, and nothing it must decide. PURE.
 * @param {{hash: string, ref: string, headSha: string, dataPath: string, htmlPath: string, now: string, counts: object}} o
 */
export function buildPublishOwed({ hash, ref, headSha, dataPath, htmlPath, now, counts } = {}) {
  return {
    owed: 'publish',
    hash,
    ref,
    headSha,
    dataPath,
    htmlPath,
    counts,
    owedSince: now,
    publishVia: PUBLISH_VIA,
  };
}

/** Counts shown on a run and carried in the hand-off: decisions, prepared, prepared with a parse warning. PURE. */
export function countItems(data) {
  const items = Array.isArray(data?.items) ? data.items : [];
  const prepared = items.filter((i) => i && i.prepared);
  return { decisions: items.length, prepared: prepared.length, parseWarnings: prepared.filter((i) => !i.parseOk).length };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
// The declaration.

/** SHAPE one `readFacts()` result into the `read` finding. PURE. */
export function shapeDocketRead(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  if (!r.root) throw new Error('docket-refresh.read: no checkout to refresh from');
  return {
    root: String(r.root),
    primary: r.primary === true,
    dir: String(r.dir || ''),
    dataPath: String(r.dataPath || ''),
    htmlPath: String(r.htmlPath || ''),
    statePath: String(r.statePath || ''),
    owedPath: String(r.owedPath || ''),
    state: r.state && typeof r.state === 'object' ? r.state : null,
    now: String(r.now || ''),
  };
}

/**
 * THE PLAN. PURE. A primary checkout is refused here, before any effect exists: the generator writes files and
 * the primary is the operator's shared tree (#2749, #2788; `we:scripts/guard-lane.mjs` names the primaries).
 * @param {object} read the `read` finding
 * @param {{apply?: boolean, ref?: string, fetch?: boolean}} input
 */
export function planDocketRefresh(read, { apply = false, ref = 'origin/main', fetch = true } = {}) {
  const refused = read.primary
    ? `${read.root} is a primary checkout; run docket-refresh from a lane or the runner's checkout at ${ref}`
    : null;
  return {
    apply: apply === true && !refused,
    refused,
    ref,
    fetch: fetch !== false,
    steps: [
      ...(fetch !== false ? [`git fetch ${ref.replace('/', ' ')}`] : []),
      `refuse unless HEAD is ${ref}`,
      `gen-decision-docket data --ref=<${ref} sha> --out=${read.dataPath}`,
      'compare the content hash (clock fields removed) with the state file',
      'when it changed: render the page, record the hash, write the publish-owed record',
    ],
    paths: { root: read.root, data: read.dataPath, html: read.htmlPath, state: read.statePath, owed: read.owedPath },
    lastHash: read.state?.lastHash ?? null,
  };
}

/**
 * THE COMMAND LINE'S TRAILER. PURE. The LAST line is `publish: owed` or `publish: none`; a refused, dry or failed
 * run prints no `publish:` line, so a reader can never take a broken refresh for "nothing to publish".
 */
export function finishDocketOutcome({ run, code, lines, json = false } = {}) {
  if (json) return { code, lines };
  const plan = run?.verdict;
  if (!plan) return { code, lines };
  if (plan.refused) return { code: 1, lines: [`docket-refresh: REFUSED — ${plan.refused}`, '', ...lines] };
  const effect = (run.effects ?? []).find((e) => e.type === DOCKET_REFRESH_EFFECT);
  if (!effect || effect.status !== 'applied' || !effect.result) {
    const head = plan.apply
      ? `docket-refresh: FAILED${effect?.error ? ` — ${String(effect.error).split('\n')[0]}` : ''}: no publish line`
      : `docket-refresh: dry run — would run: ${plan.steps.join('; ')}. Re-run with --apply.`;
    return { code: plan.apply ? 1 : code, lines: [head, '', ...lines] };
  }
  const r = effect.result;
  if (r.status === 'checkout-behind') {
    return { code: 1, lines: [`docket-refresh: REFUSED — HEAD ${r.headSha} is not ${plan.ref} (${r.refSha}); the ranking reads the working tree, so bring the checkout to ${plan.ref} first`] };
  }
  const out = [
    `docket-refresh: ${r.fetched}`,
    `docket-refresh: data ${r.dataPath} (${r.counts.decisions} decisions, ${r.counts.prepared} prepared, ${r.counts.parseWarnings} with parse warnings; content ${r.hash.slice(0, 12)})`,
    `docket-refresh: ${r.reason}`,
    r.owedPath ? `docket-refresh: publish owed, recorded at ${r.owedPath} (page ${r.htmlPath}); publish via ${PUBLISH_VIA}` : 'docket-refresh: no publish owed',
  ];
  return { code, lines: [...out, `publish: ${r.owedPath ? 'owed' : 'none'}`] };
}

/**
 * BUILD THE DECLARATION. `readFacts` is injected; `./docket-refresh-io.mjs` supplies the real one.
 * @param {{readFacts: (o: {checkout: string}) => object}} deps
 */
export function docketRefreshOperation({ readFacts } = {}) {
  if (typeof readFacts !== 'function') {
    throw new TypeError('docket-refresh: needs a `readFacts({checkout})` reader; the real one is `we:scripts/operations/docket-refresh-io.mjs`.');
  }
  return op(DOCKET_REFRESH_OP, {
    input: {
      // Off by default: a dry run prints the plan and writes nothing.
      apply: { type: 'boolean', required: false, default: false },
      // The ref the decisions are read from; the checkout's HEAD must equal it.
      ref: { type: 'string', required: false, default: 'origin/main' },
      // Fetch the ref's remote first (best effort).
      fetch: { type: 'boolean', required: false, default: true },
      // The checkout whose generator runs (a lane or the runner's checkout); the cwd's checkout when empty.
      checkout: { type: 'string', required: false, default: '' },
    },
    verdictFrom: 'plan',

    read: compute({
      reads: ['input.checkout'],
      fn: (view) => shapeDocketRead(readFacts({ checkout: view.input.checkout })),
    }),

    plan: compute({
      reads: ['findings.read', 'input.apply', 'input.ref', 'input.fetch'],
      fn: (view) => planDocketRefresh(view.findings.read, { apply: view.input.apply, ref: view.input.ref, fetch: view.input.fetch }),
    }),

    apply: effectStep({
      reads: ['verdict', 'findings.read'],
      effects: (view) => {
        if (!view.verdict?.apply) return [];
        const r = view.findings.read;
        return [{
          type: DOCKET_REFRESH_EFFECT,
          // IDEMPOTENT: a second run regenerates the same data, and an unchanged hash writes no hand-off.
          idempotent: true,
          payload: {
            root: r.root, ref: view.verdict.ref, fetch: view.verdict.fetch,
            dir: r.dir, dataPath: r.dataPath, htmlPath: r.htmlPath, statePath: r.statePath, owedPath: r.owedPath,
            state: r.state, now: r.now,
          },
        }];
      },
    }),
  });
}
