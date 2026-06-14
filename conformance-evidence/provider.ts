/**
 * Conformance-evidence manifest — the standard-owned contract for the machine-readable conformance
 * evidence a bot-PR carries (#599, ratifying #578 Fork 2-A). An **app-emits / tool-consumes** contract:
 * the app's introspectable self-description / trace substrate emits this manifest; the Plateau dev-browser
 * *renders* it into the PR body. The **same shape #575's source-anchor contract took** — a
 * self-description extension **contract**, deliberately **not a Protocol** (no swappable-vendor interop
 * beyond emit/consume — minimize lock-in), reusing the capability-manifest's `specVersion` vocabulary.
 *
 * It carries the three facts the PR evidence needs and the audit record (#410-4A: who/when/diff/revert)
 * does **not**: **which gates ran**, the **verify before/after** (the propose-and-verify edge — the
 * conformance state before the fix vs after), and the **autonomy level** the loop acted at (#141 ladder).
 * Built as a **sibling** of the audit-record substrate (separation bias), not a field-set on it.
 *
 * Runtime-agnostic: a polyglot/enterprise fix-loop (a .NET/Java conformance runner) emits the *same*
 * manifest — the forward-adapter reach. PURE — no fs, no process, no `Date`; the caller stamps `emittedAt`.
 */

/** The current conformance-evidence manifest spec version (reuses the capability-manifest semver scheme). */
export const CONFORMANCE_EVIDENCE_SPEC_VERSION = '1.0.0';

/**
 * The autonomy level the fix-loop acted at — the #141 Fork 2 ladder (ratified default = open-PR). `suggest`
 * surfaces the fix without acting; `open-pr` opens a PR for human review (the default); `auto-merge` lands
 * it unattended (reachable only behind the #410 authorization dial). Ordered by escalating autonomy.
 */
export type AutonomyLevel = 'suggest' | 'open-pr' | 'auto-merge';

export const AUTONOMY_LEVELS: readonly AutonomyLevel[] = ['suggest', 'open-pr', 'auto-merge'];

/** One gate the loop ran, with its outcome — the "which gates ran" half of the evidence. */
export interface GateRun {
  /** Gate id — e.g. `check:standards`, a conformance-suite id, a test command. */
  gate: string;
  /** Whether the gate passed on this run. */
  passed: boolean;
  /** Optional human-readable detail (error count, failing rule, …). */
  detail?: string;
}

/** A single side of the verify gate — the conformance state at one point in time. */
export interface VerifyState {
  /** Whether the conformance suite was green at this point. */
  passed: boolean;
  /** Optional summary (e.g. `3 errors`, `0 errors`). */
  summary?: string;
}

/**
 * The verify before/after — the propose-and-verify moat (#089): the conformance state **before** the fix
 * vs **after** it. A successful fix is `before.passed === false && after.passed === true`.
 */
export interface VerifyEvidence {
  before: VerifyState;
  after: VerifyState;
}

/** Who emitted the evidence — the introspectable self-description anchor (app / impl / commit). */
export interface EvidenceSubject {
  /** The app or runner that emitted this manifest. */
  app: string;
  /** The implementation under conformance (optional — a capabilityMatrix impl id). */
  impl?: string;
  /** The commit the evidence was produced against (provenance). */
  commit?: string;
}

/** The standard-owned conformance-evidence manifest a bot-PR carries (app emits, Plateau renders). */
export interface ConformanceEvidenceManifest {
  /** Semver of this manifest shape — additive → minor, removal → major (capability-manifest scheme). */
  specVersion: string;
  subject: EvidenceSubject;
  /** Which gates ran (and their outcomes). */
  gates: GateRun[];
  /** The verify before/after — the propose-and-verify edge. */
  verify: VerifyEvidence;
  /** The autonomy level the loop acted at (#141 ladder). */
  autonomy: AutonomyLevel;
  /** Provenance — ISO-8601 emit time. Optional and caller-stamped (this module is `Date`-free). */
  emittedAt?: string;
}

/** The inputs a fix-loop hands {@link buildConformanceEvidence} — the manifest minus the derived spec version. */
export interface ConformanceEvidenceInput {
  subject: EvidenceSubject;
  gates: GateRun[];
  verify: VerifyEvidence;
  autonomy: AutonomyLevel;
  emittedAt?: string;
}

/**
 * Assemble a well-formed manifest from a loop's inputs, stamping the current {@link CONFORMANCE_EVIDENCE_SPEC_VERSION}.
 * Pure — no clock; the caller passes `emittedAt` if it wants provenance.
 */
export function buildConformanceEvidence(input: ConformanceEvidenceInput): ConformanceEvidenceManifest {
  return {
    specVersion: CONFORMANCE_EVIDENCE_SPEC_VERSION,
    subject: input.subject,
    gates: input.gates,
    verify: input.verify,
    autonomy: input.autonomy,
    ...(input.emittedAt ? { emittedAt: input.emittedAt } : {}),
  };
}

/**
 * Whether the evidence shows a real fix landed: the conformance suite was failing **before** and is green
 * **after** (the propose-and-verify success signal). A manifest where `after.passed` is false should never
 * back an auto-merge — the verify gate is the moat.
 */
export function isConformanceImproved(manifest: ConformanceEvidenceManifest): boolean {
  return manifest.verify.before.passed === false && manifest.verify.after.passed === true;
}

/** A structural validation finding. */
export interface EvidenceValidation {
  valid: boolean;
  errors: string[];
}

/**
 * Validate a manifest's structural integrity — present subject, a known spec version, at least one gate, a
 * complete verify before/after, and a recognized autonomy level. A tool that consumes the evidence calls
 * this before rendering / trusting it; it checks shape, not the truth of the gates (that is the emitter's).
 */
export function validateConformanceEvidence(manifest: ConformanceEvidenceManifest): EvidenceValidation {
  const errors: string[] = [];
  if (manifest.specVersion !== CONFORMANCE_EVIDENCE_SPEC_VERSION) {
    errors.push(`unknown specVersion "${manifest.specVersion}" (expected ${CONFORMANCE_EVIDENCE_SPEC_VERSION})`);
  }
  if (!manifest.subject || !manifest.subject.app) errors.push('subject.app is required');
  if (!Array.isArray(manifest.gates) || manifest.gates.length === 0) errors.push('at least one gate run is required');
  if (!manifest.verify || !manifest.verify.before || !manifest.verify.after) errors.push('verify.before and verify.after are required');
  if (!AUTONOMY_LEVELS.includes(manifest.autonomy)) errors.push(`unknown autonomy level "${manifest.autonomy}"`);
  return { valid: errors.length === 0, errors };
}
