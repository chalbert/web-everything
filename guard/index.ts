/**
 * Default wiring for the Guard protocol seam (#288/#289). Builds the standalone registry pre-loaded
 * with the **native-first default provider** (permissive — no policy ⇒ allow) so a consumer gets a
 * working, swappable seam with one call and can `define()` a project override or custom provider on top.
 */
import { NativeGuardProvider } from './provider.js';
import { CustomGuardRegistry } from './registry.js';

export * from './provider.js';
export * from './registry.js';

/** A registry pre-loaded with the native-first default provider (the permissive default). */
export function createDefaultRegistry(): CustomGuardRegistry {
  const registry = new CustomGuardRegistry();
  registry.define(new NativeGuardProvider(), true); // native-first default
  return registry;
}
