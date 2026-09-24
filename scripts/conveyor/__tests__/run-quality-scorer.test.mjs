import { describe, it, expect } from 'vitest';
import {
  scoreRecords, scoreCodexTranscriptFile, mapCodexJudgeEventsToRecords,
  readCodexJudgeTranscriptRecords, scoreCodexJudgeTranscriptFile,
  summarizeCodexJsonStreamRecord, scoreCodexJsonStreamStdout,
  mapAntigravityJudgeEventsToRecords, readAntigravityJudgeTranscriptRecords, scoreAntigravityJudgeTranscriptFile,
} from '../run-quality-scorer.mjs';
import { RUBRIC_VERSION, EVALUABLE_CRITERIA } from '../run-quality-rubric.mjs';

const toolCall = (input, extra = {}) => ({ kind: 'tool_call', name: 'shell', input, ...extra });
const toolOutput = (text, extra = {}) => ({ kind: 'tool_output', text, ...extra });
const message = (text) => ({ kind: 'message', role: 'assistant', text });
const turnComplete = () => ({ kind: 'turn_complete' });

describe('scoreRecords — empty/unreadable transcript', () => {
  it('an empty record list scores null, never 100, with criteriaEvaluated 0', () => {
    const out = scoreRecords([]);
    expect(out.criteriaEvaluated).toBe(0);
    expect(out.score).toBeNull();
    expect(out.deductions).toEqual([]);
    expect(out.rubricVersion).toBe(RUBRIC_VERSION);
  });

  it('non-array input degrades to the same empty-read shape rather than throwing', () => {
    expect(scoreRecords(null).score).toBeNull();
    expect(scoreRecords(undefined).criteriaEvaluated).toBe(0);
  });
});

describe('scoreRecords — a clean run', () => {
  it('scores 100 with an empty deduction vector, and criteriaEvaluated equals the wired hunters', () => {
    const records = [toolCall('git status'), toolOutput('clean'), message('done'), turnComplete()];
    const out = scoreRecords(records);
    expect(out.score).toBe(100);
    // `command-churn` always records a count (weight 0, so it never moves the score) — every OTHER
    // criterion finds nothing on a clean run.
    expect(out.deductions.filter((d) => d.criterion !== 'command-churn')).toEqual([]);
    expect(out.criteriaEvaluated).toBeGreaterThan(0);
    expect(out.criteriaEvaluated).toBeLessThanOrEqual(EVALUABLE_CRITERIA.length);
  });
});

describe('scoreRecords — blacklisted-operation', () => {
  it('deducts on a destructive command', () => {
    const records = [toolCall('git reset --hard origin/main'), turnComplete()];
    const out = scoreRecords(records);
    const d = out.deductions.find((x) => x.criterion === 'blacklisted-operation');
    expect(d).toBeTruthy();
    expect(d.count).toBe(1);
    expect(out.score).toBeLessThan(100);
  });

  it('a clean command is never flagged', () => {
    const out = scoreRecords([toolCall('git status')]);
    expect(out.deductions.find((x) => x.criterion === 'blacklisted-operation')).toBeUndefined();
  });
});

describe('scoreRecords — abandoned-failing-test', () => {
  it('deducts when a test failure is never followed by a clean re-run', () => {
    const records = [toolCall('npm test'), toolOutput('FAIL scripts/foo.test.mjs\n1 failing'), message('moving on')];
    const out = scoreRecords(records);
    expect(out.deductions.find((x) => x.criterion === 'abandoned-failing-test')).toBeTruthy();
  });

  it('does NOT deduct when a later output shows the tests passing clean', () => {
    const records = [
      toolCall('npm test'), toolOutput('FAIL scripts/foo.test.mjs\n1 failing'),
      toolCall('npm test'), toolOutput('12 passed, 0 failed'),
    ];
    const out = scoreRecords(records);
    expect(out.deductions.find((x) => x.criterion === 'abandoned-failing-test')).toBeUndefined();
  });

  it('no failure at all never deducts', () => {
    const out = scoreRecords([toolCall('npm test'), toolOutput('12 passed, 0 failed')]);
    expect(out.deductions.find((x) => x.criterion === 'abandoned-failing-test')).toBeUndefined();
  });
});

