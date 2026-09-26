/**
 * @file scripts/conveyor/health-watch-core.mjs
 * @description #4077 (health daemon slice 1, ruling #4065, design we:reports/2026-09-24-health-daemon-design.md) —
 *   the PURE CORE of the health watch. No IO: no fs, no child_process, no clock. The IO shell
 *   (we:scripts/conveyor/health-watch.mjs) runs the probes, hands their raw readings in here, and writes back
 *   whatever state/report/section this module returns.
 *
 * What lives here:
 *   1. {@link parseDaemonLog} — turns an appended chunk of a daemon log (review-daemon, fix-dispatch-daemon, …)
 *      into tick blocks: each `tick (…) — …` summary line plus the refusal/failure detail lines that follow it.
 *      The daemon logs carry NO timestamps, so times come from the health watch's own sample clock.
 *   2. {@link foldDaemonMemory} — the per-daemon memory the smells read: last tick time, the current run of
 *      "unproductive" ticks (owed work, 0 dispatched, a blocking refusal) and its reasons, auth errors, no-lane
 *      refusals. On the FIRST read of a log (bootstrap) tick times are estimated backwards from the log's mtime
 *      at the daemon's own tick interval, and flagged `estimated`.
 *   3. {@link stepEpisodes} — the episode model (4065 Fork 3): key (smell, subject), `openAfter` breaching
 *      samples to open, `closeAfter` clean ones to close, a flap cap (a key re-opening more than `flapMax` times
 *      in 24 h becomes one `flapping` episode that needs `flapCloseAfter` clean samples), tracked-silences that
 *      expire, and a high-severity reminder.
 *   4. {@link planActions} — what the shell would do (diagnose, notify, investigate, file). In `shadow` mode
 *      (slice 1 ships in shadow) only deterministic diagnoses and reports run; notify/investigate/file are
 *      planned but suppressed, so the operator can see what WOULD have happened — EXCEPT a smell that opts in
 *      via `notifyEvenInShadow` (#4077 continuation: `claude-auth-expired`), whose `notify` entries are never
 *      suppressed, in any mode. See {@link ../health-watch.mjs}'s own "THE MINIMAL NOTIFY PATH" doc for the
 *      execution side — before this, `notify` was planned but never actually SENT, in any mode, for any smell.
 *   5. {@link renderEpisodeReport} / {@link renderHealthSection} — the recommendation channel (4065 Fork 4):
 *      a durable per-episode report, and the HEALTH section the operator queue prints, whose first line is the
 *      health watch's own last-tick-completed age.
 */

import { isHighEntropyToken } from '../lib/secret-scrub.mjs';

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;

/** Defaults — every number is config (`<stateRoot>/.conveyor/health/config.json` overrides any of them). */
export const DEFAULT_HEALTH_CONFIG = Object.freeze({
  mode: 'shadow',
  tickBudgetMs: 60_000,
  flapMax: 3,
  flapWindowMs: 24 * HOUR,
  flapCloseAfter: 12,
  reminderAfterMs: 4 * HOUR,
  silenceDefaultMs: 72 * HOUR,
  healthStaleAfterMs: 15 * MINUTE,
  historyKeep: 100,
});

// ── 1. Daemon log parsing ────────────────────────────────────────────────────────────────────────────────────

const TICK_SUMMARY = /^([\w.-]+): tick \((.*?)\) — (.*)$/;
const TICK_FAILED_WHOLE = /^([\w.-]+): tick failed \(non-fatal\): (.*)$/;
const TICK_FAILED_REPO = /^([\w.-]+): (\S+\/\S+) tick failed \(non-fatal[^)]*\): (.*)$/;
const REFUSED = /^([\w.-]+): refused ([\w-]+) (\S+\/\S+) PR #(\d+) — (.*)$/;
const PR_FAILED = /^([\w.-]+): (\S+\/\S+)#(\d+) failed \(non-fatal\): (.*)$/;
const RECONCILE_REFUSED = /^([\w.-]+): reconcile-refused ([\w-]+) (\S+\/\S+) PR #(\d+)/;
const STARTED = /^([\w.-]+): started on (\S+), tick every (\d+)ms/;
const AUTH_ERROR = /Bad credentials|HTTP 401\b|401 Unauthorized|status(?:Code)?[=: ]+401\b/i;

