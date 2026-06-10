/**
 * Runtime feature-detection venue (#208) — the most accurate provider, for the `runtime` venue
 * (unknown targets, no infra). It tiers each capability by testing the **actual UA** rather than
 * reading the static matrix: `CSS.supports(...)`, `'popover' in HTMLElement.prototype`, and the like.
 *
 * It is just a {@link DegradingProvider} (see `venues.ts`) whose {@link PlatformSupport} signal comes
 * from live feature tests. The static matrix (#204) supplies each impl's *architectural ceiling*; the
 * live UA tells us whether the native feature is actually present, and `degrade` lowers the ceiling
 * accordingly. **Where a capability isn't runtime-detectable, the detector returns `undefined` and the
 * tier falls back to the static matrix** — exactly the scope's requirement.
 *
 * The detectors are injectable: the default reads the real browser, but tests (and any deterministic
 * POC) pass a fixed support map, so the venue is provable without a real UA.
 */
import type { Capability } from './provider.js';
import type { CapabilityProvider } from './provider.js';
import { DegradingProvider, type PlatformSupport } from './venues.js';

/** Run a feature test, treating a missing global / thrown access as "not knowable" (`undefined`). */
function probe(test: () => boolean): boolean | undefined {
  try {
    return test();
  } catch {
    return undefined; // the API surface isn't there to test → fall back to the static matrix
  }
}

/** `CSS.supports(cond)` guarded for non-browser environments (returns `undefined` when unavailable). */
function cssSupports(cond: string): boolean | undefined {
  return typeof CSS !== 'undefined' && typeof CSS.supports === 'function'
    ? probe(() => CSS.supports(cond))
    : undefined;
}

/** True only inside a DOM environment — guards the prototype-sniffing detectors. */
function hasDom(): boolean {
  return typeof globalThis !== 'undefined' && typeof (globalThis as { document?: unknown }).document !== 'undefined';
}

/**
 * Live feature detection per capability id. Each returns `true`/`false` when the UA can be tested, or
 * `undefined` when the feature isn't runtime-detectable (→ the tier falls back to the static matrix).
 * The map keys are capability ids from `capabilities.json`; an id absent here is treated as undetectable.
 *
 * `cross-root-aria` is deliberately omitted: the gap lives in the a11y tree, which JS cannot probe — it
 * is the canonical "not runtime-detectable, fall back to the matrix" case.
 */
export const BROWSER_DETECTORS: Record<string, () => boolean | undefined> = {
  dialog: () => (hasDom() ? probe(() => typeof HTMLDialogElement !== 'undefined') : undefined),
  'request-submit': () =>
    hasDom() ? probe(() => 'requestSubmit' in HTMLFormElement.prototype) : undefined,
  showpicker: () => (hasDom() ? probe(() => 'showPicker' in HTMLInputElement.prototype) : undefined),
  face: () => (hasDom() ? probe(() => 'attachInternals' in HTMLElement.prototype) : undefined),
  'user-pseudos': () => cssSupports('selector(:user-valid)'),
  'declarative-shadow-dom': () =>
    hasDom() ? probe(() => 'shadowRootMode' in HTMLTemplateElement.prototype) : undefined,
  popover: () => (hasDom() ? probe(() => 'popover' in HTMLElement.prototype) : undefined),
  'custom-state': () =>
    hasDom() ? probe(() => typeof (globalThis as { CustomStateSet?: unknown }).CustomStateSet !== 'undefined') : undefined,
  'anchor-positioning': () => cssSupports('anchor-name: --x'),
  invokers: () => (hasDom() ? probe(() => 'commandForElement' in HTMLButtonElement.prototype) : undefined),
  'field-sizing': () => cssSupports('field-sizing: content'),
  'dialog-closedby': () => (hasDom() ? probe(() => 'closedBy' in HTMLDialogElement.prototype) : undefined),
  'customizable-select': () => cssSupports('appearance: base-select'),
  // 'cross-root-aria' — omitted on purpose: not runtime-detectable, so it falls back to the static matrix.
};

/**
 * A {@link PlatformSupport} backed by live feature detection — the runtime venue's signal source. Runs
 * the matching {@link BROWSER_DETECTORS} entry; an id with no detector (or an undetectable feature)
 * yields `undefined`, so `degrade` leaves that capability on its static-matrix tier.
 */
export function browserFeatureSupport(
  detectors: Record<string, () => boolean | undefined> = BROWSER_DETECTORS,
): PlatformSupport {
  return (capabilityId) => detectors[capabilityId]?.();
}

/**
 * Build the runtime-venue provider: the architectural-ceiling base (the static matrix, #204) degraded
 * by live feature detection. Pass a `support` override to drive it from a fixed map (tests / a
 * deterministic POC) instead of the real UA.
 */
export function createRuntimeProvider(
  base: CapabilityProvider,
  vocabulary: Capability[],
  support: PlatformSupport = browserFeatureSupport(),
): DegradingProvider {
  return new DegradingProvider(base, support, vocabulary);
}
