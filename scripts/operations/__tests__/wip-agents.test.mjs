/** Mechanical facts: no judgment filters, no inferred default for Gemini. */
import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { classifyAgents, classifyLiveness, ACTIVE_WINDOW_MS, classifyDrain, renderDrain, renderTable, extractDelegations, lastAssistantModel, pickSupervisor, pickExecutor, wipAgentsOperation } from '../wip-agents.mjs';
import { sessionTarget } from '../../conveyor/session-reaper.mjs';
import { CODEX_MODEL } from '../../codex-direct-task.mjs';
import { createRegistry } from '../registry.mjs';
import { startRun, advanceWhileRunning } from '../engine.mjs';
const entry = (command) => ({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Bash', input: { command } }] } });
const scan = (...cmds) => extractDelegations(cmds.map(entry), { defaults: { codex: CODEX_MODEL } });
it.each(['conveyor-12', 'prepare-decision-42a', 'prepare-7', 'review-12', 'fix-3B', 'ci-heal-8', 'blah', '', null, 'conveyor-3-extra'])('pins name grammar against sessionTarget: %s', (name) => {
  const t = sessionTarget(name);
  expect(classifyAgents({ agents: [{ name }], now: 0 })[0].target).toBe(t ? `${t.kind === 'item' ? 'item' : 'PR'} #${t.id}` : null);
});
it.each(['node scripts/codex-direct-task.mjs --model explicit', 'FOO=1 /bin/node --no-warnings scripts/codex-direct-task.mjs -m "explicit"', 'true && node --require helper scripts/codex-direct-task.mjs --model=explicit', '(node scripts/codex-direct-task.mjs --model explicit)', 'true;\nnode scripts/codex-direct-task.mjs --model explicit', 'false || node scripts/codex-direct-task.mjs --model explicit', 'echo a | node scripts/codex-direct-task.mjs --model explicit'])('recognizes execution: %s', (cmd) => expect(scan(cmd)).toEqual([{ provider: 'Codex', model: 'explicit' }]));
it.each(['grep codex-direct-task.mjs', 'cat scripts/gemini-direct-task.mjs', 'ps aux | grep codex-direct-task', 'echo "node scripts/codex-direct-task.mjs"', "echo 'a; node scripts/codex-direct-task.mjs'", 'rg node scripts/codex-direct-task.mjs', 'ls scripts/codex-direct-task.mjs', 'sed node scripts/codex-direct-task.mjs', 'node -e "node scripts/codex-direct-task.mjs"', 'node docs/codex-direct-task.mjs.md', '# node scripts/codex-direct-task.mjs'])('rejects mention: %s', (cmd) => expect(scan(cmd)).toEqual([]));
it('ignores user lines and Read tools', () => {
  const e = entry('node scripts/codex-direct-task.mjs'); e.type = 'user';
  const r = entry('node scripts/codex-direct-task.mjs'); r.message.content[0].name = 'Read';
  expect(extractDelegations([e, r])).toEqual([]);
});
it('uses real Codex default, no Gemini pin, stable providers and last model', () => {
  expect(scan('node scripts/codex-direct-task.mjs')).toEqual([{ provider: 'Codex', model: CODEX_MODEL }]);
  expect(scan('node scripts/gemini-direct-task.mjs')).toEqual([{ provider: 'Gemini', model: 'unknown' }]);
  expect(scan('node scripts/codex-direct-task.mjs', 'node scripts/gemini-direct-task.mjs --model=g2', 'node scripts/codex-direct-task.mjs -m c2')).toEqual([{ provider: 'Codex', model: 'c2' }, { provider: 'Gemini', model: 'g2' }]);
});
it('keeps last real assistant model and dispatch precedence', () => {
  expect(lastAssistantModel([{ type: 'assistant', message: { model: 'claude-real' } }, { type: 'assistant', message: { model: '<synthetic>' } }])).toBe('claude-real');
  expect(pickSupervisor({ supervisorModel: 'claude-dispatch' }, 'claude-tail').model).toBe('claude-dispatch');
  expect(pickSupervisor({ supervisorModel: 'sonnet' }, 'claude-tail').source).toBe('transcript');
  expect(pickSupervisor({ supervisorModel: 'sonnet' }, null).model).toBe('requested: sonnet');
  expect(pickExecutor({ executor: { provider: 'Codex', model: 'recorded' } }, { status: 'none' }).source).toBe('dispatch');
  expect(pickExecutor(null, { status: 'unknown' }).source).toBe('unknown');
});
it('keeps odd and done rows, sorts and escapes cells', () => {
  const rows = classifyAgents({ agents: [{ id: 'b', sessionId: 'b', pid: 1, startedAt: 1, kind: 'interactive', status: 'waiting', waitingFor: 'dialog open', name: 'odd|\nname' }, { id: 'a', startedAt: 1 }, { id: 'c', startedAt: 2 }, { state: 'done' }], now: 11520001, facts: { b: { pidAlive: true } } });
  expect(rows.map((r) => r.id)).toEqual(['unknown', 'a', 'b', 'c']);
  const table = renderTable(rows);
  expect(table).toContain('⚠ waiting on: dialog open · waiting · state waiting · 3h 12m · transcript unknown');
  expect(table).toContain('odd\\| name');
  expect(table.split('\n')).toHaveLength(5);
  expect(renderTable([])).toContain('No live agents.');
  expect(renderTable(classifyAgents({ agents: [{ sessionId: 'x', pid: 1 }], now: 0, facts: { x: { pidAlive: true, transcriptScan: { status: 'none' } } } }))).toContain('| none |');
});
it('runs the registered compute declaration to a verdict', () => {
  const registry = createRegistry(); registry.register(wipAgentsOperation({ readAgents: () => ({ agents: [{}], now: 0 }) }));
  const run = advanceWhileRunning(startRun({ id: 'wip-test', op: 'wip-agents', input: {}, registry }), { registry });
  expect(run.verdict.rows).toHaveLength(1);
});

it('does not execute here-doc bodies or Node check/eval flags', () => {
  expect(scan('cat <<EOF\nnode scripts/codex-direct-task.mjs\nEOF')).toEqual([]);
  expect(scan('cat <<EOF\nnode scripts/codex-direct-task.mjs\nEOF\nnode scripts/gemini-direct-task.mjs')).toEqual([{ provider: 'Gemini', model: 'unknown' }]);
  expect(scan('node --check scripts/codex-direct-task.mjs', 'node -e123 scripts/codex-direct-task.mjs')).toEqual([]);
});

it('handles value-bearing Node flags and never guesses shell-expanded model ids', () => {
  expect(scan('node --max-old-space-size 4096 scripts/codex-direct-task.mjs -m explicit')).toEqual([{ provider: 'Codex', model: 'explicit' }]);
  expect(scan('node scripts/codex-direct-task.mjs --model "$MODEL"')).toEqual([{ provider: 'Codex', model: 'unknown' }]);
});

it('falls back to the sessionId prefix when an interactive row carries no short id, and renders day-scale ages', () => {
  const agents = [{ kind: 'interactive', sessionId: 'abcdef12-0000-4000-8000-000000000000', name: 'x', pid: 1, status: 'idle', startedAt: 0 }];
  const rows = classifyAgents({ agents, now: 26 * 3600000, facts: { [agents[0].sessionId]: { pidAlive: true } } });
  expect(rows[0].id).toBe('abcdef12');
  expect(renderTable(rows)).toContain('idle · 1d 2h');
});

it.each([
  [{ state: 'done' }, {}, 'done'], [{ kind: 'interactive', status: 'done', pid: 1 }, { pidAlive: true }, 'done'],
  [{ state: 'working' }, { pidAlive: true }, 'dead-record'], [{ pid: 1 }, { pidAlive: false }, 'dead-record'],
  [{ pid: 1, waitingFor: 'human' }, { pidAlive: false }, 'dead-record'],
  [{ pid: 1, waitingFor: 'human' }, { pidAlive: true }, 'waiting'],
  [{ pid: 1 }, { pidAlive: true, transcriptMtimeMs: 0 }, 'live-active'],
  [{ pid: 1 }, { pidAlive: true, transcriptMtimeMs: -1 }, 'live-idle'],
  [{ pid: 1 }, { pidAlive: true, transcriptMtimeMs: null }, 'live-idle'],
])('classifies liveness %j with %j as %s', (agent, facts, expected) => {
  expect(classifyLiveness(agent, { now: ACTIVE_WINDOW_MS, ...facts })).toBe(expected);
});
it('counts dead records by state in one trailing line, retaining every row in the data', () => {
  const now = 10 * 86400000;
  const agents = Array.from({ length: 30 }, (_, i) => ({ sessionId: `s${i}`, name: `agent-${i}`, state: i < 20 ? 'working' : 'blocked', startedAt: i < 10 ? 0 : now - 1000 }));
  const rows = classifyAgents({ agents, now }), table = renderTable(rows);
  expect(rows).toHaveLength(30);
  expect(rows.every((r) => r.liveness === 'dead-record')).toBe(true);
  expect(table.match(/dead-record/g)).toBeNull();
  expect(table.split('\n').at(-1)).toBe('Dead records (no process): 30 (working x20, blocked x10)');
  expect(table).toContain('| — | No live agents. | — | — |');
  expect(table).not.toContain('agent-5');
  expect(renderTable(classifyAgents({ agents: [{}], now }))).toContain('Dead records (no process): 1 (unknown x1)');
});
it('orders live groups by liveness then oldest start and reports a done live process only in the trailing line', () => {
  const agents = ['idle', 'wait', 'active-new', 'active-old', 'done-live', 'done-dead'].map((name, i) => ({ name, sessionId: name, pid: i + 1, startedAt: name === 'active-old' ? 0 : 1, state: name.startsWith('done') ? 'done' : 'working', waitingFor: name === 'wait' ? 'human' : null }));
  const facts = Object.fromEntries(agents.map((a) => [a.sessionId, { pidAlive: a.name !== 'done-dead', transcriptMtimeMs: a.name.startsWith('active') ? 1000 : null }]));
  const rows = classifyAgents({ agents, facts, now: 1000 }), table = renderTable(rows);
  expect(rows).toHaveLength(6);
  expect(table.indexOf('`active-old`')).toBeLessThan(table.indexOf('`active-new`'));
  expect(table.indexOf('`active-new`')).toBeLessThan(table.indexOf('`wait`'));
  expect(table.indexOf('`wait`')).toBeLessThan(table.indexOf('`idle`'));
  expect(table).not.toContain('done (process still alive)');
  expect(table).not.toContain('`done-live` (');
  expect(table).toContain('\nFinished, not yet reaped: 1 (`done-live`)\n');
  expect(table).toMatch(/1 done \(not shown\)$/);
  expect(rows.find((r) => r.name === 'active-old')).toMatchObject({ pid: 4, pidAlive: true, transcriptAgeMs: 0, wasState: 'working' });
});
const pr = { num: 2072, item: 3140, waitOn: ['couple-carrier:unknown'] };
const at = (h) => new Date(Date.UTC(2026, 8, 19, h, 54)).toISOString();
it('reports a twelve-hour deferral streak and the standing alert independently of its last log', () => {
  const passes = Array.from({ length: 14 }, (_, i) => ({ at: at(i + 9), deferredDetail: i ? [pr] : [] }));
  const alerts = [{ at: at(9), health: 'ok', signature: 'ok' }, ...[10, 14, 22].map((h) => ({ at: at(h), health: 'stuck', signature: 'stuck', types: ['considered-never-merged'] }))];
  const drain = classifyDrain({ passes, alerts, now: Date.parse(at(22)) });
  expect(drain.deferred[0]).toMatchObject({ streak: 13, capped: false, sinceAt: at(10) });
  expect(renderDrain(drain)).toBe('PR #2072 deferred every pass (13 passes, since 2026-09-19 06:54 EDT): couple-carrier:unknown (drain has flagged stuck [considered-never-merged] since 2026-09-19 06:54 EDT, last logged 2026-09-19 18:54 EDT)');
  expect(renderDrain(classifyDrain({ passes: passes.slice(1), alerts, now: Date.parse(at(22)) }))).toContain('at least 13 passes');
});
it('reports stale, unreadable, single-pass and clean drain evidence honestly', () => {
  const passes = [{ at: at(10), deferredDetail: [pr] }], now = Date.parse(at(10));
  expect(renderDrain(classifyDrain({ passes: null, alerts: [], now }))).toBe('drain: unknown (history.jsonl unreadable)');
  expect(renderDrain(classifyDrain({ passes, alerts: [], now }))).toBe('PR #2072 deferred this pass: couple-carrier:unknown (drain has not flagged it)');
  expect(renderDrain(classifyDrain({ passes, alerts: null, now }))).toContain('(drain alert log unreadable)');
  for (const health of ['ok', 'healthy']) expect(renderDrain(classifyDrain({ passes, alerts: [{ at: at(10), health }], now }))).toContain('(drain has not flagged it)');
  const clean = [{ at: at(10), deferredDetail: [] }];
  expect(renderDrain(classifyDrain({ passes: clean, alerts: [], now: now + ACTIVE_WINDOW_MS }))).toBe('drain: last pass clean (no deferred PRs)');
  expect(renderDrain(classifyDrain({ passes: clean, alerts: [], now: now + ACTIVE_WINDOW_MS + 1 }))).toBe('drain: last pass 15m ago (daemon may be stopped)');
  expect(renderDrain(classifyDrain({ passes, alerts: [], now: now + 3600000 }))).toMatch(/^drain: last pass 1h 0m ago \(daemon may be stopped\)\nPR #2072/);
  expect(renderDrain(classifyDrain({ passes: [{ at: at(10), deferredDetail: [{ ...pr, waitOn: [] }] }], alerts: [], now }))).toContain('no waitOn recorded');
});
it('breaks deferral streaks at missing PRs and alert runs at changed signatures', () => {
  const passes = [0, 1, 2].map((i) => ({ at: at(i), deferredDetail: i === 1 ? [] : [pr] }));
  const alerts = ['stuck', 'ok', 'stuck'].map((signature, i) => ({ at: at(i), signature }));
  const drain = classifyDrain({ passes, alerts, now: Date.parse(at(2)) });
  expect(drain.deferred[0]).toMatchObject({ streak: 1, capped: false, sinceAt: at(2) });
  expect(drain.alert.standingSince).toBe(at(2));
});

it('clamps future transcript ages', () => {
  const now = 8 * 86400000;
  const rows = classifyAgents({ agents: [{ sessionId: 's0', name: 'n0', pid: 1, startedAt: now }], now, facts: { s0: { pidAlive: true, transcriptMtimeMs: now + 1 } } });
  expect(rows[0].transcriptAgeMs).toBe(0);
});

const fixture = JSON.parse(readFileSync('scripts/operations/__fixtures__/wip-agents/finished-not-reaped.json', 'utf8'));
it('lists finished sessions with a live process as one trailing line, never as rows', () => {
  const rows = classifyAgents(fixture);
  expect(rows).toHaveLength(5);
  const lines = renderTable(rows).split('\n');
  expect(lines).toHaveLength(5);
  expect(lines.filter((l) => l.startsWith('| `'))).toHaveLength(2);
  expect(lines.at(-1)).toBe('Finished, not yet reaped: 3 (`conveyor-11`, `conveyor-12`, `review-13`)');
  expect(lines.join('\n')).not.toMatch(/done \(process still alive\)|\bdone\b.*state done/);
});
it('caps the finished-not-reaped names at six and counts the rest', () => {
  const agents = Array.from({ length: 9 }, (_, i) => ({ sessionId: `d${i}`, name: `n${i}`, state: 'done', pid: i + 1, startedAt: i }));
  const facts = Object.fromEntries(agents.map((a) => [a.sessionId, { pidAlive: true }]));
  const table = renderTable(classifyAgents({ agents, facts, now: 0 }));
  expect(table).toContain('| — | No live agents. | — | — |');
  expect(table.split('\n').at(-1)).toBe('Finished, not yet reaped: 9 (`n0`, `n1`, `n2`, `n3`, `n4`, `n5` +3 more)');
});
it('omits the finished line when no done session has a live process', () => {
  const { agents, facts, now } = fixture;
  const live = { agents: agents.filter((a) => a.state !== 'done'), facts, now };
  expect(renderTable(classifyAgents(live))).not.toContain('Finished, not yet reaped');
  const dead = { agents: [...live.agents, { sessionId: 'gone', state: 'done', pid: 9 }], facts: { ...facts, gone: { pidAlive: false } }, now };
  const table = renderTable(classifyAgents(dead));
  expect(table).not.toContain('Finished, not yet reaped');
  expect(table).toMatch(/1 done \(not shown\)$/);
});
const mixed = JSON.parse(readFileSync('scripts/operations/__fixtures__/wip-agents/live-finished-dead.json', 'utf8'));
it('prints only live rows, then Finished, then Dead records, then the not-shown line', () => {
  const rows = classifyAgents({ ...mixed, agents: [...mixed.agents, { sessionId: 'gone', name: 'gone-done', state: 'done', pid: 9 }], facts: { ...mixed.facts, gone: { pidAlive: false } } });
  const lines = renderTable(rows).split('\n');
  expect(rows).toHaveLength(9);
  expect(lines.filter((l) => l.startsWith('| `'))).toHaveLength(2);
  expect(lines.slice(2)).toEqual([
    expect.stringContaining('`conveyor-21`'), expect.stringContaining('`fix-22`'),
    'Finished, not yet reaped: 1 (`conveyor-11`)',
    'Dead records (no process): 5 (working x3, blocked x1, unknown x1)',
    '1 done (not shown)',
  ]);
});
it('omits both trailing lines when there is nothing finished or dead', () => {
  const live = { ...mixed, agents: mixed.agents.filter((a) => ['active-1', 'active-2'].includes(a.sessionId)) };
  const lines = renderTable(classifyAgents(live)).split('\n');
  expect(lines).toHaveLength(4);
  expect(lines.join('\n')).not.toMatch(/Finished, not yet reaped|Dead records/);
});