/** Refusal kinds that mean the daemon WANTED to act and could not — the "refusing everything" signal. Every
 *  other kind (`nothing-owed`, `live-process`, `no-findings`, `cap-exhausted`, …) is a correct no-op. */
export const BLOCKING_REFUSALS = Object.freeze(new Set(['no-lane', 'dispatch-failed', 'stale-checkout', 'spawn-failed', 'lane-failed']));

/** Collapse a free-text reason into a stable bucket: digits → N, PR numbers dropped, capped length. */
export function normalizeReason(text) {
  return String(text ?? '')
    .replace(/\s+—\s+.*$/, (m) => m.slice(0, 140))
    .replace(/#\d+/g, '#N')
    .replace(/\b[0-9a-f]{12,40}\b/g, '<sha>')
    .replace(/\d+/g, 'N')
    .slice(0, 160)
    .trim();
}

function countField(text, name) {
  const m = new RegExp(`(\\d+) ${name}\\b`).exec(text) || new RegExp(`\\b${name} (\\d+)\\b`).exec(text);
  return m ? Number(m[1]) : 0;
}

/**
 * PURE: parse an appended chunk of one daemon log.
 * @param {string} text
 * @returns {{ ticks: Array<{owed:number, dispatched:number, refused:number, failed:number, deferred:number,
 *   wholeFailed:boolean, blocking:string[], benign:string[], noLane:Array<{repo:string}>}>,
 *   intervalMs: number|null, restarts: number, authErrors: number, lines: number }}
 */
export function parseDaemonLog(text) {
  // `lead` collects detail lines that arrive BEFORE this chunk's first tick summary: an incremental read can end
  // right after a summary line, so its refusal details land at the top of the NEXT chunk. The fold attaches
  // them to the tick it already counted, instead of dropping them.
  const out = { ticks: [], lead: { blocking: [], benign: [], noLane: [], prs: [] }, intervalMs: null, restarts: 0, authErrors: 0, lines: 0 };
  let cur = null;
  let started = false;
  const close = () => { if (cur) { out.ticks.push(cur); cur = null; } };
  for (const raw of String(text ?? '').split('\n')) {
    const line = raw.trimEnd();
    if (!line) continue;
    out.lines += 1;
    if (AUTH_ERROR.test(line)) out.authErrors += 1;
    let m;
    if ((m = STARTED.exec(line))) { close(); started = true; out.intervalMs = Number(m[3]); out.restarts += 1; continue; }
    if ((m = TICK_SUMMARY.exec(line))) {
      close();
      const body = m[3];
      cur = {
        owed: countField(body, 'owed'), dispatched: countField(body, 'dispatched'), refused: countField(body, 'refused'),
        failed: countField(body, 'failed'), deferred: countField(body, 'deferred'), wholeFailed: false,
        blocking: [], benign: [], noLane: [], prs: [],
      };
      if (cur.failed > 0) cur.blocking.push('dispatch failed');
      if (cur.deferred > 0 && /no acquirable lane/.test(body)) {
        cur.blocking.push('deferred: no acquirable lane');
        // The review daemon's deferral names no repo: recorded UNATTRIBUTED (repo null), never credited to a pool.
        for (let i = 0; i < cur.deferred; i += 1) cur.noLane.push({ repo: null });
      }
      continue;
    }
    if ((m = TICK_FAILED_WHOLE.exec(line))) {
      close();
      out.ticks.push({ owed: 0, dispatched: 0, refused: 0, failed: 0, deferred: 0, wholeFailed: true,
        blocking: [`tick failed: ${normalizeReason(m[2])}`], benign: [], noLane: [], prs: [] });
      continue;
    }
    if (!cur && started) continue; // details after a restart but before its first tick belong to no tick
    const tgt = cur ?? out.lead;
    if ((m = TICK_FAILED_REPO.exec(line))) {
      const why = /behind origin\/main/.test(m[3]) ? 'stale-checkout: dispatching clone behind origin/main' : normalizeReason(m[3]);
      tgt.blocking.push(`repo tick failed: ${why}`);
      continue;
    }
    if ((m = PR_FAILED.exec(line))) {
      // The review daemon's per-PR dispatch failure (`review-daemon: <repo>#N failed (non-fatal): …`).
      const reason = /behind origin\/main/.test(m[4]) ? 'stale-checkout: dispatching clone behind origin/main' : `dispatch failed: ${normalizeReason(m[4])}`;
      tgt.blocking.push(reason);
      tgt.prs.push({ pr: `${m[2]}#${m[3]}`, reason });
      continue;
    }
    if ((m = REFUSED.exec(line))) {
      const kind = m[2];
      const reason = `refused ${kind}: ${normalizeReason(m[5])}`;
      if (BLOCKING_REFUSALS.has(kind)) tgt.blocking.push(reason); else tgt.benign.push(reason);
      if (kind === 'no-lane') tgt.noLane.push({ repo: m[3] });
      tgt.prs.push({ pr: `${m[3]}#${m[4]}`, reason });
      continue;
    }
    if ((m = RECONCILE_REFUSED.exec(line))) {
      const kind = m[2];
      if (BLOCKING_REFUSALS.has(kind)) tgt.blocking.push(`reconcile-refused ${kind}`); else tgt.benign.push(`reconcile-refused ${kind}`);
      tgt.prs.push({ pr: `${m[3]}#${m[4]}`, reason: `reconcile-refused ${kind}` });
    }
  }
  close();
  return out;
}

/** A tick is UNPRODUCTIVE when it dispatched nothing while something blocked it (a blocking refusal, a failed
 *  dispatch, a no-lane deferral, a failed repo/whole tick). Idle, or owed work refused only by correct no-ops, is not. */
export function tickIsUnproductive(t) {
  if (!t) return false;
  if (t.dispatched > 0) return false;
  // Owed work alone is not a signal: owed PRs whose only refusals are correct no-ops (`live-process`,
  // `cap-exhausted`, …) must never count. Only a blocking reason or a thrown tick does.
  return !!t.wholeFailed || (t.blocking?.length ?? 0) > 0;
}

// ── 2. Per-daemon memory ─────────────────────────────────────────────────────────────────────────────────────

/**
 * PURE: fold one sample of one daemon's log into its memory.
 * @param {object|undefined} prev  the previous memory (undefined on first sight)
 * @param {{ name:string, mtimeMs:number, sizeBytes:number, text:string, bootstrap:boolean,
 *   defaultIntervalMs?:number, hasTickLines?:boolean }} sample
 * @param {number} now
 */
export function foldDaemonMemory(prev, sample, now) {
  const parsed = parseDaemonLog(sample.text);
  const mem = prev ? { ...prev, unproductiveReasons: { ...(prev.unproductiveReasons || {}) } } : {
    name: sample.name, intervalMs: null, lastTickAt: null, lastTickEstimated: false, ticksSeen: 0,
    unproductiveSince: null, unproductiveTicks: 0, unproductiveReasons: {}, lastTick: null,
    authErrorTimes: [], noLaneTimes: [], recentTicks: [], prRefusals: {}, lastGrowthAt: null, lastSize: 0, restarts: 0,
  };
  mem.recentTicks = [...(mem.recentTicks || [])];
  mem.prRefusals = { ...(mem.prRefusals || {}) };
  mem.intervalMs = parsed.intervalMs ?? mem.intervalMs ?? sample.defaultIntervalMs ?? 120_000;
  mem.restarts += parsed.restarts;
  if (sample.sizeBytes !== mem.lastSize || !prev) mem.lastGrowthAt = Math.min(sample.mtimeMs, now);
  mem.lastSize = sample.sizeBytes;
  mem.bootstrapEstimated = !!sample.bootstrap;

  // Late details for the tick the previous sample already counted (see `lead` in parseDaemonLog).
  const lead = parsed.lead;
  if (!sample.bootstrap && mem.lastTick && (lead.blocking.length || lead.benign.length || lead.prs.length)) {
    const at = mem.lastTick.at ?? mem.lastTickAt ?? now;
    const wasUnproductive = mem.lastTick.unproductive;
    mem.lastTick = { ...mem.lastTick, blocking: [...mem.lastTick.blocking, ...lead.blocking].slice(0, 5), noLane: [...(mem.lastTick.noLane || []), ...lead.noLane.map((x) => x.repo)] };
    for (const nl of lead.noLane) mem.noLaneTimes.push({ at, repo: nl.repo });
    for (const r of lead.prs) mem.prRefusals[r.pr] = { reason: r.reason, at };
    const nowUnproductive = tickIsUnproductive({ ...mem.lastTick, blocking: mem.lastTick.blocking });
    if (nowUnproductive) {
      if (!wasUnproductive) {
        mem.lastTick.unproductive = true;
        if (mem.unproductiveSince == null) { mem.unproductiveSince = at; mem.unproductiveReasons = {}; mem.unproductiveTicks = 0; }
        mem.unproductiveTicks += 1;
        const last = mem.recentTicks.at(-1);
        if (last && last.at === at) mem.recentTicks[mem.recentTicks.length - 1] = { ...last, u: 1, why: last.why ?? lead.blocking[0] ?? null };
      }
      for (const r of lead.blocking) mem.unproductiveReasons[r] = (mem.unproductiveReasons[r] || 0) + 1;
    }
  }

  const n = parsed.ticks.length;
  // Bootstrap: spread the ticks backwards from mtime at the tick interval (an estimate, flagged).
  // Steady state: every tick seen in this sample happened since the last sample — stamp it `now`.
  const tickTime = (i) => (sample.bootstrap ? sample.mtimeMs - (n - 1 - i) * mem.intervalMs : Math.min(now, sample.mtimeMs));
  parsed.ticks.forEach((t, i) => {
    const at = tickTime(i);
    mem.ticksSeen += 1;
    mem.lastTickAt = at;
    mem.lastTickEstimated = !!sample.bootstrap;
    mem.lastTick = { at, dispatched: t.dispatched, owed: t.owed, refused: t.refused, wholeFailed: t.wholeFailed, blocking: t.blocking.slice(0, 5), noLane: t.noLane.map((x) => x.repo), unproductive: tickIsUnproductive(t) };
    for (const nl of t.noLane) mem.noLaneTimes.push({ at, repo: nl.repo });
    for (const r of t.prs || []) mem.prRefusals[r.pr] = { reason: r.reason, at };
    mem.recentTicks.push({ at, u: tickIsUnproductive(t) ? 1 : 0, f: t.wholeFailed ? 1 : 0, why: t.blocking[0] ?? null });
    if (tickIsUnproductive(t)) {
      if (mem.unproductiveSince == null) { mem.unproductiveSince = at; mem.unproductiveReasons = {}; mem.unproductiveTicks = 0; }
      mem.unproductiveTicks += 1;
      const reasons = t.blocking.length ? t.blocking : ['owed work left undispatched'];
      for (const r of reasons) mem.unproductiveReasons[r] = (mem.unproductiveReasons[r] || 0) + 1;
    } else {
      mem.unproductiveSince = null; mem.unproductiveTicks = 0; mem.unproductiveReasons = {};
    }
  });
  if (parsed.authErrors > 0) {
    for (let i = 0; i < parsed.authErrors; i += 1) mem.authErrorTimes.push(sample.bootstrap ? sample.mtimeMs : now);
  }
  const keepAfter = now - 2 * HOUR;
  mem.authErrorTimes = mem.authErrorTimes.filter((t) => t >= keepAfter).slice(-200);
  mem.noLaneTimes = mem.noLaneTimes.filter((e) => e.at >= keepAfter).slice(-500);
  mem.recentTicks = mem.recentTicks.filter((e) => e.at >= keepAfter).slice(-300);
  mem.prRefusals = Object.fromEntries(Object.entries(mem.prRefusals).sort((a, b) => b[1].at - a[1].at).slice(0, 200));
  return mem;
}

// ── 3. Episodes ──────────────────────────────────────────────────────────────────────────────────────────────

export function episodeKey(smellId, subject) { return `${smellId}::${subject}`; }

function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60); }

