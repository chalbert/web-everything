/**
 * @file dispatch-task.test.mjs — the `dispatch-task` operation (#3730, with the prompt template from #3752 point 1).
 *
 * THE CARD'S CASES, each of which fails before the operation exists: a launch from a brief file writes a run
 * record listing session, brief path and launch time; the projected job view matches the operator's job-file
 * fields; a second call with the same session slug is refused, not double-spawned.
 *
 * REAL MECHANISM WHERE THE SEAM IS IO (#2949). The end-to-end cases drive the real command-line adapter
 * (`runOperationCli`) over a declaration, a real brief FILE and either the memory store (fast) or a REAL file run
 * store; the spawn cases run the REAL `defaultSpawnAgent` against the fake `claude` on PATH, whose parser refuses an
 * unknown flag. The two seams that stay injected are the ones that would otherwise start a session or touch the
 * network: the staleness fetch and the `claude agents` listing.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  DEFAULT_PERMISSION_MODE, DISPATCH_TASK_OP, PERMISSION_MODES, allowedToolsArgs, buildBriefLaunchPrompt,
  dispatchTaskOperation, finishTaskOutcome, planTask, projectJobs, shapeTaskRead, subscribeTarget,
} from '../dispatch-task.mjs';
import { createDispatchTaskSinks, createTaskReader, inFlightTaskRuns, readJobView } from '../dispatch-task-io.mjs';
import { DISPATCH_EFFECT } from '../dispatch-lane.mjs';
import { defaultSpawnAgent, inFlightDispatchesFor, defaultListAgents } from '../dispatch-lane-io.mjs';
import { createRegistry } from '../registry.mjs';
import { runOperationCli } from '../cli-adapter.mjs';
import { createFileRunStore, createMemoryRunStore } from '../run-store.mjs';
import { runReport } from '../completion-cli.mjs';
import { newCompletionRecord } from '../completion-record.mjs';
import { withFakeClaude } from './helpers/fake-claude.mjs';
import { withBareOrigin, withNarrowClone } from './helpers/real-repo.mjs';

const NOW = new Date('2026-09-21T10:00:00.000Z');
const JOB_FIELDS = ['agentId', 'brief', 'item', 'kind', 'launchedAt', 'note', 'result', 'session', 'state'];

let scratch;
beforeEach(() => { scratch = mkdtempSync(join(tmpdir(), 'dispatch-task-')); });
afterEach(() => { rmSync(scratch, { recursive: true, force: true }); });

function writeBrief(text = '# Do the thing\n\nWrite the result to result.md.\n') {
  const path = join(scratch, 'brief.md');
  writeFileSync(path, text);
  return path;
}

/** A spawn seam shaped like `execFileSync('claude', argv, opts)`: records the call, prints the `--bg` confirmation. */
function fakeSpawn({ handle = 'abcdef12', fail = null } = {}) {
  const calls = [];
  const spawnAgent = (argv, opts) => {
    calls.push({ argv, opts });
    if (fail) throw fail;
    const name = argv[argv.indexOf('-n') + 1];
    return `backgrounded · ${handle} · ${name}\n`;
  };
  return { calls, spawnAgent };
}

const FRESH = () => ({ fresh: true, behind: 0 });

/** The whole operation wired the way `run.mjs` wires it, with only the process-starting seams replaced. */
function harness({ store = createMemoryRunStore(), spawn = fakeSpawn(), listing = [], checkStaleness = FRESH, realStaleness = false, root = scratch, extraArgs = [] } = {}) {
  const declaration = dispatchTaskOperation({
    readTask: createTaskReader({ store, listAgents: () => listing, now: () => NOW, cwd: scratch }),
  });
  const registry = createRegistry();
  registry.register(declaration);
  const sinks = createDispatchTaskSinks({
    root, spawnAgent: spawn.spawnAgent, checkStaleness: realStaleness ? undefined : checkStaleness, extraArgs, now: () => NOW, mintSessionId: () => 'minted-session-id',
  });
  let n = 0;
  const call = async (argv) => {
    const outcome = await runOperationCli({ declaration, argv, registry, store, sinks, newRunId: () => `run-task-${++n}` });
    const json = argv.includes('--json');
    return { ...outcome, ...finishTaskOutcome({ run: outcome.run, code: outcome.code, lines: outcome.lines, json }) };
  };
  return { declaration, registry, store, spawn, call };
}

