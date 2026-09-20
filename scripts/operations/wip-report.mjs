/**
 * @file wip-report.mjs
 * @description PURE core of the operator's `/wip` report (epic #3383): the state of the operator's WORK, not a dump of
 * processes. No fs, clock, env, network or `gh`: every fact is injected, so identical input gives byte-identical
 * output. The IO shell that gathers the facts is `wip-report-io.mjs`; the CLI is `wip-report-cli.mjs`.
 *
 * Shape (in this order): a short header (the time, then one bullet each for load + workers, runner, old PRs and the operator
 * queue), `## Attention`, `## Work items`, `## Done since <last-wip>`, `## Next`,
 * `## Needs you`. Nothing here is composed by a model. Rows are per WORK ITEM (a PR, or an item that live sessions work
 * on), and the live sessions nest under it. Decisions live in the docket, never here: the report only says how many are open
 * (a count line, flagged when the docket file is over 24 h old) and never presents a decision as operator work.
 *
 * Reused, never re-derived: session facts come from `wip-agents.mjs#classifyAgents` (liveness from the pid, the
 * mechanical verdict of `conveyor/session-verdicts.mjs`); PR facts come from `land-advance.mjs#planLandAdvance`
 * (the owed table: what is owed, proposed, deferred and why). This module only JOINS them per item and applies two
 * CLOSED vocabularies: {@link PR_STATES} for a PR row and {@link ATTENTION_RULES} for a problem row.
 *
 * NEVER GUESS. A PR whose labels and merge state do not settle its state is `unknown`. An unreadable source is
 * named in the output (`unknown`, or `Needs you: unknown`), never silently an empty section.
 *
 * WHICH WORK ITEM A SESSION BELONGS TO is decided by ONE injectable function, `bindSession(session) -> binding|null`
 * ({@link defaultBindSession}): the `fix-<pr>` / `review-<pr>` / `ci-heal-<pr>` / `conveyor-<n>` / `prepare-<n>` grammar of
 * `session-verdicts.mjs#dispatchGrammar`, plus the supervision-tree task-session name `t-<story>-r<round>-<task>`
 * (`lib/dispatch-contracts.mjs#parseTaskSessionName`, G1) which binds to its story's item row. The tree's own data
 * (`lib/dispatch-supervision-tree.mjs`) is not wired to any runtime record yet (slice G2), so task status per task
 * is not shown; only the live task sessions are.
 */
import { classifyAgents } from './wip-agents.mjs';
import { planLandAdvance } from './land-advance.mjs';
import { dispatchGrammar } from '../conveyor/session-verdicts.mjs';
import { parseTaskSessionName } from '../lib/dispatch-contracts.mjs';

/** The CLOSED state vocabulary of a PR row. `blocked-on:<what>` carries a plain-words reason after the colon. */
export const PR_STATES = Object.freeze([
  'reviewing', 'waiting-for-reviewer', 'fixing', 'waiting-CI', 'waiting-merge', 'blocked-on:<what>',
  'needs-operator', 'landed', 'unknown',
]);
// `blocked-on:review stalled` / `blocked-on:fix stalled` (a bound session whose verdict is `stalled`) is chosen over
// `waiting-for-reviewer`: a reviewer IS assigned, it has stopped making progress, and the nested session row says `stalled`.

/**
 * The CLOSED remedy vocabulary of an Attention row (what auto-handles it, or what to run):
 * - `auto`: a live executor acts on it (the runner is live).
 * - `auto (runner down)` / `auto (runner unknown)`: a handler exists but only the runner runs it, and the runner is not
 *   live / its state could not be read. Never `auto` then: nothing would act.
 * - `run: session-reaper`: a foreground command handles it while the runner is down (see {@link FOREGROUND_REMEDY}).
 * - `start: /conveyor`: the runner-down row itself: the command that brings the runner up.
 * - `no-handler`: nothing mechanical picks it up.
 */
export const REMEDIES = Object.freeze(['auto', 'auto (runner down)', 'auto (runner unknown)', 'run: session-reaper', 'start: /conveyor', 'no-handler']);
/** A rule whose `auto` handler an operator can also run in the foreground: named instead of `auto (runner down)`. */
const FOREGROUND_REMEDY = Object.freeze({ 'session-finished-unreaped': 'run: session-reaper' });

/**
 * The CLOSED Attention rule table. `remedy` is the rule's BASE remedy: `auto` when a handler for the problem exists in the
 * mechanism and `no-handler` when nothing mechanical picks it up. An `auto` base is resolved against the runner's liveness
 * when a row is added ({@link resolveRemedy}): it only reads `auto` while the runner is live. Flip an entry here when a
 * handler is built; nothing else needs to change.
 */
