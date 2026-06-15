/**
 * @file blocks/workflow-engine/NativeWorkflowEngine.ts
 * @description The native-first default {@link CustomWorkflowEngine} — a dependency-free
 * interpreter of the portable SCXML-style workflow graph. It honors TIER-1 core
 * (sequence, branch/guard, nest, threaded context, completion, current-position) and
 * TIER-2 common (parallel fork/join, back/undo, gate/wait-for-event), and declares its
 * supported operator set (the #085 compliance posture). Every transition emits the
 * observable `{ flow, from, to, context, at }` step-transition event.
 */

import {
  TIER1_OPERATORS,
  TIER2_OPERATORS,
  type CustomWorkflowEngine,
  type StepTransitionDetail,
  type Transition,
  type WorkflowContext,
  type WorkflowEvent,
  type WorkflowGraph,
  type WorkflowInstance,
  type WorkflowOperator,
} from './types';

function asEvent(e: WorkflowEvent | string): WorkflowEvent {
  return typeof e === 'string' ? { type: e } : e;
}

function asTransitions(t: Transition | Transition[] | undefined): Transition[] {
  return t == null ? [] : Array.isArray(t) ? t : [t];
}

class NativeWorkflowInstance implements WorkflowInstance {
  #graph: WorkflowGraph;
  #position: string;
  #context: WorkflowContext;
  #done = false;
  #history: string[] = [];
  #transitionListeners = new Set<(d: StepTransitionDetail) => void>();
  #completeListeners = new Set<(d: { flow: string; context: WorkflowContext }) => void>();

  // For nested sub-workflows + parallel regions: the children currently running under a step.
  #child: NativeWorkflowInstance | null = null;
  #regions: NativeWorkflowInstance[] = [];

  constructor(graph: WorkflowGraph, initialContext?: WorkflowContext) {
    this.#graph = graph;
    this.#context = { ...(graph.context ?? {}), ...(initialContext ?? {}) };
    this.#position = graph.initial;
    this.#enter(graph.initial, /*record*/ false);
  }

  get position(): string {
    return this.#position;
  }
  get context(): WorkflowContext {
    return { ...this.#context };
  }
  get done(): boolean {
    return this.#done;
  }

  onTransition(listener: (d: StepTransitionDetail) => void): () => void {
    this.#transitionListeners.add(listener);
    return () => this.#transitionListeners.delete(listener);
  }
  onComplete(listener: (d: { flow: string; context: WorkflowContext }) => void): () => void {
    this.#completeListeners.add(listener);
    return () => this.#completeListeners.delete(listener);
  }

  send(eventInput: WorkflowEvent | string): boolean {
    if (this.#done) return false;
    const event = asEvent(eventInput);
    const step = this.#graph.steps[this.#position];
    if (!step) return false;

    // Nested sub-workflow: delegate to the child until it completes (TIER-1 nest).
    if (this.#child && !this.#child.done) {
      const moved = this.#child.send(event);
      if (this.#child.done && step.onDone) this.#transition(step.onDone, event);
      return moved;
    }

    // Parallel regions: fan the event to each; join when all are done (TIER-2 parallel).
    if (this.#regions.length) {
      let any = false;
      for (const r of this.#regions) if (!r.done) any = r.send(event) || any;
      if (this.#regions.every((r) => r.done) && step.join) this.#transition(step.join, event);
      return any;
    }

    // Atomic / gate: find the first guard-passing transition for this event type.
    const candidates = asTransitions(step.on?.[event.type]);
    for (const t of candidates) {
      if (t.guard && !t.guard(this.#context, event)) continue;
      if (t.assign) this.#context = { ...this.#context, ...t.assign(this.#context, event) };
      this.#transition(t.target, event);
      return true;
    }
    return false;
  }

  back(): boolean {
    if (this.#history.length === 0) return false;
    const prev = this.#history.pop() as string;
    const from = this.#position;
    this.#done = false;
    this.#position = prev;
    this.#enter(prev, /*record*/ false);
    this.#emit(from, prev);
    return true;
  }

  // ── internals ──

  #transition(target: string, event: WorkflowEvent): void {
    const from = this.#position;
    this.#history.push(from);
    this.#position = target;
    this.#enter(target, /*record*/ true, event);
    this.#emit(from, target);
  }

  #enter(stepId: string, _record: boolean, event?: WorkflowEvent): void {
    const step = this.#graph.steps[stepId];
    this.#child = null;
    this.#regions = [];
    if (!step) return;

    if (step.entryAssign) this.#context = { ...this.#context, ...step.entryAssign };

    if (step.type === 'final') {
      this.#done = true;
      for (const l of this.#completeListeners) l({ flow: this.#graph.id, context: this.context });
      return;
    }

    if (step.invoke) {
      // Nest: start the sub-workflow; its context is seeded from the parent's.
      this.#child = new NativeWorkflowInstance(step.invoke, this.#context);
      // Bubble the child's transitions up so observers see the nested flow too.
      this.#child.onTransition((d) => this.#relay(d));
      return;
    }

    if (step.type === 'parallel' && step.regions?.length) {
      this.#regions = step.regions.map((g) => {
        const region = new NativeWorkflowInstance(g, this.#context);
        region.onTransition((d) => this.#relay(d));
        return region;
      });
      void event;
      return;
    }
  }

  #emit(from: string, to: string): void {
    const detail: StepTransitionDetail = {
      flow: this.#graph.id,
      from,
      to,
      context: this.context,
      at: Date.now(),
    };
    for (const l of this.#transitionListeners) l(detail);
  }

  #relay(detail: StepTransitionDetail): void {
    for (const l of this.#transitionListeners) l(detail);
  }
}

export default class NativeWorkflowEngine implements CustomWorkflowEngine {
  readonly name = 'native';
  /** The native engine honors all TIER-1 + TIER-2 operators. */
  readonly supports: WorkflowOperator[] = [...TIER1_OPERATORS, ...TIER2_OPERATORS];

  start(graph: WorkflowGraph, initialContext?: WorkflowContext): WorkflowInstance {
    return new NativeWorkflowInstance(graph, initialContext);
  }
}