const launchArgv = (brief, more = []) => [`--brief=${brief}`, '--session=my-task', ...more];

// ── the shared launch prompt (#3752 point 1) ───────────────────────────────────────────────────────────────

describe('buildBriefLaunchPrompt — the ONE launch prompt', () => {
  it('says the brief IS the instruction, to carry it out completely, result file included, and not to stop after reading', () => {
    const prompt = buildBriefLaunchPrompt({ briefPath: '/work/brief.md', session: 'my-task' });
    expect(prompt).toContain('/work/brief.md');
    expect(prompt).toMatch(/brief IS your instruction/);
    expect(prompt).toMatch(/carry it out completely, including writing the result file/);
    expect(prompt).toMatch(/Do not stop after reading it/);
    expect(prompt).toMatch(/do not end your turn waiting on anything/);
  });

  it('names the completion report the job view reads, with the session and the task kind', () => {
    const prompt = buildBriefLaunchPrompt({ briefPath: '/work/brief.md', session: 'my-task' });
    expect(prompt).toContain('completion-cli.mjs report --session=my-task --kind=task --status=done');
  });

  it('never begins with a dash (buildAgentArgv refuses that), and refuses missing inputs', () => {
    expect(buildBriefLaunchPrompt({ briefPath: '/b', session: 's' }).trimStart().startsWith('-')).toBe(false);
    expect(() => buildBriefLaunchPrompt({ session: 's' })).toThrow(/brief path/);
    expect(() => buildBriefLaunchPrompt({ briefPath: '/b' })).toThrow(/session slug/);
  });

  it('is the only home of the wording: the io shell and the run table carry none of it', () => {
    for (const file of ['dispatch-task-io.mjs', 'run.mjs']) {
      const text = readFileSync(join(import.meta.dirname, '..', file), 'utf8');
      expect(text, file).not.toMatch(/brief IS your instruction/);
    }
  });
});

// ── the pure verdict ───────────────────────────────────────────────────────────────────────────────────────

describe('planTask — every refusal is named', () => {
  const okRead = shapeTaskRead({ briefPath: '/b.md', briefExists: true, briefBytes: 10, observedAt: NOW.toISOString(), inFlight: { runs: [] } });
  const okInput = { brief: '/b.md', session: 'my-task', kind: 'task', permissionMode: 'auto' };

  it('clears a well-formed request and builds the prompt from the shared function', () => {
    const plan = planTask(okRead, okInput);
    expect(plan.dispatching).toBe(true);
    expect(plan.prompt).toBe(buildBriefLaunchPrompt({ briefPath: '/b.md', session: 'my-task' }));
  });

  it.each([
    ['a slug that is not filename-safe', { session: 'a/b' }, okRead, 'bad-session'],
    ['a kind that is not a label', { kind: 'not a label' }, okRead, 'bad-kind'],
    ['a permission mode the CLI does not have', { permissionMode: 'yolo' }, okRead, 'bad-permission-mode'],
    ['a brief that is missing', {}, shapeTaskRead({ briefPath: '/b.md', briefExists: false }), 'brief-missing'],
    ['a brief that is empty', {}, shapeTaskRead({ briefPath: '/b.md', briefExists: true, briefBytes: 0 }), 'brief-empty'],
    ['an unreadable run store', {}, shapeTaskRead({ briefPath: '/b.md', briefExists: true, briefBytes: 1, inFlight: { runs: [], listFailed: true, error: 'EACCES' } }), 'store-unreadable'],
  ])('refuses %s', (_name, patch, read, hold) => {
    const plan = planTask(read, { ...okInput, ...patch });
    expect(plan).toMatchObject({ dispatching: false, hold });
    expect(plan.prompt).toBeUndefined();
  });

  it('holds while the session is LISTED, at any age', () => {
    const read = shapeTaskRead({ briefPath: '/b.md', briefExists: true, briefBytes: 1, observedAt: NOW.toISOString(),
      inFlight: { runs: [{ runId: 'r1', handle: 'abcdef12', startedAt: '2026-09-19T00:00:00.000Z', live: true }] } });
    expect(planTask(read, okInput)).toMatchObject({ dispatching: false, hold: 'already-in-flight' });
  });

  it('releases a session the listing no longer shows once it is past the listing grace', () => {
    const read = shapeTaskRead({ briefPath: '/b.md', briefExists: true, briefBytes: 1, observedAt: NOW.toISOString(),
      inFlight: { runs: [{ runId: 'r1', handle: 'abcdef12', startedAt: '2026-09-21T06:00:00.000Z', live: false }] } });
    expect(planTask(read, okInput).dispatching).toBe(true);
  });

  it('holds a session whose liveness is unknown until its own deadline passes', () => {
    const inFlight = (expectedBy) => ({ runs: [{ runId: 'r1', handle: 'abcdef12', startedAt: '2026-09-21T09:00:00.000Z', expectedBy, live: null }] });
    const base = { briefPath: '/b.md', briefExists: true, briefBytes: 1, observedAt: NOW.toISOString() };
    expect(planTask(shapeTaskRead({ ...base, inFlight: inFlight('2026-09-21T10:30:00.000Z') }), okInput).dispatching).toBe(false);
    expect(planTask(shapeTaskRead({ ...base, inFlight: inFlight('2026-09-21T08:00:00.000Z') }), okInput).dispatching).toBe(true);
  });

  it('the permission mode list is the CLI\'s, and the default is auto', () => {
    expect(DEFAULT_PERMISSION_MODE).toBe('auto');
    expect(PERMISSION_MODES).toEqual(['acceptEdits', 'auto', 'bypassPermissions', 'manual', 'dontAsk', 'plan']);
  });

  it('allowedTools is ONE token, because the CLI option is variadic and would swallow the prompt', () => {
    expect(allowedToolsArgs('')).toEqual([]);
    expect(allowedToolsArgs(undefined)).toEqual([]);
    expect(allowedToolsArgs('Bash(git *),Edit')).toEqual(['--allowedTools=Bash(git *),Edit']);
  });

  it('refuses a malformed reader', () => {
    expect(() => dispatchTaskOperation({})).toThrow(/needs a .readTask/);
  });
});

