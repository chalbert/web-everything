/**
 * @file scripts/conveyor/run-scorecard-store.mjs
 * @description THE SCORECARD STORE (`#3649` Fork 2) — one append-only row per scored dispatch. Shape copies
 *   `we:scripts/check-app-conformance.mjs`'s burndown precedent (append-only, a derived percentage alongside
 *   the raw record) WITHOUT its `denom ? … : 100` fallback, which the card's own skeptic amendment flags as
 *   backwards: that fires when NOTHING was measured, meaning "no information", not "a perfect subject" — this
 *   store never writes `100` for an unmeasured run; it writes `null` (`we:scripts/conveyor/
 *   run-quality-scorer.mjs#scoreRecords` already enforces this at the scoring layer, and this module trusts,
 *   never overrides, the score it is handed).
 *
 * KEYED GENERICALLY BY `{provider, model}`, PER THE OPERATOR'S EXPLICIT RULING (2026-09-13): the whole point
 * of a "probation" status is that it applies to ANY provider/model, not just Codex, and a scorecard must
 * never let a future model quietly inherit an older model's accumulated data. So every row carries its own
 * `provider`/`model` (never just a bare `model` string the way the card's own Fork 2 illustration first
 * sketched it — widened here on purpose) and {@link meanScore} REQUIRES both, alongside `rubricVersion`,
 * before it will average anything — a query that omits either cannot silently blend two different models'
 * history.
 *
 * FORK 3 (never re-normalised): `rubricVersion` is stamped once, at write time, and this store NEVER rewrites
 * a historical row's score when the rubric changes later. `meanScore`'s `rubricVersion` filter is REQUIRED —
 * there is no query that mixes versions.
 *
 * FORK 5 (subject-class gate, stamped never inferred): `subjectClass` travels on every row so a later reader
 * can tell why nothing was ever auto-applied for a `driver`-class row, and so {@link meanScore} never mixes a
 * driver run into a work-agent aggregate (or vice versa) — the aggregate filter defaults to `work-agent` for
 * exactly this reason, callers must opt in to see `driver` rows.
 *
 * PROBATION IS STAMPED TOO, same discipline as the subject-class gate: `probationStatus` records what
 * `we:scripts/lib/model-probation.mjs` said about this `{provider, model, role}` AT THE TIME the run was
 * scored — never re-queried live later, so a model's later promotion to `trusted` does not retroactively
 * relabel history it was actually produced under.
 *
 * SCRUB IS ENFORCED HERE TOO, defence in depth alongside the scorer's own scrub (`#automated-session-
 * introspection` clause 3 / `#3477` clause 5): `appendScorecard` REFUSES (throws) rather than writes a row
 * whose `deductions[].evidence` still fails `scrubReasons` — "denying on a hit rather than redacting" is a
 * hard requirement on the build, per the card's own Fork 2 amendment, not a nicety either layer could skip.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { scrubReasons } from '../lib/secret-scrub.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** The store file this module reads and writes. An append-only JSON array — matches `poc-branches.json` /
 *  `model-probation.json`'s existing small-registry IO shape rather than introducing a THIRD file format
 *  (JSONL) for what is, at this run-quality volume, still a modest read-modify-write file. Re-derive as
 *  JSONL if/when volume makes read-modify-write the bottleneck — a v1 concern deliberately deferred. */
export const SCORECARD_STORE_PATH = join(__dirname, 'run-scorecards.json');

const isNonEmptyString = (v) => typeof v === 'string' && v.trim() !== '';

/**
 * Validate one scorecard row before it is appended. Never throws on its own — returns `{ok, errors}`; the
 * caller (`appendScorecard`) decides whether to refuse the write.
 * @param {object} row
 */
export function validateScorecard(row) {
  const errors = [];
  if (!row || typeof row !== 'object') return { ok: false, errors: ['row is not an object'] };
  if (!isNonEmptyString(row.rubricVersion)) errors.push('`rubricVersion` is required — Fork 3: every row is stamped');
  if (!isNonEmptyString(row.provider)) errors.push('`provider` is required — identity is ALWAYS provider+model, never a bare model string');
  if (!isNonEmptyString(row.model)) errors.push('`model` is required');
  if (row.subjectClass !== 'work-agent' && row.subjectClass !== 'driver') errors.push('`subjectClass` must be "work-agent" or "driver" — Fork 5');
  if (!isNonEmptyString(row.dispatchKind)) errors.push('`dispatchKind` is required (e.g. "fix", "advisory-review")');
  if (typeof row.criteriaEvaluated !== 'number' || row.criteriaEvaluated < 0) errors.push('`criteriaEvaluated` must be a non-negative number');
  if (row.criteriaEvaluated === 0 && row.score !== null) errors.push('`score` MUST be null when `criteriaEvaluated` is 0 — never 100 on an empty read (Fork 2 amendment)');
  if (row.score !== null && (typeof row.score !== 'number' || row.score < 0 || row.score > 100)) errors.push('`score` must be null or a number in [0, 100]');
  if (!Array.isArray(row.deductions)) errors.push('`deductions` must be an array (possibly empty)');
  else {
    for (const d of row.deductions) {
      if (isNonEmptyString(d?.evidence) && scrubReasons(d.evidence).length > 0) {
        errors.push(`deduction ${JSON.stringify(d.criterion)}'s evidence failed the append-time scrub — denying, per Fork 2's amendment, never redacting`);
      }
    }
  }
  return { ok: errors.length === 0, errors };
}

