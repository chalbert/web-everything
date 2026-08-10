#!/usr/bin/env node
/**
 * jury-ledger.mjs — the DURABLE jury event LOG + the ONE SHARED FOLD (#2641, F4 = logbook slice of epic #2636).
 *
 * WHY (the #2641 ruling): the jury (`jury-core.mjs`) must be OBSERVABLE — an operator should see what the jury
 * IS (its roster + each juror's charter), what it is DOING (pending / running / found), and what it has FOUND
 * (its findings + current verdict + the round). #2654 already established the PURE event VOCABULARY + validator
 * (`JURY_EVENT_TYPES`, `validateJuryEvent`, `JUROR_STATUSES` in jury-core.mjs). This module adds the two pieces
 * #2654 deliberately left to #2641:
 *
 *   1. THE DURABLE ON-DISK LOG — an APPEND-ONLY JSONL event stream, ONE file per review SUBJECT (a PR, a design,
 *      a decision — the jury is subject-agnostic). Each `append` VALIDATES through the shared `validateJuryEvent`
 *      BEFORE it writes (a malformed event is rejected, never persisted) and stamps the envelope `at` timestamp.
 *      The log is the SINGLE SOURCE OF TRUTH (#2612): never a parallel state store — the tree the conveyor renders
 *      and the #2642 console renders are BOTH reconstructions of THIS log.
 *
 *   2. THE SHARED FOLD — `foldJuryLedger(events)`: the ONE reconstruction of the current ledger (the roster with
 *      each juror's derived status / verdict / findings, plus the round) from the append-only stream. Written ONCE,
 *      here in the WE core; the conveyor tick (`scripts/conveyor/jury-tree.mjs`) and the plateau-app #2642 console
 *      BOTH call it. A SECOND copy of the fold logic in either consumer is a bug (#2641 guardrail).
 *
 * DISTINCT FROM `disposition-judge.reduceLedger`: that is a LOSSY, disposition-specific PROJECTION of the same log
 * (jurorId→lens + strictest per-lens verdict + outstanding findings) that answers ONE question — "may this
 * auto-dispose?". This fold answers a DIFFERENT question — "what does the jury LOOK like right now?" — so it keeps
 * what the disposition projection discards: each juror's charter, method, derived lifecycle STATUS, and its own
 * findings. Two views over one immutable log (the #2612 single source), not two logs.
 *
 * REUSE, NEVER RE-DERIVE (#2500): the log carries the `verdict` events whose per-juror → per-lens reduction is the
 * SAME widened `lensVerdicts` shape #2500 added to the review ledger — this module does NOT stand up a second,
 * parallel ledger; it is the durable successor to #2500's persist path, reusing #2500's shape.
 *
 * PURE-CORE / IO-SHELL SPLIT: the FOLD + the event BUILDERS + the log SERIALIZATION are pure (deterministic, no
 * fs / Date / clock — unit-tested in `__tests__/jury-ledger.test.mjs`). The fs is confined to the thin
 * append/read wrappers and the `main()` CLI (gated on direct invocation). A missing / malformed log NEVER throws
 * on read — a bad line is skipped (mirroring `validateJuryEvent`'s never-throw contract), so the fold degrades to
 * whatever it can reconstruct rather than crashing the tick.
 */

