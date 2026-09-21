/**
 * @file scripts/operations/turn-digest.mjs
 * @description THE `turn-digest` DECLARATION (#3724, under epic #3718; prototype line of epic #3383) — ONE derived,
 *   read-only picture of the turn: what LANDED since a cursor, what is OWED, what NEEDS THE OPERATOR, which review
 *   labels are STALE, what is LIVE, and whether the RUNNER is up.
 *
 * WHY IT EXISTS. Every turn a session re-derived live state by hand: fetch `main`, list open PRs per repo, work out
 * what merged since last turn, run the operator queue, run the reconcile plan, spot conflicts and stale labels, list
 * sessions and lanes. Each of those reads already exists; this composes them into ONE declared operation and adds the
 * one missing piece, a "landed since" cursor. `turn-digest [--since=<sha>] [--consumer=<id>] [--repos=…]`.
 *
 * ── THE TWO STEPS ──────────────────────────────────────────────────────────────────────────────────────────
 *
 *   | step     | kind      | what it does                                                                          |
 *   |----------|-----------|---------------------------------------------------------------------------------------|
 *   | `read`   | `compute` | ONE injected `readFacts` call: git, `gh`, the operator queue, reconcile, sessions, lanes, the runner |
 *   | `assess` | `compute` | PURE: {@link buildDigest} — shape every section, and say which ones could not be read  |
 *
 * NO EFFECT IS DECLARED. Asking for the digest is a READ, so `./http-adapter.mjs` derives a GET-only, run-record-free
 * surface for it (the path `pr-status` takes). The snapshot file is NOT an effect of the run: it is written by the
 * command line's `finish` hook in `./turn-digest-io.mjs`, after the run has settled, and never through the engine.
 *
 * ── THE LANDED-SINCE CURSOR (the one new piece) ────────────────────────────────────────────────────────────
 *
 * `landed` is the FIRST-PARENT merge commits on `origin/main` after the cursor sha, each named
 * `Merge pull request #N …`. A pure git read: no `gh` call, so it works with no network and no credential. The
 * cursor is stored PER CONSUMER (a session id), so two sessions each keep their own "since". A first call with no
 * cursor returns the last {@link DEFAULT_LANDED_LIMIT} merges. The cursor moves only when the caller asks
 * (`--advance`), so an ordinary digest can never make a sibling's next digest lose what it has not yet seen.
 *
 * ── HONESTY RULES ──────────────────────────────────────────────────────────────────────────────────────────
 *
 * 1. A SECTION THAT COULD NOT BE READ IS NEVER AN EMPTY LIST. Every field is always present, and a field whose read
 *    was unavailable is named in `unavailable[]` with the reason and `complete` is `false`. An empty `owed` means
 *    "asked, and nothing is owed" only when `owed` is not in `unavailable`. The same line `pr-status` draws between
 *    an empty listing and a failed one.
 * 2. `live` REPORTS WHAT IT CAN AND FLAGS WHAT IT CANNOT. Lane availability (#3725) and finished-but-alive session
 *    reaping (#3721) are prerequisites for trusting `live`; while those cards are open the digest says so in
 *    `live.caveats`, so a consumer never mistakes a miscount for a fact.
 * 3. IRREDUCIBLE JUDGMENT STAYS OUT. The digest states facts and refusals. It does not decide whether to clear a
 *    stood-down PR, rule a decision, pick a keeper among duplicate PRs, resolve a conflict or choose what to build.
 *
 * PURE. No fs, no clock, no process, no network in this file: its import graph reaches only `./registry.mjs` and
 * `./step-kinds.mjs`, which the read-only import-graph check in `http-adapter.test.mjs` asserts.
 */
import { op } from './registry.mjs';
import { compute } from './step-kinds.mjs';

/** The operation's stable id. Adapters resolve it by this name. */
export const TURN_DIGEST_OP = 'turn-digest';

/** How many merges a first call (no cursor) returns. */
export const DEFAULT_LANDED_LIMIT = 10;