/**
 * Read the store off disk. Never throws — an unreadable/malformed file degrades to an empty store, so a
 * caller always gets a usable (if empty) history rather than a crash mid-scoring-pass.
 */
export function readStore({ path = SCORECARD_STORE_PATH, read = (p) => readFileSync(p, 'utf8'), exists = existsSync } = {}) {
  try {
    if (!exists(path)) return { version: 1, records: [] };
    const parsed = JSON.parse(read(path));
    return { version: parsed?.version ?? 1, records: Array.isArray(parsed?.records) ? parsed.records : [] };
  } catch {
    return { version: 1, records: [] };
  }
}

/** Write the store back to disk, pretty-printed. */
export function writeStore(store, { path = SCORECARD_STORE_PATH, write = (p, s) => writeFileSync(p, s) } = {}) {
  write(path, `${JSON.stringify({ version: store.version ?? 1, records: store.records ?? [] }, null, 2)}\n`);
}

/**
 * Append ONE scorecard row. REFUSES (throws) on an invalid row — a scorecard is a durable historical fact,
 * so a caller must fix the row rather than have it silently coerced or dropped.
 * @param {object} row - everything `validateScorecard` requires, plus whatever else Fork 2's shape names
 *   (`item`, `handle`, `effort`, `outcome`, `probationStatus`, `scoredAt`, …).
 * @param {object} [io] - `readStore`/`writeStore`'s own injectable IO, threaded through for tests.
 * @returns {object} the stored row (with `scoredAt` filled in if the caller omitted it).
 */
export function appendScorecard(row, io = {}) {
  const stamped = { v: 1, outcome: null, scoredAt: new Date().toISOString(), ...row };
  const verdict = validateScorecard(stamped);
  if (!verdict.ok) {
    throw new Error(`run-scorecard-store: refusing to append an invalid scorecard:\n  - ${verdict.errors.join('\n  - ')}`);
  }
  const store = readStore(io);
  store.records.push(stamped);
  writeStore(store, io);
  return stamped;
}

/**
 * FORK 2's aggregator — a 0-100 scalar published ONLY as an aggregate over a declared comparability class,
 * NEVER as a per-run headline. `rubricVersion`, `provider` and `model` are ALL REQUIRED (generalised past
 * the card's own `model × effort × dispatch-kind` sketch, which under-specified `model` as a bare string —
 * see the file header): there is no query that averages across rubric versions, and there is no query that
 * blends two different `{provider, model}` identities into one number either, so a future model's data can
 * never silently dilute or inherit an older model's trend. `effort`/`dispatchKind` narrow further when given.
 * Rows with `score: null` (nothing measured) are EXCLUDED from the average, not treated as 0 or 100.
 *
 * @param {{rubricVersion:string, provider:string, model:string, effort?:string, dispatchKind?:string, subjectClass?:string}} filter
 * @param {object} [io]
 * @returns {{mean: number|null, n: number}} `mean` is `null` when no matching row has a non-null score.
 */
export function meanScore(filter, io = {}) {
  const { rubricVersion, provider, model, effort, dispatchKind, subjectClass = 'work-agent' } = filter ?? {};
  if (!isNonEmptyString(rubricVersion)) throw new TypeError('run-scorecard-store: meanScore requires `rubricVersion` — no cross-version average may be expressed (Fork 3)');
  if (!isNonEmptyString(provider)) throw new TypeError('run-scorecard-store: meanScore requires `provider` — no cross-provider average may be expressed');
  if (!isNonEmptyString(model)) throw new TypeError('run-scorecard-store: meanScore requires `model` — no cross-model average may be expressed (a future model upgrade must never dilute this one\'s trend)');

  const { records } = readStore(io);
  const matches = records.filter((r) => (
    r.rubricVersion === rubricVersion
    && r.provider === provider
    && r.model === model
    && r.subjectClass === subjectClass
    && (effort === undefined || r.effort === effort)
    && (dispatchKind === undefined || r.dispatchKind === dispatchKind)
    && typeof r.score === 'number'
  ));
  if (!matches.length) return { mean: null, n: 0 };
  return { mean: matches.reduce((sum, r) => sum + r.score, 0) / matches.length, n: matches.length };
}