describe('scoreRecords — passive-wait-no-poll', () => {
  it('deducts when the run ends right after a backgrounded command with no later activity', () => {
    const records = [message('starting'), toolCall('long_running_job.sh &')];
    const out = scoreRecords(records);
    expect(out.deductions.find((x) => x.criterion === 'passive-wait-no-poll')).toBeTruthy();
  });

  it('does NOT deduct when a later tool call follows up on the backgrounded command', () => {
    const records = [toolCall('long_running_job.sh &'), toolOutput('started, pid 123'), toolCall('wait 123')];
    const out = scoreRecords(records);
    expect(out.deductions.find((x) => x.criterion === 'passive-wait-no-poll')).toBeUndefined();
  });

  it('a foreground-only run never deducts', () => {
    const out = scoreRecords([toolCall('git status'), toolOutput('clean')]);
    expect(out.deductions.find((x) => x.criterion === 'passive-wait-no-poll')).toBeUndefined();
  });
});

describe('scoreRecords — redundant-command (accrual)', () => {
  it('deducts a small amount when the same command runs 3+ times', () => {
    const records = [toolCall('cat file.txt'), toolCall('cat file.txt'), toolCall('cat file.txt')];
    const out = scoreRecords(records);
    const d = out.deductions.find((x) => x.criterion === 'redundant-command');
    expect(d).toBeTruthy();
    expect(d.count).toBe(1); // 3 occurrences - 2 "normal" reads = 1 extra
  });

  it('twice is not redundant', () => {
    const out = scoreRecords([toolCall('cat file.txt'), toolCall('cat file.txt')]);
    expect(out.deductions.find((x) => x.criterion === 'redundant-command')).toBeUndefined();
  });
});

describe('scoreRecords — command-churn is recorded but NEVER moves the score (Fork 4: no par band in v1)', () => {
  it('records a count deduction with weight 0, so the score is unaffected by volume alone', () => {
    const manyCalls = Array.from({ length: 20 }, (_, i) => toolCall(`unique-command-${i}`));
    const out = scoreRecords(manyCalls);
    const d = out.deductions.find((x) => x.criterion === 'command-churn');
    expect(d).toBeTruthy();
    expect(d.count).toBe(20);
    expect(out.score).toBe(100); // weight 0 ⇒ zero contribution regardless of count
  });
});

describe('scoreRecords — scrub denial (defence in depth)', () => {
  it('a repo-identifying evidence string is withheld, not silently stored raw', () => {
    const records = [toolCall('rm -rf /Users/x/workspace/webeverything/scratch')];
    const out = scoreRecords(records);
    const d = out.deductions.find((x) => x.criterion === 'blacklisted-operation');
    expect(d).toBeTruthy();
    expect(d.evidenceDenied).toBe(true);
    expect(d.evidence).toMatch(/withheld/);
    expect(d.evidence).not.toContain('/Users/x/workspace/webeverything/scratch');
  });
});

describe('scoreCodexTranscriptFile — the file-reading adapter', () => {
  it('requires an injected reader rather than touching the filesystem itself', () => {
    expect(() => scoreCodexTranscriptFile('/some/path')).toThrow(/readTranscriptRecords/);
  });

  it('scores whatever the injected reader returns', () => {
    const out = scoreCodexTranscriptFile('/some/path', { readTranscriptRecords: () => [toolCall('git status')] });
    expect(out.score).toBe(100);
  });
});

