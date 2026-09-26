// Red→green proof for the flow checker + graph generator (#4075 step 1): the same toy flow with deliberate
// gaps (fixtures/gappy) and with each gap closed (fixtures/fixed).
import { describe, it, expect } from 'vitest';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadFlows, checkFlow, checkFlows, guaranteedFacts } from '../flow-model.mjs';
import { runCheck, formatReport } from '../check.mjs';
import { renderGraphs } from '../graph.mjs';

const FIX = join(dirname(fileURLToPath(import.meta.url)), '..', 'test-fixtures');
const gappy = () => loadFlows(join(FIX, 'gappy'))[0];
const fixed = () => loadFlows(join(FIX, 'fixed'))[0];
const rules = (fs) => fs.map((f) => `${f.rule} @ ${f.where}`).sort();

describe('flow checker — red on the gappy fixture', () => {
  const findings = checkFlows([gappy()]);

  it('flags every deliberate gap, and only those', () => {
    expect(rules(findings)).toEqual([
      'dangling-ref @ transition spawned→@elsewhere',
      'dangling-ref @ transition spawned→nowhere',
      'failure-no-exit @ state stuck',
      'failure-no-exit @ step spawn',
      'no-owner @ state awaiting-ci',
      'silent-failure @ state failed',
      'unbounded-wait @ state awaiting-ci',
      'uncapped-retry @ state retrying',
      'unprovided-assumption @ step await',
      'unprovided-assumption @ step edit',
      'unreachable @ state failed',
      'unreachable @ state orphan',
    ]);
  });

  it('names the missing fact (the knock-on: cwd moved to scratch, lane edit never granted)', () => {
    const edit = findings.find((f) => f.where === 'step edit');
    expect(edit.message).toContain('permission:edit:<lane>');
  });

  it('must-analysis: ONE path that skips a provision is enough (retarget path never triggers CI)', () => {
    const IN = guaranteedFacts(gappy());
    expect(IN.get('awaiting-ci').has('ci:required checks ran on head')).toBe(false);
    const INfixed = guaranteedFacts(fixed());
    expect(INfixed.get('awaiting-ci').has('ci:required checks ran on head')).toBe(true);
  });

  it('failure / timeout edges carry only what held on entry, not the failed state\'s provisions', () => {
    const flow = {
      id: 't', entry: { state: 'a', provides: [] },
      states: [{ id: 'a', owner: 'x' }, { id: 'b', owner: 'x' }, { id: 'z', terminal: true, outcome: 'success' }],
      transitions: [{ from: 'a', to: 'b', kind: 'failure' }, { from: 'b', to: 'z' }],
      steps: [
        { id: 'p', state: 'a', provides: [{ kind: 'lock', name: 'l' }] },
        { id: 'u', state: 'b', assumes: [{ kind: 'lock', name: 'l' }] },
      ],
    };
    expect(rules(checkFlow(flow))).toEqual(['unprovided-assumption @ step u']);
    flow.transitions[0].kind = 'normal';
    expect(checkFlow(flow)).toEqual([]);
  });
});

describe('removes — a later step that changes cwd drops cwd-derived facts', () => {
  it('flags a step that relied on the old cwd once an earlier step moved it', () => {
    const flow = {
      id: 't', entry: { state: 'a', provides: [{ kind: 'cwd', name: '<clone>' }] },
      states: [{ id: 'a', owner: 'x' }, { id: 'z', terminal: true, outcome: 'success' }],
      transitions: [{ from: 'a', to: 'z' }],
      steps: [
        { id: 'move', state: 'a', provides: [{ kind: 'cwd', name: '<scratch>' }], removes: [{ kind: 'cwd', name: '<clone>' }] },
        { id: 'use', state: 'a', assumes: [{ kind: 'cwd', name: '<clone>' }] },
      ],
    };
    expect(rules(checkFlow(flow))).toEqual(['unprovided-assumption @ step use']);
    flow.steps.reverse();
    expect(checkFlow(flow)).toEqual([]);
  });
});

describe('flow checker — green on the fixed fixture', () => {
  it('reports nothing once every gap is closed', () => {
    expect(checkFlows([fixed()])).toEqual([]);
  });
});

describe('acknowledgements', () => {
  it('a card id acknowledges a finding; --ci only counts open ones', () => {
    const flow = gappy();
    flow.states.find((s) => s.id === 'awaiting-ci').ack = { 'no-owner': '#4999', 'unbounded-wait': 'x1a2b3c' };
    const fs = checkFlow(flow);
    expect(fs.find((f) => f.rule === 'no-owner').acknowledged).toBe('#4999');
    expect(fs.find((f) => f.rule === 'unbounded-wait').acknowledged).toBe('x1a2b3c');
  });

  it('an ack that is not a card id is itself a finding and does not acknowledge', () => {
    const flow = gappy();
    flow.states.find((s) => s.id === 'awaiting-ci').ack = { 'no-owner': 'later' };
    const fs = checkFlow(flow);
    expect(fs.some((f) => f.rule === 'bad-ack')).toBe(true);
    expect(fs.find((f) => f.rule === 'no-owner').acknowledged).toBeNull();
  });
});

describe('check CLI core', () => {
  it('runCheck splits open vs acknowledged and formatReport prints both', () => {
    const res = runCheck({ dir: join(FIX, 'gappy') });
    expect(res.flows).toEqual(['toy']);
    expect(res.open.length).toBe(res.findings.length);
    const txt = formatReport(res);
    expect(txt).toContain('[OPEN] no-owner');
    expect(runCheck({ dir: join(FIX, 'fixed') }).findings).toEqual([]);
  });
});

describe('graph generator', () => {
  it('emits Mermaid per flow with gap styling, plus JSON model and a combined graph', () => {
    const res = renderGraphs({ dir: join(FIX, 'gappy') });
    const m = res.flows[0].mermaid;
    expect(m.startsWith('flowchart TD')).toBe(true);
    expect(m).toContain('class s_awaiting_ci noOwner');
    expect(m).toContain('NO OWNER');
    expect(m).toContain('⏱ ∞');
    expect(m).toMatch(/s_awaiting_ci -\.->\|"red"\| s_retrying/);
    expect(res.flows[0].model.id).toBe('toy');
    expect(res.combined).toContain('subgraph toy');
  });

  it('the fixed fixture draws no gap classes', () => {
    const m = renderGraphs({ dir: join(FIX, 'fixed') }).flows[0].mermaid;
    expect(m).not.toContain('noOwner\n');
    expect(m).not.toMatch(/class \S+ (noOwner|unbounded)$/m);
  });
});
