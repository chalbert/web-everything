import { describe, it, expect } from 'vitest';
import { outcomePayload, renderOutcome, runOperationCli } from '../cli-adapter.mjs';
import * as adapter from '../cli-adapter.mjs';
import { createMemoryRunStore } from '../run-store.mjs';
import { createRegistry } from '../registry.mjs';
import { openPrOperation } from '../open-pr.mjs';
import { createOpenPrSinks } from '../open-pr-io.mjs';
import { PARK_LABELS } from '../../pr-land.mjs';

const refused = { outcome: 'refused', reason: 'verify-unfinished', detail: 'verification is UNFINISHED', pr: null };
function completed(result = refused) {
  return {
    stopped: 'complete', applied: ['proof#0#0'],
    run: { id: 'proof', op: 'example', pending: null, findings: {}, verdict: null,
      effects: [{ type: 'open-pr.submit', step: 'submit', status: 'applied', result }] },
  };
}

describe('#4160 recorded effect outcomes', () => {
  it('a complete run whose effect result is refused exits 1 and names reason and detail', () => {
    const rendered = renderOutcome({ outcome: completed() });
    expect(rendered.code).toBe(1);
    expect(rendered.lines).toEqual([
      'run proof — complete, but 1 effect(s) were REFUSED/FAILED — nothing they asked for happened.',
      '  open-pr.submit (step submit): refused — verify-unfinished',
      '    detail: verification is UNFINISHED',
    ]);
    expect(rendered.lines.join('\n')).not.toMatch(/complete\. 1 effect\(s\) applied\./);
  });

  it('a failed effect outcome is surfaced the same way', () => {
    const rendered = renderOutcome({ outcome: completed({ outcome: 'failed', reason: 'submit-failed' }) });
    expect(rendered.code).toBe(1);
    expect(rendered.lines.join('\n')).toContain('failed — submit-failed');
  });

  it('a post-open refusal prints the PR it names', () => {
    const rendered = renderOutcome({ outcome: completed({ ...refused, pr: 42, url: 'https://example.test/42' }) });
    expect(rendered.code).toBe(1);
    expect(rendered.lines).toContain('    pr: 42 https://example.test/42');
  });

  it.each([
    ['opened', { outcome: 'opened', pr: 42 }],
    ['requested dry-run', { outcome: 'unrun', reason: 'dry-run' }],
  ])('an %s outcome still prints complete and exits 0', (_name, result) => {
    expect(renderOutcome({ outcome: completed(result) })).toEqual({
      code: 0, lines: ['run proof — complete. 1 effect(s) applied.'],
    });
  });

  it('a resumed finished run re-renders the recorded refusal', () => {
    const outcome = completed();
    outcome.applied = [];
    const rendered = renderOutcome({ outcome });
    expect(rendered.code).toBe(1);
    expect(rendered.lines.join('\n')).toContain('verify-unfinished');
  });

  it('--json render is unchanged for a refused effect', () => {
    const outcome = completed();
    const rendered = renderOutcome({ outcome, json: true });
    expect(rendered.code).toBe(0);
    expect(JSON.parse(rendered.lines[0])).toEqual(outcomePayload(outcome));
  });

  it('end to end: runOperationCli over open-pr with a refusing runner exits 1, including repeated resumes', async () => {
    const declaration = openPrOperation({ parkLabels: PARK_LABELS });
    const registry = createRegistry();
    registry.register(declaration);
    const store = createMemoryRunStore();
    let calls = 0;
    const sinks = createOpenPrSinks({ run: () => { calls++; return refused; } });
    for (let attempt = 0; attempt < 20; attempt++) {
      const out = await runOperationCli({ declaration, registry, store, sinks,
        argv: attempt ? ['--resume=proof-cli'] : ['--ref=lane/1-x', '--sha=HEAD', '--base=main', '--bodyFile=unused'],
        newRunId: () => 'proof-cli',
      });
      expect(out.stopped).toBe('complete');
      expect(out.code).toBe(1);
      expect(out.lines.join('\n')).toContain('open-pr.submit (step submit): refused — verify-unfinished');
    }
    expect(calls).toBe(1);
  });

  it('selects only applied refused/failed records without mutating them, and renders all of them', () => {
    const outcome = completed();
    const first = outcome.run.effects[0];
    const second = { ...first, type: 'other.submit', result: { outcome: 'failed', reason: 'other-failure' } };
    outcome.run.effects.push(second, { ...first, status: 'pending' }, { ...first, status: 'failed' },
      { ...first, result: undefined }, { ...first, result: { outcome: 'opened' } });
    const before = structuredClone(outcome);
    expect(adapter.refusedEffects(outcome.run)).toEqual([first, second]);
    const rendered = renderOutcome({ outcome, declaration: { ownedBy: 'test-owner' } });
    expect(rendered.lines[0]).toContain('2 effect(s) were REFUSED/FAILED');
    expect(rendered.lines).toContain('  other.submit (step submit): failed — other-failure');
    expect(rendered.lines.at(-1)).toContain('test-owner');
    expect(outcome).toEqual(before);
  });
});
