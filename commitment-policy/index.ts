/**
 * Default wiring for the commitment-policy plane (#1112, webvalidation completion #1090). Builds the
 * registry pre-loaded with the two shipped strategies — `full` (the eager default) and `deferred` — so a
 * consumer gets a working, swappable plane with one call and can `register()`/`define()` custom policies
 * (severity-gated, field-specific, optimistic, staged) on top.
 */
import { FullCommitmentPolicy, DeferredCommitmentPolicy } from './provider.js';
import { CustomCommitmentPolicyRegistry } from './registry.js';

export * from './contract.js';
export * from './provider.js';
export * from './registry.js';

/** A registry pre-loaded with the shipped policies; `full` is the default. */
export function createDefaultCommitmentPolicyRegistry(): CustomCommitmentPolicyRegistry {
  const registry = new CustomCommitmentPolicyRegistry();
  registry.define(new FullCommitmentPolicy(), true); // eager default
  registry.define(new DeferredCommitmentPolicy());
  return registry;
}