describe('mapCodexJudgeEventsToRecords — the codex-judge-spawn.mjs STREAM shape, not the rollout-file shape', () => {
  it('maps a command_execution item into an ordered tool_call + tool_output pair', () => {
    const events = [
      { type: 'thread.started', thread_id: 't' },
      { type: 'turn.started' },
      {
        type: 'item.completed',
        item: { id: 'item_1', type: 'command_execution', command: 'git status --short', aggregated_output: 'clean\n', exit_code: 0 },
      },
      { type: 'turn.completed', usage: {} },
    ];
    const records = mapCodexJudgeEventsToRecords(events);
    expect(records).toEqual([
      { kind: 'tool_call', name: 'shell', input: 'git status --short' },
      { kind: 'tool_output', text: 'clean\n', isError: false },
      { kind: 'turn_complete' },
    ]);
  });

  it('flags a non-zero exit code as an error output', () => {
    const events = [{
      type: 'item.completed',
      item: { type: 'command_execution', command: 'npm test', aggregated_output: 'FAIL\n1 failing', exit_code: 1 },
    }];
    const records = mapCodexJudgeEventsToRecords(events);
    expect(records[1]).toEqual({ kind: 'tool_output', text: 'FAIL\n1 failing', isError: true });
  });

  it('maps an agent_message item into a message record', () => {
    const events = [{ type: 'item.completed', item: { type: 'agent_message', text: '{"verdict":"accept"}' } }];
    expect(mapCodexJudgeEventsToRecords(events)).toEqual([{ kind: 'message', role: 'assistant', text: '{"verdict":"accept"}' }]);
  });

  it('skips a thread.started/turn.started/file_change/unrecognised item without throwing', () => {
    const events = [
      { type: 'thread.started', thread_id: 't' },
      { type: 'turn.started' },
      { type: 'item.completed', item: { type: 'file_change', changes: [{ path: 'x', kind: 'update' }] } },
      { type: 'something.else' },
    ];
    expect(mapCodexJudgeEventsToRecords(events)).toEqual([]);
  });

  it('a turn.failed also produces a turn_complete record — the run still concluded, just not cleanly', () => {
    const events = [{ type: 'turn.failed', error: { message: 'boom' } }];
    expect(mapCodexJudgeEventsToRecords(events)).toEqual([{ kind: 'turn_complete' }]);
  });

  it('non-array input degrades to an empty list rather than throwing', () => {
    expect(mapCodexJudgeEventsToRecords(null)).toEqual([]);
    expect(mapCodexJudgeEventsToRecords(undefined)).toEqual([]);
  });
});

describe('readCodexJudgeTranscriptRecords / scoreCodexJudgeTranscriptFile — THE FIX, end to end', () => {
  // A REALISTIC advisory-judge-seat transcript — the exact stream shape `codex-judge-spawn.mjs` now persists
  // to disk (see `we:backlog/3649-*.md`'s own proof-advisory-scratch row, which recorded `score: null,
  // criteriaEvaluated: 0` for lack of exactly this file).
  const realisticJudgeStream = [
    JSON.stringify({ type: 'thread.started', thread_id: 'sess-advisory-1' }),
    JSON.stringify({ type: 'turn.started' }),
    JSON.stringify({
      type: 'item.completed',
      item: { type: 'command_execution', command: 'git status --short', aggregated_output: '', exit_code: 0 },
    }),
    JSON.stringify({
      type: 'item.completed',
      item: { type: 'agent_message', text: '{"verdict":"accept","finding":"looks fine"}' },
    }),
    JSON.stringify({ type: 'turn.completed', usage: { input_tokens: 100, output_tokens: 10 } }),
  ].join('\n');

  it('readCodexJudgeTranscriptRecords parses a file (injected reader) into summarizeRecord-shaped entries', () => {
    const records = readCodexJudgeTranscriptRecords('/fake/path.jsonl', { readFile: () => realisticJudgeStream });
    expect(records).toEqual([
      { kind: 'tool_call', name: 'shell', input: 'git status --short' },
      { kind: 'tool_output', text: '', isError: false },
      { kind: 'message', role: 'assistant', text: '{"verdict":"accept","finding":"looks fine"}' },
      { kind: 'turn_complete' },
    ]);
  });

  it('THE FIX: scoreCodexJudgeTranscriptFile now produces a REAL score for an advisory-seat run, never null/0', () => {
    const out = scoreCodexJudgeTranscriptFile('/fake/path.jsonl', { readFile: () => realisticJudgeStream });
    // Before this fix, this exact class of run (no persisted transcript — `--ephemeral` suppresses Codex's own
    // rollout) was correctly but unhelpfully recorded `score: null, criteriaEvaluated: 0` (see
    // `we:scripts/conveyor/run-scorecards.json`'s `proof-advisory-scratch` row). With a real transcript file to
    // read, it is neither:
    expect(out.criteriaEvaluated).toBeGreaterThan(0);
    expect(out.score).not.toBeNull();
    expect(out.score).toBe(100); // a clean run — nothing blacklisted, no abandoned test, no redundant reads
  });

  it('still scores null/0 on a genuinely empty transcript — never fabricates a perfect score either', () => {
    const out = scoreCodexJudgeTranscriptFile('/fake/empty.jsonl', { readFile: () => '' });
    expect(out.criteriaEvaluated).toBe(0);
    expect(out.score).toBeNull();
  });

  it('scores a real deduction when the advisory seat ran a blacklisted operation', () => {
    const dirtyStream = [
      JSON.stringify({ type: 'thread.started', thread_id: 'sess-advisory-2' }),
      JSON.stringify({
        type: 'item.completed',
        item: { type: 'command_execution', command: 'git reset --hard origin/main', aggregated_output: '', exit_code: 0 },
      }),
      JSON.stringify({ type: 'turn.completed', usage: {} }),
    ].join('\n');
    const out = scoreCodexJudgeTranscriptFile('/fake/dirty.jsonl', { readFile: () => dirtyStream });
    expect(out.score).toBeLessThan(100);
    expect(out.deductions.find((d) => d.criterion === 'blacklisted-operation')).toBeTruthy();
  });
});

