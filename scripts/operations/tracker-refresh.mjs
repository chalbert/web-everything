/**
 * @file scripts/operations/tracker-refresh.mjs
 * @description THE `tracker-refresh` DECLARATION (epic #3383) — bring the Prototype Tracker page up to date
 *   mechanically, up to (and not including) the one step only a session can do: calling the `Artifact` tool.
 *
 * WHY IT EXISTS. Nobody had published the tracker page, and a page that depends on someone remembering to run
 * three commands and then publish goes stale. Everything up to the publish is deterministic, so it is an
 * operation the orchestrator runs on every fire; only when the page really changed does a tiny worker publish it.
 *
 * ── THE THREE STEPS ────────────────────────────────────────────────────────────────────────────────────────
 *
 *   | step    | kind      | what it does                                                                        |
 *   |---------|-----------|-------------------------------------------------------------------------------------|
 *   | `read`  | `compute` | shape ONE injected `readFacts` call: the checkout, the four paths, the state file, the clock |
 *   | `plan`  | `compute` | PURE: {@link planRefresh} — what an apply would run, and where the page and brief go |
 *   | `apply` | `effect`  | with `--apply`: ONE effect that runs the sequence below and returns its result       |
 *
 * DRY RUN IS THE DEFAULT (like `priority-sync`): without `--apply` the run prints the plan and does nothing. The
 * orchestrator runs `tracker-refresh --apply`.
 *
 * ── WHAT THE APPLY EFFECT RUNS (in `tracker-refresh-io.mjs`; this file names it, and reaches none of it) ────
 *
 *   a. `git fetch` of the ref's remote (best effort), then `priority-sync --apply` (never touches a line pinned
 *      by an operator; leaves the tracker card edited and uncommitted), then `check-priority --strict`;
 *   b. the compact `render`, written to `<operations>/tracker/prototype-tracker.html`;
 *   c. a CONTENT HASH of the page with its stamp (tip sha + render time) removed, compared with
 *      `<operations>/tracker/artifact.json` (`{ url, id, lastPublishedHash, lastPublishedAt }`);
 *   d. when the page differs, the fixed brief for the publish worker ({@link buildPublishBrief}) at
 *      `<operations>/jobs/tracker-publish-task.md`.
 *
 *   The LAST stdout line is exactly `publish: needed` or `publish: current`. `--json` carries the same, plus the
 *   paths, as `verdict` and the effect's `result`.
 *
 * ── THE THROTTLE (the orchestrator's half) ─────────────────────────────────────────────────────────────────
 *
 *   The orchestrator's queue check runs `tracker-refresh --apply` on each fire and dispatches the publish worker
 *   through `dispatch-task` ONLY when the last line is `publish: needed` AND the last publish is older than
 *   {@link PUBLISH_MIN_INTERVAL_MINUTES} (a page can change on every push; the page is worth republishing at most
 *   about twice an hour). The run prints `dispatch: due` or `dispatch: wait` on the line above, computed by
 *   {@link decidePublish}, so the orchestrator does not redo the arithmetic.
 *
 * ── EXIT CODES ─────────────────────────────────────────────────────────────────────────────────────────────
 *
 *   0: refreshed. 1: `check-priority --strict` found drift (the page is still rendered and hashed: it shows the
 *   card as it is, and the drift line says what a worker must fix) or a step failed (no `publish:` line then).
 *
 * PURE. No fs, no clock, no process, no network, no `node:crypto` in this file (the hash lives in
 * `../lib/tracker-page-hash.mjs`, called by the IO shell): its import graph reaches nothing that can act.
 */

import { op } from './registry.mjs';
import { compute, effect as effectStep } from './step-kinds.mjs';

/** The operation's stable id. Adapters resolve it by this name. */
export const TRACKER_REFRESH_OP = 'tracker-refresh';

/** The effect type the `apply` step declares — the sink is registered under this string in `./tracker-refresh-io.mjs`. */
export const TRACKER_REFRESH_EFFECT = 'tracker-refresh.run';

/**
 * THE THROTTLE. A changed page is republished at most this many minutes after the last publish. The orchestrator
 * applies it (see the header); {@link decidePublish} computes it so the two never disagree.
 */
export const PUBLISH_MIN_INTERVAL_MINUTES = 30;

/** The `--session` slug of the publish worker (`dispatch-task` refuses a second launch with the same slug while one runs). */
export const PUBLISH_SESSION = 'tracker-publish';

/** The file names under the operations directory. */
export const TRACKER_DIR_NAME = 'tracker';
export const PAGE_FILE = 'prototype-tracker.html';
export const STATE_FILE = 'artifact.json';
export const BRIEF_FILE = 'tracker-publish-task.md';
export const RESULT_FILE = 'tracker-publish.result.md';

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
// The state file.

