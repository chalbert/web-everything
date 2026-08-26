/**
 * @file registry.test.mjs — the declaration shape and the closed vocabulary (#3032).
 *
 * THE LOAD-BEARING TEST IN HERE is the fifth-kind refusal. The statute
 * (#operations-declared-once-callers-generated, #3031) says *"an operation that appears to need a fifth
 * kind is a signal to change the model, not to extend the vocabulary"* — and the difference between that
 * being a rule and being a sentence is whether the refusal happens at REGISTRATION. A run-time refusal
 * would let a bad declaration ship and only fail on the unlucky path; these tests pin that `op()` itself
 * throws, before any run record exists.
 */

import { describe, it, expect } from 'vitest';

import {
  INPUT_TYPES,
  RESERVED_DECLARATION_KEYS,
  createRegistry,
  defaultRegistry,
  defineOperation,
  normalizeInputSchema,
  op,
  validateInput,
} from '../registry.mjs';
import { STEP_KINDS, compute, confirm, effect, isStep, judge } from '../step-kinds.mjs';

const noop = compute({ fn: () => 1 });

describe('the closed step vocabulary', () => {
  it('is exactly four kinds', () => {
    expect(STEP_KINDS).toEqual(['compute', 'judge', 'confirm', 'effect']);
  });

  it('accepts a declaration using all four and nothing else', () => {
    const declaration = op('four', {
      input: { pr: 'number' },
      a: compute({ reads: ['input.pr'], fn: (v) => v.input.pr }),
      b: judge({ reads: ['findings.a'], request: () => ({ mandate: 'm', input: 'i', shape: {} }) }),
      c: confirm({ asks: 'ok?', of: 'operator' }),
      d: effect({ effects: () => [] }),
    });
    expect(declaration.stepNames).toEqual(['a', 'b', 'c', 'd']);
    expect(declaration.steps.map((s) => s.step.kind)).toEqual(['compute', 'judge', 'confirm', 'effect']);
    expect(declaration.steps.map((s) => s.index)).toEqual([0, 1, 2, 3]);
  });

  it('REFUSES a fifth kind at registration, not at run time', () => {
    expect(() => op('fifth', {
      a: noop,
      notify: { kind: 'notify', to: 'operator' },
    })).toThrow(/key `notify` is not a step \(kind "notify"\)[\s\S]*vocabulary is closed at compute\|judge\|confirm\|effect/);
  });

  it('names the statute in the refusal, so the reader is pointed at the model, not at a workaround', () => {
    expect(() => op('fifth', { a: noop, spawnAgent: { kind: 'agent' } }))
      .toThrow(/signal to change the model, not to extend the vocabulary/);
  });

  it('refuses a hand-rolled lookalike carrying a legitimate kind name', () => {
    // Branding matters: without it, `{ kind: 'compute', fn }` would slip past every validation the real
    // constructor performs.
    expect(isStep({ kind: 'compute', fn: () => 1 })).toBe(false);
    expect(() => op('forged', { a: { kind: 'compute', fn: () => 1 } })).toThrow(/is not a step/);
  });

  it('refuses a stray non-step key, so a typo cannot become a silent no-op', () => {
    expect(() => op('typo', { a: noop, descriptoin: 'oops' })).toThrow(/the only non-step keys are input\|verdictFrom\|declaresOver/);
    // PINNED DELIBERATELY. Every name in this set is a key that stops being a typo and starts being accepted
    // silently, so widening it must be a decision made in this file rather than a side effect of an edit
    // somewhere else. `declaresOver` was added by #3224.
    expect(RESERVED_DECLARATION_KEYS).toEqual(['input', 'verdictFrom', 'declaresOver']);
  });

  it('refuses an operation with no steps', () => {
    expect(() => op('empty', { input: { pr: 'number' } })).toThrow(/needs at least one step/);
  });
});

