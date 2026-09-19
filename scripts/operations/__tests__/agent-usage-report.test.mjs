import { mkdtempSync, mkdirSync, writeFileSync, appendFileSync, readFileSync, realpathSync, rmSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { CODEX_MODEL } from '../../codex-direct-task.mjs';
import { buildAgyDirectTaskArgv } from '../../gemini-direct-task.mjs';
import { extractAgentUsage, delegationsFromCommand, scanAndAppend, scanSession, readAgentUsageLog, listAgentUsageDays, appendAgentUsageLogLine, reportAgentUsage, resolveAgentUsageDir, formatAgentUsageReport } from '../agent-usage-report.mjs';

let temp, projects, store, parent, childDir;
const timestamp = '2026-09-18T23:59:00.000Z';
const assistant = (content, model = 'claude-sonnet-5', ts = timestamp) => ({ type: 'assistant', timestamp: ts, message: { role: 'assistant', model, content } });
const bash = (command) => ({ type: 'tool_use', id: 'bash-1', name: 'Bash', input: { command } });
const text = (value) => ({ type: 'text', text: value });
const dispatch = (id, description = `Task ${id}`) => ({ type: 'tool_use', id, name: 'Agent', input: { description, prompt: 'Long prompt' } });
const result = (id, agentId) => ({ type: 'user', toolUseResult: { agentId }, message: { content: [{ type: 'tool_result', tool_use_id: id, content: `agentId: ${agentId}` }] } });
const jsonl = (file, entries) => writeFileSync(file, entries.map((e) => JSON.stringify(e)).join('\n') + '\n');
const child = (id, entries, meta) => {
  const file = join(childDir, `agent-${id}.jsonl`);
  jsonl(file, entries);
  if (meta) writeFileSync(file.replace('.jsonl', '.meta.json'), JSON.stringify(meta));
  return file;
};
const cli = (args, extraEnv = {}) => execFileSync(process.execPath, [resolve('scripts/operations/agent-usage-report.mjs'), ...args], {
  cwd: temp, encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECTS_DIR: projects, OPERATION_AGENT_USAGE_DIR: store, ...extraEnv },
});
beforeEach(() => {
  temp = mkdtempSync(join(tmpdir(), 'we-agent-usage-'));
  projects = join(temp, 'projects'); store = join(temp, 'usage');
  parent = join(projects, '-fixture', 'session-1.jsonl');
  childDir = join(projects, '-fixture', 'session-1', 'subagents');
  mkdirSync(childDir, { recursive: true });
  vi.stubEnv('OPERATION_AGENT_USAGE_DIR', store);
});
afterEach(() => { vi.unstubAllEnvs(); rmSync(temp, { recursive: true, force: true }); });

