import { describe, it, expect } from 'vitest';
import { buildSupervisionTree, deriveTaskLifecycle, renderSupervisionTreeMarkdown } from '../dispatch-supervision-tree.mjs';
import { buildDispatchProfile } from '../dispatch-contracts.mjs';

const now = 'operator supplied as-of';
const supervisor = { provider: 'claude', model: 'claude-opus-5', sessionId: null };
const agent = (storyRef, taskId) => ({ provider: 'codex', model: 'gpt-6-astra', executor: 'codex-direct-task', supervisionLevel: 'full', sessionName: `t-${storyRef}-r1-${taskId}` });
const task = (id, dependsOn = [], title = `Task ${id}`) => ({ id, title, dependsOn, agent: null, status: 'planned', profile: buildDispatchProfile({ taskType: 'doc-fix', estimatedLoc: 30, filesTouched: [`docs/${id}.md`], acceptanceTestable: true, dependsOn }).profile });
const result = (storyRef, taskId, status, attempt = 1) => ({ storyRef, round: 1, taskId, attempt, status, ...agent(storyRef, taskId), authorRef: `author-${taskId}`, supervisor, taskType: 'doc-fix', evidence: status === 'landed' ? { pr: 1, tests: { command: 'test', passed: 1, failed: 0 } } : {}, findings: [] });
const verdict = (storyRef, taskId, judgment, attempt = 1, mode = 'acting') => ({ storyRef, round: 1, taskId, attempt, mode, verdict: judgment, supervisor: { ...supervisor, sessionId: 'verdict-session' }, storyTaskType: 'doc-fix', verifiedBy: 'other', findings: judgment === 'accept' ? [] : ['Needs work'] });
const unknownAgent = { provider: 'unknown', model: 'unknown', executor: 'unknown', supervisionLevel: 'unknown', sessionName: 'unknown' };
const counts = extra => ({ total: 0, planned: 0, dispatched: 0, landed: 0, blocked: 0, failed: 0, validated: 0, reworked: 0, unknown: 0, ...extra });
function fixture() {
  return {
    plans: [
      { storyRef: 'x4e6oux', round: 1, supervisor: { provider: 'codex', model: 'gpt-6-astra', sessionId: 'sup-x' }, tasks: [task('b', ['a'], 'Blocked on dependency'), task('a')] },
      { storyRef: '3383', round: 1, supervisor, tasks: [task('t3', ['t1']), task('t2', ['t1']), task('t1')] },
    ],
    results: [result('3383', 't1', 'landed', 1), result('3383', 't1', 'landed', 2), result('x4e6oux', 'b', 'blocked'), result('x4e6oux', 'a', 'landed')],
    verdicts: [verdict('3383', 't1', 'rework'), verdict('3383', 't1', 'accept', 2), verdict('x4e6oux', 'a', 'reject', 9, 'shadow')],
    dispatches: [
      { kind: 'supervisor', storyRef: '3383', round: 1, supervisor: { ...supervisor, sessionId: 'sup-3383' } },
      { kind: 'task', storyRef: '3383', round: 1, taskId: 't1', agent: agent('3383', 't1') },
      { kind: 'task', storyRef: '3383', round: 1, taskId: 't2', agent: agent('3383', 't2') },
    ],
  };
}
const expected = () => [
  { story: '3383', round: 1, asOf: now, supervisor: { ...supervisor, sessionId: 'sup-3383' }, tasks: [
    { taskId: 't1', title: 'Task t1', status: 'validated', agent: agent('3383', 't1'), dependsOn: [], complexity: 'S', risk: 'low', parallelWith: [] },
    { taskId: 't2', title: 'Task t2', status: 'dispatched', agent: agent('3383', 't2'), dependsOn: ['t1'], complexity: 'S', risk: 'low', parallelWith: ['t3'] },
    { taskId: 't3', title: 'Task t3', status: 'planned', agent: unknownAgent, dependsOn: ['t1'], complexity: 'S', risk: 'low', parallelWith: ['t2'] },
  ], parallelGroups: [['t2', 't3']], parallelKnown: true, counts: counts({ total: 3, planned: 1, dispatched: 1, validated: 1 }) },
  { story: 'x4e6oux', round: 1, asOf: now, supervisor: { provider: 'codex', model: 'gpt-6-astra', sessionId: 'sup-x' }, tasks: [
    { taskId: 'a', title: 'Task a', status: 'landed', agent: agent('x4e6oux', 'a'), dependsOn: [], complexity: 'S', risk: 'low', parallelWith: [] },
    { taskId: 'b', title: 'Blocked on dependency', status: 'blocked', agent: agent('x4e6oux', 'b'), dependsOn: ['a'], complexity: 'S', risk: 'low', parallelWith: [] },
  ], parallelGroups: [], parallelKnown: true, counts: counts({ total: 2, landed: 1, blocked: 1 }) },
];

