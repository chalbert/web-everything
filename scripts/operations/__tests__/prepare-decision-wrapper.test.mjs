/**
 * @file prepare-decision-wrapper.test.mjs — #3644: the MECHANICAL ARC a prepare-decision dispatch runs.
 *
 * WHAT THIS FILE PROVES. `./dispatch-lane-prepare-decision-wiring.test.mjs` proves the dispatch REACHES this
 * wrapper by default and survives a restart. This file proves the arc itself is right — which is the half a
 * wiring test structurally cannot see:
 *
 *   1. **THE ONE AGENT TURN IS THE ONLY JUDGMENT.** Acquire, hold, stamp, commit, gate, converge, park, PR,
 *      learning and release all happen in the WRAPPER, in order, around a single blocking spawn.
 *   2. **EVERY NON-PR OUTCOME RELEASES.** A `blocked` report, a red gate, a gate-blocked self-diagnosis, an
 *      agent crash and a mid-arc throw each leave no held hold and no held lane. A lane leaked on an unhappy
 *      path is invisible until the pool runs dry. (A refused ACQUIRE is the one exception, and it is the
 *      correct one: nothing was taken, so releasing would release a lane a sibling now holds.)
 *   3. **A HALF-PREPARED DECISION IS NEVER STAMPED AND NEVER OPENS A PR.** `preparedDate` is what makes
 *      readiness rank a decision `✓ ready to ratify`; a false one is trusted by the next ratify turn.
 *   4. **THE PR REF CARRIES THE `-prepare-` INFIX.** `dispatch-lane-io.mjs#NON_IMPLEMENTING_REF_RE` is what
 *      stops the already-done guard reading this PR as evidence the ITEM was implemented. A build-shaped ref
 *      here would make every prepared decision look already-done to the next tick.
 *
 * NOTHING HERE SPAWNS A PROCESS OR TOUCHES THE REAL REPO. Every shell-out goes through an injected `run`, the
 * agent through an injected provider, and the report through an injected reader — the same discipline
 * `./deliver-item-wrapper.test.mjs` states in its own header.
 */

import { describe, it, expect, vi } from 'vitest';

import {
  CLAUDE_RESTRICTED_PREPARE_PROVIDER,
  PREPARE_DECISION_DISPATCH_KIND,
  PREPARE_DECISION_HOOKS_SETTINGS,
  PREPARE_DECISION_LANE_PURPOSE,
  buildPreparePrBody,
  buildPrepareAgentEnv,
  commitPreparedStamp,
  fillPrepareBrief,
  openPreparePr,
  prepareHold,
  prepareRelease,
  preparePrRef,
  releaseHoldAndLane,
  runPrepareAgentToCompletion,
  stampPreparedDate,
} from '../prepare-decision-wrapper.mjs';
import { DELIVERY_OUTCOMES } from '../delivery-report-record.mjs';
import { NON_IMPLEMENTING_REF_RE } from '../dispatch-lane-io.mjs';
import { decide } from '../../guard-bash.mjs';

/**
 * #3627 bug 13 — a REALISTIC `run.mjs open-pr --json` stdout: the full run-outcome envelope
 * (`cli-adapter.mjs#outcomePayload`), never a flat `{pr}` object. The real submit result lives nested at
 * `findings.submit.effects[0].result` (`engine.mjs#effectFinding`) — see `open-pr.mjs#extractSubmitResult`'s
 * docblock for the full story.
 */
function openPrEnvelope(pr) {
  return JSON.stringify({
    stopped: 'complete',
    findings: { submit: { applied: true, effects: [{ type: 'open-pr.submit', status: 'applied', result: { outcome: 'opened', pr }, error: null }] } },
    verdict: { ref: 'lane/test', base: 'main' },
  });
}

/** A `run` spy: records every shell-out and answers from a table of `[matcher, reply]` pairs. */
function recordingRun(replies = []) {
  const calls = [];
  const fn = (cmd, args = [], opts = {}) => {
    const line = `${cmd} ${args.join(' ')}`;
    calls.push({ cmd, args, opts, line });
    for (const [match, reply] of replies) {
      if (typeof match === 'function' ? match(line) : match.test(line)) {
        if (reply instanceof Error) throw reply;
        return typeof reply === 'function' ? reply(line) : reply;
      }
    }
    return '';
  };
  return { fn, calls, lines: () => calls.map((c) => c.line) };
}

