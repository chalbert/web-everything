// @webeverything/contracts/explorer — the explorer result/output interchange contract (#1769, minted by #1747).
//
// Type-only (zero runtime emit): the serializable SHAPE any tool or CI consumes explorer output through, so a
// reader never depends on the closed Plateau explorer product (#1467 — WE keeps the CONTRACT, not the engine).
// The temporal rule (#1747) is satisfied by convergent external prior art — SARIF 2.1.0, axe-core JSON,
// Lighthouse JSON — so the core here is a **SARIF 2.1.0-compatible** result log (any SARIF tool reads it
// blind), and every WE-specific field rides in SARIF `properties` bags — SARIF's own, generic-tool-ignorable
// extension slot. WE owns ONLY this shape (+ the structural validator / serializer / JSON schema + the
// reference projector in the sibling `./schema`, the build-agnostic contract runtime, like
// `conformance-vectors/schema.ts`). The Plateau explorer's reportBundle EMITS to this shape; third-party
// tools READ it. Distinct from the conformance binding interface (#1596) — this is the report format, not the
// driver↔component seam.
//
// Self-contained by the contract rule (no imports — a code generator that has never seen this repo must read
// it): the SARIF 2.1.0 subset is declared inline below, matching the published SARIF schema.

// ── SARIF 2.1.0 core (the interchange any SARIF consumer reads) ──────────────────────────────────────

/** SARIF result severity. The explorer's `error`/`warn`/`advisory` map to `error`/`warning`/`note`. */
export type SarifLevel = 'error' | 'warning' | 'note' | 'none';

/** A SARIF physical location — the artifact (a URL/route/component path) + an optional region. */
export interface SarifLocation {
  readonly physicalLocation: {
    readonly artifactLocation: { readonly uri: string };
    readonly region?: { readonly startLine: number; readonly startColumn?: number };
  };
}

// ── WE extension slots (carried in SARIF `properties` — ignorable by a generic SARIF tool) ────────────

/** The explored-graph coverage summary the explorer reports for a run. */
export interface ExplorerCoverage {
  /** Distinct states reached. */
  readonly states: number;
  /** Distinct transitions exercised. */
  readonly edges: number;
  /** Fraction of the reachable graph covered, [0, 1]. */
  readonly coverage: number;
}

/** A conformance-vector linkage — the WE-specific tie from a finding to the standard clause(s) it violates. */
export interface ExplorerConformanceRef {
  /** The contract package the vectors belong to, e.g. `@webeverything/presentation-a11y`. */
  readonly contract: string;
  /** Conformance vector ids (`<standard>/<feature>/<case>`, from `conformance-vectors/schema.ts`). */
  readonly vectorIds: readonly string[];
}

/** A piece of evidence captured for a finding (a screenshot, a DOM/state snapshot, a trace ref). */
export interface ExplorerEvidence {
  readonly kind: 'screenshot' | 'snapshot' | 'trace' | 'log';
  /** A URI to the artifact (e.g. a bundle-relative path) or, for small inline evidence, the data itself. */
  readonly uri?: string;
  readonly data?: string;
}

/** The WE extension bag on a single result (SARIF `result.properties`). */
export interface ExplorerResultProperties {
  /** The oracle that raised the finding (e.g. `no-console-errors`) — also mirrored as the SARIF `ruleId`. */
  readonly oracle: string;
  /** The explored state the finding was observed in. */
  readonly stateId?: string;
  /** Evidence captured alongside the finding. */
  readonly evidence?: readonly ExplorerEvidence[];
  /** Conformance-vector linkage — which standard clause(s) the finding maps to. */
  readonly conformance?: ExplorerConformanceRef;
  /** Advisory confidence [0, 1] for LLM-judge findings; absent for deterministic oracles (never gates). */
  readonly confidence?: number;
}

/** The WE extension bag on a run (SARIF `run.properties`) — the run/coverage summary. */
export interface ExplorerRunProperties {
  /** The entry URL the run explored. */
  readonly url: string;
  /** The explored-graph coverage summary. */
  readonly coverage: ExplorerCoverage;
  /** ISO-8601 generation timestamp. */
  readonly generatedAt?: string;
  /** The WE extension-slot version (semver), independent of the SARIF core version. */
  readonly extensionVersion: string;
}

// ── The interchange (SARIF 2.1.0 shape, WE-extended) ──────────────────────────────────────────────────

/** One SARIF result — a finding, severity mapped to a SARIF `level`, WE fields in `properties`. */
export interface ExplorerResult {
  /** The oracle id (SARIF rule identifier). */
  readonly ruleId: string;
  readonly level: SarifLevel;
  readonly message: { readonly text: string };
  readonly locations?: readonly SarifLocation[];
  /** The WE extension bag — generic SARIF tools ignore it; WE-aware tools read oracle/evidence/conformance. */
  readonly properties: ExplorerResultProperties;
}

/** One SARIF run — the explorer's tool driver + its results + the WE run/coverage `properties`. */
export interface ExplorerRun {
  readonly tool: { readonly driver: { readonly name: string; readonly rules: readonly { readonly id: string }[] } };
  readonly results: readonly ExplorerResult[];
  readonly properties: ExplorerRunProperties;
}

/** The explorer interchange document — a SARIF 2.1.0 log any tool reads, WE-extended via `properties`. */
export interface ExplorerInterchange {
  readonly $schema: string;
  readonly version: '2.1.0';
  readonly runs: readonly ExplorerRun[];
}
