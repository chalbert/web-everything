import { describe, it, expect, vi } from 'vitest';
import { readReviewCiGate, readReviewHead, readReviewChecks } from '../review-ci-gate-io.mjs';
const headSha = 'a'.repeat(40);
function fixture(over = {}) {
  return { repo: 'other/product', pr: 3432, readHead: vi.fn(() => headSha),
    readRequired: vi.fn(() => ({ source: 'live', checks: ['custom'] })),
    readChecks: vi.fn(() => [{ name: 'custom', status: 'completed', conclusion: 'success' }]), ...over };
}
describe('fresh review CI IO', () => {
  it('reads repo, fresh required set and exact SHA, then verifies the head again', () => {
    const io = fixture();
    expect(readReviewCiGate(io).allowed).toBe(true);
    expect(io.readHead.mock.calls).toEqual([[{ repo: io.repo, pr: 3432 }], [{ repo: io.repo, pr: 3432 }]]);
    expect(io.readChecks).toHaveBeenCalledWith({ repo: io.repo, headSha });
    expect(io.readRequired).toHaveBeenCalledWith({ repo: io.repo, ttlMs: 0 });
  });
  it.each(['stale-cache', 'fallback', undefined])('refuses untrusted source %s', source => {
    expect(readReviewCiGate(fixture({ readRequired: () => ({ source, checks: ['custom'] }) }))).toMatchObject({ allowed: false, reason: 'untrusted-required-set' });
  });
  it.each(['readHead', 'readRequired', 'readChecks'])('fails closed on %s errors', key => {
    expect(readReviewCiGate(fixture({ [key]: () => { throw new Error('offline'); } }))).toMatchObject({ allowed: false, reason: 'unreadable-ci' });
  });
  it('refuses a head move during the read', () => {
    expect(readReviewCiGate(fixture({ readHead: vi.fn().mockReturnValueOnce(headSha).mockReturnValueOnce('b'.repeat(40)) }))).toMatchObject({ allowed: false, reason: 'head-changed', headSha });
  });
  it.each([[], [{ name: 'custom', status: 'in_progress' }], [{ name: 'custom', status: 'completed', conclusion: 'failure' }]])('refuses fresh missing/pending/red despite an earlier green plan', checks => {
    expect(readReviewCiGate(fixture({ readChecks: () => checks })).allowed).toBe(false);
  });
});

it('production read argv is repo/SHA-explicit and fetches every page and rerun', () => {
  const runHead = vi.fn(() => JSON.stringify({ headRefOid: headSha }));
  expect(readReviewHead({ repo: 'other/product', pr: 3432, run: runHead })).toBe(headSha);
  expect(runHead).toHaveBeenCalledWith(['pr', 'view', '3432', '--repo', 'other/product', '--json', 'headRefOid']);
  const runChecks = vi.fn(() => JSON.stringify([{ check_runs: [{ id: 2 }] }, { check_runs: [{ id: 1 }] }]));
  expect(readReviewChecks({ repo: 'other/product', headSha, run: runChecks })).toEqual([{ id: 2 }, { id: 1 }]);
  expect(runChecks).toHaveBeenCalledWith(['api', '--paginate', '--slurp', `repos/other/product/commits/${headSha}/check-runs?per_page=100&filter=all`]);
  expect(() => readReviewChecks({ repo: 'other/product', headSha, run: () => '[{}]' })).toThrow('unreadable check runs');
});

// Recovered read-only from GitHub on 2026-10-02. Times are UTC. We reconstruct
// eligibility at the accept comment; neither dispatch-start time nor the old required-set configuration is archived here.
it.each([
  ['2498e55c6b57f30b629e1477e55366138ef724d6', '2026-10-02T01:42:07Z', '2026-10-02T01:44:24Z', '2026-10-02T01:42:58Z', '2026-10-02T01:43:01Z'],
  ['62f132b42c56d00231f38a71b8376b670f73417a', '2026-10-02T02:05:53Z', '2026-10-02T02:08:54Z', '2026-10-02T02:07:00Z', '2026-10-02T02:07:03Z'],
])('historical #3432 accepted head %s was ineligible at acceptance and after soak failure', (sha, acceptedAt, testDone, soakStarted, soakDone) => {
  for (const at of [acceptedAt, soakDone, testDone]) {
    const checks = [{ name: 'smoke', status: 'completed', conclusion: 'success' },
      { name: 'test', status: at < testDone ? 'in_progress' : 'completed', conclusion: at < testDone ? null : 'success' },
      ...(at < soakStarted ? [] : [{ name: 'daemon-soak', status: 'completed', conclusion: 'failure' }])];
    const out = readReviewCiGate({ repo: 'chalbert/web-everything', pr: 3432, readHead: () => sha,
      readRequired: () => ({ source: 'live', checks: ['test', 'smoke', 'daemon-soak'] }), readChecks: () => checks });
    expect(out.allowed).toBe(false);
    expect(out.affected).toContainEqual({ name: 'daemon-soak', reason: at < soakStarted ? 'missing' : 'failure' });
  }
});