/** Stable id for the episode report file: `<utc date>-<smell>-<subject>-<HHMM>`. */
export function episodeId(smellId, subject, openedAt) {
  const d = new Date(openedAt).toISOString();
  return `${d.slice(0, 10)}-${slug(smellId)}-${slug(subject)}-${d.slice(11, 13)}${d.slice(14, 16)}`;
}

export function emptyHealthState() {
  return { version: 1, episodes: {}, opens: {}, history: [], silences: [], daemons: {}, probeErrors: {}, lastTick: null };
}

function matchSilence(silences, smell, subject) {
  return (silences || []).find((s) => s.smell === smell && (s.subject == null || s.subject === '*' || s.subject === subject));
}

/**
 * PURE: step every episode by one tick's smell results.
 * @param {ReturnType<typeof emptyHealthState>} state
 * @param {Array<{ smell: object, results: Array<{subject:string, breach:boolean, measure?:object, summary?:string}>|null }>} evaluations
 *   `results: null` means the smell had no sample this tick (probe not due / errored) — its episodes do not move.
 * @param {number} now
 * @param {{ config?: object, activeCards?: Set<string> }} [opts]
 * @returns {{ state: object, transitions: Array<{type:string, key:string, episode:object}> }}
 */
export function stepEpisodes(state, evaluations, now, { config = DEFAULT_HEALTH_CONFIG, activeCards = new Set() } = {}) {
  const cfg = { ...DEFAULT_HEALTH_CONFIG, ...config };
  const next = {
    ...state,
    episodes: Object.fromEntries(Object.entries(state.episodes || {}).map(([k, e]) => [k, { ...e }])),
    opens: Object.fromEntries(Object.entries(state.opens || {}).map(([k, v]) => [k, v.filter((t) => t >= now - cfg.flapWindowMs)])),
    history: [...(state.history || [])],
    silences: (state.silences || []).map((s) => ({ ...s })),
  };
  const transitions = [];
  const emit = (type, key) => transitions.push({ type, key, episode: next.episodes[key] ?? next.history.at(-1) });

  for (const { smell, results } of evaluations) {
    if (!Array.isArray(results)) continue;
    const seen = new Set();
    const openAfter = smell.openAfter ?? 2;
    const closeAfter = smell.closeAfter ?? 3;
    for (const r of results) {
      const key = episodeKey(smell.id, r.subject);
      seen.add(key);
      let ep = next.episodes[key];
      if (r.breach) {
        if (!ep) {
          ep = next.episodes[key] = {
            key, smell: smell.id, subject: r.subject, status: 'pending', severity: smell.severity ?? 'medium',
            action: smell.action ?? 'alert', breachStreak: 0, cleanStreak: 0, firstBreachAt: now,
            openedAt: null, lastBreachAt: null, id: null, tracked: null, remindedAt: null, samples: 0,
          };
        }
        ep.breachStreak += 1; ep.cleanStreak = 0; ep.lastBreachAt = now; ep.samples += 1;
        ep.measure = r.measure ?? {}; ep.summary = r.summary ?? ''; ep.recommendation = r.recommendation ?? smell.recommendationHint ?? '';
        if (ep.status === 'pending' && ep.breachStreak >= openAfter) {
          const opens = next.opens[key] || [];
          opens.push(now);
          next.opens[key] = opens;
          ep.openedAt = now;
          ep.id = episodeId(smell.id, r.subject, now);
          ep.status = opens.length > cfg.flapMax ? 'flapping' : 'open';
          emit(ep.status === 'flapping' ? 'flapping' : 'opened', key);
        }
      } else if (ep) {
        applyClean(ep, key);
      }
    }
    // A subject that disappeared from this smell's results is a clean sample for it.
    for (const [key, ep] of Object.entries(next.episodes)) {
      if (ep.smell === smell.id && !seen.has(key)) applyClean(ep, key);
    }

    function applyClean(ep, key) {
      ep.cleanStreak += 1; ep.breachStreak = 0; ep.samples += 1;
      if (ep.status === 'pending') { delete next.episodes[key]; return; }
      const need = ep.status === 'flapping' ? cfg.flapCloseAfter : closeAfter;
      if (ep.cleanStreak >= need) {
        ep.status = 'closed'; ep.closedAt = now;
        delete next.episodes[key];
        next.history.push(ep);
        emit('closed', key);
      }
    }
  }

  // Tracked-silences: a matching unexpired silence quiets an open episode; an expired one re-raises it once.
  for (const [key, ep] of Object.entries(next.episodes)) {
    if (ep.status === 'pending') continue;
    const s = matchSilence(next.silences, ep.smell, ep.subject);
    if (!s) { ep.tracked = null; continue; }
    const live = (s.expiresAt ?? 0) > now || (s.card && activeCards.has(String(s.card)));
    if (live) { ep.tracked = { card: s.card ?? null, until: s.expiresAt ?? null }; continue; }
    if (ep.tracked || !s.expiredNotified) {
      ep.tracked = null;
      s.expiredNotified = true;
      emit('silence-expired', key);
    }
  }
  // High-severity reminder: once, `reminderAfterMs` after opening, if still untracked.
  for (const [key, ep] of Object.entries(next.episodes)) {
    if (ep.status === 'pending' || ep.tracked || ep.severity !== 'high' || ep.remindedAt) continue;
    if (ep.openedAt != null && now - ep.openedAt >= cfg.reminderAfterMs) { ep.remindedAt = now; emit('reminder', key); }
  }
  next.history = next.history.slice(-cfg.historyKeep);
  return { state: next, transitions };
}