describe('supervision tree projection', () => {
  it('projects the exact ordered two-story fixture with lifecycle and parallel components', () => {
    expect(buildSupervisionTree(fixture(), { now })).toEqual(expected());
  });
  it('is byte-identical under repetition and shuffled input order, without mutation', () => {
    const records = fixture(), before = JSON.stringify(records), first = JSON.stringify(buildSupervisionTree(records, { now }));
    expect(JSON.stringify(buildSupervisionTree(records, { now }))).toBe(first);
    const shuffled = Object.fromEntries(Object.entries(records).map(([k, rows]) => [k, [...rows].reverse()]));
    expect(JSON.stringify(buildSupervisionTree(shuffled, { now }))).toBe(first);
    // Task declaration order also does not affect the projection.
    shuffled.plans = shuffled.plans.map(p => ({ ...p, tasks: [...p.tasks].reverse() }));
    expect(JSON.stringify(buildSupervisionTree(shuffled, { now }))).toBe(first);
    expect(JSON.stringify(records)).toBe(before);
  });
  it('sorts story strings by code units and rounds numerically, then dependencies before ids', () => {
    const records = { plans: ['z', 'a', 'Z', '10', '2'].flatMap(storyRef => [10, 2, 1].map(round => ({ storyRef, round, supervisor, tasks: [task('a', ['z']), task('z'), task('b')] }))) };
    const tree = buildSupervisionTree(records);
    expect(tree.map(g => `${g.story}/${g.round}`)).toEqual(['10/1', '10/2', '10/10', '2/1', '2/2', '2/10', 'Z/1', 'Z/2', 'Z/10', 'a/1', 'a/2', 'a/10', 'z/1', 'z/2', 'z/10']);
    expect(tree[0].tasks.map(t => t.taskId)).toEqual(['b', 'z', 'a']);
    expect(tree.every(g => g.asOf === null)).toBe(true);
    expect(buildSupervisionTree(records, { now: 1 })[0].asOf).toBeNull();
  });
  it('does not invent missing provenance, dependencies or task descriptions', () => {
    const tree = buildSupervisionTree({ results: [result('42', 'orphan', 'landed')] });
    expect(tree[0]).toMatchObject({ story: '42', supervisor: { provider: 'unknown', model: 'unknown', sessionId: 'unknown' }, parallelKnown: false, parallelGroups: [], counts: counts({ total: 1, landed: 1 }) });
    expect(buildSupervisionTree({ plans: [{ storyRef: '42', round: 1, supervisor: { provider: null, model: null, sessionId: null }, tasks: [{ id: 'a', title: null, profile: { complexity: null, risk: null } }] }] })[0]).toMatchObject({ supervisor: { provider: 'unknown', model: 'unknown', sessionId: null }, tasks: [{ title: 'unknown', complexity: 'unknown', risk: 'unknown' }] });
    expect(tree[0].tasks[0]).toEqual({ taskId: 'orphan', title: 'unknown', status: 'landed', agent: agent('42', 'orphan'), dependsOn: null, complexity: 'unknown', risk: 'unknown', parallelWith: [] });
    const planned = buildSupervisionTree({ plans: [{ storyRef: '42', round: 1, tasks: [task('a')] }] })[0];
    expect(planned.tasks[0].agent).toEqual(unknownAgent); expect(planned.parallelKnown).toBe(false);
    const onlyVerdict = buildSupervisionTree({ verdicts: [verdict('42', 'v', 'rework')] })[0];
    expect(onlyVerdict.supervisor.sessionId).toBe('verdict-session');
    expect(onlyVerdict.tasks[0]).toMatchObject({ title: 'unknown', status: 'reworked', agent: unknownAgent, dependsOn: null });
    const onlyShadow = buildSupervisionTree({ verdicts: [verdict('42', 'v', 'reject', 1, 'shadow')] })[0];
    expect(onlyShadow.tasks[0].status).toBe('unknown');
    expect(onlyShadow.counts.unknown).toBe(1);
  });
  it('honors supervisor and agent precedence with explicit nulls', () => {
    const f = fixture();
    f.plans[1].supervisor = { ...supervisor, sessionId: 'plan-session' };
    f.plans[1].tasks.find(t => t.id === 't1').agent = { ...agent('3383', 't1'), model: 'plan-agent' };
    expect(buildSupervisionTree(f)[0].supervisor.sessionId).toBe('plan-session');
    expect(buildSupervisionTree(f)[0].tasks[0].agent.model).toBe('gpt-6-astra');
    f.dispatches = f.dispatches.filter(d => d.kind !== 'task');
    expect(buildSupervisionTree(f)[0].tasks[0].agent.model).toBe('plan-agent');
    const dispatchOnly = buildSupervisionTree({ dispatches: [{ kind: 'supervisor', storyRef: '42', round: 1, supervisor }, { kind: 'task', storyRef: '42', round: 1, taskId: 'a', agent: { provider: 'both', model: null, executor: null, supervisionLevel: 'full', sessionName: null } }] })[0];
    expect(dispatchOnly.supervisor).toEqual(supervisor);
    expect(dispatchOnly.tasks[0]).toMatchObject({ status: 'dispatched', agent: { model: 'unknown', executor: null, sessionName: null } });
  });
  it('handles cyclic and unknown dependencies with a sorted unresolved remainder', () => {
    for (const tasks of [[task('b', ['a']), task('a', ['b']), task('z')], [task('b', ['missing']), task('a', ['b']), task('z')]]) {
      const out = buildSupervisionTree({ plans: [{ storyRef: '42', round: 1, supervisor, tasks }] })[0];
      expect(out.tasks.map(t => t.taskId)).toEqual(['z', 'a', 'b']);
      expect(out.parallelKnown).toBe(false); expect(out.parallelGroups).toEqual([]); expect(out.tasks.every(t => !t.parallelWith.length)).toBe(true);
    }
  });
  it('reports components rather than claiming they are cliques', () => {
    const a = task('a'), b = task('b'), cc = task('c');
    cc.profile.filesTouched = [...a.profile.filesTouched];
    const out = buildSupervisionTree({ plans: [{ storyRef: '42', round: 1, supervisor, tasks: [cc, b, a] }] })[0];
    expect(out.parallelGroups).toEqual([['a', 'b', 'c']]);
    expect(out.tasks[0].parallelWith).toEqual(['b']); expect(out.tasks[1].parallelWith).toEqual(['a', 'c']);
  });
  it('chooses latest attempts and deterministic JSON ties across shuffled duplicates', () => {
    const records = { results: [result('42', 'a', 'landed', 1), result('42', 'a', 'failed', 2), { ...result('42', 'a', 'blocked', 2), model: 'latest-model' }], verdicts: [verdict('42', 'a', 'accept', 1)] };
    const out = buildSupervisionTree(records);
    expect(out[0].tasks[0].status).toBe('failed');
    expect(JSON.stringify(buildSupervisionTree({ results: [...records.results].reverse(), verdicts: records.verdicts }))).toBe(JSON.stringify(out));
    const duplicate = fixture(); duplicate.plans.push({ ...duplicate.plans[1], supervisor: { ...supervisor, sessionId: 'z' } });
    duplicate.dispatches.push({ ...duplicate.dispatches[0], supervisor: { ...supervisor, sessionId: 'another' } });
    expect(JSON.stringify(buildSupervisionTree(duplicate))).toBe(JSON.stringify(buildSupervisionTree(Object.fromEntries(Object.entries(duplicate).map(([k, v]) => [k, [...v].reverse()])))));
  });
  it('tolerates empty, absent, garbage, cyclic and hostile input', () => {
    const cyclic = {}; cyclic.self = cyclic;
    const hostile = new Proxy({}, { get() { throw Error('hostile'); } });
    for (const input of [undefined, null, [], 'x', 1, {}, { plans: null, results: {}, verdicts: 3, dispatches: 'x' }, { plans: [null, {}, cyclic, hostile] }, hostile]) expect(buildSupervisionTree(input)).toEqual([]);
  });
});

