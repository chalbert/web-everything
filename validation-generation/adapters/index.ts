/**
 * The shipped validation-generation adapters (#085 slices B–E) and a factory that registers them all
 * into a {@link ../registry.CustomValidationAdapterRegistry}. The foundation's
 * `createValidationAdapterRegistry()` is empty by design; this barrel is where the concrete emitters
 * are collected as each slice lands, native-first (the native-HTML adapter is the default).
 */
import { CustomValidationAdapterRegistry } from '../registry.js';
import { nativeHtmlAdapter } from './nativeHtml.js';
import { zodAdapter } from './zod.js';
import { pydanticAdapter } from './pydantic.js';
import { jsonSchemaAdapter } from './jsonSchema.js';

export { nativeHtmlAdapter } from './nativeHtml.js';
export { zodAdapter } from './zod.js';
export { pydanticAdapter } from './pydantic.js';
export { jsonSchemaAdapter } from './jsonSchema.js';

/** Every adapter shipped so far, native-first (the native-HTML adapter leads + is the default). */
export const SHIPPED_VALIDATION_ADAPTERS = [nativeHtmlAdapter, zodAdapter, pydanticAdapter, jsonSchemaAdapter];

/**
 * A registry preloaded with every shipped adapter; the native-HTML adapter is the native-first
 * default. The per-language slices add their adapter to {@link SHIPPED_VALIDATION_ADAPTERS} as they
 * land, so this factory grows without its callers changing.
 */
export function createDefaultValidationAdapterRegistry(): CustomValidationAdapterRegistry {
  const registry = new CustomValidationAdapterRegistry();
  for (const adapter of SHIPPED_VALIDATION_ADAPTERS) registry.define(adapter);
  return registry;
}