// ── 4. Action plan ───────────────────────────────────────────────────────────────────────────────────────────

/**
 * PURE: turn transitions into the actions the shell performs. Deterministic diagnoses always run (on open);
 * notify / investigate / file are SUPPRESSED in shadow mode — listed with `suppressed` so the report shows
 * what would have happened.
 *
 * `smell.notifyEvenInShadow: true` is the ONE opt-in exception to that shadow-mode suppression (added for the
 * `claude-auth-expired` sign, #4077 continuation — an expired operator login left every daemon-dispatched
 * session dead all night with no alert, because `notify` was never actually wired to send anything in ANY
 * mode; see `health-watch.mjs`'s own "THE MINIMAL NOTIFY PATH" doc for the execution side). A smell that does
 * NOT set this flag is completely unaffected — its `notify` entries stay suppressed in shadow exactly as
 * before this flag existed. Never applies to `investigate`/`file` (still slice-2/slice-5 work, not shipped).
 */
export function planActions(transitions, smellsById, { mode = 'shadow' } = {}) {
  const plan = [];
  for (const t of transitions) {
    const ep = t.episode;
    const smell = smellsById[ep?.smell];
    if (!ep || !smell) continue;
    const shadowSuppressed = mode === 'shadow' && !smell.notifyEvenInShadow;
    if (t.type === 'opened' || t.type === 'flapping') {
      if (smell.diagnose) plan.push({ kind: 'diagnose', key: t.key, diagnose: smell.diagnose });
      if (ep.severity === 'high' && !ep.tracked) plan.push({ kind: 'notify', key: t.key, suppressed: shadowSuppressed ? 'shadow mode' : null });
      if (smell.action === 'investigate') plan.push({ kind: 'investigate', key: t.key, suppressed: mode === 'shadow' ? 'shadow mode (agent investigation is slice 2, #4078)' : 'not built yet (slice 2, #4078)' });
      if (smell.action === 'file') plan.push({ kind: 'file', key: t.key, suppressed: mode === 'shadow' ? 'shadow mode' : 'not built yet (slice 5)' });
    } else if (t.type === 'reminder' || t.type === 'silence-expired') {
      plan.push({ kind: 'notify', key: t.key, reason: t.type, suppressed: shadowSuppressed ? 'shadow mode' : null });
    }
  }
  return plan;
}

