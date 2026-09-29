/**
 * agy-launcher-probation (#4291) — the doc-fix BUILD arc of `probation-build-run.mjs` over a fake `io` (no git,
 * no gh, no model). Mirrors `probation-heal-run.test.mjs`'s own fake-io shape and coverage, adapted to a build's
 * two extra facts a heal never has: it CLAIMS/RESOLVES a backlog item, and it OPENS a brand-new PR rather than
 * pushing to one that already exists.
 *
 * A plan review (Codex, read-only, #4291 fast-lane prepare) flagged that releasing the claim via
 * `backlog.mjs release` AFTER a `git reset --hard` (which already reverts the item's own status) trips the
 * `release`-only-from-`active`/`preparing` guard. The fix — relied on throughout below — is that NOTHING is
 * ever pushed on a failure path, so a plain `git reset --hard` back to the pre-claim HEAD undoes the claim
 * along with everything after it in one step; there is no separate "release the claim" call at all.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { openPrArgv, parseArgs, realIo, runProbationBuild } from '../probation-build-run.mjs';

describe('realIo().findItem — the card\'s own scope is what the arc allowlists (#4291 advisory finding)', () => {
  const withCard = (text, fn) => {
    const dir = mkdtempSync(join(tmpdir(), 'probation-build-find-'));
    try { mkdirSync(join(dir, 'backlog')); writeFileSync(join(dir, 'backlog', '4291-x.md'), text); return fn(realIo({ session: 's' }).findItem('4291', dir)); } finally { rmSync(dir, { recursive: true, force: true }); }
  };
  it('reads an inline-array scope', () => withCard('---\nstatus: open\nscope: ["we:docs/a.md"]\n---\n\n# X\n', (item) => expect(item.scope).toEqual(['we:docs/a.md'])));
  it('reads a block-list scope', () => withCard('---\nstatus: open\nscope:\n  - we:docs/a.md\n  - we:docs/b/\n---\n\n# X\n', (item) => expect(item.scope).toEqual(['we:docs/a.md', 'we:docs/b/'])));
  it('no scope, or a non-list scope, reads as none', () => {
    withCard('---\nstatus: open\n---\n\n# X\n', (item) => expect(item.scope).toEqual([]));
    withCard('---\nstatus: open\nscope: we:docs/a.md\n---\n\n# X\n', (item) => expect(item.scope).toEqual([]));
    withCard('---\nstatus: open\nscope: ["", "  ", null]\n---\n\n# X\n', (item) => expect(item.scope).toEqual([]));
  });
});

describe('openPrArgv — every probation build PR is parked review:pending, never label-on-green (#4291 plan review round 3)', () => {
  it('carries --mode=park --parkLabel=review:pending --requireVerified=true, never label-on-green', () => {
    const argv = openPrArgv({ num: '4291', attemptTag: '', slug: 'probation-launcher', bodyFile: '/lane/.pr-body.md' });
    expect(argv).toEqual(expect.arrayContaining(['--mode=park', '--parkLabel=review:pending', '--requireVerified=true']));
    expect(argv).not.toContain('--mode=label-on-green');
    expect(argv[1]).toBe('--ref=lane/4291-probation-launcher');
  });
  it('folds a retry\'s attempt tag into the ref between the number and the slug, never elsewhere', () => {
    const argv = openPrArgv({ num: '4291', attemptTag: 'b', slug: 'probation-launcher', bodyFile: '/lane/.pr-body.md' });
    expect(argv[1]).toBe('--ref=lane/4291b-probation-launcher');
  });
});

const codex = { id: 'codex', provider: 'codex', model: 'gpt-6-astra', executor: 'codex', launcher: 'scripts/codex-direct-task.mjs', checker: null, taskType: 'doc-fix' };

/** A fake io: a claimed item whose worker diff, gate and PR-open result the test chooses. */
// The card's own `scope:` (in `raw` AND the parsed `scope`) is what bounds the worker — kept consistent with
// the happy-path numstat below, never only the dispatch's `--scope` argument (#4291 advisory finding).
const ITEM_RAW = '---\nstatus: open\nscope: ["we:backlog-docs/probation.md"]\n---\n\n## Done when\n\n1. it works.';

