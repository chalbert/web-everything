/**
 * @file sweep-orphan-backlog-cards.test.mjs — #4317 follow-up. The sweep that lands the BACKLOG of orphans the
 * pre-#4317 filing path left behind in a daemon clone. Every subprocess call is a scripted stub (`exec`), same
 * no-fs/no-subprocess convention `land-prevention-card.test.mjs` already uses — no real `node`, `git`,
 * `lane-pool.mjs` or `gh` runs here.
 */
import { describe, it, expect } from 'vitest';
import {
  parseOrphanCard, selectOrphanSurvivors, listUntrackedBacklogCards, readMainDedupeSets, queueLandedSurvivors,
  buildSweepCommitMessage, buildSweepPrBody, sweepOrphanBacklogCards, parseSweepArgv, runSweepOrphanBacklogCardsCli,
} from '../sweep-orphan-backlog-cards.mjs';

// A real orphan's shape (#4317 approval-time filer): idempotency key, one guard.
const APPROVAL_CARD = (pr, sha, guard = 'Add the missing regression test.') => `---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/a.mjs"]
dateOpened: "2026-09-28"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#${pr}'s independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. \`we:scripts/a.mjs\` — ${guard}

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#${pr}@${sha}

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
`;

// A real orphan's shape (#2749 unattended-review-loop filer): no idempotency key, title-only source.
const LOOP_CARD = (pr, sha, guard = 'Add a concurrency test.') => `---
kind: story
size: 3
status: open
scope: ["we:scripts/b.mjs"]
dateOpened: "2026-09-27"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#${pr}'s independent review

Filed mechanically by the unattended review loop (#2749) — every finding below reduced chalbert/web-everything#${pr}'s review (reviewed head \`${sha}\`) to prevention-outstanding by naming a guard neither captured nor filed:

1. \`we:scripts/b.mjs\` — ${guard}

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
`;

describe('parseOrphanCard', () => {
  it('reads the approval-time shape: hashId, status, kind, sourceRef from the idempotency key', () => {
    const c = parseOrphanCard('backlog/xab12cd-file-the-prevention.md', APPROVAL_CARD(2900, 'deadbeef'));
    expect(c.hashId).toBe('xab12cd');
    expect(c.status).toBe('open');
    expect(c.kind).toBe('story');
    expect(c.sourceRef).toBe('chalbert/web-everything#2900');
  });

  it('reads the review-loop shape: no idempotency key, sourceRef falls back to the title', () => {
    const c = parseOrphanCard('backlog/xef34gh-file-the-prevention.md', LOOP_CARD(2821, 'cafef00d'));
    expect(c.sourceRef).toBe('chalbert/web-everything#2821');
  });

  it('two cards for the SAME PR + SAME guard hash identically; a different guard hashes differently', () => {
    const a = parseOrphanCard('backlog/xaaaaaa-x.md', APPROVAL_CARD(100, 'sha1', 'Add test A.'));
    const b = parseOrphanCard('backlog/xbbbbbb-x.md', APPROVAL_CARD(100, 'sha2', 'Add test A.'));
    const c = parseOrphanCard('backlog/xcccccc-x.md', APPROVAL_CARD(100, 'sha3', 'Add DIFFERENT test.'));
    expect(a.digestHash).toBe(b.digestHash); // different head sha, same guard text → same debt
    expect(a.digestHash).not.toBe(c.digestHash);
  });

  it('a card with no recognizable hash-id filename gets a null hashId, never throws', () => {
    const c = parseOrphanCard('backlog/weird-name.md', APPROVAL_CARD(1, 's'));
    expect(c.hashId).toBeNull();
  });
});