// ── 5. Rendering ─────────────────────────────────────────────────────────────────────────────────────────────

const TOKENISH = /\b(gh[pousr]_[A-Za-z0-9]{16,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9-]{20,}|xox[abp]-[A-Za-z0-9-]{10,})\b/g;

/** PURE: redact credential-shaped tokens from any text headed for a durable report (4065: reports are scrubbed). */
export function scrubText(text) {
  return String(text ?? '')
    .replace(/(Bearer|token)\s+[A-Za-z0-9._-]{16,}/gi, '$1 [redacted]')
    .replace(TOKENISH, '[redacted]')
    .split(/(\s+)/)
    .map((tok) => (/^[0-9a-f]{7,40}$/i.test(tok) || !isHighEntropyToken(tok) ? tok : '[redacted]'))
    .join('');
}

/**
 * PURE: shrink a diagnosis command's output for the report. JSON output (a declared operation's `--json`) is
 * summarized — every array of records counted by `kind` × `verdict`, plus any `gaps`/`reasons` strings — so
 * the report says "12 lease records: 9 live, 3 dead" instead of the tail of a 60 KB dump. Anything else keeps
 * its last `maxChars`.
 */
export function summarizeDiagnosisOutput(output, maxChars = 4000) {
  const text = String(output ?? '');
  const start = text.indexOf('{');
  let json = null;
  if (start >= 0) { try { json = JSON.parse(text.slice(start)); } catch { json = null; } }
  if (!json || typeof json !== 'object') return text.slice(-maxChars);
  const lines = [];
  const seen = new Set();
  const walk = (o, path, depth) => {
    if (!o || typeof o !== 'object' || depth > 5) return;
    if (Array.isArray(o)) {
      if (o.length && typeof o[0] === 'object' && o[0] && ('verdict' in o[0] || 'kind' in o[0])) {
        const sig = JSON.stringify(o.map((r) => [r.kind, r.verdict]));
        if (seen.has(sig)) return;
        seen.add(sig);
        const counts = {};
        for (const r of o) { const k = `${r.kind ?? '?'}:${typeof r.verdict === 'string' ? r.verdict : r.verdict ? 'object' : '-'}`; counts[k] = (counts[k] || 0) + 1; }
        lines.push(`${path}: ${o.length} record(s) — ${Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(', ')}`);
      } else if (o.length && typeof o[0] === 'string') {
        const sig = JSON.stringify(o);
        if (seen.has(sig)) return;
        seen.add(sig);
        lines.push(`${path}: ${o.slice(0, 5).join(' | ')}${o.length > 5 ? ` (+${o.length - 5})` : ''}`);
      }
      return;
    }
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === 'string' && /reason|verdict|status|summary|message/i.test(k)) lines.push(`${path}.${k}: ${v.slice(0, 200)}`);
      else walk(v, `${path}.${k}`, depth + 1);
    }
  };
  walk(json, '', 0);
  return (lines.join('\n') || text.slice(-maxChars)).slice(0, maxChars);
}

