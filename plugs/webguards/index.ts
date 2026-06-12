/**
 * @file webguards/index.ts
 * @description Runtime guard plug (#289): the live `customGuards` registry and the native-first
 *   default provider that backs the Guard protocol seam (#288). Both guard member intents — exit guard
 *   (#273) and access control (#178) — are UX-only and delegate to a provider resolved through this
 *   registry, so the registry+provider is shared infrastructure neither member owns.
 */
if (typeof window !== 'undefined') {
  console.log('[webguards] Module loaded');
}

export { default as CustomGuardRegistry } from './CustomGuardRegistry';
export { createDefaultGuardRegistry } from './CustomGuardRegistry';

// Re-export the guard-protocol vocabulary (#288) from one entry point, mirroring the validation
// re-exports: the provider contract, the region/event/decision surface, the decision guard, and the
// native-first default provider.
export {
  type CustomGuardProvider,
  type GuardRegion,
  type GuardRegionKind,
  type GuardEvent,
  type GuardContext,
  type GuardDecision,
  type GuardRevocationListener,
  NativeGuardProvider,
  GuardDecisionError,
  assertGuardDecision,
  ALLOW,
} from '../../guard/provider.js';
export { CustomGuardRegistry as StandaloneGuardRegistry, UnknownGuardProviderError } from '../../guard/registry.js';
