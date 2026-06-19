/**
 * Self-Driven Project Artefact protocol — the **runtime-impl half** (#1026, slice #1071).
 *
 * The trust-boundary guards that validate the everything-as-code artefacts a foreign tool wrote before WE's
 * own loop drives them — the runtime that fulfils the contract. The pure-contract half (types/interfaces,
 * compile-erased) is its sibling `./contract.ts`, the future
 * `@webeverything/contracts/self-driven-project-artefact-contract` entry; the OPEN meta-schema registries
 * (autonomy ladder, tolerance dimensions) live in `./registry.ts`, the recipe-resolution driving loop in
 * `./driver.ts`, the default wiring in `./index.ts`. This file re-exports the contract surface
 * (`export type * from './contract.js'`) so importers reach the types and the runtime from one site — the
 * split is at the *file* seam, not the public surface (mirrors `guard/provider.ts`, `reliability/provider.ts`).
 *
 * A run is described by files a *conforming* tool reads and drives. Because that tool (or a hostile/buggy
 * one) writes those files, the contract is **trust-crossing**: every `ArtefactRef`, `GateDefinition`,
 * `Step`, and `ProcessRecipe` coming across is validated here so a malformed artefact is caught at the seam
 * (a thrown `ArtefactContractError`), never silently driving the loop with a bad shape.
 */
import type {
  ArtefactRef,
  GateDefinition,
  ProcessRecipe,
  Step,
  ToleranceLevel,
  ToleranceProfile,
} from './contract.js';

// Re-export the pure-contract surface so `./provider.js` importers reach the types and the runtime from
// one site (the split is at the file seam, see ./contract.ts).
export type * from './contract.js';

/** The closed set of artefact kinds — the only `ArtefactRef.kind` values the run layout locates. */
export const ARTEFACT_KINDS: readonly ArtefactRef['kind'][] = [
  'requirement',
  'step',
  'gate',
  'evidence',
  'decision',
];

/** The closed gate-severity set (a webcompliance concern the gate schema references). */
export const GATE_SEVERITIES: readonly GateDefinition['severity'][] = ['error', 'warning', 'info'];

/** The closed tolerance scale a `ToleranceProfile` may use per dimension. */
export const TOLERANCE_LEVELS: readonly ToleranceLevel[] = ['low', 'medium', 'high'];

/** An artefact / gate / step / recipe crossing the seam broke the contract (the only-lock contract broken). */
export class ArtefactContractError extends Error {
  constructor(what: string, why: string) {
    super(`${what} broke the artefact contract: ${why}`);
    this.name = 'ArtefactContractError';
  }
}

/**
 * Validate an `ArtefactRef` crossing the seam. The contract fixes that an artefact is **discoverable** (a
 * well-known `kind` + a `ref` locating it in the run layout) and **metadata-bearing** (light, opaque
 * front-matter). Throws `ArtefactContractError` on a bad shape; returns the value typed otherwise. The
 * `metadata` stays opaque to the seam — its keys are not constrained (most-flexible-default).
 */
export function assertArtefactRef(ref: unknown): ArtefactRef {
  if (typeof ref !== 'object' || ref === null) {
    throw new ArtefactContractError('ArtefactRef', `expected an object, got ${ref === null ? 'null' : typeof ref}`);
  }
  const { kind, ref: refPath, metadata } = ref as Record<string, unknown>;
  if (typeof kind !== 'string' || !ARTEFACT_KINDS.includes(kind as ArtefactRef['kind'])) {
    throw new ArtefactContractError('ArtefactRef', `\`kind\` must be one of ${ARTEFACT_KINDS.join(' | ')}, got ${String(kind)}`);
  }
  if (typeof refPath !== 'string' || refPath.length === 0) {
    throw new ArtefactContractError('ArtefactRef', `\`ref\` must be a non-empty string, got ${typeof refPath}`);
  }
  if (metadata !== undefined && (typeof metadata !== 'object' || metadata === null)) {
    throw new ArtefactContractError('ArtefactRef', `\`metadata\` must be an object when present, got ${typeof metadata}`);
  }
  const clean: ArtefactRef = { kind: kind as ArtefactRef['kind'], ref: refPath };
  if (metadata !== undefined) clean.metadata = metadata as Record<string, unknown>;
  return clean;
}

/**
 * Validate a `GateDefinition` crossing the seam. The binding shape only — `severity` / `scope` / the
 * expiring `waiver` are webcompliance + webpolicy concerns the schema *references*. A `waiver`, when
 * present, must carry an audited `reason` and an `until` (the expiry webcompliance enforces).
 */
export function assertGateDefinition(gate: unknown): GateDefinition {
  if (typeof gate !== 'object' || gate === null) {
    throw new ArtefactContractError('GateDefinition', `expected an object, got ${gate === null ? 'null' : typeof gate}`);
  }
  const { id, command, severity, scope, waiver } = gate as Record<string, unknown>;
  if (typeof id !== 'string' || id.length === 0) {
    throw new ArtefactContractError('GateDefinition', `\`id\` must be a non-empty string, got ${typeof id}`);
  }
  if (typeof command !== 'string' || command.length === 0) {
    throw new ArtefactContractError('GateDefinition', `\`command\` must be a non-empty string, got ${typeof command}`);
  }
  if (typeof severity !== 'string' || !GATE_SEVERITIES.includes(severity as GateDefinition['severity'])) {
    throw new ArtefactContractError('GateDefinition', `\`severity\` must be one of ${GATE_SEVERITIES.join(' | ')}, got ${String(severity)}`);
  }
  if (scope !== undefined && typeof scope !== 'string') {
    throw new ArtefactContractError('GateDefinition', `\`scope\` must be a string when present, got ${typeof scope}`);
  }
  if (waiver !== undefined) {
    if (typeof waiver !== 'object' || waiver === null) {
      throw new ArtefactContractError('GateDefinition', `\`waiver\` must be an object when present, got ${typeof waiver}`);
    }
    const { until, reason } = waiver as Record<string, unknown>;
    if (typeof until !== 'string' || until.length === 0) {
      throw new ArtefactContractError('GateDefinition', `\`waiver.until\` must be a non-empty string`);
    }
    if (typeof reason !== 'string' || reason.length === 0) {
      throw new ArtefactContractError('GateDefinition', `\`waiver.reason\` must be a non-empty string (waivers are audited)`);
    }
  }
  const clean: GateDefinition = { id, command, severity: severity as GateDefinition['severity'] };
  if (scope !== undefined) clean.scope = scope as string;
  if (waiver !== undefined) clean.waiver = waiver as GateDefinition['waiver'];
  return clean;
}