export const ATTENTION_RULES = Object.freeze({
  'ci-failed-no-fixer': { remedy: 'auto', words: 'CI failed and no fixer is running' }, // land-advance dispatch-ci-heal; the row passes dispatchRemedy (a deferred/refused row is `no-handler`)
  'conflict-no-fix-in-flight': { remedy: 'auto', words: 'merge conflict and no fix is running' }, // land-advance dispatch-conflict-fix; same dispatchRemedy
  'changes-requested-no-fixer': { remedy: 'auto', words: 'changes requested and no fixer is running' }, // land-advance dispatch-fix
  'review-pending-no-reviewer': { remedy: 'auto', words: 'waiting for a review and no reviewer is running' }, // land-advance dispatch-review
  'stale-tag': { remedy: 'auto', words: 'review-status label disagrees with the live sessions' }, // review-status-tag rides the runner tick
  'session-stalled': { remedy: 'no-handler', words: 'session is stuck' }, // `auto` only once its ladder reaches escalate (see the add() call)
  'session-finished-unreaped': { remedy: 'auto', words: 'finished sessions still running' }, // session-reaper (runner tick §4d; `run: session-reaper` when the runner is down)
  'pre-today-pr-open': { remedy: 'no-handler', words: 'PRs opened before today are still open' },
  'over-capacity': { remedy: 'no-handler', words: 'more workers running than the cap allows' },
  'runner-not-live': { remedy: 'no-handler', words: 'the runner is not running' }, // the row itself always reads `start: /conveyor`
});
/**
 * The remedy an Attention row shows. A base of `auto` needs a live executor: with the runner live it stays `auto`; else the
 * rule's foreground command, else `auto (runner down)` (or `auto (runner unknown)` when the runner's state was unreadable).
 * Any other base is returned as is.
 * @param {string} rule
 * @param {string} base one of {@link REMEDIES}
 * @param {'live'|'not live'|'unknown'} runner the header's runner value
 */
export function resolveRemedy(rule, base, runner) {
  if (base !== 'auto' || runner === 'live') return base;
  return FOREGROUND_REMEDY[rule] ?? (runner === 'not live' ? 'auto (runner down)' : 'auto (runner unknown)');
}
/** Sort order of the Attention block: most urgent first. */
const RULE_ORDER = Object.keys(ATTENTION_RULES);

/** Fallback window for `Done` when no `last-wip` timestamp has ever been stamped. */
export const DONE_FALLBACK_MS = 3 * 60 * 60 * 1000;
/** A docket file older than this is flagged `docket may be stale`. */
export const DOCKET_STALE_MS = 24 * 60 * 60 * 1000;
export const TIME_ZONE = 'America/New_York';

// ── formatting ──────────────────────────────────────────────────────────────────────────────────
const fmt = (ms, opts) => new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, hourCycle: 'h23', ...opts }).formatToParts(new Date(ms))
  .reduce((o, p) => ({ ...o, [p.type]: p.value }), {});
const finite = (n) => typeof n === 'number' && Number.isFinite(n);
const toMs = (v) => (finite(v) ? v : typeof v === 'string' && Number.isFinite(Date.parse(v)) ? Date.parse(v) : null);
/** `HH:MM` in the operator's zone. */
export const clock = (ms) => { const p = fmt(ms, { hour: '2-digit', minute: '2-digit' }); return `${p.hour}:${p.minute}`; };
/** `YYYY-MM-DD` in the operator's zone (the day key). */
export const dayKey = (ms) => { const p = fmt(ms, { year: 'numeric', month: '2-digit', day: '2-digit' }); return `${p.year}-${p.month}-${p.day}`; };
/** `YYYY-MM-DD HH:MM EDT`. */
export const stamp = (ms) => { const p = fmt(ms, { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }); return `${dayKey(ms)} ${p.hour}:${p.minute} ${p.timeZoneName}`; };
/** `12:34` for today, `09-19 12:34` for an earlier day. */
const when = (ms, now) => (dayKey(ms) === dayKey(now) ? clock(ms) : `${dayKey(ms).slice(5)} ${clock(ms)}`);
export const age = (ms) => (!finite(ms) ? 'unknown' : ms >= 86400000 ? `${Math.floor(ms / 86400000)}d ${Math.floor(ms / 3600000) % 24}h`
  : ms >= 3600000 ? `${Math.floor(ms / 3600000)}h ${Math.floor(ms / 60000) % 60}m` : `${Math.floor(ms / 60000)}m`);
/** `since 12:34 (2h 10m)`; `unknown` when the start is not known. */
const since = (ms, now) => (finite(ms) ? `${when(ms, now)} (${age(Math.max(0, now - ms))})` : 'unknown');
const clip = (s, n = 36) => (String(s).length > n ? `${String(s).slice(0, n - 1).trimEnd()}…` : String(s));
const oneLine = (s) => String(s ?? '').replace(/[\r\n]+/g, ' ');
const repoName = (slug) => String(slug ?? '').split('/').at(-1);
const prRef = (p) => `${repoName(p.slug ?? p.repo)}#${p.number}`;
const labelsOf = (p) => (p.labels ?? []).map((l) => (typeof l === 'string' ? l : l.name));