describe('#3644 — the kind stamp is DISTINCT from the launch kind, which is what makes a guard arm possible', () => {
  it('stamps `decision-authoring`, never the launch kind `prepare-decision`', () => {
    expect(PREPARE_DECISION_DISPATCH_KIND).toBe('decision-authoring');
    const env = buildPrepareAgentEnv({
      sessionSlug: 'prepare-decision-2568', item: '2568', lanePath: '/x/.lanes/lane-6', attemptTag: '', reportsDir: '/r',
    });
    expect(env.WE_DISPATCH_KIND).toBe('decision-authoring');
    expect(env.LANE).toBe('/x/.lanes/lane-6');
    expect(env.PREPARE_SESSION).toBe('prepare-decision-2568');
    expect(env.PREPARE_ITEM).toBe('2568');
    // #3627 bug 9 — the reports dir is resolved in the WRAPPER's process and handed down, or the agent writes
    // its report into the LANE's own sidecar where this process never looks.
    expect(env.OPERATION_DELIVERY_REPORTS_DIR).toBe('/r');
  });

  it('the guard DENIES this wrapper\'s agent the lifecycle commands, and STILL ALLOWS the fallback-brief agent its own', () => {
    // Both directions together, because the scoping IS the ruling. Widening the arm to the launch kind would
    // deny the `WE_PREPARE_DECISION_DISPATCH_MODE=agent` path its own step 1.
    const owned = [
      'node scripts/lane-pool.mjs acquire --lane=6 --purpose=conveyor-prepare-decision',
      'node scripts/backlog.mjs prepare-hold 2568 --session=s',
      'node scripts/backlog.mjs prepare-stamp 2568',
      'node scripts/backlog.mjs prepare-release 2568 --session=s',
      'node scripts/backlog.mjs resolve 2568',
      'node scripts/verify-lane.mjs request',
      'node scripts/operations/run.mjs open-pr --ref=lane/2568-prepare-x --sha=HEAD --base=main',
      'gh pr view 2140',
      'node scripts/conveyor/learnings-drop.mjs --kind=friction --summary=x',
      'node scripts/converge-cli.mjs init --lane=/lane-6',
    ];
    for (const cmd of owned) {
      expect(decide(cmd, { dispatchKind: PREPARE_DECISION_DISPATCH_KIND }), cmd).not.toBeNull();
      // The FALLBACK path's agent runs the prose brief and must keep every one of these.
      expect(decide(cmd, { dispatchKind: 'prepare-decision' }), `${cmd} — fallback brief`).toBeNull();
    }
    // An interactive session is untouched, and ordinary work under this kind is not over-blocked.
    expect(decide('node scripts/lane-pool.mjs acquire --lane=6')).toBeNull();
    for (const ordinary of ['git status', 'git diff', 'git commit -m "prepare #2568"', 'node scripts/operations/delivery-report-cli.mjs report --session=s --status=started --item=2568']) {
      expect(decide(ordinary, { dispatchKind: PREPARE_DECISION_DISPATCH_KIND }), ordinary).toBeNull();
    }
  });
});