function fakeIo({
  itemScope = ['we:backlog-docs/probation.md'],
  lane = '/lanes/22', item = { path: 'backlog/4291-probation-launcher.md', slug: 'probation-launcher', title: 'Probation launcher', spec: '## Done when\n\n1. it works.', raw: ITEM_RAW, scope: itemScope },
  claimOk = true, numstat = '1\t20\tbacklog-docs/probation.md', gate = true, resolveOk = true, openPr: openPrResult = { ok: true, pr: 9001, url: 'https://x/9001' },
  throwOn = null, postWorkerSpec = null, postWorkerRaw = null, claimTamperedRaw = null, runWorkerOk = true,
  headShaSequence = null, throwOnHeadShaCall = null, hookResetClean = true, hookTampered = false,
} = {}) {
  const calls = [];
  const boom = (name) => { if (throwOn === name) throw new Error(`${name} exploded`); };
  let findItemCalls = 0;
  let headShaCalls = 0;
  const cleanSnapshot = { configHash: 'clean', files: {} };
  const tamperedSnapshot = { configHash: 'clean', files: { 'pre-commit': 'planted' } };
  const io = {
    log: () => {},
    acquireLane: (o) => { calls.push(['acquireLane', o.lane, o.scope]); return lane; },
    resetHookSurface: (d) => { boom('resetHookSurface'); calls.push(['reset-hooks', d]); return { clean: hookResetClean, leftover: hookResetClean ? [] : ['pre-commit'], snapshot: cleanSnapshot }; },
    snapshotHookSurface: (d) => { boom('snapshotHookSurface'); calls.push(['snapshot-hooks', d]); return hookTampered ? tamperedSnapshot : cleanSnapshot; },
    findItem: () => {
      findItemCalls += 1;
      // Call 1 is the very first read, before claim. Call 2 is the post-claim consistency check — normally a
      // no-op re-read (`claimTamperedRaw` simulates `claim` itself misbehaving). Call 3+ is the post-worker
      // check — `postWorkerSpec`/`postWorkerRaw` simulate a worker that rewrote the item's own body/frontmatter.
      if (findItemCalls === 1) return item;
      if (findItemCalls === 2) return claimTamperedRaw != null ? { ...item, raw: claimTamperedRaw } : item;
      return { ...item, spec: postWorkerSpec ?? item.spec, raw: postWorkerRaw ?? item.raw };
    },
    claim: () => { calls.push(['claim']); return claimOk; },
    // Call 1 is pre-claim, call 2 is post-claim — `headShaSequence` (e.g. `['a', 'b']`) simulates `claim`
    // itself moving HEAD (a commit), which every `abandon` path's undo assumes never happens.
    // `throwOnHeadShaCall` (e.g. `2`) throws on that ONE call only — the post-claim read after a successful claim.
    headSha: () => { boom('headSha'); headShaCalls += 1; if (headShaCalls === throwOnHeadShaCall) throw new Error('headSha exploded'); return headShaSequence ? headShaSequence[headShaCalls - 1] ?? headShaSequence.at(-1) : 'base-sha'; },
    writeTaskFile: (_d, name, text) => { calls.push(['task', name, text.length > 0]); return `/lanes/22/.git/${name}`; },
    runWorker: (argv) => { boom('runWorker'); calls.push(['worker', argv[0], argv.find((a) => a.startsWith('--model='))]); return { ok: runWorkerOk, out: runWorkerOk ? '' : 'timed out' }; },
    untracked: () => ['node_modules'],
    diffNumstat: (_d, _base, exclude) => { calls.push(['numstat', exclude]); return numstat; },
    discardChanges: (_d, base) => calls.push(['discard', base]),
    resolveItem: () => { boom('resolveItem'); calls.push(['resolve']); return resolveOk ? { ok: true } : { ok: false, reason: 'open-children' }; },
    commit: (_d, paths, msg) => { boom('commit'); calls.push(['commit', paths, msg.split('\n')[0]]); },
    runGate: () => { calls.push(['gate']); return { pass: gate, output: 'gate out' }; },
    writePrBody: () => { boom('writePrBody'); calls.push(['prBody']); return '/lanes/22/.pr-body.md'; },
    openPr: (o) => { boom('openPr'); calls.push(['openPr', o.slug, o.attemptTag]); return openPrResult; },
    appendScorecard: (r) => calls.push(['scorecard', r.launchOutcome, r.executor, r.outcome, r.verifiedBy, r.item, r.pr]),
  };
  return { io, calls };
}
// #4291 plan review round 7 — a declared scope is now REQUIRED before any worker runs (see the run script's
// own "no declared scope" refusal), so every test defaults one matching the happy-path numstat below; a test
// that needs a DIFFERENT scope (or none) overrides it via `extra.scope` (including `''`, which parses to `[]`).
const args = (worker = codex, extra = {}) => parseArgs(['--num=4291', '--session=probation-4291', `--worker=${JSON.stringify(worker)}`, '--lane=22', '--scope=we:backlog-docs/probation.md', ...Object.entries(extra).map(([k, v]) => `--${k}=${v}`)]);

