/**
 * Default wiring for the Error Recovery protocol seam (#1019/#1052). Builds the standalone
 * `customRecovery` registry — **empty**, because the protocol ships no built-in handlers (ratified
 * design: HTTP retry / circuit breaker / offline queue are impl the consuming project registers). A
 * consumer gets a working, swappable seam with one call and `define()`s its handlers on top, in the
 * priority order it wants.
 */
import { CustomRecoveryHandlerRegistry } from './registry.js';

export * from './provider.js';
export * from './registry.js';

/**
 * A fresh, empty recovery registry. Unlike the guard plane there is no native-first default handler to
 * pre-load (the protocol ships none); `recover()` returns `null` until the consumer `define()`s handlers.
 */
export function createDefaultRegistry(): CustomRecoveryHandlerRegistry {
  return new CustomRecoveryHandlerRegistry();
}
