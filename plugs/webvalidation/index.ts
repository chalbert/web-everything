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

// Re-export the capability-manifest vocabulary (#266) — the `{specVersion, conformanceLevel,
// features, concerns}` schema an implementation declares, the ratified Core set (OP-18), the static
// `manifest` export convention (OP-19), and the semver helpers over the validation vocabulary. The
// adherence tooling (#267–#270) consumes this one shape.
export {
  type CapabilityManifest,
  type ConformanceLevel,
  type ValidationFeatureId,
  CONFORMANCE_LEVELS,
  CORE_FEATURES,
  OPTIONAL_FEATURES,
  ALL_FEATURES,
  FEATURE_SINCE,
  VALIDATION_SPEC_VERSION,
  MANIFEST_EXPORT_NAME,
  ManifestContractError,
  parseSpecVersion,
  compareSpecVersions,
  featureAvailableIn,
  manifestSupports,
  missingCoreFeatures,
  isCapabilityManifest,
  assertCapabilityManifest,
} from '../../capability-manifest/provider.js';

// Re-export the validation-generation vocabulary (#304, slice #085-A) — the neutral intent
// enumeration (what can be constrained) + the `CustomValidationAdapter` contract + the standalone
// `customValidationAdapter` registry the per-language adapter slices (#305–#308) and the Mode-2
// service (#309) register into. A code model (like the capability manifest), not a UX intent.
export {
  type ValidationIntentId,
  type ValidationConstraint,
  type ValidationDeclaration,
  type GeneratedValidation,
  type CustomValidationAdapter,
  VALIDATION_GENERATION_SPEC_VERSION,
  VALIDATION_INTENTS,
  VALIDATION_INTENT_SINCE,
  isValidationIntentId,
  unsupportedIntents,
  isValidationAdapter,
  assertValidationAdapter,
  ValidationAdapterContractError,
} from '../../validation-generation/provider.js';
export {
  CustomValidationAdapterRegistry,
  UnknownValidationAdapterError,
  createValidationAdapterRegistry,
} from '../../validation-generation/registry.js';
// The field-error shape (#464) — the per-field error RFC 9457 leaves undefined: a JSON-Pointer to the
// offending field, the validation intent whose rule failed, and a human message. A data contract that
// rides inside the RFC 9457 envelope's `errors` extension; the output counterpart of a constraint.
export {
  type ValidationFieldError,
  type ValidationProblemDetails,
  PROBLEM_JSON_MEDIA_TYPE,
  isJsonPointer,
  fieldError,
  isValidationFieldError,
  assertValidationFieldError,
  ValidationFieldErrorContractError,
} from '../../validation-generation/fieldError.js';
export {
  nativeHtmlAdapter,
  zodAdapter,
  pydanticAdapter,
  jsonSchemaAdapter,
  SHIPPED_VALIDATION_ADAPTERS,
  createDefaultValidationAdapterRegistry,
} from '../../validation-generation/adapters/index.js';
// The Mode-2 generation service (#309, slice #085-F) — the request-boundary delivery mode (string in,
// string out, JSON) over the same adapters as Mode-1's in-process `emit`, proving ≥2 delivery modes.
export {
  type ValidationServiceRequest,
  type ValidationServiceResponse,
  type ServedArtifact,
  handleValidationRequest,
  serveValidation,
} from '../../validation-generation/service.js';

// Runtime dev-mode capability guard (#268) — the runtime sibling of the build-time adherence check:
// warns (dev-only, stripped in prod) when a used validation feature is not declared by the active
// implementation's manifest. Re-exported here so validation-runtime consumers reach it alongside the
// manifest vocabulary above.
export { guardCapability, guardCapabilities } from '../../capability-manifest/guard.js';
