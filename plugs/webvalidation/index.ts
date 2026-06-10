/**
 * @file webvalidation/index.ts
 * @description Runtime validity-merge plug (#215): the live `customValidityMerge` registry, the
 *   `ElementInternals` sink, and the `<validity-merge-field>` form-associated control.
 */
if (typeof window !== 'undefined') {
  console.log('[webvalidation] Module loaded');
}

export { default as CustomValidityMergeRegistry } from './CustomValidityMergeRegistry';
export { createDefaultValidityMergeRegistry } from './CustomValidityMergeRegistry';
export { applyMergedValidity } from './applyMergedValidity';
export type { ValiditySink } from './applyMergedValidity';
export { default as ValidityMergeField } from './ValidityMergeField';

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
