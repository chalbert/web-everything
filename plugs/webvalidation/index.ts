/**
 * @file webvalidation/index.ts
 * @description Runtime validity-merge plug (#215): the live `customValidityMerge` registry, the
 *   `ElementInternals` sink, and the `<validity-merge-field>` form-associated control. Plus the async
 *   sibling (#224): the live `customValidatorResolution` registry and the `<async-validator-field>`
 *   control that feeds a merge field's `async` source.
 */
if (typeof window !== 'undefined') {
  console.log('[webvalidation] Module loaded');
}

export { default as CustomValidityMergeRegistry } from './CustomValidityMergeRegistry';
export { createDefaultValidityMergeRegistry } from './CustomValidityMergeRegistry';
export { applyMergedValidity } from './applyMergedValidity';
export type { ValiditySink } from './applyMergedValidity';
export { default as ValidityMergeField } from './ValidityMergeField';

// Async validator-resolution plug (#224) — the live `customValidatorResolution` registry + the
// `<async-validator-field>` driver that feeds a `<validity-merge-field>`'s `async` source.
export { default as CustomValidatorResolutionRegistry } from './CustomValidatorResolutionRegistry';
export { createDefaultValidatorResolutionRegistry } from './CustomValidatorResolutionRegistry';
export { default as AsyncValidatorField } from './AsyncValidatorField';
export type { AsyncSourceTarget } from './AsyncValidatorField';

// Re-export the resolution-plane vocabulary (#214) from one entry point, mirroring the merge re-exports.
export {
  type CustomValidatorResolution,
  type AsyncResult,
  type ResolvedSource,
  type ValidationHandle,
  type ValidationInput,
  VersioningResolution,
  CancellationResolution,
} from '../../validator-resolution/provider.js';
export {
  AsyncValidationRunner,
  UnknownResolutionError,
  type AsyncValidator,
  type SourceSink,
} from '../../validator-resolution/registry.js';

// Re-export the surface types + strategies + orchestrator from the standalone model (#212) so a
// consumer of the runtime plug has the whole vocabulary from one entry point.
export {
  type CustomValidityMergeStrategy,
  type MergedValidity,
  type SourceResult,
  type SourceState,
  type ValidityMessage,
  SourceReductionStrategy,
  LastWriteWinsStrategy,
} from '../../validity-merge/provider.js';
export {
  ValiditySourceOrchestrator,
  UnknownStrategyError,
  type SourceUpdate,
} from '../../validity-merge/registry.js';
