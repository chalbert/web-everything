// Requirement-as-code slice A (#100): the meta-schema + deterministic slot validator, exercised against
// the LIVE registries (intents/semantics/protocols.json) — proving "verifiable by construction": a
// requirement whose slots all resolve validates green; one naming a nonexistent registry term fails with a
// slot-pointed finding. Mirrors the #714 worked example, grounded to terms that actually exist in the tree.
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import {
  validateRequirement,
  type RequirementRecord,
  type RequirementRegistries,
} from '../requirementValidator';

const require = createRequire(import.meta.url);
const intents = require('../../src/_data/intents.json') as RequirementRegistries['intents'];
const semantics = require('../../src/_data/semantics.json') as RequirementRegistries['semantics'];
const protocols = require('../../src/_data/protocols.json') as RequirementRegistries['protocols'];

// The governance persona roster is plateau-app-owned (#141/#166) — injected here, never imported (#475).
const personas = ['end-user', 'developer', 'designer', 'operator'] as const;
const registries: RequirementRegistries = { intents, semantics, protocols, personas: [...personas] };

// The #714 worked example, grounded to real registry terms: validation intent's `execution: blur`
// dimension value, the `Commit Policy` semantic term, the `validation` protocol at L1.
const grounded: RequirementRecord = {
  description: 'validation errors surface immediately on blur',
  role: 'end-user',
  given: { intent: 'validation', dimension: 'execution', value: 'blur' },
  when: { event: 'Commit Policy' },
  then: { protocol: 'validation', observe: 'invalid-state-announced', tier: 'L1' },
};

describe('requirement-as-code validator (#100 slice A)', () => {
  it('validates the worked-example requirement green — every typed slot resolves', () => {
    const result = validateRequirement(grounded, registries);
    expect(result.findings.filter((f) => f.severity === 'error')).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('still grounds protocol + tier, surfacing observe as info (no observable registry yet)', () => {
    const result = validateRequirement(grounded, registries);
    const observe = result.findings.find((f) => f.slot === 'then.observe');
    expect(observe?.severity).toBe('info');
  });

  it('fails a requirement naming nonexistent registry terms, pointing at each offending slot', () => {
    const broken: RequirementRecord = {
      ...grounded,
      given: { intent: 'validation', dimension: 'timing', value: 'on-blur' }, // no `timing` dimension
      when: { event: 'control-blur' }, // not a semantics term
      then: { protocol: 'no-such-protocol', observe: 'x', tier: 'L9' },
    };
    const result = validateRequirement(broken, registries);
    expect(result.valid).toBe(false);
    const errorSlots = result.findings.filter((f) => f.severity === 'error').map((f) => f.slot).sort();
    expect(errorSlots).toEqual(['given.dimension', 'then.protocol', 'then.tier', 'when.event']);
  });

  it('flags an unknown governance persona against the injected roster', () => {
    const result = validateRequirement({ ...grounded, role: 'martian' }, registries);
    expect(result.findings.some((f) => f.slot === 'role' && f.severity === 'error')).toBe(true);
  });

  it('skips role resolution when no roster is injected (role is an optional slot)', () => {
    const result = validateRequirement({ ...grounded, role: 'anything' }, { intents, semantics, protocols });
    expect(result.valid).toBe(true);
  });
});
