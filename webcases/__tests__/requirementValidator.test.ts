// Requirement-as-code slice A (#100): the meta-schema + deterministic slot validator, exercised against
// the LIVE registries (intents/semantics/protocols.json) — proving "verifiable by construction": a
// requirement whose slots all resolve validates green; one naming a nonexistent registry term fails with a
// slot-pointed finding. Mirrors the #714 worked example, grounded to terms that actually exist in the tree.
import { describe, it, expect } from 'vitest';
import {
  validateRequirement,
  type RequirementRecord,
  type RequirementRegistries,
} from '../requirementValidator';
import { intents as intentsData } from '../../src/_data/intents.data'; // per-intent specs assembled via Vite glob (#1145)
import { loadSemantics } from '../../scripts/lib/semantics-loader.cjs'; // per-term specs assembled (#1146)
import { loadProtocols } from '../../scripts/lib/protocols-loader.cjs'; // per-protocol specs assembled (#1146)

const intents = intentsData as unknown as RequirementRegistries['intents'];
const semantics = loadSemantics() as unknown as RequirementRegistries['semantics'];
const protocols = loadProtocols() as unknown as RequirementRegistries['protocols'];

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

  it('grounds then.observe HARD once the protocol declares the observable (#1160/#1201)', () => {
    // `validation` now declares `invalid-state-announced` as an observable, so it resolves with no finding —
    // not the old soft `info` fall-through.
    const result = validateRequirement(grounded, registries);
    expect(result.valid).toBe(true);
    expect(result.findings.find((f) => f.slot === 'then.observe')).toBeUndefined();
  });

  it('flags an undeclared observe token on an observable-declaring protocol as a hard error (#1201)', () => {
    const bad = { ...grounded, then: { ...grounded.then, observe: 'no-such-observable' } };
    const result = validateRequirement(bad, registries);
    const observe = result.findings.find((f) => f.slot === 'then.observe');
    expect(observe?.severity).toBe('error');
    expect(result.valid).toBe(false);
  });

  it('still grounds observe SOFT (info) on a protocol that declares no observables yet — progressive rollout', () => {
    const bare = registries.protocols.find((p) => !p.observables || p.observables.length === 0);
    expect(bare).toBeDefined();
    const result = validateRequirement(
      { ...grounded, then: { protocol: bare!.id, observe: 'anything', tier: 'L1' } },
      registries,
    );
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
