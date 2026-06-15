/**
 * @file blocks/workflow-engine/__tests__/workflow-engine.test.ts
 * @description Tests for the native-first workflow engine — TIER-1 (sequence, branch/
 * guard, nest, threaded context, completion, current-position) and TIER-2 (parallel
 * fork/join, back/undo, gate) operators, the step-transition event, the registry seam,
 * and the reference XState adapter (exercised through a structural fake).
 */

import { describe, it, expect, vi } from 'vitest';
import NativeWorkflowEngine from '../NativeWorkflowEngine';
import { CustomWorkflowEngineRegistry, customWorkflowEngine } from '../registry';
import { XStateWorkflowAdapter, toXStateConfig, type XStateLike } from '../adapters/XStateWorkflowAdapter';
import { TIER1_OPERATORS, type StepTransitionDetail, type WorkflowGraph } from '../types';

const engine = new NativeWorkflowEngine();

const checkout: WorkflowGraph = {
  id: 'checkout',
  initial: 'address',
  context: { paid: false },
  steps: {
    address: { on: { NEXT: { target: 'pay' } } },
    pay: {
      on: {
        // branch/guard: only proceed to confirm when the amount is within limit; else review.
        SUBMIT: [
          { target: 'review', guard: (ctx, e) => (e.amount as number) > (ctx.limit as number) },
          { target: 'confirm', assign: () => ({ paid: true }) },
        ],
      },
    },
    review: { on: { APPROVE: { target: 'confirm', assign: () => ({ paid: true }) } } },
    confirm: { type: 'final' },
  },
};

describe('NativeWorkflowEngine — TIER-1 core', () => {
  it('declares the full tiered operator set', () => {
    expect(TIER1_OPERATORS.every((op) => engine.supports.includes(op))).toBe(true);
    expect(engine.supports).toContain('parallel');
  });

  it('sequence + current-position: advances step to step', () => {
    const wf = engine.start(checkout);
    expect(wf.position).toBe('address');
    expect(wf.send('NEXT')).toBe(true);
    expect(wf.position).toBe('pay');
  });

  it('branch/guard + threaded context: the guard picks the path and assign threads state', () => {
    const wf = engine.start(checkout, { limit: 1000 });
    wf.send('NEXT');
    wf.send({ type: 'SUBMIT', amount: 5000 }); // over limit → review
    expect(wf.position).toBe('review');
    wf.send('APPROVE');
    expect(wf.position).toBe('confirm');
    expect(wf.context.paid).toBe(true);
  });

  it('completion: reaching a final step marks done and fires onComplete', () => {
    const wf = engine.start(checkout, { limit: 1e9 });
    const onDone = vi.fn();
    wf.onComplete(onDone);
    wf.send('NEXT');
    wf.send({ type: 'SUBMIT', amount: 10 }); // under limit → confirm (final)
    expect(wf.done).toBe(true);
    expect(onDone).toHaveBeenCalledWith({ flow: 'checkout', context: expect.objectContaining({ paid: true }) });
    expect(wf.send('NEXT')).toBe(false); // no transitions once done
  });

  it('emits a { flow, from, to, context, at } step-transition event', () => {
    const wf = engine.start(checkout, { limit: 1e9 });
    const seen: StepTransitionDetail[] = [];
    wf.onTransition((d) => seen.push(d));
    wf.send('NEXT');
    expect(seen[0]).toMatchObject({ flow: 'checkout', from: 'address', to: 'pay' });
    expect(typeof seen[0].at).toBe('number');
    expect(seen[0].context).toBeTypeOf('object');
  });

  it('nest: a sub-workflow runs to completion, then onDone is followed', () => {
    const parent: WorkflowGraph = {
      id: 'parent',
      initial: 'sub',
      steps: {
        sub: {
          invoke: {
            id: 'child',
            initial: 'a',
            steps: { a: { on: { GO: { target: 'b' } } }, b: { type: 'final' } },
          },
          onDone: 'after',
        },
        after: { type: 'final' },
      },
    };
    const wf = engine.start(parent);
    expect(wf.position).toBe('sub');
    wf.send('GO'); // drives the child to its final → parent follows onDone
    expect(wf.position).toBe('after');
    expect(wf.done).toBe(true);
  });
});

