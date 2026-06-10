/**
 * Default wiring for the validity-merge strategy plane (#212). Builds the registry pre-loaded with
 * the two shipped strategies — **source-reduction** (the native-first default) and
 * **last-write-wins** (the degenerate single-source reduction) — so a consumer gets a working,
 * swappable plane with one call and can `define()` custom strategies on top.
 */
import { SourceReductionStrategy, LastWriteWinsStrategy } from './provider.js';
import { CustomValidityMergeRegistry, ValiditySourceOrchestrator } from './registry.js';

export * from './provider.js';
export * from './registry.js';

/** A registry pre-loaded with the shipped strategies; source-reduction is the default. */
export function createDefaultRegistry(): CustomValidityMergeRegistry {
  const registry = new CustomValidityMergeRegistry();
  registry.define(new SourceReductionStrategy(), true); // native-first default
  registry.define(new LastWriteWinsStrategy());
  return registry;
}

/** An orchestrator wired to the default registry's default strategy — the common entry point. */
export function createDefaultOrchestrator(): ValiditySourceOrchestrator {
  return new ValiditySourceOrchestrator(createDefaultRegistry().resolve());
}
