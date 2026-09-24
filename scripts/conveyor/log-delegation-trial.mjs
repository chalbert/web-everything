/**
 * Record one interactive session-delegation trial (#3690) in the shared scorecard store.
 * Invalid input throws before IO; a failed store write returns null, like run-quality-record.mjs.
 * These trials are unscored observations: criteriaEvaluated is 0 and score is null.
 */
import { pathToFileURL } from 'node:url';
import { appendScorecard } from './run-scorecard-store.mjs';
import { scrubPublish } from '../lib/secret-scrub.mjs';

const isNonEmptyString = (value) => typeof value === 'string' && value.trim() !== '';
export const TASK_TYPES = Object.freeze(['bugfix', 'conflict-resolution', 'doc-fix', 'self-fix', 'other']);
const enums = {
  taskType: TASK_TYPES,
  outcome: ['landed', 'rejected', 'reworked'],
  verifiedBy: ['claude-subagent', 'independent-claude', 'other'],
};

/** @returns {object|null} The stored row, or null when the store write fails. */
export function logDelegationTrial(row, io = {}) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    throw new Error('log-delegation-trial: row must be an object');
  }
  for (const field of ['provider', 'model', 'taskDescription']) {
    if (!isNonEmptyString(row[field])) {
      throw new Error(`log-delegation-trial: ${field} must be a non-empty string`);
    }
  }
  for (const [field, values] of Object.entries(enums)) {
    if (!values.includes(row[field])) {
      throw new Error(`log-delegation-trial: ${field} must be one of: ${values.join(', ')}`);
    }
  }
  if (row.findings !== undefined && row.findings !== null && !isNonEmptyString(row.findings)) {
    throw new Error('log-delegation-trial: findings must be a non-empty string or null');
  }
  // `rootCause` is its own recorded field, distinct from `findings` (platform-decisions.md
  // #delegation-trial-record-graduation, rule 5; #3889): a diagnosis of WHY a confirmed miss happened,
  // required before any post-miss trial counts toward restoration. Neither field is derived from the
  // other — a root-cause note left in `findings` instead of this field does not count (enforced in
  // provider-routing.mjs, which reads only this field).
  if (row.rootCause !== undefined && row.rootCause !== null && !isNonEmptyString(row.rootCause)) {
    throw new Error('log-delegation-trial: rootCause must be a non-empty string or null');
  }
  // `comparisonId` links exactly two rows as ONE concurrent-baseline trial pair (#3690 Fork 2; #3783): the
  // same task dispatched to Claude AND to a delegated provider, so the router can read the pair together
  // instead of two unrelated trials that happen to share an `item`/`pr`. Stamped by the caller
  // (`concurrent-baseline-comparison.mjs`), never derived here — this module stays a thin per-row validator,
  // same discipline as `informative`/`rootCause` above. A row with no comparison partner leaves this null.
  if (row.comparisonId !== undefined && row.comparisonId !== null && !isNonEmptyString(row.comparisonId)) {
    throw new Error('log-delegation-trial: comparisonId must be a non-empty string or null');
  }
  // Free-text fields must pass a secret scrub before landing in this COMMITTED, append-only store — a
  // live independent review of this file (PR #2267, round 1) confirmed a secret-shaped `findings` value
  // reached the store unfiltered before this check existed. `scrubPublish`, not the wider `scrubReasons`
  // the store already applies to `deductions[].evidence`, is the right scrub HERE: round 2 of that same
  // review caught `scrubReasons`'s "source file path/name" rule flagging ordinary task descriptions that
  // simply name a script (e.g. "Self-fix codex-direct-task.mjs's own ENOBUFS failure"), which broke
  // `backfill-2026-09-14-delegation-trials.mjs` outright (6 of its 9 real descriptions mention a `.mjs`
  // file). `scrubPublish` is this repo's deliberately NARROWER, corpus-calibrated scrub for content that
  // is committed to the repo (the same one `we:scripts/check-standards.mjs`'s 6f-i sweep runs over
  // backlog/agent-memory-src) — it still denies a real secret (verified: an `AKIA…` value is still
  // caught) without false-positiving on a bare filename mention. `provider`/`model` are scrubbed too
  // (round 2's second, non-blocking finding: they were free-text with no scrub at all) — denying, never
  // redacting, matches run-scorecard-store.mjs's own "deny on a hit" discipline.
  for (const field of ['provider', 'model', 'taskDescription', 'findings', 'rootCause', 'comparisonId']) {
    const value = row[field];
    if (isNonEmptyString(value) && scrubPublish(value).length > 0) {
      throw new Error(`log-delegation-trial: ${field} failed the secret scrub — denying, never redacting`);
    }
  }
  for (const field of ['item', 'pr']) {
    if (row[field] !== undefined && row[field] !== null
      && (!Number.isInteger(row[field]) || row[field] <= 0)) {
      throw new Error(`log-delegation-trial: ${field} must be a positive integer or null`);
    }
  }
  if (row.retroactive !== undefined && typeof row.retroactive !== 'boolean') {
    throw new Error('log-delegation-trial: retroactive must be a boolean');
  }
  // `informative` is a recorded fact, never inferred (platform-decisions.md#delegation-trial-record-graduation,
  // rule 4; #3888): a row that omits it is written with an explicit `false` below, never left absent, so no
  // reader of the store has to guess. A non-boolean value is refused by name rather than silently coerced.
  if (row.informative !== undefined && typeof row.informative !== 'boolean') {
    throw new Error('log-delegation-trial: informative must be a boolean');
  }

  try {
    return appendScorecard({
      provider: row.provider,
      model: row.model,
      subjectClass: 'work-agent',
      dispatchKind: 'session-delegation',
      rubricVersion: 'session-delegation.1',
      criteriaEvaluated: 0,
      score: null,
      deductions: [],
      item: row.item ?? null,
      pr: row.pr ?? null,
      handle: null,
      taskDescription: row.taskDescription,
      taskType: row.taskType,
      outcome: row.outcome,
      verifiedBy: row.verifiedBy,
      findings: row.findings ?? null,
      retroactive: row.retroactive ?? false,
      informative: row.informative ?? false,
      rootCause: row.rootCause ?? null,
      comparisonId: row.comparisonId ?? null,
      ...(row.scoredAt ? { scoredAt: row.scoredAt } : {}),
    }, io);
  } catch {
    // All required scorecard fields are valid above; recording must not break a completed trial.
    return null;
  }
}