describe('full child transcript extraction', () => {
  it('uses the exact sidecar task, real assistant model, timestamp and traceability for pure Claude', async () => {
    const file = child('pure', [assistant([text('Completed without a PR.')])], { description: '  Exact task  ' });
    expect(await extractAgentUsage(file, { dispatch: dispatch('d') })).toMatchObject({
      task: '  Exact task  ', modelTier: 'claude-sonnet-5', delegatedProvider: 'none', delegatedModel: null,
      outcome: null, timestamp, timestampSource: 'transcript', agentId: 'pure', sessionId: 'session-1', transcript: realpathSync(file),
    });
  });
  it.each([
    ['cd /tmp && node scripts/codex-direct-task.mjs --model=custom-codex --task="fix"', 'codex', 'custom-codex'],
    ['node scripts/gemini-direct-task.mjs -m gemini-custom', 'gemini', 'gemini-custom'],
    ['node scripts/gemini-direct-task.mjs -m="gemini-other"', 'gemini', 'gemini-other'],
    ['node scripts/codex-direct-task.mjs', 'codex', CODEX_MODEL],
  ])('detects script execution: %s', async (command, provider, model) => {
    const record = await extractAgentUsage(child('delegate', [assistant([bash(command)])]));
    expect(record.delegatedProvider).toBe(provider);
    expect(record.delegatedModel).toEqual({ command, model });
  });
  it('does not invent a Gemini default when the real wrapper defers it to agy', async () => {
    expect(buildAgyDirectTaskArgv()).not.toContain('--model');
    const record = await extractAgentUsage(child('gemini', [assistant([bash('node scripts/gemini-direct-task.mjs')])]));
    expect(record.delegations[0]).toMatchObject({ provider: 'gemini', model: null, modelSource: 'unspecified' });
  });
  it('preserves every delegation occurrence, both providers and model changes, including the beginning of a long transcript', async () => {
    const file = child('long', [assistant([bash('node scripts/codex-direct-task.mjs -m first; node scripts/codex-direct-task.mjs -m second')])]);
    for (let i = 0; i < 150; i++) appendFileSync(file, JSON.stringify(assistant([text('x'.repeat(16000))])) + '\n');
    appendFileSync(file, JSON.stringify(assistant([bash('node scripts/gemini-direct-task.mjs --model=third')], 'claude-haiku-5')) + '\n');
    const record = await extractAgentUsage(file);
    expect(record.modelTier).toEqual(['claude-sonnet-5', 'claude-haiku-5']);
    expect(record.delegatedProvider).toEqual(['codex', 'gemini']);
    expect(record.delegations.map((d) => d.model)).toEqual(['first', 'second', 'third']);
  });
  it('ignores mentions, tool results masquerading as tool uses and non-assistant models', async () => {
    const record = await extractAgentUsage(child('mentions', [
      { type: 'user', message: { model: 'fake', content: [bash('node scripts/codex-direct-task.mjs')] } },
      assistant([text('Run node scripts/codex-direct-task.mjs'), bash('grep codex-direct-task.mjs scripts/*'), bash('ls scripts/gemini-direct-task.mjs')]),
    ]));
    expect(record.delegatedProvider).toBe('none');
    expect(record.modelTier).toBe('claude-sonnet-5');
  });
  it('falls back to mtime only when the FIRST line lacks a timestamp; counts corrupt rows', async () => {
    const file = child('mtime', [{ type: 'user' }, assistant([])]);
    appendFileSync(file, '{broken\nnull\n');
    utimesSync(file, new Date(timestamp), new Date(timestamp));
    expect(await extractAgentUsage(file)).toMatchObject({ timestamp, timestampSource: 'mtime', corruptTranscriptLines: 2 });
  });
  it('records evidenced PR creation and terminal status without turning discussion into an outcome', async () => {
    const file = child('pr', [assistant([text('Review PR #100. PR #101 is not merged.')]),
      { type: 'user', message: { content: [{ type: 'tool_result', content: [{ type: 'text', text: 'https://github.com/example/repo/pull/1234' }] }] } },
      assistant([text('Merged PR #1234')]),
    ]);
    expect((await extractAgentUsage(file)).outcome.pullRequests).toEqual([{ pr: 1234, status: 'merged', evidence: 'Merged PR #1234' }]);
  });
  it('reads real pr-land JSON output without interpreting merged:false as a merge', async () => {
    const output = { repo: 'example/repo', merged: false, reason: 'enqueued', pr: 1234, ref: 'lane/example', detail: 'PR #1234 required checks green' };
    const file = child('land', [{ type: 'user', message: { content: [{ type: 'tool_result', content: JSON.stringify(output) }] } }]);
    expect((await extractAgentUsage(file)).outcome.pullRequests).toEqual([
      { pr: 1234, status: null, evidence: JSON.stringify({ pr: 1234, merged: false, reason: 'enqueued' }) },
    ]);
    const plain = child('plain-land', [{ type: 'user', message: { content: [{ type: 'tool_result', content: 'pr-land [example/repo] ✓ enqueued (drain lands it): PR #1235 required checks green; pr-land never merges' }] } }]);
    expect((await extractAgentUsage(plain)).outcome.pullRequests[0]).toMatchObject({ pr: 1235, status: null });
  });
});

