/**
 * Runtime dev-mode capability guard (#268) — the **runtime sibling** of the build-time adherence
 * check (#267). Where the build-time tool diffs *statically-declared* feature usage against an
 * implementation's manifest, this guard does the same diff **at runtime**, at the moment a validation
 * feature is actually exercised, and warns when usage exceeds the active implementation's declared
 * capabilities (#266). Partial compliance is first-class (#266): an implementation may legitimately
 * omit `async`/`schema`/etc., but using an omitted feature must be *surfaced*, never a silent no-op —
 * this guard is that surface in dev.
 *
 * **Dev-only, stripped in prod.** The `console.warn` side effect is gated on
 * `process.env.NODE_ENV !== 'production'`, so a production bundle dead-code-eliminates the warning
 * path entirely — the guard adds no prod noise and effectively no prod cost. The cheap capability
 * *diff* (a `features[].includes`) still returns its boolean so a caller may branch on it if it wants,
 * but the guard's reason for existing is the dev warning.
 *
 * Independent of the build-time tool (#267) and the report format (#269): it reuses the shared
 * `outOfCapability` diff (#270) and the #266 model, nothing else.
 */

import {
  isCapabilityManifest,
  manifestSupports,
  type CapabilityManifest,
  type ValidationFeatureId,
} from './provider.js';
import { outOfCapability } from './fixtures.js';

const isDev = (): boolean => process.env.NODE_ENV !== 'production';

/** Warn-once memo so an out-of-capability feature does not spam the console on every use. */
const warned = new Set<string>();

function warnOnce(key: string, message: string): void {
  if (warned.has(key)) return;
  warned.add(key);
  // eslint-disable-next-line no-console
  console.warn(message);
}

/** Clear the warn-once memo — for tests that assert repeated-warning suppression. */
export function __resetCapabilityGuardWarnings(): void {
  warned.clear();
}

/**
 * Guard a single feature use against the active implementation's manifest. Returns `true` when
 * `feature` is **out of capability** (used but not declared). In dev, emits a one-time `console.warn`
 * naming the feature and the implementation's claimed conformance level; in prod the warning is
 * stripped. A malformed manifest is itself flagged (in dev) and treated as supporting nothing.
 */
export function guardCapability(manifest: CapabilityManifest, feature: ValidationFeatureId): boolean {
  if (!isCapabilityManifest(manifest)) {
    if (isDev()) {
      warnOnce(
        `__bad_manifest__:${feature}`,
        `[capability-guard] active implementation exposes no valid capability manifest; ` +
          `cannot verify use of "${feature}". Publish a conformant manifest (#266).`,
      );
    }
    return true;
  }

  if (manifestSupports(manifest, feature)) return false;

  if (isDev()) {
    warnOnce(
      `${manifest.specVersion}|${manifest.conformanceLevel}|${feature}`,
      `[capability-guard] validation feature "${feature}" is used but NOT declared by the active ` +
        `implementation (conformanceLevel ${manifest.conformanceLevel}, specVersion ` +
        `${manifest.specVersion}). It may be a silent no-op — install an implementation that declares ` +
        `"${feature}", or stop using it.`,
    );
  }
  return true;
}

/**
 * Bulk variant: guard a set of used features at once and return the out-of-capability subset (each
 * warned once in dev). Convenience over mapping {@link guardCapability} when a surface reports all the
 * features it touched up front.
 */
export function guardCapabilities(
  manifest: CapabilityManifest,
  features: readonly ValidationFeatureId[],
): ValidationFeatureId[] {
  if (!isCapabilityManifest(manifest)) {
    // Defer to the single-feature path so each feature gets the malformed-manifest warning.
    return features.filter((f) => guardCapability(manifest, f));
  }
  const out = outOfCapability(manifest, features);
  if (isDev()) {
    for (const f of out) {
      warnOnce(
        `${manifest.specVersion}|${manifest.conformanceLevel}|${f}`,
        `[capability-guard] validation feature "${f}" is used but NOT declared by the active ` +
          `implementation (conformanceLevel ${manifest.conformanceLevel}, specVersion ` +
          `${manifest.specVersion}). It may be a silent no-op — install an implementation that declares ` +
          `"${f}", or stop using it.`,
      );
    }
  }
  return out;
}
