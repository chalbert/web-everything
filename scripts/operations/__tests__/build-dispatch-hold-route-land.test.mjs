import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const {
  refFor, findCardFileName, clearScopeAndAppendFinding, landOne, landRoute,
  commitReferencesItem, extractBornAs, commitTouchesNonBacklogFile,
} = await import('../build-dispatch-hold-route-land.mjs');

// The REAL `open-pr` `--json` shape (see we:scripts/operations/health-file-request-land.mjs's own note on
// this exact envelope) — every fake `open-pr` response below must match it, or a passing test would hide the
// exact parsing bug that shape's own live catch found.
function fakeOpenPrResult(pr, url) {
  return JSON.stringify({
    runId: 'open-pr-test', op: 'open-pr', stopped: 'complete',
    findings: { submit: { applied: true, effects: [{ type: 'open-pr.submit', status: 'applied', result: { outcome: 'opened', pr, url }, error: null }] } },
  });
}

function fakeRunner(script) {
  const calls = [];
  const runFn = (cmd, args, cwd) => { calls.push({ cmd, args, cwd }); return script({ cmd, args, cwd }, calls); };
  return { runFn, calls };
}

let LANE_PATH;
beforeEach(() => { LANE_PATH = mkdtempSync(join(tmpdir(), 'hold-route-lane-')); mkdirSync(join(LANE_PATH, '.git'), { recursive: true }); });
afterEach(() => { rmSync(LANE_PATH, { recursive: true, force: true }); });

describe('refFor', () => {
  it('is stable for a given num — the same ref every attempt targets (open-pr\'s own same-ref idempotency)', () => {
    expect(refFor('4380')).toBe('lane/hold-route-4380');
    expect(refFor('4380')).toBe(refFor('4380'));
  });
});

describe('findCardFileName', () => {
  it('finds the one file that starts with `<num>-`', () => {
    const names = ['4380-review-quota-holds.md', '4295-builder-scope.md'];
    expect(findCardFileName(names, '4380')).toBe('4380-review-quota-holds.md');
  });
  it('null when nothing matches, or the list is empty/not an array', () => {
    expect(findCardFileName(['4295-x.md'], '4380')).toBeNull();
    expect(findCardFileName([], '4380')).toBeNull();
    expect(findCardFileName(null, '4380')).toBeNull();
  });
});