// ── the card's three cases, end to end ─────────────────────────────────────────────────────────────────────

describe('dispatch-task — driven end to end through the command-line adapter', () => {
  it('a launch writes a run record listing the session, the brief path and the launch time', async () => {
    const brief = writeBrief();
    const h = harness();
    const out = await h.call(launchArgv(brief, ['--item=3730']));

    expect(out.code).toBe(0);
    expect(out.stopped).toBe('effect-in-flight');
    const run = h.store.read(h.store.list()[0]);
    expect(run.op).toBe(DISPATCH_TASK_OP);
    expect(run.input).toMatchObject({ brief, session: 'my-task', item: '3730' });
    const [effect] = run.effects;
    expect(effect).toMatchObject({ type: DISPATCH_EFFECT, status: 'in-flight', handle: 'abcdef12' });
    expect(effect.payload).toMatchObject({ sessionSlug: 'my-task', brief, num: '3730', launchKind: 'task', permissionMode: 'auto' });
    expect(effect.startedAt).toEqual(expect.any(String));
    expect(Number.isNaN(Date.parse(effect.startedAt))).toBe(false);
    expect(effect.expectedBy).toBe('2026-09-21T11:30:00.000Z');
  });

  it('the projected job view has exactly the job-file fields, filled from the run record', async () => {
    const brief = writeBrief();
    const h = harness({ listing: [{ id: 'abcdef12', sessionId: 'abcdef12-0000-4000-8000-000000000000', name: 'my-task' }] });
    await h.call(launchArgv(brief, ['--item=3730', '--kind=build']));

    const jobs = readJobView({}, { store: h.store, listAgents: () => [{ id: 'abcdef12', sessionId: 'abcdef12-0000-4000-8000-000000000000' }], readCompletion: () => null });
    expect(jobs).toHaveLength(1);
    expect(Object.keys(jobs[0]).sort()).toEqual(JOB_FIELDS);
    expect(jobs[0]).toEqual({
      kind: 'build', item: '3730', session: 'my-task', agentId: 'abcdef12', launchedAt: expect.any(String),
      brief, result: null, state: 'working', note: null,
    });
  });

  it('a second call with the same session slug is refused as already in flight, and spawns nothing', async () => {
    const brief = writeBrief();
    const h = harness({ listing: [{ id: 'abcdef12', sessionId: 'abcdef12-0000-4000-8000-000000000000' }] });
    const first = await h.call(launchArgv(brief));
    expect(first.code).toBe(0);
    expect(h.spawn.calls).toHaveLength(1);

    const second = await h.call(launchArgv(brief));
    expect(second.code).toBe(1);
    expect(second.lines.join('\n')).toMatch(/refused: already-in-flight/);
    expect(h.spawn.calls).toHaveLength(1);
    const dispatches = h.store.list().flatMap((id) => h.store.read(id).effects);
    expect(dispatches).toHaveLength(1);
  });

  it('a refusal in JSON mode carries the hold and the reason, exit 1', async () => {
    const brief = writeBrief();
    const h = harness({ listing: [{ id: 'abcdef12', sessionId: 'abcdef12-0000-4000-8000-000000000000' }] });
    await h.call(launchArgv(brief));
    const second = await h.call(launchArgv(brief, ['--json']));
    expect(second.code).toBe(1);
    const payload = JSON.parse(second.lines.join('\n'));
    expect(payload.refused).toMatchObject({ hold: 'already-in-flight' });
    expect(payload.subscribe).toBeUndefined();
  });

  it('a different slug is not held by the first', async () => {
    const brief = writeBrief();
    const h = harness({ listing: [{ id: 'abcdef12', sessionId: 'abcdef12-0000-4000-8000-000000000000' }] });
    await h.call(launchArgv(brief));
    const other = await h.call([`--brief=${brief}`, '--session=other-task']);
    expect(other.code).toBe(0);
    expect(h.spawn.calls).toHaveLength(2);
  });

  it('refuses a brief that is not a file, before any spawn', async () => {
    const h = harness();
    const out = await h.call(launchArgv(join(scratch, 'missing.md')));
    expect(out.code).toBe(1);
    expect(out.lines.join('\n')).toMatch(/refused: brief-missing/);
    expect(h.spawn.calls).toHaveLength(0);
  });

  it('a relative brief path is resolved and handed to the worker ABSOLUTE', async () => {
    writeBrief();
    const h = harness();
    await h.call(['--brief=brief.md', '--session=my-task']);
    const prompt = h.spawn.calls[0].argv.at(-1);
    expect(prompt).toContain(join(scratch, 'brief.md'));
  });
});

