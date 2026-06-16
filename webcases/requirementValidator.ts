/**
 * @file webcases/requirementValidator.ts
 * @description Requirement-as-code **slice A** (backlog #100): the typed requirement meta-schema plus a
 *   deterministic, dependency-free slot validator. Ratified format = #714 Fork 1 (d): an EARS-style
 *   constrained grammar over a Given/When/Then skeleton where **every slot is a typed reference into a
 *   registry that already exists in the tree**. That typed binding is the ground truth generic BDD lacks —
 *   a requirement naming a nonexistent intent dimension, semantic term, or protocol fails *at author time*,
 *   not at test time.
 *
 * Pure resolver, the `webcases/driftCheck.ts` pattern: the registries it resolves against are **injected**,
 * never imported. That keeps the core free of build-time `_data` coupling and — crucially — keeps the
 * governance **persona roster** a no-leakage injected input (#475): the roster is plateau-app-owned
 * (#141/#166), so this WE-resident validator accepts it as a parameter rather than depending on it.
 *
 * Grounding coverage today: `role` (against the injected roster), `given.{intent,dimension,value}`
 * (intents.json), `when.event` (semantics.json term), `then.protocol` (protocols.json id), and `then.tier`
 * (the fixed conformance-tier vocabulary) all ground **hard** (an unresolved reference is an `error`).
 * `then.observe` has no registry yet — protocols.json does not model observable states — so it grounds to
 * an `info` finding rather than a hard error; minting an observable registry is a separate future artifact.
 */

/** The fixed WE conformance-tier vocabulary a `then` outcome is asserted at. */
export const CONFORMANCE_TIERS = ['L1', 'L2', 'L3'] as const;
export type ConformanceTier = (typeof CONFORMANCE_TIERS)[number];

/**
 * The typed requirement record — the authored source (#714's worked example shape). Authors write it
 * through a plain-language EARS surface; this typed record is what the validator resolves and what
 * compiles 1:N to webcases (#714 Fork 2 = compile-to). `role` is optional (a slice-A authoring detail,
 * #714); every other slot is required.
 */
export interface RequirementRecord {
  /** Plain-language statement of the requirement (the EARS sentence's intent). */
  readonly description: string;
  /** Governance persona the requirement is written from — resolved against the injected roster if present. */
  readonly role?: string;
  /** Precondition: an intent-dimension value (`intents.json#<intent>` → `<dimension>` → `<value>`). */
  readonly given: { readonly intent: string; readonly dimension: string; readonly value: string };
  /** Trigger: a semantic event/term (`semantics.json#<term>`). */
  readonly when: { readonly event: string };
  /** Outcome: a protocol-observable state/event at a conformance tier (`protocols.json#<protocol>`). */
  readonly then: { readonly protocol: string; readonly observe: string; readonly tier: string };
}

/** The live registries the resolver grounds slots against — injected, never imported (no `_data` coupling). */
export interface RequirementRegistries {
  readonly intents: ReadonlyArray<{ id: string; dimensions?: Record<string, { values?: readonly string[] }> }>;
  readonly semantics: ReadonlyArray<{ term: string }>;
  readonly protocols: ReadonlyArray<{ id: string }>;
  /** Governance persona roster (plateau-app-owned, #141/#166). Omit to skip `role` resolution. */
  readonly personas?: readonly string[];
}

/** One unresolved (or un-groundable) slot reference, pointed at the exact slot path. */
export interface RequirementFinding {
  /** Dotted slot path, e.g. `given.dimension`, `then.tier`. */
  readonly slot: string;
  /** The reference value that failed to resolve. */
  readonly reference: string;
  /** `error` = a hard grounding failure (fails validation); `info` = un-groundable today (no registry yet). */
  readonly severity: 'error' | 'info';
  readonly message: string;
}

/** Validation result: the findings plus the derived `valid` flag (no `error`-severity findings). */
export interface RequirementValidation {
  readonly valid: boolean;
  readonly findings: readonly RequirementFinding[];
}

/**
 * Resolve every typed slot of `req` against the injected `registries`, returning a slot-pointed finding for
 * each unresolved reference. Deterministic and side-effect-free.
 */
export function validateRequirement(
  req: RequirementRecord,
  registries: RequirementRegistries,
): RequirementValidation {
  const findings: RequirementFinding[] = [];
  const err = (slot: string, reference: string, message: string) =>
    findings.push({ slot, reference, severity: 'error', message });

  // role → governance persona (only if a roster is injected; the slot itself is optional).
  if (req.role !== undefined && registries.personas) {
    if (!registries.personas.includes(req.role)) {
      err('role', req.role, `no governance persona "${req.role}" in the injected roster`);
    }
  }

  // given → an intent-dimension value: intent, then its dimension, then that dimension's value.
  const intent = registries.intents.find((i) => i.id === req.given.intent);
  if (!intent) {
    err('given.intent', req.given.intent, `no intent "${req.given.intent}" in intents.json`);
  } else {
    const dimension = intent.dimensions?.[req.given.dimension];
    if (!dimension) {
      err('given.dimension', req.given.dimension, `intent "${req.given.intent}" has no dimension "${req.given.dimension}"`);
    } else if (!(dimension.values ?? []).includes(req.given.value)) {
      err('given.value', req.given.value, `dimension "${req.given.intent}.${req.given.dimension}" has no value "${req.given.value}"`);
    }
  }

  // when → a semantic event/term.
  if (!registries.semantics.some((t) => t.term === req.when.event)) {
    err('when.event', req.when.event, `no semantic term "${req.when.event}" in semantics.json`);
  }

  // then → a protocol-observable state/event at a conformance tier.
  if (!registries.protocols.some((p) => p.id === req.then.protocol)) {
    err('then.protocol', req.then.protocol, `no protocol "${req.then.protocol}" in protocols.json`);
  }
  if (!(CONFORMANCE_TIERS as readonly string[]).includes(req.then.tier)) {
    err('then.tier', req.then.tier, `tier "${req.then.tier}" is not a conformance tier (${CONFORMANCE_TIERS.join(', ')})`);
  }
  // then.observe has no registry yet (protocols.json models no observable states) — an info, not a hard fail.
  if (req.then.observe.trim() === '') {
    err('then.observe', req.then.observe, 'observe is empty');
  } else {
    findings.push({
      slot: 'then.observe',
      reference: req.then.observe,
      severity: 'info',
      message: 'observable-state grounding is pending an observable registry; protocol + tier are grounded',
    });
  }

  return { valid: findings.every((f) => f.severity !== 'error'), findings };
}
