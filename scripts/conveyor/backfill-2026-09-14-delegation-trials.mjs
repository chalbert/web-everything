/**
 * One-time backfill of the session narrative from 2026-09-14 (#3690).
 * Timestamps reconstruct narrative order across 21:00–01:30 America/New_York;
 * they are invented ordering markers, not observed execution times. Every row is retroactive.
 * Retain this script as the provenance of these nine records. Exact matches are skipped on rerun.
 */
import { pathToFileURL } from 'node:url';
import { logDelegationTrial } from './log-delegation-trial.mjs';
import { readStore } from './run-scorecard-store.mjs';

const trials = [
  {
    provider: 'codex', model: 'gpt-6-astra',
    taskDescription: 'Fix pid-forwarding bug in launch wrapper (PR #2223)',
    taskType: 'bugfix', outcome: 'landed', verifiedBy: 'claude-subagent', findings: null, pr: 2223,
    scoredAt: '2026-09-15T01:00:00.000Z', retroactive: true,
  },
  {
    provider: 'codex', model: 'gpt-6-astra',
    taskDescription: 'Resolve a real branch conflict (PR #2212)',
    taskType: 'conflict-resolution', outcome: 'landed', verifiedBy: 'claude-subagent', findings: null, pr: 2212,
    scoredAt: '2026-09-15T01:30:00.000Z', retroactive: true,
  },
  {
    provider: 'codex', model: 'gpt-6-astra',
    taskDescription: "Self-fix codex-direct-task.mjs's own ENOBUFS failure",
    taskType: 'self-fix', outcome: 'landed', verifiedBy: 'claude-subagent', findings: null,
    scoredAt: '2026-09-15T02:00:00.000Z', retroactive: true,
  },
  {
    provider: 'codex', model: 'gpt-6-astra',
    taskDescription: 'Fix a NUL-byte handling bug (backlog #3428)',
    taskType: 'bugfix', outcome: 'landed', verifiedBy: 'claude-subagent', findings: null, item: 3428,
    scoredAt: '2026-09-15T02:30:00.000Z', retroactive: true,
  },
  {
    provider: 'codex', model: 'gpt-6-astra',
    taskDescription: 'Doc fix (backlog #3539)',
    taskType: 'doc-fix', outcome: 'landed', verifiedBy: 'claude-subagent', findings: null, item: 3539,
    scoredAt: '2026-09-15T03:00:00.000Z', retroactive: true,
  },
  {
    provider: 'codex', model: 'gpt-6-astra',
    taskDescription: 'Harden codex-direct-task.mjs / gemini-direct-task.mjs — round 1 of 3',
    taskType: 'bugfix', outcome: 'reworked', verifiedBy: 'independent-claude',
    findings: 'Independent review caught a real bug before landing (round 1 of 3); fixed and re-verified before landing.',
    scoredAt: '2026-09-15T03:40:00.000Z', retroactive: true,
  },
  {
    provider: 'codex', model: 'gpt-6-astra',
    taskDescription: 'Harden codex-direct-task.mjs / gemini-direct-task.mjs — round 2 of 3',
    taskType: 'bugfix', outcome: 'reworked', verifiedBy: 'independent-claude',
    findings: 'Independent review caught a real bug before landing, including a filename-quoting bug (round 2 of 3); fixed and re-verified before landing.',
    scoredAt: '2026-09-15T04:20:00.000Z', retroactive: true,
  },
  {
    provider: 'codex', model: 'gpt-6-astra',
    taskDescription: 'Harden codex-direct-task.mjs / gemini-direct-task.mjs — round 3 of 3',
    taskType: 'bugfix', outcome: 'landed', verifiedBy: 'independent-claude', findings: null,
    scoredAt: '2026-09-15T05:00:00.000Z', retroactive: true,
  },
  {
    provider: 'antigravity', model: 'gemini-3.1-pro',
    taskDescription: 'Build gemini-direct-task.mjs, a personal Antigravity/Gemini CLI escape hatch (mirrors codex-direct-task.mjs)',
    taskType: 'other', outcome: 'landed', verifiedBy: 'other',
    findings: 'Verified via a live smoke test, not a Claude-subagent code review. NOTE: gemini-direct-task.mjs pins no default model (model/effort are optional passthroughs — see its own header); "gemini-3.1-pro" here is a best-effort label, not a confirmed pinned identity for this run.',
    scoredAt: '2026-09-15T05:30:00.000Z', retroactive: true,
  },
];

function main() {
  const store = readStore();
  for (const trial of trials) {
    if (store.records.some((record) => record.taskDescription === trial.taskDescription
      && record.provider === trial.provider && record.scoredAt === trial.scoredAt)) {
      console.log(`Skipping existing trial: ${trial.taskDescription}`);
      continue;
    }
    const stored = logDelegationTrial(trial);
    if (stored === null) throw new Error(`Could not write trial: ${trial.taskDescription}`);
    store.records.push(stored);
    console.log(`Appended trial: ${trial.taskDescription}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(`backfill-2026-09-14-delegation-trials: ${error.message}`);
    process.exitCode = 1;
  }
}