describe('parseArgs', () => {
  it('parses the build-specific flags (num, attempt) and the shared ones', () => {
    const a = parseArgs(['--num=4291', '--session=s', '--attempt=b', '--worker={"id":"codex"}', '--lane=22', '--scope=we:a.mjs,we:b.mjs']);
    expect(a).toMatchObject({ num: '4291', session: 's', attemptTag: 'b', lane: 22, scope: ['we:a.mjs', 'we:b.mjs'], worker: { id: 'codex' } });
  });
  it('a first attempt has an empty attempt tag', () => expect(parseArgs(['--num=1', '--session=s']).attemptTag).toBe(''));
});

describe('runProbationBuild — the arc', () => {
  it('claim → worker builds within envelope → resolve → commit → gate green → PR opened parked, one launch row', async () => {
    const { io, calls } = fakeIo();
    const r = await runProbationBuild(args(), io);
    expect(r).toMatchObject({ outcome: 'opened-pr', executor: 'codex' });
    expect(calls.find((c) => c[0] === 'worker')).toEqual(['worker', expect.stringMatching(/scripts\/codex-direct-task\.mjs$/), '--model=gpt-6-astra']);
    expect(calls.find((c) => c[0] === 'commit')).toEqual(['commit', ['backlog-docs/probation.md', 'backlog/4291-probation-launcher.md'], expect.stringContaining('doc-fix build on probation (codex/gpt-6-astra)')]);
    expect(calls.find((c) => c[0] === 'openPr')).toEqual(['openPr', 'probation-launcher', '']);
    expect(calls.filter((c) => c[0] === 'scorecard')).toEqual([['scorecard', 'opened-pr', 'codex', null, null, '4291', 9001]]);
    expect(calls.some((c) => c[0] === 'discard')).toBe(false);
    // the untracked files that were there BEFORE the worker ran, AND the item's own file (its claim/resolve
    // bookkeeping, not the worker's change), are excluded from the diff the worker's own change is measured by.
    expect(calls.find((c) => c[0] === 'numstat')).toEqual(['numstat', ['node_modules', 'backlog/4291-probation-launcher.md']]);
  });

  it('a claim-stamp line in the raw numstat never inflates the worker\'s own diff or duplicates the commit path', async () => {
    // If the item's own file were not excluded, this numstat (as the claim/resolve bookkeeping diff would look)
    // would count as a SECOND changed file, wrongly consuming half the doc-fix envelope's file cap.
    const { io, calls } = fakeIo({ numstat: '1\t20\tbacklog-docs/probation.md\n2\t1\tbacklog/4291-probation-launcher.md' });
    const r = await runProbationBuild(args(), io);
    expect(r.outcome).toBe('opened-pr');
    expect(calls.find((c) => c[0] === 'commit')[1]).toEqual(['backlog-docs/probation.md', 'backlog/4291-probation-launcher.md']);
  });

  it('no lane available → not-applicable, before any claim', async () => {
    const { io, calls } = fakeIo();
    io.acquireLane = () => null;
    const r = await runProbationBuild(args(), io);
    expect(r.outcome).toBe('not-applicable');
    expect(calls.some((c) => c[0] === 'claim')).toBe(false);
  });

  it('no backlog file for the item → not-applicable, before any claim', async () => {
    const { io, calls } = fakeIo();
    io.findItem = () => null;
    const r = await runProbationBuild(args(), io);
    expect(r.outcome).toBe('not-applicable');
    expect(calls.some((c) => c[0] === 'claim')).toBe(false);
  });

  it('the item could not be claimed → not-applicable, no worker run, no discard, no scorecard row', async () => {
    const { io, calls } = fakeIo({ claimOk: false });
    const r = await runProbationBuild(args(), io);
    expect(r.outcome).toBe('not-applicable');
    expect(calls.some((c) => c[0] === 'worker')).toBe(false);
    expect(calls.some((c) => c[0] === 'discard')).toBe(false);
    expect(calls.some((c) => c[0] === 'scorecard')).toBe(false);
  });

  it('the worker changes nothing → not-applicable, the claim is undone by a reset, one launch row', async () => {
    const { io, calls } = fakeIo({ numstat: '' });
    const r = await runProbationBuild(args(), io);
    expect(r.outcome).toBe('not-applicable');
    expect(calls.some((c) => c[0] === 'discard')).toBe(true);
    expect(calls.find((c) => c[0] === 'scorecard')).toBeTruthy();
  });

  it('a build bigger than the doc-fix envelope is discarded, never resolved', async () => {
    const { io, calls } = fakeIo({ numstat: '60\t50\tbacklog-docs/probation.md' });
    const r = await runProbationBuild(args(), io);
    expect(r.outcome).toBe('gate-red');
    expect(r.detail).toMatch(/changed 110 lines/);
    expect(calls.some((c) => c[0] === 'discard')).toBe(true);
    expect(calls.some((c) => c[0] === 'resolve')).toBe(false);
  });

  it('a non-documentation path touched by the worker is discarded, never resolved (#4291 plan review)', async () => {
    const { io, calls } = fakeIo({ numstat: '2\t1\tscripts/lib/probation-launcher.mjs' });
    const r = await runProbationBuild(args(), io);
    expect(r.outcome).toBe('gate-red');
    expect(r.detail).toMatch(/non-documentation path.*scripts\/lib\/probation-launcher\.mjs/);
    expect(calls.some((c) => c[0] === 'discard')).toBe(true);
    expect(calls.some((c) => c[0] === 'resolve')).toBe(false);
  });

  describe('a declared scope is an ALLOWLIST, not a growing denylist (#4291 plan review rounds 4-7)', () => {
    // Rounds 4-6 tried a DENYLIST of specific dangerous paths against an unscoped item, and it kept being
    // provably incomplete (round 5 named `CLAUDE.md`, round 6 named `GEMINI.md`). Round 7 replaced the whole
    // fallback with a hard refusal on no declared scope (below) plus this allowlist — so EVERY one of these
    // "dangerous" paths is now caught the SAME way, by not being in `args().scope`, never by name.
    it('a path matching the item\'s own declared scope is built', async () => {
      const { io } = fakeIo({ numstat: '1\t20\tbacklog-docs/probation.md' });
      const r = await runProbationBuild(args(), io);
      expect(r.outcome).toBe('opened-pr');
    });
    it('a scope entry ending in `/` is a DIRECTORY prefix — every file under it is in scope (#4291 plan review round 9)', async () => {
      const { io } = fakeIo({ numstat: '1\t20\tbacklog-docs/guides/anything.md', itemScope: ['we:backlog-docs/guides/'] });
      const r = await runProbationBuild(args(codex, { scope: 'we:backlog-docs/guides/' }), io);
      expect(r.outcome).toBe('opened-pr');
    });
    it('a cross-repo scope entry (e.g. `frontierui:docs/a.md`) never allowlists a same-named WE path — this launcher only ever builds in the WE lane (#4291 plan review round 10)', async () => {
      const { io, calls } = fakeIo({ numstat: '1\t2\tdocs/a.md', itemScope: ['frontierui:docs/a.md'] });
      const r = await runProbationBuild(args(codex, { scope: 'frontierui:docs/a.md' }), io);
      expect(r.outcome).toBe('not-applicable'); // stripped to nothing → no declared (WE) scope → refused
      expect(r.detail).toMatch(/declares no scope/);
      expect(calls.some((c) => c[0] === 'worker')).toBe(false);
    });
    it.each([
      ['a different backlog card', 'backlog/9999-some-other-item.md'],
      ['the statute layer', 'docs/agent/platform-decisions.md'],
      ['CLAUDE.md', 'CLAUDE.md'],
      ['AGENTS.md', 'AGENTS.md'],
      ['a .claude/ command file', '.claude/commands/x.md'],
      ['an arbitrary unlisted .md file (GEMINI.md — round 6\'s own example; no denylist entry names it)', 'GEMINI.md'],
    ])('%s is discarded for being out of scope, even though `.md` alone would pass the doc-only check', async (_label, path) => {
      const { io, calls } = fakeIo({ numstat: `2\t1\t${path}` });
      const r = await runProbationBuild(args(), io);
      expect(r.outcome).toBe('gate-red');
      expect(r.detail).toMatch(/outside the item's own declared scope/);
      expect(r.detail).toContain(path);
      expect(calls.some((c) => c[0] === 'discard')).toBe(true);
      expect(calls.some((c) => c[0] === 'resolve')).toBe(false);
    });
  });

  it('a dispatch --scope broader than the card\'s own declared scope never widens the allowlist — the card governs (#4291 advisory finding)', async () => {
    // The dispatch argument allows `backlog-docs/probation.md`; the card (read in the lane) declares only `a.md`.
    const { io, calls } = fakeIo({ itemScope: ['we:backlog-docs/a.md'] });
    const r = await runProbationBuild(args(), io);
    expect(r.outcome).toBe('gate-red');
    expect(r.detail).toMatch(/outside the item's own declared scope.*: backlog-docs\/probation\.md$/);
    expect(calls.some((c) => c[0] === 'resolve')).toBe(false);
    expect(calls.some((c) => c[0] === 'discard')).toBe(true);
  });

  it('a card scope WIDER than the leased dispatch --scope never lets the worker edit an unleased path (#4291 advisory repair review)', async () => {
    const { io, calls } = fakeIo({ itemScope: ['we:backlog-docs/'], numstat: '1\t2\tbacklog-docs/other.md' });
    const r = await runProbationBuild(args(), io); // leased only backlog-docs/probation.md
    expect(r.outcome).toBe('gate-red');
    expect(r.detail).toMatch(/outside the item's own declared scope.*: backlog-docs\/other\.md$/);
    expect(calls.some((c) => c[0] === 'resolve')).toBe(false);
  });

  it('an empty dispatch --scope is a whole-clone lease, not deny-all — the card\'s scope alone bounds the build (#4291 advisory finding)', async () => {
    const { io, calls } = fakeIo();
    const r = await runProbationBuild(args(codex, { scope: '' }), io);
    expect(r.outcome).toBe('opened-pr');
    expect(calls.some((c) => c[0] === 'commit')).toBe(true);
    const { io: io2 } = fakeIo({ numstat: '1\t2\tbacklog-docs/other.md' });
    expect((await runProbationBuild(args(codex, { scope: '' }), io2)).outcome).toBe('gate-red'); // the card still governs
    const { io: io3 } = fakeIo(); // a lease naming only another repo's paths is still a lease — nothing here is leased
    expect((await runProbationBuild(args(codex, { scope: 'frontierui:docs/x.md' }), io3)).outcome).toBe('gate-red');
  });

  it('a card with no declared scope is refused even when the dispatch passed a --scope (#4291 advisory finding)', async () => {
    const { io, calls } = fakeIo({ itemScope: [] });
    const r = await runProbationBuild(args(), io);
    expect(r.outcome).toBe('not-applicable');
    expect(r.detail).toMatch(/declares no scope/);
    expect(calls.some((c) => c[0] === 'worker')).toBe(false);
  });

  it('a HEAD read that throws AFTER a successful claim still undoes the claim, resetting to the known pre-claim sha (#4291 advisory finding)', async () => {
    const { io, calls } = fakeIo({ throwOnHeadShaCall: 2 });
    const r = await runProbationBuild(args(), io);
    expect(r.outcome).toBe('escalated-needs-human');
    expect(r.detail).toMatch(/unexpected error: headSha exploded/);
    expect(calls.some((c) => c[0] === 'claim')).toBe(true);
    expect(calls.find((c) => c[0] === 'discard')).toEqual(['discard', 'base-sha']);
    expect(calls.some((c) => c[0] === 'worker')).toBe(false);
  });

  it('an item with no declared scope is refused before any worker runs (#4291 plan review round 7)', async () => {
    const { io, calls } = fakeIo({ itemScope: [] });
    const r = await runProbationBuild(args(codex, { scope: '' }), io);
    expect(r.outcome).toBe('not-applicable');
    expect(r.detail).toMatch(/declares no scope/);
    expect(r.executor).toBe('none');
    expect(calls.some((c) => c[0] === 'worker')).toBe(false);
    expect(calls.some((c) => c[0] === 'scorecard')).toBe(false);
  });

  it('a worker that rewrites the item\'s own backlog card body is discarded and escalated, never resolved (#4291 plan review)', async () => {
    const { io, calls } = fakeIo({ postWorkerSpec: '## Done when\n\n1. something else entirely.' });
    const r = await runProbationBuild(args(), io);
    expect(r.outcome).toBe('escalated-needs-human');
    expect(r.detail).toMatch(/edited the item's own backlog card/);
    expect(calls.some((c) => c[0] === 'discard')).toBe(true);
    expect(calls.some((c) => c[0] === 'resolve')).toBe(false);
  });

  it('a worker that tampers with the item\'s frontmatter (e.g. `scope:`) beyond the claim\'s own stamp is discarded and escalated (#4291 plan review round 2)', async () => {
    const { io, calls } = fakeIo({ postWorkerRaw: '---\nstatus: open\nscope: ["we:evil.mjs"]\n---\n\n## Done when\n\n1. it works.' });
    const r = await runProbationBuild(args(), io);
    expect(r.outcome).toBe('escalated-needs-human');
    expect(r.detail).toMatch(/edited the item's own backlog card/);
    expect(calls.some((c) => c[0] === 'discard')).toBe(true);
    expect(calls.some((c) => c[0] === 'resolve')).toBe(false);
  });

  it('a worker forging `graduatedTo:`/`codifiedIn:` directly is caught as tamper too — this launcher never sets those itself, so they are NOT in its own allowlist even though the shared default permits them (#4291 plan review round 8)', async () => {
    const { io, calls } = fakeIo({ postWorkerRaw: '---\nstatus: open\nscope: ["we:backlog-docs/probation.md"]\ngraduatedTo: "some-standard"\n---\n\n## Done when\n\n1. it works.' });
    const r = await runProbationBuild(args(), io);
    expect(r.outcome).toBe('escalated-needs-human');
    expect(r.detail).toMatch(/edited the item's own backlog card/);
    expect(calls.some((c) => c[0] === 'discard')).toBe(true);
    expect(calls.some((c) => c[0] === 'resolve')).toBe(false);
  });
  it('a worker that did not finish cleanly (ok:false) is escalated, never resolved or committed, even with a partial diff (#4291 plan review round 2)', async () => {
    const { io, calls } = fakeIo({ runWorkerOk: false });
    const r = await runProbationBuild(args(), io);
    expect(r.outcome).toBe('escalated-needs-human');
    expect(r.detail).toMatch(/did not finish cleanly/);
    expect(calls.some((c) => c[0] === 'resolve')).toBe(false);
    expect(calls.some((c) => c[0] === 'commit')).toBe(false);
    expect(calls.find((c) => c[0] === 'scorecard')).toBeTruthy();
  });

  it('an unexpected thrown error opening the PR (not just ok:false) still preserves the gate-green commit — never discarded (#4291 plan review round 2)', async () => {
    const { io, calls } = fakeIo({ throwOn: 'openPr' });
    const r = await runProbationBuild(args(), io);
    expect(r.outcome).toBe('escalated-needs-human');
    expect(r.detail).toMatch(/unexpected error opening the PR.*gate-green/);
    expect(calls.some((c) => c[0] === 'commit')).toBe(true);
    expect(calls.some((c) => c[0] === 'discard')).toBe(false);
  });

  it('claim moving HEAD (as if it committed) is caught BEFORE the worker ever runs, and nothing is reset to an unexplained HEAD (#4291 plan review round 4)', async () => {
    const { io, calls } = fakeIo({ headShaSequence: ['pre-claim-sha', 'post-claim-sha'] });
    const r = await runProbationBuild(args(), io);
    expect(r.outcome).toBe('escalated-needs-human');
    expect(r.detail).toMatch(/claim moved HEAD \(pre-claim-sha → post-claim-sha\)/);
    expect(r.executor).toBe('none');
    expect(calls.some((c) => c[0] === 'scorecard')).toBe(false);
    expect(calls.some((c) => c[0] === 'discard')).toBe(false);
    expect(calls.some((c) => c[0] === 'worker')).toBe(false);
  });

  it('claim writing frontmatter this launcher does not expect is caught BEFORE the worker ever runs, with no scorecard row (#4291 plan review round 4)', async () => {
    // Simulates `backlog.mjs claim` itself changing to write something outside CLAIM_OWNED_FRONTMATTER_KEYS —
    // the live, self-checking counterpart to trusting that fact as a one-time review-time read. `postWorkerRaw`
    // is read by the check's OWN `findItem` call (the 2nd overall), which runs before the worker is ever spawned.
    const { io, calls } = fakeIo({ claimTamperedRaw: '---\nstatus: active\nscope: ["we:evil.mjs"]\n---\n\n## Done when\n\n1. it works.' });
    const r = await runProbationBuild(args(), io);
    expect(r.outcome).toBe('escalated-needs-human');
    expect(r.detail).toMatch(/claim wrote frontmatter this launcher does not expect/);
    expect(r.executor).toBe('none');
    expect(calls.some((c) => c[0] === 'scorecard')).toBe(false);
    expect(calls.some((c) => c[0] === 'worker')).toBe(false);
  });

  it('a broken lane (git itself throwing right after the claim) escalates rather than crashing uncaught, and never fabricates a discard with no base to reset to — and writes no scorecard row, since the worker never ran (#4291 plan review round 6)', async () => {
    const { io, calls } = fakeIo({ throwOn: 'headSha' });
    const r = await runProbationBuild(args(), io);
    expect(r.outcome).toBe('escalated-needs-human');
    expect(r.detail).toMatch(/unexpected error: headSha exploded/);
    expect(r.executor).toBe('none');
    expect(calls.some((c) => c[0] === 'discard')).toBe(false);
    expect(calls.some((c) => c[0] === 'scorecard')).toBe(false);
  });

  it('an unexpected thrown error AFTER the worker ran attributes the scorecard row to the worker, not `none` (#4291 plan review round 6 — the counterpart of the broken-lane case above)', async () => {
    const { io, calls } = fakeIo({ throwOn: 'resolveItem' });
    const r = await runProbationBuild(args(), io);
    expect(r.outcome).toBe('escalated-needs-human');
    expect(r.detail).toMatch(/unexpected error: resolveItem exploded/);
    expect(r.executor).toBe('codex');
    expect(calls.some((c) => c[0] === 'discard')).toBe(true);
    expect(calls.find((c) => c[0] === 'scorecard')).toEqual(['scorecard', 'escalated-needs-human', 'codex', null, null, '4291', null]);
  });

  it('a refused resolve is discarded and escalated', async () => {
    const { io, calls } = fakeIo({ resolveOk: false });
    const r = await runProbationBuild(args(), io);
    expect(r.outcome).toBe('escalated-needs-human');
    expect(r.detail).toMatch(/resolve refused: open-children/);
    expect(calls.some((c) => c[0] === 'discard')).toBe(true);
    expect(calls.some((c) => c[0] === 'commit')).toBe(false);
  });

  it('a red final gate (after the resolve+commit) resets the lane all the way back — the commit is undone too', async () => {
    const { io, calls } = fakeIo({ gate: false });
    const r = await runProbationBuild(args(), io);
    expect(r.outcome).toBe('gate-red');
    expect(calls.some((c) => c[0] === 'commit')).toBe(true);
    expect(calls.some((c) => c[0] === 'discard')).toBe(true);
    expect(calls.some((c) => c[0] === 'openPr')).toBe(false);
  });

  it('open-pr blocked on an outside dependency is its own outcome — the built work is never discarded', async () => {
    const { io, calls } = fakeIo({ openPr: { ok: false, blockedOnInfra: true, reason: 'a GitHub outage' } });
    const r = await runProbationBuild(args(), io);
    expect(r.outcome).toBe('blocked-on-infra');
    expect(calls.some((c) => c[0] === 'discard')).toBe(false);
  });

  it('any other open-pr failure escalates — the built, gate-green work stays in the lane', async () => {
    const { io, calls } = fakeIo({ openPr: { ok: false, blockedOnInfra: false, reason: 'the required check failed' } });
    const r = await runProbationBuild(args(), io);
    expect(r.outcome).toBe('escalated-needs-human');
    expect(calls.some((c) => c[0] === 'discard')).toBe(false);
  });

  it('an unexpected thrown error (not an explicit ok:false) still resets the lane rather than stranding the claim', async () => {
    const { io, calls } = fakeIo({ throwOn: 'commit' });
    const r = await runProbationBuild(args(), io);
    expect(r.outcome).toBe('escalated-needs-human');
    expect(r.detail).toMatch(/unexpected error: commit exploded/);
    expect(calls.some((c) => c[0] === 'discard')).toBe(true);
  });

  // x55dojc — hardening against a worker planting a git hook.
  it('refuses before any claim/worker when the lane\'s git-hook baseline cannot be cleaned', async () => {
    const { io, calls } = fakeIo({ hookResetClean: false });
    const r = await runProbationBuild(args(), io);
    expect(r).toMatchObject({ outcome: 'escalated-needs-human', executor: 'none' });
    expect(r.detail).toMatch(/clean git-hook baseline/);
    expect(calls.some((c) => c[0] === 'claim' || c[0] === 'worker')).toBe(false);
  });

  it('a worker that changes the lane\'s git-hook surface is refused, discarded, and never committed/PR-opened', async () => {
    const { io, calls } = fakeIo({ hookTampered: true });
    const r = await runProbationBuild(args(), io);
    expect(r).toMatchObject({ outcome: 'escalated-needs-human', executor: 'codex' });
    expect(r.detail).toMatch(/refused:/);
    expect(calls.some((c) => c[0] === 'commit')).toBe(false);
    expect(calls.some((c) => c[0] === 'openPr')).toBe(false);
    expect(calls.some((c) => c[0] === 'discard')).toBe(true);
    expect(calls.filter((c) => c[0] === 'reset-hooks').length).toBeGreaterThanOrEqual(2); // baseline + post-tamper cleanup
  });

  it('refuses with no num, session or worker', async () => {
    await expect(runProbationBuild(parseArgs(['--session=s', '--worker={"id":"codex"}']), fakeIo().io)).rejects.toThrow();
    await expect(runProbationBuild(parseArgs(['--num=1', '--worker={"id":"codex"}']), fakeIo().io)).rejects.toThrow();
    await expect(runProbationBuild(parseArgs(['--num=1', '--session=s']), fakeIo().io)).rejects.toThrow();
  });
});
