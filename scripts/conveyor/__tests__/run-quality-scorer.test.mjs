import { describe, it, expect } from 'vitest';
import { scoreRecords, scoreCodexTranscriptFile } from '../run-quality-scorer.mjs';
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