describe('shell invocation classification', () => {
  it.each([
    '# node scripts/codex-direct-task.mjs --model=fake',
    'echo "node scripts/codex-direct-task.mjs; node scripts/gemini-direct-task.mjs"',
    'grep -n "node scripts/codex-direct-task.mjs" file',
    'ps aux | grep codex-direct-task.mjs',
    'node --check scripts/codex-direct-task.mjs',
    'node -e "console.log(\"codex-direct-task.mjs\")"',
    "cat <<'EOF'\nnode scripts/codex-direct-task.mjs\nEOF\nls scripts/gemini-direct-task.mjs",
    'printf "%s" "--model=wrong" # node scripts/codex-direct-task.mjs',
  ])('does not classify non-executing text: %s', (command) => expect(delegationsFromCommand(command)).toEqual([]));
  it('handles quotes, line continuations, wrappers and separate command model scopes', () => {
    const commands = 'cd /tmp && MODE=test env node "scripts/codex-direct-task.mjs" \\\n --model="one"; node scripts/gemini-direct-task.mjs -m=two';
    expect(delegationsFromCommand(commands).map(({ provider, model }) => [provider, model])).toEqual([['codex', 'one'], ['gemini', 'two']]);
    expect(delegationsFromCommand("bash -lc 'node scripts/codex-direct-task.mjs -m nested'")[0].model).toBe('nested');
  });
});

describe('session scan and durable store', () => {
  it('handles meta-free old transcripts, missing children, metadata-only linking, prompt fallback and day rotation idempotently', async () => {
    child('old', [assistant([])]);
    child('meta', [assistant([], 'claude-haiku-5', '2026-09-19T00:01:00.000Z')], { toolUseId: 'd2', description: 'Sidecar description' });
    child('prompt', [assistant([])]);
    jsonl(parent, [assistant([dispatch('d1'), dispatch('d2'), dispatch('d3'), dispatch('d4'), { ...dispatch('d5'), input: { prompt: 'Prompt-only task' } }]), result('d1', 'old'), result('d3', 'missing'), result('d5', 'prompt')]);
    const first = await scanAndAppend({ transcript: parent });
    expect(first).toMatchObject({ dispatches: 5, appended: 3, alreadyPresent: 0 });
    expect(first.skipped).toHaveLength(2);
    expect(first.skipped.map((s) => s.reason).join(' ')).toMatch(/No child id/);
    const second = await scanAndAppend({ transcript: parent });
    expect(second).toMatchObject({ appended: 0, alreadyPresent: 3 });
    expect(listAgentUsageDays()).toEqual(['2026-09-18', '2026-09-19']);
    expect(readAgentUsageLog('2026-09-18').lines.map((r) => r.task)).toEqual(['Task d1', 'Prompt-only task']);
    expect(readAgentUsageLog('2026-09-19').lines[0].task).toBe('Sidecar description');
    expect(resolveAgentUsageDir()).toBe(store);
  });
  it('links textual results without sidecars or structured metadata, deduping replayed tool_use blocks', async () => {
    child('text-id', [assistant([])]);
    const entry = result('d1', 'text-id'); delete entry.toolUseResult;
    jsonl(parent, [assistant([dispatch('d1')]), assistant([dispatch('d1')]), entry]);
    expect(await scanSession({ transcript: parent })).toMatchObject({ dispatches: 1, skipped: [], records: [{ agentId: 'text-id' }] });
  });
  it('resolves decorated ids via the shared helper and session env via CLI using a synthetic projects override', async () => {
    child('old', [assistant([])]); jsonl(parent, [assistant([dispatch('d1')]), result('d1', 'old')]);
    expect(JSON.parse(cli(['--json'], { CLAUDE_CODE_SESSION_ID: 'session-1' }))).toMatchObject({ appended: 1, skipped: [] });
    expect(JSON.parse(cli(['--session=session-1', '--json']))).toMatchObject({ alreadyPresent: 1 });
    const module = resolve('scripts/operations/agent-usage-report.mjs');
    const output = execFileSync(process.execPath, ['--input-type=module', '-e', `import {extractAgentUsage} from ${JSON.stringify(module)}; console.log(JSON.stringify(await extractAgentUsage('agent-old.jsonl')));`], {
      encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECTS_DIR: projects },
    });
    expect(JSON.parse(output).agentId).toBe('old');
  });
  it('isolates a torn final store row and rejects malformed records on write', async () => {
    mkdirSync(store); writeFileSync(join(store, '2026-09-18.jsonl'), '{torn');
    const record = await extractAgentUsage(child('safe', [assistant([])]));
    expect(appendAgentUsageLogLine(record)).toEqual({ appended: true, corrupt: 1 });
    expect(readAgentUsageLog('2026-09-18')).toMatchObject({ lines: [{ agentId: 'safe' }], corrupt: 1 });
    expect(() => appendAgentUsageLogLine({ agentId: 'bad' })).toThrow(/Invalid/);
  });
});

