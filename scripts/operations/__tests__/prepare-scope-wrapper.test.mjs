/**
 * @file prepare-scope-wrapper.test.mjs — #3641: the mechanical arc a `prepare` dispatch now runs.
 *
 * WHAT THIS FILE PROVES, and why each clause is here:
 *
 *   1. **THE LIFECYCLE IS THE WRAPPER'S, NOT THE AGENT'S.** The live brief
 *      (`we:skills-src/conveyor/prepare-scope-agent-brief.md`) told the AGENT to run `lane-pool acquire`, the
 *      `verify-lane request`/`check` poll, `git commit`, and `run.mjs open-pr`. Every one of those is asserted
 *      here as a call the WRAPPER makes, in order, off its own process.
 *   2. **THE ONE JUDGMENT TURN IS STILL A REAL AGENT TURN.** The design call `we:backlog/3641-*.md` left open —
 *      zero-agent like the review wrapper, or one minimal agent like build/fix — is settled as the latter, so
 *      the provider MUST be spawned exactly once on the happy path (and exactly twice when the gate bounces).
 *   3. **THE "EDIT EXACTLY ONE FILE" GUARDRAIL IS ENFORCED, NOT ASKED FOR.** A prepare lane's whole
 *      parallel-safety story is that it owns one known-in-advance backlog file. A second touched path is
 *      refused BEFORE the commit.
 *   4. **EVERY NON-PR OUTCOME RELEASES THE LANE**, and the PR path deliberately does not.
 *
 * NOTHING HERE SPAWNS A PROCESS. Every `run` call is injected; the only real fs is a temp lane directory the
 * PR body is genuinely written into.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

vi.mock('../delivery-report-store.mjs', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, tryReadDeliveryReport: vi.fn() };
});
// The brief read is intercepted for the SAME documented reason `./deliver-item-wrapper.test.mjs` intercepts
// its own: `minimal-context-provider.mjs#REPO_ROOT` is `new URL('../..', import.meta.url).pathname`, which
// under vitest's SSR transform resolves to a `/@fs/…` path that does not exist on disk. Every other fs call
// stays real via the `actual` spread — the PR body really is written to a real temp lane directory below.
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal();
  const readFileSync = vi.fn((path, ...rest) => (
    String(path).includes('prepare-scope-agent-brief-v2.md')
      ? '# minimal prepare brief\n'
      : actual.readFileSync(path, ...rest)
  ));
  const mocked = { ...actual, readFileSync };
  return { ...mocked, default: mocked };
});

import { tryReadDeliveryReport } from '../delivery-report-store.mjs';
import {
  PREPARE_AGENT_SPAWN_TIMEOUT_MS,
  PREPARE_HOOKS_SETTINGS,
  PREPARE_SCOPE_LANE_PURPOSE,
  assertOnlyItemSpecTouched,
  buildPrepareAgentEnv,
  buildScopePrBody,
  commitScopeEdit,
  openScopePr,
  prepareScope,
  runPrepareGateWithOneRetry,
  CLAUDE_RESTRICTED_PREPARE_PROVIDER,
} from '../prepare-scope-wrapper.mjs';

const ITEM = '3641';
const SESSION = 'prepare-3641';
const SPEC = 'backlog/3641-build-and-wire-a-mechanical-harness-for-prepare-scope-dispat.md';

let laneDir;
beforeEach(() => { laneDir = mkdtempSync(join(tmpdir(), 'prepare-lane-')); });
afterEach(() => { rmSync(laneDir, { recursive: true, force: true }); vi.restoreAllMocks(); });

/** The backlog loader `findItem` reads, shaped as the real one shapes it. */
const loadItems = () => [{ num: ITEM, slug: 'build-and-wire-a-mechanical-harness-for-prepare-scope-dispat', scope: [] }];

/**
 * A recording `run` that answers every CLI the arc shells. `overrides` replaces one answer by a matcher, so a
 * test can make exactly one step fail without restating the rest.
 */
function recordingRun({ verify = { ok: true }, porcelain = ` M ${SPEC}\n`, pr = { pr: 2200 }, onCall } = {}) {
  const calls = [];
  const fn = (cmd, args, opts) => {
    calls.push({ cmd, args, opts });
    if (onCall) {
      const forced = onCall({ cmd, args, opts, index: calls.length - 1 });
      if (forced !== undefined) return forced;
    }
    if (cmd === 'git' && args[0] === 'status') return porcelain;
    if (args.includes('status') && args.includes('--json')) {
      return JSON.stringify({ lanes: [{ lane: 2, path: laneDir }] });
    }
    if (args.includes('verify')) return JSON.stringify({ verdict: typeof verify === 'function' ? verify(calls) : verify });
    if (args.includes('open-pr')) return JSON.stringify(pr);
    return '';
  };
  return { fn, calls };
}