describe('step constructors validate their own shape', () => {
  it('compute needs a fn', () => expect(() => compute({})).toThrow(/needs an `fn`/));
  it('judge needs a request fn', () => expect(() => judge({})).toThrow(/needs a `request`/));
  it('confirm needs asks and of', () => {
    expect(() => confirm({ of: 'operator' })).toThrow(/needs `asks`/);
    expect(() => confirm({ asks: 'ok?' })).toThrow(/needs `of`/);
  });
  it('effect needs an effects fn', () => expect(() => effect({})).toThrow(/needs an `effects`/));
  it('confirm refuses an empty option set', () => {
    expect(() => confirm({ asks: 'ok?', of: 'operator', options: [] })).toThrow(/non-empty array of strings/);
  });
});

describe('declared reads are checked against what exists at that point in the run', () => {
  it('refuses a read of a LATER step\'s finding', () => {
    expect(() => op('forward', {
      a: compute({ reads: ['findings.b'], fn: () => 1 }),
      b: compute({ fn: () => 2 }),
    })).toThrow(/declared LATER in the run/);
  });

  it('refuses a read of a step that does not exist at all', () => {
    expect(() => op('ghost', { a: compute({ reads: ['findings.nope'], fn: () => 1 }) }))
      .toThrow(/not a declared step/);
  });

  it('refuses a read of an undeclared input field', () => {
    expect(() => op('badfield', {
      input: { pr: 'number' },
      a: compute({ reads: ['input.sha'], fn: () => 1 }),
    })).toThrow(/the input schema has no field `sha`/);
  });

  it('refuses a read root outside input|findings|verdict', () => {
    expect(() => compute({ reads: ['process.env'], fn: () => 1 })).toThrow(/the root must be one of input\|findings\|verdict/);
  });

  it('refuses a bare `findings` read — the step must name what it reads', () => {
    expect(() => op('wild', { a: compute({ reads: ['findings'], fn: () => 1 }) })).toThrow(/name the step/);
  });

  it('refuses a sub-path under verdict and a three-segment path', () => {
    expect(() => op('deep', { a: compute({ reads: ['verdict.value'], fn: () => 1 }) })).toThrow(/`verdict` takes no sub-path/);
    expect(() => compute({ reads: ['input.a.b'], fn: () => 1 })).toThrow(/at most two segments/);
  });

  it('allows a read of an EARLIER step\'s finding and of the whole input', () => {
    expect(() => op('fine', {
      input: { pr: 'number' },
      a: compute({ reads: ['input'], fn: () => 1 }),
      b: compute({ reads: ['findings.a', 'verdict'], fn: () => 2 }),
    })).not.toThrow();
  });
});

describe('verdictFrom', () => {
  it('must name a declared step', () => {
    expect(() => op('v', { a: noop, verdictFrom: 'ghost' })).toThrow(/must name a declared step/);
  });
  it('defaults to null', () => {
    expect(op('v', { a: noop }).verdictFrom).toBeNull();
  });
  it('is recorded when valid', () => {
    expect(op('v', { a: noop, verdictFrom: 'a' }).verdictFrom).toBe('a');
  });
});