describe('report CLI', () => {
  it('prints exact totals by tier, provider and day, with tolerant corruption and date filters', async () => {
    const records = [
      await extractAgentUsage(child('a', [assistant([bash('node scripts/codex-direct-task.mjs')])])),
      await extractAgentUsage(child('b', [assistant([], 'claude-haiku-5')])),
      await extractAgentUsage(child('c', [assistant([bash('node scripts/gemini-direct-task.mjs')], 'claude-haiku-5', '2026-09-19T00:01:00Z')])),
    ];
    records.forEach((r) => appendAgentUsageLogLine(r));
    appendFileSync(join(store, '2026-09-18.jsonl'), '{broken\n{}\nnull\n\n');
    const expected = { total: 3, byModelTier: { 'claude-sonnet-5': 1, 'claude-haiku-5': 2 }, byDelegatedProvider: { codex: 1, gemini: 1, none: 1 }, byDay: { '2026-09-18': 2, '2026-09-19': 1 }, corrupt: 3 };
    expect(JSON.parse(cli(['--report', '--json']))).toEqual(expected);
    expect(cli(['--report'])).toBe(formatAgentUsageReport(expected) + '\n');
    expect(JSON.parse(cli(['--report', '--since=2026-09-19', '--json']))).toMatchObject({ total: 1, corrupt: 0, byDay: { '2026-09-19': 1 } });
    expect(reportAgentUsage({ days: 1, now: new Date('2026-09-19T10:00:00Z') }).total).toBe(1);
    expect(() => reportAgentUsage({ days: 0 })).toThrow(/positive integer/);
    expect(() => reportAgentUsage({ since: '2026-02-30' })).toThrow(/YYYY-MM-DD/);
    expect(readFileSync(join(store, '2026-09-18.jsonl'), 'utf8').split('\n').filter(Boolean)).toHaveLength(5);
  });
  it('counts each distinct observed model/provider once and represents absent models honestly', async () => {
    const record = await extractAgentUsage(child('mixed', [assistant([bash('node scripts/codex-direct-task.mjs; node scripts/gemini-direct-task.mjs')]), assistant([], 'claude-haiku-5')]));
    appendAgentUsageLogLine(record);
    appendAgentUsageLogLine({ ...record, agentId: 'unknown', modelTier: null, delegatedProvider: 'none' });
    expect(reportAgentUsage()).toMatchObject({ total: 2, byModelTier: { 'claude-sonnet-5': 1, 'claude-haiku-5': 1, unknown: 1 }, byDelegatedProvider: { codex: 1, gemini: 1, none: 1 } });
  });
});