/** A provider that records each spawn instead of running `claude`. */
function recordingProvider() {
  const spawns = [];
  return { spawns, provider: { name: 'test', spawn: (req) => { spawns.push(req); } } };
}

const doneReport = (over = {}) => ({
  version: 1, session: SESSION, item: ITEM, status: 'done', outcome: 'done',
  filesTouched: [SPEC], reason: null, learning: null, ...over,
});

const deps = (run, extra = {}) => ({
  run, loadItems, deleteReport: () => {}, newSessionId: () => '11111111-2222-3333-4444-555555555555', ...extra,
});

describe('#3641 — the prepare-scope wrapper owns the lifecycle the brief used to hand the agent', () => {
  it('runs acquire → ONE agent turn → gate → one-file check → commit → open-pr, off its own process', async () => {
    tryReadDeliveryReport.mockReturnValue(doneReport());
    const { fn: run, calls } = recordingRun();
    const { spawns, provider } = recordingProvider();

    const out = await prepareScope({ item: ITEM, lane: 2, sessionSlug: SESSION }, provider, deps(run));

    // 1. THE AGENT RAN EXACTLY ONCE — the judgment turn this shape deliberately keeps (see the file header).
    expect(spawns).toHaveLength(1);
    expect(spawns[0]).toMatchObject({ sessionSlug: SESSION, item: ITEM, itemSpecPath: SPEC, lanePath: laneDir });

    const shelled = calls.map((c) => `${c.cmd} ${c.args.join(' ')}`);
    // 2. The lane acquire is the WRAPPER's, under the live brief's own purpose, scoped to the one backlog file.
    expect(shelled[0]).toContain('scripts/lane-pool.mjs acquire --lane=2');
    expect(shelled[0]).toContain(`--purpose=${PREPARE_SCOPE_LANE_PURPOSE}`);
    expect(shelled[0]).toContain(`--scope=we:${SPEC}`);
    // 3. The gate runs SYNCHRONOUSLY through the declared operation — never the brief's request/poll dance,
    //    which existed only because a dispatched AGENT's own Bash call is what `guard-bash.mjs` denies.
    expect(shelled.some((s) => s.includes('run.mjs verify'))).toBe(true);
    expect(shelled.some((s) => s.includes('verify-lane.mjs request'))).toBe(false);
    expect(shelled.some((s) => s.includes('verify-lane.mjs check'))).toBe(false);
    // 4. The commit is one explicit path on the lane's current branch — never `git add -A`, never a new branch.
    const commit = calls.find((c) => c.cmd === 'git' && c.args[0] === 'commit');
    expect(commit.args).toEqual(['commit', '-m', expect.stringContaining(`WE #${ITEM}: author scope:`), '--', SPEC]);
    expect(commit.opts.cwd).toBe(laneDir);
    expect(shelled.some((s) => s.includes('checkout -b'))).toBe(false);
    expect(shelled.some((s) => s.includes('add -A'))).toBe(false);
    // 5. The PR goes through the canonical producer, label-on-green, on the prepare-specific ref grammar.
    const openPr = calls.find((c) => c.args.includes('open-pr'));
    expect(openPr.args).toEqual(expect.arrayContaining([
      `--ref=lane/${ITEM}-scope-build-and-wire-a-mechanical-harness-for-prepare-scope-dispat`,
      '--sha=HEAD', '--base=main', '--mode=label-on-green',
    ]));
    expect(shelled.some((s) => s.includes('gh pr create'))).toBe(false);
    // 6. And it stops there — no merge, no drain, and the lane stays held for the PR it just opened.
    expect(shelled.some((s) => s.includes('pr merge'))).toBe(false);
    expect(shelled.some((s) => s.includes('lane-pool.mjs release'))).toBe(false);
    expect(out).toEqual({ item: ITEM, result: 'scope → PR #2200 (ready-to-merge)' });
  });

  it('never claims, builds or resolves the item — a prepare only authors `scope:`', async () => {
    tryReadDeliveryReport.mockReturnValue(doneReport());
    const { fn: run, calls } = recordingRun();
    await prepareScope({ item: ITEM, lane: 2, sessionSlug: SESSION }, recordingProvider().provider, deps(run));
    const shelled = calls.map((c) => `${c.cmd} ${c.args.join(' ')}`);
    expect(shelled.some((s) => s.includes('run.mjs claim'))).toBe(false);
    expect(shelled.some((s) => s.includes('backlog.mjs claim'))).toBe(false);
    expect(shelled.some((s) => s.includes('run.mjs resolve'))).toBe(false);
  });

  it('forwards the agent\'s optional learning, and drops nothing when it reported none', async () => {
    const learning = { kind: 'friction', summary: 's', area: 'scope prediction', suggestion: 'x' };
    tryReadDeliveryReport.mockReturnValue(doneReport({ learning }));
    const { fn: run, calls } = recordingRun();
    await prepareScope({ item: ITEM, lane: 2, sessionSlug: SESSION }, recordingProvider().provider, deps(run));
    expect(calls.some((c) => c.args.includes('scripts/conveyor/learnings-drop.mjs'))).toBe(true);

    tryReadDeliveryReport.mockReturnValue(doneReport());
    const second = recordingRun();
    await prepareScope({ item: ITEM, lane: 2, sessionSlug: SESSION }, recordingProvider().provider, deps(second.fn));
    expect(second.calls.some((c) => c.args.includes('scripts/conveyor/learnings-drop.mjs'))).toBe(false);
  });

  it('deletes any STALE report for this slug before spawning — `prepare-<num>` repeats across attempts', async () => {
    tryReadDeliveryReport.mockReturnValue(doneReport());
    const deleted = [];
    const { fn: run } = recordingRun();
    await prepareScope(
      { item: ITEM, lane: 2, sessionSlug: SESSION },
      recordingProvider().provider,
      deps(run, { deleteReport: (s) => deleted.push(s) }),
    );
    expect(deleted).toEqual([SESSION]);
  });
});

