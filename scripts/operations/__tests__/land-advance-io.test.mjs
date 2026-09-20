import { describe, it, expect, vi, afterEach } from 'vitest';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLandAdvanceReader, createLandAdvanceApplier, readLiveSessions, readJsonlTail, readFollowUps, writeFollowUp, resultProvider } from '../land-advance-io.mjs';
import { planLandAdvance } from '../land-advance.mjs';
import { createMemoryRunStore } from '../run-store.mjs';
import { buildEscalationPacket, writeEscalationPacket, listUnresolvedEscalations, renderEscalationsSection } from '../land-advance-escalations.mjs';
import { allowedToolsArg, ALLOWED_TOOLS_BY_KIND } from '../land-advance-tools.mjs';
const now = Date.parse('2026-09-20T00:00:00Z');
const dirs = [];
const temp = () => { const p = fs.mkdtempSync(join(tmpdir(), 'land-advance-')); dirs.push(p); return p; };
afterEach(() => { dirs.splice(0).forEach((p) => fs.rmSync(p, { recursive: true, force: true })); });
const prs = [1,2,3].map((number) => ({ number, repo: 'we', slug: 'chalbert/web-everything', labels: ['review:pending'], createdAt: '2026-09-08' }));
const emptyFs = { ...fs, readdirSync: () => [], readFileSync: (p) => { if (String(p).endsWith('swept-repos.json')) return '["chalbert/web-everything","chalbert/frontierui","chalbert/plateau-app"]'; throw Object.assign(new Error('missing'), { code: 'ENOENT' }); }, statSync: () => { throw Object.assign(new Error('missing'), { code: 'ENOENT' }); } };
const readerPorts = (overrides = {}) => ({ fs: emptyFs, now: () => now, readSessions: () => [], store: createMemoryRunStore(), machineLoad: () => 0,
  run: (cmd, args) => cmd === 'gh' ? '[]' : cmd === 'git' ? '321 180' : '/lanes/lane-1\n/lanes/lane-2', ...overrides });