// ── the argv the worker is started with ────────────────────────────────────────────────────────────────────

describe('dispatch-task — the spawn argv', () => {
  it('goes through buildAgentArgv: --bg, -n <slug>, the shared prompt LAST, permission mode auto by default', async () => {
    const brief = writeBrief();
    const h = harness();
    await h.call(launchArgv(brief));
    const { argv } = h.spawn.calls[0];
    expect(argv[0]).toBe('--bg');
    expect(argv[argv.indexOf('-n') + 1]).toBe('my-task');
    expect(argv[argv.indexOf('--permission-mode') + 1]).toBe('auto');
    expect(argv.some((a) => a.startsWith('--allowedTools'))).toBe(false);
    expect(argv.at(-1)).toBe(buildBriefLaunchPrompt({ briefPath: brief, session: 'my-task' }));
  });

  it('an explicit --permissionMode overrides the default', async () => {
    const brief = writeBrief();
    const h = harness();
    await h.call(launchArgv(brief, ['--permissionMode=plan']));
    const { argv } = h.spawn.calls[0];
    expect(argv[argv.indexOf('--permission-mode') + 1]).toBe('plan');
  });

  it('an unknown permission mode is refused by the declared enum, before any run', async () => {
    const h = harness();
    const out = await h.call(launchArgv(writeBrief(), ['--permissionMode=yolo']));
    expect(out.code).toBe(2);
    expect(h.spawn.calls).toHaveLength(0);
    expect(h.store.list()).toEqual([]);
  });

  it('--allowedTools passes through as one token ahead of the prompt; unset by default', async () => {
    const brief = writeBrief();
    const h = harness();
    await h.call(launchArgv(brief, ['--allowedTools=Bash(git *),Edit']));
    const { argv } = h.spawn.calls[0];
    expect(argv).toContain('--allowedTools=Bash(git *),Edit');
    expect(argv.indexOf('--allowedTools=Bash(git *),Edit')).toBeLessThan(argv.length - 1);
    expect(argv.at(-1)).toMatch(/^Your assignment is the task brief/);
  });

  it('the operator\'s WE_DISPATCH_AGENT_ARGS come first, so a model set there reaches the worker', async () => {
    const brief = writeBrief();
    const h = harness({ extraArgs: ['--model', 'sonnet'] });
    await h.call(launchArgv(brief));
    const { argv } = h.spawn.calls[0];
    expect(argv[argv.indexOf('--model') + 1]).toBe('sonnet');
    expect(argv.indexOf('--model')).toBeLessThan(argv.indexOf('--permission-mode'));
  });

  it('a `model` input cannot be declared: it collides with the adapter\'s own control flag', () => {
    expect(Object.keys(dispatchTaskOperation({ readTask: () => ({}) }).input)).not.toContain('model');
  });
});