describe('#3641 — the outcomes the wrapper decides by READING the report', () => {
  it('a `blocked` report is `could-not-predict`: no commit, no PR, lane released', async () => {
    tryReadDeliveryReport.mockReturnValue(doneReport({ outcome: 'blocked', reason: 'spec names no module', filesTouched: null }));
    const { fn: run, calls } = recordingRun();
    const { spawns, provider } = recordingProvider();

    const out = await prepareScope({ item: ITEM, lane: 2, sessionSlug: SESSION }, provider, deps(run));

    expect(out.result).toBe('could-not-predict (spec names no module)');
    const shelled = calls.map((c) => `${c.cmd} ${c.args.join(' ')}`);
    expect(shelled.some((s) => s.includes('open-pr'))).toBe(false);
    expect(shelled.some((s) => s.startsWith('git commit'))).toBe(false);
    expect(shelled.some((s) => s.includes('lane-pool.mjs release --lane=2'))).toBe(true);
    // The gate never ran either — there is nothing to verify.
    expect(shelled.some((s) => s.includes('run.mjs verify'))).toBe(false);
    expect(spawns).toHaveLength(1);
  });

  it('a red gate after one retry is `gate-red`: no PR, lane released', async () => {
    tryReadDeliveryReport.mockReturnValue(doneReport());
    const { fn: run, calls } = recordingRun({ verify: { ok: false, failed: 1, blocking: ['check:standards'] } });
    const { spawns, provider } = recordingProvider();

    const out = await prepareScope({ item: ITEM, lane: 2, sessionSlug: SESSION }, provider, deps(run));

    expect(out.result).toBe('gate-red');
    // ONE resume — the agent got exactly one chance to fix its own frontmatter, never an unbounded loop.
    expect(spawns).toHaveLength(2);
    expect(spawns[1].resumeSessionId).toBe(spawns[0].sessionId);
    expect(spawns[1].prompt).toContain('Your gate failed');
    const shelled = calls.map((c) => `${c.cmd} ${c.args.join(' ')}`);
    expect(shelled.some((s) => s.includes('open-pr'))).toBe(false);
    expect(shelled.some((s) => s.includes('lane-pool.mjs release --lane=2'))).toBe(true);
  });

  it('an honest `blocked` self-diagnosis on the retry is `gate-blocked`, never rewritten as `gate-red`', async () => {
    tryReadDeliveryReport
      .mockReturnValueOnce(doneReport())
      .mockReturnValue(doneReport({ outcome: 'blocked', reason: 'the marker is foreign' }));
    const { fn: run } = recordingRun({ verify: { ok: false, failed: 0, unrun: 1 } });
    const out = await prepareScope({ item: ITEM, lane: 2, sessionSlug: SESSION }, recordingProvider().provider, deps(run));
    expect(out.result).toBe('gate-blocked (the marker is foreign)');
  });

  it('an `unrun` gate does NOT tell the agent its own change is broken', () => {
    tryReadDeliveryReport.mockReturnValue(doneReport());
    const { spawns, provider } = recordingProvider();
    const { fn: run } = recordingRun({ verify: { ok: false, failed: 0, unrun: 2 } });
    runPrepareGateWithOneRetry(
      { lanePath: laneDir, item: ITEM, sessionSlug: SESSION, itemSpecPath: SPEC, provider, claudeSessionId: 'u' },
      { run },
    );
    expect(spawns[0].prompt).toContain('could not RUN');
    expect(spawns[0].prompt).not.toContain('Your gate failed');
  });

  it('an agent that exits with no `done` report is a crash — lane released, error surfaced', async () => {
    tryReadDeliveryReport.mockReturnValue(null);
    const { fn: run, calls } = recordingRun();
    await expect(prepareScope({ item: ITEM, lane: 2, sessionSlug: SESSION }, recordingProvider().provider, deps(run)))
      .rejects.toThrow(/exited with no done report/);
    expect(calls.some((c) => c.args.join(' ').includes('lane-pool.mjs release --lane=2'))).toBe(true);
  });

  // #3383 mechanical-dispatcher fix — the #3476 regression test: `resolveReportsDir` must be called WITH the
  // lane path this wrapper already has in hand (`lanePath`, never re-resolved), never bare — bare, it
  // silently names the primary checkout regardless of which lane the agent actually ran in (invisible under
  // Claude's soft, hook-based `--restricted` sandbox, but a hard `EPERM` under Codex's real OS-level jail).
  it('CLAUDE_RESTRICTED_PREPARE_PROVIDER.spawn resolves the reports dir WITH the lane path — never bare', () => {
    const resolveReportsDir = vi.fn(() => '/ops/delivery-reports');
    CLAUDE_RESTRICTED_PREPARE_PROVIDER.spawn(
      { sessionId: 'u', prompt: 'go', lanePath: '/tmp/prepare-lane-2', sessionSlug: SESSION, item: ITEM, itemSpecPath: SPEC },
      {
        ensureSettingsFile: () => '/ops/settings.json',
        spawnAgent: () => {},
        persistFailure: () => {},
        resolveReportsDir,
      },
    );
    expect(resolveReportsDir).toHaveBeenCalledWith('/tmp/prepare-lane-2');
  });
});

