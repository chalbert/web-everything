/**
 * Build-time `check:validation-adherence` (#267) — the static, fail-the-build sibling of the runtime
 * dev-mode guard (#268). Where the guard *warns* in dev when a used validation feature is not declared
 * by the active implementation's manifest, this check runs at build/CI time over the shipped
 * implementation manifests and **fails** on the same condition — so an out-of-capability usage (a
 * feature exercised that the implementation doesn't declare) surfaces as a red gate rather than a
 * silent runtime no-op (#266's reportable case).
 *
 * Pure data → findings; no I/O here (the CLI/test layer owns process exit + printing). The model
 * (#266), the adherence report format (#269), and the `assertCapabilityManifest` contract are the
 * single source — this module adds only the aggregation + pass/fail decision, never a second copy of
 * the vocabulary or the diff.
 */

import {
  assertCapabilityManifest,
  ManifestContractError,
  type CapabilityManifest,
  type ValidationFeatureId,
} from './provider.js';
import { buildAdherenceReport, formatAdherenceReport, type AdherenceReport } from './report.js';

/**
 * One implementation under check: a label, the value it exports as its manifest (statically inspected,
 * so possibly malformed — that is itself a finding), and the validation features the app/usage corpus
 * exercises against it.
 */
export interface AdherenceInput {
  name: string;
  manifest: unknown;
  usedFeatures: readonly ValidationFeatureId[];
}

/**
 * - `malformed-manifest` — the declared value is not a contract-valid {@link CapabilityManifest}. This
 *   also covers an L1+ claim missing a Core feature (#266 OP-18), which `assertCapabilityManifest`
 *   rejects, so the check never has to re-encode the Core rule.
 * - `out-of-capability` — the app used feature(s) the (valid) manifest does not declare (`used −
 *   declared`). The headline reportable case.
 */
export type FindingKind = 'malformed-manifest' | 'out-of-capability';

export interface CheckFinding {
  name: string;
  kind: FindingKind;
  detail: string;
  features?: ValidationFeatureId[];
}

export interface AdherenceCheckResult {
  /** How many implementations were inspected. */
  checked: number;
  /** Per-(valid-manifest) adherence report, in input order. */
  reports: { name: string; report: AdherenceReport }[];
  findings: CheckFinding[];
  /** True iff there are no findings — the build-gate pass/fail. */
  ok: boolean;
}

/**
 * Run the adherence check over a set of implementations. A malformed manifest is recorded and that
 * implementation is skipped (you cannot diff usage against a manifest that isn't contract-valid); a
 * valid manifest is diffed against its used features and any out-of-capability usage is recorded.
 */
export function runAdherenceCheck(inputs: readonly AdherenceInput[]): AdherenceCheckResult {
  const findings: CheckFinding[] = [];
  const reports: { name: string; report: AdherenceReport }[] = [];

  for (const input of inputs) {
    let manifest: CapabilityManifest;
    try {
      manifest = assertCapabilityManifest(input.manifest);
    } catch (error) {
      findings.push({
        name: input.name,
        kind: 'malformed-manifest',
        detail: error instanceof ManifestContractError ? error.message : String(error),
      });
      continue;
    }

    const report = buildAdherenceReport(manifest, input.usedFeatures);
    reports.push({ name: input.name, report });

    if (report.outOfCapability.length > 0)
      findings.push({
        name: input.name,
        kind: 'out-of-capability',
        detail: `used ${report.outOfCapability.length} feature(s) the manifest does not declare`,
        features: report.outOfCapability,
      });
  }

  return { checked: inputs.length, reports, findings, ok: findings.length === 0 };
}

/**
 * The shipped validation **implementation** manifests this build gate checks — the real impls, each
 * paired with the features the app exercises against it. Intentionally **empty today**: no
 * implementation yet exports a `manifest` (per #266's static-export convention, `MANIFEST_EXPORT_NAME`)
 * with a declared usage corpus, so the gate currently passes vacuously. The seam to make it bite: when
 * an implementation ships `export const manifest`, add `{ name, manifest, usedFeatures }` here and the
 * check enforces adherence at build time. (The #270 partial-implementation fixtures are *test*
 * scenarios — several are out-of-capability by design — so they drive {@link runAdherenceCheck}'s unit
 * coverage, not this gate corpus.)
 */
export const IMPLEMENTATION_MANIFESTS: readonly AdherenceInput[] = [];

/** Render an {@link AdherenceCheckResult} as the readable block the CLI/test prints. */
export function formatCheckResult(result: AdherenceCheckResult): string {
  const headline = result.ok
    ? `✓ validation adherence — ${result.checked} implementation(s) checked, all in capability`
    : `✗ validation adherence — ${result.findings.length} finding(s) across ${result.checked} implementation(s) checked`;

  const lines: string[] = [headline];

  for (const { name, report } of result.reports) {
    lines.push('', `▸ ${name}`, formatAdherenceReport(report));
  }

  if (result.findings.length > 0) {
    lines.push('', 'Findings:');
    for (const finding of result.findings) {
      const feats = finding.features?.length ? `: ${finding.features.join(', ')}` : '';
      lines.push(`  ✗ [${finding.kind}] ${finding.name} — ${finding.detail}${feats}`);
    }
  }

  return lines.join('\n');
}