/** PURE: {@link scrubText} applied to every string (and every object key) in a JSON-able value — what the shell persists (episode
 *  `.json`, `state.json`) gets the same redaction as the `.md` report. */
export function scrubDeep(value) {
  if (typeof value === 'string') return scrubText(value);
  if (Array.isArray(value)) return value.map(scrubDeep);
  // Keys too: reason histograms (`unproductiveReasons`) are keyed BY the reason text.
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [scrubText(k), scrubDeep(v)]));
  return value;
}

export function fmtAge(ms) {
  if (ms == null || !Number.isFinite(ms)) return '?';
  const m = Math.round(ms / MINUTE);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return h < 48 ? `${h}h${String(m % 60).padStart(2, '0')}m` : `${Math.floor(h / 24)}d`;
}

/** PURE: the durable per-episode report (markdown). */
export function renderEpisodeReport(ep, { now, smell, diagnosis = null, plan = [], mode = 'shadow' } = {}) {
  const lines = [
    `# Health episode: ${ep.smell} — ${ep.subject}`,
    '',
    `- Status: **${ep.status}**${ep.tracked ? ` (tracked by card ${ep.tracked.card ?? '?'}, quiet)` : ''} · severity ${ep.severity} · mode ${mode}`,
    `- Opened: ${ep.openedAt ? new Date(ep.openedAt).toISOString() : '—'} (${fmtAge(now - (ep.openedAt ?? now))} ago) · last breach ${ep.lastBreachAt ? new Date(ep.lastBreachAt).toISOString() : '—'}`,
    '',
    '## What is wrong',
    '',
    scrubText(ep.summary || '(no summary)'),
    '',
    '## Measurements',
    '',
    '```json',
    scrubText(JSON.stringify(ep.measure ?? {}, null, 2)),
    '```',
    '',
  ];
  if (diagnosis) {
    lines.push('## Deterministic diagnosis', '', `\`${diagnosis.command}\` → exit ${diagnosis.code}${diagnosis.timedOut ? ' (timed out)' : ''}`, '', '```', scrubText(diagnosis.output || '').slice(0, 4000), '```', '');
  }
  const suppressed = plan.filter((p) => p.key === ep.key && p.suppressed);
  if (suppressed.length) {
    lines.push('## Held back', '', ...suppressed.map((p) => `- ${p.kind}: ${p.suppressed}`), '');
  }
  lines.push('## What you should do', '', scrubText(ep.recommendation || smell?.recommendationHint || 'Investigate.'), '');
  return lines.join('\n');
}

