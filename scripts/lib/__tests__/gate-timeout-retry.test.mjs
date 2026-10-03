import { describe, expect, it } from 'vitest';
import { timeoutRetryFiles, MAX_TIMEOUT_LOG_BYTES } from '../gate-timeout-retry.mjs';
import { createFailureCollector } from '../verify-failures.mjs';

function evidence(messages = ['Error: Test timed out in 5000ms.'], files = ['a.test.mjs']) {
  const stderr = messages.map((m, i) => ` FAIL  ${files[i] || files[0]} > case ${i}\n${m}\n`).join('');
  const stdout = ` Test Files  ${new Set(files).size} failed\n Tests  ${messages.length} failed\n Duration  5.1s\n`;
  const collector = createFailureCollector({ cwd: '/repo' });
  collector.push(stderr, 'stderr'); collector.push(stdout);
  return { stdout, stderr, failureDetails: collector.finish(), changedFiles: ['source.mjs'], cwd: '/repo' };
}

describe('timeout retry inventory', () => {
  it('deduplicates complete timeout-only failures in untouched files', () => {
    const e = evidence(Array(3).fill('Error: Test timed out in 5000ms.'), ['a.test.mjs', 'a.test.mjs', 'b.test.mjs']);
    expect(timeoutRetryFiles(e)).toEqual(['a.test.mjs', 'b.test.mjs']);
  });
  it('normalizes absolute and relative edited paths', () => {
    expect(timeoutRetryFiles({ ...evidence(), changedFiles: ['./a.test.mjs'] })).toEqual([]);
    const e = evidence(undefined, ['/repo/a.test.mjs']);
    expect(timeoutRetryFiles(e)).toEqual(['a.test.mjs']);
    expect(timeoutRetryFiles({ ...e, changedFiles: ['a.test.mjs'] })).toEqual([]);
  });
  it.each([
    ['mixed', e => { e.stderr += 'AssertionError: wrong value\n'; }],
    ['truncated', e => { e.failureDetails.truncated = true; }],
    ['missing totals', e => { e.stdout = ''; }],
    ['unknown diff', e => { e.changedFiles = null; }],
    ['unhandled error', e => { e.stderr += 'Unhandled Errors\n'; }],
    ['suite failure', e => { e.stderr += ' FAIL  collection.test.mjs\n'; }],
    ['missing failure', e => { e.stdout = e.stdout.replace('Tests  1', 'Tests  2'); }],
    ['oversized log', e => { e.stdout += 'x'.repeat(MAX_TIMEOUT_LOG_BYTES); }],
  ])('refuses %s', (_, alter) => {
    const e = evidence(); alter(e); expect(timeoutRetryFiles(e)).toEqual([]);
  });
  it('does not authorize from a timeout substring in an assertion', () => {
    expect(timeoutRetryFiles(evidence(['AssertionError: expected Test timed out in 5000ms.']))).toEqual([]);
  });
  it('refuses an inventory truncated by the actual collector', () => {
    const e = evidence(Array(21).fill('Error: Test timed out in 5000ms.'), Array.from({ length: 21 }, (_, i) => `${i}.test.mjs`));
    expect(e.failureDetails.truncated).toBe(true);
    expect(timeoutRetryFiles(e)).toEqual([]);
  });
});