describe('the input schema', () => {
  it('treats a shorthand type as REQUIRED — optionality is opt-in', () => {
    const schema = normalizeInputSchema({ pr: 'number' }, 'x');
    // `atConfirm: false` is part of the normalized shape (#3035) — every field answers "when may this be
    // supplied", and the shorthand answers "at start", like everything before it.
    expect(schema.pr).toEqual({ type: 'number', required: true, default: undefined, enum: null, atConfirm: false });
    expect(validateInput(schema, {}).errors).toEqual(['missing required input field `pr` (number)']);
  });

  // ── `atConfirm` — WHEN A FIELD MAY BE SUPPLIED (#3035) ──────────────────────────────────────────────────
  // The marker exists because `review-pr`'s `reason` qualifies the operator's DECISION, which does not exist
  // until the run has suspended and asked. It stays a declared field (so a step may `read` it) and moves only
  // in WHEN it arrives. See the retracted example in this module's header for the two shapes that did not work.
  describe('atConfirm', () => {
    it('marks the field and defaults to false', () => {
      const schema = normalizeInputSchema({ why: { type: 'string', required: false, atConfirm: true } }, 'x');
      expect(schema.why.atConfirm).toBe(true);
      expect(normalizeInputSchema({ why: { type: 'string', required: false } }, 'x').why.atConfirm).toBe(false);
    });

    it('refuses a non-boolean marker', () => {
      expect(() => normalizeInputSchema({ why: { type: 'string', required: false, atConfirm: 'yes' } }, 'x'))
        .toThrow(/`atConfirm` must be a boolean/);
    });

    it('refuses `required` — nothing can supply it when `required` is checked', () => {
      expect(() => normalizeInputSchema({ why: { type: 'string', atConfirm: true } }, 'x'))
        .toThrow(/cannot also be `required`/);
    });

    it('refuses a `default` — a canned answer would satisfy the guard the field exists to feed', () => {
      expect(() => normalizeInputSchema({ why: { type: 'string', required: false, atConfirm: true, default: 'x' } }, 'x'))
        .toThrow(/cannot carry a `default`/);
    });

    it('is REFUSED at start by validateInput, and is absent rather than defaulted when omitted', () => {
      const schema = normalizeInputSchema({ pr: 'number', why: { type: 'string', required: false, atConfirm: true } }, 'x');
      expect(validateInput(schema, { pr: 1, why: 'too early' }).errors.join(' '))
        .toMatch(/supplied at confirm time, not at start/);
      const ok = validateInput(schema, { pr: 1 });
      expect(ok.ok).toBe(true);
      expect(ok.value).toEqual({ pr: 1 });
    });

    it('may be named in a step\'s `reads` — that is the whole point of it staying a declared field', () => {
      const declared = op('with-confirm-input', {
        input: { why: { type: 'string', required: false, atConfirm: true } },
        only: compute({ reads: ['input.why'], fn: (v) => v.input.why ?? null }),
      });
      expect(declared.steps[0].step.reads).toEqual(['input.why']);
    });
  });

  it('refuses an unknown type', () => {
    expect(() => normalizeInputSchema({ pr: 'bigint' }, 'x')).toThrow(new RegExp(`must be one of ${INPUT_TYPES.join('\\|')}`));
  });

  it('refuses a required field that also carries a default', () => {
    expect(() => normalizeInputSchema({ pr: { type: 'number', default: 1 } }, 'x')).toThrow(/cannot also carry a `default`/);
  });

  it('FAILS CLOSED on an unknown input field — nothing gets smuggled past the declaration', () => {
    const schema = normalizeInputSchema({ pr: 'number' }, 'x');
    const result = validateInput(schema, { pr: 1, sneaky: true });
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(['unknown input field `sneaky` — the declaration does not accept it']);
  });

  it('type-checks, distinguishing array from object and rejecting null', () => {
    const schema = normalizeInputSchema({ tags: 'array', meta: 'object' }, 'x');
    expect(validateInput(schema, { tags: [], meta: {} }).ok).toBe(true);
    expect(validateInput(schema, { tags: {}, meta: {} }).errors).toContain('input field `tags` must be a array, got object');
    expect(validateInput(schema, { tags: [], meta: null }).errors).toContain('input field `meta` must be a object, got null');
  });

  it('fills a declared default for an omitted optional field', () => {
    const schema = normalizeInputSchema({ note: { type: 'string', required: false, default: 'none' } }, 'x');
    expect(validateInput(schema, {}).value).toEqual({ note: 'none' });
  });
});