describe('#3641 — the "edit exactly one file" guardrail', () => {
  it('REFUSES to commit when the agent touched anything but its own backlog file', () => {
    const { fn: run } = recordingRun({ porcelain: ` M ${SPEC}\n M scripts/readiness/dispatch-plan.mjs\n` });
    expect(() => assertOnlyItemSpecTouched({ lanePath: laneDir, itemSpecPath: SPEC, item: ITEM }, { run }))
      .toThrow(/touched 1 path\(s\) outside its own backlog file \(scripts\/readiness\/dispatch-plan\.mjs\)/);
  });

  it('REFUSES a `done` report that left the file unmodified — there is no prediction to commit', () => {
    const { fn: run } = recordingRun({ porcelain: '\n' });
    expect(() => assertOnlyItemSpecTouched({ lanePath: laneDir, itemSpecPath: SPEC, item: ITEM }, { run }))
      .toThrow(/left .* unmodified/);
  });

  it('accepts the one file, however git spells its status columns', () => {
    for (const line of [` M ${SPEC}`, `M  ${SPEC}`, `?? ${SPEC}`]) {
      const { fn: run } = recordingRun({ porcelain: `${line}\n` });
      expect(assertOnlyItemSpecTouched({ lanePath: laneDir, itemSpecPath: SPEC, item: ITEM }, { run })).toEqual([SPEC]);
    }
  });

  it('stops the whole arc BEFORE the commit and the PR when it refuses', async () => {
    tryReadDeliveryReport.mockReturnValue(doneReport());
    const { fn: run, calls } = recordingRun({ porcelain: ` M ${SPEC}\n M src/index.html\n` });
    await expect(prepareScope({ item: ITEM, lane: 2, sessionSlug: SESSION }, recordingProvider().provider, deps(run)))
      .rejects.toThrow(/outside its own backlog file/);
    const shelled = calls.map((c) => `${c.cmd} ${c.args.join(' ')}`);
    expect(shelled.some((s) => s.startsWith('git commit'))).toBe(false);
    expect(shelled.some((s) => s.includes('open-pr'))).toBe(false);
    expect(shelled.some((s) => s.includes('lane-pool.mjs release --lane=2'))).toBe(true);
  });
});

