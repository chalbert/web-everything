import { describe, it, expect } from 'vitest';
import { resolveAgentActivity, extractMention, extractLaneHint, agentActivityOperation } from '../agent-activity.mjs';
import { createRegistry, isReadOnlyOperation } from '../registry.mjs';
import { createMemoryRunStore } from '../run-store.mjs';
import { runOperationCli } from '../cli-adapter.mjs';

describe('extractMention — the #NNN / #xNNNNNN grammar', () => {
  it('finds a numeric card mention', () => { expect(extractMention('please fix #3690 today')).toBe('3690'); });
  it('finds a hash-id mention, lowercased', () => { expect(extractMention('see #Xa59Gb9 for context')).toBe('xa59gb9'); });
  it('ignores a bare number with no #', () => { expect(extractMention('call 3690 now')).toBeNull(); });
  it('is null for no text', () => { expect(extractMention('')).toBeNull(); expect(extractMention(null)).toBeNull(); });
});

describe('extractLaneHint — a card token inside a lease purpose/session string, no leading #', () => {
  it('pulls the number out of a build-<N> purpose', () => { expect(extractLaneHint('build-3932')).toBe('3932'); });
  it('pulls the number out of a bare digit-suffixed session (today\'s real shape, e.g. `lane4167`)', () => {
    expect(extractLaneHint('lane4167')).toBe('4167');
  });
  it('pulls a card number out of a slugged purpose', () => { expect(extractLaneHint('4194-review-seats')).toBe('4194'); });
  it('pulls a hash id', () => { expect(extractLaneHint('build-xa59gb9')).toBe('xa59gb9'); });
  it('never splits a longer digit run', () => { expect(extractLaneHint('v20260926')).toBeNull(); });
  it('is null for no text', () => { expect(extractLaneHint('')).toBeNull(); expect(extractLaneHint(undefined)).toBeNull(); });
});