// ── what the orchestrator subscribes to ────────────────────────────────────────────────────────────────────

describe('dispatch-task — the subscribe output', () => {
  it('the LAST stdout line is `subscribe: <name> session=<id>`', async () => {
    const h = harness();
    const out = await h.call(launchArgv(writeBrief()));
    expect(out.lines.at(-1)).toBe('subscribe: my-task session=abcdef12');
  });

  it('the JSON result carries the same fact under `subscribe`', async () => {
    const h = harness();
    const out = await h.call(launchArgv(writeBrief(), ['--json']));
    expect(out.code).toBe(0);
    expect(JSON.parse(out.lines.join('\n')).subscribe).toEqual({ name: 'my-task', sessionId: 'abcdef12' });
  });

  it('subscribeTarget is null for a run that launched nothing', () => {
    expect(subscribeTarget({ effects: [] })).toBeNull();
    expect(subscribeTarget(null)).toBeNull();
  });

  it('finishTaskOutcome leaves an unparseable JSON payload alone', () => {
    expect(finishTaskOutcome({ run: { effects: [] }, code: 0, lines: ['not json'], json: true })).toEqual({ code: 0, lines: ['not json'] });
  });
});

// ── the guards ─────────────────────────────────────────────────────────────────────────────────────────────

describe('dispatch-task — the dispatch guards', () => {
  it('refuses from a lane checkout: nothing spawns and the effect is not left in flight', async () => {
    const brief = writeBrief();
    const laneRoot = join(scratch, 'lane-7');
    mkdirSync(laneRoot);
    const h = harness({ root: laneRoot });
    const out = await h.call(launchArgv(brief));
    expect(out.code).toBe(1);
    expect(out.lines.join('\n')).toMatch(/refusing to start a delivery agent from the lane checkout/);
    expect(h.spawn.calls).toHaveLength(0);
    const effects = h.store.list().flatMap((id) => h.store.read(id).effects);
    expect(effects.map((e) => e.status)).toEqual(['failed']);
    // a failed launch does not hold the slug: a retry from a proper checkout is allowed
    expect(inFlightTaskRuns('my-task', { store: h.store }).runs).toEqual([]);
  });

  it('refuses from a stale checkout with the refresh hint, and nothing spawns', async () => {
    const h = harness({ checkStaleness: () => ({ action: 'warn', behind: 151, ahead: 0, dirty: false, warning: 'behind' }) });
    const out = await h.call(launchArgv(writeBrief()));
    expect(out.code).toBe(1);
    expect(out.lines.join('\n')).toMatch(/dispatch-task: .*151 commit\(s\) behind origin\/main.*Sync \(git pull --ff-only\)/);
    expect(h.spawn.calls).toHaveLength(0);
  });

  it('a spawn that provably never started (ENOENT) is a failed effect, not an in-flight one', async () => {
    const h = harness({ spawn: fakeSpawn({ fail: Object.assign(new Error('spawn claude ENOENT'), { code: 'ENOENT' }) }) });
    const out = await h.call(launchArgv(writeBrief()));
    expect(out.code).toBe(1);
    expect(h.store.list().flatMap((id) => h.store.read(id).effects).map((e) => e.status)).toEqual(['failed']);
  });

  describe('the staleness base — measured against a real git remote (real-repo fixtures)', () => {
    /** A clone checked out on a `proto` branch that exists on the origin, the way a prototype-tip dispatch clone is. */
    function onProto({ clone, git, seedOriginBranch }) {
      seedOriginBranch('proto', { 'proto.txt': '1' });
      git(['fetch', 'origin', 'proto']);
      git(['checkout', '-b', 'proto', 'FETCH_HEAD']);
      git(['fetch', 'origin']);
      return clone;
    }

    it('from a prototype-tip checkout, --base=<prototype branch> passes while the checkout is at the tip', async () => {
      await withBareOrigin(async (ctx) => {
        const root = onProto(ctx);
        const h = harness({ root, realStaleness: true });
        const out = await h.call(launchArgv(writeBrief(), ['--base=proto']));
        expect(out.code).toBe(0);
        expect(h.spawn.calls).toHaveLength(1);
      });
    });

    it('and refuses once origin/<prototype branch> has moved past the checkout, naming that branch', async () => {
      await withBareOrigin(async (ctx) => {
        const root = onProto(ctx);
        ctx.seedOriginBranch('proto', { 'more.txt': '1' }, 'proto');
        const h = harness({ root, realStaleness: true });
        const out = await h.call(launchArgv(writeBrief(), ['--base=proto']));
        expect(out.code).toBe(1);
        expect(out.lines.join('\n')).toMatch(/1 commit\(s\) behind origin\/proto/);
        expect(h.spawn.calls).toHaveLength(0);
      });
    });

    it('with the default base (main), a prototype-tip checkout has no local main: the guard cannot tell and does not block', async () => {
      await withBareOrigin(async (ctx) => {
        const root = onProto(ctx);
        ctx.git(['branch', '-D', 'main']);
        const h = harness({ root, realStaleness: true });
        const out = await h.call(launchArgv(writeBrief()));
        expect(out.code).toBe(0);
      });
    });

    it('a NARROW clone (#3264 geometry) cannot see origin/<base> after the fetch: the guard degrades to "cannot tell", it does not refuse', async () => {
      await withNarrowClone(async (ctx) => {
        expect(ctx.fetchRefspecs().some((r) => r.includes('*'))).toBe(false);
        ctx.seedOriginBranch('proto', { 'proto.txt': '1' });
        ctx.git(['fetch', 'origin', 'proto']);
        ctx.git(['checkout', '-b', 'proto', 'FETCH_HEAD']);
        ctx.seedOriginBranch('proto', { 'more.txt': '1' }, 'proto');
        const h = harness({ root: ctx.clone, realStaleness: true });
        const out = await h.call(launchArgv(writeBrief(), ['--base=proto']));
        // Documented weakness, pinned so a change to it is deliberate: staleness is unmeasurable here.
        expect(out.code).toBe(0);
      });
    });
  });
});

