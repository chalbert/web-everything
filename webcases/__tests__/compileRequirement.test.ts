// Requirement-as-code slice B (#797) — the deterministic requirement→webcase compiler. Asserts the typed
// record projects to the expected webcase artifact, that the projection is deterministic (same in → same
// out) and dependency-free, and that 1:N is structural (array return). Uses the #714 worked example.
import { describe, it, expect } from 'vitest';
import type { RequirementRecord } from '../requirementValidator';
import { compileRequirement, slugify } from '../compileRequirement';

const requirement: RequirementRecord = {
  description: 'validation errors surface immediately on blur',
  role: 'end-user',
  given: { intent: 'validation', dimension: 'execution', value: 'blur' },
  when: { event: 'Commit Policy' },
  then: { protocol: 'validation', observe: 'invalid-state-announced', tier: 'L1' },
};

describe('slugify — stable kebab ids', () => {
  it('is deterministic and url-safe', () => {
    expect(slugify('validation errors surface immediately on blur')).toBe('validation-errors-surface-immediately-on-blur');
    expect(slugify('!!!')).toBe('requirement');
  });
});

describe('compileRequirement — typed record → webcase(s)', () => {
  it('projects the worked example to one webcase carrying the typed Given/When/Then', () => {
    const cases = compileRequirement(requirement);
    expect(cases).toHaveLength(1);
    const [c] = cases;
    expect(c.id).toBe('validation-errors-surface-immediately-on-blur.html');
    expect(c.code).toContain('Given validation.execution = blur');
    expect(c.code).toContain('When Commit Policy');
    expect(c.code).toContain('Then validation observes invalid-state-announced at L1');
    expect(c.code).toContain('assert: protocol="validation" observe="invalid-state-announced" tier="L1"');
    expect(c.title).toContain('invalid-state-announced');
  });

  it('is deterministic — same record compiles to byte-identical output', () => {
    expect(compileRequirement(requirement)).toEqual(compileRequirement(requirement));
  });

  it('returns an array (the 1:N contract)', () => {
    expect(Array.isArray(compileRequirement(requirement))).toBe(true);
  });

  it('reflects a changed outcome in the emitted assertion (no stale projection)', () => {
    const other = compileRequirement({ ...requirement, then: { ...requirement.then, tier: 'L2' } });
    expect(other[0].code).toContain('at L2');
    expect(other[0].code).not.toContain('at L1');
  });

  it('threads the observable kind into the assert directive when a lookup is supplied (#1160/#1201)', () => {
    const lookup = {
      protocols: [{ id: 'validation', observables: [{ id: 'invalid-state-announced', kind: 'event' as const }] }],
    };
    const [c] = compileRequirement(requirement, lookup);
    expect(c.code).toContain('assert: protocol="validation" observe="invalid-state-announced" tier="L1" kind="event"');
  });

  it('omits kind when no lookup (or no matching observable) is supplied — byte-identical to pre-#1201', () => {
    expect(compileRequirement(requirement)[0].code).not.toContain('kind=');
    const noMatch = { protocols: [{ id: 'validation', observables: [{ id: 'other', kind: 'state' as const }] }] };
    expect(compileRequirement(requirement, noMatch)[0].code).not.toContain('kind=');
  });
});