describe('resolveAgentActivity — the card ↔ run join, one fixture per resolver (backlog #3932)', () => {
  it('resolver 1 (name): an item-kind session names its card directly — conveyor', () => {
    const { runs, unmatched } = resolveAgentActivity([
      { id: 'a1', sessionId: 's1', name: 'conveyor-3436', kind: 'background', state: 'working' },
    ]);
    expect(unmatched).toEqual([]);
    expect(runs).toMatchObject([{ runId: 'a1', role: 'build', card: '3436', joinVia: 'name' }]);
  });

  it('resolver 1 (name): prepare', () => {
    const { runs } = resolveAgentActivity([{ id: 'a2', sessionId: 's2', name: 'prepare-3438', kind: 'background' }]);
    expect(runs).toMatchObject([{ card: '3438', joinVia: 'name', role: 'prepare' }]);
  });

  it('resolver 1 (name): prepare-decision', () => {
    const { runs } = resolveAgentActivity([{ id: 'a3', sessionId: 's3', name: 'prepare-decision-3402', kind: 'background' }]);
    expect(runs).toMatchObject([{ card: '3402', joinVia: 'name', role: 'prepare' }]);
  });

  it('resolver 1 (name): a repo-tagged review session (review-pa-P), PR→card via the supplied map', () => {
    const { runs } = resolveAgentActivity(
      [{ id: 'a4', sessionId: 's4', name: 'review-pa-123', kind: 'background' }],
      { prToCard: { 'plateau-app:123': '3931' } },
    );
    expect(runs).toMatchObject([{ card: '3931', pr: { repo: 'plateau-app', number: 123 }, joinVia: 'name', role: 'review' }]);
  });

  it('resolver 1 (name): fix-P, real record shape (a live PR→card join)', () => {
    const { runs } = resolveAgentActivity(
      [{ id: 'a5', sessionId: 's5', name: 'fix-2267', kind: 'background', state: 'working' }],
      { prToCard: { 'we:2267': '3690' } },
    );
    expect(runs).toMatchObject([{ card: '3690', pr: { repo: 'we', number: 2267 }, joinVia: 'name', role: 'fix' }]);
  });

  it('resolver 1 (name): ci-heal-P', () => {
    const { runs } = resolveAgentActivity(
      [{ id: 'a6', sessionId: 's6', name: 'ci-heal-2711', kind: 'background' }],
      { prToCard: { 'we:2711': '4200' } },
    );
    expect(runs).toMatchObject([{ card: '4200', joinVia: 'name', role: 'ci-heal' }]);
  });

  it('resolver 1 (name): a PR-kind session with NO card in the map still records `pr`, card null — a card or a PR', () => {
    const { runs, unmatched } = resolveAgentActivity([{ id: 'a7', sessionId: 's7', name: 'fix-9999', kind: 'background' }]);
    expect(unmatched).toEqual([]);
    expect(runs).toMatchObject([{ card: null, pr: { repo: 'we', number: 9999 }, joinVia: 'name' }]);
  });

  it('resolver 2 (codex-thread): a Codex delivery-thread record resolves through its own dispatch slug', () => {
    const { runs } = resolveAgentActivity(
      [{ id: 'codex-th_abc', sessionId: null, runtime: 'codex', kind: 'codex', codexSlug: 'conveyor-3445' }],
      { },
    );
    expect(runs).toMatchObject([{ runId: 'codex-th_abc', runtime: 'codex', card: '3445', joinVia: 'codex-thread', role: 'build' }]);
  });

  it('resolver 3 (parent): a plain subagent inherits its already-resolved parent\'s card', () => {
    const rows = [
      { id: 'parent', sessionId: 'sess-parent', name: 'conveyor-3436', kind: 'background' },
      { id: 'child', sessionId: null, kind: 'subagent', parentSessionId: 'sess-parent', workflowLane: false },
    ];
    const { runs, unmatched } = resolveAgentActivity(rows);
    expect(unmatched).toEqual([]);
    expect(runs).toMatchObject([
      { runId: 'parent', card: '3436', joinVia: 'name' },
      { runId: 'child', card: '3436', joinVia: 'parent', parentRunId: 'parent', role: 'subagent' },
    ]);
  });

  it('parentRunId is the parent\'s EMITTED runId, never its sessionId (referential integrity, PR #2715 review)', () => {
    const rows = [
      { id: 'child', sessionId: null, kind: 'subagent', parentSessionId: 'sess-p', workflowLane: false },
      { id: 'run-p', sessionId: 'sess-p', name: 'conveyor-3436', kind: 'background' },
      // An unresolvable parent still emits a runId (in `unmatched`); its weak-mention child must point at it.
      { id: 'run-q', sessionId: 'sess-q', name: 'unrelated-task', kind: 'background' },
      { id: 'child-q', sessionId: null, kind: 'subagent', parentSessionId: 'sess-q', workflowLane: false, firstMessageText: 'look at #3444' },
    ];
    const { runs, unmatched } = resolveAgentActivity(rows);
    const emitted = new Set([...runs, ...unmatched].map((r) => r.runId));
    for (const r of runs.filter((x) => x.parentRunId)) expect(emitted.has(r.parentRunId)).toBe(true);
    expect(runs.find((r) => r.runId === 'child').parentRunId).toBe('run-p');
    expect(runs.find((r) => r.runId === 'child-q').parentRunId).toBe('run-q');
  });

  it('resolver 3 (parent): inherits regardless of row order (parent listed after its child)', () => {
    const rows = [
      { id: 'child', sessionId: null, kind: 'subagent', parentSessionId: 'sess-parent', workflowLane: false },
      { id: 'parent', sessionId: 'sess-parent', name: 'prepare-3399', kind: 'background' },
    ];
    const { runs } = resolveAgentActivity(rows);
    expect(runs.find((r) => r.runId === 'child')).toMatchObject({ card: '3399', joinVia: 'parent' });
  });

  it('resolver 3 (parent): a workflow-lane child takes the first #NNN in its OWN first message, not its parent', () => {
    const rows = [
      { id: 'orchestrator', sessionId: 'sess-wf', name: 'test-mywork', kind: 'background' }, // not itself resolvable
      { id: 'lane-child', sessionId: null, kind: 'subagent', parentSessionId: 'sess-wf', workflowLane: true, firstMessageText: 'verify:#3436 please proceed' },
    ];
    const { runs, unmatched } = resolveAgentActivity(rows);
    expect(runs.find((r) => r.runId === 'lane-child')).toMatchObject({ card: '3436', joinVia: 'parent' });
    expect(unmatched.map((u) => u.runId)).toEqual(['orchestrator']);
  });

  it('resolver 4 (lane): a lane-lease session, keyed by ownerSession/workerSession — today\'s real shape (no branch field)', () => {
    const lease = { purpose: 'build-3932', session: 'build-3932', ownerSession: 'op-1', workerSession: 'op-1' };
    const { runs } = resolveAgentActivity([
      { id: 'lane-row', sessionId: 'op-1', name: null, kind: 'background', lease },
    ]);
    expect(runs).toMatchObject([{ card: '3932', joinVia: 'lane' }]);
  });

  it('resolver 4 (lane): a lease that does not name this row\'s session is not applied', () => {
    const lease = { purpose: 'build-3932', ownerSession: 'someone-else', workerSession: 'someone-else' };
    const { unmatched } = resolveAgentActivity([{ id: 'r', sessionId: 'op-1', name: null, kind: 'background', lease }]);
    expect(unmatched).toMatchObject([{ runId: 'r' }]);
  });

  it('resolver 5 (claim): a claim-replay session — most recently claimed wins', () => {
    const { runs } = resolveAgentActivity([
      { id: 'r', sessionId: 'op-2', name: null, kind: 'background', claimedNums: ['3401', '3555'] },
    ]);
    expect(runs).toMatchObject([{ card: '3555', joinVia: 'claim' }]);
  });

  it('resolver 6 (mention): a subagent with NO resolved parent, tagged weak via its own prompt mention', () => {
    const rows = [
      { id: 'orphan-parent', sessionId: 'sess-x', name: 'unrelated-task', kind: 'background' },
      { id: 'mentioned-child', sessionId: null, kind: 'subagent', parentSessionId: 'sess-x', workflowLane: false, firstMessageText: 'go look at #3444 please' },
    ];
    const { runs, unmatched } = resolveAgentActivity(rows);
    expect(runs.find((r) => r.runId === 'mentioned-child')).toMatchObject({ card: '3444', joinVia: 'mention', weak: true });
    expect(unmatched.map((u) => u.runId)).toEqual(['orphan-parent']);
  });

  it('a background session with no match of any kind lands in `unmatched`, not `runs`', () => {
    const { runs, unmatched } = resolveAgentActivity([{ id: 'z', sessionId: 'op-9', name: 'test-scratch', kind: 'background' }]);
    expect(runs).toEqual([]);
    expect(unmatched).toMatchObject([{ runId: 'z', kind: 'background' }]);
  });

  it('an interactive session with no lane or claim is dropped entirely — never runs, never unmatched', () => {
    const { runs, unmatched } = resolveAgentActivity([
      { id: 'op-1', sessionId: 'op-1', name: 'conveyor-3436', kind: 'interactive' },
    ]);
    expect(runs).toEqual([]);
    expect(unmatched).toEqual([]);
  });

  it('an interactive session with a NAME that happens to look like an item slug is still never joined via name — only 4/5', () => {
    const lease = { purpose: 'build-9001', ownerSession: 'op-3', workerSession: 'op-3' };
    const { runs } = resolveAgentActivity([
      { id: 'op-3', sessionId: 'op-3', name: 'conveyor-1', kind: 'interactive', lease },
    ]);
    // joins via lane (9001), never via the name resolver (which would have said card '1')
    expect(runs).toMatchObject([{ card: '9001', joinVia: 'lane' }]);
  });

  it('rejects non-array rows', () => { expect(() => resolveAgentActivity(null)).toThrow(/array/); });
});