// ── real mechanism: real process, real stores ──────────────────────────────────────────────────────────────

describe('dispatch-task — against a real process and real stores (#2949)', () => {
  let fake;
  afterEach(() => { if (fake) fake.cleanup(); fake = null; });

  /** The REAL defaultSpawnAgent and defaultListAgents, with the fake `claude` first on PATH. */
  function realSeams() {
    fake = withFakeClaude();
    const env = { ...process.env, ...fake.env };
    fake.assertWins(env);
    return {
      env,
      spawnAgent: (argv, opts) => defaultSpawnAgent(argv, { ...opts, env: { ...opts.env, ...fake.env } }),
      listAgents: () => defaultListAgents({ env }),
    };
  }

  it('the fake CLI ACCEPTS the argv, and the job view reads liveness from its real listing', async () => {
    const seams = realSeams();
    const store = createFileRunStore(join(scratch, 'runs'));
    const declaration = dispatchTaskOperation({ readTask: createTaskReader({ store, listAgents: seams.listAgents, now: () => NOW, cwd: scratch }) });
    const registry = createRegistry(); registry.register(declaration);
    const sinks = createDispatchTaskSinks({ root: scratch, spawnAgent: seams.spawnAgent, checkStaleness: FRESH, now: () => NOW });

    const out = await runOperationCli({ declaration, registry, store, sinks, newRunId: () => 'run-real-1',
      argv: launchArgv(writeBrief(), ['--item=3730', '--allowedTools=Bash(git *)']) });
    expect(out.code).toBe(0);

    const listed = fake.sessions();
    expect(listed).toHaveLength(1);
    expect(listed[0].name).toBe('my-task');
    const argv = fake.lastArgv();
    expect(argv).toContain('--allowedTools=Bash(git *)');
    expect(argv[argv.indexOf('--permission-mode') + 1]).toBe('auto');

    const [job] = readJobView({}, { store, listAgents: seams.listAgents, readCompletion: () => null });
    expect(job).toMatchObject({ session: 'my-task', agentId: listed[0].id, state: 'working', item: '3730' });
  });

  it('the run record is visible to the readers runner-activity uses: the item row, and the no-item row', async () => {
    const seams = realSeams();
    const store = createFileRunStore(join(scratch, 'runs'));
    const declaration = dispatchTaskOperation({ readTask: createTaskReader({ store, listAgents: seams.listAgents, now: () => NOW, cwd: scratch }) });
    const registry = createRegistry(); registry.register(declaration);
    const sinks = createDispatchTaskSinks({ root: scratch, spawnAgent: seams.spawnAgent, checkStaleness: FRESH, now: () => NOW });
    let n = 0;
    const run = (argv) => runOperationCli({ declaration, registry, store, sinks, newRunId: () => `run-real-${++n}`, argv });
    await run(launchArgv(writeBrief(), ['--item=3730']));
    await run([`--brief=${join(scratch, 'brief.md')}`, '--session=no-item-task']);

    // `runner-activity` collects in-flight dispatches through `inFlightDispatchesFor`, keyed by `payload.num`.
    expect(inFlightDispatchesFor('3730', { store }).runs.map((r) => r.handle)).toHaveLength(1);
    expect(inFlightDispatchesFor('', { store }).runs).toHaveLength(1);
  });

  it('a worker that reports done through the completion CLI moves the job to done with its result, no hand edit', async () => {
    const seams = realSeams();
    const runs = join(scratch, 'runs');
    const completions = join(scratch, 'completions');
    const store = createFileRunStore(runs);
    const declaration = dispatchTaskOperation({ readTask: createTaskReader({ store, listAgents: seams.listAgents, now: () => NOW, cwd: scratch }) });
    const registry = createRegistry(); registry.register(declaration);
    const sinks = createDispatchTaskSinks({ root: scratch, spawnAgent: seams.spawnAgent, checkStaleness: FRESH, now: () => NOW });
    await runOperationCli({ declaration, registry, store, sinks, newRunId: () => 'run-real-9', argv: launchArgv(writeBrief()) });

    const before = process.env.OPERATION_COMPLETIONS_DIR;
    process.env.OPERATION_COMPLETIONS_DIR = completions;
    try {
      // exactly what the launch prompt tells the worker to run
      runReport({ session: 'my-task', kind: 'task', status: 'done', outcome: '/work/result.md' });
      const [job] = readJobView({}, { store, listAgents: seams.listAgents });
      expect(job).toMatchObject({ session: 'my-task', state: 'done', result: '/work/result.md', note: '/work/result.md' });
    } finally {
      if (before === undefined) delete process.env.OPERATION_COMPLETIONS_DIR; else process.env.OPERATION_COMPLETIONS_DIR = before;
    }
  });

  it('a completion record of kind `task` is valid', () => {
    expect(newCompletionRecord({ session: 'my-task', kind: 'task' })).toMatchObject({ kind: 'task', status: 'started' });
  });
});

