/**
 * @file webcases/caseToVector.ts
 * @description The **case-to-test bridge** (backlog #1162, ruling #1233-A) — the consumer the compiler's
 *   assert-directive was missing. `compileRequirement` emits `<!-- assert: protocol observe tier kind -->`
 *   into every webcase but nothing read it; this lowers a typed requirement (or that directive) to a minimal
 *   behavioral {@link ConformanceVector} the #899 driver (FUI/plateau) can run.
 *
 * Ruling #1233 — **Fork 1 → A (reachability lowering):** the directive carries no expected *value* (neither
 * it, nor `ProtocolObservable`, nor the authored `then` does), so the only semantics the contract can mean is
 * **reachability** — assert the named observable was *reached* (a `state`) or *fired* (an `event`) at its
 * tier, derived from the #1201 `kind` token. No registry/authoring change: the vector lowers standalone and
 * the schema gains only the optional `tier` field. Value-equality lowering (B) is the sanctioned future layer
 * #1235, scoped to the value-bearing minority of state observables — out of scope here.
 *
 * WE-resident + dependency-free (the `compileRequirement.ts`/`driftCheck.ts` pattern): this produces the
 * vector *contract*; executing + judging it stays the FUI/plateau driver's job (#817/#899, WE↛FUI runtime).
 */
import type { ObservableLookup } from './compileRequirement';
import { slugify } from './compileRequirement';
import type { RequirementRecord, ObservableKind } from './requirementValidator';
import type { ConformanceVector } from '../conformance-vectors/schema';

/** The four facts the compiler's assert-directive carries (the #1201 `kind` is present once a protocol declares observables). */
export interface AssertDirective {
  readonly protocol: string;
  readonly observe: string;
  readonly tier: string;
  readonly kind?: ObservableKind;
}

const DIRECTIVE_RE = /<!--\s*assert:\s*protocol="([^"]*)"\s+observe="([^"]*)"\s+tier="([^"]*)"(?:\s+kind="([^"]*)")?\s*-->/;

/**
 * Parse the `<!-- assert: ... -->` directive a compiled webcase carries (the artifact `compileRequirement`
 * emits) into its four facts — the consumer that closes the "nothing reads the directive" gap. Returns null
 * when the code carries no directive. `kind` is `undefined` when the protocol declared no observables yet.
 */
export function parseAssertDirective(code: string): AssertDirective | null {
  const m = DIRECTIVE_RE.exec(code);
  if (!m) return null;
  const kind = m[4] === 'state' || m[4] === 'event' ? m[4] : undefined;
  return { protocol: m[1], observe: m[2], tier: m[3], kind };
}

/** The surface a reachability outcome is read through, by kind. An event is read via the event stream; a
 *  state via its declared platform surface (aria/validity/…) when known, else the generic `state` surface. */
function observeSurface(kind: ObservableKind | undefined, platform?: string): string {
  if (kind === 'event') return 'events';
  return platform ?? 'state';
}

/**
 * Lower a (validated) requirement to a behavioral conformance vector. Two layers:
 *
 *  - **Reachability (#1233-A, the floor):** the vector asserts the named observable was reached/fired at
 *    its tier — `{ reached: <observe> }` for a state, `{ fired: <observe> }` for an event.
 *  - **Value-equality (#1235, the B-layer):** for the value-bearing minority of STATE observables
 *    (`valueBearing: true`) where reaching != the right value, when the requirement authors an expected
 *    `then.value` the vector additionally asserts the literal — `{ reached: <observe>, equals: <value> }`
 *    (value-equality subsumes reachability). Per-observable opt-in: never applies to an `event` observable
 *    (firing IS the value) nor to a non-`valueBearing` state observable (reachability suffices).
 *
 * `steps` replay the requirement's precondition then trigger; `tier` rides the schema field. The observable's
 * `kind` + `valueBearing` are resolved from the same injected `lookup` the compiler uses (omit it and an
 * unknown observable falls back to `state` reachability — the most-flexible default).
 */
export function lowerRequirementToVector(record: RequirementRecord, lookup?: ObservableLookup): ConformanceVector {
  const { protocol, observe, tier, value } = record.then;
  const observable = lookup?.protocols
    .find((p) => p.id === protocol)
    ?.observables?.find((o) => o.id === observe);
  const kind = observable?.kind;
  const platform = (observable as { platform?: string } | undefined)?.platform;
  // Value-equality only for a value-bearing STATE observable with an authored expected literal (#1235);
  // everything else stays on the reachability floor.
  const valueEquality = kind === 'state' && observable?.valueBearing === true && value !== undefined;

  const expect = kind === 'event'
    ? { fired: observe }
    : valueEquality
      ? { reached: observe, equals: value }
      : { reached: observe };

  const description = valueEquality
    ? `Value-equality: ${protocol} ${observe} equals "${value}" at ${tier} when ${record.when.event}.`
    : `Reachability: ${protocol} ${kind === 'event' ? 'fires' : 'reaches'} ${observe} at ${tier} when ${record.when.event}.`;

  return {
    id: `${protocol}/${slugify(observe)}/${slugify(record.description)}`,
    contract: `@webeverything/${protocol}`,
    steps: [
      { do: 'setGiven', intent: record.given.intent, dimension: record.given.dimension, value: record.given.value },
      { do: 'trigger', event: record.when.event },
    ],
    expect,
    observeVia: [observeSurface(kind, platform)],
    tier,
    description,
  };
}