import { appendFileSync, readFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import {
  VERDICTS,
  JURY_EVENT_TYPES,
  JUROR_STATUSES,
  validateJuryEvent,
  normalizeJuryEvent,
  // #2823 round-2 finding 1 — the strictness accessor is SINGLE-SOURCED in jury-core. This fold's per-lens/panel
  // diversity-selection imports it rather than keeping a hand-copied `VERDICT_STRICTNESS` twin (whose doc claimed to
  // "mirror disposition-judge" but silently went stale when `prevention-outstanding` was added — the round-2 miss).
  // With no local copy, this fold cannot drift from disposition-judge's reduction again.
  verdictStrictness,
} from './jury-core.mjs';
import { writeAllSync } from './write-all-sync.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
/** The repo root (this file lives at `<root>/scripts/lib/`). The default log dir hangs off it (never CWD). */
const REPO_ROOT = resolve(HERE, '..', '..');

// ─────────────────────────────────────────────────────────────────────────────
// DURABLE-LOG LOCATION (mirrors the queue-store.mjs `.conveyor/` sidecar convention — gitignored operational state)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The directory holding the per-subject jury logs: `<root>/.conveyor/jury` (gitignored). Anchored to the SCRIPT
 * location (never CWD) so every writer and reader agree, exactly like `queue-store.mjs`. `CONVEYOR_JURY_DIR`
 * overrides it (tests point it at a temp dir).
 * @param {string} [root]
 * @returns {string}
 */
export function juryLogDir(root = REPO_ROOT) {
  const env = process.env.CONVEYOR_JURY_DIR;
  return env && env.trim() ? env : join(root, '.conveyor', 'jury');
}

/**
 * Sanitize a subject key into a filesystem-safe log basename. The jury subject is a stable label like `we#123`
 * (a PR) — `#` is a legal filename char, so only path separators / whitespace / control chars are replaced, which
 * keeps the mapping REVERSIBLE (the basename is the display key). An empty/garbage key collapses to `subject`.
 * @param {string} subjectKey
 * @returns {string}
 */
export function subjectSlug(subjectKey) {
  const s = String(subjectKey ?? '').trim().replace(/[/\\\s\x00-\x1f]+/g, '-').replace(/^-+|-+$/g, '');
  return s || 'subject';
}

/**
 * The durable log path for one review subject: `<juryLogDir>/<slug(subjectKey)>.jsonl`. One file per subject so
 * the append-only stream is a SINGLE jury run (the #2654 event schema carries no subject field — a log IS the
 * subject). Mirrors #2500's `repo#pr` keying of the persisted review ledger.
 * @param {string} subjectKey
 * @param {string} [root]
 * @returns {string}
 */
export function juryLogPath(subjectKey, root = REPO_ROOT) {
  return join(juryLogDir(root), `${subjectSlug(subjectKey)}.jsonl`);
}

// ─────────────────────────────────────────────────────────────────────────────
// PURE EVENT BUILDERS — construct the four non-roster append-only events (roster-picked has its own richer builder,
// `rosterPickedEvent`, in jury-core.mjs). Each returns a SCHEMA-VALID raw event, or throws on a bad shape (a
// programming error, caught by tests) — the persisted stream is validated again at append time regardless.
// ─────────────────────────────────────────────────────────────────────────────

function assertValid(raw, where) {
  const { valid, errors, event } = validateJuryEvent(raw);
  if (!valid) throw new Error(`${where}: built an invalid jury event — ${errors.join('; ')}`);
  return event;
}

/** The `juror-running` event — a rostered juror started reviewing. */
export function jurorRunningEvent({ jurorId, round = 0, at } = {}) {
  const raw = { type: JURY_EVENT_TYPES.JUROR_RUNNING, jurorId, round };
  if (at != null) raw.at = at;
  return assertValid(raw, 'jurorRunningEvent');
}

/** The `finding` event — a juror reported one finding (canonical `Finding` shape, normalized by the validator). */
export function findingEvent({ jurorId, finding, round = 0, at } = {}) {
  const raw = { type: JURY_EVENT_TYPES.FINDING, jurorId, finding, round };
  if (at != null) raw.at = at;
  return assertValid(raw, 'findingEvent');
}

/** The `verdict` event — a juror's current verdict (accept | changes | needs-human). */
export function verdictEvent({ jurorId, verdict, round = 0, at } = {}) {
  const raw = { type: JURY_EVENT_TYPES.VERDICT, jurorId, verdict, round };
  if (at != null) raw.at = at;
  return assertValid(raw, 'verdictEvent');
}

/** The `round-advanced` event — the negotiation loop advanced to a NEW round (≥1). */
export function roundAdvancedEvent({ round, at } = {}) {
  const raw = { type: JURY_EVENT_TYPES.ROUND_ADVANCED, round };
  if (at != null) raw.at = at;
  return assertValid(raw, 'roundAdvancedEvent');
}

// ─────────────────────────────────────────────────────────────────────────────
// THE REVIEW-PIPELINE EVENT PROJECTION — turn one PR's converged review state into ledger events. This is the ONE
// place that logic lives (importable + unit-tested), so the `review-parked-prs` Workflow SANDBOX — which cannot
// import or run fs/Node APIs in its body (a top-level `return` makes it un-importable) — does NOT hand-build events
// in an untestable prompt: its recorder agent shells `jury-ledger record`, which calls THIS.
// ─────────────────────────────────────────────────────────────────────────────

/** The juror CHARTER per PR-review panel lens — what each lens juror is asked to look for, recorded in the roster
 *  so the observable tree shows each juror's expectation. Mirrors the `review-core-cli mandate --lens` framing. */
export const REVIEW_LENS_CHARTER = Object.freeze({
  correctness: 'find logic errors, broken behaviour, and unhandled cases in the diff',
  security: 'find injection, auth, secret-handling, and unsafe I/O flaws in the diff',
  simplicity: 'flag needless complexity and simpler equivalents (advisory)',
  'standards-conformance': 'flag deviations from repo standards the deterministic gate does not catch (advisory)',
});

/** The PR-review panel lenses, in order — the default roster when a caller passes no explicit `activeLenses`. */
export const REVIEW_PANEL_LENSES = Object.freeze(['correctness', 'security', 'simplicity', 'standards-conformance']);

const VERDICT_STRINGS = new Set(Object.values(VERDICTS));

/**
 * Build the append-only JURY-LEDGER events for ONE converged PR review (#2641). PURE + unit-tested. Represents
 * each panel LENS as one ledger juror (`<lens>#1`): the review loop already reduced its jurors-per-lens diversity
 * to a single per-lens verdict, so the ledger is faithful at lens granularity. Emits, in order: roster-picked
 * (round 0) · round-advanced for each round the loop advanced past the first (ledger rounds are 0-based, the
 * loop's are 1-based) · per-lens juror-running + verdict at the final round · one finding event per flattened
 * finding, attributed to its lens's juror via the finding's `category` (the reduce step tags each finding with
 * its lens). A lens with no VALID verdict (a failed / "unknown" lens) is rostered + marked running but casts no
 * verdict event — a reviewer that did not run never reads as a verdict.
 * @param {{ activeLenses?: string[], lensVerdicts?: object, findings?: object[], rounds?: number }} [state]
 * @returns {object[]} schema-valid raw jury-ledger events
 */
export function buildReviewLedgerEvents({ activeLenses, lensVerdicts = {}, findings = [], rounds = 1, reviewedSha } = {}) {
  const lenses = Array.isArray(activeLenses) && activeLenses.length ? [...new Set(activeLenses)] : [...REVIEW_PANEL_LENSES];
  const jid = (lens) => `${lens}#1`;
  const finalRound = Math.max(0, (Number.isFinite(rounds) ? Math.floor(rounds) : 1) - 1);

  const events = [{
    type: JURY_EVENT_TYPES.ROSTER_PICKED,
    round: 0,
    jurors: lenses.map((lens) => ({ id: jid(lens), lens, charter: REVIEW_LENS_CHARTER[lens] || `judge the "${lens}" lens` })),
    // #2864 — the reviewed head sha. THIS is the writer the review pipeline actually uses (the `record` CLI and
    // review-parked-prs.mjs both come through here), so without it the field is write-dead: every ledger the repo
    // produces folds to `reviewedSha: null`, and a `null` from a CURRENT writer is indistinguishable from a `null`
    // on a legacy pre-field event. A freshness gate could then only fail closed on 100% of PRs. Omitted when the
    // caller has no sha (a design or decision subject has no commit) — the field stays optional in the schema.
    ...(reviewedSha != null ? { reviewedSha } : {}),
  }];
  for (let r = 1; r <= finalRound; r += 1) events.push(roundAdvancedEvent({ round: r }));
  for (const lens of lenses) {
    events.push(jurorRunningEvent({ jurorId: jid(lens), round: finalRound }));
    const v = lensVerdicts && lensVerdicts[lens];
    if (VERDICT_STRINGS.has(v)) events.push(verdictEvent({ jurorId: jid(lens), verdict: v, round: finalRound }));
  }
  for (const f of Array.isArray(findings) ? findings : []) {
    const lens = f && typeof f.category === 'string' ? f.category : '';
    if (!lens || !lenses.includes(lens) || !f || !String(f.summary || '').trim()) continue;
    events.push(findingEvent({ jurorId: jid(lens), round: finalRound, finding: f }));
  }
  return events;
}

// ─────────────────────────────────────────────────────────────────────────────
// LOG SERIALIZATION (pure) + fs APPEND / READ (thin shells)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Serialize one raw event to a single JSONL line, VALIDATING + normalizing it first and stamping the envelope
 * `at` when absent (so every persisted event is timestamped without the pure schema depending on a clock). PURE:
 * the timestamp is INJECTED (`nowIso`), never read from the wall clock here — the append shell passes the real
 * `new Date().toISOString()`. Returns `{ ok, line, event, errors }`; `ok:false` (with `errors`) means the event
 * was rejected and NOTHING should be written (a malformed event never reaches the durable log).
 * @param {*} rawEvent
 * @param {{ nowIso?: string }} [o]
 * @returns {{ ok: boolean, line: string|null, event: object|null, errors: string[] }}
 */
export function serializeJuryEvent(rawEvent, { nowIso } = {}) {
  const stamped = (rawEvent && typeof rawEvent === 'object' && rawEvent.at == null && nowIso)
    ? { ...rawEvent, at: nowIso }
    : rawEvent;
  const { valid, errors, event } = validateJuryEvent(stamped);
  if (!valid) return { ok: false, line: null, event: null, errors };
  return { ok: true, line: JSON.stringify(event), event, errors: [] };
}

/**
 * Parse the durable log TEXT into a normalized event array. PURE + tolerant: a blank / unparseable / schema-invalid
 * line is SKIPPED (never throws), so a partially-written or hand-edited log still folds to whatever is valid. The
 * append-only order is preserved.
 * @param {string} text
 * @returns {object[]}
 */
export function parseJuryLog(text) {
  const out = [];
  for (const line of String(text ?? '').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let parsed;
    try { parsed = JSON.parse(trimmed); } catch { continue; }
    const ev = normalizeJuryEvent(parsed);
    if (ev) out.push(ev);
  }
  return out;
}

/**
 * Append ONE event to a subject's durable log, creating `.conveyor/jury/` as needed. VALIDATES first (a rejected
 * event is NOT written) and stamps `at`. The append is atomic per line (a single `appendFileSync` of one
 * newline-terminated JSON line). Returns `{ ok, event, errors }`.
 * @param {string} subjectKey
 * @param {*} rawEvent
 * @param {{ now?: Date, root?: string }} [o]
 * @returns {{ ok: boolean, event: object|null, errors: string[] }}
 */
export function appendJuryEvent(subjectKey, rawEvent, { now = new Date(), root = REPO_ROOT } = {}) {
  const { ok, line, event, errors } = serializeJuryEvent(rawEvent, { nowIso: now.toISOString() });
  if (!ok) return { ok: false, event: null, errors };
  const path = juryLogPath(subjectKey, root);
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${line}\n`);
  return { ok: true, event, errors: [] };
}

/**
 * Append MANY events to a subject's log in order, each validated independently (an invalid one is skipped and
 * recorded in `rejected`, never aborting the batch — a durable log must not lose good events to one bad neighbor).
 * @param {string} subjectKey
 * @param {Array<*>} rawEvents
 * @param {{ now?: Date, root?: string }} [o]
 * @returns {{ appended: number, rejected: Array<{ index: number, errors: string[] }> }}
 */
export function appendJuryEvents(subjectKey, rawEvents, { now = new Date(), root = REPO_ROOT } = {}) {
  const list = Array.isArray(rawEvents) ? rawEvents : [];
  let appended = 0;
  const rejected = [];
  list.forEach((raw, index) => {
    const r = appendJuryEvent(subjectKey, raw, { now, root });
    if (r.ok) appended += 1;
    else rejected.push({ index, errors: r.errors });
  });
  return { appended, rejected };
}

/**
 * Read + normalize a subject's durable log. Missing file → `[]` (a subject with no jury run yet). Never throws.
 * @param {string} subjectKey
 * @param {{ root?: string }} [o]
 * @returns {object[]}
 */
export function readJuryLog(subjectKey, { root = REPO_ROOT } = {}) {
  const path = juryLogPath(subjectKey, root);
  let text;
  try { text = readFileSync(path, 'utf8'); } catch { return []; }
  return parseJuryLog(text);
}

/**
 * List the review subjects that have a durable jury log (one `.jsonl` file each under `.conveyor/jury/`). Missing
 * dir → `[]`. Each entry's `subject` is the file basename (the reversible display key from `juryLogPath`).
 * @param {{ root?: string }} [o]
 * @returns {Array<{ subject: string, path: string }>}
 */
export function listJurySubjects({ root = REPO_ROOT } = {}) {
  const dir = juryLogDir(root);
  if (!existsSync(dir)) return [];
  let names;
  try { names = readdirSync(dir); } catch { return []; }
  return names
    .filter((n) => n.endsWith('.jsonl'))
    .map((n) => ({ subject: n.slice(0, -'.jsonl'.length), path: join(dir, n) }))
    .sort((a, b) => a.subject.localeCompare(b.subject));
}

// ─────────────────────────────────────────────────────────────────────────────
// THE SHARED FOLD — reconstruct the current ledger from the append-only stream. PURE. The ONE fold both consumers
// (the conveyor tree + the #2642 console) call; neither re-implements it.
// ─────────────────────────────────────────────────────────────────────────────

/** Reduce a set of verdicts to the strictest present (diversity-selection, #2567 — the STRICTEST juror verdict
 *  carries a lens/panel, never a vote), or null when none is present. Ranks via the single-sourced
 *  `verdictStrictness` (jury-core), so this fold and disposition-judge's reduction can never diverge. */
function strictestVerdict(verdicts) {
  let worst = null;
  for (const v of verdicts) {
    if (v == null) continue;
    if (worst == null || verdictStrictness(v) > verdictStrictness(worst)) worst = v;
  }
  return worst;
}

/**
 * @typedef {Object} FoldedJuror
 * @property {string} id - stable juror id (the roster key later events reference).
 * @property {string} lens - the lens/dimension this juror judges under.
 * @property {string} charter - the juror's charter / expectation (what it was asked to look for).
 * @property {string} [method] - the grounding method label, when the roster carried one.
 * @property {'pending'|'running'|'found'} status - the DERIVED lifecycle status (JUROR_STATUSES).
 * @property {'accept'|'changes'|'needs-human'|null} verdict - the juror's LATEST verdict, or null if none yet.
 * @property {number} verdictRound - the round of that latest verdict (-1 when none).
 * @property {import('./jury-core.mjs').Finding[]} findings - the juror's findings (latest report per finding).
 */

/**
 * @typedef {Object} FoldedLedger
 * @property {boolean} rosterKnown - a `roster-picked` event named the roster.
 * @property {number} round - the CURRENT round (the highest any event referenced; 0 before any advance).
 * @property {FoldedJuror[]} jurors - the roster, in roster order, each with its derived status / verdict / findings.
 * @property {Object<string,string>} lensVerdicts - lens → the STRICTEST verdict among its jurors (#2500 shape).
 * @property {'accept'|'changes'|'needs-human'|null} panelVerdict - the strictest verdict across ALL jurors, or null.
 * @property {{ pending: number, running: number, found: number }} counts - juror count by derived status.
 * @property {number} findingCount - total findings across the roster.
 * @property {string|null} reviewedSha - #2864: the head sha the LATEST roster was seated over, or null when the
 *   stream predates the field / the subject has no commit. A consumer that acts on a verdict MUST compare this
 *   with the subject's observed head — a fold is a statement about the tree the jurors saw, not about the tree
 *   the caller is holding.
 */

/**
 * THE FOLD (#2641) — replay the append-only jury event stream into the current ledger. PURE + total (a malformed
 * event is skipped via `normalizeJuryEvent`; an empty/foreign stream folds to an empty ledger, never a throw).
 *
 * Derivation rules (all append-only, latest-wins):
 *   • ROSTER — the LATEST `roster-picked` names the jurors (id, lens, charter, method). A juror-referencing event
 *     whose id the roster never named is IGNORED (fail-closed — we cannot attribute it).
 *   • STATUS (JUROR_STATUSES) — `pending` once rostered; `running` after its `juror-running`; `found` once it has
 *     emitted a `finding` OR a `verdict`. Monotonic: a later event only ever ADVANCES a juror's status.
 *   • VERDICT — a juror's verdict is the one from the HIGHEST round it voted in (a later round supersedes).
 *   • FINDINGS — keyed by (juror, anchor, summary); a re-report in a later round supersedes the earlier record
 *     (the append-only stream's way of updating a finding), mirroring `disposition-judge.reduceLedger`.
 *   • LENS / PANEL verdict — diversity-selection (strictest wins), the #2567 reduction; `lensVerdicts` is the same
 *     widened per-lens shape #2500 added, reconstructed from the durable log.
 * @param {Array<object>} events - the raw (or normalized) append-only jury events.
 * @returns {FoldedLedger}
 */
export function foldJuryLedger(events) {
  const stream = (Array.isArray(events) ? events : []).map(normalizeJuryEvent).filter(Boolean);

  /** @type {Map<string, FoldedJuror>} roster order preserved by insertion. */
  const jurors = new Map();
  /** jurorId → Map(findingKey → { round, finding }) so a later round supersedes an earlier report. */
  const findingsByJuror = new Map();
  let rosterKnown = false;
  let round = 0;
  let reviewedSha = null;

  const ensureFindingMap = (id) => {
    let m = findingsByJuror.get(id);
    if (!m) { m = new Map(); findingsByJuror.set(id, m); }
    return m;
  };
  // Status only ever advances (pending → running → found); never regress on a late/out-of-order event.
  const advance = (juror, to) => {
    const order = { [JUROR_STATUSES.PENDING]: 0, [JUROR_STATUSES.RUNNING]: 1, [JUROR_STATUSES.FOUND]: 2 };
    if (order[to] > order[juror.status]) juror.status = to;
  };

  for (const ev of stream) {
    if (Number.isInteger(ev.round) && ev.round > round) round = ev.round;
    switch (ev.type) {
      case JURY_EVENT_TYPES.ROSTER_PICKED: {
        rosterKnown = true;
        // #2864 — the latest roster is authoritative about WHICH TREE the jury was seated over, exactly as it is
        // about who sits on it. `null` when the stream predates the field or the subject has no commit (a design
        // or decision subject) — the consumer decides what an unknown sha means; the fold only reports it.
        reviewedSha = ev.reviewedSha != null ? String(ev.reviewedSha) : null;
        // The latest roster is authoritative. Re-seat, preserving any status/verdict/findings already derived for a
        // juror the new roster still names (a re-pick — e.g. a #2640 grown jury — keeps prior jurors' progress).
        const kept = new Map(jurors);
        jurors.clear();
        for (const spec of ev.jurors) {
          const prior = kept.get(spec.id);
          jurors.set(spec.id, prior || {
            id: spec.id, lens: spec.lens, charter: spec.charter,
            ...(spec.method ? { method: spec.method } : {}),
            status: JUROR_STATUSES.PENDING, verdict: null, verdictRound: -1, findings: [],
          });
        }
        break;
      }
      case JURY_EVENT_TYPES.JUROR_RUNNING: {
        const juror = jurors.get(ev.jurorId);
        if (juror) advance(juror, JUROR_STATUSES.RUNNING);
        break;
      }
      case JURY_EVENT_TYPES.FINDING: {
        const juror = jurors.get(ev.jurorId);
        if (!juror) break;
        advance(juror, JUROR_STATUSES.FOUND);
        const f = ev.finding;
        const key = JSON.stringify([f.file ?? '', f.line ?? '', f.summary]);
        const m = ensureFindingMap(ev.jurorId);
        const prev = m.get(key);
        if (!prev || ev.round >= prev.round) m.set(key, { round: ev.round, finding: f });
        break;
      }
      case JURY_EVENT_TYPES.VERDICT: {
        const juror = jurors.get(ev.jurorId);
        if (!juror) break;
        advance(juror, JUROR_STATUSES.FOUND);
        if (ev.round >= juror.verdictRound) { juror.verdict = ev.verdict; juror.verdictRound = ev.round; }
        break;
      }
      case JURY_EVENT_TYPES.ROUND_ADVANCED:
        // `round` already tracked above from the event's round field.
        break;
      default:
        break;
    }
  }

  // Attach each juror's latest findings (roster order), and roll up per-lens + panel verdicts by diversity-selection.
  const jurorList = [...jurors.values()].map((j) => {
    const m = findingsByJuror.get(j.id);
    const findings = m ? [...m.values()].map((x) => x.finding) : [];
    return { ...j, findings };
  });

  const lensVerdicts = {};
  for (const j of jurorList) {
    if (j.verdict == null) continue;
    const cur = lensVerdicts[j.lens];
    if (cur === undefined || verdictStrictness(j.verdict) > verdictStrictness(cur)) lensVerdicts[j.lens] = j.verdict;
  }
  const panelVerdict = strictestVerdict(jurorList.map((j) => j.verdict));

  const counts = { pending: 0, running: 0, found: 0 };
  let findingCount = 0;
  for (const j of jurorList) { counts[j.status] += 1; findingCount += j.findings.length; }

  return { rosterKnown, round, jurors: jurorList, lensVerdicts, panelVerdict, counts, findingCount, reviewedSha };
}

/**
 * Convenience: read one subject's durable log and fold it. `{ subject, ledger }`. The single call the conveyor
 * tree and the console use to go from a subject key to its live ledger.
 * @param {string} subjectKey
 * @param {{ root?: string }} [o]
 * @returns {{ subject: string, ledger: FoldedLedger }}
 */
export function foldSubject(subjectKey, { root = REPO_ROOT } = {}) {
  return { subject: subjectKey, ledger: foldJuryLedger(readJuryLog(subjectKey, { root })) };
}

/**
 * Fold EVERY subject that has a durable log — the whole live jury picture the conveyor renders. `[{ subject,
 * ledger }]`, subject-sorted. Empty when no jury has ever run.
 * @param {{ root?: string }} [o]
 * @returns {Array<{ subject: string, ledger: FoldedLedger }>}
 */
export function foldAllSubjects({ root = REPO_ROOT } = {}) {
  return listJurySubjects({ root }).map(({ subject }) => foldSubject(subject, { root }));
}

// ─────────────────────────────────────────────────────────────────────────────
// IO SHELL — the CLI. `append` (persist raw events any jury run hands it) · `record` (build a PR review's events
// from its converged state, then append — the review-parked-prs sandbox seam) · `show` (fold + print). Gated on
// direct invocation so importing the pure fold/builders never runs it.
// ─────────────────────────────────────────────────────────────────────────────

function parseFlags(argv) {
  const flags = {};
  for (const a of argv) {
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq === -1) flags[a.slice(2)] = true;
    else flags[a.slice(2, eq)] = a.slice(eq + 1);
  }
  return flags;
}

function readInput(flags) {
  if (typeof flags.file === 'string') return JSON.parse(readFileSync(flags.file, 'utf8'));
  const stdin = readFileSync(0, 'utf8');
  return stdin.trim() ? JSON.parse(stdin) : null;
}

function main(argv) {
  const sub = argv[0];
  const flags = parseFlags(argv.slice(1));

  if (sub === 'append') {
    if (typeof flags.subject !== 'string' || !flags.subject.trim()) {
      process.stderr.write('jury-ledger append: --subject=<key> is required\n');
      process.exit(2);
    }
    let input;
    try { input = readInput(flags); } catch (e) {
      process.stderr.write(`jury-ledger append: could not read events — ${String(e.message || e).split('\n')[0]}\n`);
      process.exit(2);
    }
    const raw = Array.isArray(input) ? input : (input && Array.isArray(input.events) ? input.events : (input ? [input] : []));
    const { appended, rejected } = appendJuryEvents(flags.subject, raw);
    writeAllSync(1, `${JSON.stringify({ subject: flags.subject, appended, rejected })}\n`);
    // A rejected event is a caller bug (a malformed event), surfaced non-zero so a CI/agent notices — but the
    // good events in the batch were still persisted (append-only never loses a valid event to a bad neighbor).
    process.exit(rejected.length ? 1 : 0);
  }

  if (sub === 'record') {
    // The review-pipeline seam (#2641): read one PR's converged state ({ activeLenses, lensVerdicts, findings,
    // rounds }), BUILD its ledger events here (the ONE tested place that logic lives), and append them. The
    // `review-parked-prs` sandbox recorder agent shells THIS, so no event-construction happens in an untestable
    // prompt. The state may embed untrusted PR-finding text — it arrives via --file/stdin, never a shell arg.
    if (typeof flags.subject !== 'string' || !flags.subject.trim()) {
      process.stderr.write('jury-ledger record: --subject=<key> is required\n');
      process.exit(2);
    }
    let state;
    try { state = readInput(flags); } catch (e) {
      process.stderr.write(`jury-ledger record: could not read state — ${String(e.message || e).split('\n')[0]}\n`);
      process.exit(2);
    }
    const events = buildReviewLedgerEvents(state || {});
    const { appended, rejected } = appendJuryEvents(flags.subject, events);
    writeAllSync(1, `${JSON.stringify({ subject: flags.subject, appended, rejected })}\n`);
    process.exit(rejected.length ? 1 : 0);
  }

  if (sub === 'show' || sub === 'fold') {
    const out = typeof flags.subject === 'string' && flags.subject.trim()
      ? foldSubject(flags.subject)
      : foldAllSubjects();
    writeAllSync(1, `${JSON.stringify(out, null, flags.json ? 0 : 2)}\n`);
    process.exit(0);
  }

  process.stderr.write('usage: jury-ledger <append --subject=<key> [--file=<events.json>] | record --subject=<key> [--file=<state.json>] | show [--subject=<key>] [--json]>\n');
  process.exit(2);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main(process.argv.slice(2));
}