/**
 * Parse `artifact.json` text into `{ url, id, lastPublishedHash, lastPublishedAt }`, or `null` when there is none
 * (absent text, not JSON, not an object). Every field is a string or `null`; nothing is invented. PURE.
 * @param {string|null|undefined} text
 */
export function parseState(text) {
  if (typeof text !== 'string' || !text.trim()) return null;
  let raw;
  try { raw = JSON.parse(text); } catch { return null; }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const str = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  return { url: str(raw.url), id: str(raw.id), lastPublishedHash: str(raw.lastPublishedHash), lastPublishedAt: str(raw.lastPublishedAt) };
}

/** The state as file text: the four fields in a fixed order, one trailing newline. PURE. */
export function formatState({ url = null, id = null, lastPublishedHash = null, lastPublishedAt = null } = {}) {
  return `${JSON.stringify({ url, id, lastPublishedHash, lastPublishedAt }, null, 2)}\n`;
}

/** The artifact id out of a published page's URL (`…/artifact/<id>`), or `null`. PURE. */
export function idFromUrl(url) {
  const m = /\/artifact\/([^/?#\s]+)\/?(?:[?#].*)?$/.exec(String(url ?? '').trim());
  return m ? m[1] : null;
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
// The decision.

/**
 * IS A PUBLISH NEEDED, AND IS THE WORKER DUE. PURE.
 *
 * `publish` is `current` only when the page's content hash equals the recorded one AND a page is recorded (a hash
 * with no url could not be updated in place). `dispatchDue` is `needed` and either nothing was ever published or
 * the last publish is at least `minIntervalMinutes` old; a timestamp that does not parse counts as never.
 *
 * @param {{hash: string, state: (object|null), now: string, minIntervalMinutes?: number}} o
 * @returns {{publish: 'needed'|'current', dispatchDue: boolean, ageMinutes: (number|null), reason: string}}
 */
export function decidePublish({ hash, state, now, minIntervalMinutes = PUBLISH_MIN_INTERVAL_MINUTES } = {}) {
  const same = !!state && !!state.url && !!hash && state.lastPublishedHash === hash;
  const last = state?.lastPublishedAt ? Date.parse(state.lastPublishedAt) : NaN;
  const at = Date.parse(now);
  const ageMinutes = Number.isFinite(last) && Number.isFinite(at) ? Math.max(0, Math.floor((at - last) / 60000)) : null;
  if (same) return { publish: 'current', dispatchDue: false, ageMinutes, reason: 'the page content equals the last published content' };
  const why = !state ? 'no page has been published yet'
    : !state.url ? 'the state file records no page url'
      : 'the page content differs from the last published content';
  const due = ageMinutes === null || ageMinutes >= minIntervalMinutes;
  return { publish: 'needed', dispatchDue: due, ageMinutes, reason: `${why}${due ? '' : `; last publish ${ageMinutes} min ago, minimum ${minIntervalMinutes}`}` };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
// The publish worker's brief.

/**
 * THE FIXED, COMPLETE BRIEF for the tiny publish worker. PURE: same input, same text. It names every path and
 * command, so the worker needs nothing but this file, and it ends where the orchestrator's `dispatch-task` launch
 * prompt takes over (the completion report).
 *
 * @param {{htmlPath: string, statePath: string, resultPath: string, hash: string, state: (object|null),
 *   stateScript: string, trackerPath: string, queueScript: (string|null), queueRoot: (string|null), renderedAt: string}} o
 * @returns {string}
 */
export function buildPublishBrief({ htmlPath, statePath, resultPath, hash, state, stateScript, trackerPath, queueScript, queueRoot, renderedAt } = {}) {
  const url = state?.url ?? null;
  const queueStep = queueScript
    ? `   a. NEEDS YOU. Run \`node ${queueScript}\` (from ${queueRoot}) and compare the lines under its \`NEEDS YOU\` heading with the page's "Needs you" block: the same lines, or \`(none)\` on one side and the word "none" on the other.`
    : '   a. NEEDS YOU. No operator-queue script was found when this brief was made, so the page must say "unavailable" in its "Needs you" block. If it shows lines or "none", stop and report that.';
  return `${[
    'TASK: publish the compact Prototype Tracker page as an Artifact, exactly as rendered. You are a tiny publish worker: do only what is below, in auto mode, and nothing else.',
    '',
    `WHY: \`tracker-refresh\` (a mechanical operation) rendered the page at ${renderedAt} and found its content differs from the last published page (content hash ${hash}; last publish: ${state?.lastPublishedAt ?? 'never'}).`,
    '',
    'FILES:',
    `- page: ${htmlPath} (about 50 KB; read it fully, in one Read)`,
    `- state: ${statePath} (\`{ url, id, lastPublishedHash, lastPublishedAt }\`; ${url ? `it records the page ${url}` : 'it records no page yet'})`,
    `- result: ${resultPath}`,
    '',
    'STEPS:',
    '1. Read the page file fully. Never edit it, and never publish a page you wrote yourself: only this file.',
    `2. Confirm it is still the page this brief was made for: \`node ${stateScript} verify --html=${htmlPath} --hash=${hash}\`. Exit 0 means the same content. Exit 1 means a newer render replaced it: write the result file with status "superseded" and stop.`,
    '3. Verify by content, then publish only if both match:',
    queueStep,
    `   b. UP NEXT. Run \`grep -E '^[0-9]+\\. #' ${trackerPath} | head -3\` and compare those three lines with the first three rows of the page's first table (rank and #card, in the same order).`,
    '   If either differs, do NOT publish: write the result file with both sides quoted, and stop.',
    '4. Publish with the `Artifact` tool:',
    url
      ? `   - UPDATE the page in place: first \`Artifact(action:"read", url:"${url}")\`, then \`Artifact(action:"publish", file_path:"${htmlPath}", url:"${url}")\`. Do not create a new page.`
      : `   - Create a NEW private page: \`Artifact(action:"publish", file_path:"${htmlPath}", icon:"list", description:"Prototype tracker for epic #3383: what needs the operator, what is next, the notes.")\`.`,
    `5. Record it. Do not write the state file by hand: \`node ${stateScript} record --html=${htmlPath} --url=<the published page's url>\` (it rewrites ${statePath} with the new content hash, the time, the id and the url).`,
    `6. Write ${resultPath}: the status (published, updated, superseded or stopped), the url, the content hash, the time, and what step 3 compared (quote the NEEDS YOU line or "none", and the three ranks and cards).`,
    '',
    'RULES: no commits, no pull request, no other repo edits. No nested Agent calls and no backgrounded shell commands. If the `Artifact` call is denied or the tool is missing, stop and write that to the result file with the exact denial; do not reword the call and do not route around it. Do not end your turn waiting on anything.',
    '',
    `RESULT: ${resultPath}. Then record completion as the launch prompt says.`,
  ].join('\n')}\n`;
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
// The declaration.

/**
 * SHAPE one `readFacts()` result into the `read` finding. PURE — every field defensively coalesced.
 * @param {object} raw
 */
export function shapeRefreshRead(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  if (!r.root) throw new Error('tracker-refresh.read: no checkout to refresh (run it inside the prototype checkout)');
  return {
    root: String(r.root),
    trackerPath: r.trackerPath ? String(r.trackerPath) : null,
    operationsDir: String(r.operationsDir || ''),
    htmlPath: String(r.htmlPath || ''),
    statePath: String(r.statePath || ''),
    briefPath: String(r.briefPath || ''),
    resultPath: String(r.resultPath || ''),
    state: r.state && typeof r.state === 'object' ? r.state : null,
    now: String(r.now || ''),
  };
}

/**
 * THE PLAN. PURE: what an apply would run and where its outputs go. Nothing here needs the page, so it can be
 * printed by a dry run.
 * @param {object} read the `read` finding
 * @param {{apply: boolean, ref: string, fetch: boolean}} input
 */
export function planRefresh(read, { apply = false, ref = 'origin/main', fetch = true } = {}) {
  const steps = [
    ...(fetch ? [`git fetch ${ref.split('/')[0]}`] : []),
    `priority-sync --apply --ref=${ref}`,
    `check-priority --ref=${ref} --strict`,
    `render --ref=${ref}`,
    'compare the content hash with the state file',
    'write the publish worker brief when the page changed',
  ];
  return {
    apply: apply === true,
    ref,
    fetch: fetch !== false,
    steps,
    minIntervalMinutes: PUBLISH_MIN_INTERVAL_MINUTES,
    lastPublishedAt: read.state?.lastPublishedAt ?? null,
    recordedUrl: read.state?.url ?? null,
    paths: { root: read.root, tracker: read.trackerPath, html: read.htmlPath, state: read.statePath, brief: read.briefPath, result: read.resultPath },
  };
}

/**
 * THE COMMAND LINE'S TRAILER. PURE. In plain mode: what the apply did, then (last) `publish: needed|current`.
 * `--json` is left to the adapter, whose payload carries the plan as `verdict` and the effect's result.
 * A dry run, or a run whose effect failed, prints no `publish:` line: the orchestrator reads its absence as "do not dispatch".
 * @param {{run: object, code: number, lines: string[], json?: boolean}} o
 */
export function finishRefreshOutcome({ run, code, lines, json = false } = {}) {
  if (json) return { code, lines };
  const plan = run?.verdict;
  if (!plan) return { code, lines };
  const effect = (run.effects ?? []).find((e) => e.type === TRACKER_REFRESH_EFFECT);
  if (!effect || effect.status !== 'applied' || !effect.result) {
    const head = plan.apply
      ? `tracker-refresh: FAILED${effect?.error ? ` — ${String(effect.error).split('\n')[0]}` : ''}: no page written, no publish line`
      : `tracker-refresh: dry run — would run: ${plan.steps.join('; ')}. Re-run with --apply.`;
    return { code: plan.apply ? 1 : code, lines: [head, '', ...lines] };
  }
  const r = effect.result;
  const out = [
    `tracker-refresh: ${r.sync}`,
    `tracker-refresh: check-priority ${r.check.ok ? 'OK' : `DRIFT — ${r.check.summary}`}`,
    ...r.check.details.map((d) => `  ${d}`),
    `tracker-refresh: page ${r.htmlPath} (${r.bytes} bytes, content ${r.hash.slice(0, 12)})`,
    `tracker-refresh: last publish ${r.lastPublishedAt ?? 'never'}${r.ageMinutes === null ? '' : ` (${r.ageMinutes} min ago)`}; ${r.reason}`,
    r.briefPath ? `tracker-refresh: worker brief ${r.briefPath}` : 'tracker-refresh: no worker brief needed',
    r.publish === 'needed'
      ? `dispatch: ${r.dispatchDue ? 'due' : `wait (minimum ${plan.minIntervalMinutes} min between publishes)`}${r.dispatchDue ? `: node scripts/operations/run.mjs dispatch-task --brief=${r.briefPath} --session=${PUBLISH_SESSION}` : ''}`
      : 'dispatch: none',
  ];
  return { code: r.check.ok ? code : 1, lines: [...out, `publish: ${r.publish}`] };
}

/**
 * BUILD THE DECLARATION. `readFacts` is the injected reader; {@link ./tracker-refresh-io.mjs} supplies the real one
 * and tests supply a stub. Built per call so nothing leaks between registries.
 * @param {{readFacts: (o: {operationsDir: string}) => object}} deps
 */
export function trackerRefreshOperation({ readFacts } = {}) {
  if (typeof readFacts !== 'function') {
    throw new TypeError(
      'tracker-refresh: needs a `readFacts({operationsDir})` reader — the io is INJECTED so the declaration stays testable '
      + 'without git, the backlog or the operations directory; the real binding is `we:scripts/operations/tracker-refresh-io.mjs`.',
    );
  }

  return op(TRACKER_REFRESH_OP, {
    input: {
      // Off by default: a dry run prints the plan and writes nothing.
      apply: { type: 'boolean', required: false, default: false },
      // Where the cards and the branch's newer state are read from; `priority-sync` and `render` take the same ref.
      ref: { type: 'string', required: false, default: 'origin/main' },
      // Fetch the ref's remote first (best effort: a failed fetch is reported, not fatal).
      fetch: { type: 'boolean', required: false, default: true },
      // The operator's operations directory (`~/workspace/.operations` when empty). It holds `tracker/` and `jobs/`.
      operationsDir: { type: 'string', required: false, default: '' },
    },
    verdictFrom: 'plan',

    read: compute({
      reads: ['input.operationsDir'],
      fn: (view) => shapeRefreshRead(readFacts({ operationsDir: view.input.operationsDir })),
    }),

    plan: compute({
      reads: ['findings.read', 'input.apply', 'input.ref', 'input.fetch'],
      fn: (view) => planRefresh(view.findings.read, { apply: view.input.apply, ref: view.input.ref, fetch: view.input.fetch }),
    }),

    apply: effectStep({
      reads: ['verdict', 'findings.read'],
      effects: (view) => {
        if (!view.verdict?.apply) return [];
        return [{
          type: TRACKER_REFRESH_EFFECT,
          // IDEMPOTENT: a second run re-syncs an already-synced section, re-renders, and overwrites the page and the
          // brief with the same content when nothing changed.
          idempotent: true,
          payload: {
            root: view.findings.read.root,
            trackerPath: view.findings.read.trackerPath,
            ref: view.verdict.ref,
            fetch: view.verdict.fetch,
            htmlPath: view.findings.read.htmlPath,
            statePath: view.findings.read.statePath,
            briefPath: view.findings.read.briefPath,
            resultPath: view.findings.read.resultPath,
            state: view.findings.read.state,
            now: view.findings.read.now,
          },
        }];
      },
    }),
  });
}