// ── the projection, pure ───────────────────────────────────────────────────────────────────────────────────

describe('projectJobs', () => {
  const run = (over = {}) => ({
    op: DISPATCH_TASK_OP,
    effects: [{ key: 'r#2#0', type: DISPATCH_EFFECT, status: 'in-flight', handle: 'abcdef12', startedAt: '2026-09-21T09:00:00.000Z',
      payload: { sessionSlug: 's1', brief: '/b.md', launchKind: 'task' }, ...over }],
  });

  it('ignores runs of other operations', () => {
    expect(projectJobs({ runs: [{ ...run(), op: 'dispatch-lane' }] })).toEqual([]);
  });

  it.each([
    ['in flight and listed', run(), { 'r#2#0': true }, {}, 'working'],
    ['in flight with unknown liveness', run(), {}, {}, 'working'],
    ['in flight and no longer listed, nothing reported', run(), { 'r#2#0': false }, {}, 'gone'],
    ['resolved by the observer', run({ status: 'applied', result: { resolvedBy: 'pr-merged' } }), {}, {}, 'done'],
    ['failed', run({ status: 'failed', error: 'boom' }), {}, {}, 'failed'],
    ['reported done by the worker', run(), { 'r#2#0': false }, { s1: { status: 'done', outcome: '/r.md' } }, 'done'],
  ])('%s → %s', (_name, r, liveness, completions, state) => {
    expect(projectJobs({ runs: [r], liveness, completions })[0].state).toBe(state);
  });

  it('lists the newest launch first', () => {
    const a = run(); const b = run({ key: 'r2#2#0', startedAt: '2026-09-21T09:30:00.000Z', payload: { sessionSlug: 's2', brief: '/c.md' } });
    expect(projectJobs({ runs: [a, b] }).map((j) => j.session)).toEqual(['s2', 's1']);
  });
});
