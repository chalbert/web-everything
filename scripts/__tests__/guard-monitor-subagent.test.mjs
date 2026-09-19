/** Pure decisions and the real stdin/JSON boundary of PreToolUse(Monitor). */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decide } from '../guard-monitor-subagent.mjs';

const event = { hook_event_name: 'PreToolUse', tool_name: 'Monitor', agent_id: 'agent-1', tool_input: {} };

describe('guard-monitor-subagent — pure decision', () => {
  it('asks instead of denying a subagent Monitor call, with foreground guidance', () => {
    const output = decide(event).hookSpecificOutput;
    expect(output.hookEventName).toBe('PreToolUse');
    expect(output.permissionDecision).toBe('ask');
    expect(output.permissionDecisionReason).toMatch(/will not reliably deliver a wake-up notification/);
    expect(output.permissionDecisionReason).toMatch(/root CLAUDE\.md/);
    expect(output.permissionDecisionReason).toMatch(/block or poll in the foreground within this turn/);
  });
  it.each([undefined, null, '', false, 1, {}])('allows absent or invalid subagent identity: %j', (agent_id) => {
    expect(decide({ ...event, agent_id })).toBeNull();
  });
  it.each(['Stop', 'SubagentStop', 'PostToolUse', undefined])('ignores other events: %s', (hook_event_name) => {
    expect(decide({ ...event, hook_event_name })).toBeNull();
  });
  it.each(['Bash', 'Agent', 'Task', undefined])('ignores other tools: %s', (tool_name) => {
    expect(decide({ ...event, tool_name })).toBeNull();
  });
  it.each([undefined, null, {}, [], 'bad'])('fails open on an invalid envelope: %j', (input) => {
    expect(decide(input)).toBeNull();
  });
});

describe('guard-monitor-subagent — CLI and hook wiring', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const guard = join(here, '..', 'guard-monitor-subagent.mjs');
  const run = (input) => spawnSync(process.execPath, [guard], { input, encoding: 'utf8' });
  it('emits one ask decision with exit 0 for a subagent Monitor', () => {
    const output = run(JSON.stringify(event));
    expect(output.status).toBe(0);
    expect(output.stderr).toBe('');
    expect(JSON.parse(output.stdout)).toEqual(decide(event));
  });
  it.each([
    { hook_event_name: 'PreToolUse', tool_name: 'Monitor' },
    { ...event, hook_event_name: 'SubagentStop' },
    { ...event, tool_name: 'Bash' },
    null,
  ])('silently allows main-session Monitor and irrelevant envelopes: %j', (input) => {
    const output = run(JSON.stringify(input));
    expect(output.status).toBe(0);
    expect(output.stdout).toBe('');
    expect(output.stderr).toBe('');
  });
  it.each(['', '{broken'])('fails open on malformed stdin: %j', (input) => {
    const output = run(input);
    expect(output.status).toBe(0);
    expect(output.stdout).toBe('');
    expect(output.stderr).toBe('');
  });
  it('wires the Monitor matcher alongside the existing Bash guard', () => {
    const settings = JSON.parse(readFileSync(join(here, '../../.claude/settings.json'), 'utf8'));
    for (const [matcher, script] of [['Monitor', 'guard-monitor-subagent'], ['Bash', 'guard-bash']]) {
      expect(settings.hooks.PreToolUse.find((entry) => entry.matcher === matcher).hooks).toContainEqual({
        type: 'command', command: `node scripts/${script}.mjs`,
      });
    }
  });
});