describe('agentActivityOperation — the declared operation (#3032 shape)', () => {
  it('refuses a malformed injected reader', () => {
    expect(() => agentActivityOperation()).toThrow(/reader/);
  });

  it('is read-only (two compute steps) and threads input.prToCard through to the resolver', async () => {
    const declaration = agentActivityOperation({
      readActivity: () => ({ rows: [{ id: 'a', sessionId: 's', name: 'fix-2267', kind: 'background' }] }),
    });
    expect(isReadOnlyOperation(declaration)).toBe(true);
    expect(declaration.steps.map(({ step }) => step.kind)).toEqual(['compute', 'compute']);
    const registry = createRegistry();
    registry.register(declaration);
    const result = await runOperationCli({
      declaration, registry, argv: ['--json', `--prToCard=${JSON.stringify({ 'we:2267': '3690' })}`],
      store: createMemoryRunStore(), sinks: {}, newRunId: () => 'test-agent-activity',
    });
    expect(result.code).toBe(0);
    const verdict = JSON.parse(result.lines.join('\n')).verdict;
    expect(verdict.runs).toMatchObject([{ card: '3690', joinVia: 'name' }]);
  });

  it('refuses a reader that does not return { rows: [...] }', () => {
    const declaration = agentActivityOperation({ readActivity: () => null });
    expect(() => declaration.steps[0].step.fn({ input: { all: false, prToCard: {} } })).toThrow(/rows/);
  });
});
