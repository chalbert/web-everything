/**
 * Case-to-test bridge tests (backlog #1162, ruling #1233-A). Proves the bridge (1) consumes the compiler's
 * assert-directive (closing the "nothing reads it" gap), (2) lowers a requirement to a REACHABILITY vector —
 * `reached` for a state, `fired` for an event, derived from the #1201 `kind`, never a value (B/#1235), (3)
 * emits a structurally-valid `ConformanceVector` the #899 driver can run, and (4) round-trips with the
 * compiler — the directive it parses names the same facts the lowering used.
 */
import { describe, it, expect } from 'vitest';
import { parseAssertDirective, lowerRequirementToVector } from '../caseToVector';
import { compileRequirement, type ObservableLookup } from '../compileRequirement';
import type { RequirementRecord } from '../requirementValidator';
import { assertConformanceSuite } from '../../conformance-vectors/schema';

const record: RequirementRecord = {
  description: 'invalid input announces an error',
  given: { intent: 'text-input', dimension: 'validity', value: 'invalid' },
  when: { event: 'blur' },
  then: { protocol: 'validator-resolution', observe: 'invalid-state-announced', tier: 'aa' },
};

const stateLookup: ObservableLookup = {
  protocols: [{ id: 'validator-resolution', observables: [{ id: 'invalid-state-announced', kind: 'state', platform: 'aria' }] }],
};
const eventLookup: ObservableLookup = {
  protocols: [{ id: 'validator-resolution', observables: [{ id: 'invalid-state-announced', kind: 'event' }] }],
};

describe('parseAssertDirective — consume the compiler directive', () => {
  it('parses protocol/observe/tier/kind from a compiled case', () => {
    const [compiled] = compileRequirement(record, stateLookup);
    expect(parseAssertDirective(compiled.code)).toEqual({
      protocol: 'validator-resolution',
      observe: 'invalid-state-announced',
      tier: 'aa',
      kind: 'state',
    });
  });

  it('kind is undefined when the protocol declared no observables (pre-#1201 directive)', () => {
    const [compiled] = compileRequirement(record); // no lookup → no kind attr
    expect(parseAssertDirective(compiled.code)?.kind).toBeUndefined();
  });

  it('returns null when there is no directive', () => {
    expect(parseAssertDirective('<main>no directive here</main>')).toBeNull();
  });
});

describe('lowerRequirementToVector — reachability lowering (#1233-A)', () => {
  it('a STATE observable lowers to a `reached` expectation read via its platform surface', () => {
    const v = lowerRequirementToVector(record, stateLookup);
    expect(v.expect).toEqual({ reached: 'invalid-state-announced' });
    expect(v.observeVia).toEqual(['aria']);
    expect(v.tier).toBe('aa');
    expect(v.contract).toBe('@webeverything/validator-resolution');
  });

  it('an EVENT observable lowers to a `fired` expectation read via the event stream', () => {
    const v = lowerRequirementToVector(record, eventLookup);
    expect(v.expect).toEqual({ fired: 'invalid-state-announced' });
    expect(v.observeVia).toEqual(['events']);
  });

  it('falls back to state-reachability (most-flexible default) when kind is unknown', () => {
    const v = lowerRequirementToVector(record); // no lookup
    expect(v.expect).toEqual({ reached: 'invalid-state-announced' });
    expect(v.observeVia).toEqual(['state']);
  });

  it('replays the requirement precondition + trigger as steps', () => {
    const v = lowerRequirementToVector(record, stateLookup);
    expect(v.steps).toEqual([
      { do: 'setGiven', intent: 'text-input', dimension: 'validity', value: 'invalid' },
      { do: 'trigger', event: 'blur' },
    ]);
  });

  it('emits a structurally-valid ConformanceVector the driver can run', () => {
    const v = lowerRequirementToVector(record, stateLookup);
    expect(() => assertConformanceSuite({
      standard: 'validator-resolution',
      contract: v.contract,
      vectors: [v],
    })).not.toThrow();
  });
});

describe('compiler ↔ bridge round-trip', () => {
  it('the directive the compiler emits names the same facts the lowering used', () => {
    const [compiled] = compileRequirement(record, stateLookup);
    const directive = parseAssertDirective(compiled.code)!;
    const vector = lowerRequirementToVector(record, stateLookup);
    expect(directive.protocol).toBe(record.then.protocol);
    expect(directive.observe).toBe(record.then.observe);
    expect(directive.tier).toBe(vector.tier);
    // kind=state → reachability `reached`, matching the directive's kind
    expect(directive.kind).toBe('state');
    expect(vector.expect).toEqual({ reached: directive.observe });
  });
});

describe('lowerRequirementToVector — value-equality lowering (#1235, B-layer)', () => {
  const valueBearingLookup: ObservableLookup = {
    protocols: [{ id: 'text-state', observables: [{ id: 'current-value', kind: 'state', platform: 'value', valueBearing: true }] }],
  };
  const valueRecord: RequirementRecord = {
    description: 'committed value equals the typed text',
    given: { intent: 'text-input', dimension: 'validity', value: 'invalid' },
    when: { event: 'change' },
    then: { protocol: 'text-state', observe: 'current-value', tier: 'aa', value: 'hello' },
  };

  it('lowers a value-bearing state observable + expected value to a value-equality vector', () => {
    const v = lowerRequirementToVector(valueRecord, valueBearingLookup);
    expect(v.expect).toEqual({ reached: 'current-value', equals: 'hello' });
    expect(v.description).toMatch(/Value-equality/);
  });

  it('stays reachability when the observable is NOT valueBearing, even if a value is authored', () => {
    const plain: ObservableLookup = {
      protocols: [{ id: 'text-state', observables: [{ id: 'current-value', kind: 'state', platform: 'value' }] }],
    };
    const v = lowerRequirementToVector(valueRecord, plain);
    expect(v.expect).toEqual({ reached: 'current-value' });
  });

  it('never value-equality on an event observable (firing IS the value)', () => {
    const ev: ObservableLookup = {
      protocols: [{ id: 'text-state', observables: [{ id: 'current-value', kind: 'event', valueBearing: true }] }],
    };
    const v = lowerRequirementToVector(valueRecord, ev);
    expect(v.expect).toEqual({ fired: 'current-value' });
  });

  it('stays reachability when valueBearing but no expected value is authored', () => {
    const noValue: RequirementRecord = { ...valueRecord, then: { ...valueRecord.then, value: undefined } };
    const v = lowerRequirementToVector(noValue, valueBearingLookup);
    expect(v.expect).toEqual({ reached: 'current-value' });
  });

  it('still emits a structurally-valid ConformanceVector', () => {
    const v = lowerRequirementToVector(valueRecord, valueBearingLookup);
    expect(() => assertConformanceSuite({ standard: 'text-state', contract: v.contract, vectors: [v] })).not.toThrow();
  });
});
