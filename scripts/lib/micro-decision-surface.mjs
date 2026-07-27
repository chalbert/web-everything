/**
 * micro-decision-surface.mjs — the SURFACING half of #2650 (micro-decision surfacing + challenge loop, last
 * piece of the autonomous jury layer, ratified record 273a2dbd; child of #2577).
 *
 * WHY: #2652's disposition judge (`disposition-judge.mjs`) classifies a review's jury ledger as `auto-dispose`
 * (auto-clear, no human) or `escalate` (needs a human). A prepared DECISION is a SET of forks, each carrying its
 * own jury ledger. Running the judge PER FORK yields a per-fork contention map: some forks auto-clear, some are
 * CONTESTED (escalate). The human should only ever be handed the CONTESTED forks — one micro-choice at a time —
 * not the whole decision. This module is that reduction: it CONSUMES the judge's per-fork disposition (it does
 * NOT re-derive contention) and emits the ordered micro-decision QUEUE the console surface (plateau-app:src/)
 * walks one fork at a time.
 *
 * SPLIT OF OWNERSHIP (the item's cross-locus seam):
 *   • THIS module (we:scripts/) owns WHICH forks are contested, in what ORDER, and WHY (the judge's reason +
 *     trail). It is pure: no I/O, no side effects, deterministic — the same per-fork ledgers always yield the
 *     same queue. It is the contract shape the UI mirrors (like `decision-forks.ts` mirrors the WE projection).
 *   • The plateau-app console owns the PRESENTATION — surfacing the contested forks one at a time, and the three
 *     challenge-loop affordances (challenge the disposition · ask a question · open for full discussion). It
 *     consumes the DTO this module produces; it never re-runs the judge.
 *
 * A CONTESTED fork is exactly one whose combined disposition is `escalate` (green proposed escalate, OR green
 * proposed auto-dispose and the red judge refuted it). An auto-cleared fork is one whose disposition survives to
 * `auto-dispose`. Fail-closed is inherited from the judge: any fork the judge cannot prove safe (unreadable
 * ledger, missing mandatory lens, gate-self, dissent) surfaces as CONTESTED — surfacing MORE, never fewer, so a
 * doubtful fork always reaches the human.
 *
 * PURE-CORE / IO-SHELL SPLIT (#2665): the classification + queue build (`classifyForkContention`,
 * `buildMicroDecisionQueue`) and the record schema (`microDecisionSubjectKey`, `validateMicroDecisionRecord`,
 * `foldMicroDecisionRecords`) are PURE — deterministic, no fs / clock — unit-tested in
 * `we:scripts/lib/__tests__/micro-decision-surface.test.mjs`. The fs is confined to the thin
 * read/append wrappers + `buildSurfaceFromDisk` + the `main()` CLI (gated on direct invocation). #2665 wires this
 * builder to the plateau-app read port (`GET /api/backlog/micro-decisions`, which SHELLS `surface`) and adds the
 * DURABLE per-fork challenge / ask-a-question record (the `record` verb) the console half was capturing
 * client-side only. A missing / malformed ledger or record NEVER throws on read — it degrades fail-closed
 * (an unreadable ledger surfaces the fork CONTESTED; a bad record line is skipped).
 */