describe('evidence IO', () => {
  it('records a failed repo without hiding other repos; uses full slugs', () => {
    const run = vi.fn((cmd, args) => {
      if (cmd !== 'gh') return cmd === 'git' ? '321 180' : '/lane-1';
      const slug = args[args.indexOf('--repo') + 1]; expect(slug).toMatch(/^chalbert\//);
      if (slug === 'chalbert/frontierui') throw new Error('network unavailable');
      return JSON.stringify([prs[0]]);
    });
    const inputs = createLandAdvanceReader(readerPorts({ run }))();
    expect(inputs.prs.map((p) => p.repo)).toEqual(['we', 'plateau-app']); expect(inputs.errors[0].source).toBe('prs:frontierui');
    expect(run.mock.calls.some(([cmd, args]) => cmd === 'git' && args[0] === 'fetch')).toBe(false);
    expect(inputs.prototype).toMatchObject({ ahead: 180, behind: 321, refreshed: false });
  });
  it('refresh failure is unknown, lane failure closes capacity', () => {
    const inputs = createLandAdvanceReader(readerPorts({ refreshPrototype: true, run: (cmd) => { if (cmd === 'gh') return '[]'; throw new Error('failed'); } }))();
    expect(inputs.prototype.status).toBe('unknown'); expect(inputs.freeLanes).toBe('unknown'); expect(inputs.errors).toHaveLength(2);
  });
  it('probes pid or full sessionId, never trusts working labels', () => {
    const agents = Array.from({ length: 44 }, (_, i) => ({ name: `review-${i}`, sessionId: `full-session-${i}`, state: i < 31 ? 'working' : 'blocked', kind: 'background' }));
    const sessions = readLiveSessions({ listAgents: () => agents, ps: () => '' });
    expect(sessions.every((s) => s.liveness === 'dead-record')).toBe(true);
    expect(readLiveSessions({ listAgents: () => [{ pid: 1, state: 'done' }, { sessionId: 'abc', waitingFor: 'permission' }], ps: () => 'claude abc', isPidAlive: () => true }).map((s) => s.liveness)).toEqual(['done','waiting']);
    expect(() => readLiveSessions({ listAgents: () => [{ sessionId: 'abc' }], ps: () => null })).toThrow('Unknown liveness');
  });
  it('bounds history by bytes and lines', () => {
    const file = join(temp(), 'history.jsonl'); fs.writeFileSync(file, Array.from({ length: 100 }, (_, i) => JSON.stringify({ i })).join('\n') + '\n');
    const tail = readJsonlTail(file, { maxBytes: 200, maxLines: 3 }); expect(tail.capped).toBe(true); expect(tail.entries).toEqual([{ i: 97 }, { i: 98 }, { i: 99 }]);
  });
  it.each(['Provider used: CODEX-direct-task', '## Authorship\nGemini wrote it', '**Provider used:** Codex'])('parses section %s', (text) => expect(resultProvider(text)).toMatch(/Codex|Gemini/));
  it('does not treat an incidental mention as authorship', () => expect(resultProvider('Maybe use codex tomorrow')).toBeNull());
  it('calls the existing fix planner and retains both refusal shapes', () => {
    const run = (cmd, args) => cmd === 'gh' ? (args.includes('chalbert/web-everything') ? JSON.stringify([
      { number: 2170, labels: ['review:changes'], headRefName: 'lane/stuck-session-op-docs' },
      { number: 2108, labels: ['review:changes'], headRefName: 'lane/3140-fix' },
    ]) : '[]') : cmd === 'git' ? '0 1' : '/lane-1';
    const inputs = createLandAdvanceReader(readerPorts({ run, findItemFn: () => null, loadItems: () => [], resolveFallbackScope: () => [] }))();
    expect(inputs.fixPlans['we#2170'].refusal.kind).toBe('no-item-num'); expect(inputs.fixPlans['we#2108'].refusal.kind).toBe('no-scope');
    const yes = createLandAdvanceReader(readerPorts({ run, findItemFn: () => ({ scope: ['we:scripts/'] }), loadItems: () => [] }))();
    expect(yes.fixPlans['we#2108'].planned.scope).toEqual(['we:scripts/']);
  });
  it('round-trips follow-ups through the real run schema', () => {
    const store = createMemoryRunStore(), entry = { session: 'session-123', kind: 'review', target: 'frontierui#49', launchedAt: new Date(now).toISOString(), deadline: new Date(now + 1000).toISOString(), expectedResultPath: '/jobs/review-49.result.md', permissionsGranted: ['Read'] };
    writeFollowUp(entry, { store }); expect(readFollowUps({ store })).toEqual([entry]);
    writeFollowUp({ ...entry, session: null }, { store }); expect(readFollowUps({ store })).toHaveLength(2);
  });
});
describe('apply uses injected effects only', () => {
  const plan = () => planLandAdvance({ now, prs, freeLanes: 3, escalations: [] });
  const ports = () => ({ now: () => now, readCapacity: vi.fn(() => ({ freeLanes: 3, sessions: [], load: 0 })), writeLedger: vi.fn(), writePacket: vi.fn(), reap: vi.fn(), dispatchReview: vi.fn(async ({ pr }) => ({ agentId: `s-${pr}`, sessionSlug: `review-${pr}` })) });
  it('awaits each dispatch, grants one argv atom, logs each launch, and stops on failure', async () => {
    const p = ports(); let active = 0;
    p.dispatchReview = vi.fn(async (args) => { expect(active++).toBe(0); expect(args.repo).toBe('chalbert/web-everything'); expect(args.extraArgs).toEqual([allowedToolsArg('review')]); await Promise.resolve(); active--; if (args.pr === 2) throw new Error('spawn failed'); return { agentId: 'a', sessionSlug: 'review-1' }; });
    const result = await createLandAdvanceApplier(p)(plan());
    expect(p.dispatchReview).toHaveBeenCalledTimes(2); expect(p.writeLedger).toHaveBeenCalledTimes(1); expect(result.errors[0].message).toBe('spawn failed');
    expect(p.writeLedger.mock.calls[0][0]).toMatchObject({ target: 'we#1', permissionsGranted: ALLOWED_TOOLS_BY_KIND.review });
  });
  it('rechecks capacity at each step', async () => {
    const p = ports(); p.readCapacity.mockReturnValueOnce({ freeLanes: 1 }).mockReturnValue({ freeLanes: 0 });
    const result = await createLandAdvanceApplier(p)(plan()); expect(result.dispatched).toHaveLength(1); expect(p.dispatchReview).toHaveBeenCalledTimes(1);
  });
  it('routes fix arguments and invokes reaper once for summary rows', async () => {
    const p = ports(); p.dispatchFix = vi.fn(() => ({ agentId: 'f', sessionSlug: 'fix-1' })); p.pickFixLane = () => 7;
    const data = planLandAdvance({ now, freeLanes: 1, prs: [{ ...prs[0], labels: ['review:changes'] }], fixPlans: { 'we#1': { planned: { pr: 1, itemNum: '3140', scope: ['we:scripts/'] } } }, sessions: [{ liveness: 'dead-record' }] });
    await createLandAdvanceApplier(p)(data); expect(p.reap).toHaveBeenCalledOnce(); expect(p.dispatchFix).toHaveBeenCalledWith(expect.objectContaining({ lane: 7 }), { extraArgs: [allowedToolsArg('fix')] });
  });
});
describe('tools and escalation packets', () => {
  it('closes tool kinds and disallows unbounded shell grants', () => {
    expect(Object.keys(ALLOWED_TOOLS_BY_KIND)).toEqual(['review','fix','build']);
    for (const [kind, tools] of Object.entries(ALLOWED_TOOLS_BY_KIND)) {
      expect(Object.isFrozen(tools)).toBe(true); expect(allowedToolsArg(kind)).toBe(`--allowedTools=${tools.join(',')}`);
      for (const tool of tools) { expect(tool).not.toMatch(/dangerously|git push --force/); expect(['Bash','Bash(*)']).not.toContain(tool); }
    }
    expect(() => allowedToolsArg('other')).toThrow();
  });
  it('updates deterministic packets and excludes resolved packets', () => {
    const dir = temp(), row = { packetId: 'stuck-in-drain-we-2072', kind: 'stuck-in-drain', subject: 'we#2072', evidence: ['waiting'], blockedBy: 'plateau-app#153' };
    const packet = buildEscalationPacket(row, now); writeEscalationPacket(packet, { dir }); writeEscalationPacket(packet, { dir });
    expect(fs.readdirSync(dir)).toHaveLength(1); expect(listUnresolvedEscalations({ dir })).toHaveLength(1); expect(renderEscalationsSection([packet])).toContain('plateau-app#153');
    const resolved = buildEscalationPacket(row, now + 1, { ...packet, status: 'resolved', resolvedAt: new Date(now).toISOString(), resolution: 'fixed' });
    writeEscalationPacket(resolved, { dir }); expect(listUnresolvedEscalations({ dir })).toEqual([]);
  });
});
it('reads follow-up identity and target progress without inventing closed PRs from absence', () => {
  const store = createMemoryRunStore();
  const entry = { session: 'live-id', kind: 'review', target: 'we#1', launchedAt: '2026-09-18T00:00:00Z', deadline: '2026-09-19T00:00:00Z', expectedResultPath: '/jobs/r.result.md', permissionsGranted: ['Read'] };
  writeFollowUp(entry, { store });
  const inputs = createLandAdvanceReader(readerPorts({ store, readSessions: () => [{ id: 'live-id', liveness: 'live-idle' }],
    run: (cmd, args) => cmd === 'gh' ? (args[1] === 'view' ? '{"state":"MERGED"}' : '[]') : cmd === 'git' ? '0 0' : '' }))();
  expect(inputs.followUps[0].evidence).toMatchObject({ liveness: 'live-idle', targetState: 'MERGED' });
});
it('writes escalation packets only through apply and never folds a PR', async () => {
  const writePacket = vi.fn(), dispatchReview = vi.fn(), dispatchFix = vi.fn();
  const plan = planLandAdvance({ now, freeLanes: 0, prs: [{ ...prs[0], labels: ['review:accepted'], baseRefName: 'lane/mechanical-dispatcher' }], followUps: [{ target: 'we#2', session: 's', evidence: {}, launchedAt: '2026-09-01' }] });
  await createLandAdvanceApplier({ writePacket, dispatchReview, dispatchFix, now: () => now })(plan);
  expect(writePacket).toHaveBeenCalledOnce(); expect(writePacket.mock.calls[0][0].kind).toBe('follow-up-ambiguous');
  expect(dispatchReview).not.toHaveBeenCalled(); expect(dispatchFix).not.toHaveBeenCalled();
});
it('completion evidence must belong to this launch, not an old same-name session', () => {
  const store = createMemoryRunStore(), path = '/completion/review-49.json';
  const entry = { session: 's', kind: 'review', target: 'we#49', launchedAt: '2026-09-18T00:00:00Z', deadline: '2026-09-21T00:00:00Z', expectedResultPath: path, permissionsGranted: ['Read'] };
  writeFollowUp(entry, { store });
  for (const [startedAt, expected] of [['2026-09-17', false], ['2026-09-19', true]]) {
    const io = { ...emptyFs, readFileSync: (p, ...args) => p === path ? JSON.stringify({ status: 'done', startedAt }) : emptyFs.readFileSync(p, ...args) };
    const data = createLandAdvanceReader(readerPorts({ fs: io, store, followUpEvidence: () => ({}) }))();
    expect(data.followUps[0].evidence.resultPresent).toBe(expected);
  }
});