// ── sessions ────────────────────────────────────────────────────────────────────────────────────
const LIVE = ['live-active', 'live-idle', 'waiting'];
/** A finished session whose process is still alive: counted in Attention, never a row. */
export const isFinishedUnreaped = (s) => s.pidAlive === true && (s.liveness === 'done' || ['finished-unreaped', 'target-moved-on'].includes(s.verdict));
/** A session counts as working ONLY with a live pid (the wip-agents liveness enum) and not already finished. */
export const isLiveSession = (s) => s.kind === 'background' && s.pidAlive === true && LIVE.includes(s.liveness) && !isFinishedUnreaped(s);
const isStuck = (s) => s.verdict === 'stalled' || s.verdict === 'waiting-permission';

/**
 * Default session → work item binding, from the session name. `null` = not a work-item session. `key` names the item
 * row a non-PR session groups under (`#3383`); PR sessions bind by `number`.
 * @returns {{kind:'pr'|'item', role:string, number:number|null, key:string}|null}
 */
export function defaultBindSession(session) {
  const g = dispatchGrammar(session?.name);
  if (g) return { kind: g.target, role: g.kind, number: Number(g.id), key: `#${g.id}` };
  const t = parseTaskSessionName(session?.name);
  return t ? { kind: 'item', role: 'task', number: null, key: `#${t.storyRef.replace(/^#/, '')}` } : null;
}
export function sessionWords(s) {
  if (s.verdict === 'stalled') return 'stalled';
  if (s.verdict === 'waiting-permission') return 'blocked on a permission prompt';
  if (s.liveness === 'waiting') return `waiting on ${s.waitingFor ?? 'something'}`;
  if (s.liveness === 'live-idle') return 'idle';
  return 'working';
}
export function agentWords(s) {
  const model = s.supervisor?.model && s.supervisor.model !== 'unknown' ? s.supervisor.model : 'an unknown model';
  const providers = s.executor?.providers ?? [];
  const delegated = providers.length ? `; delegated to ${providers.map((p) => `${p.provider} ${p.model || 'unknown'}${p.cliVersion ? ` (cli ${p.cliVersion})` : ''}`).join(' + ')}`
    : s.executor?.source === 'unknown' ? '; delegation unknown' : '';
  return `runs on ${model}${delegated}`;
}
/** When the session started, from its age (rows carry an age, not a timestamp). */
const startedMs = (s, now) => (finite(s.ageMs) ? now - s.ageMs : null);
/** When the session went quiet. */
const quietSinceMs = (s, now) => (finite(s.transcriptAgeMs) ? now - s.transcriptAgeMs : startedMs(s, now));

// ── PR state ────────────────────────────────────────────────────────────────────────────────────
/**
 * Deterministic PR state from labels + mergeStateStatus + the bound live sessions' verdicts + the land-advance owed row.
 * First match wins; anything that settles nothing is `unknown`.
 * @returns {string} one of {@link PR_STATES} (`blocked-on:<what>` filled in).
 */
export function derivePrState(pr, { sessions = [], planRow = null } = {}) {
  const ls = labelsOf(pr), ms = pr.mergeStateStatus;
  if (planRow?.owedAction === 'needs-operator' || (ls.includes('review:human') && ls.includes('advisory:accepted'))) return 'needs-operator';
  const fixer = sessions.find((s) => ['fix', 'ci-heal'].includes(s.binding.role)), reviewer = sessions.find((s) => s.binding.role === 'review');
  const worker = fixer ?? reviewer;
  if (worker) return isStuck(worker.session) ? `blocked-on:${fixer ? 'fix' : 'review'} ${worker.session.verdict === 'stalled' ? 'stalled' : 'waiting on a permission prompt'}` : fixer ? 'fixing' : 'reviewing';
  if (planRow?.owedAction === 'wait-on-drain' || planRow?.owedAction === 'escalate') {
    const reason = planRow.evidence?.[0] ?? 'the drain';
    return `blocked-on:drain (${planRow.owedAction === 'escalate' ? 'stuck: ' : ''}${reason})`;
  }
  if (pr.isDraft) return 'blocked-on:draft PR';
  if (ls.includes('ci:failed')) return 'blocked-on:CI failure';
  if (ms === 'DIRTY' || pr.mergeable === 'CONFLICTING') return 'blocked-on:merge conflict';
  if (ls.includes('review:changes')) return 'blocked-on:changes requested';
  if (ls.includes('review:pending')) return 'waiting-for-reviewer';
  if (ms === 'UNSTABLE' || ms === 'BLOCKED') return 'waiting-CI';
  if (ls.includes('review:accepted') && (ms === 'CLEAN' || ms === 'HAS_HOOKS')) return 'waiting-merge';
  return 'unknown';
}