describe('#3644 — the three backlog verbs that make this a PREPARE and not a build', () => {
  it('HOLDS (never claims) from the wrapper\'s own cwd — the hold registry is the PRIMARY\'s, local and unpushed', () => {
    const { fn, calls } = recordingRun();
    prepareHold({ item: '2568', sessionSlug: 'prepare-decision-2568' }, { run: fn });
    expect(calls[0].args).toEqual(['scripts/backlog.mjs', 'prepare-hold', '2568', '--session=prepare-decision-2568']);
    // No `cwd` override — a hold written into a throwaway lane clone is invisible to the tick meant to obey it.
    expect(calls[0].opts.cwd).toBeUndefined();
    // And it is NOT a claim: a prepared decision stays `open`.
    expect(calls[0].args).not.toContain('claim');
  });

  it('STAMPS in the LANE — `prepare-stamp` is blocked from a primary cwd by design', () => {
    const { fn, calls } = recordingRun();
    stampPreparedDate({ item: '2568', lanePath: '/x/.lanes/lane-6' }, { run: fn });
    expect(calls[0].args).toEqual(['scripts/backlog.mjs', 'prepare-stamp', '2568']);
    expect(calls[0].opts.cwd).toBe('/x/.lanes/lane-6');
  });

  it('COMMITS the stamp with an explicit path and a message FILE — never a heredoc, never `git add -A`', () => {
    const written = [];
    const { fn, calls } = recordingRun([[/git status/, ' M backlog/2568-a-decision.md\n']]);
    const out = commitPreparedStamp(
      { item: '2568', lanePath: '/lane-6' },
      { run: fn, writeFile: (p, c) => written.push({ p, c }), itemBasename: () => '2568-a-decision.md' },
    );
    expect(out).toEqual({ committed: true, path: 'backlog/2568-a-decision.md' });
    expect(written[0].p).toBe('/lane-6/.prepare-stamp-msg.txt');
    const commit = calls.find((c) => c.args[0] === 'commit');
    expect(commit.args).toEqual(['commit', '-F', '/lane-6/.prepare-stamp-msg.txt', '--', 'backlog/2568-a-decision.md']);
    expect(commit.opts.cwd).toBe('/lane-6');
    expect(calls.some((c) => c.args.includes('-A'))).toBe(false);
  });

  it('and NO-OPS when the splice changed nothing, rather than failing the whole arc on an empty commit', () => {
    const { fn, calls } = recordingRun([[/git status/, '   \n']]);
    expect(commitPreparedStamp({ item: '2568', lanePath: '/lane-6' }, { run: fn, itemBasename: () => '2568-x.md' }))
      .toEqual({ committed: false, path: 'backlog/2568-x.md' });
    expect(calls.some((c) => c.args[0] === 'commit')).toBe(false);
  });

  it('releases the HOLD and the LANE, and never `backlog.mjs release` — this arc holds no claim to release', () => {
    const { fn, lines } = recordingRun();
    releaseHoldAndLane({ item: '2568', lane: 6, sessionSlug: 'prepare-decision-2568' }, { run: fn });
    expect(lines().some((l) => /backlog\.mjs prepare-release 2568/.test(l))).toBe(true);
    expect(lines().some((l) => /lane-pool\.mjs release --lane=6/.test(l))).toBe(true);
    expect(lines().some((l) => /backlog\.mjs release\b/.test(l))).toBe(false);
  });

  it('a refused hold-release still releases the LANE — a stuck hold must not leak a lane too', () => {
    const { fn, lines } = recordingRun([[/prepare-release/, new Error('no such hold')]]);
    expect(() => releaseHoldAndLane({ item: '2568', lane: 6, sessionSlug: 's' }, { run: fn })).not.toThrow();
    expect(lines().some((l) => /lane-pool\.mjs release --lane=6/.test(l))).toBe(true);
  });
});

describe('#3644 — the PR ref shape is load-bearing, not cosmetic', () => {
  it('mints `lane/<num><attempt>-prepare-<slug>`, which the already-done guard\'s own regex recognises', () => {
    expect(preparePrRef({ item: '2568', attemptTag: '', slug: 'a-decision' })).toBe('lane/2568-prepare-a-decision');
    expect(preparePrRef({ item: '2568', attemptTag: 'b', slug: 'a-decision' })).toBe('lane/2568b-prepare-a-decision');
    // THE CLAIM, asserted against the REAL regex rather than restated: both shapes read as
    // "authored the card, did not implement the item", so a merged prepare PR never makes its own decision
    // look already-done to the next tick's dispatch guard.
    expect(NON_IMPLEMENTING_REF_RE.test(preparePrRef({ item: '2568', attemptTag: '', slug: 'a-decision' }))).toBe(true);
    expect(NON_IMPLEMENTING_REF_RE.test(preparePrRef({ item: '2568', attemptTag: 'b', slug: 'a-decision' }))).toBe(true);
    // …and the BUILD shape (what reusing `openPr` would have minted here) does NOT — which is the whole
    // reason this is a sibling function rather than a reuse.
    expect(NON_IMPLEMENTING_REF_RE.test('lane/2568b-a-decision')).toBe(false);
  });

  it('refuses to substitute a literal placeholder when the slug is missing', () => {
    expect(() => preparePrRef({ item: '2568', attemptTag: '', slug: '' })).toThrow(/real slug/);
  });

  it('opens through `run.mjs open-pr` with a real body file, label-on-green by default and park when parked', () => {
    const written = [];
    const { fn, calls } = recordingRun([[/open-pr/, openPrEnvelope(2140)]]);
    const report = { outcome: 'done', reason: null, filesTouched: ['backlog/2568-a-decision.md'] };
    const out = openPreparePr(
      { item: '2568', attemptTag: '', lane: '/lane-6', park: { mode: 'label-on-green', label: 'ready-to-merge' }, report, slug: 'a-decision' },
      { run: fn, writeFile: (p, c) => written.push({ p, c }) },
    );
    // `openPreparePr` returns the REAL `.pr` (`extractSubmitResult`'s shape), never the raw envelope it parsed.
    expect(out).toEqual({ outcome: 'opened', pr: 2140 });
    expect(calls[0].opts.cwd).toBe('/lane-6');
    expect(calls[0].args).toEqual(expect.arrayContaining([
      '--ref=lane/2568-prepare-a-decision', '--sha=HEAD', '--base=main', '--bodyFile=/lane-6/.pr-body.md',
      '--requireVerified=true', '--mode=label-on-green',
    ]));
    expect(calls[0].args).not.toContain('--mode=park');
    // The body file `--bodyFile` names is genuinely WRITTEN before `open-pr` reads it — `planOpen` refuses a
    // bodyless create, so an unwritten path here is an ENOENT on the very next real run, not a cosmetic gap.
    expect(written[0].p).toBe('/lane-6/.pr-body.md');
    expect(written[0].c).toContain('#2568');

    const parked = recordingRun([[/open-pr/, openPrEnvelope(2141)]]);
    openPreparePr(
      { item: '2568', attemptTag: '', lane: '/lane-6', park: { mode: 'park', label: 'review:human' }, report, slug: 'a-decision' },
      { run: parked.fn, writeFile: () => {} },
    );
    expect(parked.calls[0].args).toEqual(expect.arrayContaining(['--mode=park', '--parkLabel=review:human']));
  });

  it('the body says what this PR is — a PREPARED decision that is still OPEN, never a ratified one', () => {
    const body = buildPreparePrBody({ item: '2568', report: { outcome: 'done', reason: null, filesTouched: ['backlog/2568-a.md'] } });
    expect(body).toContain('#2568');
    expect(body).toContain('preparedDate');
    expect(body).toMatch(/NOT made here/);
    expect(body).toContain('- backlog/2568-a.md');
    // `open-pr.mjs#planOpen` REFUSES a bodyless create, so an empty body is a real failure, not a cosmetic one.
    expect(body.trim().length).toBeGreaterThan(80);
  });
});