/** The most merges one call reports after a cursor; more is reported as `landedTruncated`, never dropped silently. */
export const MAX_LANDED = 200;

/** The label the parked-PR conflict watch owns (`we:scripts/conveyor/parked-pr-conflict-watch.mjs#CONFLICT_LABEL`). */
export const CONFLICT_LABEL = 'merge-status:conflicting';

/** The snapshot's shape version, so a reader (#3726's hook) can refuse a file it does not understand. */
export const DIGEST_VERSION = 1;

/** Every top-level section the digest carries, in output order. `unavailable[].field` is always one of these. */
export const DIGEST_FIELDS = Object.freeze(['landed', 'needsOperator', 'owed', 'staleLabels', 'live', 'runner']);

/** A first-parent merge subject: `Merge pull request #2383 from chalbert/lane/x`. */
const MERGE_SUBJECT = /^Merge pull request #(\d+)\b/;

const str = (v) => (typeof v === 'string' ? v : v == null ? '' : String(v));
const arr = (v) => (Array.isArray(v) ? v : []);
const short = (sha) => str(sha).slice(0, 9);
const unavailable = (field, reason) => ({ field, reason: str(reason) || 'unreadable' });

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
// The consumer id and the cursor.

/** A consumer id is a filename on disk, so it is restricted to a filename-safe token. PURE. */
export function isValidConsumerId(id) {
  return typeof id === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(id);
}

/**
 * WHICH CURSOR APPLIES. An explicit `--since` beats the consumer's stored one, which beats "none" (a first call).
 * PURE.
 * @param {{since?: string, stored?: (string|null)}} o
 * @returns {{cursor: (string|null), source: 'input'|'stored'|'none'}}
 */
export function resolveCursor({ since = '', stored = null } = {}) {
  const s = str(since).trim();
  if (s) return { cursor: s, source: 'input' };
  const t = str(stored).trim();
  if (t) return { cursor: t, source: 'stored' };
  return { cursor: null, source: 'none' };
}

/**
 * Parse `git log --first-parent --format=%H%x1f%cI%x1f%s` output into commit rows. PURE. A line that does not have
 * three fields is dropped: a torn line must not become a phantom commit.
 * @param {string} text
 * @returns {Array<{sha: string, date: string, subject: string}>}
 */
export function parseCommitLog(text) {
  return str(text).split('\n').map((l) => l.replace(/\r$/, '')).filter(Boolean).map((line) => {
    const [sha, date, ...rest] = line.split('\x1f');
    return { sha: str(sha).trim(), date: str(date).trim(), subject: rest.join('\x1f') };
  }).filter((c) => /^[0-9a-f]{7,64}$/.test(c.sha) && c.subject);
}

/**
 * REDUCE first-parent commits (newest first, as git prints them) to the merged PRs. PURE.
 *
 * ONLY `Merge pull request #N` SUBJECTS COUNT. A drain bookkeeping commit or a direct push on `main` landed no PR and
 * must not be reported as one. Result order is OLDEST FIRST, the order a reader replays them in. With `limit` set (a
 * first call) the NEWEST `limit` merges are kept; without it (a cursor call) all are kept up to {@link MAX_LANDED}.
 * A PR number appearing twice (a revert-and-reland) is listed once per merge, since each is a real landing.
 *
 * @param {Array<{sha: string, date?: string, subject: string}>} commits
 * @param {{limit?: (number|null)}} [o]
 * @returns {{landed: Array<{pr: number, sha: string, mergedAt: (string|null), subject: string}>, truncated: boolean}}
 */