describe('task lifecycle', () => {
  it('applies verdict, result, dispatch, plan and unknown precedence', () => {
    for (const [judgment, status] of [['accept', 'validated'], ['rework', 'reworked'], ['reject', 'failed']]) expect(deriveTaskLifecycle({ verdicts: [verdict('42', 'a', judgment)], results: [result('42', 'a', 'landed')], dispatch: {}, task: task('a') })).toBe(status);
    for (const status of ['landed', 'blocked', 'failed']) expect(deriveTaskLifecycle({ results: [result('42', 'a', status)], dispatch: {}, task: task('a') })).toBe(status);
    expect(deriveTaskLifecycle({ dispatch: {}, task: task('a') })).toBe('dispatched');
    expect(deriveTaskLifecycle({ task: { ...task('a'), status: 'reworked' } })).toBe('reworked');
    expect(deriveTaskLifecycle({ task: {} })).toBe('planned');
    expect(deriveTaskLifecycle()).toBe('unknown');
    expect(deriveTaskLifecycle(null)).toBe('unknown');
    expect(deriveTaskLifecycle({ verdicts: [verdict('42', 'a', 'accept', 1)], results: [result('42', 'a', 'blocked', 2)] })).toBe('blocked');
    expect(deriveTaskLifecycle({ verdicts: [verdict('42', 'a', 'reject', 9, 'shadow')], results: [result('42', 'a', 'landed')] })).toBe('landed');
  });
});

