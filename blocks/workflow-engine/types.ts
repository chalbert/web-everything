/**
 * @file blocks/workflow-engine/types.ts
 * @description Types for the Workflow Engine block — the runtime behind the
 * Workflow Protocol's swappable `CustomWorkflowEngine` provider seam (ratified in
 * #634, owned by `webworkflows`). The orchestration graph is a portable, data-defined
 * SCXML-style interchange (steps + transitions + guards + parallel/fork-join +
 * completion); the engine threads context, tracks the current position, and emits a
 * `{ flow, from, to, context, at }` step-transition event on every move.
 *
 * @module blocks/workflow-engine
 */

export type WorkflowContext = Record<string, unknown>;

/** A guard predicate over the threaded context (TIER-1 branch/guard). */
export type Guard = (ctx: WorkflowContext, event: WorkflowEvent) => boolean;

/** A context assignment applied when a transition is taken (threaded state). */
export type Assign = (ctx: WorkflowContext, event: WorkflowEvent) => WorkflowContext;

/** A named event sent to the engine to drive a transition. */
export interface WorkflowEvent {
  type: string;
  [key: string]: unknown;
}

/** One outgoing transition from a step. */
export interface Transition {
  /** Target step id. */
  target: string;
  /** Branch/guard — the transition is eligible only if this returns true. */
  guard?: Guard;
  /** Context update applied when this transition is taken. */
  assign?: Assign;
}

/** The kind of a step (default `atomic`). */
export type StepType = 'atomic' | 'final' | 'parallel';

/** One step in the orchestration graph. */
export interface WorkflowStep {
  type?: StepType;
  /** event type → transition(s) (first guard-passing one wins). A step with no `on` and not final is a gate. */
  on?: Record<string, Transition | Transition[]>;
  /** Context merged in when this step is entered. */
  entryAssign?: WorkflowContext;
  /** Nested sub-workflow (TIER-1 nest); when it completes, `onDone` is followed. */
  invoke?: WorkflowGraph;
  onDone?: string;
  /** For `type: parallel` — the regions run concurrently; `join` is taken once all reach a final step. */
  regions?: WorkflowGraph[];
  join?: string;
}

/** The portable, data-defined workflow graph (the only lock — engine-swappable behind it). */
export interface WorkflowGraph {
  id: string;
  /** Initial step id. */
  initial: string;
  /** Seed context. */
  context?: WorkflowContext;
  steps: Record<string, WorkflowStep>;
}

/** The observable step-transition event — the composition seam for UX + audit/reporting. */
export interface StepTransitionDetail {
  /** The workflow (graph) id. */
  flow: string;
  /** Step id moved from. */
  from: string;
  /** Step id moved to. */
  to: string;
  /** A snapshot of the threaded context after the move. */
  context: WorkflowContext;
  /** Epoch ms of the transition. */
  at: number;
}

export const STEP_TRANSITION_EVENT = 'step-transition';
export const WORKFLOW_COMPLETE_EVENT = 'workflow-complete';

// -----------------------------------------------------------------------
// The CustomWorkflowEngine provider seam + the #085-style compliance matrix
// -----------------------------------------------------------------------

/** The standardized, tiered operator set (the open meta-schema engines declare against). */
export type WorkflowOperator =
  // TIER-1 core/mandatory
  | 'sequence'
  | 'branch'
  | 'nest'
  | 'context'
  | 'completion'
  | 'current-position'
  // TIER-2 common/optional
  | 'parallel'
  | 'back'
  | 'gate';

export const TIER1_OPERATORS: WorkflowOperator[] = [
  'sequence',
  'branch',
  'nest',
  'context',
  'completion',
  'current-position',
];
export const TIER2_OPERATORS: WorkflowOperator[] = ['parallel', 'back', 'gate'];

/** A running workflow instance — what `CustomWorkflowEngine.start()` returns. */
export interface WorkflowInstance {
  /** The active step id(s) — a string for a single position, a Set for parallel regions. */
  readonly position: string;
  /** The current threaded context (read-only snapshot). */
  readonly context: WorkflowContext;
  /** Whether the workflow has reached a final step. */
  readonly done: boolean;
  /** Drive a transition by sending a named event. Returns true if a transition was taken. */
  send(event: WorkflowEvent | string): boolean;
  /** Step back to the previous position (TIER-2 back/undo), if history allows. */
  back(): boolean;
  /** Subscribe to step-transition events; returns an unsubscribe. */
  onTransition(listener: (detail: StepTransitionDetail) => void): () => void;
  /** Subscribe to completion; returns an unsubscribe. */
  onComplete(listener: (detail: { flow: string; context: WorkflowContext }) => void): () => void;
}

/**
 * The swappable provider contract (#634). The native-first default and every library
 * adapter (XState, SCION, …) implement this; the registry resolves one per scope.
 */
export interface CustomWorkflowEngine {
  /** A stable engine name (`native`, `xstate`, `scion`, …). */
  readonly name: string;
  /** Which operators this engine honors — the #085 compliance posture. */
  readonly supports: WorkflowOperator[];
  /** Instantiate a running workflow from a portable graph. */
  start(graph: WorkflowGraph, initialContext?: WorkflowContext): WorkflowInstance;
}
