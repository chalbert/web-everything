/**
 * Analytics protocol — the **runtime-impl half** (#1003, slice #1012).
 *
 * The **native-first no-op default tracker** — the runtime that fulfils the contract when no real
 * backend is wired. The pure-contract half (types/interfaces, compile-erased) is its sibling
 * `./contract.ts`, the future `@webeverything/contracts/analytics` entry; the registry that swaps
 * backends is the runtime `customTrackers` plug (`plugs/webanalytics/`). This file re-exports the
 * contract surface (`export type * from './contract.js'`) so importers reach types and runtime from one
 * site — the split is at the *file* seam, not the public surface (mirrors `guard/provider.ts`).
 *
 * The native-first floor is **silent**: with no project override, every call is dropped (telemetry is
 * advisory, so "no backend" must degrade to a no-op, never an error). A project swaps in a real backend
 * via the plug registry's `define()`.
 */
import type {
  AnalyticsProperties,
  AnalyticsTraits,
  CustomAnalyticsOptions,
  CustomTracker,
} from './contract.js';

// Re-export the pure-contract surface so `./provider.js` importers reach the types and the runtime from
// one site (the split is at the file seam, see ./contract.ts).
export type * from './contract.js';

/**
 * The native-first default backend: every method is a **no-op** (analytics with no configured provider
 * drops calls silently). Swapped out the moment a project `define()`s a real `CustomTracker`.
 */
export class NoopTracker implements CustomTracker {
  readonly key = 'noop';

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  identify(_userId: string, _traits?: AnalyticsTraits, _options?: CustomAnalyticsOptions): void {}
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  track(_event: string, _properties?: AnalyticsProperties, _options?: CustomAnalyticsOptions): void {}
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  page(_category?: string, _name?: string, _properties?: AnalyticsProperties, _options?: CustomAnalyticsOptions): void {}
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  group(_groupId: string, _traits?: AnalyticsTraits, _options?: CustomAnalyticsOptions): void {}
}