// A CLOSED VALUE SET, DECLARED ONCE. It buys the refusal AND the `--help` text AND #3036's HTTP validation
// from one line — the alternative being each adapter re-listing the same vocabulary, which is the
// two-readers-of-one-contract defect the whole statute is about.
describe('the input schema — a declared enum', () => {
  const lens = (extra = {}) => normalizeInputSchema(
    { lens: { type: 'string', required: false, default: 'a', enum: ['a', 'b'], ...extra } }, 'x',
  );

  it('normalizes to a frozen member list a caller cannot mutate', () => {
    const schema = lens();
    expect(schema.lens.enum).toEqual(['a', 'b']);
    expect(Object.isFrozen(schema.lens.enum)).toBe(true);
  });

  it('refuses a value outside the set, BEFORE a run record exists, and names the set', () => {
    const result = validateInput(lens(), { lens: 'c' });
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(['input field `lens` must be one of a|b, got "c"']);
  });

  it('accepts a member, and still fills the default when omitted', () => {
    expect(validateInput(lens(), { lens: 'b' }).value).toEqual({ lens: 'b' });
    expect(validateInput(lens(), {}).value).toEqual({ lens: 'a' });
  });

  it('refuses a declaration whose own default is not a member — that is a run that dies on its schema', () => {
    expect(() => lens({ default: 'z' })).toThrow(/defaults to "z", which is not one of its own declared values/);
  });

  it('refuses a malformed or mistyped set at DECLARATION time, not at run time', () => {
    expect(() => normalizeInputSchema({ f: { type: 'string', enum: [] } }, 'x')).toThrow(/non-empty array/);
    expect(() => normalizeInputSchema({ f: { type: 'string', enum: ['a', 'a'] } }, 'x')).toThrow(/repeats a value/);
    expect(() => normalizeInputSchema({ f: { type: 'string', enum: [1] } }, 'x')).toThrow(/is not a string/);
    expect(() => normalizeInputSchema({ f: { type: 'object', enum: [{}] } }, 'x')).toThrow(/cannot declare an `enum`/);
  });

  it('works on numbers too, and a number field with no enum is unconstrained as before', () => {
    const schema = normalizeInputSchema({ n: { type: 'number', enum: [1, 2] }, m: 'number' }, 'x');
    expect(validateInput(schema, { n: 3, m: 99 }).errors).toEqual(['input field `n` must be one of 1|2, got 3']);
    expect(validateInput(schema, { n: 2, m: 99 }).ok).toBe(true);
  });
});

describe('the registry', () => {
  it('THROWS on an unknown name rather than returning undefined', () => {
    const registry = createRegistry();
    expect(() => registry.get('nope')).toThrow(/no operation named "nope" is registered \(the registry is empty\)/);
    registry.register(op('known', { a: noop }));
    expect(() => registry.get('nope')).toThrow(/known: known/);
  });

  it('refuses a second, different declaration under a taken name', () => {
    const registry = createRegistry();
    registry.register(op('dup', { a: noop }));
    expect(() => registry.register(op('dup', { a: noop }))).toThrow(/already registered with a different declaration/);
  });

  it('is a no-op when the SAME frozen declaration is registered twice', () => {
    const registry = createRegistry();
    const declaration = op('same', { a: noop });
    registry.register(declaration);
    expect(() => registry.register(declaration)).not.toThrow();
    expect(registry.names()).toEqual(['same']);
  });

  it('refuses a hand-built object that never went through op()', () => {
    expect(() => createRegistry().register({ name: 'fake' })).toThrow(/expects a declaration built by `op\(name, …\)`/);
  });

  it('ships EMPTY — #3032 is the machine; #3035 is the first declaration onto it', () => {
    expect(defaultRegistry.names()).toEqual([]);
  });

  it('defineOperation registers into the default registry', () => {
    try {
      defineOperation('temp-op', { a: noop });
      expect(defaultRegistry.has('temp-op')).toBe(true);
    } finally {
      defaultRegistry.clear();
    }
    expect(defaultRegistry.names()).toEqual([]);
  });
});
