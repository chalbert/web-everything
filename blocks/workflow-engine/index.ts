/**
 * @file blocks/workflow-engine/index.ts
 * @description Public API for the Workflow Engine block — the native-first runtime
 * behind the Workflow Protocol's `CustomWorkflowEngine` provider seam (#634/webworkflows),
 * plus the registry and a reference XState adapter.
 */

// Native-first default engine
export { default as NativeWorkflowEngine } from './NativeWorkflowEngine';

// Provider seam
export { CustomWorkflowEngineRegistry, customWorkflowEngine } from './registry';

// Reference library adapter
export { XStateWorkflowAdapter, toXStateConfig } from './adapters/XStateWorkflowAdapter';
export type { XStateLike, XStateMachineConfig, XStateService } from './adapters/XStateWorkflowAdapter';

// Types + the tiered operator vocabulary
export {
  TIER1_OPERATORS,
  TIER2_OPERATORS,
  STEP_TRANSITION_EVENT,
  WORKFLOW_COMPLETE_EVENT,
} from './types';
export type {
  WorkflowGraph,
  WorkflowStep,
  StepType,
  Transition,
  Guard,
  Assign,
  WorkflowEvent,
  WorkflowContext,
  WorkflowInstance,
  CustomWorkflowEngine,
  WorkflowOperator,
  StepTransitionDetail,
} from './types';