/**
 * PURE: the HEALTH section of the operator queue. First line = the health watch's own last-tick-completed age
 * (the operator's view of whether the watcher itself is alive). One row per non-pending episode.
 * @param {{ lastTick: {completedAt:number, durationMs:number, mode:string}|null, episodes: object }} state
 * @param {{ now:number, reportDir?:string, staleAfterMs?:number }} o
 * @returns {string[]}
 */
export function renderHealthSection(state, { now, reportDir = '', staleAfterMs = DEFAULT_HEALTH_CONFIG.healthStaleAfterMs } = {}) {
  const lt = state?.lastTick;
  const eps = Object.values(state?.episodes ?? {}).filter((e) => e.status !== 'pending')
    .sort((a, b) => (a.severity === b.severity ? (a.openedAt ?? 0) - (b.openedAt ?? 0) : a.severity === 'high' ? -1 : 1));
  const head = !lt
    ? 'HEALTH — the health watch has never completed a tick (not running: see skills-src/conveyor/launchd/com.we.health-watch.plist.example)'
    : `HEALTH — last health tick completed ${fmtAge(now - lt.completedAt)} ago${now - lt.completedAt > staleAfterMs ? ' — STALE, the health watch itself is not ticking' : ''} (${lt.mode ?? 'shadow'} mode, ${eps.length} open episode(s))`;
  const rows = eps.map((e) => {
    const where = reportDir && e.id ? `  → ${reportDir}/${e.id}.md` : '';
    const tag = e.status === 'flapping' ? 'FLAPPING ' : '';
    const quiet = e.tracked ? ` [tracked: ${e.tracked.card ?? 'silenced'}]` : '';
    return `  [${e.severity}] ${tag}${e.smell}  ${e.subject}  open ${fmtAge(now - (e.openedAt ?? now))}${quiet} — ${e.recommendation || e.summary}${where}`;
  });
  return [head, ...(rows.length ? rows : ['  (no open episodes)'])];
}

