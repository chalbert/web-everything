/**
 * @file blocks/workflow-engine/adapters/XStateWorkflowAdapter.ts
 * @description Reference library adapter (#650): plugs an XState-style statechart
 * interpreter in behind the {@link CustomWorkflowEngine} seam as an alternative impl.
 *
 * To keep the native-first runtime dependency-free, the adapter is written against the
 * *minimal slice* of the XState API it needs ({@link XStateLike} — `createMachine` +
 * `interpret`), injected by the consumer. That demonstrates the mapping — portable
 * graph → XState machine config → running service → the WorkflowInstance contract —
 * without bundling XState. Pass your real `xstate` module (`{ createMachine, interpret }`)
 * to use it; SCION (or any statechart engine) plugs in the same way.
 *
 * @example
 * ```ts
 * import * as xstate from 'xstate';
 * customWorkflowEngine.define(new XStateWorkflowAdapter(xstate));
 * customWorkflowEngine.setDefault('xstate');
 * ```
 */

import {
  TIER1_OPERATORS,
  TIER2_OPERATORS,
  type CustomWorkflowEngine,
  type StepTransitionDetail,
  type WorkflowContext,
  type WorkflowGraph,
  type WorkflowInstance,
  type WorkflowOperator,
} from '../types';

/** The minimal XState surface the adapter depends on (structural, so a fake satisfies it in tests). */
export interface XStateLike {
  createMachine(config: XStateMachineConfig, options?: unknown): unknown;
  interpret(machine: unknown): XStateService;
}

export interface XStateMachineConfig {
  id: string;
  initial: string;
  context: WorkflowContext;
  states: Record<string, XStateNodeConfig>;
}
export interface XStateNodeConfig {
  type?: 'final';
  on?: Record<string, { target: string }>;
}
export interface XStateService {
  start(): XStateService;
  stop(): void;
  send(event: { type: string } & Record<string, unknown>): void;
  subscribe(cb: (state: { value: string; context: WorkflowContext; done?: boolean }) => void): {
    unsubscribe(): void;
  };
}

/** Translate the portable graph into an XState machine config (the sequence/branch/final subset). */
export function toXStateConfig(graph: WorkflowGraph): XStateMachineConfig {
  const states: Record<string, XStateNodeConfig> = {};
  for (const [id, step] of Object.entries(graph.steps)) {
    const node: XStateNodeConfig = {};
    if (step.type === 'final') node.type = 'final';
    if (step.on) {
      node.on = {};
      for (const [evt, t] of Object.entries(step.on)) {
        const first = Array.isArray(t) ? t[0] : t;
        if (first) node.on[evt] = { target: first.target };
      }
    }
    states[id] = node;
  }
  return { id: graph.id, initial: graph.initial, context: { ...(graph.context ?? {}) }, states };
}

export class XStateWorkflowAdapter implements CustomWorkflowEngine {
  readonly name = 'xstate';
  /** XState natively covers the statechart operators; durable-execution TIER-3 stays the backend's. */
  readonly supports: WorkflowOperator[] = [...TIER1_OPERATORS, ...TIER2_OPERATORS];

  #xstate: XStateLike;
  constructor(xstate: XStateLike) {
    this.#xstate = xstate;
  }

  start(graph: WorkflowGraph, initialContext?: WorkflowContext): WorkflowInstance {
    const config = toXStateConfig(graph);
    config.context = { ...config.context, ...(initialContext ?? {}) };
    const service = this.#xstate.interpret(this.#xstate.createMachine(config));

    let position = graph.initial;
    let context: WorkflowContext = { ...config.context };
    let done = false;
    const transitionListeners = new Set<(d: StepTransitionDetail) => void>();
    const completeListeners = new Set<(d: { flow: string; context: WorkflowContext }) => void>();

    service.subscribe((state) => {
      const from = position;
      position = state.value;
      context = state.context;
      if (from !== state.value) {
        const detail: StepTransitionDetail = { flow: graph.id, from, to: state.value, context, at: Date.now() };
        for (const l of transitionListeners) l(detail);
      }
      if (state.done && !done) {
        done = true;
        for (const l of completeListeners) l({ flow: graph.id, context });
      }
    });
    service.start();

    return {
      get position() {
        return position;
      },
      get context() {
        return { ...context };
      },
      get done() {
        return done;
      },
      send(event) {
        if (done) return false;
        service.send(typeof event === 'string' ? { type: event } : event);
        return true;
      },
      back() {
        // Back/undo is a host concern over XState (snapshot history); not provided by the bare service.
        return false;
      },
      onTransition(listener) {
        transitionListeners.add(listener);
        return () => transitionListeners.delete(listener);
      },
      onComplete(listener) {
        completeListeners.add(listener);
        return () => completeListeners.delete(listener);
      },
    };
  }
}
