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
 * `then.observe` grounds **progressively** (#1160/#1201): a protocol now co-locates an `observables` list
 * (`src/_data/protocols/<id>.json`), and once the resolved protocol declares observables the token must
 * name one — a hard `error` otherwise. A protocol that declares none still grounds soft (an `info`), so the
 * observable registry rolls out one protocol at a time without breaking requirements against the rest.
 */

/** The fixed WE conformance-tier vocabulary a `then` outcome is asserted at. */
export const CONFORMANCE_TIERS = ['L1', 'L2', 'L3'] as const;
export type ConformanceTier = (typeof CONFORMANCE_TIERS)[number];

/** An observable's nature: a readable state vs a fired event (the #1162 bridge reads-a-state vs awaits-an-event). */
export type ObservableKind = 'state' | 'event';

/**
 * A protocol-declared observable — the typed grounding target for a requirement's `then.observe`
 * (#1160/#1201). Co-located on the protocol record (`src/_data/protocols/<id>.json#observables`); `platform`
 * names the surface it's read through (`aria`, `validity`, `event`, …) when relevant.
 */
export interface ProtocolObservable {
  readonly id: string;
  readonly kind: ObservableKind;
  readonly platform?: string;
  /**
   * Value-equality opt-in (#1235, the B-layer over the #1162/#1233-A reachability floor). `true` marks the
   * minority of value-bearing STATE observables (current-value, validity-state, entity-timeline) where
   * *reaching* the observable is not enough — the right *value* must be asserted. Absent/false ⇒ the
   * observable lowers to a reachability vector (the floor). Never set on an `event` observable (firing IS
   * the value) nor on a value-as-identity observable (distinct observables, reachability suffices).
   */
  readonly valueBearing?: boolean;
}

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
  /**
   * Outcome: a protocol-observable state/event at a conformance tier (`protocols.json#<protocol>`).
   * `value` is the optional **expected literal** (#1235): authored only for a value-bearing state
   * observable, it lowers the requirement to a value-equality vector instead of a reachability one.
   */
  readonly then: { readonly protocol: string; readonly observe: string; readonly tier: string; readonly value?: string };
}

/** The live registries the resolver grounds slots against — injected, never imported (no `_data` coupling). */
export interface RequirementRegistries {
  readonly intents: ReadonlyArray<{ id: string; dimensions?: Record<string, { values?: readonly string[] }> }>;
  readonly semantics: ReadonlyArray<{ term: string }>;
  readonly protocols: ReadonlyArray<{ id: string; observables?: readonly ProtocolObservable[] }>;
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
  const thenProtocol = registries.protocols.find((p) => p.id === req.then.protocol);
  if (!thenProtocol) {
    err('then.protocol', req.then.protocol, `no protocol "${req.then.protocol}" in protocols.json`);
  }
  if (!(CONFORMANCE_TIERS as readonly string[]).includes(req.then.tier)) {
    err('then.tier', req.then.tier, `tier "${req.then.tier}" is not a conformance tier (${CONFORMANCE_TIERS.join(', ')})`);
  }
  // then.observe → progressive-hard grounding (#1160/#1201): once the resolved protocol DECLARES
  // observables, the token must name one (hard error otherwise); a protocol that declares none still
  // grounds soft (an info), so the registry rolls out per-protocol without breaking ungrounded ones.
  const observables = thenProtocol?.observables ?? [];
  if (req.then.observe.trim() === '') {
    err('then.observe', req.then.observe, 'observe is empty');
  } else if (observables.length > 0) {
    const matched = observables.find((o) => o.id === req.then.observe);
    if (!matched) {
      err(
        'then.observe',
        req.then.observe,
        `no observable "${req.then.observe}" on protocol "${req.then.protocol}" (declares: ${observables.map((o) => o.id).join(', ')})`,
      );
    } else if (req.then.value !== undefined) {
      // Value-equality opt-in guard (#1235): an authored expected `value` is only meaningful for a
      // value-bearing STATE observable. On a reachability-only or event observable it would silently never
      // lower to a value-equality vector, so reject it rather than drop it.
      if (matched.kind !== 'state' || matched.valueBearing !== true)
        err(
          'then.value',
          req.then.value,
          `observable "${req.then.observe}" on "${req.then.protocol}" is not a value-bearing state observable (kind="${matched.kind}", valueBearing=${matched.valueBearing ?? false}) — an expected \`then.value\` only lowers to a value-equality vector for a \`valueBearing: true\` state observable (#1235); drop the value or mark the observable value-bearing`,
        );
    }
  } else {
    findings.push({
      slot: 'then.observe',
      reference: req.then.observe,
      severity: 'info',
      message: 'observable-state grounding is pending — the resolved protocol declares no observables; protocol + tier are grounded',
    });
  }

  return { valid: findings.every((f) => f.severity !== 'error'), findings };
}