// #3383 mechanical-dispatcher Bug 2 — the stdout-shape adapter. `REAL_CODEX_JSON_STDOUT` below is a VERBATIM
// capture of a real `codex exec --json` run (codex-cli 0.153.4, 2026-09-13: `codex exec --json
// --skip-git-repo-check -m gpt-6-astra -c model_reasoning_effort=low -c approval_policy=never -s read-only
// "Run \`ls\` in the current directory and then just say done."`), not a hand-typed fixture — this is exactly
// the shape `codex-delivery-provider.mjs#defaultSpawnCodexAgent` and `codex-judge-spawn.mjs#codexJudgeSpawn`
// already capture as `stdout` from their own real spawns.
const REAL_CODEX_JSON_STDOUT = [
  '{"type":"thread.started","thread_id":"01a09caf-885b-7170-a88e-8d79c23468f3"}',
  '{"type":"turn.started"}',
  '{"type":"item.completed","item":{"id":"item_0","type":"agent_message","text":"I’ll run `ls` in the current directory."}}',
  '{"type":"item.started","item":{"id":"item_1","type":"command_execution","command":"/bin/bash -lc ls","aggregated_output":"","exit_code":null,"status":"in_progress"}}',
  '{"type":"item.completed","item":{"id":"item_1","type":"command_execution","command":"/bin/bash -lc ls","aggregated_output":"README.md\\n","exit_code":0,"status":"completed"}}',
  '{"type":"item.completed","item":{"id":"item_2","type":"agent_message","text":"done"}}',
  '{"type":"turn.completed","usage":{"input_tokens":31033,"cached_input_tokens":27520,"cache_write_input_tokens":0,"output_tokens":49,"reasoning_output_tokens":0}}',
].join('\n');

describe('summarizeCodexJsonStreamRecord (#3383 — real `codex exec --json` stdout, a different shape from the rollout file)', () => {
  it('normalizes a real command_execution item.started into a tool_call', () => {
    const line = '{"type":"item.started","item":{"id":"item_1","type":"command_execution","command":"ls -la","aggregated_output":"","exit_code":null,"status":"in_progress"}}';
    expect(summarizeCodexJsonStreamRecord(line)).toEqual({ kind: 'tool_call', callId: 'item_1', name: 'command_execution', input: 'ls -la' });
  });

  it('normalizes a real command_execution item.completed into a tool_output, with exit code', () => {
    const line = '{"type":"item.completed","item":{"id":"item_1","type":"command_execution","command":"ls -la","aggregated_output":"README.md\\n","exit_code":0,"status":"completed"}}';
    expect(summarizeCodexJsonStreamRecord(line)).toEqual({ kind: 'tool_output', callId: 'item_1', exitCode: 0, isError: false, text: 'README.md\n' });
  });

  it('a non-zero exit code is a failure', () => {
    const line = '{"type":"item.completed","item":{"id":"item_1","type":"command_execution","command":"false","aggregated_output":"","exit_code":1,"status":"completed"}}';
    expect(summarizeCodexJsonStreamRecord(line).isError).toBe(true);
  });

  it('normalizes a completed agent_message into a message', () => {
    const line = '{"type":"item.completed","item":{"id":"item_2","type":"agent_message","text":"done"}}';
    expect(summarizeCodexJsonStreamRecord(line)).toEqual({ kind: 'message', role: 'assistant', text: 'done' });
  });

  it('bookkeeping events map to harmless, ignored kinds', () => {
    expect(summarizeCodexJsonStreamRecord('{"type":"thread.started","thread_id":"x"}').kind).toBe('thread_started');
    expect(summarizeCodexJsonStreamRecord('{"type":"turn.started"}').kind).toBe('turn_started');
    expect(summarizeCodexJsonStreamRecord('{"type":"turn.completed","usage":{}}').kind).toBe('turn_complete');
  });

  it('an unparseable line degrades to `unparseable`, never throws', () => {
    expect(summarizeCodexJsonStreamRecord('not json').kind).toBe('unparseable');
  });
});