describe('NativeWorkflowEngine — TIER-2 common', () => {
  it('gate/wait-for-event: a step with only one event stays until that event arrives', () => {
    const wf = engine.start(checkout);
    expect(wf.send('SUBMIT')).toBe(false); // address has no SUBMIT — gated
    expect(wf.position).toBe('address');
    expect(wf.send('NEXT')).toBe(true);
  });

  it('back/undo: returns to the previous position', () => {
    const wf = engine.start(checkout, { limit: 1e9 });
    wf.send('NEXT');
    expect(wf.position).toBe('pay');
    expect(wf.back()).toBe(true);
    expect(wf.position).toBe('address');
    expect(wf.back()).toBe(false); // nothing before the initial
  });

  it('parallel fork/join: joins once all regions reach final', () => {
    const parallel: WorkflowGraph = {
      id: 'par',
      initial: 'fork',
      steps: {
        fork: {
          type: 'parallel',
          regions: [
            { id: 'r1', initial: 'x', steps: { x: { on: { A: { target: 'xd' } } }, xd: { type: 'final' } } },
            { id: 'r2', initial: 'y', steps: { y: { on: { B: { target: 'yd' } } }, yd: { type: 'final' } } },
          ],
          join: 'joined',
        },
        joined: { type: 'final' },
      },
    };
    const wf = engine.start(parallel);
    wf.send('A'); // region 1 done, region 2 still running → no join yet
    expect(wf.position).toBe('fork');
    wf.send('B'); // both done → join
    expect(wf.position).toBe('joined');
    expect(wf.done).toBe(true);
  });
});

describe('CustomWorkflowEngineRegistry — provider seam', () => {
  it('pre-registers the native-first default', () => {
    const reg = new CustomWorkflowEngineRegistry();
    expect(reg.resolve().name).toBe('native');
    expect(reg.names()).toContain('native');
  });

  it('registers + resolves an alternative, and can switch the default', () => {
    const reg = new CustomWorkflowEngineRegistry();
    const fake = { name: 'scion', supports: [], start: () => ({}) } as never;
    reg.define(fake);
    expect(reg.resolve('scion')).toBe(fake);
    reg.setDefault('scion');
    expect(reg.resolve().name).toBe('scion');
    expect(() => reg.setDefault('ghost')).toThrow();
  });

  it('the shared instance exposes native by default', () => {
    expect(customWorkflowEngine.resolve().name).toBe('native');
  });
});

describe('XStateWorkflowAdapter — reference library adapter', () => {
  it('maps the portable graph to an XState machine config (sequence/branch/final subset)', () => {
    const config = toXStateConfig(checkout);
    expect(config).toMatchObject({ id: 'checkout', initial: 'address' });
    expect(config.states.address.on?.NEXT).toEqual({ target: 'pay' });
    expect(config.states.confirm.type).toBe('final');
  });

  it('drives a fake XState service through the WorkflowInstance contract', () => {
    // A minimal structural fake of XState: a service whose send() walks the config's transitions.
    const fake: XStateLike = {
      createMachine: (cfg) => cfg,
      interpret: (machine) => {
        const cfg = machine as ReturnType<typeof toXStateConfig>;
        let value = cfg.initial;
        let subscriber: ((s: { value: string; context: Record<string, unknown>; done?: boolean }) => void) | null = null;
        const emit = () => subscriber?.({ value, context: cfg.context, done: cfg.states[value]?.type === 'final' });
        return {
          start() {
            emit();
            return this;
          },
          stop() {},
          send(e) {
            const next = cfg.states[value]?.on?.[e.type]?.target;
            if (next) {
              value = next;
              emit();
            }
          },
          subscribe(cb) {
            subscriber = cb;
            return { unsubscribe() {} };
          },
        };
      },
    };
    const adapter = new XStateWorkflowAdapter(fake);
    expect(adapter.name).toBe('xstate');
    const wf = adapter.start(checkout);
    const seen: string[] = [];
    wf.onTransition((d) => seen.push(`${d.from}->${d.to}`));
    wf.send('NEXT');
    expect(wf.position).toBe('pay');
    expect(seen).toContain('address->pay');
  });
});
