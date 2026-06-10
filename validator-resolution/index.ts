/**
 * Default wiring for the async validator resolution strategy plane (#214). Builds the registry
 * pre-loaded with the two shipped strategies — **versioning** (the native-first default) and
 * **cancellation** — so a consumer gets a working, swappable plane with one call and can `define()`
 * custom strategies on top.
 */
import { VersioningResolution, CancellationResolution } from './provider.js';
import { CustomValidatorResolutionRegistry, AsyncValidationRunner, type SourceSink } from './registry.js';

export * from './provider.js';
export * from './registry.js';

/** A registry pre-loaded with the shipped strategies; versioning is the default. */
export function createDefaultRegistry(): CustomValidatorResolutionRegistry {
  const registry = new CustomValidatorResolutionRegistry();
  registry.define(new VersioningResolution(), true); // native-first default
  registry.define(new CancellationResolution());
  return registry;
}

/** A runner wired to the default registry's default strategy — the common entry point. */
export function createDefaultRunner(opts: { sourceName?: string; emit?: SourceSink } = {}): AsyncValidationRunner {
  return new AsyncValidationRunner(createDefaultRegistry().resolve(), opts);
}