describe('scoreCodexJsonStreamStdout (#3383 — scores directly off REAL captured stdout, no rollout file needed)', () => {
  it('scores a real clean run at 100 with an empty deduction vector (besides command-churn)', () => {
    const out = scoreCodexJsonStreamStdout(REAL_CODEX_JSON_STDOUT);
    expect(out.rubricVersion).toBe(RUBRIC_VERSION);
    expect(out.score).toBe(100);
    expect(out.deductions.filter((d) => d.criterion !== 'command-churn')).toEqual([]);
    expect(out.criteriaEvaluated).toBeGreaterThan(0);
  });

  it('a blacklisted command in a real-shaped stream is caught the same way it is in the rollout shape', () => {
    const stdout = [
      '{"type":"thread.started","thread_id":"t1"}',
      '{"type":"item.started","item":{"id":"item_1","type":"command_execution","command":"git reset --hard origin/main","aggregated_output":"","exit_code":null,"status":"in_progress"}}',
      '{"type":"item.completed","item":{"id":"item_1","type":"command_execution","command":"git reset --hard origin/main","aggregated_output":"","exit_code":0,"status":"completed"}}',
      '{"type":"turn.completed","usage":{}}',
    ].join('\n');
    const out = scoreCodexJsonStreamStdout(stdout);
    expect(out.deductions.find((d) => d.criterion === 'blacklisted-operation')).toBeTruthy();
    expect(out.score).toBeLessThan(100);
  });

  it('empty stdout scores null, never 100 — never 100 on an empty read', () => {
    expect(scoreCodexJsonStreamStdout('').score).toBeNull();
    expect(scoreCodexJsonStreamStdout('').criteriaEvaluated).toBe(0);
  });
});

describe('mapAntigravityJudgeEventsToRecords — the antigravity-judge-spawn.mjs stream shape (`event`/`step_update`, '
  + 'a THIRD shape, distinct from both Codex ones)', () => {
  it('maps a step_update carrying a tool_name into an ordered tool_call + tool_output pair', () => {
    const events = [
      { event: 'init', conversation_id: 'conv-1' },
      {
        event: 'step_update',
        step_update: {
          tool_name: 'run_command', tool_info: { parameters: { command: 'git status --short' }, output: 'clean\n' }, status: 'SUCCESS',
        },
      },
      { event: 'result', result: { conversation_id: 'conv-1', status: 'SUCCESS' } },
    ];
    const records = mapAntigravityJudgeEventsToRecords(events);
    expect(records).toEqual([
      { kind: 'tool_call', name: 'run_command', input: JSON.stringify({ command: 'git status --short' }) },
      { kind: 'tool_output', text: 'clean\n', isError: false },
      { kind: 'turn_complete' },
    ]);
  });

  it('flags a TOOL_ERROR status as an error output — the auto-denied-tool shape #3633 probe 7 found', () => {
    const events = [{
      event: 'step_update',
      step_update: { tool_name: 'run_command', tool_info: { parameters: { command: 'git status' }, output: 'permission check failed' }, status: 'TOOL_ERROR' },
    }];
    const records = mapAntigravityJudgeEventsToRecords(events);
    expect(records[1]).toEqual({ kind: 'tool_output', text: 'permission check failed', isError: true });
  });

  it('every terminal `result` event yields a turn_complete record, regardless of status', () => {
    expect(mapAntigravityJudgeEventsToRecords([{ event: 'result', result: { status: 'SUCCESS' } }]))
      .toEqual([{ kind: 'turn_complete' }]);
    expect(mapAntigravityJudgeEventsToRecords([{ event: 'result', result: { status: 'ERROR', error: 'boom' } }]))
      .toEqual([{ kind: 'turn_complete' }]);
  });

  it('skips an `init` event and a `step_update` carrying no tool_name, without throwing', () => {
    const events = [
      { event: 'init', conversation_id: 'conv-1' },
      { event: 'step_update', step_update: { some_other_field: 1 } },
      { event: 'something.else' },
    ];
    expect(mapAntigravityJudgeEventsToRecords(events)).toEqual([]);
  });

  it('non-array input degrades to an empty list rather than throwing', () => {
    expect(mapAntigravityJudgeEventsToRecords(null)).toEqual([]);
    expect(mapAntigravityJudgeEventsToRecords(undefined)).toEqual([]);
  });
});