describe('#3644 — the ONE agent turn', () => {
  it('fills the v2 brief through the shared `fillBrief` and leaves no `{{…}}` residue', () => {
    const template = '# brief\nRead `$LANE/backlog/{{ITEM_SPEC_PATH_BASENAME}}`.\n';
    const prompt = fillPrepareBrief(
      template, { item: '2568', sessionSlug: 'prepare-decision-2568', lane: 6, attemptTag: '' },
      { loadItems: () => [{ num: '2568', specPath: 'backlog/2568-a-decision.md', slug: 'a-decision' }] },
    );
    expect(prompt).toContain('backlog/2568-a-decision.md');
    expect(prompt).not.toMatch(/\{\{[A-Z_]+\}\}/);
    // The env footer names THIS kind's variables, not the delivery pipeline's.
    expect(prompt).toContain('[env: PREPARE_SESSION=prepare-decision-2568 PREPARE_ITEM=2568 LANE=6 ATTEMPT_TAG=]');
  });

  // #3383 mechanical-dispatcher fix — `runPrepareAgentToCompletion` now resolves the lane path itself (to
  // read the report back from the SAME lane-scoped directory the provider wrote to — mirrors
  // `deliver-item-wrapper.mjs#runAgentToCompletion`'s own equivalent fix), so every case below needs a fake
  // `resolveLane` too, never the real `resolveLanePath` (which would shell a real `lane-pool.mjs status
  // --json` against this machine's own lane pool — slow, and not hermetic).
  const fakeResolveLane = () => '/fake/pool/lane-6';

  it('spawns ONCE, blocking, and reads the structured report back — no polling anywhere', () => {
    const spawns = [];
    const provider = { name: 'fake', spawn: (req) => spawns.push(req) };
    const report = { status: 'done', outcome: 'done', filesTouched: ['backlog/2568-a-decision.md'] };
    return runPrepareAgentToCompletion(
      { item: '2568', sessionSlug: 'prepare-decision-2568', lane: 6, attemptTag: '', provider, claudeSessionId: 'uuid-1' },
      {
        readBrief: () => '# brief {{ITEM_SPEC_PATH_BASENAME}}',
        readReport: () => report,
        loadItems: () => [{ num: '2568', specPath: 'backlog/2568-a-decision.md', slug: 'a-decision' }],
        resolveLane: fakeResolveLane,
      },
    ).then((got) => {
      expect(got).toBe(report);
      expect(spawns).toHaveLength(1);
      // The CLI's own session id is the minted UUID, never the human-readable slug (#3627 bug 5 — the CLI
      // rejects a non-UUID `--session-id` outright).
      expect(spawns[0].sessionId).toBe('uuid-1');
      expect(spawns[0].resumeSessionId).toBeUndefined();
    });
  });

  it('a process that exited with NO done report THROWS — a crash is not a reasoned `blocked`', async () => {
    const provider = { name: 'fake', spawn: () => {} };
    const base = {
      item: '2568', sessionSlug: 'prepare-decision-2568', lane: 6, attemptTag: '', provider, claudeSessionId: 'u',
    };
    const io = (readReport) => ({
      readBrief: () => '# brief {{ITEM_SPEC_PATH_BASENAME}}',
      readReport,
      loadItems: () => [{ num: '2568', specPath: 'backlog/2568-a.md', slug: 'a' }],
      resolveLane: fakeResolveLane,
    });
    await expect(runPrepareAgentToCompletion(base, io(() => null))).rejects.toThrow(/no done report/);
    await expect(runPrepareAgentToCompletion(base, io(() => ({ status: 'started' })))).rejects.toThrow(/no done report/);
  });

  // #3383 mechanical-dispatcher fix — the #3476 regression test: the read-back must resolve through the
  // SAME lane-aware path the provider itself used, never an un-lane-aware default.
  it('reads the report back from the LANE-SCOPED reports dir (resolveReportsDir(lanePath))', async () => {
    const readReport = vi.fn(() => ({ status: 'done', outcome: 'done', filesTouched: [] }));
    const resolveReportsDir = vi.fn((lanePath) => `${lanePath}/.operations/delivery-reports`);
    await runPrepareAgentToCompletion(
      {
        item: '2568', sessionSlug: 'prepare-decision-2568', lane: 6, attemptTag: '',
        provider: { name: 'fake', spawn: vi.fn() }, claudeSessionId: 'u',
      },
      {
        readBrief: () => '# brief {{ITEM_SPEC_PATH_BASENAME}}',
        readReport,
        loadItems: () => [{ num: '2568', specPath: 'backlog/2568-a.md', slug: 'a' }],
        resolveLane: fakeResolveLane,
        resolveReportsDir,
      },
    );
    expect(resolveReportsDir).toHaveBeenCalledWith('/fake/pool/lane-6');
    expect(readReport).toHaveBeenCalledWith('prepare-decision-2568', '/fake/pool/lane-6/.operations/delivery-reports');
  });

  it('the provider spawns into the LANE, with this kind\'s env and its OWN failure-capture directory', () => {
    const spawned = [];
    const persisted = [];
    const resolveReportsDir = vi.fn(() => '/ops/delivery-reports');
    CLAUDE_RESTRICTED_PREPARE_PROVIDER.spawn(
      { sessionId: 'uuid-1', prompt: 'go', lane: 6, sessionSlug: 'prepare-decision-2568', item: '2568', attemptTag: '' },
      {
        ensureSettingsFile: () => '/ops/settings.json',
        spawnAgent: (argv, opts) => { spawned.push({ argv, opts }); },
        resolveLane: () => '/x/.lanes/lane-6',
        resolveReportsDir,
        persistFailure: (...a) => persisted.push(a),
      },
    );
    // #3383 mechanical-dispatcher fix — the #3476 regression test: `resolveReportsDir` must be called WITH
    // the resolved lane path, never bare.
    expect(resolveReportsDir).toHaveBeenCalledWith('/x/.lanes/lane-6');
    expect(spawned).toHaveLength(1);
    // #3627 bug 7(a) — `--restricted` confines the file tools to the process's own working directories, so a
    // wrong cwd sandboxes the agent into the wrong repo entirely.
    expect(spawned[0].opts.cwd).toBe('/x/.lanes/lane-6');
    expect(spawned[0].opts.env.WE_DISPATCH_KIND).toBe('decision-authoring');
    expect(spawned[0].opts.env.LANE).toBe('/x/.lanes/lane-6');
    // The proven `--restricted` argv, reused rather than restated — including the settings file that keeps
    // `guard-lane.mjs`/`guard-bash.mjs` firing inside the agent's own turn.
    expect(spawned[0].argv).toEqual(expect.arrayContaining([
      '--restricted', '--strict-mcp-config', '--disable-slash-commands', '--settings', '/ops/settings.json',
      '-p', '--session-id', 'uuid-1', 'go',
    ]));
    // A real authoring turn cannot finish inside the io shell's 60-SECOND fire-and-forget budget.
    expect(spawned[0].opts.timeout).toBeGreaterThanOrEqual(60 * 60 * 1000);
    expect(persisted).toEqual([]);
  });

  it('captures the child\'s output on a spawn failure, then rethrows the real error untouched', async () => {
    const persisted = [];
    const boom = new Error('spawnSync claude ETIMEDOUT');
    await expect(CLAUDE_RESTRICTED_PREPARE_PROVIDER.spawn(
      { sessionId: 'u', prompt: 'go', lane: 6, sessionSlug: 's', item: '2568' },
      {
        ensureSettingsFile: () => '/ops/s.json',
        spawnAgent: () => { throw boom; },
        resolveLane: () => '/lane-6',
        resolveReportsDir: () => '/r',
        persistFailure: (slug, err, opts) => { persisted.push({ slug, err, opts }); return null; },
      },
    )).rejects.toThrow(boom);
    expect(persisted[0].slug).toBe('s');
    expect(persisted[0].err).toBe(boom);
  });

  it('runs under the SAME trimmed hooks settings a delivery agent does — the four safety hooks, six tools', () => {
    const matchers = PREPARE_DECISION_HOOKS_SETTINGS.hooks.PreToolUse.flatMap(
      (h) => h.hooks.map((x) => x.command),
    );
    // `lint-locus-prefix`/`backlog-guard` matter MORE here than for a build: this agent's entire output is
    // `backlog/*.md` and research-topic writes, which is exactly what those two police at write-time.
    expect(matchers).toEqual(expect.arrayContaining([
      'node scripts/guard-lane.mjs',
      'node scripts/lint-locus-prefix.mjs --pre',
      'node scripts/backlog-guard.mjs --pre',
      'node scripts/guard-bash.mjs',
    ]));
    expect(PREPARE_DECISION_HOOKS_SETTINGS.permissions.allow).toContain('Bash');
  });
});