export function landedFrom(commits, { limit = null } = {}) {
  const merges = arr(commits).map((c) => {
    const m = MERGE_SUBJECT.exec(str(c?.subject));
    return m ? { pr: Number(m[1]), sha: str(c.sha), mergedAt: str(c.date) || null, subject: str(c.subject) } : null;
  }).filter(Boolean);
  const cap = Number.isInteger(limit) && limit > 0 ? limit : MAX_LANDED;
  const kept = merges.slice(0, cap);
  return { landed: kept.reverse(), truncated: merges.length > cap && !(Number.isInteger(limit) && limit > 0) };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
// The per-section shapers. Each takes what the reader returned and never throws on a hostile shape.

/**
 * `needsOperator[]` from the operator queue's `NEEDS YOU` lines, verbatim, with the PR number and repo lifted out when
 * the line names them (`PR #2401 (chalbert/web-everything) — …` or `chalbert/web-everything#2401  title`). PURE.
 * @param {{available?: boolean, lines?: string[], reason?: string}} raw
 */
export function shapeNeedsOperator(raw) {
  if (!raw || raw.available === false) return { items: [], gap: unavailable('needsOperator', raw?.reason ?? 'the operator queue was not read') };
  const items = arr(raw.lines).map((line) => {
    const l = str(line).trim();
    const a = /^PR #(\d+) \(([^)]+)\)/.exec(l);
    const b = /^([^\s#]+)#(\d+)\b/.exec(l);
    const pr = a ? Number(a[1]) : b ? Number(b[2]) : null;
    const repo = a ? a[2] : b ? b[1] : null;
    return { pr, repo, line: l };
  });
  return { items, gap: null };
}

/**
 * `owed[]` (dispatches and refusals) from each repo's reconcile plan. A repo whose plan could not be read is a
 * per-repo gap, not an empty repo. PURE.
 * @param {{available?: boolean, reason?: string, byRepo?: Array<{repo: string, error?: string, dispatch?: object[], refusals?: object[], notes?: object[]}>}} raw
 */
export function shapeOwed(raw) {
  if (!raw || raw.available === false) return { items: [], notes: [], gaps: [unavailable('owed', raw?.reason ?? 'the reconcile plan was not read')] };
  const items = [];
  const notes = [];
  const gaps = [];
  for (const r of arr(raw.byRepo)) {
    if (r?.error) { gaps.push(unavailable('owed', `${r.repo}: ${r.error}`)); continue; }
    for (const d of arr(r.dispatch)) items.push({ repo: str(r.repo), type: 'dispatch', kind: str(d.kind), pr: Number(d.prNumber) || null, why: str(d.why) });
    for (const f of arr(r.refusals)) {
      items.push({ repo: str(r.repo), type: 'refusal', kind: str(f.kind), pr: Number(f.prNumber) || null, why: str(f.why) });
    }
    for (const n of arr(r.notes)) notes.push({ repo: str(r.repo), text: str(n?.text) });
  }
  return { items, notes, gaps };
}

/**
 * `staleLabels[]`: a PR whose `merge-status:conflicting` label DISAGREES with its current mergeability. PURE.
 *
 *   · `stale-label`   — the label is on the PR but GitHub reports it MERGEABLE (the conflict is gone).
 *   · `missing-label` — GitHub reports it CONFLICTING and it is a PR the watch tracks (`parked`), but the label is absent.
 *
 * `UNKNOWN` mergeability is GitHub still computing: it says nothing either way, so it is counted as `undetermined`
 * and never reported as a disagreement. The digest REPORTS; it never writes a label (that is the watch's job).
 *
 * @param {{available?: boolean, reason?: string, byRepo?: Array<{repo: string, error?: string, prs?: object[]}>}} raw
 */
export function shapeStaleLabels(raw) {
  if (!raw || raw.available === false) return { items: [], undetermined: 0, gaps: [unavailable('staleLabels', raw?.reason ?? 'open PRs were not read')] };
  const items = [];
  const gaps = [];
  let undetermined = 0;
  for (const r of arr(raw.byRepo)) {
    if (r?.error) { gaps.push(unavailable('staleLabels', `${r.repo}: ${r.error}`)); continue; }
    for (const pr of arr(r.prs)) {
      const labels = arr(pr.labels).map((l) => str(l?.name ?? l));
      const has = labels.includes(CONFLICT_LABEL);
      const mergeable = str(pr.mergeable).toUpperCase();
      const base = { repo: str(r.repo), pr: Number(pr.number) || null, label: CONFLICT_LABEL, mergeable, mergeStateStatus: str(pr.mergeStateStatus).toUpperCase() };
      if (mergeable === 'UNKNOWN' || mergeable === '') { if (has) undetermined += 1; continue; }
      if (has && mergeable === 'MERGEABLE') {
        items.push({ ...base, kind: 'stale-label', why: `carries \`${CONFLICT_LABEL}\` but GitHub reports it MERGEABLE — the conflict is gone` });
      } else if (!has && mergeable === 'CONFLICTING' && pr.parked === true) {
        items.push({ ...base, kind: 'missing-label', why: `GitHub reports it CONFLICTING and the watch tracks it, but it lacks \`${CONFLICT_LABEL}\`` });
      }
    }
  }
  items.sort((a, b) => (a.repo < b.repo ? -1 : a.repo > b.repo ? 1 : a.pr - b.pr));
  return { items, undetermined, gaps };
}

/**
 * `live`: sessions, in-flight dispatches, free lanes, and the caveats that say how far to trust them. PURE.
 * @param {object} raw
 */
export function shapeLive(raw) {
  const gaps = [];
  const section = (name, s, rows) => {
    if (!s || s.available === false) { gaps.push(unavailable('live', `${name}: ${s?.reason ?? 'not read'}`)); return { available: false, reason: str(s?.reason) || 'not read', ...rows.empty }; }
    return { available: true, ...rows.fill(s) };
  };
  const sessions = section('sessions', raw?.sessions, {
    empty: { count: 0, rows: [] },
    fill: (s) => ({ count: arr(s.rows).length, rows: arr(s.rows).map((r) => ({ id: str(r.id), name: str(r.name), status: str(r.status), cwd: str(r.cwd) })) }),
  });
  const inFlight = section('inFlight', raw?.inFlight, {
    empty: { count: 0, rows: [] },
    fill: (s) => ({ count: arr(s.rows).length, rows: arr(s.rows).map((r) => ({ runId: str(r.runId), item: str(r.item), handle: r.handle ?? null, startedAt: r.startedAt ?? null, lastSeenLiveAt: r.lastSeenLiveAt ?? null })), ...(s.unreadable ? { unreadable: s.unreadable } : {}) }),
  });
  const lanes = section('lanes', raw?.lanes, {
    empty: { total: null, acquirable: null, byRepo: [] },
    fill: (s) => ({ total: Number(s.total) || 0, acquirable: Number(s.acquirable) || 0, byRepo: arr(s.byRepo).map((r) => ({ repo: str(r.repo), total: r.total ?? null, acquirable: r.acquirable ?? null, ...(r.error ? { error: str(r.error) } : {}) })) }),
  });
  const caveats = arr(raw?.prerequisites).filter((p) => p && p.status !== 'resolved').map((p) => ({
    card: str(p.card),
    status: str(p.status) || 'unknown',
    says: p.card === '3725' ? 'lane counts (`lanes`) may be wrong: the free-lane predicate is not yet shared between `list --acquirable` and `acquire`'
      : p.card === '3721' ? 'finished-but-alive sessions are not yet reaped, so `sessions` and `inFlight` may include sessions that are done'
        : 'a prerequisite of a trustworthy `live` is not resolved',
    ...(p.status === 'unknown' ? { reason: str(p.reason) } : {}),
  }));
  return { live: { sessions, inFlight, lanes, caveats }, gaps };
}

/**
 * `runner`: up, down or paused. PURE. `up` needs a present, unexpired lease whose pid is alive; anything else with a
 * readable lease file is `down`. A pause marker overrides `up` to `paused`.
 * @param {{available?: boolean, reason?: string, lease?: object, paused?: (boolean|null), pausedKinds?: (string[]|null)}} raw
 */
export function shapeRunner(raw) {
  if (!raw || raw.available === false) return { runner: { state: 'unknown', paused: null }, gap: unavailable('runner', raw?.reason ?? 'the runner lease was not read') };
  const lease = raw.lease ?? {};
  const alive = lease.present === true && lease.expired !== true && lease.pidAlive === true;
  const paused = raw.paused === true;
  const state = paused ? 'paused' : alive ? 'up' : 'down';
  return {
    runner: {
      state,
      paused: raw.paused ?? null,
      ...(paused && Array.isArray(raw.pausedKinds) ? { pausedKinds: raw.pausedKinds } : {}),
      lease: { present: lease.present === true, pid: lease.pid ?? null, heartbeatAt: lease.heartbeatAt ?? null, expired: lease.expired === true, pidAlive: lease.pidAlive ?? null },
    },
    gap: null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
// The digest.

/**
 * SHAPE ONE `readFacts()` result. PURE — every field defensively coalesced, and the one thing it refuses is a result
 * with no clock (a digest with no `generatedAt` cannot be aged by the hook that reads it).
 * @param {object} raw
 */
export function shapeDigestFacts(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  if (!str(r.now)) throw new Error('turn-digest.read: the reader returned no `now` — a digest with no generatedAt cannot be aged');
  return r;
}

/**
 * BUILD THE DIGEST from the reader's facts. PURE: the same facts always yield the same digest.
 * @param {object} facts a {@link shapeDigestFacts} result
 * @returns {object}
 */
export function buildDigest(facts) {
  const gaps = [];
  const l = facts.landed ?? {};
  let landed = [];
  let landedTruncated = false;
  if (l.available === false) gaps.push(unavailable('landed', l.reason ?? 'the git history was not read'));
  else {
    const r = landedFrom(parseCommitLog(l.log ?? ''), { limit: l.cursor?.value ? null : Number.isInteger(l.limit) ? l.limit : DEFAULT_LANDED_LIMIT });
    landed = r.landed;
    landedTruncated = r.truncated;
  }

  const needs = shapeNeedsOperator(facts.needs);
  const owed = shapeOwed(facts.owed);
  const stale = shapeStaleLabels(facts.prs);
  const live = shapeLive(facts.live);
  const runner = shapeRunner(facts.runner);
  if (needs.gap) gaps.push(needs.gap);
  gaps.push(...owed.gaps, ...stale.gaps, ...live.gaps);
  if (runner.gap) gaps.push(runner.gap);

  const cursor = {
    consumer: facts.consumer || null,
    since: l.cursor?.value ?? null,
    source: l.cursor?.source ?? 'none',
    tip: l.tip ?? null,
    fetched: l.fetch ?? null,
    advanceRequested: facts.advance === true,
    // What `--advance` would store. Present only when the caller asked to advance AND named a consumer AND a tip exists;
    // the command line's finish hook is what writes it, never the run.
    advanceTo: facts.advance === true && facts.consumer && l.tip ? l.tip : null,
  };

  return {
    version: DIGEST_VERSION,
    generatedAt: facts.now,
    complete: gaps.length === 0,
    unavailable: gaps,
    repos: arr(facts.repos),
    cursor,
    landed,
    ...(landedTruncated ? { landedTruncated: true } : {}),
    needsOperator: needs.items,
    owed: owed.items,
    ...(owed.notes.length ? { owedNotes: owed.notes } : {}),
    staleLabels: stale.items,
    ...(stale.undetermined ? { staleLabelsUndetermined: stale.undetermined } : {}),
    live: live.live,
    runner: runner.runner,
  };
}

/**
 * THE PLAIN-TEXT RENDER for the command line. PURE: same digest, same lines. `--json` prints the digest itself.
 * @param {object} d a {@link buildDigest} result
 * @returns {string[]}
 */
export function formatDigest(d) {
  const out = [];
  const c = d.cursor;
  out.push(`turn-digest @ ${d.generatedAt}${d.complete ? '' : `  [INCOMPLETE — ${d.unavailable.length} gap(s)]`}`);
  out.push(`landed: ${d.landed.length}${d.landedTruncated ? '+ (truncated)' : ''} since ${c.since ? short(c.since) : 'the last few'} (cursor from ${c.source}${c.consumer ? `, consumer ${c.consumer}` : ''}); main tip ${c.tip ? short(c.tip) : '?'}`);
  for (const m of d.landed) out.push(`  #${m.pr}  ${short(m.sha)}${m.mergedAt ? `  ${m.mergedAt}` : ''}`);
  out.push(`needs you: ${d.needsOperator.length}`);
  for (const n of d.needsOperator) out.push(`  ${n.line}`);
  const dispatch = d.owed.filter((o) => o.type === 'dispatch').length;
  out.push(`owed: ${dispatch} dispatch, ${d.owed.length - dispatch} refusal(s)`);
  for (const o of d.owed) out.push(`  ${o.type === 'dispatch' ? '→' : '✗'} ${o.kind} ${o.repo}#${o.pr ?? '?'} — ${o.why}`);
  out.push(`stale labels: ${d.staleLabels.length}`);
  for (const s of d.staleLabels) out.push(`  ${s.repo}#${s.pr} ${s.kind} — ${s.why}`);
  const lv = d.live;
  out.push(`live: ${lv.sessions.available ? `${lv.sessions.count} session(s)` : 'sessions ?'}, ${lv.inFlight.available ? `${lv.inFlight.count} in-flight` : 'in-flight ?'}, ${lv.lanes.available ? `${lv.lanes.acquirable}/${lv.lanes.total} lane(s) acquirable` : 'lanes ?'}`);
  for (const cv of lv.caveats) out.push(`  caveat #${cv.card} (${cv.status}): ${cv.says}`);
  out.push(`runner: ${d.runner.state}`);
  for (const g of d.unavailable) out.push(`  UNAVAILABLE ${g.field}: ${g.reason}`);
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
// The declaration.

/**
 * BUILD THE DECLARATION. `readFacts` is the injected reader; `./turn-digest-io.mjs` supplies the real one and tests
 * supply a stub. Built per call so nothing leaks between registries.
 * @param {{readFacts: (o: object) => object}} deps
 */
export function turnDigestOperation({ readFacts } = {}) {
  if (typeof readFacts !== 'function') {
    throw new TypeError(
      'turn-digest: needs a `readFacts(input)` reader — the io is INJECTED so the declaration stays testable without git, '
      + '`gh` or a session listing; the real binding is `we:scripts/operations/turn-digest-io.mjs`.',
    );
  }

  return op(TURN_DIGEST_OP, {
    input: {
      // A commit sha on `origin/main`. Empty: use the consumer's stored cursor, or (none stored) the last N merges.
      since: { type: 'string', required: false, default: '' },
      // Whose cursor. Empty: no stored cursor is read or advanced.
      consumer: { type: 'string', required: false, default: '' },
      // Comma-separated `gh` repo slugs for the PR-derived sections. Empty: the whole constellation.
      repos: { type: 'string', required: false, default: '' },
      // How many merges a first call returns.
      limit: { type: 'number', required: false, default: DEFAULT_LANDED_LIMIT },
      // Move the consumer's stored cursor to the main tip after this read. Off by default: an ordinary digest never
      // costs a sibling its "since".
      advance: { type: 'boolean', required: false, default: false },
      // Fetch `origin/main` first (a remote-tracking ref update, the one thing here that touches `.git`). Off by
      // default; without it `landed` is as fresh as the last fetch.
      fetch: { type: 'boolean', required: false, default: false },
    },
    verdictFrom: 'assess',

    read: compute({
      reads: ['input.since', 'input.consumer', 'input.repos', 'input.limit', 'input.advance', 'input.fetch'],
      fn: (view) => shapeDigestFacts(readFacts({
        since: view.input.since,
        consumer: view.input.consumer,
        repos: view.input.repos,
        limit: view.input.limit,
        advance: view.input.advance,
        fetch: view.input.fetch,
      })),
    }),

    assess: compute({
      reads: ['findings.read'],
      fn: (view) => buildDigest(view.findings.read),
    }),
  });
}