describe('#3641 — the agent\'s world', () => {
  it('hands the agent REAL env vars — the one file it may edit, its lane, and where to report', () => {
    const env = buildPrepareAgentEnv({
      sessionSlug: SESSION, item: ITEM, lanePath: '/lanes/2', itemSpecPath: SPEC, reportsDir: '/r',
    });
    expect(env).toEqual({
      // `scope-authoring`, NOT the launch kind `prepare` (#3642 — see `buildPrepareAgentEnv`'s own docblock
      // and `./dispatch-kind-axes.test.mjs`'s `#3642` block, which is the regression for the move). A LAUNCH
      // kind here would be stamping this restricted agent with the value `defaultClaudeProvider` puts on the
      // FALLBACK agent that runs its own `lane-pool acquire`/`verify-lane`/`open-pr`.
      WE_DISPATCH_KIND: 'scope-authoring',
      DELIVERY_SESSION: SESSION,
      DELIVERY_ITEM: ITEM,
      ITEM_SPEC_PATH: SPEC,
      LANE: '/lanes/2',
      OPERATION_DELIVERY_REPORTS_DIR: '/r',
    });
  });

  it('keeps the two hooks that guard a `backlog/*.md` write — this agent edits nothing else', () => {
    const editWrite = PREPARE_HOOKS_SETTINGS.hooks.PreToolUse.find((h) => h.matcher === 'Edit|Write');
    const commands = editWrite.hooks.map((h) => h.command);
    expect(commands).toContain('node scripts/lint-locus-prefix.mjs --pre');
    expect(commands).toContain('node scripts/backlog-guard.mjs --pre');
    expect(commands).toContain('node scripts/guard-lane.mjs');
  });

  it('budgets the one agent turn well under a delivery\'s hour — it reads and writes one key', () => {
    expect(PREPARE_AGENT_SPAWN_TIMEOUT_MS).toBe(20 * 60 * 1000);
  });
});

describe('#3641 — the PR the wrapper opens', () => {
  it('writes a real body file naming the one file touched', () => {
    const body = buildScopePrBody({ item: ITEM, itemSpecPath: SPEC, report: doneReport() });
    expect(body).toContain(`## #${ITEM} — predicted \`scope:\``);
    expect(body).toContain(`- ${SPEC}`);
  });

  it('writes that body to the lane and hands `open-pr` its real path', () => {
    const { fn: run, calls } = recordingRun();
    const out = openScopePr({ item: ITEM, lanePath: laneDir, itemSpecPath: SPEC, report: doneReport(), slug: 's' }, { run });
    expect(out).toEqual({ pr: 2200 });
    expect(readFileSync(`${laneDir}/.pr-body.md`, 'utf8')).toContain(`## #${ITEM}`);
    expect(calls[0].args).toContain(`--bodyFile=${laneDir}/.pr-body.md`);
  });

  it('refuses a ref with no real slug rather than substituting a literal placeholder', () => {
    expect(() => openScopePr({ item: ITEM, lanePath: laneDir, itemSpecPath: SPEC, report: null, slug: '' }, { run: () => '' }))
      .toThrow(/needs the item's real slug/);
  });

  it('commits through an argv array, so the live brief\'s backtick-heredoc footgun cannot occur', () => {
    const { fn: run, calls } = recordingRun();
    commitScopeEdit({ lanePath: laneDir, itemSpecPath: SPEC, item: ITEM }, { run });
    // The message is ONE argv element handed straight to `git` — there is no shell between here and the
    // process, which is exactly what the live brief had to write a message FILE to work around (a backtick in
    // a heredoc runs as a subshell).
    expect(calls[0].args[2]).toContain(`WE #${ITEM}: author scope:`);
    expect(calls[0].args[2]).toContain('Co-Authored-By:');
    expect(calls[0].cmd).toBe('git');
  });
});
