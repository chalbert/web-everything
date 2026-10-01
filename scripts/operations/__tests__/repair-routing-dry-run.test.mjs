import { describe, it, expect, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dispatchFix } from '../../conveyor/reconcile-fix-dispatch.mjs';
import { readFixDispatchClaim, refreshLiveFixDispatchClaims } from '../../conveyor/fix-dispatch-claim.mjs';
import { codexBriefDetachedProvider } from '../dispatch-providers/codex-brief.mjs';
import { routeDispatchProvider } from '../dispatch-lane-io.mjs';
import { resolveDispatchRoute } from '../../lib/dispatch-routing-policy-io.mjs';
import { buildCodexDirectTaskArgv } from '../../codex-direct-task.mjs';
import { runCodexBrief } from '../codex-brief-run.mjs';

const planned = { pr: 900001, itemNum: '3209', lane: 4, laneRef: 'lane/3209-fix', scope: ['we:scripts/example.mjs'], risk: 'low', size: 2, operatorAnswer: { actor: 'operator', channel: 'test', reason: 'Preserve the existing behavior.' } };
const brief = 'Fix {{PR_NUM}} {{ITEM_NUM}} {{LANE}} {{LANE_REF}} {{SESSION_SLUG}} {{SCOPE}}. Follow fix-begin and fix-end.';
describe('repair dispatch dry run (no paid session)', () => {
  it('dispatches a non-critical review fix to Codex and stamps its real claim and argv', () => {
    const dir = mkdtempSync(join(tmpdir(), 'repair-route-')); const calls = [];
    try {
      const result = dispatchFix(planned, { root: '/dispatcher', readBrief: () => brief,
        claimRoot: join(dir, 'claims'), claimOwner: 'dry-run', readFixClaim: () => null,
        sessionCwdFor: () => dir, ensureSessionCwd: p => p, resolveSettingsEnv: () => null,
        providerAvailable: () => true, routeFix: p => resolveDispatchRoute({ kind: 'fix', scopePaths: p.scope, size: p.size, risk: p.risk }, { scorecards: [] }),
        spawnAgent: () => { throw new Error('must not start Claude'); },
        spawnCodex: request => codexBriefDetachedProvider(request, { spawnDetached: (argv, options) => { calls.push({ argv, options }); return { pid: 98765 }; } }),
      });
      expect(result).toMatchObject({ provider: 'codex', model: 'gpt-6-astra', effort: 'high', agentId: 'pid:98765' });
      expect(calls[0].argv).toEqual(expect.arrayContaining(['--model=gpt-6-astra', '--effort=high']));
      const request = JSON.parse(readFileSync(join(dir, 'codex-brief.json'), 'utf8'));
      expect(request.prompt).toContain('Preserve the existing behavior.');
      expect(request.prompt).toContain('fix-begin and fix-end');
      const claim = readFixDispatchClaim({ repo: 'we', pr: planned.pr, kind: 'fix', lockRoot: join(dir, 'claims') });
      expect(claim.meta).toMatchObject({ provider: 'codex', model: 'gpt-6-astra', effort: 'high', handle: 'pid:98765' });
      expect(refreshLiveFixDispatchClaims({ lockRoot: join(dir, 'claims'), listAgentsAll: () => { throw new Error('native CLI unavailable'); }, isPidAlive: pid => pid === 98765 }).refreshed).toHaveLength(1);
      console.log('DRY RUN: non-critical review fix -> codex / gpt-6-astra / high / pid:98765; claim and filled brief verified');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  it.each(['fix', 'ci-heal'])('uses Codex for non-critical %s, Claude for critical scope or unavailable Codex', kind => {
    const codex = vi.fn(() => 'pid:123'); const native = vi.fn(() => 'native');
    const request = scope => ({ launchKind: kind, prompt: 'fix', lane: 4, pr: 900001,
      policyRoute: resolveDispatchRoute({ kind, scopePaths: scope, size: 2, risk: 'low' }, { scorecards: [] }).policyRoute });
    expect(routeDispatchProvider(request(planned.scope), { codexBrief: codex, agent: native })).toBe('pid:123');
    expect(codex.mock.calls[0][0].policyRoute).toMatchObject({ effort: 'high', model: 'gpt-6-astra' });
    expect(routeDispatchProvider(request(['we:scripts/lib/critical-work.mjs']), { codexBrief: codex, agent: native })).toBe('native');
    expect(routeDispatchProvider(request(planned.scope), { providerAvailable: p => p === 'claude', codexBrief: codex, agent: native })).toBe('native');
    expect(native.mock.calls.at(-1)[0].table).toMatchObject({ effort: 'high', model: 'claude-sonnet-5-5' });
  });
  it('runs the same fix protocol in the assigned lane with explicit Codex effort', async () => {
    const run = vi.fn(async options => ({ code: 0, argv: buildCodexDirectTaskArgv({ cwd: options.dir, model: options.model, effort: options.effort }) }));
    const exec = vi.fn(() => '/tmp/isolated-lane'); const write = vi.fn();
    await runCodexBrief({ ...planned, repo: 'we', cwd: '/tmp/session', launchKind: 'fix', sessionSlug: 'fix-900001', prompt: brief, policyRoute: { model: 'gpt-6-astra', effort: 'high' } }, { exec, run, write, ensureDir: vi.fn() });
    expect(exec.mock.calls[0][1]).toEqual(expect.arrayContaining(['--lane=4', '--base=lane/3209-fix']));
    expect(run.mock.calls[0][0]).toMatchObject({ dir: '/tmp/isolated-lane', effort: 'high' });
    expect(run.mock.calls[0][0].task).toContain(brief);
    expect(JSON.parse(write.mock.calls.at(-1)[1])).toMatchObject({ model: 'gpt-6-astra', effort: 'high', state: 'finished', result: { argv: expect.arrayContaining(['model_reasoning_effort=high']) } });
  });
});

it('passes resolved effort to the actual Codex, Gemini and native Claude argv builders', async () => {
  const { resolveOperationRoute } = await import('../../lib/dispatch-routing-policy.mjs');
  const { buildWorkerArgv } = await import('../../lib/probation-launcher.mjs');
  const { buildAgyDirectTaskArgv } = await import('../../gemini-direct-task.mjs');
  const { buildAgentArgv } = await import('../dispatch-lane-io.mjs');
  const codex = resolveOperationRoute({ operation: 'fix' });
  expect(buildCodexDirectTaskArgv({ cwd: '/tmp/lane', ...codex })).toEqual(expect.arrayContaining(['-m', 'gpt-6-astra', 'model_reasoning_effort=high']));
  const gemini = resolveOperationRoute({ operation: 'build', taskType: 'test-fix' });
  expect(buildWorkerArgv({ worker: { ...gemini, launcher: 'scripts/gemini-direct-task.mjs' }, weRoot: '/we', dir: '/lane', taskFile: '/task' })).toContain('--effort=low');
  expect(buildAgyDirectTaskArgv(gemini)).toEqual(expect.arrayContaining(['--model', 'gemini-3.8-flash', '--effort', 'low']));
  const native = resolveOperationRoute({ operation: 'fix', gateClosed: true });
  expect(buildAgentArgv({ payload: { prompt: 'repair', launchKind: 'fix' }, table: native })).toEqual(expect.arrayContaining(['--model', 'sonnet', '--effort', 'high']));
  expect(() => buildAgentArgv({ payload: { prompt: 'repair' }, extraArgs: ['--effort=typo'] })).toThrow(/unknown effort/);
});