/**
 * Validate a `Step` crossing the seam. Composes webworkflows: `after` are the dependency edges, `gates` the
 * completion guards, `autonomyCeiling` the nominal cap, `final` a terminal marker. The referenced gate /
 * step ids are validated by the driver against the run's actual artefacts (cross-reference integrity, see
 * `./driver.ts`); this guard validates the *shape* only.
 */
export function assertStep(step: unknown): Step {
  if (typeof step !== 'object' || step === null) {
    throw new ArtefactContractError('Step', `expected an object, got ${step === null ? 'null' : typeof step}`);
  }
  const { id, after, gates, autonomyCeiling, final } = step as Record<string, unknown>;
  if (typeof id !== 'string' || id.length === 0) {
    throw new ArtefactContractError('Step', `\`id\` must be a non-empty string, got ${typeof id}`);
  }
  if (!Array.isArray(after) || after.some((a) => typeof a !== 'string')) {
    throw new ArtefactContractError('Step', `\`after\` must be an array of step-id strings`);
  }
  if (!Array.isArray(gates) || gates.some((g) => typeof g !== 'string')) {
    throw new ArtefactContractError('Step', `\`gates\` must be an array of gate-id strings`);
  }
  if (typeof autonomyCeiling !== 'string' || autonomyCeiling.length === 0) {
    throw new ArtefactContractError('Step', `\`autonomyCeiling\` must be a non-empty autonomy-level string`);
  }
  if (typeof final !== 'boolean') {
    throw new ArtefactContractError('Step', `\`final\` must be a boolean, got ${typeof final}`);
  }
  return { id, after: after as string[], gates: gates as string[], autonomyCeiling, final };
}

/**
 * Validate a `ProcessRecipe` crossing the seam — `config-extends-platform-default`. A recipe MUST name the
 * recipe it `extends` (`webprocess/default` for a top-level flavor), so a project recipe is always a flavor
 * on top, never authored from nothing. The override maps (`ceilings`, `gates`) and the `tolerance` dial are
 * optional; their values must be well-shaped when present.
 */
export function assertProcessRecipe(recipe: unknown): ProcessRecipe {
  if (typeof recipe !== 'object' || recipe === null) {
    throw new ArtefactContractError('ProcessRecipe', `expected an object, got ${recipe === null ? 'null' : typeof recipe}`);
  }
  const { extends: ext, ceilings, tolerance, gates } = recipe as Record<string, unknown>;
  if (typeof ext !== 'string' || ext.length === 0) {
    throw new ArtefactContractError('ProcessRecipe', `\`extends\` must name the recipe extended (config-extends-platform-default)`);
  }
  if (ceilings !== undefined && (typeof ceilings !== 'object' || ceilings === null)) {
    throw new ArtefactContractError('ProcessRecipe', `\`ceilings\` must be a step-id → autonomy-level map when present`);
  }
  if (tolerance !== undefined) assertToleranceProfile(tolerance);
  if (gates !== undefined) {
    if (typeof gates !== 'object' || gates === null) {
      throw new ArtefactContractError('ProcessRecipe', `\`gates\` must be a step-id → gate-id[] map when present`);
    }
    for (const [stepId, ids] of Object.entries(gates as Record<string, unknown>)) {
      if (!Array.isArray(ids) || ids.some((g) => typeof g !== 'string')) {
        throw new ArtefactContractError('ProcessRecipe', `\`gates["${stepId}"]\` must be an array of gate-id strings`);
      }
    }
  }
  const clean: ProcessRecipe = { extends: ext };
  if (ceilings !== undefined) clean.ceilings = ceilings as ProcessRecipe['ceilings'];
  if (tolerance !== undefined) clean.tolerance = tolerance as ToleranceProfile;
  if (gates !== undefined) clean.gates = gates as ProcessRecipe['gates'];
  return clean;
}

/**
 * Validate a `ToleranceProfile` — a tolerance level per dimension. The dimension keys are OPEN (a recipe
 * may dial a registered custom dimension), so keys are not constrained here; the *level* must be one of the
 * closed `low | medium | high` scale.
 */
export function assertToleranceProfile(profile: unknown): ToleranceProfile {
  if (typeof profile !== 'object' || profile === null) {
    throw new ArtefactContractError('ToleranceProfile', `expected an object, got ${profile === null ? 'null' : typeof profile}`);
  }
  for (const [dim, level] of Object.entries(profile as Record<string, unknown>)) {
    if (typeof level !== 'string' || !TOLERANCE_LEVELS.includes(level as ToleranceLevel)) {
      throw new ArtefactContractError('ToleranceProfile', `\`${dim}\` must be one of ${TOLERANCE_LEVELS.join(' | ')}, got ${String(level)}`);
    }
  }
  return profile as ToleranceProfile;
}
