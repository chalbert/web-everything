/** Mechanical facts: no judgment filters, no inferred default for Gemini. */
import { it, expect } from 'vitest';
import { classifyAgents, renderTable, extractDelegations, lastAssistantModel, pickSupervisor, pickExecutor, wipAgentsOperation } from '../wip-agents.mjs';
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
it('keeps odd rows, excludes only done, sorts and escapes cells', () => {
  const rows = classifyAgents({ agents: [{ id: 'b', startedAt: 1, kind: 'interactive', status: 'waiting', waitingFor: 'dialog open', name: 'odd|\nname' }, { id: 'a', startedAt: 1 }, { id: 'c', startedAt: 2 }, { state: 'done' }], now: 11520001 });
  expect(rows.map((r) => r.id)).toEqual(['a', 'b', 'c']);
  const table = renderTable(rows);
  expect(table).toContain('waiting · 3h 12m · ⚠ waiting on: dialog open');
  expect(table).toContain('odd\\| name');
  expect(table.split('\n')).toHaveLength(5);
  expect(renderTable([])).toContain('No live agents.');
  expect(renderTable(classifyAgents({ agents: [{ sessionId: 'x' }], now: 0, facts: { x: { transcriptScan: { status: 'none' } } } }))).toContain('| none |');
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
  const agents = [{ kind: 'interactive', sessionId: 'abcdef12-0000-4000-8000-000000000000', name: 'x', status: 'idle', startedAt: 0 }];
  const rows = classifyAgents({ agents, now: 26 * 3600000 });
  expect(rows[0].id).toBe('abcdef12');
  expect(renderTable(rows)).toContain('idle · 1d 2h');
});