describe('#3644 — the outcome enum: the existing three carry this kind\'s three endings', () => {
  it('reuses `DELIVERY_OUTCOMES` rather than inventing a fourth value', () => {
    // The item asked whether prepare-decision needs its own enum. It does not, and this pins the answer: the
    // wrapper branches on exactly these three and nothing else.
    expect(DELIVERY_OUTCOMES).toEqual(['done', 'blocked', 'needs-human-judgment']);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════
// THE FULL ARC. `prepareDecision` takes every step of its arc as an injectable seam defaulting to the real
// function beside it (the same `{ run: runFn = run }` convention this codebase uses throughout, one level
// up). That is what makes THE ORDER OF THE STEPS and THE RELEASE DISCIPLINE assertable end to end — the two
// things a caller actually depends on, and the two no per-function test can see — with no lane, no `claude`,
// no gate run and no `gh` token anywhere near it.
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════

/**
 * Run the real arc with every seam recorded. `gateResult`/`parkResult` are shorthands for the two verdicts
 * most cases vary; anything else in `over` REPLACES that seam outright (including `gate`/`park` themselves,
 * for the cases that need to count calls or throw).
 */
async function runArc({ report, gateResult = { status: 'green', lanePath: '/lane-6' }, parkResult = { mode: 'label-on-green', label: 'ready-to-merge' }, ...over } = {}) {
  const { prepareDecision } = await import('../prepare-decision-wrapper.mjs');
  const log = [];
  const seams = {
    newSessionId: () => 'uuid-1',
    acquire: (o) => { log.push(`acquire lane=${o.lane} purpose=${o.purpose} session=${o.claudeSessionId}`); },
    hold: (o) => { log.push(`hold ${o.item}`); },
    runAgent: async (o) => { log.push(`agent-turn session=${o.claudeSessionId}`); return report; },
    resolveLane: () => '/lane-6',
    stamp: (o) => { log.push(`stamp ${o.item}@${o.lanePath}`); },
    commitStamp: (o) => { log.push(`commit-stamp ${o.item}`); return { committed: true }; },
    gate: () => { log.push('gate'); return gateResult; },
    converge: (o, io) => { log.push(`converge kind=${io.dispatchKind} goal=${o.goal}`); return { verdict: 'land', dismissed: [] }; },
    park: (o) => { log.push(`park outcome=${o.report.outcome}`); return parkResult; },
    openPr: (o) => { log.push(`open-pr ref-slug=${o.slug} mode=${o.park.mode}`); return { pr: 2140 }; },
    forwardLearning: (o) => { log.push(`learning ${o.learning.kind}`); },
    releaseBoth: (o) => { log.push(`release-both lane=${o.lane}${o.bestEffort ? ' best-effort' : ''}`); },
    releaseHold: (o) => { log.push(`release-hold ${o.item}`); },
    lookupItem: () => ({ num: '2568', slug: 'a-decision', specPath: 'backlog/2568-a-decision.md' }),
    ...over,
  };
  const launch = {
    item: '2568', lane: 6, scope: 'we:backlog/2568-a-decision.md',
    sessionSlug: 'prepare-decision-2568', attemptTag: '',
  };
  const provider = { name: 'fake', spawn: () => { throw new Error('the arc must go through `runAgent`'); } };
  let result = null;
  let thrown = null;
  try {
    result = await prepareDecision(launch, provider, seams);
  } catch (e) {
    thrown = e;
  }
  return { log, result, thrown };
}

const DONE_REPORT = Object.freeze({
  status: 'done', outcome: 'done', reason: null, filesTouched: ['backlog/2568-a-decision.md'], learning: null,
});

describe('#3644 — the arc, end to end', () => {
  it('the HAPPY path runs every mechanical step IN ORDER around ONE agent turn, and holds the lane for the drain', async () => {
    const { log, result } = await runArc({ report: DONE_REPORT });
    expect(result).toEqual({ item: '2568', result: 'PR #2140 (ready-to-merge)' });
    // THE ORDER IS THE CONTRACT — and exactly one of these steps is the agent's.
    expect(log.map((l) => l.split(' ')[0])).toEqual([
      'acquire', 'hold', 'agent-turn', 'stamp', 'commit-stamp', 'gate', 'converge', 'park', 'open-pr',
      'release-hold',
    ]);
    // The LANE is NOT released on the PR path — the drain lands the PR out of it. Only the HOLD is dropped.
    expect(log.some((l) => l.startsWith('release-both'))).toBe(false);
    expect(log).toContain('release-hold 2568');
    // The lane is acquired for THIS kind's purpose, with the agent's own future session id stamped (#3627's
    // `--adopt` finding), and the SAME id reaches the one agent turn.
    expect(log[0]).toBe(`acquire lane=6 purpose=${PREPARE_DECISION_LANE_PURPOSE} session=uuid-1`);
    expect(log).toContain('agent-turn session=uuid-1');
    // Converge runs under THIS kind's dispatch stamp, on a decision-shaped goal — not a build's.
    expect(log.find((l) => l.startsWith('converge')))
      .toBe("converge kind=decision-authoring goal=bring decision #2568's forks to the Definition of Ready");
  });

  it('a `blocked` report NEVER stamps and NEVER opens a PR, and releases BOTH hold and lane', async () => {
    const { log, result } = await runArc({
      report: { ...DONE_REPORT, outcome: 'blocked', reason: 'the card names no concrete choice, only a goal' },
    });
    expect(result.result).toBe('could-not-prepare (the card names no concrete choice, only a goal)');
    // A half-authored decision is an UNPREPARED one. A non-empty `filesTouched` changes nothing here — which
    // is the one place this arc deliberately does NOT follow the build wrapper's two-way `blocked` split.
    expect(log.some((l) => l.startsWith('stamp'))).toBe(false);
    expect(log.some((l) => l.startsWith('open-pr'))).toBe(false);
    expect(log.some((l) => l.startsWith('gate'))).toBe(false);
    expect(log).toContain('release-both lane=6');
  });

  it('a `blocked` report with NO reason still names itself rather than an empty parenthesis', async () => {
    const { result } = await runArc({ report: { ...DONE_REPORT, outcome: 'blocked', reason: null } });
    expect(result.result).toBe('could-not-prepare (no reason reported)');
  });

  it('a RED gate stops, releases both, and never reaches converge or the PR', async () => {
    const { log, result } = await runArc({ report: DONE_REPORT, gateResult: { status: 'red', lanePath: '/lane-6' } });
    expect(result.result).toBe('gate-red');
    // The stamp DID happen — the agent reported done, and the gate is what found the authoring wanting. That
    // splice lives only in the lane, which is released and reset, so nothing false ever reaches `main`.
    expect(log.some((l) => l.startsWith('stamp'))).toBe(true);
    expect(log.some((l) => l.startsWith('converge'))).toBe(false);
    expect(log.some((l) => l.startsWith('open-pr'))).toBe(false);
    expect(log).toContain('release-both lane=6');
  });

  it('a `gate-blocked` self-diagnosis keeps its own reason instead of collapsing into `gate-red`', async () => {
    const { log, result } = await runArc({
      report: DONE_REPORT,
      gateResult: { status: 'gate-blocked', lanePath: '/lane-6', reason: 'a stale verify marker, nothing in my own diff' },
    });
    expect(result.result).toBe('gate-blocked (a stale verify marker, nothing in my own diff)');
    expect(log.some((l) => l.startsWith('open-pr'))).toBe(false);
    expect(log).toContain('release-both lane=6');
  });

  it('the gate is called EXACTLY ONCE — the one retry lives inside the shared function, never as a loop here', async () => {
    let calls = 0;
    const { result } = await runArc({
      report: DONE_REPORT,
      gate: () => { calls += 1; return { status: 'green', lanePath: '/lane-6' }; },
    });
    expect(calls).toBe(1);
    expect(result.result).toContain('PR #2140');
  });

  it('`needs-human-judgment` still stamps and still opens a PR — PARKED, per the SAME rubric a build uses', async () => {
    const { log, result } = await runArc({
      report: { ...DONE_REPORT, outcome: 'needs-human-judgment', reason: "fork 3's default is a product-voice call" },
      parkResult: { mode: 'park', label: 'review:human' },
    });
    expect(result.result).toBe('PR #2140 (review:human)');
    expect(log.some((l) => l.startsWith('stamp'))).toBe(true);
    expect(log).toContain('open-pr ref-slug=a-decision mode=park');
    // The rubric is handed the agent's own outcome — that is what turns this into a park.
    expect(log).toContain('park outcome=needs-human-judgment');
  });

  it('forwards an optional learning through the SAME drop-box the build wrapper uses, and skips it when absent', async () => {
    const withLearning = await runArc({
      report: { ...DONE_REPORT, learning: { kind: 'doc-gap', summary: 'x', area: 'decision prepare', suggestion: 'y' } },
    });
    expect(withLearning.log).toContain('learning doc-gap');
    const without = await runArc({ report: DONE_REPORT });
    expect(without.log.some((l) => l.startsWith('learning'))).toBe(false);
  });

  it('an ACQUIRE failure throws, takes NOTHING, and therefore releases nothing', async () => {
    // The acquire sits OUTSIDE the try deliberately (the same place `deliver-item-wrapper.mjs` puts its own):
    // if it refused, no lane was taken and no hold was placed, so there is nothing to release — and a
    // best-effort `lane-pool release` here would be a release against a lane a SIBLING session is holding,
    // which is worse than doing nothing. Everything from the hold onward is inside the try.
    const { log, thrown } = await runArc({
      report: DONE_REPORT,
      acquire: () => { throw new Error('lane-pool: lane 6 is already held'); },
    });
    expect(String(thrown?.message)).toMatch(/already held/);
    expect(log).toEqual([]);
  });

  it('a HOLD failure throws and releases too — the lane is already taken by then', async () => {
    const { log, thrown } = await runArc({
      report: DONE_REPORT,
      hold: () => { throw new Error('backlog: #2568 is already held by another session'); },
    });
    expect(String(thrown?.message)).toMatch(/already held/);
    expect(log.some((l) => l.startsWith('agent-turn'))).toBe(false);
    expect(log).toContain('release-both lane=6 best-effort');
  });

  it('an AGENT CRASH (no done report) throws and releases — a crash is never read as a reasoned outcome', async () => {
    const { log, thrown } = await runArc({
      report: DONE_REPORT,
      runAgent: async () => { throw new Error('agent for prepare-decision-2568 exited with no done report'); },
    });
    expect(String(thrown?.message)).toMatch(/no done report/);
    expect(log.some((l) => l.startsWith('stamp'))).toBe(false);
    expect(log).toContain('release-both lane=6 best-effort');
  });

  it('a mid-arc throw ANYWHERE after the agent still releases — converge, park and open-pr each', async () => {
    for (const seam of ['converge', 'park', 'openPr']) {
      const { log, thrown } = await runArc({
        report: DONE_REPORT,
        [seam]: () => { throw new Error(`${seam} exploded`); },
      });
      expect(String(thrown?.message), seam).toMatch(/exploded/);
      expect(log, seam).toContain('release-both lane=6 best-effort');
    }
  });

  it('an item whose slug cannot be resolved REFUSES rather than minting a ref with a literal placeholder', async () => {
    const { log, thrown } = await runArc({ report: DONE_REPORT, lookupItem: () => null });
    expect(String(thrown?.message)).toMatch(/could not resolve a slug/);
    expect(log.some((l) => l.startsWith('open-pr'))).toBe(false);
    expect(log).toContain('release-both lane=6 best-effort');
  });
});

