import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateRoutingPolicy, resolveOperationRoute } from '../dispatch-routing-policy.mjs';
import { readRoutingPolicy, createRoutingPolicyReader } from '../dispatch-routing-policy-io.mjs';
import { decideDispatchRoute } from '../dispatch-contracts.mjs';
import { routeDispatchProvider } from '../../operations/dispatch-lane-io.mjs';

const copy = () => structuredClone(readRoutingPolicy());
describe('operation routing policy', () => {
  it('resolves aliases, ordered availability fallback, and inherited routes', () => {
    expect(resolveOperationRoute({ operation: 'prepare-item' })).toMatchObject({ provider: 'codex', model: 'gpt-6-astra', fallback: [{ provider: 'claude', model: 'claude-sonnet-5-5' }] });
    expect(resolveOperationRoute({ operation: 'prepare-item', available: ['claude'] })).toMatchObject({ provider: 'claude', model: 'claude-sonnet-5-5', fallback: [] });
    expect(resolveOperationRoute({ operation: 'build' })).toBeNull();
    expect(() => resolveOperationRoute({ operation: 'prepare-item', available: [] })).toThrow(/no available route/);
  });
  it.each([
    [p => { p.operations.build = { provider: 'typo', model: 'default', fallback: [] }; }, /unknown provider/],
    [p => { p.operations['prepare-item'].model = 'unknown'; }, /unknown model\/alias/],
    [p => { p.aliases.codex.default = 'not-a-model'; }, /aliases.codex.default.*unknown model/],
    [p => { p.operations['prepare-item'].fallback = {}; }, /fallback must be an array/],
    [p => { p.operations['prepare-item'].fallback = [{ provider: 'codex', model: 'sonnet' }]; }, /fallback\[0\].*unknown model/],
    [p => { p.operations.build.extra = true; }, /extra is unknown/],
    [p => { p.criticalWorkGate.kinds = 'build'; }, /kinds must contain/],
    [p => { p.criticalWorkGate.openForNonCritical.bugfix = 'yes'; }, /must contain booleans/],
  ])('rejects malformed edits with an actionable error', (edit, error) => {
    const policy = copy(); edit(policy); expect(() => validateRoutingPolicy(policy)).toThrow(error);
  });
  it('hot reloads valid edits and keeps last good through malformed, invalid, and missing files', () => {
    const dir = mkdtempSync(join(tmpdir(), 'routing-policy-'));
    const path = join(dir, 'policy.json'); const log = vi.fn();
    const read = createRoutingPolicyReader({ path, log });
    try {
      const next = copy(); next.operations['prepare-item'].model = 'gpt-6-sol';
      writeFileSync(path, JSON.stringify(next));
      expect(read().operations['prepare-item'].model).toBe('gpt-6-sol');
      for (const bad of ['{', JSON.stringify({ ...next, version: 99 })]) {
        writeFileSync(path, bad); expect(read().operations['prepare-item'].model).toBe('gpt-6-sol');
        const count = log.mock.calls.length; read(); expect(log).toHaveBeenCalledTimes(count);
      }
      rmSync(path); expect(read().operations['prepare-item'].model).toBe('gpt-6-sol');
      next.operations['prepare-item'].model = 'default'; writeFileSync(path, JSON.stringify(next));
      expect(read().operations['prepare-item'].model).toBe('default');
      expect(log.mock.calls.every(([message]) => message.includes('keeping last good policy'))).toBe(true);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  it('supports task types and per-seat operation keys without changing code', () => {
    const policy = copy(); policy.taskTypes.bugfix = { provider: 'codex', model: 'gpt-6-sol', fallback: [] };
    policy.operations['review-seat:security'] = { provider: 'agy-claude', model: 'opus', fallback: [] };
    expect(resolveOperationRoute({ operation: 'fix', taskType: 'bugfix', policy })).toMatchObject({ provider: 'codex', model: 'gpt-6-sol' });
    expect(resolveOperationRoute({ operation: 'review-seat', taskType: 'security', policy })).toMatchObject({ provider: 'agy-claude', model: 'claude-opus-4-6-thinking' });
  });
  it('keeps the critical gate ahead of an explicit provider override, and reads its kinds from policy', () => {
    const policy = copy(); policy.operations.build = { provider: 'codex', model: 'default', fallback: [{ provider: 'claude', model: 'opus' }] };
    const dispatch = { kind: 'build', scopePaths: ['we:scripts/lib/critical-work.mjs'], size: 1, risk: 'high' };
    expect(decideDispatchRoute(dispatch, { routingPolicy: policy }).policyRoute).toMatchObject({ provider: 'claude', model: 'claude-opus-5' });
    policy.criticalWorkGate.kinds = [];
    expect(decideDispatchRoute(dispatch, { routingPolicy: policy }).policyRoute).toMatchObject({ provider: 'codex', model: 'gpt-6-astra' });
  });
  it('prepare policy reaches the actual launcher and reports the selected fallback model', () => {
    const routing = decideDispatchRoute({ kind: 'prepare-item' });
    const request = { launchKind: 'prepare-item', policyRoute: routing.policyRoute, probationWorker: routing.probationWorker, reportModel: vi.fn() };
    const probation = vi.fn(() => 'pid:123'); const agent = vi.fn(() => 'claude-session');
    expect(routeDispatchProvider(request, { probationLaunch: 'on', scriptExists: () => true, probation, agent })).toBe('pid:123');
    expect(probation.mock.calls[0][0].probationWorker.model).toBe('gpt-6-astra');
    expect(request.reportModel).toHaveBeenLastCalledWith('gpt-6-astra');
    expect(routeDispatchProvider(request, { probationLaunch: 'off', probation, agent })).toBe('claude-session');
    expect(agent.mock.calls[0][0].table.model).toBe('claude-sonnet-5-5');
    expect(request.reportModel).toHaveBeenLastCalledWith('claude-sonnet-5-5');
    probation.mockImplementation(() => { throw new Error('indeterminate launch'); });
    expect(() => routeDispatchProvider(request, { probationLaunch: 'on', scriptExists: () => true, probation, agent })).toThrow('indeterminate launch');
    expect(agent).toHaveBeenCalledTimes(1);
  });
});


it('a child uses the inherited last-good snapshot even while the policy file is syntactically broken', () => {
  const dir = mkdtempSync(join(tmpdir(), 'routing-policy-child-'));
  try {
    for (const file of ['dispatch-routing-policy-source.mjs', 'dispatch-routing-policy.mjs']) copyFileSync(`scripts/lib/${file}`, join(dir, file));
    writeFileSync(join(dir, 'dispatch-routing-policy.json'), '{broken edit');
    const moduleUrl = pathToFileURL(join(dir, 'dispatch-routing-policy.mjs')).href;
    const result = execFileSync(process.execPath, ['--input-type=module', '-e', `import { resolveOperationRoute } from ${JSON.stringify(moduleUrl)}; console.log(JSON.stringify(resolveOperationRoute({operation:'prepare-item'})));`], {
      encoding: 'utf8', env: { ...process.env, WE_DISPATCH_ROUTING_SNAPSHOT: JSON.stringify(readRoutingPolicy()) },
    });
    expect(JSON.parse(result)).toMatchObject({ provider: 'codex', model: 'gpt-6-astra' });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

it('adding prepare-item to gated kinds applies the same fail-closed check to its explicit policy', () => {
  const policy = copy(); policy.criticalWorkGate.kinds.push('prepare-item');
  expect(decideDispatchRoute({ kind: 'prepare-item', risk: 'high' }, { routingPolicy: policy }).policyRoute).toMatchObject({ provider: 'claude' });
});

it('a critical-miss veto removes the exact model from the whole fallback chain', () => {
  const policy = copy(); policy.operations.fix = { provider: 'codex', model: 'default', fallback: [{ provider: 'claude', model: 'sonnet' }] };
  expect(resolveOperationRoute({ operation: 'fix', policy, vetoes: [{ provider: 'codex', model: 'gpt-6-astra' }] })).toMatchObject({ provider: 'claude' });
});


it('treats an edit to the routing policy itself as critical work', () => {
  const policy = copy(); policy.operations.build = { provider: 'codex', model: 'default', fallback: [{ provider: 'claude', model: 'opus' }] };
  const route = decideDispatchRoute({ kind: 'build', scopePaths: ['we:scripts/lib/dispatch-routing-policy.json'], risk: 'low', size: 1 }, { routingPolicy: policy });
  expect(route.policyRoute).toMatchObject({ provider: 'claude', model: 'claude-opus-5' });
});


it('a closed gate removes external providers from all later fallback entries too', () => {
  const policy = copy(); policy.operations.build = { provider: 'codex', model: 'default', fallback: [{ provider: 'claude', model: 'sonnet' }, { provider: 'codex', model: 'sol' }] };
  expect(resolveOperationRoute({ operation: 'build', policy, gateClosed: true })).toMatchObject({ provider: 'claude', fallback: [] });
});