describe('markdown rendering', () => {
  it('renders the exact fixture with no trailing newline', () => {
    expect(renderSupervisionTreeMarkdown(buildSupervisionTree(fixture(), { now }))).toBe([
      '- **3383 r1** — supervisor claude/claude-opus-5 [sup-3383] — 3 tasks: planned 1, dispatched 1, validated 1',
      '  - `t1` validated — codex/gpt-6-astra via codex-direct-task (full) — S/low — Task t1',
      '  - `t2` dispatched — codex/gpt-6-astra via codex-direct-task (full) — S/low — Task t2 — parallel: t3 — after: t1',
      '  - `t3` planned — unknown/unknown via unknown (unknown) — S/low — Task t3 — parallel: t2 — after: t1',
      '- **x4e6oux r1** — supervisor codex/gpt-6-astra [sup-x] — 2 tasks: landed 1, blocked 1',
      '  - `a` landed — codex/gpt-6-astra via codex-direct-task (full) — S/low — Task a',
      '  - `b` blocked — codex/gpt-6-astra via codex-direct-task (full) — S/low — Blocked on dependency — after: a',
    ].join('\n'));
  });
  it('prints unknowns and explicit nulls as specified', () => {
    const records = { dispatches: [{ kind: 'supervisor', storyRef: '42', round: 1, supervisor }, { kind: 'task', storyRef: '42', round: 1, taskId: 'a', agent: { executor: null, sessionName: null } }] };
    expect(renderSupervisionTreeMarkdown(buildSupervisionTree(records))).toBe('- **42 r1** — supervisor claude/claude-opus-5 [no-session] — 1 tasks: dispatched 1\n  - `a` dispatched — unknown/unknown via - (unknown) — unknown/unknown — unknown');
    expect(renderSupervisionTreeMarkdown(buildSupervisionTree({ verdicts: [{ storyRef: '42', round: 1, taskId: 'a', mode: 'shadow' }] }))).toBe('- **42 r1** — supervisor unknown/unknown [unknown] — 1 tasks: unknown 1\n  - `a` unknown — unknown/unknown via unknown (unknown) — unknown/unknown — unknown');
  });
  it('fails malformed trees closed', () => {
    for (const tree of [undefined, null, {}, [], [null], [{}], [{ story: '42', round: 1, supervisor: {}, counts: {}, tasks: [] }], [{ ...expected()[0], tasks: [null] }], [{ ...expected()[0], tasks: [{ ...expected()[0].tasks[0], title: undefined }] }]]) expect(renderSupervisionTreeMarkdown(tree)).toBe('_no supervision data_');
  });
});