const DEFERRAL = { capacity: 'no free worker slot', draft: 'draft PR', 'no-item-num': 'no backlog item number to plan a fix from', 'queue-first': 'older PRs are drained first', ambiguous: 'session identity ambiguous' };
export const deferralWords = (reason) => DEFERRAL[reason] ?? `refused: ${reason}`;
/** Why the plan has no free slot, in plain words, from its own capacity numbers. */
export function capacityWords(c) {
  if (!c) return 'capacity unknown';
  if (!Number.isFinite(c.load)) return 'load unknown';
  if (c.load > c.loadThreshold) return `machine load ${c.load.toFixed(2)} per core is over ${c.loadThreshold}`;
  if (!Number.isInteger(c.freeLanes)) return 'free lanes unknown';
  return `${c.live} of ${c.cap} workers running, ${c.freeLanes} free lanes`;
}

function nextFor(state, planRow, deferred, capacity) {
  const d = deferred.get(planRow?.subject);
  if (planRow?.owedAction?.startsWith('dispatch-')) {
    const who = planRow.owedAction === 'dispatch-review' ? 'reviewer' : 'fixer';
    if (d) return `${who} deferred: ${deferralWords(d.reason)}${d.reason === 'capacity' ? ` (${capacityWords(capacity)})` : ''}`;
    return `${who} will be dispatched`;
  }
  const byAction = { 'wait-on-drain': 'drain retries', 'needs-operator': 'you review it', 'fold-into-prototype': 'fold worker folds it in', escalate: 'escalation packet for triage', 'stale-label': 'runner clears the stale label' };
  if (byAction[planRow?.owedAction]) return byAction[planRow.owedAction];
  if (state === 'waiting-merge') return 'drain lands it';
  if (state === 'waiting-CI') return 'CI finishes';
  if (state === 'reviewing') return 'reviewer posts a verdict';
  if (state === 'fixing') return 'fixer pushes a fix';
  if (state === 'needs-operator') return 'you review it';
  return '—';
}

// ── the report ──────────────────────────────────────────────────────────────────────────────────
/**
 * Compose the pure input from the RAW facts the IO shell gathered. The two reused cores run here (both pure):
 * `classifyAgents` for the session rows and `planLandAdvance` for the owed table.
 * @param {object} raw `{now, load, cores, runner, wipData, landInputs, merged, operatorQueueText, completions, lastWip, docket, errors}`
 */
export function composeInput(raw) {
  const errors = [...(raw.errors ?? [])];
  let sessions = null, plan = null;
  if (raw.wipData) { try { sessions = classifyAgents({ ...raw.wipData, now: raw.now }); } catch (e) { errors.push({ source: 'sessions', message: String(e.message ?? e) }); } }
  if (raw.landInputs) { try { plan = planLandAdvance({ ...raw.landInputs, now: raw.now }); } catch (e) { errors.push({ source: 'land-advance', message: String(e.message ?? e) }); } }
  return { now: raw.now, load: raw.load ?? null, cores: raw.cores ?? null, runner: raw.runner ?? null, sessions, plan,
    prs: raw.landInputs?.prs ?? null, merged: raw.merged ?? null, operatorQueueText: raw.operatorQueueText ?? null,
    completions: raw.completions ?? null, lastWip: raw.lastWip ?? null, docket: raw.docket ?? null, errors };
}

/** The `NEEDS YOU` lines of `operator-queue.mjs`'s text output, verbatim; `null` if the text has no such section. */
export function parseNeedsYou(text) {
  if (typeof text !== 'string') return null;
  const lines = text.split('\n');
  const start = lines.findIndex((l) => l.startsWith('NEEDS YOU'));
  if (start < 0) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => /^(PENDING|UNSUPPORTED REPO|NOT READY)\b/.test(l));
  return (end < 0 ? rest : rest.slice(0, end)).map((l) => l.trimEnd()).filter((l) => l.trim() && l.trim() !== '(none)');
}

/**
 * Build the structured report. Pure.
 * @param {object} input from {@link composeInput}
 * @param {{bindSession?:Function}} [opts]
 */