import { appendFileSync, readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { disposeVerdict, DISPOSITIONS } from './disposition-judge.mjs';
import { resolveDispositionConfig } from './review-policy.mjs';
import { MANDATORY_LENSES } from './jury-core.mjs';
import { subjectSlug, readJuryLog } from './jury-ledger.mjs';

/**
 * @typedef {Object} ForkInput
 * @property {number} n - the fork number (`## Fork N`), used for identity + default ordering.
 * @property {string} [question] - the fork's question heading (carried through for the surface to render).
 * @property {string} [recommendedDefault] - the fork's recommended-default line, carried through for context.
 * @property {Array<object>} [ledger] - this fork's jury-ledger events (the #2654 append-only stream).
 * @property {{lensWeights: object, dissentThreshold: number, resolutionMode: string}} [config] - a RESOLVED
 *   #2651 disposition config for this fork. When absent, the module resolves the global default once.
 * @property {{gateSelf?: boolean, humanRequired?: boolean, nonConvergence?: boolean}} [signals] - the judge's
 *   hard-escalate signals for this fork.
 * @property {string[]} [mandatoryLenses] - override the mandatory-lens set (defaults to correctness+security).
 */

/**
 * @typedef {Object} MicroDecisionForkDTO
 * @property {number} n - the fork number.
 * @property {string} question - the fork's question (or `Fork N` when the input carried none).
 * @property {boolean} contested - true when the fork's disposition is `escalate` (it needs a human).
 * @property {'auto-dispose'|'escalate'} disposition - the judge's combined disposition for this fork.
 * @property {string} reason - the judge's machine reason token (e.g. `dissent-present`, `red-refuted`, `gate-self`).
 * @property {string[]} trail - the judge's human-readable disposition trail (WHY this fork landed where it did).
 * @property {string} [recommendedDefault] - carried through when the fork input had one.
 */

/**
 * Classify ONE fork's contention by running the #2652 combined disposition judge over its ledger + config.
 * PURE. CONSUMES the judge — it does not re-derive contention. A fork with no explicit `config` uses the
 * resolved global default. Never throws: a malformed ledger is handled fail-closed by the judge (→ escalate →
 * contested), so a doubtful fork always surfaces to the human rather than silently auto-clearing.
 * @param {ForkInput} fork
 * @param {{lensWeights: object, dissentThreshold: number, resolutionMode: string}} [defaultConfig] - a pre-resolved
 *   default so a batch does not re-resolve the config per fork (an internal optimisation; callers may omit it).
 * @returns {MicroDecisionForkDTO}
 */
export function classifyForkContention(fork, defaultConfig) {
  const n = Number.isInteger(fork?.n) ? fork.n : 0;
  const question = fork?.question && String(fork.question).trim() ? String(fork.question).trim() : `Fork ${n}`;
  // A per-fork config must be a real object for the judge (a truthy non-object would make `disposeVerdict` throw,
  // breaking the never-throws contract). Fall back to the shared default / a freshly-resolved one otherwise.
  const forkConfig = fork?.config && typeof fork.config === 'object' ? fork.config : undefined;
  const config = forkConfig ?? defaultConfig ?? resolveDispositionConfig();
  const verdict = disposeVerdict({
    ledger: Array.isArray(fork?.ledger) ? fork.ledger : [],
    config,
    signals: fork?.signals ?? {},
    mandatoryLenses: Array.isArray(fork?.mandatoryLenses) && fork.mandatoryLenses.length ? fork.mandatoryLenses : MANDATORY_LENSES,
  });
  const contested = verdict.disposition === DISPOSITIONS.ESCALATE;
  return {
    n,
    question,
    contested,
    disposition: verdict.disposition,
    reason: verdict.reason,
    trail: Array.isArray(verdict.trail) ? [...verdict.trail] : [],
    ...(fork?.recommendedDefault && String(fork.recommendedDefault).trim()
      ? { recommendedDefault: String(fork.recommendedDefault).trim() }
      : {}),
  };
}

/**
 * @typedef {Object} MicroDecisionSurfaceDTO
 * @property {string} repo - the repo slug the decision was read from (the configurable seam; mirrors #2580).
 * @property {string} decisionId - the decision item's filename stem (route key).
 * @property {string} [decisionNum] - the leading `NNN`/`xNNNNNN` token, when present.
 * @property {string} decisionTitle - the decision's title.
 * @property {MicroDecisionForkDTO[]} contested - the ordered micro-decision QUEUE: the contested forks the human
 *   walks one at a time. Ordered by fork `n` ascending (file order) so the surface is stable across re-reads.
 * @property {MicroDecisionForkDTO[]} autoCleared - the forks the judge auto-cleared (never surfaced as a choice,
 *   kept so the surface can honestly say "N of M forks auto-cleared").
 * @property {number} forkCount - total forks classified.
 * @property {number} contestedCount - `contested.length` (the number of micro-choices the human faces).
 * @property {number} autoClearedCount - `autoCleared.length`.
 */

/**
 * Build the micro-decision surface DTO for ONE decision from its per-fork jury ledgers (#2650). PURE — the
 * contract seam between the WE surfacing half and the plateau-app console half. Runs the #2652 judge per fork
 * (via {@link classifyForkContention}), partitions the forks into CONTESTED (escalate → the surfaced queue) and
 * AUTO-CLEARED (auto-dispose → never surfaced), and orders the contested queue by fork `n` ascending so the
 * "one micro-choice at a time" walk is stable. The config is resolved ONCE up front and shared by every fork
 * that carries no per-fork override (cheap + deterministic). Never throws: a decision with no forks yields an
 * honest empty queue (`contested: []`), never a surfaced blank.
 * @param {{ repo?: string, id?: string, decisionId?: string, num?: string, decisionNum?: string, title?: string,
 *   decisionTitle?: string, forks?: ForkInput[] }} decision
 * @returns {MicroDecisionSurfaceDTO}
 */
export function buildMicroDecisionQueue(decision) {
  const repo = decision?.repo && String(decision.repo).trim() ? String(decision.repo).trim() : 'webeverything';
  const decisionId = String(decision?.decisionId ?? decision?.id ?? '');
  const decisionNum = decision?.decisionNum ?? decision?.num;
  const decisionTitle = String(decision?.decisionTitle ?? decision?.title ?? '');
  const forks = Array.isArray(decision?.forks) ? decision.forks : [];

  // Resolve the global default config once — every fork without its own override shares it (deterministic + cheap).
  const defaultConfig = resolveDispositionConfig();
  const classified = forks.map((fork) => classifyForkContention(fork, defaultConfig));

  const byN = (a, b) => a.n - b.n;
  const contested = classified.filter((f) => f.contested).sort(byN);
  const autoCleared = classified.filter((f) => !f.contested).sort(byN);

  return {
    repo,
    decisionId,
    ...(decisionNum !== undefined && decisionNum !== null && String(decisionNum) !== '' ? { decisionNum: String(decisionNum) } : {}),
    decisionTitle,
    contested,
    autoCleared,
    forkCount: classified.length,
    contestedCount: contested.length,
    autoClearedCount: autoCleared.length,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PER-FORK SUBJECT KEY (#2665) — the ONE canonical identity for a decision fork across BOTH halves: the jury
// ledger the read port folds AND the durable challenge/question record. The subject IS the fork (one durable
// stream per fork), mirroring jury-ledger's "a log IS the subject". PURE + reversible: `#`-joined, no internal
// spaces/dashes, so `subjectSlug` (which collapses whitespace/dashes) leaves it intact.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The canonical durable subject key for ONE fork of ONE decision. Both the per-fork jury ledger (read port) and
 * the per-fork challenge/question record key off THIS, so the two halves never drift. PURE.
 * @param {string} repo - the repo slug the decision was read from.
 * @param {string|number} decisionKey - the decision's `num` (preferred) or filename stem.
 * @param {number} forkN - the fork number (`## Fork N`).
 * @returns {string} e.g. `webeverything#2665#fork3`
 */
export function microDecisionSubjectKey(repo, decisionKey, forkN) {
  const r = String(repo ?? '').trim() || 'webeverything';
  const d = String(decisionKey ?? '').trim() || 'decision';
  const n = Number.isInteger(forkN) ? forkN : Number.parseInt(String(forkN), 10) || 0;
  return `${r}#${d}#fork${n}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// DURABLE CHALLENGE / QUESTION RECORD (#2665) — the write path the console half was missing. An append-only
// per-fork JSONL under `.conveyor/micro-decisions/` (gitignored operational state, mirroring jury-ledger's
// `.conveyor/jury/` sidecar). Each record is one human action on a fork: CHALLENGE the disposition · ASK a
// question · WITHDRAW (reopen to pending). The fold is latest-wins, so a reload restores the human's in-flight
// challenge/question rather than losing it (the client-only limitation #2650 documented).
// ─────────────────────────────────────────────────────────────────────────────

/** The three durable per-fork record kinds. `open` (open-for-full-discussion) is NOT here — that durable
 *  escalation is the #2577 ruling-surface reopen (a real navigation), not a record on this stream. */
export const MICRO_RECORD_KINDS = Object.freeze({ CHALLENGE: 'challenge', QUESTION: 'question', WITHDRAW: 'withdraw' });
const MICRO_RECORD_KIND_SET = new Set(Object.values(MICRO_RECORD_KINDS));
/** A challenge/question text is capped so one record can't bloat the durable log (mirrors the jury finding cap). */
const MICRO_RECORD_TEXT_MAX = 2000;

/**
 * The directory holding the per-fork micro-decision records: `<root>/.conveyor/micro-decisions` (gitignored).
 * `CONVEYOR_MICRO_DIR` overrides it (tests point it at a temp dir), matching jury-ledger's `CONVEYOR_JURY_DIR`.
 * @param {string} root
 * @returns {string}
 */
export function microDecisionRecordDir(root) {
  const env = process.env.CONVEYOR_MICRO_DIR;
  return env && env.trim() ? env : join(String(root ?? '.'), '.conveyor', 'micro-decisions');
}

/** The durable record path for one fork subject: `<microDecisionRecordDir>/<slug(subjectKey)>.jsonl`. */
export function microDecisionRecordPath(subjectKey, root) {
  return join(microDecisionRecordDir(root), `${subjectSlug(subjectKey)}.jsonl`);
}

/**
 * Validate + normalize a raw challenge/question/withdraw record. PURE + never-throws contract: returns
 * `{ ok, record, errors }`. A `challenge`/`question` MUST carry non-empty text (≤ cap); a `withdraw` carries
 * none. `forkN` must be a finite integer. Unknown kinds / over-length text / bad forkN are REJECTED (never
 * persisted) so the durable stream stays well-formed.
 * @param {*} raw
 * @returns {{ ok: boolean, record: object|null, errors: string[] }}
 */
export function validateMicroDecisionRecord(raw) {
  const errors = [];
  if (!raw || typeof raw !== 'object') return { ok: false, record: null, errors: ['record must be an object'] };
  const kind = String(raw.kind ?? '');
  if (!MICRO_RECORD_KIND_SET.has(kind)) errors.push(`unknown kind "${kind}" (one of ${[...MICRO_RECORD_KIND_SET].join(', ')})`);
  const forkN = Number.isInteger(raw.forkN) ? raw.forkN : Number.parseInt(String(raw.forkN), 10);
  if (!Number.isInteger(forkN)) errors.push('forkN must be an integer');
  let text = '';
  if (kind === MICRO_RECORD_KINDS.CHALLENGE || kind === MICRO_RECORD_KINDS.QUESTION) {
    text = String(raw.text ?? '').trim();
    if (!text) errors.push(`a ${kind} record needs non-empty text`);
    else if (text.length > MICRO_RECORD_TEXT_MAX) errors.push(`text exceeds ${MICRO_RECORD_TEXT_MAX} chars`);
  }
  if (errors.length) return { ok: false, record: null, errors };
  const record = { kind, forkN, ...(text ? { text } : {}) };
  if (raw.at != null) record.at = String(raw.at);
  return { ok: true, record, errors: [] };
}

/**
 * Parse a durable record log's TEXT into a normalized record array. PURE + tolerant: a blank / unparseable /
 * invalid line is SKIPPED (never throws), append-only order preserved. Mirrors `parseJuryLog`.
 * @param {string} text
 * @returns {object[]}
 */
export function parseMicroDecisionLog(text) {
  const out = [];
  for (const line of String(text ?? '').split('\n')) {
    const t = line.trim();
    if (!t) continue;
    let parsed;
    try { parsed = JSON.parse(t); } catch { continue; }
    const { ok, record } = validateMicroDecisionRecord(parsed);
    if (ok) out.push(record);
  }
  return out;
}

/**
 * Fold a fork's append-only record stream to its CURRENT durable interaction (latest-wins). PURE. A `withdraw`
 * clears back to pending; the latest `challenge`/`question` sets the status + carries its text. Returns
 * `{ status, challenge, question }` where status is `pending` | `challenged` | `asked`. Text of the non-active
 * kind is kept too (so switching challenge↔question and back restores prior text), but only the LATEST action
 * drives `status`.
 * @param {object[]} records
 * @returns {{ status: 'pending'|'challenged'|'asked', challenge?: string, question?: string }}
 */
export function foldMicroDecisionRecords(records) {
  const list = Array.isArray(records) ? records : [];
  let status = 'pending';
  let challenge;
  let question;
  for (const r of list) {
    if (!r || typeof r !== 'object') continue;
    if (r.kind === MICRO_RECORD_KINDS.WITHDRAW) { status = 'pending'; continue; }
    if (r.kind === MICRO_RECORD_KINDS.CHALLENGE) { status = 'challenged'; challenge = r.text; continue; }
    if (r.kind === MICRO_RECORD_KINDS.QUESTION) { status = 'asked'; question = r.text; continue; }
  }
  return {
    status,
    ...(challenge ? { challenge } : {}),
    ...(question ? { question } : {}),
  };
}

/**
 * Read + fold ONE fork subject's durable record. Missing file → the pending default (never throws). IO shell.
 * @param {string} subjectKey
 * @param {{ root?: string }} [o]
 * @returns {{ status: 'pending'|'challenged'|'asked', challenge?: string, question?: string }}
 */
export function readMicroDecisionRecord(subjectKey, { root } = {}) {
  let text;
  try { text = readFileSync(microDecisionRecordPath(subjectKey, root), 'utf8'); } catch { return { status: 'pending' }; }
  return foldMicroDecisionRecords(parseMicroDecisionLog(text));
}

/**
 * Append ONE validated record to a fork subject's durable log, creating `.conveyor/micro-decisions/` as needed.
 * VALIDATES first (a rejected record is NOT written) and stamps `at` when absent. IO shell — returns
 * `{ ok, record, errors }`.
 * @param {string} subjectKey
 * @param {*} raw
 * @param {{ now?: Date, root?: string }} [o]
 * @returns {{ ok: boolean, record: object|null, errors: string[] }}
 */
export function appendMicroDecisionRecord(subjectKey, raw, { now = new Date(), root } = {}) {
  const stamped = raw && typeof raw === 'object' && raw.at == null ? { ...raw, at: now.toISOString() } : raw;
  const { ok, record, errors } = validateMicroDecisionRecord(stamped);
  if (!ok) return { ok: false, record: null, errors };
  const path = microDecisionRecordPath(subjectKey, root);
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${JSON.stringify(record)}\n`);
  return { ok: true, record, errors: [] };
}

// ─────────────────────────────────────────────────────────────────────────────
// THE READ MODEL (#2665) — from a decision + its projected forks (the plateau read port supplies the fork
// n/question/recommendedDefault via its markdown projection), read each fork's per-fork jury ledger + durable
// record from disk, run the pure builder, and merge the durable challenge/question onto each fork DTO. IO shell.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the micro-decision surface DTO for one decision by reading each fork's per-fork jury ledger + durable
 * record from disk under `root`. The CALLER (the plateau read port) supplies the fork identities it parsed from
 * the decision markdown (`forks: [{ n, question, recommendedDefault }]`); THIS reads the durable state the WE
 * side owns (the jury ledger + the challenge/question record) and folds it in. Never throws: an unreadable
 * ledger surfaces its fork CONTESTED (fail-closed, inherited from the judge), a missing record is pending.
 * @param {{ root?: string, repo?: string, decisionKey?: string|number, decisionId?: string, decisionNum?: string,
 *   decisionTitle?: string, forks?: Array<{ n: number, question?: string, recommendedDefault?: string,
 *   signals?: object, config?: object }> }} input
 * @returns {import('./micro-decision-surface.mjs').MicroDecisionSurfaceDTO}
 */
export function buildSurfaceFromDisk(input) {
  const root = input?.root;
  const repo = input?.repo && String(input.repo).trim() ? String(input.repo).trim() : 'webeverything';
  const decisionKey = input?.decisionKey ?? input?.decisionNum ?? input?.decisionId ?? 'decision';
  const forks = Array.isArray(input?.forks) ? input.forks : [];

  const forkInputs = forks.map((f) => {
    const n = Number.isInteger(f?.n) ? f.n : Number.parseInt(String(f?.n), 10) || 0;
    const subject = microDecisionSubjectKey(repo, decisionKey, n);
    return {
      n,
      ...(f?.question ? { question: f.question } : {}),
      ...(f?.recommendedDefault ? { recommendedDefault: f.recommendedDefault } : {}),
      ...(f?.signals ? { signals: f.signals } : {}),
      ...(f?.config ? { config: f.config } : {}),
      ledger: readJuryLog(subject, { root }),
    };
  });

  const dto = buildMicroDecisionQueue({
    repo,
    decisionId: input?.decisionId,
    decisionNum: input?.decisionNum,
    decisionTitle: input?.decisionTitle,
    forks: forkInputs,
  });

  // Merge the durable challenge/question record onto each surfaced + auto-cleared fork (latest-wins fold).
  const withRecord = (fork) => {
    const rec = readMicroDecisionRecord(microDecisionSubjectKey(repo, decisionKey, fork.n), { root });
    const active = rec.status && rec.status !== 'pending';
    // Attach the recorded text ONLY for the ACTIVE status. A withdrawn (pending) fork ships no `recorded*` — the
    // fold keeps prior text for a client switch-back, but the DTO must not resurrect a withdrawn challenge.
    return {
      ...fork,
      ...(active ? { recordStatus: rec.status } : {}),
      ...(active && rec.status === 'challenged' && rec.challenge ? { recordedChallenge: rec.challenge } : {}),
      ...(active && rec.status === 'asked' && rec.question ? { recordedQuestion: rec.question } : {}),
    };
  };
  return {
    ...dto,
    contested: dto.contested.map(withRecord),
    autoCleared: dto.autoCleared.map(withRecord),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// IO SHELL — the CLI. `surface` (read the DTO for one decision, shelled by the plateau read port) · `record`
// (durably append one challenge/question/withdraw). Gated on direct invocation so importing the pure functions
// never runs it. Untrusted text (a challenge/question body) arrives via --file/stdin, NEVER a shell arg.
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

  if (sub === 'surface') {
    let payload;
    try { payload = readInput(flags); } catch (e) {
      process.stdout.write(`${JSON.stringify({ ok: false, error: `could not read payload — ${String(e.message || e).split('\n')[0]}` })}\n`);
      process.exit(2);
    }
    const dto = buildSurfaceFromDisk({ root: flags.root, ...(payload || {}) });
    process.stdout.write(`${JSON.stringify(dto)}\n`);
    process.exit(0);
  }

  if (sub === 'record') {
    // Durably append one challenge/question/withdraw to a fork subject. The subject is computed HERE from
    // --repo/--decision/--fork so no consumer duplicates `microDecisionSubjectKey`. The text body (untrusted)
    // arrives via --file/stdin, never argv.
    let body;
    try { body = readInput(flags); } catch (e) {
      process.stdout.write(`${JSON.stringify({ ok: false, error: `could not read record — ${String(e.message || e).split('\n')[0]}` })}\n`);
      process.exit(2);
    }
    const forkN = Number.parseInt(String(flags.fork ?? body?.forkN), 10);
    const subject = microDecisionSubjectKey(flags.repo ?? body?.repo, flags.decision ?? body?.decision ?? body?.decisionKey, forkN);
    const { ok, record, errors } = appendMicroDecisionRecord(subject, { kind: flags.kind ?? body?.kind, forkN, text: body?.text }, { root: flags.root });
    process.stdout.write(`${JSON.stringify(ok ? { ok: true, subject, record } : { ok: false, error: errors.join('; ') })}\n`);
    process.exit(ok ? 0 : 1);
  }

  process.stderr.write('usage: micro-decision-surface <surface --root=<checkout> [--file=<payload.json>] | record --root=<checkout> --repo=<slug> --decision=<key> --fork=<n> --kind=<challenge|question|withdraw> [--file=<body.json>]>\n');
  process.exit(2);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main(process.argv.slice(2));
}
