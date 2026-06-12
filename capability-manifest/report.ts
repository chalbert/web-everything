/**
 * Validation adherence report format (#269) — the **readable artifact** the build-time check (#267)
 * and the runtime guard (#268) emit. A capability diff is more than pass/fail: an implementation
 * declares a set of features, an app uses a set of features, and conformance is the *relationship*
 * between them. This module defines that relationship as a structured {@link AdherenceReport} plus a
 * plain-text {@link formatAdherenceReport} rendering, so a developer can see — at a glance — which
 * declared features the implementation actually backs in this app, which declared features go unused,
 * and which usages fell **out of capability** (used but not declared, #266's reportable case).
 *
 * Pure data → report; no I/O, no dev/prod gating (that is the guard's concern, #268). Consumes the
 * #266 model and the shared `outOfCapability` diff (#270) so the slices agree on one definition.
 */

import {
  missingCoreFeatures,
  type CapabilityManifest,
  type ConformanceLevel,
  type ValidationFeatureId,
} from './provider.js';
import { outOfCapability } from './fixtures.js';

/**
 * The relationship between what an implementation *declares* and what an app *uses*, partitioned into
 * the four meaningful buckets a reader cares about. `conformant` is true iff nothing was used out of
 * capability (the headline pass/fail), but the buckets carry the detail.
 */
export interface AdherenceReport {
  specVersion: string;
  conformanceLevel: ConformanceLevel;
  /** Everything the implementation declares it supports. */
  declared: ValidationFeatureId[];
  /** Everything the app exercises. */
  used: ValidationFeatureId[];
  /** Declared **and** used — the features the implementation actually backs for this app. */
  honoured: ValidationFeatureId[];
  /** Declared but **not** used — capability the app does not exercise (informational). */
  unused: ValidationFeatureId[];
  /** Used but **not** declared — the reportable out-of-capability usage (`used − declared`). */
  outOfCapability: ValidationFeatureId[];
  /** Core ids missing from an L1+ claim (#266 OP-18) — a manifest-level conformance defect. */
  missingCore: ValidationFeatureId[];
  /** True iff `outOfCapability` is empty (the headline pass/fail). */
  conformant: boolean;
}

/**
 * Build the adherence report for an implementation's `manifest` against the `usedFeatures` an app
 * exercises. Order-preserving against the inputs (declared order for declared-derived buckets, used
 * order for used-derived buckets) so the report is stable and diff-friendly.
 */
export function buildAdherenceReport(
  manifest: CapabilityManifest,
  usedFeatures: readonly ValidationFeatureId[],
): AdherenceReport {
  const usedSet = new Set(usedFeatures);

  const honoured = manifest.features.filter((f) => usedSet.has(f));
  const unused = manifest.features.filter((f) => !usedSet.has(f));
  const out = outOfCapability(manifest, usedFeatures);

  return {
    specVersion: manifest.specVersion,
    conformanceLevel: manifest.conformanceLevel,
    declared: [...manifest.features],
    used: [...usedFeatures],
    honoured,
    unused,
    outOfCapability: out,
    missingCore: missingCoreFeatures(manifest),
    conformant: out.length === 0,
  };
}

/** Strip the `validation.feature.` prefix for compact display; ids stay canonical in the data. */
function shortId(feature: ValidationFeatureId): string {
  return feature.replace(/^validation\.feature\./, '');
}

function renderBucket(label: string, ids: readonly ValidationFeatureId[]): string {
  if (ids.length === 0) return `  ${label}: —`;
  return `  ${label}: ${ids.map(shortId).join(', ')}`;
}

/**
 * Render an {@link AdherenceReport} as a readable plain-text block — the artifact form a build-time
 * check prints or a guard logs. Headline conformance line, then the four buckets, then any
 * manifest-level Core defect.
 */
export function formatAdherenceReport(report: AdherenceReport): string {
  const headline = report.conformant
    ? `✓ in capability`
    : `✗ ${report.outOfCapability.length} feature(s) out of capability`;

  const lines = [
    `Validation adherence — ${report.conformanceLevel} @ spec ${report.specVersion}: ${headline}`,
    renderBucket('honoured (declared & used)', report.honoured),
    renderBucket('unused  (declared, not used)', report.unused),
    renderBucket('out of capability (used, not declared)', report.outOfCapability),
  ];

  if (report.missingCore.length > 0) {
    lines.push(
      `  ⚠ manifest defect: ${report.conformanceLevel} claim missing Core feature(s): ` +
        report.missingCore.map(shortId).join(', '),
    );
  }

  return lines.join('\n');
}