const usage = `Usage: node scripts/conveyor/log-delegation-trial.mjs
  --provider=NAME --model=NAME --task=TEXT
  --task-type=bugfix|conflict-resolution|doc-fix|self-fix|other
  --outcome=landed|rejected|reworked
  --verified-by=claude-subagent|independent-claude|other
  [--findings=TEXT] [--item=NUMBER] [--pr=NUMBER] [--scored-at=TIMESTAMP]
  [--informative=true|false] [--root-cause=TEXT] [--comparison-id=TEXT] [--retroactive] [--help]

Quote values containing spaces. --retroactive marks reconstructed historical trials.
--informative marks whether independent review found a real problem that was then fixed
(platform-decisions.md#delegation-trial-record-graduation, rule 4); omitted, it is written false.
--root-cause records, in its OWN field (never derived from --findings), why a confirmed miss happened;
required before any post-miss trial counts toward restoration (rule 5; #3889). Omitted, it is null.
--comparison-id links this row to its concurrent-baseline partner row (#3690 Fork 2; #3783) — normally
stamped by scripts/conveyor/concurrent-baseline-comparison.mjs, not typed by hand. Omitted, it is null.`;

/** CLI seam accepts the store's injectable IO so tests never write the real store. */
export function main(argv, io = {}) {
  if (argv.includes('--help')) {
    console.log(usage);
    return 0;
  }
  const fields = {
    provider: 'provider', model: 'model', task: 'taskDescription', 'task-type': 'taskType',
    outcome: 'outcome', 'verified-by': 'verifiedBy', findings: 'findings', item: 'item',
    pr: 'pr', 'scored-at': 'scoredAt', informative: 'informative', 'root-cause': 'rootCause',
    'comparison-id': 'comparisonId',
  };
  try {
    const row = {};
    for (const arg of argv) {
      if (arg === '--retroactive') {
        row.retroactive = true;
        continue;
      }
      const match = /^--([^=]+)=(.*)$/s.exec(arg);
      if (!match || !Object.hasOwn(fields, match[1])) {
        throw new Error(`unknown or malformed flag: ${arg}; see --help`);
      }
      const [, flag, value] = match;
      if (flag === 'item' || flag === 'pr') {
        if (!/^[0-9]+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) <= 0) {
          throw new Error(`--${flag} must be a positive integer`);
        }
        row[fields[flag]] = Number(value);
      } else if (flag === 'informative') {
        if (value !== 'true' && value !== 'false') {
          throw new Error('--informative must be true or false');
        }
        row[fields[flag]] = value === 'true';
      } else {
        row[fields[flag]] = value;
      }
    }
    const stored = logDelegationTrial(row, io);
    if (stored === null) throw new Error('could not write trial to the scorecard store');
    console.log(JSON.stringify(stored));
    return 0;
  } catch (error) {
    console.error(`log-delegation-trial: ${error.message}`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv.slice(2));
}