describe('selectOrphanSurvivors', () => {
  it('drops an orphan whose hashId already carries a bornAs card on main', () => {
    const cards = [parseOrphanCard('backlog/xab12cd-a.md', APPROVAL_CARD(1, 's1'))];
    const { survivors, dropped } = selectOrphanSurvivors(cards, { mainBornAsIds: new Set(['xab12cd']) });
    expect(survivors).toEqual([]);
    expect(dropped).toHaveLength(1);
    expect(dropped[0].reason).toMatch(/bornAs: xab12cd/);
  });

  it('drops an orphan whose source PR already has a card on main, even with no bornAs match', () => {
    const cards = [parseOrphanCard('backlog/xzzzzzz-a.md', APPROVAL_CARD(42, 's1'))];
    const { survivors, dropped } = selectOrphanSurvivors(cards, { mainSourceRefs: new Set(['chalbert/web-everything#42']) });
    expect(survivors).toEqual([]);
    expect(dropped[0].reason).toMatch(/covers chalbert\/web-everything#42/);
  });

  it('among orphans, keeps the alphabetically-first of two citing the SAME PR + SAME guard, drops the other', () => {
    const cards = [
      parseOrphanCard('backlog/xbbbbbb-a.md', APPROVAL_CARD(7, 'sha2', 'Same guard.')),
      parseOrphanCard('backlog/xaaaaaa-a.md', APPROVAL_CARD(7, 'sha1', 'Same guard.')),
    ];
    const { survivors, dropped } = selectOrphanSurvivors(cards, {});
    expect(survivors.map((s) => s.rel)).toEqual(['backlog/xaaaaaa-a.md']);
    expect(dropped).toHaveLength(1);
    expect(dropped[0].rel).toBe('backlog/xbbbbbb-a.md');
    expect(dropped[0].duplicateOf).toBe('backlog/xaaaaaa-a.md');
  });

  it('keeps BOTH orphans that cite the same PR but a genuinely different guard', () => {
    const cards = [
      parseOrphanCard('backlog/xaaaaaa-a.md', APPROVAL_CARD(7, 'sha1', 'Guard one.')),
      parseOrphanCard('backlog/xbbbbbb-a.md', APPROVAL_CARD(7, 'sha2', 'Guard two.')),
    ];
    const { survivors, dropped } = selectOrphanSurvivors(cards, {});
    expect(survivors.map((s) => s.rel).sort()).toEqual(['backlog/xaaaaaa-a.md', 'backlog/xbbbbbb-a.md']);
    expect(dropped).toEqual([]);
  });

  it('a clean clone (nothing matches, nothing duplicates) survives whole', () => {
    const cards = [
      parseOrphanCard('backlog/xaaaaaa-a.md', APPROVAL_CARD(1, 's1')),
      parseOrphanCard('backlog/xbbbbbb-a.md', LOOP_CARD(2, 's2')),
    ];
    const { survivors, dropped } = selectOrphanSurvivors(cards, { mainBornAsIds: new Set(['xzzzzzz']) });
    expect(survivors).toHaveLength(2);
    expect(dropped).toEqual([]);
  });
});

describe('listUntrackedBacklogCards', () => {
  it('parses `git status --porcelain` output, skipping tracked/modified entries and non-hash-id paths', () => {
    const status = [
      '?? backlog/xab12cd-file-the-prevention.md',
      ' M backlog/4200-existing.md', // tracked, modified — never an "orphan"
      '?? backlog/not-a-hash-id.md', // untracked but not the hash-id shape — out of scope
      '?? scripts/some-other-file.mjs', // untracked, not under backlog/
    ].join('\n');
    const exec = (cmd, args) => {
      expect(cmd).toBe('git');
      expect(args).toEqual(['-C', '/clone', 'status', '--porcelain', '--untracked-files=all', '--', 'backlog']);
      return status;
    };
    const readFile = (p) => { expect(p).toBe('/clone/backlog/xab12cd-file-the-prevention.md'); return 'CONTENT'; };
    const out = listUntrackedBacklogCards('/clone', { exec, readFile });
    expect(out).toEqual([{ rel: 'backlog/xab12cd-file-the-prevention.md', content: 'CONTENT' }]);
  });

  it('NEVER shells anything but the one read-only `git status` call — no add/commit path exists in this function', () => {
    const calls = [];
    const exec = (cmd, args) => { calls.push([cmd, args]); return ''; };
    listUntrackedBacklogCards('/clone', { exec, readFile: () => '' });
    expect(calls).toHaveLength(1);
    expect(calls[0][1]).not.toContain('add');
    expect(calls[0][1]).not.toContain('commit');
  });
});

describe('readMainDedupeSets', () => {
  it('reads bornAs ids and title-derived source refs off two `git grep` passes over origin/main', () => {
    const calls = [];
    const exec = (cmd, args) => {
      calls.push(args);
      if (args.includes('^bornAs:')) return 'bornAs: x21soye\nbornAs: x3qp94j\n';
      return "# File the prevention guard(s) owed by chalbert/web-everything#2807's independent review\n";
    };
    const { mainBornAsIds, mainSourceRefs } = readMainDedupeSets({ exec });
    expect(mainBornAsIds).toEqual(new Set(['x21soye', 'x3qp94j']));
    expect(mainSourceRefs).toEqual(new Set(['chalbert/web-everything#2807']));
    expect(calls.every((a) => a[0] === 'grep' && a.includes('origin/main'))).toBe(true);
  });

  it('a `git grep` with zero matches (exit 1, empty stdout) reads as an empty set, never an error', () => {
    const exec = () => { const e = new Error('exit 1'); e.stdout = ''; throw e; };
    const { mainBornAsIds, mainSourceRefs } = readMainDedupeSets({ exec });
    expect(mainBornAsIds.size).toBe(0);
    expect(mainSourceRefs.size).toBe(0);
  });
});

describe('queueLandedSurvivors', () => {
  it('clears an open story/task by hashId, skips an already-queued one, skips epic/decision kinds', () => {
    const survivors = [
      { hashId: 'xaaaaaa', kind: 'story', status: 'open' },
      { hashId: 'xbbbbbb', kind: 'story', status: 'open' }, // already queued
      { hashId: 'xccccccc', kind: 'epic', status: 'open' }, // never dispatchable
      { hashId: null, kind: 'story', status: 'open' }, // no id to queue by
    ];
    let written = null;
    const queued = queueLandedSurvivors(survivors, {
      read: () => [{ num: 'xbbbbbb', addedAt: null }],
      writeQ: (q) => { written = q; },
      has: (q, id) => q.some((e) => e.num === id),
      add: (q, id) => [...q, { num: id, addedAt: 't' }],
      queuePath: () => '/fake/queue.json',
      now: () => 't',
    });
    expect(queued).toEqual(['xaaaaaa']);
    expect(written).toEqual([{ num: 'xbbbbbb', addedAt: null }, { num: 'xaaaaaa', addedAt: 't' }]);
  });

  it('never writes the sidecar when nothing changed', () => {
    let wrote = false;
    queueLandedSurvivors([{ hashId: 'xaaaaaa', kind: 'story', status: 'open' }], {
      read: () => [{ num: 'xaaaaaa' }],
      writeQ: () => { wrote = true; },
      has: () => true,
      add: (q) => q,
      queuePath: () => '/fake/queue.json',
    });
    expect(wrote).toBe(false);
  });
});

describe('buildSweepCommitMessage / buildSweepPrBody', () => {
  it('the commit message carries the attribution line and every survivor rel (or a bounded summary)', () => {
    const survivors = [{ rel: 'backlog/xaaaaaa-a.md' }, { rel: 'backlog/xbbbbbb-b.md' }];
    const msg = buildSweepCommitMessage(survivors, '/clone');
    expect(msg).toContain('Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>');
    expect(msg).toContain('backlog/xaaaaaa-a.md');
    expect(msg).toContain('backlog/xbbbbbb-b.md');
  });

  it('the PR body names both what landed and what was dropped, with its reason', () => {
    const survivors = [{ rel: 'backlog/xaaaaaa-a.md' }];
    const dropped = [{ rel: 'backlog/xbbbbbb-b.md', reason: 'already landed on origin/main (a card there carries bornAs: xbbbbbb)' }];
    const body = buildSweepPrBody(survivors, dropped, '/clone');
    expect(body).toContain('backlog/xaaaaaa-a.md');
    expect(body).toContain('backlog/xbbbbbb-b.md');
    expect(body).toContain('bornAs: xbbbbbb');
  });
});

// ── The full orchestration, scripted exec — mirrors land-prevention-card.test.mjs's own harness. ──────────────

function scriptedExec(steps) {
  let i = 0;
  const calls = [];
  const exec = (cmd, args, opts) => {
    calls.push({ cmd, args, opts });
    const step = steps[i];
    i += 1;
    if (!step) throw new Error(`scriptedExec: no step scripted for call #${i} (${cmd} ${args.join(' ')})`);
    if (typeof step === 'function') return step(cmd, args, opts);
    if (step instanceof Error) throw step;
    return step;
  };
  return { exec, calls };
}

const ACQUIRE_OK = JSON.stringify({ lane: 9, path: '/workspace/.lanes/web-everything/lane-9', session: 's', holder: 'h' });
const VERIFY_GREEN = JSON.stringify({ verdict: { ok: true, passed: 3, failed: 0, unrun: 0, blocking: [] } });
const VERIFY_RED = JSON.stringify({ verdict: { ok: false, blocking: ['vitest'] } });
const OPEN_PR_OPENED = JSON.stringify({
  findings: { submit: { effects: [{ result: { outcome: 'opened', pr: 7777, url: 'https://github.com/chalbert/web-everything/pull/7777' } }] } },
});

const ONE_CARD = () => [{ rel: 'backlog/xab12cd-a.md', content: APPROVAL_CARD(500, 'sha500') }];

describe('sweepOrphanBacklogCards — the real scan → dedupe → lane → commit → verify → open-pr → release sequence', () => {
  it('nothing to land: an all-duplicate clone never acquires a lane at all', async () => {
    const { exec, calls } = scriptedExec([]); // any call at all is a test failure
    const result = await sweepOrphanBacklogCards({ clone: '/clone', session: 's' }, {
      exec, write: () => {},
      listOrphans: () => ONE_CARD(),
      readMain: () => ({ mainBornAsIds: new Set(['xab12cd']), mainSourceRefs: new Set() }),
      queueSurvivors: () => [],
    });
    expect(result.ok).toBe(true);
    expect(result.landed).toEqual([]);
    expect(result.dropped).toHaveLength(1);
    expect(calls).toHaveLength(0);
  });

  it('an empty clone (no untracked cards) is a clean no-op', async () => {
    const { exec, calls } = scriptedExec([]);
    const result = await sweepOrphanBacklogCards({ clone: '/clone', session: 's' }, {
      exec, write: () => {}, listOrphans: () => [], readMain: () => ({ mainBornAsIds: new Set(), mainSourceRefs: new Set() }),
    });
    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(0);
  });

  it('dry-run reports survivors + dropped, acquires no lane, writes nothing', async () => {
    const { exec, calls } = scriptedExec([]);
    const result = await sweepOrphanBacklogCards({ clone: '/clone', session: 's', dryRun: true }, {
      exec, write: () => {}, listOrphans: () => ONE_CARD(), readMain: () => ({ mainBornAsIds: new Set(), mainSourceRefs: new Set() }),
    });
    expect(result).toEqual({ ok: true, step: 'dry-run', reason: null, landed: ['backlog/xab12cd-a.md'], dropped: [], pr: null, url: null });
    expect(calls).toHaveLength(0);
  });

  it('lands one survivor: acquires a lane, copies+commits+verifies+opens the PR, queues, releases', async () => {
    const written = [];
    const queuedWith = [];
    const { exec, calls } = scriptedExec([ACQUIRE_OK, 'added', 'committed', VERIFY_GREEN, OPEN_PR_OPENED, 'released']);
    const result = await sweepOrphanBacklogCards({ clone: '/clone', session: 'sweep-s' }, {
      exec, write: () => {},
      listOrphans: () => ONE_CARD(),
      readMain: () => ({ mainBornAsIds: new Set(), mainSourceRefs: new Set() }),
      queueSurvivors: (survivors) => { queuedWith.push(...survivors); return survivors.map((s) => s.hashId); },
      mkTmp: () => '/tmp/sweep-x', rmTmp: () => {}, writeFile: (p, c) => written.push({ p, c }),
    });
    expect(result).toEqual({ ok: true, step: 'done', reason: null, landed: ['backlog/xab12cd-a.md'], dropped: [], pr: 7777, url: 'https://github.com/chalbert/web-everything/pull/7777' });

    // acquire — a real lane.
    expect(calls[0].args[0]).toMatch(/scripts[/\\]lane-pool\.mjs$/);
    expect(calls[0].args.slice(1)).toEqual(['acquire', '--purpose=orphan-card-sweep', '--session=sweep-s', '--json']);
    // the survivor's content was copied byte-for-byte into the LANE (never touching /clone).
    expect(written.some((w) => w.p === '/workspace/.lanes/web-everything/lane-9/backlog/xab12cd-a.md' && w.c === APPROVAL_CARD(500, 'sha500'))).toBe(true);
    // add — exactly the one survivor path, in the lane.
    expect(calls[1].cmd).toBe('git');
    expect(calls[1].args).toEqual(['-C', '/workspace/.lanes/web-everything/lane-9', 'add', '--', 'backlog/xab12cd-a.md']);
    // commit — one commit, in the lane.
    expect(calls[2].args).toContain('commit');
    // verify — the LANE's own run.mjs, mode=run.
    expect(calls[3].args[0]).toBe('/workspace/.lanes/web-everything/lane-9/scripts/operations/run.mjs');
    expect(calls[3].args).toContain('verify');
    expect(calls[3].args).toContain('--mode=run');
    // open-pr — label-on-green, one PR for the whole batch.
    expect(calls[4].args).toContain('open-pr');
    expect(calls[4].args).toContain('--mode=label-on-green');
    // release — always, by lane number.
    expect(calls[5].args).toEqual(expect.arrayContaining(['release', '--lane=9', '--session=sweep-s']));
    // the conveyor queue-clear ran with the survivor, best-effort.
    expect(queuedWith).toHaveLength(1);
  });

  it('a red gate fails the sweep, never opens a PR, and STILL releases the lane', async () => {
    const { exec, calls } = scriptedExec([ACQUIRE_OK, 'added', 'committed', VERIFY_RED, 'released']);
    const result = await sweepOrphanBacklogCards({ clone: '/clone', session: 's' }, {
      exec, write: () => {}, listOrphans: () => ONE_CARD(), readMain: () => ({ mainBornAsIds: new Set(), mainSourceRefs: new Set() }),
      mkTmp: () => '/tmp/x', rmTmp: () => {}, writeFile: () => {},
    });
    expect(result.ok).toBe(false);
    expect(result.step).toBe('verify');
    expect(calls.at(-1).args).toEqual(expect.arrayContaining(['release', '--lane=9']));
    expect(calls.some((c) => c.args.includes('open-pr'))).toBe(false);
  });

  it('a refused acquire fails cleanly with no lane to release', async () => {
    const { exec, calls } = scriptedExec([new Error('lane pool exhausted')]);
    const result = await sweepOrphanBacklogCards({ clone: '/clone', session: 's' }, {
      exec, write: () => {}, listOrphans: () => ONE_CARD(), readMain: () => ({ mainBornAsIds: new Set(), mainSourceRefs: new Set() }),
    });
    expect(result.ok).toBe(false);
    expect(result.step).toBe('acquire');
    expect(calls).toHaveLength(1); // no release call — nothing was ever acquired
  });
});

describe('parseSweepArgv', () => {
  it('requires --clone, defaults session + dry-run', () => {
    expect(() => parseSweepArgv([])).toThrow(/--clone=/);
    const parsed = parseSweepArgv(['--clone=/workspace/wev-review-daemon']);
    expect(parsed.clone).toBe('/workspace/wev-review-daemon');
    expect(parsed.session).toMatch(/^orphan-card-sweep-/);
    expect(parsed.dryRun).toBe(false);
  });

  it('reads an explicit session and dry-run flag', () => {
    const parsed = parseSweepArgv(['--clone=/c', '--session=my-session', '--dry-run=true']);
    expect(parsed.session).toBe('my-session');
    expect(parsed.dryRun).toBe(true);
  });
});

describe('runSweepOrphanBacklogCardsCli', () => {
  it('exits 1 with no sweep call at all on a missing --clone', async () => {
    let sweepCalled = false;
    const { code } = await runSweepOrphanBacklogCardsCli([], {
      sweep: () => { sweepCalled = true; }, write: () => {}, writeErr: () => {},
    });
    expect(code).toBe(1);
    expect(sweepCalled).toBe(false);
  });

  it('exits 0 and reports counts on a successful sweep', async () => {
    const { code, result } = await runSweepOrphanBacklogCardsCli(['--clone=/c'], {
      sweep: async () => ({ ok: true, step: 'done', reason: null, landed: ['a', 'b'], dropped: ['c'], pr: 42, url: 'u' }),
      write: () => {}, writeErr: () => {},
    });
    expect(code).toBe(0);
    expect(result.pr).toBe(42);
  });

  it('exits 1 on a failed sweep', async () => {
    const { code } = await runSweepOrphanBacklogCardsCli(['--clone=/c'], {
      sweep: async () => ({ ok: false, step: 'verify', reason: 'gate red', landed: [], dropped: [] }),
      write: () => {}, writeErr: () => {},
    });
    expect(code).toBe(1);
  });
});