// ── The whole tick, pure ─────────────────────────────────────────────────────────────────────────────────────

/**
 * PURE: one full health tick over already-read probes.
 * @param {object} prevState
 * @param {{ daemonLogs?: Array<object>, [probe:string]: any }} probes  raw probe readings from the shell
 * @param {Array<object>} smells  the registry
 * @param {number} now
 * @param {{ config?: object, activeCards?: Set<string>, probeErrors?: Record<string,string> }} [opts]
 */
export function runHealthTick(prevState, probes, smells, now, { config = {}, activeCards, probeErrors = {} } = {}) {
  const cfg = { ...DEFAULT_HEALTH_CONFIG, ...config };
  const state = { ...emptyHealthState(), ...(prevState || {}) };
  const daemons = { ...(state.daemons || {}) };
  for (const s of probes.daemonLogs || []) daemons[s.name] = foldDaemonMemory(daemons[s.name], s, now);
  // Probe-error streaks (smell 15's input).
  const errs = { ...(state.probeErrors || {}) };
  // An IO probe's streak resets when that probe succeeds; a smell's own `smell:<id>` streak resets only when that
  // smell evaluates cleanly (below) — never here, or a smell that throws every tick would never reach 3.
  for (const name of Object.keys(errs)) if (!name.startsWith('smell:') && !(name in probeErrors)) delete errs[name];
  for (const [name, msg] of Object.entries(probeErrors)) errs[name] = { count: (errs[name]?.count ?? 0) + 1, last: String(msg).slice(0, 200) };

  // When each heavy-admission slot holder was FIRST seen (the status read carries no acquire time): kept in state,
  // dropped as soon as that (slot, owner, pid) no longer holds.
  let heavyHeldSince = state.heavyHeldSince || {};
  if (probes.heavyQueue) {
    const next = {};
    for (const h of probes.heavyQueue.held || []) {
      const k = `${h.slot}|${h.owner}|${h.pid}`;
      next[k] = heavyHeldSince[k] ?? now;
    }
    heavyHeldSince = next;
  }
  const ctx = { now, config: cfg, daemons, probeErrors: errs, lastTick: state.lastTick, heavyHeldSince };
  const evaluations = smells.map((smell) => {
    const needs = smell.probes ?? [];
    const missing = needs.filter((p) => probes[p] === undefined);
    if (missing.length) return { smell, results: null, skipped: missing };
    try {
      const results = smell.evaluate(probes, ctx);
      delete errs[`smell:${smell.id}`];
      return { smell, results };
    } catch (e) {
      errs[`smell:${smell.id}`] = { count: (errs[`smell:${smell.id}`]?.count ?? 0) + 1, last: String(e?.message || e).slice(0, 200) };
      return { smell, results: null, error: String(e?.message || e) };
    }
  });
  const stepped = stepEpisodes({ ...state, daemons, probeErrors: errs, heavyHeldSince }, evaluations, now, { config: cfg, activeCards });
  const smellsById = Object.fromEntries(smells.map((s) => [s.id, s]));
  const plan = planActions(stepped.transitions, smellsById, { mode: cfg.mode });
  return { state: stepped.state, transitions: stepped.transitions, plan, evaluations };
}