describe('readAntigravityJudgeTranscriptRecords / scoreAntigravityJudgeTranscriptFile — THE FIX, end to end', () => {
  // A REALISTIC Antigravity judge transcript for the ORDINARY case this genuinely tool-free seat produces:
  // no tool call was ever unlocked (see antigravity-judge-spawn.mjs's own file header), so the only records
  // are the init/result bookends — exactly the shape #3649's scorer previously had NOTHING to read at all,
  // since no transcript was ever persisted for this seat before this fix.
  const realisticJudgeStream = [
    JSON.stringify({ event: 'init', conversation_id: 'sess-advisory-1' }),
    JSON.stringify({ event: 'result', result: { conversation_id: 'sess-advisory-1', status: 'SUCCESS', structured_output: { verdict: 'accept', finding: 'looks fine' }, usage: { input_tokens: 100, output_tokens: 10 } } }),
  ].join('\n');

  it('readAntigravityJudgeTranscriptRecords parses a file (injected reader) into summarizeRecord-shaped entries', () => {
    const records = readAntigravityJudgeTranscriptRecords('/fake/path.jsonl', { readFile: () => realisticJudgeStream });
    expect(records).toEqual([{ kind: 'turn_complete' }]);
  });

  it('THE FIX: scoreAntigravityJudgeTranscriptFile now produces a REAL score for a tool-free advisory run, never null/0', () => {
    const out = scoreAntigravityJudgeTranscriptFile('/fake/path.jsonl', { readFile: () => realisticJudgeStream });
    // Before this fix, this exact class of run (no persisted transcript at all — antigravityJudgeSpawn
    // discarded its captured stdout once parsed) was correctly but unhelpfully recorded `score: null,
    // criteriaEvaluated: 0`. With a real transcript file to read, it is neither:
    expect(out.criteriaEvaluated).toBeGreaterThan(0);
    expect(out.score).not.toBeNull();
    expect(out.score).toBe(100); // a clean run — nothing blacklisted, no abandoned test, no redundant reads
  });

  it('still scores null/0 on a genuinely empty transcript — never fabricates a perfect score either', () => {
    const out = scoreAntigravityJudgeTranscriptFile('/fake/empty.jsonl', { readFile: () => '' });
    expect(out.criteriaEvaluated).toBe(0);
    expect(out.score).toBeNull();
  });

  it('scores a real deduction when a step_update shows the seat attempting a blacklisted operation (even though '
    + 'it was auto-denied — the attempt itself is what the hunter names)', () => {
    const dirtyStream = [
      JSON.stringify({ event: 'init', conversation_id: 'sess-advisory-2' }),
      JSON.stringify({
        event: 'step_update',
        step_update: {
          tool_name: 'run_command', tool_info: { parameters: { command: 'git reset --hard origin/main' }, output: 'permission check failed' }, status: 'TOOL_ERROR',
        },
      }),
      JSON.stringify({ event: 'result', result: { conversation_id: 'sess-advisory-2', status: 'SUCCESS', denied_actions: [{ action: 'command' }] } }),
    ].join('\n');
    const out = scoreAntigravityJudgeTranscriptFile('/fake/dirty.jsonl', { readFile: () => dirtyStream });
    expect(out.score).toBeLessThan(100);
    expect(out.deductions.find((d) => d.criterion === 'blacklisted-operation')).toBeTruthy();
  });
});