export function buildReport(input, { bindSession = defaultBindSession } = {}) {
  const { now } = input;
  const prs = input.prs ?? [], plan = input.plan, capacity = plan?.capacity ?? null;
  const sessions = input.sessions ?? [];
  const live = sessions.filter(isLiveSession).map((s) => ({ session: s, binding: bindSession(s) }));
  const unreaped = sessions.filter(isFinishedUnreaped), deadCount = sessions.filter((s) => s.liveness === 'dead-record').length;
  const openByNumber = new Map();
  for (const p of prs) openByNumber.set(p.number, [...(openByNumber.get(p.number) ?? []), p]);
  const planRows = new Map((plan?.rows ?? []).filter((r) => r.pr != null).map((r) => [`${r.repo}#${r.pr}`, r]));
  const deferred = new Map((plan?.deferred ?? []).map((r) => [r.subject, r]));
  const proposed = new Set((plan?.proposed ?? []).map((r) => r.subject));
  // A session binds to a PR only when exactly ONE open PR carries that number (never a cross-repo guess).
  const bound = (p) => live.filter((x) => x.binding?.kind === 'pr' && x.binding.number === p.number && openByNumber.get(p.number)?.length === 1);
  const boundSet = new Set();

  // Work items: one row per PR.
  const items = prs.slice().sort((a, b) => (toMs(a.createdAt) ?? 0) - (toMs(b.createdAt) ?? 0) || prRef(a).localeCompare(prRef(b))).map((p) => {
    const mine = bound(p), planRow = planRows.get(`${p.repo}#${p.number}`) ?? null;
    for (const x of mine) boundSet.add(x.session.sessionId);
    const state = derivePrState(p, { sessions: mine, planRow });
    return { type: 'pr', ref: prRef(p), repo: p.repo, number: p.number, title: p.title, state, since: toMs(p.updatedAt), createdAt: toMs(p.createdAt),
      next: nextFor(state, planRow, deferred, capacity), planAction: planRow?.owedAction ?? null, proposed: proposed.has(`${p.repo}#${p.number}`),
      sessions: mine.map((x) => ({ name: x.session.name, id: x.session.id, state: sessionWords(x.session), agent: agentWords(x.session), since: startedMs(x.session, now) })) };
  });
  // Decisions live in the docket, never in this report and never as operator work: only a count line (see `docket`).
  const docketItems = input.docket?.items ?? [];
  // Live sessions that belong to no listed item: item sessions get an item row, the rest are listed as sessions.
  const itemSessions = new Map(), other = [];
  for (const x of live) {
    if (boundSet.has(x.session.sessionId)) continue;
    if (x.binding?.kind === 'item') itemSessions.set(x.binding.key, [...(itemSessions.get(x.binding.key) ?? []), x]);
    else other.push(x);
  }
  const itemRows = [...itemSessions].sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true })).map(([key, xs]) => ({ type: 'item', ref: `item ${key}`, title: '', state: xs.some((x) => isStuck(x.session)) ? 'blocked-on:stuck session' : 'working', since: Math.min(...xs.map((x) => startedMs(x.session, now) ?? Infinity)), next: '—',
    sessions: xs.map((x) => ({ name: x.session.name, id: x.session.id, state: sessionWords(x.session), agent: agentWords(x.session), since: startedMs(x.session, now) })) }));
  const otherRows = other.sort((a, b) => (b.session.ageMs ?? 0) - (a.session.ageMs ?? 0) || a.session.name.localeCompare(b.session.name)).map((x) => {
    const g = x.binding, ambiguous = g?.kind === 'pr' && (openByNumber.get(g.number)?.length ?? 0) > 1, closed = g?.kind === 'pr' && !openByNumber.has(g.number);
    return { type: 'session', ref: `session ${x.session.name}`, title: '', state: sessionWords(x.session), since: startedMs(x.session, now),
      next: ambiguous ? `PR number ${g.number} is open in several repos` : closed ? `PR #${g.number} is not open` : '—', sessions: [{ name: x.session.name, id: x.session.id, state: sessionWords(x.session), agent: agentWords(x.session), since: startedMs(x.session, now) }], nested: false };
  });

  // Attention: the closed rule table, computed mechanically.
  const attention = [];
  const runnerLive = input.runner?.state === 'alive-and-idle', runnerKnown = input.runner && input.runner.state !== 'unknown';
  const runnerStatus = input.runner ? (runnerLive ? 'live' : runnerKnown ? 'not live' : 'unknown') : 'unknown';
  const add = (rule, item, what, sinceMs, remedy) => attention.push({ rule, item, what, since: finite(sinceMs) ? sinceMs : null, remedy: resolveRemedy(rule, remedy ?? ATTENTION_RULES[rule].remedy, runnerStatus) });
  for (const p of prs) {
    const ls = labelsOf(p), mine = bound(p), ref = prRef(p), planRow = planRows.get(`${p.repo}#${p.number}`);
    const fixer = mine.some((x) => ['fix', 'ci-heal'].includes(x.binding.role)), reviewer = mine.some((x) => x.binding.role === 'review');
    const updated = toMs(p.updatedAt);
    // Dispatch handlers exist only when the owed table says one can act (a refusal is "no handler").
    const dispatchRemedy = planRow?.owedAction?.startsWith('dispatch-') && planRow.dispatchable ? 'auto' : 'no-handler';
    if (ls.includes('ci:failed') && !fixer) add('ci-failed-no-fixer', ref, 'CI failed (ci:failed label) and no fixer is running', updated, dispatchRemedy);
    if ((p.mergeStateStatus === 'DIRTY' || p.mergeable === 'CONFLICTING') && !fixer) add('conflict-no-fix-in-flight', ref, `merge conflict (${p.mergeStateStatus ?? 'CONFLICTING'}) and no fix is running`, updated, dispatchRemedy);
    if (ls.includes('review:changes') && !fixer) add('changes-requested-no-fixer', ref, 'changes requested (review:changes) and no fixer is running', updated, dispatchRemedy);
    if (ls.includes('review:pending') && !reviewer) add('review-pending-no-reviewer', ref, 'waiting for a review (review:pending) and no reviewer is running', toMs(p.createdAt), dispatchRemedy);
    const tagFixing = ls.some((l) => ['review-status:fixing', 'review-status:fix-stalled'].includes(l)), tagReviewing = ls.some((l) => ['review-status:reviewing', 'review-status:review-stalled'].includes(l));
    const stale = [], startOf = (role) => Math.min(...mine.filter((x) => (role === 'fix' ? ['fix', 'ci-heal'].includes(x.binding.role) : x.binding.role === role)).map((x) => startedMs(x.session, now) ?? Infinity));
    if (tagFixing && !fixer) stale.push(['tag says fixing but no fix session is running', updated]);
    if (tagReviewing && !reviewer) stale.push(['tag says reviewing but no review session is running', updated]);
    if (fixer && !tagFixing) stale.push(['a fix session is running but the PR has no fixing tag', startOf('fix')]);
    if (reviewer && !tagReviewing) stale.push(['a review session is running but the PR has no reviewing tag', startOf('review')]);
    if (stale.length) add('stale-tag', ref, stale.map((e) => e[0]).join('; '), stale[0][1]);
  }
  for (const x of live.filter((x) => isStuck(x.session))) {
    const s = x.session, remedy = s.action === 'escalate' ? 'auto' : 'no-handler';
    add('session-stalled', `${s.name}${x.binding?.kind === 'pr' ? ` (PR #${x.binding.number})` : ''}`, s.verdict === 'waiting-permission' ? `blocked on a permission prompt: ${s.waitingFor ?? 'no detail'}` : `no activity for ${age(s.transcriptAgeMs)} and no result file`, quietSinceMs(s, now), remedy);
  }
  if (unreaped.length) add('session-finished-unreaped', `${unreaped.length} session${unreaped.length === 1 ? '' : 's'}`, `finished but the process is still running: ${unreaped.slice(0, 6).map((s) => s.name).join(', ')}${unreaped.length > 6 ? ` +${unreaped.length - 6} more` : ''}`, Math.min(...unreaped.map((s) => startedMs(s, now) ?? Infinity)));
  const pre = prs.filter((p) => toMs(p.createdAt) != null && dayKey(toMs(p.createdAt)) < dayKey(now)).sort((a, b) => toMs(a.createdAt) - toMs(b.createdAt));
  if (pre.length) add('pre-today-pr-open', `${pre.length} PR${pre.length === 1 ? '' : 's'}`, `opened before today and still open; oldest is ${prRef(pre[0])}`, toMs(pre[0].createdAt));
  // ONE worker count for the header, over-capacity and the Next lines: land-advance's own (`capacityFor`, which counts only
  // sessions whose verdict holds a slot). Without a plan, fall back to the live dispatch-named sessions counted here.
  const workers = capacity ? capacity.live : live.filter((x) => x.binding).length;
  if (capacity && workers > capacity.cap) add('over-capacity', `${workers} workers`, `${workers} workers are running and the cap is ${capacity.cap}`, null);
  if (runnerKnown && !runnerLive) {
    // How long it has been down: the newest sign of life the runner report carries (last tick or heartbeat). No source -> unknown.
    const lastAlive = Math.max(...[input.runner.lastTick?.at, input.runner.runner?.heartbeatAt].map(toMs).filter(finite), -Infinity);
    const reason = input.runner.stalledReason ?? `runner state ${input.runner.state}`;
    add('runner-not-live', 'conveyor runner', finite(lastAlive) ? `${reason} Down since its last tick or heartbeat.` : `${reason} How long it has been down: unknown.`, finite(lastAlive) ? lastAlive : null, 'start: /conveyor');
  }
  attention.sort((a, b) => RULE_ORDER.indexOf(a.rule) - RULE_ORDER.indexOf(b.rule) || (a.since ?? Infinity) - (b.since ?? Infinity) || a.item.localeCompare(b.item));

  // Done since the last /wip (or the fallback window).
  const lastMs = toMs(input.lastWip), sinceMs = lastMs ?? now - DONE_FALLBACK_MS;
  const done = [
    ...(input.merged ?? []).filter((m) => toMs(m.mergedAt) > sinceMs && toMs(m.mergedAt) <= now).map((m) => ({ at: toMs(m.mergedAt), text: `${prRef(m)} landed — ${m.title}`, state: 'landed' })),
    ...(input.completions ?? []).filter((c) => c.status === 'done' && toMs(c.updatedAt) > sinceMs && toMs(c.updatedAt) <= now).map((c) => ({ at: toMs(c.updatedAt), text: `${c.session} finished${c.outcome ? ` — ${String(c.outcome).split('\n')[0]}` : ''}`, state: 'completed' })),
  ].sort((a, b) => a.at - b.at || a.text.localeCompare(b.text));

  // Next: only what land-advance owes and has proposed or deferred.
  const next = plan ? [...(plan.proposed ?? []).map((r) => ({ subject: r.subject, text: `${r.subject}: ${r.owedAction === 'dispatch-review' ? 'review' : 'fix'} will be dispatched`, deferred: false })),
    ...(plan.deferred ?? []).map((r) => ({ subject: r.subject, text: `${r.subject}: ${r.owedAction === 'dispatch-review' ? 'review' : 'fix'} deferred — ${deferralWords(r.reason)}`, deferred: true, reason: r.reason }))] : null;

  // Needs you: the operator queue's own lines, verbatim.
  const needsYou = parseNeedsYou(input.operatorQueueText);

  // Header.
  const oldest = pre[0] ?? null;
  const header = {
    time: stamp(now), load: finite(input.load) ? input.load : null, cores: input.cores ?? null,
    workers: capacity ? { live: workers, cap: capacity.cap } : null,
    runner: runnerStatus,
    preToday: { count: pre.length, oldest: oldest ? { ref: prRef(oldest), ageMs: now - toMs(oldest.createdAt) } : null, known: input.prs != null },
    operatorQueue: needsYou == null ? 'unknown' : needsYou.length ? `${needsYou.length}` : 'none', checkedAt: clock(now),
  };
  return { generatedAt: new Date(now).toISOString(), header, attention, attentionCounts: { dead: deadCount, unreaped: unreaped.length },
    workItems: [...items, ...itemRows, ...otherRows], docketAvailable: input.docket != null,
    docket: input.docket == null ? null : { total: docketItems.length, generatedAt: toMs(input.docket.generatedAt), stale: !(now - toMs(input.docket.generatedAt) <= DOCKET_STALE_MS) },
    done: { since: sinceMs, fallback: lastMs == null, rows: done, merged: input.merged != null }, next, capacity, needsYou, errors: input.errors ?? [] };
}

// ── rendering ───────────────────────────────────────────────────────────────────────────────────
// ONE output for a phone and a desktop terminal: plain markdown, no tables, no HTML, no flag, no width detection. Every
// fact is a short bullet, and a bullet longer than WRAP_AT columns wraps onto continuation lines indented under its text
// (markdown reads those as the same paragraph). `## Needs you` is the operator queue's own text and is never wrapped.
const remedyWords = (r) => (r === 'no-handler' ? 'no handler' : r);
/** Wrap width in columns; a single word longer than this stays whole on its own line. */
export const WRAP_AT = 42;
/** Word-wrap `text`: the first line starts with `lead`, continuation lines with `hang` (default: as wide as `lead`, blank). */
function wrap(text, lead = '', hang = ' '.repeat(lead.length)) {
  const words = String(text ?? '').split(/\s+/).filter(Boolean), lines = [];
  let line = lead, first = true;
  for (const w of words) {
    if (!first && line.length + 1 + w.length > WRAP_AT) { lines.push(line); line = hang + w; } else line += (first ? '' : ' ') + w;
    first = false;
  }
  lines.push(line.trimEnd());
  return lines;
}
/** A bullet at `depth` (0 = top level, 1 = a sub-bullet, ...). */
const bullet = (text, depth = 0) => wrap(text, `${'  '.repeat(depth)}- `);
/** A landed/finished row is `<head> — <detail>`: the head stays on the bullet, the detail goes on the next indented line. */
const splitDone = (text) => { const i = text.indexOf(' — '); return i < 0 ? [text, ''] : [text.slice(0, i), text.slice(i + 3)]; };

export function renderReport(r) {
  const { header: h } = r, now = Date.parse(r.generatedAt);
  const out = [];
  out.push(h.time);
  out.push(...bullet([h.load == null ? 'load unknown' : `load ${h.load.toFixed(2)} on ${h.cores ?? '?'} cores`, h.workers ? `workers ${h.workers.live} of ${h.workers.cap}` : 'workers unknown'].join(' · ')));
  out.push(...bullet(`runner: ${h.runner}${h.runner === 'unknown' ? ' (source unavailable)' : ''}`));
  if (h.runner === 'not live') out.push(...bullet('Attention items are NOT auto-handled', 1));
  if (!h.preToday.known) out.push(...bullet('pre-today PRs: unknown'));
  else if (!h.preToday.count) out.push(...bullet('no PRs open from before today'));
  else out.push(...bullet(`${h.preToday.count} PR${h.preToday.count === 1 ? '' : 's'} open from before today`), ...bullet(`oldest ${h.preToday.oldest.ref} (${age(h.preToday.oldest.ageMs)})`, 1));
  out.push(...bullet(h.operatorQueue === 'none' ? `operator queue: none (checked ${h.checkedAt})` : h.operatorQueue === 'unknown' ? 'operator queue: unknown' : `operator queue: ${h.operatorQueue} waiting on you`));
  if (h.operatorQueue === 'unknown') out.push(...bullet('could not read it', 1));
  out.push('');

  out.push('## Attention');
  const c = r.attentionCounts;
  if (!r.attention.length) out.push('Nothing needs attention.');
  else {
    for (const a of r.attention) {
      out.push(...bullet(`**${oneLine(a.item)}**`), ...bullet(oneLine(a.what), 1), ...bullet(`since ${a.since == null ? 'unknown' : since(a.since, now)}`, 1), ...bullet(`remedy: ${remedyWords(a.remedy)}`, 1));
    }
  }
  if (c.dead) out.push('', ...wrap(`${c.dead} dead session record${c.dead === 1 ? '' : 's'} (no process): nothing to act on.`));
  out.push('');

  out.push('## Work items');
  if (!r.workItems.length) out.push('No open PRs or live sessions.');
  else {
    const sinceLine = (ms) => (ms == null || !Number.isFinite(ms) ? [] : bullet(`since ${since(ms, now)}`, 1));
    for (const w of r.workItems) {
      out.push(...bullet(`**${oneLine(w.ref)}** ${oneLine(w.state)}`));
      if (w.title) out.push(...bullet(clip(oneLine(w.title)), 1));
      if (w.type === 'session') out.push(...bullet(oneLine(w.sessions[0].agent), 1));
      out.push(...sinceLine(w.since));
      if (w.next && w.next !== '—') out.push(...bullet(`next: ${oneLine(w.next)}`, 1));
      if (w.type !== 'session') {
        for (const s of w.sessions) {
          out.push(...bullet(`↳ ${oneLine(s.name)} ${oneLine(s.state)}`, 1), ...bullet(oneLine(s.agent), 2));
          if (s.since != null && Number.isFinite(s.since)) out.push(...bullet(`since ${since(s.since, now)}`, 2));
        }
      }
    }
  }
  if (!r.docketAvailable) out.push('', ...wrap('Open decisions: not listed (no decision docket data on this machine).'));
  else out.push('', ...wrap(`${r.docket.total} open decision${r.docket.total === 1 ? '' : 's'} in the docket (built ${Number.isFinite(r.docket.generatedAt) ? stamp(r.docket.generatedAt) : 'unknown date'})${r.docket.stale ? ' — docket may be stale' : ''}`));
  out.push('');

  // The heading is verbatim and may exceed WRAP_AT (a heading wraps by itself in any viewer).
  out.push(r.done.fallback ? `## Done since ${stamp(r.done.since)} (last 3 h; no earlier /wip stamp)` : `## Done since ${stamp(r.done.since)}`);
  if (!r.done.merged) out.push(...wrap('Merged PRs: unknown (could not list them).'));
  if (!r.done.rows.length) out.push(...wrap(r.done.merged ? 'Nothing landed or finished in this window.' : 'No finished-session records in this window.'));
  for (const d of r.done.rows) {
    const [head, detail] = splitDone(oneLine(d.text));
    out.push(...bullet(`${clock(d.at)} ${head}`));
    if (detail) out.push(...wrap(detail, '  '));
  }
  out.push('');

  out.push('## Next');
  if (r.next == null) out.push('Unknown (land-advance could not run).');
  else if (!r.next.length) out.push('Nothing owed.');
  else for (const n of r.next) out.push(...bullet(`${n.text}${n.reason === 'capacity' ? ` (${capacityWords(r.capacity)})` : ''}`));
  out.push('');

  // The operator queue's own lines, verbatim and unwrapped.
  out.push('## Needs you');
  if (r.needsYou == null) out.push('Needs you: unknown (operator queue could not be read)');
  else if (!r.needsYou.length) out.push('Needs you: none');
  else for (const line of r.needsYou) out.push(`- ${line}`);
  for (const e of r.errors) out.push('', ...wrap(`Source error: ${e.source}: ${e.message}`));
  return out.join('\n');
}