describe('clearScopeAndAppendFinding', () => {
  const card = [
    '---', 'bornAs: xyz', 'scope: ["we:a.mjs", "we:b.mjs"]', 'status: active', '---', '',
    '# A title', '', 'Body text.', '',
  ].join('\n');

  it('clears the scope: line to [] (making the card "unshaped" for dispatch-plan\'s own auto-prepare)', () => {
    const out = clearScopeAndAppendFinding(card, { num: '4295', reason: 'not buildable', today: '2026-09-29' });
    expect(out).toMatch(/^scope: \[\]$/m);
    expect(out).not.toMatch(/we:a\.mjs/);
  });

  it('appends a Held finding section naming the item and the reason', () => {
    const out = clearScopeAndAppendFinding(card, { num: '4295', reason: 'not buildable as written', today: '2026-09-29' });
    expect(out).toMatch(/## Held finding — auto-routed by #4465 \(2026-09-29\)/);
    expect(out).toMatch(/#4295/);
    expect(out).toMatch(/not buildable as written/);
  });

  it('leaves the rest of the card body intact', () => {
    const out = clearScopeAndAppendFinding(card, { num: '4295', reason: 'x' });
    expect(out).toMatch(/# A title/);
    expect(out).toMatch(/Body text\./);
  });
});

describe('commitReferencesItem', () => {
  it('matches a numeric id in the #<id> shape this repo\'s own commit convention uses', () => {
    expect(commitReferencesItem('WE #4465: does the thing', ['4465'])).toBe(true);
    expect(commitReferencesItem('backlog: resolve #4464 (landed in #2924)', ['4464'])).toBe(true);
  });

  it('matches a bornAs hash the same way', () => {
    expect(commitReferencesItem('fix(review-pr): quota-holds, #x5s8b47', ['4380', 'x5s8b47'])).toBe(true);
  });

  it('does not match a real but unrelated id, or a substring/prefix collision', () => {
    expect(commitReferencesItem('chore: cleanup, #9999', ['4465'])).toBe(false);
    expect(commitReferencesItem('fixes #44650 by accident', ['4465'])).toBe(false); // #4465 is a prefix, not a match
  });

  it('never throws on empty/null ids or message', () => {
    expect(commitReferencesItem(null, ['4465'])).toBe(false);
    expect(commitReferencesItem('WE #4465: x', [null, undefined, ''])).toBe(false);
    expect(commitReferencesItem('WE #4465: x', [])).toBe(false);
  });

  // #4465 review round 3 (live security finding) — `bornAs` is untrusted, card-file-supplied text; an
  // unescaped id fed straight into `new RegExp(...)` lets a metacharacter-laden id either match almost
  // anything or throw on an invalid pattern.
  it('treats a regex-metacharacter-laden id as a LITERAL string, never as a pattern (no false-positive '
    + 'match, no throw)', () => {
    expect(commitReferencesItem('chore: totally unrelated, #9999', ['4465', '.*'])).toBe(false);
    expect(() => commitReferencesItem('anything at all', ['4465', '('])).not.toThrow();
    expect(commitReferencesItem('anything at all', ['4465', '('])).toBe(false);
  });
});

describe('extractBornAs', () => {
  it('reads the bornAs hash out of a card\'s frontmatter', () => {
    expect(extractBornAs('---\nbornAs: xs7cyyh\nstatus: open\n---\n')).toBe('xs7cyyh');
  });

  it('null when absent or the text is not parseable', () => {
    expect(extractBornAs('---\nstatus: open\n---\n')).toBeNull();
    expect(extractBornAs(null)).toBeNull();
    expect(extractBornAs('')).toBeNull();
  });
});

describe('landOne — route "already-done"', () => {
  it('runs backlog.mjs resolve --graduated-to=<commit>, commits, pushes the stable ref, verifies, opens the PR', () => {
    const { runFn, calls } = fakeRunner(({ cmd, args }) => {
      if (args.includes('resolve')) return '';
      if (cmd === 'git' && args[0] === 'log') return 'WE #4380: fix(review-pr): judgeAdvisory quota-holds, #x5s8b47\n';
      if (cmd === 'git' && args[0] === 'show') return 'scripts/review-job.mjs\n';
      if (cmd === 'git') return '';
      if (args.some((a) => a === 'verify' || String(a).startsWith('--checkout='))) return '';
      if (args.includes('open-pr')) return fakeOpenPrResult(4501, 'https://github.com/x/y/pull/4501');
      return '';
    });
    const acquireFn = () => ({ path: LANE_PATH, lane: 37, holder: 'sess-1' });
    const releaseFn = () => {};
    const result = landOne({ num: '4380', route: 'already-done', commit: 'b93d13e29' }, { runFn, acquireFn, releaseFn });
    expect(result).toEqual({ status: 'landed', pr: 4501, prUrl: 'https://github.com/x/y/pull/4501' });

    const resolveCall = calls.find((c) => c.args.includes('resolve'));
    expect(resolveCall.args).toEqual(expect.arrayContaining(['4380', '--graduated-to=b93d13e29']));
    expect(resolveCall.cwd).toBe(LANE_PATH); // never REPO_ROOT — everything lands in the lane
    const pushCall = calls.find((c) => c.cmd === 'git' && c.args[0] === 'push');
    expect(pushCall.args).toEqual(expect.arrayContaining(['HEAD:refs/heads/lane/hold-route-4380']));
    const openPrCall = calls.find((c) => c.args.includes('open-pr'));
    expect(openPrCall.args).toEqual(expect.arrayContaining(['--ref=lane/hold-route-4380', '--mode=label-on-green']));
  });

  it('requires a commit — refuses rather than resolving with an empty graduatedTo', () => {
    const acquireFn = () => ({ path: LANE_PATH, lane: 37, holder: 'sess-1' });
    const result = landOne({ num: '4380', route: 'already-done', commit: null }, { runFn: () => '', acquireFn, releaseFn: () => {} });
    expect(result.status).toBe('failed');
    expect(result.error).toMatch(/requires a cited commit/);
  });
});

describe('landOne — route "out-of-scope"', () => {
  it('clears scope + appends the finding on the real card file, commits, pushes, verifies, opens the PR', () => {
    mkdirSync(join(LANE_PATH, 'backlog'), { recursive: true });
    const cardPath = join(LANE_PATH, 'backlog', '4295-builder-scope.md');
    writeFileSync(cardPath, '---\nscope: ["we:a.mjs"]\n---\n\n# T\n\nBody.\n');

    const { runFn, calls } = fakeRunner(({ cmd, args }) => {
      if (cmd === 'git') return '';
      if (args.includes('verify')) return '';
      if (args.includes('open-pr')) return fakeOpenPrResult(4502, 'https://github.com/x/y/pull/4502');
      return '';
    });
    const acquireFn = () => ({ path: LANE_PATH, lane: 37, holder: 'sess-1' });
    const result = landOne({ num: '4295', route: 'out-of-scope', reason: 'not buildable' }, { runFn, acquireFn, releaseFn: () => {} });

    expect(result).toEqual({ status: 'landed', pr: 4502, prUrl: 'https://github.com/x/y/pull/4502' });
    const written = readFileSync(cardPath, 'utf8');
    expect(written).toMatch(/^scope: \[\]$/m);
    expect(written).toMatch(/Held finding/);
    const pushCall = calls.find((c) => c.cmd === 'git' && c.args[0] === 'push');
    expect(pushCall.args).toEqual(expect.arrayContaining(['HEAD:refs/heads/lane/hold-route-4295']));
  });

  it('fails cleanly when no card file matches the num', () => {
    mkdirSync(join(LANE_PATH, 'backlog'), { recursive: true });
    const acquireFn = () => ({ path: LANE_PATH, lane: 37, holder: 'sess-1' });
    const result = landOne({ num: '9999', route: 'out-of-scope', reason: 'x' }, { runFn: () => '', acquireFn, releaseFn: () => {} });
    expect(result.status).toBe('failed');
    expect(result.error).toMatch(/no backlog card found/);
  });
});

describe('landOne — always releases the lane, even on failure', () => {
  it('a thrown mid-arc error still releases the acquired lane', () => {
    let released = false;
    const acquireFn = () => ({ path: LANE_PATH, lane: 37, holder: 'sess-1' });
    const releaseFn = () => { released = true; };
    const runFn = () => { throw new Error('boom'); };
    const result = landOne({ num: '4380', route: 'already-done', commit: 'b93d13e29' }, { runFn, acquireFn, releaseFn });
    expect(result.status).toBe('failed');
    expect(released).toBe(true);
  });
});

describe('landOne — an unroutable route never acquires a lane at all', () => {
  it("route 'other' refuses immediately — that route never lands here", () => {
    let acquired = false;
    const result = landOne({ num: '9001', route: 'other' }, { acquireFn: () => { acquired = true; return { path: LANE_PATH }; } });
    expect(result.status).toBe('failed');
    expect(acquired).toBe(false);
  });
});

describe('landRoute — NEVER releases the build-dispatch hold or the router\'s own dedup lease, even on a '
  + 'successful land — landOne reaching \'landed\' means only that the PR OPENED, not that it merged', () => {
  it('a landed result is returned unchanged; landRoute performs no release side effect at all', () => {
    const { runFn, calls } = fakeRunner(({ cmd, args }) => {
      if (cmd === 'git' && args[0] === 'log') return 'WE #4380: does the thing\n';
      if (cmd === 'git' && args[0] === 'show') return 'scripts/review-job.mjs\n';
      if (args.includes('open-pr')) return fakeOpenPrResult(4501, 'https://github.com/x/y/pull/4501');
      return '';
    });
    const acquireFn = () => ({ path: LANE_PATH, lane: 37, holder: 'sess-1' });
    const result = landRoute({ num: '4380', route: 'already-done', commit: 'b93d13e29' }, { runFn, acquireFn, releaseFn: () => {} });
    expect(result).toEqual({ status: 'landed', pr: 4501, prUrl: 'https://github.com/x/y/pull/4501' });
    // Nothing named 'release' (a build-dispatch-hold release or a route-lease release) ever ran through the
    // injected runFn — the only releases in this arc are lane-pool's own (acquireFn/releaseFn), never these.
    expect(calls.some((c) => /release/i.test(JSON.stringify(c.args)))).toBe(false);
  });

  it('a failed result is likewise returned unchanged — landRoute performs no release side effect on this '
    + 'layer either way; a failed landing (as opposed to a spawn that never started) is a known, accepted '
    + 'MVP gap this layer never retries on its own', () => {
    const runFn = () => { throw new Error('boom'); };
    const acquireFn = () => ({ path: LANE_PATH, lane: 37, holder: 'sess-1' });
    const result = landRoute({ num: '4380', route: 'already-done', commit: 'b93d13e29' }, { runFn, acquireFn, releaseFn: () => {} });
    expect(result.status).toBe('failed');
  });
});

describe('landOne — route "already-done" verifies the cited commit before resolving (never trust the '
  + 'build agent\'s free-text citation blind)', () => {
  it('refuses and never calls backlog.mjs resolve when the cited commit is not a verified ancestor of '
    + 'origin/main (a hallucinated sha, or a real sha on some other, unmerged branch)', () => {
    const { runFn, calls } = fakeRunner(({ cmd, args }) => {
      if (cmd === 'git' && args[0] === 'merge-base') throw new Error("fatal: not a valid object name deadbeef\nfatal: Not a valid commit name deadbeef");
      if (cmd === 'git') return '';
      return '';
    });
    const acquireFn = () => ({ path: LANE_PATH, lane: 37, holder: 'sess-1' });
    const result = landOne({ num: '4380', route: 'already-done', commit: 'deadbeef' }, { runFn, acquireFn, releaseFn: () => {} });
    expect(result.status).toBe('failed');
    expect(result.error).toMatch(/not a verified ancestor of origin\/main/);
    expect(calls.some((c) => c.args.includes('resolve'))).toBe(false);
  });

  it('checks the cited commit against origin/main before resolving, on a real citation', () => {
    const { runFn, calls } = fakeRunner(({ cmd, args }) => {
      if (args.includes('resolve')) return '';
      if (cmd === 'git' && args[0] === 'log') return 'WE #4380: does the thing\n';
      if (cmd === 'git' && args[0] === 'show') return 'scripts/review-job.mjs\n';
      if (cmd === 'git') return '';
      if (args.includes('open-pr')) return fakeOpenPrResult(4501, 'https://github.com/x/y/pull/4501');
      return '';
    });
    const acquireFn = () => ({ path: LANE_PATH, lane: 37, holder: 'sess-1' });
    const result = landOne({ num: '4380', route: 'already-done', commit: 'b93d13e29' }, { runFn, acquireFn, releaseFn: () => {} });
    expect(result.status).toBe('landed');
    const mergeBaseCall = calls.find((c) => c.cmd === 'git' && c.args[0] === 'merge-base');
    expect(mergeBaseCall.args).toEqual(expect.arrayContaining(['--is-ancestor', 'b93d13e29', 'origin/main']));
    // the ancestor check runs BEFORE the resolve — never resolve first and verify after the fact.
    const resolveIdx = calls.findIndex((c) => c.args.includes('resolve'));
    expect(calls.indexOf(mergeBaseCall)).toBeLessThan(resolveIdx);
  });

  it('refuses when the cited commit is a REAL ancestor of origin/main but its own message never '
    + 'references this card — an unrelated-but-real citation, not merely a hallucinated one', () => {
    const { runFn, calls } = fakeRunner(({ cmd, args }) => {
      if (cmd === 'git' && args[0] === 'log') return 'chore: totally unrelated cleanup, #9999\n';
      if (cmd === 'git') return '';
      return '';
    });
    const acquireFn = () => ({ path: LANE_PATH, lane: 37, holder: 'sess-1' });
    const result = landOne({ num: '4380', route: 'already-done', commit: 'b93d13e29' }, { runFn, acquireFn, releaseFn: () => {} });
    expect(result.status).toBe('failed');
    expect(result.error).toMatch(/never references #4380/);
    expect(calls.some((c) => c.args.includes('resolve'))).toBe(false);
  });

  it('accepts a citation whose message names the card\'s bornAs hash instead of its numeric id — the '
    + 'shape every commit that landed BEFORE this card was JIT-numbered actually has', () => {
    mkdirSync(join(LANE_PATH, 'backlog'), { recursive: true });
    writeFileSync(join(LANE_PATH, 'backlog', '4380-review-quota-holds.md'), '---\nbornAs: x5s8b47\n---\n\n# T\n');
    const { runFn, calls } = fakeRunner(({ cmd, args }) => {
      if (args.includes('resolve')) return '';
      if (cmd === 'git' && args[0] === 'log') return 'fix(review-pr): judgeAdvisory quota-holds, #x5s8b47\n';
      if (cmd === 'git' && args[0] === 'show') return 'scripts/review-job.mjs\n';
      if (cmd === 'git') return '';
      if (args.includes('open-pr')) return fakeOpenPrResult(4501, 'https://github.com/x/y/pull/4501');
      return '';
    });
    const acquireFn = () => ({ path: LANE_PATH, lane: 37, holder: 'sess-1' });
    const result = landOne({ num: '4380', route: 'already-done', commit: 'b93d13e29' }, { runFn, acquireFn, releaseFn: () => {} });
    expect(result.status).toBe('landed');
    expect(calls.some((c) => c.args.includes('resolve'))).toBe(true);
  });

  it('refuses when the cited commit references this card but touches ONLY backlog/ files — a purely '
    + 'bookkeeping citation (a filing, a resolve splice, a JIT-numbering commit), not an implementation', () => {
    const { runFn, calls } = fakeRunner(({ cmd, args }) => {
      if (cmd === 'git' && args[0] === 'log') return 'backlog: file #4380 (a placeholder card)\n';
      if (cmd === 'git' && args[0] === 'show') return 'backlog/4380-review-quota-holds.md\n';
      if (cmd === 'git') return '';
      return '';
    });
    const acquireFn = () => ({ path: LANE_PATH, lane: 37, holder: 'sess-1' });
    const result = landOne({ num: '4380', route: 'already-done', commit: 'b93d13e29' }, { runFn, acquireFn, releaseFn: () => {} });
    expect(result.status).toBe('failed');
    expect(result.error).toMatch(/touches only backlog\/ files/);
    expect(calls.some((c) => c.args.includes('resolve'))).toBe(false);
  });
});

describe('commitTouchesNonBacklogFile', () => {
  it('true when at least one changed path is outside backlog/', () => {
    expect(commitTouchesNonBacklogFile(['backlog/4380-x.md', 'scripts/review-job.mjs'])).toBe(true);
    expect(commitTouchesNonBacklogFile('backlog/4380-x.md\nscripts/review-job.mjs\n')).toBe(true);
  });

  it('false when every changed path is under backlog/, or the list is empty', () => {
    expect(commitTouchesNonBacklogFile(['backlog/4380-x.md'])).toBe(false);
    expect(commitTouchesNonBacklogFile([])).toBe(false);
    expect(commitTouchesNonBacklogFile('')).toBe(false);
  });
});
