/**
 * Self-Driven Project Artefact protocol — the **pure-contract half** (#1026, slice #1070).
 *
 * Types and interfaces only: this module is fully **compile-erased** (no runtime emit) so it can become
 * the `@webeverything/contracts/self-driven-project-artefact-contract` entry (#872/#874) that FUI depends
 * on (the FUI→WE arrow), superseding byte-replication — exactly like `guard/contract.ts`. The runtime
 * half — the driving loop, the meta-schema registries, the default-recipe resolution, and the Plateau
 * recipe configurator — is impl and lives in FUI / plateau-app; only the contract crosses the seam (npm
 * scope mirrors layer).
 *
 * The contract fixes **one seam**: a portable, declarative, everything-as-code artefact structure that
 * binds the SDLC together (autonomy + value/risk-ODD + gates + evidence + steps), and nothing else. A run
 * is described by files; a conforming tool (WE's own loop, or a foreign PM/CI tool) reads them, drives the
 * work, and appends evidence — GitOps for the *methodology*, OSCAL-posture for the gate/evidence half,
 * SPDX-style escapability. This is a genuine Protocol — a tool-agnostic interchange schema independent
 * tools conform to, per the Project/Protocol bar (#672 / #690 design, spec report
 * `we:reports/2026-06-15-self-driven-project-artefact-contract-spec.md`).
 *
 * It standardizes the *shape* via **four composable meta-schemas**, each with a default flavor a recipe
 * extends. Two are NEW and owned here (autonomy ladder, value/risk-ODD dial); two **compose** existing
 * standards and are referenced, not re-defined (gate → webcompliance + webpolicy; step → webworkflows).
 * Records the contract references (requirements #100, run-evidence webaudit, human-handoff webdecisions)
 * are composed, never owned. Domain-general (no hard-coded "web"); web apps are the first consumer.
 */

// ── Meta-schema 1: Autonomy-level registry — NEW (a vocabulary, OPEN) ───────────────────────────────

/**
 * The default SAE-style autonomy ladder — how much an agent may do unattended, per step. This is the
 * **default flavor**, not a closed list: `AutonomyLevel` stays open so a project's recipe can add levels.
 */
export type DefaultAutonomyLevel =
  | 'L0' // report-only — observe + report; never mutate
  | 'L1' // propose — draft a change for human review; never apply
  | 'L2' // live-verify — apply in a sandbox and verify; never land
  | 'L3' // open-PR — land on a branch + open a PR for human merge
  | 'L4' // auto-merge — merge once gates pass, no human in the loop
  | 'L5'; // live-patch — patch a running system within the tolerance envelope

/**
 * An autonomy level — an OPEN registry. The default ladder (`DefaultAutonomyLevel`) is the shipped flavor;
 * a project recipe may register more. The `string & {}` keeps the union open while preserving the
 * default-flavor autocomplete (the same open-vocabulary pattern as the Permission intent's `PermissionName`).
 */
export type AutonomyLevel = DefaultAutonomyLevel | (string & {});

// ── Meta-schema 2: Value/risk-ODD dimension registry — NEW (the organizing model, OPEN) ─────────────

/**
 * The default tolerance dimensions — the quality/risk dial whose per-step tolerance throttles the
 * autonomy ceiling (the operational-design-domain idea, borrowed from autonomous driving: autonomy is
 * permitted only inside the domain the tolerance defines). Default flavor; the registry is OPEN.
 */
export type DefaultToleranceDimension = 'correctness' | 'security' | 'blast-radius' | 'reversibility';

/** A tolerance dimension — OPEN registry; the default set is `DefaultToleranceDimension`. */
export type ToleranceDimension = DefaultToleranceDimension | (string & {});

/** The tolerance scale for a dimension. */
export type ToleranceLevel = 'low' | 'medium' | 'high';

/** A per-step tolerance profile: a tolerance level per dimension. The recipe maps this → an autonomy ceiling. */
export type ToleranceProfile = Partial<Record<ToleranceDimension, ToleranceLevel>>;

// ── Meta-schema 3: Gate-definition schema — COMPOSED (webcompliance + webpolicy) ────────────────────

/**
 * A machine-checkable gate. `severity` / `scope` / expiring `waiver` / audit are **webcompliance +
 * webpolicy** concerns the schema *references*, not re-invents — this is the binding shape only.
 */
export interface GateDefinition {
  id: string;
  /** The command whose exit status is the pass/fail. */
  command: string;
  /** webcompliance severity — gate-blocking when `error`. */
  severity: 'error' | 'warning' | 'info';
  /** The scope the gate applies to (e.g. `code`, `docs`) — a webcompliance concern. */
  scope?: string;
  /** An expiring waiver (webcompliance) — suppresses the gate until `until`, with an audited `reason`. */
  waiver?: { until: string; reason: string };
}

// ── Meta-schema 4: Step schema — COMPOSED (webworkflows) ────────────────────────────────────────────

/**
 * A step in the directed SDLC progression `design → code → test → ship → monitor → upgrade`. Composes the
 * **webworkflows** orchestration graph (the SDLC is another instance of the same machinery): `after`
 * encodes the dependency edges, `gates` the completion guards, `autonomyCeiling` the nominal cap (a
 * tolerance profile may throttle it lower), `final` marks a terminal step.
 */
export interface Step {
  id: string;
  /** Step ids that must complete first — the webworkflows dependency edges. */
  after: string[];
  /** Gate ids that guard completion. */
  gates: string[];
  /** Nominal autonomy ceiling — the tolerance dial may cap it lower per the recipe. */
  autonomyCeiling: AutonomyLevel;
  /** Whether this is a terminal step. */
  final: boolean;
}

// ── The artefact structure + the default recipe ─────────────────────────────────────────────────────

/**
 * A reference to a discoverable, metadata-bearing artefact in the everything-as-code run layout
 * (`runs/<run-id>/{requirements,steps,gates,evidence,decisions}/*`). The contract fixes that artefacts
 * are **discoverable** (well-known locations / a manifest) and **metadata-bearing** (enough front-matter
 * to be selected, ordered, audited), and that they **reference** the composed standards (requirements
 * #100, evidence webaudit, decisions webdecisions) rather than re-defining them — requirement structure
 * stays light (most-flexible-default).
 */
export interface ArtefactRef {
  /** The well-known kind locating the artefact in the run layout. */
  kind: 'requirement' | 'step' | 'gate' | 'evidence' | 'decision';
  /** Path / id discoverable within the run. */
  ref: string;
  /** Light front-matter metadata — enough to select, order, and audit. Opaque to the seam. */
  metadata?: Record<string, unknown>;
}

/**
 * A process recipe — `config-extends-platform-default`. The node ships **one fully-defined default
 * recipe** (`webprocess/default`) so a project's recipe is a flavor on top, never authored from nothing:
 * it overrides autonomy ceilings, the tolerance dial, and gate selections per step. WE's own
 * dev-lifecycle config is exactly such a flavor (a dogfooded consumer, never part of the standard).
 */
export interface ProcessRecipe {
  /** The recipe this one extends — `webprocess/default` for the shipped flavor. */
  extends: string;
  /** Per-step autonomy ceiling overrides. */
  ceilings?: Record<string, AutonomyLevel>;
  /** The tolerance dial — caps the autonomy ceiling per dimension. */
  tolerance?: ToleranceProfile;
  /** Per-step gate selections (gate ids). */
  gates?: Record<string, string[]>;
}
