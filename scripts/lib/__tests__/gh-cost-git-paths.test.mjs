import { describe, it, expect, vi } from 'vitest';
import { stripGhDebug, rateLimitRecords } from '../gh-throttle.mjs';
import { meteredPrCommits, meteredAlreadyDone } from '../gh-metered-reads.mjs';
import { attributeSpend } from '../gh-spend.mjs';
import { fetchPrCommits, countBackpressurePrs } from '../pr-limit.mjs';
import { defaultCheckAlreadyDone, defaultCheckAlreadyDoneAsync } from '../../operations/dispatch-lane-io.mjs';

const merge = '88396bb20\0' + '2026-09-30T12:00:00Z\0Merge pull request #3084 from chalbert/lane/4386-prepare-item\n\nWE #4386: prepare item — Design/MVP/Test plan/Proof plan/Follow-ups\n\0';
function gitFixture(log = merge, files = 'backlog/4386-item.md\0') {
  return vi.fn((_file, args) => {
    if (args[0] === 'rev-parse') return 'false\n';
    if (args[0] === 'remote') return 'git@github.com:chalbert/web-everything.git\n';
    if (args.includes('--grep=JIT-number')) return 'drain: JIT-number xcyvee3→#4586 at land (#2288)\n';
    if (args[0] === 'log') return log;
    if (args[0] === 'diff') return files;
    return '';
  });
}

describe('in-band cost', () => {
  it('captures the response cost, not a concurrent caller’s shared delta', () => {
    const trace = '* Request at now\n* Request to https://api.github.com/graphql\n< HTTP/2.0 200 OK\n< X-Ratelimit-Used: 100\n< X-Ratelimit-Reset: 200\n< X-Ratelimit-Resource: graphql\n\n{"data":{"rateLimit":{"cost":1}}}\n\n* Request took 1ms\n';
    const records = rateLimitRecords(stripGhDebug(trace).responses);
    expect(records[0].cost).toBe(1);
    const result = attributeSpend([{ ts: '2026-09-30T12:00:00Z', outcome: 'call', id: 'app', op: 'api graphql', rl: records }], { baselines: { 'app|graphql|200': { used: 10, t: Date.parse('2026-09-30T11:59:00Z') } } });
    expect(result.gaps[0]).toMatchObject({ delta: 90, attributed: 1, unattributed: 89 });
  });
});

describe('git paths', () => {
  it('excludes a real prepare merge with no GitHub calls, sync and async', async () => {
    const gh = vi.fn(() => { throw new Error('GitHub must not run'); });
    expect(defaultCheckAlreadyDone('4386', { git: gitFixture(), exec: gh })).toEqual({ done: false, pr: null, checked: true });
    expect(await defaultCheckAlreadyDoneAsync('4386', { git: gitFixture(), execFileFn: gh })).toEqual({ done: false, pr: null, checked: true });
    expect(gh).not.toHaveBeenCalled();
  });
  it('retains body-disclaimer safety by falling back for a potentially implementing merge', () => {
    const gh = vi.fn(() => JSON.stringify([{ title: 'WE #4386: build', body: 'does not resolve #4386', files: [{ path: 'scripts/a.mjs' }] }]));
    const git = gitFixture(merge.replace('4386-prepare-item', '4386-build').replace('prepare item', 'build'), 'scripts/a.mjs\0');
    expect(defaultCheckAlreadyDone('4386', { git, exec: gh }).done).toBe(false);
    expect(gh).toHaveBeenCalledTimes(1);
  });
  it('reads commits after fetch and gives the existing classifier equivalent inputs at zero GitHub calls', () => {
    const git = gitFixture('abc\0Nic\0nic@example.com\0Build\n\nCo-Authored-By: Claude <noreply@anthropic.com>\n\0Claude <noreply@anthropic.com>\0');
    const gh = vi.fn(() => { throw new Error('GitHub must not run'); });
    const commits = fetchPrCommits('chalbert/web-everything', 3084, { headRefName: 'lane/4386-build', git, exec: gh });
    expect(commits[0].authors).toContainEqual({ name: 'Claude', email: 'noreply@anthropic.com' });
    expect(countBackpressurePrs([{ number: 3084, commits }])).toHaveLength(1);
    expect(git.mock.calls.findIndex(([, a]) => a[0] === 'fetch')).toBeLessThan(git.mock.calls.findIndex(([, a]) => a[0] === 'log'));
    expect(gh).not.toHaveBeenCalled();
  });
  it('falls back when fetch fails', () => {
    const git = vi.fn(() => { throw new Error('offline'); });
    const gh = vi.fn(() => '{"commits":[]}');
    expect(fetchPrCommits('chalbert/web-everything', 3084, { headRefName: 'lane/4386', git, exec: gh })).toEqual([]);
    expect(gh).toHaveBeenCalledTimes(1);
  });
});


describe('metered fallback query shapes', () => {
  it('keeps cost in-band and projects the same consumer JSON', () => {
    const rows = [{ number: 42, title: 'WE #4386: build' }];
    const exec = vi.fn(() => JSON.stringify(rows));
    expect(meteredAlreadyDone('chalbert/web-everything', '4386', { exec })).toEqual(rows);
    expect(meteredPrCommits('chalbert/web-everything', 42, { exec })).toEqual(rows);
    for (const [argv] of exec.mock.calls) expect(argv.find((arg) => arg.startsWith('query='))).toContain('rateLimit { cost }');
    expect(exec.mock.calls[1][0]).toEqual(expect.arrayContaining(['--paginate', '--slurp']));
  });
  it('can attribute the first response from its own cost without a preceding counter', () => {
    const { gaps } = attributeSpend([{ ts: '2026-09-30T12:00:00Z', outcome: 'call', id: 'app', op: 'api graphql', rl: [{ res: 'graphql', reset: 200, used: 100, cost: 2 }] }]);
    expect(gaps[0]).toMatchObject({ delta: 2, attributed: 2, unattributed: 0 });
  });
});
